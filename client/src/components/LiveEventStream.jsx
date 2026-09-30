import React, { useState, useEffect } from 'react';
import {
  Radio,
  History,
  Filter,
  CheckCircle2,
  Cpu,
  ShieldCheck,
  Wrench,
  UserCheck,
  Sparkles,
  ShieldX,
  ExternalLink,
  Hash,
  Clock,
  Layers,
  Search
} from 'lucide-react';
import { blockchainService } from '../services/blockchain';

export default function LiveEventStream({ onSelectSerial }) {
  const [events, setEvents] = useState([]);
  const [filterType, setFilterType] = useState('');
  const [searchQuery, setSearchQuery] = useState('');
  const [livePulse, setLivePulse] = useState(false);

  const loadEvents = () => {
    const list = blockchainService.getHistoricalEvents(filterType);
    setEvents([...list]);
  };

  useEffect(() => {
    loadEvents();

    // Dang ky lang nghe realtime event
    const unsubscribe = blockchainService.subscribeToEvents((newEvt) => {
      setEvents((prev) => [newEvt, ...prev]);
      setLivePulse(true);
      setTimeout(() => setLivePulse(false), 2000);
    });

    return () => unsubscribe();
  }, [filterType]);

  const getEventBadge = (name) => {
    switch (name) {
      case 'ProductRegistered':
        return { label: 'Xuất xưởng On-Chain', icon: Cpu, color: 'text-blue-400 bg-blue-500/10 border-blue-500/20' };
      case 'WarrantyActivated':
        return { label: 'Kích hoạt Bảo hành', icon: ShieldCheck, color: 'text-emerald-400 bg-emerald-500/10 border-emerald-500/20' };
      case 'OwnershipTransferred':
        return { label: 'Chuyển nhượng máy cũ', icon: UserCheck, color: 'text-purple-400 bg-purple-500/10 border-purple-500/20' };
      case 'WarrantyExtended':
        return { label: 'Gia hạn gói bảo hành', icon: Sparkles, color: 'text-amber-400 bg-amber-500/10 border-amber-500/20' };
      case 'ServiceRecorded':
        return { label: 'Nhật ký Sửa chữa', icon: Wrench, color: 'text-sky-400 bg-sky-500/10 border-sky-500/20' };
      case 'WarrantyVoided':
        return { label: 'Vô hiệu hóa Bảo hành', icon: ShieldX, color: 'text-rose-400 bg-rose-500/10 border-rose-500/20' };
      default:
        return { label: name, icon: CheckCircle2, color: 'text-slate-400 bg-slate-500/10 border-slate-500/20' };
    }
  };

  const formatDate = (timestamp) => {
    if (!timestamp) return 'Vừa xong';
    return new Date(timestamp * 1000).toLocaleTimeString('vi-VN', {
      hour: '2-digit',
      minute: '2-digit',
      second: '2-digit',
      day: '2-digit',
      month: '2-digit',
    });
  };

  const filteredEvents = events.filter((e) => {
    if (!searchQuery) return true;
    const q = searchQuery.toLowerCase();
    return (
      e.serial?.toLowerCase().includes(q) ||
      e.eventName?.toLowerCase().includes(q) ||
      e.txHash?.toLowerCase().includes(q)
    );
  });

  return (
    <div className="space-y-6">
      
      {/* Header Banner */}
      <div className="p-4 sm:p-5 rounded-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 flex items-center justify-between gap-4 shadow-xs">
        <div className="flex items-center gap-3.5">
          <div className={`w-10 h-10 rounded-2xl bg-blue-500/10 text-blue-600 dark:text-blue-400 border border-blue-500/20 flex items-center justify-center transition-all ${
            livePulse ? 'ring-4 ring-blue-500/40 scale-105' : ''
          }`}>
            <Radio className={`w-5 h-5 ${livePulse ? 'animate-pulse text-blue-500' : ''}`} />
          </div>
          <div>
            <h2 className="text-base sm:text-lg font-bold text-slate-900 dark:text-white">
              Sổ Cái Giám Sát Sự Kiện
            </h2>
            <p className="text-xs text-slate-500 dark:text-slate-400">
              Nhật ký kiểm toán giao dịch thời gian thực trên Smart Contract EVM
            </p>
          </div>
        </div>
      </div>

      {/* Filter Bar & Search */}
      <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3">
        
        {/* Filter Pills */}
        <div className="flex items-center gap-1.5 overflow-x-auto pb-1 text-xs">
          {[
            { id: '', label: 'Tất cả sự kiện' },
            { id: 'ProductRegistered', label: 'Đăng ký' },
            { id: 'WarrantyActivated', label: 'Kích hoạt' },
            { id: 'OwnershipTransferred', label: 'Chuyển nhượng' },
            { id: 'WarrantyExtended', label: 'Gia hạn' },
            { id: 'ServiceRecorded', label: 'Sửa chữa' },
          ].map((btn) => (
            <button
              key={btn.id}
              onClick={() => setFilterType(btn.id)}
              className={`px-3 py-1.5 rounded-xl font-semibold whitespace-nowrap transition cursor-pointer ${
                filterType === btn.id
                  ? 'bg-blue-600 text-white shadow-md shadow-blue-600/20'
                  : 'bg-white dark:bg-slate-900/80 hover:bg-slate-50 dark:hover:bg-slate-800 text-slate-600 dark:text-slate-400 border border-slate-200 dark:border-slate-800'
              }`}
            >
              {btn.label}
            </button>
          ))}
        </div>

        {/* Search input */}
        <div className="flex items-center gap-2 px-3 py-1.5 rounded-xl bg-white dark:bg-slate-950 border border-slate-300 dark:border-slate-800 text-xs text-slate-600 dark:text-slate-400">
          <Search className="w-4 h-4 text-slate-400 dark:text-slate-500" />
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Lọc theo Serial, TxHash..."
            className="bg-transparent border-none text-slate-900 dark:text-white focus:outline-none placeholder:text-slate-400 dark:placeholder:text-slate-500 w-40 sm:w-56 font-mono"
          />
        </div>

      </div>

      {/* Event List Feed */}
      <div className="space-y-3">
        {filteredEvents.length > 0 ? (
          filteredEvents.map((evt) => {
            const badge = getEventBadge(evt.eventName);
            const BadgeIcon = badge.icon;
            return (
              <div
                key={evt.id}
                className="p-4 rounded-2xl glass-card border border-slate-200 dark:border-slate-800/90 hover:border-slate-300 dark:hover:border-slate-700 transition flex flex-col sm:flex-row sm:items-center justify-between gap-4 text-xs"
              >
                <div className="flex items-start gap-3">
                  <div className={`p-2.5 rounded-xl border ${badge.color} shrink-0 mt-0.5`}>
                    <BadgeIcon className="w-4 h-4" />
                  </div>
                  <div className="space-y-1">
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="font-bold text-slate-900 dark:text-white text-sm">{badge.label}</span>
                      <span className="font-mono text-[11px] text-blue-600 dark:text-blue-400 bg-blue-50 dark:bg-blue-500/10 px-2 py-0.5 rounded border border-blue-200 dark:border-blue-500/20 cursor-pointer"
                        onClick={() => onSelectSerial && onSelectSerial(evt.serial)}
                        title="Bấm để tra cứu chi tiết sản phẩm này"
                      >
                        {evt.serial}
                      </span>
                    </div>

                    {/* Event Arguments */}
                    <div className="text-slate-500 dark:text-slate-400 text-[11px] flex items-center gap-3 flex-wrap">
                      {evt.data && Object.entries(evt.data).map(([k, v]) => (
                        <span key={k}>
                          <strong className="text-slate-600 dark:text-slate-400 capitalize">{k}:</strong>{' '}
                          <span className="text-slate-800 dark:text-slate-300 font-mono">{String(v)}</span>
                        </span>
                      ))}
                    </div>
                  </div>
                </div>

                {/* Block & Tx Details */}
                <div className="flex sm:flex-col items-end justify-between gap-1 sm:text-right border-t sm:border-t-0 border-slate-200 dark:border-slate-800/60 pt-2 sm:pt-0 shrink-0">
                  <div className="text-slate-500 dark:text-slate-400 font-mono text-[11px] flex items-center gap-1">
                    <Clock className="w-3.5 h-3.5 text-slate-400 dark:text-slate-500" />
                    {formatDate(evt.timestamp)}
                  </div>
                  <div className="flex items-center gap-2 text-[10px] text-slate-500 font-mono">
                    <span className="px-1.5 py-0.5 rounded bg-slate-100 dark:bg-slate-900 border border-slate-200 dark:border-slate-800 text-slate-700 dark:text-slate-300">
                      Block #{evt.blockNumber}
                    </span>
                    <span className="text-blue-600 dark:text-blue-400/80 truncate max-w-[110px]" title={evt.txHash}>
                      {evt.txHash ? `${evt.txHash.slice(0, 10)}...` : '0x...'}
                    </span>
                  </div>
                </div>
              </div>
            );
          })
        ) : (
          <div className="text-center py-12 glass-card rounded-3xl border border-slate-200 dark:border-slate-800 text-slate-500 dark:text-slate-400 text-xs">
            Không tìm thấy sự kiện nào phù hợp với bộ lọc hiện tại.
          </div>
        )}
      </div>

    </div>
  );
}
