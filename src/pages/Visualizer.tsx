import React, { useState, useRef, useEffect, useCallback } from 'react';
import { getDb } from '@/src/lib/api';
import { motion, AnimatePresence } from 'motion/react';
import { Camera, Upload, Trash2, Check, Crosshair, Scale, Sparkles, Loader2, X } from 'lucide-react';
import { cn } from '@/src/lib/utils';
import { GoogleGenAI } from "@google/genai";

interface Point {
  x: number;
  y: number;
}

interface Material {
  id: string;
  name: string;
  image: string;
  artikul: string;
  priceUSD: number;
  type: string;
}

interface WindowSection {
  id: string;
  points: Point[];
  width: string;
  height: string;
  material?: Material;
}

export default function Visualizer() {
  const [image, setImage] = useState<string | null>(null);
  const [windows, setWindows] = useState<WindowSection[]>([]);
  const [tempPoints, setTempPoints] = useState<Point[]>([]);
  const canvasRef = useRef<HTMLCanvasElement>(null);

  // Custom camera & file input refs
  const galleryInputRef = useRef<HTMLInputElement>(null);
  const cameraInputRef = useRef<HTMLInputElement>(null);
  const videoRef = useRef<HTMLVideoElement>(null);
  
  // Camera capture states
  const [isCameraOpen, setIsCameraOpen] = useState(false);
  const [cameraStream, setCameraStream] = useState<MediaStream | null>(null);
  const [cameraError, setCameraError] = useState<string | null>(null);

  const [activePoint, setActivePoint] = useState<{ winIdx: number, ptIdx: number } | null>(null);
  const [selectedMaterial, setSelectedMaterial] = useState<Material | null>(null);
  const [focusedWindowId, setFocusedWindowId] = useState<string | null>(null);
  const [materials, setMaterials] = useState<Material[]>([]);
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [isDragging, setIsDragging] = useState(false);
  const [loadedImages, setLoadedImages] = useState<Record<string, HTMLImageElement>>({});
  const [globalRate, setGlobalRate] = useState(12650);

  useEffect(() => {
    let active = true;
    const loadVisualizerData = async () => {
      try {
        const dbState = await getDb();
        if (!active) return;
        setGlobalRate(dbState.settings?.usdToUzs || 12650);
        setMaterials((dbState.materials || []) as Material[]);
      } catch (err) {
        console.error("Visualizer API load error:", err);
      }
    };
    loadVisualizerData();
    const interval = setInterval(loadVisualizerData, 5000);
    return () => {
      active = false;
      clearInterval(interval);
    };
  }, []);

  useEffect(() => {
    return () => {
      if (cameraStream) {
        cameraStream.getTracks().forEach(track => track.stop());
      }
    };
  }, [cameraStream]);

  const startCamera = async () => {
    setIsCameraOpen(true);
    setCameraError(null);
    try {
      let stream;
      try {
        // Try requesting rear-facing (environment) camera with ideal relaxed constraints
        stream = await navigator.mediaDevices.getUserMedia({
          video: { facingMode: { ideal: 'environment' }, width: { ideal: 1280 }, height: { ideal: 720 } }
        });
      } catch (firstErr) {
        console.warn("Could not access environment camera, trying default video fallback", firstErr);
        // Fallback to any available video input device (front camera, webcam, etc)
        stream = await navigator.mediaDevices.getUserMedia({
          video: true
        });
      }

      setCameraStream(stream);
      setTimeout(() => {
        if (videoRef.current) {
          videoRef.current.srcObject = stream;
        }
      }, 150);
    } catch (err: any) {
      console.error("Camera access error:", err);
      setCameraError("Kameraga ruxsat berilmadi yoki kamera topilmadi. Mobil qurilmada bo'lsangiz, quyidagi tugma orqali tizim kamerasidan foydalanishga harakat qiling.");
    }
  };

  const stopCamera = () => {
    if (cameraStream) {
      cameraStream.getTracks().forEach(track => track.stop());
      setCameraStream(null);
    }
    setIsCameraOpen(false);
  };

  const capturePhoto = () => {
    if (videoRef.current) {
      const video = videoRef.current;
      const canvas = document.createElement('canvas');
      canvas.width = video.videoWidth || 1280;
      canvas.height = video.videoHeight || 720;
      const ctx = canvas.getContext('2d');
      if (ctx) {
        ctx.drawImage(video, 0, 0, canvas.width, canvas.height);
        const dataUrl = canvas.toDataURL('image/jpeg', 0.85);
        setImage(dataUrl);
        setWindows([]);
        setTempPoints([]);
        loadImage(dataUrl);
        stopCamera();
      }
    }
  };

  // Jami kvadrat metr hisobi
  const totalM2 = windows.reduce((acc, win) => acc + (parseFloat(win.width) || 0) * (parseFloat(win.height) || 0), 0);

  const [loadErrors, setLoadErrors] = useState<Record<string, boolean>>({});

  const loadImage = useCallback((src: string) => {
    if (!src || loadErrors[src]) return Promise.reject("Invalid source or load failed");
    if (loadedImages[src]) return Promise.resolve(loadedImages[src]);
    return new Promise<HTMLImageElement>((resolve, reject) => {
      const img = new Image();
      img.crossOrigin = "Anonymous";
      img.src = src;
      img.onload = () => {
        setLoadedImages(prev => ({ ...prev, [src]: img }));
        resolve(img);
      };
      img.onerror = (e) => {
        setLoadErrors(prev => ({ ...prev, [src]: true }));
        reject(e);
      };
    });
  }, [loadedImages, loadErrors]);

  // Ensure selected material image is loaded
  useEffect(() => {
    if (selectedMaterial?.image && !loadedImages[selectedMaterial.image]) {
      loadImage(selectedMaterial.image).catch(err => console.error("Material image load error:", err));
    }
  }, [selectedMaterial?.image, loadedImages, loadImage]);

  const sortPoints = (pts: Point[]) => {
    if (pts.length !== 4) return pts;
    const center = pts.reduce((acc, p) => ({ x: acc.x + p.x / 4, y: acc.y + p.y / 4 }), { x: 0, y: 0 });
    return [...pts].sort((a, b) => {
      const angleA = Math.atan2(a.y - center.y, a.x - center.x);
      const angleB = Math.atan2(b.y - center.y, b.x - center.x);
      return angleA - angleB;
    });
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      const reader = new FileReader();
      reader.onload = (event) => {
        const src = event.target?.result as string;
        setImage(src);
        setWindows([]);
        setTempPoints([]);
        loadImage(src);
      };
      reader.readAsDataURL(file);
    }
  };

  // Automatically detect window corners
  useEffect(() => {
    if (image && windows.length === 0 && tempPoints.length === 0 && !isAnalyzing) {
      const timer = setTimeout(() => {
        detectWindowCorners();
      }, 800);
      return () => clearTimeout(timer);
    }
  }, [image]);

  const detectWindowCorners = async () => {
    if (!image) return;
    setIsAnalyzing(true);
    try {
      const response = await fetch('/api/detect-windows', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ image })
      });

      if (!response.ok) {
        const errData = await response.json();
        throw new Error(errData.error || 'Tahlil muvaffaqiyatsiz tugadi');
      }

      const parsed = await response.json();
      
      if (parsed.windows && parsed.windows.length > 0) {
        setWindows(parsed.windows.map((w: any) => ({
          id: Math.random().toString(36).substr(2, 9),
          points: w.points,
          width: (w.width || "1.0").toString(),
          height: (w.height || "1.0").toString(),
          material: selectedMaterial
        })));
      }
    } catch (error) {
      console.error("AI detection error:", error);
    } finally {
      setIsAnalyzing(false);
    }
  };

  const isPointInPoly = (points: Point[], x: number, y: number) => {
    let inside = false;
    for (let i = 0, j = points.length - 1; i < points.length; j = i++) {
      const xi = points[i].x, yi = points[i].y;
      const xj = points[j].x, yj = points[j].y;
      const intersect = ((yi > y) !== (yj > y)) && (x < (xj - xi) * (y - yi) / (yj - yi) + xi);
      if (intersect) inside = !inside;
    }
    return inside;
  };

  const handleMouseDown = (e: React.MouseEvent) => {
    if (!image) return;
    const rect = canvasRef.current?.getBoundingClientRect();
    if (!rect) return;
    
    const mouseX = ((e.clientX - rect.left) / rect.width) * 100;
    const mouseY = ((e.clientY - rect.top) / rect.height) * 100;

    // 1. Check points drag
    for (let i = 0; i < windows.length; i++) {
      const ptIdx = windows[i].points.findIndex(p => {
        const dist = Math.sqrt(Math.pow(p.x - mouseX, 2) + Math.pow(p.y - mouseY, 2));
        return dist < 3;
      });
      if (ptIdx !== -1) {
        setActivePoint({ winIdx: i, ptIdx });
        setFocusedWindowId(windows[i].id);
        setIsDragging(true);
        return;
      }
    }

    // 2. Check window selection (click inside)
    const clickedWin = [...windows].reverse().find(w => isPointInPoly(w.points, mouseX, mouseY));
    if (clickedWin) {
      setFocusedWindowId(clickedWin.id);
      return;
    } else {
      setFocusedWindowId(null);
    }

    // 3. Otherwise add to tempPoints
    if (tempPoints.length < 3) {
      setTempPoints([...tempPoints, { x: mouseX, y: mouseY }]);
    } else if (tempPoints.length === 3) {
      const newWin: WindowSection = {
        id: Math.random().toString(36).substr(2, 9),
        points: [...tempPoints, { x: mouseX, y: mouseY }],
        width: "1.0",
        height: "1.0",
        material: selectedMaterial
      };
      setWindows([...windows, newWin]);
      setTempPoints([]);
      setFocusedWindowId(newWin.id);
    }
  };

  const handleMouseMove = (e: React.MouseEvent) => {
    if (!isDragging || !activePoint) return;
    const rect = canvasRef.current?.getBoundingClientRect();
    if (!rect) return;

    const x = ((e.clientX - rect.left) / rect.width) * 100;
    const y = ((e.clientY - rect.top) / rect.height) * 100;

    const newWindows = [...windows];
    newWindows[activePoint.winIdx].points[activePoint.ptIdx] = { x, y };
    setWindows(newWindows);
  };

  const handleMouseUp = () => {
    setIsDragging(false);
    setActivePoint(null);
  };

    const handleMaterialSelect = (mat: Material) => {
      setSelectedMaterial(mat);
      if (focusedWindowId) {
        setWindows(prev => prev.map(w => w.id === focusedWindowId ? { ...w, material: mat } : w));
      } else {
        setWindows(prev => prev.map(w => ({ ...w, material: mat })));
      }
    };

  const drawPoints = useCallback(() => {
    const canvas = canvasRef.current;
    if (!canvas || !image) return;
    const ctx = canvas.getContext('2d', { willReadFrequently: true });
    if (!ctx) return;

    const img = loadedImages[image];
    if (!img) { 
      loadImage(image).catch(err => console.error("Image load error:", err));
      return; 
    }

    canvas.width = img.naturalWidth;
    canvas.height = img.naturalHeight;
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    ctx.drawImage(img, 0, 0);

    const texImg = selectedMaterial?.image ? loadedImages[selectedMaterial.image] : null;

    windows.forEach((win, idx) => {
      if (!win.points || win.points.length < 3) return;
      
      const isFocused = win.id === focusedWindowId;
      const centerX = win.points.reduce((acc, p) => acc + p.x, 0) / win.points.length;
      const centerY = win.points.reduce((acc, p) => acc + p.y, 0) / win.points.length;
      const cpx = (centerX / 100) * canvas.width;
      const cpy = (centerY / 100) * canvas.height;

      const winMat = win.material || selectedMaterial;
      const winTexImg = winMat?.image ? loadedImages[winMat.image] : null;

      // Draw Texture if exists
      if (winTexImg && winTexImg.width > 0) {
        ctx.save();
        ctx.beginPath();
        const sorted = sortPoints(win.points);
        sorted.forEach((p, i) => {
          const px = (p.x / 100) * canvas.width;
          const py = (p.y / 100) * canvas.height;
          if (i === 0) ctx.moveTo(px, py);
          else ctx.lineTo(px, py);
        });
        ctx.closePath();
        ctx.clip();
        
        const minX = Math.min(...win.points.map(p => p.x)) * canvas.width / 100;
        const minY = Math.min(...win.points.map(p => p.y)) * canvas.height / 100;
        const maxX = Math.max(...win.points.map(p => p.x)) * canvas.width / 100;
        const maxY = Math.max(...win.points.map(p => p.y)) * canvas.height / 100;
        const winW = Math.max(1, maxX - minX);
        const winH = Math.max(1, maxY - minY);

        try {
          const pattern = ctx.createPattern(winTexImg, 'repeat');
          if (pattern && winTexImg.width > 0 && winTexImg.height > 0) {
            const matrix = new DOMMatrix();
            const scaleX = winW / winTexImg.width;
            const scaleY = winH / winTexImg.height;
            
            if (isFinite(scaleX) && isFinite(scaleY)) {
              matrix.translateSelf(minX, minY);
              matrix.scaleSelf(scaleX, scaleY);
              pattern.setTransform(matrix);
              
              // Layer 1: Base texture 
              ctx.fillStyle = pattern;
              ctx.globalAlpha = 1.0; 
              ctx.fill(); 
              
              // Layer 2: Fold shadows (Subtle multipliers)
              const foldGradient = ctx.createLinearGradient(minX, 0, maxX, 0);
              const foldCount = Math.max(4, Math.floor(winW / (canvas.width * 0.08))); 
              for (let i = 0; i < foldCount; i++) {
                const s1 = i / foldCount;
                const s2 = (i + 0.5) / foldCount;
                const s3 = (i + 1) / foldCount;
                
                foldGradient.addColorStop(s1, 'rgba(0,0,0,0.22)'); 
                foldGradient.addColorStop(s2, 'rgba(255,255,255,0.08)'); 
                if (i === foldCount - 1) {
                   foldGradient.addColorStop(s3, 'rgba(0,0,0,0.22)');
                }
              }
              
              ctx.globalCompositeOperation = 'multiply';
              ctx.fillStyle = foldGradient;
              ctx.fill();

              // Layer 3: Vignette for depth
              const vignette = ctx.createRadialGradient(cpx, cpy, 0, cpx, cpy, Math.max(winW, winH) / 1.2);
              vignette.addColorStop(0, 'rgba(0,0,0,0)');
              vignette.addColorStop(0.7, 'rgba(0,0,0,0.1)');
              vignette.addColorStop(1, 'rgba(0,0,0,0.25)');
              ctx.globalCompositeOperation = 'source-over';
              ctx.fillStyle = vignette;
              ctx.fill();
            }
          }
        } catch (e) {
          console.error("Pattern rendering error:", e);
        }
        ctx.restore();
      }

      // Draw Overlay for this window
      ctx.save();
      ctx.beginPath();
      ctx.strokeStyle = isFocused ? '#fbbf24' : '#6366f1';
      ctx.lineWidth = isFocused ? Math.max(4, canvas.width * 0.005) : Math.max(2, canvas.width * 0.003);
      const sorted = sortPoints(win.points);
      sorted.forEach((p, i) => {
        const px = (p.x / 100) * canvas.width;
        const py = (p.y / 100) * canvas.height;
        if (i === 0) ctx.moveTo(px, py);
        else ctx.lineTo(px, py);
      });
      ctx.closePath();
      ctx.stroke();
      
      // Draw point handles
      sorted.forEach((p, i) => {
        const px = (p.x / 100) * canvas.width;
        const py = (p.y / 100) * canvas.height;
        ctx.beginPath();
        ctx.fillStyle = '#6366f1';
        ctx.arc(px, py, canvas.width * 0.008, 0, Math.PI * 2);
        ctx.fill();
        ctx.strokeStyle = '#fff';
        ctx.lineWidth = 2;
        ctx.stroke();
      });

      // Draw Window Index Label
      ctx.beginPath();
      ctx.fillStyle = '#6366f1';
      const r = canvas.width * 0.02;
      // Fallback for roundRect
      if (ctx.roundRect) {
        ctx.roundRect(cpx - r, cpy - r, r*2, r*2, 8);
      } else {
        ctx.rect(cpx - r, cpy - r, r*2, r*2);
      }
      ctx.fill();
      
      ctx.fillStyle = '#fff';
      ctx.font = `bold ${canvas.width * 0.02}px sans-serif`;
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.fillText(`#${idx + 1}`, cpx, cpy);
      
      ctx.restore();
    });

    // Draw tempPoints
    if (tempPoints.length > 0) {
      tempPoints.forEach(p => {
        const px = (p.x / 100) * canvas.width;
        const py = (p.y / 100) * canvas.height;
        ctx.beginPath();
        ctx.fillStyle = '#ef4444';
        ctx.arc(px, py, canvas.width * 0.008, 0, Math.PI * 2);
        ctx.fill();
      });
    }
  }, [windows, tempPoints, image, selectedMaterial, loadedImages, loadImage]);

  useEffect(() => {
    drawPoints();
  }, [drawPoints]);

  return (
    <div className="min-h-full w-full flex flex-col liquid-bg">
      <div className="flex-1 grid grid-cols-1 lg:grid-cols-12 gap-4 sm:gap-6 p-3 sm:p-6 lg:p-10 lg:max-h-[calc(100vh-14rem)] lg:min-h-0">
        
        {/* Visualizer Area */}
        <section className="lg:col-span-8 glass rounded-2xl sm:rounded-[3rem] relative overflow-hidden group min-h-[350px] sm:min-h-[500px] lg:h-full lg:min-h-0 shadow-2xl animate-in fade-in zoom-in-95 duration-1000">
          {!image ? (
            <div className="absolute inset-0 flex flex-col items-center justify-center p-4 sm:p-6 lg:p-10 text-center bg-transparent">
              <motion.div 
                animate={{ y: [0, -10, 0] }}
                transition={{ duration: 4, repeat: Infinity, ease: 'easeInOut' }}
                className="p-6 sm:p-8 bg-indigo-600 shadow-2xl shadow-indigo-200 rounded-[1.75rem] sm:rounded-[2.5rem] mb-4 sm:mb-6 text-white rotate-3"
              >
                <Camera size={36} strokeWidth={2.5} />
              </motion.div>
              
              <h2 className="text-xl sm:text-2xl lg:text-4xl font-black text-slate-900 tracking-tight">Smart Vizualizator</h2>
              <p className="text-slate-500 mt-2 sm:mt-3 max-w-sm mx-auto text-xs sm:text-sm font-semibold leading-relaxed">
                Interyeringiz suratini yuklang va sun'iy intellekt yordamida matolarni sinab ko'ring.
              </p>

              <div className="mt-8 grid grid-cols-1 sm:grid-cols-2 gap-4 w-full max-w-md px-4">
                {/* 1. Gallery Choosing Button */}
                <button 
                  type="button"
                  onClick={() => galleryInputRef.current?.click()}
                  className="flex flex-col items-center justify-center p-6 bg-white hover:bg-indigo-50/50 border border-slate-200 hover:border-indigo-400 rounded-3xl shadow-sm hover:shadow-lg transition-all group/btn cursor-pointer active:scale-95"
                >
                  <div className="p-3 bg-indigo-50 text-indigo-600 rounded-xl group-hover/btn:scale-110 group-hover/btn:bg-indigo-600 group-hover/btn:text-white transition-all mb-3 shadow-inner">
                    <Upload size={20} />
                  </div>
                  <span className="text-sm font-black text-slate-800">Galereyaga kirish</span>
                  <span className="text-[10px] text-slate-400 font-bold mt-1 uppercase tracking-tight">Mavjud rasm tanlash</span>
                </button>

                {/* 2. Direct Camera Trigger Button */}
                <button 
                  type="button"
                  onClick={startCamera}
                  className="flex flex-col items-center justify-center p-6 bg-white hover:bg-indigo-50/50 border border-slate-200 hover:border-indigo-400 rounded-3xl shadow-sm hover:shadow-lg transition-all group/btn cursor-pointer active:scale-95"
                >
                  <div className="p-3 bg-indigo-50 text-indigo-600 rounded-xl group-hover/btn:scale-110 group-hover/btn:bg-indigo-600 group-hover/btn:text-white transition-all mb-3 shadow-inner">
                    <Camera size={20} />
                  </div>
                  <span className="text-sm font-black text-slate-800">Rasmga olish</span>
                  <span className="text-[10px] text-slate-400 font-bold mt-1 uppercase tracking-tight">Kamera orqali</span>
                </button>
              </div>

              {/* Hidden file inputs */}
              <input 
                type="file" 
                ref={galleryInputRef} 
                className="hidden" 
                accept="image/*" 
                onChange={handleFileChange} 
              />
              <input 
                type="file" 
                ref={cameraInputRef} 
                className="hidden" 
                accept="image/*" 
                capture="environment" 
                onChange={handleFileChange} 
              />
            </div>
          ) : (
            <div className="absolute inset-0 bg-slate-900/10 flex items-center justify-center select-none">
              <div className="relative w-full h-full flex flex-col items-center overflow-y-auto p-4 scrollbar-thin">
                <canvas 
                  ref={canvasRef}
                  onMouseDown={handleMouseDown}
                  onMouseMove={handleMouseMove}
                  onMouseUp={handleMouseUp}
                  onMouseLeave={handleMouseUp}
                  className="max-w-[95%] max-h-none object-contain cursor-crosshair touch-none shadow-2xl rounded-2xl my-auto block flex-shrink-0"
                />
              </div>
              
              <div className="absolute top-8 right-8 flex flex-col gap-3 z-30">
                 <button 
                  onClick={() => { setImage(null); setWindows([]); setTempPoints([]); setSelectedMaterial(null); }}
                  className="w-14 h-14 glass flex items-center justify-center text-red-500 rounded-2xl hover:bg-white transition-all shadow-xl active:scale-90"
                  title="Yangilash"
                >
                  <Trash2 size={24} />
                </button>
              </div>

              <div className="absolute bottom-10 left-1/2 -translate-x-1/2 flex flex-col sm:flex-row gap-4 glass p-3 rounded-[2rem] shadow-2xl z-20">
                {!isAnalyzing && (
                  <button 
                    onClick={detectWindowCorners}
                    className="px-8 py-4 bg-indigo-600 text-white rounded-2xl text-[11px] font-black uppercase tracking-widest flex items-center gap-3 hover:bg-indigo-500 transition-all shadow-xl shadow-indigo-200"
                  >
                    <Sparkles size={18} /> AI Tahlil
                  </button>
                )}
                
                {isAnalyzing && (
                  <div className="px-8 py-4 bg-white text-indigo-600 rounded-2xl text-[11px] font-black uppercase tracking-widest flex items-center gap-3 shadow-xl">
                    <Loader2 size={18} className="animate-spin" /> Qidirilmoqda...
                  </div>
                )}

                {windows.length > 0 && !isAnalyzing && (
                  <button 
                    onClick={() => { setWindows([]); setTempPoints([]); }}
                    className="px-8 py-4 bg-white text-slate-900 rounded-2xl text-[11px] font-black uppercase tracking-widest hover:bg-slate-50 transition-all shadow-xl"
                  >
                    Tozalash
                  </button>
                )}
              </div>
            </div>
          )}
        </section>

        {/* Control Panel Area */}
        <section className="lg:col-span-4 flex flex-col gap-6 lg:h-full lg:overflow-y-auto pb-6 pr-1 scrollbar-thin animate-in fade-in slide-in-from-right duration-1000">
          
          {/* Material Selection */}
          <div className="glass rounded-[2.5rem] p-8 flex flex-col min-h-0">
            <h3 className="text-xs font-black text-slate-400 uppercase tracking-widest mb-8 flex items-center justify-between">
              <span className="flex items-center gap-2"><Sparkles size={16} className="text-indigo-500" /> Katalog</span>
              <span className="text-[10px] bg-indigo-50 text-indigo-600 px-3 py-1 rounded-full">{materials.length} tur</span>
            </h3>
            
            <div className="flex-1 overflow-y-auto scrollbar-hide pr-1">
              {materials.length === 0 ? (
                <div className="p-10 text-center bg-white/40 rounded-3xl border border-dashed border-slate-200">
                  <p className="text-xs text-slate-400 font-black uppercase tracking-widest leading-loose">
                    Katalog bo'sh
                  </p>
                </div>
              ) : (
                <div className="grid grid-cols-2 gap-4">
                  {materials.map((mat) => (
                    <motion.button 
                      whileHover={{ scale: 1.05 }}
                      whileTap={{ scale: 0.95 }}
                      key={mat.id}
                      onClick={() => handleMaterialSelect(mat)}
                      className={cn(
                        "aspect-[3/4] rounded-3xl cursor-pointer transition-all overflow-hidden border-4 relative group",
                        selectedMaterial?.id === mat.id 
                          ? "border-indigo-600 shadow-2xl shadow-indigo-200" 
                          : "border-transparent bg-white/40 hover:border-white/80 shadow-sm"
                      )}
                    >
                      <img src={mat.image} className="w-full h-full object-cover transform group-hover:scale-110 transition-transform duration-700" />
                      <div className="absolute inset-x-4 bottom-4 glass-dark p-3 rounded-2xl backdrop-blur-md">
                         <p className="text-[10px] text-white font-black truncate leading-none uppercase tracking-tight">{mat.name}</p>
                         <p className="text-[8px] text-slate-400 mt-1 uppercase tracking-widest font-bold">${mat.priceUSD || 0}/m²</p>
                      </div>
                      {selectedMaterial?.id === mat.id && (
                        <div className="absolute top-4 right-4 flex items-center justify-center">
                          <motion.div 
                            initial={{ scale: 0 }}
                            animate={{ scale: 1 }}
                            className="bg-indigo-600 text-white rounded-full p-1.5 shadow-xl"
                          >
                            <Check size={16} strokeWidth={4} />
                          </motion.div>
                        </div>
                      )}
                    </motion.button>
                  ))}
                </div>
              )}
            </div>
          </div>

          {/* Configuration & Price */}
          <div className="space-y-6">
            {/* Window Stats */}
            <div className="glass rounded-[2.5rem] p-8">
               <h3 className="text-xs font-black text-slate-400 uppercase tracking-widest mb-6 flex items-center gap-2">
                <Scale size={16} className="text-indigo-500" /> O'lchamlar ({windows.length})
              </h3>
              
              <div className="space-y-4 max-h-[300px] overflow-y-auto scrollbar-hide">
                {windows.map((win, idx) => (
                  <motion.div 
                    initial={{ opacity: 0, x: 20 }}
                    animate={{ opacity: 1, x: 0 }}
                    key={win.id} 
                    onClick={() => setFocusedWindowId(win.id)}
                    className={cn(
                      "p-6 rounded-3xl border transition-all relative group cursor-pointer",
                      focusedWindowId === win.id 
                        ? "bg-white border-indigo-200 shadow-2xl shadow-indigo-100 ring-2 ring-indigo-100" 
                        : "bg-white/40 border-white/60 hover:bg-white/60"
                    )}
                  >
                    <div className="flex items-center justify-between mb-4">
                       <span className="text-[10px] font-black uppercase tracking-widest text-slate-900">Oyna #{idx + 1}</span>
                       <button 
                         onClick={(e) => { e.stopPropagation(); setWindows(windows.filter(w => w.id !== win.id)); }}
                         className="p-2 text-slate-300 hover:text-red-500 transition-colors bg-white rounded-xl"
                       >
                         <Trash2 size={16} />
                       </button>
                    </div>
                    <div className="grid grid-cols-2 gap-4">
                      <div className="space-y-2">
                        <label className="text-[9px] font-black text-slate-400 uppercase tracking-widest">Eni (M)</label>
                        <input 
                          type="number" step="0.1" value={win.width}
                          onClick={e => e.stopPropagation()}
                          onChange={(e) => {
                            const newWins = [...windows];
                            newWins[idx].width = e.target.value;
                            setWindows(newWins);
                          }}
                          className="w-full bg-slate-50 border border-slate-100 rounded-xl px-4 py-2.5 text-sm font-black outline-none focus:ring-2 focus:ring-indigo-500 transition-all"
                        />
                      </div>
                      <div className="space-y-2">
                        <label className="text-[9px] font-black text-slate-400 uppercase tracking-widest">Bo'yi (M)</label>
                        <input 
                          type="number" step="0.1" value={win.height}
                          onClick={e => e.stopPropagation()}
                          onChange={(e) => {
                            const newWins = [...windows];
                            newWins[idx].height = e.target.value;
                            setWindows(newWins);
                          }}
                          className="w-full bg-slate-50 border border-slate-100 rounded-xl px-4 py-2.5 text-sm font-black outline-none focus:ring-2 focus:ring-indigo-500 transition-all"
                        />
                      </div>
                    </div>
                  </motion.div>
                ))}
              </div>
            </div>

            {/* Total Price Card */}
            <div className="glass-dark rounded-[2.5rem] p-10 relative overflow-hidden group shadow-2xl">
              <div className="relative z-10">
                <div className="flex justify-between items-start mb-10">
                  <div>
                    <p className="text-[10px] font-black text-indigo-400 uppercase tracking-widest mb-3">Buyurtma jamlanmasi</p>
                    <p className="text-4xl font-black tracking-tighter text-white">
                      {(() => {
                        const totalUSD = windows.reduce((acc, win) => {
                          const mha = (parseFloat(win.width) || 0) * (parseFloat(win.height) || 0);
                          const price = win.material?.priceUSD || selectedMaterial?.priceUSD || 0;
                          return acc + (mha * price);
                        }, 0);
                        return (totalUSD * globalRate).toLocaleString();
                      })()} 
                      <span className="text-xs text-slate-400 ml-2 italic">UZS</span>
                    </p>
                    <p className="text-xs text-slate-400 mt-3 font-medium opacity-80">
                      Kurs: $1 = {globalRate.toLocaleString()} UZS
                    </p>
                  </div>
                  <div className="w-14 h-14 bg-white/10 rounded-2xl backdrop-blur-md flex items-center justify-center relative overflow-hidden group-hover:scale-110 transition-transform">
                     <span className="text-white font-black text-2xl">$</span>
                     <div className="absolute inset-0 bg-white/20 -translate-y-full group-hover:translate-y-0 transition-transform duration-500" />
                  </div>
                </div>
                
                <button 
                  disabled={!selectedMaterial || windows.length === 0}
                  className="w-full py-5 bg-indigo-600 text-white rounded-3xl font-black text-base tracking-tight shadow-3xl shadow-indigo-600/40 hover:bg-indigo-500 active:scale-95 transition-all disabled:opacity-40 disabled:grayscale disabled:scale-100"
                >
                  Hisoblab chiqarish
                </button>
              </div>
              
              {/* Background Glow */}
              <div className="absolute top-0 right-0 w-40 h-40 bg-indigo-500/20 blur-[80px] rounded-full" />
            </div>
          </div>
        </section>
      </div>

      {/* Live Camera Interface Overlay */}
      <AnimatePresence>
        {isCameraOpen && (
          <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 lg:p-10">
            <motion.div 
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={stopCamera}
              className="absolute inset-0 bg-slate-900/60 backdrop-blur-md"
            />
            
            <motion.div 
              initial={{ scale: 0.95, opacity: 0, y: 30 }}
              animate={{ scale: 1, opacity: 1, y: 0 }}
              exit={{ scale: 0.95, opacity: 0, y: 30 }}
              className="relative bg-white w-full max-w-xl rounded-[2.5rem] p-6 lg:p-8 shadow-3xl border border-slate-200/50 flex flex-col overflow-hidden max-h-[90vh] z-10"
            >
              <div className="flex items-center justify-between pb-4 border-b border-slate-100 mb-4 bg-transparent shrink-0">
                <div>
                  <h3 className="text-xl font-black text-slate-900">Kamera orqali rasm olish</h3>
                  <p className="text-xs text-slate-400 font-bold uppercase tracking-widest mt-0.5">Xonani rasmga tushiring</p>
                </div>
                <button 
                  onClick={stopCamera}
                  className="p-3 bg-slate-100 hover:bg-slate-200 text-slate-500 hover:text-slate-800 rounded-2xl transition-all cursor-pointer"
                >
                  <X size={18} />
                </button>
              </div>

              <div className="relative aspect-video w-full bg-slate-950 rounded-2xl overflow-hidden shadow-inner flex items-center justify-center">
                {cameraError ? (
                  <div className="p-6 text-center space-y-4">
                    <p className="text-sm font-semibold text-slate-300 leading-relaxed">{cameraError}</p>
                    <button 
                      onClick={() => {
                        cameraInputRef.current?.click();
                        stopCamera();
                      }}
                      className="px-6 py-3 bg-indigo-600 hover:bg-indigo-550 text-white rounded-xl text-xs font-black uppercase tracking-widest transition-all shadow-md flex items-center gap-2 mx-auto cursor-pointer"
                    >
                      <Camera size={14} /> Telefon kamerasini ochish
                    </button>
                  </div>
                ) : (
                  <>
                    <video 
                      ref={videoRef}
                      autoPlay 
                      playsInline 
                      muted
                      className="w-full h-full object-cover"
                    />
                    {/* Framing guides */}
                    <div className="absolute inset-4 border border-dashed border-white/30 rounded-xl pointer-events-none flex items-center justify-center">
                      <div className="w-8 h-8 border-t-2 border-l-2 border-white absolute top-0 left-0" />
                      <div className="w-8 h-8 border-t-2 border-r-2 border-white absolute top-0 right-0" />
                      <div className="w-8 h-8 border-b-2 border-l-2 border-white absolute bottom-0 left-0" />
                      <div className="w-8 h-8 border-b-2 border-r-2 border-white absolute bottom-0 right-0" />
                    </div>
                  </>
                )}
              </div>

              <div className="flex flex-col sm:flex-row items-center gap-3 mt-6 shrink-0">
                {!cameraError && (
                  <button 
                    onClick={capturePhoto}
                    className="w-full sm:flex-1 py-4 bg-indigo-600 hover:bg-indigo-500 text-white rounded-2xl font-black text-xs uppercase tracking-widest transition-all shadow-xl shadow-indigo-100 flex items-center justify-center gap-2 cursor-pointer"
                  >
                    <Camera size={16} /> Rasmga olish
                  </button>
                )}

                <button 
                  onClick={() => {
                    cameraInputRef.current?.click();
                    stopCamera();
                  }}
                  className="w-full sm:w-auto px-6 py-4 bg-slate-100 hover:bg-slate-200 text-slate-800 rounded-2xl font-black text-xs uppercase tracking-widest transition-all flex items-center justify-center gap-2 cursor-pointer"
                >
                  <Upload size={16} /> Tizim kamerasidan foydalanish
                </button>

                <button 
                  onClick={stopCamera}
                  className="w-full sm:w-auto px-6 py-4 bg-slate-900 hover:bg-slate-850 text-white rounded-2xl font-black text-xs uppercase tracking-widest transition-all cursor-pointer"
                >
                  Yopish
                </button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </div>
  );
}
