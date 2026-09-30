import React, { useState, useRef, useEffect } from 'react';
import { 
  ShieldCheck, 
  Factory, 
  Store, 
  Wrench, 
  User, 
  LogOut, 
  LogIn, 
  Settings,
  ChevronDown, 
  Sun, 
  Moon,
  Menu,
  Search,
  Radio,
  Home,
  Maximize2,
  Minimize2
} from 'lucide-react';
import NotificationBell from './NotificationBell';

export default function Navbar({
  activeRole,
  onConnectMetaMask,
  onDisconnectMetaMask,
  activeTab,
  onSelectTab,
  networkMode,
  onToggleNetworkMode,
  eventCount,
  isMetaMaskConnected,
  metaMaskAddress,
  metaMaskNetwork,
  metaMaskBalance,
  onTopUpFaucet,
  isFaucetLoading,
  onSwitchToGanache,
  currentUser,
  onOpenAuthModal,
  onLogout,
  onOpenProfile,
  onOpenSettings,
  theme = 'dark',
  onToggleTheme,
  onToggleSidebar,
  isSidebarOpen = false,
}) {
  const [showUserMenu, setShowUserMenu] = useState(false);
  const menuRef = useRef(null);
  const [isFullscreen, setIsFullscreen] = useState(
    typeof document !== 'undefined' ? Boolean(document.fullscreenElement) : false
  );

  useEffect(() => {
    const handleFsChange = () => {
      setIsFullscreen(Boolean(document.fullscreenElement));
    };
    document.addEventListener('fullscreenchange', handleFsChange);
    return () => document.removeEventListener('fullscreenchange', handleFsChange);
  }, []);

  const handleToggleFullscreen = () => {
    if (!document.fullscreenElement) {
      document.documentElement.requestFullscreen().catch((err) => {
        console.warn('Lỗi kích hoạt toàn màn hình:', err);
      });
    } else {
      if (document.exitFullscreen) {
        document.exitFullscreen().catch((err) => {
          console.warn('Lỗi thoát toàn màn hình:', err);
        });
      }
    }
  };

  useEffect(() => {
    const handleClickOutside = (e) => {
      if (menuRef.current && !menuRef.current.contains(e.target)) {
        setShowUserMenu(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const navItems = [
    {
      id: 'home',
      label: 'Trang Chủ',
      icon: Home,
      badge: null,
      visible: true,
    },
    {
      id: 'lookup',
      label: 'Tra Cứu & Bảo Hành',
      icon: Search,
      badge: null,
      visible: true,
    },
    {
      id: 'events',
      label: 'Sổ Cái Sự Kiện',
      icon: Radio,
      badge: eventCount > 0 ? `${eventCount}` : null,
      badgeColor: 'bg-blue-100 text-blue-700 dark:bg-blue-900/40 dark:text-blue-300',
      visible: Boolean(currentUser),
    },
    {
      id: 'manufacturer',
      label: 'Cổng Nhà SX',
      icon: Factory,
      badge: null,
      visible: currentUser?.role === 'MANUFACTURER',
    },
    {
      id: 'seller',
      label: 'Cổng Đại Lý',
      icon: Store,
      badge: null,
      visible: currentUser?.role === 'SELLER',
    },
    {
      id: 'service',
      label: 'Trạm Dịch Vụ',
      icon: Wrench,
      badge: null,
      visible: currentUser?.role === 'SERVICE_CENTER',
    },
  ];

  return (
    <header className="sticky top-0 z-30 bg-white/90 dark:bg-slate-900/90 backdrop-blur-md border-b border-slate-200 dark:border-slate-800/80 px-4 lg:px-8 py-3 transition-colors">
      <div className="w-full flex items-center justify-between gap-3">
        
        {/* Left: Mobile hamburger menu toggle + Logo */}
        <div className="flex items-center gap-3 shrink-0">
          {/* Hamburger button (Chỉ hiển thị trên điện thoại / màn hình thích nghi nhỏ hơn < xl) */}
          <button
            type="button"
            onClick={onToggleSidebar}
            className={`xl:hidden p-2 rounded-xl border transition-all duration-200 cursor-pointer flex items-center justify-center active:scale-95 ${
              isSidebarOpen
                ? 'bg-blue-600 text-white border-blue-600 shadow-md shadow-blue-600/30 ring-2 ring-blue-600/20'
                : 'bg-slate-100 hover:bg-blue-50 dark:bg-slate-800 dark:hover:bg-slate-700 border-slate-200 dark:border-slate-700 text-slate-700 dark:text-slate-200 hover:text-blue-600 dark:hover:text-blue-400'
            }`}
            title={isSidebarOpen ? 'Thu gọn menu điều hướng (Sidebar)' : 'Mở menu điều hướng (Sidebar)'}
            aria-label="Toggle navigation menu"
          >
            <Menu className="w-5 h-5 transition-transform" />
          </button>

          {/* Logo & Brand Name */}
          <div 
            className="flex items-center gap-2.5 cursor-pointer group" 
            onClick={() => onSelectTab && onSelectTab('home')}
          >
            <div className="w-9 h-9 rounded-2xl bg-white dark:bg-slate-900 border border-blue-500/40 p-0.5 overflow-hidden flex items-center justify-center shrink-0 group-hover:scale-105 group-hover:border-blue-500 transition-all shadow-sm">
              <img
                src="/logo.png"
                alt="TrustWarranty Logo"
                className="w-full h-full object-cover rounded-xl"
              />
            </div>
            <div className="hidden sm:block">
              <div className="flex items-center gap-1.5">
                <span className="font-black text-base tracking-tight text-slate-900 dark:text-white group-hover:text-blue-600 dark:group-hover:text-blue-400 transition-colors">
                  TrustWarranty
                </span>
              </div>
              <p className="text-[10px] text-slate-500 dark:text-slate-400 font-medium hidden md:block">
                Quản lý Bảo hành On-Chain
              </p>
            </div>
          </div>
        </div>

        {/* Center: Desktop Navigation Bar (Thanh điều hướng nằm ở đoạn trên này cho máy tính) */}
        <nav className="hidden xl:flex items-center gap-1 p-1 rounded-2xl bg-slate-100/80 dark:bg-slate-950/70 border border-slate-200/90 dark:border-slate-800">
          {navItems
            .filter((item) => item.visible)
            .map((item) => {
              const Icon = item.icon;
              const isActive = activeTab === item.id;
              return (
                <button
                  key={item.id}
                  type="button"
                  onClick={() => onSelectTab(item.id)}
                  className={`flex items-center gap-2 px-3 py-1.5 rounded-xl text-xs font-bold transition-all cursor-pointer whitespace-nowrap active:scale-98 ${
                    isActive
                      ? 'bg-blue-600 text-white shadow-md shadow-blue-600/25 ring-2 ring-blue-600/20'
                      : 'text-slate-600 hover:text-blue-600 hover:bg-white dark:text-slate-300 dark:hover:text-white dark:hover:bg-slate-800/80'
                  }`}
                >
                  <Icon className={`w-3.5 h-3.5 ${isActive ? 'text-white' : 'text-slate-400'}`} />
                  <span>{item.label}</span>
                  {item.badge && (
                    <span
                      className={`px-1.5 py-0.2 rounded-full text-[10px] font-extrabold ${
                        isActive
                          ? 'bg-white/25 text-white'
                          : item.badgeColor || 'bg-blue-100 text-blue-700 dark:bg-blue-900/40 dark:text-blue-300'
                      }`}
                    >
                      {item.badge}
                    </span>
                  )}
                </button>
              );
            })}
        </nav>

        {/* Right: Controls, Bell & Theme Actions */}
        <div className="flex items-center gap-2 shrink-0">
          
          {/* QUẢ CHUÔNG THÔNG BÁO (Notification Center) */}
          <NotificationBell 
            currentUser={currentUser} 
            onOpenAuthModal={onOpenAuthModal} 
          />

          {/* NÚT CHUYỂN ĐỔI CHẾ ĐỘ SÁNG / TỐI (Theme Toggle) */}
          <button
            type="button"
            onClick={onToggleTheme}
            className="p-2 rounded-xl bg-slate-100 hover:bg-slate-200 dark:bg-slate-800/80 dark:hover:bg-slate-800 border border-slate-200 dark:border-slate-700/80 text-slate-600 dark:text-slate-300 hover:text-slate-900 dark:hover:text-white transition cursor-pointer"
            title={theme === 'dark' ? 'Chuyển sang Giao diện Sáng (Light Mode)' : 'Chuyển sang Giao diện Tối (Dark Mode)'}
            aria-label="Toggle theme"
          >
            {theme === 'dark' ? (
              <Sun className="w-4 h-4 text-amber-400 hover:rotate-45 transition-transform" />
            ) : (
              <Moon className="w-4 h-4 text-indigo-600 hover:-rotate-12 transition-transform" />
            )}
          </button>

          {/* NÚT BẬT / TẮT TOÀN MÀN HÌNH (Fullscreen Mode Toggle) */}
          <button
            type="button"
            onClick={handleToggleFullscreen}
            className="p-2 rounded-xl bg-slate-100 hover:bg-slate-200 dark:bg-slate-800/80 dark:hover:bg-slate-800 border border-slate-200 dark:border-slate-700/80 text-slate-600 dark:text-slate-300 hover:text-slate-900 dark:hover:text-white transition cursor-pointer"
            title={isFullscreen ? 'Thu nhỏ giao diện (Thoát toàn màn hình)' : 'Phóng to toàn màn hình (Fullscreen F11)'}
            aria-label="Toggle fullscreen"
          >
            {isFullscreen ? (
              <Minimize2 className="w-4 h-4 text-blue-600 dark:text-blue-400" />
            ) : (
              <Maximize2 className="w-4 h-4 text-slate-600 dark:text-slate-400" />
            )}
          </button>

          {/* METAMASK CONNECT / STATUS BUTTON (Chỉ hiển thị cho các vai trò cần tương tác On-Chain: Nhà sản xuất, Đại lý, Trạm dịch vụ) */}
          {currentUser && ['MANUFACTURER', 'SELLER', 'SERVICE_CENTER'].includes(currentUser.role) && (
            isMetaMaskConnected ? (
              <div className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-xl bg-orange-500/10 dark:bg-orange-500/15 border border-orange-500/30 dark:border-orange-500/35 text-xs text-orange-600 dark:text-orange-400">
                <span className="text-base leading-none">🦊</span>
                <span className="font-mono font-bold text-slate-800 dark:text-slate-200">
                  {metaMaskAddress ? `${metaMaskAddress.slice(0, 6)}...${metaMaskAddress.slice(-4)}` : ''}
                </span>
                {metaMaskNetwork && !['Ganache', 'Chain #1337', '1337', '5777'].includes(metaMaskNetwork) && !metaMaskNetwork.includes('1337') && onSwitchToGanache ? (
                  <button
                    type="button"
                    onClick={onSwitchToGanache}
                    className="text-[10px] px-2 py-0.5 rounded bg-amber-500/20 hover:bg-amber-500/30 text-amber-700 dark:text-amber-300 font-bold transition cursor-pointer flex items-center gap-1 border border-amber-500/40"
                    title="MetaMask đang kết nối mạng khác. Bấm để tự động chuyển sang mạng Ganache Local (1337)"
                  >
                    <span>⚠️ {metaMaskNetwork}</span>
                    <span className="underline text-[9px]">Chuyển sang Ganache</span>
                  </button>
                ) : (
                  <span className="text-[10px] px-1.5 py-0.5 rounded bg-orange-500/20 text-orange-600 dark:text-orange-300 font-semibold uppercase">
                    Ganache
                  </span>
                )}

                {/* Số dư ETH */}
                <span 
                  className="text-[11px] font-mono font-bold px-2 py-0.5 rounded bg-emerald-500/15 dark:bg-emerald-500/20 text-emerald-600 dark:text-emerald-400 border border-emerald-500/30 shadow-xs"
                  title={`Số dư ví thực tế trên MetaMask: ${metaMaskBalance || '0.00'} ETH`}
                >
                  {`${metaMaskBalance || '0.00'} ETH`}
                </span>

                <button
                  type="button"
                  onClick={onDisconnectMetaMask}
                  title="Ngắt kết nối MetaMask"
                  className="ml-1 text-slate-400 hover:text-rose-500 p-0.5 transition cursor-pointer"
                >
                  <LogOut className="w-3.5 h-3.5" />
                </button>
              </div>
            ) : (
              <button
                onClick={onConnectMetaMask}
                className="flex items-center gap-2 px-3.5 py-1.5 rounded-xl bg-gradient-to-r from-amber-500 via-orange-500 to-amber-600 hover:from-amber-400 hover:to-orange-400 text-white font-bold text-xs shadow-lg shadow-orange-500/20 transition cursor-pointer active:scale-95"
              >
                <span className="text-base leading-none">🦊</span>
                <span>Kết nối MetaMask</span>
              </button>
            )
          )}

          {/* EMBEDDED WALLET BADGE CHO KHÁCH HÀNG (CUSTOMER) */}
          {currentUser && currentUser.role === 'CUSTOMER' && currentUser.walletAddress && currentUser.walletAddress !== '0x0000000000000000000000000000000000000000' && (
            <div 
              className="hidden md:flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-emerald-500/10 dark:bg-emerald-500/15 border border-emerald-500/30 text-xs text-emerald-700 dark:text-emerald-300"
              title={`Ví Ngầm Bảo Mật (MPC / Embedded Wallet): ${currentUser.walletAddress}`}
            >
              <ShieldCheck className="w-3.5 h-3.5 text-emerald-500 shrink-0" />
              <span className="font-mono font-bold text-[11px]">
                {`${currentUser.walletAddress.slice(0, 6)}...${currentUser.walletAddress.slice(-4)}`}
              </span>
              <span className="text-[9px] px-1.5 py-0.2 rounded bg-emerald-500/20 text-emerald-700 dark:text-emerald-300 font-extrabold uppercase">
                Gasless ⚡
              </span>
            </div>
          )}

          {/* USER PROFILE DROPDOWN OR LOGIN BUTTON */}
          {currentUser ? (
            <div className="relative" ref={menuRef}>
              <button
                type="button"
                onClick={() => setShowUserMenu(!showUserMenu)}
                className="flex items-center gap-2 p-1.5 pr-2.5 rounded-xl bg-slate-100 hover:bg-slate-200 dark:bg-slate-800/80 dark:hover:bg-slate-800 border border-slate-200 dark:border-slate-700/80 text-xs text-slate-800 dark:text-white transition cursor-pointer"
              >
                <div className="w-6 h-6 rounded-lg bg-gradient-to-tr from-blue-600 to-indigo-600 font-bold text-[11px] flex items-center justify-center text-white">
                  {currentUser.fullName ? currentUser.fullName.charAt(0).toUpperCase() : 'U'}
                </div>
                <span className="font-semibold max-w-[100px] truncate hidden sm:inline">
                  {currentUser.fullName || currentUser.username}
                </span>
                <ChevronDown className={`w-3.5 h-3.5 text-slate-400 transition-transform ${showUserMenu ? 'rotate-180' : ''}`} />
              </button>

              {/* User Dropdown Menu */}
              {showUserMenu && (
                <div className="absolute right-0 mt-2 w-56 rounded-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700/80 shadow-2xl p-2 text-xs z-50 animate-fade-in space-y-1">
                  <div className="px-3 py-2 border-b border-slate-100 dark:border-slate-800">
                    <div className="font-bold text-slate-900 dark:text-white truncate">{currentUser.fullName}</div>
                    <div className="text-[11px] text-slate-500 dark:text-slate-400 font-mono truncate">{currentUser.email}</div>
                    <div className="flex items-center gap-1.5 mt-1 flex-wrap">
                      <span className="inline-block text-[9px] font-bold px-2 py-0.5 rounded bg-blue-500/15 dark:bg-blue-500/20 text-blue-600 dark:text-blue-300 uppercase">
                        {currentUser.role}
                      </span>
                      {currentUser.role === 'CUSTOMER' && (currentUser.walletType === 'EMBEDDED_MPC' || currentUser.isEmbedded) && (
                        <span className="inline-block text-[9px] font-bold px-1.5 py-0.5 rounded bg-emerald-500/15 text-emerald-600 dark:text-emerald-400">
                          Ví Ngầm MPC ⚡
                        </span>
                      )}
                    </div>
                  </div>

                  <button
                    type="button"
                    onClick={() => {
                      setShowUserMenu(false);
                      onOpenProfile();
                    }}
                    className="w-full flex items-center gap-2.5 px-3 py-2 rounded-xl text-slate-700 dark:text-slate-300 hover:text-slate-900 dark:hover:text-white hover:bg-slate-100 dark:hover:bg-slate-800 transition cursor-pointer text-left"
                  >
                    <User className="w-4 h-4 text-blue-500" />
                    <span>Trang cá nhân</span>
                  </button>

                  <button
                    type="button"
                    onClick={() => {
                      setShowUserMenu(false);
                      onOpenSettings();
                    }}
                    className="w-full flex items-center gap-2.5 px-3 py-2 rounded-xl text-slate-700 dark:text-slate-300 hover:text-slate-900 dark:hover:text-white hover:bg-slate-100 dark:hover:bg-slate-800 transition cursor-pointer text-left"
                  >
                    <Settings className="w-4 h-4 text-indigo-500" />
                    <span>Cài đặt & Bảo mật</span>
                  </button>

                  <div className="border-t border-slate-100 dark:border-slate-800 my-1" />

                  <button
                    type="button"
                    onClick={() => {
                      setShowUserMenu(false);
                      onLogout();
                    }}
                    className="w-full flex items-center gap-2.5 px-3 py-2 rounded-xl text-rose-500 hover:text-rose-600 hover:bg-rose-50 dark:hover:bg-rose-500/10 transition cursor-pointer text-left font-semibold"
                  >
                    <LogOut className="w-4 h-4 text-rose-500" />
                    <span>Đăng xuất</span>
                  </button>
                </div>
              )}
            </div>
          ) : (
            <button
              type="button"
              onClick={onOpenAuthModal}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-blue-600 hover:bg-blue-500 text-white font-bold text-xs shadow-md shadow-blue-600/30 transition cursor-pointer active:scale-95"
            >
              <LogIn className="w-3.5 h-3.5" />
              <span>Đăng nhập</span>
            </button>
          )}

        </div>

      </div>
    </header>
  );
}
