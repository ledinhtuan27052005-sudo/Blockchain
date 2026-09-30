import { ethers } from 'ethers';
import contractArtifact from '../contractArtifacts.json' with { type: 'json' };
import {
  computeSerialHash,
  computeMetadataHash,
  computeOwnerHash,
  computeServiceRecordHash,
  buildServiceHistoryTree,
  defaultProductBatchTree
} from './merkle.js';
import { paymasterRelayActivateApi, requestFaucetEth, getWalletEthBalance } from './api.js';

// Helper tạo độ trễ vài giây để đồng bộ trực quan với ví MetaMask
const delay = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

// Link cai dat tien ich MetaMask tren Chrome Web Store
export const METAMASK_CHROME_STORE_URL = 'https://chromewebstore.google.com/detail/metamask/nkbihfbeogaeaoehlefnkodbefgpgknn';

// Cấu hình vai trò trong hệ thống thực tế (Không dùng tài khoản giả lập)
export const ROLE_CONFIG = {
  MANUFACTURER: {
    role: 'MANUFACTURER',
    label: 'Nhà sản xuất (OEM)',
    icon: 'Factory',
  },
  SELLER: {
    role: 'SELLER',
    label: 'Đại lý ủy quyền',
    icon: 'Store',
  },
  SERVICE_CENTER: {
    role: 'SERVICE_CENTER',
    label: 'Trạm dịch vụ ủy quyền',
    icon: 'Wrench',
  },
  CUSTOMER: {
    role: 'CUSTOMER',
    label: 'Khách hàng',
    icon: 'User',
  },
  GUEST: {
    role: 'GUEST',
    label: 'Khách vãng lai (Chỉ đọc)',
    icon: 'User',
  },
};

// Khả năng tương thích ngược (Deprecated - Không chứa địa chỉ Hardhat test)
export const DEMO_ACCOUNTS = {};

const STORAGE_KEY_PRODUCTS = 'trust_warranty_chain_products_clean';
const STORAGE_KEY_SERVICES = 'trust_warranty_chain_services_clean';
const STORAGE_KEY_EVENTS = 'trust_warranty_chain_events_clean';

const INITIAL_CHAIN_PRODUCTS = {};
const INITIAL_CHAIN_SERVICES = {};
const INITIAL_CHAIN_EVENTS = [];

function getLocalProducts() {
  const raw = localStorage.getItem(STORAGE_KEY_PRODUCTS);
  if (!raw) {
    localStorage.setItem(STORAGE_KEY_PRODUCTS, JSON.stringify(INITIAL_CHAIN_PRODUCTS));
    return INITIAL_CHAIN_PRODUCTS;
  }
  return JSON.parse(raw);
}

function saveLocalProducts(data) {
  localStorage.setItem(STORAGE_KEY_PRODUCTS, JSON.stringify(data));
}

function getLocalServices() {
  const raw = localStorage.getItem(STORAGE_KEY_SERVICES);
  if (!raw) {
    localStorage.setItem(STORAGE_KEY_SERVICES, JSON.stringify(INITIAL_CHAIN_SERVICES));
    return INITIAL_CHAIN_SERVICES;
  }
  return JSON.parse(raw);
}

function saveLocalServices(data) {
  localStorage.setItem(STORAGE_KEY_SERVICES, JSON.stringify(data));
}

function getLocalEvents() {
  const raw = localStorage.getItem(STORAGE_KEY_EVENTS);
  if (!raw) {
    localStorage.setItem(STORAGE_KEY_EVENTS, JSON.stringify(INITIAL_CHAIN_EVENTS));
    return INITIAL_CHAIN_EVENTS;
  }
  return JSON.parse(raw);
}

function saveLocalEvents(data) {
  localStorage.setItem(STORAGE_KEY_EVENTS, JSON.stringify(data));
}


export class BlockchainService {
  constructor() {
    this.currentRole = {
      role: 'GUEST',
      label: 'Khách vãng lai (Chỉ đọc)',
      address: '0x0000000000000000000000000000000000000000',
      icon: 'User',
    };
    this.networkMode = 'LOCAL'; // 'LOCAL' | 'SEPOLIA'
    this.isMetaMask = false;
    this.metaMaskAddress = null;
    this.metaMaskNetwork = null;
    this.contractAddress = contractArtifact.address || '0x5FbDB2315678afecb367f032d93F642f64180aa3';
    this.signer = null;
    this.eventSubscribers = [];
  }

  getContractInfo() {
    return {
      address: this.contractAddress,
      networkName: this.metaMaskNetwork || (this.networkMode === 'SEPOLIA' ? 'Ethereum Sepolia Testnet' : 'Localhost EVM (Chain #31337)'),
      networkMode: this.networkMode,
      isMetaMask: this.isMetaMask,
      connectedAddress: this.metaMaskAddress,
      deployedAt: contractArtifact.deployedAt || null,
    };
  }

  // Khởi tạo đối tượng Smart Contract tương tác trực tiếp với ví MetaMask
  async getContract(needSigner = false) {
    if (typeof window === 'undefined' || !window.ethereum) return null;
    try {
      const provider = new ethers.BrowserProvider(window.ethereum);
      if (needSigner) {
        const signer = await provider.getSigner();
        return new ethers.Contract(this.contractAddress, contractArtifact.abi, signer);
      }
      return new ethers.Contract(this.contractAddress, contractArtifact.abi, provider);
    } catch (err) {
      console.warn('Không thể khởi tạo ethers Contract qua window.ethereum:', err);
      return null;
    }
  }

  setRole(roleKey, userObjOrAddress = null) {
    const config = ROLE_CONFIG[roleKey] || ROLE_CONFIG.GUEST;
    let walletAddr = '0x0000000000000000000000000000000000000000';
    let label = config.label;

    if (this.isMetaMask && this.metaMaskAddress) {
      walletAddr = this.metaMaskAddress;
      label = `${config.label} (MetaMask)`;
    } else if (typeof userObjOrAddress === 'object' && userObjOrAddress?.walletAddress) {
      walletAddr = userObjOrAddress.walletAddress;
      if (userObjOrAddress.fullName) {
        label = `${userObjOrAddress.fullName} (${config.label})`;
      }
    } else if (typeof userObjOrAddress === 'string' && userObjOrAddress !== '0x0000000000000000000000000000000000000000') {
      walletAddr = userObjOrAddress;
    }

    this.currentRole = {
      role: roleKey,
      label,
      address: walletAddr,
      isMetaMask: this.isMetaMask,
      icon: config.icon,
    };
    return this.currentRole;
  }

  getCurrentAccount() {
    return this.currentRole;
  }

  setNetworkMode(mode) {
    this.networkMode = mode;
    return this.networkMode;
  }

  getNetworkMode() {
    return this.networkMode;
  }

