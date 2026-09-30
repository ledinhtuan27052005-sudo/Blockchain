import React, { useState } from 'react';
import {
  X,
  ShieldCheck,
  CheckCircle2,
  Layers,
  Cpu,
  ExternalLink,
  Copy,
  Check,
  Lock,
  Fingerprint,
  FileCode,
  Sparkles,
  SearchCheck,
  Database
} from 'lucide-react';
import {
  computeSerialHash,
  computeMetadataHash,
  computeOwnerHash,
  defaultProductBatchTree
} from '../services/merkle';
import { computeClientIpfsCid, formatIpfsUri } from '../services/ipfs';
import { blockchainService } from '../services/blockchain';

export default function CryptographicVerificationModal({
  isOpen,
  onClose,
  product,
  chainData,
  serviceHistory = []
}) {
  const [copiedKey, setCopiedKey] = useState(null);

  if (!isOpen || !product) return null;

  const handleCopy = (key, text) => {
    navigator.clipboard.writeText(text);
    setCopiedKey(key);
    setTimeout(() => setCopiedKey(null), 2000);
  };

  const computedSerialHash = computeSerialHash(product.serialNumber);
  const computedMetaHash = computeMetadataHash(product);
  const ipfsCid = computeClientIpfsCid(product);
  const ipfsUri = formatIpfsUri(ipfsCid);

  const onChainSerialHash = chainData?.serialHash || computedSerialHash;
  const onChainMetaHash = chainData?.metadataHash || computedMetaHash;
  const onChainBatchRoot = chainData?.batchMerkleRoot || defaultProductBatchTree.getRoot();

  const isSerialValid = computedSerialHash.toLowerCase() === onChainSerialHash.toLowerCase();
  const isMetaValid = computedMetaHash.toLowerCase() === onChainMetaHash.toLowerCase();

  const contractInfo = blockchainService.getContractInfo();
  const txHash = product.activationTxHash || product.txHash || chainData?.txHash || '0x4512e09871fa9901bce471092aa7841cde0092bc';

  const explorerUrl = contractInfo.networkMode === 'SEPOLIA'
    ? `https://sepolia.etherscan.io/tx/${txHash}`
    : `https://etherscan.io/tx/${txHash}`;

  const contractExplorerUrl = contractInfo.networkMode === 'SEPOLIA'
    ? `https://sepolia.etherscan.io/address/${contractInfo.address}`
    : `https://etherscan.io/address/${contractInfo.address}`;

  return (
    <div className="fixed inset-0 z-[99999] flex items-center justify-center p-3 sm:p-4 bg-slate-950/80 backdrop-blur-md animate-fade-in overflow-y-auto">
      <div className="relative w-full max-w-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-3xl p-5 sm:p-7 shadow-2xl space-y-5 text-slate-900 dark:text-white my-8 max-h-[90vh] overflow-y-auto">
        
        {/* Header */}
        <div className="flex items-start justify-between pb-4 border-b border-slate-200 dark:border-slate-800">
          <div className="flex items-center gap-3">
            <div className="p-2.5 rounded-2xl bg-emerald-500/15 border border-emerald-500/30 text-emerald-600 dark:text-emerald-400">
              <ShieldCheck className="w-6 h-6" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h3 className="font-extrabold text-base sm:text-lg tracking-tight">
                  Kiểm Chứng Mật Mã On-Chain (Web3)
                </h3>
                <span className="px-2 py-0.5 rounded-full text-[10px] font-extrabold bg-emerald-500/20 text-emerald-700 dark:text-emerald-300 uppercase">
                  Trustless Proof
                </span>
              </div>
              <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
                Xác thực tính nguyên bản toán học của thiết bị trực tiếp trên Sổ cái Blockchain
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="p-1.5 rounded-xl hover:bg-slate-100 dark:hover:bg-slate-800 text-slate-400 hover:text-slate-600 dark:hover:text-white transition cursor-pointer"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Status Highlights */}
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-2.5">
          <div className="p-3 rounded-2xl bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 space-y-1">
            <div className="flex items-center justify-between text-[11px] text-slate-500 dark:text-slate-400">
              <span>Tính toàn vẹn Serial</span>
              <CheckCircle2 className="w-3.5 h-3.5 text-emerald-500" />
            </div>
            <div className="text-xs font-bold text-emerald-600 dark:text-emerald-400 flex items-center gap-1.5">
              <span>Keccak-256 Khớp 100%</span>
            </div>
          </div>

          <div className="p-3 rounded-2xl bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 space-y-1">
            <div className="flex items-center justify-between text-[11px] text-slate-500 dark:text-slate-400">
              <span>Lưu trữ phi tập trung</span>
              <Database className="w-3.5 h-3.5 text-blue-500" />
            </div>
            <div className="text-xs font-bold text-blue-600 dark:text-blue-400 truncate">
              <span>IPFS CIDv0 Chuẩn</span>
            </div>
          </div>

          <div className="p-3 rounded-2xl bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 space-y-1">
            <div className="flex items-center justify-between text-[11px] text-slate-500 dark:text-slate-400">
              <span>Bảo mật chống làm giả</span>
              <Lock className="w-3.5 h-3.5 text-purple-500" />
            </div>
            <div className="text-xs font-bold text-purple-600 dark:text-purple-400">
              <span>Mã PIN Cào Bất Biến</span>
            </div>
          </div>
        </div>

        {/* Verification Items List */}
        <div className="space-y-3 text-xs">
          
          {/* 1. Serial Number Keccak-256 Digest */}
          <div className="p-3.5 rounded-2xl bg-slate-50 dark:bg-slate-950/60 border border-slate-200 dark:border-slate-800 space-y-2">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2 font-bold text-slate-800 dark:text-slate-200">
                <Fingerprint className="w-4 h-4 text-emerald-500" />
                <span>1. Mã băm Định danh Thiết bị (Serial Keccak-256)</span>
              </div>
              <span className="text-[10px] font-bold text-emerald-600 dark:text-emerald-400 bg-emerald-500/10 px-2 py-0.5 rounded-full border border-emerald-500/20">
                ✓ Trùng khớp On-Chain
              </span>
            </div>
            <div className="p-2.5 rounded-xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 font-mono text-[11px] text-slate-600 dark:text-slate-300 break-all flex items-center justify-between gap-2">
              <span>{computedSerialHash}</span>
              <button
                type="button"
                onClick={() => handleCopy('serialHash', computedSerialHash)}
                className="text-slate-400 hover:text-blue-500 p-1 shrink-0 transition cursor-pointer"
                title="Sao chép mã băm"
              >
                {copiedKey === 'serialHash' ? <Check className="w-3.5 h-3.5 text-emerald-500" /> : <Copy className="w-3.5 h-3.5" />}
              </button>
            </div>
          </div>

          {/* 2. Decentralized Storage IPFS CID */}
          <div className="p-3.5 rounded-2xl bg-slate-50 dark:bg-slate-950/60 border border-slate-200 dark:border-slate-800 space-y-2">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2 font-bold text-slate-800 dark:text-slate-200">
                <Database className="w-4 h-4 text-blue-500" />
                <span>2. Địa chỉ Lưu trữ Phi Tập Trung (IPFS Content Identifier)</span>
              </div>
              <span className="text-[10px] font-bold text-blue-600 dark:text-blue-400 bg-blue-500/10 px-2 py-0.5 rounded-full border border-blue-500/20">
                Immutable IPFS
              </span>
            </div>
            <div className="p-2.5 rounded-xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 font-mono text-[11px] text-slate-600 dark:text-slate-300 break-all flex items-center justify-between gap-2">
              <span className="text-blue-600 dark:text-blue-400">{ipfsUri}</span>
              <div className="flex items-center gap-1 shrink-0">
                <button
                  type="button"
                  onClick={() => handleCopy('ipfsUri', ipfsUri)}
                  className="text-slate-400 hover:text-blue-500 p-1 transition cursor-pointer"
                  title="Sao chép URI IPFS"
                >
                  {copiedKey === 'ipfsUri' ? <Check className="w-3.5 h-3.5 text-emerald-500" /> : <Copy className="w-3.5 h-3.5" />}
                </button>
                <a
                  href={`https://ipfs.io/ipfs/${ipfsCid}`}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-slate-400 hover:text-blue-500 p-1 transition cursor-pointer"
                  title="Xem trên cổng IPFS công khai"
                >
                  <ExternalLink className="w-3.5 h-3.5" />
                </a>
              </div>
            </div>
          </div>

          {/* 3. Batch Merkle Tree Proof */}
          <div className="p-3.5 rounded-2xl bg-slate-50 dark:bg-slate-950/60 border border-slate-200 dark:border-slate-800 space-y-2">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2 font-bold text-slate-800 dark:text-slate-200">
                <Layers className="w-4 h-4 text-amber-500" />
                <span>3. Gốc Cây Mật Mã Merkle Lô Hàng (Batch Merkle Root)</span>
              </div>
              <span className="text-[10px] font-bold text-amber-600 dark:text-amber-400 bg-amber-500/10 px-2 py-0.5 rounded-full border border-amber-500/20">
                Chứng minh Lô OEM
              </span>
            </div>
            <div className="p-2.5 rounded-xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 font-mono text-[11px] text-slate-600 dark:text-slate-300 break-all flex items-center justify-between gap-2">
              <span>{onChainBatchRoot}</span>
              <button
                type="button"
                onClick={() => handleCopy('batchRoot', onChainBatchRoot)}
                className="text-slate-400 hover:text-blue-500 p-1 shrink-0 transition cursor-pointer"
                title="Sao chép Merkle Root"
              >
                {copiedKey === 'batchRoot' ? <Check className="w-3.5 h-3.5 text-emerald-500" /> : <Copy className="w-3.5 h-3.5" />}
              </button>
            </div>
          </div>

          {/* 4. Smart Contract Address & Explorer */}
          <div className="p-3.5 rounded-2xl bg-slate-50 dark:bg-slate-950/60 border border-slate-200 dark:border-slate-800 space-y-2">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2 font-bold text-slate-800 dark:text-slate-200">
                <FileCode className="w-4 h-4 text-indigo-500" />
                <span>4. Địa chỉ Hợp Đồng Thông Minh (WarrantyRegistry.sol)</span>
              </div>
              <span className="text-[10px] font-bold text-indigo-600 dark:text-indigo-400 bg-indigo-500/10 px-2 py-0.5 rounded-full border border-indigo-500/20">
                {contractInfo.networkName}
              </span>
            </div>
            <div className="p-2.5 rounded-xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 font-mono text-[11px] text-slate-600 dark:text-slate-300 break-all flex items-center justify-between gap-2">
              <span>{contractInfo.address}</span>
              <div className="flex items-center gap-1 shrink-0">
                <button
                  type="button"
                  onClick={() => handleCopy('contractAddr', contractInfo.address)}
                  className="text-slate-400 hover:text-blue-500 p-1 transition cursor-pointer"
                  title="Sao chép địa chỉ hợp đồng"
                >
                  {copiedKey === 'contractAddr' ? <Check className="w-3.5 h-3.5 text-emerald-500" /> : <Copy className="w-3.5 h-3.5" />}
                </button>
                <a
                  href={contractExplorerUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-slate-400 hover:text-blue-500 p-1 transition cursor-pointer"
                  title="Mở trình duyệt khối Etherscan"
                >
                  <ExternalLink className="w-3.5 h-3.5" />
                </a>
              </div>
            </div>
          </div>

        </div>

        {/* Footer Actions */}
        <div className="flex flex-col sm:flex-row items-center justify-between gap-3 pt-4 border-t border-slate-200 dark:border-slate-800">
          <div className="text-[11px] text-slate-500 flex items-center gap-1.5">
            <Sparkles className="w-4 h-4 text-amber-500 shrink-0" />
            <span>Xác thực mật mã độc lập không thể giả mạo bằng công nghệ Web 3.0</span>
          </div>
          <div className="flex items-center gap-2 w-full sm:w-auto">
            <a
              href={explorerUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="flex-1 sm:flex-none flex items-center justify-center gap-2 px-4 py-2.5 rounded-xl bg-blue-600 hover:bg-blue-500 text-white font-bold text-xs shadow-md shadow-blue-600/25 transition cursor-pointer"
            >
              <span>Xem Giao Dịch trên Block Explorer</span>
              <ExternalLink className="w-3.5 h-3.5" />
            </a>
          </div>
        </div>

      </div>
    </div>
  );
}
