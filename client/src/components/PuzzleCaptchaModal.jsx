import React, { useState, useEffect, useRef } from 'react';
import { 
  X, 
  RotateCw, 
  ShieldCheck, 
  CheckCircle2, 
  AlertTriangle, 
  ArrowRight,
  Puzzle
} from 'lucide-react';

const CAPTCHA_IMAGES = [
  {
    url: 'https://images.unsplash.com/photo-1639762681485-074b7f938ba0?auto=format&fit=crop&w=600&q=80',
    title: 'Blockchain Cryptography'
  },
  {
    url: 'https://images.unsplash.com/photo-1518770660439-4636190af475?auto=format&fit=crop&w=600&q=80',
    title: 'Hardware & Microchips'
  },
  {
    url: 'https://images.unsplash.com/photo-1550751827-4bd374c3f58b?auto=format&fit=crop&w=600&q=80',
    title: 'Smart Contract Security'
  },
  {
    url: 'https://images.unsplash.com/photo-1526374965328-7f61d4dc18c5?auto=format&fit=crop&w=600&q=80',
    title: 'Decentralized Network'
  }
];

const CANVAS_WIDTH = 360;
const CANVAS_HEIGHT = 180;
const PIECE_SIZE = 48;
const TOLERANCE_PX = 6;