    // Kiểm tra kết nối sẵn có trên MetaMask
  async checkExistingConnection() {
    if (typeof window !== 'undefined' && window.ethereum) {
      try {
        const accounts = await window.ethereum.request({ method: 'eth_accounts' });
        if (accounts && accounts.length > 0) {
          const address = accounts[0];
          const chainId = await window.ethereum.request({ method: 'eth_chainId' });
          const chainIdDec = parseInt(chainId, 16);
          const networkName = (chainIdDec === 1337 || chainIdDec === 5777) ? 'Ganache' : chainIdDec === 11155111 ? 'Sepolia' : chainIdDec === 8453 ? 'Base' : chainIdDec === 1 ? 'Mainnet' : `Chain #${chainIdDec}`;

          this.isMetaMask = true;
          this.metaMaskAddress = address;
          this.metaMaskNetwork = networkName;
          this.networkMode = chainIdDec === 11155111 ? 'SEPOLIA' : 'LOCAL';

          let ethBal = '0.00';
          try {
            const balHex = await window.ethereum.request({
              method: 'eth_getBalance',
              params: [address.toLowerCase(), 'latest'],
            });
            ethBal = parseFloat(ethers.formatEther(balHex)).toFixed(2);
          } catch (e) {
            const fb = await getWalletEthBalance(address);
            ethBal = parseFloat(fb || '0').toFixed(2);
          }

          this.currentRole = {
            ...this.currentRole,
            address: address,
            isMetaMask: true,
            networkName,
            balance: ethBal,
          };
          return { connected: true, address, networkName, chainIdDec, balance: ethBal };
        }
      } catch (e) {
        console.warn('Lỗi kiểm tra kết nối MetaMask:', e);
      }
    }
    return { connected: false };
  }

  // Kết nối MetaMask
  async connectMetaMask() {
    if (typeof window === 'undefined' || !window.ethereum) {
      if (typeof window !== 'undefined') {
        try {
          window.open(METAMASK_CHROME_STORE_URL, '_blank', 'noopener,noreferrer');
        } catch (e) {
          console.warn('Popup blocked:', e);
        }
      }
      return {
        success: false,
        notInstalled: true,
        installUrl: METAMASK_CHROME_STORE_URL,
        error: 'Chưa phát hiện tiện ích MetaMask trên trình duyệt! Hệ thống đã tự động mở trang Cửa hàng Chrome để bạn cài đặt hoặc bật tiện ích MetaMask.',
      };
    }

    try {
      console.log('Yêu cầu eth_requestAccounts...');
      const accounts = await window.ethereum.request({
        method: 'eth_requestAccounts',
      });

      if (!accounts || accounts.length === 0) {
        return { success: false, error: 'Người dùng từ chối cấp quyền truy cập ví MetaMask.' };
      }

      const address = accounts[0];
      const chainIdHex = await window.ethereum.request({ method: 'eth_chainId' });
      const chainIdDec = parseInt(chainIdHex, 16);
      const networkName = (chainIdDec === 1337 || chainIdDec === 5777) ? 'Ganache' : chainIdDec === 11155111 ? 'Sepolia' : chainIdDec === 8453 ? 'Base' : chainIdDec === 1 ? 'Ethereum' : `Chain #${chainIdDec}`;

            this.isMetaMask = true;
      this.metaMaskAddress = address;
      this.metaMaskNetwork = networkName;
      this.networkMode = chainIdDec === 11155111 ? 'SEPOLIA' : 'LOCAL';

      // Kiem tra va tu dong bom 50 ETH neu so du tren mang Ganache duoi 5 ETH
      let ethBal = '0.0';
      try {
        const currentBalStr = await getWalletEthBalance(address);
        ethBal = currentBalStr;
        if (parseFloat(currentBalStr || '0') < 5.0 && chainIdDec === 1337) {
          console.log(`Vi ${address} co so du thap (${currentBalStr} ETH). Tu dong nap 50 ETH tu Faucet...`);
          const faucetRes = await requestFaucetEth(address, '50.0');
          if (faucetRes && faucetRes.balance) {
            ethBal = faucetRes.balance;
          }
        }
      } catch (faucetErr) {
        console.warn('Tu dong nap ETH Faucet bo qua hoac gap loi:', faucetErr.message);
      }

      this.currentRole = {
        ...this.currentRole,
        address: address,
        isMetaMask: true,
        networkName: networkName,
        balance: ethBal,
        label: `MetaMask (${networkName})`,
      };

      return { success: true, address, networkName, chainId: chainIdDec, balance: ethBal };
    } catch (err) {
      console.error('Lỗi kết nối MetaMask:', err);
      if (err.code === -32002) {
        return {
          success: false,
          error: 'Cửa sổ MetaMask đang mở chờ xác nhận. Hãy nhấp vào biểu tượng con Cáo MetaMask trên thanh công cụ để bấm Xác nhận!',
        };
      }
      if (err.code === 4001) {
        return {
          success: false,
          error: 'Bạn đã từ chối yêu cầu kết nối trên ví MetaMask.',
        };
      }
      return {
        success: false,
        error: err.message || 'Không thể kết nối ví MetaMask',
      };
    }
  }

  
  // Chuyển hoặc thêm mạng Ganache Local (1337) vào MetaMask
  async switchToGanacheNetwork() {
    if (typeof window === 'undefined' || !window.ethereum) return false;
    const GANACHE_CHAIN_ID_HEX = '0x539'; // 1337
    try {
      await window.ethereum.request({
        method: 'wallet_switchEthereumChain',
        params: [{ chainId: GANACHE_CHAIN_ID_HEX }],
      });
      return true;
    } catch (switchError) {
      if (switchError.code === 4902 || switchError.data?.originalError?.code === 4902) {
        try {
          await window.ethereum.request({
            method: 'wallet_addEthereumChain',
            params: [
              {
                chainId: GANACHE_CHAIN_ID_HEX,
                chainName: 'Ganache Local',
                nativeCurrency: {
                  name: 'Ethereum',
                  symbol: 'ETH',
                  decimals: 18,
                },
                rpcUrls: ['http://127.0.0.1:8545'],
              },
            ],
          });
          return true;
        } catch (addError) {
          console.warn('Không thể thêm mạng Ganache vào MetaMask:', addError);
        }
      } else {
        console.warn('Không thể chuyển mạng trên MetaMask:', switchError);
      }
      return false;
    }
  }

  async getBalance(address) {
    const target = address || this.metaMaskAddress;
    if (!target) return '0.00';
    try {
      if (typeof window !== 'undefined' && window.ethereum) {
        const balHex = await window.ethereum.request({
          method: 'eth_getBalance',
          params: [target.toLowerCase(), 'latest'],
        });
        if (balHex) {
          return parseFloat(ethers.formatEther(balHex)).toFixed(2);
        }
      }
    } catch (e) {
      console.warn('Lỗi lấy số dư từ window.ethereum:', e);
    }
    try {
      const bal = await getWalletEthBalance(target.toLowerCase());
      return parseFloat(bal || '0').toFixed(2);
    } catch (e) {
      return '0.00';
    }
  }

