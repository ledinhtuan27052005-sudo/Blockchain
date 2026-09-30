import React, { useState } from 'react';
import ReactDOM from 'react-dom';
import {
  Wrench,
  X,
  CheckCircle2,
  AlertTriangle,
  Send,
  Phone,
  Mail,
  User,
  FileQuestion,
  Building2,
  Clock,
  Sparkles,
  Wallet,
  ShieldCheck
} from 'lucide-react';
import { createRmaTicket } from '../services/api';
import { blockchainService } from '../services/blockchain';

export default function RmaRequestModal({ product, chainData, serviceCenters = [], onClose, onSuccess }) {
  const [customerName, setCustomerName] = useState('');
  const [customerPhone, setCustomerPhone] = useState('');
  const [customerEmail, setCustomerEmail] = useState('');
  const [defectDescription, setDefectDescription] = useState('');
  const [preferredCenter, setPreferredCenter] = useState('');
  const [loading, setLoading] = useState(false);
  const [errorMsg, setErrorMsg] = useState('');
  const [ticketResult, setTicketResult] = useState(null);

  if (!chainData) return null;

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!customerName.trim() || !defectDescription.trim()) {
      setErrorMsg('Vui lòng điền họ tên và mô tả chi tiết sự cố gặp phải');
      return;
    }

    if (customerEmail && !customerEmail.includes('@gmail.com')) {
      setErrorMsg('Vui lòng nhập địa chỉ Gmail hợp lệ (@gmail.com) để nhận thông báo tiến độ');
      return;
    }

    if (customerPhone && !/^\d{10}$/.test(customerPhone.trim())) {
      setErrorMsg('Số điện thoại phải gồm đúng 10 chữ số');
      return;
    }

    setLoading(true);
    setErrorMsg('');

    try {
      const payload = {
        serialNumber: chainData.serialNumber,
        customerName: customerName.trim(),
        customerPhone: customerPhone.trim(),
        customerEmail: customerEmail.trim(),
        defectDescription: defectDescription.trim(),
        preferredCenter: preferredCenter || (serviceCenters[0]?.name || 'Trạm Kỹ Thuật Ủy Quyền Tiêu Chuẩn'),
      };

      const res = await createRmaTicket(payload);
      setTicketResult(res.ticket);
      if (onSuccess) onSuccess(res.ticket);
      if (onSuccess) onSuccess(res.ticket);
    } catch (err) {
      setErrorMsg(err.message || 'Lỗi khi gửi yêu cầu bảo hành');
    } finally {
      setLoading(false);
    }
  };

  return typeof document !== 'undefined' && ReactDOM.createPortal(
    <div className="fixed inset-0 z-[99999] flex items-center justify-center p-3 md:p-6 bg-slate-950/70 backdrop-blur-md animate-fade-in overflow-y-auto">
      <div className="relative w-full max-w-lg bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-3xl p-6 shadow-2xl space-y-5 my-auto text-slate-900 dark:text-slate-100">
        
        {/* Close Button */}
        <button
          onClick={onClose}
          className="absolute top-4 right-4 p-2 rounded-xl bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 text-slate-400 hover:text-slate-700 dark:hover:text-white transition cursor-pointer"
        >
          <X className="w-5 h-5" />
        </button>

        {/* Header */}
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-2xl bg-blue-500/10 text-blue-600 dark:text-blue-400 border border-blue-500/20 flex items-center justify-center">
            <Wrench className="w-5 h-5" />
          </div>
          <div>
            <h3 className="text-base font-bold text-slate-900 dark:text-white flex items-center gap-2">
              Phiếu Yêu Cầu Dịch Vụ & Bảo Hành (RMA)
            </h3>
            <p className="text-xs text-slate-500 dark:text-slate-400 font-mono">
              Thiết bị: <strong className="text-slate-900 dark:text-white">{chainData.serialNumber}</strong> ({chainData.modelCode})
            </p>
          </div>
        </div>

        {errorMsg && (
          <div className="p-3 rounded-xl bg-rose-500/10 border border-rose-500/30 text-rose-600 dark:text-rose-400 text-xs flex items-center gap-2">
            <AlertTriangle className="w-4 h-4 shrink-0" />
            <span>{errorMsg}</span>
          </div>
        )}

        {ticketResult ? (
          <div className="p-5 rounded-2xl bg-emerald-50 dark:bg-emerald-950/40 border border-emerald-300 dark:border-emerald-500/40 text-emerald-800 dark:text-emerald-300 space-y-4 text-xs">
            <div className="flex items-center gap-2 text-sm font-bold text-emerald-600 dark:text-emerald-400">
              <CheckCircle2 className="w-5 h-5" />
              Tạo Phiếu Yêu Cầu Thành Công!
            </div>

            <div className="p-3 rounded-xl bg-white dark:bg-slate-950/80 border border-slate-200 dark:border-slate-800 space-y-1 font-mono text-[11px] text-slate-800 dark:text-slate-200">
              <div>MÃ PHIẾU RMA: <strong className="text-amber-600 dark:text-yellow-300 text-xs">{ticketResult.id}</strong></div>
              <div>TRẠNG THÁI: <span className="text-blue-600 dark:text-blue-400 font-bold">CHỜ TIẾP NHẬN KIỂM ĐỊNH</span></div>
              <div>THIẾT BỊ: <span className="text-slate-700 dark:text-slate-200">{ticketResult.serialNumber}</span></div>
              <div>KHÁCH HÀNG: <span className="text-slate-700 dark:text-slate-200">{ticketResult.customerName}</span></div>
              {ticketResult.signerAddress && (
                <div className="pt-1 border-t border-slate-200 dark:border-slate-800 text-[10px] text-emerald-600 dark:text-emerald-400 flex items-center gap-1.5">
                  <ShieldCheck className="w-3.5 h-3.5 shrink-0" />
                  <span>Đã ký số xác thực MetaMask: <strong className="font-mono">{ticketResult.signerAddress.slice(0, 8)}...{ticketResult.signerAddress.slice(-6)}</strong></span>
                </div>
              )}
            </div>

            <p className="text-slate-600 dark:text-slate-300 leading-relaxed text-xs">
              Trạm dịch vụ kỹ thuật đã nhận được yêu cầu của bạn. Quý khách vui lòng mang thiết bị kèm mã phiếu RMA đến trạm hoặc gửi bưu điện theo chỉ dẫn.
            </p>

            <button
              type="button"
              onClick={onClose}
              className="w-full py-2.5 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white font-bold transition cursor-pointer"
            >
              Hoàn Tất & Đóng
            </button>
          </div>
        ) : (
          <form onSubmit={handleSubmit} className="space-y-3.5 text-xs">
            
            {/* Customer Name */}
            <div>
              <label className="block text-slate-700 dark:text-slate-300 mb-1 font-semibold flex items-center gap-1">
                <User className="w-3.5 h-3.5 text-slate-400 dark:text-slate-500" />
                Họ và Tên Khách Hàng (*)
              </label>
              <input
                type="text"
                required
                value={customerName}
                onChange={(e) => setCustomerName(e.target.value)}
                placeholder="VD: Nguyễn Văn A"
                className="w-full px-3 py-2 rounded-xl bg-white dark:bg-slate-950 border border-slate-300 dark:border-slate-800 text-slate-900 dark:text-white placeholder:text-slate-400 dark:placeholder:text-slate-500 focus:border-blue-500 focus:outline-none"
              />
            </div>

            {/* Phone & Email Grid */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div>
                <label className="block text-slate-700 dark:text-slate-300 mb-1 font-semibold flex items-center gap-1">
                  <Phone className="w-3.5 h-3.5 text-slate-400 dark:text-slate-500" />
                  Số Điện Thoại Liên Hệ (*)
                </label>
                <input
                  type="text"
                  required
                  value={customerPhone}
                  onChange={(e) => setCustomerPhone(e.target.value)}
                  placeholder="0912345678"
                  className="w-full px-3 py-2 rounded-xl bg-white dark:bg-slate-950 border border-slate-300 dark:border-slate-800 text-slate-900 dark:text-white placeholder:text-slate-400 dark:placeholder:text-slate-500 font-mono focus:border-blue-500 focus:outline-none"
                />
              </div>

              <div>
                <label className="block text-slate-700 dark:text-slate-300 mb-1 font-semibold flex items-center gap-1">
                  <Mail className="w-3.5 h-3.5 text-slate-400 dark:text-slate-500" />
                  Địa Chỉ Gmail Nhận Thông Báo
                </label>
                <input
                  type="email"
                  value={customerEmail}
                  onChange={(e) => setCustomerEmail(e.target.value)}
                  placeholder="example@gmail.com"
                  className="w-full px-3 py-2 rounded-xl bg-white dark:bg-slate-950 border border-slate-300 dark:border-slate-800 text-slate-900 dark:text-white placeholder:text-slate-400 dark:placeholder:text-slate-500 font-mono focus:border-blue-500 focus:outline-none"
                />
              </div>
            </div>

            {/* Preferred Service Center */}
            <div>
              <label className="block text-slate-700 dark:text-slate-300 mb-1 font-semibold flex items-center gap-1">
                <Building2 className="w-3.5 h-3.5 text-slate-400 dark:text-slate-500" />
                Trạm Dịch Vụ Tiếp Nhận
              </label>
              <select
                value={preferredCenter}
                onChange={(e) => setPreferredCenter(e.target.value)}
                className="w-full px-3 py-2 rounded-xl bg-white dark:bg-slate-950 border border-slate-300 dark:border-slate-800 text-slate-900 dark:text-white focus:border-blue-500 focus:outline-none"
              >
                <option value="">-- Trạm Kỹ thuật Trung tâm (Mặc định) --</option>
                {serviceCenters.map((ctr) => (
                  <option key={ctr.id || ctr.code} value={ctr.name}>
                    {ctr.name} - {ctr.address}
                  </option>
                ))}
              </select>
            </div>

            {/* Defect Description */}
            <div>
              <label className="block text-slate-700 dark:text-slate-300 mb-1 font-semibold flex items-center gap-1">
                <FileQuestion className="w-3.5 h-3.5 text-slate-400 dark:text-slate-500" />
                Mô Tả Chi Tiết Triệu Chứng / Lỗi Gặp Phải (*)
              </label>
              <textarea
                required
                rows={3}
                value={defectDescription}
                onChange={(e) => setDefectDescription(e.target.value)}
                placeholder="VD: Màn hình bị chớp tắt khi cắm sạc, pin báo sạc nhưng không vào điện, phát ra tiếng kêu lạ..."
                className="w-full px-3 py-2 rounded-xl bg-white dark:bg-slate-950 border border-slate-300 dark:border-slate-800 text-slate-900 dark:text-white placeholder:text-slate-400 dark:placeholder:text-slate-500 focus:border-blue-500 focus:outline-none"
              />
            </div>

            <div className="p-3 rounded-2xl bg-blue-500/10 border border-blue-500/30 text-blue-700 dark:text-blue-300 text-[11px] flex items-start gap-2.5">
              <Wallet className="w-4 h-4 text-blue-500 shrink-0 mt-0.5" />
              <div>
                <strong className="block font-semibold">Ký số xác thực MetaMask bắt buộc:</strong>
                Khi bấm gửi, ví MetaMask sẽ mở ra để bạn ký điện tử xác nhận yêu cầu bảo hành chính chủ. Phiếu RMA chỉ được ghi nhận vào hệ thống sau khi bạn chấp thuận trên MetaMask.
              </div>
            </div>

            <div className="flex justify-end gap-2 pt-2">
              <button
                type="button"
                onClick={onClose}
                className="px-4 py-2 rounded-xl bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 text-slate-700 dark:text-slate-300 dark:hover:bg-slate-700 transition cursor-pointer"
              >
                Hủy
              </button>
              <button
                type="submit"
                disabled={loading}
                className="px-5 py-2.5 rounded-xl bg-blue-600 hover:bg-blue-700 text-white font-bold transition shadow-lg shadow-blue-600/25 flex items-center gap-2 cursor-pointer disabled:opacity-50"
              >
                <Wallet className="w-3.5 h-3.5" />
                <span>{loading ? 'Đang mở MetaMask...' : 'Ký MetaMask & Gửi Phiếu'}</span>
              </button>
            </div>

          </form>
        )}

      </div>
    </div>,
    document.body
  );
}
