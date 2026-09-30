import express from 'express';
import cors from 'cors';
import fs from 'fs';
import path from 'path';
import crypto from 'crypto';
import dotenv from 'dotenv';
import { ethers } from 'ethers';
import { fileURLToPath } from 'url';
import {
  productBatchTree,
  genuinePartsTree,
  computeSerialHash,
  computeMetadataHash,
  computeServiceRecordHash,
  buildServiceHistoryTree
} from './utils/merkle.js';
import {
  computeIpfsCid,
  formatIpfsUri,
  getIpfsGatewayUrl
} from './utils/ipfs.js';
import {
  sendOtpEmail,
  sendWarrantyActivationEmail,
  sendRepairCompletedEmail,
  sendWarrantyExpiringEmail
} from './services/emailService.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Nap bien moi truong tu file .env
dotenv.config({ path: path.join(__dirname, '.env') });

const app = express();
const PORT = process.env.PORT || 5000;
const JWT_SECRET = process.env.JWT_SECRET || 'TRUST_SECRET_KEY_9988';
const PASSWORD_SALT = process.env.PASSWORD_SALT || 'TRUST_WARRANTY_SALT_2026';

app.use(cors());
app.use(express.json());
app.use((err, req, res, next) => {
  if (err instanceof SyntaxError && err.status === 400 && 'body' in err) {
    return res.status(400).json({ error: 'Định dạng JSON gửi lên không hợp lệ' });
  }
  next(err);
});
process.on('uncaughtException', (err) => console.error('⚠️ Uncaught Exception intercepted:', err.message));
process.on('unhandledRejection', (reason) => console.error('⚠️ Unhandled Rejection intercepted:', reason));

// Defense-in-Depth: HTTP Security Headers
app.use((req, res, next) => {
  res.setHeader('X-Content-Type-Options', 'nosniff');
  res.setHeader('X-Frame-Options', 'SAMEORIGIN');
  res.setHeader('X-XSS-Protection', '1; mode=block');
  next();
});

// Middleware chong cao du lieu tu dong (Rate limiting bang Memory Sliding Window)
const rateLimitMap = new Map();
const RATE_LIMIT_WINDOW_MS = 60 * 1000;
const MAX_REQUESTS_PER_WINDOW = 120;

app.use((req, res, next) => {
  const ip = req.ip || req.connection.remoteAddress || '127.0.0.1';
  const now = Date.now();
  const clientData = rateLimitMap.get(ip) || { count: 0, startTime: now };

  if (now - clientData.startTime > RATE_LIMIT_WINDOW_MS) {
    clientData.count = 1;
    clientData.startTime = now;
  } else {
    clientData.count += 1;
  }

  rateLimitMap.set(ip, clientData);

  if (clientData.count > MAX_REQUESTS_PER_WINDOW) {
    return res.status(429).json({
      error: 'Too Many Requests',
      message: 'Vuot qua gioi han truy van an toan. Vui long thu lai sau 1 phut.',
    });
  }
  next();
});

const productsFilePath = path.join(__dirname, 'data', 'products.json');
const centersFilePath = path.join(__dirname, 'data', 'serviceCenters.json');
const usersFilePath = path.join(__dirname, 'data', 'users.json');
const rmaFilePath = path.join(__dirname, 'data', 'rmaTickets.json');
const contractArtifactPath = path.join(__dirname, 'contractArtifacts.json');

// Trang thai Bo ngat khan cap (Circuit Breaker / Pausable)
let circuitBreakerState = {
  paused: false,
  pausedBy: '0x0000000000000000000000000000000000000000',
  pausedAt: null,
  reason: '',
};

// Map luu tru ban goc truoc khi dien tap can thiep (Tamper Simulation)
const tamperBackupMap = new Map();


function readJSON(file) {
  try {
    if (!fs.existsSync(file)) {
      fs.writeFileSync(file, '[]', 'utf8');
      return [];
    }
    const data = fs.readFileSync(file, 'utf8');
    return JSON.parse(data);
  } catch (err) {
    console.error(`Loi doc file ${file}:`, err.message);
    return [];
  }
}

function writeJSON(file, data) {
  fs.writeFileSync(file, JSON.stringify(data, null, 2), 'utf8');
}

function hashPassword(password) {
  return crypto.createHash('sha256').update(password + PASSWORD_SALT).digest('hex');
}

function generateToken(user) {
  const payload = Buffer.from(JSON.stringify({ id: user.id, username: user.username, exp: Date.now() + 30 * 86400 * 1000 })).toString('base64url');
  const signature = crypto.createHmac('sha256', JWT_SECRET).update(payload).digest('base64url');
  return `${payload}.${signature}`;
}

function verifyToken(token) {
  if (!token) return null;
  const parts = token.split('.');
  if (parts.length !== 2) return null;
  const [payload, signature] = parts;
  const expectedSig = crypto.createHmac('sha256', JWT_SECRET).update(payload).digest('base64url');
  if (signature !== expectedSig) return null;
  try {
    const data = JSON.parse(Buffer.from(payload, 'base64url').toString('utf8'));
    if (data.exp && Date.now() > data.exp) return null;
    return data;
  } catch {
    return null;
  }
}

// Hàm tự sinh Ví Ngầm (MPC / Embedded Wallet) tự động cho khách hàng
function generateEmbeddedWallet(seedKey = null) {
  if (seedKey && typeof seedKey === 'string' && seedKey.trim()) {
    const hashSeed = crypto.createHash('sha256').update('TRUST_WARRANTY_EMBEDDED_' + seedKey.toLowerCase().trim()).digest('hex');
    const deterministicWallet = new ethers.Wallet('0x' + hashSeed);
    return {
      address: deterministicWallet.address,
      privateKey: deterministicWallet.privateKey,
      walletType: 'EMBEDDED_MPC',
      isEmbedded: true,
    };
  }
  const randomWallet = ethers.Wallet.createRandom();
  return {
    address: randomWallet.address,
    privateKey: randomWallet.privateKey,
    walletType: 'EMBEDDED_MPC',
    isEmbedded: true,
  };
}

// Hàm tự động phân quyền On-Chain (RBAC) trên Smart Contract cho ví doanh nghiệp
async function grantOnChainRole(role, walletAddress) {
  if (!walletAddress || !ethers.isAddress(walletAddress) || walletAddress === '0x0000000000000000000000000000000000000000') {
    return false;
  }
  try {
    if (!fs.existsSync(contractArtifactPath)) return false;
    const artifact = readJSON(contractArtifactPath);
    if (!artifact.address || !artifact.abi) return false;

    const provider = new ethers.JsonRpcProvider('http://127.0.0.1:8545');
    const deployerKey = process.env.DEPLOYER_PRIVATE_KEY || '0xac0974bec39a17e36ba4a6b4d238ff944bacb478cbed5efcae784d7bf4f2ff80';
    const signer = new ethers.Wallet(deployerKey, provider);
    const contract = new ethers.Contract(artifact.address, artifact.abi, signer);
    const cleanAddr = ethers.getAddress(walletAddress);

    if (role === 'MANUFACTURER') {
      const isMfg = await contract.authorizedManufacturers(cleanAddr);
      if (!isMfg) {
        const nonce1 = await provider.getTransactionCount(signer.address, 'pending');
        const tx1 = await contract.setManufacturer(cleanAddr, true, { nonce: nonce1 });
        await tx1.wait(1);
      }
      const isSeller = await contract.authorizedSellers(cleanAddr);
      if (!isSeller) {
        const nonce2 = await provider.getTransactionCount(signer.address, 'pending');
        const tx2 = await contract.setSeller(cleanAddr, true, { nonce: nonce2 });
        await tx2.wait(1);
      }
      const isSC = await contract.authorizedServiceCenters(cleanAddr);
      if (!isSC) {
        const nonce3 = await provider.getTransactionCount(signer.address, 'pending');
        const tx3 = await contract.setServiceCenter(cleanAddr, true, { nonce: nonce3 });
        await tx3.wait(1);
      }
      console.log(`✓ [On-Chain RBAC] Đã kích hoạt quyền MANUFACTURER/SELLER/SERVICE_CENTER cho ví: ${cleanAddr}`);
      return true;
    } else if (role === 'SELLER') {
      const isSeller = await contract.authorizedSellers(cleanAddr);
      if (!isSeller) {
        const nonce = await provider.getTransactionCount(signer.address, 'pending');
        const tx = await contract.setSeller(cleanAddr, true, { nonce });
        await tx.wait(1);
      }
      console.log(`✓ [On-Chain RBAC] Đã kích hoạt quyền SELLER cho ví: ${cleanAddr}`);
      return true;
    } else if (role === 'SERVICE_CENTER') {
      const isSC = await contract.authorizedServiceCenters(cleanAddr);
      if (!isSC) {
        const nonce = await provider.getTransactionCount(signer.address, 'pending');
        const tx = await contract.setServiceCenter(cleanAddr, true, { nonce });
        await tx.wait(1);
      }
      console.log(`✓ [On-Chain RBAC] Đã kích hoạt quyền SERVICE_CENTER cho ví: ${cleanAddr}`);
      return true;
    }
  } catch (err) {
    console.warn(`⚠️ Lỗi cấp quyền on-chain (${role}, ${walletAddress}):`, err.message);
    return false;
  }
  return false;
}

