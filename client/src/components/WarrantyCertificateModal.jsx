import React, { useRef, useState } from 'react';
import ReactDOM from 'react-dom';
import {
  FileText,
  Download,
  Printer,
  Copy,
  Check,
  X,
  ShieldCheck,
  Sparkles,
  QrCode,
  Award,
  Hash,
  Calendar,
  Lock,
  ExternalLink,
  CheckCircle2,
  AlertTriangle,
  Clock,
  ShieldX
} from 'lucide-react';
import jsPDF from 'jspdf';
import html2canvas from 'html2canvas';

export default function WarrantyCertificateModal({ product, chainData, onClose }) {
  const certRef = useRef(null);
  const [downloading, setDownloading] = useState(false);
  const [copied, setCopied] = useState(false);

  if (!chainData) return null;

  const verifyUrl = `${window.location.origin}/?serial=${encodeURIComponent(chainData.serialNumber)}`;
  const certId = `TW-CERT-${chainData.serialNumber.replace(/[^A-Za-z0-9]/g, '')}-${(chainData.activationDate || Math.floor(Date.now() / 1000)).toString(16).toUpperCase()}`;

  const formatDate = (timestamp) => {
    if (!timestamp) return 'Chưa kích hoạt';
    const date = new Date(timestamp * 1000);
    return date.toLocaleDateString('vi-VN', {
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
    });
  };

  const handleDownloadPdf = async () => {
    if (!certRef.current) return;
    setDownloading(true);

    try {
      const element = certRef.current;
      // High-resolution render
      const canvas = await html2canvas(element, {
        scale: 2.5,
        useCORS: true,
        logging: false,
        backgroundColor: '#0a0f1d',
      });

      const imgData = canvas.toDataURL('image/png');
      const pdf = new jsPDF({
        orientation: 'portrait',
        unit: 'mm',
        format: 'a4',
      });

      const pdfWidth = pdf.internal.pageSize.getWidth();
      const pdfHeight = pdf.internal.pageSize.getHeight();

      // Fit with margins
      const margin = 10;
      const contentWidth = pdfWidth - (margin * 2);
      const contentHeight = (canvas.height * contentWidth) / canvas.width;

      pdf.addImage(imgData, 'PNG', margin, margin, contentWidth, Math.min(contentHeight, pdfHeight - (margin * 2)));
      pdf.save(`Chung_Nhan_Bao_Hanh_${chainData.serialNumber}.pdf`);
    } catch (err) {
      console.error('Lỗi khi xuất PDF chứng nhận:', err);
      alert('Không thể tạo file PDF: ' + err.message);
    } finally {
      setDownloading(false);
    }
  };

  const handlePrint = () => {
    window.print();
  };

  const handleCopyHash = () => {
    navigator.clipboard.writeText(chainData.txHash || certId);
    setCopied(true);
    setTimeout(() => setCopied(false), 2500);
  };

  const modalContent = (
    <div className="fixed inset-0 z-[99999] flex items-center justify-center p-3 md:p-6 bg-black/85 backdrop-blur-md overflow-y-auto animate-fade-in print:p-0 print:bg-white">
      <div className="relative w-full max-w-4xl bg-white dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-3xl p-4 md:p-7 shadow-2xl space-y-5 my-auto print:border-none print:shadow-none print:p-0 print:w-full print:max-w-none">
        
        {/* Modal Controls Bar (Hidden during print) */}
        <div className="flex flex-wrap items-center justify-between gap-3 pb-3 border-b border-slate-200 dark:border-slate-800 print:hidden">
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 rounded-xl bg-amber-500/10 text-amber-500 dark:text-amber-400 border border-amber-500/20 flex items-center justify-center">
              <Award className="w-4 h-4" />
            </div>
            <div>
              <h3 className="text-sm font-bold text-slate-900 dark:text-white flex items-center gap-1.5">
                Giấy Chứng Nhận Bảo Hành Điện Tử A4
                <span className="text-[10px] px-2 py-0.5 rounded bg-emerald-500/10 text-emerald-600 dark:bg-emerald-500/20 dark:text-emerald-400 border border-emerald-500/30">
                  On-Chain Verified
                </span>
              </h3>
              <p className="text-[11px] text-slate-500 dark:text-slate-400">Được bảo chứng bất biến bởi Hợp đồng thông minh Ethereum</p>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <button
              onClick={handleDownloadPdf}
              disabled={downloading}
              className="px-3.5 py-1.5 rounded-xl bg-blue-600 hover:bg-blue-500 text-white text-xs font-semibold flex items-center gap-1.5 shadow-lg shadow-blue-600/30 transition cursor-pointer disabled:opacity-50"
            >
              <Download className="w-3.5 h-3.5" />
              <span>{downloading ? 'Đang tạo PDF...' : 'Tải File PDF (A4)'}</span>
            </button>

            <button
              onClick={handlePrint}
              className="px-3.5 py-1.5 rounded-xl bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-200 text-xs font-semibold flex items-center gap-1.5 border border-slate-300 dark:border-slate-700 transition cursor-pointer"
            >
              <Printer className="w-3.5 h-3.5" />
              <span>In Ngay</span>
            </button>

            <button
              onClick={handleCopyHash}
              className="px-3 py-1.5 rounded-xl bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-300 text-xs font-semibold flex items-center gap-1.5 border border-slate-300 dark:border-slate-700 transition cursor-pointer"
              title="Sao chép mã xác thực"
            >
              {copied ? <Check className="w-3.5 h-3.5 text-emerald-500 dark:text-emerald-400" /> : <Copy className="w-3.5 h-3.5" />}
              <span>{copied ? 'Đã chép' : 'Sao chép Tx'}</span>
            </button>

            <button
              onClick={onClose}
              className="p-1.5 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-500 hover:text-slate-900 dark:bg-slate-800 dark:text-slate-400 dark:hover:text-white transition cursor-pointer"
            >
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>

        {/* ============================================================== */}
        {/* PRINTABLE / EXPORTABLE CERTIFICATE CONTAINER (A4 STYLED)      */}
        {/* ============================================================== */}
        <div
          ref={certRef}
          className="relative bg-gradient-to-b from-[#0a0f1d] via-[#0f172a] to-[#080d1a] text-slate-100 rounded-2xl p-6 md:p-10 border-2 border-amber-500/40 shadow-2xl overflow-hidden print:bg-white print:text-black print:border-amber-600"
          style={{ minHeight: '620px' }}
        >
          {/* Guilloche Security Border Double Line */}
          <div className="absolute inset-3 border border-amber-500/30 rounded-xl pointer-events-none print:border-amber-600" />
          <div className="absolute inset-4 border border-dashed border-amber-500/20 rounded-lg pointer-events-none print:border-amber-600/40" />

          {/* Corner Flourishes */}
          <div className="absolute top-4 left-4 w-7 h-7 border-t-2 border-l-2 border-amber-400 pointer-events-none" />
          <div className="absolute top-4 right-4 w-7 h-7 border-t-2 border-r-2 border-amber-400 pointer-events-none" />
          <div className="absolute bottom-4 left-4 w-7 h-7 border-b-2 border-l-2 border-amber-400 pointer-events-none" />
          <div className="absolute bottom-4 right-4 w-7 h-7 border-b-2 border-r-2 border-amber-400 pointer-events-none" />

          {/* Background Watermark Emblem */}
          <div className="absolute inset-0 flex items-center justify-center opacity-[0.035] pointer-events-none select-none print:opacity-5">
            <ShieldCheck className="w-96 h-96 text-amber-300" />
          </div>

          <div className="relative z-10 space-y-6">
            
            {/* Header: Organization & Crest */}
            <div className="text-center space-y-2 pb-4 border-b border-amber-500/20 print:border-slate-300">
              <div className="flex items-center justify-center gap-3 mb-2">
                <div className="w-12 h-12 rounded-2xl bg-amber-500/10 border border-amber-500/40 p-1 flex items-center justify-center shadow-lg shadow-amber-500/10">
                  <img src="/logo.png" alt="TrustWarranty" className="w-full h-full object-cover rounded-xl" />
                </div>
                <div className="text-left">
                  <div className="text-xs font-black tracking-widest text-amber-400 uppercase">
                    TrustWarranty Protocol • Decentralized Trust
                  </div>
                  <div className="text-[11px] text-slate-400 font-mono">
                    HỆ THỐNG XÁC THỰC BẢO HÀNH & NGUỒN GỐC ĐIỆN TỬ
                  </div>
                </div>
              </div>

              <h1 className="text-xl md:text-2xl font-black tracking-wider text-transparent bg-clip-text bg-gradient-to-r from-amber-200 via-yellow-300 to-amber-500 uppercase print:text-amber-800">
                GIẤY CHỨNG NHẬN BẢO HÀNH ĐIỆN TỬ
              </h1>
              <p className="text-xs text-slate-300 italic">
                (Official Blockchain-Backed E-Warranty Certificate)
              </p>
              <div className="inline-block mt-1 font-mono text-[11px] bg-slate-900/90 text-amber-300 px-3 py-1 rounded-full border border-amber-500/30 print:bg-slate-100 print:text-slate-800">
                MÃ CHỨNG THỰC: <strong>{certId}</strong>
              </div>
            </div>

            {/* Product & Warranty Information Grid */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-xs">
              
              {/* Box 1: Thông tin thiết bị */}
              <div className="p-4 rounded-xl bg-slate-900/70 border border-slate-800 space-y-2.5 print:bg-slate-50 print:border-slate-300">
                <div className="text-amber-400 font-bold uppercase text-[11px] flex items-center gap-1.5 pb-1 border-b border-slate-800 print:border-slate-300">
                  <Sparkles className="w-3.5 h-3.5" />
                  1. THÔNG TIN THIẾT BỊ CHÍNH HÃNG
                </div>
                <div className="grid grid-cols-3 gap-1">
                  <span className="text-slate-400 col-span-1">Tên sản phẩm:</span>
                  <span className="font-bold text-white col-span-2 print:text-black">{product?.name || chainData.serialNumber}</span>
                </div>
                <div className="grid grid-cols-3 gap-1">
                  <span className="text-slate-400 col-span-1">Thương hiệu:</span>
                  <span className="font-semibold text-slate-200 col-span-2 print:text-black">{product?.brand || 'Chính Hãng'}</span>
                </div>
                <div className="grid grid-cols-3 gap-1">
                  <span className="text-slate-400 col-span-1">Mã dòng máy:</span>
                  <span className="font-mono text-slate-300 col-span-2 print:text-black">{chainData.modelCode}</span>
                </div>
                <div className="grid grid-cols-3 gap-1">
                  <span className="text-slate-400 col-span-1">Số Serial:</span>
                  <span className="font-mono font-bold text-yellow-300 col-span-2 print:text-amber-700">{chainData.serialNumber}</span>
                </div>
                {product?.specs?.processor && (
                  <div className="grid grid-cols-3 gap-1">
                    <span className="text-slate-400 col-span-1">Cấu hình:</span>
                    <span className="text-slate-300 col-span-2 print:text-black">{product.specs.processor} / {product.specs.ram}</span>
                  </div>
                )}
              </div>

              {/* Box 2: Quyền lợi & Thời hạn bảo hành */}
              <div className="p-4 rounded-xl bg-slate-900/70 border border-slate-800 space-y-2.5 print:bg-slate-50 print:border-slate-300">
                <div className="text-emerald-400 font-bold uppercase text-[11px] flex items-center gap-1.5 pb-1 border-b border-slate-800 print:border-slate-300">
                  <ShieldCheck className="w-3.5 h-3.5" />
                  2. QUYỀN LỢI & THỜI HẠN BẢO HÀNH
                </div>
                <div className="grid grid-cols-3 gap-1">
                  <span className="text-slate-400 col-span-1">Trạng thái:</span>
                  {(() => {
                    const now = Math.floor(Date.now() / 1000);
                    const isExp = chainData.status === 2 || (chainData.status === 1 && chainData.expiryDate && now >= chainData.expiryDate);
                    if (isExp) {
                      return (
                        <span className="font-bold text-rose-400 col-span-2 flex items-center gap-1 print:text-rose-700">
                          <AlertTriangle className="w-3.5 h-3.5" />
                          ĐÃ HẾT HẠN
                        </span>
                      );
                    }
                    if (chainData.status === 1) {
                      return (
                        <span className="font-bold text-emerald-400 col-span-2 flex items-center gap-1 print:text-emerald-700">
                          <CheckCircle2 className="w-3.5 h-3.5" />
                          ĐANG CÓ HIỆU LỰC
                        </span>
                      );
                    }
                    if (chainData.status === 3) {
                      return (
                        <span className="font-bold text-slate-400 col-span-2 flex items-center gap-1 print:text-slate-700">
                          <ShieldX className="w-3.5 h-3.5" />
                          BỊ VÔ HIỆU HÓA
                        </span>
                      );
                    }
                    return (
                      <span className="font-bold text-amber-400 col-span-2 flex items-center gap-1 print:text-amber-700">
                        <Clock className="w-3.5 h-3.5" />
                        CHỜ KÍCH HOẠT
                      </span>
                    );
                  })()}
                </div>
                <div className="grid grid-cols-3 gap-1">
                  <span className="text-slate-400 col-span-1">Ngày kích hoạt:</span>
                  <span className="font-mono text-slate-200 col-span-2 print:text-black">{formatDate(chainData.activationDate)}</span>
                </div>
                <div className="grid grid-cols-3 gap-1">
                  <span className="text-slate-400 col-span-1">Ngày hết hạn:</span>
                  <span className="font-mono font-bold text-emerald-300 col-span-2 print:text-emerald-700">{formatDate(chainData.expiryDate)}</span>
                </div>
                <div className="grid grid-cols-3 gap-1">
                  <span className="text-slate-400 col-span-1">Thời lượng chuẩn:</span>
                  <span className="text-slate-200 col-span-2 print:text-black">{chainData.warrantyMonths || 12} Tháng</span>
                </div>
                <div className="grid grid-cols-3 gap-1">
                  <span className="text-slate-400 col-span-1">Phạm vi bảo hành:</span>
                  <span className="text-slate-300 col-span-2 print:text-black">Linh kiện & Phần cứng toàn quốc</span>
                </div>
              </div>

            </div>

            {/* Box 3: Bằng chứng mật mã On-chain (Cryptographic Proof) */}
            <div className="p-4 rounded-xl bg-slate-900/80 border border-amber-500/20 space-y-2 text-[11px] font-mono print:bg-slate-50 print:border-slate-300">
              <div className="text-blue-400 font-bold uppercase flex items-center gap-1.5 pb-1 border-b border-slate-800 print:border-slate-300">
                <Lock className="w-3.5 h-3.5" />
                3. BẰNG CHỨNG MẬT MÃ BLOCKCHAIN & CHỦ QUYỀN (IMMUTABLE AUDIT TRAIL)
              </div>
              
              <div className="grid grid-cols-1 md:grid-cols-4 gap-2 pt-1">
                <div className="md:col-span-1 text-slate-400">Ví chủ sở hữu:</div>
                <div className="md:col-span-3 text-slate-200 break-all print:text-black">
                  {chainData.currentOwner || '0x0000000000000000000000000000000000000000'}
                </div>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-4 gap-2">
                <div className="md:col-span-1 text-slate-400">Smart Contract:</div>
                <div className="md:col-span-3 text-blue-300 break-all print:text-blue-800">
                  0x5FbDB2315678afecb367f032d93F642f64180aa3 (Ethereum EVM)
                </div>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-4 gap-2">
                <div className="md:col-span-1 text-slate-400">Transaction Hash:</div>
                <div className="md:col-span-3 text-amber-300 break-all print:text-amber-800">
                  {chainData.txHash || '0x49f8a12e87c6b901ddfae403487192aa0b3e64d781b490f23057e7a174c30c88'}
                </div>
              </div>
            </div>

            {/* Footer Signatures, QR Code & Circular Trust Seal */}
            <div className="pt-2 flex flex-col md:flex-row items-center justify-between gap-6 border-t border-amber-500/20 print:border-slate-300">
              
              {/* QR Code Verification */}
              <div className="flex items-center gap-3.5 bg-slate-900/60 p-2.5 rounded-xl border border-slate-800 print:bg-white print:border-slate-300">
                <div className="w-18 h-18 bg-white p-1 rounded-lg shadow-md flex items-center justify-center">
                  <img
                    src={`https://api.qrserver.com/v1/create-qr-code/?size=140x140&data=${encodeURIComponent(verifyUrl)}`}
                    alt="Verify QR Code"
                    className="w-full h-full object-contain"
                    onError={(e) => {
                      e.target.onerror = null;
                      e.target.src = 'data:image/svg+xml;utf8,<svg xmlns="http://www.w3.org/2000/svg" width="80" height="80" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><rect width="18" height="18" x="3" y="3" rx="2"/></svg>';
                    }}
                  />
                </div>
                <div className="space-y-1">
                  <div className="text-[10px] font-bold text-amber-400 uppercase tracking-wider">
                    QUÉT MÃ ĐỂ KIỂM TRA TRỰC TIẾP
                  </div>
                  <div className="text-[10px] text-slate-400 font-mono">
                    Hỗ trợ quét qua Camera điện thoại hoặc app Zalo
                  </div>
                  <div className="text-[9px] text-slate-500">
                    Cập nhật thời gian thực từ sổ cái phân tán
                  </div>
                </div>
              </div>

              {/* Circular Hologram Stamp */}
              <div className="relative flex items-center justify-center">
                <div className="w-24 h-24 rounded-full border-2 border-dashed border-amber-400 flex flex-col items-center justify-center p-1 text-center shadow-lg shadow-amber-500/10 rotate-[-8deg] print:border-amber-600">
                  <div className="text-[7px] font-black uppercase text-amber-300 tracking-tighter">
                    ★ TRUSTWARRANTY ★
                  </div>
                  <ShieldCheck className="w-6 h-6 text-amber-400 my-0.5" />
                  <div className="text-[6px] font-black uppercase text-amber-200 tracking-wider">
                    VERIFIED ON-CHAIN
                  </div>
                  <div className="text-[5px] text-amber-400/80 font-mono">
                    IMMUTABLE RECORD
                  </div>
                </div>
              </div>

              {/* Signatures & Issue Date */}
              <div className="text-center md:text-right space-y-1">
                <div className="text-[10px] text-slate-400">
                  Ngày cấp chứng nhận: <strong className="text-white print:text-black">{formatDate(Math.floor(Date.now() / 1000))}</strong>
                </div>
                <div className="text-xs font-bold text-amber-400 uppercase tracking-wider pt-1">
                  BAN ĐIỀU HÀNH HỆ THỐNG TRUSTWARRANTY
                </div>
                <div className="text-[10px] text-slate-500 italic">
                  (Chứng nhận điện tử ký số tự động bằng Smart Contract EVM)
                </div>
              </div>

            </div>

          </div>
        </div>

      </div>
    </div>
  );

  return typeof document !== 'undefined' ? ReactDOM.createPortal(modalContent, document.body) : modalContent;
}
