import React, { useEffect } from 'react';
import {
  Home,
  Search,
  Radio,
  Factory,
  Store,
  Wrench,
  User,
  X,
  ShieldCheck,
  Cpu,
  Layers,
  CheckCircle2,
  AlertTriangle,
  Wallet,
  ExternalLink,
  ChevronRight
} from 'lucide-react';

export default function Sidebar({
  activeTab,
  onSelectTab,
  currentUser,
  eventCount = 0,
  isMetaMaskConnected,
  metaMaskAddress,
  metaMaskNetwork,
  onConnectMetaMask,
  networkMode = 'LOCAL',
  isOpen = false,
  onClose,
}) {
  // Lắng nghe phím Escape để tự động đóng Drawer
  useEffect(() => {
    const handleKeyDown = (e) => {
      if (e.key === 'Escape' && isOpen && onClose) {
        onClose();
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isOpen, onClose]);

  const navItems = [
    {
      id: 'home',
      label: 'Trang Chủ',
      desc: 'Giới thiệu & Tổng quan giải pháp',
      icon: Home,
      badge: null,
      visible: true,
    },
    {
      id: 'lookup',
      label: 'Tra Cứu & Bảo Hành',
      desc: 'Kích hoạt, tra cứu, chuyển nhượng',
      icon: Search,
      badge: null,
      visible: true,
    },
    {
      id: 'events',
      label: 'Sổ Cái Sự Kiện On-Chain',
      desc: 'Giám sát giao dịch thời gian thực',
      icon: Radio,
      badge: eventCount > 0 ? `${eventCount}` : null,
      badgeColor: 'bg-blue-100 text-blue-700 dark:bg-blue-500/20 dark:text-blue-300',
      visible: Boolean(currentUser),
    },
    {
      id: 'manufacturer',
      label: 'Cổng Nhà Sản Xuất',
      desc: 'Đăng ký thiết bị xuất xưởng',
      icon: Factory,
      badge: null,
      visible: currentUser?.role === 'MANUFACTURER',
    },
    {
      id: 'seller',
      label: 'Cổng Đại Lý Bán Lẻ',
      desc: 'Nhập kho, kích hoạt, gia hạn',
      icon: Store,
      badge: null,
      visible: currentUser?.role === 'SELLER',
    },
    {
      id: 'service',
      label: 'Cổng Trạm Dịch Vụ',
      desc: 'Tiếp nhận RMA, ghi biên bản sửa',
      icon: Wrench,
      badge: null,
      visible: currentUser?.role === 'SERVICE_CENTER',
    },
  ];

  const handleItemClick = (id) => {
    onSelectTab(id);
    if (onClose) onClose();
  };

  const getRoleInfo = (role) => {
    switch (role) {
      case 'MANUFACTURER':
        return { label: 'Nhà sản xuất (OEM)', color: 'text-amber-600 dark:text-amber-400 bg-amber-50 dark:bg-amber-950/40 border-amber-200 dark:border-amber-800', icon: Factory };
      case 'SELLER':
        return { label: 'Đại lý phân phối', color: 'text-emerald-600 dark:text-emerald-400 bg-emerald-50 dark:bg-emerald-950/40 border-emerald-200 dark:border-emerald-800', icon: Store };
      case 'SERVICE_CENTER':
        return { label: 'Trạm dịch vụ ủy quyền', color: 'text-indigo-600 dark:text-indigo-400 bg-indigo-50 dark:bg-indigo-950/40 border-indigo-200 dark:border-indigo-800', icon: Wrench };
      case 'CUSTOMER':
        return { label: 'Khách hàng cá nhân', color: 'text-blue-600 dark:text-blue-400 bg-blue-50 dark:bg-blue-950/40 border-blue-200 dark:border-blue-800', icon: User };
      default:
        return { label: 'Khách vãng lai (Chỉ đọc)', color: 'text-slate-600 dark:text-slate-400 bg-slate-100 dark:bg-slate-800 border-slate-200 dark:border-slate-700', icon: ShieldCheck };
    }
  };

  const roleInfo = getRoleInfo(currentUser?.role);
  const RoleIcon = roleInfo.icon;

  const sidebarContent = (
    <aside className="w-full h-full flex flex-col justify-between bg-white dark:bg-slate-900 border-r border-slate-200 dark:border-slate-800 text-slate-800 dark:text-slate-200 transition-colors select-none shadow-2xl">
      
      {/* Top Section: Brand & User Role */}
      <div className="p-4 sm:p-5 border-b border-slate-200 dark:border-slate-800 space-y-4">
        {/* Brand Banner */}
        <div className="flex items-center justify-between">
          <div 
            onClick={() => handleItemClick('home')}
            className="flex items-center gap-3 cursor-pointer group"
          >
            <div className="w-10 h-10 rounded-2xl bg-white dark:bg-slate-950 border border-blue-500/40 p-0.5 overflow-hidden shadow-md shadow-blue-500/20 group-hover:border-blue-500 group-hover:scale-105 transition-all flex items-center justify-center shrink-0">
              <img
                src="/logo.png"
                alt="TrustWarranty Logo"
                className="w-full h-full object-cover rounded-xl"
              />
            </div>
            <div>
              <div className="flex items-center gap-1.5">
                <span className="font-black text-base tracking-tight text-slate-900 dark:text-white group-hover:text-blue-600 dark:group-hover:text-blue-400 transition-colors">
                  TrustWarranty
                </span>
              </div>
              <p className="text-[10px] text-slate-500 dark:text-slate-400 font-medium">
                Quản lý Bảo hành On-Chain
              </p>
            </div>
          </div>

          {/* Close button (Luôn hiển thị trên mọi kích thước khi mở Drawer) */}
          {onClose && (
            <button
              onClick={onClose}
              className="p-1.5 rounded-xl bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 dark:hover:bg-slate-700 text-slate-500 hover:text-slate-900 dark:hover:text-white transition cursor-pointer"
              title="Thu gọn menu điều hướng"
              aria-label="Đóng thanh điều hướng"
            >
              <X className="w-5 h-5" />
            </button>
          )}
        </div>

        {/* Current User Role Identity Card */}
        <div className={`p-2.5 rounded-2xl border ${roleInfo.color} flex items-center gap-2.5 text-xs`}>
          <div className="w-7 h-7 rounded-xl bg-white/80 dark:bg-slate-900/80 flex items-center justify-center shrink-0 shadow-xs">
            <RoleIcon className="w-3.5 h-3.5" />
          </div>
          <div className="min-w-0 flex-1">
            <div className="text-[10px] uppercase font-bold tracking-wider opacity-75 leading-none">
              Quyền hạn hiện tại
            </div>
            <div className="font-bold text-xs truncate mt-0.5">
              {roleInfo.label}
            </div>
          </div>
        </div>
      </div>

      {/* Middle Section: Navigation Menu Links */}
      <div className="flex-1 overflow-y-auto p-3 sm:p-4 space-y-1.5">
        <div className="px-3 pb-1 text-[10px] font-extrabold uppercase tracking-wider text-slate-400 dark:text-slate-500">
          Danh Mục Quản Trị
        </div>

        {navItems
          .filter((item) => item.visible)
          .map((item) => {
            const Icon = item.icon;
            const isActive = activeTab === item.id;
            return (
              <button
                key={item.id}
                type="button"
                onClick={() => handleItemClick(item.id)}
                className={`w-full flex items-center justify-between gap-3 px-3.5 py-3 rounded-2xl text-xs transition cursor-pointer group text-left ${
                  isActive
                    ? 'bg-blue-600 text-white font-bold shadow-md shadow-blue-600/25 ring-2 ring-blue-600/20'
                    : 'text-slate-700 dark:text-slate-300 hover:bg-blue-50/80 hover:text-blue-600 dark:hover:bg-slate-800/80 dark:hover:text-white'
                }`}
              >
                <div className="flex items-center gap-3 min-w-0">
                  <Icon
                    className={`w-4 h-4 shrink-0 transition-transform group-hover:scale-110 ${
                      isActive ? 'text-white' : 'text-slate-400 group-hover:text-blue-600 dark:group-hover:text-blue-400'
                    }`}
                  />
                  <div className="truncate">
                    <div className="truncate font-semibold">{item.label}</div>
                    <div
                      className={`text-[10px] truncate ${
                        isActive ? 'text-blue-100 font-normal' : 'text-slate-400 dark:text-slate-500'
                      }`}
                    >
                      {item.desc}
                    </div>
                  </div>
                </div>

                {item.badge && (
                  <span
                    className={`px-2 py-0.5 rounded-full text-[10px] font-bold shrink-0 ${
                      isActive
                        ? 'bg-white/20 text-white'
                        : item.badgeColor || 'bg-slate-100 text-slate-600 dark:bg-slate-800 dark:text-slate-300'
                    }`}
                  >
                    {item.badge}
                  </span>
                )}
              </button>
            );
          })}
      </div>

      {/* Bottom Section: Web3 Wallet & Network Status */}
      <div className="p-3 sm:p-4 border-t border-slate-200 dark:border-slate-800 bg-slate-50/70 dark:bg-slate-950/50 space-y-2.5 text-xs">
        
        {/* Network Indicator */}
        <div className="flex items-center justify-between text-[11px] px-1 text-slate-500 dark:text-slate-400">
          <span className="flex items-center gap-1.5 font-medium">
            <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />
            <span>Sổ cái On-Chain:</span>
          </span>
          <span className="font-mono font-bold text-slate-700 dark:text-slate-300">
            {networkMode === 'LOCAL' ? 'Hardhat EVM' : 'Sepolia'}
          </span>
        </div>

        {/* MetaMask Connection Card */}
        {currentUser && currentUser.role === 'CUSTOMER' ? (
          currentUser.walletAddress && currentUser.walletAddress !== '0x0000000000000000000000000000000000000000' ? (
            <div className="p-2.5 rounded-xl bg-emerald-500/10 border border-emerald-500/25 flex items-center justify-between gap-2 text-[11px]">
              <div className="flex items-center gap-2 truncate">
                <span className="text-base leading-none">🛡️</span>
                <div className="truncate">
                  <div className="font-mono font-bold text-slate-900 dark:text-white truncate">
                    {`${currentUser.walletAddress.slice(0, 6)}...${currentUser.walletAddress.slice(-4)}`}
                  </div>
                  <div className="text-[10px] text-emerald-600 dark:text-emerald-400 font-semibold flex items-center gap-1">
                    <span>Ví Web3 của bạn</span>
                    <span className="text-[9px] px-1 rounded bg-emerald-500/20 font-bold">Bảo mật ⚡</span>
                  </div>
                </div>
              </div>
              <span className="w-2 h-2 rounded-full bg-emerald-500 shrink-0" title="Ví Web3 đang hoạt động" />
            </div>
          ) : null
        ) : isMetaMaskConnected ? (
          <div className="p-2.5 rounded-xl bg-orange-500/10 border border-orange-500/25 flex items-center justify-between gap-2 text-[11px]">
            <div className="flex items-center gap-2 truncate">
              <span className="text-sm">🦊</span>
              <div className="truncate">
                <div className="font-mono font-bold text-slate-900 dark:text-white truncate">
                  {metaMaskAddress ? `${metaMaskAddress.slice(0, 6)}...${metaMaskAddress.slice(-4)}` : ''}
                </div>
                <div className="text-[10px] text-orange-600 dark:text-orange-400 font-semibold">
                  Đã kết nối Web3
                </div>
              </div>
            </div>
            <span className="w-2 h-2 rounded-full bg-emerald-500 shrink-0" title="Ví sẵn sàng giao dịch" />
          </div>
        ) : (
          currentUser && ['MANUFACTURER', 'SELLER', 'SERVICE_CENTER'].includes(currentUser.role) && onConnectMetaMask && (
            <button
              type="button"
              onClick={onConnectMetaMask}
              className="w-full py-2 px-3 rounded-xl bg-gradient-to-r from-amber-500 to-orange-500 hover:from-amber-600 hover:to-orange-600 text-white font-bold text-xs flex items-center justify-center gap-1.5 shadow-md shadow-orange-500/20 transition cursor-pointer active:scale-98"
            >
              <span>🦊</span>
              <span>Kết nối MetaMask</span>
            </button>
          )
        )}

        <div className="text-[10px] text-center text-slate-400 dark:text-slate-500 pt-1">
          TrustWarranty v2.5 • Wholesale & Retail
        </div>

      </div>

    </aside>
  );

  return (
    <div
      className={`fixed inset-0 z-50 transition-all duration-300 ${
        isOpen ? 'visible pointer-events-auto' : 'invisible pointer-events-none'
      }`}
    >
      {/* Backdrop overlay */}
      <div
        className={`fixed inset-0 bg-slate-950/60 backdrop-blur-sm transition-opacity duration-300 ${
          isOpen ? 'opacity-100' : 'opacity-0'
        }`}
        onClick={onClose}
      />

      {/* Drawer content with smooth slide transition */}
      <div
        className={`relative z-10 w-72 sm:w-80 max-w-[85vw] h-full shadow-2xl transition-transform duration-300 ease-out transform ${
          isOpen ? 'translate-x-0' : '-translate-x-full'
        }`}
      >
        {sidebarContent}
      </div>
    </div>
  );
}
