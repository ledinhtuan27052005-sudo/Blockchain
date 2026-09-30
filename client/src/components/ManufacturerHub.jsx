import React, { useState, useEffect } from 'react';
import {
  Factory,
  PlusCircle,
  Package,
  Layers,
  CheckCircle2,
  AlertTriangle,
  Sparkles,
  ShieldCheck,
  Building2,
  Cpu,
  Hash,
  ArrowRight,
  Key,
  Wallet,
  ArrowRightLeft,
  Store,
  User,
  Phone,
  Mail,
  Search,
  ChevronRight,
  X,
  UserCheck,
  Send,
  RefreshCw,
  Clock,
  Shield
} from 'lucide-react';
import { blockchainService } from '../services/blockchain';
import { saveProduct, transferProductOwnership, resolveCustomerWallet } from '../services/api';
import { computeMetadataHash } from '../services/merkle';

export default function ManufacturerHub({ 
  onProductAdded, 
  allProducts, 
  serviceCenters,
  isMetaMaskConnected,
  metaMaskAddress,
  onConnectMetaMask,
  onNotify
}) {
  // Quản lý Tab chính: 'register' (Đăng ký xuất xưởng) | 'dispatch' (Điều phối thiết bị)
  const [activeSubTab, setActiveSubTab] = useState('register');

  // ==========================================
  // TAB 1: ĐĂNG KÝ XUẤT XƯỞNG STATE
  // ==========================================
  const [formData, setFormData] = useState({
    serialNumber: '',
    modelCode: '',
    name: '',
    brand: '',
    category: 'Laptop',
    standardWarrantyMonths: 24,
    imageUrl: '',
    specs: {
      processor: '',
      ram: '',
      storage: '',
      display: '',
    },
  });

  const [loading, setLoading] = useState(false);
  const [successResult, setSuccessResult] = useState(null);
  const [errorMsg, setErrorMsg] = useState('');
  const [txProgress, setTxProgress] = useState(null);

  // ==========================================
  // TAB 2: ĐIỀU PHỐI THIẾT BỊ STATE
  // ==========================================
  const [dispatchSerial, setDispatchSerial] = useState('');
  const [dispatchSearchQuery, setDispatchSearchQuery] = useState('');
  const [isDispatchDropdownOpen, setIsDispatchDropdownOpen] = useState(false);
  const [dispatchTargetIdentifier, setDispatchTargetIdentifier] = useState('');
  const [dispatchResolvedWallet, setDispatchResolvedWallet] = useState(null);
  const [isDispatchResolving, setIsDispatchResolving] = useState(false);
  const [dispatchResolveError, setDispatchResolveError] = useState('');
  const [dispatchLoading, setDispatchLoading] = useState(false);
  const [dispatchTxProgress, setDispatchTxProgress] = useState(null);
  const [dispatchSuccess, setDispatchSuccess] = useState(null);
  const [dispatchError, setDispatchError] = useState('');

  // Tự động phân giải ví đích khi nhập SĐT / Email / Địa chỉ ví
  useEffect(() => {
    if (!dispatchTargetIdentifier || !dispatchTargetIdentifier.trim()) {
      setDispatchResolvedWallet(null);
      setDispatchResolveError('');
      return;
    }

    const timer = setTimeout(async () => {
      setIsDispatchResolving(true);
      setDispatchResolveError('');
      try {
        const res = await resolveCustomerWallet(dispatchTargetIdentifier.trim());
        if (res && res.success) {
          setDispatchResolvedWallet(res);
        } else {
          setDispatchResolvedWallet(null);
          setDispatchResolveError(res?.message || 'Không tìm thấy thông tin ví');
        }
      } catch (err) {
        setDispatchResolveError(err.message || 'Lỗi tra cứu thông tin đối tác');
        setDispatchResolvedWallet(null);
      } finally {
        setIsDispatchResolving(false);
      }
    }, 350);

    return () => clearTimeout(timer);
  }, [dispatchTargetIdentifier]);

  // Submit Đăng ký sản phẩm xuất xưởng
  const handleSubmit = async (e) => {
    e.preventDefault();
    setLoading(true);
    setErrorMsg('');
    setSuccessResult(null);
    setTxProgress({ step: 'AWAITING_SIGNATURE', message: 'Đang mở ví MetaMask & chờ bạn ký duyệt đăng ký sản phẩm...' });

    try {
      if (!isMetaMaskConnected) {
        if (onConnectMetaMask) onConnectMetaMask();
        throw new Error('Vui lòng kết nối ví MetaMask để ký giao dịch xuất xưởng và lưu dữ liệu On-Chain!');
      }

      if (!formData.serialNumber.trim()) throw new Error('Vui lòng nhập số Serial');
      if (!formData.name.trim()) throw new Error('Vui lòng nhập tên sản phẩm');
      const cleanSerial = formData.serialNumber.trim();
      const duplicate = (allProducts || []).find(p => p.serialNumber.toLowerCase() === cleanSerial.toLowerCase());
      if (duplicate) {
        throw new Error(`Số Serial [${cleanSerial}] đã tồn tại trong hệ thống. Vui lòng nhập số Serial khác!`);
      }

      // Sinh mã PIN cào bảo mật vật lý chống sao chép từ xa
      const secretPin = `PIN-${Math.floor(100000 + Math.random() * 900000)}`;

      const backendPayload = {
        serialNumber: formData.serialNumber.trim(),
        modelCode: formData.modelCode || 'MOD-STANDARD',
        name: formData.name.trim(),
        brand: formData.brand || 'Thương hiệu đối tác',
        category: formData.category,
        imageUrl: formData.imageUrl || 'https://images.unsplash.com/photo-1526738549149-8e07eca6c147?auto=format&fit=crop&w=800&q=80',
        standardWarrantyMonths: formData.standardWarrantyMonths,
        secretPin,
        specs: {
          processor: formData.specs.processor || 'Tiêu chuẩn nhà sản xuất',
          ram: formData.specs.ram || '8GB Unified',
          storage: formData.specs.storage || '256GB SSD',
          display: formData.specs.display || 'FHD 1080p',
        },
        documentation: {
          manualUrl: '#',
          safetyGuide: '#',
          serviceCoverage: 'Chinh hang toan quoc'
        }
      };

      const computedHash = computeMetadataHash(backendPayload);

      const chainRes = await blockchainService.registerProduct(
        formData.serialNumber.trim(),
        formData.modelCode || 'MOD-STANDARD',
        formData.standardWarrantyMonths,
        secretPin,
        computedHash,
        (progress) => setTxProgress(progress)
      );

      await saveProduct(backendPayload);

      setSuccessResult({
        serial: formData.serialNumber,
        txHash: chainRes.txHash,
        blockNumber: chainRes.blockNumber,
        secretPin,
      });

      setFormData({
        serialNumber: '',
        modelCode: '',
        name: '',
        brand: '',
        category: 'Laptop',
        standardWarrantyMonths: 24,
        imageUrl: '',
        specs: { processor: '', ram: '', storage: '', display: '' },
      });

      if (onProductAdded) onProductAdded();
    } catch (err) {
      setErrorMsg(err.message || 'Lỗi khi đăng ký sản phẩm');
    } finally {
      setLoading(false);
      setTxProgress(null);
    }
  };

  const handleQuickActivate = async (serial) => {
    try {
      const prod = (allProducts || []).find(p => p.serialNumber === serial);
      await blockchainService.activateWarranty(serial, null, prod?.secretPin || '');
      if (onProductAdded) onProductAdded();
    } catch (err) {
      setErrorMsg(err.message || 'Lỗi khi kích hoạt bảo hành');
    }
  };

  // Xử lý Điều phối / Sang tên thiết bị từ Nhà sản xuất
  const handleDispatchDevice = async (e) => {
    e.preventDefault();
    setDispatchError('');
    setDispatchSuccess(null);

    if (!isMetaMaskConnected) {
      if (onConnectMetaMask) onConnectMetaMask();
      setDispatchError('Vui lòng kết nối ví MetaMask của Nhà sản xuất để ký giao dịch điều phối On-Chain!');
      return;
    }

    if (!dispatchSerial || !dispatchSerial.trim()) {
      setDispatchError('Vui lòng chọn hoặc nhập số Serial của thiết bị cần điều phối.');
      return;
    }

    const cleanSn = dispatchSerial.trim();
    const targetProduct = (allProducts || []).find(p => p.serialNumber.toLowerCase() === cleanSn.toLowerCase());
    if (!targetProduct) {
      setDispatchError(`Không tìm thấy thiết bị [${cleanSn}] trong hệ thống.`);
      return;
    }

    const newOwnerWallet = dispatchResolvedWallet?.walletAddress;
    if (!newOwnerWallet || !/^0x[a-fA-F0-9]{40}$/.test(newOwnerWallet)) {
      setDispatchError('Vui lòng cung cấp người nhận hợp lệ (Số điện thoại, Email hoặc Địa chỉ ví Ethereum 0x...).');
      return;
    }

    // Kiểm tra trùng ví hiện tại
    const currentOwner = targetProduct.currentOwner || targetProduct.ownerAddress;
    if (currentOwner && currentOwner.toLowerCase() === newOwnerWallet.toLowerCase()) {
      setDispatchError('Người nhận này đã là chủ sở hữu hiện tại của thiết bị! Vui lòng chọn đối tác khác.');
      return;
    }

    setDispatchLoading(true);
    setDispatchTxProgress({ step: 'AWAITING_SIGNATURE', message: 'Đang mở ví MetaMask & chờ bạn ký duyệt điều phối thiết bị...' });

    try {
      // 1. Ký giao dịch On-Chain qua MetaMask
      const res = await blockchainService.transferOwnership(cleanSn, newOwnerWallet, (p) => setDispatchTxProgress(p));

      const buyerName = dispatchResolvedWallet?.user?.fullName || dispatchResolvedWallet?.user?.username || (dispatchTargetIdentifier.includes('@') ? dispatchTargetIdentifier.split('@')[0] : 'Đại lý / Đối tác');
      const buyerPhone = dispatchResolvedWallet?.user?.phone || (dispatchTargetIdentifier.match(/^\d+$/) ? dispatchTargetIdentifier : '');
      const buyerEmail = dispatchResolvedWallet?.user?.email || (dispatchTargetIdentifier.includes('@') ? dispatchTargetIdentifier : '');

      // 2. Cập nhật dữ liệu CSDL Backend
      await transferProductOwnership(cleanSn, {
        newOwner: newOwnerWallet,
        buyerPhone,
        buyerEmail,
        buyerName,
        txHash: res.txHash,
      });

      setDispatchSuccess({
        serial: cleanSn,
        newOwner: newOwnerWallet,
        recipientName: buyerName,
        role: dispatchResolvedWallet?.user?.role || 'PARTNER',
        txHash: res.txHash,
      });

      if (onNotify) {
        onNotify({
          type: 'success',
          title: 'Điều phối thiết bị thành công',
          message: `Thiết bị [${cleanSn}] đã được điều chuyển sang cho ${buyerName} (${newOwnerWallet.slice(0, 6)}...${newOwnerWallet.slice(-4)}) On-Chain!`,
        });
      }

      // Reset form
      setDispatchSerial('');
      setDispatchSearchQuery('');
      setDispatchTargetIdentifier('');
      setDispatchResolvedWallet(null);

      if (onProductAdded) onProductAdded();
    } catch (err) {
      setDispatchError(err.message || 'Lỗi khi thực hiện điều phối thiết bị');
    } finally {
      setDispatchLoading(false);
      setDispatchTxProgress(null);
    }
  };

  const selectedDispatchProduct = (allProducts || []).find(
    p => p.serialNumber.toLowerCase() === (dispatchSerial || '').toLowerCase()
  );

  return (
    <div className="space-y-6">
      
      {/* Header Banner */}
      <div className="p-6 rounded-3xl glass-card border border-slate-200 dark:border-slate-800 flex flex-col md:flex-row items-start md:items-center justify-between gap-4">
        <div className="flex items-center gap-4">
          <div className="w-12 h-12 rounded-2xl bg-blue-500/10 text-blue-500 dark:text-blue-400 border border-blue-500/20 flex items-center justify-center">
            <Factory className="w-6 h-6" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h2 className="text-lg font-bold text-slate-900 dark:text-white">Cổng Quản Trị Nhà Sản Xuất (Manufacturer Hub)</h2>
              <span className="text-[10px] bg-blue-500/15 text-blue-600 dark:text-blue-400 font-bold px-2 py-0.5 rounded border border-blue-500/30">
                ROLE: MANUFACTURER
              </span>
            </div>
            <p className="text-xs text-slate-600 dark:text-slate-400">
              Đăng ký xuất xưởng sản phẩm mới lên Blockchain và điều phối thiết bị sang cho Đại lý (Seller) hoặc Khách hàng.
            </p>
          </div>
        </div>
      </div>

      {/* Sub-navigation Tabs */}
      <div className="flex border-b border-slate-200 dark:border-slate-800 gap-2 sm:gap-6">
        <button
          type="button"
          onClick={() => setActiveSubTab('register')}
          className={`pb-3 px-3 text-xs sm:text-sm font-bold flex items-center gap-2 border-b-2 transition-all cursor-pointer ${
            activeSubTab === 'register'
              ? 'border-blue-500 text-blue-600 dark:text-blue-400'
              : 'border-transparent text-slate-500 hover:text-slate-700 dark:hover:text-slate-300'
          }`}
        >
          <PlusCircle className="w-4 h-4" />
          <span>Đăng ký Xuất xưởng</span>
        </button>

        <button
          type="button"
          onClick={() => setActiveSubTab('dispatch')}
          className={`pb-3 px-3 text-xs sm:text-sm font-bold flex items-center gap-2 border-b-2 transition-all cursor-pointer ${
            activeSubTab === 'dispatch'
              ? 'border-blue-500 text-blue-600 dark:text-blue-400'
              : 'border-transparent text-slate-500 hover:text-slate-700 dark:hover:text-slate-300'
          }`}
        >
          <ArrowRightLeft className="w-4 h-4" />
          <span>Điều phối thiết bị</span>
          <span className="text-[10px] px-2 py-0.5 rounded-full bg-blue-500/10 text-blue-600 dark:text-blue-400 font-mono font-bold">
            {(allProducts || []).length} máy
          </span>
        </button>
      </div>

      {/* ============================================================== */}
      {/* TAB 1: ĐĂNG KÝ XUẤT XƯỞNG                                     */}
      {/* ============================================================== */}
      {activeSubTab === 'register' && (
        <div className="grid grid-cols-1 xl:grid-cols-12 gap-6 animate-fade-in">
          
          {/* Left Form (7 cols on xl) */}
          <div className="xl:col-span-7 glass-card rounded-3xl p-5 sm:p-6 border border-slate-200 dark:border-slate-800 space-y-5">
            <h3 className="text-sm font-bold text-slate-900 dark:text-white flex items-center gap-2 pb-3 border-b border-slate-200 dark:border-slate-800">
              <PlusCircle className="w-4 h-4 text-blue-500 dark:text-blue-400" />
              Đăng ký Thiết bị Mới lên Blockchain
            </h3>

            {/* Wallet status banner */}
            {isMetaMaskConnected ? (
              <div className="p-3 rounded-2xl bg-emerald-500/10 border border-emerald-500/30 flex items-center justify-between gap-2 text-emerald-800 dark:text-emerald-300 text-xs">
                <div className="flex items-center gap-2">
                  <CheckCircle2 className="w-4 h-4 text-emerald-500 dark:text-emerald-400 shrink-0" />
                  <span>Ví MetaMask đã kết nối: <span className="font-mono font-bold text-slate-900 dark:text-white">{metaMaskAddress}</span></span>
                </div>
                <span className="text-[10px] bg-emerald-500/20 px-2.5 py-1 rounded-lg text-emerald-800 dark:text-emerald-300 font-bold border border-emerald-500/30">
                  ✓ Sẵn sàng ký On-Chain
                </span>
              </div>
            ) : (
              <div className="p-3 rounded-2xl bg-amber-500/10 border border-amber-500/30 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 text-amber-800 dark:text-amber-300 text-xs">
                <div className="flex items-center gap-2">
                  <AlertTriangle className="w-4 h-4 text-amber-500 dark:text-amber-400 shrink-0" />
                  <span>Yêu cầu kết nối ví MetaMask: Cần chữ ký số từ ví Web3 của Nhà sản xuất để lưu dữ liệu lên Smart Contract.</span>
                </div>
                {onConnectMetaMask && (
                  <button
                    type="button"
                    onClick={onConnectMetaMask}
                    className="px-3 py-1 rounded-xl bg-orange-500 hover:bg-orange-600 text-white font-bold text-[11px] flex items-center gap-1.5 transition cursor-pointer shrink-0 shadow-md shadow-orange-500/20"
                  >
                    <Wallet className="w-3.5 h-3.5" />
                    <span>Kết nối MetaMask</span>
                  </button>
                )}
              </div>
            )}

            {/* Real-time MetaMask Transaction Status Indicator */}
            {loading && txProgress && (
              <div className={`p-4 rounded-2xl border text-xs flex items-center gap-3 transition-all duration-300 animate-fade-in ${
                txProgress.step === 'CONFIRMED'
                  ? 'bg-emerald-500/15 border-emerald-500/40 text-emerald-800 dark:text-emerald-300'
                  : txProgress.step === 'FAILED'
                  ? 'bg-rose-500/15 border-rose-500/40 text-rose-800 dark:text-rose-300'
                  : 'bg-blue-500/10 border-blue-500/30 text-blue-800 dark:text-blue-300 animate-pulse'
              }`}>
                <div className="w-5 h-5 rounded-full border-2 border-current border-t-transparent animate-spin shrink-0" />
                <div className="flex-1">
                  <div className="font-bold flex items-center gap-1.5 text-sm">
                    <span>🦊 MetaMask:</span>
                    <span>{txProgress.message}</span>
                  </div>
                  <p className="text-[11px] opacity-80 mt-0.5">
                    {txProgress.step === 'AWAITING_SIGNATURE' && 'Cửa sổ MetaMask đang mở. Vui lòng bấm "Xác nhận" trên ví để ký giao dịch.'}
                    {txProgress.step === 'MINING' && 'Giao dịch đã được phát lên mạng Blockchain. Đang chờ khối được đào xác nhận...'}
                    {txProgress.step === 'CONFIRMED' && 'Giao dịch đã được MetaMask xác nhận thành công! Chuẩn bị hoàn tất hệ thống...'}
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

            {successResult && (
              <div className="p-4 rounded-xl bg-emerald-500/10 border border-emerald-500/30 text-emerald-700 dark:text-emerald-400 text-xs space-y-2.5">
                <div className="flex items-center gap-2 font-bold text-sm">
                  <CheckCircle2 className="w-4 h-4" />
                  <span>Đã ghi nhận sản phẩm xuất xưởng On-Chain thành công!</span>
                </div>
                <div className="space-y-1 font-mono text-[11px]">
                  <div>Số Serial: <span className="font-bold text-slate-900 dark:text-white">{successResult.serial}</span></div>
                  <div>Mã PIN cào bảo mật: <span className="font-bold text-amber-600 dark:text-amber-400 bg-amber-500/10 px-2 py-0.5 rounded">{successResult.secretPin}</span></div>
                  <div>Transaction Hash: <span className="text-emerald-700 dark:text-emerald-300 break-all">{successResult.txHash}</span></div>
                </div>
              </div>
            )}

            {/* Registration Form */}
            <form onSubmit={handleSubmit} className="space-y-4 text-xs">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div className="space-y-1">
                  <label className="block text-slate-700 dark:text-slate-300 font-semibold">Số Serial <span className="text-rose-500">*</span></label>
                  <input
                    type="text"
                    required
                    value={formData.serialNumber}
                    onChange={(e) => setFormData({ ...formData, serialNumber: e.target.value })}
                    placeholder="VD: SN-DELL-XPS-2026"
                    className="w-full px-3 py-2 rounded-xl bg-white dark:bg-slate-950 border border-slate-300 dark:border-slate-800 text-slate-900 dark:text-white font-mono placeholder:text-slate-400 dark:placeholder:text-slate-500 focus:border-blue-500 focus:outline-none"
                  />
                </div>

                <div className="space-y-1">
                  <label className="block text-slate-700 dark:text-slate-300 font-semibold">Mã Model (Model Code)</label>
                  <input
                    type="text"
                    value={formData.modelCode}
                    onChange={(e) => setFormData({ ...formData, modelCode: e.target.value })}
                    placeholder="VD: XPS-9530-OLED"
                    className="w-full px-3 py-2 rounded-xl bg-white dark:bg-slate-950 border border-slate-300 dark:border-slate-800 text-slate-900 dark:text-white font-mono placeholder:text-slate-400 dark:placeholder:text-slate-500 focus:border-blue-500 focus:outline-none"
                  />
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div className="space-y-1">
                  <label className="block text-slate-700 dark:text-slate-300 font-semibold">Tên sản phẩm <span className="text-rose-500">*</span></label>
                  <input
                    type="text"
                    required
                    value={formData.name}
                    onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                    placeholder="VD: Dell XPS 15 9530 OLED"
                    className="w-full px-3 py-2 rounded-xl bg-white dark:bg-slate-950 border border-slate-300 dark:border-slate-800 text-slate-900 dark:text-white placeholder:text-slate-400 dark:placeholder:text-slate-500 focus:border-blue-500 focus:outline-none"
                  />
                </div>

                <div className="space-y-1">
                  <label className="block text-slate-700 dark:text-slate-300 font-semibold">Hãng sản xuất (Brand)</label>
                  <input
                    type="text"
                    value={formData.brand}
                    onChange={(e) => setFormData({ ...formData, brand: e.target.value })}
                    placeholder="VD: Dell Technologies"
                    className="w-full px-3 py-2 rounded-xl bg-white dark:bg-slate-950 border border-slate-300 dark:border-slate-800 text-slate-900 dark:text-white placeholder:text-slate-400 dark:placeholder:text-slate-500 focus:border-blue-500 focus:outline-none"
                  />
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div className="space-y-1">
                  <label className="block text-slate-700 dark:text-slate-300 font-semibold">Phân loại danh mục</label>
                  <select
                    value={formData.category}
                    onChange={(e) => setFormData({ ...formData, category: e.target.value })}
                    className="w-full px-3 py-2 rounded-xl bg-white dark:bg-slate-950 border border-slate-300 dark:border-slate-800 text-slate-900 dark:text-white focus:border-blue-500 focus:outline-none cursor-pointer"
                  >
                    <option value="Laptop">Laptop / Máy tính xách tay</option>
                    <option value="Smartphone">Điện thoại thông minh</option>
                    <option value="Tablet">Máy tính bảng</option>
                    <option value="Smartwatch">Đồng hồ thông minh</option>
                    <option value="Audio">Tai nghe / Thiết bị âm thanh</option>
                    <option value="Accessories">Phụ kiện công nghệ</option>
                  </select>
                </div>

                <div className="space-y-1">
                  <label className="block text-slate-700 dark:text-slate-300 font-semibold">Thời hạn bảo hành tiêu chuẩn (Tháng)</label>
                  <input
                    type="number"
                    min="1"
                    max="120"
                    value={formData.standardWarrantyMonths}
                    onChange={(e) => setFormData({ ...formData, standardWarrantyMonths: Number(e.target.value) })}
                    className="w-full px-3 py-2 rounded-xl bg-white dark:bg-slate-950 border border-slate-300 dark:border-slate-800 text-slate-900 dark:text-white focus:border-blue-500 focus:outline-none"
                  />
                </div>
              </div>

              {/* Supporting Specs */}
              <div className="pt-2 border-t border-slate-200 dark:border-slate-800/80 space-y-2">
                <label className="block text-slate-700 dark:text-slate-300 font-semibold">Thông số bổ trợ (Off-chain Metadata)</label>
                <div className="grid grid-cols-2 gap-2">
                  <input
                    type="text"
                    value={formData.specs.processor}
                    onChange={(e) => setFormData({ ...formData, specs: { ...formData.specs, processor: e.target.value } })}
                    placeholder="CPU / Chipset..."
                    className="px-3 py-1.5 rounded-lg bg-white dark:bg-slate-950 border border-slate-300 dark:border-slate-800 text-slate-900 dark:text-white placeholder:text-slate-400 dark:placeholder:text-slate-500 text-xs focus:border-blue-500 focus:outline-none"
                  />
                  <input
                    type="text"
                    value={formData.specs.ram}
                    onChange={(e) => setFormData({ ...formData, specs: { ...formData.specs, ram: e.target.value } })}
                    placeholder="RAM / Bộ nhớ..."
                    className="px-3 py-1.5 rounded-lg bg-white dark:bg-slate-950 border border-slate-300 dark:border-slate-800 text-slate-900 dark:text-white placeholder:text-slate-400 dark:placeholder:text-slate-500 text-xs focus:border-blue-500 focus:outline-none"
                  />
                </div>
              </div>

              {!isMetaMaskConnected ? (
                <button
                  type="button"
                  onClick={onConnectMetaMask}
                  className="w-full py-3 rounded-xl font-bold tracking-wide transition flex items-center justify-center gap-2 bg-gradient-to-r from-orange-500 to-amber-600 hover:from-orange-600 hover:to-amber-700 text-white shadow-lg shadow-orange-500/25 cursor-pointer active:scale-98"
                >
                  <Wallet className="w-4 h-4" />
                  <span>🦊 Kết Nối Ví MetaMask Để Ký Số Xuất Xưởng</span>
                </button>
              ) : (
                <button
                  type="submit"
                  disabled={loading}
                  className="w-full py-3 rounded-xl font-bold tracking-wide transition flex items-center justify-center gap-2 shadow-lg cursor-pointer disabled:opacity-50 bg-blue-600 hover:bg-blue-500 text-white shadow-blue-600/30"
                >
                  {loading ? (
                    <>
                      <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
                      <span>{txProgress?.message || 'Đang xử lý giao dịch qua MetaMask...'}</span>
                    </>
                  ) : (
                    <>
                      <ShieldCheck className="w-4 h-4" />
                      <span>Ký số & Đăng ký On-Chain (MetaMask)</span>
                    </>
                  )}
                </button>
              )}
            </form>
          </div>

          {/* Right Info: Product Catalog & Authorized Centers (5 cols on xl) */}
          <div className="xl:col-span-5 space-y-6">
            
            {/* Registered Products List */}
            <div className="glass-card rounded-3xl p-6 border border-slate-200 dark:border-slate-800 space-y-4">
              <h3 className="text-sm font-bold text-slate-900 dark:text-white flex items-center gap-2 pb-2 border-b border-slate-200 dark:border-slate-800">
                <Package className="w-4 h-4 text-emerald-500 dark:text-emerald-400" />
                Sản phẩm đã cấp phép ({allProducts?.length || 0})
              </h3>

              <div className="space-y-2.5 max-h-[380px] overflow-y-auto pr-1">
                {(!allProducts || allProducts.length === 0) ? (
                  <div className="p-6 text-center text-slate-400 text-xs">
                    Chưa có thiết bị nào được xuất xưởng trong kho.
                  </div>
                ) : (
                  allProducts.map((p) => (
                    <div
                      key={p.serialNumber}
                      className="p-3 rounded-xl bg-slate-50 dark:bg-slate-950/70 border border-slate-200 dark:border-slate-800/80 hover:border-slate-300 dark:hover:border-slate-700 transition flex items-center justify-between text-xs"
                    >
                      <div className="space-y-0.5">
                        <div className="font-bold text-slate-900 dark:text-white">{p.name || p.serialNumber}</div>
                        <div className="text-slate-500 dark:text-slate-400 font-mono text-[11px]">{p.serialNumber}</div>
                      </div>
                      <div>
                        {p.status === 1 ? (
                          <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-emerald-500/20 text-emerald-700 dark:text-emerald-400 border border-emerald-500/30">
                            Đang bảo hành
                          </span>
                        ) : (
                          <div className="flex items-center gap-1.5">
                            <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-amber-500/20 text-amber-700 dark:text-amber-400 border border-amber-500/30">
                              Chờ kích hoạt
                            </span>
                            <button
                              type="button"
                              onClick={() => handleQuickActivate(p.serialNumber)}
                              className="px-2 py-0.5 rounded text-[10px] font-bold bg-emerald-600 hover:bg-emerald-500 text-white transition cursor-pointer"
                              title="Kích hoạt bảo hành trực tiếp"
                            >
                              Kích hoạt
                            </button>
                          </div>
                        )}
                      </div>
                    </div>
                  ))
                )}
              </div>
            </div>

            {/* Authorized Centers Directory */}
            <div className="glass-card rounded-3xl p-6 border border-slate-200 dark:border-slate-800 space-y-3">
              <h3 className="text-sm font-bold text-slate-900 dark:text-white flex items-center gap-2 pb-2 border-b border-slate-200 dark:border-slate-800">
                <Building2 className="w-4 h-4 text-indigo-500 dark:text-indigo-400" />
                Mạng lưới Trạm dịch vụ ủy quyền
              </h3>
              <div className="space-y-2 text-xs">
                {(!serviceCenters || serviceCenters.length === 0) ? (
                  <div className="p-4 rounded-xl bg-slate-50 dark:bg-slate-950/40 border border-slate-200 dark:border-slate-800/50 text-center text-slate-500 text-xs">
                    Chưa có trạm dịch vụ ủy quyền nào trong hệ thống.
                  </div>
                ) : (
                  serviceCenters.map((c) => (
                    <div key={c.id} className="p-2.5 rounded-xl bg-slate-50 dark:bg-slate-950/50 border border-slate-200 dark:border-slate-800/60">
                      <div className="font-semibold text-slate-800 dark:text-slate-200">{c.name}</div>
                      <div className="text-slate-500 dark:text-slate-400 text-[11px]">{c.address}</div>
                      <div className="text-slate-400 dark:text-slate-500 font-mono text-[10px] truncate mt-0.5">
                        Ví: {c.ethAddress}
                      </div>
                    </div>
                  ))
                )}
              </div>
            </div>

          </div>

        </div>
      )}

      {/* ============================================================== */}
      {/* TAB 2: ĐIỀU PHỐI THIẾT BỊ (DISPATCH HUB)                       */}
      {/* ============================================================== */}
      {activeSubTab === 'dispatch' && (
        <div className="grid grid-cols-1 xl:grid-cols-12 gap-6 animate-fade-in">
          
          {/* Left Form: Dispatch Form (7 cols on xl) */}
          <div className="xl:col-span-7 glass-card rounded-3xl p-5 sm:p-6 border border-slate-200 dark:border-slate-800 space-y-5">
            <div className="flex items-center justify-between pb-3 border-b border-slate-200 dark:border-slate-800">
              <h3 className="text-sm font-bold text-slate-900 dark:text-white flex items-center gap-2">
                <ArrowRightLeft className="w-4 h-4 text-blue-500 dark:text-blue-400" />
                Điều Phối & Sang Tên Thiết Bị (On-Chain)
              </h3>
              <span className="text-[10px] bg-blue-500/10 text-blue-600 dark:text-blue-400 px-2.5 py-0.5 rounded-full font-bold border border-blue-500/20">
                B2B & B2C Transfer
              </span>
            </div>

            {/* Wallet status banner */}
            {isMetaMaskConnected ? (
              <div className="p-3 rounded-2xl bg-emerald-500/10 border border-emerald-500/30 flex items-center justify-between gap-2 text-emerald-800 dark:text-emerald-300 text-xs">
                <div className="flex items-center gap-2">
                  <CheckCircle2 className="w-4 h-4 text-emerald-500 dark:text-emerald-400 shrink-0" />
                  <span>Ví ký điều phối: <span className="font-mono font-bold text-slate-900 dark:text-white">{metaMaskAddress}</span></span>
                </div>
                <span className="text-[10px] bg-emerald-500/20 px-2.5 py-1 rounded-lg text-emerald-800 dark:text-emerald-300 font-bold border border-emerald-500/30">
                  ✓ Quyền NSX On-Chain
                </span>
              </div>
            ) : (
              <div className="p-3 rounded-2xl bg-amber-500/10 border border-amber-500/30 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 text-amber-800 dark:text-amber-300 text-xs">
                <div className="flex items-center gap-2">
                  <AlertTriangle className="w-4 h-4 text-amber-500 dark:text-amber-400 shrink-0" />
                  <span>Cần kết nối ví MetaMask của Nhà sản xuất để ký sang tên hợp đồng thông minh.</span>
                </div>
                {onConnectMetaMask && (
                  <button
                    type="button"
                    onClick={onConnectMetaMask}
                    className="px-3 py-1 rounded-xl bg-orange-500 hover:bg-orange-600 text-white font-bold text-[11px] flex items-center gap-1.5 transition cursor-pointer shrink-0 shadow-md shadow-orange-500/20"
                  >
                    <Wallet className="w-3.5 h-3.5" />
                    <span>Kết nối MetaMask</span>
                  </button>
                )}
              </div>
            )}

            {/* Real-time MetaMask Transaction Status Indicator */}
            {dispatchLoading && dispatchTxProgress && (
              <div className={`p-4 rounded-2xl border text-xs flex items-center gap-3 transition-all duration-300 animate-fade-in ${
                dispatchTxProgress.step === 'CONFIRMED'
                  ? 'bg-emerald-500/15 border-emerald-500/40 text-emerald-800 dark:text-emerald-300'
                  : dispatchTxProgress.step === 'FAILED'
                  ? 'bg-rose-500/15 border-rose-500/40 text-rose-800 dark:text-rose-300'
                  : 'bg-blue-500/10 border-blue-500/30 text-blue-800 dark:text-blue-300 animate-pulse'
              }`}>
                <div className="w-5 h-5 rounded-full border-2 border-current border-t-transparent animate-spin shrink-0" />
                <div className="flex-1">
                  <div className="font-bold flex items-center gap-1.5 text-sm">
                    <span>🦊 MetaMask:</span>
                    <span>{dispatchTxProgress.message}</span>
                  </div>
                  <p className="text-[11px] opacity-80 mt-0.5">
                    {dispatchTxProgress.step === 'AWAITING_SIGNATURE' && 'Cửa sổ MetaMask đang mở. Vui lòng bấm "Xác nhận" trên ví để ký sang tên thiết bị.'}
                    {dispatchTxProgress.step === 'MINING' && 'Giao dịch đã phát lên Blockchain. Đang chờ xác nhận khối...'}
                    {dispatchTxProgress.step === 'CONFIRMED' && 'Giao dịch đã được MetaMask xác nhận thành công! Đang lưu vào hệ thống...'}
                    {dispatchTxProgress.step === 'FAILED' && 'Giao dịch đã bị từ chối hoặc gặp lỗi từ ví MetaMask.'}
                  </p>
                </div>
              </div>
            )}

            {dispatchError && (
              <div className="p-3.5 rounded-xl bg-rose-500/10 border border-rose-500/30 text-rose-600 dark:text-rose-400 text-xs flex items-center gap-2">
                <AlertTriangle className="w-4 h-4 shrink-0" />
                <span>{dispatchError}</span>
              </div>
            )}

            {dispatchSuccess && (
              <div className="p-4 rounded-xl bg-emerald-500/10 border border-emerald-500/30 text-emerald-700 dark:text-emerald-400 text-xs space-y-2.5">
                <div className="flex items-center gap-2 font-bold text-sm">
                  <CheckCircle2 className="w-4 h-4" />
                  <span>Đã điều phối thiết bị thành công sang cho {dispatchSuccess.recipientName}!</span>
                </div>
                <div className="space-y-1 font-mono text-[11px]">
                  <div>Số Serial: <span className="font-bold text-slate-900 dark:text-white">{dispatchSuccess.serial}</span></div>
                  <div>Ví người nhận: <span className="font-bold text-slate-900 dark:text-white">{dispatchSuccess.newOwner}</span></div>
                  <div>Tx Hash: <span className="text-emerald-700 dark:text-emerald-300 break-all">{dispatchSuccess.txHash}</span></div>
                </div>
              </div>
            )}

            {/* Dispatch Form */}
            <form onSubmit={handleDispatchDevice} className="space-y-5 text-xs">
              
              {/* 1. Chọn Thiết Bị Cần Điều Phối */}
              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <label className="text-slate-700 dark:text-slate-300 font-semibold flex items-center gap-1.5">
                    <Package className="w-4 h-4 text-blue-500" />
                    <span>Bước 1: Chọn thiết bị xuất kho điều phối</span>
                    <span className="text-rose-500">*</span>
                  </label>
                  {dispatchSerial && (
                    <span className="text-[11px] text-blue-600 dark:text-blue-400 font-mono font-bold">
                      Đã chọn: {dispatchSerial}
                    </span>
                  )}
                </div>

                <div className="relative">
                  <div className="relative flex items-center">
                    <Search className="w-4 h-4 text-slate-400 absolute left-3 pointer-events-none" />
                    <input
                      type="text"
                      placeholder="Tìm kiếm theo mã Serial, tên thiết bị hoặc model..."
                      value={dispatchSearchQuery || dispatchSerial}
                      onFocus={() => setIsDispatchDropdownOpen(true)}
                      onChange={(e) => {
                        const val = e.target.value;
                        setDispatchSearchQuery(val);
                        setDispatchSerial(val);
                        setIsDispatchDropdownOpen(true);
                      }}
                      className="w-full pl-9 pr-10 py-2.5 rounded-xl bg-white dark:bg-slate-950 border border-slate-300 dark:border-slate-800 text-slate-900 dark:text-white font-mono placeholder:font-sans placeholder:text-slate-400 focus:border-blue-500 focus:outline-none"
                    />
                    {dispatchSerial && (
                      <button
                        type="button"
                        onClick={() => {
                          setDispatchSerial('');
                          setDispatchSearchQuery('');
                          setIsDispatchDropdownOpen(true);
                        }}
                        className="absolute right-8 text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 p-1"
                      >
                        <X className="w-3.5 h-3.5" />
                      </button>
                    )}
                    <button
                      type="button"
                      onClick={() => setIsDispatchDropdownOpen(!isDispatchDropdownOpen)}
                      className="absolute right-2.5 text-slate-400 hover:text-slate-600 p-1"
                    >
                      <ChevronRight className={`w-4 h-4 transition-transform duration-200 ${isDispatchDropdownOpen ? 'rotate-90 text-blue-500' : ''}`} />
                    </button>
                  </div>

                  {/* Dropdown danh sách sản phẩm */}
                  {isDispatchDropdownOpen && (
                    <div className="absolute z-20 left-0 right-0 mt-1.5 max-h-56 overflow-y-auto rounded-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 shadow-xl py-1 divide-y divide-slate-100 dark:divide-slate-800/60">
                      {(!allProducts || allProducts.length === 0) ? (
                        <div className="p-3 text-center text-slate-400 text-xs">
                          Chưa có thiết bị nào trong kho.
                        </div>
                      ) : (
                        allProducts
                          .filter((p) => {
                            if (!dispatchSearchQuery.trim()) return true;
                            const q = dispatchSearchQuery.toLowerCase().trim();
                            return (
                              p.serialNumber.toLowerCase().includes(q) ||
                              (p.name && p.name.toLowerCase().includes(q)) ||
                              (p.modelCode && p.modelCode.toLowerCase().includes(q))
                            );
                          })
                          .map((p) => {
                            const isSel = dispatchSerial && dispatchSerial.toLowerCase() === p.serialNumber.toLowerCase();
                            return (
                              <button
                                key={p.serialNumber}
                                type="button"
                                onClick={() => {
                                  setDispatchSerial(p.serialNumber);
                                  setDispatchSearchQuery(p.serialNumber);
                                  setIsDispatchDropdownOpen(false);
                                }}
                                className={`w-full text-left p-3 flex items-center justify-between hover:bg-blue-50/70 dark:hover:bg-blue-950/30 transition cursor-pointer ${
                                  isSel ? 'bg-blue-50 dark:bg-blue-950/40 text-blue-700 dark:text-blue-300 font-bold' : ''
                                }`}
                              >
                                <div className="space-y-0.5">
                                  <div className="font-semibold text-slate-900 dark:text-white flex items-center gap-1.5">
                                    <span>{p.name || p.serialNumber}</span>
                                    {p.brand && <span className="text-[10px] font-normal text-slate-400">({p.brand})</span>}
                                  </div>
                                  <div className="font-mono text-[11px] text-slate-500 dark:text-slate-400">{p.serialNumber}</div>
                                </div>
                                <div className="text-right shrink-0">
                                  {p.status === 1 ? (
                                    <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-emerald-500/15 text-emerald-600 dark:text-emerald-400">
                                      Đang bảo hành
                                    </span>
                                  ) : (
                                    <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-amber-500/15 text-amber-600 dark:text-amber-400">
                                      Chờ kích hoạt
                                    </span>
                                  )}
                                </div>
                              </button>
                            );
                          })
                      )}
                    </div>
                  )}
                </div>

                {/* Selected Product Card Preview */}
                {selectedDispatchProduct && (
                  <div className="p-3.5 rounded-2xl bg-blue-50/60 dark:bg-blue-950/20 border border-blue-200/80 dark:border-blue-900/40 flex items-center justify-between text-xs animate-fade-in">
                    <div className="space-y-1">
                      <div className="font-bold text-slate-900 dark:text-white flex items-center gap-2">
                        <span>{selectedDispatchProduct.name}</span>
                        <span className="text-[10px] font-normal px-2 py-0.5 rounded bg-blue-500/10 text-blue-600 dark:text-blue-400 border border-blue-500/20">
                          {selectedDispatchProduct.category || 'Thiết bị'}
                        </span>
                      </div>
                      <div className="font-mono text-[11px] text-slate-600 dark:text-slate-400 flex items-center gap-3">
                        <span>Serial: <strong className="text-slate-900 dark:text-white">{selectedDispatchProduct.serialNumber}</strong></span>
                        <span>Hạn BH: {selectedDispatchProduct.standardWarrantyMonths || 24} tháng</span>
                      </div>
                      <div className="text-[10px] text-slate-500 font-mono truncate max-w-sm">
                        Chủ hiện tại: {selectedDispatchProduct.currentOwner || selectedDispatchProduct.ownerAddress || 'Kho Nhà máy (Chưa điều phối)'}
                      </div>
                    </div>
                  </div>
                )}
              </div>

              {/* 2. Chọn Người Nhận / Đối Tác Nhận Máy */}
              <div className="space-y-2 pt-2 border-t border-slate-200 dark:border-slate-800">
                <label className="text-slate-700 dark:text-slate-300 font-semibold flex items-center justify-between">
                  <div className="flex items-center gap-1.5">
                    <Store className="w-4 h-4 text-emerald-500" />
                    <span>Bước 2: Chọn Đại lý (Seller) hoặc Khách hàng nhận máy</span>
                    <span className="text-rose-500">*</span>
                  </div>
                </label>

                {/* Gợi ý nhanh Đại lý và Đối tác */}
                <div className="space-y-1.5">
                  <span className="text-[11px] text-slate-500 dark:text-slate-400 font-medium">Gợi ý nhanh đối tác ủy quyền:</span>
                  <div className="flex flex-wrap gap-2">
                    <button
                      type="button"
                      onClick={() => setDispatchTargetIdentifier('42tuana2k46@gmail.com')}
                      className="px-3 py-1.5 rounded-xl text-xs font-semibold bg-emerald-500/10 hover:bg-emerald-500/20 text-emerald-700 dark:text-emerald-400 border border-emerald-500/30 flex items-center gap-1.5 transition cursor-pointer"
                    >
                      <Store className="w-3.5 h-3.5" />
                      <span>Đại lý tuan (ledinhtuan)</span>
                    </button>

                    <button
                      type="button"
                      onClick={() => setDispatchTargetIdentifier('dinhchi21102005@gmail.com')}
                      className="px-3 py-1.5 rounded-text-xs font-semibold bg-blue-500/10 hover:bg-blue-500/20 text-blue-700 dark:text-blue-400 border border-blue-500/30 px-3 py-1.5 rounded-xl text-xs flex items-center gap-1.5 transition cursor-pointer"
                    >
                      <User className="w-3.5 h-3.5" />
                      <span>Khách hàng dinh chi</span>
                    </button>
                  </div>
                </div>

                {/* Ô nhập SĐT / Email / Ví */}
                <div className="relative mt-2">
                  <div className="relative flex items-center">
                    <input
                      type="text"
                      required
                      placeholder="Nhập Số điện thoại, Email (@gmail.com) hoặc Địa chỉ ví (0x...)"
                      value={dispatchTargetIdentifier}
                      onChange={(e) => setDispatchTargetIdentifier(e.target.value)}
                      className="w-full pl-3.5 pr-10 py-2.5 rounded-xl bg-white dark:bg-slate-950 border border-slate-300 dark:border-slate-800 text-slate-900 dark:text-white font-mono placeholder:font-sans placeholder:text-slate-400 focus:border-blue-500 focus:outline-none"
                    />
                    {isDispatchResolving && (
                      <div className="absolute right-3.5 text-blue-500 animate-spin">
                        <RefreshCw className="w-4 h-4" />
                      </div>
                    )}
                  </div>
                </div>

                {/* Thông báo lỗi tra cứu người nhận */}
                {dispatchResolveError && dispatchTargetIdentifier.trim() && (
                  <div className="text-[11px] text-rose-500 dark:text-rose-400 flex items-center gap-1">
                    <AlertTriangle className="w-3 h-3 shrink-0" />
                    <span>{dispatchResolveError}</span>
                  </div>
                )}

                {/* Card hiển thị người nhận sau khi tra cứu thành công */}
                {dispatchResolvedWallet && (
                  <div className="p-3.5 rounded-2xl bg-emerald-500/10 border border-emerald-500/30 text-xs space-y-2 animate-fade-in">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        <UserCheck className="w-4 h-4 text-emerald-500 shrink-0" />
                        <span className="font-bold text-slate-900 dark:text-white">
                          {dispatchResolvedWallet.user?.fullName || dispatchResolvedWallet.user?.username || 'Đối tác nhận máy'}
                        </span>
                      </div>
                      <span className="text-[10px] font-bold px-2 py-0.5 rounded bg-emerald-500/20 text-emerald-700 dark:text-emerald-400 border border-emerald-500/30">
                        {dispatchResolvedWallet.user?.role || 'PARTNER'}
                      </span>
                    </div>

                    <div className="space-y-0.5 text-[11px] text-slate-600 dark:text-slate-300 font-mono">
                      {dispatchResolvedWallet.user?.email && (
                        <div>Email: <strong className="text-slate-900 dark:text-white">{dispatchResolvedWallet.user.email}</strong></div>
                      )}
                      {dispatchResolvedWallet.user?.phone && (
                        <div>SĐT: <strong className="text-slate-900 dark:text-white">{dispatchResolvedWallet.user.phone}</strong></div>
                      )}
                      <div>
                        Địa chỉ ví On-Chain: <strong className="text-emerald-700 dark:text-emerald-400 break-all">{dispatchResolvedWallet.walletAddress}</strong>
                      </div>
                    </div>
                  </div>
                )}
              </div>

              {/* Nút bấm ký duyệt */}
              {!isMetaMaskConnected ? (
                <button
                  type="button"
                  onClick={onConnectMetaMask}
                  className="w-full py-3.5 rounded-xl font-bold tracking-wide transition flex items-center justify-center gap-2 bg-gradient-to-r from-orange-500 to-amber-600 hover:from-orange-600 hover:to-amber-700 text-white shadow-lg shadow-orange-500/25 cursor-pointer active:scale-98"
                >
                  <Wallet className="w-4 h-4" />
                  <span>🦊 Kết Nối MetaMask Để Ký Điều Phối</span>
                </button>
              ) : (
                <button
                  type="submit"
                  disabled={dispatchLoading || !dispatchSerial || !dispatchResolvedWallet?.walletAddress}
                  className="w-full py-3.5 rounded-xl font-bold tracking-wide transition flex items-center justify-center gap-2 shadow-lg cursor-pointer disabled:opacity-50 bg-blue-600 hover:bg-blue-500 text-white shadow-blue-600/30"
                >
                  {dispatchLoading ? (
                    <>
                      <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
                      <span>{dispatchTxProgress?.message || 'Đang ký điều phối on-chain qua MetaMask...'}</span>
                    </>
                  ) : (
                    <>
                      <Send className="w-4 h-4" />
                      <span>Xác nhận Điều Phối & Ký MetaMask</span>
                    </>
                  )}
                </button>
              )}

            </form>
          </div>

          {/* Right Info: Inventory Dispatch Board (5 cols on xl) */}
          <div className="xl:col-span-5 space-y-6">
            <div className="glass-card rounded-3xl p-6 border border-slate-200 dark:border-slate-800 space-y-4">
              <div className="flex items-center justify-between pb-2 border-b border-slate-200 dark:border-slate-800">
                <h3 className="text-sm font-bold text-slate-900 dark:text-white flex items-center gap-2">
                  <Package className="w-4 h-4 text-blue-500" />
                  Danh mục Thiết bị Trong Kho ({allProducts?.length || 0})
                </h3>
                <span className="text-[10px] text-slate-400 font-medium">Bấm để chọn máy</span>
              </div>

              <div className="space-y-3 max-h-[500px] overflow-y-auto pr-1">
                {(!allProducts || allProducts.length === 0) ? (
                  <div className="p-8 text-center text-slate-400 text-xs">
                    Kho hiện chưa có thiết bị nào. Hãy đăng ký xuất xưởng thiết bị trước.
                  </div>
                ) : (
                  allProducts.map((p) => {
                    const isCurrentSelected = dispatchSerial && dispatchSerial.toLowerCase() === p.serialNumber.toLowerCase();
                    return (
                      <div
                        key={p.serialNumber}
                        className={`p-3.5 rounded-2xl border transition text-xs space-y-2 ${
                          isCurrentSelected
                            ? 'bg-blue-50/80 dark:bg-blue-950/40 border-blue-500/50 shadow-md shadow-blue-500/10'
                            : 'bg-white dark:bg-slate-950/60 border-slate-200 dark:border-slate-800 hover:border-slate-300 dark:hover:border-slate-700'
                        }`}
                      >
                        <div className="flex items-start justify-between gap-2">
                          <div>
                            <div className="font-bold text-slate-900 dark:text-white">{p.name || p.serialNumber}</div>
                            <div className="font-mono text-[11px] text-blue-600 dark:text-blue-400 mt-0.5">{p.serialNumber}</div>
                          </div>
                          {p.status === 1 ? (
                            <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-emerald-500/15 text-emerald-600 dark:text-emerald-400 border border-emerald-500/20">
                              Đang bảo hành
                            </span>
                          ) : (
                            <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-amber-500/15 text-amber-600 dark:text-amber-400 border border-amber-500/20">
                              Chờ kích hoạt
                            </span>
                          )}
                        </div>

                        <div className="text-[10px] text-slate-500 font-mono truncate">
                          Chủ sở hữu: {p.currentOwner || p.ownerAddress || 'Kho Nhà máy (Chưa giao)'}
                        </div>

                        <div className="flex items-center justify-between pt-1 border-t border-slate-100 dark:border-slate-800/80">
                          <span className="text-[10px] text-slate-400">Model: {p.modelCode || 'Tiêu chuẩn'}</span>
                          <button
                            type="button"
                            onClick={() => {
                              setDispatchSerial(p.serialNumber);
                              setDispatchSearchQuery(p.serialNumber);
                            }}
                            className={`px-2.5 py-1 rounded-lg text-[10px] font-bold transition cursor-pointer flex items-center gap-1 ${
                              isCurrentSelected
                                ? 'bg-blue-600 text-white'
                                : 'bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300 hover:bg-blue-600 hover:text-white'
                            }`}
                          >
                            <span>{isCurrentSelected ? '✓ Đang chọn' : 'Chọn điều phối'}</span>
                            <ArrowRight className="w-3 h-3" />
                          </button>
                        </div>
                      </div>
                    );
                  })
                )}
              </div>
            </div>
          </div>

        </div>
      )}

    </div>
  );
}
