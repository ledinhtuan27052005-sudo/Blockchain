import React, { useState, useEffect, useRef } from 'react';
import Navbar from './components/Navbar';
import Sidebar from './components/Sidebar';
import HomePage from './components/HomePage';
import StatsBanner from './components/StatsBanner';
import PublicLookup from './components/PublicLookup';
import ManufacturerHub from './components/ManufacturerHub';
import SellerHub from './components/SellerHub';
import ServiceCenterHub from './components/ServiceCenterHub';
import LiveEventStream from './components/LiveEventStream';
import SystemNotificationBox from './components/SystemNotificationBox';
import AuthModal from './components/AuthModal';
import ProfileView from './components/ProfileView';
import AccessRestrictedCard from './components/AccessRestrictedCard';
import { blockchainService, ROLE_CONFIG } from './services/blockchain';
import { getProducts, getProductBySerial, getServiceCenters, requestFaucetEth } from './services/api';
import { computeMetadataHash } from './services/merkle';
import { authService } from './services/auth';
import { notificationService } from './services/notificationService';
import { Search, Factory, Store, Wrench, Radio, User } from 'lucide-react';

export default function App() {
  const initialUser = authService.getCurrentUser();
  const [currentUser, setCurrentUser] = useState(initialUser);
  const [isSidebarOpen, setIsSidebarOpen] = useState(false);
  const [showAuthModal, setShowAuthModal] = useState(false);
  const [authModalTab, setAuthModalTab] = useState('login');
  const [activeRole, setActiveRole] = useState(
    initialUser
      ? blockchainService.setRole(initialUser.role, initialUser)
      : { role: 'GUEST', label: 'Khách vãng lai (Chỉ đọc)', address: '0x0000000000000000000000000000000000000000', icon: 'User' }
  );
  const [activeTab, setActiveTab] = useState('home'); // Mặc định mở Trang Chủ Giới Thiệu khi mới vào
  const [profileSubTab, setProfileSubTab] = useState('profile'); // 'profile' | 'settings'
  const [searchSerial, setSearchSerial] = useState('');
  const [productData, setProductData] = useState(null);
  const [chainData, setChainData] = useState(null);
  const [serviceHistory, setServiceHistory] = useState([]);
  const [allProducts, setAllProducts] = useState([]);
  const [serviceCenters, setServiceCenters] = useState([]);
  const [networkMode, setNetworkMode] = useState('LOCAL'); // 'LOCAL' | 'SEPOLIA'
  const [eventsList, setEventsList] = useState([]);
  
  // In-system notification banner state
  const [systemNotice, setSystemNotice] = useState(null);

  // MetaMask state
  const [isMetaMaskConnected, setIsMetaMaskConnected] = useState(false);
  const [metaMaskAddress, setMetaMaskAddress] = useState(null);
  const [metaMaskNetwork, setMetaMaskNetwork] = useState(null);
  const [metaMaskBalance, setMetaMaskBalance] = useState('0.0');
  const [isFaucetLoading, setIsFaucetLoading] = useState(false);
  const metaMaskAddressRef = useRef(null);
  const isLoggingOutRef = useRef(false);
  const handleLogoutRef = useRef(null);

  // Chế độ Giao diện Sáng / Tối (Mặc định: Tone Xanh Dương & Nền Trắng)
  const [theme, setTheme] = useState(() => {
    try {
      const saved = localStorage.getItem('trustwarranty_theme');
      if (saved) return saved;
      return 'light';
    } catch (e) {
      return 'light';
    }
  });

  // Đồng bộ theme với thẻ HTML và LocalStorage
  useEffect(() => {
    try {
      localStorage.setItem('trustwarranty_theme', theme);
      if (theme === 'dark') {
        document.documentElement.classList.add('dark');
      } else {
        document.documentElement.classList.remove('dark');
      }
    } catch (e) {
      console.error('Lỗi thiết lập theme:', e);
    }
  }, [theme]);

  const handleToggleTheme = () => {
    setTheme((prev) => (prev === 'dark' ? 'light' : 'dark'));
  };

  /**
   * Phát thông báo: Vừa hiển thị popup toast ngắn hạn, vừa lưu vào Quả chuông
   * Chỉ lưu vào quả chuông nếu có tài khoản người dùng đang đăng nhập
   */
  const notifyUser = (notice) => {
    if (!notice) return;
    setSystemNotice(notice);

    if (typeof notice === 'object' && notice.title) {
      const activeUser = authService.getCurrentUser() || currentUser;
      if (activeUser) {
        const uid = activeUser.id || activeUser.email;
        notificationService.addNotification({
          title: notice.title,
          message: notice.message,
          type: notice.type || 'info',
          txHash: notice.txHash || null,
          details: notice.details || notice.message,
          action: notice.action || null,
          targetUserId: uid,
        });
      }
    }
  };

  // Load ban dau
  const loadInitialData = async () => {
    // 1. Backend products & centers
    const prods = await getProducts();
    const centers = await getServiceCenters();
    setServiceCenters(centers);

    // 2. Dong bo & ket hop blockchain state
    blockchainService.syncWithBackend(prods);

    if (!prods || prods.length === 0) {
      setAllProducts([]);
      setEventsList([]);
      setSearchSerial('');
      setChainData(null);
      setProductData(null);
      setServiceHistory([]);
    } else {
      const chainProds = blockchainService.getAllProducts();
      const combined = prods.map((bp) => {
        const cp = chainProds.find((p) => p.serialNumber.toLowerCase() === bp.serialNumber.toLowerCase()) || blockchainService.getProduct(bp.serialNumber);
        return {
          ...cp,
          name: bp.name || cp?.serialNumber,
          brand: bp.brand || 'Thiết bị',
          imageUrl: bp.imageUrl,
          specs: bp.specs,
        };
      });
      setAllProducts(combined);
      setEventsList(blockchainService.getHistoricalEvents());
    }

    // 3. Đồng bộ thông tin tài khoản mới nhất từ backend (Ví ngầm MPC tự động)
    if (authService.getToken()) {
      try {
        const freshUser = await authService.refreshProfile();
        if (freshUser) {
          setCurrentUser(freshUser);
        }
      } catch (profileErr) {
        console.warn('Lỗi refresh profile ban đầu:', profileErr.message);
      }
    }

    // 5. Kiem tra xem trinh duyet da cap quyen MetaMask tu truoc chua
    const mmCheck = await blockchainService.checkExistingConnection();
    if (mmCheck.connected) {
      metaMaskAddressRef.current = mmCheck.address;
      setIsMetaMaskConnected(true);
      setMetaMaskAddress(mmCheck.address);
      setMetaMaskNetwork(mmCheck.networkName);
      if (mmCheck.balance) setMetaMaskBalance(mmCheck.balance);
      setActiveRole({ ...blockchainService.getCurrentAccount() });

      // Đối với tài khoản doanh nghiệp đã liên kết ví
      if (initialUser && ['MANUFACTURER', 'SELLER', 'SERVICE_CENTER'].includes(initialUser.role)) {
        const savedWallet = localStorage.getItem('trustwarranty_linked_wallet_' + initialUser.id) || initialUser.walletAddress;
        if (savedWallet && savedWallet.toLowerCase() !== mmCheck.address.toLowerCase()) {
          notifyUser({
            type: 'warning',
            title: 'Ví MetaMask không trùng khớp',
            message: `Tài khoản doanh nghiệp này đã liên kết với ví ${savedWallet.slice(0, 6)}...${savedWallet.slice(-4)}, nhưng MetaMask hiện đang chọn ví ${mmCheck.address.slice(0, 6)}...${mmCheck.address.slice(-4)}. Hãy đổi sang đúng ví đã liên kết!`,
          });
        }
      }
    } else if (initialUser && ['MANUFACTURER', 'SELLER', 'SERVICE_CENTER'].includes(initialUser.role)) {
      // Nếu có ví đã liên kết và trình duyệt có MetaMask, tự động kết nối
      const savedWallet = localStorage.getItem('trustwarranty_linked_wallet_' + initialUser.id) || initialUser.walletAddress;
      if (savedWallet && typeof window !== 'undefined' && window.ethereum) {
        try {
          const autoRes = await blockchainService.connectMetaMask();
          if (autoRes.success) {
            metaMaskAddressRef.current = autoRes.address;
            setIsMetaMaskConnected(true);
            setMetaMaskAddress(autoRes.address);
            setMetaMaskNetwork(autoRes.networkName);
            setActiveRole({ ...blockchainService.getCurrentAccount() });
            setNetworkMode(blockchainService.getNetworkMode());

            if (autoRes.address.toLowerCase() === savedWallet.toLowerCase()) {
              notifyUser({
                type: 'success',
                title: 'Tự động kết nối ví doanh nghiệp',
                message: `Đã kết nối với ví MetaMask liên kết: ${autoRes.address.slice(0, 6)}...${autoRes.address.slice(-4)}`,
              });
            } else {
              notifyUser({
                type: 'warning',
                title: 'Ví MetaMask không trùng khớp',
                message: `Tài khoản doanh nghiệp liên kết ví ${savedWallet.slice(0, 6)}...${savedWallet.slice(-4)}, nhưng MetaMask đang chọn ví ${autoRes.address.slice(0, 6)}...${autoRes.address.slice(-4)}. Hãy chuyển sang đúng ví đã liên kết trên MetaMask!`,
              });
            }
          }
        } catch (e) {
          console.warn('Lỗi auto connect khi khởi động:', e);
        }
      }
    }
  };

  useEffect(() => {
    loadInitialData();

    // Lắng nghe sự kiện Smart Contract thời gian thực
    const unsubscribe = blockchainService.subscribeToEvents((newEvt) => {
      setEventsList((prev) => [newEvt, ...prev]);

      notifyUser({
        type: 'event',
        title: `Phát hiện Sự kiện On-Chain: ${newEvt.eventName}`,
        message: `Mã Serial: ${newEvt.serial} | Sổ cái vừa ghi nhận một giao dịch mới được xác nhận bởi Block #${newEvt.blockNumber}.`,
        txHash: newEvt.txHash,
      });
    });

    // Lắng nghe sự kiện từ MetaMask tiện ích
    if (typeof window !== 'undefined' && window.ethereum) {
      window.ethereum.on('accountsChanged', (accounts) => {
        if (isLoggingOutRef.current) {
          return;
        }
        if (accounts && accounts.length > 0) {
          const newAddr = accounts[0];
          // Tránh spam nếu địa chỉ ví không đổi
          if (metaMaskAddressRef.current && metaMaskAddressRef.current.toLowerCase() === newAddr.toLowerCase()) {
            return;
          }
          metaMaskAddressRef.current = newAddr;
          setIsMetaMaskConnected(true);
          setMetaMaskAddress(newAddr);
          blockchainService.isMetaMask = true;
          blockchainService.metaMaskAddress = newAddr;
          setActiveRole((prev) => ({ ...prev, address: newAddr }));

          blockchainService.getBalance(newAddr).then((bal) => {
            setMetaMaskBalance(bal);
            if (parseFloat(bal || '0') < 5.0) {
              requestFaucetEth(newAddr, '50.0').then((faucetRes) => {
                if (faucetRes && faucetRes.balance) {
                  setMetaMaskBalance(faucetRes.balance);
                  notifyUser({
                    type: 'success',
                    title: 'Tự động nạp ETH từ Faucet ⚡',
                    message: `Đã nạp 50 ETH cho tài khoản MetaMask mới (${newAddr.slice(0, 6)}...${newAddr.slice(-4)}). Số dư hiện tại: ${parseFloat(faucetRes.balance).toFixed(2)} ETH.`,
                  });
                }
              }).catch(err => console.warn('Lỗi auto faucet:', err));
            }
          });

          notifyUser({
            type: 'success',
            title: 'MetaMask đổi tài khoản',
            message: `Đã tự động chuyển sang ví: ${newAddr}`,
          });
        } else {
          // Khi MetaMask bị ngắt kết nối hoặc khóa ví (danh sách accounts rỗng)
          metaMaskAddressRef.current = null;
          setIsMetaMaskConnected(false);
          setMetaMaskAddress(null);
          setMetaMaskNetwork(null);

          const activeUser = authService.getCurrentUser() || currentUser;
          if (activeUser && handleLogoutRef.current) {
            // Đồng bộ hai chiều: Ngắt kết nối / khóa trên MetaMask -> Tự động đăng xuất tài khoản hệ thống
            handleLogoutRef.current();
          } else {
            blockchainService.disconnectMetaMask(false);
            setActiveRole(blockchainService.setRole('GUEST'));
          }
        }
      });

      window.ethereum.on('chainChanged', () => {
        window.location.reload();
      });
    }

    // Tự động kiểm tra ví khi người dùng quay lại tab sau khi vừa cài đặt/bật tiện ích
    const handleWindowFocus = async () => {
      if (typeof window !== 'undefined' && window.ethereum && !blockchainService.isMetaMask) {
        try {
          const mmCheck = await blockchainService.checkExistingConnection();
          if (mmCheck.connected) {
            setIsMetaMaskConnected(true);
            setMetaMaskAddress(mmCheck.address);
            setMetaMaskNetwork(mmCheck.networkName);
            setActiveRole({ ...blockchainService.getCurrentAccount() });
            notifyUser({
              type: 'success',
              title: 'Tự động nhận diện ví MetaMask',
              message: `Tiện ích MetaMask đã sẵn sàng! Đã tự động kết nối ví: ${mmCheck.address}`,
            });
          }
        } catch (e) {
          console.warn('Auto-detect on focus error:', e);
        }
      }
    };
    window.addEventListener('focus', handleWindowFocus);

    return () => {
      unsubscribe();
      window.removeEventListener('focus', handleWindowFocus);
    };
  }, []);

  const handleSearch = async (serial) => {
    const cleanSerial = serial.trim();
    if (!cleanSerial) return;

    const onChain = blockchainService.getProduct(cleanSerial);
    const history = blockchainService.getServiceHistory(cleanSerial);
    const offChain = await getProductBySerial(cleanSerial);

    if (!onChain) {
      setChainData(null);
      setProductData(null);
      setServiceHistory([]);
      notifyUser({
        type: 'error',
        title: 'Cảnh Báo Vi Phạm: Sản Phẩm Không Xác Thực',
        message: `Mã Serial "${cleanSerial}" không tồn tại trên hệ thống Smart Contract hoặc không thuộc danh mục xuất xưởng hợp lệ. Cảnh báo nguy cơ hàng giả mạo!`,
      });
      return;
    }

    // Ràng buộc bảo mật sở hữu: Cổng tra cứu dành cho Khách hàng
    if (currentUser?.role === 'CUSTOMER') {
      const userWallet = (currentUser?.walletAddress || '').toLowerCase().trim();
      const userPhone = (currentUser?.phone || '').trim();
      const userEmail = (currentUser?.email || '').toLowerCase().trim();

      const isOwner = Boolean(
        (userWallet && onChain.currentOwner && onChain.currentOwner.toLowerCase() === userWallet && userWallet !== '0x0000000000000000000000000000000000000000') ||
        (userWallet && offChain?.currentOwner && offChain.currentOwner.toLowerCase() === userWallet && userWallet !== '0x0000000000000000000000000000000000000000') ||
        (userWallet && offChain?.ownerAddress && offChain.ownerAddress.toLowerCase() === userWallet && userWallet !== '0x0000000000000000000000000000000000000000') ||
        (userPhone && offChain?.buyerPhone && offChain.buyerPhone.trim() === userPhone) ||
        (userPhone && offChain?.customerPhone && offChain.customerPhone.trim() === userPhone) ||
        (userEmail && offChain?.buyerEmail && offChain.buyerEmail.toLowerCase().trim() === userEmail) ||
        (userEmail && offChain?.customerEmail && offChain.customerEmail.toLowerCase().trim() === userEmail)
      );

      if (!isOwner) {
        setChainData(null);
        setProductData(null);
        setServiceHistory([]);
        notifyUser({
          type: 'error',
          title: 'Tra cứu không thành công',
          message: 'Sản phẩm không phải của bạn',
        });
        return;
      }
    } else if (!currentUser) {
      setChainData(null);
      setProductData(null);
      setServiceHistory([]);
      notifyUser({
        type: 'warning',
        title: 'Yêu cầu đăng nhập',
        message: 'Vui lòng đăng nhập tài khoản Khách hàng để tra cứu thông tin sản phẩm của bạn.',
      });
      return;
    }

    // Kiểm tra trường hợp 1: Thiết bị đã bị vô hiệu hóa bảo hành do vi phạm
    if (onChain.status === 3) {
      notifyUser({
        type: 'error',
        title: 'Cảnh Báo Vi Phạm: Bảo Hành Bị Vô Hiệu Hóa',
        message: `Thiết bị có Serial "${cleanSerial}" đã bị vô hiệu hóa quyền bảo hành trên Blockchain do can thiệp phần cứng hoặc vi phạm chính sách sử dụng!`,
      });
    } else {
      // Kiểm tra trường hợp 2: Tính toàn vẹn mã băm ngầm
      if (offChain && onChain.metadataHash) {
        const computed = computeMetadataHash(offChain);
        if (computed.toLowerCase() !== onChain.metadataHash.toLowerCase()) {
          notifyUser({
            type: 'error',
            title: 'Cảnh Báo Vi Phạm: Dữ Liệu Bị Thay Đổi Trái Phép',
            message: `Mã băm thông số kỹ thuật của [${cleanSerial}] không khớp với cam kết mã băm đã lưu trên Blockchain. Dữ liệu có dấu hiệu bị can thiệp trái phép!`,
          });
        } else {
          setSystemNotice((prev) => (prev?.title?.includes('Cảnh Báo Vi Phạm') ? null : prev));
        }
      }
    }

    setChainData(onChain);
    setProductData(offChain);
    setServiceHistory(history);
  };

  const handleSelectRole = (roleKey) => {
    const newRole = blockchainService.setRole(roleKey);
    setActiveRole({ ...newRole });
  };

  const handleToggleNetworkMode = () => {
    const newMode = networkMode === 'LOCAL' ? 'SEPOLIA' : 'LOCAL';
    setNetworkMode(newMode);
    blockchainService.setNetworkMode(newMode);

    notifyUser({
      type: 'info',
      title: newMode === 'SEPOLIA' ? 'Chế độ mạng: Sepolia Testnet' : 'Chế độ mạng: Local Fast Demo',
      message: newMode === 'SEPOLIA'
        ? 'Đã bật chế độ Ethereum Sepolia Testnet! Bạn có thể kết nối MetaMask để ký giao dịch on-chain thật.'
        : 'Đã bật chế độ Local Fast Demo! Mọi giao dịch được xử lý tức thì 0 giây phục vụ thuyết trình.',
    });
  };

  const handleConnectMetaMask = async () => {
    if (typeof window !== 'undefined' && !window.ethereum) {
      const storeUrl = 'https://chromewebstore.google.com/detail/metamask/nkbihfbeogaeaoehlefnkodbefgpgknn';
      try {
        window.open(storeUrl, '_blank', 'noopener,noreferrer');
      } catch (e) {
        console.warn('Popup blocked:', e);
      }

      notifyUser({
        type: 'info',
        title: 'Tự động mở trang Cài đặt / Bật MetaMask',
        message: 'Hệ thống đã tự động mở trang Cửa hàng Chrome của MetaMask. Hãy bấm "Thêm vào Chrome" (hoặc "Bật tiện ích"), sau đó bấm nút bên dưới để tải lại trang kết nối ví!',
        action: {
          label: 'Tải lại trang (F5)',
          onClick: () => window.location.reload(),
        },
      });
      return;
    }

    const res = await blockchainService.connectMetaMask();
    if (res.success) {
      metaMaskAddressRef.current = res.address;
      setIsMetaMaskConnected(true);
      setMetaMaskAddress(res.address);
      setMetaMaskNetwork(res.networkName);
      if (res.balance) setMetaMaskBalance(res.balance);
      setActiveRole({ ...blockchainService.getCurrentAccount() });
      setNetworkMode(blockchainService.getNetworkMode());

      // Tự động ghi nhớ và liên kết ví cho các vai trò doanh nghiệp
      if (currentUser && ['MANUFACTURER', 'SELLER', 'SERVICE_CENTER'].includes(currentUser.role)) {
        try {
          const key = 'trustwarranty_linked_wallet_' + currentUser.id;
          localStorage.setItem(key, res.address.toLowerCase());

          // Đồng bộ với hồ sơ trên cơ sở dữ liệu nếu có sự thay đổi
          if (!currentUser.walletAddress || currentUser.walletAddress.toLowerCase() !== res.address.toLowerCase()) {
            const updatedUser = await authService.updateProfile({ walletAddress: res.address });
            setCurrentUser(updatedUser);
          }
        } catch (linkErr) {
          console.warn('Lỗi lưu ví liên kết:', linkErr);
        }
      }

      notifyUser({
        type: 'success',
        title: 'Kết nối ví MetaMask thành công',
        message: `Địa chỉ ví: ${res.address} | Mạng: ${res.networkName}. Hệ thống đã ghi nhớ ví này cho tài khoản doanh nghiệp.`,
      });
    } else if (res.notInstalled) {
      notifyUser({
        type: 'info',
        title: 'Tự động mở trang Cài đặt / Bật MetaMask',
        message: res.error,
        action: {
          label: 'Tải lại trang (F5)',
          onClick: () => window.location.reload(),
        },
      });
    } else {
      notifyUser({
        type: 'error',
        title: 'Kết nối MetaMask thất bại',
        message: res.error,
      });
    }
  };

  
  // Đồng bộ số dư MetaMask liên tục theo thời gian thực (real-time sync)
  useEffect(() => {
    if (!isMetaMaskConnected || !metaMaskAddress) return;

    let isMounted = true;
    const syncBalance = async () => {
      try {
        const bal = await blockchainService.getBalance(metaMaskAddress);
        if (isMounted && bal !== undefined && bal !== null) {
          setMetaMaskBalance(bal);
        }
      } catch (e) {
        console.warn('Lỗi đồng bộ số dư MetaMask:', e);
      }
    };

    syncBalance();
    const interval = setInterval(syncBalance, 2500);
    window.addEventListener('focus', syncBalance);

    return () => {
      isMounted = false;
      clearInterval(interval);
      window.removeEventListener('focus', syncBalance);
    };
  }, [isMetaMaskConnected, metaMaskAddress]);

  const handleSwitchToGanache = async () => {
    const success = await blockchainService.switchToGanacheNetwork();
    if (success) {
      notifyUser({
        type: 'success',
        title: 'Chuyển mạng thành công',
        message: 'Đã chuyển MetaMask sang mạng Ganache Local (Chain ID: 1337).',
      });
      const bal = await blockchainService.getBalance();
      setMetaMaskBalance(bal);
    }
  };

  const handleTopUpFaucet = async (targetAddr) => {
    const addr = targetAddr || metaMaskAddressRef.current || (currentUser && currentUser.walletAddress);
    if (!addr || addr === '0x0000000000000000000000000000000000000000') {
      notifyUser({
        type: 'warning',
        title: 'Chưa có địa chỉ ví',
        message: 'Vui lòng kết nối ví MetaMask trước khi nạp ETH!',
      });
      return;
    }
    setIsFaucetLoading(true);
    try {
      const res = await requestFaucetEth(addr, '50.0');
      const newBal = parseFloat(res.balance || '50.0').toFixed(2);
      setMetaMaskBalance(newBal);
      notifyUser({
        type: 'success',
        title: 'Nạp ETH thành công! ⚡',
        message: `Đã nạp 50 ETH vào ví ${addr.slice(0, 6)}...${addr.slice(-4)}. Số dư mới: ${newBal} ETH.`,
      });
    } catch (err) {
      notifyUser({
        type: 'error',
        title: 'Nạp ETH thất bại',
        message: err.message || 'Không thể kết nối Faucet mạng nội bộ',
      });
    } finally {
      setIsFaucetLoading(false);
    }
  };

  const handleDisconnectMetaMask = async () => {
    metaMaskAddressRef.current = null;
    try {
      await blockchainService.disconnectMetaMask(true);
    } catch (err) {
      console.warn('Lỗi khi thu hồi quyền MetaMask:', err);
    }
    setIsMetaMaskConnected(false);
    setMetaMaskAddress(null);
    setMetaMaskNetwork(null);

    const activeUser = authService.getCurrentUser() || currentUser;
    if (activeUser) {
      // Đồng bộ hai chiều: Ngắt kết nối MetaMask -> Tự động đăng xuất tài khoản hệ thống
      handleLogout();
    } else {
      const guestRole = blockchainService.setRole('GUEST');
      setActiveRole({ ...guestRole });
    }
  };

  const handleClearCatalog = () => {
    blockchainService.clearLocalCache();
    loadInitialData();

    notifyUser({
      type: 'info',
      title: 'Đã làm mới bộ nhớ cache',
      message: 'Bộ nhớ lưu trữ dữ liệu sản phẩm cục bộ đã được làm sạch.',
    });
  };

  const handleAuthSuccess = (user) => {
    setCurrentUser(user);
    const roleKey = user.role || 'CUSTOMER';
    const syncedRole = blockchainService.setRole(roleKey, user.walletAddress);
    setActiveRole({ ...syncedRole });

    if (user.role === 'MANUFACTURER') {
      setActiveTab('manufacturer');
    } else if (user.role === 'SELLER') {
      setActiveTab('seller');
    } else if (user.role === 'SERVICE_CENTER') {
      setActiveTab('service');
    } else {
      setActiveTab('profile');
    }

    // Tự động kết nối ví MetaMask đã liên kết đối với Nhà sản xuất, Đại lý, Trạm bảo hành
    if (['MANUFACTURER', 'SELLER', 'SERVICE_CENTER'].includes(user.role)) {
      const savedWallet = localStorage.getItem('trustwarranty_linked_wallet_' + user.id) || user.walletAddress;
      if (savedWallet) {
        setTimeout(async () => {
          try {
            let check = await blockchainService.checkExistingConnection();
            let connAddr = check.connected ? check.address : null;

            // Nếu chưa kết nối sẵn và có extension MetaMask, tự động kết nối
            if (!connAddr && typeof window !== 'undefined' && window.ethereum) {
              const res = await blockchainService.connectMetaMask();
              if (res.success) {
                connAddr = res.address;
                check = { connected: true, address: res.address, networkName: res.networkName };
              }
            }

            if (connAddr) {
              if (connAddr.toLowerCase() === savedWallet.toLowerCase()) {
                metaMaskAddressRef.current = connAddr;
                setIsMetaMaskConnected(true);
                setMetaMaskAddress(connAddr);
                setMetaMaskNetwork(check.networkName || 'Ethereum');
                setActiveRole({ ...blockchainService.getCurrentAccount() });
                setNetworkMode(blockchainService.getNetworkMode());

                notifyUser({
                  type: 'success',
                  title: 'Tự động kết nối ví MetaMask',
                  message: `Hệ thống đã tự động nhận diện và kết nối với ví doanh nghiệp đã liên kết (${connAddr.slice(0, 6)}...${connAddr.slice(-4)}).`,
                });
              } else {
                notifyUser({
                  type: 'warning',
                  title: 'Ví MetaMask không trùng khớp',
                  message: `Tài khoản này đã liên kết với ví ${savedWallet.slice(0, 6)}...${savedWallet.slice(-4)}, nhưng MetaMask hiện đang chọn ví ${connAddr.slice(0, 6)}...${connAddr.slice(-4)}. Hãy chuyển sang đúng ví đã liên kết trên MetaMask!`,
                });
              }
            }
          } catch (autoErr) {
            console.warn('Lỗi tự động kết nối MetaMask khi đăng nhập:', autoErr);
          }
        }, 500);
      }
    }
  };

  const handleOpenAuthModal = (tab = 'login') => {
    setAuthModalTab(tab);
    setShowAuthModal(true);
  };

  const handleLogout = async () => {
    isLoggingOutRef.current = true;
    try {
      // Đồng bộ hai chiều: Đăng xuất hệ thống -> Tự động thu hồi quyền & Disconnect MetaMask (EIP-2255)
      await blockchainService.disconnectMetaMask(true);
    } catch (err) {
      console.warn('Lỗi khi huỷ kết nối ví MetaMask:', err);
    }
    metaMaskAddressRef.current = null;
    setIsMetaMaskConnected(false);
    setMetaMaskAddress(null);
    setMetaMaskNetwork(null);

    authService.logout();
    setCurrentUser(null);

    const guestRole = blockchainService.setRole('GUEST');
    setActiveRole({ ...guestRole });
    setActiveTab('lookup');

    setAuthModalTab('login');
    setShowAuthModal(true);

    // Không gửi bất kỳ thông báo đăng xuất nào (theo yêu cầu người dùng)
    setSystemNotice(null);

    // Reset toàn bộ thông tin tra cứu sản phẩm khi đăng xuất (không giữ nguyên số liệu)
    setSearchSerial('');
    setProductData(null);
    setChainData(null);
    setServiceHistory([]);

    setTimeout(() => {
      isLoggingOutRef.current = false;
    }, 1000);
  };
  handleLogoutRef.current = handleLogout;

  // Tinh toan thong ke
  const activeWarrantiesCount = allProducts.filter((p) => p.status === 1).length;
  const totalServiceRecords = allProducts.reduce((acc, p) => {
    const history = blockchainService.getServiceHistory(p.serialNumber);
    return acc + (history?.length || 0);
  }, 0);

  return (
    <div className="min-h-screen bg-slate-50 dark:bg-[#0b0f19] text-slate-800 dark:text-slate-100 flex flex-col relative transition-colors duration-200">
      
      {/* Universal Collapsible Drawer Sidebar */}
      <Sidebar
        activeTab={activeTab}
        onSelectTab={setActiveTab}
        currentUser={currentUser}
        eventCount={eventsList.length}
        isMetaMaskConnected={isMetaMaskConnected}
        metaMaskAddress={metaMaskAddress}
        metaMaskNetwork={metaMaskNetwork}
        onConnectMetaMask={handleConnectMetaMask}
        networkMode={networkMode}
        isOpen={isSidebarOpen}
        onClose={() => setIsSidebarOpen(false)}
      />

      {/* Main Content Area */}
      <div className="flex-1 flex flex-col min-h-screen">
        {/* Sticky Topbar */}
        <Navbar
          activeRole={activeRole}
          onConnectMetaMask={handleConnectMetaMask}
          onDisconnectMetaMask={handleDisconnectMetaMask}
          activeTab={activeTab}
          onSelectTab={setActiveTab}
          networkMode={networkMode}
          onToggleNetworkMode={handleToggleNetworkMode}
          eventCount={eventsList.length}
          isMetaMaskConnected={isMetaMaskConnected}
          metaMaskAddress={metaMaskAddress}
          metaMaskNetwork={metaMaskNetwork}
          metaMaskBalance={metaMaskBalance}
          onTopUpFaucet={() => handleTopUpFaucet()}
          isFaucetLoading={isFaucetLoading}
          onSwitchToGanache={handleSwitchToGanache}
          currentUser={currentUser}
          onOpenAuthModal={() => handleOpenAuthModal('login')}
          onLogout={handleLogout}
          onOpenProfile={() => {
            setProfileSubTab('profile');
            setActiveTab('profile');
          }}
          onOpenSettings={() => {
            setProfileSubTab('settings');
            setActiveTab('profile');
          }}
          theme={theme}
          onToggleTheme={handleToggleTheme}
          onToggleSidebar={() => setIsSidebarOpen((prev) => !prev)}
          isSidebarOpen={isSidebarOpen}
        />

        {/* Main Container */}
        <main className="flex-1 w-full max-w-[1920px] 2xl:max-w-full mx-auto px-3 sm:px-5 lg:px-6 2xl:px-10 py-5 sm:py-6 space-y-6">
          
          {/* IN-APP SYSTEM NOTIFICATION BOX (Khung thông báo tích hợp) */}
          {systemNotice && (
            <SystemNotificationBox
              notice={systemNotice}
              onClose={() => setSystemNotice(null)}
            />
          )}

          {/* Quick System Metrics (Hiển thị ở các phân hệ nghiệp vụ) */}
          {activeTab !== 'home' && (
            <StatsBanner
              totalProducts={allProducts.length}
              activeCount={activeWarrantiesCount}
              totalServices={totalServiceRecords}
            />
          )}

          {/* Active Portal Views */}
          <div>
          {activeTab === 'home' && (
            <HomePage
              onNavigate={(tabId) => setActiveTab(tabId)}
              onOpenAuthModal={() => handleOpenAuthModal('login')}
              currentUser={currentUser}
              totalProducts={allProducts.length}
              activeCount={activeWarrantiesCount}
              totalServices={totalServiceRecords}
              eventCount={eventsList.length}
            />
          )}

          {activeTab === 'lookup' && (
            <PublicLookup
              searchSerial={searchSerial}
              setSearchSerial={setSearchSerial}
              onSearch={handleSearch}
              productData={productData}
              chainData={chainData}
              serviceHistory={serviceHistory}
              serviceCenters={serviceCenters}
              onDataChanged={() => loadInitialData()}
              onNotify={(notice) => notifyUser(notice)}
              isMetaMaskConnected={isMetaMaskConnected}
              onConnectMetaMask={handleConnectMetaMask}
              currentUser={currentUser}
              onNavigate={(tabId) => setActiveTab(tabId)}
            />
          )}

          {activeTab === 'events' && (
            currentUser ? (
              <LiveEventStream
                onSelectSerial={(sn) => {
                  setSearchSerial(sn);
                  handleSearch(sn);
                  setActiveTab('lookup');
                }}
              />
            ) : (
              <AccessRestrictedCard
                requiredRole="MEMBER"
                requiredRoleName="Người dùng đã đăng nhập"
                currentUser={currentUser}
                onOpenAuthModal={() => handleOpenAuthModal('login')}
                onNavigateHome={() => setActiveTab('lookup')}
              />
            )
          )}

          {activeTab === 'manufacturer' && (
            currentUser?.role === 'MANUFACTURER' ? (
              <ManufacturerHub
                allProducts={allProducts}
                serviceCenters={serviceCenters}
                isMetaMaskConnected={isMetaMaskConnected}
                metaMaskAddress={metaMaskAddress}
                onConnectMetaMask={handleConnectMetaMask}
                onNotify={(notice) => notifyUser(notice)}
                onProductAdded={() => {
                  loadInitialData();
                  notifyUser({
                    type: 'success',
                    title: 'Dữ liệu sản phẩm đã cập nhật',
                    message: 'Thông tin sản phẩm đã được đồng bộ hóa thành công với Smart Contract và CSDL.',
                  });
                }}
              />
            ) : (
              <AccessRestrictedCard
                requiredRole="MANUFACTURER"
                requiredRoleName="Nhà sản xuất"
                currentUser={currentUser}
                onOpenAuthModal={() => handleOpenAuthModal('login')}
                onNavigateHome={() => setActiveTab('lookup')}
              />
            )
          )}

          {activeTab === 'seller' && (
            currentUser?.role === 'SELLER' ? (
              <SellerHub
                allProducts={allProducts}
                isMetaMaskConnected={isMetaMaskConnected}
                metaMaskAddress={metaMaskAddress}
                onConnectMetaMask={handleConnectMetaMask}
                onProductAdded={() => {
                  loadInitialData();
                  notifyUser({
                    type: 'success',
                    title: 'Đăng ký thiết bị thành công',
                    message: 'Thiết bị đã được thêm vào danh mục quản lý của đại lý.',
                  });
                }}
                onWarrantyActivated={() => {
                  loadInitialData();
                  notifyUser({
                    type: 'success',
                    title: 'Kích hoạt bảo hành thành công',
                    message: 'Thiết bị đã được kích hoạt bảo hành điện tử chính thức trên Blockchain.',
                  });
                }}
                onWarrantyExtended={() => {
                  loadInitialData();
                  notifyUser({
                    type: 'success',
                    title: 'Gia hạn bảo hành thành công',
                    message: 'Thời hạn bảo hành của thiết bị đã được gia hạn thêm trên Blockchain.',
                  });
                }}
                onNotify={(notice) => notifyUser(notice)}
              />
            ) : (
              <AccessRestrictedCard
                requiredRole="SELLER"
                requiredRoleName="Đại lý bán lẻ"
                currentUser={currentUser}
                onOpenAuthModal={() => handleOpenAuthModal('login')}
                onNavigateHome={() => setActiveTab('lookup')}
              />
            )
          )}

          {activeTab === 'service' && (
            currentUser?.role === 'SERVICE_CENTER' ? (
              <ServiceCenterHub
                allProducts={allProducts}
                isMetaMaskConnected={isMetaMaskConnected}
                metaMaskAddress={metaMaskAddress}
                onConnectMetaMask={handleConnectMetaMask}
                onServiceRecorded={() => {
                  loadInitialData();
                  notifyUser({
                    type: 'success',
                    title: 'Ghi nhận biên bản bảo dưỡng thành công',
                    message: 'Biên bản dịch vụ kỹ thuật đã được lưu vĩnh viễn trên sổ cái Blockchain.',
                  });
                }}
                onNotify={(notice) => notifyUser(notice)}
              />
            ) : (
              <AccessRestrictedCard
                requiredRole="SERVICE_CENTER"
                requiredRoleName="Trạm dịch vụ ủy quyền"
                currentUser={currentUser}
                onOpenAuthModal={() => handleOpenAuthModal('login')}
                onNavigateHome={() => setActiveTab('lookup')}
              />
            )
          )}

          {activeTab === 'profile' && currentUser && (
            <ProfileView
              currentUser={currentUser}
              onLogout={handleLogout}
              allProducts={allProducts}
              onSelectSerial={(sn) => {
                setSearchSerial(sn);
                handleSearch(sn);
                setActiveTab('lookup');
              }}
              onNotify={(notice) => notifyUser(notice)}
              metaMaskAddress={metaMaskAddress}
              onConnectMetaMask={handleConnectMetaMask}
              onDataReset={loadInitialData}
              metaMaskBalance={metaMaskBalance}
              onTopUpFaucet={handleTopUpFaucet}
              isFaucetLoading={isFaucetLoading}
              initialSubTab={profileSubTab}
              onSubTabChange={(subTab) => setProfileSubTab(subTab)}
            />
          )}
        </div>

      </main>

      {/* Authentication Modal */}
      <AuthModal
        isOpen={showAuthModal}
        onClose={() => setShowAuthModal(false)}
        onAuthSuccess={handleAuthSuccess}
        metaMaskAddress={metaMaskAddress}
        onConnectMetaMask={handleConnectMetaMask}
        initialTab={authModalTab}
      />

      {/* Footer */}
      <footer className="border-t border-slate-200 dark:border-slate-800/80 bg-white dark:bg-slate-950 py-6 px-4 lg:px-8 mt-12 text-xs text-slate-500 transition-colors">
        <div className="w-full max-w-[1920px] 2xl:max-w-full mx-auto flex items-center justify-center">
          <div className="flex items-center gap-2.5">
            <img src="/logo.png" alt="TrustWarranty" className="w-5 h-5 object-contain rounded-md" />
            <span className="text-slate-800 dark:text-slate-300 font-bold">TrustWarranty System</span>
            <span>— Hệ thống Quản lý Bảo hành & Lịch sử Dịch vụ</span>
          </div>
        </div>
      </footer>

      </div>

    </div>
  );
}