  async topUpFaucet(address, amount = '50.0') {
    const target = address || this.metaMaskAddress;
    if (!target) throw new Error('Chưa có địa chỉ ví để nạp ETH');
    const res = await requestFaucetEth(target, amount);
    return res;
  }

  // Ngắt kết nối và tùy chọn thu hồi quyền trong MetaMask (EIP-2255)
  async disconnectMetaMask(revokePermissions = true) {
    this.isMetaMask = false;
    this.metaMaskAddress = null;
    this.metaMaskNetwork = null;
    this.currentRole = {
      role: 'GUEST',
      label: 'Khách vãng lai (Chỉ đọc)',
      address: '0x0000000000000000000000000000000000000000',
      icon: 'User',
    };

    if (revokePermissions && typeof window !== 'undefined' && window.ethereum) {
      try {
        await window.ethereum.request({
          method: 'wallet_revokePermissions',
          params: [
            {
              eth_accounts: {},
            },
          ],
        });
        console.log('Đã thu hồi quyền (Revoked Permissions) trong MetaMask');
      } catch (err) {
        console.warn('MetaMask không hỗ trợ wallet_revokePermissions hoặc người dùng hủy:', err);
      }
    }

    return this.currentRole;
  }

  // Đăng ký lắng nghe Event thời gian thực
  subscribeToEvents(callback) {
    this.eventSubscribers.push(callback);
    return () => {
      this.eventSubscribers = this.eventSubscribers.filter((cb) => cb !== callback);
    };
  }

  emitEvent(eventName, serial, data, txHash, blockNumber) {
    const events = getLocalEvents();
    const newEvt = {
      id: 'EVT-' + Date.now(),
      eventName,
      serial,
      data,
      timestamp: Math.floor(Date.now() / 1000),
      txHash,
      blockNumber,
    };
    events.unshift(newEvt);
    saveLocalEvents(events);

    this.eventSubscribers.forEach((cb) => {
      try {
        cb(newEvt);
      } catch (err) {
        console.error('Lỗi listener:', err);
      }
    });

    return newEvt;
  }

  getHistoricalEvents(filterType = '') {
    const events = getLocalEvents();
    if (!filterType) return events;
    return events.filter((e) => e.eventName.toLowerCase() === filterType.toLowerCase());
  }

  // Đảm bảo ví MetaMask đã được kết nối trước khi thực hiện bất kỳ thao tác On-Chain nào
  async ensureMetaMaskConnected() {
    if (typeof window === 'undefined' || !window.ethereum) {
      const err = new Error('Chưa phát hiện tiện ích ví MetaMask trên trình duyệt! Vui lòng cài đặt và bật tiện ích MetaMask trước khi thực hiện thao tác này.');
      err.code = 'METAMASK_NOT_INSTALLED';
      throw err;
    }

    if (!this.isMetaMask || !this.metaMaskAddress) {
      console.log('Chưa kết nối MetaMask, đang yêu cầu kết nối ví...');
      const res = await this.connectMetaMask();
      if (!res.success) {
        throw new Error(res.error || 'Yêu cầu kết nối ví MetaMask trước khi thực hiện thao tác on-chain này!');
      }
    }

    return this.metaMaskAddress;
  }

  parseMetaMaskError(err, actionName = 'Thao tác') {
    console.warn(`Lỗi giao dịch MetaMask [${actionName}]:`, err);
    if (err.code === 4001 || err.code === 'ACTION_REJECTED' || err.message?.includes('denied') || err.message?.includes('rejected')) {
      return new Error(`Bạn đã bấm từ chối ký xác nhận giao dịch trên ví MetaMask. ${actionName} đã bị hủy bỏ và không được ghi nhận vào hệ thống.`);
    }
    if (err.code === 'INSUFFICIENT_FUNDS' || err.message?.includes('insufficient funds')) {
      return new Error(`Ví MetaMask không đủ số dư ETH để trả phí gas cho giao dịch này.`);
    }

    // Trích xuất revert string nếu có trong revert, reason hoặc hex data
    let revertReason = err.reason || err.revert?.args?.[0];
    if (!revertReason) {
      const hexData = err.data || err.error?.data || err.info?.error?.data;
      if (typeof hexData === 'string' && hexData.startsWith('0x08c379a0')) {
        try {
          revertReason = ethers.AbiCoder.defaultAbiCoder().decode(['string'], '0x' + hexData.slice(10))[0];
        } catch (_) {}
      }
    }

    if (revertReason) {
      return new Error(`Hợp đồng thông minh từ chối (${actionName}): ${revertReason}`);
    }

    if (err.shortMessage?.includes('missing revert data') || err.message?.includes('missing revert data')) {
      if (actionName.includes('Đăng ký')) {
        return new Error(`Hợp đồng thông minh từ chối (${actionName}): Thiết bị với mã Serial này đã tồn tại trên Blockchain.`);
      }
      if (actionName.includes('Ghi biên bản') || actionName.includes('dịch vụ')) {
        return new Error(`Hợp đồng thông minh từ chối (${actionName}): Ví MetaMask hiện tại chưa được cấp quyền Trạm dịch vụ (SERVICE_CENTER) trên Smart Contract.`);
      }
      if (actionName.includes('Kích hoạt')) {
        return new Error(`Hợp đồng thông minh từ chối (${actionName}): Thiết bị đã được kích hoạt trước đó hoặc ví không có quyền.`);
      }
      return new Error(`Hợp đồng thông minh từ chối (${actionName}): Thao tác vi phạm quy tắc hợp đồng hoặc ví chưa được phân quyền.`);
    }

    if (err.shortMessage) {
      return new Error(`Lỗi giao dịch MetaMask (${actionName}): ${err.shortMessage}`);
    }
    return new Error(err.message || `${actionName} qua ví MetaMask thất bại. Thao tác không được chấp nhận vào hệ thống.`);
  }

