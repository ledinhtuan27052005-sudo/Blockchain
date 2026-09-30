import React, { useEffect } from 'react';
import { createPortal } from 'react-dom';
import {
  CheckCircle2,
  AlertCircle,
  Info,
  Radio,
  X,
  Hash,
  ShieldAlert,
  ShieldCheck,
  Bell
} from 'lucide-react';

export default function SystemNotificationBox({ notice, onClose }) {
  if (!notice || typeof document === 'undefined') return null;

  useEffect(() => {
    // Tự động ẩn: thông báo có hành động hoặc vi phạm giữ lâu hơn để người dùng kịp thao tác
    const duration = notice.action ? 15000 : (notice.type === 'error' ? 9000 : 5000);
    const timer = setTimeout(() => {
      onClose();
    }, duration);
    return () => clearTimeout(timer);
  }, [notice, onClose]);

  const getTheme = () => {
    switch (notice.type) {
      case 'success':
        return {
          border: 'border-emerald-500/40 dark:border-emerald-500/50 shadow-emerald-500/10',
          bg: 'bg-white dark:bg-slate-900',
          iconBg: 'bg-emerald-100 text-emerald-600 dark:bg-emerald-500/20 dark:text-emerald-400',
          titleColor: 'text-emerald-700 dark:text-emerald-400',
          icon: CheckCircle2,
          progressColor: 'bg-emerald-500',
        };
      case 'event':
        return {
          border: 'border-blue-500/40 dark:border-blue-500/50 shadow-blue-500/10',
          bg: 'bg-white dark:bg-slate-900',
          iconBg: 'bg-blue-100 text-blue-600 dark:bg-blue-500/20 dark:text-blue-400',
          titleColor: 'text-blue-700 dark:text-blue-400',
          icon: Radio,
          progressColor: 'bg-blue-500',
        };
      case 'error':
        return {
          border: 'border-rose-500/60 dark:border-rose-500/80 shadow-rose-500/20 ring-2 ring-rose-500/20',
          bg: 'bg-white dark:bg-slate-950',
          iconBg: 'bg-rose-100 text-rose-600 dark:bg-rose-500/25 dark:text-rose-400',
          titleColor: 'text-rose-700 dark:text-rose-400',
          icon: ShieldAlert,
          progressColor: 'bg-rose-500',
        };
      default:
        return {
          border: 'border-indigo-500/40 dark:border-indigo-500/50 shadow-indigo-500/10',
          bg: 'bg-white dark:bg-slate-900',
          iconBg: 'bg-indigo-100 text-indigo-600 dark:bg-indigo-500/20 dark:text-indigo-400',
          titleColor: 'text-indigo-700 dark:text-indigo-400',
          icon: Info,
          progressColor: 'bg-indigo-500',
        };
    }
  };

  const theme = getTheme();
  const IconComponent = theme.icon;

  const content = (
    <div className="fixed top-20 right-4 sm:right-6 z-[99999] max-w-md w-[calc(100%-2rem)] sm:w-[460px] pointer-events-auto animate-fade-in">
      <div className={`relative overflow-hidden rounded-2xl border ${theme.border} ${theme.bg} p-4 backdrop-blur-xl shadow-2xl transition-all duration-300`}>
        <div className="flex items-start justify-between gap-3 text-xs">
          
          {/* Left Icon */}
          <div className={`p-2.5 rounded-xl ${theme.iconBg} shrink-0 mt-0.5 shadow-xs`}>
            <IconComponent className="w-5 h-5" />
          </div>

          {/* Content */}
          <div className="flex-1 space-y-1.5">
            <div className="flex items-center gap-2 flex-wrap">
              <span className={`font-bold text-sm ${theme.titleColor}`}>
                {notice.title}
              </span>
              {notice.type === 'error' && (
                <span className="text-[10px] font-bold uppercase tracking-wider px-2 py-0.5 rounded-full bg-rose-100 text-rose-800 dark:bg-rose-500/20 dark:text-rose-300 border border-rose-300 dark:border-rose-500/40 animate-pulse">
                  Phát Hiện Vi Phạm
                </span>
              )}
              {notice.type === 'event' && (
                <span className="text-[10px] font-bold uppercase tracking-wider px-2 py-0.5 rounded-full bg-blue-100 text-blue-800 dark:bg-blue-500/20 dark:text-blue-300 border border-blue-300 dark:border-blue-500/30">
                  On-Chain Event
                </span>
              )}
            </div>

            <p className="text-slate-700 dark:text-slate-200 leading-relaxed text-xs">
              {notice.message}
            </p>

            {notice.txHash && (
              <div className="pt-1 flex items-center gap-2 text-[11px] font-mono text-slate-500 dark:text-slate-400">
                <Hash className="w-3 h-3 text-slate-400" />
                <span>Tx: <strong className="text-blue-600 dark:text-blue-400">{notice.txHash}</strong></span>
              </div>
            )}

            {notice.action && (
              <div className="pt-2 flex items-center gap-2 flex-wrap">
                {notice.action.url ? (
                  <a
                    href={notice.action.url}
                    target="_blank"
                    rel="noreferrer"
                    className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-orange-500 hover:bg-orange-400 text-white font-bold text-xs transition shadow-md cursor-pointer"
                  >
                    <span>{notice.action.label}</span>
                  </a>
                ) : (
                  <button
                    type="button"
                    onClick={notice.action.onClick}
                    className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-blue-600 hover:bg-blue-500 text-white font-bold text-xs transition shadow-md cursor-pointer"
                  >
                    <span>{notice.action.label}</span>
                  </button>
                )}
              </div>
            )}
          </div>

          {/* Close Button */}
          <button
            onClick={onClose}
            className="p-1.5 rounded-lg text-slate-400 hover:text-slate-700 dark:hover:text-white hover:bg-slate-100 dark:hover:bg-slate-800/80 transition cursor-pointer shrink-0"
            title="Đóng thông báo"
          >
            <X className="w-4 h-4" />
          </button>

        </div>

        {/* Subtle bottom progress bar */}
        <div className="absolute bottom-0 left-0 right-0 h-0.5 bg-slate-200 dark:bg-slate-800">
          <div className={`h-full ${theme.progressColor} animate-shrink-width`} />
        </div>
      </div>
    </div>
  );

  return createPortal(content, document.body);
}
