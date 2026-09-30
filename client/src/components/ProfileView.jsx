import React, { useState, useEffect } from 'react';
import { 
  User, 
  Settings, 
  LogOut, 
  Mail, 
  Phone, 
  Wallet, 
  Calendar, 
  ShieldCheck, 
  Factory, 
  Store, 
  Wrench, 
  Lock, 
  CheckCircle2, 
  AlertCircle, 
  Trash2, 
  Copy, 
  ExternalLink,
  Laptop,
  QrCode,
  Tag
} from 'lucide-react';
import { authService } from '../services/auth';
import { clearDatabaseApi } from '../services/api';
import { blockchainService } from '../services/blockchain';

export default function ProfileView({ 
  currentUser, 
  onLogout, 
  allProducts, 
  onSelectSerial, 
  onNotify, 
  metaMaskAddress,
  onDataReset,
  onConnectMetaMask,
  onTopUpFaucet,
  metaMaskBalance,
  isFaucetLoading,
  initialSubTab = 'profile',
  onSubTabChange
}) {
  const [activeSubTab, setActiveSubTab] = useState(initialSubTab);
  const [copiedWallet, setCopiedWallet] = useState(false);

  // Đồng bộ subtab khi cha (Navbar dropdown) thay đổi lựa chọn
  useEffect(() => {
    if (initialSubTab) {
      setActiveSubTab(initialSubTab);
    }
  }, [initialSubTab]);

  const handleSwitchSubTab = (tab) => {
    setActiveSubTab(tab);
    if (onSubTabChange) {
      onSubTabChange(tab);
    }
  };

  // Settings form states
  const [profileForm, setProfileForm] = useState({
    fullName: currentUser?.fullName || '',
    phone: currentUser?.phone || '',
    walletAddress: currentUser?.walletAddress || metaMaskAddress || '',
  });

  // Đồng bộ profileForm khi currentUser thay đổi
  useEffect(() => {
    if (currentUser) {
      setProfileForm({
        fullName: currentUser.fullName || '',
        phone: currentUser.phone || '',
        walletAddress: currentUser.walletAddress || '',
      });
    }
  }, [currentUser]);

  // Tự động nhận diện và cập nhật mã ví khi MetaMask kết nối
  useEffect(() => {
    if (currentUser.role !== 'CUSTOMER' && metaMaskAddress && (!profileForm.walletAddress || profileForm.walletAddress === '0x0000000000000000000000000000000000000000')) {
      setProfileForm((prev) => ({
        ...prev,
        walletAddress: metaMaskAddress
      }));
    }
  }, [metaMaskAddress]);

  const [profileLoading, setProfileLoading] = useState(false);
  const [profileSuccess, setProfileSuccess] = useState('');
  const [profileError, setProfileError] = useState('');

  // Password change state
  const [passwordForm, setPasswordForm] = useState({
    oldPassword: '',
    newPassword: '',
    confirmPassword: '',
  });
  const [passwordLoading, setPasswordLoading] = useState(false);
  const [passwordSuccess, setPasswordSuccess] = useState('');
  const [passwordError, setPasswordError] = useState('');

  // Clear database state
  const [clearLoading, setClearLoading] = useState(false);

  if (!currentUser) return null;

  const handleCopyWallet = () => {
    if (currentUser.walletAddress) {
      navigator.clipboard.writeText(currentUser.walletAddress);
      setCopiedWallet(true);
      setTimeout(() => setCopiedWallet(false), 2000);
    }
  };

  const handleUpdateProfile = async (e) => {
    e.preventDefault();
    setProfileLoading(true);
    setProfileError('');
    setProfileSuccess('');

    if (profileForm.phone && !/^\d{10}$/.test(profileForm.phone.trim())) {
      setProfileError('Số điện thoại phải gồm đúng 10 chữ số và không chứa chữ cái');
      setProfileLoading(false);
      return;
    }

    try {
      // Nếu có cập nhật hoặc liên kết ví mới, yêu cầu xác nhận chữ ký MetaMask trước
      if (currentUser.role !== 'CUSTOMER' && profileForm.walletAddress && profileForm.walletAddress.trim()) {
        const cleanWallet = profileForm.walletAddress.trim();
        const connectedAddr = await blockchainService.ensureMetaMaskConnected();

        if (connectedAddr.toLowerCase() !== cleanWallet.toLowerCase()) {
          throw new Error(`Địa chỉ ví nhập (${cleanWallet.slice(0, 6)}...${cleanWallet.slice(-4)}) không khớp với tài khoản MetaMask đang mở (${connectedAddr.slice(0, 6)}...${connectedAddr.slice(-4)}). Vui lòng chuyển sang đúng tài khoản trên MetaMask.`);
        }

        const linkMessage = `XÁC THỰC QUYỀN SỞ HỮU VÍ METAMASK:
- Tài khoản: ${currentUser.email} (${currentUser.fullName})
- Địa chỉ ví liên kết: ${cleanWallet}
- Thời gian xác thực: ${new Date().toLocaleString('vi-VN')}

Bằng việc ký thông điệp này, bạn xác nhận là chủ sở hữu hợp pháp của ví để lưu vào hồ sơ TrustWarranty.`;

        try {
          await window.ethereum.request({
            method: 'personal_sign',
            params: [linkMessage, connectedAddr],
          });
        } catch (signErr) {
          if (signErr.code === 4001 || signErr.message?.includes('denied') || signErr.message?.includes('rejected')) {
            throw new Error('Bạn đã từ chối ký xác nhận quyền sở hữu ví trên MetaMask. Thông tin hồ sơ chưa được lưu.');
          }
          throw signErr;
        }
      }

      const updatedUser = await authService.updateProfile(profileForm);
      if (profileForm.walletAddress && ['MANUFACTURER', 'SELLER', 'SERVICE_CENTER'].includes(currentUser.role)) {
        localStorage.setItem('trustwarranty_linked_wallet_' + currentUser.id, profileForm.walletAddress.toLowerCase());
      }
      setProfileSuccess(currentUser.role === 'CUSTOMER' ? 'Cập nhật thông tin cá nhân thành công!' : 'Cập nhật thông tin cá nhân và liên kết ví MetaMask thành công!');
      if (onNotify) {
        onNotify({
          type: 'success',
          title: 'Cập nhật thành công',
          message: currentUser.role === 'CUSTOMER' ? 'Thông tin hồ sơ cá nhân đã được lưu trữ an toàn.' : 'Thông tin hồ sơ cá nhân và ví liên kết đã được xác thực qua MetaMask và lưu trữ an toàn.',
        });
      }
    } catch (err) {
      setProfileError(err.message || 'Lỗi khi cập nhật thông tin');
    } finally {
      setProfileLoading(false);
    }
  };

  const handleChangePassword = async (e) => {
    e.preventDefault();
    setPasswordLoading(true);
    setPasswordError('');
    setPasswordSuccess('');

    if (passwordForm.newPassword.length < 6) {
      setPasswordError('Mật khẩu mới phải có tối thiểu 6 ký tự');
      setPasswordLoading(false);
      return;
    }

    if (!/[!@#$%^&*()_+\-=\[\]{};':"\\|,.<>\/?~`]/.test(passwordForm.newPassword)) {
      setPasswordError('Mật khẩu mới phải chứa ít nhất 1 ký tự đặc biệt (!@#$%^&*...)');
      setPasswordLoading(false);
      return;
    }

    if (passwordForm.newPassword !== passwordForm.confirmPassword) {
      setPasswordError('Mật khẩu mới và mật khẩu xác nhận không khớp');
      setPasswordLoading(false);
      return;
    }

    try {
      await authService.changePassword({
        oldPassword: passwordForm.oldPassword,
        newPassword: passwordForm.newPassword,
      });
      setPasswordSuccess('Đổi mật khẩu bảo mật thành công!');
      setPasswordForm({ oldPassword: '', newPassword: '', confirmPassword: '' });
      if (onNotify) {
        onNotify({
          type: 'success',
          title: 'Đổi mật khẩu thành công',
          message: 'Mật khẩu đăng nhập mới của bạn đã có hiệu lực ngay bây giờ.',
        });
      }
    } catch (err) {
      setPasswordError(err.message || 'Lỗi khi đổi mật khẩu');
    } finally {
      setPasswordLoading(false);
    }
  };

  const handleClearDatabase = async () => {
    const confirm = window.confirm('Bạn có chắc chắn muốn xóa toàn bộ sản phẩm trong database để nhập dữ liệu mới từ đầu không? Thao tác này sẽ yêu cầu xác thực chữ ký Admin trên MetaMask.');
    if (!confirm) return;

    setClearLoading(true);
    try {
      // Bắt buộc xác thực chữ ký admin qua MetaMask
      const adminAddr = await blockchainService.ensureMetaMaskConnected();
      const clearMessage = `XÁC NHẬN ĐẶC QUYỀN QUẢN TRỊ VIÊN:
- Thao tác: XÓA VÀ LÀM MỚI DATABASE HỆ THỐNG
- Người thực hiện: ${currentUser.fullName} (${currentUser.email})
- Địa chỉ ví quản trị: ${adminAddr}
- Thời gian xác thực: ${new Date().toLocaleString('vi-VN')}

CẢNH BÁO: Thao tác này sẽ xóa sạch dữ liệu sản phẩm trong cơ sở dữ liệu.`;

      try {
        await window.ethereum.request({
          method: 'personal_sign',
          params: [clearMessage, adminAddr],
        });
      } catch (signErr) {
        if (signErr.code === 4001 || signErr.message?.includes('denied') || signErr.message?.includes('rejected')) {
          alert('Bạn đã từ chối xác nhận trên MetaMask. Thao tác xóa database đã bị hủy bỏ an toàn.');
          return;
        }
        throw signErr;
      }

      await clearDatabaseApi();
      blockchainService.clearLocalCache();
      if (onDataReset) onDataReset();
      if (onNotify) {
        onNotify({
          type: 'info',
          title: 'Đã làm mới cơ sở dữ liệu',
          message: 'Toàn bộ danh mục sản phẩm đã được xóa trắng sau khi xác nhận chữ ký quản trị trên MetaMask.',
        });
      }
    } catch (err) {
      alert(err.message || 'Lỗi khi xóa database');
    } finally {
      setClearLoading(false);
    }
  };

  // Lọc thiết bị liên quan đến user (khớp theo Ví On-Chain, Số Điện Thoại hoặc Email)
  const userWallet = (currentUser.walletAddress || '').toLowerCase();
  const userPhone = (currentUser.phone || '').trim();
  const userEmail = (currentUser.email || '').toLowerCase().trim();
  const myDevices = allProducts.filter(p => {
    const owner = (p.currentOwner || '').toLowerCase();
    const mfg = (p.manufacturer || '').toLowerCase();
    const bWallet = (p.buyerWallet || p.customerAddress || p.ownerAddress || '').toLowerCase().trim();
    const bPhone = (p.buyerPhone || p.customerPhone || '').trim();
    const bEmail = (p.buyerEmail || p.customerEmail || '').toLowerCase().trim();

    if (userWallet && (owner === userWallet || mfg === userWallet || bWallet === userWallet)) return true;
    if (userPhone && bPhone && userPhone === bPhone) return true;
    if (userEmail && bEmail && userEmail === bEmail) return true;
    return false;
  });

  const getRoleBadge = (role) => {
    switch (role) {
      case 'MANUFACTURER':
        return { label: 'Nhà sản xuất (OEM)', color: 'bg-blue-500/15 text-blue-600 dark:text-blue-400 border-blue-500/30', icon: Factory };
      case 'SELLER':
        return { label: 'Đại lý phân phối', color: 'bg-emerald-500/15 text-emerald-700 dark:text-emerald-400 border-emerald-500/30', icon: Store };
      case 'SERVICE_CENTER':
        return { label: 'Trạm dịch vụ ủy quyền', color: 'bg-amber-500/15 text-amber-700 dark:text-amber-400 border-amber-500/30', icon: Wrench };
      default:
        return { label: 'Khách hàng / Người dùng', color: 'bg-blue-500/15 text-blue-600 dark:text-blue-400 border-blue-500/30', icon: User };
    }
  };

  const roleInfo = getRoleBadge(currentUser.role);
  const RoleIcon = roleInfo.icon;

  return (
    <div className="space-y-6">
      
      {/* Profile Header Banner */}
      <div className="p-6 md:p-8 rounded-3xl bg-white dark:bg-gradient-to-r dark:from-slate-900 dark:via-slate-900/90 dark:to-slate-950 border border-slate-200 dark:border-slate-800 shadow-xl dark:shadow-2xl relative overflow-hidden transition-colors">
        <div className="flex flex-col md:flex-row items-start md:items-center justify-between gap-6 relative z-10">
          
          {/* User Info Avatar & Title */}
          <div className="flex items-center gap-5">
            <div className="w-16 h-16 md:w-20 md:h-20 rounded-2xl bg-gradient-to-tr from-blue-600 to-indigo-600 text-white font-extrabold text-2xl flex items-center justify-center shadow-lg shadow-blue-500/25 border border-white/10 shrink-0">
              {currentUser.fullName ? currentUser.fullName.charAt(0).toUpperCase() : 'U'}
            </div>

            <div className="space-y-1">
              <div className="flex items-center gap-2 flex-wrap">
                <span className={`inline-flex items-center gap-1 text-[11px] font-bold px-2.5 py-0.5 rounded-full border ${roleInfo.color}`}>
                  <RoleIcon className="w-3.5 h-3.5" />
                  <span>{roleInfo.label}</span>
                </span>
                <span className="text-xs text-slate-500 dark:text-slate-400 font-mono">@{currentUser.username}</span>
              </div>
              <h1 className="text-xl md:text-2xl font-bold text-slate-900 dark:text-white tracking-tight">
                {currentUser.fullName}
              </h1>
              <p className="text-xs text-slate-600 dark:text-slate-400 flex items-center gap-1.5">
                <Mail className="w-3.5 h-3.5 text-slate-400" />
                <span>{currentUser.email}</span>
                {currentUser.phone && (
                  <>
                    <span className="text-slate-300 dark:text-slate-600">•</span>
                    <Phone className="w-3.5 h-3.5 text-slate-400" />
                    <span>{currentUser.phone}</span>
                  </>
                )}
              </p>
            </div>
          </div>

          {/* Action: Logout & Quick Stats */}
          <div className="flex items-center gap-3">
            <button
              onClick={onLogout}
              className="px-4 py-2.5 rounded-xl bg-rose-500/10 hover:bg-rose-500/20 text-rose-600 dark:text-rose-300 border border-rose-500/30 text-xs font-bold flex items-center gap-2 transition cursor-pointer"
              title="Đăng xuất khỏi hệ thống"
            >
              <LogOut className="w-4 h-4 text-rose-500 dark:text-rose-400" />
              <span>Đăng xuất</span>
            </button>
          </div>

        </div>
      </div>

      {/* Sub-Tabs: Trang cá nhân & Cài đặt */}
      <div className="flex border-b border-slate-200 dark:border-slate-800 gap-6">
        <button
          onClick={() => handleSwitchSubTab('profile')}
          className={`pb-3 text-sm font-bold flex items-center gap-2 border-b-2 transition cursor-pointer ${
            activeSubTab === 'profile'
              ? 'border-blue-500 text-blue-600 dark:text-blue-400'
              : 'border-transparent text-slate-500 hover:text-slate-800 dark:text-slate-400 dark:hover:text-slate-200'
          }`}
        >
          <User className="w-4 h-4" />
          <span>Trang Cá Nhân</span>
        </button>

        <button
          onClick={() => handleSwitchSubTab('settings')}
          className={`pb-3 text-sm font-bold flex items-center gap-2 border-b-2 transition cursor-pointer ${
            activeSubTab === 'settings'
              ? 'border-blue-500 text-blue-600 dark:text-blue-400'
              : 'border-transparent text-slate-500 hover:text-slate-800 dark:text-slate-400 dark:hover:text-slate-200'
          }`}
        >
          <Settings className="w-4 h-4" />
          <span>Cài Đặt & Bảo Mật</span>
        </button>
      </div>

      {/* SUB-TAB 1: TRANG CÁ NHÂN */}
      {activeSubTab === 'profile' && (
        <div className="space-y-6">
          
          {/* Account Information Card */}
          <div className="glass-card rounded-3xl p-6 border border-slate-200 dark:border-slate-800 space-y-4">
            <h3 className="text-sm font-bold text-slate-900 dark:text-white flex items-center gap-2 border-b border-slate-200 dark:border-slate-800 pb-3">
              <User className="w-4 h-4 text-blue-500 dark:text-blue-400" />
              Thông tin Tài khoản
            </h3>

            <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-4 text-xs">
              <div className="p-3 rounded-xl bg-slate-50 dark:bg-slate-950/60 border border-slate-200 dark:border-slate-800/60 space-y-1">
                <span className="text-slate-500 dark:text-slate-400 block text-[11px]">Mã người dùng:</span>
                <span className="font-mono text-slate-800 dark:text-slate-200 font-semibold">{currentUser.id}</span>
              </div>

              <div className="p-3 rounded-xl bg-slate-50 dark:bg-slate-950/60 border border-slate-200 dark:border-slate-800/60 space-y-1">
                <span className="text-slate-500 dark:text-slate-400 block text-[11px]">Tên đăng nhập:</span>
                <span className="font-mono text-slate-800 dark:text-slate-200 font-semibold">{currentUser.username}</span>
              </div>

              <div className="p-3 rounded-xl bg-slate-50 dark:bg-slate-950/60 border border-slate-200 dark:border-slate-800/60 space-y-1">
                <span className="text-slate-500 dark:text-slate-400 block text-[11px]">Họ và tên:</span>
                <span className="text-slate-800 dark:text-slate-200 font-semibold">{currentUser.fullName}</span>
              </div>

              <div className="p-3 rounded-xl bg-slate-50 dark:bg-slate-950/60 border border-slate-200 dark:border-slate-800/60 space-y-1">
                <span className="text-slate-500 dark:text-slate-400 block text-[11px]">Email:</span>
                <span className="text-slate-800 dark:text-slate-200 font-semibold truncate block">{currentUser.email}</span>
              </div>

              <div className="p-3 rounded-xl bg-slate-50 dark:bg-slate-950/60 border border-slate-200 dark:border-slate-800/60 space-y-1">
                <span className="text-slate-500 dark:text-slate-400 block text-[11px]">Số điện thoại:</span>
                <span className="text-slate-800 dark:text-slate-200 font-semibold">{currentUser.phone || 'Chưa cập nhật'}</span>
              </div>

              <div className="p-3 rounded-xl bg-slate-50 dark:bg-slate-950/60 border border-slate-200 dark:border-slate-800/60 space-y-1">
                <span className="text-slate-500 dark:text-slate-400 block text-[11px]">Ngày đăng ký:</span>
                <span className="text-slate-800 dark:text-slate-200 font-semibold">
                  {new Date(currentUser.createdAt).toLocaleDateString('vi-VN')}
                </span>
              </div>

              {/* Web3 Linked Wallet Information Card */}
              <div className="p-3.5 rounded-xl bg-slate-50 dark:bg-slate-950/60 border border-slate-200 dark:border-slate-800/60 space-y-2 sm:col-span-2 md:col-span-3">
                <div className="flex items-center justify-between flex-wrap gap-2">
                  <span className="text-slate-600 dark:text-slate-400 text-[11px] font-semibold flex items-center gap-1.5">
                    <Wallet className="w-3.5 h-3.5 text-blue-500" />
                    <span>Địa chỉ ví Web3 liên kết:</span>
                    {currentUser.role === 'CUSTOMER' || currentUser.walletType === 'EMBEDDED_MPC' || currentUser.isEmbedded ? (
                      <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-emerald-500/15 text-emerald-600 dark:text-emerald-400 border border-emerald-500/30 flex items-center gap-1">
                        <ShieldCheck className="w-3 h-3" /> Ví Ngầm Tự Động (MPC / Embedded)
                      </span>
                    ) : (
                      <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-orange-500/15 text-orange-600 dark:text-orange-400 border border-orange-500/30">
                        MetaMask Web3
                      </span>
                    )}
                  </span>

                  {currentUser.walletAddress && currentUser.walletAddress !== '0x0000000000000000000000000000000000000000' && (
                    <button
                      type="button"
                      onClick={handleCopyWallet}
                      className="text-[11px] text-blue-600 dark:text-blue-400 hover:underline flex items-center gap-1 cursor-pointer font-semibold"
                    >
                      <Copy className="w-3 h-3" />
                      <span>{copiedWallet ? 'Đã sao chép!' : 'Sao chép địa chỉ'}</span>
                    </button>
                  )}
                </div>

                <div className="font-mono text-slate-900 dark:text-slate-100 text-xs font-bold break-all pt-0.5">
                  {currentUser.walletAddress && currentUser.walletAddress !== '0x0000000000000000000000000000000000000000' 
                    ? currentUser.walletAddress 
                    : (currentUser.role === 'CUSTOMER' ? 'Đang khởi tạo ví ngầm...' : 'Chưa liên kết ví (Vào tab "Cài Đặt & Bảo Mật" để kết nối ví MetaMask)')}
                </div>

                {currentUser.role === 'CUSTOMER' && (
                  <p className="text-[11px] text-slate-500 dark:text-slate-400 leading-relaxed pt-0.5 border-t border-slate-200/60 dark:border-slate-800/60">
                    💡 Khách hàng không cần cài đặt MetaMask hay tốn phí Gas. Ví này được hệ thống tự động khởi tạo để nhận quyền sở hữu thiết bị và kích hoạt bảo hành on-chain hoàn toàn miễn phí.
                  </p>
                )}
              </div>
            </div>
          </div>

          {/* User's Devices & Assets Section */}
          <div className="glass-card rounded-3xl p-6 border border-slate-200 dark:border-slate-800 space-y-4">
            <div className="flex items-center justify-between border-b border-slate-200 dark:border-slate-800 pb-4">
              <div className="flex items-center gap-2">
                <Laptop className="w-5 h-5 text-blue-500 dark:text-blue-400" />
                <h3 className="text-base font-bold text-slate-900 dark:text-white">
                  Thiết Bị Của Bạn ({myDevices.length})
                </h3>
              </div>
            </div>

            {myDevices.length > 0 ? (
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
                {myDevices.map((prod) => (
                  <div
                    key={prod.serialNumber}
                    onClick={() => onSelectSerial && onSelectSerial(prod.serialNumber)}
                    className="p-4 rounded-2xl bg-white dark:bg-slate-950/70 border border-slate-200 dark:border-slate-800/80 hover:border-blue-500/50 hover:bg-slate-50 dark:hover:bg-slate-900/80 transition cursor-pointer space-y-2"
                  >
                    <div className="flex items-center justify-between text-xs">
                      <span className="font-bold text-blue-600 dark:text-blue-400">{prod.brand}</span>
                      <span className={`px-2 py-0.5 rounded-full text-[10px] font-bold ${
                        prod.status === 1 ? 'bg-emerald-500/15 text-emerald-600 dark:text-emerald-400' : 'bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-400'
                      }`}>
                        {prod.status === 1 ? 'Đang bảo hành' : 'Chờ kích hoạt'}
                      </span>
                    </div>
                    <div className="font-bold text-slate-900 dark:text-white text-sm truncate">{prod.name}</div>
                    <div className="font-mono text-slate-500 dark:text-slate-400 text-xs">SN: {prod.serialNumber}</div>
                  </div>
                ))}
              </div>
            ) : (
              <div className="text-center py-8 text-xs text-slate-500 dark:text-slate-400 space-y-2">
                <p>Bạn chưa có thiết bị nào liên kết với địa chỉ ví này.</p>
                <p className="text-slate-400 dark:text-slate-500">
                  Hãy sang cổng <strong>Nhà sản xuất</strong> để tự đăng ký thiết bị mới, hoặc vào <strong>Tra cứu</strong> để kích hoạt sản phẩm.
                </p>
              </div>
            )}
          </div>

        </div>
      )}

      {/* SUB-TAB 2: CÀI ĐẶT */}
      {activeSubTab === 'settings' && (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6 text-xs">
          
          {/* Column 1: Update Profile Form */}
          <div className="glass-card rounded-2xl p-6 border border-slate-200 dark:border-slate-800 space-y-4">
            <h3 className="text-sm font-bold text-slate-900 dark:text-white flex items-center gap-2 border-b border-slate-200 dark:border-slate-800 pb-3">
              <Settings className="w-4 h-4 text-blue-500 dark:text-blue-400" />
              Cập nhật Thông tin Cá nhân
            </h3>

            {profileError && (
              <div className="p-3 rounded-xl bg-rose-500/10 border border-rose-500/30 text-rose-600 dark:text-rose-300 flex items-center gap-2">
                <AlertCircle className="w-4 h-4 text-rose-500 dark:text-rose-400 shrink-0" />
                <span>{profileError}</span>
              </div>
            )}

            {profileSuccess && (
              <div className="p-3 rounded-xl bg-emerald-500/10 border border-emerald-500/30 text-emerald-600 dark:text-emerald-300 flex items-center gap-2">
                <CheckCircle2 className="w-4 h-4 text-emerald-500 dark:text-emerald-400 shrink-0" />
                <span>{profileSuccess}</span>
              </div>
            )}

            <form onSubmit={handleUpdateProfile} className="space-y-3.5">
              <div>
                <label className="block text-slate-700 dark:text-slate-400 mb-1 font-semibold">Họ và tên</label>
                <input
                  type="text"
                  required
                  value={profileForm.fullName}
                  onChange={(e) => setProfileForm({ ...profileForm, fullName: e.target.value })}
                  className="w-full px-3 py-2 rounded-xl bg-slate-50 dark:bg-slate-950 border border-slate-300 dark:border-slate-800 text-slate-900 dark:text-white focus:border-blue-500 focus:outline-none"
                />
              </div>

              <div>
                <div className="flex items-center justify-between mb-1">
                  <label className="text-slate-700 dark:text-slate-400 font-semibold">Số điện thoại</label>
                  <span className="text-[10px] text-slate-400">Đúng 10 số</span>
                </div>
                <input
                  type="text"
                  maxLength={10}
                  value={profileForm.phone}
                  onChange={(e) => setProfileForm({ ...profileForm, phone: e.target.value.replace(/\D/g, '') })}
                  placeholder="0912345678"
                  className="w-full px-3 py-2 rounded-xl bg-slate-50 dark:bg-slate-950 border border-slate-300 dark:border-slate-800 text-slate-900 dark:text-white font-mono focus:border-blue-500 focus:outline-none"
                />
              </div>

              {currentUser.role !== 'CUSTOMER' && (
                <div>
                  <div className="flex items-center justify-between mb-1.5 flex-wrap gap-1">
                    <label className="text-slate-700 dark:text-slate-400 font-semibold flex items-center gap-1.5">
                      <Wallet className="w-3.5 h-3.5 text-orange-500" />
                      <span>Địa chỉ ví Ethereum Web3</span>
                    </label>
                    {metaMaskAddress ? (
                      <button
                        type="button"
                        onClick={() => setProfileForm({ ...profileForm, walletAddress: metaMaskAddress })}
                        className="text-[10px] text-orange-600 dark:text-orange-400 hover:text-orange-500 font-semibold flex items-center gap-1 px-2 py-0.5 rounded-lg bg-orange-500/10 border border-orange-500/30 hover:bg-orange-500/20 transition cursor-pointer"
                        title="Bấm để lấy địa chỉ ví MetaMask hiện tại"
                      >
                        <CheckCircle2 className="w-3 h-3 text-emerald-500" />
                        <span>Đồng bộ ví MetaMask</span>
                      </button>
                    ) : onConnectMetaMask ? (
                      <button
                        type="button"
                        onClick={onConnectMetaMask}
                        className="text-[10px] text-orange-600 dark:text-orange-300 hover:text-white font-semibold flex items-center gap-1 px-2.5 py-1 rounded-lg bg-orange-500/15 border border-orange-500/35 hover:bg-orange-500/25 transition cursor-pointer"
                      >
                        <span>🦊 Kết nối MetaMask</span>
                      </button>
                    ) : null}
                  </div>
                  <input
                    type="text"
                    value={profileForm.walletAddress}
                    onChange={(e) => setProfileForm({ ...profileForm, walletAddress: e.target.value })}
                    placeholder="0x..."
                    className="w-full px-3 py-2 rounded-xl bg-slate-50 dark:bg-slate-950 border border-slate-300 dark:border-slate-800 text-slate-900 dark:text-white font-mono text-[11px] focus:border-blue-500 focus:outline-none"
                  />
                  <p className="text-[10px] text-slate-500 mt-1">
                    {metaMaskAddress
                      ? `Ví MetaMask đang phát hiện: ${metaMaskAddress.slice(0, 10)}...${metaMaskAddress.slice(-6)}`
                      : 'Kết nối MetaMask để tự động đồng bộ hóa mã ví với hồ sơ của bạn.'
                    }
                  </p>
                </div>
              )}

              <button
                type="submit"
                disabled={profileLoading}
                className="w-full py-2.5 rounded-xl bg-blue-600 hover:bg-blue-500 text-white font-bold transition flex items-center justify-center gap-2 cursor-pointer disabled:opacity-50"
              >
                {profileLoading ? 'Đang lưu...' : 'Lưu Thay Đổi'}
              </button>
            </form>
          </div>

          {/* Column 2: Change Password & Danger Zone */}
          <div className="space-y-6">
            
            {/* Change Password Card */}
            <div className="glass-card rounded-2xl p-6 border border-slate-200 dark:border-slate-800 space-y-4">
              <h3 className="text-sm font-bold text-slate-900 dark:text-white flex items-center gap-2 border-b border-slate-200 dark:border-slate-800 pb-3">
                <Lock className="w-4 h-4 text-blue-600 dark:text-blue-400" />
                Đổi Mật Khẩu
              </h3>

              {passwordError && (
                <div className="p-3 rounded-xl bg-rose-500/10 border border-rose-500/30 text-rose-600 dark:text-rose-300 flex items-center gap-2">
                  <AlertCircle className="w-4 h-4 text-rose-500 dark:text-rose-400 shrink-0" />
                  <span>{passwordError}</span>
                </div>
              )}

              {passwordSuccess && (
                <div className="p-3 rounded-xl bg-emerald-500/10 border border-emerald-500/30 text-emerald-600 dark:text-emerald-300 flex items-center gap-2">
                  <CheckCircle2 className="w-4 h-4 text-emerald-500 dark:text-emerald-400 shrink-0" />
                  <span>{passwordSuccess}</span>
                </div>
              )}

              <form onSubmit={handleChangePassword} className="space-y-3.5">
                <div>
                  <label className="block text-slate-700 dark:text-slate-400 mb-1 font-semibold">Mật khẩu hiện tại</label>
                  <input
                    type="password"
                    required
                    value={passwordForm.oldPassword}
                    onChange={(e) => setPasswordForm({ ...passwordForm, oldPassword: e.target.value })}
                    className="w-full px-3 py-2 rounded-xl bg-slate-50 dark:bg-slate-950 border border-slate-300 dark:border-slate-800 text-slate-900 dark:text-white focus:border-blue-500 focus:outline-none"
                  />
                </div>

                <div>
                  <div className="flex items-center justify-between mb-1">
                    <label className="text-slate-700 dark:text-slate-400 font-semibold">Mật khẩu mới</label>
                    <span className="text-[10px] text-slate-400">≥ 6 ký tự + 1 ký tự đặc biệt</span>
                  </div>
                  <input
                    type="password"
                    required
                    minLength={6}
                    value={passwordForm.newPassword}
                    onChange={(e) => setPasswordForm({ ...passwordForm, newPassword: e.target.value })}
                    placeholder="Tối thiểu 6 ký tự (Ví dụ: Pass@123)"
                    className="w-full px-3 py-2 rounded-xl bg-slate-50 dark:bg-slate-950 border border-slate-300 dark:border-slate-800 text-slate-900 dark:text-white focus:border-blue-500 focus:outline-none"
                  />
                </div>

                <div>
                  <label className="block text-slate-700 dark:text-slate-400 mb-1 font-semibold">Xác nhận mật khẩu mới</label>
                  <input
                    type="password"
                    required
                    value={passwordForm.confirmPassword}
                    onChange={(e) => setPasswordForm({ ...passwordForm, confirmPassword: e.target.value })}
                    className="w-full px-3 py-2 rounded-xl bg-slate-50 dark:bg-slate-950 border border-slate-300 dark:border-slate-800 text-slate-900 dark:text-white focus:border-blue-500 focus:outline-none"
                  />
                </div>

                <button
                  type="submit"
                  disabled={passwordLoading}
                  className="w-full py-2.5 rounded-xl bg-blue-600 hover:bg-blue-700 text-white font-bold transition flex items-center justify-center gap-2 cursor-pointer disabled:opacity-50 shadow-md shadow-blue-600/20"
                >
                  {passwordLoading ? 'Đang xử lý...' : 'Xác Nhận Đổi Mật Khẩu'}
                </button>
              </form>
            </div>

          </div>

        </div>
      )}

    </div>
  );
}
