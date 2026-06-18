import React, { useState, useEffect } from 'react';
import { getDb, createItem, updateItem, deleteItem } from '@/src/lib/api';
import { motion, AnimatePresence } from 'motion/react';
import { 
  Plus, 
  Search, 
  AlertTriangle, 
  MinusCircle, 
  History,
  Scale,
  Trash2,
  Loader2
} from 'lucide-react';
import { cn } from '@/src/lib/utils';

export default function Inventory() {
  const [items, setItems] = useState<any[]>([]);
  const [materials, setMaterials] = useState<any[]>([]);
  const [searchTerm, setSearchTerm] = useState('');
  const [isAdding, setIsAdding] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [newItem, setNewItem] = useState({
    materialId: '',
    totalLength: '',
    remainingLength: '',
    warehouse: 'Asosiy Ombor'
  });

  useEffect(() => {
    let active = true;
    const loadInventoryData = async () => {
      try {
        const dbState = await getDb();
        if (!active) return;
        setItems(dbState.inventory || []);
        
        const matNames = (dbState.materials || []).map((m: any) => ({ id: m.id, name: m.name }));
        setMaterials(matNames);
      } catch (err) {
        console.error("Inventory load error:", err);
      }
    };

    loadInventoryData();
    const interval = setInterval(loadInventoryData, 5000);
    return () => {
      active = false;
      clearInterval(interval);
    };
  }, []);

  const handleAddNewItem = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newItem.materialId || !newItem.totalLength) return;

    setIsSaving(true);
    try {
      const added = await createItem('inventory', {
        ...newItem,
        totalLength: parseFloat(newItem.totalLength),
        remainingLength: parseFloat(newItem.remainingLength || newItem.totalLength),
        lastUpdated: new Date().toISOString()
      });

      setItems(prev => [...prev, added]);
      setIsAdding(false);
      setNewItem({ materialId: '', totalLength: '', remainingLength: '', warehouse: 'Asosiy Ombor' });
    } catch (error) {
      console.error("Error adding inventory item:", error);
      alert("Omborga qo'shishda xatolik: " + (error instanceof Error ? error.message : String(error)));
    } finally {
      setIsSaving(false);
    }
  };

  const handleUpdateStock = async (id: string, current: number, amount: number) => {
    if (current - amount < 0) return alert("Not enough material!");
    try {
      const updated = await updateItem('inventory', id, {
        remainingLength: current - amount,
        lastUpdated: new Date().toISOString()
      });
      setItems(prev => prev.map(item => item.id === id ? updated : item));
    } catch (err) {
      console.error("Error updating stock:", err);
      alert("Rulon metrajini yangilashda xatolik yuz berdi.");
    }
  };

  const handleDeleteItem = async (id: string) => {
    if (!window.confirm("Haqiqatan ham ushbu rulonni o'chirib tashlamoqchimisiz?")) return;
    try {
      await deleteItem('inventory', id);
      setItems(prev => prev.filter(item => item.id !== id));
    } catch (e: any) {
      console.error(e);
      alert("Rulonni o'chirishda xatolik: " + e.message);
    }
  };

  const filteredItems = items.filter(item => 
    item.materialId?.toLowerCase().includes(searchTerm.toLowerCase())
  );

  return (
    <div className="space-y-6 lg:space-y-10 lg:p-8 animate-in fade-in duration-1000">
      <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-6">
        <div>
          <h2 className="text-3xl lg:text-4xl font-black tracking-tight text-slate-900">Ombor zaxirasi</h2>
          <p className="text-sm lg:text-base text-slate-500 mt-2 font-medium">Rulonlarni monitoring qilish va metrajni chegirish.</p>
        </div>
        
        <button 
          onClick={() => setIsAdding(true)}
          className="h-14 px-8 bg-slate-900 text-white rounded-2xl font-black text-sm tracking-tight hover:bg-slate-800 active:scale-95 shadow-2xl transition-all flex items-center justify-center gap-3"
        >
          <Plus size={22} strokeWidth={3} />
          <span>Yangi rulon</span>
        </button>
      </div>

      <div className="flex items-center gap-4 p-5 glass rounded-[2rem] shadow-xl focus-within:bg-white/80 transition-all border border-white/40">
        <Search className="text-slate-400" size={24} strokeWidth={2.5} />
        <input 
          type="text" 
          placeholder="Artikul yoki ID bo'yicha qidirish..." 
          className="flex-1 bg-transparent border-none outline-none text-base font-black text-slate-900 placeholder:text-slate-400 placeholder:font-medium uppercase tracking-tight"
          value={searchTerm}
          onChange={(e) => setSearchTerm(e.target.value)}
        />
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-8">
        {filteredItems.map((item, i) => (
          <motion.div
            layout
            initial={{ opacity: 0, scale: 0.9 }}
            animate={{ opacity: 1, scale: 1 }}
            transition={{ delay: i * 0.05 }}
            key={item.id}
            className="p-8 glass rounded-[2.5rem] relative overflow-hidden group hover:scale-[1.02] transition-all hover:bg-white/80"
          >
            <div className="flex justify-between items-start mb-8">
              <div>
                <h3 className="font-black text-slate-900 text-base lg:text-lg leading-none uppercase tracking-tight">{item.materialId}</h3>
                <div className="flex items-center gap-2 mt-3">
                  <span className="text-[10px] text-slate-400 font-black tracking-widest bg-slate-50 px-2 py-0.5 rounded-md">ID: {item.id.slice(0, 8)}</span>
                  <span className="text-[10px] text-indigo-400 font-black tracking-widest uppercase">{item.warehouse || 'Asosiy'}</span>
                </div>
              </div>
              <div className="flex gap-2">
                {item.remainingLength < 5 && (
                  <div className="bg-red-500 text-white p-2.5 rounded-2xl shadow-xl shadow-red-200 animate-pulse" title="Kam qolgan">
                    <AlertTriangle size={20} strokeWidth={2.5} />
                  </div>
                )}
                <button 
                  onClick={() => handleDeleteItem(item.id)}
                  className="w-11 h-11 flex items-center justify-center text-slate-300 hover:text-red-500 hover:bg-white rounded-2xl transition-all shadow-sm"
                >
                  <Trash2 size={20} />
                </button>
              </div>
            </div>

            <div className="space-y-4">
              <div className="relative h-3 bg-slate-100 rounded-full overflow-hidden shadow-inner">
                <motion.div 
                  initial={{ width: 0 }}
                  animate={{ width: `${(item.remainingLength / (item.totalLength || item.remainingLength || 1)) * 100}%` }}
                  className={cn(
                    "absolute top-0 left-0 h-full rounded-full transition-all shadow-lg",
                    item.remainingLength < 5 ? "bg-red-500" : "bg-indigo-600 shadow-indigo-200"
                  )}
                />
              </div>
              <div className="flex justify-between text-[11px] font-black uppercase tracking-widest leading-none">
                <span className={cn(
                  item.remainingLength < 5 ? "text-red-600" : "text-slate-900"
                )}>{item.remainingLength.toFixed(1)}m qoldi</span>
                <span className="text-slate-300">/ {item.totalLength}m</span>
              </div>
            </div>

            <div className="mt-10 pt-8 border-t border-slate-100 grid grid-cols-2 gap-4">
              <button 
                onClick={() => handleUpdateStock(item.id, item.remainingLength, 1)}
                className="flex items-center justify-center gap-3 py-4 glass text-slate-900 rounded-2xl hover:bg-white hover:text-indigo-600 font-black text-[10px] uppercase tracking-widest transition-all active:scale-95 shadow-sm border-white/60"
              >
                <MinusCircle size={18} strokeWidth={2.5} /> -1.0m
              </button>
              <button 
                onClick={() => handleUpdateStock(item.id, item.remainingLength, 0.5)}
                className="flex items-center justify-center gap-3 py-4 glass text-slate-900 rounded-2xl hover:bg-white hover:text-indigo-600 font-black text-[10px] uppercase tracking-widest transition-all active:scale-95 shadow-sm border-white/60"
              >
                <MinusCircle size={18} strokeWidth={2.5} /> -0.5m
              </button>
            </div>
            
            <div className="absolute -right-4 -bottom-4 w-24 h-24 bg-slate-500/5 rounded-full blur-3xl group-hover:bg-indigo-500/10 transition-colors" />
          </motion.div>
        ))}
      </div>

      <AnimatePresence>
        {isAdding && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
            <motion.div 
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => setIsAdding(false)}
              className="absolute inset-0 bg-slate-900/40 backdrop-blur-md"
            />
            <motion.div 
              initial={{ scale: 0.9, opacity: 0, y: 40 }}
              animate={{ scale: 1, opacity: 1, y: 0 }}
              exit={{ scale: 0.9, opacity: 0, y: 40 }}
              className="relative glass-dark w-full max-w-lg rounded-[3rem] shadow-2xl overflow-hidden border border-white/20"
            >
              <div className="p-10 border-b border-white/10 flex justify-between items-center bg-white/5">
                <div>
                  <h3 className="text-2xl font-black text-white tracking-tight">Yangi Rulon</h3>
                  <p className="text-sm text-slate-400 font-medium mt-1">Ombor zaxirasini to'ldirish.</p>
                </div>
                <button onClick={() => setIsAdding(false)} className="w-12 h-12 flex items-center justify-center bg-white/10 hover:bg-white/20 text-white rounded-2xl transition-all">
                  <Plus size={24} className="rotate-45" />
                </button>
              </div>

              <form onSubmit={handleAddNewItem} className="p-10 space-y-8">
                <div className="space-y-2">
                  <label className="text-[10px] font-black text-indigo-400 uppercase tracking-widest ml-1">Material</label>
                  <select 
                    required
                    value={newItem.materialId}
                    onChange={e => setNewItem({...newItem, materialId: e.target.value})}
                    className="w-full bg-white/5 border border-white/10 rounded-2xl px-6 py-5 text-sm font-black text-white focus:ring-2 focus:ring-indigo-500 outline-none transition-all appearance-none"
                  >
                    <option value="" className="bg-slate-900">Tanlang...</option>
                    {materials.map(m => (
                      <option key={m.id} value={m.name} className="bg-slate-900">{m.name}</option>
                    ))}
                  </select>
                </div>

                <div className="grid grid-cols-2 gap-6">
                  <div className="space-y-2">
                    <label className="text-[10px] font-black text-indigo-400 uppercase tracking-widest ml-1">Jami (m)</label>
                    <input 
                      required
                      type="number" step="0.1" value={newItem.totalLength}
                      onChange={e => setNewItem({...newItem, totalLength: e.target.value})}
                      placeholder="50.0"
                      className="w-full bg-white/5 border border-white/10 rounded-2xl px-6 py-5 text-sm font-black text-white focus:ring-2 focus:ring-indigo-500 outline-none transition-all"
                    />
                  </div>
                  <div className="space-y-2">
                    <label className="text-[10px] font-black text-indigo-400 uppercase tracking-widest ml-1">Qoldiq (m)</label>
                    <input 
                      type="number" step="0.1" value={newItem.remainingLength}
                      onChange={e => setNewItem({...newItem, remainingLength: e.target.value})}
                      placeholder="Ixtiyoriy"
                      className="w-full bg-white/5 border border-white/10 rounded-2xl px-6 py-5 text-sm font-black text-white focus:ring-2 focus:ring-indigo-500 outline-none transition-all"
                    />
                  </div>
                </div>

                <div className="space-y-2">
                  <label className="text-[10px] font-black text-indigo-400 uppercase tracking-widest ml-1">Ombor</label>
                  <input 
                    type="text" value={newItem.warehouse}
                    onChange={e => setNewItem({...newItem, warehouse: e.target.value})}
                    className="w-full bg-white/5 border border-white/10 rounded-2xl px-6 py-5 text-sm font-black text-white focus:ring-2 focus:ring-indigo-500 outline-none transition-all"
                  />
                </div>

                <div className="pt-6">
                  <button 
                    disabled={isSaving}
                    type="submit"
                    className="w-full py-5 bg-indigo-600 text-white rounded-[1.5rem] font-black text-sm tracking-tight hover:bg-indigo-500 transition-all shadow-2xl shadow-indigo-600/30 flex items-center justify-center gap-3 disabled:opacity-50"
                  >
                    {isSaving ? <Loader2 size={20} className="animate-spin" /> : <Plus size={20} strokeWidth={3} />}
                    Rulonni saqlash
                  </button>
                </div>
              </form>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </div>
  );
}
