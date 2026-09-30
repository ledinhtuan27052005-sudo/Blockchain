/**
 * Dịch vụ Quản lý & Lưu trữ Thông Báo (Notification Service)
 * - Phân tách thông báo độc lập theo từng tài khoản người dùng (Account-Scoped Storage).
 * - Chống trùng lặp thông báo (Deduplication filter: không ghi đè/spam các thông báo cùng nội dung).
 * - Đăng xuất thì không còn hiển thị thông báo trong quả chuông (Empty list khi chưa đăng nhập).
 * - Tự động xóa sạch dữ liệu thông báo rác cũ.
 */

import { authService } from './auth';

const STORAGE_PREFIX = 'trustwarranty_notifications_user_';
const EVENT_NAME = 'trustwarranty_notifications_updated';
const LEGACY_STORAGE_KEY = 'trustwarranty_notifications_v1';

class NotificationService {
  constructor() {
    this._cleanupLegacyStorage();
  }

  /**
   * Dọn dẹp dữ liệu lưu trữ rác cũ từ các phiên bản trước và thực hiện lệnh reset sạch thông báo
   */
  _cleanupLegacyStorage() {
    try {
      if (typeof window !== 'undefined') {
        localStorage.removeItem(LEGACY_STORAGE_KEY);
        const CLEAN_RESET_FLAG = 'trustwarranty_wiped_all_accounts_v4';
        if (!localStorage.getItem(CLEAN_RESET_FLAG)) {
          const keysToRemove = [];
          for (let i = 0; i < localStorage.length; i++) {
            const k = localStorage.key(i);
            if (k && (k.startsWith(STORAGE_PREFIX) || k.includes('notifications') || k.includes('trust_warranty_') || k.includes('trustwarranty_linked_wallet_'))) {
              keysToRemove.push(k);
            }
          }
          keysToRemove.forEach((k) => localStorage.removeItem(k));
          localStorage.setItem(CLEAN_RESET_FLAG, 'true');
        }
      }
    } catch (e) {
      console.warn('Lỗi dọn dẹp legacy notifications:', e);
    }
  }

  _getCurrentUserId() {
    try {
      const user = authService.getCurrentUser();
      return user ? (user.id || user.email) : null;
    } catch {
      return null;
    }
  }

  _getStorageKey(targetUserId = null) {
    const uid = targetUserId || this._getCurrentUserId();
    if (!uid) return null;
    return `${STORAGE_PREFIX}${uid}`;
  }

  _notifySubscribers(targetUserId = null) {
    if (typeof window !== 'undefined') {
      window.dispatchEvent(new CustomEvent(EVENT_NAME, { detail: { targetUserId } }));
    }
  }

  /**
   * Lấy toàn bộ danh sách thông báo của tài khoản hiện tại (Mới nhất xếp trên đầu)
   * Nếu chưa đăng nhập / đã đăng xuất, trả về mảng rỗng []
   */
  getNotifications(targetUserId = null) {
    const key = this._getStorageKey(targetUserId);
    if (!key) return [];

    try {
      const raw = localStorage.getItem(key);
      if (!raw) return [];
      const list = JSON.parse(raw);
      if (!Array.isArray(list)) return [];

      const sorted = list.sort((a, b) => new Date(b.timestamp) - new Date(a.timestamp));

      // Lọc sạch trùng lặp ngay khi đọc từ bộ nhớ (loại bỏ các thông báo rác lặp nội dung trước đây)
      const seen = new Set();
      const uniqueList = [];
      for (const item of sorted) {
        const dedupeKey = `${(item.title || '').trim().toLowerCase()}|${(item.message || '').trim().toLowerCase()}`;
        if (!seen.has(dedupeKey)) {
          seen.add(dedupeKey);
          uniqueList.push(item);
        }
      }

      // Tự động cập nhật lại kho lưu trữ nếu có bản ghi trùng lặp bị loại bỏ
      if (uniqueList.length !== list.length) {
        try {
          localStorage.setItem(key, JSON.stringify(uniqueList));
        } catch (_) {}
      }

      return uniqueList;
    } catch (e) {
      console.error('Lỗi đọc notifications:', e);
      return [];
    }
  }

  /**
   * Đếm số lượng thông báo chưa đọc của tài khoản hiện tại
   */
  getUnreadCount(targetUserId = null) {
    const list = this.getNotifications(targetUserId);
    return list.filter((item) => !item.isRead).length;
  }

