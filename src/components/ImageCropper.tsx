import React, { useState, useEffect, useRef } from 'react';
import { RotateCw, Check, X, Move, Frame } from 'lucide-react';

interface ImageCropperProps {
  imageSrc: string;
  onCropComplete: (croppedBase64: string) => void;
  onCancel: () => void;
}

interface CropState {
  x: number; // percentage (0 - 100)
  y: number; // percentage (0 - 100)
  w: number; // percentage (0 - 100)
  h: number; // percentage (0 - 100)
}

export default function ImageCropper({ imageSrc, onCropComplete, onCancel }: ImageCropperProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const displayCanvasRef = useRef<HTMLCanvasElement>(null);
  const imgRef = useRef<HTMLImageElement | null>(null);

  // States
  const [rotation, setRotation] = useState<number>(0); // 0, 90, 180, 270
  const [crop, setCrop] = useState<CropState>({ x: 10, y: 10, w: 80, h: 80 });
  const [dragState, setDragState] = useState<{
    active: boolean;
    type: string;
    startX: number;
    startY: number;
    initialCrop: CropState;
  }>({
    active: false,
    type: '',
    startX: 0,
    startY: 0,
    initialCrop: { x: 10, y: 10, w: 80, h: 80 }
  });

  // Aspect Ratio Settings
  // 'free' bo'lganda foydalanuvchi xohlagan tomonini erkin cho'zib, qisqartira oladi.
  const [aspectMode, setAspectMode] = useState<'free' | '1:1' | '4:3' | '16:9'>('free');
  
  // "Cho'zish" - Agar yoqilgan bo'lsa, kesilgan qism qanday shaklda bo'lishidan qat'i nazar,
  // u ma'lum bir standart o'lchamga (masalan, 4:3 yoki kvadratga) proportsiyasini buzib (cho'zib/siqib) to'ldiriladi.
  const [distortAndStretch, setDistortAndStretch] = useState<boolean>(true);

  // Rasmni yuklash
  useEffect(() => {
    if (!imageSrc) return;
    
    const img = new Image();
    img.src = imageSrc;
    img.crossOrigin = 'anonymous';
    img.onload = () => {
      imgRef.current = img;
      setRotation(0);
      resetCropBox('free');
    };
  }, [imageSrc]);

  // Crop nisbatiga qarab crop qutisini qayta tiklash
  const resetCropBox = (mode: 'free' | '1:1' | '4:3' | '16:9') => {
    let w = 80;
    let h = 80;

    if (mode === '1:1') {
      w = 70;
      h = 70;
    } else if (mode === '4:3') {
      w = 80;
      h = 60; // 4:3 nisbati
    } else if (mode === '16:9') {
      w = 85;
      h = 47.8; // 16:9 nisbati
    }

    setCrop({
      x: (100 - w) / 2,
      y: (100 - h) / 2,
      w,
      h
    });
  };

  // Aspect o'zgarganda cropni moslash
  useEffect(() => {
    resetCropBox(aspectMode);
  }, [aspectMode]);

  // Rotated Canvasni chizuvchi effekt (Biz buni upright saqlashimiz uchun foydalanamiz)
  useEffect(() => {
    const img = imgRef.current;
    const canvas = displayCanvasRef.current;
    if (!img || !canvas) return;

    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const isRotatedOdd = (rotation / 90) % 2 !== 0;
    const canvasW = isRotatedOdd ? img.naturalHeight : img.naturalWidth;
    const canvasH = isRotatedOdd ? img.naturalWidth : img.naturalHeight;

    canvas.width = canvasW;
    canvas.height = canvasH;

    ctx.clearRect(0, 0, canvasW, canvasH);
    ctx.save();
    ctx.translate(canvasW / 2, canvasH / 2);
    ctx.rotate((rotation * Math.PI) / 180);
    ctx.drawImage(img, -img.naturalWidth / 2, -img.naturalHeight / 2);
    ctx.restore();
  }, [rotation, imgRef.current]);

  // Pointer Down hodisasi
  const handlePointerDown = (e: React.PointerEvent, type: string) => {
    e.preventDefault();
    if (!containerRef.current) return;

    const rect = containerRef.current.getBoundingClientRect();
    const px = ((e.clientX - rect.left) / rect.width) * 100;
    const py = ((e.clientY - rect.top) / rect.height) * 100;

    // Pointer capture faollashtirish (sichqoncha tashqariga chiqib ketsa ham ishlashi uchun)
    try {
      (e.target as HTMLElement).setPointerCapture(e.pointerId);
    } catch (err) {}

    setDragState({
      active: true,
      type,
      startX: px,
      startY: py,
      initialCrop: { ...crop }
    });
  };

  // Pointer Move hodisasi (8 nuqtada ishlash)
  const handlePointerMove = (e: React.PointerEvent) => {
    if (!dragState.active || !containerRef.current) return;
    e.preventDefault();

    const rect = containerRef.current.getBoundingClientRect();
    const px = ((e.clientX - rect.left) / rect.width) * 100;
    const py = ((e.clientY - rect.top) / rect.height) * 100;

    const dx = px - dragState.startX;
    const dy = py - dragState.startY;

    let { x, y, w, h } = dragState.initialCrop;
    const minSize = 5; // minimal size in % (kichikroq qila olish uchun 5% qildik)

    if (dragState.type === 'move') {
      x = Math.max(0, Math.min(100 - w, x + dx));
      y = Math.max(0, Math.min(100 - h, y + dy));
    } else {
      // 1. Tepa tomon (stretch/shrink top)
      if (dragState.type === 'top' || dragState.type.includes('top')) {
        const originalBottom = y + h;
        let newY = Math.max(0, Math.min(originalBottom - minSize, y + dy));
        let newH = originalBottom - newY;
        y = newY;
        h = newH;
      }
      
      // 2. Pastki tomon (stretch/shrink bottom)
      if (dragState.type === 'bottom' || dragState.type.includes('bottom')) {
        h = Math.max(minSize, Math.min(100 - y, h + dy));
      }
      
      // 3. Chap tomon (stretch/shrink left)
      if (dragState.type === 'left' || dragState.type.includes('left')) {
        const originalRight = x + w;
        let newX = Math.max(0, Math.min(originalRight - minSize, x + dx));
        let newW = originalRight - newX;
        x = newX;
        w = newW;
      }
      
      // 4. O'ng tomon (stretch/shrink right)
      if (dragState.type === 'right' || dragState.type.includes('right')) {
        w = Math.max(minSize, Math.min(100 - x, w + dx));
      }

      // Proportsiyalar bog'liq bo'lsa va aspectMode free bo'lmasa, moslashuv (Aspect ratio lock)
      if (aspectMode !== 'free') {
        const targetRatio = aspectMode === '1:1' ? 1 : aspectMode === '4:3' ? 4 / 3 : 16 / 9;
        const containerRatio = rect.width / rect.height;
        const targetPercentRatio = targetRatio / containerRatio;

        if (dragState.type.includes('right') || dragState.type.includes('bottom') || dragState.type === 'right' || dragState.type === 'bottom') {
          h = w / targetPercentRatio;
          if (y + h > 100) {
            h = 100 - y;
            w = h * targetPercentRatio;
          }
        } else if (dragState.type.includes('left') || dragState.type.includes('top') || dragState.type === 'left' || dragState.type === 'top') {
          w = h * targetPercentRatio;
          if (x + w > 100) {
            w = 100 - x;
            h = w / targetPercentRatio;
          }
        }
      }
    }

    setCrop({ x, y, w, h });
  };

  // Pointer Up
  const handlePointerUp = (e: React.PointerEvent) => {
    try {
      (e.target as HTMLElement).releasePointerCapture(e.pointerId);
    } catch (err) {}
    setDragState(prev => ({ ...prev, active: false }));
  };

  // Yakuniy kesish va saqlash
  const handleConfirm = () => {
    const img = imgRef.current;
    if (!img) return;

    const isRotatedOdd = (rotation / 90) % 2 !== 0;
    const rotatedW = isRotatedOdd ? img.naturalHeight : img.naturalWidth;
    const rotatedH = isRotatedOdd ? img.naturalWidth : img.naturalHeight;

    // Crop koordinatalarini piksellarga o'tkazamiz
    const drawX = (crop.x / 100) * rotatedW;
    const drawY = (crop.y / 100) * rotatedH;
    const drawW = (crop.w / 100) * rotatedW;
    const drawH = (crop.h / 100) * rotatedH;

    // Yangi yuqori sifatli kesilgan rasm uchun canvas
    const cropCanvas = document.createElement('canvas');
    
    // Agar foydalanuvchi "cho'zish/siqish orqali to'ldirish" ni yoqqan bo'lsa,
    // biz har qanday kesilgan shaklni standart 4:3 (800x600) proportsiyali o'lchamga cho'zamiz/siqamiz.
    // Agar o'chirilgan bo'lsa, rasm o'zining asl o'lchamida kesiladi (aspekt saqlanadi).
    if (distortAndStretch) {
      cropCanvas.width = 800;
      cropCanvas.height = 600;
    } else {
      cropCanvas.width = drawW;
      cropCanvas.height = drawH;
    }
    
    const ctx = cropCanvas.getContext('2d');
    if (!ctx) return;

    ctx.fillStyle = '#0f172a';
    ctx.fillRect(0, 0, cropCanvas.width, cropCanvas.height);

    ctx.save();
    
    if (distortAndStretch) {
      // 1. Agar proportsiyani buzib cho'zish yoqilgan bo'lsa:
      // Biz vaqtinchalik to'liq o'lchamli "rotated" canvas yaratib olamiz, u yerdan crop qismini olib, 
      // yangi canvasning 800x600 o'lchamiga erkin shaklda 'drawImage(tempCanvas, sx, sy, sw, sh, dx, dy, dw, dh)' orqali cho'zib joylashtiramiz.
      const tempCanvas = document.createElement('canvas');
      tempCanvas.width = rotatedW;
      tempCanvas.height = rotatedH;
      const tCtx = tempCanvas.getContext('2d');
      if (tCtx) {
        tCtx.save();
        tCtx.translate(rotatedW / 2, rotatedH / 2);
        tCtx.rotate((rotation * Math.PI) / 180);
        tCtx.drawImage(img, -img.naturalWidth / 2, -img.naturalHeight / 2);
        tCtx.restore();

        // Kesilgan qismni 800x600 ga cho'zib/siqib chizamiz (Hamma tomoni cho'ziladi!)
        ctx.drawImage(
          tempCanvas, 
          drawX, drawY, drawW, drawH, // Manba koordinatalari
          0, 0, 800, 600              // Mo'ljal (cho'ziluvchi/siqiluvchi o'lcham)
        );
      }
    } else {
      // 2. Oddiy proportsional kesish:
      ctx.translate(-drawX, -drawY);
      ctx.translate(rotatedW / 2, rotatedH / 2);
      ctx.rotate((rotation * Math.PI) / 180);
      ctx.drawImage(img, -img.naturalWidth / 2, -img.naturalHeight / 2, img.naturalWidth, img.naturalHeight);
    }
    
    ctx.restore();

    // Sifatli jpeg ko'rinishida saqlash
    const base64 = cropCanvas.toDataURL('image/jpeg', 0.9);
    onCropComplete(base64);
  };

  return (
    <div className="flex flex-col space-y-3 md:space-y-4">
      <div className="text-center">
        <p className="text-[10px] font-black text-indigo-400 uppercase tracking-widest flex items-center justify-center gap-1.5 mb-0.5 bg-indigo-500/10 py-1 px-3 rounded-full w-max mx-auto border border-indigo-500/20">
          <Move size={10} />
          Erkin Cho'zish va Qiyqish
        </p>
        <p className="text-[10px] text-slate-400 font-medium">Istalgan tomoni yoki burchagidan tortib o'lchamni o'zgartiring.</p>
      </div>

      {/* Rasm va Dynamic Crop Qutisi */}
      <div className="w-full flex justify-center items-center px-1">
        <div 
          ref={containerRef}
          className="relative select-none overflow-hidden rounded-2xl bg-slate-950 shadow-xl border border-white/10 max-w-[300px] md:max-w-md w-full aspect-[4/3] touch-none"
          onPointerMove={handlePointerMove}
        >
          {/* Asosiy upright tasvirlangan canvas */}
          <canvas 
            ref={displayCanvasRef}
            className="w-full h-full object-contain pointer-events-none"
          />

          {/* Qorong'ilashgan tashqi hududlar (Overlay Masks) */}
          <div className="absolute inset-0 pointer-events-none">
            {/* Top mask */}
            <div 
              className="absolute bg-slate-950/75 top-0 left-0 right-0"
              style={{ height: `${crop.y}%` }}
            />
            {/* Bottom mask */}
            <div 
              className="absolute bg-slate-950/75 left-0 right-0 bottom-0"
              style={{ top: `${crop.y + crop.h}%` }}
            />
            {/* Left mask */}
            <div 
              className="absolute bg-slate-950/75 left-0"
              style={{ top: `${crop.y}%`, height: `${crop.h}%`, width: `${crop.x}%` }}
            />
            {/* Right mask */}
            <div 
              className="absolute bg-slate-950/75 right-0"
              style={{ top: `${crop.y}%`, height: `${crop.h}%`, left: `${crop.x + crop.w}%` }}
            />
          </div>

          {/* Faol Crop Qutisi Chegarasi (8 nuqtalik interaktiv quti) */}
          <div 
            className="absolute border-2 border-indigo-400 active:border-indigo-300 shadow-[0_0_0_1px_rgba(255,255,255,0.2)]"
            style={{
              left: `${crop.x}%`,
              top: `${crop.y}%`,
              width: `${crop.w}%`,
              height: `${crop.h}%`,
            }}
          >
            {/* Ichki Rules of Thirds To'ri (Setka) */}
            <div className="absolute inset-0 grid grid-cols-3 grid-rows-3 pointer-events-none">
              <div className="border-r border-b border-white/15"></div>
              <div className="border-r border-b border-white/15"></div>
              <div className="border-b border-white/15"></div>
              <div className="border-r border-b border-white/15"></div>
              <div className="border-r border-b border-white/15"></div>
              <div className="border-b border-white/15"></div>
              <div className="border-r border-white/15"></div>
              <div className="border-r border-white/15"></div>
              <div></div>
            </div>

            {/* O'rtasidan Butunlay Surish Hududi */}
            <div 
              className="absolute inset-4 cursor-move flex items-center justify-center text-white/5 hover:text-indigo-400/20 transition-all select-none"
              onPointerDown={(e) => handlePointerDown(e, 'move')}
              onPointerUp={handlePointerUp}
              title="Surish"
            >
              <Move size={18} className="drop-shadow" />
            </div>

            {/* ====== TOMONLAR (SIЗИҚЛАР) ORQALI CHO'ZISH VA KICHRAYTIRISH (4 TA CHET) ====== */}
            {/* Tepadagi chet (Top Edge Handle) */}
            <div 
              className="absolute top-0 left-4 right-4 h-3 -translate-y-1.5 cursor-ns-resize flex items-center justify-center z-20 group"
              onPointerDown={(e) => handlePointerDown(e, 'top')}
              onPointerUp={handlePointerUp}
            >
              <div className="w-8 h-1 bg-indigo-400 rounded-full group-hover:bg-white border border-indigo-600 transition-colors shadow-sm" />
            </div>

            {/* Pastki chet (Bottom Edge Handle) */}
            <div 
              className="absolute bottom-0 left-4 right-4 h-3 translate-y-1.5 cursor-ns-resize flex items-center justify-center z-20 group"
              onPointerDown={(e) => handlePointerDown(e, 'bottom')}
              onPointerUp={handlePointerUp}
            >
              <div className="w-8 h-1 bg-indigo-400 rounded-full group-hover:bg-white border border-indigo-600 transition-colors shadow-sm" />
            </div>

            {/* Chap chet (Left Edge Handle) */}
            <div 
              className="absolute left-0 top-4 bottom-4 w-3 -translate-x-1.5 cursor-ew-resize flex items-center justify-center z-20 group"
              onPointerDown={(e) => handlePointerDown(e, 'left')}
              onPointerUp={handlePointerUp}
            >
              <div className="h-8 w-1 bg-indigo-400 rounded-full group-hover:bg-white border border-indigo-600 transition-colors shadow-sm" />
            </div>

            {/* O'ng chet (Right Edge Handle) */}
            <div 
              className="absolute right-0 top-4 bottom-4 w-3 translate-x-1.5 cursor-ew-resize flex items-center justify-center z-20 group"
              onPointerDown={(e) => handlePointerDown(e, 'right')}
              onPointerUp={handlePointerUp}
            >
              <div className="h-8 w-1 bg-indigo-400 rounded-full group-hover:bg-white border border-indigo-600 transition-colors shadow-sm" />
            </div>


            {/* ====== BURCHAKLAR ORQALI CHO'ZISH VA KICHRAYTIRISH (4 TA BURCHAK) ====== */}
            {/* Top-Left Corner */}
            <div 
              className="absolute -top-1.5 -left-1.5 w-6 h-6 cursor-nwse-resize z-30"
              onPointerDown={(e) => handlePointerDown(e, 'topLeft')}
              onPointerUp={handlePointerUp}
            >
              <div className="w-4 h-4 border-t-[3px] border-l-[3px] border-white drop-shadow-md rounded-tl-sm" />
            </div>

            {/* Top-Right Corner */}
            <div 
              className="absolute -top-1.5 -right-1.5 w-6 h-6 cursor-nesw-resize z-30 flex justify-end"
              onPointerDown={(e) => handlePointerDown(e, 'topRight')}
              onPointerUp={handlePointerUp}
            >
              <div className="w-4 h-4 border-t-[3px] border-r-[3px] border-white drop-shadow-md rounded-tr-sm" />
            </div>

            {/* Bottom-Left Corner */}
            <div 
              className="absolute -bottom-1.5 -left-1.5 w-6 h-6 cursor-nesw-resize z-30 flex items-end"
              onPointerDown={(e) => handlePointerDown(e, 'bottomLeft')}
              onPointerUp={handlePointerUp}
            >
              <div className="w-4 h-4 border-b-[3px] border-l-[3px] border-white drop-shadow-md rounded-bl-sm" />
            </div>

            {/* Bottom-Right Corner */}
            <div 
              className="absolute -bottom-1.5 -right-1.5 w-6 h-6 cursor-nwse-resize z-30 flex items-end justify-end"
              onPointerDown={(e) => handlePointerDown(e, 'bottomRight')}
              onPointerUp={handlePointerUp}
            >
              <div className="w-4 h-4 border-b-[3px] border-r-[3px] border-white drop-shadow-md rounded-br-sm" />
            </div>
          </div>
        </div>
      </div>

      {/* Tanlovlar, Proportsiyalarni boshqarish va "Cho'zish" rejimi */}
      <div className="bg-white/5 border border-white/10 rounded-2xl p-3 space-y-3 max-w-sm md:max-w-md mx-auto w-full">
        
        {/* Cho'zish/Siqish funksiyasi tugmasi */}
        <div className="flex items-start gap-2.5 bg-indigo-500/10 border border-indigo-500/20 p-2.5 rounded-xl">
          <input
            id="distort-check"
            type="checkbox"
            checked={distortAndStretch}
            onChange={(e) => setDistortAndStretch(e.target.checked)}
            className="w-4 h-4 text-indigo-600 bg-slate-900 border-white/20 rounded focus:ring-indigo-500 accent-indigo-500 mt-0.5 shrink-0"
          />
          <label htmlFor="distort-check" className="cursor-pointer select-none">
            <p className="text-[11px] font-black text-white uppercase tracking-wider mb-0.5">
              Rasm o'lchamini cho'zib to'ldirish
            </p>
            <p className="text-[9px] text-slate-300 leading-snug font-medium">
              Qirqish shakli qanday bo'lishidan qat'i nazar, rasm to'liq cho'zilib/siqilib standart katalog o'lchamiga joylashadi.
            </p>
          </label>
        </div>

        {/* Aspect Ratio tanlagich */}
        <div className="space-y-1.5">
          <p className="text-[9px] font-black text-slate-400 uppercase tracking-widest flex items-center gap-1">
            <Frame size={10} className="text-indigo-400" />
            Boshqaruv shakli / Format
          </p>
          <div className="grid grid-cols-4 gap-1.5">
            {[
              { id: 'free', label: 'Erkin' },
              { id: '4:3', label: '4:3 Katalog' },
              { id: '1:1', label: '1:1 Kvadrat' },
              { id: '16:9', label: '16:9 Keng' }
            ].map((opt) => (
              <button
                key={opt.id}
                type="button"
                onClick={() => setAspectMode(opt.id as any)}
                className={`py-1.5 px-0.5 rounded-lg text-[9px] font-black uppercase tracking-wider transition-all border ${
                  aspectMode === opt.id 
                    ? 'bg-indigo-600 text-white border-transparent shadow shadow-indigo-600/20' 
                    : 'bg-white/5 text-slate-400 border-white/5 hover:bg-white/10 hover:text-white'
                }`}
              >
                {opt.label}
              </button>
            ))}
          </div>
        </div>

        {/* Aylantirish va reset */}
        <div className="flex items-center justify-between pt-2 border-t border-white/5">
          <button
            type="button"
            onClick={() => setRotation((prev) => (prev + 90) % 360)}
            className="flex items-center gap-1.5 px-3 py-1.5 bg-white/10 hover:bg-white/15 text-white text-[10px] font-black uppercase tracking-wider rounded-lg transition-all"
          >
            <RotateCw size={11} className="text-indigo-400" />
            Aylantirish (90°)
          </button>
          
          <button
            type="button"
            onClick={() => {
              setRotation(0);
              setAspectMode('free');
              setDistortAndStretch(true);
              resetCropBox('free');
            }}
            className="text-[9px] font-black uppercase tracking-widest text-slate-400 hover:text-white transition-all"
          >
            Qayta tiklash
          </button>
        </div>
      </div>

      {/* Tasdiqlash va bekor qilish tugmalari */}
      <div className="flex gap-3 pt-3 border-t border-white/10">
        <button
          type="button"
          onClick={onCancel}
          className="flex-1 py-2.5 bg-white/5 hover:bg-white/10 text-slate-300 rounded-xl font-black text-[11px] uppercase tracking-wider transition-all border border-white/10 flex items-center justify-center gap-1.5"
        >
          <X size={14} />
          Bekor qilish
        </button>
        <button
          type="button"
          onClick={handleConfirm}
          className="flex-1 py-2.5 bg-indigo-600 hover:bg-indigo-500 text-white rounded-xl font-black text-[11px] uppercase tracking-wider transition-all shadow-lg shadow-indigo-600/20 flex items-center justify-center gap-1.5"
        >
          <Check size={14} strokeWidth={3} />
          Tayyor / Saqlash
        </button>
      </div>
    </div>
  );
}
