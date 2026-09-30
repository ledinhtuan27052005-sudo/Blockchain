import React, { useState, useEffect, useRef } from 'react';
import {
  Wrench,
  CheckCircle2,
  AlertTriangle,
  Sparkles,
  Cpu,
  Hammer,
  ShieldX,
  FileCheck,
  Hash,
  ShieldAlert,
  Inbox,
  User,
  Phone,
  Mail,
  RefreshCw,
  Clock,
  ArrowRight,
  Send,
  Wallet,
  Check,
  UserCheck,
  PackageCheck,
  Search,
  ChevronDown,
  X,
  ArrowRightLeft,
  Package
} from 'lucide-react';
import { blockchainService } from '../services/blockchain';
import { 
  getRmaTickets, 
  updateRmaTicketStatus, 
  sendRepairCompletedNotification,
  resolveCustomerWallet,
  transferProductOwnership
} from '../services/api';

export default function ServiceCenterHub({ 
  allProducts, 
  onServiceRecorded, 
  onNotify,
  isMetaMaskConnected,
  metaMaskAddress,
  onConnectMetaMask
}) {
  const [serial, setSerial] = useState('');
  const [serviceType, setServiceType] = useState('0'); // 0: Maintenance, 1: Repair, 2: Replacement, 3: Inspection
  const [notes, setNotes] = useState('');
  const [replacedPart, setReplacedPart] = useState('');
  const [technicianId, setTechnicianId] = useState('');
  const [customerEmail, setCustomerEmail] = useState('');
  const [voidReason, setVoidReason] = useState('');

  // Trạng thái tìm kiếm & chọn thiết bị (Combobox/Autocomplete)
  const [serialSearchQuery, setSerialSearchQuery] = useState('');
  const [isSerialDropdownOpen, setIsSerialDropdownOpen] = useState(false);
  const serialDropdownRef = useRef(null);

  // Đóng dropdown tìm kiếm thiết bị khi click ra ngoài
  useEffect(() => {
    const handleClickOutside = (e) => {
      if (serialDropdownRef.current && !serialDropdownRef.current.contains(e.target)) {
        setIsSerialDropdownOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  // Lọc danh sách thiết bị theo từ khóa tìm kiếm (Serial, Tên máy, Model, Brand)
  const filteredProducts = (allProducts || []).filter((p) => {
    if (!serialSearchQuery.trim()) return true;
    const q = serialSearchQuery.toLowerCase().trim();
    return (
      (p.serialNumber && p.serialNumber.toLowerCase().includes(q)) ||
      (p.name && p.name.toLowerCase().includes(q)) ||
      (p.modelCode && p.modelCode.toLowerCase().includes(q)) ||
      (p.brand && p.brand.toLowerCase().includes(q))
    );
  });

  // Tra cứu & Định danh khách hàng (đồng bộ cấu trúc với SellerHub)
  const [customerIdentifier, setCustomerIdentifier] = useState('');
  const [customerAddress, setCustomerAddress] = useState('');
  const [resolvedWallet, setResolvedWallet] = useState(null);
  const [isResolvingWallet, setIsResolvingWallet] = useState(false);
  const [resolveError, setResolveError] = useState('');
  const [emailAutoFilled, setEmailAutoFilled] = useState(false);

  const [loading, setLoading] = useState(false);
  const [successInfo, setSuccessInfo] = useState(null);
  const [emailStatus, setEmailStatus] = useState('');
  const [errorMsg, setErrorMsg] = useState('');
  const [showVoidModal, setShowVoidModal] = useState(false);
  const [txProgress, setTxProgress] = useState(null);

  // RMA Tickets Queue State
  const [rmaTickets, setRmaTickets] = useState([]);
  const [loadingRma, setLoadingRma] = useState(false);
  const [selectedRmaId, setSelectedRmaId] = useState(null);

  // Modal Sang tên thiết bị / Đổi máy 1 đổi 1
  const [showTransferModal, setShowTransferModal] = useState(false);
  const [transferTicket, setTransferTicket] = useState(null);
  const [transferSerial, setTransferSerial] = useState('');
  const [transferIdentifier, setTransferIdentifier] = useState('');
  const [transferResolvedWallet, setTransferResolvedWallet] = useState(null);
  const [isTransferResolving, setIsTransferResolving] = useState(false);
  const [transferResolveError, setTransferResolveError] = useState('');
  const [transferReason, setTransferReason] = useState('Đổi máy 1-đổi-1 do lỗi phần cứng');
  const [transferLoading, setTransferLoading] = useState(false);
  const [transferTxProgress, setTransferTxProgress] = useState(null);
  const [transferError, setTransferError] = useState('');
  const [transferSuccess, setTransferSuccess] = useState(null);

  const handleOpenTransferModal = (ticket = null) => {
    setTransferTicket(ticket);
    const sn = ticket?.serialNumber || serial || '';
    setTransferSerial(sn);
    setTransferIdentifier('');
    setTransferResolvedWallet(null);
    setTransferResolveError('');
    setTransferError('');
    setTransferSuccess(null);
    setTransferReason('Đổi máy 1-đổi-1 do lỗi phần cứng');
    setShowTransferModal(true);
  };

  const fetchRmaQueue = async () => {
    setLoadingRma(true);
    try {
      const tickets = await getRmaTickets();
      setRmaTickets(tickets);
    } catch (err) {
      console.warn('Lỗi tải hàng đợi RMA:', err);
    } finally {
      setLoadingRma(false);
    }
  };

  useEffect(() => {
    fetchRmaQueue();
  }, []);

  // Tự động đảm bảo ví kết nối được phân quyền SERVICE_CENTER On-Chain
  useEffect(() => {
    if (metaMaskAddress && isMetaMaskConnected) {
      fetch('http://localhost:5000/api/blockchain/ensure-role', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ role: 'SERVICE_CENTER', address: metaMaskAddress }),
      }).catch((e) => console.warn('Lỗi auto-ensure role:', e.message));
    }
  }, [metaMaskAddress, isMetaMaskConnected]);

  // Tự động phân giải thông tin người nhận mới khi trạm dịch vụ sang tên
  useEffect(() => {
    if (!transferIdentifier || !transferIdentifier.trim()) {
      setTransferResolvedWallet(null);
      setTransferResolveError('');
      return;
    }

    const timer = setTimeout(async () => {
      setIsTransferResolving(true);
      setTransferResolveError('');
      try {
        const res = await resolveCustomerWallet(transferIdentifier.trim());
        if (res && res.success) {
          setTransferResolvedWallet(res);
        } else {
          setTransferResolvedWallet(null);
          setTransferResolveError(res?.message || 'Không tìm thấy thông tin ví');
        }
      } catch (err) {
        setTransferResolveError(err.message || 'Lỗi tra cứu thông tin khách hàng');
        setTransferResolvedWallet(null);
      } finally {
        setIsTransferResolving(false);
      }
    }, 350);

    return () => clearTimeout(timer);
  }, [transferIdentifier]);

  const handleTransferOwnership = async (e) => {
    e.preventDefault();
    setTransferError('');
    setTransferSuccess(null);

    if (!isMetaMaskConnected) {
      if (onConnectMetaMask) onConnectMetaMask();
      setTransferError('Vui lòng kết nối ví MetaMask của Trạm dịch vụ để ký giao dịch sang tên On-Chain!');
      return;
    }

    if (!transferSerial || !transferSerial.trim()) {
      setTransferError('Vui lòng cung cấp số Serial của thiết bị cần sang tên.');
      return;
    }

    const cleanSn = transferSerial.trim();
    const newOwnerWallet = transferResolvedWallet?.walletAddress;
    if (!newOwnerWallet || !/^0x[a-fA-F0-9]{40}$/.test(newOwnerWallet)) {
      setTransferError('Vui lòng cung cấp người nhận hợp lệ (Số điện thoại, Email hoặc Địa chỉ ví Ethereum 0x...).');
      return;
    }

    setTransferLoading(true);
    setTransferTxProgress({ step: 'AWAITING_SIGNATURE', message: 'Đang mở ví MetaMask & chờ bạn ký duyệt sang tên thiết bị...' });

    try {
      // 1. Ký On-Chain qua MetaMask
      const res = await blockchainService.transferOwnership(cleanSn, newOwnerWallet, (p) => setTransferTxProgress(p));

      const buyerName = transferResolvedWallet?.user?.fullName || transferResolvedWallet?.user?.username || (transferIdentifier.includes('@') ? transferIdentifier.split('@')[0] : 'Khách hàng / Đối tác');
      const buyerPhone = transferResolvedWallet?.user?.phone || (transferIdentifier.match(/^\d+$/) ? transferIdentifier : '');
      const buyerEmail = transferResolvedWallet?.user?.email || (transferIdentifier.includes('@') ? transferIdentifier : '');

      // 2. Cập nhật cơ sở dữ liệu sản phẩm
      await transferProductOwnership(cleanSn, {
        newOwner: newOwnerWallet,
        buyerPhone,
        buyerEmail,
        buyerName,
        txHash: res.txHash,
      });

      // 3. Nếu đang xử lý theo phiếu RMA, cập nhật luôn ghi chú của phiếu RMA
      if (transferTicket?.id) {
        try {
          await updateRmaTicketStatus(transferTicket.id, {
            status: 'COMPLETED',
            technicianNotes: `Đã sang tên/đổi thiết bị cho ${buyerName} (${newOwnerWallet.slice(0, 6)}...${newOwnerWallet.slice(-4)}). Lý do: ${transferReason || 'Xử lý bảo hành RMA'}. TxHash: ${res.txHash}`,
            technicianId: technicianId || 'TECH-SVC',
          });
          const updatedQueue = await getRmaTickets();
          if (Array.isArray(updatedQueue)) setRmaTickets(updatedQueue);
        } catch (ticketErr) {
          console.warn('Lỗi cập nhật ghi chú phiếu RMA:', ticketErr);
        }
      }

      setTransferSuccess({
        serial: cleanSn,
        newOwner: newOwnerWallet,
        recipientName: buyerName,
        txHash: res.txHash,
      });

      if (onNotify) {
        onNotify({
          type: 'success',
          title: 'Sang tên thiết bị RMA thành công',
          message: `Thiết bị [${cleanSn}] đã được chuyển nhượng thành công cho ${buyerName} On-Chain!`,
        });
      }

      if (onServiceRecorded) onServiceRecorded();
    } catch (err) {
      setTransferError(err.message || 'Lỗi khi thực hiện sang tên thiết bị');
    } finally {
      setTransferLoading(false);
      setTransferTxProgress(null);
    }
  };

  // Tự động phân giải thông tin khách hàng qua SĐT / Email / Ví
  useEffect(() => {
    if (!customerIdentifier || !customerIdentifier.trim()) {
      setResolvedWallet(null);
      setResolveError('');
      setCustomerAddress('');
      return;
    }

    const timer = setTimeout(async () => {
      setIsResolvingWallet(true);
      setResolveError('');
      try {
        const res = await resolveCustomerWallet(customerIdentifier.trim());
        if (res && res.success) {
          setResolvedWallet(res);
          setCustomerAddress(res.walletAddress);
          if (res.user?.email) {
            setCustomerEmail(res.user.email);
            setEmailAutoFilled(true);
            setTimeout(() => setEmailAutoFilled(false), 4500);
          }
        }
      } catch (err) {
        setResolveError(err.message || 'Lỗi tra cứu thông tin khách hàng');
        setResolvedWallet(null);
      } finally {
        setIsResolvingWallet(false);
      }
    }, 350);

    return () => clearTimeout(timer);
  }, [customerIdentifier]);

  // Xử lý khi nhân viên bấm chọn khách hàng từ kết quả tìm kiếm
  const handleSelectCustomer = (u) => {
    if (!u) return;
    if (u.phone) {
      setCustomerIdentifier(u.phone);
    } else if (u.email) {
      setCustomerIdentifier(u.email);
    }
    if (u.walletAddress) {
      setCustomerAddress(u.walletAddress);
    }
    if (u.email) {
      setCustomerEmail(u.email);
      setEmailAutoFilled(true);
      setTimeout(() => setEmailAutoFilled(false), 4500);
    }
    setResolvedWallet({
      success: true,
      found: true,
      walletAddress: u.walletAddress,
      user: u
    });
  };

  const handleTriageRma = async (ticket) => {
    try {
      // Bắt buộc xác nhận bằng chữ ký ví MetaMask của Trạm Dịch Vụ
      const technicianAddr = await blockchainService.ensureMetaMaskConnected();
      const triageMessage = `TRẠM DỊCH VỤ TIẾP NHẬN BẢO HÀNH (RMA TRIAGE):
- Mã phiếu: ${ticket.id}
- Thiết bị: ${ticket.serialNumber}
- Kỹ thuật viên: ${technicianId || 'TECH-V01'}
- Địa chỉ ví trạm: ${technicianAddr}
- Thời gian tiếp nhận: ${new Date().toLocaleString('vi-VN')}

Ký xác nhận tiếp nhận thiết bị vào quy trình sửa chữa/bảo dưỡng.`;

      let signature = null;
      try {
        signature = await window.ethereum.request({
          method: 'personal_sign',
          params: [triageMessage, technicianAddr],
        });
      } catch (signErr) {
        if (signErr.code === 4001 || signErr.message?.includes('denied') || signErr.message?.includes('rejected')) {
          setErrorMsg('Bạn đã từ chối ký xác nhận tiếp nhận phiếu trên MetaMask. Trạng thái phiếu không thay đổi.');
          return;
        }
        throw signErr;
      }

      setSerial(ticket.serialNumber);
      setSerialSearchQuery(ticket.serialNumber);
      setServiceType('1'); // Hardware Repair
      setNotes(`[Phiếu ${ticket.id}] ${ticket.defectDescription}`);
      setCustomerEmail(ticket.customerEmail || '');
      if (ticket.customerPhone) {
        setCustomerIdentifier(ticket.customerPhone);
      } else if (ticket.customerEmail) {
        setCustomerIdentifier(ticket.customerEmail);
      }
      setSelectedRmaId(ticket.id);

      await updateRmaTicketStatus(ticket.id, {
        status: 'REPAIRING',
        technicianId: technicianId || 'TECH-V01',
        technicianWallet: technicianAddr,
        triageSignature: signature,
      });
      fetchRmaQueue();

      if (onNotify) {
        onNotify({
          type: 'info',
          title: 'Tiếp nhận phiếu RMA thành công',
          message: `Phiếu [${ticket.id}] đã được ký xác nhận bởi ví ${technicianAddr.slice(0, 6)}...${technicianAddr.slice(-4)} và chuyển sang trạng thái Đang Sửa Chữa.`,
        });
      }
    } catch (err) {
      setErrorMsg(err.message || 'Lỗi khi tiếp nhận phiếu RMA qua MetaMask');
    }
  };

  const renderProductStatusTag = (status) => {
    switch (Number(status)) {
      case 1:
        return (
          <span className="text-[10px] px-2 py-0.5 rounded font-semibold bg-emerald-500/15 text-emerald-700 dark:text-emerald-400 border border-emerald-500/30">
            ✓ Đang bảo hành
          </span>
        );
      case 2:
        return (
          <span className="text-[10px] px-2 py-0.5 rounded font-semibold bg-rose-500/15 text-rose-700 dark:text-rose-400 border border-rose-500/30">
            ⚠ Hết hạn bảo hành
          </span>
        );
      case 3:
        return (
          <span className="text-[10px] px-2 py-0.5 rounded font-semibold bg-slate-500/15 text-slate-700 dark:text-slate-400 border border-slate-500/30">
            ⛔ Bị vô hiệu hóa
          </span>
        );
      default:
        return (
          <span className="text-[10px] px-2 py-0.5 rounded font-semibold bg-amber-500/15 text-amber-700 dark:text-amber-400 border border-amber-500/30">
            ⏳ Chưa kích hoạt
          </span>
        );
    }
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!isMetaMaskConnected) {
      if (onConnectMetaMask) onConnectMetaMask();
      setErrorMsg('Vui lòng kết nối ví MetaMask để ký số biên bản dịch vụ On-Chain!');
      return;
    }

    if (!serial.trim()) {
      setErrorMsg('Vui lòng nhập hoặc chọn mã Serial sản phẩm');
      return;
    }
    const cleanSerial = serial.trim();
    const matchedProd = (allProducts || []).find(p => p.serialNumber.toLowerCase() === cleanSerial.toLowerCase());
    if (!matchedProd) {
      setErrorMsg(`Số Serial [${cleanSerial}] chưa tồn tại trong danh mục hệ thống. Vui lòng kiểm tra lại mã thiết bị.`);
      return;
    }
    if (!notes.trim()) {
      setErrorMsg('Vui lòng nhập mô tả công việc sửa chữa/bảo dưỡng');
      return;
    }

    setLoading(true);
    setErrorMsg('');
    setSuccessInfo(null);
    setEmailStatus('');
    setTxProgress({ step: 'AWAITING_SIGNATURE', message: 'Đang mở ví MetaMask & chờ bạn ký biên bản dịch vụ...' });

    try {
      const res = await blockchainService.addServiceRecord(
        serial,
        serviceType,
        notes,
        replacedPart || 'Không thay thế',
        technicianId,
        (p) => setTxProgress(p)
      );

      const typeNames = ['Bảo dưỡng định kỳ', 'Sửa chữa phần cứng', 'Thay thế linh kiện', 'Kiểm định & Hiệu chuẩn'];
      const currentServiceTypeName = typeNames[Number(serviceType)] || 'Dịch vụ kỹ thuật';

      setSuccessInfo({
        serial,
        recordId: res.record.recordId,
        txHash: res.txHash,
        blockNumber: res.blockNumber,
      });

      // 1. Tự động gửi Email thông báo hoàn tất dịch vụ nếu có email khách hàng
      if (customerEmail && customerEmail.trim()) {
        sendRepairCompletedNotification({
          toEmail: customerEmail.trim(),
          customerName: resolvedWallet?.user?.fullName || 'Quý khách hàng',
          serialNumber: serial,
          serviceType: currentServiceTypeName,
          notes,
          replacedPart: replacedPart || 'Không thay thế',
          technicianId,
          txHash: res.txHash,
        }).then(() => {
          setEmailStatus(`Đã tự động gửi biên bản dịch vụ qua email tới: ${customerEmail}`);
        });
      }

      // 2. Tự động hoàn tất phiếu RMA nếu đang xử lý theo phiếu
      if (selectedRmaId) {
        await updateRmaTicketStatus(selectedRmaId, {
          status: 'COMPLETED',
          technicianId,
          replacedPart: replacedPart || 'Không thay thế',
          technicianNotes: notes,
        });
        setSelectedRmaId(null);
        fetchRmaQueue();
      }

      setNotes('');
      setReplacedPart('');
      setCustomerEmail('');
      setCustomerIdentifier('');
      setResolvedWallet(null);
      setSerial('');
      setSerialSearchQuery('');
      if (onServiceRecorded) onServiceRecorded();
    } catch (err) {
      setErrorMsg(err.message || 'Lỗi khi ghi nhận lịch sử dịch vụ');
    } finally {
      setLoading(false);
      setTxProgress(null);
    }
  };

  const handleVoidWarranty = async () => {
    if (!isMetaMaskConnected) {
      if (onConnectMetaMask) onConnectMetaMask();
      setErrorMsg('Vui lòng kết nối ví MetaMask để ký giao dịch vô hiệu hóa bảo hành On-Chain!');
      return;
    }

    if (!serial.trim()) {
      setErrorMsg('Vui lòng chọn sản phẩm cần vô hiệu hóa');
      return;
    }
    if (!voidReason.trim()) {
      setErrorMsg('Vui lòng nhập lý do từ chối/vô hiệu hóa bảo hành');
      return;
    }

    setLoading(true);
    setTxProgress({ step: 'AWAITING_SIGNATURE', message: 'Đang mở ví MetaMask & chờ bạn ký vô hiệu hóa bảo hành...' });
    try {
      const res = await blockchainService.voidWarranty(serial, voidReason, (p) => setTxProgress(p));
      setShowVoidModal(false);
      const savedReason = voidReason;
      const savedSerial = serial;
      setVoidReason('');
      setSuccessInfo({
        serial: savedSerial,
        recordId: 'VÔ HIỆU HÓA',
        txHash: res?.txHash || 'Giao dịch On-Chain đã xác thực',
        blockNumber: res?.blockNumber,
      });
      if (onNotify) {
        onNotify({
          type: 'error',
          title: 'Cảnh Báo Vi Phạm: Đã Vô Hiệu Hóa Bảo Hành',
          message: `Thiết bị [${savedSerial}] đã bị vô hiệu hóa quyền bảo hành on-chain với lý do: "${savedReason}". Mã giao dịch xác thực: ${res?.txHash}`,
        });
      }
      if (onServiceRecorded) onServiceRecorded();
    } catch (err) {
      setErrorMsg(err.message || 'Lỗi khi vô hiệu hóa bảo hành');
    } finally {
      setLoading(false);
      setTxProgress(null);
    }
  };

  const getRmaStatusBadge = (status) => {
    switch (status) {
      case 'COMPLETED':
        return <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-emerald-500/20 text-emerald-400 border border-emerald-500/30">Đã Hoàn Tất</span>;
      case 'REPAIRING':
        return <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-amber-500/20 text-amber-300 border border-amber-500/30">Đang Sửa Chữa</span>;
      case 'REJECTED':
        return <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-rose-500/20 text-rose-400 border border-rose-500/30">Từ Chối</span>;
      default:
        return <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-blue-500/20 text-blue-400 border border-blue-500/30">Chờ Tiếp Nhận</span>;
    }
  };

  return (
    <div className="space-y-8">
      
      {/* Banner */}
      <div className="p-6 rounded-3xl glass-card border border-slate-200 dark:border-slate-800 flex flex-col md:flex-row items-start md:items-center justify-between gap-4">
        <div className="flex items-center gap-4">
          <div className="w-12 h-12 rounded-2xl bg-blue-500/10 text-blue-600 dark:text-blue-400 border border-blue-500/20 flex items-center justify-center">
            <Wrench className="w-6 h-6" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h2 className="text-lg font-bold text-slate-900 dark:text-white">Cổng Trạm Dịch Vụ & Bảo Dưỡng Ủy Quyền</h2>
              <span className="text-[10px] bg-blue-500/15 text-blue-700 dark:text-blue-400 font-bold px-2 py-0.5 rounded border border-blue-500/30">
                ROLE: SERVICE_CENTER
              </span>
            </div>
            <p className="text-xs text-slate-600 dark:text-slate-400">
              Tiếp nhận phiếu RMA của khách hàng, ghi nhận bất biến hoạt động sửa chữa vào Smart Contract & Tự động gửi Email biên bản.
            </p>
          </div>
        </div>

        <button
          type="button"
          onClick={() => setShowVoidModal(!showVoidModal)}
          className="px-3.5 py-2 rounded-xl bg-rose-500/15 hover:bg-rose-500/25 text-rose-600 dark:text-rose-400 text-xs font-semibold border border-rose-500/30 flex items-center gap-2 transition cursor-pointer"
        >
          <ShieldAlert className="w-4 h-4" />
          Vô hiệu hóa Bảo hành (Vi phạm)
        </button>
      </div>

      {/* Wallet status banner */}
      {isMetaMaskConnected ? (
        <div className="p-3.5 rounded-2xl bg-emerald-500/10 border border-emerald-500/30 flex items-center justify-between gap-2 text-emerald-800 dark:text-emerald-300 text-xs">
          <div className="flex items-center gap-2">
            <CheckCircle2 className="w-4 h-4 text-emerald-500 dark:text-emerald-400 shrink-0" />
            <span>Ví MetaMask đã kết nối: <span className="font-mono font-bold text-slate-900 dark:text-white">{metaMaskAddress}</span></span>
          </div>
          <span className="text-[10px] bg-emerald-500/20 px-2.5 py-1 rounded-lg text-emerald-800 dark:text-emerald-300 font-bold border border-emerald-500/30">
            ✓ Sẵn sàng ghi sổ cái On-Chain
          </span>
        </div>
      ) : (
        <div className="p-3.5 rounded-2xl bg-amber-500/10 border border-amber-500/30 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 text-amber-800 dark:text-amber-300 text-xs">
          <div className="flex items-center gap-2">
            <AlertTriangle className="w-4 h-4 text-amber-500 dark:text-amber-400 shrink-0" />
            <span>Yêu cầu kết nối ví MetaMask: Trạm dịch vụ ủy quyền cần chữ ký số từ ví Web3 để niêm phong biên bản sửa chữa vào Smart Contract.</span>
          </div>
          {onConnectMetaMask && (
            <button
              type="button"
              onClick={onConnectMetaMask}
              className="px-3.5 py-1.5 rounded-xl bg-orange-500 hover:bg-orange-600 text-white font-bold text-xs flex items-center gap-1.5 transition cursor-pointer shrink-0 shadow-md shadow-orange-500/20"
            >
              <Wallet className="w-3.5 h-3.5" />
              <span>Kết nối MetaMask</span>
            </button>
          )}
        </div>
      )}

      {/* ============================================================== */}
      {/* HÀNG ĐỢI TIẾP NHẬN PHIẾU RMA CỦA KHÁCH HÀNG                     */}
      {/* ============================================================== */}
      <div className="glass-card rounded-3xl p-6 border border-slate-200 dark:border-slate-800 space-y-4">
        <div className="flex flex-wrap items-center justify-between gap-3 pb-3 border-b border-slate-200 dark:border-slate-800">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-xl bg-blue-500/10 text-blue-500 dark:text-blue-400 border border-blue-500/20 flex items-center justify-center">
              <Inbox className="w-4 h-4" />
            </div>
            <div>
              <h3 className="text-sm font-bold text-slate-900 dark:text-white flex items-center gap-2">
                Hàng Đợi Tiếp Nhận Yêu Cầu Bảo Hành / RMA Của Khách Hàng
                <span className="text-[10px] px-2 py-0.5 rounded-full bg-blue-500/20 text-blue-600 dark:text-blue-400 font-mono font-bold">
                  {rmaTickets.filter(t => t.status !== 'COMPLETED').length} phiếu cần xử lý
                </span>
              </h3>
              <p className="text-xs text-slate-600 dark:text-slate-400">
                Phiếu yêu cầu do khách hàng tạo từ Cổng tra cứu công khai hoặc gửi bưu điện.
              </p>
            </div>
          </div>

          <button
            type="button"
            onClick={fetchRmaQueue}
            disabled={loadingRma}
            className="px-3 py-1.5 rounded-xl bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-300 text-xs font-semibold flex items-center gap-1.5 transition cursor-pointer border border-slate-200 dark:border-slate-700"
          >
            <RefreshCw className={`w-3.5 h-3.5 ${loadingRma ? 'animate-spin' : ''}`} />
            <span>Làm mới hàng đợi</span>
          </button>
        </div>

        {rmaTickets.length === 0 ? (
          <div className="p-6 rounded-2xl bg-slate-50 dark:bg-slate-950/60 border border-slate-200 dark:border-slate-800/80 text-center text-xs text-slate-500 dark:text-slate-400 space-y-1">
            <Inbox className="w-8 h-8 text-slate-400 dark:text-slate-600 mx-auto mb-2" />
            <div className="font-semibold text-slate-700 dark:text-slate-300">Hiện chưa có phiếu yêu cầu bảo hành (RMA) nào trong hàng đợi</div>
            <p className="text-[11px] text-slate-500">
              Khách hàng có thể tra cứu mã Serial tại Cổng Tra Cứu và bấm nút &quot;Yêu cầu RMA&quot; để gửi phiếu sửa chữa.
            </p>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
            {rmaTickets.map((ticket) => (
              <div
                key={ticket.id}
                className={`p-4 rounded-2xl border transition text-xs space-y-3 ${
                  selectedRmaId === ticket.id
                    ? 'bg-amber-50 dark:bg-amber-950/20 border-amber-300 dark:border-amber-500/50 shadow-lg shadow-amber-500/5'
                    : ticket.status === 'COMPLETED'
                    ? 'bg-slate-50 dark:bg-slate-950/40 border-slate-200 dark:border-slate-800/60 opacity-70'
                    : 'bg-white dark:bg-slate-950/70 border-slate-200 dark:border-slate-800 hover:border-slate-300 dark:hover:border-slate-700'
                }`}
              >
                <div className="flex items-start justify-between gap-2">
                  <div>
                    <div className="font-mono font-bold text-amber-600 dark:text-amber-300 text-[11px]">{ticket.id}</div>
                    <div className="font-mono font-semibold text-slate-900 dark:text-white text-xs mt-0.5">{ticket.serialNumber}</div>
                  </div>
                  {getRmaStatusBadge(ticket.status)}
                </div>

                <div className="p-2.5 rounded-xl bg-slate-50 dark:bg-slate-900/80 border border-slate-200 dark:border-slate-800/80 text-[11px] space-y-1">
                  <div className="flex items-center gap-1.5 text-slate-700 dark:text-slate-300">
                    <User className="w-3 h-3 text-slate-400 dark:text-slate-500" />
                    <strong>{ticket.customerName}</strong>
                    {ticket.customerPhone && <span className="text-slate-500">({ticket.customerPhone})</span>}
                  </div>
                  {ticket.customerEmail && (
                    <div className="flex items-center gap-1.5 text-slate-500 dark:text-slate-400 font-mono text-[10px]">
                      <Mail className="w-3 h-3 text-blue-500 dark:text-blue-400" />
                      <span>{ticket.customerEmail}</span>
                    </div>
                  )}
                  <div className="text-slate-600 dark:text-slate-300 pt-1 border-t border-slate-200 dark:border-slate-800/60 line-clamp-2 italic">
                    &quot;{ticket.defectDescription}&quot;
                  </div>
                </div>

                <div className="flex items-center gap-2 pt-1">
                  {ticket.status !== 'COMPLETED' ? (
                    <button
                      type="button"
                      onClick={() => handleTriageRma(ticket)}
                      className="flex-1 py-2 rounded-xl bg-blue-600 hover:bg-blue-700 text-white font-bold text-[11px] flex items-center justify-center gap-1.5 transition shadow-md shadow-blue-600/20 cursor-pointer"
                    >
                      <span>Tiếp nhận & Sửa</span>
                      <ArrowRight className="w-3 h-3" />
                    </button>
                  ) : (
                    <div className="flex-1 text-[11px] text-slate-400 italic flex items-center gap-1">
                      <CheckCircle2 className="w-3.5 h-3.5 text-emerald-500" />
                      <span>Đã xử lý xong phiếu</span>
                    </div>
                  )}

                  <button
                    type="button"
                    onClick={() => handleOpenTransferModal(ticket)}
                    className="px-3 py-2 rounded-xl bg-purple-500/10 hover:bg-purple-500/20 text-purple-700 dark:text-purple-300 border border-purple-500/30 font-bold text-[11px] flex items-center gap-1.5 transition cursor-pointer"
                    title="Sang tên thiết bị hoặc đổi máy 1-đổi-1 cho khách hàng"
                  >
                    <ArrowRightLeft className="w-3.5 h-3.5" />
                    <span>Sang tên</span>
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* ============================================================== */}
      {/* FORM: LẬP PHIẾU DỊCH VỤ & GHI SỔ CÁI ON-CHAIN                   */}
      {/* ============================================================== */}
      <div className="glass-card rounded-3xl p-6 sm:p-8 border border-slate-200 dark:border-slate-800 space-y-6 shadow-sm">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between pb-4 border-b border-slate-200 dark:border-slate-800 gap-2">
          <div>
            <h3 className="text-base font-bold text-slate-900 dark:text-white flex items-center gap-2">
              <FileCheck className="w-5 h-5 text-amber-500 dark:text-amber-400" />
              Lập Phiếu Dịch vụ & Ghi sổ cái On-Chain
            </h3>
            <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
              Nhập thông tin khách hàng, chọn thiết bị nhận sửa chữa và niêm phong biên bản kỹ thuật vào Smart Contract.
            </p>
          </div>
          <div className="flex items-center gap-2 self-start sm:self-center flex-wrap">
            {selectedRmaId && (
              <span className="text-xs font-mono px-3 py-1 rounded-xl bg-amber-500/20 text-amber-700 dark:text-amber-300 border border-amber-500/30 font-bold">
                Đang xử lý theo RMA: {selectedRmaId}
              </span>
            )}
            <button
              type="button"
              onClick={() => {
                const curTicket = rmaTickets.find(t => t.id === selectedRmaId);
                handleOpenTransferModal(curTicket || (serial ? { serialNumber: serial } : null));
              }}
              className="text-xs px-3 py-1.5 rounded-xl bg-purple-500/10 hover:bg-purple-500/20 text-purple-700 dark:text-purple-300 border border-purple-500/30 font-bold flex items-center gap-1.5 transition cursor-pointer"
              title="Sang tên thiết bị hoặc đổi máy 1-đổi-1 cho khách hàng"
            >
              <ArrowRightLeft className="w-3.5 h-3.5" />
              <span>Sang tên / Đổi máy</span>
            </button>
          </div>
        </div>

        {/* Real-time MetaMask Transaction Status Indicator */}
        {loading && txProgress && (
          <div className={`p-4 rounded-2xl border text-xs flex items-center gap-3 transition-all duration-300 animate-fade-in ${
            txProgress.step === 'CONFIRMED'
              ? 'bg-emerald-500/15 border-emerald-500/40 text-emerald-800 dark:text-emerald-300'
              : txProgress.step === 'FAILED'
              ? 'bg-rose-500/15 border-rose-500/40 text-rose-800 dark:text-rose-300'
              : 'bg-blue-500/10 border-blue-500/30 text-blue-800 dark:text-blue-300 animate-pulse'
          }`}>
            <div className="w-5 h-5 rounded-full border-2 border-current border-t-transparent animate-spin shrink-0" />
            <div className="flex-1">
              <div className="font-bold flex items-center gap-1.5 text-sm">
                <span>🦊 MetaMask:</span>
                <span>{txProgress.message}</span>
              </div>
              <p className="text-[11px] opacity-80 mt-0.5">
                {txProgress.step === 'AWAITING_SIGNATURE' && 'Cửa sổ MetaMask đang mở. Vui lòng bấm "Xác nhận" để ký biên bản dịch vụ.'}
                {txProgress.step === 'MINING' && 'Giao dịch đã được phát lên mạng Blockchain. Đang chờ xác nhận khối...'}
                {txProgress.step === 'CONFIRMED' && 'MetaMask đã xác nhận giao dịch thành công! Đang lưu dữ liệu...'}
                {txProgress.step === 'FAILED' && 'Giao dịch đã bị từ chối hoặc gặp lỗi từ ví MetaMask.'}
              </p>
            </div>
          </div>
        )}

        {errorMsg && (
          <div className="p-3.5 rounded-xl bg-rose-500/10 border border-rose-500/30 text-rose-600 dark:text-rose-400 text-xs flex items-center gap-2">
            <AlertTriangle className="w-4 h-4 shrink-0" />
            <span>{errorMsg}</span>
          </div>
        )}

        {successInfo && (
          <div className="p-4 rounded-xl bg-emerald-500/10 border border-emerald-500/30 text-emerald-700 dark:text-emerald-400 text-xs space-y-2">
            <div className="flex items-center gap-2 font-bold text-sm">
              <CheckCircle2 className="w-4 h-4" />
              Ghi nhận thành công vào sổ cái Blockchain cho {successInfo.serial}!
            </div>
            <div className="font-mono text-[11px] text-slate-600 dark:text-slate-300">
              Tx Hash: <span className="text-emerald-700 dark:text-emerald-300">{successInfo.txHash}</span>
            </div>
            {emailStatus && (
              <div className="p-2 rounded-lg bg-blue-500/10 border border-blue-500/20 text-blue-700 dark:text-blue-300 text-[11px] flex items-center gap-1.5">
                <Mail className="w-3.5 h-3.5 text-blue-500 dark:text-blue-400 shrink-0" />
                <span>{emailStatus}</span>
              </div>
            )}
          </div>
        )}

        {/* Void Modal / Alert Drawer */}
        {showVoidModal && (
          <div className="p-4 rounded-2xl bg-rose-50 dark:bg-rose-950/40 border border-rose-300 dark:border-rose-500/30 space-y-3 text-xs">
            <div className="flex items-center gap-2 text-rose-600 dark:text-rose-400 font-bold">
              <ShieldX className="w-4 h-4" />
              Từ chối và vô hiệu hóa quyền lợi bảo hành
            </div>
            <p className="text-slate-600 dark:text-slate-400">
              Chức năng dành riêng khi thiết bị bị can thiệp trái phép, vào nước, rơi vỡ hoặc tự ý cạy tem niêm phong.
            </p>
            <input
              type="text"
              value={voidReason}
              onChange={(e) => setVoidReason(e.target.value)}
              placeholder="Nhập lý do vi phạm điều khoản (VD: Tem bảo hành bị rách, ngấm nước mặn)..."
              className="w-full px-3 py-2 rounded-xl bg-white dark:bg-slate-950 border border-slate-300 dark:border-slate-800 text-slate-900 dark:text-white focus:outline-none placeholder:text-slate-400 dark:placeholder:text-slate-500"
            />
            <div className="flex justify-end gap-2">
              <button
                type="button"
                onClick={() => setShowVoidModal(false)}
                className="px-3 py-1.5 rounded-lg bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 text-slate-700 dark:text-slate-300 dark:hover:bg-slate-700 cursor-pointer"
              >
                Hủy
              </button>
              <button
                type="button"
                disabled={loading}
                onClick={handleVoidWarranty}
                className="px-3 py-1.5 rounded-lg bg-rose-600 text-white hover:bg-rose-500 font-bold cursor-pointer disabled:opacity-50 flex items-center gap-1.5"
              >
                {loading && <div className="w-3.5 h-3.5 border-2 border-white border-t-transparent rounded-full animate-spin" />}
                <span>{loading ? (txProgress?.message || 'Đang vô hiệu hóa...') : 'Xác nhận Vô hiệu On-Chain'}</span>
              </button>
            </div>
          </div>
        )}

        <form onSubmit={handleSubmit} className="space-y-5 text-xs">
          
          {/* BƯỚC 1: SỐ ĐIỆN THOẠI / EMAIL / VÍ KHÁCH HÀNG (GIỐNG SELLER) */}
          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <label className="text-slate-700 dark:text-slate-300 font-semibold flex items-center gap-1.5 text-xs">
                <Phone className="w-3.5 h-3.5 text-emerald-500" />
                <span>1. Số Điện Thoại / Email / Ví Khách Hàng</span>
              </label>
              <span className="text-[10px] text-slate-500 dark:text-slate-400">
                📱 Nhập SĐT (10 số), Email hoặc ví 0x...
              </span>
            </div>
            
            <div className="relative">
              <input
                type="text"
                value={customerIdentifier}
                onChange={(e) => {
                  const val = e.target.value;
                  setCustomerIdentifier(val);
                  if (val.startsWith('0x') && val.length === 42) {
                    setCustomerAddress(val);
                  }
                }}
                placeholder="Nhập SĐT khách hàng (VD: 0987654313, 0367833013) hoặc Email..."
                className="w-full px-3.5 py-2.5 rounded-xl bg-white dark:bg-slate-950 border border-slate-300 dark:border-slate-800 text-slate-900 dark:text-white font-mono text-xs focus:border-emerald-500 focus:outline-none placeholder:text-slate-400 dark:placeholder:text-slate-500 pr-10"
              />
              {isResolvingWallet && (
                <div className="absolute right-3 top-1/2 -translate-y-1/2">
                  <div className="w-4 h-4 border-2 border-emerald-500 border-t-transparent rounded-full animate-spin" />
                </div>
              )}
            </div>

            {/* Thông tin khách hàng nhận diện được */}
            {resolvedWallet && resolvedWallet.user ? (
              <div 
                onClick={() => handleSelectCustomer(resolvedWallet.user)}
                className="p-3.5 rounded-2xl bg-gradient-to-r from-emerald-500/10 via-teal-500/10 to-blue-500/10 border-2 border-emerald-500/50 hover:border-emerald-500 text-slate-900 dark:text-white text-xs space-y-2 cursor-pointer transition-all duration-200 shadow-xs hover:shadow-md hover:scale-[1.008] group animate-fade-in"
                title="Nhấp vào để chọn khách hàng này & tự động điền Email bên dưới"
              >
                <div className="flex items-center justify-between gap-3">
                  <div className="flex items-center gap-3">
                    <div className="w-9 h-9 rounded-xl bg-emerald-500/20 text-emerald-600 dark:text-emerald-400 flex items-center justify-center font-bold text-sm shrink-0 border border-emerald-500/30">
                      {resolvedWallet.user.fullName?.charAt(0) || '👤'}
                    </div>
                    <div>
                      <div className="font-bold text-slate-900 dark:text-white flex items-center gap-2">
                        <span className="text-sm">{resolvedWallet.user.fullName || resolvedWallet.user.username}</span>
                        <span className="text-[10px] px-2 py-0.5 rounded-full bg-emerald-500/20 text-emerald-700 dark:text-emerald-300 font-bold border border-emerald-500/30">
                          ✓ Khách hàng hệ thống
                        </span>
                      </div>
                      <div className="text-[11px] text-slate-500 dark:text-slate-400 flex flex-wrap items-center gap-2.5 mt-0.5">
                        {resolvedWallet.user.phone && (
                          <span className="flex items-center gap-1 font-mono text-slate-700 dark:text-slate-300">
                            <Phone className="w-3 h-3 text-blue-500" />
                            {resolvedWallet.user.phone}
                          </span>
                        )}
                        {resolvedWallet.user.email && (
                          <span className="flex items-center gap-1 font-mono text-emerald-600 dark:text-emerald-400 font-semibold">
                            <Mail className="w-3 h-3 text-emerald-500" />
                            {resolvedWallet.user.email}
                          </span>
                        )}
                      </div>
                    </div>
                  </div>

                  <button
                    type="button"
                    onClick={(e) => {
                      e.stopPropagation();
                      handleSelectCustomer(resolvedWallet.user);
                    }}
                    className="px-3.5 py-2 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white font-bold text-[11px] flex items-center gap-1.5 shadow-md shadow-emerald-600/25 transition cursor-pointer shrink-0 active:scale-95"
                  >
                    <Check className="w-3.5 h-3.5" />
                    <span>Chọn Khách Hàng Này</span>
                  </button>
                </div>

                <div className="pt-2 border-t border-emerald-500/20 flex flex-wrap items-center justify-between gap-2 text-[11px]">
                  <div className="flex items-center gap-1 font-mono text-slate-600 dark:text-slate-400">
                    <span>Ví On-Chain liên kết:</span>
                    <span className="text-slate-900 dark:text-white font-bold">{resolvedWallet.walletAddress}</span>
                  </div>
                  <span className="text-emerald-700 dark:text-emerald-400 font-medium text-[10px] flex items-center gap-1">
                    <Sparkles className="w-3 h-3" />
                    Nhấp vào để tự động điền Email vào ô bên dưới
                  </span>
                </div>
              </div>
            ) : resolvedWallet && resolvedWallet.isAutoDerived ? (
              <div className="p-3 rounded-2xl bg-blue-500/10 border border-blue-500/30 text-blue-800 dark:text-blue-300 text-xs space-y-1 animate-fade-in">
                <div className="flex items-center justify-between">
                  <span className="font-bold flex items-center gap-1.5">
                    <UserCheck className="w-4 h-4 text-blue-500 shrink-0" />
                    Khách hàng mới (chưa có tài khoản Web)
                  </span>
                  <span className="text-[10px] px-2 py-0.5 rounded bg-blue-500/20 text-blue-700 dark:text-blue-300 font-bold">
                    ✓ Đã cấp ví bảo mật MPC
                  </span>
                </div>
                <div className="text-[11px] text-slate-600 dark:text-slate-400 font-mono">
                  Ví On-Chain định danh theo SĐT: <strong className="text-slate-900 dark:text-white">{resolvedWallet.walletAddress}</strong>
                </div>
              </div>
            ) : null}

            {resolveError && customerIdentifier.trim() && (
              <div className="p-2.5 rounded-xl bg-amber-500/10 border border-amber-500/30 text-amber-700 dark:text-amber-300 text-xs flex items-center gap-2">
                <AlertTriangle className="w-3.5 h-3.5 shrink-0" />
                <span>{resolveError}</span>
              </div>
            )}
          </div>

          {/* BƯỚC 2: CHỌN & TÌM KIẾM THIẾT BỊ TIẾP NHẬN (COMBOBOX) */}
          <div className="space-y-2 relative" ref={serialDropdownRef}>
            <div className="flex justify-between items-center">
              <label className="text-slate-700 dark:text-slate-300 font-semibold flex items-center gap-1.5 text-xs">
                <PackageCheck className="w-3.5 h-3.5 text-blue-500" />
                <span>2. Chọn Thiết Bị Cần Sửa Chữa / Bảo Dưỡng (*)</span>
              </label>
              {serial && (
                <span className="text-[10px] text-emerald-600 dark:text-emerald-400 font-mono flex items-center gap-1">
                  <Check className="w-3 h-3" />
                  Đã chọn: <strong className="font-bold">{serial}</strong>
                </span>
              )}
            </div>

            <div className="relative">
              <Search className="w-4 h-4 text-slate-400 absolute left-3.5 top-1/2 -translate-y-1/2 pointer-events-none" />
              <input
                type="text"
                required
                value={serialSearchQuery}
                onFocus={() => setIsSerialDropdownOpen(true)}
                onChange={(e) => {
                  const val = e.target.value;
                  setSerialSearchQuery(val);
                  setSerial(val);
                  setIsSerialDropdownOpen(true);
                }}
                placeholder="-- Nhấp để chọn hoặc gõ mã máy, model, số serial để tìm kiếm --"
                className="w-full pl-10 pr-20 py-2.5 rounded-xl bg-white dark:bg-slate-950 border border-slate-300 dark:border-slate-800 text-slate-900 dark:text-white font-mono text-xs focus:border-blue-500 focus:outline-none placeholder:text-slate-400 dark:placeholder:text-slate-500 cursor-pointer"
              />
              <div className="absolute right-3 top-1/2 -translate-y-1/2 flex items-center gap-1">
                {serialSearchQuery && (
                  <button
                    type="button"
                    onClick={() => {
                      setSerial('');
                      setSerialSearchQuery('');
                      setIsSerialDropdownOpen(true);
                    }}
                    className="p-1 rounded-md hover:bg-slate-100 dark:hover:bg-slate-800 text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 transition cursor-pointer"
                    title="Xóa lựa chọn"
                  >
                    <X className="w-3.5 h-3.5" />
                  </button>
                )}
                <button
                  type="button"
                  onClick={() => setIsSerialDropdownOpen(!isSerialDropdownOpen)}
                  className="p-1 rounded-md text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 transition cursor-pointer"
                  title="Mở danh sách thiết bị"
                >
                  <ChevronDown className={`w-4 h-4 transition-transform duration-200 ${isSerialDropdownOpen ? 'rotate-180 text-blue-500' : ''}`} />
                </button>
              </div>
            </div>

            {/* Thẻ tóm tắt thông tin thiết bị đang chọn */}
            {(() => {
              const selProd = (allProducts || []).find(p => p.serialNumber.toLowerCase() === (serial || '').toLowerCase());
              if (!selProd) {
                if (serial.trim()) {
                  return (
                    <div className="p-3 rounded-xl bg-amber-500/10 border border-amber-500/30 text-amber-700 dark:text-amber-300 text-xs flex items-center gap-2">
                      <AlertTriangle className="w-4 h-4 shrink-0 text-amber-500" />
                      <span>Số Serial &quot;{serial}&quot; chưa tồn tại trong danh mục hệ thống. Vui lòng chọn từ danh sách hoặc kiểm tra lại.</span>
                    </div>
                  );
                }
                return null;
              }
              return (
                <div className="p-3 rounded-2xl bg-blue-500/10 border border-blue-500/20 text-xs space-y-2 animate-fade-in">
                  <div className="flex items-center justify-between">
                    <div className="font-bold text-slate-900 dark:text-white flex items-center gap-2">
                      <span>{selProd.name || selProd.modelCode}</span>
                      {selProd.brand && <span className="text-slate-500 text-[11px]">({selProd.brand})</span>}
                    </div>
                    {renderProductStatusTag(selProd.status)}
                  </div>
                  <div className="flex flex-wrap items-center justify-between text-[11px] text-slate-500 dark:text-slate-400 font-mono gap-2 pt-1 border-t border-blue-500/20">
                    <div>Model: <strong className="text-slate-700 dark:text-slate-200">{selProd.modelCode || 'Tiêu chuẩn'}</strong></div>
                    <div>Chủ máy: <strong className="text-slate-700 dark:text-slate-200">{selProd.currentOwner ? `${selProd.currentOwner.slice(0, 8)}...` : 'Chưa kích hoạt'}</strong></div>
                  </div>
                  {selProd.status === 3 && (
                    <div className="p-2 rounded-lg bg-rose-500/15 border border-rose-500/30 text-rose-700 dark:text-rose-300 text-[11px] flex items-center gap-1.5 font-bold">
                      <ShieldX className="w-3.5 h-3.5 shrink-0" />
                      <span>Cảnh báo: Thiết bị này đã bị vô hiệu hóa bảo hành. Mọi chi phí sửa chữa sẽ tính dịch vụ ngoài.</span>
                    </div>
                  )}
                  {selProd.status === 0 && (
                    <div className="p-2 rounded-lg bg-amber-500/15 border border-amber-500/30 text-amber-800 dark:text-amber-300 text-[11px] flex items-center gap-1.5">
                      <Clock className="w-3.5 h-3.5 shrink-0" />
                      <span>Lưu ý: Thiết bị này chưa được kích hoạt bảo hành điện tử (Chưa bán hoặc hàng tồn kho).</span>
                    </div>
                  )}
                </div>
              );
            })()}

            {/* Dropdown Menu Danh Sách Kết Quả */}
            {isSerialDropdownOpen && (
              <div className="absolute z-30 left-0 right-0 mt-1 max-h-60 overflow-y-auto rounded-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 shadow-xl p-2 space-y-1 text-xs animate-fade-in backdrop-blur-md">
                {filteredProducts.length === 0 ? (
                  <div className="p-4 text-center text-slate-500 dark:text-slate-400 space-y-1">
                    <p className="font-medium text-xs">Không tìm thấy thiết bị nào khớp với &quot;{serialSearchQuery}&quot;</p>
                    <p className="text-[11px] text-slate-400">
                      Bạn vẫn có thể tiếp tục sử dụng mã Serial này để lập biên bản sửa chữa.
                    </p>
                  </div>
                ) : (
                  filteredProducts.map((p) => {
                    const isSelected = serial && serial.toLowerCase() === p.serialNumber.toLowerCase();
                    return (
                      <div
                        key={p.serialNumber}
                        onClick={() => {
                          setSerial(p.serialNumber);
                          setSerialSearchQuery(p.serialNumber);
                          setIsSerialDropdownOpen(false);
                        }}
                        className={`p-2.5 rounded-xl cursor-pointer transition flex items-center justify-between gap-3 ${
                          isSelected
                            ? 'bg-blue-50 dark:bg-blue-950/40 text-blue-600 dark:text-blue-300 font-bold border border-blue-200 dark:border-blue-800'
                            : 'hover:bg-slate-100 dark:hover:bg-slate-800/80 text-slate-700 dark:text-slate-200'
                        }`}
                      >
                        <div className="min-w-0 flex-1">
                          <div className="flex items-center gap-2">
                            <span className="font-mono font-bold text-slate-900 dark:text-white text-xs">{p.serialNumber}</span>
                            {renderProductStatusTag(p.status)}
                          </div>
                          <div className="text-[11px] text-slate-500 dark:text-slate-400 truncate mt-0.5">
                            {p.name || p.modelCode} {p.brand ? `• ${p.brand}` : ''}
                          </div>
                        </div>

                        {isSelected && (
                          <Check className="w-4 h-4 text-blue-500 shrink-0" />
                        )}
                      </div>
                    );
                  })
                )}
              </div>
            )}
          </div>

          {/* BƯỚC 3: LOẠI HÌNH DỊCH VỤ & MÃ KỸ THUẬT VIÊN */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="block text-slate-700 dark:text-slate-300 mb-1.5 font-semibold">3. Loại hình Dịch vụ (Service Type) (*)</label>
              <select
                value={serviceType}
                onChange={(e) => setServiceType(e.target.value)}
                className="w-full px-3.5 py-2.5 rounded-xl bg-white dark:bg-slate-950 border border-slate-300 dark:border-slate-800 text-slate-900 dark:text-white focus:border-blue-500 focus:outline-none text-xs"
              >
                <option value="0">Bảo dưỡng định kỳ (Maintenance)</option>
                <option value="1">Sửa chữa kỹ thuật (Hardware Repair)</option>
                <option value="2">Thay thế linh kiện (Part Replacement)</option>
                <option value="3">Kiểm định & Hiệu chuẩn (Inspection)</option>
              </select>
            </div>

            <div>
              <label className="block text-slate-700 dark:text-slate-300 mb-1.5 font-semibold">Mã Kỹ thuật viên (Technician ID)</label>
              <input
                type="text"
                value={technicianId}
                onChange={(e) => setTechnicianId(e.target.value)}
                placeholder="VD: TECH-CHI-01"
                className="w-full px-3.5 py-2.5 rounded-xl bg-white dark:bg-slate-950 border border-slate-300 dark:border-slate-800 text-slate-900 dark:text-white font-mono focus:border-blue-500 focus:outline-none placeholder:text-slate-400 dark:placeholder:text-slate-500 text-xs"
              />
            </div>
          </div>

          {/* BƯỚC 4: MÃ LINH KIỆN THAY THẾ */}
          <div>
            <label className="block text-slate-700 dark:text-slate-300 mb-1.5 font-semibold">4. Mã linh kiện thay thế (nếu có)</label>
            <input
              type="text"
              value={replacedPart}
              onChange={(e) => setReplacedPart(e.target.value)}
              placeholder="VD: Cụm Pin Lithium Dell 86Wh (hoặc để trống nếu không thay thế)"
              className="w-full px-3.5 py-2.5 rounded-xl bg-white dark:bg-slate-950 border border-slate-300 dark:border-slate-800 text-slate-900 dark:text-white font-mono focus:border-blue-500 focus:outline-none placeholder:text-slate-400 dark:placeholder:text-slate-500 text-xs"
            />
          </div>

          {/* BƯỚC 5: GMAIL KHÁCH HÀNG (TỰ ĐỘNG GỬI BIÊN BẢN KHI HOÀN TẤT) */}
          <div className="space-y-1">
            <div className="flex items-center justify-between">
              <label className="text-slate-700 dark:text-slate-300 font-semibold flex items-center gap-1.5 text-xs">
                <Mail className="w-3.5 h-3.5 text-blue-500 dark:text-blue-400" />
                <span>5. Địa Chỉ Gmail Khách Hàng (Tự Động Gửi Biên Bản Khi Hoàn Tất)</span>
              </label>
              {emailAutoFilled && (
                <span className="text-[10px] px-2 py-0.5 rounded-full bg-emerald-500/20 text-emerald-700 dark:text-emerald-300 font-bold animate-pulse flex items-center gap-1 border border-emerald-500/30">
                  <Check className="w-3 h-3" />
                  Đã tự động điền từ tài khoản khách hàng!
                </span>
              )}
            </div>
            <div className="relative">
              <input
                type="email"
                value={customerEmail}
                onChange={(e) => {
                  setCustomerEmail(e.target.value);
                  setEmailAutoFilled(false);
                }}
                placeholder="VD: 42tuana2k46@gmail.com"
                className={`w-full px-3.5 py-2.5 rounded-xl bg-white dark:bg-slate-950 border text-slate-900 dark:text-white font-mono text-xs focus:outline-none transition-all duration-300 ${
                  emailAutoFilled
                    ? 'border-emerald-500 ring-2 ring-emerald-500/20 bg-emerald-50/20 dark:bg-emerald-950/20'
                    : 'border-slate-300 dark:border-slate-800 focus:border-blue-500'
                }`}
              />
            </div>
            <span className="text-[10px] text-slate-500 dark:text-slate-400 block mt-0.5">
              📧 Hệ thống sẽ gửi email biên bản hoàn tất sửa chữa kèm Tx Hash On-Chain và thông tin kỹ thuật viên.
            </span>
          </div>

          {/* BƯỚC 6: NỘI DUNG THAO TÁC KỸ THUẬT */}
          <div>
            <label className="block text-slate-700 dark:text-slate-300 mb-1.5 font-semibold">6. Nội dung thao tác kỹ thuật (*)</label>
            <textarea
              rows={3}
              required
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              placeholder="VD: Vệ sinh buồng tản nhiệt kim loại lỏng và thay thế cụm pin chính hãng định kỳ..."
              className="w-full px-3.5 py-2.5 rounded-xl bg-white dark:bg-slate-950 border border-slate-300 dark:border-slate-800 text-slate-900 dark:text-white focus:border-blue-500 focus:outline-none leading-relaxed placeholder:text-slate-400 dark:placeholder:text-slate-500 text-xs"
            />
          </div>

          {/* Nút Ký số MetaMask */}
          {!isMetaMaskConnected ? (
            <button
              type="button"
              onClick={onConnectMetaMask}
              className="w-full py-3.5 rounded-xl font-bold tracking-wide transition flex items-center justify-center gap-2 bg-gradient-to-r from-orange-500 to-amber-600 hover:from-orange-600 hover:to-amber-700 text-white shadow-lg shadow-orange-500/25 cursor-pointer active:scale-98 text-xs"
            >
              <Wallet className="w-4 h-4" />
              <span>🦊 Kết Nối Ví MetaMask Để Ký Biên Bản Dịch Vụ</span>
            </button>
          ) : (
            <button
              type="submit"
              disabled={loading}
              className="w-full py-3.5 rounded-xl bg-blue-600 hover:bg-blue-700 text-white font-bold tracking-wide transition flex items-center justify-center gap-2 shadow-lg shadow-blue-600/30 cursor-pointer disabled:opacity-50 text-xs"
            >
              {loading ? (
                <>
                  <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
                  <span>{txProgress?.message || 'Đang ghi sổ cái Smart Contract...'}</span>
                </>
              ) : (
                <>
                  <Wrench className="w-4 h-4" />
                  <span>Ký số & Lưu Biên Bản Dịch Vụ On-Chain (MetaMask)</span>
                </>
              )}
            </button>
          )}

        </form>
      </div>

      {/* ============================================================== */}
      {/* MODAL: SANG TÊN THIẾT BỊ / ĐỔI MÁY 1 ĐỔI 1                     */}
      {/* ============================================================== */}
      {showTransferModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/70 backdrop-blur-sm animate-fade-in">
          <div className="w-full max-w-lg glass-card rounded-3xl p-6 sm:p-7 border border-slate-200 dark:border-slate-800 shadow-2xl space-y-5 max-h-[90vh] overflow-y-auto">
            
            {/* Modal Header */}
            <div className="flex items-center justify-between pb-3 border-b border-slate-200 dark:border-slate-800">
              <div className="flex items-center gap-2.5">
                <div className="w-9 h-9 rounded-xl bg-purple-500/10 text-purple-600 dark:text-purple-400 flex items-center justify-center border border-purple-500/20">
                  <ArrowRightLeft className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="text-sm font-bold text-slate-900 dark:text-white">
                    Sang Tên Thiết Bị / Đổi Máy 1 Đổi 1
                  </h3>
                  <p className="text-[11px] text-slate-500">
                    Cập nhật quyền sở hữu thiết bị On-Chain qua Smart Contract
                  </p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setShowTransferModal(false)}
                className="p-1.5 rounded-xl text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800 transition cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            {/* Context Banner: RMA Ticket Info */}
            {transferTicket && (
              <div className="p-3 rounded-2xl bg-amber-500/10 border border-amber-500/20 text-xs space-y-1 text-amber-900 dark:text-amber-200">
                <div className="flex items-center justify-between font-mono font-bold text-[11px]">
                  <span>Phiếu RMA: {transferTicket.id}</span>
                  <span>Khách: {transferTicket.customerName}</span>
                </div>
                <div className="text-[11px] text-slate-600 dark:text-slate-300 italic line-clamp-1">
                  Lỗi: &quot;{transferTicket.defectDescription}&quot;
                </div>
              </div>
            )}

            {/* MetaMask Realtime Transaction Status */}
            {transferLoading && transferTxProgress && (
              <div className={`p-4 rounded-2xl border text-xs flex items-center gap-3 transition-all duration-300 ${
                transferTxProgress.step === 'CONFIRMED'
                  ? 'bg-emerald-500/15 border-emerald-500/40 text-emerald-800 dark:text-emerald-300'
                  : transferTxProgress.step === 'FAILED'
                  ? 'bg-rose-500/15 border-rose-500/40 text-rose-800 dark:text-rose-300'
                  : 'bg-purple-500/10 border-purple-500/30 text-purple-800 dark:text-purple-300 animate-pulse'
              }`}>
                <div className="w-5 h-5 rounded-full border-2 border-current border-t-transparent animate-spin shrink-0" />
                <div className="flex-1">
                  <div className="font-bold flex items-center gap-1.5 text-xs">
                    <span>🦊 MetaMask:</span>
                    <span>{transferTxProgress.message}</span>
                  </div>
                </div>
              </div>
            )}

            {transferError && (
              <div className="p-3 rounded-xl bg-rose-500/10 border border-rose-500/30 text-rose-600 dark:text-rose-400 text-xs flex items-center gap-2">
                <AlertTriangle className="w-4 h-4 shrink-0" />
                <span>{transferError}</span>
              </div>
            )}

            {transferSuccess && (
              <div className="p-4 rounded-2xl bg-emerald-500/10 border border-emerald-500/30 text-emerald-700 dark:text-emerald-400 text-xs space-y-2">
                <div className="flex items-center gap-2 font-bold text-sm">
                  <CheckCircle2 className="w-4 h-4" />
                  <span>Đã sang tên thiết bị thành công On-Chain!</span>
                </div>
                <div className="font-mono text-[11px] space-y-0.5">
                  <div>Serial: <strong>{transferSuccess.serial}</strong></div>
                  <div>Chủ mới: <strong>{transferSuccess.recipientName}</strong></div>
                  <div>Ví: <strong className="break-all">{transferSuccess.newOwner}</strong></div>
                </div>
              </div>
            )}

            {/* Transfer Form */}
            <form onSubmit={handleTransferOwnership} className="space-y-4 text-xs">
              
              {/* Số Serial thiết bị */}
              <div className="space-y-1">
                <label className="block text-slate-700 dark:text-slate-300 font-semibold">
                  Số Serial thiết bị cần sang tên <span className="text-rose-500">*</span>
                </label>
                <input
                  type="text"
                  required
                  value={transferSerial}
                  onChange={(e) => setTransferSerial(e.target.value)}
                  placeholder="Nhập số Serial..."
                  className="w-full px-3.5 py-2.5 rounded-xl bg-white dark:bg-slate-950 border border-slate-300 dark:border-slate-800 text-slate-900 dark:text-white font-mono focus:border-purple-500 focus:outline-none"
                />
              </div>

              {/* Lý do sang tên */}
              <div className="space-y-1">
                <label className="block text-slate-700 dark:text-slate-300 font-semibold">
                  Nghiệp vụ / Lý do sang tên
                </label>
                <select
                  value={transferReason}
                  onChange={(e) => setTransferReason(e.target.value)}
                  className="w-full px-3.5 py-2.5 rounded-xl bg-white dark:bg-slate-950 border border-slate-300 dark:border-slate-800 text-slate-900 dark:text-white focus:border-purple-500 focus:outline-none cursor-pointer"
                >
                  <option value="Đổi máy 1-đổi-1 do lỗi phần cứng">Đổi máy 1-đổi-1 do lỗi phần cứng (Device Swap)</option>
                  <option value="Khách hàng yêu cầu sang tên sau thẩm định">Khách hàng yêu cầu sang tên sau thẩm định / bảo dưỡng</option>
                  <option value="Cấp máy bảo hành thay thế tương đương">Cấp máy bảo hành thay thế tương đương</option>
                </select>
              </div>

              {/* Người nhận mới */}
              <div className="space-y-2">
                <label className="block text-slate-700 dark:text-slate-300 font-semibold">
                  Thông tin chủ sở hữu mới <span className="text-rose-500">*</span>
                </label>

                {/* Gợi ý nhanh */}
                <div className="flex flex-wrap gap-2">
                  {transferTicket?.customerPhone && (
                    <button
                      type="button"
                      onClick={() => setTransferIdentifier(transferTicket.customerPhone)}
                      className="px-2.5 py-1 rounded-lg text-[11px] font-semibold bg-blue-500/10 hover:bg-blue-500/20 text-blue-700 dark:text-blue-300 border border-blue-500/20 cursor-pointer"
                    >
                      <span>Khách hiện tại ({transferTicket.customerName})</span>
                    </button>
                  )}
                  <button
                    type="button"
                    onClick={() => setTransferIdentifier('dinhchi21102005@gmail.com')}
                    className="px-2.5 py-1 rounded-lg text-[11px] font-semibold bg-emerald-500/10 hover:bg-emerald-500/20 text-emerald-700 dark:text-emerald-300 border border-emerald-500/20 cursor-pointer"
                  >
                    <span>Khách hàng dinh chi</span>
                  </button>
                </div>

                <div className="relative">
                  <input
                    type="text"
                    required
                    placeholder="Nhập Số điện thoại, Email (@gmail.com) hoặc Địa chỉ ví (0x...)"
                    value={transferIdentifier}
                    onChange={(e) => setTransferIdentifier(e.target.value)}
                    className="w-full pl-3.5 pr-10 py-2.5 rounded-xl bg-white dark:bg-slate-950 border border-slate-300 dark:border-slate-800 text-slate-900 dark:text-white font-mono placeholder:font-sans placeholder:text-slate-400 focus:border-purple-500 focus:outline-none"
                  />
                  {isTransferResolving && (
                    <div className="absolute right-3.5 top-3 text-purple-500 animate-spin">
                      <RefreshCw className="w-4 h-4" />
                    </div>
                  )}
                </div>

                {transferResolveError && transferIdentifier.trim() && (
                  <div className="text-[11px] text-rose-500 flex items-center gap-1">
                    <AlertTriangle className="w-3 h-3" />
                    <span>{transferResolveError}</span>
                  </div>
                )}

                {transferResolvedWallet && (
                  <div className="p-3 rounded-xl bg-purple-500/10 border border-purple-500/20 text-xs space-y-1">
                    <div className="flex items-center justify-between font-bold text-slate-900 dark:text-white">
                      <span>{transferResolvedWallet.user?.fullName || 'Người nhận mới'}</span>
                      <span className="text-[10px] px-2 py-0.5 rounded bg-purple-500/20 text-purple-700 dark:text-purple-300 font-mono">
                        {transferResolvedWallet.user?.role || 'CUSTOMER'}
                      </span>
                    </div>
                    <div className="text-[11px] font-mono text-slate-600 dark:text-slate-400 truncate">
                      Ví: <strong className="text-purple-700 dark:text-purple-400">{transferResolvedWallet.walletAddress}</strong>
                    </div>
                  </div>
                )}
              </div>

              {/* Action buttons */}
              <div className="flex items-center justify-end gap-3 pt-3 border-t border-slate-200 dark:border-slate-800">
                <button
                  type="button"
                  onClick={() => setShowTransferModal(false)}
                  className="px-4 py-2.5 rounded-xl bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-300 font-bold transition cursor-pointer"
                >
                  Đóng
                </button>
                <button
                  type="submit"
                  disabled={transferLoading || !transferSerial || !transferResolvedWallet?.walletAddress}
                  className="px-5 py-2.5 rounded-xl bg-purple-600 hover:bg-purple-700 text-white font-bold transition shadow-lg shadow-purple-600/30 flex items-center gap-2 cursor-pointer disabled:opacity-50"
                >
                  {transferLoading ? (
                    <>
                      <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
                      <span>Đang ký MetaMask...</span>
                    </>
                  ) : (
                    <>
                      <ArrowRightLeft className="w-4 h-4" />
                      <span>Xác nhận Sang Tên (Ký MetaMask)</span>
                    </>
                  )}
                </button>
              </div>

            </form>

          </div>
        </div>
      )}

    </div>
  );
}
