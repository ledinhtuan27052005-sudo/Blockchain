import React, { useState } from 'react';
import { createPortal } from 'react-dom';
import {
  X,
  CheckCircle2,
  AlertCircle,
  Info,
  Radio,
  ShieldAlert,
  Hash,
  Copy,
  Check,
  Calendar,
  ExternalLink
} from 'lucide-react';

export default function NotificationDetailModal({ notification, onClose, onMarkAsRead }) {
  const [copied, setCopied] = useState(false);

  if (!notification || typeof document === 'undefined') return null;

  const handleCopyHash = () => {
    if (notification.txHash) {
      navigator.clipboard.writeText(notification.txHash);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    }
  };

  const getTypeMeta = () => {
    switch (notification.type) {
      case 'success':
        return {
          icon: CheckCircle2,
          bg: 'bg-emerald-100 text-emerald-800 border-emerald-300 dark:bg-emerald-500/20 dark:text-emerald-300 dark:border-emerald-500/40',
          label: 'Thành Công',
        };
      case 'event':
        return {
          icon: Radio,
          bg: 'bg-blue-100 text-blue-800 border-blue-300 dark:bg-blue-500/20 dark:text-blue-300 dark:border-blue-500/40',
          label: 'Sự Kiện On-Chain',
        };
      case 'error':
        return {
          icon: ShieldAlert,
          bg: 'bg-rose-100 text-rose-800 border-rose-300 dark:bg-rose-500/20 dark:text-rose-300 dark:border-rose-500/40',
          label: 'Cảnh Báo Vi Phạm',
        };
      case 'warning':
        return {
          icon: AlertCircle,
          bg: 'bg-amber-100 text-amber-800 border-amber-300 dark:bg-amber-500/20 dark:text-amber-300 dark:border-amber-500/40',
          label: 'Chú Ý',
        };
      default:
        return {
          icon: Info,
          bg: 'bg-indigo-100 text-indigo-800 border-indigo-300 dark:bg-indigo-500/20 dark:text-indigo-300 dark:border-indigo-500/40',
          label: 'Hệ Thống',
        };
    }
  };

  const meta = getTypeMeta();
  const Icon = meta.icon;

  const formattedDate = notification.timestamp
    ? new Date(notification.timestamp).toLocaleString('vi-VN', {
        hour: '2-digit',
        minute: '2-digit',
        day: '2-digit',
        month: '2-digit',
        year: 'numeric',
      })
    : '';

  const modalContent = (
    <div 
      className="fixed inset-0 z-[99999] flex items-center justify-center p-4 bg-slate-900/60 dark:bg-black/80 backdrop-blur-sm animate-fade-in"
      onClick={onClose}
    >
      <div 
        className="w-full max-w-lg rounded-3xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 shadow-2xl overflow-hidden flex flex-col max-h-[90vh] transition-colors"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="p-5 border-b border-slate-200 dark:border-slate-800 flex items-center justify-between bg-slate-50 dark:bg-slate-950/60">
          <div className="flex items-center gap-2.5 flex-wrap">
            <span className={`inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-bold border ${meta.bg}`}>
              <Icon className="w-3.5 h-3.5" />
              <span>{meta.label}</span>
            </span>
            <div className="flex items-center gap-1 text-slate-500 dark:text-slate-400 text-xs">
              <Calendar className="w-3.5 h-3.5" />
              <span>{formattedDate}</span>
            </div>
          </div>

          <button
            type="button"
            onClick={onClose}
            className="p-1.5 rounded-xl text-slate-400 hover:text-slate-700 dark:hover:text-white hover:bg-slate-100 dark:hover:bg-slate-800 transition cursor-pointer"
            title="Đóng cửa sổ"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Body Content */}
        <div className="p-6 space-y-4 overflow-y-auto text-sm text-slate-700 dark:text-slate-300">
          <h2 className="text-lg font-extrabold text-slate-900 dark:text-white tracking-tight leading-snug">
            {notification.title}
          </h2>

          <div className="p-4 rounded-2xl bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 leading-relaxed text-xs sm:text-sm text-slate-800 dark:text-slate-200">
            {notification.message}
          </div>

          {notification.details && notification.details !== notification.message && (
            <div className="space-y-1.5">
              <h4 className="text-xs font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400">
                Chi tiết bổ sung
              </h4>
              <p className="text-xs leading-relaxed text-slate-600 dark:text-slate-400 whitespace-pre-line">
                {notification.details}
              </p>
            </div>
          )}

          {/* On-Chain Transaction Hash */}
          {notification.txHash && (
            <div className="p-3.5 rounded-2xl bg-blue-50 dark:bg-blue-950/30 border border-blue-200 dark:border-blue-900/50 space-y-2">
              <div className="flex items-center justify-between">
                <span className="text-xs font-bold text-blue-700 dark:text-blue-300 flex items-center gap-1.5">
                  <Hash className="w-4 h-4 text-blue-500" />
                  <span>Mã Băm Giao Dịch (On-Chain Tx Hash)</span>
                </span>
                <button
                  type="button"
                  onClick={handleCopyHash}
                  className="flex items-center gap-1 px-2.5 py-1 rounded-lg text-xs font-semibold bg-white dark:bg-slate-800 text-blue-600 dark:text-blue-400 border border-blue-200 dark:border-blue-800 hover:bg-blue-50 dark:hover:bg-slate-700 transition cursor-pointer shadow-xs"
                >
                  {copied ? (
                    <>
                      <Check className="w-3.5 h-3.5 text-emerald-500" />
                      <span className="text-emerald-500">Đã chép</span>
                    </>
                  ) : (
                    <>
                      <Copy className="w-3.5 h-3.5" />
                      <span>Sao chép</span>
                    </>
                  )}
                </button>
              </div>

              <div className="font-mono text-xs text-blue-950 dark:text-blue-200 break-all p-2 rounded-xl bg-white dark:bg-slate-900 border border-blue-100 dark:border-slate-800 select-all">
                {notification.txHash}
              </div>
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="p-4 px-6 border-t border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-950/70 flex items-center justify-between gap-3">
          {notification.action ? (
            <button
              type="button"
              onClick={() => {
                if (notification.action.onClick) notification.action.onClick();
                onClose();
              }}
              className="px-4 py-2 rounded-xl bg-blue-600 hover:bg-blue-500 text-white font-bold text-xs shadow-md transition flex items-center gap-1.5 cursor-pointer"
            >
              <span>{notification.action.label || 'Xem Thêm'}</span>
              <ExternalLink className="w-3.5 h-3.5" />
            </button>
          ) : (
            <span className="text-[11px] text-slate-400 dark:text-slate-500">TrustWarranty Ledger Notification</span>
          )}

          <div className="flex items-center gap-2">
            {!notification.isRead && onMarkAsRead && (
              <button
                type="button"
                onClick={() => {
                  onMarkAsRead(notification.id);
                  onClose();
                }}
                className="px-4 py-2 rounded-xl bg-blue-600 hover:bg-blue-500 text-white font-bold text-xs shadow-md transition flex items-center gap-1.5 cursor-pointer"
              >
                <CheckCircle2 className="w-3.5 h-3.5" />
                <span>Đã đọc</span>
              </button>
            )}

            <button
              type="button"
              onClick={onClose}
              className="px-5 py-2 rounded-xl bg-slate-200 hover:bg-slate-300 dark:bg-slate-800 dark:hover:bg-slate-700 text-slate-800 dark:text-slate-200 font-bold text-xs transition cursor-pointer"
            >
              Đóng
            </button>
          </div>
        </div>
      </div>
    </div>
  );

  return createPortal(modalContent, document.body);
}