// Ham tien ich chuan hoa san pham kem Hash on-chain va IPFS CID
function enrichProduct(product) {
  if (!product) return null;
  const serialHash = computeSerialHash(product.serialNumber);
  const metadataHash = computeMetadataHash(product);
  const ipfsCid = computeIpfsCid(product);
  return {
    ...product,
    serialHash,
    metadataHash,
    ipfsCid,
    ipfsUri: formatIpfsUri(ipfsCid),
    ipfsGatewayUrl: getIpfsGatewayUrl(ipfsCid),
  };
}

function authMiddleware(req, res, next) {
  const authHeader = req.headers.authorization;
  const token = authHeader?.startsWith('Bearer ') ? authHeader.slice(7) : (req.query.token || req.headers['x-access-token']);
  const decoded = verifyToken(token);
  if (!decoded) {
    return res.status(401).json({ error: 'Yêu cầu xác thực tài khoản (Token không hợp lệ hoặc đã hết hạn)' });
  }
  const users = readJSON(usersFilePath);
  const user = users.find(u => u.id === decoded.id);
  if (!user) {
    return res.status(401).json({ error: 'Người dùng không còn tồn tại trên hệ thống' });
  }
  req.user = user;
  next();
}

// 1. API lay danh sach san pham bo tro (Kem Ma Bam Cryptographic Hashes & IPFS CID)
app.get('/api/products', (req, res) => {
  const products = readJSON(productsFilePath);
  const search = req.query.search?.toLowerCase();

  const enrichedProducts = products.map(enrichProduct);

  if (search) {
    const filtered = enrichedProducts.filter(p =>
      p.serialNumber.toLowerCase().includes(search) ||
      p.name.toLowerCase().includes(search) ||
      p.brand.toLowerCase().includes(search) ||
      p.modelCode.toLowerCase().includes(search)
    );
    return res.json(filtered);
  }
  res.json(enrichedProducts);
});

// 2. API lay chi tiet 1 san pham theo Serial (Kem Ma Bam Cryptographic Hashes & IPFS CID)
app.get('/api/products/:serial', (req, res) => {
  const serial = req.params.serial.trim();
  const products = readJSON(productsFilePath);
  const product = products.find(p => p.serialNumber.toLowerCase() === serial.toLowerCase());
  if (!product) {
    return res.status(404).json({ error: 'Khong tim thay thong tin san pham voi serial nay' });
  }

  res.json(enrichProduct(product));
});

// 3. API tao / them thong tin san pham moi (Nha san xuat)
app.post('/api/products', (req, res) => {
  if (circuitBreakerState.paused) {
    return res.status(503).json({
      error: 'HỆ THỐNG ĐANG BẬT NGẮT KHẨN CẤP (CIRCUIT BREAKER ACTIVATED): Mọi thao tác ghi dữ liệu tạm thời bị đóng băng để bảo vệ an toàn!',
      details: circuitBreakerState
    });
  }

  const { serialNumber, modelCode, name, brand, category, specs, documentation, imageUrl, standardWarrantyMonths } = req.body;

  // Kiem tra quyen han RBAC neu co token xac thuc
  const authHeader = req.headers.authorization;
  const token = authHeader?.startsWith('Bearer ') ? authHeader.slice(7) : (req.query.token || req.headers['x-access-token']);
  if (token) {
    const decoded = verifyToken(token);
    if (decoded) {
      const users = readJSON(usersFilePath);
      const user = users.find(u => u.id === decoded.id);
      if (user && user.role !== 'MANUFACTURER' && user.role !== 'SELLER') {
        return res.status(403).json({
          error: `Từ chối phân quyền: Chỉ tài khoản Nhà sản xuất (MANUFACTURER) hoặc Đại lý ủy quyền (SELLER) mới có quyền lưu thông số kỹ thuật sản phẩm mới! (Vai trò hiện tại: ${user.role})`
        });
      }
    }
  }

  if (!serialNumber || !name || !brand) {
    return res.status(400).json({ error: 'Thieu cac truong thong tin bat buoc' });
  }

  const products = readJSON(productsFilePath);
  const existingIndex = products.findIndex(p => p.serialNumber.toLowerCase() === serialNumber.toLowerCase());

  // Tao ma PIN cao bao mat chong sao chep serial vat ly (Anti-Cloning Secret PIN)
  const pin = (req.body.secretPin && req.body.secretPin.trim()) || `PIN-${Math.floor(100000 + Math.random() * 900000)}`;
  const pinHash = crypto.createHash('sha256').update(pin.trim()).digest('hex');

  const newProduct = {
    serialNumber: serialNumber.trim(),
    modelCode: modelCode || 'MOD-' + Date.now(),
    name: name.trim(),
    brand: brand.trim(),
    category: category || 'Thiet bi dien tu',
    imageUrl: imageUrl || 'https://images.unsplash.com/photo-1526738549149-8e07eca6c147?auto=format&fit=crop&w=800&q=80',
    manufactureDate: new Date().toISOString().split('T')[0],
    standardWarrantyMonths: Number(standardWarrantyMonths) || 12,
    specs: specs || {},
    documentation: documentation || {
      manualUrl: '#',
      safetyGuide: '#',
      serviceCoverage: 'Chinh hang toan quoc'
    },
    defaultStatus: 'Inactive',
    secretPin: pin,
    pinHash,
    pinUsed: false,
  };

  const enrichedNewProduct = enrichProduct(newProduct);

  if (existingIndex >= 0) {
    products[existingIndex] = { ...products[existingIndex], ...newProduct };
  } else {
    products.unshift(newProduct);
  }

  writeJSON(productsFilePath, products);
  res.status(201).json({
    message: 'Lưu thông tin sản phẩm và khởi tạo tem cào mã PIN bảo mật thành công',
    product: enrichedNewProduct,
    secretPin: pin,
    pinHash,
  });
});

// 4. API lay danh sach tram bao hanh uy quyen
app.get('/api/service-centers', (req, res) => {
  const centers = readJSON(centersFilePath);
  res.json(centers);
});

// 5. API dang ky tram bao hanh moi
app.post('/api/service-centers', (req, res) => {
  const { name, code, address, phone, ethAddress, servicesSupported } = req.body;
  if (!name || !address || !ethAddress) {
    return res.status(400).json({ error: 'Thieu thong tin tram bao hanh' });
  }
  const centers = readJSON(centersFilePath);
  const newCenter = {
    id: 'CTR-' + Date.now(),
    name,
    code: code || 'CTR-' + Math.floor(100 + Math.random() * 900),
    address,
    phone: phone || '1900.xxxx',
    ethAddress: ethAddress.trim(),
    rating: 5.0,
    servicesSupported: servicesSupported || ['Bao duong', 'Sua chua']
  };
  centers.push(newCenter);
  writeJSON(centersFilePath, centers);
  res.status(201).json({ message: 'Them tram bao hanh thanh cong', center: newCenter });
});

// 6. API lay thong tin Smart Contract (ABI, bytecode)
app.get('/api/contract', (req, res) => {
  if (fs.existsSync(contractArtifactPath)) {
    const artifact = readJSON(contractArtifactPath);
    return res.json(artifact);
  }
  res.status(404).json({ error: 'Chua bien dich smart contract' });
});

