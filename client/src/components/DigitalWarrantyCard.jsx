import React, { useState, useRef } from 'react';
import ReactDOM from 'react-dom';
import html2canvas from 'html2canvas';
import {
  ShieldCheck,
  QrCode,
  CheckCircle2,
  AlertTriangle,
  Clock,
  ShieldX,
  X,
  Share2,
  Download,
  Copy,
  Hash,
  Calendar,
  Building2,
  Sparkles,
  Check,
  Printer,
  RefreshCw
} from 'lucide-react';

export default function DigitalWarrantyCard({ product, chainData, onClose }) {
  const [copied, setCopied] = useState(false);
  const [downloadingImg, setDownloadingImg] = useState(false);
    const cardRef = useRef(null);

  if (!chainData) return null;

  const verifyUrl = `${window.location.origin}/?serial=${encodeURIComponent(chainData.serialNumber)}`;

  const handleCopyLink = () => {
    navigator.clipboard.writeText(verifyUrl);
    setCopied(true);
    setTimeout(() => setCopied(false), 2500);
  };

  const handleDownloadImage = async () => {
    if (!cardRef.current) return;
    setDownloadingImg(true);
    try {
      const canvas = await html2canvas(cardRef.current, {
        scale: 3,
        useCORS: true,
        backgroundColor: '#0a0f1d',
        logging: false,
      });
      const link = document.createElement('a');
      link.download = `The_Bao_Hanh_${chainData.serialNumber}.png`;
      link.href = canvas.toDataURL('image/png');
      link.click();
    } catch (err) {
      console.error('Lỗi khi tải ảnh thẻ bảo hành:', err);
      alert('Không thể tạo file ảnh thẻ: ' + err.message);
    } finally {
      setDownloadingImg(false);
    }
  };

  const handlePrintCard = () => {
    window.print();
  };

  const formatDate = (timestamp) => {
    if (!timestamp) return 'Chưa kích hoạt';
    return new Date(timestamp * 1000).toLocaleDateString('vi-VN', {
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
    });
  };

  const modalContent = (
    <div className="fixed inset-0 z-[99999] flex items-center justify-center p-4 bg-black/80 backdrop-blur-md animate-fade-in">
      <div className="relative w-full max-w-md bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700/80 rounded-3xl p-6 shadow-2xl space-y-6">
        
        {/* Close Button */}
        <button
          onClick={onClose}
          className="absolute top-4 right-4 p-2 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-500 hover:text-slate-800 dark:bg-slate-800 dark:text-slate-400 dark:hover:text-white transition cursor-pointer"
        >
          <X className="w-5 h-5" />
        </button>

        {/* Modal Title */}
        <div className="flex items-center gap-2 text-xs font-bold text-blue-400 uppercase tracking-wider">
          <Sparkles className="w-4 h-4" />
          <span>Thẻ Bảo Hành Kỹ Thuật Số (Digital Pass)</span>
        </div>

        {/* Apple Wallet Style Digital Card */}
        <div 
          ref={cardRef}
          className="relative rounded-3xl p-6 bg-gradient-to-br from-indigo-950 via-slate-900 to-blue-950 border border-blue-500/30 shadow-xl overflow-hidden space-y-5 text-white"
        >
          {/* Subtle Glows */}
          <div className="absolute -top-12 -right-12 w-40 h-40 bg-blue-500/20 rounded-full blur-2xl pointer-events-none" />
          <div className="absolute -bottom-12 -left-12 w-40 h-40 bg-indigo-500/20 rounded-full blur-2xl pointer-events-none" />

          {/* Card Header */}
          <div className="flex items-start justify-between relative z-10">
            <div>
              <span className="text-[10px] font-extrabold uppercase tracking-widest text-blue-400 bg-blue-500/10 px-2 py-0.5 rounded border border-blue-500/20">
                {product?.brand || 'CHÍNH HÃNG'}
              </span>
              <h3 className="text-lg font-extrabold mt-1 text-slate-100">
                {product?.name || chainData.serialNumber}
              </h3>
              <p className="text-xs text-slate-400 font-mono">Model: {chainData.modelCode}</p>
            </div>

            <div className="w-11 h-11 rounded-2xl bg-slate-950 border border-blue-500/40 p-0.5 overflow-hidden shadow-lg shadow-blue-500/30 flex items-center justify-center shrink-0">
              <img src="/logo.png" alt="TrustWarranty Logo" className="w-full h-full object-cover rounded-xl" />
            </div>
          </div>

          {/* Card Middle: Genuine Stamp & QR Code */}
          <div className="flex items-center justify-between p-4 rounded-2xl bg-slate-950/60 border border-white/5 relative z-10">
            <div className="space-y-2 text-xs">
              <div>
                <span className="text-slate-500 text-[10px] block">MÃ ĐỊNH DANH (SERIAL)</span>
                <span className="font-mono font-bold text-slate-200 text-xs">{chainData.serialNumber}</span>
              </div>

              <div>
                <span className="text-slate-500 text-[10px] block">HẠN BẢO HÀNH ON-CHAIN</span>
                <span className="font-semibold text-emerald-400 text-xs">
                  {formatDate(chainData.expiryDate)}
                </span>
              </div>

              <div>
                <span className="text-slate-500 text-[10px] block">TRẠNG THÁI BẢO HÀNH</span>
                {(() => {
                  const now = Math.floor(Date.now() / 1000);
                  const isExpired = chainData.status === 2 || (chainData.status === 1 && chainData.expiryDate && now >= chainData.expiryDate);
                  if (isExpired) {
                    return (
                      <span className="inline-flex items-center gap-1 text-[11px] font-bold text-rose-400">
                        <AlertTriangle className="w-3.5 h-3.5" />
                        ĐÃ HẾT HẠN
                      </span>
                    );
                  }
                  if (chainData.status === 1) {
                    return (
                      <span className="inline-flex items-center gap-1 text-[11px] font-bold text-emerald-400">
                        <CheckCircle2 className="w-3.5 h-3.5" />
                        ĐANG CÒN HẠN
                      </span>
                    );
                  }
                  if (chainData.status === 3) {
                    return (
                      <span className="inline-flex items-center gap-1 text-[11px] font-bold text-slate-400">
                        <ShieldX className="w-3.5 h-3.5" />
                        BỊ VÔ HIỆU HÓA
                      </span>
                    );
                  }
                  return (
                    <span className="inline-flex items-center gap-1 text-[11px] font-bold text-amber-400">
                      <Clock className="w-3.5 h-3.5" />
                      CHỜ KÍCH HOẠT
                    </span>
                  );
                })()}
              </div>
            </div>

            {/* Dynamic QR Image Generator */}
            <div className="p-2 rounded-xl bg-white text-slate-950 shadow-inner flex flex-col items-center">
              <img 
                src={`https://api.qrserver.com/v1/create-qr-code/?size=120x120&data=${encodeURIComponent(verifyUrl)}`} 
                alt="QR Code" 
                className="w-16 h-16 object-contain"
                crossOrigin="anonymous"
              />
              <span className="text-[7.5px] font-mono text-slate-700 font-bold mt-1">SCAN TO VERIFY</span>
            </div>
          </div>

          {/* Card Footer: Wallet & Hash */}
          <div className="relative z-10 pt-1 flex items-center justify-between text-[10px] text-slate-400 font-mono border-t border-white/10">
            <div>
              <span className="text-slate-500">Chủ sở hữu:</span>{' '}
              <span>{chainData.currentOwner ? `${chainData.currentOwner.slice(0, 8)}...${chainData.currentOwner.slice(-4)}` : 'Chưa gán ví'}</span>
            </div>
            <div className="text-blue-400 font-bold">
              VERIFIED BY EVM
            </div>
          </div>

        </div>

        {/* Action Buttons */}
        <div className="grid grid-cols-3 gap-2 text-xs">
          <button
            type="button"
            onClick={handleDownloadImage}
            disabled={downloadingImg}
            className="p-2.5 rounded-xl font-bold bg-blue-600 hover:bg-blue-500 text-white flex items-center justify-center gap-1.5 shadow-lg shadow-blue-600/20 transition cursor-pointer disabled:opacity-50"
            title="Tải ảnh thẻ số độ nét cao về điện thoại / máy tính"
          >
            {downloadingImg ? <RefreshCw className="w-3.5 h-3.5 animate-spin" /> : <Download className="w-3.5 h-3.5" />}
            <span>{downloadingImg ? 'Đang tải...' : 'Tải Ảnh (PNG)'}</span>
          </button>

          <button
            type="button"
            onClick={handlePrintCard}
            className="p-2.5 rounded-xl font-semibold bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-200 border border-slate-200 dark:border-slate-700/80 flex items-center justify-center gap-1.5 transition cursor-pointer"
            title="In thẻ bảo hành trực tiếp"
          >
            <Printer className="w-3.5 h-3.5" />
            <span>In Thẻ</span>
          </button>

          <button
            type="button"
            onClick={handleCopyLink}
            className={`p-2.5 rounded-xl font-semibold border flex items-center justify-center gap-1.5 transition cursor-pointer ${
              copied
                ? 'bg-emerald-500/20 text-emerald-600 dark:text-emerald-300 border-emerald-500/40'
                : 'bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-200 border-slate-200 dark:border-slate-700/80'
            }`}
          >
            {copied ? <Check className="w-3.5 h-3.5 text-emerald-500 dark:text-emerald-400" /> : <Copy className="w-3.5 h-3.5" />}
            <span>{copied ? 'Đã sao chép' : 'Sao chép Link'}</span>
          </button>
        </div>

        </div>


    </div>
  );

  return typeof document !== 'undefined' ? ReactDOM.createPortal(modalContent, document.body) : modalContent;
}
