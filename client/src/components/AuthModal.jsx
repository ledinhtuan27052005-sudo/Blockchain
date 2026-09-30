import React, { useState, useEffect } from 'react';
import ReactDOM from 'react-dom';
import { 
  X, 
  LogIn, 
  UserPlus, 
  User, 
  Mail, 
  Lock, 
  Eye, 
  EyeOff, 
  Phone, 
  ShieldCheck, 
  Factory, 
  Store, 
  Wrench, 
  Wallet,
  AlertCircle,
  CheckCircle2,
  Clock,
  RotateCw,
  ArrowLeft,
  KeyRound
} from 'lucide-react';
import { authService } from '../services/auth';

// Biểu thức chính quy kiểm tra định dạng
const GMAIL_REGEX = /^[a-zA-Z0-9._%+-]+@gmail\.com$/i;
const PHONE_10_DIGIT_REGEX = /^\d{10}$/;

// Giá trị mặc định hoàn toàn trống cho form đăng ký
const initialRegisterState = {
  username: '',
  email: '',
  password: '',
  confirmPassword: '',
  fullName: '',
  phone: '',
  role: 'CUSTOMER',
  walletAddress: '',
};

export default function AuthModal({ 
  isOpen, 
  onClose, 
  onAuthSuccess, 
  metaMaskAddress,
  onConnectMetaMask,
  initialTab = 'login'
}) {
  const [tab, setTab] = useState(initialTab || 'login'); // 'login' | 'register'
  const [step, setStep] = useState('form'); // 'form' | 'otp'
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [errorMsg, setErrorMsg] = useState('');
  const [successMsg, setSuccessMsg] = useState('');

  // OTP state
  const [otpCode, setOtpCode] = useState('');
  const [countdown, setCountdown] = useState(60);
  const [canResend, setCanResend] = useState(false);
  const [devOtpHint, setDevOtpHint] = useState('');

  // Login form state
  const [loginIdentifier, setLoginIdentifier] = useState('');
  const [loginPassword, setLoginPassword] = useState('');

  // Register form state (luôn bắt đầu hoàn toàn trống, không tự động điền sẵn)
  const [registerData, setRegisterData] = useState({ ...initialRegisterState });

  // Reset toàn bộ thông tin đăng nhập và đăng ký mỗi khi mở modal hoặc thay đổi initialTab
  useEffect(() => {
    if (isOpen) {
      setTab(initialTab || 'login');
      setStep('form');
      setErrorMsg('');
      setSuccessMsg('');
      setOtpCode('');
      setDevOtpHint('');
      setShowPassword(false);
      setRegisterData({ ...initialRegisterState });
      setLoginIdentifier('');
      setLoginPassword('');
    }
  }, [isOpen, initialTab]);

  // Bộ đếm ngược thời gian cho nút Gửi lại OTP
  useEffect(() => {
    let timer;
    if (step === 'otp' && countdown > 0) {
      timer = setInterval(() => {
        setCountdown((prev) => prev - 1);
      }, 1000);
    } else if (countdown === 0) {
      setCanResend(true);
    }
    return () => clearInterval(timer);
  }, [step, countdown]);

  if (!isOpen) return null;

  // Thực thi Đăng nhập sau khi vượt qua Captcha thành công
  const executeLogin = async () => {
    setErrorMsg('');
    setSuccessMsg('');
    setLoading(true);

    try {
      const res = await authService.login({
        usernameOrEmail: loginIdentifier.trim(),
        password: loginPassword,
      });
      onAuthSuccess(res.user);
      onClose();
    } catch (err) {
      setErrorMsg(err.message || 'Lỗi khi đăng nhập');
    } finally {
      setLoading(false);
    }
  };


  // Gửi OTP xác thực đến email người dùng
  const handleSendOtp = async () => {
    setErrorMsg('');
    setSuccessMsg('');
    setLoading(true);

    try {
      const res = await authService.sendOtp({
        username: registerData.username.trim(),
        email: registerData.email.trim(),
        phone: registerData.phone.trim(),
        password: registerData.password,
        fullName: registerData.fullName.trim(),
      });

      setSuccessMsg(`Mã OTP đã được gửi đến ${registerData.email}. Vui lòng kiểm tra hộp thư.`);
      if (res.devOtp) {
        setDevOtpHint(res.devOtp);
      }
      setStep('otp');
      setCountdown(60);
      setCanResend(false);
    } catch (err) {
      setErrorMsg(err.message || 'Lỗi gửi mã OTP qua email');
    } finally {
      setLoading(false);
    }
  };

  // Gửi lại mã OTP
  const handleResendOtp = async () => {
    if (!canResend || loading) return;
    await handleSendOtp();
  };

  // Xác nhận OTP và hoàn tất Đăng ký tài khoản
  const handleVerifyOtpAndRegister = async (e) => {
    e.preventDefault();
    setErrorMsg('');
    setSuccessMsg('');

    if (!otpCode.trim() || otpCode.trim().length !== 6) {
      setErrorMsg('Vui lòng nhập đủ 6 chữ số mã OTP xác thực');
      return;
    }

    setLoading(true);
    try {
      const res = await authService.register({
        username: registerData.username.trim(),
        email: registerData.email.trim(),
        password: registerData.password,
        fullName: registerData.fullName.trim(),
        phone: registerData.phone.trim(),
        role: registerData.role,
        walletAddress: registerData.walletAddress.trim() || '0x0000000000000000000000000000000000000000',
        otp: otpCode.trim(),
      });

      setSuccessMsg('Đăng ký tài khoản và xác thực email thành công!');
      // Xoá sạch toàn bộ dữ liệu đăng ký để không lưu lại bất cứ thông tin nào
      setRegisterData({ ...initialRegisterState });
      setOtpCode('');
      setDevOtpHint('');
      setStep('form');

      setTimeout(() => {
        onAuthSuccess(res.user);
        onClose();
      }, 600);
    } catch (err) {
      setErrorMsg(err.message || 'Xác thực OTP thất bại');
    } finally {
      setLoading(false);
    }
  };

  // Submit Đăng nhập -> Kiểm tra form và kích hoạt Captcha kéo ghép ảnh
  const handleLoginSubmit = (e) => {
    e.preventDefault();
    setErrorMsg('');
    setSuccessMsg('');

    if (!loginIdentifier.trim() || !loginPassword.trim()) {
      setErrorMsg('Vui lòng nhập đầy đủ tên đăng nhập và mật khẩu');
      return;
    }

    executeLogin();
  };

  // Submit Đăng ký -> Kiểm tra toàn bộ ràng buộc và hoàn tất đăng ký ngay
  const handleRegisterSubmit = async (e) => {
    e.preventDefault();
    setErrorMsg('');
    setSuccessMsg('');

    // 1. Kiểm tra Họ và tên
    if (!registerData.fullName.trim()) {
      setErrorMsg('Vui lòng nhập Họ và tên');
      return;
    }

    // 2. Kiểm tra Tên đăng nhập (tối thiểu 6 ký tự)
    if (registerData.username.trim().length < 6) {
      setErrorMsg('Tên đăng nhập phải có từ 6 ký tự trở lên');
      return;
    }

    // 3. Kiểm tra Email (bắt buộc đuôi @gmail.com)
    if (!GMAIL_REGEX.test(registerData.email.trim())) {
      setErrorMsg('Địa chỉ email bắt buộc phải có đuôi @gmail.com (ví dụ: name@gmail.com)');
      return;
    }

    // 4. Kiểm tra Số điện thoại (nếu nhập, phải đúng 10 số)
    if (registerData.phone.trim() && !PHONE_10_DIGIT_REGEX.test(registerData.phone.trim())) {
      setErrorMsg('Số điện thoại phải gồm đúng 10 chữ số (0-9) và không chứa chữ cái hay ký tự đặc biệt');
      return;
    }

    // 5. Kiểm tra Mật khẩu (tối thiểu 6 ký tự)
    if (registerData.password.length < 6) {
      setErrorMsg('Mật khẩu bảo mật phải có tối thiểu 6 ký tự');
      return;
    }

    // 6. Kiểm tra xác nhận mật khẩu
    if (registerData.password !== registerData.confirmPassword) {
      setErrorMsg('Mật khẩu xác nhận không trùng khớp');
      return;
    }

    // 7. Kiểm tra ví MetaMask đối với các vai trò doanh nghiệp
    if (['MANUFACTURER', 'SELLER', 'SERVICE_CENTER'].includes(registerData.role)) {
      if (!registerData.walletAddress.trim()) {
        setErrorMsg('Vai trò này yêu cầu liên kết địa chỉ ví MetaMask');
        return;
      }
    }

    // Gửi mã OTP xác thực qua email và chuyển sang bước 2 (nhập OTP)
    await handleSendOtp();
  };

  const roles = [
    { key: 'CUSTOMER', label: 'Khách hàng', desc: 'Tra cứu & sở hữu thiết bị', icon: User },
    { key: 'MANUFACTURER', label: 'Nhà sản xuất', desc: 'Đăng ký thiết bị on-chain', icon: Factory },
    { key: 'SELLER', label: 'Đại lý bán lẻ', desc: 'Kích hoạt & gia hạn bảo hành', icon: Store },
    { key: 'SERVICE_CENTER', label: 'Trạm dịch vụ', desc: 'Ghi nhật ký sửa chữa', icon: Wrench },
  ];

  return (
    <>
      {typeof document !== 'undefined' && ReactDOM.createPortal(
        <div className="fixed inset-0 z-[99999] flex items-center justify-center p-4 bg-slate-950/70 backdrop-blur-sm animate-fade-in">
          <div className="relative w-full max-w-lg bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-3xl p-6 shadow-2xl space-y-5 max-h-[90vh] overflow-y-auto text-slate-900 dark:text-white">
            
            {/* Close Button */}
          <button
            onClick={() => {
              setRegisterData({ ...initialRegisterState });
              setErrorMsg('');
              setSuccessMsg('');
              onClose();
            }}
            className="absolute top-4 right-4 p-2 rounded-xl bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 text-slate-400 hover:text-slate-700 dark:hover:text-white dark:hover:bg-slate-700 transition cursor-pointer"
          >
            <X className="w-5 h-5" />
          </button>

          {/* Modal Brand Banner */}
          <div className="flex items-center gap-3 pb-3 border-b border-slate-200 dark:border-slate-800 pr-10">
            <div className="w-11 h-11 rounded-2xl bg-white dark:bg-slate-950 border border-blue-500/40 p-0.5 overflow-hidden shadow-lg shadow-blue-500/30 flex items-center justify-center shrink-0">
              <img src="/logo.png" alt="TrustWarranty" className="w-full h-full object-cover rounded-xl" />
            </div>
            <div>
              <h3 className="text-base font-black text-slate-900 dark:text-white tracking-tight">TrustWarranty</h3>
              <p className="text-[11px] text-slate-500 dark:text-slate-400">Hệ thống Quản lý Bảo hành & Lịch sử Dịch vụ</p>
            </div>
          </div>

          {/* Header Tabs (Ẩn khi đang ở bước nhập OTP) */}
          {step === 'form' && (
            <div className="flex border-b border-slate-200 dark:border-slate-800 gap-4 pt-1">
              <button
                type="button"
                onClick={() => {
                  setTab('login');
                  setStep('form');
                  setErrorMsg('');
                  setSuccessMsg('');
                }}
                className={`pb-3 text-sm font-bold flex items-center gap-2 border-b-2 transition cursor-pointer ${
                  tab === 'login'
                    ? 'border-blue-500 text-blue-600 dark:text-blue-400'
                    : 'border-transparent text-slate-500 hover:text-slate-800 dark:text-slate-400 dark:hover:text-slate-200'
                }`}
              >
                <LogIn className="w-4 h-4" />
                <span>Đăng nhập</span>
              </button>

              <button
                type="button"
                onClick={() => {
                  setTab('register');
                  setStep('form');
                  setErrorMsg('');
                  setSuccessMsg('');
                  setRegisterData({ ...initialRegisterState });
                  setOtpCode('');
                  setDevOtpHint('');
                }}
                className={`pb-3 text-sm font-bold flex items-center gap-2 border-b-2 transition cursor-pointer ${
                  tab === 'register'
                    ? 'border-blue-500 text-blue-600 dark:text-blue-400'
                    : 'border-transparent text-slate-500 hover:text-slate-800 dark:text-slate-400 dark:hover:text-slate-200'
                }`}
              >
                <UserPlus className="w-4 h-4" />
                <span>Tạo tài khoản mới</span>
              </button>
            </div>
          )}

          {/* Error / Success Notifications */}
          {errorMsg && (
            <div className="p-3 rounded-xl bg-rose-500/10 border border-rose-500/30 text-rose-600 dark:text-rose-300 text-xs flex items-center gap-2 animate-fade-in">
              <AlertCircle className="w-4 h-4 shrink-0 text-rose-500 dark:text-rose-400" />
              <span>{errorMsg}</span>
            </div>
          )}

          {successMsg && (
            <div className="p-3 rounded-xl bg-emerald-500/10 border border-emerald-500/30 text-emerald-700 dark:text-emerald-300 text-xs flex items-center gap-2 animate-fade-in">
              <CheckCircle2 className="w-4 h-4 shrink-0 text-emerald-500 dark:text-emerald-400" />
              <span>{successMsg}</span>
            </div>
          )}

          {/* TAB 1: ĐĂNG NHẬP */}
          {step === 'form' && tab === 'login' && (
            <form onSubmit={handleLoginSubmit} className="space-y-4 text-xs">
              <div>
                <label className="block text-slate-700 dark:text-slate-300 mb-1 font-semibold">Tên đăng nhập hoặc Email</label>
                <div className="relative">
                  <input
                    type="text"
                    required
                    value={loginIdentifier}
                    onChange={(e) => setLoginIdentifier(e.target.value)}
                    placeholder="Nhập username hoặc email..."
                    className="w-full pl-9 pr-3 py-2.5 rounded-xl bg-slate-50 dark:bg-slate-950 border border-slate-300 dark:border-slate-800 text-slate-900 dark:text-white placeholder:text-slate-400 dark:placeholder:text-slate-500 focus:border-blue-500 focus:outline-none"
                  />
                  <User className="w-4 h-4 text-slate-400 dark:text-slate-500 absolute left-3 top-3" />
                </div>
              </div>

              <div>
                <label className="block text-slate-700 dark:text-slate-300 mb-1 font-semibold">Mật khẩu</label>
                <div className="relative">
                  <input
                    type={showPassword ? 'text' : 'password'}
                    required
                    value={loginPassword}
                    onChange={(e) => setLoginPassword(e.target.value)}
                    placeholder="Nhập mật khẩu..."
                    className="w-full pl-9 pr-10 py-2.5 rounded-xl bg-slate-50 dark:bg-slate-950 border border-slate-300 dark:border-slate-800 text-slate-900 dark:text-white placeholder:text-slate-400 dark:placeholder:text-slate-500 focus:border-blue-500 focus:outline-none"
                  />
                  <Lock className="w-4 h-4 text-slate-400 dark:text-slate-500 absolute left-3 top-3" />
                  <button
                    type="button"
                    onClick={() => setShowPassword(!showPassword)}
                    className="absolute right-3 top-3 text-slate-400 hover:text-slate-600 dark:hover:text-slate-300 cursor-pointer"
                  >
                    {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                  </button>
                </div>
              </div>

              <button
                type="submit"
                disabled={loading}
                className="w-full py-3 rounded-xl bg-blue-600 hover:bg-blue-500 text-white font-bold text-xs shadow-lg shadow-blue-600/30 transition flex items-center justify-center gap-2 cursor-pointer disabled:opacity-50"
              >
                {loading ? (
                  <span>Đang xác thực...</span>
                ) : (
                  <>
                    <LogIn className="w-4 h-4" />
                    <span>Đăng Nhập</span>
                  </>
                )}
              </button>
            </form>
          )}

          {/* TAB 2: ĐĂNG KÝ (BƯỚC 1: NHẬP THÔNG TIN) */}
          {step === 'form' && tab === 'register' && (
            <form onSubmit={handleRegisterSubmit} className="space-y-3.5 text-xs" autoComplete="off">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="block text-slate-700 dark:text-slate-300 mb-1 font-semibold">Họ và tên (*)</label>
                  <input
                    type="text"
                    required
                    autoComplete="off"
                    value={registerData.fullName}
                    onChange={(e) => setRegisterData({ ...registerData, fullName: e.target.value })}
                    placeholder="Nguyễn Văn A"
                    className="w-full px-3 py-2 rounded-xl bg-slate-50 dark:bg-slate-950 border border-slate-300 dark:border-slate-800 text-slate-900 dark:text-white placeholder:text-slate-400 dark:placeholder:text-slate-500 focus:border-blue-500 focus:outline-none"
                  />
                </div>

                <div>
                  <div className="flex items-center justify-between mb-1">
                    <label className="text-slate-700 dark:text-slate-300 font-semibold">Tên đăng nhập (*)</label>
                    <span className="text-[10px] text-slate-500">≥ 6 ký tự</span>
                  </div>
                  <input
                    type="text"
                    required
                    minLength={6}
                    autoComplete="off"
                    value={registerData.username}
                    onChange={(e) => setRegisterData({ ...registerData, username: e.target.value })}
                    placeholder="tối thiểu 6 ký tự"
                    className="w-full px-3 py-2 rounded-xl bg-slate-50 dark:bg-slate-950 border border-slate-300 dark:border-slate-800 text-slate-900 dark:text-white placeholder:text-slate-400 dark:placeholder:text-slate-500 font-mono focus:border-blue-500 focus:outline-none"
                  />
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <div className="flex items-center justify-between mb-1">
                    <label className="text-slate-700 dark:text-slate-300 font-semibold">Email (*)</label>
                    <span className="text-[10px] text-blue-600 dark:text-blue-400 font-medium">Bắt buộc @gmail.com</span>
                  </div>
                  <input
                    type="email"
                    required
                    autoComplete="off"
                    value={registerData.email}
                    onChange={(e) => setRegisterData({ ...registerData, email: e.target.value })}
                    placeholder="user@gmail.com"
                    className="w-full px-3 py-2 rounded-xl bg-slate-50 dark:bg-slate-950 border border-slate-300 dark:border-slate-800 text-slate-900 dark:text-white placeholder:text-slate-400 dark:placeholder:text-slate-500 focus:border-blue-500 focus:outline-none"
                  />
                </div>

                <div>
                  <div className="flex items-center justify-between mb-1">
                    <label className="text-slate-700 dark:text-slate-300 font-semibold">Số điện thoại (*)</label>
                    <span className="text-[10px] text-slate-500">Đúng 10 số</span>
                  </div>
                  <input
                    type="text"
                    required
                    maxLength={10}
                    autoComplete="off"
                    value={registerData.phone}
                    onChange={(e) => {
                      const val = e.target.value.replace(/\D/g, '');
                      setRegisterData({ ...registerData, phone: val });
                    }}
                    placeholder="0912345678 (10 số)"
                    className="w-full px-3 py-2 rounded-xl bg-slate-50 dark:bg-slate-950 border border-slate-300 dark:border-slate-800 text-slate-900 dark:text-white placeholder:text-slate-400 dark:placeholder:text-slate-500 font-mono focus:border-blue-500 focus:outline-none"
                  />
                </div>
              </div>

              {/* Chọn vai trò người dùng */}
              <div>
                <label className="block text-slate-700 dark:text-slate-300 mb-1 font-semibold">Vai trò tham gia hệ thống</label>
                <div className="grid grid-cols-2 gap-2">
                  {roles.map((r) => {
                    const Icon = r.icon;
                    const isChecked = registerData.role === r.key;
                    return (
                      <button
                        key={r.key}
                        type="button"
                        onClick={() => setRegisterData((prev) => ({
                          ...prev,
                          role: r.key,
                          walletAddress: r.key === 'CUSTOMER' ? '' : (prev.walletAddress || metaMaskAddress || '')
                        }))}
                        className={`p-2.5 rounded-xl border text-left transition flex items-start gap-2 cursor-pointer ${
                          isChecked
                            ? 'border-blue-500 bg-blue-50/80 dark:bg-blue-500/10 text-slate-900 dark:text-white shadow-xs'
                            : 'border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-950/60 text-slate-600 dark:text-slate-400 hover:border-slate-300 dark:hover:border-slate-700'
                        }`}
                      >
                        <Icon className={`w-4 h-4 mt-0.5 shrink-0 ${isChecked ? 'text-blue-600 dark:text-blue-400' : 'text-slate-400 dark:text-slate-500'}`} />
                        <div>
                          <div className={`font-semibold text-xs ${isChecked ? 'text-blue-600 dark:text-blue-300' : 'text-slate-700 dark:text-slate-300'}`}>
                            {r.label}
                          </div>
                          <div className="text-[10px] text-slate-500 leading-tight">
                            {r.desc}
                          </div>
                        </div>
                      </button>
                    );
                  })}
                </div>
              </div>

              {/* Thông báo cấp ví ngầm tự động cho Khách hàng (Không cần MetaMask) */}
              {registerData.role === 'CUSTOMER' && (
                <div className="animate-fade-in p-3 rounded-2xl bg-emerald-500/10 border border-emerald-500/25 space-y-1 text-slate-800 dark:text-slate-200">
                  <div className="flex items-center gap-2 text-xs font-bold text-emerald-600 dark:text-emerald-400">
                    <ShieldCheck className="w-4 h-4" />
                    <span>Cấp sẵn Ví Ngầm Web3 (MPC) tự động</span>
                  </div>
                  <p className="text-[11px] text-slate-600 dark:text-slate-400 leading-relaxed">
                    Khách hàng <strong>không cần cài đặt MetaMask</strong>. Hệ thống sẽ tự động tạo sẵn mã ví ngầm Web3 bảo mật ngay sau khi đăng ký thành công. Toàn bộ phí gas bảo hành được tài trợ 100%.
                  </p>
                </div>
              )}

              {/* Liên kết ví Ethereum Web3 (Chỉ hiển thị cho các vai trò cần MetaMask để ghi dữ liệu On-Chain) */}
              {['MANUFACTURER', 'SELLER', 'SERVICE_CENTER'].includes(registerData.role) && (
                <div className="animate-fade-in p-3 rounded-2xl bg-slate-50 dark:bg-slate-950/90 border border-slate-200 dark:border-slate-800 space-y-2">
                  <div className="flex items-center justify-between flex-wrap gap-1">
                    <label className="text-slate-800 dark:text-slate-300 font-semibold flex items-center gap-1.5 text-xs">
                      <Wallet className="w-3.5 h-3.5 text-orange-500 dark:text-orange-400" />
                      <span>Địa chỉ ví Web3 On-Chain (MetaMask) (*)</span>
                    </label>
                    {metaMaskAddress && registerData.walletAddress !== metaMaskAddress ? (
                      <button
                        type="button"
                        onClick={() => setRegisterData((prev) => ({ ...prev, walletAddress: metaMaskAddress }))}
                        className="text-[10px] text-blue-600 dark:text-blue-400 hover:text-blue-700 dark:hover:text-blue-300 font-semibold flex items-center gap-1 px-2.5 py-0.5 rounded-lg bg-blue-100 dark:bg-blue-500/15 border border-blue-200 dark:border-blue-500/35 transition cursor-pointer"
                        title="Bấm để lấy địa chỉ ví MetaMask đang kết nối"
                      >
                        <span>🦊 Dán ví MetaMask ({metaMaskAddress.slice(0, 6)}...{metaMaskAddress.slice(-4)})</span>
                      </button>
                    ) : !metaMaskAddress && onConnectMetaMask ? (
                      <button
                        type="button"
                        onClick={onConnectMetaMask}
                        className="text-[10px] text-orange-600 dark:text-orange-300 hover:text-orange-700 dark:hover:text-white font-semibold flex items-center gap-1 px-2.5 py-0.5 rounded-lg bg-orange-100 dark:bg-orange-500/15 border border-orange-200 dark:border-orange-500/35 transition cursor-pointer"
                      >
                        <span>🦊 Kết nối MetaMask</span>
                      </button>
                    ) : null}
                  </div>
                  <input
                    type="text"
                    value={registerData.walletAddress}
                    onChange={(e) => setRegisterData({ ...registerData, walletAddress: e.target.value })}
                    placeholder="0x... (Địa chỉ ví MetaMask thực hiện giao dịch on-chain)"
                    autoComplete="off"
                    className="w-full px-3 py-2 rounded-xl bg-white dark:bg-slate-900 border border-slate-300 dark:border-slate-700/80 text-slate-900 dark:text-white placeholder:text-slate-400 dark:placeholder:text-slate-500 font-mono text-[11px] focus:border-orange-500 focus:outline-none"
                  />
                  <p className="text-[10px] text-slate-500 dark:text-slate-400">
                    💡 Vai trò này bắt buộc liên kết ví Web3 MetaMask để ký số các giao dịch On-Chain trên Smart Contract.
                  </p>
                </div>
              )}


              {/* Mật khẩu */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <div className="flex items-center justify-between mb-1">
                    <label className="text-slate-700 dark:text-slate-300 font-semibold">Mật khẩu (*)</label>
                    <span className="text-[10px] text-slate-500">≥ 6 ký tự</span>
                  </div>
                  <input
                    type="password"
                    required
                    minLength={6}
                    autoComplete="new-password"
                    value={registerData.password}
                    onChange={(e) => setRegisterData({ ...registerData, password: e.target.value })}
                    placeholder="Ví dụ: Abc1234"
                    className="w-full px-3 py-2 rounded-xl bg-slate-50 dark:bg-slate-950 border border-slate-300 dark:border-slate-800 text-slate-900 dark:text-white placeholder:text-slate-400 dark:placeholder:text-slate-500 focus:border-blue-500 focus:outline-none"
                  />
                </div>

                <div>
                  <div className="flex items-center justify-between mb-1">
                    <label className="text-slate-700 dark:text-slate-300 font-semibold">Xác nhận mật khẩu (*)</label>
                    <span className="text-[10px] text-slate-500">Khớp mật khẩu</span>
                  </div>
                  <input
                    type="password"
                    required
                    autoComplete="new-password"
                    value={registerData.confirmPassword}
                    onChange={(e) => setRegisterData({ ...registerData, confirmPassword: e.target.value })}
                    placeholder="Nhập lại mật khẩu"
                    className="w-full px-3 py-2 rounded-xl bg-slate-50 dark:bg-slate-950 border border-slate-300 dark:border-slate-800 text-slate-900 dark:text-white placeholder:text-slate-400 dark:placeholder:text-slate-500 focus:border-blue-500 focus:outline-none"
                  />
                </div>
              </div>

              <button
                type="submit"
                disabled={loading}
                className="w-full py-3 rounded-xl bg-blue-600 hover:bg-blue-700 text-white font-bold text-xs shadow-lg shadow-blue-600/25 transition flex items-center justify-center gap-2 cursor-pointer disabled:opacity-50"
              >
                {loading ? (
                  <span>Đang gửi mã OTP qua Email...</span>
                ) : (
                  <>
                    <Mail className="w-4 h-4" />
                    <span>Tiếp Tục (Nhận Mã OTP Email)</span>
                  </>
                )}
              </button>
            </form>
          )}

          {/* BƯỚC 2: MÀN HÌNH NHẬP MÃ OTP EMAIL */}
          {step === 'otp' && (
            <div className="space-y-5 animate-fade-in text-xs">
              
              <div className="flex items-center justify-between border-b border-slate-200 dark:border-slate-800 pb-3">
                <button
                  type="button"
                  onClick={() => { setStep('form'); setErrorMsg(''); setSuccessMsg(''); }}
                  className="flex items-center gap-1.5 text-slate-500 hover:text-slate-900 dark:text-slate-400 dark:hover:text-white text-xs transition cursor-pointer"
                >
                  <ArrowLeft className="w-4 h-4" />
                  <span>Quay lại sửa thông tin</span>
                </button>
                <span className="px-2.5 py-0.5 rounded-full bg-blue-500/15 border border-blue-500/30 text-blue-600 dark:text-blue-300 font-bold text-[11px]">
                  Bước 2: Xác Thực Email
                </span>
              </div>

              <div className="text-center space-y-2 py-1">
                <div className="w-14 h-14 mx-auto rounded-2xl bg-blue-600/20 border border-blue-500/30 text-blue-600 dark:text-blue-400 flex items-center justify-center shadow-lg shadow-blue-500/20">
                  <Mail className="w-7 h-7" />
                </div>
                <h3 className="text-base font-bold text-slate-900 dark:text-white">Xác Thực Mã OTP Qua Email</h3>
                <p className="text-slate-600 dark:text-slate-400 text-xs max-w-sm mx-auto leading-relaxed">
                  Hệ thống vừa gửi mã xác nhận 6 chữ số đến địa chỉ Gmail của bạn:
                  <strong className="block text-blue-600 dark:text-blue-300 font-mono mt-1">{registerData.email}</strong>
                </p>
              </div>

              {/* Hộp hiển thị mã OTP thử nghiệm khi chưa cấu hình Gmail SMTP */}
              {devOtpHint && (
                <div className="p-3.5 rounded-2xl bg-amber-500/10 border border-amber-500/30 text-slate-800 dark:text-slate-200 text-xs flex flex-col items-center gap-2 text-center animate-fade-in shadow-xs">
                  <div className="flex items-center gap-1.5 font-bold text-amber-600 dark:text-amber-400">
                    <KeyRound className="w-4 h-4 shrink-0" />
                    <span>Mã OTP Xác Thực Của Bạn:</span>
                  </div>
                  <div className="font-mono text-2xl font-black tracking-[0.25em] text-blue-600 dark:text-blue-400 bg-white dark:bg-slate-950 px-4 py-1.5 rounded-xl border border-blue-200 dark:border-blue-900 shadow-inner">
                    {devOtpHint}
                  </div>
                  <p className="text-[11px] text-slate-500 dark:text-slate-400 max-w-xs">
                    💡 Do máy chủ chưa cấu hình Gmail App Password trong file .env nên mã OTP được hiển thị trực tiếp tại đây để bạn kiểm thử ngay.
                  </p>
                  <button
                    type="button"
                    onClick={() => setOtpCode(devOtpHint)}
                    className="px-3.5 py-1.5 rounded-xl bg-blue-600 hover:bg-blue-700 text-white font-bold text-[11px] shadow-sm transition cursor-pointer flex items-center gap-1.5"
                  >
                    <span>⚡ Bấm vào đây để tự động điền mã {devOtpHint}</span>
                  </button>
                </div>
              )}

              <form onSubmit={handleVerifyOtpAndRegister} className="space-y-4">
                <div>
                  <label className="block text-slate-700 dark:text-slate-300 mb-1.5 font-semibold text-center">
                    Nhập mã xác thực OTP (6 chữ số)
                  </label>
                  <input
                    type="text"
                    required
                    maxLength={6}
                    autoFocus
                    value={otpCode}
                    onChange={(e) => setOtpCode(e.target.value.replace(/\D/g, ''))}
                    placeholder="• • • • • •"
                    className="w-full text-center py-3 text-2xl font-mono font-bold tracking-[0.5em] rounded-2xl bg-slate-50 dark:bg-slate-950 border border-slate-300 dark:border-slate-700 text-blue-600 dark:text-blue-400 focus:border-blue-500 focus:outline-none shadow-inner"
                  />
                </div>

                <div className="flex items-center justify-between text-xs text-slate-500 dark:text-slate-400 pt-1">
                  <span className="flex items-center gap-1.5">
                    <Clock className="w-3.5 h-3.5 text-slate-400 dark:text-slate-500" />
                    <span>
                      {countdown > 0 ? (
                        <span>Mã hết hạn sau: <strong className="text-slate-800 dark:text-white font-mono">{countdown}s</strong></span>
                      ) : (
                        <span className="text-rose-500 dark:text-rose-400 font-semibold">Mã đã hết hạn</span>
                      )}
                    </span>
                  </span>

                  <button
                    type="button"
                    onClick={handleResendOtp}
                    disabled={!canResend || loading}
                    className={`flex items-center gap-1 font-semibold transition cursor-pointer ${
                      canResend && !loading
                        ? 'text-blue-600 hover:text-blue-700 dark:text-blue-400 dark:hover:text-blue-300 underline'
                        : 'text-slate-400 dark:text-slate-600 cursor-not-allowed'
                    }`}
                  >
                    <RotateCw className="w-3.5 h-3.5" />
                    <span>Gửi lại mã OTP</span>
                  </button>
                </div>

                <button
                  type="submit"
                  disabled={loading || otpCode.trim().length !== 6}
                  className="w-full py-3 rounded-xl bg-blue-600 hover:bg-blue-700 text-white font-bold text-xs shadow-lg shadow-blue-600/25 transition flex items-center justify-center gap-2 cursor-pointer disabled:opacity-50"
                >
                  {loading ? (
                    <span>Đang xác thực OTP...</span>
                  ) : (
                    <>
                      <CheckCircle2 className="w-4 h-4" />
                      <span>Xác Nhận & Hoàn Tất Đăng Ký</span>
                    </>
                  )}
                </button>
              </form>

            </div>
          )}

        </div>
      </div>,
      document.body
    )}
    </>
  );
}