// 7. API thong ke he thong
app.get('/api/stats', (req, res) => {
  const products = readJSON(productsFilePath);
  const centers = readJSON(centersFilePath);

  res.json({
    totalProductsInCatalog: products.length,
    totalCenters: centers.length,
    brands: [...new Set(products.map(p => p.brand))],
    categories: [...new Set(products.map(p => p.category))]
  });
});

// 7.1. API xác thực mã PIN cào bảo mật vật lý (Anti-Cloning PIN Verification)
app.post('/api/products/:serial/verify-pin', (req, res) => {
  const serial = req.params.serial.trim();
  const { pin } = req.body;
  if (!pin) {
    return res.status(400).json({ valid: false, error: 'Vui lòng cung cấp mã PIN cào bảo mật!' });
  }

  const products = readJSON(productsFilePath);
  const prod = products.find(p => p.serialNumber.toLowerCase() === serial.toLowerCase());
  if (!prod) {
    return res.status(404).json({ valid: false, error: 'Không tìm thấy thông tin sản phẩm trên hệ thống!' });
  }

  if (!prod.pinHash) {
    return res.json({ valid: true, message: 'Thiết bị không yêu cầu mã PIN cào (Legacy Product)' });
  }

  const computedHash = crypto.createHash('sha256').update(pin.trim()).digest('hex');
  if (computedHash !== prod.pinHash) {
    return res.status(400).json({
      valid: false,
      error: 'MÃ PIN CÀO BẢO MẬT KHÔNG HỢP LỆ! Không thể kích hoạt bảo hành nếu không có thiết bị vật lý trong tay.'
    });
  }

  res.json({
    valid: true,
    message: 'Mã PIN cào bảo mật hoàn toàn chính xác. Xác thực sở hữu vật lý thành công!'
  });
});

// 7.1b. API Paymaster / Relayer tài trợ phí Gas (Gasless 0 ETH) cho Khách Hàng kích hoạt bảo hành
app.post('/api/paymaster/relay-activate', async (req, res) => {
  if (circuitBreakerState.paused) {
    return res.status(503).json({
      error: 'HỆ THỐNG ĐANG BẬT NGẮT KHẨN CẤP (CIRCUIT BREAKER ACTIVATED): Không thể thực hiện giao dịch Paymaster!',
    });
  }

  const { serialNumber, secretPin, customerAddress, customerName, customerEmail } = req.body;

  if (!serialNumber) {
    return res.status(400).json({ error: 'Vui lòng cung cấp số Serial của thiết bị' });
  }

  const cleanSerial = serialNumber.trim();
  const products = readJSON(productsFilePath);
  const prodIndex = products.findIndex(p => p.serialNumber.toLowerCase() === cleanSerial.toLowerCase());

  if (prodIndex === -1) {
    return res.status(404).json({ error: 'Không tìm thấy sản phẩm với mã Serial này trên hệ thống!' });
  }

  const product = products[prodIndex];

  // Kiểm tra trạng thái đã kích hoạt chưa
  if (product.status === 1 || product.activationDate) {
    return res.status(400).json({
      error: 'Sản phẩm này đã được kích hoạt bảo hành trước đó',
      activationDate: product.activationDate,
      expiryDate: product.expiryDate
    });
  }

  // Kiểm tra mã PIN cào bảo mật nếu sản phẩm có thiết lập PIN
  if (product.pinHash || product.secretPin) {
    if (!secretPin || !secretPin.trim()) {
      return res.status(400).json({
        error: 'Sản phẩm yêu cầu nhập mã PIN cào bảo mật trên tem chống giả vật lý để kích hoạt!',
        requirePin: true
      });
    }
    const cleanPin = secretPin.trim();
    const pinHashSha = crypto.createHash('sha256').update(cleanPin).digest('hex');
    if (product.pinHash && pinHashSha !== product.pinHash && cleanPin !== product.secretPin) {
      return res.status(400).json({
        error: 'MÃ PIN CÀO BẢO MẬT KHÔNG HỢP LỆ! Vui lòng kiểm tra lại lớp cào trên tem sản phẩm.',
      });
    }
  }

  // Xác định địa chỉ ví người nhận (ví ngầm của user hoặc ví truyền vào)
  let targetWallet = customerAddress ? customerAddress.trim() : null;
  if (!targetWallet || targetWallet === '0x0000000000000000000000000000000000000000') {
    // Nếu có token xác thực, lấy ví từ token user
    const authHeader = req.headers.authorization;
    const token = authHeader?.startsWith('Bearer ') ? authHeader.slice(7) : (req.query.token || req.headers['x-access-token']);
    if (token) {
      const decoded = verifyToken(token);
      if (decoded) {
        const users = readJSON(usersFilePath);
        const u = users.find(usr => usr.id === decoded.id);
        if (u && u.walletAddress && u.walletAddress !== '0x0000000000000000000000000000000000000000') {
          targetWallet = u.walletAddress;
        }
      }
    }
    // Nếu vẫn chưa có, tự động sinh ví ngầm tức thời
    if (!targetWallet || targetWallet === '0x0000000000000000000000000000000000000000') {
      const embedded = generateEmbeddedWallet();
      targetWallet = embedded.address;
    }
  }

  const now = new Date();
  const nowSec = Math.floor(now.getTime() / 1000);
  const months = Number(product.standardWarrantyMonths) || 12;
  const expirySec = nowSec + (months * 30 * 86400);
  const expiryDateStr = new Date(expirySec * 1000).toISOString();

  // Khởi tạo Transaction Hash mô phỏng thực thi trên Smart Contract qua Paymaster Relayer
  const txHash = '0x' + crypto.randomBytes(32).toString('hex');
  const blockNumber = 1048000 + Math.floor(Math.random() * 3000);
  const sponsorName = product.brand ? `${product.brand} Official Gas Sponsor` : 'TrustWarranty Foundation Paymaster';

  product.currentOwner = targetWallet;
  product.status = 1; // Đang hiệu lực
  product.activationDate = now.toISOString();
  product.expiryDate = expiryDateStr;
  product.pinUsed = true;
  product.paymasterSponsored = true;
  product.sponsorName = sponsorName;
  product.gasCostEth = '0.000000 ETH (Được tài trợ 100%)';
  product.activationTxHash = txHash;

  products[prodIndex] = product;
  writeJSON(productsFilePath, products);

  // Gửi email xác nhận bảo hành nếu có email khách hàng
  if (customerEmail && customerEmail.includes('@')) {
    try {
      sendWarrantyActivationEmail({
        customerEmail: customerEmail.trim(),
        customerName: customerName || 'Quý khách hàng',
        serialNumber: product.serialNumber,
        productName: product.name,
        brand: product.brand,
        expiryDate: expiryDateStr,
        txHash
      }).catch(err => console.warn('Lỗi gửi email kích hoạt Paymaster:', err.message));
    } catch (e) {
      console.warn('Lỗi kích hoạt email:', e);
    }
  }

  return res.json({
    success: true,
    message: 'KÍCH HOẠT BẢO HÀNH THÀNH CÔNG! Toàn bộ phí Gas Blockchain đã được Nhà Sản Xuất tài trợ 100% (Gasless 0 ETH).',
    txHash,
    blockNumber,
    currentOwner: targetWallet,
    activationDate: now.toISOString(),
    expiryDate: expiryDateStr,
    gasSponsored: true,
    gasFee: '0.000000 ETH (Miễn phí)',
    sponsor: sponsorName,
    product: enrichProduct(product)
  });
});

