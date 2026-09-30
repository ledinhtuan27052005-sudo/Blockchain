import React, { useState, useEffect } from 'react';
import {
  Search,
  ShieldCheck,
  ShieldAlert,
  ShieldX,
  Clock,
  Wrench,
  Cpu,
  FileText,
  CheckCircle2,
  Calendar,
  Building2,
  Store,
  Hash,
  Sparkles,
  RefreshCw,
  QrCode,
  Tag,
  AlertCircle,
  UserCheck,
  ArrowRightLeft,
  Database,
  X,
  Wallet,
  Camera,
  AlertTriangle,
  Bell
} from 'lucide-react';
import DigitalWarrantyCard from './DigitalWarrantyCard';
import WarrantyCertificateModal from './WarrantyCertificateModal';
import RmaRequestModal from './RmaRequestModal';
import QrCameraScannerModal from './QrCameraScannerModal';
import { blockchainService } from '../services/blockchain';
import { resolveCustomerWallet } from '../services/api';

export default function PublicLookup({
  searchSerial,
  setSearchSerial,
  onSearch,
  productData,
  chainData,
  serviceHistory,
  serviceCenters,
  onDataChanged,
  onNotify,
  isMetaMaskConnected,
  onConnectMetaMask,
  currentUser,
  onNavigate,
}) {
  const [activeTab, setActiveTab] = useState('timeline'); // 'timeline' | 'specs'
  const [showDigitalPass, setShowDigitalPass] = useState(false);
  const [showCertificateModal, setShowCertificateModal] = useState(false);
    const [showRmaModal, setShowRmaModal] = useState(false);
            
        
  // Real-world features state
  const [showQrScanner, setShowQrScanner] = useState(false);
  const [sendingExpiryAlert, setSendingExpiryAlert] = useState(false);
  const [expiryAlertSent, setExpiryAlertSent] = useState(false);

  const handleQrScanSuccess = (scannedSerial) => {
    if (scannedSerial) {
      setSearchSerial(scannedSerial);
      onSearch(scannedSerial);
    }
  };

  const handleSendExpiryAlert = async () => {
    if (!chainData) return;
    setSendingExpiryAlert(true);
    try {
      const res = await fetch('http://localhost:5000/api/notifications/send-expiry-alert', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          customerEmail: currentUser?.email || 'customer@trustwarranty.io',
          customerName: currentUser?.fullName || 'Quý khách hàng',
          serialNumber: chainData.serialNumber,
          productName: productData?.name || chainData.serialNumber,
          brand: productData?.brand || 'TrustWarranty Partner',
          expiryDate: chainData.expiryDate,
          daysRemaining: remaining?.days || 0,
        }),
      });
      const data = await res.json();
      if (res.ok) {
        setExpiryAlertSent(true);
        if (onNotify) {
          onNotify({
            type: 'success',
            title: 'Đã gửi email cảnh báo hết hạn',
            message: `Hệ thống đã gửi email thông báo chi tiết và hướng dẫn gia hạn tới ${currentUser?.email || 'hộp thư của bạn'}.`,
          });
        }
      } else {
        throw new Error(data.error || 'Lỗi gửi email');
      }
    } catch (err) {
      if (onNotify) {
        onNotify({
          type: 'error',
          title: 'Không thể gửi email cảnh báo',
          message: err.message,
        });
      }
    } finally {
      setSendingExpiryAlert(false);
    }
  };

  // Format date helper
  const formatDate = (timestamp) => {
    if (!timestamp) return 'Chưa ghi nhận';
    const date = new Date(timestamp * 1000);
    return date.toLocaleDateString('vi-VN', {
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
    });
  };

  // Tính toán thời gian bảo hành còn lại
  const calculateRemaining = () => {
    if (!chainData || !chainData.expiryDate) return null;
    const now = Math.floor(Date.now() / 1000);
    const diffSec = chainData.expiryDate - now;
    if (diffSec <= 0 || chainData.status === 2) {
      return { expired: true, days: 0, percent: 0, text: '0 ngày (Đã hết hạn)' };
    }
    const days = Math.ceil(diffSec / 86400);
    const totalDurationSec = Math.max(1, chainData.expiryDate - (chainData.activationDate || (chainData.expiryDate - 365 * 86400)));
    const percent = Math.max(0, Math.min(100, Math.round((diffSec / totalDurationSec) * 100)));
    return { expired: false, days, percent };
  };

  const remaining = calculateRemaining();

  // Helper render status badge
  const renderStatusBadge = () => {
    if (!chainData) return null;
    const now = Math.floor(Date.now() / 1000);
    const isActuallyExpired = chainData.status === 2 || (chainData.status === 1 && chainData.expiryDate && now >= chainData.expiryDate);
    if (isActuallyExpired) {
      return (
        <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-bold bg-rose-500/15 text-rose-500 dark:text-rose-400 border border-rose-500/30">
          <ShieldAlert className="w-4 h-4" /> Đã hết hạn
        </span>
      );
    }
    switch (chainData.status) {
      case 1:
        return (
          <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-bold bg-emerald-500/15 text-emerald-600 dark:text-emerald-400 border border-emerald-500/30">
            <ShieldCheck className="w-4 h-4" /> Còn hiệu lực
          </span>
        );
      case 3:
        return (
          <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-bold bg-slate-500/15 text-slate-600 dark:text-slate-400 border border-slate-500/30">
            <ShieldX className="w-4 h-4" /> Bị vô hiệu hóa
          </span>
        );
      default:
        return (
          <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-bold bg-amber-500/15 text-amber-600 dark:text-amber-400 border border-amber-500/30">
            <Clock className="w-4 h-4" /> Chờ kích hoạt
          </span>
        );
    }
  };

  const getServiceTypeInfo = (type) => {
    switch (Number(type)) {
      case 0:
        return { label: 'Bảo dưỡng định kỳ', icon: Sparkles, color: 'text-sky-400 bg-sky-500/10 border-sky-500/20' };
      case 1:
        return { label: 'Sửa chữa kỹ thuật', icon: Wrench, color: 'text-amber-400 bg-amber-500/10 border-amber-500/20' };
      case 2:
        return { label: 'Thay thế linh kiện', icon: Cpu, color: 'text-purple-400 bg-purple-500/10 border-purple-500/20' };
      default:
        return { label: 'Kiểm tra & Hiệu chuẩn', icon: CheckCircle2, color: 'text-emerald-400 bg-emerald-500/10 border-emerald-500/20' };
    }
  };

  return (
    <div className="space-y-6">
      
      {/* Search Header */}
      <div className="p-6 md:p-8 rounded-3xl bg-white dark:bg-gradient-to-b dark:from-slate-900 dark:via-slate-900/90 dark:to-slate-950 border border-slate-200 dark:border-slate-800 shadow-xl dark:shadow-2xl relative overflow-hidden transition-colors">
        <div className="absolute -top-24 -right-24 w-72 h-72 bg-blue-500/10 rounded-full blur-3xl pointer-events-none" />
        <div className="max-w-2xl mx-auto text-center space-y-4 relative z-10">
          <div className="flex justify-center">
            <div className="w-20 h-20 rounded-3xl bg-slate-100 dark:bg-slate-950 border border-blue-500/40 p-1 shadow-xl shadow-blue-500/20 flex items-center justify-center">
              <img src="/logo.png" alt="TrustWarranty Logo" className="w-full h-full object-cover rounded-2xl" />
            </div>
          </div>
          <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-blue-500/10 border border-blue-500/20 text-blue-600 dark:text-blue-400 text-xs font-semibold">
            <ShieldCheck className="w-4 h-4" /> Sổ cái Bảo hành Minh bạch & Bất biến
          </div>
          <h1 className="text-2xl md:text-3xl font-extrabold text-slate-900 dark:text-white tracking-tight">
            Tra cứu Bảo hành & Lịch sử Thiết bị
          </h1>
          <p className="text-sm text-slate-600 dark:text-slate-400">
            Nhập số Serial để xác thực sản phẩm chính hãng và truy xuất lịch sử bảo dưỡng trực tiếp từ Smart Contract.
          </p>

          {/* Search Input Bar */}
          <form
            onSubmit={(e) => {
              e.preventDefault();
              onSearch(searchSerial);
            }}
            className="flex items-center gap-2 p-1.5 bg-slate-100 dark:bg-slate-950 rounded-2xl border border-slate-200 dark:border-slate-700/80 shadow-inner focus-within:border-blue-500 transition"
          >
            <div className="pl-3 text-slate-400 dark:text-slate-500">
              <Search className="w-5 h-5" />
            </div>
            <input
              type="text"
              value={searchSerial}
              onChange={(e) => setSearchSerial(e.target.value)}
              placeholder="Nhập số Serial (ví dụ: SN-APL-MAC16-9921)..."
              className="flex-1 bg-transparent border-none text-slate-900 dark:text-white text-sm focus:outline-none placeholder:text-slate-400 dark:placeholder:text-slate-500 font-mono py-2"
            />
            <button
              type="button"
              onClick={() => setShowQrScanner(true)}
              className="p-2.5 px-3 rounded-xl bg-slate-200 hover:bg-slate-300 dark:bg-slate-800 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-200 hover:text-blue-600 dark:hover:text-blue-400 transition cursor-pointer flex items-center gap-1.5 text-xs font-semibold shrink-0"
              title="Mở camera quét mã QR hoặc tải ảnh mã QR"
            >
              <Camera className="w-4 h-4 text-blue-500" />
              <span className="hidden sm:inline">Quét QR</span>
            </button>

            <button
              type="submit"
              className="px-5 py-2.5 rounded-xl bg-blue-600 hover:bg-blue-500 text-white text-xs font-bold tracking-wide transition flex items-center gap-1.5 shadow-lg shadow-blue-600/20 cursor-pointer"
            >
              <Search className="w-4 h-4" />
              <span>Tra cứu</span>
            </button>
          </form>
        </div>
      </div>

      {/* Lookup Result Content */}
      {chainData ? (
        <div className="space-y-6">

          {/* SMART EXPIRY ALERT BANNER (Cảnh báo thông minh khi bảo hành còn dưới 30 ngày) */}
          {chainData.status === 1 && remaining && !remaining.expired && remaining.days <= 30 && (
            <div className="p-4 sm:p-5 rounded-3xl bg-gradient-to-r from-amber-500/15 via-orange-500/10 to-amber-500/15 border-2 border-amber-500/40 text-amber-900 dark:text-amber-200 flex flex-col md:flex-row items-start md:items-center justify-between gap-4 shadow-lg shadow-amber-500/10 animate-fade-in">
              <div className="flex items-start gap-3.5">
                <div className="w-10 h-10 rounded-2xl bg-amber-500 text-slate-950 flex items-center justify-center shrink-0 shadow-md">
                  <AlertTriangle className="w-5 h-5 text-slate-950" />
                </div>
                <div>
                  <div className="font-extrabold text-sm text-amber-800 dark:text-amber-300 flex items-center gap-2">
                    <span>Cảnh Báo: Bảo Hành Sắp Hết Hạn On-Chain!</span>
                    <span className="text-[10px] px-2 py-0.5 rounded-full bg-amber-500/20 text-amber-700 dark:text-amber-300 font-bold border border-amber-500/40">
                      Còn {remaining.days} ngày
                    </span>
                  </div>
                  <p className="text-xs text-amber-700/90 dark:text-amber-300/80 mt-1 max-w-2xl leading-relaxed">
                    Thiết bị này sẽ hết hạn bảo hành chính hãng vào ngày <strong>{formatDate(chainData.expiryDate)}</strong>. Sau ngày này, mọi chi phí sửa chữa và thay thế linh kiện sẽ không còn được đài thọ miễn phí.
                  </p>
                </div>
              </div>

              <div className="flex items-center gap-2.5 shrink-0 w-full md:w-auto">
                <button
                  type="button"
                  onClick={handleSendExpiryAlert}
                  disabled={sendingExpiryAlert || expiryAlertSent}
                  className="flex-1 md:flex-none px-3.5 py-2 rounded-xl bg-amber-500 hover:bg-amber-600 text-slate-950 font-bold text-xs flex items-center justify-center gap-1.5 shadow-md shadow-amber-500/20 transition cursor-pointer disabled:opacity-60"
                  title="Gửi email nhắc nhở bảo hành kèm hướng dẫn chi tiết"
                >
                  <Bell className="w-3.5 h-3.5" />
                  <span>{expiryAlertSent ? 'Đã Gửi Email Nhắc' : (sendingExpiryAlert ? 'Đang gửi...' : 'Nhận Email Nhắc')}</span>
                </button>

                {onNavigate && (
                  <button
                    type="button"
                    onClick={() => onNavigate('seller')}
                    className="flex-1 md:flex-none px-3.5 py-2 rounded-xl bg-white dark:bg-slate-900 hover:bg-amber-50 dark:hover:bg-slate-800 text-amber-700 dark:text-amber-300 border border-amber-500/40 font-bold text-xs flex items-center justify-center gap-1.5 transition cursor-pointer"
                    title="Chuyển sang Cổng Đại Lý để thực hiện gia hạn bảo hành"
                  >
                    <Sparkles className="w-3.5 h-3.5 text-amber-500" />
                    <span>Gia Hạn Bảo Hành</span>
                  </button>
                )}
              </div>
            </div>
          )}

          {/* KHỐI THÔNG TIN THIẾT BỊ CHỜ KÍCH HOẠT */}
          {chainData.status === 0 && (
            <div className="p-6 sm:p-7 rounded-3xl bg-gradient-to-r from-amber-500/10 via-blue-500/10 to-indigo-500/10 border-2 border-amber-500/40 shadow-xl relative overflow-hidden animate-fade-in">
              <div className="flex flex-col lg:flex-row items-start lg:items-center justify-between gap-6">
                
                <div className="space-y-2 max-w-2xl">
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-extrabold bg-amber-500 text-slate-950 shadow-md shadow-amber-500/20">
                      <Clock className="w-3.5 h-3.5" /> Thiết Bị Chờ Kích Hoạt
                    </span>
                    <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-[11px] font-bold bg-emerald-500/15 text-emerald-700 dark:text-emerald-400 border border-emerald-500/30">
                      <ShieldCheck className="w-3.5 h-3.5" /> Đã Xác Thực Xuất Xưởng On-Chain
                    </span>
                  </div>

                  <h3 className="text-lg sm:text-xl font-black text-slate-900 dark:text-white">
                    Thiết bị chính hãng chưa bàn giao / kích hoạt
                  </h3>

                  <p className="text-xs text-slate-600 dark:text-slate-300 leading-relaxed">
                    Sản phẩm này đã được Nhà sản xuất đăng ký hợp lệ và niêm phong mật mã trên Smart Contract. Hợp đồng bảo hành điện tử chính thức sẽ được Đại lý bán lẻ kích hoạt và gán vào số điện thoại / ví Web3 của bạn khi bàn giao máy mới.
                  </p>

                  <div className="p-3 rounded-xl bg-white/60 dark:bg-slate-900/60 border border-amber-500/30 text-[11px] text-amber-800 dark:text-amber-300 flex items-center gap-2">
                    <ShieldCheck className="w-4 h-4 shrink-0 text-amber-500" />
                    <span>Tem bảo mật cào (Scratch PIN) trên vỏ hộp còn nguyên vẹn, đảm bảo thiết bị 100% nguyên bản chưa qua sử dụng.</span>
                  </div>
                </div>

                {/* Hướng dẫn hoặc Chuyển sang Cổng Đại Lý nếu là Seller */}
                <div className="w-full lg:w-72 shrink-0 bg-white dark:bg-slate-900/90 p-5 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-md space-y-3 text-center">
                  <div className="w-10 h-10 rounded-xl bg-blue-500/10 text-blue-600 dark:text-blue-400 flex items-center justify-center mx-auto">
                    <Building2 className="w-5 h-5" />
                  </div>
                  <div>
                    <h4 className="text-xs font-bold text-slate-900 dark:text-white">Quy Trình Kích Hoạt</h4>
                    <p className="text-[11px] text-slate-500 dark:text-slate-400 mt-1">
                      Thủ tục kích hoạt on-chain do Đại lý bán lẻ ủy quyền thực hiện theo quy chuẩn bảo mật.
                    </p>
                  </div>
                  {currentUser?.role === 'SELLER' && onNavigate && (
                    <button
                      type="button"
                      onClick={() => onNavigate('seller')}
                      className="w-full py-2.5 rounded-xl bg-blue-600 hover:bg-blue-500 text-white font-bold text-xs shadow-md shadow-blue-600/30 transition flex items-center justify-center gap-1.5 cursor-pointer"
                    >
                      <Store className="w-4 h-4" />
                      <span>Mở Cổng Đại Lý Kích Hoạt</span>
                    </button>
                  )}
                </div>

              </div>
            </div>
          )}

          {/* Product Overview Card */}
          <div className="glass-card rounded-3xl p-6 border border-slate-200 dark:border-slate-800 relative overflow-hidden transition-colors">
            <div className="flex flex-col md:flex-row items-start md:items-center justify-between gap-6 pb-6 border-b border-slate-200 dark:border-slate-800/80">
              
              <div className="flex items-center gap-5">
                {productData?.imageUrl && (
                  <img
                    src={productData.imageUrl}
                    alt={productData?.name || 'Sản phẩm'}
                    className="w-20 h-20 md:w-24 md:h-24 rounded-2xl object-cover border border-slate-200 dark:border-slate-700/80 shadow-md"
                  />
                )}
                <div className="space-y-1">
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className="text-xs font-bold uppercase tracking-wider text-blue-600 dark:text-blue-400 bg-blue-500/10 px-2 py-0.5 rounded border border-blue-500/20">
                      {productData?.brand || 'Verified Device'}
                    </span>
                    <span className="text-xs text-slate-500 dark:text-slate-400 font-mono">
                      Model: {chainData.modelCode}
                    </span>
                  </div>
                  <h2 className="text-xl md:text-2xl font-bold text-slate-900 dark:text-white">
                    {productData?.name || chainData.serialNumber}
                  </h2>
                  <div className="flex items-center gap-2 text-xs text-slate-500 dark:text-slate-400 font-mono">
                    <Hash className="w-3.5 h-3.5 text-slate-400" />
                    <span>Serial: <strong className="text-slate-800 dark:text-slate-200">{chainData.serialNumber}</strong></span>
                  </div>
                </div>
              </div>

              {/* Status Badge & Digital Pass & Transfer actions */}
              <div className="flex flex-col items-start md:items-end gap-2.5">
                <div className="flex items-center gap-2">
                  {renderStatusBadge()}
                  {remaining && !remaining.expired && (
                    <div className="text-xs text-slate-500 dark:text-slate-400 flex items-center gap-1 font-mono">
                      <Clock className="w-3.5 h-3.5 text-blue-500 dark:text-blue-400" />
                      <span>Còn lại: <strong className="text-slate-900 dark:text-white">{remaining.days} ngày</strong></span>
                    </div>
                  )}
                </div>

                <div className="flex flex-wrap items-center gap-2">
                  {/* Digital Pass Modal Button */}
                  <button
                    onClick={() => setShowDigitalPass(true)}
                    className="px-3 py-1.5 rounded-xl bg-blue-500/10 hover:bg-blue-500/20 text-blue-600 dark:text-blue-400 border border-blue-500/30 text-xs font-semibold flex items-center gap-1.5 transition cursor-pointer"
                  >
                    <QrCode className="w-3.5 h-3.5" />
                    <span>Thẻ số</span>
                  </button>

                  {/* Warranty Certificate PDF Button */}
                  <button
                    onClick={() => setShowCertificateModal(true)}
                    className="px-3 py-1.5 rounded-xl bg-amber-500/10 hover:bg-amber-500/20 text-amber-600 dark:text-amber-400 border border-amber-500/30 text-xs font-semibold flex items-center gap-1.5 transition cursor-pointer shadow-sm"
                    title="Xuất Giấy Chứng Nhận Bảo Hành Điện Tử Chuẩn A4 (PDF)"
                  >
                    <FileText className="w-3.5 h-3.5" />
                    <span>Chứng nhận PDF</span>
                  </button>

                  {/* RMA Defect Report Ticket Button */}
                  <button
                    onClick={() => setShowRmaModal(true)}
                    className="px-3 py-1.5 rounded-xl bg-rose-500/10 hover:bg-rose-500/20 text-rose-600 dark:text-rose-400 border border-rose-500/30 text-xs font-semibold flex items-center gap-1.5 transition cursor-pointer"
                    title="Gửi yêu cầu bảo hành hoặc sửa chữa kỹ thuật tới trạm ủy quyền"
                  >
                    <Wrench className="w-3.5 h-3.5" />
                    <span>Yêu cầu RMA</span>
                  </button>

                  </div>
              </div>
            </div>

            {/* Warranty Countdown Bar */}
            {chainData.status === 1 && remaining && (
              <div className="py-4 border-b border-slate-200 dark:border-slate-800/80 space-y-2">
                <div className="flex justify-between text-xs text-slate-500 dark:text-slate-400">
                  <span className="flex items-center gap-1">
                    <Calendar className="w-3.5 h-3.5 text-emerald-500" />
                    Kích hoạt: {formatDate(chainData.activationDate)}
                  </span>
                  <span className="flex items-center gap-1">
                    <Calendar className="w-3.5 h-3.5 text-rose-500" />
                    Hết hạn: {formatDate(chainData.expiryDate)}
                  </span>
                </div>
                <div className="w-full h-2 rounded-full bg-slate-200 dark:bg-slate-800 overflow-hidden">
                  <div
                    className="h-full bg-gradient-to-r from-blue-500 to-emerald-500 transition-all duration-500"
                    style={{ width: `${remaining.percent}%` }}
                  />
                </div>
              </div>
            )}

            {/* Blockchain On-Chain Provenance Info */}
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 pt-5 text-xs">
              <div className="p-3 rounded-xl bg-slate-50 dark:bg-slate-950/60 border border-slate-200 dark:border-slate-800/80">
                <div className="text-slate-500 dark:text-slate-400 mb-1 flex items-center gap-1">
                  <Building2 className="w-3.5 h-3.5 text-blue-500" /> Nhà sản xuất
                </div>
                <div className="font-mono text-slate-800 dark:text-slate-300 truncate" title={chainData.manufacturer}>
                  {chainData.manufacturer ? `${chainData.manufacturer.slice(0, 10)}...` : 'Hệ thống'}
                </div>
              </div>

              <div className="p-3 rounded-xl bg-slate-50 dark:bg-slate-950/60 border border-slate-200 dark:border-slate-800/80">
                <div className="text-slate-500 dark:text-slate-400 mb-1 flex items-center gap-1">
                  <UserCheck className="w-3.5 h-3.5 text-emerald-500" /> Chủ sở hữu hiện tại
                </div>
                <div className="font-mono text-slate-800 dark:text-slate-300 truncate" title={chainData.currentOwner}>
                  {chainData.currentOwner && chainData.currentOwner !== '0x0000000000000000000000000000000000000000'
                    ? `${chainData.currentOwner.slice(0, 10)}...`
                    : 'Chưa chuyển giao'}
                </div>
              </div>

              <div className="p-3 rounded-xl bg-slate-50 dark:bg-slate-950/60 border border-slate-200 dark:border-slate-800/80">
                <div className="text-slate-500 dark:text-slate-400 mb-1 flex items-center gap-1">
                  <Calendar className="w-3.5 h-3.5 text-amber-500" /> Ngày xuất xưởng
                </div>
                <div className="font-semibold text-slate-800 dark:text-slate-200">
                  {formatDate(chainData.manufactureDate)} ({chainData.warrantyMonths} tháng BH)
                </div>
              </div>

              <div className="p-3 rounded-xl bg-slate-50 dark:bg-slate-950/60 border border-slate-200 dark:border-slate-800/80">
                <div className="text-slate-500 dark:text-slate-400 mb-1 flex items-center gap-1">
                  <Hash className="w-3.5 h-3.5 text-purple-500" /> Tx Gốc (Khởi tạo)
                </div>
                <div className="font-mono text-slate-800 dark:text-slate-300 truncate" title={chainData.txHash}>
                  {chainData.txHash ? `${chainData.txHash.slice(0, 12)}...` : 'Block #104210'}
                </div>
              </div>
            </div>
          </div>

          {/* Navigation Tabs (Timeline vs Specs) */}
          <div className="flex border-b border-slate-200 dark:border-slate-800 gap-6">
            <button
              onClick={() => setActiveTab('timeline')}
              className={`pb-3 text-sm font-bold flex items-center gap-2 border-b-2 transition cursor-pointer ${
                activeTab === 'timeline'
                  ? 'border-blue-500 text-blue-600 dark:text-blue-400'
                  : 'border-transparent text-slate-500 hover:text-slate-800 dark:text-slate-400 dark:hover:text-slate-200'
              }`}
            >
              <Wrench className="w-4 h-4" />
              <span>Lịch sử Dịch vụ On-Chain ({serviceHistory?.length || 0})</span>
            </button>

            <button
              onClick={() => setActiveTab('specs')}
              className={`pb-3 text-sm font-bold flex items-center gap-2 border-b-2 transition cursor-pointer ${
                activeTab === 'specs'
                  ? 'border-blue-500 text-blue-600 dark:text-blue-400'
                  : 'border-transparent text-slate-500 hover:text-slate-800 dark:text-slate-400 dark:hover:text-slate-200'
              }`}
            >
              <Cpu className="w-4 h-4" />
              <span>Thông số Kỹ thuật & Hỗ trợ</span>
            </button>
          </div>

          {/* Tab 1: Service History Timeline */}
          {activeTab === 'timeline' && (
            <div className="space-y-4">
              {serviceHistory && serviceHistory.length > 0 ? (
                <div className="relative pl-6 border-l-2 border-slate-200 dark:border-slate-800 space-y-6">
                  {serviceHistory.map((item, idx) => {
                    const info = getServiceTypeInfo(item.serviceType);
                    const TypeIcon = info.icon;
                    return (
                      <div key={idx} className="relative group">
                        <div className="absolute -left-[33px] top-1 w-6 h-6 rounded-full bg-white dark:bg-slate-900 border-2 border-blue-500 flex items-center justify-center text-blue-500 dark:text-blue-400 shadow-md shadow-blue-500/20">
                          <div className="w-2 h-2 rounded-full bg-blue-500 dark:bg-blue-400" />
                        </div>

                        <div className="glass-card rounded-2xl p-5 border border-slate-200 dark:border-slate-800 group-hover:border-slate-300 dark:group-hover:border-slate-700 transition">
                          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 pb-3 border-b border-slate-200 dark:border-slate-800/80">
                            <div className="flex items-center gap-2">
                              <span className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-xs font-bold border ${info.color}`}>
                                <TypeIcon className="w-3.5 h-3.5" />
                                {info.label}
                              </span>
                              <span className="text-xs text-slate-500 font-mono">
                                Mã phiếu #{item.recordId}
                              </span>
                            </div>

                            <div className="text-xs text-slate-500 dark:text-slate-400 flex items-center gap-1 font-mono">
                              <Clock className="w-3.5 h-3.5 text-slate-400 dark:text-slate-500" />
                              {formatDate(item.timestamp)}
                            </div>
                          </div>

                          <div className="pt-3 space-y-2 text-xs">
                            <p className="text-slate-800 dark:text-slate-200 font-medium text-sm">
                              {item.notes}
                            </p>

                            <div className="grid grid-cols-1 sm:grid-cols-3 gap-2 pt-2 text-slate-600 dark:text-slate-400">
                              <div className="p-2 rounded-lg bg-slate-50 dark:bg-slate-950/50 border border-slate-200 dark:border-slate-800/60">
                                <span className="text-slate-500 block mb-0.5">Linh kiện thay thế:</span>
                                <span className="text-slate-800 dark:text-slate-200 font-semibold">{item.replacedPart || 'Không'}</span>
                              </div>

                              <div className="p-2 rounded-lg bg-slate-50 dark:bg-slate-950/50 border border-slate-200 dark:border-slate-800/60">
                                <span className="text-slate-500 block mb-0.5">Kỹ thuật viên:</span>
                                <span className="text-slate-800 dark:text-slate-200 font-mono">{item.technicianId || 'KTV ủy quyền'}</span>
                              </div>

                              <div className="p-2 rounded-lg bg-slate-50 dark:bg-slate-950/50 border border-slate-200 dark:border-slate-800/60">
                                <span className="text-slate-500 block mb-0.5">Tx Hash ghi nhận:</span>
                                <span className="text-blue-600 dark:text-blue-400 font-mono truncate block" title={item.txHash}>
                                  {item.txHash ? `${item.txHash.slice(0, 10)}...` : 'Confirmed'}
                                </span>
                              </div>
                            </div>
                          </div>
                        </div>
                      </div>
                    );
                  })}
                </div>
              ) : (
                <div className="text-center py-12 rounded-3xl glass-card border border-slate-200 dark:border-slate-800 space-y-3">
                  <div className="w-12 h-12 rounded-full bg-emerald-500/10 text-emerald-500 dark:text-emerald-400 border border-emerald-500/20 flex items-center justify-center mx-auto">
                    <CheckCircle2 className="w-6 h-6" />
                  </div>
                  <h3 className="text-base font-bold text-slate-900 dark:text-white">Chưa có bản ghi sửa chữa</h3>
                  <p className="text-xs text-slate-600 dark:text-slate-400 max-w-md mx-auto">
                    Sản phẩm này chưa từng phải bảo hành hay sửa chữa, tình trạng vận hành hoàn toàn bình thường.
                  </p>
                </div>
              )}
            </div>
          )}

          {/* Tab 2: Specs */}
          {activeTab === 'specs' && (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="glass-card rounded-2xl p-5 border border-slate-200 dark:border-slate-800 space-y-4">
                <h3 className="text-sm font-bold text-slate-900 dark:text-white flex items-center gap-2 border-b border-slate-200 dark:border-slate-800 pb-3">
                  <Cpu className="w-4 h-4 text-blue-500 dark:text-blue-400" />
                  Thông số kỹ thuật chính (Backend Data)
                </h3>
                {productData?.specs ? (
                  <dl className="space-y-2.5 text-xs">
                    {Object.entries(productData.specs).map(([key, val]) => (
                      <div key={key} className="flex justify-between py-1 border-b border-slate-200/80 dark:border-slate-800/50">
                        <dt className="text-slate-500 dark:text-slate-400 capitalize">{key}:</dt>
                        <dd className="text-slate-800 dark:text-slate-200 font-medium text-right max-w-[65%]">{val}</dd>
                      </div>
                    ))}
                  </dl>
                ) : (
                  <p className="text-xs text-slate-500">Chưa cập nhật thông số chi tiết.</p>
                )}
              </div>

              <div className="glass-card rounded-2xl p-5 border border-slate-200 dark:border-slate-800 space-y-4">
                <h3 className="text-sm font-bold text-slate-900 dark:text-white flex items-center gap-2 border-b border-slate-200 dark:border-slate-800 pb-3">
                  <FileText className="w-4 h-4 text-emerald-500 dark:text-emerald-400" />
                  Tài liệu & Trung tâm Hỗ trợ
                </h3>
                <div className="space-y-3 text-xs">
                  <div className="p-3 rounded-xl bg-slate-50 dark:bg-slate-950/60 border border-slate-200 dark:border-slate-800/80">
                    <div className="font-semibold text-slate-800 dark:text-slate-200 mb-1">Chính sách bảo hành hợp lệ</div>
                    <p className="text-slate-600 dark:text-slate-400 leading-relaxed">
                      {productData?.documentation?.serviceCoverage || 'Bảo hành chính hãng tại tất cả trung tâm dịch vụ ủy quyền.'}
                    </p>
                  </div>
                </div>
              </div>
            </div>
          )}

        </div>
      ) : (
        <div className="text-center py-16 rounded-3xl glass-card border border-slate-200 dark:border-slate-800 space-y-3">
          <div className="w-12 h-12 rounded-full bg-slate-100 dark:bg-slate-800/60 text-slate-400 flex items-center justify-center mx-auto">
            <Search className="w-6 h-6" />
          </div>
          <h3 className="text-base font-bold text-slate-900 dark:text-white">Chưa có thông tin tra cứu</h3>
          <p className="text-xs text-slate-600 dark:text-slate-400 max-w-md mx-auto">
            Nhập số Serial ở ô tìm kiếm phía trên để tra cứu dữ liệu bảo hành và lịch sử bảo dưỡng trực tiếp từ Smart Contract.
          </p>
        </div>
      )}

      {/* Digital Pass Modal */}
      {showDigitalPass && chainData && (
        <DigitalWarrantyCard
          product={productData}
          chainData={chainData}
          onClose={() => setShowDigitalPass(false)}
        />
      )}



      
      {/* Warranty Certificate Modal */}
      {showCertificateModal && (
        <WarrantyCertificateModal
          product={productData}
          chainData={chainData}
          onClose={() => setShowCertificateModal(false)}
        />
      )}

      {/* RMA Defect Report Modal */}
      {showRmaModal && (
        <RmaRequestModal
          product={productData}
          chainData={chainData}
          serviceCenters={serviceCenters || []}
          onClose={() => setShowRmaModal(false)}
          onSuccess={(ticket) => {
            if (onNotify) {
              onNotify({
                type: 'success',
                title: 'Tạo phiếu RMA thành công',
                message: `Phiếu yêu cầu [${ticket.id}] đã được gửi tới hàng đợi của trạm kỹ thuật.`,
              });
            }
          }}
        />
      )}

      {/* Live Camera QR Scanner Modal */}
      {showQrScanner && (
        <QrCameraScannerModal
          isOpen={showQrScanner}
          onClose={() => setShowQrScanner(false)}
          onScanSuccess={handleQrScanSuccess}
          title="Quét Mã QR Tra Cứu Bảo Hành"
        />
      )}

    </div>
  );
}
