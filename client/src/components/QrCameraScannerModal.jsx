import React, { useState, useEffect, useRef } from 'react';
import ReactDOM from 'react-dom';
import { Html5Qrcode } from 'html5-qrcode';
import { 
  Camera, 
  Upload, 
  X, 
  Sparkles, 
  AlertCircle, 
  CheckCircle2, 
  RefreshCw, 
  Flashlight,
  Image as ImageIcon
} from 'lucide-react';

/**
 * Phát âm thanh Beep nhẹ thông báo quét QR thành công bằng Web Audio API
 */
function playSuccessBeep() {
  try {
    const audioCtx = new (window.AudioContext || window.webkitAudioContext)();
    const osc = audioCtx.createOscillator();
    const gain = audioCtx.createGain();
    osc.type = 'sine';
    osc.frequency.setValueAtTime(880, audioCtx.currentTime); // Note A5
    gain.gain.setValueAtTime(0.15, audioCtx.currentTime);
    gain.gain.exponentialRampToValueAtTime(0.01, audioCtx.currentTime + 0.15);
    osc.connect(gain);
    gain.connect(audioCtx.destination);
    osc.start();
    osc.stop(audioCtx.currentTime + 0.15);
  } catch (e) {
    // Ignore audio context errors if blocked by browser policy
  }
}

/**
 * Phân tích và trích xuất số Serial từ nội dung quét được
 * (Hỗ trợ cả chuỗi Serial thô và URL có chứa tham số ?serial=...)
 */
export function extractSerialFromQrText(rawText) {
  if (!rawText) return '';
  const text = rawText.trim();

  // Kiểm tra nếu là URL chứa ?serial= hoặc &serial=
  if (text.includes('serial=')) {
    try {
      const url = new URL(text);
      const sn = url.searchParams.get('serial');
      if (sn) return sn.trim();
    } catch (e) {
      const match = text.match(/[?&]serial=([^&]+)/i);
      if (match && match[1]) {
        return decodeURIComponent(match[1]).trim();
      }
    }
  }

  // Nếu là chuỗi JSON
  if (text.startsWith('{') && text.endsWith('}')) {
    try {
      const parsed = JSON.parse(text);
      if (parsed.serialNumber) return String(parsed.serialNumber).trim();
      if (parsed.serial) return String(parsed.serial).trim();
    } catch (e) {
      // Not json
    }
  }

  return text;
}

