import { useState, useEffect } from 'react';
import { getDb } from '@/src/lib/api';
import { motion } from 'motion/react';
import { 
  TrendingUp, 
  Package, 
  Layers, 
  ArrowUpRight, 
  DollarSign,
  Calculator,
  BarChart3
} from 'lucide-react';
import { cn } from '@/src/lib/utils';
import { Link } from 'react-router-dom';

export default function Dashboard() {
  const [materialCount, setMaterialCount] = useState(0);
  const [lowStockCount, setLowStockCount] = useState(0);
  const [totalOrders, setTotalOrders] = useState(0);
  const [rate, setRate] = useState(12650);
  const [recentInventory, setRecentInventory] = useState<any[]>([]);

  useEffect(() => {
    let active = true;
    const loadDashboardData = async () => {
      try {
        const dbState = await getDb();
        if (!active) return;
        
        // Materials count
        setMaterialCount(dbState.materials?.length || 0);
        
        // Orders count
        setTotalOrders(dbState.orders?.length || 0);
        
        // Inventory and low stock
        const invData = dbState.inventory || [];
        const low = invData.filter((item: any) => item.remainingLength < 5);
        setLowStockCount(low.length);
        
        const sorted = [...invData].sort((a: any, b: any) => 
          new Date(b.lastUpdated || b.createdAt || 0).getTime() - new Date(a.lastUpdated || a.createdAt || 0).getTime()
        );
        setRecentInventory(sorted.slice(0, 4));
        
        // Settings rate
        setRate(dbState.settings?.usdToUzs || 12650);
      } catch (err) {
        console.error("Dashboard Load Error:", err);
      }
    };

    loadDashboardData();
    const interval = setInterval(loadDashboardData, 5000);
    return () => {
      active = false;
      clearInterval(interval);
    };
  }, []);

  const stats = [
    { label: 'Jami materiallar', value: materialCount.toString(), icon: Layers, trend: 'Katalogdagi jami turlar', to: '/catalog' },
    { label: 'Kam qolganlar', value: lowStockCount.toString(), icon: Package, trend: 'E’tibor kutilmoqda', urgent: lowStockCount > 0, to: '/inventory' },
    { label: 'Jami buyurtmalar', value: totalOrders.toString(), icon: Calculator, trend: 'Barcha saqlanganlar', to: '/orders' },
    { label: 'Joriy kurs', value: rate.toLocaleString(), icon: DollarSign, trend: '1 USD uchun UZS', to: '/settings' },
  ];

  return (
    <motion.div 
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      className="space-y-4 md:space-y-6 lg:space-y-10 p-3 sm:p-6 lg:p-8"
    >
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h2 className="text-2xl sm:text-3xl lg:text-4xl font-black tracking-tight text-slate-900 leading-tight">Boshqaruv <span className="text-indigo-600">Paneli</span></h2>
          <p className="text-xs sm:text-sm lg:text-base text-slate-500 mt-1 md:mt-2 font-medium"><span className="text-red-600 font-bold">BESHBOLA JALUZI</span> • Xush kelibsiz, <span className="text-indigo-600">Admin</span></p>
        </div>
        <div className="flex items-center gap-3">
          <Link to="/reports" className="h-10 w-10 sm:h-12 sm:w-12 rounded-xl sm:rounded-2xl glass flex items-center justify-center text-slate-400 group cursor-pointer hover:bg-white/80 transition-all">
            <BarChart3 size={18} className="group-hover:text-indigo-600 transition-colors" />
          </Link>
          <Link to="/orders" className="h-10 sm:h-12 px-4 sm:px-6 rounded-xl sm:rounded-2xl bg-slate-900 text-white font-black text-xs sm:text-sm tracking-tight shadow-xl hover:bg-slate-800 active:scale-95 transition-all flex items-center gap-2">
            <Calculator size={16} />
            <span>Yangi buyurtma</span>
          </Link>
        </div>
      </div>

      <div className="grid grid-cols-1 xs:grid-cols-2 lg:grid-cols-4 gap-4 sm:gap-6">
        {stats.map((stat, i) => (
          <Link to={stat.to} key={stat.label}>
            <motion.div
              initial={{ opacity: 0, y: 30 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: i * 0.1, type: 'spring', damping: 20 }}
              className="p-5 sm:p-8 glass rounded-2xl sm:rounded-[2rem] relative overflow-hidden group hover:scale-[1.02] transition-all hover:bg-white/80 h-full"
            >
              <div className="flex justify-between items-start">
                <div className={cn(
                  "w-11 h-11 sm:w-14 sm:h-14 rounded-xl sm:rounded-2.5xl flex items-center justify-center shadow-lg",
                  stat.urgent 
                    ? "bg-red-500 text-white shadow-red-200" 
                    : "bg-indigo-600 text-white shadow-indigo-100"
                )}>
                  <stat.icon size={20} strokeWidth={2.5} />
                </div>
                <div className="w-7 h-7 sm:w-8 sm:h-8 rounded-full bg-slate-100/50 flex items-center justify-center text-slate-400 group-hover:bg-indigo-50 group-hover:text-indigo-600 transition-all">
                  <ArrowUpRight size={14} strokeWidth={3} />
                </div>
              </div>
              
              <div className="mt-5 sm:mt-8">
                <p className="text-[9px] uppercase font-black tracking-widest text-slate-400 leading-none">{stat.label}</p>
                <p className="text-2xl sm:text-3xl lg:text-4xl font-black tracking-tighter mt-1.5 sm:mt-3 text-slate-900">{stat.value}</p>
              </div>

              <div className="mt-4 sm:mt-6">
                <div className={cn(
                  "text-[9px] font-black uppercase tracking-widest px-3 py-1 sm:px-4 sm:py-1.5 rounded-full inline-block",
                  stat.urgent ? "bg-red-50 text-red-600" : "bg-indigo-50 text-indigo-600"
                )}>
                  {stat.trend}
                </div>
              </div>
              
              {/* Background Accent */}
              <div className={cn(
                "absolute -right-4 -bottom-4 w-24 h-24 blur-3xl opacity-10 rounded-full",
                stat.urgent ? "bg-red-500" : "bg-indigo-500"
              )} />
            </motion.div>
          </Link>
        ))}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 md:gap-8">
        {/* Recent Items */}
        <div className="lg:col-span-8 p-5 sm:p-8 lg:p-10 glass rounded-2xl sm:rounded-[2.5rem] relative overflow-hidden group">
          <div className="flex items-center justify-between mb-6">
            <h3 className="text-[10px] sm:text-xs font-black text-slate-400 uppercase tracking-widest">So'nggi ombor yangilanishlari</h3>
            <button className="text-[10px] sm:text-xs font-black text-indigo-600 hover:opacity-70 transition-opacity">Hammasini ko'rish</button>
          </div>
          <div className="space-y-3 sm:space-y-4">
            {recentInventory.length === 0 ? (
              <div className="py-12 sm:py-16 text-center text-slate-400 font-bold uppercase tracking-widest text-[10px] bg-slate-50/50 rounded-2xl border border-dashed border-slate-200">
                Hozircha ma'lumotlar yo'q
              </div>
            ) : (
              recentInventory.map((item, idx) => (
                <motion.div 
                  key={item.id}
                  initial={{ opacity: 0, x: -20 }}
                  animate={{ opacity: 1, x: 0 }}
                  transition={{ delay: 0.4 + idx * 0.1 }}
                  className="flex items-center justify-between p-3 sm:p-5 bg-white/40 border border-white/60 rounded-xl sm:rounded-[1.5rem] hover:bg-white/80 hover:shadow-xl hover:shadow-slate-200/50 transition-all cursor-pointer group/item"
                >
                  <div className="flex items-center gap-3 sm:gap-5">
                    <div className="w-11 h-11 sm:w-14 sm:h-14 bg-indigo-50 rounded-xl flex items-center justify-center text-indigo-500 border border-indigo-100/50 flex-shrink-0 group-hover/item:scale-110 transition-transform">
                      <Package size={20} />
                    </div>
                    <div>
                      <p className="font-black text-slate-900 text-xs sm:text-sm lg:text-base tracking-tight">{item.materialId}</p>
                      <div className="flex items-center gap-1.5 sm:gap-3 mt-1">
                        <span className="text-[8px] sm:text-[10px] text-slate-400 font-black tracking-widest uppercase bg-slate-100 px-1.5 py-0.5 rounded-md">{item.warehouse || 'Noma‘lum'}</span>
                        <div className="w-1 h-1 bg-slate-300 rounded-full"></div>
                        <span className="text-[8px] sm:text-[10px] text-slate-400 font-black tracking-widest uppercase">Ombor</span>
                      </div>
                    </div>
                  </div>
                  <div className="text-right">
                    <p className="font-black text-sm sm:text-lg lg:text-xl text-slate-900 tracking-tighter">{item.remainingLength.toFixed(1)}m</p>
                    <div className="flex items-center gap-1.5 sm:gap-2 justify-end mt-1">
                      <div className="w-12 sm:w-16 h-1 sm:h-1.5 bg-slate-100 rounded-full overflow-hidden">
                        <motion.div 
                          initial={{ width: 0 }}
                          animate={{ width: `${(item.remainingLength / (item.totalLength || 30)) * 100}%` }}
                          className={cn(
                            "h-full rounded-full",
                            (item.remainingLength / (item.totalLength || 30)) < 0.2 ? "bg-red-500" : "bg-emerald-500"
                          )}
                        />
                      </div>
                      <span className="text-[8px] sm:text-[9px] text-slate-400 uppercase font-black">{((item.remainingLength / (item.totalLength || 30)) * 100).toFixed(0)}%</span>
                    </div>
                  </div>
                </motion.div>
              ))
            )}
          </div>
        </div>

        {/* Price Tracker Card */}
        <div className="lg:col-span-4 p-6 sm:p-10 glass-dark rounded-2xl sm:rounded-[2.5rem] flex flex-col justify-between relative overflow-hidden group">
          <div className="relative z-10">
            <div className="w-11 h-11 sm:w-14 sm:h-14 bg-indigo-500/20 rounded-xl sm:rounded-2xl flex items-center justify-center text-indigo-400 mb-4 sm:mb-6 group-hover:scale-110 transition-transform">
              <DollarSign size={22} strokeWidth={2.5} />
            </div>
            <h3 className="text-[10px] sm:text-xs font-black text-indigo-400 uppercase tracking-widest mb-2 sm:mb-3">Narx hisoblagich</h3>
            <p className="text-xs sm:text-sm text-slate-400 leading-relaxed font-medium">Joriy valyuta kursi bo'yicha narxlarni markaziy bank orqali yangilang yoki qo'lda kiriting.</p>
          </div>
          
          <div className="mt-8 sm:mt-12 space-y-4 sm:space-y-6 relative z-10">
            <div className="p-4 sm:p-6 bg-white/5 rounded-2xl sm:rounded-3xl border border-white/5 backdrop-blur-sm">
              <label className="text-[9px] sm:text-[10px] uppercase font-black tracking-widest text-slate-500 mb-1.5 sm:mb-3 block">USD kursi (bugun)</label>
              <motion.div 
                key={rate}
                initial={{ opacity: 0, scale: 0.9 }}
                animate={{ opacity: 1, scale: 1 }}
                className="text-2xl sm:text-3xl lg:text-4xl font-mono text-white font-black tracking-tighter flex items-baseline gap-2 sm:gap-3"
              >
                {rate.toLocaleString()} <span className="text-[10px] sm:text-xs text-slate-500 font-sans uppercase font-black tracking-widest italic">UZS</span>
              </motion.div>
            </div>
            
            <Link to="/settings" className="block w-full py-3.5 sm:py-5 bg-indigo-600 text-white rounded-xl sm:rounded-[1.5rem] font-black text-xs sm:text-sm tracking-tight hover:bg-indigo-505 transition-all shadow-2xl shadow-indigo-600/30 active:scale-[0.98] text-center">
              Kursni yangilash
            </Link>
          </div>
          
          {/* Animated Background Element */}
          <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-80 h-80 bg-indigo-500/10 rounded-full blur-[100px] animate-pulse" />
        </div>
      </div>
    </motion.div>
  );
}
