import React from 'react';
import { 
  ShieldAlert, 
  Lock, 
  ArrowRight, 
  UserPlus, 
  LogIn, 
  Search,
  Factory,
  Store,
  Wrench,
  User
} from 'lucide-react';

export default function AccessRestrictedCard({ 
  requiredRole, 
  requiredRoleName,
  currentRole, 
  currentUser,
  onOpenAuthModal,
  onNavigateHome
}) {
  const getRoleIcon = (role) => {
    switch (role) {
      case 'MANUFACTURER': return Factory;
      case 'SELLER': return Store;
      case 'SERVICE_CENTER': return Wrench;
      default: return User;
    }
  };

  const RequiredIcon = getRoleIcon(requiredRole);
  const CurrentIcon = getRoleIcon(currentUser?.role);

  return (
    <div className="max-w-2xl mx-auto my-8 p-6 md:p-8 rounded-3xl bg-white dark:bg-slate-900/90 border border-amber-500/40 shadow-2xl backdrop-blur-xl animate-fade-in text-center space-y-6 transition-colors">
      
      {/* Icon Badge */}
      <div className="w-16 h-16 mx-auto rounded-2xl bg-amber-500/15 border border-amber-500/30 text-amber-500 dark:text-amber-400 flex items-center justify-center shadow-lg shadow-amber-500/20">
        <Lock className="w-8 h-8" />
      </div>

      {/* Title & Role Info */}
      <div className="space-y-2">
        <span className="inline-flex items-center gap-1.5 text-[11px] font-bold uppercase tracking-wider px-3 py-1 rounded-full bg-amber-500/20 text-amber-700 dark:text-amber-300 border border-amber-500/40">
          <ShieldAlert className="w-3.5 h-3.5" />
          Phân Quyền Truy Cập (RBAC)
        </span>
        <h2 className="text-xl md:text-2xl font-bold text-slate-900 dark:text-white tracking-tight">
          Cổng Dành Riêng Cho: {requiredRoleName}
        </h2>
        <p className="text-slate-600 dark:text-slate-400 text-xs md:text-sm max-w-lg mx-auto leading-relaxed">
          Theo chính sách bảo mật phân quyền của hệ thống, mỗi người dùng chỉ có quyền sử dụng các cổng nghiệp vụ tương ứng với vai trò đã đăng ký.
        </p>
      </div>

      {/* Comparison Pills */}
      <div className="p-4 rounded-2xl bg-slate-50 dark:bg-slate-950/70 border border-slate-200 dark:border-slate-800 text-xs grid grid-cols-1 sm:grid-cols-2 gap-3 text-left">
        <div className="p-3 rounded-xl bg-rose-500/10 border border-rose-500/20 space-y-1">
          <span className="text-slate-500 dark:text-slate-400 block text-[11px]">Vai trò hiện tại của bạn:</span>
          <div className="flex items-center gap-2 font-bold text-rose-600 dark:text-rose-300">
            <CurrentIcon className="w-4 h-4 text-rose-500 dark:text-rose-400 shrink-0" />
            <span>{currentUser ? currentUser.role : 'Khách vãng lai (Chưa đăng nhập)'}</span>
          </div>
        </div>

        <div className="p-3 rounded-xl bg-emerald-500/10 border border-emerald-500/20 space-y-1">
          <span className="text-slate-500 dark:text-slate-400 block text-[11px]">Vai trò được cấp phép:</span>
          <div className="flex items-center gap-2 font-bold text-emerald-600 dark:text-emerald-300">
            <RequiredIcon className="w-4 h-4 text-emerald-500 dark:text-emerald-400 shrink-0" />
            <span>{requiredRole} ({requiredRoleName})</span>
          </div>
        </div>
      </div>

      {/* Action Buttons */}
      <div className="flex flex-col sm:flex-row items-center justify-center gap-3 pt-2">
        <button
          type="button"
          onClick={onNavigateHome}
          className="w-full sm:w-auto px-5 py-2.5 rounded-xl bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 dark:hover:bg-slate-700 text-slate-700 hover:text-slate-900 dark:text-slate-200 dark:hover:text-white border border-slate-300 dark:border-slate-700 text-xs font-bold transition flex items-center justify-center gap-2 cursor-pointer"
        >
          <Search className="w-4 h-4" />
          <span>Về Cổng Tra Cứu Chung</span>
        </button>

        <button
          type="button"
          onClick={onOpenAuthModal}
          className="w-full sm:w-auto px-5 py-2.5 rounded-xl bg-blue-600 hover:bg-blue-500 text-white text-xs font-bold shadow-lg shadow-blue-600/30 transition flex items-center justify-center gap-2 cursor-pointer"
        >
          <LogIn className="w-4 h-4" />
          <span>Đăng Nhập Tài Khoản {requiredRoleName}</span>
        </button>
      </div>

    </div>
  );
}
