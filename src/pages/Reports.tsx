import React, { useState, useEffect, useMemo } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { 
  BarChart3, 
  TrendingUp, 
  Layers, 
  DollarSign, 
  FileText, 
  Search,
  Calendar,
  ChevronRight,
  User,
  ArrowUpRight,
  ArrowDownRight,
  Pencil,
  Trash2,
  Plus,
  X,
  ArrowUpDown,
  Phone,
  MapPin,
  Loader2,
  Check,
  AlertCircle,
  Clock,
  Briefcase,
  Info
} from 'lucide-react';
import { cn } from '@/src/lib/utils';
import { getDb, updateItem, deleteItem } from '@/src/lib/api';
import { 
  XAxis, 
  YAxis, 
  CartesianGrid, 
  Tooltip, 
  ResponsiveContainer,
  AreaChart,
  Area
} from 'recharts';

interface OrderItem {
  id: string;
  eni: number;
  boyi: number;
  soni: number;
  turi: string;
  narxi: number;
  kv: number;
  summa: number;
}

export default function Reports() {
  const [orders, setOrders] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedMonth, setSelectedMonth] = useState(new Date().toISOString().substring(0, 7));
  const [monthlyStats, setMonthlyStats] = useState({
    totalSqm: 0,
    totalRevenue: 0,
    orderCount: 0,
    avgOrder: 0
  });

  // Drill-down states
  const [selectedOrder, setSelectedOrder] = useState<any | null>(null);
  const [isDetailListOpen, setIsDetailListOpen] = useState(false);
  const [activeFilter, setActiveFilter] = useState<'all' | 'revenue' | 'orders' | 'sqm' | 'avg_check'>('all');
  const [searchQuery, setSearchQuery] = useState('');
  const [sortBy, setSortBy] = useState<'createdAt' | 'total' | 'totalKv' | 'totalQty'>('createdAt');
  const [sortOrder, setSortOrder] = useState<'asc' | 'desc'>('desc');

  // Edit states for selected order
  const [isEditing, setIsEditing] = useState(false);
  const [editingCustomer, setEditingCustomer] = useState({
    name: '',
    phone: '',
    address: '',
    date: ''
  });
  const [editingItems, setEditingItems] = useState<OrderItem[]>([]);
  const [editingManager, setEditingManager] = useState({ name: '', phone: '' });
  const [isSaving, setIsSaving] = useState(false);
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  const [toastMsg, setToastMsg] = useState<string | null>(null);

  // Subscribing to monthly orders
  useEffect(() => {
    let active = true;
    const loadOrdersData = async () => {
      try {
        const dbState = await getDb();
        if (!active) return;
        
        const allOrders = dbState.orders || [];
        const filtered = allOrders.filter((o: any) => o.month === selectedMonth);
        
        // Sort in-memory desc by createdAt or fallback to custom order date
        filtered.sort((a: any, b: any) => {
          const timeA = a.createdAt ? new Date(a.createdAt).getTime() : new Date(a.customer?.date || 0).getTime();
          const timeB = b.createdAt ? new Date(b.createdAt).getTime() : new Date(b.customer?.date || 0).getTime();
          return timeB - timeA;
        });

        setOrders(filtered);
        
        // Compute statistics
        const sqm = filtered.reduce((sum, o: any) => sum + (o.summary?.totalKv || 0), 0);
        const revenue = filtered.reduce((sum, o: any) => sum + (o.summary?.total || 0), 0);
        
        setMonthlyStats({
          totalSqm: sqm,
          totalRevenue: revenue,
          orderCount: filtered.length,
          avgOrder: filtered.length > 0 ? revenue / filtered.length : 0
        });
        setLoading(false);
      } catch (err) {
        console.error("Reports load data error:", err);
        setLoading(false);
      }
    };

    setLoading(true);
    loadOrdersData();
    const interval = setInterval(loadOrdersData, 5000);
    return () => {
      active = false;
      clearInterval(interval);
    };
  }, [selectedMonth]);

  // Show Toast function
  const showToast = (msg: string) => {
    setToastMsg(msg);
    setTimeout(() => {
      setToastMsg(null);
    }, 4000);
  };

  // Recharts Day chart calculations
  const chartData = useMemo(() => {
    if (orders.length === 0) return [];
    
    const dayMap: Record<string, number> = {};
    orders.forEach((o: any) => {
      if (o.createdAt) {
        const date = o.createdAt.toDate ? o.createdAt.toDate() : new Date(o.createdAt);
        const day = date.getDate().toString();
        dayMap[day] = (dayMap[day] || 0) + (o.summary?.total || 0);
      }
    });

    return Object.entries(dayMap)
      .map(([day, total]) => ({ day, total }))
      .sort((a, b) => parseInt(a.day) - parseInt(b.day));
  }, [orders]);

  // Filter & Sort orders for the detail list view
  const filteredOrders = useMemo(() => {
    let result = [...orders];

    // Search query
    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase();
      result = result.filter(o => 
        (o.customer?.name || '').toLowerCase().includes(q) ||
        (o.customer?.phone || '').includes(q) ||
        (o.customer?.address || '').toLowerCase().includes(q)
      );
    }

    // Sort
    result.sort((a, b) => {
      let valA: any = 0;
      let valB: any = 0;

      if (sortBy === 'createdAt') {
        valA = a.createdAt?.toDate ? a.createdAt.toDate().getTime() : new Date(a.customer?.date || 0).getTime();
        valB = b.createdAt?.toDate ? b.createdAt.toDate().getTime() : new Date(b.customer?.date || 0).getTime();
      } else if (sortBy === 'total') {
        valA = a.summary?.total || 0;
        valB = b.summary?.total || 0;
      } else if (sortBy === 'totalKv') {
        valA = a.summary?.totalKv || 0;
        valB = b.summary?.totalKv || 0;
      } else if (sortBy === 'totalQty') {
        valA = a.summary?.totalQty || 0;
        valB = b.summary?.totalQty || 0;
      }

      if (sortOrder === 'asc') {
        return valA > valB ? 1 : valA < valB ? -1 : 0;
      } else {
        return valA < valB ? 1 : valA > valB ? -1 : 0;
      }
    });

    return result;
  }, [orders, searchQuery, sortBy, sortOrder]);

  // Toggling details list
  const openDetailList = (filter: typeof activeFilter) => {
    setActiveFilter(filter);
    
    // Auto-sort mapping for best viewing experience
    if (filter === 'revenue') {
      setSortBy('total');
      setSortOrder('desc');
    } else if (filter === 'sqm') {
      setSortBy('totalKv');
      setSortOrder('desc');
    } else {
      setSortBy('createdAt');
      setSortOrder('desc');
    }
    
    setIsDetailListOpen(true);
  };

  // Inspecting specific order
  const handleInspectOrder = (order: any) => {
    setSelectedOrder(order);
    setIsEditing(false);
    setEditingCustomer({
      name: order.customer?.name || '',
      phone: order.customer?.phone || '',
      address: order.customer?.address || '',
      date: order.customer?.date || ''
    });
    setEditingItems(order.items ? JSON.parse(JSON.stringify(order.items)) : []);
    setEditingManager({
      name: order.manager?.name || 'Dostonbek',
      phone: order.manager?.phone || '+998911200004'
    });
  };

  // Itemized automatic calculation for interactive edits
  const handleUpdateItem = (id: string, field: keyof OrderItem, value: any) => {
    setEditingItems(prevItems => prevItems.map(item => {
      if (item.id === id) {
        const updated = { ...item, [field]: value };
        
        const eniVal = String(updated.eni).replace(',', '.');
        const boyiVal = String(updated.boyi).replace(',', '.');
        const narxiVal = String(updated.narxi).replace(',', '.');

        const eni = parseFloat(eniVal) || 0;
        const boyi = parseFloat(boyiVal) || 0;
        const soni = parseInt(String(updated.soni)) || 0;
        const narxi = parseFloat(narxiVal) || 0;

        // Formula mirroring standard Jaluzi billing (with minimum area limit of 1.0 m2 per product unit)
        let rawArea = (eni * boyi) / 10000;
        if (eni > 0 && eni < 10 && boyi > 0 && boyi < 10) {
          rawArea = eni * boyi;
        }

        const areaPerUnit = rawArea > 0 ? Math.max(rawArea, 1.0) : 0;
        updated.kv = parseFloat(areaPerUnit.toFixed(2));
        
        const rowSum = soni * updated.kv * narxi;
        updated.summa = parseFloat(rowSum.toFixed(2));
        
        return updated;
      }
      return item;
    }));
  };

  // Removing item row in edit mode
  const handleRemoveItem = (id: string) => {
    setEditingItems(editingItems.filter(item => item.id !== id));
  };

  // Add item row in edit mode
  const handleAddItem = () => {
    const newItem: OrderItem = {
      id: Math.random().toString(36).substr(2, 9),
      eni: 0,
      boyi: 0,
      soni: 1,
      turi: '',
      narxi: 0,
      kv: 0,
      summa: 0
    };
    setEditingItems([...editingItems, newItem]);
  };

  // Compute calculated sums for the active edit formulation
  const editSummary = useMemo(() => {
    const totalQty = editingItems.reduce((sum, item) => sum + (parseInt(item.soni as any) || 0), 0);
    const totalKv = editingItems.reduce((sum, item) => sum + (item.kv * (parseInt(item.soni as any) || 0)), 0);
    const total = editingItems.reduce((sum, item) => sum + (parseFloat(item.summa as any) || 0), 0);
    
    return {
      totalQty,
      totalKv: parseFloat(totalKv.toFixed(2)),
      total: parseFloat(total.toFixed(2))
    };
  }, [editingItems]);

  // Save changes to Firestore
  const handleSaveChanges = async () => {
    if (!selectedOrder) return;
    if (!editingCustomer.name) {
      showToast("Xatolik: Mijoz F.I.O majburiy.");
      return;
    }
    if (editingItems.length === 0 || editingItems.every(i => i.eni === 0 || i.boyi === 0)) {
      showToast("Xatolik: Kamida bitta to'g'ri o'lchamlarga ega mahsulot bo'lishi lozim.");
      return;
    }

    setIsSaving(true);
    try {
      const updatedData = {
        customer: editingCustomer,
        items: editingItems,
        summary: editSummary,
        manager: editingManager,
        month: editingCustomer.date.substring(0, 7)
      };

      await updateItem('orders', selectedOrder.id, updatedData);
      
      // Update local inspected order representation
      setSelectedOrder({
        ...selectedOrder,
        ...updatedData
      });
      
      setOrders(prev => prev.map(o => o.id === selectedOrder.id ? { ...o, ...updatedData } : o));
      setIsEditing(false);
      showToast("Buyurtma hisoboti muvaffaqiyatli tahrirlandi!");
    } catch (err: any) {
      console.error("Delayed update error:", err);
      showToast("Xatolik yuz berdi: " + err.message);
    } finally {
      setIsSaving(false);
    }
  };

  // Delete order permanently
  const handleDeleteOrder = async () => {
    if (!selectedOrder) return;
    setIsSaving(true);
    try {
      await deleteItem('orders', selectedOrder.id);
      setOrders(prev => prev.filter(o => o.id !== selectedOrder.id));
      setSelectedOrder(null);
      setShowDeleteConfirm(false);
      setIsEditing(false);
      showToast("Buyurtma hisoboti butunlay o'chirib tashlandi.");
    } catch (err: any) {
      showToast("Xatolik yuz berdi: " + err.message);
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <div className="space-y-4 md:space-y-6 lg:space-y-10 p-3 sm:p-6 lg:p-8 animate-in fade-in duration-1000">
      
      {/* Header section */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h2 className="text-2xl sm:text-3xl lg:text-4xl font-black tracking-tight text-slate-900 leading-tight">
            Oylik <span className="text-indigo-600">Hisobotlar</span>
          </h2>
          <p className="text-xs sm:text-sm lg:text-base text-slate-500 mt-1 md:mt-2 font-medium">
            Sotuvlar va daromadlar tahlili. Bo'limlarni bosib batafsil ko'ring.
          </p>
        </div>
        <div className="flex items-center gap-3 glass px-4 py-2.5 sm:px-6 sm:py-3 rounded-xl sm:rounded-2xl border-white/60 shadow-sm self-start sm:self-auto">
          <Calendar size={16} className="text-indigo-500" />
          <input 
            type="month" 
            className="bg-transparent border-none outline-none font-black text-xs uppercase tracking-widest text-slate-900 focus:ring-0 cursor-pointer"
            value={selectedMonth}
            onChange={e => setSelectedMonth(e.target.value)}
          />
        </div>
      </div>

      {/* Interactive Stats Grid */}
      <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-4 sm:gap-6">
        
        {/* Card 1: Revenue */}
        <motion.div 
          onClick={() => openDetailList('revenue')}
          whileHover={{ scale: 1.02, y: -4 }}
          whileTap={{ scale: 0.98 }}
          className="glass p-5 sm:p-8 rounded-2xl sm:rounded-[2.5rem] border border-indigo-100 hover:border-indigo-300 transition-all cursor-pointer group shadow-md hover:shadow-xl relative overflow-hidden"
          title="Batafsil tahlil qilish uchun bosing"
        >
          <div className="absolute right-4 top-4 opacity-0 group-hover:opacity-100 transition-opacity text-indigo-400">
            <ArrowUpRight size={18} />
          </div>
          <div className="w-11 h-11 sm:w-12 sm:h-12 bg-indigo-600 rounded-xl sm:rounded-2xl flex items-center justify-center text-white shadow-xl shadow-indigo-100">
            <DollarSign size={20} />
          </div>
          <div className="mt-4">
            <p className="text-[9px] sm:text-[10px] font-black text-slate-400 uppercase tracking-widest">Jami Tushum</p>
            <p className="text-2xl sm:text-3xl font-black text-slate-900 mt-1">${monthlyStats.totalRevenue.toFixed(2)}</p>
          </div>
          <div className="flex items-center justify-between text-[9px] sm:text-[10px] font-bold mt-4">
            <span className="text-green-600 flex items-center gap-0.5">
              <TrendingUp size={12} /> +12.5% o'tgan oydan
            </span>
            <span className="text-indigo-500 group-hover:underline">Batafsil &rarr;</span>
          </div>
        </motion.div>

        {/* Card 2: Order volume */}
        <motion.div 
          onClick={() => openDetailList('orders')}
          whileHover={{ scale: 1.02, y: -4 }}
          whileTap={{ scale: 0.98 }}
          className="glass p-5 sm:p-8 rounded-2xl sm:rounded-[2.5rem] border border-indigo-100 hover:border-indigo-300 transition-all cursor-pointer group shadow-md hover:shadow-xl relative overflow-hidden"
          title="Batafsil tahlil qilish uchun bosing"
        >
          <div className="absolute right-4 top-4 opacity-0 group-hover:opacity-100 transition-opacity text-indigo-400">
            <ArrowUpRight size={18} />
          </div>
          <div className="w-11 h-11 sm:w-12 sm:h-12 bg-indigo-600 rounded-xl sm:rounded-2xl flex items-center justify-center text-white shadow-xl shadow-indigo-100">
            <Layers size={20} />
          </div>
          <div className="mt-4">
            <p className="text-[9px] sm:text-[10px] font-black text-slate-400 uppercase tracking-widest">Buyurtmalar Soni</p>
            <p className="text-2xl sm:text-3xl font-black text-slate-900 mt-1">{monthlyStats.orderCount}</p>
          </div>
          <div className="flex items-center justify-between text-[9px] sm:text-[10px] font-bold mt-4">
            <span className="text-green-600 flex items-center gap-0.5">
              <Check size={12} /> Yangi buyurtmalar kiritilgan
            </span>
            <span className="text-indigo-500 group-hover:underline">Batafsil &rarr;</span>
          </div>
        </motion.div>

        {/* Card 3: Square meters */}
        <motion.div 
          onClick={() => openDetailList('sqm')}
          whileHover={{ scale: 1.02, y: -4 }}
          whileTap={{ scale: 0.98 }}
          className="glass p-5 sm:p-8 rounded-2xl sm:rounded-[2.5rem] border border-indigo-100 hover:border-indigo-300 transition-all cursor-pointer group shadow-md hover:shadow-xl relative overflow-hidden"
          title="Batafsil tahlil qilish uchun bosing"
        >
          <div className="absolute right-4 top-4 opacity-0 group-hover:opacity-100 transition-opacity text-indigo-400">
            <ArrowUpRight size={18} />
          </div>
          <div className="w-11 h-11 sm:w-12 sm:h-12 bg-indigo-600 rounded-xl sm:rounded-2xl flex items-center justify-center text-white shadow-xl shadow-indigo-100">
            <TrendingUp size={20} />
          </div>
          <div className="mt-4">
            <p className="text-[9px] sm:text-[10px] font-black text-slate-400 uppercase tracking-widest">Umumiy m²</p>
            <p className="text-2xl sm:text-3xl font-black text-slate-900 mt-1">{monthlyStats.totalSqm.toFixed(2)} m²</p>
          </div>
          <div className="flex items-center justify-between text-[9px] sm:text-[10px] font-bold mt-4">
            <span className="text-indigo-600">
              O'rtacha {(monthlyStats.totalSqm / (monthlyStats.orderCount || 1)).toFixed(1)} m²/order
            </span>
            <span className="text-indigo-500 group-hover:underline">Batafsil &rarr;</span>
          </div>
        </motion.div>

        {/* Card 4: Average sale check */}
        <motion.div 
          onClick={() => openDetailList('avg_check')}
          whileHover={{ scale: 1.02, y: -4 }}
          whileTap={{ scale: 0.98 }}
          className="glass p-5 sm:p-8 rounded-2xl sm:rounded-[2.5rem] border border-indigo-100 hover:border-indigo-300 transition-all cursor-pointer group shadow-md hover:shadow-xl relative overflow-hidden"
          title="Batafsil tahlil qilish uchun bosing"
        >
          <div className="absolute right-4 top-4 opacity-0 group-hover:opacity-100 transition-opacity text-indigo-400">
            <ArrowUpRight size={18} />
          </div>
          <div className="w-11 h-11 sm:w-12 sm:h-12 bg-indigo-600 rounded-xl sm:rounded-2xl flex items-center justify-center text-white shadow-xl shadow-indigo-100">
            <BarChart3 size={20} />
          </div>
          <div className="mt-4">
            <p className="text-[9px] sm:text-[10px] font-black text-slate-400 uppercase tracking-widest">O'rtacha Chek</p>
            <p className="text-2xl sm:text-3xl font-black text-slate-900 mt-1">${monthlyStats.avgOrder.toFixed(2)}</p>
          </div>
          <div className="flex items-center justify-between text-[9px] sm:text-[10px] font-bold mt-4">
            <span className="text-slate-500">Filtr va qiyosiy tahlil</span>
            <span className="text-indigo-500 group-hover:underline">Batafsil &rarr;</span>
          </div>
        </motion.div>
      </div>

      <div className="grid grid-cols-1 xl:grid-cols-3 gap-8">
        
        {/* Dynamic Recharts Chart Area */}
        <div className="xl:col-span-2 glass p-10 rounded-[3rem] border border-white/40 min-h-[450px] flex flex-col shadow-sm">
          <div className="flex items-center justify-between mb-10">
            <div>
              <h3 className="text-xl font-black text-slate-900">Daromad Grafigi</h3>
              <p className="text-xs text-slate-400 font-bold uppercase tracking-widest mt-1">Kunlik tushum tahlili</p>
            </div>
            <div className="flex items-center gap-2">
              <div className="w-3 h-3 bg-indigo-600 rounded-full animate-pulse" />
              <span className="text-[10px] font-black uppercase tracking-widest text-slate-500">Real-time daromad</span>
            </div>
          </div>
          
          <div className="flex-1 w-full min-h-[350px]">
            {chartData.length === 0 ? (
              <div className="h-full flex flex-col items-center justify-center text-slate-400 opacity-40">
                <Clock size={40} className="mb-2" />
                <p className="text-xs font-black uppercase tracking-widest">Chart uchun yetarli ma'lumot yo'q</p>
              </div>
            ) : (
              <ResponsiveContainer width="100%" height={350}>
                <AreaChart data={chartData}>
                  <defs>
                    <linearGradient id="colorTotal" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%" stopColor="#4f46e5" stopOpacity={0.3}/>
                      <stop offset="95%" stopColor="#4f46e5" stopOpacity={0}/>
                    </linearGradient>
                  </defs>
                  <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f1f5f9" />
                  <XAxis 
                    dataKey="day" 
                    axisLine={false} 
                    tickLine={false} 
                    tick={{ fontSize: 10, fontWeight: 900, fill: '#94a3b8' }}
                    dy={10}
                  />
                  <YAxis 
                    axisLine={false} 
                    tickLine={false} 
                    tick={{ fontSize: 10, fontWeight: 900, fill: '#94a3b8' }}
                    tickFormatter={(val) => `$${val}`}
                  />
                  <Tooltip 
                    contentStyle={{ 
                      backgroundColor: 'rgba(255, 255, 255, 0.85)', 
                      backdropFilter: 'blur(10px)',
                      borderRadius: '20px',
                      border: '1px solid rgba(255,255,255,0.4)',
                      boxShadow: '0 20px 40px rgba(79, 70, 229, 0.1)',
                      padding: '12px 16px'
                    }}
                    labelStyle={{ fontWeight: 900, color: '#1e293b', paddingBottom: '4px' }}
                    itemStyle={{ fontWeight: 900, color: '#4f46e5' }}
                  />
                  <Area 
                    type="monotone" 
                    dataKey="total" 
                    stroke="#4f46e5" 
                    strokeWidth={4}
                    fillOpacity={1} 
                    fill="url(#colorTotal)" 
                  />
                </AreaChart>
              </ResponsiveContainer>
            )}
          </div>
        </div>

        {/* Recent Orders List Panel */}
        <div className="glass p-10 rounded-[3rem] border border-white/40 flex flex-col shadow-sm">
          <div className="flex justify-between items-center mb-8">
            <h3 className="text-xl font-black text-slate-900">So'nggi Zakazlar</h3>
            <span className="text-[10px] font-black bg-indigo-50 text-indigo-600 px-3 py-1 rounded-full uppercase tracking-wider">
              {orders.length} ta jami
            </span>
          </div>
          
          <div className="flex-1 space-y-6 overflow-y-auto pr-2 scrollbar-hide max-h-[380px]">
            {orders.length === 0 ? (
               <div className="h-full flex flex-col items-center justify-center text-center opacity-40">
                  <FileText size={48} className="mb-4 text-slate-300" />
                  <p className="text-xs font-black uppercase tracking-widest text-slate-400">Ma'lumotlar yo'q</p>
               </div>
            ) : (
              orders.slice(0, 7).map((o: any, idx) => (
                <motion.div 
                  initial={{ opacity: 0, x: 20 }}
                  animate={{ opacity: 1, x: 0 }}
                  transition={{ delay: idx * 0.05 }}
                  onClick={() => handleInspectOrder(o)}
                  key={o.id} 
                  className="flex items-center gap-4 group cursor-pointer hover:bg-slate-50/70 p-3 rounded-2xl transition-all"
                >
                  <div className="w-12 h-12 bg-white border border-slate-100 group-hover:bg-indigo-50 group-hover:border-indigo-100 rounded-xl flex items-center justify-center text-slate-400 group-hover:text-indigo-600 transition-all shrink-0 shadow-sm">
                    <User size={18} />
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-black text-slate-900 truncate tracking-tight">{o.customer?.name}</p>
                    <p className="text-[9px] text-slate-400 font-bold uppercase tracking-widest mt-0.5">{o.customer?.date}</p>
                  </div>
                  <div className="text-right shrink-0">
                    <p className="text-sm font-black text-slate-900 leading-none">${o.summary?.total?.toFixed(2)}</p>
                    <p className="text-[9px] text-slate-400 font-bold mt-1 uppercase tracking-widest">{o.summary?.totalKv?.toFixed(1)} m²</p>
                  </div>
                  <ChevronRight size={16} className="text-slate-200 group-hover:text-slate-500 transition-colors shrink-0" />
                </motion.div>
              ))
            )}
          </div>
          
          <button 
            onClick={() => openDetailList('all')}
            className="w-full py-4 mt-8 bg-indigo-50 border border-indigo-100 hover:border-indigo-200 text-indigo-600 rounded-2xl font-black text-[10px] uppercase tracking-widest hover:bg-indigo-100/50 transition-all active:scale-95 shadow-sm"
          >
             Barcha hisobotlar ({orders.length})
          </button>
        </div>
      </div>

      {/* Drill-Down Orders & Detail list modal */}
      <AnimatePresence>
        {isDetailListOpen && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4 lg:p-10">
            <motion.div 
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => setIsDetailListOpen(false)}
              className="absolute inset-0 bg-slate-900/40 backdrop-blur-md"
            />
            
            <motion.div 
              initial={{ scale: 0.95, opacity: 0, y: 30 }}
              animate={{ scale: 1, opacity: 1, y: 0 }}
              exit={{ scale: 0.95, opacity: 0, y: 30 }}
              className="relative bg-white/95 backdrop-blur-xl w-full max-w-5xl rounded-[3rem] p-6 lg:p-10 shadow-3xl border border-slate-200/50 h-[85vh] flex flex-col overflow-hidden max-h-[850px]"
            >
              
              {/* Modal header */}
              <div className="flex items-start justify-between gap-4 pb-6 border-b border-slate-100 shrink-0">
                <div>
                  <div className="flex items-center gap-2">
                    <span className="text-[10px] font-black uppercase tracking-widest bg-indigo-100 text-indigo-600 px-3 py-1 rounded-full">
                      {selectedMonth} Hisoboti
                    </span>
                    <span className="text-[10px] font-black uppercase tracking-widest bg-emerald-100 text-emerald-600 px-3 py-1 rounded-full">
                      {filteredOrders.length} ta topildi
                    </span>
                  </div>
                  <h3 className="text-2xl lg:text-3xl font-black text-slate-900 mt-2 tracking-tight">
                    {activeFilter === 'revenue' && "Jami Sotuvlar & Tushumlar"}
                    {activeFilter === 'orders' && "Ro'yxatdan o'tgan buyurtmalar"}
                    {activeFilter === 'sqm' && "Buyurtmalar hajmi (m² bo'yicha)"}
                    {activeFilter === 'avg_check' && "O'rtacha hisob tahlili"}
                    {activeFilter === 'all' && "Oylik buyurtmalar hisob-kitobi"}
                  </h3>
                  <p className="text-xs text-slate-500 mt-1 font-semibold">Tahrirlash va ko'rish uchun quyidagi buyurtmalardan birini tanlang.</p>
                </div>
                <button 
                  onClick={() => setIsDetailListOpen(false)}
                  className="p-3 bg-slate-100 hover:bg-slate-200 text-slate-500 hover:text-slate-800 rounded-2xl transition-all"
                >
                  <X size={20} />
                </button>
              </div>

              {/* Filtering / Search Sub-header bar */}
              <div className="flex flex-col md:flex-row items-stretch md:items-center justify-between gap-4 py-6 border-b border-slate-100 shrink-0 bg-slate-50/50 -mx-6 lg:-mx-10 px-6 lg:px-10">
                <div className="relative flex-1 max-w-md">
                  <Search className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400" size={16} />
                  <input 
                    type="text"
                    placeholder="Mijoz ismi, tel va manzil bo'yicha qidirish..."
                    className="w-full bg-white border border-slate-200 hover:border-indigo-100 focus:border-indigo-500 outline-none rounded-2xl pl-11 pr-5 py-3 text-xs font-bold transition-all placeholder:text-slate-300"
                    value={searchQuery}
                    onChange={e => setSearchQuery(e.target.value)}
                  />
                  {searchQuery && (
                    <button 
                      onClick={() => setSearchQuery('')}
                      className="absolute right-4 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-700"
                    >
                      <X size={14} />
                    </button>
                  )}
                </div>

                <div className="flex flex-wrap items-center gap-3">
                  <div className="flex items-center gap-1.5 text-xs font-black text-slate-500">
                    <ArrowUpDown size={14} className="text-slate-400" />
                    <span>Saralash:</span>
                  </div>
                  
                  {/* Sort keys checkboxes */}
                  <select
                    className="bg-white border border-slate-200 text-xs font-black text-slate-700 px-4 py-2.5 rounded-xl outline-none focus:border-indigo-500 cursor-pointer"
                    value={sortBy}
                    onChange={e => setSortBy(e.target.value as any)}
                  >
                    <option value="createdAt">Kiritilgan sana</option>
                    <option value="total">Jami summa ($)</option>
                    <option value="totalKv">Jami kvadrat (m²)</option>
                    <option value="totalQty">Dona soni</option>
                  </select>

                  <button
                    onClick={() => setSortOrder(prev => prev === 'asc' ? 'desc' : 'asc')}
                    className="p-2.5 bg-white border border-slate-200 hover:border-indigo-200 text-slate-600 hover:text-indigo-600 rounded-xl text-xs font-black uppercase tracking-widest transition-all shadow-sm"
                    title={sortOrder === 'desc' ? "Kamayish tartibida" : "O'sish tartibida"}
                  >
                    {sortOrder === 'desc' ? "▼ KAMAYISH" : "▲ O'SISH"}
                  </button>
                </div>
              </div>

              {/* Modal data list */}
              <div className="flex-1 overflow-y-auto scrollbar-hide py-4">
                {filteredOrders.length === 0 ? (
                  <div className="py-20 text-center opacity-50">
                    <AlertCircle className="mx-auto text-slate-300 mb-3 animate-bounce" size={40} />
                    <p className="text-xs font-black uppercase tracking-widest text-slate-400">Hech qanday buyurtma topilmadi</p>
                    <p className="text-xs text-slate-400 mt-1">Sana va qidiruv kalitini tekshirib ko'ring.</p>
                  </div>
                ) : (
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    {filteredOrders.map((o: any) => (
                      <motion.div 
                        key={o.id}
                        layoutId={`order-row-${o.id}`}
                        onClick={() => handleInspectOrder(o)}
                        whileHover={{ scale: 1.01, y: -2 }}
                        className="bg-white border border-slate-100 p-6 rounded-3xl hover:border-indigo-200 hover:shadow-xl transition-all cursor-pointer flex flex-col justify-between gap-4"
                      >
                        <div className="flex justify-between items-start gap-3">
                          <div className="min-w-0">
                            <span className="text-[9px] font-black px-2 py-0.5 bg-slate-100 text-slate-500 rounded-full uppercase tracking-wider">
                              ID: ...{o.id.substring(o.id.length - 6)}
                            </span>
                            <h4 className="text-sm font-black text-slate-900 mt-1 truncate tracking-tight">{o.customer?.name}</h4>
                            <p className="text-xs text-slate-500 flex items-center gap-1 mt-0.5 font-bold">
                              <Phone size={11} /> {o.customer?.phone || "Telefon kiritilmagan"}
                            </p>
                          </div>
                          <div className="text-right">
                            <p className="text-base font-black text-indigo-600">${o.summary?.total?.toFixed(2)}</p>
                            <p className="text-[10px] font-bold text-slate-400 mt-0.5 uppercase tracking-widest">{o.summary?.totalKv?.toFixed(2)} m²</p>
                          </div>
                        </div>

                        {/* Order item preview badges */}
                        <div className="flex flex-wrap gap-1.5 py-2 border-t border-b border-dashed border-slate-100">
                          {o.items?.slice(0, 3).map((item: any, i: number) => (
                            <span key={item.id || i} className="text-[9px] font-black bg-indigo-50/50 text-indigo-600 px-2 py-0.5 rounded-md border border-indigo-100/30">
                              {item.turi || "Mato"} ({item.eni}x{item.boyi})
                            </span>
                          ))}
                          {o.items?.length > 3 && (
                            <span className="text-[9px] font-black bg-slate-100 text-slate-500 px-2 py-0.5 rounded-md">
                              +{o.items.length - 3} yana
                            </span>
                          )}
                        </div>

                        <div className="flex justify-between items-center text-[10px] font-bold text-slate-400">
                          <span className="flex items-center gap-1 uppercase tracking-tight"><Clock size={11} /> {o.customer?.date}</span>
                          <span className="text-indigo-500 group-hover:underline flex items-center gap-0.5">Tahrirlash / Ko'rish &rarr;</span>
                        </div>
                      </motion.div>
                    ))}
                  </div>
                )}
              </div>
              
              <div className="pt-6 border-t border-slate-100 flex items-center justify-between shrink-0 bg-indigo-50/20 -mx-6 lg:-mx-10 px-6 lg:px-10 -mb-6 lg:-mb-10 py-5">
                <div className="flex items-center gap-2">
                  <Info size={16} className="text-indigo-500 shrink-0" />
                  <p className="text-[11px] font-bold text-slate-500 uppercase tracking-tight">Oylik jami hisob shakllantirilgan tizim ma'lumotlari.</p>
                </div>
                <button 
                  onClick={() => setIsDetailListOpen(false)}
                  className="px-6 py-3 bg-slate-900 hover:bg-slate-800 text-white font-black text-xs uppercase tracking-widest rounded-xl transition-all"
                >
                  Yopish
                </button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* Selected Order Detailed Inspector / Editor Drawer */}
      <AnimatePresence>
        {selectedOrder && (
          <div className="fixed inset-0 z-[100] flex items-center justify-end">
            
            {/* Backdrop */}
            <motion.div 
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => {
                if (!isEditing) setSelectedOrder(null);
              }}
              className="absolute inset-0 bg-slate-900/40 backdrop-blur-md"
            />
            
            {/* Drawer sheet container */}
            <motion.div 
              initial={{ x: "100%", opacity: 0.9 }}
              animate={{ x: 0, opacity: 1 }}
              exit={{ x: "100%", opacity: 0.9 }}
              transition={{ type: 'spring', damping: 25, stiffness: 200 }}
              className="relative bg-white w-full max-w-2xl h-full shadow-2xl flex flex-col border-l border-slate-200 overflow-hidden"
            >
              
              {/* Header block template */}
              <div className="p-8 pb-6 border-b border-slate-100 shrink-0 flex items-start justify-between gap-4 bg-slate-50/70">
                <div>
                  <div className="flex items-center gap-2">
                    <span className="text-[9px] font-black bg-indigo-100 text-indigo-600 px-2.5 py-1 rounded-full uppercase tracking-widest">
                      Buyurtma tafsiloti
                    </span>
                    <span className="text-[9px] font-black bg-slate-200 text-slate-700 px-2.5 py-1 rounded-full tracking-widest">
                      ID: {selectedOrder.id}
                    </span>
                  </div>
                  
                  <h3 className="text-2xl font-black text-slate-900 mt-2 tracking-tight">
                    {isEditing ? "Buyurtmani Tahrirlash" : selectedOrder.customer?.name}
                  </h3>
                  
                  {!isEditing && (
                    <p className="text-xs text-slate-400 font-bold uppercase tracking-widest mt-1 flex items-center gap-1.5">
                      <Clock size={12} className="text-slate-400" /> {selectedOrder.customer?.date}
                    </p>
                  )}
                </div>
                
                <button 
                  onClick={() => setSelectedOrder(null)}
                  disabled={isSaving}
                  className="p-3 hover:bg-slate-200 text-slate-400 hover:text-slate-800 rounded-2xl transition-all"
                >
                  <X size={20} />
                </button>
              </div>

              {/* Scrollable scroll sheet */}
              <div className="flex-1 overflow-y-auto p-8 space-y-6 scrollbar-hide">
                
                {/* 1. CUSTOMER INFORMATION BLOCK */}
                <div className="glass p-6 rounded-3xl border border-slate-100 space-y-4">
                  <div className="flex justify-between items-center pb-3 border-b border-slate-50">
                    <h4 className="text-xs font-black text-indigo-500 uppercase tracking-widest">Mijoz ma'lumotlari</h4>
                    {!isEditing && (
                      <span className="text-[10px] font-semibold text-slate-400">Tahrirlash rejimida ozgartira olasiz</span>
                    )}
                  </div>

                  {isEditing ? (
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                      
                      <div className="space-y-1">
                        <label className="text-[9px] font-black text-slate-400 uppercase tracking-widest ml-1">F.I.O</label>
                        <div className="relative">
                          <User size={14} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400" />
                          <input 
                            type="text"
                            className="bg-white border border-slate-200 rounded-xl pl-9 pr-4 py-2.5 text-xs font-bold outline-none w-full focus:border-indigo-500 transition-all"
                            value={editingCustomer.name}
                            onChange={e => setEditingCustomer({...editingCustomer, name: e.target.value})}
                          />
                        </div>
                      </div>

                      <div className="space-y-1">
                        <label className="text-[9px] font-black text-slate-400 uppercase tracking-widest ml-1">Telefon</label>
                        <div className="relative">
                          <Phone size={14} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400" />
                          <input 
                            type="text"
                            className="bg-white border border-slate-200 rounded-xl pl-9 pr-4 py-2.5 text-xs font-bold outline-none w-full focus:border-indigo-500 transition-all"
                            value={editingCustomer.phone}
                            onChange={e => setEditingCustomer({...editingCustomer, phone: e.target.value})}
                          />
                        </div>
                      </div>

                      <div className="space-y-1">
                        <label className="text-[9px] font-black text-slate-400 uppercase tracking-widest ml-1">Manzil</label>
                        <div className="relative">
                          <MapPin size={14} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400" />
                          <input 
                            type="text"
                            className="bg-white border border-slate-200 rounded-xl pl-9 pr-4 py-2.5 text-xs font-bold outline-none w-full focus:border-indigo-500 transition-all"
                            value={editingCustomer.address}
                            onChange={e => setEditingCustomer({...editingCustomer, address: e.target.value})}
                          />
                        </div>
                      </div>

                      <div className="space-y-1">
                        <label className="text-[9px] font-black text-slate-400 uppercase tracking-widest ml-1">Sana</label>
                        <div className="relative">
                          <Calendar size={14} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400" />
                          <input 
                            type="date"
                            className="bg-white border border-slate-200 rounded-xl pl-9 pr-4 py-2.5 text-xs font-bold outline-none w-full focus:border-indigo-500 transition-all"
                            value={editingCustomer.date}
                            onChange={e => setEditingCustomer({...editingCustomer, date: e.target.value})}
                          />
                        </div>
                      </div>

                    </div>
                  ) : (
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 text-xs font-bold text-slate-650">
                      <div className="flex items-center gap-2">
                        <User size={14} className="text-slate-400 shrink-0" />
                        <span>F.I.O: <span className="text-slate-900 font-extrabold">{selectedOrder.customer?.name}</span></span>
                      </div>
                      <div className="flex items-center gap-2">
                        <Phone size={14} className="text-slate-400 shrink-0" />
                        <span>Tel: <span className="text-slate-900 font-extrabold">{selectedOrder.customer?.phone || "Nomalum"}</span></span>
                      </div>
                      <div className="flex items-center gap-2">
                        <MapPin size={14} className="text-slate-400 shrink-0" />
                        <span>Manzil: <span className="text-slate-900 font-extrabold">{selectedOrder.customer?.address || "Nomalum"}</span></span>
                      </div>
                      <div className="flex items-center gap-2">
                        <Calendar size={14} className="text-slate-400 shrink-0" />
                        <span>Sana: <span className="text-slate-900 font-extrabold">{selectedOrder.customer?.date}</span></span>
                      </div>
                    </div>
                  )}
                </div>

                {/* 2. ORDER ITEMS & MATERIALS TABLE */}
                <div className="glass p-6 rounded-3xl border border-slate-100 space-y-4">
                  <div className="flex justify-between items-center pb-3 border-b border-slate-50">
                    <h4 className="text-xs font-black text-indigo-500 uppercase tracking-widest">Buyurtmadagi mahsulotlar</h4>
                    {isEditing && (
                      <button 
                        onClick={handleAddItem}
                        className="px-4 py-2 bg-indigo-600 text-white rounded-xl font-black text-[9px] uppercase tracking-wider hover:bg-indigo-500 transition-all flex items-center gap-1 shadow-md shadow-indigo-100"
                      >
                        <Plus size={11} strokeWidth={3} /> Qoshish
                      </button>
                    )}
                  </div>

                  <div className="overflow-x-auto scrollbar-hide py-1">
                    <table className="w-full min-w-[500px] text-xs">
                      <thead>
                        <tr className="border-b border-slate-100 text-[9px] font-black text-slate-400 uppercase tracking-widest">
                          <th className="pb-3 text-left w-24">Turi (Nomi)</th>
                          <th className="pb-3 text-center w-16">Eni (sm)</th>
                          <th className="pb-3 text-center w-16">Bo'yi (sm)</th>
                          <th className="pb-3 text-center w-12">Soni</th>
                          <th className="pb-3 text-center w-20">Narhi ($/m²)</th>
                          <th className="pb-3 text-center w-16">Jami m²</th>
                          <th className="pb-3 text-right">Summa ($)</th>
                          {isEditing && <th className="pb-3 text-right w-10"></th>}
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-slate-50">
                        {(isEditing ? editingItems : selectedOrder.items || []).map((item: any, idx: number) => (
                          <tr key={item.id || idx} className="hover:bg-slate-50/50 transition-colors">
                            <td className="py-3 font-semibold">
                              {isEditing ? (
                                <input 
                                  type="text"
                                  className="w-full bg-white border border-slate-200 rounded-lg px-2 py-1 text-xs font-extrabold outline-none focus:border-indigo-500"
                                  value={item.turi}
                                  onChange={e => handleUpdateItem(item.id, 'turi', e.target.value)}
                                />
                              ) : (
                                <span className="font-extrabold text-slate-900">{item.turi || "Mato"}</span>
                              )}
                            </td>
                            <td className="py-3 text-center font-bold">
                              {isEditing ? (
                                <input 
                                  type="number"
                                  className="w-14 bg-white border border-slate-200 rounded-lg px-2 py-1 text-xs font-extrabold text-center outline-none focus:border-indigo-500"
                                  value={item.eni || ''}
                                  onChange={e => handleUpdateItem(item.id, 'eni', e.target.value)}
                                />
                              ) : (
                                item.eni
                              )}
                            </td>
                            <td className="py-3 text-center font-bold">
                              {isEditing ? (
                                <input 
                                  type="number"
                                  className="w-14 bg-white border border-slate-200 rounded-lg px-2 py-1 text-xs font-extrabold text-center outline-none focus:border-indigo-500"
                                  value={item.boyi || ''}
                                  onChange={e => handleUpdateItem(item.id, 'boyi', e.target.value)}
                                />
                              ) : (
                                item.boyi
                              )}
                            </td>
                            <td className="py-3 text-center font-bold">
                              {isEditing ? (
                                <input 
                                  type="number"
                                  className="w-12 bg-white border border-slate-200 rounded-lg px-1 py-1 text-xs font-extrabold text-center outline-none focus:border-indigo-500"
                                  value={item.soni || ''}
                                  onChange={e => handleUpdateItem(item.id, 'soni', e.target.value)}
                                />
                              ) : (
                                item.soni
                              )}
                            </td>
                            <td className="py-3 text-center font-extrabold">
                              {isEditing ? (
                                <input 
                                  type="number"
                                  step="0.01"
                                  className="w-16 bg-white border border-slate-200 rounded-lg px-2 py-1 text-xs font-extrabold text-center outline-none focus:border-indigo-500"
                                  value={item.narxi || ''}
                                  onChange={e => handleUpdateItem(item.id, 'narxi', e.target.value)}
                                />
                              ) : (
                                `$${parseFloat(item.narxi || 0).toFixed(2)}`
                              )}
                            </td>
                            <td className="py-3 text-center text-indigo-600 font-extrabold">
                              {/* Jami kvadrat value calculation for item summary row */}
                              {((item.kv || 0) * (item.soni || 0)).toFixed(2)} m²
                            </td>
                            <td className="py-3 text-right text-slate-900 font-black">
                              ${parseFloat(item.summa || 0).toLocaleString()}
                            </td>
                            {isEditing && (
                              <td className="py-3 text-right">
                                <button 
                                  onClick={() => handleRemoveItem(item.id)}
                                  className="p-1.5 text-slate-300 hover:text-red-500 rounded-lg hover:bg-red-50 transition-all"
                                  title="O'chirish"
                                >
                                  <Trash2 size={13} />
                                </button>
                              </td>
                            )}
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>

                  {/* Summary row */}
                  <div className="pt-4 border-t border-slate-100 flex items-center justify-between text-xs bg-slate-50/50 p-4 rounded-2xl">
                    <div className="space-y-0.5">
                      <p className="text-slate-400 font-bold uppercase tracking-widest text-[9px]">Jami Mahsulotlar</p>
                      <p className="font-extrabold text-slate-900">
                        {isEditing ? editSummary.totalQty : selectedOrder.summary?.totalQty} dona 
                        <span className="text-slate-300 mx-2">|</span> 
                        {isEditing ? editSummary.totalKv : selectedOrder.summary?.totalKv} m²
                      </p>
                    </div>
                    <div className="text-right">
                      <p className="text-indigo-600 font-bold uppercase tracking-widest text-[9px]">Umumiy hisob ($)</p>
                      <p className="text-xl font-black text-slate-900">
                        ${isEditing ? editSummary.total.toFixed(2) : selectedOrder.summary?.total?.toFixed(2)}
                      </p>
                    </div>
                  </div>
                </div>

                {/* 3. MANAGER INFO SECURE */}
                <div className="glass p-6 rounded-3xl border border-slate-100 space-y-4">
                  <h4 className="text-xs font-black text-indigo-500 uppercase tracking-widest pb-3 border-b border-slate-50">Mas'ul xodim</h4>
                  
                  {isEditing ? (
                    <div className="grid grid-cols-2 gap-4">
                      <div className="space-y-1">
                        <label className="text-[9px] font-black text-slate-400 uppercase tracking-widest ml-1">Menejer Ismi</label>
                        <div className="relative">
                          <Briefcase size={14} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400" />
                          <input 
                            type="text"
                            className="bg-white border border-slate-200 rounded-xl pl-9 pr-4 py-2.5 text-xs font-bold outline-none w-full focus:border-indigo-500 transition-all"
                            value={editingManager.name}
                            onChange={e => setEditingManager({...editingManager, name: e.target.value})}
                          />
                        </div>
                      </div>
                      <div className="space-y-1">
                        <label className="text-[9px] font-black text-slate-400 uppercase tracking-widest ml-1">Telefon raqami</label>
                        <div className="relative">
                          <Phone size={14} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400" />
                          <input 
                            type="text"
                            className="bg-white border border-slate-200 rounded-xl pl-9 pr-4 py-2.5 text-xs font-bold outline-none w-full focus:border-indigo-500 transition-all"
                            value={editingManager.phone}
                            onChange={e => setEditingManager({...editingManager, phone: e.target.value})}
                          />
                        </div>
                      </div>
                    </div>
                  ) : (
                    <div className="flex items-center justify-between text-xs font-bold">
                      <span className="text-slate-650 flex items-center gap-2">
                        <Briefcase size={14} className="text-slate-400" />
                        <span>Menejer: <span className="text-slate-900 font-extrabold">{selectedOrder.manager?.name || "Dostonbek"}</span></span>
                      </span>
                      <span className="text-slate-650 flex items-center gap-2">
                        <Phone size={14} className="text-slate-400" />
                        <span>Aloqa: <span className="text-slate-900 font-extrabold">{selectedOrder.manager?.phone || "+998911200004"}</span></span>
                      </span>
                    </div>
                  )}
                </div>

              </div>

              {/* Action operations shelf */}
              <div className="p-8 border-t border-slate-100 bg-slate-50 shrink-0 flex items-center justify-between gap-4">
                
                {isEditing ? (
                  <>
                    <button 
                      onClick={() => setIsEditing(false)}
                      disabled={isSaving}
                      className="px-6 py-4 border border-slate-200 text-slate-600 rounded-2xl font-black text-xs uppercase tracking-widest hover:bg-slate-100 transition-all disabled:opacity-50"
                    >
                      Bekor qilish
                    </button>
                    <div className="flex gap-3">
                      <button 
                        onClick={() => setShowDeleteConfirm(true)}
                        disabled={isSaving}
                        className="px-4 py-4 bg-red-50 hover:bg-red-100 text-red-600 rounded-2xl transition-all"
                        title="Buyurtmani butunlay o'chirish"
                      >
                        <Trash2 size={18} />
                      </button>
                      <button 
                        onClick={handleSaveChanges}
                        disabled={isSaving}
                        className="px-8 py-4 bg-indigo-600 hover:bg-indigo-500 text-white rounded-2xl font-black text-xs uppercase tracking-widest transition-all shadow-xl shadow-indigo-100 flex items-center gap-2 disabled:opacity-50"
                      >
                        {isSaving ? <Loader2 size={16} className="animate-spin" /> : <Check size={16} />}
                        Saqlash
                      </button>
                    </div>
                  </>
                ) : (
                  <>
                    <button 
                      onClick={() => setSelectedOrder(null)}
                      className="px-6 py-4 border border-slate-200 text-slate-600 rounded-2xl font-black text-xs uppercase tracking-widest hover:bg-slate-100 transition-all"
                    >
                      Yopish
                    </button>
                    <div className="flex gap-3">
                      <button 
                        onClick={() => setShowDeleteConfirm(true)}
                        className="px-6 py-4 border border-red-200 text-red-600 hover:bg-red-50 rounded-2xl font-black text-xs uppercase tracking-widest transition-all"
                      >
                        O'chirish
                      </button>
                      
                      <button 
                        onClick={() => setIsEditing(true)}
                        className="px-8 py-4 bg-slate-900 hover:bg-slate-800 text-white rounded-2xl font-black text-xs uppercase tracking-widest transition-all shadow-xl flex items-center gap-2"
                      >
                        <Pencil size={14} />
                        Tahrirlash (Ozgartirish)
                      </button>
                    </div>
                  </>
                )}
                
              </div>

              {/* Secure delete warning confirmation */}
              <AnimatePresence>
                {showDeleteConfirm && (
                  <div className="absolute inset-0 z-[110] flex items-center justify-center p-6 bg-slate-900/60 backdrop-blur-md">
                    <motion.div 
                      initial={{ scale: 0.95, opacity: 0 }}
                      animate={{ scale: 1, opacity: 1 }}
                      exit={{ scale: 0.95, opacity: 0 }}
                      className="bg-white w-full max-w-sm rounded-[2.5rem] p-8 shadow-2xl text-center border border-slate-200"
                    >
                      <div className="w-16 h-16 bg-red-100 text-red-600 rounded-full flex items-center justify-center mx-auto mb-5">
                        <AlertCircle size={32} />
                      </div>
                      <h4 className="text-xl font-black text-slate-900 tracking-tight">Buyurtmani o'chirish?</h4>
                      <p className="text-xs text-slate-500 font-semibold mt-2 leading-relaxed">
                        Ushbu buyurtmani o'chirganingizdan so'ng, uning ma'lumotlari umumiy oylik hisobot va daromaddan butunlay o'chiriladi. Ushbu amalni ortga qaytarib bo'lmaydi!
                      </p>
                      
                      <div className="flex gap-3 mt-8">
                        <button 
                          onClick={() => setShowDeleteConfirm(false)}
                          disabled={isSaving}
                          className="flex-1 py-3.5 bg-slate-100 text-slate-600 rounded-xl font-black text-xs uppercase tracking-widest hover:bg-slate-200 transition-all disabled:opacity-50"
                        >
                          Ortga
                        </button>
                        <button 
                          onClick={handleDeleteOrder}
                          disabled={isSaving}
                          className="flex-1 py-3.5 bg-red-600 text-white rounded-xl font-black text-xs uppercase tracking-widest hover:bg-red-500 transition-all shadow-lg shadow-red-100 flex items-center justify-center gap-1.5 disabled:opacity-50"
                        >
                          {isSaving && <Loader2 size={14} className="animate-spin" />}
                          O'chirish
                        </button>
                      </div>
                    </motion.div>
                  </div>
                )}
              </AnimatePresence>

            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* Real-time elegant success toast notification */}
      <AnimatePresence>
        {toastMsg && (
          <motion.div 
            initial={{ opacity: 0, y: 50, scale: 0.9 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, scale: 0.9 }}
            className="fixed bottom-10 left-1/2 -translate-x-1/2 bg-slate-900 border border-slate-800 text-white px-8 py-5 rounded-[2rem] shadow-2xl flex items-center gap-3.5 z-[1000] max-w-md w-full"
          >
            <div className="w-10 h-10 bg-indigo-600 rounded-2xl flex items-center justify-center text-white shrink-0 shadow-lg shadow-indigo-500/20">
              <Check size={20} strokeWidth={3} />
            </div>
            <div className="min-w-0 flex-1">
              <p className="font-black text-xs uppercase tracking-wider text-slate-200">Hisobotlar tizimi</p>
              <p className="text-xs text-slate-400 mt-0.5 truncate font-semibold leading-tight">{toastMsg}</p>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

    </div>
  );
}