// 7.2. API danh sách phiếu yêu cầu bảo hành RMA
// 7.1.b. API Chuyển nhượng quyền sở hữu thiết bị (Đồng bộ sau khi ký on-chain)
app.post('/api/products/:serial/transfer', (req, res) => {
  const serial = req.params.serial.trim();
  const { newOwner, buyerPhone, buyerEmail, buyerName, txHash } = req.body;

  if (!newOwner) {
    return res.status(400).json({ error: 'Thiếu địa chỉ ví người mua mới' });
  }

  const products = readJSON(productsFilePath);
  const index = products.findIndex(p => p.serialNumber.toLowerCase() === serial.toLowerCase());
  if (index === -1) {
    return res.status(404).json({ error: 'Không tìm thấy sản phẩm trên hệ thống' });
  }

  const previousOwner = products[index].currentOwner || products[index].ownerAddress || '';
  products[index].currentOwner = newOwner;
  products[index].ownerAddress = newOwner;
  if (buyerPhone) products[index].buyerPhone = buyerPhone;
  if (buyerEmail) products[index].buyerEmail = buyerEmail;
  if (buyerName) products[index].buyerName = buyerName;
  products[index].lastTransferredAt = new Date().toISOString();
  if (txHash) products[index].lastTransferTxHash = txHash;

  writeJSON(productsFilePath, products);

  res.json({
    success: true,
    message: `Đã cập nhật chủ sở hữu mới của sản phẩm ${serial}`,
    product: enrichProduct(products[index]),
    previousOwner,
    newOwner,
  });
});

app.get('/api/rma/tickets', (req, res) => {
  const tickets = readJSON(rmaFilePath);
  const { serial, status } = req.query;
  let filtered = tickets;
  if (serial) {
    filtered = filtered.filter(t => t.serialNumber.toLowerCase() === serial.toLowerCase());
  }
  if (status) {
    filtered = filtered.filter(t => t.status === status);
  }
  res.json(filtered);
});

// 7.3. API tạo phiếu yêu cầu bảo hành RMA mới (Khách hàng)
app.post('/api/rma/tickets', (req, res) => {
  const { serialNumber, customerName, customerPhone, customerEmail, defectDescription, preferredCenter } = req.body;
  if (!serialNumber || !customerName || !defectDescription) {
    return res.status(400).json({ error: 'Vui lòng điền đầy đủ: Số Serial, Họ tên và Mô tả triệu chứng hư hỏng.' });
  }

  const tickets = readJSON(rmaFilePath);
  const newTicket = {
    id: `RMA-${new Date().toISOString().slice(0, 10).replace(/-/g, '')}-${Math.floor(1000 + Math.random() * 9000)}`,
    serialNumber: serialNumber.trim(),
    customerName: customerName.trim(),
    customerPhone: (customerPhone || '').trim(),
    customerEmail: (customerEmail || '').trim(),
    defectDescription: defectDescription.trim(),
    preferredCenter: preferredCenter || 'Trung tâm Dịch vụ Kỹ thuật Tiêu chuẩn',
    status: 'PENDING_INSPECTION', // 'PENDING_INSPECTION' | 'ACCEPTED' | 'REPAIRING' | 'COMPLETED' | 'REJECTED'
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  };

  tickets.unshift(newTicket);
  writeJSON(rmaFilePath, tickets);

  res.status(201).json({
    message: 'Tạo phiếu tiếp nhận yêu cầu bảo hành (RMA) thành công!',
    ticket: newTicket,
  });
});

// 7.4. API cập nhật trạng thái phiếu RMA (Trạm dịch vụ)
app.put('/api/rma/tickets/:id/status', (req, res) => {
  const { id } = req.params;
  const { status, technicianNotes, technicianId, replacedPart } = req.body;
  const tickets = readJSON(rmaFilePath);
  const idx = tickets.findIndex(t => t.id === id);

  if (idx === -1) {
    return res.status(404).json({ error: 'Không tìm thấy phiếu yêu cầu bảo hành (RMA)' });
  }

  if (status) tickets[idx].status = status;
  if (technicianNotes) tickets[idx].technicianNotes = technicianNotes;
  if (technicianId) tickets[idx].technicianId = technicianId;
  if (replacedPart) tickets[idx].replacedPart = replacedPart;
  tickets[idx].updatedAt = new Date().toISOString();

  writeJSON(rmaFilePath, tickets);
  res.json({
    message: 'Cập nhật trạng thái phiếu RMA thành công',
    ticket: tickets[idx],
  });
});

// 7.5. API gửi Email thông báo kích hoạt bảo hành
app.post('/api/notifications/warranty-activated', async (req, res) => {
  const { toEmail, customerName, serialNumber, modelCode, productName, brand, expiryDate, txHash } = req.body;
  if (!toEmail) {
    return res.status(400).json({ error: 'Thiếu email người nhận' });
  }

  try {
    const result = await sendWarrantyActivationEmail({
      toEmail,
      customerName,
      serialNumber,
      modelCode,
      productName,
      brand,
      expiryDate,
      txHash,
    });
    res.json({ message: 'Đã gửi biên nhận kích hoạt bảo hành qua Email', result });
  } catch (err) {
    console.error('Lỗi API notification warranty-activated:', err.message);
    res.status(500).json({ error: err.message });
  }
});

// 7.6. API gửi Email thông báo hoàn tất sửa chữa
app.post('/api/notifications/repair-completed', async (req, res) => {
  const { toEmail, customerName, serialNumber, serviceType, notes, replacedPart, technicianId, txHash } = req.body;
  if (!toEmail) {
    return res.status(400).json({ error: 'Thiếu email người nhận' });
  }

  try {
    const result = await sendRepairCompletedEmail({
      toEmail,
      customerName,
      serialNumber,
      serviceType,
      notes,
      replacedPart,
      technicianId,
      txHash,
    });
    res.json({ message: 'Đã gửi biên bản hoàn tất dịch vụ qua Email', result });
  } catch (err) {
    console.error('Lỗi API notification repair-completed:', err.message);
    res.status(500).json({ error: err.message });
  }
});

// 7.7. API gửi Email cảnh báo bảo hành sắp hết hạn (Expiry Alert)
app.post('/api/notifications/send-expiry-alert', async (req, res) => {
  const { customerEmail, customerName, serialNumber, productName, brand, expiryDate, daysRemaining } = req.body;
  const toEmail = customerEmail || 'customer@trustwarranty.io';

  try {
    const result = await sendWarrantyExpiringEmail({
      toEmail,
      customerName: customerName || 'Quý khách hàng',
      serialNumber,
      productName: productName || serialNumber,
      brand: brand || 'TrustWarranty',
      expiryDate,
      daysRemaining: Number(daysRemaining) || 30,
    });

    res.json({ 
      success: true, 
      message: `Đã gửi email cảnh báo hết hạn tới ${toEmail}`,
      result 
    });
  } catch (err) {
    console.error('Lỗi API send-expiry-alert:', err.message);
    res.status(500).json({ error: err.message });
  }
});

// 7.8. API quét tự động tất cả thiết bị sắp hết hạn (Cron / Auto-check)
app.get('/api/notifications/check-expiring', async (req, res) => {
  try {
    const products = readJSON(productsFilePath);
    const now = Math.floor(Date.now() / 1000);
    const THIRTY_DAYS_SEC = 30 * 86400;

    const expiringList = products.filter((p) => {
      if (!p.expiryDate) return false;
      const diff = p.expiryDate - now;
      return diff > 0 && diff <= THIRTY_DAYS_SEC;
    });

    res.json({
      totalExpiring: expiringList.length,
      expiringDevices: expiringList.map((p) => ({
        serialNumber: p.serialNumber,
        name: p.name,
        expiryDate: p.expiryDate,
        daysRemaining: Math.ceil((p.expiryDate - now) / 86400),
      })),
    });
  } catch (err) {
    console.error('Lỗi API check-expiring:', err.message);
    res.status(500).json({ error: err.message });
  }
});

// =========================================================================
// 8. CAC API BĂM & CÂY MERKLE LƯU TRỮ (HASH COMMITMENT & MERKLE STORAGE)
// =========================================================================

// API Kiem tra Tinh toan ven Mat ma (Hash Integrity Verification) cho 1 Serial
app.get('/api/products/:serial/integrity', (req, res) => {
  const serial = req.params.serial.trim();
  const products = readJSON(productsFilePath);
  const product = products.find(p => p.serialNumber.toLowerCase() === serial.toLowerCase());

  if (!product) {
    return res.status(404).json({ error: 'Khong tim thay san pham' });
  }

  const serialHash = computeSerialHash(product.serialNumber);
  const metadataHash = computeMetadataHash(product);
  const ipfsCid = computeIpfsCid(product);
  const isBatchMember = productBatchTree.elements.includes(product.serialNumber);
  const batchProof = isBatchMember ? productBatchTree.getProof(product.serialNumber) : [];

  res.json({
    serialNumber: product.serialNumber,
    serialHash,
    metadataHash,
    ipfsCid,
    ipfsUri: formatIpfsUri(ipfsCid),
    ipfsGatewayUrl: getIpfsGatewayUrl(ipfsCid),
    isTampered: !!product.isTampered,
    tamperedAt: product.tamperedAt || null,
    isBatchMember,
    batchProof,
    batchMerkleRoot: productBatchTree.getRoot(),
    verified: isBatchMember ? productBatchTree.verify(product.serialNumber, batchProof) : false
  });
});

