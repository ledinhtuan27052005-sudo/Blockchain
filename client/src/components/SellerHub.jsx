import React, { useState, useEffect } from 'react';
import {
  Store,
  ShieldCheck,
  CheckCircle2,
  AlertTriangle,
  UserCheck,
  Calendar,
  PackageCheck,
  ArrowRight,
  Clock,
  Sparkles,
  Zap,
  Plus,
  PackagePlus,
  PlusCircle,
  X,
  Key,
  Mail,
  FileText,
  Copy,
  Check,
  Wallet,
  Camera,
  Search,
  Eye,
  EyeOff,
  ChevronRight,
  ArrowLeft,
  Inbox,
  Phone,
  Smartphone,
  ArrowRightLeft,
  RefreshCw
} from 'lucide-react';
import { blockchainService } from '../services/blockchain';
import { saveProduct, sendWarrantyActivationNotification, resolveCustomerWallet, transferProductOwnership, getRmaTickets, updateRmaTicketStatus } from '../services/api';
import { computeMetadataHash } from '../services/merkle';
import WarrantyCertificateModal from './WarrantyCertificateModal';
import QrCameraScannerModal from './QrCameraScannerModal';
import ReactDOM from 'react-dom';

export default function SellerHub({ 
  allProducts, 
  onWarrantyActivated, 
  onWarrantyExtended, 
  onProductAdded,
  isMetaMaskConnected,
  metaMaskAddress,
  onConnectMetaMask,
  onNotify
}) {
  const [selectedSerial, setSelectedSerial] = useState('');
  const [customerAddress, setCustomerAddress] = useState('');
  const [customerIdentifier, setCustomerIdentifier] = useState('');
  const [resolvedWallet, setResolvedWallet] = useState(null);
  const [isResolvingWallet, setIsResolvingWallet] = useState(false);
  const [resolveError, setResolveError] = useState('');

  // Tự động phân giải ví qua SĐT / Email / Ví (KHÔNG tự điền sản phẩm bảo hành)
  useEffect(() => {
    if (!customerIdentifier || !customerIdentifier.trim()) {
      setResolvedWallet(null);
      setResolveError('');
      setCustomerAddress('');
      return;
    }

    const timer = setTimeout(async () => {
      setIsResolvingWallet(true);
      setResolveError('');
      try {
        const res = await resolveCustomerWallet(customerIdentifier.trim());
        if (res && res.success) {
          setResolvedWallet(res);
          setCustomerAddress(res.walletAddress);
          if (res.user?.email) {
            setCustomerEmail(res.user.email);
            setEmailAutoFilled(true);
            setTimeout(() => setEmailAutoFilled(false), 4500);
          }
        }
      } catch (err) {
        setResolveError(err.message || 'Lỗi tra cứu thông tin khách hàng');
        setResolvedWallet(null);
      } finally {
        setIsResolvingWallet(false);
      }
    }, 350);

    return () => clearTimeout(timer);
  }, [customerIdentifier]);
  const [activationPin, setActivationPin] = useState('');
  const [customerEmail, setCustomerEmail] = useState('');
  const [emailAutoFilled, setEmailAutoFilled] = useState(false);

  // Xử lý khi đại lý chọn khách hàng từ kết quả tra cứu SĐT
  const handleSelectCustomer = (u) => {
    if (!u) return;
    if (u.phone) {
      setCustomerIdentifier(u.phone);
    } else if (u.email) {
      setCustomerIdentifier(u.email);
    }
    if (u.walletAddress) {
      setCustomerAddress(u.walletAddress);
    }
    if (u.email) {
      setCustomerEmail(u.email);
      setEmailAutoFilled(true);
      setTimeout(() => setEmailAutoFilled(false), 4500);
    }
    setResolvedWallet({
      success: true,
      found: true,
      walletAddress: u.walletAddress,
      user: u
    });
  };
  const [loading, setLoading] = useState(false);
  const [successInfo, setSuccessInfo] = useState(null);
  const [errorMsg, setErrorMsg] = useState('');
  const [showCertModal, setShowCertModal] = useState(false);
  const [certData, setCertData] = useState(null);
  const [emailStatus, setEmailStatus] = useState('');
  const [txProgress, setTxProgress] = useState(null);
  const [transferTxProgress, setTransferTxProgress] = useState(null);
  const [extendTxProgress, setExtendTxProgress] = useState(null);
  const [registerTxProgress, setRegisterTxProgress] = useState(null);

  // Hàng đợi tiếp nhận yêu cầu từ khách hàng (RMA / Hỗ trợ)
  const [rmaTickets, setRmaTickets] = useState([]);
  const [loadingRma, setLoadingRma] = useState(false);
  const [activeHandlingTicket, setActiveHandlingTicket] = useState(null);
  const [rmaFilter, setRmaFilter] = useState('PENDING'); // 'PENDING' | 'ACCEPTED'

  const fetchRmaQueue = async () => {
    setLoadingRma(true);
    try {
      const tickets = await getRmaTickets();
      setRmaTickets(Array.isArray(tickets) ? tickets : []);
    } catch (err) {
      console.warn('Lỗi tải hàng đợi tiếp nhận yêu cầu:', err);
    } finally {
      setLoadingRma(false);
    }
  };

  useEffect(() => {
    fetchRmaQueue();
  }, []);

  const pendingRmaTickets = rmaTickets.filter(
    (t) => t.status !== 'COMPLETED' && t.status !== 'ACCEPTED' && t.id !== activeHandlingTicket?.id
  );
  const acceptedRmaTickets = rmaTickets.filter(
    (t) => t.status === 'ACCEPTED'
  );

  const handleIntakeTicket = (ticket) => {
    setActiveHandlingTicket(ticket);
    setSelectedSerial(ticket.serialNumber);
    if (ticket.customerPhone) {
      setCustomerIdentifier(ticket.customerPhone);
    } else if (ticket.customerEmail) {
      setCustomerIdentifier(ticket.customerEmail);
    }
    if (ticket.customerEmail) {
      setCustomerEmail(ticket.customerEmail);
    }

    const matched = (allProducts || []).find(
      (p) => p.serialNumber?.toLowerCase() === ticket.serialNumber?.toLowerCase()
    );
    if (matched && matched.secretPin) {
      setActivationPin(matched.secretPin);
    }

    setActiveSubTab('overview');
    setQuickActivateNotice(
      `Đang tiếp nhận phiếu [${ticket.id}] cho khách hàng ${ticket.customerName}. Dữ liệu thiết bị và khách hàng đã được tự động điền xuống biểu mẫu.`
    );

    setTimeout(() => {
      const formEl = document.getElementById('activation-form-section');
      if (formEl) {
        formEl.scrollIntoView({ behavior: 'smooth', block: 'start' });
      }
    }, 100);
  };

  const handleCancelIntake = () => {
    if (activeHandlingTicket) {
      const ticketId = activeHandlingTicket.id;
      setActiveHandlingTicket(null);
      setSelectedSerial('');
      setCustomerIdentifier('');
      setCustomerEmail('');
      setActivationPin('');
      setQuickActivateNotice(null);
      if (onNotify) {
        onNotify({
          type: 'info',
          title: 'Khôi phục đơn tiếp nhận',
          message: `Đơn [${ticketId}] đã được khôi phục trở lại danh sách chờ tiếp nhận.`,
        });
      }
    }
  };

  const handleCompleteIntake = async () => {
    if (!activeHandlingTicket) return;
    try {
      await updateRmaTicketStatus(activeHandlingTicket.id, {
        status: 'ACCEPTED',
        technicianNotes: 'Đại lý bán lẻ đã tiếp nhận xử lý yêu cầu thành công',
      });
      const completedId = activeHandlingTicket.id;
      setActiveHandlingTicket(null);
      await fetchRmaQueue();
      if (onNotify) {
        onNotify({
          type: 'success',
          title: 'Tiếp nhận thành công',
          message: `Đơn [${completedId}] đã được chuyển sang trạng thái "Đã tiếp nhận".`,
        });
      }
    } catch (err) {
      setErrorMsg(err.message || 'Lỗi khi cập nhật trạng thái phiếu tiếp nhận');
    }
  };

  const pendingProducts = (allProducts || []).filter(
    (p) => p.status === 0 || p.status === 'Inactive' || (!p.isActivated && p.status !== 1)
  );

  const activeOrExpiredProducts = (allProducts || []).filter(
    (p) => p.status === 1 || p.status === 2 || p.status === 'Active' || p.status === 'Expired' || p.isActivated
  );

  // Quản lý chuyển tab phụ & Trang xem sản phẩm chờ kích hoạt
  const [activeSubTab, setActiveSubTab] = useState('overview'); // 'overview' | 'pending'
  const [pendingSearchQuery, setPendingSearchQuery] = useState('');
  const [revealedPins, setRevealedPins] = useState({});
  const [copiedPinSerial, setCopiedPinSerial] = useState(null);
  const [copiedSn, setCopiedSn] = useState(null);
  const [quickActivateNotice, setQuickActivateNotice] = useState(null);

  const filteredPendingProducts = pendingProducts.filter((p) => {
    if (!pendingSearchQuery.trim()) return true;
    const q = pendingSearchQuery.toLowerCase().trim();
    return (
      (p.serialNumber && p.serialNumber.toLowerCase().includes(q)) ||
      (p.name && p.name.toLowerCase().includes(q)) ||
      (p.brand && p.brand.toLowerCase().includes(q)) ||
      (p.modelCode && p.modelCode.toLowerCase().includes(q))
    );
  });

  const handleSelectForActivation = (prod) => {
    setSelectedSerial(prod.serialNumber);
    if (prod.secretPin) {
      setActivationPin(prod.secretPin);
    }
    setActiveSubTab('overview');
    setQuickActivateNotice(`Đã chọn thiết bị ${prod.serialNumber}${prod.secretPin ? ' và nạp sẵn mã PIN cào' : ''}. Hãy nhập Số Điện Thoại hoặc Email khách hàng để ký kích hoạt on-chain!`);
    setTimeout(() => {
      const formEl = document.getElementById('activation-form-section');
      if (formEl) {
        formEl.scrollIntoView({ behavior: 'smooth', block: 'start' });
      }
    }, 100);
  };

  // Gia han bao hanh state
  const [extendSerial, setExtendSerial] = useState('');
  const [additionalMonths, setAdditionalMonths] = useState(12);
  const [extendLoading, setExtendLoading] = useState(false);
  const [extendSuccess, setExtendSuccess] = useState(null);
  const [extendError, setExtendError] = useState('');

  // Đăng ký sản phẩm mới state (Dành cho Đại lý bán lẻ nhập kho thiết bị)
  const [showRegisterModal, setShowRegisterModal] = useState(false);
  const [registeredPinInfo, setRegisteredPinInfo] = useState(null);
  const [copiedPin, setCopiedPin] = useState(false);
  // Sang tên & Chuyển nhượng quyền sở hữu thiết bị (Bán máy cũ - Dành riêng cho Đại lý)
  const [transferSerial, setTransferSerial] = useState('');
  const [transferSearchQuery, setTransferSearchQuery] = useState('');
  const [isTransferDropdownOpen, setIsTransferDropdownOpen] = useState(false);
  const [activationSerialQuery, setActivationSerialQuery] = useState('');
  const [isActivationDropdownOpen, setIsActivationDropdownOpen] = useState(false);
  const [transferIdentifier, setTransferIdentifier] = useState('');
  const [newOwnerWallet, setNewOwnerWallet] = useState('');
  const [resolvedBuyer, setResolvedBuyer] = useState(null);
  const [isResolvingBuyer, setIsResolvingBuyer] = useState(false);
  const [resolveBuyerError, setResolveBuyerError] = useState('');
  const [transferLoading, setTransferLoading] = useState(false);
  const [transferSuccess, setTransferSuccess] = useState(null);
  const [transferError, setTransferError] = useState('');

  // Tự động phân giải thông tin người mua mới qua SĐT / Email / Ví
  useEffect(() => {
    if (!transferIdentifier || !transferIdentifier.trim()) {
      setResolvedBuyer(null);
      setResolveBuyerError('');
      setNewOwnerWallet('');
      return;
    }

    const timer = setTimeout(async () => {
      setIsResolvingBuyer(true);
      setResolveBuyerError('');
      try {
        const res = await resolveCustomerWallet(transferIdentifier.trim());
        if (res && res.success) {
          setResolvedBuyer(res);
          setNewOwnerWallet(res.walletAddress);
        }
      } catch (err) {
        setResolveBuyerError(err.message || 'Lỗi tra cứu thông tin người mua mới');
        setResolvedBuyer(null);
      } finally {
        setIsResolvingBuyer(false);
      }
    }, 350);

    return () => clearTimeout(timer);
  }, [transferIdentifier]);

  const handleSelectBuyer = (u) => {
    if (!u) return;
    if (u.phone) {
      setTransferIdentifier(u.phone);
    } else if (u.email) {
      setTransferIdentifier(u.email);
    }
    if (u.walletAddress) {
      setNewOwnerWallet(u.walletAddress);
    }
    setResolvedBuyer({
      success: true,
      found: true,
      walletAddress: u.walletAddress,
      user: u
    });
  };

  const handleTransferOwnership = async (e) => {
    e.preventDefault();
    if (!isMetaMaskConnected) {
      if (onConnectMetaMask) onConnectMetaMask();
      setTransferError('Vui lòng kết nối ví MetaMask của Đại lý để ký giao dịch sang tên On-Chain!');
      return;
    }

    if (!transferSerial) {
      setTransferError('Vui lòng chọn hoặc nhập thiết bị cần chuyển nhượng');
      return;
    }

    const cleanTransferSn = transferSerial.trim();
    const selectedProd = activeOrExpiredProducts.find(p => p.serialNumber.toLowerCase() === cleanTransferSn.toLowerCase());
    if (!selectedProd) {
      setTransferError(`Thiết bị [${cleanTransferSn}] không tồn tại hoặc chưa được kích hoạt bảo hành để sang tên.`);
      return;
    }

    const cleanNewOwner = (newOwnerWallet || '').trim();
    if (!cleanNewOwner || !/^0x[0-9a-fA-F]{40}$/.test(cleanNewOwner)) {
      setTransferError('Địa chỉ ví người mua mới không đúng định dạng chuẩn Ethereum (phải là 0x... gồm 42 ký tự hex)');
      return;
    }

    if (selectedProd.currentOwner && selectedProd.currentOwner.toLowerCase() === cleanNewOwner.toLowerCase()) {
      setTransferError('Địa chỉ ví người mua mới trùng với chủ sở hữu hiện tại của thiết bị! Vui lòng chọn người mua mới.');
      return;
    }

    setTransferLoading(true);
    setTransferError('');
    setTransferSuccess(null);
    setTransferTxProgress({ step: 'AWAITING_SIGNATURE', message: 'Đang mở ví MetaMask & chờ bạn ký sang tên thiết bị...' });

    try {
      const res = await blockchainService.transferOwnership(cleanTransferSn, cleanNewOwner, (p) => setTransferTxProgress(p));
      const buyerName = resolvedBuyer?.user?.fullName || resolvedBuyer?.user?.username || 'Khách hàng mới';
      const buyerPhone = resolvedBuyer?.user?.phone || (transferIdentifier.match(/^\d+$/) ? transferIdentifier : '');
      const buyerEmail = resolvedBuyer?.user?.email || (transferIdentifier.includes('@') ? transferIdentifier : '');

      // Đồng bộ thông tin chủ sở hữu mới về Backend
      try {
        await transferProductOwnership(cleanTransferSn, {
          newOwner: cleanNewOwner,
          buyerPhone,
          buyerEmail,
          buyerName,
          txHash: res.txHash,
        });
      } catch (syncErr) {
        console.warn('Lỗi đồng bộ backend sau khi sang tên on-chain:', syncErr);
      }

      setTransferSuccess({
        serial: cleanTransferSn,
        newOwner: cleanNewOwner,
        buyerName,
        txHash: res.txHash,
        blockNumber: res.blockNumber
      });

      if (onNotify) {
        onNotify({
          type: 'success',
          title: 'Sang tên thiết bị thành công On-Chain',
          message: `Thiết bị [${cleanTransferSn}] đã được chuyển nhượng thành công sang chủ sở hữu mới (${cleanNewOwner.slice(0, 6)}...${cleanNewOwner.slice(-4)}). Tx Hash: ${res.txHash}`,
        });
      }

      if (onWarrantyActivated) onWarrantyActivated();

      // Reset fields
      setTransferSerial('');
      setTransferSearchQuery('');
      setTransferIdentifier('');
      setResolvedBuyer(null);
      setNewOwnerWallet('');
    } catch (err) {
      setTransferError(err.message || 'Lỗi khi thực hiện sang tên thiết bị');
    } finally {
      setTransferLoading(false);
      setTransferTxProgress(null);
    }
  };

  const [newProdData, setNewProdData] = useState({
    serialNumber: '',
    modelCode: '',
    name: '',
    brand: '',
    category: 'Smartphone',
    standardWarrantyMonths: 12,
  });
  const [registerLoading, setRegisterLoading] = useState(false);
  const [registerError, setRegisterError] = useState('');

  // QR Camera Scanner state
  const [showQrModal, setShowQrModal] = useState(false);
  const [qrTarget, setQrTarget] = useState('activate'); // 'activate' | 'register'

  const handleQrScanSuccess = (scannedSerial) => {
    if (qrTarget === 'register') {
      setNewProdData((prev) => ({ ...prev, serialNumber: scannedSerial }));
    } else {
      setSelectedSerial(scannedSerial);
    }
  };

  const handleRegisterProduct = async (e) => {
    e.preventDefault();

    if (!newProdData.serialNumber.trim() || !newProdData.name.trim()) {
      setRegisterError('Vui lòng điền đủ Serial Number và Tên sản phẩm');
      return;
    }
    const cleanSn = newProdData.serialNumber.trim();
    const duplicate = (allProducts || []).find(p => p.serialNumber.toLowerCase() === cleanSn.toLowerCase());
    if (duplicate) {
      setRegisterError(`Số Serial [${cleanSn}] đã tồn tại trong hệ thống. Vui lòng nhập số Serial khác!`);
      return;
    }
    setRegisterLoading(true);
    setRegisterError('');
    setRegisterTxProgress({ step: 'AWAITING_SIGNATURE', message: 'Đang mở ví MetaMask & chờ bạn ký đăng ký thiết bị...' });

    try {
      // Sinh mã PIN cào bảo mật chống sao chép vật lý
      const secretPin = `PIN-${Math.floor(100000 + Math.random() * 900000)}`;

      const backendPayload = {
        serialNumber: newProdData.serialNumber.trim(),
        modelCode: newProdData.modelCode || 'MOD-SELLER',
        name: newProdData.name.trim(),
        brand: newProdData.brand.trim() || 'Samsung',
        category: newProdData.category || 'Smartphone',
        standardWarrantyMonths: Number(newProdData.standardWarrantyMonths) || 12,
        secretPin,
        specs: {
          processor: 'Tiêu chuẩn đại lý',
          ram: '8GB',
          storage: '256GB',
          display: 'Standard Display',
        },
        documentation: {
          manualUrl: '#',
          safetyGuide: '#',
          serviceCoverage: 'Chinh hang toan quoc'
        }
      };

      const computedHash = computeMetadataHash(backendPayload);

      // 1. Lưu on-chain kèm mã băm
      await blockchainService.registerProduct(
        newProdData.serialNumber.trim(),
        newProdData.modelCode || 'MOD-SELLER',
        newProdData.standardWarrantyMonths,
        secretPin,
        computedHash,
        (p) => setRegisterTxProgress(p)
      );

      // 2. Lưu backend
      await saveProduct(backendPayload);

      setRegisteredPinInfo({ serial: newProdData.serialNumber, pin: secretPin });

      setNewProdData({
        serialNumber: '',
        modelCode: '',
        name: '',
        brand: 'Samsung',
        category: 'Smartphone',
        standardWarrantyMonths: 12,
      });

      if (onProductAdded) onProductAdded();
      else if (onWarrantyActivated) onWarrantyActivated();
    } catch (err) {
      setRegisterError(err.message || 'Lỗi đăng ký sản phẩm');
    } finally {
      setRegisterLoading(false);
      setRegisterTxProgress(null);
    }
  };

  const handleActivate = async (e) => {
    e.preventDefault();
    if (!isMetaMaskConnected) {
      if (onConnectMetaMask) onConnectMetaMask();
      setErrorMsg('Vui lòng kết nối ví MetaMask để ký giao dịch kích hoạt bảo hành On-Chain!');
      return;
    }

    if (!selectedSerial) {
      setErrorMsg('Vui lòng chọn sản phẩm cần kích hoạt');
      return;
    }

    if (!activationPin.trim()) {
      setErrorMsg('Vui lòng nhập Mã PIN cào bảo mật vật lý (Scratch PIN) từ vỏ thiết bị để xác thực sở hữu!');
      return;
    }

    setLoading(true);
    setErrorMsg('');
    setSuccessInfo(null);
    setEmailStatus('');
    setTxProgress({ step: 'AWAITING_SIGNATURE', message: 'Đang mở ví MetaMask & chờ bạn ký kích hoạt bảo hành...' });

    try {
      let finalWallet = customerAddress;
      if (!finalWallet && customerIdentifier.trim()) {
        try {
          const resolved = await resolveCustomerWallet(customerIdentifier.trim());
          if (resolved?.walletAddress) finalWallet = resolved.walletAddress;
        } catch (e) {
          console.warn('Lỗi phân giải ví khi kích hoạt:', e);
        }
      }
      const res = await blockchainService.activateWarranty(selectedSerial, finalWallet, activationPin, (p) => setTxProgress(p));
      const matchedProd = (allProducts || []).find((p) => p.serialNumber.toLowerCase() === selectedSerial.toLowerCase());

      setSuccessInfo({
        serial: selectedSerial,
        txHash: res.txHash,
        blockNumber: res.blockNumber,
        expiryDate: res.product.expiryDate,
      });

      setCertData({
        product: matchedProd,
        chainData: res.product,
      });

      // Tự động gửi Email xác nhận kích hoạt nếu có email
      if (customerEmail && customerEmail.trim()) {
        sendWarrantyActivationNotification({
          toEmail: customerEmail.trim(),
          customerName: 'Quý khách hàng',
          serialNumber: selectedSerial,
          modelCode: res.product.modelCode,
          productName: matchedProd?.name || selectedSerial,
          brand: matchedProd?.brand || 'Chính hãng',
          expiryDate: res.product.expiryDate,
          txHash: res.txHash,
        }).then((mailRes) => {
          setEmailStatus(`Đã tự động gửi email biên nhận bảo hành tới: ${customerEmail}`);
        });
      }

      // Tự động hoàn tất tiếp nhận phiếu yêu cầu nếu đang xử lý theo phiếu
      if (activeHandlingTicket) {
        try {
          await updateRmaTicketStatus(activeHandlingTicket.id, {
            status: 'ACCEPTED',
            technicianNotes: `Đại lý đã tiếp nhận và kích hoạt bảo hành thành công (Tx: ${res.txHash.slice(0, 10)}...)`,
          });
          setActiveHandlingTicket(null);
          fetchRmaQueue();
        } catch (rmaErr) {
          console.warn('Lỗi cập nhật trạng thái phiếu RMA khi kích hoạt:', rmaErr);
        }
      }

      setSelectedSerial('');
      setActivationPin('');
      setCustomerIdentifier('');
      setResolvedWallet(null);
      if (onWarrantyActivated) onWarrantyActivated();
    } catch (err) {
      setErrorMsg(err.message || 'Lỗi khi kích hoạt bảo hành');
    } finally {
      setLoading(false);
      setTxProgress(null);
    }
  };

  const handleExtend = async (e) => {
    e.preventDefault();
    if (!isMetaMaskConnected) {
      if (onConnectMetaMask) onConnectMetaMask();
      setExtendError('Vui lòng kết nối ví MetaMask để ký giao dịch gia hạn bảo hành On-Chain!');
      return;
    }

    if (!extendSerial) {
      setExtendError('Vui lòng chọn thiết bị cần mua gói bảo hành mở rộng');
      return;
    }
    setExtendLoading(true);
    setExtendError('');
    setExtendSuccess(null);
    setExtendTxProgress({ step: 'AWAITING_SIGNATURE', message: 'Đang mở ví MetaMask & chờ bạn ký gia hạn bảo hành...' });

    try {
      const res = await blockchainService.extendWarranty(extendSerial, additionalMonths, (p) => setExtendTxProgress(p));
      setExtendSuccess({
        serial: extendSerial,
        months: additionalMonths,
        txHash: res.txHash,
        newExpiry: res.product.expiryDate,
      });
      setExtendSerial('');
      if (onWarrantyExtended) onWarrantyExtended();
    } catch (err) {
      setExtendError(err.message || 'Lỗi khi gia hạn bảo hành');
    } finally {
      setExtendLoading(false);
      setExtendTxProgress(null);
    }
  };

  return (
    <div className="space-y-8">
      
      {/* Banner */}
      <div className="p-6 rounded-3xl glass-card border border-slate-200 dark:border-slate-800 flex flex-col md:flex-row items-start md:items-center justify-between gap-4">
        <div className="flex items-center gap-4">
          <div className="w-12 h-12 rounded-2xl bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border border-emerald-500/20 flex items-center justify-center">
            <Store className="w-6 h-6" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h2 className="text-lg font-bold text-slate-900 dark:text-white">Cổng Đại Lý Ủy Quyền (Authorized Seller)</h2>
              <span className="text-[10px] bg-emerald-500/15 text-emerald-700 dark:text-emerald-400 font-bold px-2 py-0.5 rounded border border-emerald-500/30">
                ROLE: SELLER
              </span>
            </div>
            <p className="text-xs text-slate-600 dark:text-slate-400">
              Kích hoạt hợp đồng bảo hành điện tử khi bán máy mới & Cung cấp gói gia hạn bảo hành mở rộng.
            </p>
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-3">
          <button
            type="button"
            onClick={() => setShowRegisterModal(true)}
            className="px-3.5 py-2 rounded-xl bg-blue-600 hover:bg-blue-500 text-white font-bold text-xs flex items-center gap-1.5 shadow-md shadow-blue-600/30 transition cursor-pointer"
          >
            <PackagePlus className="w-4 h-4" />
            <span>Đăng ký Sản phẩm Mới</span>
          </button>

          <button
            type="button"
            onClick={() => setActiveSubTab(prev => prev === 'pending' ? 'overview' : 'pending')}
            className={`px-3.5 py-1.5 rounded-xl text-xs font-semibold flex items-center gap-2 transition cursor-pointer border ${
              activeSubTab === 'pending'
                ? 'bg-amber-500/20 text-amber-800 dark:text-amber-300 border-amber-500/50 shadow-md shadow-amber-500/10 ring-2 ring-amber-500/30'
                : 'bg-slate-100 hover:bg-amber-50 dark:bg-slate-950/60 dark:hover:bg-slate-900 border-slate-200 dark:border-slate-800 text-slate-700 dark:text-slate-300 hover:text-amber-600 dark:hover:text-amber-400'
            }`}
            title="Bấm vào đây để mở Danh sách Toàn bộ Sản phẩm Chờ Kích Hoạt"
          >
            <Clock className="w-4 h-4 text-amber-500 dark:text-amber-400 animate-pulse" />
            <span>Sản phẩm chờ kích hoạt: <strong className="text-slate-900 dark:text-white ml-0.5">{pendingProducts.length}</strong></span>
            <ChevronRight className="w-3.5 h-3.5 opacity-60" />
          </button>

          <button
            type="button"
            onClick={() => {
              setActiveSubTab('overview');
              setTimeout(() => {
                const qEl = document.getElementById('seller-rma-queue-section');
                if (qEl) qEl.scrollIntoView({ behavior: 'smooth', block: 'start' });
              }, 100);
            }}
            className="px-3.5 py-1.5 rounded-xl text-xs font-semibold flex items-center gap-2 transition cursor-pointer border bg-slate-100 hover:bg-amber-50 dark:bg-slate-950/60 dark:hover:bg-slate-900 border-slate-200 dark:border-slate-800 text-slate-700 dark:text-slate-300 hover:text-amber-600 dark:hover:text-amber-400"
            title="Xem danh sách đơn yêu cầu tiếp nhận từ khách hàng"
          >
            <Inbox className="w-4 h-4 text-amber-500 animate-pulse" />
            <span>Đơn chờ tiếp nhận: <strong className="text-slate-900 dark:text-white ml-0.5">{pendingRmaTickets.length}</strong></span>
          </button>
        </div>
      </div>

      {/* Wallet status banner */}
      {isMetaMaskConnected ? (
        <div className="p-3.5 rounded-2xl bg-emerald-500/10 border border-emerald-500/30 flex items-center justify-between gap-2 text-emerald-800 dark:text-emerald-300 text-xs">
          <div className="flex items-center gap-2">
            <CheckCircle2 className="w-4 h-4 text-emerald-500 dark:text-emerald-400 shrink-0" />
            <span>Ví MetaMask đã kết nối: <span className="font-mono font-bold text-slate-900 dark:text-white">{metaMaskAddress}</span></span>
          </div>
          <span className="text-[10px] bg-emerald-500/20 px-2.5 py-1 rounded-lg text-emerald-800 dark:text-emerald-300 font-bold border border-emerald-500/30">
            ✓ Sẵn sàng kích hoạt & gia hạn On-Chain
          </span>
        </div>
      ) : (
        <div className="p-3.5 rounded-2xl bg-amber-500/10 border border-amber-500/30 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 text-amber-800 dark:text-amber-300 text-xs">
          <div className="flex items-center gap-2">
            <AlertTriangle className="w-4 h-4 text-amber-500 dark:text-amber-400 shrink-0" />
            <span>Yêu cầu kết nối ví MetaMask: Tài khoản Đại lý cần kết nối ví Web3 để ký hợp đồng kích hoạt và gia hạn bảo hành lên Smart Contract.</span>
          </div>
          {onConnectMetaMask && (
            <button
              type="button"
              onClick={onConnectMetaMask}
              className="px-3.5 py-1.5 rounded-xl bg-orange-500 hover:bg-orange-600 text-white font-bold text-xs flex items-center gap-1.5 transition cursor-pointer shrink-0 shadow-md shadow-orange-500/20"
            >
              <Wallet className="w-3.5 h-3.5" />
              <span>Kết nối MetaMask</span>
            </button>
          )}
        </div>
      )}

      {/* Sub-tab Navigation */}
      <div className="flex flex-wrap items-center justify-between gap-3 pb-1 border-b border-slate-200 dark:border-slate-800">
        <div className="flex items-center gap-2 p-1 bg-slate-100 dark:bg-slate-900/80 rounded-2xl border border-slate-200 dark:border-slate-800">
          <button
            type="button"
            onClick={() => setActiveSubTab('overview')}
            className={`px-4 py-2 rounded-xl text-xs font-bold transition flex items-center gap-2 cursor-pointer ${
              activeSubTab === 'overview'
                ? 'bg-white dark:bg-slate-800 text-blue-600 dark:text-blue-400 shadow-sm border border-slate-200 dark:border-slate-700'
                : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white'
            }`}
          >
            <Store className="w-4 h-4" />
            <span>Bàn Làm Việc Kích Hoạt</span>
          </button>

          <button
            type="button"
            onClick={() => setActiveSubTab('pending')}
            className={`px-4 py-2 rounded-xl text-xs font-bold transition flex items-center gap-2 cursor-pointer ${
              activeSubTab === 'pending'
                ? 'bg-white dark:bg-slate-800 text-amber-600 dark:text-amber-400 shadow-sm border border-slate-200 dark:border-slate-700'
                : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white'
            }`}
          >
            <Clock className="w-4 h-4 text-amber-500" />
            <span>Kho Sản Phẩm Chờ Kích Hoạt</span>
            <span className={`px-2 py-0.5 rounded-full text-[10px] font-mono font-bold ${
              activeSubTab === 'pending'
                ? 'bg-amber-500 text-white'
                : 'bg-amber-100 text-amber-800 dark:bg-amber-950 dark:text-amber-300'
            }`}>
              {pendingProducts.length}
            </span>
          </button>

          <button
            type="button"
            onClick={() => setActiveSubTab('transfer')}
            className={`px-4 py-2 rounded-xl text-xs font-bold transition flex items-center gap-2 cursor-pointer ${
              activeSubTab === 'transfer'
                ? 'bg-white dark:bg-slate-800 text-purple-600 dark:text-purple-400 shadow-sm border border-slate-200 dark:border-slate-700'
                : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white'
            }`}
          >
            <ArrowRightLeft className="w-4 h-4 text-purple-500" />
            <span>Sang Tên & Chuyển Nhượng Máy</span>
            <span className={`px-2 py-0.5 rounded-full text-[10px] font-mono font-bold ${
              activeSubTab === 'transfer'
                ? 'bg-purple-500 text-white'
                : 'bg-purple-100 text-purple-800 dark:bg-purple-950 dark:text-purple-300'
            }`}>
              {activeOrExpiredProducts.length}
            </span>
          </button>
        </div>

        {(activeSubTab === 'pending' || activeSubTab === 'transfer') && (
          <button
            type="button"
            onClick={() => setActiveSubTab('overview')}
            className="px-3 py-1.5 rounded-xl bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-300 font-semibold text-xs flex items-center gap-1.5 transition cursor-pointer"
          >
            <ArrowLeft className="w-3.5 h-3.5" />
            <span>Quay lại Bàn Làm Việc</span>
          </button>
        )}
      </div>

      
      {activeSubTab === 'transfer' ? (
        /* Dedicated Page: Sang Tên & Chuyển Nhượng Máy Cũ */
        <div className="space-y-6 animate-fade-in">
          {/* Page Header Banner */}
          <div className="glass-card rounded-3xl p-6 border border-slate-200 dark:border-slate-800 flex flex-col md:flex-row items-start md:items-center justify-between gap-4">
            <div className="flex items-center gap-3">
              <div className="w-12 h-12 rounded-2xl bg-purple-500/10 text-purple-600 dark:text-purple-400 border border-purple-500/20 flex items-center justify-center shrink-0">
                <ArrowRightLeft className="w-6 h-6" />
              </div>
              <div>
                <h3 className="text-base font-bold text-slate-900 dark:text-white flex items-center gap-2">
                  Cổng Sang Tên & Chuyển Quyền Sở Hữu Thiết Bị (Bán Máy Cũ)
                  <span className="text-[10px] px-2.5 py-0.5 rounded-full bg-purple-500/15 text-purple-700 dark:text-purple-300 font-bold border border-purple-500/30">
                    ROLE: SELLER EXCLUSIVE
                  </span>
                </h3>
                <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
                  Đại lý bán lẻ tiếp nhận thiết bị đã kích hoạt, xác thực hợp đồng bảo hành và ký số giao dịch chuyển quyền sở hữu On-Chain sang người mua mới.
                </p>
              </div>
            </div>

            <div className="px-3.5 py-2 rounded-2xl bg-purple-500/10 border border-purple-500/25 text-purple-700 dark:text-purple-300 text-xs font-semibold">
              <span>Thiết bị có thể sang tên: <strong>{activeOrExpiredProducts.length}</strong></span>
            </div>
          </div>

          {/* Transfer Form Card */}
          <div className="glass-card rounded-3xl p-6 sm:p-8 border border-slate-200 dark:border-slate-800 space-y-6 shadow-sm w-full max-w-5xl mx-auto">
            <div className="flex items-center justify-between pb-3 border-b border-slate-200 dark:border-slate-800">
              <h4 className="text-sm font-bold text-slate-900 dark:text-white flex items-center gap-2">
                <ArrowRightLeft className="w-4 h-4 text-purple-500" />
                Phiếu Chuyển Giao Quyền Sở Hữu Hợp Đồng Bảo Hành On-Chain
              </h4>
              <span className="text-[10px] font-mono px-2 py-0.5 rounded bg-purple-500/20 text-purple-700 dark:text-purple-300 border border-purple-500/30">
                Smart Contract Verified
              </span>
            </div>

            {/* Real-time MetaMask Transaction Status Indicator */}
            {transferLoading && transferTxProgress && (
              <div className={`p-4 rounded-2xl border text-xs flex items-center gap-3 transition-all duration-300 animate-fade-in ${
                transferTxProgress.step === 'CONFIRMED'
                  ? 'bg-emerald-500/15 border-emerald-500/40 text-emerald-800 dark:text-emerald-300'
                  : transferTxProgress.step === 'FAILED'
                  ? 'bg-rose-500/15 border-rose-500/40 text-rose-800 dark:text-rose-300'
                  : 'bg-purple-500/10 border-purple-500/30 text-purple-800 dark:text-purple-300 animate-pulse'
              }`}>
                <div className="w-5 h-5 rounded-full border-2 border-current border-t-transparent animate-spin shrink-0" />
                <div className="flex-1">
                  <div className="font-bold flex items-center gap-1.5 text-sm">
                    <span>🦊 MetaMask:</span>
                    <span>{transferTxProgress.message}</span>
                  </div>
                  <p className="text-[11px] opacity-80 mt-0.5">
                    {transferTxProgress.step === 'AWAITING_SIGNATURE' && 'Cửa sổ MetaMask đang mở. Vui lòng bấm "Xác nhận" để ký sang tên thiết bị.'}
                    {transferTxProgress.step === 'MINING' && 'Giao dịch đã được phát lên mạng Blockchain. Đang chờ xác nhận khối...'}
                    {transferTxProgress.step === 'CONFIRMED' && 'MetaMask đã xác nhận sang tên thành công! Đang lưu vào hệ thống...'}
                    {transferTxProgress.step === 'FAILED' && 'Giao dịch đã bị từ chối hoặc gặp lỗi từ ví MetaMask.'}
                  </p>
                </div>
              </div>
            )}

            {transferError && (
              <div className="p-3.5 rounded-xl bg-rose-500/10 border border-rose-500/30 text-rose-600 dark:text-rose-400 text-xs flex items-center gap-2">
                <AlertTriangle className="w-4 h-4 shrink-0" />
                <span>{transferError}</span>
              </div>
            )}

            {transferSuccess && (
              <div className="p-4 rounded-xl bg-emerald-500/10 border border-emerald-500/30 text-emerald-700 dark:text-emerald-400 text-xs space-y-2 animate-fade-in">
                <div className="flex items-center gap-2 font-bold text-sm">
                  <CheckCircle2 className="w-4 h-4" />
                  Đã sang tên thiết bị {transferSuccess.serial} thành công cho {transferSuccess.buyerName}!
                </div>
                <div className="font-mono text-[11px] text-slate-600 dark:text-slate-300 space-y-0.5">
                  <div>Ví chủ mới: <span className="font-bold text-slate-900 dark:text-white">{transferSuccess.newOwner}</span></div>
                  <div>Tx Hash: <span className="text-emerald-700 dark:text-emerald-300">{transferSuccess.txHash}</span></div>
                </div>
              </div>
            )}

            <form onSubmit={handleTransferOwnership} className="space-y-5 text-xs">
              
              {/* BƯỚC 1: CHỌN HOẶC TÌM KIẾM THIẾT BỊ CẦN SANG TÊN */}
              <div className="space-y-2 relative">
                <div className="flex items-center justify-between">
                  <label className="text-slate-700 dark:text-slate-300 font-semibold flex items-center gap-1.5 text-xs">
                    <PackageCheck className="w-3.5 h-3.5 text-purple-500" />
                    <span>1. Chọn hoặc Tìm Kiếm Thiết Bị Cần Sang Tên (*)</span>
                  </label>
                  {transferSerial && (
                    <span className="text-[10px] text-purple-600 dark:text-purple-400 font-mono flex items-center gap-1 font-bold">
                      <Check className="w-3 h-3" />
                      Đã chọn: {transferSerial}
                    </span>
                  )}
                </div>

                <div className="relative">
                  <Search className="w-4 h-4 text-slate-400 absolute left-3.5 top-1/2 -translate-y-1/2 pointer-events-none" />
                  <input
                    type="text"
                    required
                    value={transferSearchQuery || transferSerial}
                    onFocus={() => setIsTransferDropdownOpen(true)}
                    onChange={(e) => {
                      const val = e.target.value;
                      setTransferSearchQuery(val);
                      setTransferSerial(val);
                      setIsTransferDropdownOpen(true);
                    }}
                    placeholder="-- Nhấp để chọn hoặc gõ mã máy, model, số serial để tìm kiếm --"
                    className="w-full pl-10 pr-20 py-2.5 rounded-xl bg-white dark:bg-slate-950 border border-slate-300 dark:border-slate-800 text-slate-900 dark:text-white font-mono text-xs focus:border-purple-500 focus:outline-none placeholder:text-slate-400 dark:placeholder:text-slate-500 cursor-pointer"
                  />
                  <div className="absolute right-3 top-1/2 -translate-y-1/2 flex items-center gap-1">
                    {transferSerial && (
                      <button
                        type="button"
                        onClick={() => {
                          setTransferSerial('');
                          setTransferSearchQuery('');
                          setIsTransferDropdownOpen(true);
                        }}
                        className="p-1 rounded-md hover:bg-slate-100 dark:hover:bg-slate-800 text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 transition cursor-pointer"
                        title="Xóa lựa chọn"
                      >
                        <X className="w-3.5 h-3.5" />
                      </button>
                    )}
                    <button
                      type="button"
                      onClick={() => setIsTransferDropdownOpen(!isTransferDropdownOpen)}
                      className="p-1 rounded-md text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 transition cursor-pointer"
                    >
                      <ChevronRight className={`w-4 h-4 transition-transform duration-200 ${isTransferDropdownOpen ? 'rotate-90 text-purple-500' : ''}`} />
                    </button>
                  </div>
                </div>

                {/* Dropdown danh sách thiết bị có thể sang tên */}
                {isTransferDropdownOpen && (
                  <div className="absolute z-30 left-0 right-0 mt-1 max-h-56 overflow-y-auto rounded-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 shadow-xl p-2 space-y-1 text-xs animate-fade-in backdrop-blur-md">
                    {activeOrExpiredProducts.filter(p => {
                      if (!transferSearchQuery.trim()) return true;
                      const q = transferSearchQuery.toLowerCase().trim();
                      return (
                        (p.serialNumber && p.serialNumber.toLowerCase().includes(q)) ||
                        (p.name && p.name.toLowerCase().includes(q)) ||
                        (p.modelCode && p.modelCode.toLowerCase().includes(q)) ||
                        (p.brand && p.brand.toLowerCase().includes(q))
                      );
                    }).length === 0 ? (
                      <div className="p-3 text-center text-slate-400">Không tìm thấy thiết bị nào phù hợp</div>
                    ) : (
                      activeOrExpiredProducts.filter(p => {
                        if (!transferSearchQuery.trim()) return true;
                        const q = transferSearchQuery.toLowerCase().trim();
                        return (
                          (p.serialNumber && p.serialNumber.toLowerCase().includes(q)) ||
                          (p.name && p.name.toLowerCase().includes(q)) ||
                          (p.modelCode && p.modelCode.toLowerCase().includes(q)) ||
                          (p.brand && p.brand.toLowerCase().includes(q))
                        );
                      }).map((p) => {
                        const isSel = transferSerial && transferSerial.toLowerCase() === p.serialNumber.toLowerCase();
                        return (
                          <div
                            key={p.serialNumber}
                            onClick={() => {
                              setTransferSerial(p.serialNumber);
                              setTransferSearchQuery(p.serialNumber);
                              setIsTransferDropdownOpen(false);
                            }}
                            className={`p-2.5 rounded-xl cursor-pointer transition flex items-center justify-between gap-3 ${
                              isSel
                                ? 'bg-purple-50 dark:bg-purple-950/40 text-purple-600 dark:text-purple-300 font-bold border border-purple-200 dark:border-purple-800'
                                : 'hover:bg-slate-100 dark:hover:bg-slate-800/80 text-slate-700 dark:text-slate-200'
                            }`}
                          >
                            <div className="min-w-0 flex-1">
                              <div className="flex items-center gap-2">
                                <span className="font-mono font-bold text-slate-900 dark:text-white text-xs">{p.serialNumber}</span>
                                <span className={`text-[10px] px-1.5 py-0.2 rounded font-semibold ${
                                  p.status === 1
                                    ? 'bg-emerald-500/15 text-emerald-700 dark:text-emerald-400 border border-emerald-500/30'
                                    : 'bg-rose-500/15 text-rose-700 dark:text-rose-400 border border-rose-500/30'
                                }`}>
                                  {p.status === 1 ? 'Đang bảo hành' : 'Hết hạn bảo hành'}
                                </span>
                              </div>
                              <div className="text-[11px] text-slate-500 dark:text-slate-400 truncate mt-0.5">
                                {p.name || p.modelCode} {p.brand ? `• ${p.brand}` : ''} • Chủ máy: {p.currentOwner ? `${p.currentOwner.slice(0, 8)}...` : 'Chưa gán'}
                              </div>
                            </div>
                            {isSel && <Check className="w-4 h-4 text-purple-500 shrink-0" />}
                          </div>
                        );
                      })
                    )}
                  </div>
                )}

                {/* Card hiển thị thông tin thiết bị đang chọn */}
                {(() => {
                  const selectedProd = activeOrExpiredProducts.find(p => p.serialNumber.toLowerCase() === (transferSerial || '').toLowerCase());
                  if (!selectedProd) return null;
                  return (
                    <div className="p-3.5 rounded-2xl bg-purple-500/10 border border-purple-500/25 text-xs space-y-2 animate-fade-in">
                      <div className="flex items-center justify-between">
                        <div className="font-bold text-slate-900 dark:text-white text-sm">
                          {selectedProd.name || selectedProd.modelCode}
                        </div>
                        <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-emerald-500/20 text-emerald-700 dark:text-emerald-300">
                          {selectedProd.status === 1 ? 'Bảo hành hiệu lực' : 'Đã hết hạn'}
                        </span>
                      </div>
                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 text-[11px] text-slate-600 dark:text-slate-400 font-mono">
                        <div>Số Serial: <strong className="text-slate-900 dark:text-white">{selectedProd.serialNumber}</strong></div>
                        <div className="truncate">Chủ sở hữu hiện tại: <strong className="text-slate-900 dark:text-white">{selectedProd.currentOwner ? `${selectedProd.currentOwner.slice(0, 10)}...` : 'Chưa gán'}</strong></div>
                      </div>
                    </div>
                  );
                })()}
              </div>

              {/* BƯỚC 2: THÔNG TIN NGƯỜI MUA MỚI */}
              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <label className="text-slate-700 dark:text-slate-300 font-semibold flex items-center gap-1.5 text-xs">
                    <Phone className="w-3.5 h-3.5 text-emerald-500" />
                    <span>2. Số Điện Thoại / Email / Ví Người Mua Mới (*)</span>
                  </label>
                  <span className="text-[10px] text-slate-500 dark:text-slate-400">
                    📱 Nhập SĐT (10 số), Email hoặc ví 0x...
                  </span>
                </div>

                <div className="relative">
                  <input
                    type="text"
                    required
                    value={transferIdentifier}
                    onChange={(e) => {
                      const val = e.target.value;
                      setTransferIdentifier(val);
                      if (val.startsWith('0x') && val.length === 42) {
                        setNewOwnerWallet(val);
                      }
                    }}
                    placeholder="Nhập SĐT người mua (VD: 0987654313) hoặc Email để nhận diện ví..."
                    className="w-full px-3.5 py-2.5 rounded-xl bg-white dark:bg-slate-950 border border-slate-300 dark:border-slate-800 text-slate-900 dark:text-white font-mono text-xs focus:border-purple-500 focus:outline-none placeholder:text-slate-400 dark:placeholder:text-slate-500 pr-10"
                  />
                  {isResolvingBuyer && (
                    <div className="absolute right-3 top-1/2 -translate-y-1/2">
                      <div className="w-4 h-4 border-2 border-purple-500 border-t-transparent rounded-full animate-spin" />
                    </div>
                  )}
                </div>

                {/* Card thông tin người mua nhận diện được */}
                {resolvedBuyer && resolvedBuyer.user ? (
                  <div 
                    onClick={() => handleSelectBuyer(resolvedBuyer.user)}
                    className="p-3.5 rounded-2xl bg-gradient-to-r from-purple-500/10 via-indigo-500/10 to-blue-500/10 border-2 border-purple-500/50 hover:border-purple-500 text-slate-900 dark:text-white text-xs space-y-2 cursor-pointer transition-all duration-200 shadow-xs hover:shadow-md group animate-fade-in"
                    title="Nhấp vào để chọn người mua này"
                  >
                    <div className="flex items-center justify-between gap-3">
                      <div className="flex items-center gap-3">
                        <div className="w-9 h-9 rounded-xl bg-purple-500/20 text-purple-600 dark:text-purple-400 flex items-center justify-center font-bold text-sm shrink-0 border border-purple-500/30">
                          {resolvedBuyer.user.fullName?.charAt(0) || '👤'}
                        </div>
                        <div>
                          <div className="font-bold text-slate-900 dark:text-white flex items-center gap-2">
                            <span className="text-sm">{resolvedBuyer.user.fullName || resolvedBuyer.user.username}</span>
                            <span className="text-[10px] px-2 py-0.5 rounded-full bg-purple-500/20 text-purple-700 dark:text-purple-300 font-bold border border-purple-500/30">
                              ✓ Khách hàng hệ thống
                            </span>
                          </div>
                          <div className="text-[11px] text-slate-500 dark:text-slate-400 flex flex-wrap items-center gap-2.5 mt-0.5">
                            {resolvedBuyer.user.phone && (
                              <span className="flex items-center gap-1 font-mono text-slate-700 dark:text-slate-300">
                                <Phone className="w-3 h-3 text-blue-500" />
                                {resolvedBuyer.user.phone}
                              </span>
                            )}
                            {resolvedBuyer.user.email && (
                              <span className="flex items-center gap-1 font-mono text-purple-600 dark:text-purple-400 font-semibold">
                                <Mail className="w-3 h-3 text-purple-500" />
                                {resolvedBuyer.user.email}
                              </span>
                            )}
                          </div>
                        </div>
                      </div>

                      <button
                        type="button"
                        onClick={(e) => {
                          e.stopPropagation();
                          handleSelectBuyer(resolvedBuyer.user);
                        }}
                        className="px-3.5 py-2 rounded-xl bg-purple-600 hover:bg-purple-500 text-white font-bold text-[11px] flex items-center gap-1.5 shadow-md shadow-purple-600/25 transition cursor-pointer shrink-0 active:scale-95"
                      >
                        <Check className="w-3.5 h-3.5" />
                        <span>Chọn Người Mua Này</span>
                      </button>
                    </div>

                    <div className="pt-2 border-t border-purple-500/20 flex flex-wrap items-center justify-between gap-2 text-[11px]">
                      <div className="flex items-center gap-1 font-mono text-slate-600 dark:text-slate-400">
                        <span>Ví On-Chain đích nhận chuyển giao:</span>
                        <span className="text-slate-900 dark:text-white font-bold">{resolvedBuyer.walletAddress}</span>
                      </div>
                    </div>
                  </div>
                ) : resolvedBuyer && resolvedBuyer.isAutoDerived ? (
                  <div className="p-3 rounded-2xl bg-blue-500/10 border border-blue-500/30 text-blue-800 dark:text-blue-300 text-xs space-y-1 animate-fade-in">
                    <div className="flex items-center justify-between">
                      <span className="font-bold flex items-center gap-1.5">
                        <UserCheck className="w-4 h-4 text-blue-500 shrink-0" />
                        Khách hàng mới (chưa có tài khoản Web)
                      </span>
                      <span className="text-[10px] px-2 py-0.5 rounded bg-blue-500/20 text-blue-700 dark:text-blue-300 font-bold">
                        ✓ Đã cấp ví bảo mật MPC
                      </span>
                    </div>
                    <div className="text-[11px] text-slate-600 dark:text-slate-400 font-mono">
                      Ví On-Chain định danh theo SĐT: <strong className="text-slate-900 dark:text-white">{resolvedBuyer.walletAddress}</strong>
                    </div>
                  </div>
                ) : null}

                {resolveBuyerError && transferIdentifier.trim() && (
                  <div className="p-2.5 rounded-xl bg-amber-500/10 border border-amber-500/30 text-amber-700 dark:text-amber-300 text-xs flex items-center gap-2">
                    <AlertTriangle className="w-3.5 h-3.5 shrink-0" />
                    <span>{resolveBuyerError}</span>
                  </div>
                )}
              </div>

              {/* NÚT KÝ SỐ METAMASK SANG TÊN */}
              {!isMetaMaskConnected ? (
                <button
                  type="button"
                  onClick={onConnectMetaMask}
                  className="w-full py-3.5 rounded-xl font-bold tracking-wide transition flex items-center justify-center gap-2 bg-gradient-to-r from-orange-500 to-amber-600 hover:from-orange-600 hover:to-amber-700 text-white shadow-lg shadow-orange-500/25 cursor-pointer active:scale-98 text-xs"
                >
                  <Wallet className="w-4 h-4" />
                  <span>🦊 Kết Nối MetaMask Đại Lý Để Ký Sang Tên</span>
                </button>
              ) : (
                <button
                  type="submit"
                  disabled={transferLoading || !transferSerial || !newOwnerWallet}
                  className="w-full py-3.5 rounded-xl bg-purple-600 hover:bg-purple-700 text-white font-bold tracking-wide transition flex items-center justify-center gap-2 shadow-lg shadow-purple-600/30 cursor-pointer disabled:opacity-50 text-xs active:scale-98"
                >
                  {transferLoading ? (
                    <>
                      <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
                      <span>{transferTxProgress?.message || 'Đang xử lý sang tên qua MetaMask...'}</span>
                    </>
                  ) : (
                    <>
                      <ArrowRightLeft className="w-4 h-4" />
                      <span>Ký Số & Sang Tên Thiết Bị On-Chain (MetaMask)</span>
                    </>
                  )}
                </button>
              )}

            </form>
          </div>
        </div>
      ) : activeSubTab === 'pending' ? (

        /* Dedicated Page: Kho Sản Phẩm Cần Kích Hoạt */
        <div className="space-y-6 animate-fade-in">
          {/* Page Header */}
          <div className="glass-card rounded-3xl p-6 border border-slate-200 dark:border-slate-800 flex flex-col md:flex-row items-start md:items-center justify-between gap-4">
            <div className="flex items-center gap-3">
              <div className="w-12 h-12 rounded-2xl bg-amber-500/10 text-amber-600 dark:text-amber-400 border border-amber-500/20 flex items-center justify-center shrink-0">
                <Clock className="w-6 h-6" />
              </div>
              <div>
                <h3 className="text-base font-bold text-slate-900 dark:text-white flex items-center gap-2">
                  Kho Sản Phẩm Cần Kích Hoạt Bảo Hành
                  <span className="text-xs px-2.5 py-0.5 rounded-full bg-amber-500/15 text-amber-700 dark:text-amber-300 font-bold border border-amber-500/30">
                    {filteredPendingProducts.length} thiết bị
                  </span>
                </h3>
                <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
                  Danh sách thiết bị đã xuất xưởng/nhập kho thành công trên Smart Contract, đang sẵn sàng kích hoạt và bàn giao cho khách hàng.
                </p>
              </div>
            </div>

            <div className="flex items-center gap-2.5 w-full md:w-auto">
              <button
                type="button"
                onClick={() => setShowRegisterModal(true)}
                className="px-3.5 py-2 rounded-xl bg-blue-600 hover:bg-blue-500 text-white font-bold text-xs flex items-center gap-1.5 shadow-md shadow-blue-600/30 transition cursor-pointer shrink-0"
              >
                <PackagePlus className="w-4 h-4" />
                <span>Nhập Thiết Bị Mới</span>
              </button>
            </div>
          </div>

          {/* Search & Stats Bar */}
          <div className="grid grid-cols-1 md:grid-cols-12 gap-4">
            <div className="md:col-span-8 relative">
              <Search className="w-4 h-4 text-slate-400 absolute left-3.5 top-1/2 -translate-y-1/2" />
              <input
                type="text"
                value={pendingSearchQuery}
                onChange={(e) => setPendingSearchQuery(e.target.value)}
                placeholder="Tìm kiếm theo Số Serial, Tên sản phẩm, Mã Model, Thương hiệu..."
                className="w-full pl-10 pr-4 py-2.5 rounded-2xl bg-white dark:bg-slate-950 border border-slate-300 dark:border-slate-800 text-slate-900 dark:text-white text-xs focus:border-amber-500 focus:outline-none placeholder:text-slate-400 dark:placeholder:text-slate-500"
              />
              {pendingSearchQuery && (
                <button
                  type="button"
                  onClick={() => setPendingSearchQuery('')}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 text-xs"
                >
                  <X className="w-3.5 h-3.5" />
                </button>
              )}
            </div>

            <div className="md:col-span-4 flex items-center justify-end gap-3 text-xs text-slate-600 dark:text-slate-400">
              <div className="px-3.5 py-2 rounded-xl bg-slate-100 dark:bg-slate-900 border border-slate-200 dark:border-slate-800 flex items-center gap-2">
                <Key className="w-3.5 h-3.5 text-amber-500" />
                <span>Có mã PIN cào: <strong className="text-slate-900 dark:text-white">{pendingProducts.filter(p => p.secretPin).length}</strong></span>
              </div>
            </div>
          </div>

          {/* Product Cards List */}
          {filteredPendingProducts.length === 0 ? (
            <div className="glass-card rounded-3xl p-12 text-center border border-slate-200 dark:border-slate-800 space-y-3">
              <div className="w-14 h-14 rounded-2xl bg-slate-100 dark:bg-slate-800/80 text-slate-400 flex items-center justify-center mx-auto">
                <Inbox className="w-7 h-7" />
              </div>
              <h4 className="text-sm font-bold text-slate-900 dark:text-white">
                {pendingSearchQuery ? 'Không tìm thấy thiết bị nào phù hợp' : 'Không có sản phẩm nào đang chờ kích hoạt'}
              </h4>
              <p className="text-xs text-slate-500 dark:text-slate-400 max-w-md mx-auto">
                {pendingSearchQuery
                  ? `Không có thiết bị nào khớp với từ khóa "${pendingSearchQuery}". Hãy thử tìm kiếm với số Serial hoặc Model khác.`
                  : 'Toàn bộ thiết bị trong hệ thống đều đã được kích hoạt bảo hành điện tử chính thức. Bạn có thể bấm nút Đăng ký sản phẩm mới để nhập kho thêm thiết bị.'}
              </p>
              <div className="pt-2 flex justify-center gap-3">
                {pendingSearchQuery && (
                  <button
                    type="button"
                    onClick={() => setPendingSearchQuery('')}
                    className="px-4 py-2 rounded-xl bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 dark:hover:bg-slate-700 text-xs font-semibold text-slate-700 dark:text-slate-200 cursor-pointer"
                  >
                    Xóa bộ lọc tìm kiếm
                  </button>
                )}
                <button
                  type="button"
                  onClick={() => setShowRegisterModal(true)}
                  className="px-4 py-2 rounded-xl bg-blue-600 hover:bg-blue-500 text-xs font-bold text-white shadow-md shadow-blue-600/30 cursor-pointer"
                >
                  + Đăng ký thiết bị mới vào kho
                </button>
              </div>
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-5">
              {filteredPendingProducts.map((p) => {
                const isPinRevealed = Boolean(revealedPins[p.serialNumber]);
                return (
                  <div
                    key={p.serialNumber}
                    className="glass-card rounded-3xl p-5 border border-slate-200 dark:border-slate-800 hover:border-amber-500/40 dark:hover:border-amber-500/40 transition-all duration-200 shadow-sm hover:shadow-lg flex flex-col justify-between space-y-4 group bg-white/70 dark:bg-slate-900/70"
                  >
                    {/* Top info */}
                    <div className="space-y-3">
                      <div className="flex items-start justify-between gap-3">
                        <div className="flex items-center gap-3">
                          <img
                            src={p.imageUrl || 'https://images.unsplash.com/photo-1526738549149-8e07eca6c147?auto=format&fit=crop&w=300&q=80'}
                            alt={p.name}
                            className="w-14 h-14 rounded-2xl object-cover border border-slate-200 dark:border-slate-800 shrink-0 bg-slate-100 dark:bg-slate-800"
                          />
                          <div>
                            <h4 className="font-bold text-slate-900 dark:text-white text-sm line-clamp-1 group-hover:text-amber-600 dark:group-hover:text-amber-400 transition-colors">
                              {p.name || p.modelCode}
                            </h4>
                            <div className="text-[11px] text-slate-500 dark:text-slate-400 flex items-center gap-2 mt-0.5">
                              <span className="font-semibold text-slate-700 dark:text-slate-300">{p.brand || 'Chính hãng'}</span>
                              <span>•</span>
                              <span>{p.category || 'Thiết bị'}</span>
                            </div>
                          </div>
                        </div>
                        <span className="shrink-0 text-[10px] font-bold px-2 py-0.5 rounded-full bg-amber-500/15 text-amber-700 dark:text-amber-400 border border-amber-500/30 flex items-center gap-1">
                          <Clock className="w-3 h-3" />
                          Chờ kích hoạt
                        </span>
                      </div>

                      {/* Specs / Meta details */}
                      <div className="p-3 rounded-2xl bg-slate-50 dark:bg-slate-950/70 border border-slate-200 dark:border-slate-800/80 space-y-2 text-xs">
                        <div className="flex items-center justify-between">
                          <span className="text-slate-500 dark:text-slate-400 text-[11px]">Số Serial:</span>
                          <div className="flex items-center gap-1">
                            <span className="font-mono font-bold text-slate-900 dark:text-white text-[11px]">{p.serialNumber}</span>
                            <button
                              type="button"
                              onClick={() => {
                                navigator.clipboard.writeText(p.serialNumber);
                                setCopiedSn(p.serialNumber);
                                setTimeout(() => setCopiedSn(null), 1800);
                              }}
                              className="p-1 rounded hover:bg-slate-200 dark:hover:bg-slate-800 text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 transition cursor-pointer"
                              title="Sao chép Serial"
                            >
                              {copiedSn === p.serialNumber ? <Check className="w-3 h-3 text-emerald-500" /> : <Copy className="w-3 h-3" />}
                            </button>
                          </div>
                        </div>

                        <div className="flex items-center justify-between text-[11px]">
                          <span className="text-slate-500 dark:text-slate-400">Mã Model:</span>
                          <span className="font-mono text-slate-700 dark:text-slate-300">{p.modelCode || 'Tiêu chuẩn'}</span>
                        </div>

                        <div className="flex items-center justify-between text-[11px]">
                          <span className="text-slate-500 dark:text-slate-400">Thời hạn bảo hành:</span>
                          <span className="font-bold text-emerald-600 dark:text-emerald-400">{p.warrantyMonths || p.standardWarrantyMonths || 12} Tháng</span>
                        </div>

                        {/* Secret Scratch PIN Section */}
                        {p.secretPin ? (
                          <div className="pt-1.5 border-t border-slate-200 dark:border-slate-800 flex items-center justify-between gap-2">
                            <div className="flex items-center gap-1.5 text-amber-700 dark:text-amber-400 font-semibold text-[11px]">
                              <Key className="w-3 h-3 shrink-0" />
                              <span>Mã PIN Cào:</span>
                            </div>
                            <div className="flex items-center gap-1">
                              <span className="font-mono font-bold text-amber-600 dark:text-amber-300 text-[11px]">
                                {isPinRevealed ? p.secretPin : 'PIN-••••••'}
                              </span>
                              <button
                                type="button"
                                onClick={() => setRevealedPins(prev => ({ ...prev, [p.serialNumber]: !prev[p.serialNumber] }))}
                                className="p-1 text-slate-400 hover:text-amber-600 dark:hover:text-amber-400 transition cursor-pointer"
                                title={isPinRevealed ? "Ẩn mã PIN" : "Hiện mã PIN cào"}
                              >
                                {isPinRevealed ? <EyeOff className="w-3 h-3" /> : <Eye className="w-3 h-3" />}
                              </button>
                              <button
                                type="button"
                                onClick={() => {
                                  navigator.clipboard.writeText(p.secretPin);
                                  setCopiedPinSerial(p.serialNumber);
                                  setTimeout(() => setCopiedPinSerial(null), 1800);
                                }}
                                className="p-1 text-slate-400 hover:text-amber-600 dark:hover:text-amber-400 transition cursor-pointer"
                                title="Sao chép mã PIN cào"
                              >
                                {copiedPinSerial === p.serialNumber ? <Check className="w-3 h-3 text-emerald-500" /> : <Copy className="w-3 h-3" />}
                              </button>
                            </div>
                          </div>
                        ) : (
                          <div className="pt-1.5 border-t border-slate-200 dark:border-slate-800 text-[10px] text-slate-400 italic">
                            🔒 Tem cào bảo mật dán trên vỏ hộp máy
                          </div>
                        )}
                      </div>
                    </div>

                    {/* Action Button */}
                    <button
                      type="button"
                      onClick={() => handleSelectForActivation(p)}
                      className="w-full py-2.5 px-4 rounded-xl bg-gradient-to-r from-emerald-600 to-teal-600 hover:from-emerald-500 hover:to-teal-500 text-white font-bold text-xs flex items-center justify-center gap-2 shadow-md shadow-emerald-600/20 transition cursor-pointer active:scale-98"
                    >
                      <Zap className="w-3.5 h-3.5" />
                      <span>Kích Hoạt Bảo Hành Ngay</span>
                    </button>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      ) : (

      <div className="space-y-8">
        {/* HÀNG ĐỢI TIẾP NHẬN YÊU CẦU CỦA KHÁCH HÀNG (HỖ TRỢ & BẢO HÀNH) */}
        <div id="seller-rma-queue-section" className="glass-card rounded-3xl p-6 border border-slate-200 dark:border-slate-800 space-y-4 shadow-sm">
          <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 pb-3 border-b border-slate-200 dark:border-slate-800">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-2xl bg-amber-500/10 text-amber-600 dark:text-amber-400 border border-amber-500/20 flex items-center justify-center shrink-0">
                <Inbox className="w-5 h-5" />
              </div>
              <div>
                <h3 className="text-base font-bold text-slate-900 dark:text-white flex items-center gap-2">
                  Hàng Đợi Tiếp Nhận Yêu Cầu Từ Khách Hàng (Hỗ Trợ & Bảo Hành)
                  {pendingRmaTickets.length > 0 && (
                    <span className="text-[10px] px-2 py-0.5 rounded-full bg-amber-500 text-slate-950 font-extrabold animate-pulse">
                      {pendingRmaTickets.length} yêu cầu
                    </span>
                  )}
                </h3>
                <p className="text-xs text-slate-500 dark:text-slate-400">
                  Tiếp nhận phiếu yêu cầu hỗ trợ của khách hàng, tự động điền form và cập nhật trạng thái đơn.
                </p>
              </div>
            </div>

            <div className="flex items-center gap-2">
              <div className="flex p-1 bg-slate-100 dark:bg-slate-900 rounded-xl border border-slate-200 dark:border-slate-800 text-xs">
                <button
                  type="button"
                  onClick={() => setRmaFilter('PENDING')}
                  className={`px-3 py-1 rounded-lg font-bold transition cursor-pointer ${
                    rmaFilter === 'PENDING'
                      ? 'bg-white dark:bg-slate-800 text-amber-600 dark:text-amber-400 shadow-xs'
                      : 'text-slate-500 hover:text-slate-900 dark:text-slate-400 dark:hover:text-white'
                  }`}
                >
                  Chờ tiếp nhận ({pendingRmaTickets.length})
                </button>
                <button
                  type="button"
                  onClick={() => setRmaFilter('ACCEPTED')}
                  className={`px-3 py-1 rounded-lg font-bold transition cursor-pointer ${
                    rmaFilter === 'ACCEPTED'
                      ? 'bg-white dark:bg-slate-800 text-blue-600 dark:text-blue-400 shadow-xs'
                      : 'text-slate-500 hover:text-slate-900 dark:text-slate-400 dark:hover:text-white'
                  }`}
                >
                  Đã tiếp nhận ({acceptedRmaTickets.length})
                </button>
              </div>

              <button
                type="button"
                onClick={fetchRmaQueue}
                disabled={loadingRma}
                className="p-2 rounded-xl bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 dark:hover:bg-slate-700 text-slate-600 dark:text-slate-300 transition cursor-pointer"
                title="Làm mới hàng đợi yêu cầu"
              >
                <RefreshCw className={`w-4 h-4 ${loadingRma ? 'animate-spin' : ''}`} />
              </button>
            </div>
          </div>

          {rmaFilter === 'PENDING' ? (
            pendingRmaTickets.length === 0 ? (
              <div className="p-8 text-center rounded-2xl bg-slate-50/50 dark:bg-slate-950/30 border border-dashed border-slate-200 dark:border-slate-800 space-y-2">
                <Inbox className="w-8 h-8 text-slate-400 mx-auto opacity-50" />
                <p className="text-xs text-slate-500 dark:text-slate-400 font-medium">
                  {activeHandlingTicket
                    ? 'Đơn đang chọn đã được đưa xuống biểu mẫu xử lý bên dưới.'
                    : 'Hiện không có phiếu yêu cầu nào đang chờ tiếp nhận.'}
                </p>
              </div>
            ) : (
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {pendingRmaTickets.map((ticket) => (
                  <div
                    key={ticket.id}
                    className="p-4 rounded-2xl bg-slate-50 dark:bg-slate-950/60 border border-slate-200 dark:border-slate-800/80 hover:border-amber-500/40 transition space-y-3"
                  >
                    <div className="flex items-start justify-between gap-2">
                      <div>
                        <div className="flex items-center gap-2">
                          <span className="font-mono font-bold text-xs text-amber-700 dark:text-amber-400">
                            {ticket.id}
                          </span>
                          <span className="text-[10px] px-2 py-0.5 rounded-full bg-amber-500/15 text-amber-700 dark:text-amber-300 border border-amber-500/30 font-semibold">
                            Chờ tiếp nhận
                          </span>
                        </div>
                        <div className="font-mono font-semibold text-slate-900 dark:text-white text-xs mt-1">
                          Serial: {ticket.serialNumber}
                        </div>
                      </div>

                      <button
                        type="button"
                        onClick={() => handleIntakeTicket(ticket)}
                        className="px-3.5 py-1.5 rounded-xl bg-amber-500 hover:bg-amber-600 text-slate-950 font-bold text-xs flex items-center gap-1.5 shadow-md shadow-amber-500/20 transition cursor-pointer shrink-0"
                      >
                        <Inbox className="w-3.5 h-3.5" />
                        <span>Tiếp nhận yêu cầu</span>
                      </button>
                    </div>

                    <div className="text-xs text-slate-600 dark:text-slate-300 space-y-1 bg-white dark:bg-slate-900 p-2.5 rounded-xl border border-slate-200 dark:border-slate-800">
                      <div>Khách hàng: <strong className="text-slate-900 dark:text-white">{ticket.customerName}</strong></div>
                      {ticket.customerPhone && (
                        <div>SĐT: <span className="font-mono text-slate-700 dark:text-slate-300">{ticket.customerPhone}</span></div>
                      )}
                      {ticket.customerEmail && (
                        <div>Email: <span className="font-mono text-slate-700 dark:text-slate-300">{ticket.customerEmail}</span></div>
                      )}
                      {ticket.defectDescription && (
                        <div className="text-[11px] text-slate-500 dark:text-slate-400 italic pt-1 border-t border-slate-100 dark:border-slate-800">
                          Nội dung: &quot;{ticket.defectDescription}&quot;
                        </div>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            )
          ) : (
            acceptedRmaTickets.length === 0 ? (
              <div className="p-8 text-center rounded-2xl bg-slate-50/50 dark:bg-slate-950/30 border border-dashed border-slate-200 dark:border-slate-800 space-y-2">
                <CheckCircle2 className="w-8 h-8 text-emerald-400 mx-auto opacity-50" />
                <p className="text-xs text-slate-500 dark:text-slate-400 font-medium">
                  Chưa có phiếu nào đã tiếp nhận.
                </p>
              </div>
            ) : (
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {acceptedRmaTickets.map((ticket) => (
                  <div
                    key={ticket.id}
                    className="p-4 rounded-2xl bg-slate-50 dark:bg-slate-950/60 border border-slate-200 dark:border-slate-800/80 space-y-2"
                  >
                    <div className="flex items-center justify-between gap-2">
                      <span className="font-mono font-bold text-xs text-blue-700 dark:text-blue-400">
                        {ticket.id}
                      </span>
                      <span className="text-[10px] px-2 py-0.5 rounded-full bg-emerald-500/15 text-emerald-700 dark:text-emerald-300 border border-emerald-500/30 font-semibold flex items-center gap-1">
                        <CheckCircle2 className="w-3 h-3" />
                        Đã tiếp nhận
                      </span>
                    </div>
                    <div className="text-xs text-slate-600 dark:text-slate-300 space-y-0.5">
                      <div>Thiết bị: <strong className="font-mono text-slate-900 dark:text-white">{ticket.serialNumber}</strong></div>
                      <div>Khách hàng: <strong>{ticket.customerName}</strong> ({ticket.customerPhone || ticket.customerEmail})</div>
                      {ticket.technicianNotes && (
                        <div className="text-[11px] text-slate-500 dark:text-slate-400 italic">
                          Ghi chú: {ticket.technicianNotes}
                        </div>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            )
          )}
        </div>

        <div className="grid grid-cols-1 xl:grid-cols-12 gap-6">
          
          {/* Form 1: Kích hoạt bảo hành máy mới (7 cols on xl) */}
          <div id="activation-form-section" className="xl:col-span-7 glass-card rounded-3xl p-5 sm:p-6 border border-slate-200 dark:border-slate-800 space-y-5 scroll-mt-24">
            <h3 className="text-sm font-bold text-slate-900 dark:text-white flex items-center gap-2 pb-3 border-b border-slate-200 dark:border-slate-800">
              <PackageCheck className="w-4 h-4 text-emerald-500 dark:text-emerald-400" />
              1. Kích hoạt Bảo hành Bàn giao Thiết bị Mới
            </h3>

            {/* Active Handling Ticket Banner */}
            {activeHandlingTicket && (
              <div className="p-4 rounded-2xl bg-amber-500/10 border-2 border-amber-500/40 text-amber-900 dark:text-amber-200 text-xs space-y-3 animate-fade-in shadow-md">
                <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3">
                  <div className="space-y-1">
                    <div className="flex items-center gap-2">
                      <span className="px-2 py-0.5 rounded-full bg-amber-500 text-slate-950 font-extrabold text-[10px] uppercase">
                        Đang xử lý tiếp nhận
                      </span>
                      <span className="font-mono font-bold text-xs text-slate-900 dark:text-white">
                        {activeHandlingTicket.id}
                      </span>
                    </div>
                    <p className="text-slate-700 dark:text-slate-300 text-xs">
                      Thiết bị: <strong className="font-mono text-slate-900 dark:text-white">{activeHandlingTicket.serialNumber}</strong> | Khách hàng: <strong>{activeHandlingTicket.customerName}</strong> ({activeHandlingTicket.customerPhone || activeHandlingTicket.customerEmail})
                    </p>
                    {activeHandlingTicket.defectDescription && (
                      <p className="text-[11px] text-slate-500 dark:text-slate-400 italic">
                        Nội dung yêu cầu: &quot;{activeHandlingTicket.defectDescription}&quot;
                      </p>
                    )}
                  </div>

                  <div className="flex flex-wrap items-center gap-2">
                    <button
                      type="button"
                      onClick={handleCompleteIntake}
                      className="px-3.5 py-2 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white font-bold text-xs flex items-center gap-1.5 shadow-md shadow-emerald-600/20 transition cursor-pointer"
                      title="Xác nhận tiếp nhận thành công (chuyển trạng thái sang Đã tiếp nhận)"
                    >
                      <CheckCircle2 className="w-3.5 h-3.5" />
                      <span>Xử lý tiếp nhận xong (Đã tiếp nhận)</span>
                    </button>

                    <button
                      type="button"
                      onClick={handleCancelIntake}
                      className="px-3 py-2 rounded-xl bg-slate-200 hover:bg-slate-300 dark:bg-slate-800 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-300 font-bold text-xs flex items-center gap-1.5 transition cursor-pointer"
                      title="Hủy tiếp nhận và khôi phục phiếu trở lại danh sách chờ"
                    >
                      <X className="w-3.5 h-3.5" />
                      <span>Hủy & Khôi phục đơn</span>
                    </button>
                  </div>
                </div>
              </div>
            )}

          {quickActivateNotice && (
            <div className="p-3.5 rounded-2xl bg-blue-500/10 border border-blue-500/30 text-blue-700 dark:text-blue-300 text-xs flex items-center justify-between gap-2 animate-fade-in">
              <div className="flex items-center gap-2 font-medium">
                <Zap className="w-4 h-4 text-blue-500 shrink-0" />
                <span>{quickActivateNotice}</span>
              </div>
              <button
                type="button"
                onClick={() => setQuickActivateNotice(null)}
                className="text-blue-500 hover:text-blue-700 p-1 rounded-lg hover:bg-blue-500/20 transition cursor-pointer"
              >
                <X className="w-3.5 h-3.5" />
              </button>
            </div>
          )}

          {/* Real-time MetaMask Transaction Status Indicator */}
          {loading && txProgress && (
            <div className={`p-4 rounded-2xl border text-xs flex items-center gap-3 transition-all duration-300 animate-fade-in ${
              txProgress.step === 'CONFIRMED'
                ? 'bg-emerald-500/15 border-emerald-500/40 text-emerald-800 dark:text-emerald-300'
                : txProgress.step === 'FAILED'
                ? 'bg-rose-500/15 border-rose-500/40 text-rose-800 dark:text-rose-300'
                : 'bg-emerald-500/10 border-emerald-500/30 text-emerald-800 dark:text-emerald-300 animate-pulse'
            }`}>
              <div className="w-5 h-5 rounded-full border-2 border-current border-t-transparent animate-spin shrink-0" />
              <div className="flex-1">
                <div className="font-bold flex items-center gap-1.5 text-sm">
                  <span>🦊 MetaMask:</span>
                  <span>{txProgress.message}</span>
                </div>
                <p className="text-[11px] opacity-80 mt-0.5">
                  {txProgress.step === 'AWAITING_SIGNATURE' && 'Cửa sổ MetaMask đang mở. Vui lòng bấm "Xác nhận" để ký giao dịch kích hoạt.'}
                  {txProgress.step === 'MINING' && 'Giao dịch đã được phát lên mạng Blockchain. Đang chờ xác nhận khối...'}
                  {txProgress.step === 'CONFIRMED' && 'MetaMask đã xác nhận kích hoạt thành công! Đang hoàn tất chứng nhận...'}
                  {txProgress.step === 'FAILED' && 'Giao dịch đã bị từ chối hoặc gặp lỗi từ ví MetaMask.'}
                </p>
              </div>
            </div>
          )}

          {errorMsg && (
            <div className="p-3.5 rounded-xl bg-rose-500/10 border border-rose-500/30 text-rose-600 dark:text-rose-400 text-xs flex items-center gap-2">
              <AlertTriangle className="w-4 h-4 shrink-0" />
              <span>{errorMsg}</span>
            </div>
          )}

          {successInfo && (
            <div className="p-4 rounded-xl bg-emerald-500/10 border border-emerald-500/30 text-emerald-700 dark:text-emerald-400 text-xs space-y-2.5">
              <div className="flex items-center gap-2 font-bold text-sm">
                <CheckCircle2 className="w-4 h-4" />
                Đã kích hoạt bảo hành cho sản phẩm {successInfo.serial}!
              </div>
              <div className="font-mono text-[11px] text-slate-600 dark:text-slate-300">
                Tx Hash: <span className="text-emerald-700 dark:text-emerald-300">{successInfo.txHash}</span>
              </div>
              {emailStatus && (
                <div className="p-2 rounded-lg bg-blue-500/10 border border-blue-500/20 text-blue-700 dark:text-blue-300 text-[11px] flex items-center gap-1.5">
                  <Mail className="w-3.5 h-3.5 text-blue-500 dark:text-blue-400 shrink-0" />
                  <span>{emailStatus}</span>
                </div>
              )}
              <div className="pt-1 flex items-center gap-2">
                <button
                  type="button"
                  onClick={() => setShowCertModal(true)}
                  className="px-3.5 py-1.5 rounded-lg bg-amber-500/20 hover:bg-amber-500/30 text-amber-800 dark:text-amber-300 border border-amber-500/40 text-xs font-bold flex items-center gap-1.5 transition cursor-pointer shadow-xs"
                >
                  <FileText className="w-3.5 h-3.5" />
                  <span>Xem & Tải Giấy Chứng Nhận PDF (A4)</span>
                </button>
              </div>
            </div>
          )}

          <form onSubmit={handleActivate} className="space-y-4 text-xs">
            {/* BƯỚC 1: SỐ ĐIỆN THOẠI / EMAIL / VÍ KHÁCH HÀNG (ĐƯA LÊN ĐẦU TIÊN) */}
            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <label className="text-slate-700 dark:text-slate-300 font-semibold flex items-center gap-1.5 text-xs">
                  <Phone className="w-3.5 h-3.5 text-emerald-500" />
                  <span>1. Số Điện Thoại / Email / Ví Khách Hàng (*)</span>
                </label>
                <span className="text-[10px] text-slate-500 dark:text-slate-400">
                  📱 Nhập SĐT (10 số), Email hoặc ví 0x...
                </span>
              </div>
              
              <div className="relative">
                <input
                  type="text"
                  required
                  value={customerIdentifier}
                  onChange={(e) => {
                    const val = e.target.value;
                    setCustomerIdentifier(val);
                    if (val.startsWith('0x') && val.length === 42) {
                      setCustomerAddress(val);
                    }
                  }}
                  placeholder="Nhập SĐT khách hàng (VD: 0987654313, 0367833013) hoặc Email..."
                  className="w-full px-3.5 py-2.5 rounded-xl bg-white dark:bg-slate-950 border border-slate-300 dark:border-slate-800 text-slate-900 dark:text-white font-mono text-xs focus:border-emerald-500 focus:outline-none placeholder:text-slate-400 dark:placeholder:text-slate-500 pr-10"
                />
                {isResolvingWallet && (
                  <div className="absolute right-3 top-1/2 -translate-y-1/2">
                    <div className="w-4 h-4 border-2 border-emerald-500 border-t-transparent rounded-full animate-spin" />
                  </div>
                )}
              </div>

              {/* Danh sách ứng viên hoặc Thông tin khách hàng nhận diện được */}
              {resolvedWallet && resolvedWallet.user ? (
                <div 
                  onClick={() => handleSelectCustomer(resolvedWallet.user)}
                  className="p-3.5 rounded-2xl bg-gradient-to-r from-emerald-500/10 via-teal-500/10 to-blue-500/10 border-2 border-emerald-500/50 hover:border-emerald-500 text-slate-900 dark:text-white text-xs space-y-2 cursor-pointer transition-all duration-200 shadow-xs hover:shadow-md hover:scale-[1.008] group animate-fade-in"
                  title="Nhấp vào để chọn khách hàng này & tự động điền Email bên dưới"
                >
                  <div className="flex items-center justify-between gap-3">
                    <div className="flex items-center gap-3">
                      <div className="w-9 h-9 rounded-xl bg-emerald-500/20 text-emerald-600 dark:text-emerald-400 flex items-center justify-center font-bold text-sm shrink-0 border border-emerald-500/30">
                        {resolvedWallet.user.fullName?.charAt(0) || '👤'}
                      </div>
                      <div>
                        <div className="font-bold text-slate-900 dark:text-white flex items-center gap-2">
                          <span className="text-sm">{resolvedWallet.user.fullName || resolvedWallet.user.username}</span>
                          <span className="text-[10px] px-2 py-0.5 rounded-full bg-emerald-500/20 text-emerald-700 dark:text-emerald-300 font-bold border border-emerald-500/30">
                            ✓ Khách hàng hệ thống
                          </span>
                        </div>
                        <div className="text-[11px] text-slate-500 dark:text-slate-400 flex flex-wrap items-center gap-2.5 mt-0.5">
                          {resolvedWallet.user.phone && (
                            <span className="flex items-center gap-1 font-mono text-slate-700 dark:text-slate-300">
                              <Phone className="w-3 h-3 text-blue-500" />
                              {resolvedWallet.user.phone}
                            </span>
                          )}
                          {resolvedWallet.user.email && (
                            <span className="flex items-center gap-1 font-mono text-emerald-600 dark:text-emerald-400 font-semibold">
                              <Mail className="w-3 h-3 text-emerald-500" />
                              {resolvedWallet.user.email}
                            </span>
                          )}
                        </div>
                      </div>
                    </div>

                    <button
                      type="button"
                      onClick={(e) => {
                        e.stopPropagation();
                        handleSelectCustomer(resolvedWallet.user);
                      }}
                      className="px-3.5 py-2 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white font-bold text-[11px] flex items-center gap-1.5 shadow-md shadow-emerald-600/25 transition cursor-pointer shrink-0 active:scale-95"
                    >
                      <Check className="w-3.5 h-3.5" />
                      <span>Chọn Khách Hàng Này</span>
                    </button>
                  </div>

                  <div className="pt-2 border-t border-emerald-500/20 flex flex-wrap items-center justify-between gap-2 text-[11px]">
                    <div className="flex items-center gap-1 font-mono text-slate-600 dark:text-slate-400">
                      <span>Ví On-Chain liên kết:</span>
                      <span className="text-slate-900 dark:text-white font-bold">{resolvedWallet.walletAddress}</span>
                    </div>
                    <span className="text-emerald-700 dark:text-emerald-400 font-medium text-[10px] flex items-center gap-1">
                      <Sparkles className="w-3 h-3" />
                      Nhấp vào để tự động điền Email vào ô bên dưới
                    </span>
                  </div>
                </div>
              ) : resolvedWallet && resolvedWallet.isAutoDerived ? (
                <div className="p-3 rounded-2xl bg-blue-500/10 border border-blue-500/30 text-blue-800 dark:text-blue-300 text-xs space-y-1 animate-fade-in">
                  <div className="flex items-center justify-between">
                    <span className="font-bold flex items-center gap-1.5">
                      <UserCheck className="w-4 h-4 text-blue-500 shrink-0" />
                      Khách hàng mới (chưa có tài khoản Web)
                    </span>
                    <span className="text-[10px] px-2 py-0.5 rounded bg-blue-500/20 text-blue-700 dark:text-blue-300 font-bold">
                      ✓ Đã cấp ví bảo mật MPC
                    </span>
                  </div>
                  <div className="text-[11px] text-slate-600 dark:text-slate-400 font-mono">
                    Ví On-Chain định danh theo SĐT: <strong className="text-slate-900 dark:text-white">{resolvedWallet.walletAddress}</strong>
                  </div>
                </div>
              ) : null}

              {resolveError && customerIdentifier.trim() && (
                <div className="p-2.5 rounded-xl bg-amber-500/10 border border-amber-500/30 text-amber-700 dark:text-amber-300 text-xs flex items-center gap-2">
                  <AlertTriangle className="w-3.5 h-3.5 shrink-0" />
                  <span>{resolveError}</span>
                </div>
              )}
            </div>

            {/* BƯỚC 2: CHỌN SẢN PHẨM CẦN KÍCH HOẠT */}
            <div className="space-y-1.5">
              <div className="flex justify-between items-center mb-1">
                <label className="text-slate-700 dark:text-slate-300 font-semibold flex items-center gap-1.5">
                  <PackageCheck className="w-3.5 h-3.5 text-blue-500" />
                  <span>2. Chọn Sản Phẩm Cần Kích Hoạt (*)</span>
                </label>
                <button
                  type="button"
                  onClick={() => {
                    setQrTarget('activate');
                    setShowQrModal(true);
                  }}
                  className="text-[11px] text-emerald-600 dark:text-emerald-400 hover:text-emerald-700 dark:hover:text-emerald-300 font-bold flex items-center gap-1 cursor-pointer"
                  title="Mở camera quét mã QR trên vỏ hộp để tự động chọn"
                >
                  <Camera className="w-3.5 h-3.5 text-emerald-500" />
                  <span>Quét QR tem hộp</span>
                </button>
              </div>

              {pendingProducts.length > 0 ? (
                <select
                  value={selectedSerial}
                  onChange={(e) => {
                    const val = e.target.value;
                    setSelectedSerial(val);
                    const prod = (allProducts || []).find((p) => p.serialNumber.toLowerCase() === val.toLowerCase());
                    if (prod && prod.secretPin) {
                      setActivationPin(prod.secretPin);
                    }
                  }}
                  className="w-full px-3 py-2.5 rounded-xl bg-white dark:bg-slate-950 border border-slate-300 dark:border-slate-800 text-slate-900 dark:text-white font-mono focus:border-emerald-500 focus:outline-none"
                >
                  <option value="">-- Chọn sản phẩm trong kho cần kích hoạt --</option>
                  {pendingProducts.map((p) => (
                    <option key={p.serialNumber} value={p.serialNumber}>
                      {p.serialNumber} - {p.name || p.modelCode} ({p.warrantyMonths || 12} Tháng)
                    </option>
                  ))}
                </select>
              ) : (
                <div className="p-3 rounded-xl bg-slate-100 dark:bg-slate-950/60 border border-slate-200 dark:border-slate-800 text-slate-600 dark:text-slate-400 text-xs">
                  Hiện không có sản phẩm nào ở trạng thái chờ kích hoạt. Hãy sang tab Nhà sản xuất để đăng ký thiết bị mới.
                </div>
              )}
            </div>

            {/* BƯỚC 3: MÃ PIN CÀO BẢO MẬT VẬT LÝ */}
            <div>
              <div className="flex justify-between items-center mb-1">
                <label className="text-slate-700 dark:text-slate-300 font-semibold flex items-center gap-1">
                  <Key className="w-3.5 h-3.5 text-amber-500 dark:text-amber-400" />
                  3. Mã PIN Cào Bảo Mật Vật Lý (*)
                </label>
              </div>
              <input
                type="text"
                required
                value={activationPin}
                onChange={(e) => setActivationPin(e.target.value)}
                placeholder="Nhập mã PIN cào từ vỏ hộp thiết bị (tự điền nếu hệ thống có sẵn)..."
                className="w-full px-3 py-2 rounded-xl bg-white dark:bg-slate-950 border border-slate-300 dark:border-slate-800 text-amber-700 dark:text-yellow-300 font-mono text-xs focus:border-amber-500 focus:outline-none placeholder:text-slate-400 dark:placeholder:text-slate-500"
              />
              <span className="text-[10px] text-slate-500 dark:text-slate-400 block mt-0.5">
                🔒 Chống sao chép số Serial từ xa: Yêu cầu cào lớp phủ bạc trên tem niêm phong vật lý của hộp thiết bị.
              </span>
            </div>

            {/* Email Notification */}
            <div className="space-y-1">
              <div className="flex items-center justify-between">
                <label className="text-slate-700 dark:text-slate-300 font-semibold flex items-center gap-1.5 text-xs">
                  <Mail className="w-3.5 h-3.5 text-blue-500 dark:text-blue-400" />
                  <span>Địa Chỉ Gmail Khách Hàng (Tự Động Gửi Biên Nhận)</span>
                </label>
                {emailAutoFilled && (
                  <span className="text-[10px] px-2 py-0.5 rounded-full bg-emerald-500/20 text-emerald-700 dark:text-emerald-300 font-bold animate-pulse flex items-center gap-1 border border-emerald-500/30">
                    <Check className="w-3 h-3" />
                    Đã tự động điền từ tài khoản khách hàng!
                  </span>
                )}
              </div>
              <div className="relative">
                <input
                  type="email"
                  value={customerEmail}
                  onChange={(e) => {
                    setCustomerEmail(e.target.value);
                    setEmailAutoFilled(false);
                  }}
                  placeholder="VD: 42tuana2k46@gmail.com"
                  className={`w-full px-3.5 py-2.5 rounded-xl bg-white dark:bg-slate-950 border text-slate-900 dark:text-white font-mono text-xs focus:outline-none transition-all duration-300 ${
                    emailAutoFilled
                      ? 'border-emerald-500 ring-2 ring-emerald-500/20 bg-emerald-50/20 dark:bg-emerald-950/20'
                      : 'border-slate-300 dark:border-slate-800 focus:border-blue-500'
                  }`}
                />
              </div>
              <span className="text-[10px] text-slate-500 dark:text-slate-400 block mt-0.5">
                📧 Hệ thống sẽ gửi email xác nhận tức thì kèm đường link tra cứu chứng nhận điện tử.
              </span>
            </div>

            {!isMetaMaskConnected ? (
              <button
                type="button"
                onClick={onConnectMetaMask}
                className="w-full py-3 rounded-xl font-bold tracking-wide transition flex items-center justify-center gap-2 bg-gradient-to-r from-orange-500 to-amber-600 hover:from-orange-600 hover:to-amber-700 text-white shadow-lg shadow-orange-500/25 cursor-pointer active:scale-98"
              >
                <Wallet className="w-4 h-4" />
                <span>🦊 Kết Nối Ví MetaMask Để Kích Hoạt</span>
              </button>
            ) : (
              <button
                type="submit"
                disabled={loading || !selectedSerial}
                className="w-full py-3 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white font-bold tracking-wide transition flex items-center justify-center gap-2 shadow-lg shadow-emerald-600/30 cursor-pointer disabled:opacity-50"
              >
                {loading ? (
                  <>
                    <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
                    <span>{txProgress?.message || 'Đang thực hiện giao dịch...'}</span>
                  </>
                ) : (
                  <>
                    <ShieldCheck className="w-4 h-4" />
                    <span>Ký số & Kích hoạt Bảo hành On-Chain (MetaMask)</span>
                  </>
                )}
              </button>
            )}
          </form>
        </div>

        {/* Form 2: Gói gia hạn bảo hành mở rộng (5 cols on xl) */}
        <div className="xl:col-span-5 glass-card rounded-3xl p-5 sm:p-6 border border-slate-200 dark:border-slate-800 space-y-5">
          <h3 className="text-sm font-bold text-slate-900 dark:text-white flex items-center gap-2 pb-3 border-b border-slate-200 dark:border-slate-800">
            <Sparkles className="w-4 h-4 text-amber-500 dark:text-amber-400" />
            2. Gia hạn Gói Bảo hành Mở rộng (AppleCare+)
          </h3>

          {/* Real-time MetaMask Transaction Status Indicator */}
          {extendLoading && extendTxProgress && (
            <div className={`p-4 rounded-2xl border text-xs flex items-center gap-3 transition-all duration-300 animate-fade-in ${
              extendTxProgress.step === 'CONFIRMED'
                ? 'bg-emerald-500/15 border-emerald-500/40 text-emerald-800 dark:text-emerald-300'
                : extendTxProgress.step === 'FAILED'
                ? 'bg-rose-500/15 border-rose-500/40 text-rose-800 dark:text-rose-300'
                : 'bg-amber-500/10 border-amber-500/30 text-amber-800 dark:text-amber-300 animate-pulse'
            }`}>
              <div className="w-5 h-5 rounded-full border-2 border-current border-t-transparent animate-spin shrink-0" />
              <div className="flex-1">
                <div className="font-bold flex items-center gap-1.5 text-sm">
                  <span>🦊 MetaMask:</span>
                  <span>{extendTxProgress.message}</span>
                </div>
                <p className="text-[11px] opacity-80 mt-0.5">
                  {extendTxProgress.step === 'AWAITING_SIGNATURE' && 'Cửa sổ MetaMask đang mở. Vui lòng bấm "Xác nhận" để ký gia hạn bảo hành.'}
                  {extendTxProgress.step === 'MINING' && 'Giao dịch đã được phát lên mạng Blockchain. Đang chờ xác nhận khối...'}
                  {extendTxProgress.step === 'CONFIRMED' && 'MetaMask đã xác nhận gia hạn thành công!'}
                  {extendTxProgress.step === 'FAILED' && 'Giao dịch đã bị từ chối hoặc gặp lỗi từ ví MetaMask.'}
                </p>
              </div>
            </div>
          )}

          {extendError && (
            <div className="p-3.5 rounded-xl bg-rose-500/10 border border-rose-500/30 text-rose-600 dark:text-rose-400 text-xs">
              {extendError}
            </div>
          )}

          {extendSuccess && (
            <div className="p-4 rounded-xl bg-amber-500/10 border border-amber-500/30 text-amber-700 dark:text-amber-400 text-xs space-y-1">
              <div className="font-bold flex items-center gap-1.5">
                <CheckCircle2 className="w-4 h-4" />
                Đã gia hạn thành công +{extendSuccess.months} tháng!
              </div>
              <div className="text-[11px] text-slate-600 dark:text-slate-300 font-mono">
                Tx: {extendSuccess.txHash.slice(0, 16)}...
              </div>
            </div>
          )}

          <form onSubmit={handleExtend} className="space-y-4 text-xs">
            <div>
              <label className="block text-slate-700 dark:text-slate-300 mb-1 font-semibold">Chọn thiết bị cần gia hạn (*)</label>
              <select
                value={extendSerial}
                onChange={(e) => setExtendSerial(e.target.value)}
                className="w-full px-3 py-2.5 rounded-xl bg-white dark:bg-slate-950 border border-slate-300 dark:border-slate-800 text-slate-900 dark:text-white font-mono focus:border-amber-500 focus:outline-none"
              >
                <option value="">-- Chọn thiết bị đang hoạt động --</option>
                {activeOrExpiredProducts.map((p) => (
                  <option key={p.serialNumber} value={p.serialNumber}>
                    {p.serialNumber} ({p.name || p.modelCode})
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label className="block text-slate-700 dark:text-slate-300 mb-1 font-semibold">Gói thời gian gia hạn</label>
              <div className="grid grid-cols-3 gap-2">
                {[
                  { m: 6, l: '+6 Tháng' },
                  { m: 12, l: '+12 Tháng' },
                  { m: 24, l: '+24 Tháng' },
                ].map((pkg) => (
                  <button
                    key={pkg.m}
                    type="button"
                    onClick={() => setAdditionalMonths(pkg.m)}
                    className={`py-2 rounded-xl font-bold border transition cursor-pointer ${
                      additionalMonths === pkg.m
                        ? 'bg-amber-500/20 text-amber-700 dark:text-amber-300 border-amber-500/40 shadow-xs'
                        : 'bg-white dark:bg-slate-950 text-slate-600 dark:text-slate-400 border-slate-300 dark:border-slate-800 hover:text-slate-900 dark:hover:text-white'
                    }`}
                  >
                    {pkg.l}
                  </button>
                ))}
              </div>
            </div>

            <div className="p-3 rounded-xl bg-slate-100 dark:bg-slate-950/60 border border-slate-200 dark:border-slate-800 text-slate-600 dark:text-slate-400 text-[11px]">
              Thời hạn bảo hành mới được cộng dồn trực tiếp vào <code className="text-amber-600 dark:text-amber-400 font-mono">expiryDate</code> trên Smart Contract và phát ra event <code className="text-amber-600 dark:text-amber-400 font-mono">WarrantyExtended</code>.
            </div>

            {!isMetaMaskConnected ? (
              <button
                type="button"
                onClick={onConnectMetaMask}
                className="w-full py-3 rounded-xl font-bold tracking-wide transition flex items-center justify-center gap-2 bg-gradient-to-r from-orange-500 to-amber-600 hover:from-orange-600 hover:to-amber-700 text-white shadow-lg shadow-orange-500/25 cursor-pointer active:scale-98"
              >
                <Wallet className="w-4 h-4" />
                <span>🦊 Kết Nối MetaMask Để Gia Hạn</span>
              </button>
            ) : (
              <button
                type="submit"
                disabled={extendLoading || !extendSerial}
                className="w-full py-3 rounded-xl bg-amber-600 hover:bg-amber-500 text-white font-bold transition flex items-center justify-center gap-2 shadow-lg shadow-amber-600/30 cursor-pointer disabled:opacity-50"
              >
                {extendLoading ? (
                  <>
                    <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
                    <span>{extendTxProgress?.message || 'Đang gia hạn qua MetaMask...'}</span>
                  </>
                ) : (
                  <>
                    <Plus className="w-4 h-4" />
                    <span>Ký số & Gia hạn +${additionalMonths} Tháng (MetaMask)</span>
                  </>
                )}
              </button>
            )}
          </form>
        </div>

        </div>
      </div>
      )}

      {/* MODAL: ĐĂNG KÝ SẢN PHẨM MỚI VÀO KHO (Dành cho Đại lý bán lẻ) */}
      {showRegisterModal && typeof document !== 'undefined' && ReactDOM.createPortal(
        <div className="fixed inset-0 z-[99999] bg-black/70 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="w-full max-w-lg bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-3xl p-6 shadow-2xl space-y-4 animate-fade-in relative text-slate-900 dark:text-white">
            <div className="flex items-center justify-between pb-3 border-b border-slate-200 dark:border-slate-800">
              <div className="flex items-center gap-2">
                <PackagePlus className="w-5 h-5 text-blue-500 dark:text-blue-400" />
                <h3 className="font-bold text-slate-900 dark:text-white text-base">Đăng Ký Thiết Bị Mới Vào Kho (On-Chain)</h3>
              </div>
              <button
                type="button"
                onClick={() => setShowRegisterModal(false)}
                className="text-slate-400 hover:text-slate-700 dark:hover:text-white p-1 rounded-lg hover:bg-slate-100 dark:hover:bg-slate-800 transition cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Yêu cầu kết nối ví MetaMask */}
            {!isMetaMaskConnected ? (
              <div className="p-3 rounded-xl bg-amber-500/10 border border-amber-500/30 flex items-center justify-between gap-2 text-amber-800 dark:text-amber-300 text-xs">
                <div className="flex items-center gap-2">
                  <AlertTriangle className="w-4 h-4 text-amber-500 dark:text-amber-400 shrink-0" />
                  <span>Yêu cầu kết nối ví MetaMask để có thể lưu sản phẩm lên Blockchain.</span>
                </div>
                {onConnectMetaMask && (
                  <button
                    type="button"
                    onClick={onConnectMetaMask}
                    className="px-2.5 py-1 rounded-lg bg-orange-500 hover:bg-orange-600 text-white font-bold text-[11px] flex items-center gap-1 shrink-0 cursor-pointer"
                  >
                    <Wallet className="w-3 h-3" />
                    <span>Kết nối</span>
                  </button>
                )}
              </div>
            ) : (
              <div className="p-2.5 rounded-xl bg-emerald-500/10 border border-emerald-500/30 flex items-center gap-2 text-emerald-800 dark:text-emerald-300 text-xs">
                <CheckCircle2 className="w-4 h-4 text-emerald-500 dark:text-emerald-400 shrink-0" />
                <span>Ví ký On-Chain: <span className="font-mono font-bold text-slate-900 dark:text-white">{metaMaskAddress}</span></span>
              </div>
            )}

            {/* Real-time MetaMask Transaction Status Indicator */}
            {registerLoading && registerTxProgress && (
              <div className={`p-4 rounded-2xl border text-xs flex items-center gap-3 transition-all duration-300 animate-fade-in ${
                registerTxProgress.step === 'CONFIRMED'
                  ? 'bg-emerald-500/15 border-emerald-500/40 text-emerald-800 dark:text-emerald-300'
                  : registerTxProgress.step === 'FAILED'
                  ? 'bg-rose-500/15 border-rose-500/40 text-rose-800 dark:text-rose-300'
                  : 'bg-blue-500/10 border-blue-500/30 text-blue-800 dark:text-blue-300 animate-pulse'
              }`}>
                <div className="w-5 h-5 rounded-full border-2 border-current border-t-transparent animate-spin shrink-0" />
                <div className="flex-1">
                  <div className="font-bold flex items-center gap-1.5 text-sm">
                    <span>🦊 MetaMask:</span>
                    <span>{registerTxProgress.message}</span>
                  </div>
                  <p className="text-[11px] opacity-80 mt-0.5">
                    {registerTxProgress.step === 'AWAITING_SIGNATURE' && 'Cửa sổ MetaMask đang mở. Vui lòng bấm "Xác nhận" để ký lưu thiết bị.'}
                    {registerTxProgress.step === 'MINING' && 'Giao dịch đã được phát lên mạng Blockchain. Đang chờ xác nhận khối...'}
                    {registerTxProgress.step === 'CONFIRMED' && 'MetaMask đã xác nhận đăng ký thành công!'}
                    {registerTxProgress.step === 'FAILED' && 'Giao dịch đã bị từ chối hoặc gặp lỗi từ ví MetaMask.'}
                  </p>
                </div>
              </div>
            )}

            {registerError && (
              <div className="p-3 rounded-xl bg-rose-500/10 border border-rose-500/30 text-rose-600 dark:text-rose-400 text-xs flex items-center gap-2">
                <AlertTriangle className="w-4 h-4 shrink-0" />
                <span>{registerError}</span>
              </div>
            )}

            <form onSubmit={handleRegisterProduct} className="space-y-3.5 text-xs">
              <div>
                <div className="flex items-center justify-between mb-1">
                  <label className="text-slate-700 dark:text-slate-300 font-semibold">Số Serial (*)</label>
                  <button
                    type="button"
                    onClick={() => {
                      setQrTarget('register');
                      setShowQrModal(true);
                    }}
                    className="text-[11px] text-blue-600 dark:text-blue-400 hover:text-blue-500 font-bold flex items-center gap-1 cursor-pointer"
                    title="Quét barcode / QR trên tem máy"
                  >
                    <Camera className="w-3.5 h-3.5" />
                    <span>Quét Barcode / QR</span>
                  </button>
                </div>
              </div>
              <input
                type="text"
                required
                value={newProdData.serialNumber}
                onChange={(e) => setNewProdData({ ...newProdData, serialNumber: e.target.value })}
                placeholder="VD: SN-SMS-RTL-8821"
                className="w-full px-3 py-2 rounded-xl bg-white dark:bg-slate-950 border border-slate-300 dark:border-slate-800 text-slate-900 dark:text-white font-mono focus:border-blue-500 focus:outline-none placeholder:text-slate-400 dark:placeholder:text-slate-500"
              />

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-slate-700 dark:text-slate-300 mb-1 font-semibold">Tên sản phẩm (*)</label>
                  <input
                    type="text"
                    required
                    value={newProdData.name}
                    onChange={(e) => setNewProdData({ ...newProdData, name: e.target.value })}
                    placeholder="VD: Galaxy S24 Ultra"
                    className="w-full px-3 py-2 rounded-xl bg-white dark:bg-slate-950 border border-slate-300 dark:border-slate-800 text-slate-900 dark:text-white focus:border-blue-500 focus:outline-none placeholder:text-slate-400 dark:placeholder:text-slate-500"
                  />
                </div>
                <div>
                  <label className="block text-slate-700 dark:text-slate-300 mb-1 font-semibold">Hãng sản xuất</label>
                  <input
                    type="text"
                    value={newProdData.brand}
                    onChange={(e) => setNewProdData({ ...newProdData, brand: e.target.value })}
                    placeholder="VD: Samsung"
                    className="w-full px-3 py-2 rounded-xl bg-white dark:bg-slate-950 border border-slate-300 dark:border-slate-800 text-slate-900 dark:text-white focus:border-blue-500 focus:outline-none placeholder:text-slate-400 dark:placeholder:text-slate-500"
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-slate-700 dark:text-slate-300 mb-1 font-semibold">Mã Model</label>
                  <input
                    type="text"
                    value={newProdData.modelCode}
                    onChange={(e) => setNewProdData({ ...newProdData, modelCode: e.target.value })}
                    placeholder="VD: MOD-SMS-01"
                    className="w-full px-3 py-2 rounded-xl bg-white dark:bg-slate-950 border border-slate-300 dark:border-slate-800 text-slate-900 dark:text-white focus:border-blue-500 focus:outline-none placeholder:text-slate-400 dark:placeholder:text-slate-500"
                  />
                </div>
                <div>
                  <label className="block text-slate-700 dark:text-slate-300 mb-1 font-semibold">Thời hạn BH (tháng)</label>
                  <input
                    type="number"
                    min="1"
                    max="60"
                    value={newProdData.standardWarrantyMonths}
                    onChange={(e) => setNewProdData({ ...newProdData, standardWarrantyMonths: Number(e.target.value) })}
                    className="w-full px-3 py-2 rounded-xl bg-white dark:bg-slate-950 border border-slate-300 dark:border-slate-800 text-slate-900 dark:text-white focus:border-blue-500 focus:outline-none"
                  />
                </div>
              </div>

              <div className="pt-2 flex justify-end gap-2">
                <button
                  type="button"
                  onClick={() => setShowRegisterModal(false)}
                  className="px-4 py-2 rounded-xl bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-300 font-semibold cursor-pointer"
                >
                  Hủy
                </button>
                <button
                  type="submit"
                  disabled={registerLoading}
                  className={`px-5 py-2.5 rounded-xl text-white font-bold shadow-lg cursor-pointer disabled:opacity-50 flex items-center gap-2 ${
                    !isMetaMaskConnected
                      ? 'bg-amber-600 hover:bg-amber-500 shadow-amber-600/30'
                      : 'bg-blue-600 hover:bg-blue-500 shadow-blue-600/30'
                  }`}
                >
                  {registerLoading ? (
                    <>
                      <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
                      <span>{registerTxProgress?.message || 'Đang đăng ký qua MetaMask...'}</span>
                    </>
                  ) : (
                    !isMetaMaskConnected ? '🦊 Kết Nối MetaMask Để Lưu' : 'Ký số & Lưu vào Kho (MetaMask)'
                  )}
                </button>
              </div>
            </form>
          </div>
        </div>,
        document.body
      )}

      {/* Modal / Toast thông báo Tem Cào Mã PIN sau khi đăng ký */}
      {registeredPinInfo && typeof document !== 'undefined' && ReactDOM.createPortal(
        <div className="fixed inset-0 z-[99999] flex items-center justify-center p-4 bg-black/80 backdrop-blur-md animate-fade-in">
          <div className="relative w-full max-w-md bg-white dark:bg-slate-900 border border-amber-500/40 rounded-3xl p-6 shadow-2xl space-y-5 text-center text-slate-900 dark:text-white">
            <div className="w-12 h-12 rounded-2xl bg-amber-500/10 text-amber-500 dark:text-amber-400 border border-amber-500/20 flex items-center justify-center mx-auto">
              <Key className="w-6 h-6" />
            </div>

            <div>
              <h3 className="text-base font-bold text-slate-900 dark:text-white">Khởi Tạo Tem Cào Bảo Mật Vật Lý</h3>
              <p className="text-xs text-slate-600 dark:text-slate-400 mt-1">
                Thiết bị <strong>{registeredPinInfo.serial}</strong> đã được gán mã PIN cào bảo vệ chống sao chép:
              </p>
            </div>

            {/* Visual Scratch Label Box */}
            <div className="p-4 rounded-2xl bg-gradient-to-r from-amber-50 via-white to-amber-50 dark:from-amber-950/60 dark:via-slate-950 dark:to-amber-950/60 border-2 border-dashed border-amber-400 dark:border-amber-500/50 space-y-2">
              <span className="text-[10px] uppercase font-bold tracking-widest text-amber-700 dark:text-amber-400 block">
                ★ TEM NIÊM PHONG PHỦ CÀO BẢO MẬT (SCRATCH PIN) ★
              </span>
              <div className="text-2xl font-mono font-black text-amber-600 dark:text-amber-300 tracking-wider">
                {registeredPinInfo.pin}
              </div>
              <p className="text-[11px] text-slate-600 dark:text-slate-400 italic">
                In tem này dán lên bao bì hoặc hướng dẫn khách hàng cào mã khi nhận máy.
              </p>
            </div>

            <div className="flex gap-2">
              <button
                type="button"
                onClick={() => {
                  navigator.clipboard.writeText(registeredPinInfo.pin);
                  setCopiedPin(true);
                  setTimeout(() => setCopiedPin(false), 2000);
                }}
                className="flex-1 py-2.5 rounded-xl bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-200 text-xs font-semibold flex items-center justify-center gap-1.5 transition cursor-pointer"
              >
                {copiedPin ? <Check className="w-4 h-4 text-emerald-500" /> : <Copy className="w-4 h-4" />}
                <span>{copiedPin ? 'Đã sao chép!' : 'Sao chép mã PIN'}</span>
              </button>

              <button
                type="button"
                onClick={() => {
                  setRegisteredPinInfo(null);
                  setShowRegisterModal(false);
                }}
                className="flex-1 py-2.5 rounded-xl bg-blue-600 hover:bg-blue-500 text-white text-xs font-bold transition shadow-lg shadow-blue-600/30 cursor-pointer"
              >
                Hoàn tất & Đóng
              </button>
            </div>
          </div>
        </div>,
        document.body
      )}

      {/* Warranty Certificate Modal */}
      {showCertModal && certData && (
        <WarrantyCertificateModal
          product={certData.product}
          chainData={certData.chainData}
          onClose={() => setShowCertModal(false)}
        />
      )}

      {/* Live Camera QR Scanner Modal */}
      {showQrModal && (
        <QrCameraScannerModal
          isOpen={showQrModal}
          onClose={() => setShowQrModal(false)}
          onScanSuccess={handleQrScanSuccess}
          title={qrTarget === 'register' ? 'Quét Barcode / QR Nhập Kho' : 'Quét Mã QR Hộp Máy Kích Hoạt'}
        />
      )}

    </div>
  );
}