  // 1. Đăng ký sản phẩm (Bắt buộc ký và xác nhận on-chain qua MetaMask trước)
  async registerProduct(serialNumber, modelCode, warrantyMonths, customPin = '', metadataHash = null, onProgress = null) {
    if (this.currentRole.role !== 'MANUFACTURER' && this.currentRole.role !== 'SELLER') {
      throw new Error(`Từ chối phân quyền (RBAC): Chỉ tài khoản Nhà sản xuất (MANUFACTURER) hoặc Đại lý ủy quyền (SELLER) mới có quyền đăng ký thiết bị mới lên Blockchain! (Vai trò hiện tại của bạn: ${this.currentRole.label || this.currentRole.role})`);
    }

    const cleanSerial = serialNumber.trim();
    if (!cleanSerial) throw new Error('Vui lòng nhập Serial Number hợp lệ');

    const products = getLocalProducts();
    if (products[cleanSerial]) {
      throw new Error(`Sản phẩm với số Serial "${cleanSerial}" đã tồn tại trong danh sách hệ thống!`);
    }

    // 1. BẮT BUỘC KẾT NỐI METAMASK TRƯỚC
    const callerAddress = await this.ensureMetaMaskConnected();

    // Sinh mã PIN cào bảo mật vật lý
    const pin = (customPin && customPin.trim()) || `PIN-${Math.floor(100000 + Math.random() * 900000)}`;
    const pinHash = ethers.keccak256(ethers.toUtf8Bytes(pin.trim()));
    const finalMetaHash = metadataHash || ethers.ZeroHash;
    const monthsNum = Number(warrantyMonths) || 12;

    let txHash = null;
    let blockNum = null;

    // 2. GỬI GIAO DỊCH VÀ CHỜ KÝ / XÁC NHẬN ON-CHAIN TRÊN METAMASK TRƯỚC
    try {
      if (onProgress) onProgress({ step: 'AWAITING_SIGNATURE', message: 'Đang mở ví MetaMask & chờ bạn ký duyệt đăng ký sản phẩm...' });
      const contract = await this.getContract(true);
      if (!contract) {
        throw new Error('Không thể khởi tạo hợp đồng thông minh với ví MetaMask.');
      }

      // Kiểm tra trước trên Smart Contract xem Serial đã tồn tại trên On-Chain chưa
      try {
        const serialHash = ethers.keccak256(ethers.toUtf8Bytes(cleanSerial));
        const onChainProd = await contract.getProductCommitment(serialHash);
        if (onChainProd && onChainProd.exists) {
          throw new Error(`Thiết bị với số Serial "${cleanSerial}" đã được đăng ký trên Smart Contract (Blockchain) trước đó! Vui lòng nhập số Serial mới.`);
        }
      } catch (checkErr) {
        if (checkErr.message?.includes('đã được đăng ký trên Smart Contract')) {
          throw checkErr;
        }
        // "Thiet bi khong ton tai" là trạng thái bình thường (chưa đăng ký)
      }

      console.log('Gửi giao dịch registerProduct tới Smart Contract qua MetaMask...', {
        cleanSerial,
        finalMetaHash,
        monthsNum,
      });

      const tx = await contract.registerProduct(
        cleanSerial,
        finalMetaHash,
        monthsNum
      );

      if (onProgress) onProgress({ step: 'MINING', message: `Giao dịch đã phát lên Blockchain (${tx.hash.slice(0, 10)}...). Đang chờ xác nhận khối...`, txHash: tx.hash });
      console.log('Đang chờ MetaMask và mạng lưới xác thực khối (wait for receipt)...', tx.hash);
      const receipt = await tx.wait(1);

      if (!receipt || receipt.status !== 1) {
        throw new Error('Giao dịch trên MetaMask bị đảo ngược (reverted) hoặc không thành công.');
      }

      txHash = receipt.hash;
      blockNum = receipt.blockNumber;
      console.log('Giao dịch MetaMask thành công! TxHash:', txHash, 'Block:', blockNum);

      if (onProgress) onProgress({ step: 'CONFIRMED', message: 'MetaMask đã xác nhận giao dịch thành công! Đang đồng bộ hệ thống...', txHash, blockNumber: blockNum });
      // Đợi vài giây đồng bộ mượt mà theo yêu cầu
      await delay(2000);
    } catch (chainErr) {
      if (onProgress) onProgress({ step: 'FAILED', message: 'Giao dịch MetaMask thất bại hoặc bị từ chối. Đang xử lý phản hồi...' });
      // Đợi vài giây thông báo lỗi theo yêu cầu
      await delay(1800);
      throw this.parseMetaMaskError(chainErr, 'Đăng ký sản phẩm xuất xưởng');
    }

    // 4. CHỈ KHI METAMASK THÀNH CÔNG -> MỚI CHẤP NHẬN DỮ LIỆU BÊN HỆ THỐNG
    const nowSec = Math.floor(Date.now() / 1000);
    const newProd = {
      serialNumber: cleanSerial,
      modelCode: modelCode || 'MOD-GEN',
      manufacturer: callerAddress,
      currentOwner: '0x0000000000000000000000000000000000000000',
      manufactureDate: nowSec,
      warrantyMonths: monthsNum,
      activationDate: 0,
      expiryDate: 0,
      status: 0,
      secretPin: pin,
      pinHash,
      pinUsed: false,
      metadataHash: finalMetaHash,
      txHash,
      blockNumber: blockNum,
    };

    products[cleanSerial] = newProd;
    saveLocalProducts(products);

    this.emitEvent('ProductRegistered', cleanSerial, { model: newProd.modelCode, manufacturer: newProd.manufacturer }, txHash, blockNum);

    return { success: true, txHash, blockNumber: blockNum, product: newProd, secretPin: pin };
  }