  /**
   * Thêm mới một thông báo vào kho lưu trữ của tài khoản
   * Có cơ chế CHỐNG TRÙNG LẶP (Deduplication) triệt để
   */
  addNotification({ title, message, type = 'info', txHash = null, details = null, action = null, targetUserId = null }) {
    if (!title || !message) return null;

    const uid = targetUserId || this._getCurrentUserId();
    if (!uid) {
      // Khi người dùng chưa đăng nhập, không lưu thông báo cá nhân vào quả chuông
      return null;
    }

    const key = this._getStorageKey(uid);
    if (!key) return null;

    const list = this.getNotifications(uid);

    // CHỐNG TRÙNG LẶP:
    // 1. Nếu có thông báo cùng title & message trong vòng 15 phút gần nhất -> Bỏ qua
    // 2. Nếu cùng tiêu đề (ví dụ 'Đã ngắt kết nối MetaMask') trong vòng 3 phút -> Bỏ qua
    const now = Date.now();
    const cleanTitle = title.trim().toLowerCase();
    const cleanMsg = message.trim().toLowerCase();

    const isDuplicate = list.some((item) => {
      const itemTitle = (item.title || '').trim().toLowerCase();
      const itemMsg = (item.message || '').trim().toLowerCase();
      const isSameTitle = itemTitle === cleanTitle;
      const isSameMsg = itemMsg === cleanMsg;

      if (!isSameTitle) return false;
      const ageMs = now - new Date(item.timestamp).getTime();

      // Cùng title và cùng nội dung trong vòng 15 phút -> Bỏ qua
      if (isSameMsg && ageMs < 15 * 60 * 1000) return true;

      // Cùng tiêu đề trạng thái ví / kết nối trong vòng 3 phút -> Bỏ qua
      if (ageMs < 3 * 60 * 1000 && isSameTitle) return true;

      return false;
    });

    if (isDuplicate) {
      return null;
    }

    const newNotice = {
      id: `notif-${Date.now()}-${Math.random().toString(36).substring(2, 7)}`,
      userId: uid,
      title: title.trim(),
      message: message.trim(),
      type, // 'info' | 'success' | 'event' | 'error' | 'warning'
      txHash,
      details: details || message,
      action,
      timestamp: new Date().toISOString(),
      isRead: false,
    };

    // Giữ tối đa 50 thông báo gần nhất cho mỗi người dùng
    const updated = [newNotice, ...list].slice(0, 50);
    try {
      localStorage.setItem(key, JSON.stringify(updated));
      this._notifySubscribers(uid);
    } catch (e) {
      console.error('Lỗi lưu notification mới:', e);
    }
    return newNotice;
  }

  /**
   * Đánh dấu 1 thông báo là đã đọc
   */
  markAsRead(id, targetUserId = null) {
    const uid = targetUserId || this._getCurrentUserId();
    const key = this._getStorageKey(uid);
    if (!key) return;

    const list = this.getNotifications(uid);
    let hasChange = false;
    const updated = list.map((item) => {
      if (item.id === id && !item.isRead) {
        hasChange = true;
        return { ...item, isRead: true };
      }
      return item;
    });

    if (hasChange) {
      try {
        localStorage.setItem(key, JSON.stringify(updated));
        this._notifySubscribers(uid);
      } catch (e) {
        console.error('Lỗi cập nhật trạng thái thông báo:', e);
      }
    }
  }

  /**
   * Đánh dấu tất cả thông báo là đã đọc
   */
  markAllAsRead(targetUserId = null) {
    const uid = targetUserId || this._getCurrentUserId();
    const key = this._getStorageKey(uid);
    if (!key) return;

    const list = this.getNotifications(uid);
    const updated = list.map((item) => ({ ...item, isRead: true }));
    try {
      localStorage.setItem(key, JSON.stringify(updated));
      this._notifySubscribers(uid);
    } catch (e) {
      console.error('Lỗi đánh dấu đã đọc tất cả:', e);
    }
  }

  /**
   * Xóa 1 thông báo
   */
  deleteNotification(id, targetUserId = null) {
    const uid = targetUserId || this._getCurrentUserId();
    const key = this._getStorageKey(uid);
    if (!key) return;

    const list = this.getNotifications(uid);
    const updated = list.filter((item) => item.id !== id);
    try {
      localStorage.setItem(key, JSON.stringify(updated));
      this._notifySubscribers(uid);
    } catch (e) {
      console.error('Lỗi xóa thông báo:', e);
    }
  }

  /**
   * Xóa toàn bộ lịch sử thông báo của tài khoản hiện tại
   */
  clearAll(targetUserId = null) {
    const uid = targetUserId || this._getCurrentUserId();
    const key = this._getStorageKey(uid);
    if (!key) return;

    try {
      localStorage.setItem(key, JSON.stringify([]));
      this._notifySubscribers(uid);
    } catch (e) {
      console.error('Lỗi xóa toàn bộ thông báo:', e);
    }
  }

  /**
   * Đăng ký lắng nghe sự kiện thay đổi thông báo cho tài khoản
   */
  subscribe(callback, targetUserId = null) {
    if (typeof window === 'undefined') return () => {};
    const handler = (e) => {
      const activeUid = targetUserId || this._getCurrentUserId();
      if (!activeUid) {
        callback([], 0);
        return;
      }
      if (!e.detail?.targetUserId || e.detail.targetUserId === activeUid) {
        callback(this.getNotifications(activeUid), this.getUnreadCount(activeUid));
      }
    };
    window.addEventListener(EVENT_NAME, handler);
    return () => {
      window.removeEventListener(EVENT_NAME, handler);
    };
  }
}

export const notificationService = new NotificationService();
