import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { 
  Plus, 
  Trash2, 
  FileText, 
  Download, 
  Save, 
  User, 
  Phone, 
  MapPin, 
  Calendar,
  CheckCircle2,
  Loader2,
  Printer
} from 'lucide-react';
import { cn } from '@/src/lib/utils';
import { createItem } from '@/src/lib/api';
import { jsPDF } from 'jspdf';
import autoTable from 'jspdf-autotable';
import { Document, Packer, Paragraph, Table, TableRow, TableCell, WidthType, AlignmentType, HeadingLevel, TextRun } from 'docx';
import { saveAs } from 'file-saver';

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

export default function Orders() {
  const [customer, setCustomer] = useState({
    name: '',
    phone: '',
    address: '',
    date: new Date().toISOString().split('T')[0]
  });

  const [items, setItems] = useState<OrderItem[]>([]);
  const [isSaving, setIsSaving] = useState(false);
  const [isSuccess, setIsSuccess] = useState(false);
  const [showExportConfirm, setShowExportConfirm] = useState(false);
  const [showFormatSelect, setShowFormatSelect] = useState(false);
  const [managerInfo, setManagerInfo] = useState({ name: 'Dostonbek', phone: '+998911200004' });

  const addItem = () => {
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
    setItems([...items, newItem]);
  };

  const updateItem = (id: string, field: keyof OrderItem, value: any) => {
    setItems(prevItems => prevItems.map(item => {
      if (item.id === id) {
        // Preserve the raw input value in the state so the user can continue typing (e.g., decimal points)
        // while calculating with numeric equivalents
        const updated = { ...item, [field]: value };
        
        // Convert everything to numbers for computation
        // We replace commas with dots to support both formats (e.g. 1.5 or 1,5)
        const eniVal = String(updated.eni).replace(',', '.');
        const boyiVal = String(updated.boyi).replace(',', '.');
        const narxiVal = String(updated.narxi).replace(',', '.');

        const eni = parseFloat(eniVal) || 0;
        const boyi = parseFloat(boyiVal) || 0;
        const soni = parseInt(String(updated.soni)) || 0;
        const narxi = parseFloat(narxiVal) || 0;

        // Standard Window Blinds (Jaluzi) Calculation Logic:
        // Area (m2) = (Eni * Bo'yi) / 10000
        // Usually, there is a minimum area (typically 1.0 m2 or 1.5 m2)
        // because even tiny windows have a base cost.
        let rawArea = (eni * boyi) / 10000;
        
        // If the area is extremely small (less than 0.1), maybe they entered METERS instead of CM
        // Let's check for small values and adjust
        if (eni > 0 && eni < 10 && boyi > 0 && boyi < 10) {
          rawArea = eni * boyi;
        }

        // Apply minimum 1.0 m2 logic (standard for the industry)
        const areaPerUnit = rawArea > 0 ? Math.max(rawArea, 1.0) : 0;
        
        // Update the item with calculated values
        updated.kv = parseFloat(areaPerUnit.toFixed(2));
        
        // Total row sum: Soni * Area * Price
        const rowSum = soni * updated.kv * narxi;
        updated.summa = parseFloat(rowSum.toFixed(2));
        
        return updated;
      }
      return item;
    }));
  };

  const handleKeyDown = (e: React.KeyboardEvent, index: number, field: string) => {
    if (e.key === 'Enter') {
      e.preventDefault();
      if (index === items.length - 1) {
        addItem();
      } else {
        // Find next input in same column if possible, or just focus first of next row
        const nextInput = document.querySelector(`tr:nth-child(${index + 2}) input`) as HTMLElement;
        if (nextInput) nextInput.focus();
      }
    }
  };

  const removeItem = (id: string) => {
    setItems(items.filter(item => item.id !== id));
  };

  useEffect(() => {
    if (items.length === 0) {
      addItem();
    }
  }, []);

  const [advancePayment, setAdvancePayment] = useState<string>('0');

  const totalQty = items.reduce((sum, item) => sum + (parseInt(item.soni as any) || 0), 0);
  const totalKv = items.reduce((sum, item) => sum + (item.kv * (parseInt(item.soni as any) || 0)), 0);
  const total = items.reduce((sum, item) => sum + (parseFloat(item.summa as any) || 0), 0);
  
  const advance = parseFloat(advancePayment.replace(',', '.')) || 0;
  const remainingBalance = total - advance;

  const [error, setError] = useState<string | null>(null);

  const startExportFlow = () => {
    if (!customer.name) {
      setError("Iltimos, mijoz ismini kiriting.");
      setTimeout(() => setError(null), 3000);
      return;
    }
    if (items.length === 0 || items.every(i => i.eni === 0 || i.boyi === 0)) {
      setError("Iltimos, kamida bitta mahsulot o'lchamlarini kiriting.");
      setTimeout(() => setError(null), 3000);
      return;
    }
    setShowExportConfirm(true);
  };

  const handleSave = async () => {
    setIsSaving(true);
    try {
      await createItem('orders', {
        customer,
        items,
        summary: {
          totalQty,
          totalKv: parseFloat(totalKv.toFixed(2)),
          total
        },
        manager: managerInfo,
        createdAt: new Date().toISOString(),
        month: customer.date.substring(0, 7) // Store month for reports
      });

      setIsSuccess(true);
      setTimeout(() => setIsSuccess(false), 3000);
      setShowExportConfirm(false);
      setShowFormatSelect(false);
    } catch (error: any) {
      console.error("Order save error:", error);
      alert("Buyurtmani saqlashda xatolik yuz berdi: " + error.message);
    } finally {
      setIsSaving(false);
    }
  };

  const exportPDF = () => {
    const doc = new jsPDF() as any;
    
    // Header
    doc.setTextColor(255, 0, 0); // Red color
    doc.setFontSize(26);
    doc.setFont(undefined, 'bold');
    doc.text("BESHBOLA JALUZI", 105, 20, { align: 'center' });
    
    doc.setTextColor(0, 0, 0); // Back to black
    doc.setFontSize(16);
    doc.setFont(undefined, 'normal');
    doc.text("HISOB-KITOB VARAQASI", 105, 30, { align: 'center' });
    
    doc.setFontSize(12);
    doc.text(`Mijoz: ${customer.name}`, 20, 45);
    doc.text(`Tel: ${customer.phone}`, 20, 52);
    doc.text(`Manzil: ${customer.address}`, 20, 59);
    doc.text(`Sana: ${customer.date}`, 20, 66);

    const tableData = items.map((item, index) => [
      index + 1,
      item.eni,
      item.boyi,
      item.soni,
      item.turi,
      item.narxi,
      (item.kv * item.soni).toFixed(2),
      item.summa
    ]);

    autoTable(doc, {
      startY: 75,
      head: [['T/R', 'Eni', 'Bo\'yi', 'Soni', 'Jalyuzi turi', 'Narxi', 'Jami m²', 'Summa ($)']],
      body: tableData,
      theme: 'grid',
      headStyles: { fillColor: [79, 70, 229], halign: 'center' },
      styles: { fontSize: 10, halign: 'center' },
      columnStyles: {
        4: { halign: 'left' },
      }
    });

    const finalY = (doc as any).lastAutoTable.finalY + 15;
    doc.setFontSize(11);
    doc.text(`Jami dona: ${totalQty} dona`, 20, finalY);
    doc.text(`Umumiy kvadrat: ${totalKv.toFixed(2)} m2`, 20, finalY + 7);
    doc.setFontSize(13);
    doc.setFont(undefined, 'bold');
    doc.text(`JAMI SUMMA: ${total.toFixed(2)} $`, 20, finalY + 17);
    doc.setFontSize(11);
    doc.text(`OLDINDAN TOLOV: ${advance.toFixed(2)} $`, 20, finalY + 25);
    doc.setTextColor(255, 0, 0);
    doc.setFontSize(13);
    doc.text(`QOLGAN TOLOV: ${remainingBalance.toFixed(2)} $`, 20, finalY + 35);
    doc.setTextColor(0, 0, 0);

    doc.setFontSize(11);
    doc.setFont(undefined, 'normal');
    doc.text(`Menejer: ${managerInfo.name}`, 20, finalY + 48);
    doc.text(`Tel: ${managerInfo.phone}`, 20, finalY + 55);

    doc.save(`Hisob_kitob_${customer.name}_${customer.date}.pdf`);
    handleSave();
  };

  const exportWord = () => {
    const doc = new Document({
      sections: [{
        properties: {},
        children: [
          new Paragraph({
            alignment: AlignmentType.CENTER,
            children: [
              new TextRun({
                text: "BESHBOLA JALUZI",
                color: "FF0000",
                bold: true,
                size: 52,
              }),
            ],
          }),
          new Paragraph({
            text: "HISOB-KITOB VARAQASI",
            alignment: AlignmentType.CENTER,
            heading: HeadingLevel.HEADING_2,
            spacing: { after: 400 },
          }),
          new Paragraph({
            children: [
              new TextRun({ text: `Mijoz: ${customer.name}`, bold: true }),
            ],
          }),
          new Paragraph(`Tel: ${customer.phone}`),
          new Paragraph(`Manzil: ${customer.address}`),
          new Paragraph({ text: `Sana: ${customer.date}`, spacing: { after: 400 } }),
          
          new Table({
            width: { size: 100, type: WidthType.PERCENTAGE },
            rows: [
              new TableRow({
                children: [
                  new TableCell({ children: [new Paragraph({ children: [new TextRun({ text: "T/R", bold: true })] })] }),
                  new TableCell({ children: [new Paragraph({ children: [new TextRun({ text: "Eni", bold: true })] })] }),
                  new TableCell({ children: [new Paragraph({ children: [new TextRun({ text: "Bo'yi", bold: true })] })] }),
                  new TableCell({ children: [new Paragraph({ children: [new TextRun({ text: "Soni", bold: true })] })] }),
                  new TableCell({ children: [new Paragraph({ children: [new TextRun({ text: "Turi", bold: true })] })] }),
                  new TableCell({ children: [new Paragraph({ children: [new TextRun({ text: "Narxi ($)", bold: true })] })] }),
                  new TableCell({ children: [new Paragraph({ children: [new TextRun({ text: "Jami m2", bold: true })] })] }),
                  new TableCell({ children: [new Paragraph({ children: [new TextRun({ text: "Summa ($)", bold: true })] })] }),
                ]
              }),
              ...items.map((item, index) => new TableRow({
                children: [
                  new TableCell({ children: [new Paragraph((index + 1).toString())] }),
                  new TableCell({ children: [new Paragraph(item.eni.toString())] }),
                  new TableCell({ children: [new Paragraph(item.boyi.toString())] }),
                  new TableCell({ children: [new Paragraph(item.soni.toString())] }),
                  new TableCell({ children: [new Paragraph(item.turi)] }),
                  new TableCell({ children: [new Paragraph(item.narxi.toString())] }),
                  new TableCell({ children: [new Paragraph((item.kv * item.soni).toFixed(2))] }),
                  new TableCell({ children: [new Paragraph(item.summa.toString())] }),
                ]
              }))
            ]
          }),

          new Paragraph({ text: `\nJami dona: ${totalQty} dona`, spacing: { before: 400 } }),
          new Paragraph(`Umumiy kvadrat: ${totalKv.toFixed(2)} m2`),
          new Paragraph({
            children: [
              new TextRun({ text: `JAMI SUMMA: ${total.toFixed(2)} $`, bold: true, size: 28 }),
            ],
            spacing: { before: 200 }
          }),
          new Paragraph({
            children: [
              new TextRun({ text: `OLDINDAN TO'LOV: ${advance.toFixed(2)} $`, bold: true, size: 24 }),
            ],
          }),
          new Paragraph({
            children: [
              new TextRun({ text: `QOLGAN TO'LOV: ${remainingBalance.toFixed(2)} $`, bold: true, size: 32, color: "FF0000" }),
            ],
            spacing: { before: 200 }
          }),

          new Paragraph({ text: `\nMenejer: ${managerInfo.name}`, spacing: { before: 400 } }),
          new Paragraph(`Tel: ${managerInfo.phone}`),
        ],
      }],
    });

    Packer.toBlob(doc).then((blob) => {
      saveAs(blob, `Hisob_kitob_${customer.name}_${customer.date}.docx`);
      handleSave();
    });
  };

  return (
    <div className="space-y-6 lg:space-y-10 lg:p-8 animate-in fade-in duration-1000">
      <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-6">
        <div>
          <h2 className="text-3xl lg:text-4xl font-black tracking-tight text-slate-900 leading-tight">Hisob-kitob <span className="text-indigo-600">Varaqasi</span></h2>
          <p className="text-sm lg:text-base text-slate-500 mt-2 font-medium">Yangi buyurtma hisob-kitobini yaratish va saqlash.</p>
        </div>
        <div className="flex gap-3">
          <button 
            onClick={startExportFlow}
            disabled={isSaving}
            className="h-14 px-8 bg-slate-900 text-white rounded-2xl font-black text-sm tracking-tight hover:bg-slate-800 active:scale-95 shadow-2xl transition-all flex items-center justify-center gap-3 disabled:opacity-50"
          >
            {isSaving ? <Loader2 size={20} className="animate-spin" /> : <Save size={20} />}
            <span>Saqlash</span>
          </button>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
        {/* Customer Form */}
        <div className="lg:col-span-1 space-y-6">
          <div className="glass p-8 rounded-[2.5rem] border border-white/40 space-y-6">
            <h3 className="text-xl font-black text-slate-900 mb-2">Mijoz Ma'lumotlari</h3>
            
            <div className="space-y-4">
              <div className="space-y-2">
                <label className="text-[10px] font-black text-indigo-400 uppercase tracking-widest ml-1">F.I.O</label>
                <div className="relative">
                  <User className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400" size={18} />
                  <input 
                    type="text" 
                    placeholder="Mijoz ismi..."
                    className="w-full bg-white/50 border border-white/60 rounded-2xl pl-12 pr-6 py-4 text-sm font-bold focus:ring-2 focus:ring-indigo-500 outline-none transition-all placeholder:text-slate-300"
                    value={customer.name}
                    onChange={e => setCustomer({...customer, name: e.target.value})}
                  />
                </div>
              </div>

              <div className="space-y-2">
                <label className="text-[10px] font-black text-indigo-400 uppercase tracking-widest ml-1">Telefon</label>
                <div className="relative">
                  <Phone className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400" size={18} />
                  <input 
                    type="text" 
                    placeholder="+998..."
                    className="w-full bg-white/50 border border-white/60 rounded-2xl pl-12 pr-6 py-4 text-sm font-bold focus:ring-2 focus:ring-indigo-500 outline-none transition-all placeholder:text-slate-300"
                    value={customer.phone}
                    onChange={e => setCustomer({...customer, phone: e.target.value})}
                  />
                </div>
              </div>

              <div className="space-y-2">
                <label className="text-[10px] font-black text-indigo-400 uppercase tracking-widest ml-1">Manzil</label>
                <div className="relative">
                  <MapPin className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400" size={18} />
                  <input 
                    type="text" 
                    placeholder="Shahar, tuman..."
                    className="w-full bg-white/50 border border-white/60 rounded-2xl pl-12 pr-6 py-4 text-sm font-bold focus:ring-2 focus:ring-indigo-500 outline-none transition-all placeholder:text-slate-300"
                    value={customer.address}
                    onChange={e => setCustomer({...customer, address: e.target.value})}
                  />
                </div>
              </div>

              <div className="space-y-2">
                <label className="text-[10px] font-black text-indigo-400 uppercase tracking-widest ml-1">Sana</label>
                <div className="relative">
                  <Calendar className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400" size={18} />
                  <input 
                    type="date" 
                    className="w-full bg-white/50 border border-white/60 rounded-2xl pl-12 pr-6 py-4 text-sm font-bold focus:ring-2 focus:ring-indigo-500 outline-none transition-all"
                    value={customer.date}
                    onChange={e => setCustomer({...customer, date: e.target.value})}
                  />
                </div>
              </div>
            </div>
          </div>

          <div className="glass p-8 rounded-[2.5rem] border border-white/40 space-y-4">
            <div className="flex justify-between items-center text-sm font-bold text-slate-500">
              <span>Jami dona</span>
              <span className="text-slate-900 font-black">{totalQty} dona</span>
            </div>
            <div className="flex justify-between items-center text-sm font-bold text-slate-500">
              <span>Umumiy m²</span>
              <span className="text-slate-900 font-black">{totalKv.toFixed(2)} m²</span>
            </div>
            
            <div className="pt-4 border-t border-slate-100 space-y-4">
              <div className="flex justify-between items-center">
                <span className="text-sm font-bold text-slate-500 uppercase tracking-tight">Jami Summa</span>
                <span className="text-xl font-black text-slate-900">${total.toLocaleString(undefined, {minimumFractionDigits: 2, maximumFractionDigits: 2})}</span>
              </div>
              
              <div className="space-y-2">
                <label className="text-[10px] font-black text-indigo-400 uppercase tracking-widest ml-1">Berilgan Summa (Oldindan)</label>
                <div className="relative">
                  <span className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400 font-bold">$</span>
                  <input 
                    type="text" 
                    placeholder="0.00"
                    className="w-full bg-indigo-50/50 border border-indigo-100 rounded-2xl pl-10 pr-6 py-3 text-sm font-bold focus:ring-2 focus:ring-indigo-500 outline-none transition-all placeholder:text-slate-300"
                    value={advancePayment}
                    onChange={e => setAdvancePayment(e.target.value)}
                  />
                </div>
              </div>

              <div className="pt-4 border-t border-slate-100 flex justify-between items-center bg-indigo-50/30 -mx-8 px-8 py-4">
                <span className="text-base font-black text-slate-900 uppercase tracking-tight">Qolgan To'lov</span>
                <span className="text-2xl font-black text-red-600">${remainingBalance.toLocaleString(undefined, {minimumFractionDigits: 2, maximumFractionDigits: 2})}</span>
              </div>
            </div>
          </div>
        </div>

        {/* Table Area */}
        <div className="lg:col-span-2 glass p-8 rounded-[2.5rem] border border-white/40 overflow-hidden flex flex-col">
          <div className="flex items-center justify-between mb-8">
            <h3 className="text-xl font-black text-slate-900">Mahsulotlar Jadvali</h3>
            <button 
              onClick={addItem}
              className="px-6 py-3 bg-indigo-600 text-white rounded-2xl font-black text-xs uppercase tracking-widest hover:bg-indigo-500 active:scale-95 transition-all flex items-center gap-2 shadow-xl shadow-indigo-100"
            >
              <Plus size={16} strokeWidth={3} />
              Qator qo'shish
            </button>
          </div>

          <div className="flex-1 overflow-x-auto scrollbar-hide">
            <table className="w-full min-w-[850px]">
              <thead>
                <tr className="border-b border-slate-100">
                  <th className="pb-4 text-left text-[10px] font-black text-slate-400 uppercase tracking-widest pl-2">Eni (sm/m)</th>
                  <th className="pb-4 text-left text-[10px] font-black text-slate-400 uppercase tracking-widest">Bo'yi (sm/m)</th>
                  <th className="pb-4 text-left text-[10px] font-black text-slate-400 uppercase tracking-widest w-20">Soni</th>
                  <th className="pb-4 text-left text-[10px] font-black text-slate-400 uppercase tracking-widest">Turi (Nomi)</th>
                  <th className="pb-4 text-left text-[10px] font-black text-slate-400 uppercase tracking-widest">Narh ($/m²)</th>
                  <th className="pb-4 text-left text-[10px] font-black text-slate-400 uppercase tracking-widest">Jami m²</th>
                  <th className="pb-4 text-left text-[10px] font-black text-slate-400 uppercase tracking-widest">Summa ($)</th>
                  <th className="pb-4 text-right pr-2"></th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-50">
                {items.map((item, idx) => (
                  <tr key={item.id} className="group hover:bg-slate-50/50 transition-colors">
                    <td className="py-4 pl-2">
                      <input 
                        type="number" 
                        step="0.1"
                        className="w-20 bg-white border border-slate-100 hover:border-indigo-200 focus:border-indigo-500 rounded-xl px-3 py-2.5 text-xs font-bold outline-none transition-all shadow-sm"
                        placeholder="0"
                        value={item.eni || ''}
                        onChange={e => updateItem(item.id, 'eni', e.target.value)}
                        onKeyDown={e => handleKeyDown(e, idx, 'eni')}
                      />
                    </td>
                    <td className="py-4">
                      <input 
                        type="number" 
                        step="0.1"
                        className="w-20 bg-white border border-slate-100 hover:border-indigo-200 focus:border-indigo-500 rounded-xl px-3 py-2.5 text-xs font-bold outline-none transition-all shadow-sm"
                        placeholder="0"
                        value={item.boyi || ''}
                        onChange={e => updateItem(item.id, 'boyi', e.target.value)}
                        onKeyDown={e => handleKeyDown(e, idx, 'boyi')}
                      />
                    </td>
                    <td className="py-4">
                      <input 
                        type="number" 
                        className="w-16 bg-white border border-slate-100 hover:border-indigo-200 focus:border-indigo-500 rounded-xl px-3 py-2.5 text-xs font-bold outline-none transition-all shadow-sm"
                        placeholder="1"
                        value={item.soni || ''}
                        onChange={e => updateItem(item.id, 'soni', e.target.value)}
                        onKeyDown={e => handleKeyDown(e, idx, 'soni')}
                      />
                    </td>
                    <td className="py-4">
                      <input 
                        type="text" 
                        className="w-40 bg-white border border-slate-100 hover:border-indigo-200 focus:border-indigo-500 rounded-xl px-4 py-2.5 text-xs font-bold outline-none transition-all shadow-sm"
                        placeholder="Mahsulot turi..."
                        value={item.turi}
                        onChange={e => updateItem(item.id, 'turi', e.target.value)}
                        onKeyDown={e => handleKeyDown(e, idx, 'turi')}
                      />
                    </td>
                    <td className="py-4">
                      <input 
                        type="number" 
                        step="0.01"
                        className="w-24 bg-white border border-slate-100 hover:border-indigo-200 focus:border-indigo-500 rounded-xl px-3 py-2.5 text-xs font-bold outline-none transition-all shadow-sm"
                        placeholder="0.00"
                        value={item.narxi || ''}
                        onChange={e => updateItem(item.id, 'narxi', e.target.value)}
                        onKeyDown={e => handleKeyDown(e, idx, 'narxi')}
                      />
                    </td>
                    <td className="py-4">
                      <div className="flex flex-col">
                        <span className="text-[12px] font-black text-indigo-600">
                          {(item.kv * item.soni).toFixed(2)} m²
                        </span>
                        <span className="text-[9px] text-slate-400 font-bold uppercase tracking-tighter">({item.kv} m²/dona)</span>
                      </div>
                    </td>
                    <td className="py-4">
                      <span className="text-[13px] font-black text-slate-900">
                        ${item.summa.toLocaleString()}
                      </span>
                    </td>
                    <td className="py-4 pr-2 text-right">
                      <button 
                        onClick={() => removeItem(item.id)}
                        className="p-2.5 text-slate-300 hover:text-red-500 hover:bg-red-50 rounded-xl transition-all"
                      >
                        <Trash2 size={16} />
                      </button>
                    </td>
                  </tr>
                ))}
                {items.length > 0 && (
                  <>
                    <tr className="bg-slate-50/50 font-black">
                      <td colSpan={5} className="py-6 pl-2 text-right text-[10px] text-slate-400 uppercase tracking-widest">Jami:</td>
                      <td className="py-6">
                        <div className="flex flex-col">
                          <span className="text-sm text-indigo-600">{totalKv.toFixed(2)} m²</span>
                        </div>
                      </td>
                      <td colSpan={2} className="py-6 text-base text-slate-900">${total.toLocaleString(undefined, {minimumFractionDigits: 2, maximumFractionDigits: 2})}</td>
                    </tr>
                    <tr>
                      <td colSpan={8} className="py-4">
                        <button 
                          onClick={addItem}
                          className="w-full py-4 border-2 border-dashed border-slate-100 rounded-2xl text-slate-400 hover:text-indigo-600 hover:border-indigo-200 hover:bg-indigo-50/30 transition-all flex items-center justify-center gap-2 font-black text-xs uppercase tracking-widest"
                        >
                          <Plus size={16} />
                          Yangi qator qo'shish
                        </button>
                      </td>
                    </tr>
                  </>
                )}
              </tbody>
            </table>
            {items.length === 0 && (
              <div className="py-20 text-center">
                <FileText size={48} className="mx-auto text-slate-200 mb-4" />
                <p className="text-sm font-bold text-slate-400 uppercase tracking-widest">Jadval bo'sh. Mahsulot qo'shing.</p>
              </div>
            )}

            {items.length > 0 && (
              <div className="mt-10 flex justify-end">
                <button 
                  onClick={startExportFlow}
                  className="px-10 py-5 bg-slate-900 text-white rounded-2xl font-black text-sm tracking-tight hover:bg-slate-800 transition-all shadow-2xl flex items-center gap-3"
                >
                  <Save size={20} />
                  HISOBNI YAKUNLASH VA SAQLASH
                </button>
              </div>
            )}
          </div>
        </div>
      </div>

      <AnimatePresence>
        {showExportConfirm && (
          <div className="fixed inset-0 z-[110] flex items-center justify-center p-4">
            <motion.div 
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => setShowExportConfirm(false)}
              className="absolute inset-0 bg-slate-900/40 backdrop-blur-md"
            />
            <motion.div 
              initial={{ scale: 0.9, opacity: 0, y: 40 }}
              animate={{ scale: 1, opacity: 1, y: 0 }}
              exit={{ scale: 0.9, opacity: 0, y: 40 }}
              className="relative glass-dark w-full max-w-md rounded-[3rem] p-10 shadow-2xl border border-white/20 text-center"
            >
              <div className="w-20 h-20 bg-white/10 rounded-full flex items-center justify-center mx-auto mb-6">
                <FileText size={32} className="text-white" />
              </div>
              <h3 className="text-2xl font-black text-white mb-4 tracking-tight">Hujjatni saqlash</h3>
              <p className="text-slate-400 font-medium mb-10 leading-relaxed">
                Hujjatni PDF yoki Word formatiga o'tkazib saqlashni xohlaysizmi?
              </p>
              <div className="flex gap-4">
                <button 
                  onClick={() => {
                    setShowExportConfirm(false);
                    handleSave();
                  }}
                  className="flex-1 py-5 glass border-white/10 text-white rounded-2xl font-black text-sm uppercase tracking-widest hover:bg-white/10 transition-all font-mono"
                >
                  YO'Q
                </button>
                <button 
                  onClick={() => {
                    setShowExportConfirm(false);
                    setShowFormatSelect(true);
                  }}
                  className="flex-1 py-5 bg-indigo-600 text-white rounded-2xl font-black text-sm uppercase tracking-widest hover:bg-indigo-500 transition-all shadow-xl shadow-indigo-600/20 font-mono"
                >
                  XA
                </button>
              </div>
            </motion.div>
          </div>
        )}

        {showFormatSelect && (
          <div className="fixed inset-0 z-[110] flex items-center justify-center p-4">
            <motion.div 
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => setShowFormatSelect(false)}
              className="absolute inset-0 bg-slate-900/40 backdrop-blur-md"
            />
            <motion.div 
              initial={{ scale: 0.9, opacity: 0, y: 40 }}
              animate={{ scale: 1, opacity: 1, y: 0 }}
              exit={{ scale: 0.9, opacity: 0, y: 40 }}
              className="relative glass-dark w-full max-w-md rounded-[3rem] p-10 shadow-2xl border border-white/20 text-center"
            >
              <h3 className="text-2xl font-black text-white mb-4 tracking-tight">Formatni tanlang</h3>
              <p className="text-slate-400 font-medium mb-10 leading-relaxed">
                Qaysi formatda saqlashni afzal ko'rasiz?
              </p>
              <div className="grid grid-cols-2 gap-6">
                <button 
                  onClick={exportPDF}
                  className="flex flex-col items-center justify-center gap-4 py-8 glass border-white/10 text-white rounded-3xl hover:bg-white/10 transition-all"
                >
                  <Printer size={32} />
                  <span className="font-black text-xs uppercase tracking-widest">PDF</span>
                </button>
                <button 
                  onClick={exportWord}
                  className="flex flex-col items-center justify-center gap-4 py-8 glass border-white/10 text-white rounded-3xl hover:bg-white/10 transition-all"
                >
                  <FileText size={32} />
                  <span className="font-black text-xs uppercase tracking-widest">WORD</span>
                </button>
              </div>
              <button 
                onClick={() => setShowFormatSelect(false)}
                className="mt-8 text-slate-500 font-black text-[10px] uppercase tracking-widest hover:text-white transition-colors"
              >
                Bekor qilish
              </button>
            </motion.div>
          </div>
        )}

        {isSuccess && (
          <motion.div 
            initial={{ opacity: 0, y: 50 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.8 }}
            className="fixed bottom-10 left-1/2 -translate-x-1/2 glass px-10 py-6 rounded-[2rem] border border-green-200 shadow-2xl flex items-center gap-4 z-[100]"
          >
            <div className="w-12 h-12 bg-green-500 rounded-2xl flex items-center justify-center text-white shadow-xl shadow-green-100">
              <CheckCircle2 size={24} strokeWidth={3} />
            </div>
            <div>
              <p className="font-black text-slate-900 uppercase tracking-tight">Muvaffaqiyatli!</p>
              <p className="text-xs text-slate-500 font-medium">Buyurtma ombor va hisobga saqlandi.</p>
            </div>
          </motion.div>
        )}

        {error && (
          <motion.div 
            initial={{ opacity: 0, y: 50 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.8 }}
            className="fixed bottom-10 left-1/2 -translate-x-1/2 bg-red-600 text-white px-8 py-5 rounded-[2rem] shadow-2xl flex items-center gap-4 z-[100]"
          >
            <div className="w-10 h-10 bg-white/20 rounded-xl flex items-center justify-center">
              <Plus size={20} className="rotate-45" />
            </div>
            <p className="font-black text-sm uppercase tracking-tight">{error}</p>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
