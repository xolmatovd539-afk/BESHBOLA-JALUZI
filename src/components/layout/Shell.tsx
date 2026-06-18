import { ReactNode, useState, useEffect } from 'react';
import { NavLink } from 'react-router-dom';
import { 
  Camera, 
  Layers, 
  Package, 
  Settings as SettingsIcon, 
  LayoutDashboard,
  Menu,
  X,
  Calculator,
  BarChart3
} from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { cn } from '@/src/lib/utils';
import { doc, onSnapshot, setDoc } from 'firebase/firestore';
import { db, handleFirestoreError, OperationType } from '@/src/lib/firebase';

interface ShellProps {
  children: ReactNode;
}

const navItems = [
  { to: '/', icon: LayoutDashboard, label: 'Bosh sahifa' },
  { to: '/visualizer', icon: Camera, label: 'Vizualizator' },
  { to: '/orders', icon: Calculator, label: 'Hisob-kitob' },
  { to: '/reports', icon: BarChart3, label: 'Hisobotlar' },
  { to: '/catalog', icon: Layers, label: 'Katalog' },
  { to: '/inventory', icon: Package, label: 'Ombor' },
  { to: '/settings', icon: SettingsIcon, label: 'Sozlamalar' },
];

export function Shell({ children }: ShellProps) {
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);
  const [isOnline, setIsOnline] = useState(() => typeof navigator !== 'undefined' ? navigator.onLine : true);

  const [globalRate, setGlobalRate] = useState<number>(() => {
    try {
      const stored = localStorage.getItem('beshbola_db_state');
      if (stored) {
        const parsed = JSON.parse(stored);
        if (parsed.settings?.usdToUzs) {
          return parsed.settings.usdToUzs;
        }
      }
    } catch (e) {}
    return 12650;
  });

  const [lastUpdated, setLastUpdated] = useState<string>('');
  const authorName = "Fergana Doston";

  useEffect(() => {
    // Online / Offline listeners
    const handleOnline = () => setIsOnline(true);
    const handleOffline = () => setIsOnline(false);

    window.addEventListener('online', handleOnline);
    window.addEventListener('offline', handleOffline);

    // Snapshot with offline resiliency
    const unsub = onSnapshot(doc(db, 'settings', 'global'), async (snap) => {
      if (snap.exists()) {
        const data = snap.data();
        const rateVal = data?.usdToUzs || 12650;
        setGlobalRate(rateVal);
        
        const now = new Date();
        const last = data?.lastUpdated ? new Date(data.lastUpdated) : new Date(0);
        const hoursPassed = (now.getTime() - last.getTime()) / (1000 * 60 * 60);

        // Har soatda avtomatik yangilash (agar 1 soatdan ko'p o'tgan bo'lsa va tarmoq ulangan bo'lsa)
        if (hoursPassed >= 1 && navigator.onLine) {
          try {
            const resp = await fetch('https://cbu.uz/uz/arkhiv-kursov-valyut/json/');
            const cbuData = await resp.json();
            const usd = cbuData.find((i: any) => i.Ccy === 'USD');
            if (usd) {
              const newRate = parseFloat(usd.Rate);
              await setDoc(doc(db, 'settings', 'global'), {
                usdToUzs: newRate,
                lastUpdated: new Date().toISOString(),
                autoUpdated: true
              }, { merge: true });
            }
          } catch (err) {
            console.warn("CBU Auto Sync Write Error (expected if offline):", err instanceof Error ? err.message : err);
          }
        }

        if (data?.lastUpdated) {
          const date = new Date(data.lastUpdated);
          setLastUpdated(date.toLocaleTimeString('uz-UZ', { hour: '2-digit', minute: '2-digit' }));
        }
      } else {
        // Fallback or Initial create
        if (navigator.onLine) {
          try {
            await setDoc(doc(db, 'settings', 'global'), {
              usdToUzs: 12650,
              lastUpdated: new Date().toISOString()
            });
          } catch (err) {
            console.warn("Could not create initial global settings document:", err);
          }
        }
      }
    }, (err) => {
      console.warn("onSnapshot failed for settings/global (safely continuing offline):", err.message || err);
    });

    return () => {
      unsub();
      window.removeEventListener('online', handleOnline);
      window.removeEventListener('offline', handleOffline);
    };
  }, []);

  return (
    <div className="h-screen flex flex-col font-sans text-slate-800 liquid-bg overflow-hidden p-2 sm:p-4 gap-2 sm:gap-4">
      {/* Sidebar - Faqat desktopda */}
      <div className="flex-1 flex overflow-hidden gap-2 sm:gap-4">
        
        <aside className="w-24 glass rounded-[2.5rem] hidden lg:flex flex-col items-center py-10 space-y-10 flex-shrink-0 animate-in fade-in slide-in-from-left duration-700">
          <div className="w-14 h-14 bg-indigo-600 rounded-[1.25rem] flex items-center justify-center text-white font-black text-2xl shadow-xl shadow-indigo-200 rotate-3 hover:rotate-0 transition-transform cursor-pointer">
            S
          </div>
          <nav className="flex flex-col space-y-8">
            {navItems.map((item, idx) => (
              <NavLink
                key={item.to}
                to={item.to}
                title={item.label}
              >
                {({ isActive }) => (
                  <motion.div 
                    initial={{ opacity: 0, scale: 0.8 }}
                    animate={{ opacity: 1, scale: 1 }}
                    transition={{ delay: 0.1 + idx * 0.1 }}
                    className={cn(
                      "p-4 rounded-2xl transition-all duration-300 group relative",
                      isActive 
                        ? "bg-indigo-600 text-white shadow-xl shadow-indigo-100 scale-110" 
                        : "text-slate-400 hover:text-slate-900 hover:bg-white/50"
                    )}
                  >
                    <item.icon size={26} strokeWidth={isActive ? 2.5 : 2} />
                    {isActive && (
                      <motion.div 
                        layoutId="activePill"
                        className="absolute -right-1 top-1/2 -translate-y-1/2 w-1.5 h-1.5 bg-indigo-600 rounded-full"
                      />
                    )}
                  </motion.div>
                )}
              </NavLink>
            ))}
          </nav>
        </aside>

        <main className="flex-1 flex flex-col min-w-0 bg-transparent relative overflow-hidden">
          {/* Header */}
          <header className="h-16 md:h-20 lg:h-24 glass rounded-2xl md:rounded-[2.5rem] flex items-center justify-between px-4 md:px-6 lg:px-10 flex-shrink-0 mb-2 md:mb-4 animate-in fade-in slide-in-from-top duration-700">
            <div className="flex items-center gap-3 md:gap-4">
              <button 
                onClick={() => setIsMobileMenuOpen(true)}
                className="lg:hidden p-2 text-slate-600 hover:bg-white/50 rounded-xl"
              >
                <Menu size={24} />
              </button>
              <div>
                <h1 className="text-sm xs:text-base md:text-xl lg:text-2xl font-black tracking-tight text-slate-900 leading-none">
                  <span className="text-red-600">BESHBOLA JALUZI</span>
                </h1>
                <p className="text-[8px] md:text-[10px] lg:text-[11px] text-slate-400 uppercase tracking-widest font-black mt-1 md:mt-2">Studiya Maishiy • Muallif: {authorName}</p>
              </div>
            </div>
            
            <div className="flex space-x-2 md:space-x-4 items-center">
              {/* Online / Offline status */}
              <div className={cn(
                "flex items-center space-x-1.5 px-3 py-1.5 md:px-4 md:py-2.5 rounded-xl md:rounded-2xl shadow-sm text-[9px] md:text-xs font-black tracking-tight border transition-all duration-300",
                isOnline 
                  ? "bg-emerald-500/10 text-emerald-600 border-emerald-500/20" 
                  : "bg-amber-500/10 text-amber-600 border-amber-500/20 animate-pulse"
              )}>
                <span className={cn(
                  "w-1.5 h-1.5 rounded-full",
                  isOnline ? "bg-emerald-500" : "bg-amber-500"
                )} />
                <span>{isOnline ? "ONLAYN" : "OFFLAYN REJIM"}</span>
              </div>

              <div className="flex items-center space-x-2 bg-white/40 border border-white/50 px-3 py-1.5 md:px-5 md:py-2.5 rounded-xl md:rounded-2xl shadow-sm text-indigo-600 text-[9px] md:text-xs font-black tracking-tight-dense">
                <span className="w-1.5 h-1.5 bg-indigo-600 rounded-full"></span>
                <span>$1 = {globalRate.toLocaleString()} UZS</span>
              </div>
            </div>
          </header>

          {/* Page Content */}
          <div className="flex-1 glass rounded-2xl md:rounded-[2.5rem] overflow-hidden flex flex-col relative animate-in fade-in zoom-in-95 duration-1000">
            <div className="flex-1 overflow-y-auto">
              {children}
            </div>
            
            {/* Bottom Alert Bar Integrated into Content Box */}
            <footer className={cn(
              "h-10 md:h-12 lg:h-14 text-white flex items-center px-4 md:px-8 space-x-4 md:space-x-8 overflow-hidden whitespace-nowrap flex-shrink-0 transition-colors duration-500",
              isOnline ? "bg-indigo-600/90 backdrop-blur-md" : "bg-amber-600/90 backdrop-blur-md"
            )}>
              <div className="flex items-center space-x-2 flex-shrink-0">
                <div className={cn(
                  "w-1.5 h-1.5 rounded-full animate-pulse shadow-md",
                  isOnline ? "bg-emerald-400 shadow-emerald-500/50" : "bg-white shadow-white/50"
                )} />
                <span className="text-[9px] font-black uppercase tracking-widest leading-none">TIZIM:</span>
                <span className="text-[10px] md:text-xs font-bold tracking-tight">
                  {isOnline ? `Onlayn • Kurs: ${lastUpdated || 'hozirgina'}` : "Internet yo'q • Avtonom (Ooflayn) rejimda to'liq ishlamoqda"}
                </span>
              </div>
              <div className="w-px h-5 bg-white/20 hidden lg:block"></div>
              <div className="flex items-center space-x-2">
                <span className="text-[9px] font-black uppercase tracking-widest leading-none hidden sm:block">Foydalanuvchi:</span>
                <span className="text-[10px] md:text-xs font-bold tracking-tight italic opacity-80">{authorName}</span>
              </div>
            </footer>
          </div>
        </main>
      </div>

      {/* Mobile Menu */}
      <AnimatePresence>
        {isMobileMenuOpen && (
          <>
            <motion.div 
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => setIsMobileMenuOpen(false)}
              className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm z-[60] lg:hidden"
            />
            <motion.div
              initial={{ x: '-100%' }}
              animate={{ x: 0 }}
              exit={{ x: '-100%' }}
              transition={{ type: 'spring', damping: 25, stiffness: 200 }}
              className="fixed top-0 left-0 bottom-0 w-4/5 max-w-sm bg-white z-[70] lg:hidden flex flex-col p-6 shadow-2xl"
            >
              <div className="flex items-center justify-between mb-8">
                <div>
                  <h1 className="text-xl font-bold tracking-tight text-red-600">BESHBOLA JALUZI</h1>
                  <p className="text-[10px] text-slate-500 uppercase tracking-widest font-bold">Navigatsiya</p>
                </div>
                <button 
                  onClick={() => setIsMobileMenuOpen(false)}
                  className="p-2 hover:bg-slate-100 rounded-lg transition-colors text-slate-400"
                >
                  <X size={24} />
                </button>
              </div>
              <nav className="space-y-2">
                {navItems.map((item) => (
                  <NavLink
                    key={item.to}
                    to={item.to}
                    onClick={() => setIsMobileMenuOpen(false)}
                    className={({ isActive }) => cn(
                      "flex items-center gap-4 px-4 py-4 rounded-xl transition-all duration-200",
                      isActive 
                        ? "bg-indigo-600 text-white shadow-lg shadow-indigo-600/20" 
                        : "text-slate-500 hover:bg-slate-50 hover:text-slate-900"
                    )}
                  >
                    <item.icon size={20} />
                    <span className="font-bold text-base tracking-tight">{item.label}</span>
                  </NavLink>
                ))}
              </nav>
              
              <div className="mt-auto pt-6 border-t border-slate-100">
                <div className="flex items-center gap-3 px-2">
                  <div className="w-10 h-10 rounded-full bg-slate-100 flex items-center justify-center text-slate-400 text-xs font-bold">
                    AD
                  </div>
                  <div>
                    <p className="text-sm font-bold text-slate-900">Admin</p>
                    <p className="text-xs text-slate-400">Boshqaruv paneli</p>
                  </div>
                </div>
              </div>
            </motion.div>
          </>
        )}
      </AnimatePresence>
    </div>
  );
}
