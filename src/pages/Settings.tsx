import { useState, useEffect } from 'react';
import { getDb, updateSettings } from '@/src/lib/api';
import { motion } from 'motion/react';
import { 
  DollarSign, 
  RefreshCw, 
  Save, 
  Bell, 
  ShieldCheck,
  Globe
} from 'lucide-react';
import { cn } from '@/src/lib/utils';

export default function Settings() {
  const [rate, setRate] = useState<number>(12950);
  const [isLoading, setIsLoading] = useState(false);
  const [isCbuLoading, setIsCbuLoading] = useState(false);

  useEffect(() => {
    const loadSettings = async () => {
      try {
        const dbState = await getDb();
        if (dbState.settings?.usdToUzs) {
          setRate(dbState.settings.usdToUzs);
        }
      } catch (err) {
        console.error("Settings API load error:", err);
      }
    };
    loadSettings();
  }, []);

  const fetchCbuRate = async () => {
    setIsCbuLoading(true);
    try {
      const response = await fetch('https://cbu.uz/uz/arkhiv-kursov-valyut/json/');
      const data = await response.json();
      const usdRate = data.find((item: any) => item.Ccy === 'USD');
      if (usdRate) {
        const newRate = parseFloat(usdRate.Rate);
        setRate(newRate);
        
        // Automatically save to backend db
        await updateSettings({
          usdToUzs: newRate,
          lastUpdated: new Date().toISOString(),
          autoUpdated: true
        });
        alert(`Markaziy Bank kursi bo'yicha yangilandi: 1$ = ${newRate} UZS`);
      }
    } catch (e) {
      console.error(e);
      alert("CBU API dan ma'lumot olishda xato yuz berdi.");
    } finally {
      setIsCbuLoading(false);
    }
  };

  const handleUpdateRate = async () => {
    setIsLoading(true);
    try {
      await updateSettings({
        usdToUzs: rate,
        lastUpdated: new Date().toISOString()
      });
      alert("Kurs muvaffaqiyatli saqlandi!");
    } catch (e: any) {
      console.error(e);
      alert("Kursni saqlashda xatolik: " + e.message);
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="max-w-4xl space-y-8 lg:space-y-12 lg:p-8">
      <div>
        <h2 className="text-2xl lg:text-3xl font-bold tracking-tight text-slate-900">Tizim sozlamalari</h2>
        <p className="text-sm lg:text-base text-slate-500 mt-1 lg:mt-2">Valyuta kurslari, bildirishnomalar va do'kon ma'lumotlarini sozlang.</p>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 lg:gap-8">
        <div className="lg:col-span-1 space-y-3 lg:space-y-4">
          <h3 className="font-bold text-base lg:text-lg flex items-center gap-2 text-slate-900">
            <DollarSign size={20} className="text-indigo-600" />
            Valyuta va Kurslar
          </h3>
          <p className="text-xs lg:text-sm text-slate-500 leading-relaxed">Barcha hisob-kitoblar uchun rasmiy dollar kursini yangilang.</p>
        </div>

        <div className="lg:col-span-2 p-6 lg:p-8 bg-white border border-slate-200 rounded-2xl lg:rounded-3xl shadow-sm">
          <div className="space-y-6">
            <div>
              <label className="text-[9px] lg:text-[10px] uppercase font-bold tracking-widest text-slate-400 mb-3 block">Joriy kurs (1 USD dan UZS ga)</label>
              <div className="flex items-center gap-3 lg:gap-4">
                <input 
                  type="number" 
                  value={rate}
                  onChange={(e) => setRate(Number(e.target.value))}
                  className="w-full bg-slate-50 border border-slate-100 rounded-xl lg:rounded-2xl p-3 lg:p-4 text-xl lg:text-2xl font-mono focus:ring-2 focus:ring-indigo-500 focus:outline-none transition-all text-slate-900"
                />
                <div className="flex gap-2">
                  <button 
                    onClick={fetchCbuRate}
                    disabled={isCbuLoading}
                    title="Markaziy Bankdan olish"
                    className="p-3 lg:p-5 bg-indigo-50 text-indigo-600 rounded-xl lg:rounded-2xl hover:bg-indigo-100 disabled:opacity-50 transition-all active:scale-95 shrink-0"
                  >
                    {isCbuLoading ? <RefreshCw className="animate-spin" size={20} /> : <RefreshCw size={20} />}
                  </button>
                  <button 
                    onClick={handleUpdateRate}
                    disabled={isLoading}
                    title="Saqlash"
                    className="p-3 lg:p-5 bg-slate-900 text-white rounded-xl lg:rounded-2xl hover:bg-slate-800 disabled:opacity-50 transition-all shadow-lg active:scale-95 shrink-0"
                  >
                    {isLoading ? <RefreshCw className="animate-spin" size={20} /> : <Save size={20} />}
                  </button>
                </div>
              </div>
              <p className="text-[9px] lg:text-[10px] text-slate-400 mt-3 flex items-center gap-1 italic font-medium">
                <RefreshCw size={10} /> Markaziy Bank (CBU) API orqali kursni yangilash tavsiya etiladi.
              </p>
            </div>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 lg:gap-8 pt-8 lg:pt-12 border-t border-slate-100">
        <div className="lg:col-span-1 space-y-3 lg:space-y-4">
          <h3 className="font-bold text-base lg:text-lg flex items-center gap-2 text-slate-900">
            <Globe size={20} className="text-indigo-600" />
            Do'kon ma'lumotlari
          </h3>
          <p className="text-xs lg:text-sm text-slate-500 leading-relaxed">Buyurtmalar va kotirovkalarda ko'rsatiladigan ommaviy ma'lumotlar.</p>
        </div>

        <div className="lg:col-span-2 space-y-4">
          <div className="p-5 lg:p-6 bg-slate-50 rounded-xl lg:rounded-2xl border border-slate-100 text-xs lg:text-sm text-slate-400 font-medium italic leading-relaxed">
            Funksiyani kengaytirish rejalashtirilgan: Administrator bu yerda do'kon nomi, logotipi va aloqa ma'lumotlarini yangilashi mumkin bo'ladi.
          </div>
        </div>
      </div>
    </div>
  );
}