export default function PuzzleCaptchaModal({ isOpen, onClose, onSuccess }) {
  const [imageIndex, setImageIndex] = useState(0);
  const [targetX, setTargetX] = useState(180);
  const [targetY, setTargetY] = useState(60);
  const [sliderVal, setSliderVal] = useState(0); // 0 to 100%
  const [isDragging, setIsDragging] = useState(false);
  const [status, setStatus] = useState('idle'); // 'idle' | 'success' | 'fail'
  const [failCount, setFailCount] = useState(0);

  const trackRef = useRef(null);
  const dragStartXRef = useRef(0);
  const initialSliderRef = useRef(0);

  // Sinh vị trí ngẫu nhiên cho mảnh ghép
  const generateRandomTarget = (idx = null) => {
    const nextIdx = idx !== null ? idx : Math.floor(Math.random() * CAPTCHA_IMAGES.length);
    setImageIndex(nextIdx);
    
    // Target X: khoảng từ 130px đến 280px (đảm bảo phải kéo một khoảng đủ lớn)
    const newX = Math.floor(130 + Math.random() * 150);
    // Target Y: khoảng từ 25px đến 110px
    const newY = Math.floor(25 + Math.random() * 85);
    
    setTargetX(newX);
    setTargetY(newY);
    setSliderVal(0);
    setStatus('idle');
  };

  useEffect(() => {
    if (isOpen) {
      generateRandomTarget();
    }
  }, [isOpen]);

  if (!isOpen) return null;

  // Tính tọa độ X của mảnh ghép theo % slider (từ 0 đến CANVAS_WIDTH - PIECE_SIZE)
  const maxPieceX = CANVAS_WIDTH - PIECE_SIZE;
  const currentPieceX = (sliderVal / 100) * maxPieceX;

  // Xử lý kéo thả bằng chuột / cảm ứng
  const handleStart = (clientX) => {
    if (status === 'success') return;
    setIsDragging(true);
    setStatus('idle');
    dragStartXRef.current = clientX;
    initialSliderRef.current = sliderVal;
  };

  const handleMove = (clientX) => {
    if (!isDragging || !trackRef.current) return;
    const trackWidth = trackRef.current.clientWidth - 44; // trừ kích thước thumb
    const deltaX = clientX - dragStartXRef.current;
    const deltaPercent = (deltaX / trackWidth) * 100;
    
    let newPercent = Math.max(0, Math.min(100, initialSliderRef.current + deltaPercent));
    setSliderVal(newPercent);
  };

  const handleEnd = () => {
    if (!isDragging) return;
    setIsDragging(false);

    // Tính toán độ sai lệch giữa vị trí mảnh ghép và vị trí mục tiêu
    const diff = Math.abs(currentPieceX - targetX);

    if (diff <= TOLERANCE_PX) {
      // Thành công!
      setStatus('success');
      // Snap mảnh ghép vào đúng vị trí đích
      setSliderVal((targetX / maxPieceX) * 100);
      
      setTimeout(() => {
        onSuccess();
      }, 700);
    } else {
      // Thất bại
      setStatus('fail');
      setFailCount(prev => prev + 1);
      
      setTimeout(() => {
        // Tự động trả về vị trí ban đầu và đổi vị trí đích
        generateRandomTarget();
      }, 900);
    }
  };

  // Mouse Events
  const onMouseDown = (e) => handleStart(e.clientX);
  const onMouseMove = (e) => handleMove(e.clientX);
  const onMouseUp = () => handleEnd();

  // Touch Events (Mobile)
  const onTouchStart = (e) => {
    if (e.touches.length > 0) handleStart(e.touches[0].clientX);
  };
  const onTouchMove = (e) => {
    if (e.touches.length > 0) handleMove(e.touches[0].clientX);
  };
  const onTouchEnd = () => handleEnd();

  const currentImage = CAPTCHA_IMAGES[imageIndex];

  return (
    <div 
      className="fixed inset-0 z-[60] flex items-center justify-center p-4 bg-black/85 backdrop-blur-md animate-fade-in select-none"
      onMouseMove={onMouseMove}
      onMouseUp={onMouseUp}
      onTouchMove={onTouchMove}
      onTouchEnd={onTouchEnd}
    >
      <div className="relative w-full max-w-sm bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700/80 rounded-3xl p-5 shadow-2xl space-y-4 text-xs text-slate-900 dark:text-white">
        
        {/* Header */}
        <div className="flex items-center justify-between pb-1 border-b border-slate-200 dark:border-slate-800">
          <div className="flex items-center gap-2 font-bold text-slate-900 dark:text-white text-sm">
            <ShieldCheck className="w-4 h-4 text-blue-500 dark:text-blue-400" />
            <span>Xác Thực Bảo Mật (Anti-Bot)</span>
          </div>

          <div className="flex items-center gap-1">
            <button
              type="button"
              onClick={() => generateRandomTarget((imageIndex + 1) % CAPTCHA_IMAGES.length)}
              className="p-1.5 rounded-lg text-slate-400 hover:text-slate-700 dark:hover:text-white hover:bg-slate-100 dark:hover:bg-slate-800 transition cursor-pointer"
              title="Đổi hình ảnh & vị trí mới"
            >
              <RotateCw className="w-3.5 h-3.5" />
            </button>
            <button
              type="button"
              onClick={onClose}
              className="p-1.5 rounded-lg text-slate-400 hover:text-slate-700 dark:hover:text-white hover:bg-slate-100 dark:hover:bg-slate-800 transition cursor-pointer"
              title="Hủy xác thực"
            >
              <X className="w-4 h-4" />
            </button>
          </div>
        </div>

        <p className="text-slate-600 dark:text-slate-400 text-xs">
          Kéo thanh trượt bên dưới để ghép mảnh ghép vào đúng vị trí khuyết trên ảnh.
        </p>

        {/* Puzzle Image Canvas Area */}
        <div 
          className={`relative rounded-2xl overflow-hidden border transition-all duration-200 ${
            status === 'success' 
              ? 'border-emerald-500 shadow-lg shadow-emerald-500/20' 
              : status === 'fail' 
                ? 'border-rose-500 animate-wiggle shadow-lg shadow-rose-500/20' 
                : 'border-slate-300 dark:border-slate-700 shadow-inner'
          }`}
          style={{ width: `${CANVAS_WIDTH}px`, height: `${CANVAS_HEIGHT}px`, margin: '0 auto' }}
        >
          {/* Main Background Image */}
          <img 
            src={currentImage.url} 
            alt="Captcha background"
            className="w-full h-full object-cover pointer-events-none"
            draggable={false}
          />

          {/* Target Cutout Slot (Lỗ khuyết mục tiêu) */}
          <div 
            className="absolute rounded-xl border-2 border-dashed border-white/80 bg-slate-950/70 shadow-2xl pointer-events-none transition-transform"
            style={{
              left: `${targetX}px`,
              top: `${targetY}px`,
              width: `${PIECE_SIZE}px`,
              height: `${PIECE_SIZE}px`,
              boxShadow: 'inset 0 0 12px rgba(0, 0, 0, 0.9)',
            }}
          >
            <div className="w-full h-full flex items-center justify-center opacity-30 text-white">
              <Puzzle className="w-5 h-5" />
            </div>
          </div>

          {/* Sliding Puzzle Piece (Mảnh ghép di động) */}
          <div 
            className={`absolute rounded-xl overflow-hidden transition-shadow pointer-events-none ${
              status === 'success'
                ? 'border-2 border-emerald-400 shadow-lg shadow-emerald-400/50'
                : 'border-2 border-blue-400 shadow-2xl shadow-blue-500/50'
            }`}
            style={{
              left: `${currentPieceX}px`,
              top: `${targetY}px`,
              width: `${PIECE_SIZE}px`,
              height: `${PIECE_SIZE}px`,
              backgroundImage: `url(${currentImage.url})`,
              backgroundSize: `${CANVAS_WIDTH}px ${CANVAS_HEIGHT}px`,
              backgroundPosition: `-${targetX}px -${targetY}px`,
              zIndex: 20,
            }}
          />

          {/* Success Overlay Indicator */}
          {status === 'success' && (
            <div className="absolute inset-0 bg-emerald-950/40 backdrop-blur-xs flex items-center justify-center gap-2 text-emerald-300 font-bold text-sm animate-fade-in z-30">
              <CheckCircle2 className="w-6 h-6 text-emerald-400" />
              <span>Xác Thực Thành Công!</span>
            </div>
          )}

          {/* Fail Overlay Alert */}
          {status === 'fail' && (
            <div className="absolute inset-0 bg-rose-950/50 backdrop-blur-xs flex items-center justify-center gap-2 text-rose-300 font-bold text-xs animate-fade-in z-30">
              <AlertTriangle className="w-5 h-5 text-rose-400" />
              <span>Chưa khớp, vui lòng thử lại!</span>
            </div>
          )}

        </div>

        {/* Slider Track Area */}
        <div 
          ref={trackRef}
          className={`relative h-11 rounded-2xl border transition-colors flex items-center p-1 cursor-pointer overflow-hidden ${
            status === 'success'
              ? 'bg-emerald-50 dark:bg-emerald-950/40 border-emerald-500/50'
              : status === 'fail'
                ? 'bg-rose-50 dark:bg-rose-950/40 border-rose-500/50'
                : 'bg-slate-100 dark:bg-slate-950 border-slate-200 dark:border-slate-800'
          }`}
          onMouseDown={onMouseDown}
          onTouchStart={onTouchStart}
        >
          {/* Track Fill Progress Bar */}
          <div 
            className={`absolute left-0 top-0 bottom-0 transition-all ${
              status === 'success' 
                ? 'bg-emerald-500/30' 
                : status === 'fail' 
                  ? 'bg-rose-500/30' 
                  : 'bg-blue-600/25'
            }`}
            style={{ width: `${Math.max(sliderVal, 5)}%` }}
          />

          {/* Centered Guide Text */}
          <div className="absolute inset-0 flex items-center justify-center text-slate-500 text-[11px] font-semibold pointer-events-none">
            {status === 'success' ? (
              <span className="text-emerald-600 dark:text-emerald-400 flex items-center gap-1 font-bold">
                <CheckCircle2 className="w-3.5 h-3.5" /> Khớp hoàn hảo!
              </span>
            ) : status === 'fail' ? (
              <span className="text-rose-600 dark:text-rose-400 font-semibold">Sai vị trí, đang tải lại...</span>
            ) : sliderVal < 15 ? (
              <span>Kéo thanh trượt sang phải ➔</span>
            ) : null}
          </div>

          {/* Draggable Slider Thumb */}
          <div 
            className={`relative z-10 w-10 h-9 rounded-xl flex items-center justify-center shadow-lg transition-transform cursor-grab active:cursor-grabbing ${
              status === 'success'
                ? 'bg-emerald-500 text-white shadow-emerald-500/40'
                : status === 'fail'
                  ? 'bg-rose-500 text-white shadow-rose-500/40'
                  : isDragging
                    ? 'bg-blue-600 text-white scale-105 shadow-blue-500/40'
                    : 'bg-white dark:bg-slate-800 text-slate-700 dark:text-slate-200 hover:bg-slate-50 dark:hover:bg-slate-700 border border-slate-200 dark:border-slate-700'
            }`}
            style={{
              transform: `translateX(${(sliderVal / 100) * (CANVAS_WIDTH - 44 - 10)}px)`,
            }}
          >
            {status === 'success' ? (
              <CheckCircle2 className="w-4 h-4 text-white" />
            ) : status === 'fail' ? (
              <X className="w-4 h-4 text-white" />
            ) : (
              <ArrowRight className="w-4 h-4" />
            )}
          </div>

        </div>

      </div>
    </div>
  );
}
