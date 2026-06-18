import React, { useState, useEffect, useRef } from 'react';
import { getDb, createItem, deleteItem } from '@/src/lib/api';
import { motion, AnimatePresence } from 'motion/react';
import { Layers, Plus, Filter, LayoutGrid, List as ListIcon, X, Upload, Camera, Loader2, Check, Trash2 } from 'lucide-react';
import { cn, formatCurrency } from '@/src/lib/utils';
import ImageCropper from '@/src/components/ImageCropper';

const categories = ["All", "Plesse", "Combo", "Dikey", "Vertical", "Horizontal", "Bambuk"];

export default function Catalog() {
  const [materials, setMaterials] = useState<any[]>([]);
  const [activeCategory, setActiveCategory] = useState("All");
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [globalRate, setGlobalRate] = useState(12650);
  
  useEffect(() => {
    let active = true;
    const loadData = async () => {
      try {
        const dbState = await getDb();
        if (active) {
          setGlobalRate(dbState.settings?.usdToUzs || 12650);
          setMaterials(dbState.materials || []);
        }
      } catch (err) {
        console.error("Catalog API load error:", err);
      }
    };
    loadData();
    const interval = setInterval(loadData, 5000);
    return () => {
      active = false;
      clearInterval(interval);
    };
  }, []);
  
  // Form State
  const [formData, setFormData] = useState({
    name: '',
    artikul: '',
    country: 'Turkiya',
    priceUSD: '15', // Default narx
    type: 'Plesse',
    image: ''
  });

  const [imageToCrop, setImageToCrop] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleCloseModal = () => {
    setIsModalOpen(false);
    setImageToCrop(null);
    setFormData({ name: '', artikul: '', country: 'Turkiya', priceUSD: '15', type: 'Plesse', image: '' });
    if (fileInputRef.current) fileInputRef.current.value = '';
  };

  // Rasmni siqish va o'lchamini kichraytirish funksiyasi (Tez, sifatli va ultra-engil)
  const compressImage = (base64Str: string): Promise<string> => {
    return new Promise((resolve) => {
      const img = new Image();
      img.src = base64Str;
      img.onerror = () => {
        resolve(base64Str);
      };
      img.onload = () => {
        const canvas = document.createElement('canvas');
        // Max 400px o'lcham va 0.5 sifat bilan rasm super engil va tez yuklanishi kafolatlanadi (15-30KB)
        const MAX_WIDTH = 400;
        const MAX_HEIGHT = 400;
        let width = img.width;
        let height = img.height;

        if (width > height) {
          if (width > MAX_WIDTH) {
            height *= MAX_WIDTH / width;
            width = MAX_WIDTH;
          }
        } else {
          if (height > MAX_HEIGHT) {
            width *= MAX_HEIGHT / height;
            height = MAX_HEIGHT;
          }
        }
        canvas.width = width;
        canvas.height = height;
        const ctx = canvas.getContext('2d');
        if (ctx) {
          ctx.imageSmoothingEnabled = true;
          ctx.imageSmoothingQuality = 'medium';
          ctx.drawImage(img, 0, 0, width, height);
          resolve(canvas.toDataURL('image/jpeg', 0.5));
        } else {
          resolve(base64Str);
        }
      };
    });
  };

  const handleImageUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      const reader = new FileReader();
      reader.onload = (event) => {
        if (event.target?.result) {
          setImageToCrop(event.target.result as string);
        }
      };
      reader.readAsDataURL(file);
    }
  };

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    // Faqat rasm bo'lsa kifoya, qolganlarini avto-to'ldiramiz
    if (!formData.image) {
      alert("Iltimos, rasm yuklang!");
      return;
    }

    setIsSaving(true);
    try {
      const finalName = formData.name || `Mato #${Math.floor(Math.random() * 1000)}`;
      const finalArt = formData.artikul || `ART-${Date.now().toString().slice(-4)}`;

      const newItem = await createItem('materials', {
        ...formData,
        name: finalName,
        artikul: finalArt,
        priceUSD: parseFloat(formData.priceUSD) || 15
      });
      
      setMaterials(prev => [...prev, newItem]);
      handleCloseModal();
    } catch (error: any) {
      console.error("Catalog item save error:", error);
      alert("Mato ma'lumotlarini saqlashda xatolik: " + error.message);
    } finally {
      setIsSaving(false);
    }
  };

  const filteredMaterials = activeCategory === "All" 
    ? materials 
    : materials.filter(m => m.type === activeCategory);

  return (
    <div className="space-y-4 md:space-y-6 lg:space-y-10 p-3 sm:p-6 lg:p-8 animate-in fade-in duration-1000">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h2 className="text-2xl sm:text-3xl lg:text-4xl font-black tracking-tight text-slate-900">Materiallar katalogi</h2>
          <p className="text-xs sm:text-sm lg:text-base text-slate-500 mt-1 md:mt-2 font-medium">Vizualizatsiya uchun matolar, turlari va narxlari.</p>
        </div>
        <button 
          onClick={() => setIsModalOpen(true)}
          className="h-11 sm:h-14 px-6 sm:px-8 bg-slate-900 text-white rounded-xl sm:rounded-2xl font-black text-xs sm:text-sm tracking-tight hover:bg-slate-800 active:scale-95 shadow-xl transition-all flex items-center justify-center gap-2"
        >
          <Plus size={16} strokeWidth={3} />
          <span>Material qo'shish</span>
        </button>
      </div>

      <div className="flex items-center gap-2 overflow-x-auto pb-2 scrollbar-hide -mx-3 px-3 lg:mx-0">
        {categories.map((cat) => (
          <button
            key={cat}
            onClick={() => setActiveCategory(cat)}
            className={cn(
              "px-5 py-2 rounded-full text-[9px] sm:text-[10px] font-black uppercase tracking-widest transition-all whitespace-nowrap",
              activeCategory === cat 
                ? "bg-indigo-600 text-white shadow-xl shadow-indigo-100" 
                : "glass text-slate-500 hover:bg-white/80"
            )}
          >
            {cat === 'All' ? 'Barchasi' : cat}
          </button>
        ))}
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6 md:gap-8">
        {filteredMaterials.length === 0 ? (
          <div className="col-span-full py-16 sm:py-20 glass rounded-[2rem] sm:rounded-[3rem] text-center">
            <Layers size={40} className="mx-auto text-slate-300 mb-4" />
            <p className="text-xs sm:text-sm font-black text-slate-400 uppercase tracking-widest">Ma'lumotlar topilmadi</p>
          </div>
        ) : (
          filteredMaterials.map((material, i) => (
            <motion.div
              initial={{ opacity: 0, y: 30 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: i * 0.05, type: 'spring', damping: 20 }}
              key={material.id}
              className="group glass rounded-2xl sm:rounded-[2.5rem] overflow-hidden hover:scale-[1.02] transition-all hover:bg-white/80"
            >
              <div className="aspect-[4/3] bg-slate-100 relative overflow-hidden">
                <img 
                  src={material.image || 'https://images.unsplash.com/photo-1513519245088-0e12902e5a38?q=80&w=2070&auto=format&fit=crop'} 
                  alt={material.name}
                  className="w-full h-full object-cover group-hover:scale-110 transition-transform duration-1000"
                />
                <div className="absolute top-4 right-4 px-4 py-1.5 glass-dark backdrop-blur-md rounded-full text-[10px] font-bold uppercase tracking-widest text-white border border-white/10">
                  {material.type}
                </div>
                
                {/* O'chirish tugmasi - user xohlaganda o'chira olishi uchun */}
                <button
                  type="button"
                  onClick={async (e) => {
                    e.stopPropagation();
                    if (window.confirm(`${material.name} materialini butunlay o'chirmoqchimisiz?`)) {
                      try {
                        await deleteItem('materials', material.id);
                        setMaterials(prev => prev.filter(m => m.id !== material.id));
                      } catch (err: any) {
                        console.error("Xatolik materialni o'chirishda:", err);
                        alert("Materialni o'chirib bo'lmadi: " + err.message);
                      }
                    }
                  }}
                  className="absolute top-4 left-4 w-9 h-9 bg-red-500/90 hover:bg-red-600 text-white rounded-xl flex items-center justify-center transition-all shadow-md hover:scale-105 active:scale-95 z-10"
                  title="O'chirish"
                >
                  <Trash2 size={15} />
                </button>
              </div>
              
              <div className="p-8">
                <div className="flex justify-between items-start mb-3">
                  <h3 className="font-black text-slate-900 text-sm lg:text-base leading-tight uppercase tracking-tight truncate mr-2">{material.name}</h3>
                  <p className="text-[10px] text-slate-400 font-mono font-black tracking-widest bg-slate-50 px-2 py-0.5 rounded-md shrink-0">#{material.artikul || 'N/A'}</p>
                </div>
                <p className="text-[10px] text-slate-400 font-black uppercase tracking-widest mb-6">{material.country}</p>
                
                <div className="flex items-center justify-between pt-6 border-t border-slate-100">
                  <div>
                    <p className="text-[10px] text-slate-400 uppercase font-black tracking-widest mb-2 leading-none">Narxi / m²</p>
                    <div className="flex items-baseline gap-2">
                      <p className="font-black text-2xl text-slate-900 leading-none">${material.priceUSD}</p>
                      <p className="text-[10px] text-slate-400 font-black tracking-widest italic opacity-60">≈ {formatCurrency(material.priceUSD * globalRate)}</p>
                    </div>
                  </div>
                  <div className="w-12 h-12 glass flex items-center justify-center text-slate-400 group-hover:text-indigo-600 transition-all rounded-2xl group-hover:bg-white">
                    <LayoutGrid size={20} strokeWidth={2.5} />
                  </div>
                </div>
              </div>
            </motion.div>
          ))
        )}
      </div>

      {/* Add Material Modal */}
      <AnimatePresence>
        {isModalOpen && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
            <motion.div 
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={handleCloseModal}
              className="absolute inset-0 bg-slate-900/40 backdrop-blur-md"
            />
            <motion.div 
              initial={{ scale: 0.9, opacity: 0, y: 40 }}
              animate={{ scale: 1, opacity: 1, y: 0 }}
              exit={{ scale: 0.9, opacity: 0, y: 40 }}
              className="relative glass-dark w-full max-w-xl max-h-[90vh] overflow-y-auto rounded-[3rem] shadow-2xl border border-white/20 scrollbar-hide"
            >
              <div className="p-8 lg:p-10 border-b border-white/10 flex justify-between items-center bg-white/5">
                <div>
                  <h3 className="text-2xl font-black text-white tracking-tight">
                    {imageToCrop ? "Mato rasmiga tuzatish kiritish" : "Yangi Material"}
                  </h3>
                  <p className="text-sm text-slate-400 font-medium mt-1">
                    {imageToCrop ? "Rasmni kerakli ko'rinishda qirqib oling." : "Katalogga yangi mato turini qo'shing."}
                  </p>
                </div>
                <button onClick={handleCloseModal} className="w-12 h-12 flex items-center justify-center bg-white/10 hover:bg-white/20 text-white rounded-2xl transition-all">
                  <X size={24} />
                </button>
              </div>

              {imageToCrop ? (
                <div className="p-8 lg:p-10">
                  <ImageCropper
                    imageSrc={imageToCrop}
                    onCropComplete={async (croppedBase64) => {
                      const compressed = await compressImage(croppedBase64);
                      setFormData({ ...formData, image: compressed });
                      setImageToCrop(null);
                    }}
                    onCancel={() => {
                      setImageToCrop(null);
                      if (fileInputRef.current) fileInputRef.current.value = '';
                    }}
                  />
                </div>
              ) : (
                <form onSubmit={handleSave} className="p-8 lg:p-10 space-y-8">
                  {/* Image Upload Area */}
                  <div 
                    onClick={() => fileInputRef.current?.click()}
                    className="w-full aspect-video bg-white/5 border-2 border-dashed border-white/20 rounded-[2rem] flex flex-col items-center justify-center cursor-pointer hover:bg-white/10 transition-all overflow-hidden group relative"
                  >
                    {formData.image ? (
                      <img src={formData.image} className="w-full h-full object-cover" />
                    ) : (
                      <div className="text-center">
                        <div className="w-16 h-16 bg-white/10 rounded-full flex items-center justify-center text-white mb-4 mx-auto group-hover:scale-110 transition-transform">
                          <Camera size={28} />
                        </div>
                        <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Mato rasmini yuklash</p>
                      </div>
                    )}
                    <input ref={fileInputRef} type="file" className="hidden" accept="image/*" onChange={handleImageUpload} />
                  </div>

                  <div className="grid grid-cols-2 gap-6">
                    <div className="space-y-2">
                      <label className="text-[10px] font-black text-indigo-400 uppercase tracking-widest">Nomi</label>
                      <input 
                        required
                        type="text" 
                        value={formData.name}
                        onChange={e => setFormData({...formData, name: e.target.value})}
                        placeholder="Mato nomi..."
                        className="w-full bg-white/5 border border-white/10 rounded-2xl px-5 py-4 text-sm text-white placeholder:text-slate-600 focus:ring-2 focus:ring-indigo-500 outline-none transition-all"
                      />
                    </div>
                    <div className="space-y-2">
                      <label className="text-[10px] font-black text-indigo-400 uppercase tracking-widest">Artikul</label>
                      <input 
                        type="text" 
                        value={formData.artikul}
                        onChange={e => setFormData({...formData, artikul: e.target.value})}
                        placeholder="Masalan: SL-2024"
                        className="w-full bg-white/5 border border-white/10 rounded-2xl px-5 py-4 text-sm text-white placeholder:text-slate-600 focus:ring-2 focus:ring-indigo-500 outline-none transition-all"
                      />
                    </div>
                  </div>

                  <div className="grid grid-cols-2 gap-6">
                    <div className="space-y-2">
                      <label className="text-[10px] font-black text-indigo-400 uppercase tracking-widest">Tur</label>
                      <select 
                        value={formData.type}
                        onChange={e => setFormData({...formData, type: e.target.value})}
                        className="w-full bg-white/5 border border-white/10 rounded-2xl px-5 py-4 text-sm text-white focus:ring-2 focus:ring-indigo-500 outline-none transition-all appearance-none"
                      >
                        {categories.filter(c => c !== 'All').map(c => (
                          <option key={c} value={c} className="bg-slate-900 text-white">{c}</option>
                        ) )}
                      </select>
                    </div>
                    <div className="space-y-2">
                      <label className="text-[10px] font-black text-indigo-400 uppercase tracking-widest">Narxi ($ / m²)</label>
                      <input 
                        required
                        type="number" 
                        step="0.01"
                        value={formData.priceUSD}
                        onChange={e => setFormData({...formData, priceUSD: e.target.value})}
                        className="w-full bg-white/5 border border-white/10 rounded-2xl px-5 py-4 text-sm text-white focus:ring-2 focus:ring-indigo-500 outline-none transition-all"
                      />
                    </div>
                  </div>

                  <div className="pt-6 flex gap-4">
                    <button 
                      disabled={isSaving}
                      type="submit"
                      className="flex-1 py-5 bg-indigo-600 text-white rounded-[1.5rem] font-black text-sm tracking-tight hover:bg-indigo-500 transition-all shadow-2xl shadow-indigo-600/30 flex items-center justify-center gap-3 disabled:opacity-50"
                    >
                      {isSaving ? <Loader2 size={18} className="animate-spin" /> : <Check size={18} strokeWidth={3} />}
                      Saqlash
                    </button>
                  </div>
                </form>
              )}
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </div>
  );
}
