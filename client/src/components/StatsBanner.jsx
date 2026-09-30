import React from 'react';
import { Package, ShieldCheck, Wrench } from 'lucide-react';
import { blockchainService } from '../services/blockchain';

export default function StatsBanner({ totalProducts, activeCount, totalServices }) {
  const contractInfo = blockchainService.getContractInfo();
  const stats = [
    {
      label: 'Sản phẩm On-Chain',
      val: totalProducts ?? 0,
      icon: Package,
      iconStyle: 'bg-blue-50 text-blue-600 border-blue-200/80 dark:bg-blue-500/10 dark:text-blue-400 dark:border-blue-500/20',
      hoverBorder: 'hover:border-blue-300 dark:hover:border-blue-500/40',
    },
    {
      label: 'Bảo hành kích hoạt',
      val: activeCount ?? 0,
      icon: ShieldCheck,
      iconStyle: 'bg-emerald-50 text-emerald-600 border-emerald-200/80 dark:bg-emerald-500/10 dark:text-emerald-400 dark:border-emerald-500/20',
      hoverBorder: 'hover:border-emerald-300 dark:hover:border-emerald-500/40',
    },
    {
      label: 'Nhật ký dịch vụ',
      val: totalServices ?? 0,
      icon: Wrench,
      iconStyle: 'bg-amber-50 text-amber-600 border-amber-200/80 dark:bg-amber-500/10 dark:text-amber-400 dark:border-amber-500/20',
      hoverBorder: 'hover:border-amber-300 dark:hover:border-amber-500/40',
    },
  ];

  return (
    <div className="mb-6 space-y-3">
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
        {stats.map((s, idx) => {
          const Icon = s.icon;
          return (
            <div
              key={idx}
              className={`p-3.5 rounded-2xl bg-white dark:bg-slate-900/90 border border-slate-200 dark:border-slate-800 flex items-center gap-3.5 shadow-xs dark:shadow-none transition-all ${s.hoverBorder}`}
            >
              <div className={`p-2.5 rounded-xl border ${s.iconStyle} shrink-0`}>
                <Icon className="w-5 h-5" />
              </div>
              <div>
                <div className="text-xl font-extrabold text-slate-900 dark:text-white tracking-tight">
                  {s.val}
                </div>
                <div className="text-xs text-slate-500 dark:text-slate-400 font-medium">
                  {s.label}
                </div>
              </div>
            </div>
          );
        })}
      </div>

      {/* Live Web3 Contract & Blockchain Network Status Bar */}
      <div className="p-3 rounded-2xl bg-gradient-to-r from-blue-500/10 via-indigo-500/10 to-purple-500/10 border border-blue-500/20 flex flex-wrap items-center justify-between gap-3 text-xs">
        <div className="flex items-center gap-2 text-slate-700 dark:text-slate-300 flex-wrap">
          <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse shrink-0" />
          <span className="font-semibold text-slate-500 dark:text-slate-400">Sổ cái:</span>
          <span className="font-mono font-bold text-blue-600 dark:text-blue-400">{contractInfo.networkName}</span>
          <span className="text-slate-300 dark:text-slate-700 hidden sm:inline">|</span>
          <span className="font-semibold text-slate-500 dark:text-slate-400">Smart Contract:</span>
          <span className="font-mono text-slate-800 dark:text-slate-200">{`${contractInfo.address.slice(0, 8)}...${contractInfo.address.slice(-6)}`}</span>
        </div>
        <div className="flex items-center gap-2 flex-wrap">
          <span className="px-2 py-0.5 rounded-full text-[10px] font-extrabold bg-orange-500/15 text-orange-600 dark:text-orange-400 border border-orange-500/20">
            MetaMask-First Verified 🦊
          </span>
          <span className="px-2 py-0.5 rounded-full text-[10px] font-extrabold bg-purple-500/15 text-purple-600 dark:text-purple-400 border border-purple-500/20">
            100% On-Chain Hash & Merkle
          </span>
        </div>
      </div>
    </div>
  );
}