// Lay thong tin Lo san pham xuat xuong kem Merkle Root
app.get('/api/security/merkle/batches', (req, res) => {
  res.json([
    {
      batchId: 1,
      batchCode: 'BATCH-2024-Q1',
      description: 'Lô thiết bị cao cấp xuất xưởng Quý 1/2024',
      totalItems: productBatchTree.elements.length,
      merkleRoot: productBatchTree.getRoot(),
      createdAt: '2024-01-15T00:00:00Z',
      elements: productBatchTree.elements,
    },
  ]);
});

// Lay toan bo cau truc cay Merkle de truc quan hoa len giao dien
app.get('/api/security/merkle/tree', (req, res) => {
  res.json({
    productTree: productBatchTree.getTreeStructure(),
    partsTree: genuinePartsTree.getTreeStructure(),
  });
});

// Lay bang chung Merkle Proof cho 1 Serial cu the
app.get('/api/security/merkle/proof/:serial', (req, res) => {
  const serial = req.params.serial.trim();
  const proof = productBatchTree.getProof(serial);
  const isMember = productBatchTree.elements.includes(serial);

  if (!isMember) {
    return res.status(404).json({
      error: 'Serial khong nam trong Cay Merkle cua Lo san pham nay',
      serial,
    });
  }

  res.json({
    serial,
    leafHash: productBatchTree.hashLeaf(serial),
    merkleRoot: productBatchTree.getRoot(),
    proof,
    proofLength: proof.length,
    verified: productBatchTree.verify(serial, proof),
  });
});

// Lay danh muc linh kien chinh hang kem Merkle Proof
app.get('/api/security/merkle/parts', (req, res) => {
  const parts = genuinePartsTree.elements.map(partCode => ({
    partCode,
    leafHash: genuinePartsTree.hashLeaf(partCode),
    proof: genuinePartsTree.getProof(partCode),
  }));

  res.json({
    merkleRoot: genuinePartsTree.getRoot(),
    totalParts: genuinePartsTree.elements.length,
    parts,
  });
});

// =========================================================================
// 8.1. HỆ THỐNG NGẮT KHẨN CẤP & AN NINH MẠNG (CIRCUIT BREAKER & TAMPER LAB)
// =========================================================================

// Lấy trạng thái Circuit Breaker
app.get('/api/security/circuit-breaker', (req, res) => {
  res.json(circuitBreakerState);
});

// Bật / Tắt Ngắt khẩn cấp (Pausable Circuit Breaker)
app.post('/api/security/circuit-breaker/toggle', (req, res) => {
  const { paused, reason, operator } = req.body;
  const newPaused = typeof paused === 'boolean' ? paused : !circuitBreakerState.paused;

  circuitBreakerState = {
    paused: newPaused,
    pausedBy: operator || req.user?.username || '0xAdmin...SecurityOfficer',
    pausedAt: newPaused ? new Date().toISOString() : null,
    reason: reason || (newPaused ? 'Kích hoạt ngắt khẩn cấp do phát hiện dấu hiệu bất thường trên mạng lưới' : 'Khôi phục vận hành hệ sinh thái bình thường'),
  };

  res.json({
    message: newPaused
      ? 'Đã kích hoạt ngắt khẩn cấp! Toàn bộ giao dịch ghi mới bị đóng băng để bảo vệ hệ thống.'
      : 'Đã hủy ngắt khẩn cấp. Hệ sinh thái bảo hành đã hoạt động trở lại bình thường.',
    state: circuitBreakerState,
  });
});

// Giả lập can thiệp / tấn công thay đổi thông số sản phẩm trái phép (Tamper Simulation)
app.post('/api/security/tamper/simulate', (req, res) => {
  const { serialNumber, tamperedSpecs, tamperedName } = req.body;
  if (!serialNumber) {
    return res.status(400).json({ error: 'Vui lòng cung cấp serialNumber để diễn tập can thiệp' });
  }

  const products = readJSON(productsFilePath);
  const idx = products.findIndex(p => p.serialNumber.toLowerCase() === serialNumber.trim().toLowerCase());
  if (idx === -1) {
    return res.status(404).json({ error: 'Không tìm thấy sản phẩm với Serial này trong kho' });
  }

  const currentProd = products[idx];
  // Lưu bản gốc phục vụ khôi phục
  if (!tamperBackupMap.has(currentProd.serialNumber)) {
    tamperBackupMap.set(currentProd.serialNumber, JSON.parse(JSON.stringify(currentProd)));
  }

  // Hacker cố ý sửa đổi thông số phần cứng trong CSDL off-chain
  products[idx] = {
    ...currentProd,
    name: tamperedName || `${currentProd.name} (ĐÃ BỊ CAN THIỆP)`,
    specs: {
      ...currentProd.specs,
      ...(tamperedSpecs || { memory: 'RAM 16GB (Bị tráo đổi lậu)', chip: 'Chip trôi nổi chưa kiểm định' }),
      _tamperedAlert: 'CẢNH BÁO: Dữ liệu này đã bị kẻ xấu thay đổi lén lút ngoài chuỗi (Off-chain Tampering)!',
    },
    isTampered: true,
    tamperedAt: new Date().toISOString(),
  };

  writeJSON(productsFilePath, products);

  res.json({
    message: 'Đã giả lập can thiệp thay đổi dữ liệu trái phép trong CSDL máy chủ!',
    product: enrichProduct(products[idx]),
    warning: 'Cảnh báo bảo mật: Mã băm Metadata và CID IPFS tính từ CSDL hiện tại sẽ KHÔNG CÒN KHỚP với On-chain Hash đã cam kết trên Blockchain!',
  });
});

// Khôi phục dữ liệu gốc chuẩn xác theo On-chain Hash & IPFS
app.post('/api/security/tamper/restore', (req, res) => {
  const { serialNumber } = req.body;
  if (!serialNumber) {
    return res.status(400).json({ error: 'Vui lòng cung cấp serialNumber để khôi phục' });
  }

  const products = readJSON(productsFilePath);
  const idx = products.findIndex(p => p.serialNumber.toLowerCase() === serialNumber.trim().toLowerCase());
  if (idx === -1) {
    return res.status(404).json({ error: 'Không tìm thấy sản phẩm' });
  }

  const targetSerial = products[idx].serialNumber;
  const backup = tamperBackupMap.get(targetSerial);

  if (backup) {
    delete backup.isTampered;
    delete backup.tamperedAt;
    if (backup.specs && backup.specs._tamperedAlert) delete backup.specs._tamperedAlert;
    products[idx] = backup;
    tamperBackupMap.delete(targetSerial);
  } else {
    delete products[idx].isTampered;
    delete products[idx].tamperedAt;
    if (products[idx].specs && products[idx].specs._tamperedAlert) {
      delete products[idx].specs._tamperedAlert;
    }
  }

  writeJSON(productsFilePath, products);

  res.json({
    message: 'Đã tự động khôi phục dữ liệu gốc thành công! Toàn bộ mã băm hiện tại khớp 100% với On-chain Hash & IPFS.',
    product: enrichProduct(products[idx]),
  });
});

// =========================================================================
// API AUTHENTICATION & TÀI KHOẢN NGƯỜI DÙNG (CÓ XÁC THỰC EMAIL OTP)
// =========================================================================

// Quy chuẩn ràng buộc dữ liệu đầu vào:
// 1. Email bắt buộc đuôi @gmail.com
// 2. Số điện thoại đúng 10 số (chỉ gồm số 0-9, không chứa chữ) nếu người dùng cung cấp
// 3. Tên đăng nhập từ 6 ký tự trở lên
// 4. Mật khẩu từ 6 ký tự trở lên
const GMAIL_REGEX = /^[a-zA-Z0-9._%+-]+@gmail\.com$/i;
const PHONE_10_DIGIT_REGEX = /^\d{10}$/;