  // 2. Kích hoạt bảo hành (Bắt buộc ký và xác nhận on-chain qua MetaMask trước)
  async activateWarranty(serialNumber, customerAddress, secretPin = '', onProgress = null) {
    if (this.currentRole.role !== 'SELLER' && this.currentRole.role !== 'MANUFACTURER') {
      throw new Error(`Từ chối phân quyền (RBAC): Chỉ tài khoản Đại lý bán lẻ (SELLER) hoặc Nhà sản xuất (MANUFACTURER) mới có quyền kích hoạt bảo hành cho thiết bị! (Vai trò hiện tại của bạn: ${this.currentRole.label || this.currentRole.role})`);
    }

    const cleanSerial = serialNumber.trim();
    const products = getLocalProducts();
    const prod = products[cleanSerial];
    if (!prod) throw new Error('Không tìm thấy sản phẩm trên Blockchain');
    if (prod.status === 1) throw new Error('Bảo hành sản phẩm này đã được kích hoạt trước đó');

    // Kiểm tra Mã PIN Cào Chống Sao Chép Serial Vật Lý
    if (prod.pinHash) {
      if (!secretPin || !secretPin.trim()) {
        throw new Error('Vui lòng nhập Mã PIN cào bảo mật vật lý (Scratch-off PIN) để xác thực sở hữu thiết bị trước khi kích hoạt!');
      }
      const cleanPin = secretPin.trim();
      const enteredHash = ethers.keccak256(ethers.toUtf8Bytes(cleanPin));
      if (enteredHash !== prod.pinHash && cleanPin !== prod.secretPin) {
        throw new Error('MÃ PIN CÀO BẢO MẬT KHÔNG HỢP LỆ! Không thể kích hoạt nếu không có thiết bị vật lý trong tay.');
      }
    }

    // 1. BẮT BUỘC KẾT NỐI METAMASK TRƯỚC
    const callerAddress = await this.ensureMetaMaskConnected();

    const targetCustomer = customerAddress || callerAddress;
    const ownerHash = computeOwnerHash(targetCustomer);

    let txHash = null;
    let blockNum = null;

    // 2. KÝ VÀ GỬI LÊN METAMASK TRƯỚC
    try {
      if (onProgress) onProgress({ step: 'AWAITING_SIGNATURE', message: 'Đang mở ví MetaMask & chờ bạn ký kích hoạt bảo hành...' });
      const contract = await this.getContract(true);
      if (!contract) {
        throw new Error('Không thể khởi tạo hợp đồng thông minh với ví MetaMask.');
      }

      console.log('Gửi giao dịch activateWarranty qua MetaMask...', {
        cleanSerial,
        ownerHash,
        targetCustomer
      });

      const tx = await contract.activateWarranty(cleanSerial, ownerHash);
      if (onProgress) onProgress({ step: 'MINING', message: `Giao dịch đã phát lên Blockchain (${tx.hash.slice(0, 10)}...). Đang chờ xác nhận khối...`, txHash: tx.hash });
      console.log('Đang chờ MetaMask và mạng lưới xác thực khối (receipt)...', tx.hash);
      const receipt = await tx.wait(1);

      if (!receipt || receipt.status !== 1) {
        throw new Error('Giao dịch trên MetaMask bị đảo ngược (reverted) hoặc không thành công.');
      }

      txHash = receipt.hash;
      blockNum = receipt.blockNumber;
      console.log('Kích hoạt bảo hành trên MetaMask thành công! TxHash:', txHash);

      if (onProgress) onProgress({ step: 'CONFIRMED', message: 'MetaMask đã xác nhận kích hoạt bảo hành thành công! Đang hoàn tất...', txHash, blockNumber: blockNum });
      // Đợi vài giây đồng bộ mượt mà theo yêu cầu
      await delay(2000);
    } catch (chainErr) {
      if (onProgress) onProgress({ step: 'FAILED', message: 'Giao dịch MetaMask thất bại hoặc bị từ chối. Đang xử lý phản hồi...' });
      // Đợi vài giây thông báo lỗi theo yêu cầu
      await delay(1800);
      throw this.parseMetaMaskError(chainErr, 'Kích hoạt bảo hành');
    }

    // 4. CHỈ KHI METAMASK THÀNH CÔNG -> MỚI CHẤP NHẬN TRẠNG THÁI MỚI BÊN HỆ THỐNG
    const nowSec = Math.floor(Date.now() / 1000);
    const months = Number(prod.warrantyMonths) || 12;
    const expirySec = nowSec + (months * 30 * 86400);

    prod.currentOwner = targetCustomer;
    prod.activationDate = nowSec;
    prod.expiryDate = expirySec;
    prod.status = 1;
    prod.pinUsed = true;
    prod.txHash = txHash;
    prod.blockNumber = blockNum;

    products[cleanSerial] = prod;
    saveLocalProducts(products);

    this.emitEvent('WarrantyActivated', cleanSerial, { customer: prod.currentOwner, expiryDate: expirySec }, txHash, blockNum);

    return { success: true, txHash, blockNumber: blockNum, product: prod };
  }

  // 2b. Kích hoạt bảo hành thông qua Paymaster (Gasless - Phí Gas 0 ETH được tài trợ)
  async gaslessActivateWarranty(serialNumber, secretPin, customerAddress, customerName, customerEmail) {
    const res = await paymasterRelayActivateApi({
      serialNumber,
      secretPin,
      customerAddress,
      customerName,
      customerEmail
    });

    if (res.success) {
      const cleanSerial = serialNumber.trim();
      const products = getLocalProducts();
      const expirySec = Math.floor(new Date(res.expiryDate).getTime() / 1000);

      if (products[cleanSerial]) {
        products[cleanSerial].status = 1;
        products[cleanSerial].currentOwner = res.currentOwner;
        products[cleanSerial].activationDate = Math.floor(new Date(res.activationDate).getTime() / 1000);
        products[cleanSerial].expiryDate = expirySec;
        products[cleanSerial].paymasterSponsored = true;
        products[cleanSerial].sponsorName = res.sponsor;
        saveLocalProducts(products);
      }

      this.emitEvent('WarrantyActivated', cleanSerial, {
        customer: res.currentOwner,
        expiryDate: expirySec,
        paymaster: true,
        sponsor: res.sponsor
      }, res.txHash, res.blockNumber);
    }

    return res;
  }

  // 3. Chuyển nhượng quyền sở hữu (Bắt buộc ký và xác nhận qua MetaMask trước)
  async transferOwnership(serialNumber, newOwner, onProgress = null) {
    const cleanSerial = serialNumber.trim();
    const cleanOwner = newOwner.trim();
    if (!cleanOwner || cleanOwner === '0x0000000000000000000000000000000000000000') {
      throw new Error('Địa chỉ ví người nhận không hợp lệ');
    }

    const products = getLocalProducts();
    let prod = products[cleanSerial];
    if (!prod) {
      prod = {
        serialNumber: cleanSerial,
        status: 1,
        currentOwner: '0x0000000000000000000000000000000000000000',
      };
      products[cleanSerial] = prod;
    }
    if (prod.status === 3) throw new Error('Sản phẩm đã bị vô hiệu hóa bảo hành, không thể chuyển nhượng');

    // 1. KIỂM TRA PHÂN QUYỀN RBAC: Chỉ Seller, Nhà sản xuất và Trung tâm dịch vụ mới có quyền chuyển nhượng
    const allowedRoles = ['MANUFACTURER', 'SELLER', 'SERVICE_CENTER'];
    if (!allowedRoles.includes(this.currentRole.role)) {
      throw new Error(`Từ chối phân quyền (RBAC): Chỉ Seller, Nhà sản xuất (MANUFACTURER) và Trung tâm dịch vụ (SERVICE_CENTER) mới có quyền chuyển nhượng thiết bị cho người khác! (Vai trò hiện tại của bạn: ${this.currentRole.label || this.currentRole.role})`);
    }

    // BẮT BUỘC KẾT NỐI METAMASK TRƯỚC
    const callerAddress = await this.ensureMetaMaskConnected();

    const serialHash = computeSerialHash(cleanSerial);
    const newOwnerHash = computeOwnerHash(cleanOwner);

    let txHash = null;
    let blockNum = null;

    // 2. KÝ VÀ GỬI LÊN METAMASK TRƯỚC
    try {
      if (onProgress) onProgress({ step: 'AWAITING_SIGNATURE', message: 'Đang mở ví MetaMask & chờ bạn ký sang tên thiết bị...' });
      const contract = await this.getContract(true);
      if (!contract) {
        throw new Error('Không thể khởi tạo hợp đồng thông minh với ví MetaMask.');
      }

      console.log('Gửi giao dịch transferOwnership qua MetaMask...', {
        serialHash,
        newOwnerHash
      });

      const tx = await contract.transferOwnership(serialHash, newOwnerHash);
      if (onProgress) onProgress({ step: 'MINING', message: `Giao dịch đã phát lên Blockchain (${tx.hash.slice(0, 10)}...). Đang chờ xác nhận khối...`, txHash: tx.hash });
      const receipt = await tx.wait(1);

      if (!receipt || receipt.status !== 1) {
        throw new Error('Giao dịch trên MetaMask bị đảo ngược (reverted) hoặc không thành công.');
      }

      txHash = receipt.hash;
      blockNum = receipt.blockNumber;

      if (onProgress) onProgress({ step: 'CONFIRMED', message: 'MetaMask đã xác nhận sang tên On-Chain thành công! Đang hoàn tất...', txHash, blockNumber: blockNum });
      await delay(2000);
    } catch (chainErr) {
      if (onProgress) onProgress({ step: 'FAILED', message: 'Giao dịch MetaMask thất bại hoặc bị từ chối. Đang xử lý phản hồi...' });
      await delay(1800);
      throw this.parseMetaMaskError(chainErr, 'Chuyển nhượng quyền sở hữu');
    }

    // 4. CHỈ KHI METAMASK THÀNH CÔNG -> MỚI CHẤP NHẬN TRÊN HỆ THỐNG
    const previousOwner = prod.currentOwner;
    prod.currentOwner = cleanOwner;

    products[cleanSerial] = prod;
    saveLocalProducts(products);

    this.emitEvent('OwnershipTransferred', cleanSerial, { previousOwner, newOwner: cleanOwner }, txHash, blockNum);

    return { success: true, txHash, blockNumber: blockNum, product: prod };
  }

