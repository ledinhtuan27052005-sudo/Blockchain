import React from 'react';
import {
  ShieldCheck,
  Search,
  Factory,
  Store,
  Wrench,
  Radio,
  ArrowRight,
  CheckCircle2,
  Lock,
  Cpu,
  Layers,
  Sparkles,
  Users,
  QrCode,
  FileCheck2,
  ChevronRight,
  Shield,
  HelpCircle
} from 'lucide-react';

export default function HomePage({
  onNavigate,
  onOpenAuthModal,
  currentUser,
  totalProducts = 0,
  activeCount = 0,
  totalServices = 0,
  eventCount = 0,
}) {
  const steps = [
    {
      step: '01',
      title: 'Xuất Xưởng & Định Danh On-Chain',
      role: 'Nhà Sản Xuất (OEM)',
      desc: 'Thiết bị được đúc thông số định danh lên Smart Contract, kèm mã PIN bí mật được băm mật mã học (SHA-256) chống giả mạo.',
      icon: Factory,
      badgeColor: 'bg-amber-100 text-amber-700 dark:bg-amber-950/60 dark:text-amber-300 border-amber-200 dark:border-amber-800',
      iconColor: 'text-amber-500',
    },
    {
      step: '02',
      title: 'Nhập Kho & Kích Hoạt Bảo Hành',
      role: 'Đại Lý Phân Phối (Seller)',
      desc: 'Đại lý kiểm tra xuất xưởng, phân phối cho người dùng và kích hoạt bảo hành điện tử chính thức ngay thời điểm bàn giao thiết bị.',
      icon: Store,
      badgeColor: 'bg-emerald-100 text-emerald-700 dark:bg-emerald-950/60 dark:text-emerald-300 border-emerald-200 dark:border-emerald-800',
      iconColor: 'text-emerald-500',
    },
    {
      step: '03',
      title: 'Tra Cứu & Chuyển Nhượng Quyền',
      role: 'Người Tiêu Dùng (Customer)',
      desc: 'Khách hàng tra cứu nguồn gốc tức thì, kiểm tra thời hạn bảo hành còn lại và có thể chuyển nhượng quyền sở hữu tài sản an toàn.',
      icon: Search,
      badgeColor: 'bg-blue-100 text-blue-700 dark:bg-blue-950/60 dark:text-blue-300 border-blue-200 dark:border-blue-800',
      iconColor: 'text-blue-500',
    },
    {
      step: '04',
      title: 'Tiếp Nhận RMA & Biên Bản Dịch Vụ',
      role: 'Trạm Dịch Vụ Ủy Quyền',
      desc: 'Tiếp nhận thiết bị bảo hành, xác thực lịch sử trên Sổ cái và ghi nhận nhật ký thay thế linh kiện bất biến vào Smart Contract.',
      icon: Wrench,
      badgeColor: 'bg-indigo-100 text-indigo-700 dark:bg-indigo-950/60 dark:text-indigo-300 border-indigo-200 dark:border-indigo-800',
      iconColor: 'text-indigo-500',
    },
  ];

  const features = [
    {
      title: 'Bất Biến & Minh Bạch',
      desc: 'Mọi giao dịch xuất xưởng, kích hoạt và sửa chữa đều được ký điện tử và lưu trữ vĩnh viễn trên Sổ cái Blockchain EVM.',
      icon: Lock,
    },
    {
      title: 'Chống Hàng Giả Bằng Mã PIN',
      desc: 'Mỗi thiết bị sở hữu mã PIN bí mật được mã hóa. Chỉ khi đối khớp mã băm trên Smart Contract thì quyền bảo hành mới được kích hoạt.',
      icon: ShieldCheck,
    },
    {
      title: 'Phân Quyền RBAC Nghiêm Ngặt',
      desc: 'Hệ thống thiết lập phân quyền chặt chẽ giữa Nhà sản xuất, Đại lý, Trạm dịch vụ và Khách hàng nhằm bảo đảm tính toàn vẹn dữ liệu.',
      icon: Users,
    },
    {
      title: 'Sổ Cái Thời Gian Thực',
      desc: 'Giám sát mọi sự kiện On-Chain (ProductCreated, WarrantyActivated, ServiceLogged) tức thì với số block và mã băm giao dịch (TxHash).',
      icon: Radio,
    },
  ];


  return (
    <div className="space-y-8 sm:space-y-10 py-1 animate-fade-in text-slate-800 dark:text-slate-100">
      
      {/* 1. HERO SECTION (Thu gọn chiều cao tối ưu không gian hiển thị) */}
      <section className="relative overflow-hidden rounded-3xl bg-gradient-to-b from-blue-50/80 via-white to-slate-50/50 dark:from-slate-900/90 dark:via-slate-900/60 dark:to-slate-950 border border-blue-200/60 dark:border-slate-800 py-6 sm:py-8 px-5 sm:px-8 text-center shadow-md shadow-blue-500/5">
        
        {/* Decorative backdrop glow */}
        <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-80 h-80 bg-blue-500/10 rounded-full blur-3xl pointer-events-none" />

        <div className="relative max-w-3xl mx-auto space-y-4">
          
          {/* Badge */}
          <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-blue-50 dark:bg-blue-950/60 border border-blue-200 dark:border-blue-800/80 text-blue-700 dark:text-blue-300 text-[11px] font-bold tracking-wide shadow-xs">
            <span className="w-1.5 h-1.5 rounded-full bg-blue-600 animate-pulse" />
            <span>Nền tảng Quản lý Bảo hành On-Chain Bán buôn & Bán lẻ</span>
            <span className="px-1.5 py-0.2 rounded bg-blue-200/60 dark:bg-blue-800/60 text-[9px] font-mono">v2.5</span>
          </div>

          {/* Main Headline */}
          <h1 className="text-2xl sm:text-3.5xl lg:text-4xl font-black tracking-tight text-slate-900 dark:text-white leading-tight">
            Bảo Hành Điện Tử & Lịch Sử Dịch Vụ{' '}
            <span className="bg-gradient-to-r from-blue-600 via-indigo-600 to-blue-700 bg-clip-text text-transparent">
              Bất Biến Trên Blockchain
            </span>
          </h1>

          {/* Subtitle */}
          <p className="text-xs sm:text-sm text-slate-600 dark:text-slate-300 max-w-2xl mx-auto leading-relaxed">
            Giải pháp số hóa toàn diện kết nối Nhà sản xuất (OEM), Chuỗi đại lý bán lẻ, Trạm dịch vụ ủy quyền và Khách hàng trên cùng một Smart Contract EVM minh bạch, không thể giả mạo.
          </p>

          {/* Action CTAs */}
          <div className="flex flex-wrap items-center justify-center gap-2.5 pt-1">
            <button
              type="button"
              onClick={() => onNavigate('lookup')}
              className="flex items-center gap-2 px-5 py-2.5 rounded-xl bg-blue-600 hover:bg-blue-700 text-white font-bold text-xs sm:text-sm shadow-md shadow-blue-600/30 transition-all cursor-pointer active:scale-95 group"
            >
              <Search className="w-3.5 h-3.5 transition-transform group-hover:scale-110" />
              <span>Tra Cứu Bảo Hành Ngay</span>
              <ArrowRight className="w-3.5 h-3.5 transition-transform group-hover:translate-x-1" />
            </button>

            {currentUser ? (
              <button
                type="button"
                onClick={() => onNavigate('profile')}
                className="flex items-center gap-2 px-5 py-2.5 rounded-xl bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 dark:hover:bg-slate-700 border border-slate-200 dark:border-slate-700 text-slate-800 dark:text-white font-bold text-xs sm:text-sm transition-all cursor-pointer active:scale-95"
              >
                <span>Hồ Sơ & Thiết Bị Của Tôi</span>
              </button>
            ) : (
              <button
                type="button"
                onClick={onOpenAuthModal}
                className="flex items-center gap-2 px-5 py-2.5 rounded-xl bg-white hover:bg-slate-50 dark:bg-slate-800/80 dark:hover:bg-slate-800 border border-slate-200 dark:border-slate-700 text-slate-800 dark:text-white font-bold text-xs sm:text-sm shadow-sm transition-all cursor-pointer active:scale-95"
              >
                <Lock className="w-3.5 h-3.5 text-blue-600 dark:text-blue-400" />
                <span>Đăng Nhập Cổng Nghiệp Vụ</span>
              </button>
            )}
          </div>

          {/* Trust Highlights */}
          <div className="pt-2 flex flex-wrap items-center justify-center gap-4 sm:gap-6 text-[11px] text-slate-500 dark:text-slate-400 font-medium">
            <span className="flex items-center gap-1.5">
              <CheckCircle2 className="w-3.5 h-3.5 text-emerald-500" />
              Chuẩn Smart Contract EVM
            </span>
            <span className="flex items-center gap-1.5">
              <CheckCircle2 className="w-3.5 h-3.5 text-emerald-500" />
              Mật mã hóa PIN SHA-256
            </span>
            <span className="flex items-center gap-1.5">
              <CheckCircle2 className="w-3.5 h-3.5 text-emerald-500" />
              Không thể giả mạo dữ liệu
            </span>
          </div>

        </div>

      </section>

      {/* 2. LIVE METRICS COUNTER */}
      <section className="grid grid-cols-2 xl:grid-cols-4 gap-3 sm:gap-4">
        <div className="p-4 sm:p-5 rounded-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 shadow-sm text-center space-y-1">
          <div className="text-2xl sm:text-3xl font-black text-blue-600 dark:text-blue-400">
            {totalProducts}
          </div>
          <div className="text-xs font-bold text-slate-700 dark:text-slate-300">Thiết Bị Xuất Xưởng</div>
          <p className="text-[11px] text-slate-400">Đã định danh trên Blockchain</p>
        </div>

        <div className="p-5 rounded-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 shadow-sm text-center space-y-1">
          <div className="text-2xl sm:text-3xl font-black text-emerald-600 dark:text-emerald-400">
            {activeCount}
          </div>
          <div className="text-xs font-bold text-slate-700 dark:text-slate-300">Đang Trong Bảo Hành</div>
          <p className="text-[11px] text-slate-400">Đã kích hoạt điện tử hợp lệ</p>
        </div>

        <div className="p-5 rounded-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 shadow-sm text-center space-y-1">
          <div className="text-2xl sm:text-3xl font-black text-indigo-600 dark:text-indigo-400">
            {totalServices}
          </div>
          <div className="text-xs font-bold text-slate-700 dark:text-slate-300">Biên Bản Dịch Vụ RMA</div>
          <p className="text-[11px] text-slate-400">Nhật ký sửa chữa bất biến</p>
        </div>

        <div className="p-5 rounded-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 shadow-sm text-center space-y-1">
          <div className="text-2xl sm:text-3xl font-black text-amber-600 dark:text-amber-400">
            {eventCount || '100%'}
          </div>
          <div className="text-xs font-bold text-slate-700 dark:text-slate-300">Giao Dịch Xác Thực</div>
          <p className="text-[11px] text-slate-400">Sổ cái phân tán Hardhat EVM</p>
        </div>
      </section>

      {/* 3. 4-STEP ON-CHAIN WORKFLOW */}
      <section className="space-y-6">
        <div className="text-center space-y-2 max-w-2xl mx-auto">
          <span className="text-[11px] font-extrabold uppercase tracking-wider text-blue-600 dark:text-blue-400 bg-blue-50 dark:bg-blue-950/60 px-3 py-1 rounded-full border border-blue-200/60 dark:border-blue-800/60">
            Quy Trình Khép Kín
          </span>
          <h2 className="text-2xl sm:text-3xl font-extrabold text-slate-900 dark:text-white tracking-tight">
            Vòng Đời Thiết Bị Trên Sổ Cái Blockchain
          </h2>
          <p className="text-xs sm:text-sm text-slate-500 dark:text-slate-400">
            Quy trình chuẩn hóa từ lúc linh kiện xuất xưởng đến khi bàn giao đại lý, kích hoạt và tiếp nhận bảo hành.
          </p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
          {steps.map((item, index) => {
            const Icon = item.icon;
            return (
              <div
                key={index}
                className="relative p-6 rounded-3xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 hover:border-blue-500/40 hover:shadow-lg hover:shadow-blue-500/5 transition-all group flex flex-col justify-between"
              >
                <div className="space-y-4">
                  <div className="flex items-center justify-between">
                    <span className="text-2xl font-black text-slate-300 dark:text-slate-700 font-mono">
                      {item.step}
                    </span>
                    <div className="w-10 h-10 rounded-2xl bg-slate-100 dark:bg-slate-800 flex items-center justify-center group-hover:scale-110 transition-transform">
                      <Icon className={`w-5 h-5 ${item.iconColor}`} />
                    </div>
                  </div>

                  <div className="space-y-1.5">
                    <span className={`inline-block text-[10px] font-bold px-2 py-0.5 rounded-full border ${item.badgeColor}`}>
                      {item.role}
                    </span>
                    <h3 className="font-bold text-sm text-slate-900 dark:text-white">
                      {item.title}
                    </h3>
                    <p className="text-xs text-slate-500 dark:text-slate-400 leading-relaxed">
                      {item.desc}
                    </p>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      </section>


      {/* 5. CORE TECHNOLOGY PILLARS */}
      <section className="p-8 sm:p-10 rounded-3xl bg-slate-900 text-white space-y-8 relative overflow-hidden">
        <div className="relative z-10 max-w-2xl space-y-2">
          <span className="text-[11px] font-extrabold uppercase tracking-wider text-blue-400 bg-blue-950/80 px-3 py-1 rounded-full border border-blue-800">
            Nền Tảng Công Nghệ
          </span>
          <h2 className="text-2xl sm:text-3xl font-black tracking-tight">
            Kiến Trúc Blockchain Minh Bạch & Bảo Mật
          </h2>
          <p className="text-xs sm:text-sm text-slate-400">
            Ứng dụng công nghệ hợp đồng thông minh Smart Contract kết hợp mã hóa bảo mật để bảo vệ quyền lợi tối đa cho doanh nghiệp và người tiêu dùng.
          </p>
        </div>

        <div className="relative z-10 grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          {features.map((feat, idx) => {
            const Icon = feat.icon;
            return (
              <div
                key={idx}
                className="p-5 rounded-2xl bg-slate-800/70 border border-slate-700/60 space-y-2.5"
              >
                <div className="w-9 h-9 rounded-xl bg-blue-500/20 text-blue-400 flex items-center justify-center">
                  <Icon className="w-4 h-4" />
                </div>
                <h4 className="font-bold text-sm text-white">{feat.title}</h4>
                <p className="text-xs text-slate-400 leading-relaxed">{feat.desc}</p>
              </div>
            );
          })}
        </div>
      </section>

    </div>
  );
}