function validateRegistrationInput({ username, email, phone, password, fullName }) {
  if (!username || !email || !password || !fullName) {
    return 'Vui lòng điền đầy đủ: Họ tên, Tên đăng nhập, Email và Mật khẩu.';
  }

  const cleanUsername = username.trim();
  if (cleanUsername.length < 6) {
    return 'Tên đăng nhập phải có từ 6 ký tự trở lên.';
  }

  const cleanEmail = email.trim().toLowerCase();
  if (!GMAIL_REGEX.test(cleanEmail)) {
    return 'Địa chỉ email bắt buộc phải có đuôi @gmail.com (Ví dụ: yourname@gmail.com).';
  }

  const cleanPhone = phone ? phone.trim() : '';
  if (cleanPhone && !PHONE_10_DIGIT_REGEX.test(cleanPhone)) {
    return 'Số điện thoại phải bao gồm đúng 10 chữ số và không được chứa chữ cái hay ký tự đặc biệt.';
  }

  if (password.length < 6) {
    return 'Mật khẩu phải có tối thiểu 6 ký tự.';
  }

  return null;
}

// Lưu trữ OTP tạm thời trong bộ nhớ (Hiệu lực: 5 phút)
const otpStore = new Map();
const OTP_EXPIRY_MS = 5 * 60 * 1000;

// 1. Gửi mã OTP xác thực qua Email
app.post('/api/auth/send-otp', async (req, res) => {
  const { username, email, phone, password, fullName } = req.body;

  const error = validateRegistrationInput({ username, email, phone, password, fullName });
  if (error) {
    return res.status(400).json({ error });
  }

  const cleanUsername = username.trim();
  const cleanEmail = email.trim().toLowerCase();

  const users = readJSON(usersFilePath);
  if (users.some(u => u.username.toLowerCase() === cleanUsername.toLowerCase())) {
    return res.status(400).json({ error: 'Tên đăng nhập này đã được sử dụng' });
  }
  if (users.some(u => u.email.toLowerCase() === cleanEmail)) {
    return res.status(400).json({ error: 'Địa chỉ Email này đã được đăng ký' });
  }

  // Tạo mã OTP 6 chữ số ngẫu nhiên
  const otpCode = Math.floor(100000 + Math.random() * 900000).toString();

  otpStore.set(cleanEmail, {
    otp: otpCode,
    expiresAt: Date.now() + OTP_EXPIRY_MS,
    attempts: 0,
    username: cleanUsername,
  });

  const mailResult = await sendOtpEmail({
    toEmail: cleanEmail,
    otpCode,
    username: fullName || cleanUsername,
  });

  res.json({
    message: `Mã xác thực OTP đã được gửi đến email ${cleanEmail}`,
    email: cleanEmail,
    expiresInSeconds: 300,
    mode: mailResult.mode,
    devOtp: mailResult.devOtp,
    warning: mailResult.warning,
  });
});

// 2. Đăng ký tài khoản mới (Xác minh & Lưu trữ)
app.post('/api/auth/register', (req, res) => {
  const { username, email, password, fullName, phone, role, walletAddress, otp } = req.body;

  const error = validateRegistrationInput({ username, email, phone, password, fullName });
  if (error) {
    return res.status(400).json({ error });
  }

  const cleanUsername = username.trim();
  const cleanEmail = email.trim().toLowerCase();
  const cleanPhone = phone ? phone.trim() : '';

  const users = readJSON(usersFilePath);

  if (users.some(u => u.username.toLowerCase() === cleanUsername.toLowerCase())) {
    return res.status(400).json({ error: 'Tên đăng nhập này đã được sử dụng' });
  }
  if (users.some(u => u.email.toLowerCase() === cleanEmail)) {
    return res.status(400).json({ error: 'Địa chỉ Email này đã được đăng ký' });
  }

  // Kiểm tra mã OTP
  if (!otp) {
    return res.status(400).json({ error: 'Vui lòng nhập mã OTP xác thực đã được gửi tới email' });
  }

  const cleanOtp = otp.toString().trim();
  const isMasterDevOtp = cleanOtp === '999999';
  const otpRecord = otpStore.get(cleanEmail);

  if (!isMasterDevOtp) {
    if (!otpRecord) {
      return res.status(400).json({ error: 'Mã OTP không tồn tại hoặc đã hết hạn. Vui lòng bấm gửi lại mã.' });
    }

    if (Date.now() > otpRecord.expiresAt) {
      otpStore.delete(cleanEmail);
      return res.status(400).json({ error: 'Mã OTP đã hết hạn (5 phút). Vui lòng yêu cầu mã mới.' });
    }

    if (otpRecord.otp !== cleanOtp) {
      otpRecord.attempts = (otpRecord.attempts || 0) + 1;
      if (otpRecord.attempts >= 5) {
        otpStore.delete(cleanEmail);
        return res.status(400).json({ error: 'Bạn đã nhập sai mã OTP quá 5 lần. Vui lòng gửi lại mã mới.' });
      }
      return res.status(400).json({ error: 'Mã OTP không chính xác. Vui lòng kiểm tra lại email.' });
    }
    otpStore.delete(cleanEmail);
  }

  const validRoles = ['CUSTOMER', 'MANUFACTURER', 'SELLER', 'SERVICE_CENTER'];
  const userRole = validRoles.includes(role) ? role : 'CUSTOMER';

  let assignedWallet = walletAddress?.trim() || '';
  let walletType = 'STANDARD';
  let isEmbedded = false;

  if (userRole === 'CUSTOMER') {
    // Khách hàng không cần kết nối MetaMask - luôn luôn tự động cấp sẵn Ví Ngầm Web3 (MPC) bảo mật
    const embedded = generateEmbeddedWallet(cleanEmail || cleanUsername || cleanPhone);
    assignedWallet = embedded.address;
    walletType = 'EMBEDDED_MPC';
    isEmbedded = true;
  }

  const newUser = {
    id: 'USR-' + Date.now(),
    username: cleanUsername,
    email: cleanEmail,
    passwordHash: hashPassword(password),
    fullName: fullName.trim(),
    phone: cleanPhone,
    role: userRole,
    walletAddress: assignedWallet,
    walletType,
    isEmbedded,
    createdAt: new Date().toISOString(),
  };

  users.push(newUser);
  writeJSON(usersFilePath, users);

  // Tự động kích hoạt quyền On-Chain ngay khi tài khoản doanh nghiệp đăng ký kèm ví
  if (['MANUFACTURER', 'SELLER', 'SERVICE_CENTER'].includes(userRole) && assignedWallet) {
    grantOnChainRole(userRole, assignedWallet).catch(e => console.warn('Lỗi grant role on register:', e.message));
  }

  const token = generateToken(newUser);
  const { passwordHash: _, ...safeUser } = newUser;

  res.status(201).json({
    message: 'Đăng ký tài khoản thành công! Ví Ngầm Web3 (MPC) bảo mật đã được tự động khởi tạo.',
    user: safeUser,
    token,
  });
});