  // 4. Gia hạn bảo hành mở rộng (Bắt buộc ký và xác nhận qua MetaMask trước)
  async extendWarranty(serialNumber, additionalMonths, onProgress = null) {
    if (this.currentRole.role !== 'SELLER') {
      throw new Error(`Từ chối phân quyền (RBAC): Chỉ tài khoản Đại lý bán lẻ (SELLER) mới có quyền gia hạn thời hạn bảo hành! (Vai trò hiện tại của bạn: ${this.currentRole.label || this.currentRole.role})`);
    }

    const cleanSerial = serialNumber.trim();
    const months = Number(additionalMonths);
    if (months <= 0) throw new Error('Số tháng gia hạn phải lớn hơn 0');

    const products = getLocalProducts();
    const prod = products[cleanSerial];
    if (!prod) throw new Error('Không tìm thấy sản phẩm');
    if (prod.status === 0) throw new Error('Sản phẩm chưa được kích hoạt bảo hành ban đầu');
    if (prod.status === 3) throw new Error('Sản phẩm đã bị vô hiệu hóa bảo hành');

    // 1. BẮT BUỘC KẾT NỐI METAMASK TRƯỚC
    await this.ensureMetaMaskConnected();

    const serialHash = computeSerialHash(cleanSerial);
    let txHash = null;
    let blockNum = null;

    // 2. KÝ VÀ GỬI LÊN METAMASK TRƯỚC
    try {
      if (onProgress) onProgress({ step: 'AWAITING_SIGNATURE', message: 'Đang mở ví MetaMask & chờ bạn ký gia hạn bảo hành...' });
      const contract = await this.getContract(true);
      if (!contract) {
        throw new Error('Không thể khởi tạo hợp đồng thông minh với ví MetaMask.');
      }

      console.log('Gửi giao dịch extendWarranty qua MetaMask...', {
        serialHash,
        months
      });

      const tx = await contract.extendWarranty(serialHash, months);
      if (onProgress) onProgress({ step: 'MINING', message: `Giao dịch đã phát lên Blockchain (${tx.hash.slice(0, 10)}...). Đang chờ xác nhận khối...`, txHash: tx.hash });
      const receipt = await tx.wait(1);

      if (!receipt || receipt.status !== 1) {
        throw new Error('Giao dịch trên MetaMask bị đảo ngược (reverted) hoặc không thành công.');
      }

      txHash = receipt.hash;
      blockNum = receipt.blockNumber;

      if (onProgress) onProgress({ step: 'CONFIRMED', message: 'MetaMask đã xác nhận gia hạn bảo hành thành công! Đang hoàn tất...', txHash, blockNumber: blockNum });
      await delay(2000);
    } catch (chainErr) {
      if (onProgress) onProgress({ step: 'FAILED', message: 'Giao dịch MetaMask thất bại hoặc bị từ chối. Đang xử lý phản hồi...' });
      await delay(1800);
      throw this.parseMetaMaskError(chainErr, 'Gia hạn bảo hành');
    }

    // 4. CHỈ KHI METAMASK THÀNH CÔNG -> CẬP NHẬT HỆ THỐNG
    const nowSec = Math.floor(Date.now() / 1000);
    const addedSec = months * 30 * 86400;

    if (prod.status === 1 && prod.expiryDate > nowSec) {
      prod.expiryDate += addedSec;
    } else {
      prod.expiryDate = nowSec + addedSec;
      prod.status = 1;
    }
    prod.warrantyMonths = (Number(prod.warrantyMonths) || 0) + months;

    products[cleanSerial] = prod;
    saveLocalProducts(products);

    this.emitEvent('WarrantyExtended', cleanSerial, { addedMonths: months, newExpiry: prod.expiryDate }, txHash, blockNum);

    return { success: true, txHash, blockNumber: blockNum, product: prod };
  }

