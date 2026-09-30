import React, { useState, useEffect, useRef } from 'react';
import {
  Bell,
  CheckCheck,
  Trash2,
  CheckCircle2,
  AlertCircle,
  Info,
  Radio,
  ShieldAlert,
  ChevronRight,
  LogIn
} from 'lucide-react';
import { notificationService } from '../services/notificationService';
import NotificationDetailModal from './NotificationDetailModal';

export default function NotificationBell({ currentUser, onOpenAuthModal }) {
  const [isOpen, setIsOpen] = useState(false);
  const [notifications, setNotifications] = useState([]);
  const [unreadCount, setUnreadCount] = useState(0);
  const [filter, setFilter] = useState('all'); // 'all' | 'unread'
  const [selectedNotif, setSelectedNotif] = useState(null);
  const dropdownRef = useRef(null);

  // Phản ứng tức thì khi người dùng đăng nhập, đổi tài khoản hoặc đăng xuất
  useEffect(() => {
    if (!currentUser) {
      setNotifications([]);
      setUnreadCount(0);
      return;
    }

    const uid = currentUser.id || currentUser.email;
    const initialList = notificationService.getNotifications(uid);
    const initialCount = notificationService.getUnreadCount(uid);

    setNotifications(initialList);
    setUnreadCount(initialCount);

    // Lắng nghe sự kiện cập nhật thông báo riêng cho tài khoản này
    const unsubscribe = notificationService.subscribe((list, count) => {
      setNotifications([...list]);
      setUnreadCount(count);
    }, uid);

    return () => unsubscribe();
  }, [currentUser]);

  // Đóng dropdown khi click bên ngoài
  useEffect(() => {
    const handleOutsideClick = (e) => {
      if (dropdownRef.current && !dropdownRef.current.contains(e.target)) {
        setIsOpen(false);
      }
    };
    if (isOpen) {
      document.addEventListener('mousedown', handleOutsideClick);
    }
    return () => document.removeEventListener('mousedown', handleOutsideClick);
  }, [isOpen]);

  const handleMarkAllAsRead = () => {
    if (!currentUser) return;
    const uid = currentUser.id || currentUser.email;
    notificationService.markAllAsRead(uid);
    setUnreadCount(0);
    setNotifications((prev) => prev.map((item) => ({ ...item, isRead: true })));
  };

  const handleClearAll = () => {
    if (!currentUser) return;
    if (window.confirm('Bạn có chắc chắn muốn xóa toàn bộ lịch sử thông báo?')) {
      const uid = currentUser.id || currentUser.email;
      notificationService.clearAll(uid);
      setNotifications([]);
      setUnreadCount(0);
    }
  };

  const handleMarkSingleRead = (e, item) => {
    e.stopPropagation();
    if (!currentUser) return;
    const uid = currentUser.id || currentUser.email;
    notificationService.markAsRead(item.id, uid);
    setNotifications((prev) =>
      prev.map((n) => (n.id === item.id ? { ...n, isRead: true } : n))
    );
    setUnreadCount((prev) => Math.max(0, prev - 1));
  };

  const handleItemClick = (item) => {
    if (currentUser) {
      const uid = currentUser.id || currentUser.email;
      notificationService.markAsRead(item.id, uid);
      if (!item.isRead) {
        setNotifications((prev) =>
          prev.map((n) => (n.id === item.id ? { ...n, isRead: true } : n))
        );
        setUnreadCount((prev) => Math.max(0, prev - 1));
      }
    }
    setSelectedNotif({ ...item, isRead: true });
    setIsOpen(false);
  };

  const filteredList = filter === 'unread' 
    ? notifications.filter((item) => !item.isRead) 
    : notifications;

  const getItemIcon = (type) => {
    switch (type) {
      case 'success':
        return <CheckCircle2 className="w-4 h-4 text-emerald-500 shrink-0" />;
      case 'event':
        return <Radio className="w-4 h-4 text-blue-500 shrink-0" />;
      case 'error':
        return <ShieldAlert className="w-4 h-4 text-rose-500 shrink-0" />;
      case 'warning':
        return <AlertCircle className="w-4 h-4 text-amber-500 shrink-0" />;
      default:
        return <Info className="w-4 h-4 text-indigo-500 shrink-0" />;
    }
  };

  const formatTimeAgo = (isoString) => {
    if (!isoString) return '';
    const now = new Date();
    const past = new Date(isoString);
    const diffSec = Math.floor((now - past) / 1000);

    if (diffSec < 60) return 'Vừa xong';
    if (diffSec < 3600) return `${Math.floor(diffSec / 60)} phút trước`;
    if (diffSec < 86400) return `${Math.floor(diffSec / 3600)} giờ trước`;
    return past.toLocaleDateString('vi-VN', { day: '2-digit', month: '2-digit' });
  };

  return (
    <div className="relative" ref={dropdownRef}>
      {/* Nút quả chuông trên thanh điều hướng */}
      <button
        type="button"
        onClick={() => setIsOpen(!isOpen)}
        className={`relative p-2 rounded-xl border transition-all duration-200 cursor-pointer ${
          currentUser && unreadCount > 0
            ? 'bg-amber-50/90 hover:bg-amber-100 dark:bg-amber-950/30 dark:hover:bg-amber-900/40 border-amber-300 dark:border-amber-700/70 text-amber-600 dark:text-amber-400 shadow-sm shadow-amber-500/10'
            : 'bg-slate-100 hover:bg-slate-200 dark:bg-slate-800/80 dark:hover:bg-slate-800 border-slate-200 dark:border-slate-700/80 text-slate-600 dark:text-slate-300 hover:text-slate-900 dark:hover:text-white'
        }`}
        title={
          !currentUser
            ? 'Thông báo hệ thống (Chưa đăng nhập)'
            : unreadCount > 0
            ? `Bạn có ${unreadCount} thông báo chưa xem`
            : 'Thông báo hệ thống'
        }
        aria-label="Thông báo hệ thống"
      >
        <Bell className={`w-4 h-4 transition-transform ${currentUser && unreadCount > 0 ? 'animate-bell-ring text-amber-500 dark:text-amber-400' : ''}`} />
        {currentUser && unreadCount > 0 && (
          <span className="absolute -top-1 -right-1 flex h-4 min-w-[16px] px-1 items-center justify-center rounded-full bg-rose-500 text-[9px] font-extrabold text-white shadow-sm ring-2 ring-white dark:ring-slate-900 animate-pulse">
            {unreadCount > 99 ? '99+' : unreadCount}
          </span>
        )}
      </button>

      {/* Menu thả xuống (Dropdown List) */}
      {isOpen && (
        <div className="absolute right-0 mt-2 w-80 sm:w-96 rounded-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 shadow-2xl z-50 overflow-hidden animate-fade-in text-xs">
          {/* Header */}
          <div className="p-3.5 border-b border-slate-200 dark:border-slate-800 flex items-center justify-between bg-slate-50 dark:bg-slate-950/60">
            <div className="flex items-center gap-2">
              <span className="font-extrabold text-slate-900 dark:text-white text-sm">
                Thông Báo
              </span>
              {currentUser && (
                <span className="text-[10px] text-slate-500 dark:text-slate-400 font-medium truncate max-w-[120px]">
                  ({currentUser.fullName || currentUser.username})
                </span>
              )}
              {currentUser && unreadCount > 0 && (
                <span className="px-2 py-0.5 rounded-full bg-blue-100 dark:bg-blue-500/20 text-blue-700 dark:text-blue-300 font-bold text-[10px]">
                  {unreadCount} mới
                </span>
              )}
            </div>

            {currentUser && (
              <div className="flex items-center gap-1">
                {unreadCount > 0 && (
                  <button
                    type="button"
                    onClick={handleMarkAllAsRead}
                    className="flex items-center gap-1 px-2.5 py-1 rounded-lg text-[11px] font-bold text-blue-600 hover:text-blue-700 dark:text-blue-400 dark:hover:text-blue-300 hover:bg-blue-50 dark:hover:bg-blue-500/10 transition cursor-pointer"
                    title="Đánh dấu tất cả thông báo là đã đọc"
                  >
                    <CheckCheck className="w-3.5 h-3.5" />
                    <span>Đọc tất cả</span>
                  </button>
                )}

                {notifications.length > 0 && (
                  <button
                    type="button"
                    onClick={handleClearAll}
                    className="p-1.5 rounded-lg text-slate-400 hover:text-rose-500 hover:bg-rose-50 dark:hover:bg-rose-500/10 transition cursor-pointer"
                    title="Xóa tất cả thông báo"
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                  </button>
                )}
              </div>
            )}
          </div>

          {/* TRƯỜNG HỢP 1: NGƯỜI DÙNG CHƯA ĐĂNG NHẬP / ĐÃ ĐĂNG XUẤT */}
          {!currentUser ? (
            <div className="p-8 text-center space-y-3.5">
              <div className="w-12 h-12 mx-auto rounded-2xl bg-blue-50 dark:bg-blue-950/40 text-blue-500 flex items-center justify-center">
                <Bell className="w-6 h-6 opacity-70" />
              </div>
              <div className="space-y-1">
                <p className="text-sm font-bold text-slate-800 dark:text-slate-200">
                  Chưa đăng nhập
                </p>
                <p className="text-xs text-slate-500 dark:text-slate-400 max-w-[240px] mx-auto leading-relaxed">
                  Thông báo hệ thống được phân quyền độc lập theo từng tài khoản. Hãy đăng nhập để xem thông báo của bạn.
                </p>
              </div>
              {onOpenAuthModal && (
                <button
                  type="button"
                  onClick={() => {
                    setIsOpen(false);
                    onOpenAuthModal('login');
                  }}
                  className="inline-flex items-center gap-2 px-4 py-2 rounded-xl bg-blue-600 hover:bg-blue-500 text-white font-bold text-xs shadow-md shadow-blue-600/25 transition cursor-pointer active:scale-95"
                >
                  <LogIn className="w-3.5 h-3.5" />
                  <span>Đăng nhập ngay</span>
                </button>
              )}
            </div>
          ) : (
            /* TRƯỜNG HỢP 2: ĐÃ ĐĂNG NHẬP (Hiển thị danh sách thông báo của tài khoản) */
            <>
              {/* Filter Tabs */}
              <div className="flex border-b border-slate-200 dark:border-slate-800 px-3 pt-2 gap-4 text-xs font-semibold bg-slate-50/50 dark:bg-slate-950/30">
                <button
                  type="button"
                  onClick={() => setFilter('all')}
                  className={`pb-2 transition border-b-2 cursor-pointer ${
                    filter === 'all'
                      ? 'border-blue-500 text-blue-600 dark:text-blue-400'
                      : 'border-transparent text-slate-500 hover:text-slate-800 dark:text-slate-400 dark:hover:text-slate-300'
                  }`}
                >
                  Tất cả ({notifications.length})
                </button>
                <button
                  type="button"
                  onClick={() => setFilter('unread')}
                  className={`pb-2 transition border-b-2 cursor-pointer ${
                    filter === 'unread'
                      ? 'border-blue-500 text-blue-600 dark:text-blue-400'
                      : 'border-transparent text-slate-500 hover:text-slate-800 dark:text-slate-400 dark:hover:text-slate-300'
                  }`}
                >
                  Chưa đọc ({unreadCount})
                </button>
              </div>

              {/* Notifications List */}
              <div className="max-h-80 overflow-y-auto divide-y divide-slate-100 dark:divide-slate-800/60">
                {filteredList.length === 0 ? (
                  <div className="p-8 text-center text-slate-400 space-y-2">
                    <Bell className="w-8 h-8 mx-auto opacity-30 text-slate-400" />
                    <p className="text-xs text-slate-500 dark:text-slate-400">
                      {filter === 'unread' ? 'Không có thông báo chưa đọc nào.' : 'Chưa có thông báo nào trong lịch sử.'}
                    </p>
                  </div>
                ) : (
                  filteredList.map((item) => (
                    <div
                      key={item.id}
                      onClick={() => handleItemClick(item)}
                      className={`p-3.5 hover:bg-slate-50 dark:hover:bg-slate-800/50 transition cursor-pointer flex items-start gap-3 relative ${
                        !item.isRead ? 'bg-blue-50/50 dark:bg-blue-950/20' : ''
                      }`}
                    >
                      {/* Status Indicator Dot */}
                      {!item.isRead && (
                        <span className="absolute top-4 left-1.5 w-1.5 h-1.5 rounded-full bg-blue-500" />
                      )}

                      {/* Type Icon */}
                      <div className="mt-0.5">{getItemIcon(item.type)}</div>

                      {/* Body Text */}
                      <div className="flex-1 min-w-0 space-y-1">
                        <div className="flex items-center justify-between gap-1">
                          <span className={`font-bold truncate text-xs ${!item.isRead ? 'text-slate-900 dark:text-white' : 'text-slate-700 dark:text-slate-300'}`}>
                            {item.title}
                          </span>
                          <span className="text-[10px] text-slate-400 dark:text-slate-500 shrink-0 font-medium">
                            {formatTimeAgo(item.timestamp)}
                          </span>
                        </div>

                        <p className="text-[11px] text-slate-600 dark:text-slate-400 line-clamp-2 leading-relaxed">
                          {item.message}
                        </p>
                      </div>

                      <div className="flex items-center gap-1.5 shrink-0 self-center">
                        {!item.isRead && (
                          <button
                            type="button"
                            onClick={(e) => handleMarkSingleRead(e, item)}
                            className="px-2 py-0.5 rounded-lg text-[10px] font-bold bg-blue-100 hover:bg-blue-200 dark:bg-blue-900/50 dark:hover:bg-blue-800 text-blue-700 dark:text-blue-300 transition cursor-pointer"
                            title="Đánh dấu thông báo này là đã đọc"
                          >
                            ✓ Đã đọc
                          </button>
                        )}
                        <ChevronRight className="w-3.5 h-3.5 text-slate-400 dark:text-slate-600" />
                      </div>
                    </div>
                  ))
                )}
              </div>

              {/* Footer */}
              <div className="p-2 text-center text-[10px] text-slate-500 dark:text-slate-400 border-t border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-950/50">
                Bấm vào một thông báo để mở toàn văn chi tiết
              </div>
            </>
          )}
        </div>
      )}

      {/* Modal Chi Tiết Thông Báo Khi Click Vào 1 Mục */}
      {selectedNotif && (
        <NotificationDetailModal
          notification={selectedNotif}
          onClose={() => setSelectedNotif(null)}
          onMarkAsRead={(id) => {
            if (currentUser) {
              const uid = currentUser.id || currentUser.email;
              notificationService.markAsRead(id, uid);
              setNotifications((prev) =>
                prev.map((n) => (n.id === id ? { ...n, isRead: true } : n))
              );
              setUnreadCount((prev) => Math.max(0, prev - 1));
            }
          }}
        />
      )}
    </div>
  );
}