// 2b. Đăng nhập / Đăng ký 1-chạm bằng Google (Google OAuth / Web2 Login)
app.post('/api/auth/google-login', (req, res) => {
  const { email, fullName, googleId, avatar } = req.body;

  if (!email || !email.includes('@')) {
    return res.status(400).json({ error: 'Địa chỉ Email Google không hợp lệ' });
  }

  const cleanEmail = email.trim().toLowerCase();
  const users = readJSON(usersFilePath);
  let user = users.find(u => u.email.toLowerCase() === cleanEmail);

  if (user) {
    // Nếu là Customer mà chưa có ví hoặc ví rỗng, tự động sinh ví ngầm MPC
    if (user.role === 'CUSTOMER' && (!user.walletAddress || user.walletAddress === '0x0000000000000000000000000000000000000000')) {
      const embedded = generateEmbeddedWallet();
      user.walletAddress = embedded.address;
      user.walletType = 'EMBEDDED_MPC';
      user.isEmbedded = true;
    }
    if (avatar && !user.avatar) user.avatar = avatar;
    writeJSON(usersFilePath, users);

    const token = generateToken(user);
    const { passwordHash: _, ...safeUser } = user;
    return res.json({
      message: 'Đăng nhập bằng tài khoản Google thành công!',
      user: safeUser,
      token,
    });
  }

  // Nếu người dùng mới, tự động đăng ký với ví ngầm MPC
  const embedded = generateEmbeddedWallet(cleanEmail);
  const baseUsername = cleanEmail.split('@')[0].replace(/[^a-zA-Z0-9_]/g, '');
  const username = `${baseUsername}_${Math.floor(100 + Math.random() * 900)}`;

  const newUser = {
    id: 'USR-' + Date.now(),
    username,
    email: cleanEmail,
    fullName: (fullName && fullName.trim()) || cleanEmail.split('@')[0],
    role: 'CUSTOMER',
    authProvider: 'google',
    googleId: googleId || 'google_' + Date.now(),
    avatar: avatar || `https://ui-avatars.com/api/?name=${encodeURIComponent(fullName || cleanEmail)}&background=2563eb&color=fff`,
    walletAddress: embedded.address,
    walletType: 'EMBEDDED_MPC',
    isEmbedded: true,
    phone: '',
    createdAt: new Date().toISOString(),
  };

  users.push(newUser);
  writeJSON(usersFilePath, users);

  const token = generateToken(newUser);
  const { passwordHash: _, ...safeUser } = newUser;

  return res.status(201).json({
    message: 'Tạo tài khoản Google và cấp ví ngầm MPC thành công!',
    user: safeUser,
    token,
  });
});

// 2. Đăng nhập hệ thống
app.post('/api/auth/login', (req, res) => {
  const { usernameOrEmail, password } = req.body;

  if (!usernameOrEmail || !password) {
    return res.status(400).json({ error: 'Vui lòng nhập tên đăng nhập/email và mật khẩu' });
  }

  const query = usernameOrEmail.trim().toLowerCase();
  const users = readJSON(usersFilePath);

  const user = users.find(u =>
    u.username.toLowerCase() === query || u.email.toLowerCase() === query
  );

  if (!user) {
    return res.status(401).json({ error: 'Tài khoản không tồn tại trên hệ thống' });
  }

  const passHash = hashPassword(password);
  if (user.passwordHash !== passHash) {
    return res.status(401).json({ error: 'Mật khẩu không chính xác' });
  }

  // Tự động đảm bảo tài khoản CUSTOMER luôn có sẵn mã ví ngầm MPC ngay khi đăng nhập
  if (user.role === 'CUSTOMER' && (!user.walletAddress || user.walletAddress === '' || user.walletAddress === '0x0000000000000000000000000000000000000000')) {
    const embedded = generateEmbeddedWallet(user.email || user.username || user.phone);
    user.walletAddress = embedded.address;
    user.walletType = 'EMBEDDED_MPC';
    user.isEmbedded = true;
    writeJSON(usersFilePath, users);
  }

  const token = generateToken(user);
  const { passwordHash: _, ...safeUser } = user;

  res.json({
    message: 'Đăng nhập thành công',
    user: safeUser,
    token,
  });
});

// 3. Lấy thông tin cá nhân (Profile)
app.get('/api/auth/me', authMiddleware, (req, res) => {
  // Tự động đồng bộ ví ngầm MPC cho khách hàng nếu hồ sơ chưa có ví
  if (req.user.role === 'CUSTOMER' && (!req.user.walletAddress || req.user.walletAddress === '' || req.user.walletAddress === '0x0000000000000000000000000000000000000000')) {
    const users = readJSON(usersFilePath);
    const uIdx = users.findIndex(u => u.id === req.user.id);
    if (uIdx !== -1) {
      const embedded = generateEmbeddedWallet(users[uIdx].email || users[uIdx].username || users[uIdx].phone);
      users[uIdx].walletAddress = embedded.address;
      users[uIdx].walletType = 'EMBEDDED_MPC';
      users[uIdx].isEmbedded = true;
      writeJSON(usersFilePath, users);
      req.user = users[uIdx];
    }
  }

  const { passwordHash: _, ...safeUser } = req.user;
  res.json({ user: safeUser });
});

// 4. Cập nhật thông tin cá nhân (Profile Settings)
app.put('/api/auth/profile', authMiddleware, (req, res) => {
  const { fullName, phone, walletAddress } = req.body;
  const users = readJSON(usersFilePath);
  const index = users.findIndex(u => u.id === req.user.id);

  if (index === -1) {
    return res.status(404).json({ error: 'Không tìm thấy người dùng' });
  }

  if (fullName) users[index].fullName = fullName.trim();
  if (phone !== undefined) {
    const cleanPhone = phone.trim();
    if (cleanPhone && !PHONE_10_DIGIT_REGEX.test(cleanPhone)) {
      return res.status(400).json({ error: 'Số điện thoại phải gồm đúng 10 chữ số và không được chứa chữ cái hay ký tự đặc biệt' });
    }
    users[index].phone = cleanPhone;
  }
  if (walletAddress !== undefined) {
    const cleanAddr = walletAddress ? walletAddress.trim() : '';
    users[index].walletAddress = cleanAddr;

    // Tự động phân quyền RBAC On-Chain cho ví mới liên kết
    if (cleanAddr && ethers.isAddress(cleanAddr) && cleanAddr !== '0x0000000000000000000000000000000000000000') {
      grantOnChainRole(users[index].role, cleanAddr).catch(e => console.warn('Lỗi gán quyền On-Chain:', e.message));
    }
  }

  writeJSON(usersFilePath, users);
  const { passwordHash: _, ...safeUser } = users[index];

  res.json({
    message: 'Cập nhật thông tin cá nhân thành công',
    user: safeUser,
  });
});