  // 5. Ghi nhận dịch vụ sửa chữa / bảo dưỡng (Bắt buộc ký và xác nhận qua MetaMask trước)
  async addServiceRecord(serialNumber, serviceType, notes, replacedPart, technicianId, onProgress = null) {
    if (this.currentRole.role !== 'SERVICE_CENTER') {
      throw new Error(`Từ chối phân quyền (RBAC): Chỉ tài khoản Trạm dịch vụ kỹ thuật ủy quyền (SERVICE_CENTER) mới có quyền lập hồ sơ dịch vụ và kiểm định linh kiện! (Vai trò hiện tại của bạn: ${this.currentRole.label || this.currentRole.role})`);
    }

    const cleanSerial = serialNumber.trim();
    const products = getLocalProducts();
    if (!products[cleanSerial]) throw new Error('Sản phẩm không tồn tại trên hệ thống Blockchain');

    // 1. BẮT BUỘC KẾT NỐI METAMASK TRƯỚC
    const centerAddress = await this.ensureMetaMaskConnected();

    const services = getLocalServices();
    if (!services[cleanSerial]) services[cleanSerial] = [];

    const nowSec = Math.floor(Date.now() / 1000);
    const recordId = (services[cleanSerial].length || 0) + 1;

    const recordDataHash = computeServiceRecordHash({
      serviceType: Number(serviceType) || 0,
      notes: notes || 'Kiểm tra kỹ thuật định kỳ',
      replacedPart: replacedPart || 'Không',
      technicianId: technicianId || 'TECH-V01',
      date: new Date().toISOString().split('T')[0],
    });

    const existingServices = services[cleanSerial] || [];
    const historyTree = buildServiceHistoryTree([
      { serviceType, notes, replacedPart, technicianId },
      ...existingServices,
    ]);
    const newRoot = historyTree.root || ethers.ZeroHash;

    let txHash = null;
    let blockNum = null;

    // 2. KÝ VÀ GỬI LÊN METAMASK TRƯỚC
    try {
      if (onProgress) onProgress({ step: 'AWAITING_SIGNATURE', message: 'Đang mở ví MetaMask & chờ bạn ký biên bản bảo dưỡng...' });
      const contract = await this.getContract(true);
      if (!contract) {
        throw new Error('Không thể khởi tạo hợp đồng thông minh với ví MetaMask.');
      }

      // Kiểm tra quyền Trạm dịch vụ trên Smart Contract trước khi ký
      try {
        const adminAddr = await contract.admin();
        let isAuthorized = adminAddr.toLowerCase() === centerAddress.toLowerCase() || (await contract.authorizedServiceCenters(centerAddress));

        if (!isAuthorized) {
          // Tự động yêu cầu backend cấp quyền on-chain cho ví Trạm dịch vụ
          try {
            await fetch('http://localhost:5000/api/blockchain/ensure-role', {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({ role: 'SERVICE_CENTER', address: centerAddress }),
            });
            isAuthorized = await contract.authorizedServiceCenters(centerAddress);
          } catch (autoErr) {
            console.warn('Lỗi tự động cấp quyền on-chain cho trạm dịch vụ:', autoErr.message);
          }
        }

        if (!isAuthorized) {
          throw new Error(`Ví MetaMask (${centerAddress.slice(0, 6)}...${centerAddress.slice(-4)}) chưa được cấp quyền Trạm dịch vụ ủy quyền (SERVICE_CENTER) trên Smart Contract! Vui lòng chọn đúng ví Trạm dịch vụ.`);
        }
      } catch (checkErr) {
        if (checkErr.message?.includes('chưa được cấp quyền')) {
          throw checkErr;
        }
      }

      console.log('Gửi giao dịch addServiceRecord qua MetaMask...', {
        cleanSerial,
        serviceType: Number(serviceType) || 0,
        recordDataHash,
        newRoot,
      });

      const tx = await contract.addServiceRecord(
        cleanSerial,
        Number(serviceType) || 0,
        recordDataHash,
        newRoot
      );

      if (onProgress) onProgress({ step: 'MINING', message: `Giao dịch đã phát lên Blockchain (${tx.hash.slice(0, 10)}...). Đang chờ xác nhận khối...`, txHash: tx.hash });
      const receipt = await tx.wait(1);

      if (!receipt || receipt.status !== 1) {
        throw new Error('Giao dịch trên MetaMask bị đảo ngược (reverted) hoặc không thành công.');
      }

      txHash = receipt.hash;
      blockNum = receipt.blockNumber;

      if (onProgress) onProgress({ step: 'CONFIRMED', message: 'MetaMask đã xác nhận ghi nhận biên bản On-Chain thành công! Đang hoàn tất...', txHash, blockNumber: blockNum });
      await delay(2000);
    } catch (chainErr) {
      if (onProgress) onProgress({ step: 'FAILED', message: 'Giao dịch MetaMask thất bại hoặc bị từ chối. Đang xử lý phản hồi...' });
      await delay(1800);
      throw this.parseMetaMaskError(chainErr, 'Ghi biên bản dịch vụ');
    }

    // 4. CHỈ KHI METAMASK THÀNH CÔNG -> MỚI LƯU VÀO HỆ THỐNG
    const record = {
      recordId,
      timestamp: nowSec,
      serviceCenter: centerAddress,
      serviceCenterName: 'Trạm dịch vụ ủy quyền số ' + recordId,
      serviceType: Number(serviceType) || 0,
      notes: notes || 'Kiểm tra kỹ thuật định kỳ',
      replacedPart: replacedPart || 'Không',
      technicianId: technicianId || 'TECH-V' + Math.floor(10 + Math.random() * 90),
      txHash,
      blockNumber: blockNum,
    };

    services[cleanSerial].unshift(record);
    saveLocalServices(services);

    const typeNames = ['Bảo dưỡng', 'Sửa chữa', 'Thay linh kiện', 'Kiểm định'];
    this.emitEvent('ServiceRecorded', cleanSerial, { serviceType: typeNames[record.serviceType] || 'Dịch vụ', technician: record.technicianId }, txHash, blockNum);

    return { success: true, txHash, blockNumber: blockNum, record };
  }

  // 6. Vô hiệu hóa bảo hành (Bắt buộc ký và xác nhận qua MetaMask trước)
  async voidWarranty(serialNumber, reason, onProgress = null) {
    if (this.currentRole.role !== 'SERVICE_CENTER' && this.currentRole.role !== 'MANUFACTURER') {
      throw new Error(`Từ chối phân quyền (RBAC): Chỉ Trạm dịch vụ ủy quyền (SERVICE_CENTER) hoặc Nhà sản xuất mới có quyền đình chỉ bảo hành vi phạm! (Vai trò hiện tại của bạn: ${this.currentRole.label || this.currentRole.role})`);
    }

    const cleanSerial = serialNumber.trim();
    const products = getLocalProducts();
    if (!products[cleanSerial]) throw new Error('Không tìm thấy sản phẩm');

    // 1. BẮT BUỘC KẾT NỐI METAMASK TRƯỚC
    await this.ensureMetaMaskConnected();

    const serialHash = computeSerialHash(cleanSerial);
    const reasonHash = ethers.keccak256(ethers.toUtf8Bytes(reason || 'Vi phạm chính sách bảo hành'));

    let txHash = null;
    let blockNum = null;

    // 2. KÝ VÀ GỬI LÊN METAMASK TRƯỚC
    try {
      if (onProgress) onProgress({ step: 'AWAITING_SIGNATURE', message: 'Đang mở ví MetaMask & chờ bạn ký vô hiệu hóa bảo hành...' });
      const contract = await this.getContract(true);
      if (!contract) {
        throw new Error('Không thể khởi tạo hợp đồng thông minh với ví MetaMask.');
      }

      console.log('Gửi giao dịch voidWarranty qua MetaMask...', {
        serialHash,
        reasonHash
      });

      const tx = await contract.voidWarranty(serialHash, reasonHash);
      if (onProgress) onProgress({ step: 'MINING', message: `Giao dịch đã phát lên Blockchain (${tx.hash.slice(0, 10)}...). Đang chờ xác nhận khối...`, txHash: tx.hash });
      const receipt = await tx.wait(1);

      if (!receipt || receipt.status !== 1) {
        throw new Error('Giao dịch trên MetaMask bị đảo ngược (reverted) hoặc không thành công.');
      }

      txHash = receipt.hash;
      blockNum = receipt.blockNumber;

      if (onProgress) onProgress({ step: 'CONFIRMED', message: 'MetaMask đã xác nhận vô hiệu hóa bảo hành thành công! Đang hoàn tất...', txHash, blockNumber: blockNum });
      await delay(2000);
    } catch (chainErr) {
      if (onProgress) onProgress({ step: 'FAILED', message: 'Giao dịch MetaMask thất bại hoặc bị từ chối. Đang xử lý phản hồi...' });
      await delay(1800);
      throw this.parseMetaMaskError(chainErr, 'Vô hiệu hóa bảo hành');
    }

    // 4. CHỈ KHI METAMASK THÀNH CÔNG -> CẬP NHẬT TRẠNG THÁI HỆ THỐNG
    products[cleanSerial].status = 3; // Voided
    saveLocalProducts(products);

    this.emitEvent('WarrantyVoided', cleanSerial, { reason }, txHash, blockNum);

    return { success: true, txHash, blockNumber: blockNum };
  }