export default function QrCameraScannerModal({ 
  isOpen, 
  onClose, 
  onScanSuccess, 
  title = 'Quét Mã QR Thiết Bị' 
}) {
  const [activeMode, setActiveMode] = useState('camera'); // 'camera' | 'upload'
  const [cameraError, setCameraError] = useState('');
  const [isScanning, setIsScanning] = useState(false);
  const [scannedResult, setScannedResult] = useState('');
  const [fileLoading, setFileLoading] = useState(false);

  const scannerRef = useRef(null);
  const readerElementId = 'trustwarranty-qr-reader';

  // Khởi động Camera khi modal mở và ở tab 'camera'
  useEffect(() => {
    if (!isOpen || activeMode !== 'camera') {
      stopCamera();
      return;
    }

    let isMounted = true;
    let html5QrCode = null;

    const startCamera = async () => {
      setCameraError('');
      setScannedResult('');

      try {
        // Đợi DOM render element
        await new Promise((resolve) => setTimeout(resolve, 150));
        const element = document.getElementById(readerElementId);
        if (!element || !isMounted) return;

        html5QrCode = new Html5Qrcode(readerElementId);
        scannerRef.current = html5QrCode;

        const config = {
          fps: 15,
          qrbox: (viewfinderWidth, viewfinderHeight) => {
            const minEdge = Math.min(viewfinderWidth, viewfinderHeight);
            const edgeSize = Math.floor(minEdge * 0.72);
            return { width: edgeSize, height: edgeSize };
          },
          aspectRatio: 1.0,
        };

        await html5QrCode.start(
          { facingMode: 'environment' }, // Ưu tiên camera sau
          config,
          (decodedText) => {
            if (!isMounted) return;
            handleDecoded(decodedText);
          },
          () => {
            // Frame error - ignore
          }
        );

        if (isMounted) {
          setIsScanning(true);
        }
      } catch (err) {
        console.warn('Lỗi bật camera:', err);
        if (isMounted) {
          setCameraError(
            err.name === 'NotAllowedError'
              ? 'Trình duyệt chưa được cấp quyền truy cập Camera. Vui lòng bật quyền Camera trong cài đặt trình duyệt hoặc sử dụng tab Tải Ảnh.'
              : `Không thể kết nối với Camera thiết bị (${err.message || 'Lỗi thiết bị'}). Bạn có thể chuyển sang tab Tải Ảnh QR.`
          );
          setIsScanning(false);
        }
      }
    };

    startCamera();

    return () => {
      isMounted = false;
      stopCamera();
    };
  }, [isOpen, activeMode]);

  const stopCamera = async () => {
    if (scannerRef.current) {
      try {
        if (scannerRef.current.isScanning) {
          await scannerRef.current.stop();
        }
        scannerRef.current.clear();
      } catch (e) {
        console.debug('Error stopping camera:', e);
      }
      scannerRef.current = null;
    }
    setIsScanning(false);
  };

  const handleDecoded = (rawText) => {
    const serial = extractSerialFromQrText(rawText);
    if (!serial) return;

    playSuccessBeep();
    setScannedResult(serial);
    stopCamera();

    // Delay 300ms để người dùng thấy feedback màu xanh lá rồi đóng modal
    setTimeout(() => {
      onScanSuccess(serial);
      onClose();
    }, 450);
  };

  // Quét từ tệp ảnh người dùng tải lên
  const handleFileUpload = async (e) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setFileLoading(true);
    setCameraError('');

    try {
      const html5QrCode = new Html5Qrcode('trustwarranty-file-reader-dummy');
      const decodedText = await html5QrCode.scanFile(file, true);
      html5QrCode.clear();
      handleDecoded(decodedText);
    } catch (err) {
      setCameraError('Không tìm thấy mã QR hợp lệ trong bức ảnh này. Vui lòng chọn ảnh chụp rõ nét hơn.');
    } finally {
      setFileLoading(false);
    }
  };

  if (!isOpen) return null;

  const modalContent = (
    <div className="fixed inset-0 z-[99999] flex items-center justify-center p-4 bg-slate-950/80 backdrop-blur-md animate-fade-in">
      <div className="relative w-full max-w-md bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-3xl p-5 sm:p-6 shadow-2xl space-y-5 text-slate-900 dark:text-white">
        
        {/* Header */}
        <div className="flex items-center justify-between border-b border-slate-100 dark:border-slate-800 pb-3">
          <div className="flex items-center gap-2 text-xs font-bold text-blue-600 dark:text-blue-400 uppercase tracking-wider">
            <Camera className="w-4 h-4" />
            <span>{title}</span>
          </div>

          <button
            type="button"
            onClick={onClose}
            className="p-1.5 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-500 hover:text-slate-900 dark:bg-slate-800 dark:text-slate-400 dark:hover:text-white transition cursor-pointer"
            title="Đóng cửa sổ quét"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Tab Switcher: Camera trực tiếp vs Tải ảnh */}
        <div className="flex p-1 rounded-2xl bg-slate-100 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 text-xs font-bold">
          <button
            type="button"
            onClick={() => setActiveMode('camera')}
            className={`flex-1 flex items-center justify-center gap-2 py-2 rounded-xl transition cursor-pointer ${
              activeMode === 'camera'
                ? 'bg-blue-600 text-white shadow-md shadow-blue-600/30'
                : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white'
            }`}
          >
            <Camera className="w-3.5 h-3.5" />
            <span>Camera trực tiếp</span>
          </button>

          <button
            type="button"
            onClick={() => setActiveMode('upload')}
            className={`flex-1 flex items-center justify-center gap-2 py-2 rounded-xl transition cursor-pointer ${
              activeMode === 'upload'
                ? 'bg-blue-600 text-white shadow-md shadow-blue-600/30'
                : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white'
            }`}
          >
            <Upload className="w-3.5 h-3.5" />
            <span>Tải ảnh từ máy</span>
          </button>
        </div>

        {/* Content Body */}
        {activeMode === 'camera' ? (
          <div className="space-y-4">
            {/* Viewfinder Video Frame */}
            <div className="relative w-full aspect-square max-h-[300px] rounded-2xl overflow-hidden bg-slate-950 border-2 border-slate-800 flex items-center justify-center shadow-inner">
              
              {/* Target div for Html5Qrcode video */}
              <div id={readerElementId} className="w-full h-full object-cover" />

              {/* Animated Laser Scanning Line & Reticle Overlay */}
              {isScanning && !scannedResult && (
                <div className="absolute inset-0 pointer-events-none flex flex-col items-center justify-center">
                  <div className="w-[72%] h-[72%] border-2 border-blue-400/80 rounded-2xl relative shadow-[0_0_20px_rgba(59,130,246,0.3)]">
                    {/* 4 Corners */}
                    <div className="absolute -top-1 -left-1 w-4 h-4 border-t-4 border-l-4 border-blue-500 rounded-tl-lg" />
                    <div className="absolute -top-1 -right-1 w-4 h-4 border-t-4 border-r-4 border-blue-500 rounded-tr-lg" />
                    <div className="absolute -bottom-1 -left-1 w-4 h-4 border-b-4 border-l-4 border-blue-500 rounded-bl-lg" />
                    <div className="absolute -bottom-1 -right-1 w-4 h-4 border-b-4 border-r-4 border-blue-500 rounded-br-lg" />

                    {/* Laser scanning beam */}
                    <div className="w-full h-0.5 bg-gradient-to-r from-transparent via-blue-400 to-transparent shadow-[0_0_12px_#3b82f6] animate-pulse relative top-1/2 -translate-y-1/2" />
                  </div>
                  <span className="text-[11px] font-medium text-slate-300 bg-slate-900/80 px-2.5 py-0.5 rounded-full mt-3 backdrop-blur-xs">
                    Đặt mã QR vào giữa khung ngắm
                  </span>
                </div>
              )}

              {/* Result Flash Feedback */}
              {scannedResult && (
                <div className="absolute inset-0 bg-emerald-950/90 flex flex-col items-center justify-center p-4 text-center text-white space-y-2 animate-fade-in z-20">
                  <CheckCircle2 className="w-12 h-12 text-emerald-400 animate-bounce" />
                  <div className="text-xs font-bold text-emerald-300 uppercase tracking-wider">Đã nhận diện thành công!</div>
                  <div className="font-mono font-bold text-sm bg-black/40 px-3 py-1.5 rounded-xl border border-emerald-500/30 text-white max-w-[90%] truncate">
                    {scannedResult}
                  </div>
                </div>
              )}
            </div>

            {/* Error Message */}
            {cameraError && (
              <div className="p-3 rounded-xl bg-amber-500/10 border border-amber-500/30 text-amber-700 dark:text-amber-300 text-xs flex items-start gap-2.5">
                <AlertCircle className="w-4 h-4 shrink-0 text-amber-500 mt-0.5" />
                <div className="flex-1">
                  <p>{cameraError}</p>
                  <button
                    type="button"
                    onClick={() => setActiveMode('upload')}
                    className="mt-2 text-[11px] font-bold text-blue-600 dark:text-blue-400 underline cursor-pointer"
                  >
                    Chuyển sang tải ảnh mã QR từ máy tính/điện thoại ➔
                  </button>
                </div>
              </div>
            )}
          </div>
        ) : (
          /* Upload Mode */
          <div className="space-y-4">
            <div className="border-2 border-dashed border-slate-300 dark:border-slate-700 hover:border-blue-500 dark:hover:border-blue-500 rounded-2xl p-8 text-center transition cursor-pointer relative bg-slate-50 dark:bg-slate-950/60">
              <input
                type="file"
                accept="image/*"
                onChange={handleFileUpload}
                disabled={fileLoading}
                className="absolute inset-0 w-full h-full opacity-0 cursor-pointer"
              />
              <div className="flex flex-col items-center justify-center space-y-2 pointer-events-none">
                <div className="w-12 h-12 rounded-2xl bg-blue-500/10 text-blue-600 dark:text-blue-400 flex items-center justify-center">
                  {fileLoading ? (
                    <RefreshCw className="w-6 h-6 animate-spin" />
                  ) : (
                    <ImageIcon className="w-6 h-6" />
                  )}
                </div>
                <div className="text-xs font-bold text-slate-800 dark:text-slate-200">
                  {fileLoading ? 'Đang phân tích mã QR...' : 'Chọn hoặc thả ảnh mã QR vào đây'}
                </div>
                <p className="text-[11px] text-slate-500 dark:text-slate-400">
                  Hỗ trợ định dạng PNG, JPG, JPEG từ album ảnh
                </p>
              </div>
            </div>

            {/* Hidden dummy element for file scanner */}
            <div id="trustwarranty-file-reader-dummy" className="hidden" />

            {cameraError && (
              <div className="p-3 rounded-xl bg-rose-500/10 border border-rose-500/30 text-rose-600 dark:text-rose-300 text-xs flex items-center gap-2">
                <AlertCircle className="w-4 h-4 shrink-0 text-rose-500" />
                <span>{cameraError}</span>
              </div>
            )}
          </div>
        )}

        {/* Footer tips */}
        <div className="text-[10px] text-center text-slate-400 dark:text-slate-500">
          Mã QR trên tem sản phẩm hoặc thẻ bảo hành được mã hóa tự động để đảm bảo tính xác thực.
        </div>

      </div>
    </div>
  );

  return typeof document !== 'undefined' ? ReactDOM.createPortal(modalContent, document.body) : null;
}