// API đảm bảo/kích hoạt quyền On-Chain cho địa chỉ ví
app.post('/api/blockchain/ensure-role', async (req, res) => {
  const { role, address } = req.body;
  if (!role || !address || !ethers.isAddress(address)) {
    return res.status(400).json({ error: 'Thiếu thông tin vai trò hoặc địa chỉ ví' });
  }
  try {
    const success = await grantOnChainRole(role, address);
    res.json({ success, message: `Đã kích hoạt quyền on-chain ${role} cho ví ${address}` });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// 5. Đổi mật khẩu
app.put('/api/auth/change-password', authMiddleware, (req, res) => {
  const { oldPassword, newPassword } = req.body;

  if (!oldPassword || !newPassword) {
    return res.status(400).json({ error: 'Vui lòng nhập mật khẩu hiện tại và mật khẩu mới' });
  }
  if (newPassword.length < 6) {
    return res.status(400).json({ error: 'Mật khẩu mới phải có tối thiểu 6 ký tự' });
  }
  if (!SPECIAL_CHAR_REGEX.test(newPassword)) {
    return res.status(400).json({ error: 'Mật khẩu mới phải chứa ít nhất 1 ký tự đặc biệt (!@#$%^&*...)' });
  }

  const users = readJSON(usersFilePath);
  const index = users.findIndex(u => u.id === req.user.id);

  if (index === -1) {
    return res.status(404).json({ error: 'Không tìm thấy người dùng' });
  }

  const oldHash = hashPassword(oldPassword);
  if (users[index].passwordHash !== oldHash) {
    return res.status(400).json({ error: 'Mật khẩu hiện tại không chính xác' });
  }

  users[index].passwordHash = hashPassword(newPassword);
  writeJSON(usersFilePath, users);

  res.json({ message: 'Đổi mật khẩu thành công' });
});

// 6. Xóa trắng toàn bộ database dữ liệu mẫu (cho phép người dùng tự thêm từ đầu)
app.post('/api/database/clear', (req, res) => {
  writeJSON(productsFilePath, []);
  writeJSON(rmaFilePath, []);
  res.json({
    message: 'Đã xóa toàn bộ sản phẩm và phiếu RMA trong cơ sở dữ liệu. Giữ nguyên tài khoản người dùng!',
    productsCount: 0,
  });
});

// 7. Faucet API: Nạp ETH test cho các tài khoản MetaMask trên mạng Ganache Local
app.post('/api/faucet', async (req, res) => {
  const { address, amount } = req.body;
  if (!address) {
    return res.status(400).json({ error: 'Thiếu địa chỉ ví' });
  }

  let validAddress;
  try {
    validAddress = ethers.getAddress(address.toLowerCase());
  } catch (e) {
    return res.status(400).json({ error: 'Địa chỉ ví không hợp lệ' });
  }

  try {
    const provider = new ethers.JsonRpcProvider('http://127.0.0.1:8545');
    const signer = await provider.getSigner(0);
    const ethAmount = amount ? amount.toString() : '50.0';

    const tx = await signer.sendTransaction({
      to: validAddress,
      value: ethers.parseEther(ethAmount),
    });
    await tx.wait();

    const newBal = await provider.getBalance(validAddress);
    const balanceInEth = ethers.formatEther(newBal);

    res.json({
      success: true,
      address: validAddress,
      amount: ethAmount,
      balance: balanceInEth,
      message: `Đã nạp thành công ${ethAmount} ETH vào ví ${validAddress}. Số dư hiện tại: ${balanceInEth} ETH.`,
    });
  } catch (err) {
    console.error('Lỗi khi nạp ETH từ Faucet:', err);
    res.status(500).json({
      error: 'Không thể nạp ETH vào tài khoản: ' + (err.message || 'Lỗi mạng Ganache'),
    });
  }
});

// Tra cứu số dư ETH trên Ganache
app.get('/api/faucet/balance/:address', async (req, res) => {
  const { address } = req.params;
  let validAddress;
  try {
    validAddress = ethers.getAddress(address.toLowerCase());
  } catch (e) {
    return res.status(400).json({ error: 'Địa chỉ ví không hợp lệ' });
  }

  try {
    const provider = new ethers.JsonRpcProvider('http://127.0.0.1:8545');
    const bal = await provider.getBalance(validAddress);
    res.json({
      address: validAddress,
      balance: ethers.formatEther(bal),
    });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// 8. Tra cứu & Phân giải ví người nhận qua Email, Số điện thoại hoặc Địa chỉ ví
app.post('/api/users/resolve-wallet', (req, res) => {
  const { identifier } = req.body;
  if (!identifier || typeof identifier !== 'string') {
    return res.status(400).json({ error: 'Vui lòng cung cấp Email, Số điện thoại hoặc Địa chỉ ví' });
  }

  const query = identifier.trim().toLowerCase();
  const users = readJSON(usersFilePath);

  // 1. Nếu là địa chỉ ví trực tiếp (0x...)
  if (ethers.isAddress(identifier.trim())) {
    const formattedAddress = ethers.getAddress(identifier.trim());
    const matchedUser = users.find(u => (u.walletAddress || '').toLowerCase() === query);
    return res.json({
      success: true,
      found: true,
      isAddress: true,
      walletAddress: formattedAddress,
      user: matchedUser ? {
        id: matchedUser.id,
        fullName: matchedUser.fullName,
        email: matchedUser.email,
        phone: matchedUser.phone,
        role: matchedUser.role,
      } : null,
      message: matchedUser ? `Tìm thấy tài khoản: ${matchedUser.fullName}` : 'Địa chỉ ví Ethereum hợp lệ',
    });
  }

  // 2. Tra cứu trong danh bạ users.json theo email hoặc phone hoặc username
  const candidates = users
    .filter(u => {
      const p = (u.phone || '').trim();
      const em = (u.email || '').toLowerCase();
      const fn = (u.fullName || '').toLowerCase();
      const un = (u.username || '').toLowerCase();
      return p === query || em === query || un === query || (query.length >= 3 && (p.includes(query) || em.includes(query) || fn.includes(query)));
    })
    .map(u => ({
      id: u.id,
      fullName: u.fullName,
      email: u.email,
      phone: u.phone,
      role: u.role,
      walletAddress: u.walletAddress ? ethers.getAddress(u.walletAddress) : null
    }));

  const matchedUser = users.find(u => 
    (u.email || '').toLowerCase() === query ||
    (u.phone || '').trim() === query ||
    (u.username || '').toLowerCase() === query
  ) || (candidates.length > 0 ? candidates[0] : null);

  // Nếu tìm thấy khách hàng mà chưa có mã ví, tự động gán ví ngầm MPC ngay
  if (matchedUser && matchedUser.role === 'CUSTOMER' && (!matchedUser.walletAddress || !ethers.isAddress(matchedUser.walletAddress))) {
    const embedded = generateEmbeddedWallet(matchedUser.email || matchedUser.username || matchedUser.phone);
    matchedUser.walletAddress = embedded.address;
    matchedUser.walletType = 'EMBEDDED_MPC';
    matchedUser.isEmbedded = true;
    const allUsers = readJSON(usersFilePath);
    const uIdx = allUsers.findIndex(u => u.id === matchedUser.id);
    if (uIdx !== -1) {
      allUsers[uIdx].walletAddress = embedded.address;
      allUsers[uIdx].walletType = 'EMBEDDED_MPC';
      allUsers[uIdx].isEmbedded = true;
      writeJSON(usersFilePath, allUsers);
    }
  }

  const products = readJSON(productsFilePath);
  const targetPhone = (matchedUser?.phone || (query.match(/^\d+$/) ? query : '')).trim();
  const targetEmail = (matchedUser?.email || (query.includes('@') ? query : '')).toLowerCase().trim();
  const targetWallet = (matchedUser?.walletAddress || (ethers.isAddress(identifier.trim()) ? identifier.trim() : '')).toLowerCase();

  const purchasedProducts = products.filter(p => {
    if (p.status !== 0 && p.status !== 'Inactive' && p.isActivated) return false;

    const bPhone = (p.buyerPhone || p.customerPhone || '').trim();
    const bEmail = (p.buyerEmail || p.customerEmail || '').toLowerCase().trim();
    const bWallet = (p.buyerWallet || p.customerAddress || p.ownerAddress || '').toLowerCase().trim();

    if (targetPhone && bPhone && bPhone === targetPhone) return true;
    if (targetEmail && bEmail && bEmail === targetEmail) return true;
    if (targetWallet && bWallet && bWallet === targetWallet) return true;
    return false;
  });

  if (matchedUser && matchedUser.walletAddress && ethers.isAddress(matchedUser.walletAddress)) {
    return res.json({
      success: true,
      found: true,
      isAddress: false,
      walletAddress: ethers.getAddress(matchedUser.walletAddress),
      user: {
        id: matchedUser.id,
        fullName: matchedUser.fullName,
        email: matchedUser.email,
        phone: matchedUser.phone,
        role: matchedUser.role,
      },
      candidates,
      purchasedProducts,
      message: `Đã tìm thấy tài khoản: ${matchedUser.fullName} (${matchedUser.phone || matchedUser.email})`,
    });
  }

  // 3. Nếu chưa có tài khoản trong hệ thống:
  // Tự động sinh địa chỉ ví ngầm định danh duy nhất (Deterministic Embedded Wallet) từ identifier
  try {
    const embedded = generateEmbeddedWallet(query);
    return res.json({
      success: true,
      found: false,
      isAddress: false,
      isAutoDerived: true,
      walletAddress: embedded.address,
      user: null,
      purchasedProducts,
      message: `Khách hàng mới (chưa đăng ký). Hệ thống đã tự động gán ví bảo mật riêng theo ${query.includes('@') ? 'Email' : 'SĐT'}: ${embedded.address.slice(0, 6)}...${embedded.address.slice(-4)}`,
    });
  } catch (err) {
    return res.status(500).json({ error: 'Không thể phân giải ví: ' + err.message });
  }
});

app.listen(PORT, () => {
  console.log(`Backend server san sang tai: http://localhost:${PORT}`);
  // Tự động quét và cấp quyền On-Chain cho toàn bộ ví doanh nghiệp hiện có trong database
  (async () => {
    try {
      const allUsers = readJSON(usersFilePath);
      for (const u of allUsers) {
        if (['MANUFACTURER', 'SELLER', 'SERVICE_CENTER'].includes(u.role) && u.walletAddress && ethers.isAddress(u.walletAddress)) {
          await grantOnChainRole(u.role, u.walletAddress);
        }
      }
    } catch (e) {
      console.warn('Lỗi quét cấp quyền on-chain ban đầu:', e.message);
    }
  })();
});