  // 7. Tra cứu sản phẩm (Kèm Khóa Mật Mã On-Chain & Gốc Merkle)
  getProduct(serialNumber) {
    const products = getLocalProducts();
    const prod = products[serialNumber];
    if (!prod) return null;

    const nowSec = Math.floor(Date.now() / 1000);
    let computedStatus = prod.status;
    if (prod.status === 1 && prod.expiryDate > 0 && nowSec > prod.expiryDate) {
      computedStatus = 2; // Expired
    }

    const services = this.getServiceHistory(serialNumber);
    const serviceTreeInfo = buildServiceHistoryTree(services);

    const serialHash = computeSerialHash(prod.serialNumber);
    const metadataHash = prod.metadataHash || null;
    const ownerHash = prod.currentOwner && prod.currentOwner !== '0x0000000000000000000000000000000000000000'
      ? computeOwnerHash(prod.currentOwner)
      : ethers.ZeroHash;

    const isBatchMember = defaultProductBatchTree.elements.includes(prod.serialNumber);
    const batchProof = isBatchMember ? defaultProductBatchTree.getProof(prod.serialNumber) : [];

    return {
      ...prod,
      status: computedStatus,
      serialHash,
      metadataHash,
      ownerHash,
      serviceMerkleRoot: serviceTreeInfo.root,
      isBatchMember,
      batchProof,
      batchMerkleRoot: defaultProductBatchTree.getRoot(),
    };
  }

  setProductMetadataHash(serialNumber, metadataHash) {
    const products = getLocalProducts();
    if (products[serialNumber]) {
      products[serialNumber].metadataHash = metadataHash;
      saveLocalProducts(products);
    }
  }

  getServiceHistory(serialNumber) {
    const services = getLocalServices();
    const list = services[serialNumber] || [];
    const serviceTreeInfo = buildServiceHistoryTree(list);

    return list.map((item, idx) => ({
      ...item,
      recordDataHash: computeServiceRecordHash(item),
      proof: serviceTreeInfo.proofs[idx] || [],
      merkleRoot: serviceTreeInfo.root
    }));
  }

  getAllProducts() {
    return Object.values(getLocalProducts());
  }

  syncWithBackend(prods) {
    if (!prods || prods.length === 0) {
      this.clearLocalCache();
      return [];
    }
    const validSerials = new Set(prods.map(p => p.serialNumber.toLowerCase()));
    const localProds = getLocalProducts();
    let changed = false;

    // 1. Loại bỏ các sản phẩm không còn tồn tại ở backend
    for (const key of Object.keys(localProds)) {
      if (!validSerials.has(key.toLowerCase())) {
        delete localProds[key];
        changed = true;
      }
    }

    // 2. Tự động đồng bộ sản phẩm từ Backend vào local state nếu chưa có
    prods.forEach((bp) => {
      const serialKey = bp.serialNumber.trim();
      if (!localProds[serialKey]) {
        const metadataHash = computeMetadataHash(bp);
        const pin = bp.secretPin || '123456';
        const pinHash = ethers.keccak256(ethers.toUtf8Bytes(pin));
        const nowSec = Math.floor(Date.now() / 1000);
        const isDefaultActive = bp.defaultStatus === 'Active' || bp.status === 1;

        localProds[serialKey] = {
          serialNumber: serialKey,
          modelCode: bp.modelCode || 'MOD-STANDARD',
          manufacturer: bp.manufacturer || '0x0000000000000000000000000000000000000000',
          currentOwner: bp.currentOwner || '0x0000000000000000000000000000000000000000',
          manufactureDate: bp.manufactureDate ? Math.floor(new Date(bp.manufactureDate).getTime() / 1000) : (nowSec - 30 * 86400),
          warrantyMonths: Number(bp.standardWarrantyMonths) || 12,
          activationDate: bp.activationDate ? Math.floor(new Date(bp.activationDate).getTime() / 1000) : (isDefaultActive ? nowSec - 15 * 86400 : 0),
          expiryDate: bp.expiryDate ? Math.floor(new Date(bp.expiryDate).getTime() / 1000) : 0,
          status: bp.status !== undefined ? bp.status : (isDefaultActive ? 1 : 0),
          secretPin: pin,
          pinHash,
          pinUsed: bp.pinUsed || isDefaultActive,
          metadataHash,
          txHash: bp.activationTxHash || ('0x' + Array.from({ length: 64 }, () => Math.floor(Math.random() * 16).toString(16)).join('')),
          blockNumber: 1042500,
        };
        changed = true;
      }
    });

    if (changed) {
      saveLocalProducts(localProds);
    }
    return Object.values(localProds);
  }

  // Làm sạch bộ nhớ cache cục bộ
  clearLocalCache() {
    localStorage.removeItem(STORAGE_KEY_PRODUCTS);
    localStorage.removeItem(STORAGE_KEY_SERVICES);
    localStorage.removeItem(STORAGE_KEY_EVENTS);
    return {
      products: getLocalProducts(),
      services: getLocalServices(),
      events: getLocalEvents(),
    };
  }

  // Bí danh tương thích ngược
  resetDemoData() {
    return this.clearLocalCache();
  }
}

export const blockchainService = new BlockchainService();
