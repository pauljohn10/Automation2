/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState } from 'react';
import { useFuelSystem } from '../context';
import { FuelStation, FuelGrade, SalesTransaction } from '../types';
import { BarChart, TrendingUp, AlertTriangle, Coins, Filter, Calendar, Layers, FileDown, ChevronDown, ChevronUp } from 'lucide-react';
import { jsPDF } from 'jspdf';
import 'jspdf-autotable';

export const ReportDashboard: React.FC = () => {
  const { transactions, stations, tanks, session } = useFuelSystem();
  
  // States
  const [selectedGradeFilter, setSelectedGradeFilter] = useState<string>('ALL');
  const [timeRange, setTimeRange] = useState<'TODAY' | 'WEEK' | 'MONTH'>('TODAY');

  // Advanced PDF export filter states
  const [isExportOpen, setIsExportOpen] = useState(false);
  const [pdfStartDate, setPdfStartDate] = useState(() => {
    const d = new Date();
    d.setDate(d.getDate() - 30); // default last 30 days
    return d.toISOString().split('T')[0];
  });
  const [pdfEndDate, setPdfEndDate] = useState(() => new Date().toISOString().split('T')[0]);
  const [pdfStationFilter, setPdfStationFilter] = useState('ALL');
  const [pdfGradeFilter, setPdfGradeFilter] = useState('ALL');
  const [pdfPumpFilter, setPdfPumpFilter] = useState('ALL');
  const [pdfNozzleFilter, setPdfNozzleFilter] = useState('ALL');
  const [pdfCashierFilter, setPdfCashierFilter] = useState('');
  const [pdfShiftFilter, setPdfShiftFilter] = useState('ALL');
  const [pdfPaymentFilter, setPdfPaymentFilter] = useState('ALL');
  const [pdfStatusFilter, setPdfStatusFilter] = useState('ALL');

  const [customPaymentMethodsList] = useState<string[]>(() => {
    try {
      const saved = localStorage.getItem('custom_payment_methods');
      return saved ? JSON.parse(saved) : [];
    } catch {
      return [];
    }
  });

  const parseTxDate = (tsString: string): Date => {
    if (tsString.includes('-') && tsString.includes('T')) {
      return new Date(tsString);
    }
    const currentYear = new Date().getFullYear();
    const match = tsString.match(/(\d{2})\/(\d{2})\s+(\d{2}):(\d{2})/);
    if (match) {
      const month = parseInt(match[1]) - 1;
      const day = parseInt(match[2]);
      const hour = parseInt(match[3]);
      const minute = parseInt(match[4]);
      return new Date(currentYear, month, day, hour, minute);
    }
    return new Date(tsString);
  };

  const exportPDFReport = () => {
    const filteredTxs = transactions.filter(tx => {
      // 1. Station Filter
      if (!isHQ) {
        if (tx.stationId !== session.activeStationId) return false;
      } else {
        if (pdfStationFilter !== 'ALL' && tx.stationId !== pdfStationFilter) return false;
      }

      // 2. Date Range Filter
      const txDate = parseTxDate(tx.timestamp);
      const start = new Date(pdfStartDate + 'T00:00:00');
      const end = new Date(pdfEndDate + 'T23:59:59');
      if (txDate < start || txDate > end) return false;

      // 3. Fuel Grade Filter
      if (pdfGradeFilter !== 'ALL' && tx.fuelType !== pdfGradeFilter) return false;

      // 4. Pump Filter
      if (pdfPumpFilter !== 'ALL') {
        const matchesPump = tx.pumpId.toLowerCase().includes(pdfPumpFilter.toLowerCase());
        if (!matchesPump) return false;
      }

      // 5. Nozzle Filter
      if (pdfNozzleFilter !== 'ALL') {
        const matchesNozzle = tx.nozzleId && tx.nozzleId.toLowerCase().includes(pdfNozzleFilter.toLowerCase());
        if (!matchesNozzle) return false;
      }

      // 6. Cashier / Operator Filter
      if (pdfCashierFilter.trim() !== '') {
        if (!tx.operator || !tx.operator.toLowerCase().includes(pdfCashierFilter.toLowerCase())) return false;
      }

      // 7. Shift Filter
      if (pdfShiftFilter !== 'ALL') {
        if (!tx.shift || tx.shift.toLowerCase() !== pdfShiftFilter.toLowerCase()) return false;
      }

      // 8. Payment Method Filter
      if (pdfPaymentFilter !== 'ALL') {
        if (pdfPaymentFilter === 'UNPAID') {
          if (tx.paymentMethod) return false;
        } else {
          if (tx.paymentMethod !== pdfPaymentFilter) return false;
        }
      }

      // 9. Status Filter
      if (pdfStatusFilter !== 'ALL' && tx.status !== pdfStatusFilter) return false;

      return true;
    });

    const totalCount = filteredTxs.length;
    const totalVolume = filteredTxs.reduce((sum, tx) => sum + tx.volume, 0);
    const totalGross = filteredTxs.reduce((sum, tx) => sum + tx.amount, 0);
    const totalDiscount = filteredTxs.reduce((sum, tx) => sum + (tx.discount || 0), 0);
    const totalVat = filteredTxs.reduce((sum, tx) => sum + (tx.vat || 0), 0);
    const grandTotal = totalGross;

    const doc = new jsPDF({ orientation: 'landscape', unit: 'mm', format: 'a4' });
    const primaryColor = [108, 93, 211];
    const textColor = [30, 41, 59];
    const margin = 15;
    const pageWidth = doc.internal.pageSize.width;
    const pageHeight = doc.internal.pageSize.height;

    // Draw header bar
    doc.setFillColor(30, 41, 59);
    doc.rect(0, 0, pageWidth, 22, 'F');
    doc.setTextColor(255, 255, 255);
    doc.setFont('Helvetica', 'bold');
    doc.setFontSize(14);
    doc.text('NOOR FUEL AUTOMATION - COMPREHENSIVE SALES REPORT', margin, 10);
    
    doc.setFont('Helvetica', 'normal');
    doc.setFontSize(8);
    doc.setTextColor(203, 213, 225);
    const activeStationName = pdfStationFilter !== 'ALL' 
      ? stations.find(s => s.id === pdfStationFilter)?.name || pdfStationFilter
      : 'Global HQ Context';
    doc.text(`Station: ${activeStationName}  |  Exported: ${new Date().toLocaleString()}`, margin, 15);

    // Filters context
    doc.setTextColor(textColor[0], textColor[1], textColor[2]);
    doc.setFont('Helvetica', 'bold');
    doc.setFontSize(9);
    doc.text('REPORT FILTER SETTINGS:', margin, 30);
    
    doc.setFont('Helvetica', 'normal');
    doc.setFontSize(8);
    doc.text(`Date Range: ${pdfStartDate} to ${pdfEndDate}`, margin, 35);
    doc.text(`Fuel Grade: ${pdfGradeFilter}`, margin + 80, 35);
    doc.text(`Shift: ${pdfShiftFilter}`, margin + 140, 35);
    doc.text(`Payment Method: ${pdfPaymentFilter}`, margin, 40);
    doc.text(`Cashier Name: ${pdfCashierFilter || 'ALL'}`, margin + 80, 40);
    doc.text(`Transaction Status: ${pdfStatusFilter}`, margin + 140, 40);

    // Summary Box
    doc.setFillColor(248, 250, 252);
    doc.setDrawColor(226, 232, 240);
    doc.roundedRect(margin, 45, pageWidth - (margin * 2), 22, 2, 2, 'FD');
    
    doc.setFont('Helvetica', 'bold');
    doc.setFontSize(8);
    doc.setTextColor(100, 116, 139);
    doc.text('TOTAL TRANSACTIONS', margin + 5, 51);
    doc.text('TOTAL VOLUME SOLD', margin + 50, 51);
    doc.text('TOTAL GROSS SALES', margin + 100, 51);
    doc.text('TOTAL VAT COLLECTED', margin + 150, 51);
    doc.text('TOTAL DISCOUNTS', margin + 200, 51);
    doc.text('GRAND TOTAL SALES', margin + 240, 51);

    doc.setTextColor(textColor[0], textColor[1], textColor[2]);
    doc.setFontSize(11);
    doc.setFont('Helvetica', 'bold');
    doc.text(totalCount.toString(), margin + 5, 59);
    doc.text(`${totalVolume.toFixed(2)} L`, margin + 50, 59);
    doc.text(`SAR ${totalGross.toFixed(2)}`, margin + 100, 59);
    doc.text(`SAR ${totalVat.toFixed(2)}`, margin + 150, 59);
    doc.text(`SAR ${totalDiscount.toFixed(2)}`, margin + 200, 59);
    
    doc.setTextColor(16, 185, 129);
    doc.text(`SAR ${grandTotal.toFixed(2)}`, margin + 240, 59);

    doc.setTextColor(textColor[0], textColor[1], textColor[2]);
    doc.setFont('Helvetica', 'bold');
    doc.setFontSize(9);
    doc.text('DETAILED TRANSACTION LEDGER:', margin, 74);

    const tableColumns = [
      'Ref Code', 'Station', 'Timestamp', 'Nozzle', 'Product', 'Volume', 'Price', 'Gross', 'Disc', 'VAT', 'Net', 'Payment', 'Cashier', 'Shift'
    ];
    
    const tableRows = filteredTxs.map(tx => {
      const stationName = stations.find(s => s.id === tx.stationId)?.name.split('-')[0].trim() || 'Default';
      const gross = tx.amount + (tx.discount || 0);
      return [
        `#${tx.id.replace('tx-sale-', '').replace('tx-', '')}`,
        stationName,
        tx.timestamp,
        tx.nozzleId || tx.pumpId.slice(-2),
        tx.fuelType,
        `${tx.volume.toFixed(1)} L`,
        `SAR ${tx.pricePerLitre.toFixed(2)}`,
        `SAR ${gross.toFixed(2)}`,
        `SAR ${(tx.discount || 0).toFixed(2)}`,
        `SAR ${(tx.vat || 0).toFixed(2)}`,
        `SAR ${(tx.netAmount || (tx.amount - (tx.vat || 0))).toFixed(2)}`,
        tx.paymentMethod || 'UNPAID',
        tx.operator || 'Attendant',
        tx.shift || 'Shift 1'
      ];
    });

    (doc as any).autoTable({
      startY: 77,
      head: [tableColumns],
      body: tableRows,
      theme: 'grid',
      styles: {
        fontSize: 7,
        cellPadding: 1.5,
        font: 'Helvetica',
        textColor: [51, 65, 85]
      },
      headStyles: {
        fillColor: primaryColor,
        textColor: [255, 255, 255],
        fontStyle: 'bold',
        halign: 'center'
      },
      columnStyles: {
        0: { fontStyle: 'bold' },
        5: { halign: 'right' },
        6: { halign: 'right' },
        7: { halign: 'right' },
        8: { halign: 'right' },
        9: { halign: 'right' },
        10: { halign: 'right' }
      },
      margin: { left: margin, right: margin },
      didDrawPage: (data: any) => {
        doc.setFont('Helvetica', 'normal');
        doc.setFontSize(7);
        doc.setTextColor(148, 163, 184);
        const pageNum = data.pageNumber;
        doc.text(`Page ${pageNum}`, pageWidth - margin - 15, pageHeight - 8);
        doc.text('NOOR FUEL ERP AUTOMATION - SECURITY & INVENTORY SYNCED', margin, pageHeight - 8);
      }
    });

    doc.save(`Sales_Report_${pdfStartDate}_to_${pdfEndDate}.pdf`);
  };

  const isHQ = (session.role === 'SUPER_ADMIN' || session.role === 'ADMIN' || session.role === 'VIEWER') && !session.isStationContext;

  // Filter transaction records by context (global for HQ vs localized for single station)
  const contextTx = transactions.filter(tx => {
    if (!isHQ && tx.stationId !== session.activeStationId) return false;
    if (tx.status !== 'FINISHED') return false; // only finished sales/replenishments counted
    if (selectedGradeFilter !== 'ALL' && tx.fuelType !== selectedGradeFilter) return false;
    return true;
  });

  // Calculate high value metrics
  const totalVolume = contextTx.reduce((sum, tx) => sum + tx.volume, 0);
  const totalRevenue = contextTx.reduce((sum, tx) => sum + tx.amount, 0);
  
  // Under the SaaS model we can assume a solid fuel margin (e.g., KSA average margins around 0.15 SAR/Litre)
  const averageMarginPerLitre = 0.15;
  const estimatedProfit = totalVolume * averageMarginPerLitre;

  // Compile volume per fuel grade for a stunning inline SVG chart
  const gradeVolumeMap: Record<FuelGrade, number> = {
    GAS91: 0,
    GAS95: 0,
    GAS98: 0,
    DIESEL: 0
  };

  contextTx.forEach(tx => {
    if (tx.fuelType in gradeVolumeMap) {
      gradeVolumeMap[tx.fuelType] += tx.volume;
    }
  });

  // Max volume for scaling chart
  const maxGradeVol = Math.max(...Object.values(gradeVolumeMap), 100);

  // Cross-station performance compilation (HQ SUPER_ADMIN only)
  const stationPerformanceList = stations.map(station => {
    const stationSpecificTx = transactions.filter(tx => tx.stationId === station.id && tx.status === 'FINISHED');
    const vol = stationSpecificTx.reduce((sum, tx) => sum + tx.volume, 0);
    const rev = stationSpecificTx.reduce((sum, tx) => sum + tx.amount, 0);
    
    // Calculate aggregate capacity of tanks
    const stationTanks = tanks.filter(t => t.stationId === station.id);
    const totalCap = stationTanks.reduce((sum, t) => sum + t.capacity, 0);
    const currentFuel = stationTanks.reduce((sum, t) => sum + t.currentLevel, 0);
    const storagePct = totalCap > 0 ? (currentFuel / totalCap) * 100 : 0;

    return {
      ...station,
      volumeSold: vol,
      revenueGenerated: rev,
      storagePercentage: storagePct
    };
  });

  const maxRevenue = Math.max(...stationPerformanceList.map(s => s.revenueGenerated), 100);

  return (
    <div className="p-6 space-y-6 bg-slate-50 min-h-[calc(100vh-64px)] font-sans text-left">
      {/* Title & Filters */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 bg-white p-5 rounded-xl border border-slate-200">
        <div>
          <h3 className="text-sm font-black text-slate-800 tracking-tight uppercase flex items-center gap-2">
            <BarChart size={18} className="text-[#6c5dd3]" />
            {isHQ ? 'Global Operations ERP Registry & Margins' : 'Local Station Flow Logs & Analytics'}
          </h3>
          <p className="text-xs text-slate-500 mt-1">
            {isHQ 
              ? 'Aggregated performance charts, pricing indices, and volume distribution metrics compiled across all active tenants.' 
              : 'Detailed local statistics, ullage room forecasts, and fuel grade sales velocity charts.'}
          </p>
        </div>

        {/* Filtering Controls */}
        <div className="flex flex-wrap items-center gap-2.5">
          {/* Time range */}
          <div className="flex bg-[#f1f3f9] border border-slate-200 p-1 rounded-lg text-xs font-semibold">
            <button 
              onClick={() => setTimeRange('TODAY')}
              className={`px-3 py-1 rounded-md transition-colors ${timeRange === 'TODAY' ? 'bg-white text-slate-800 shadow-3xs' : 'text-slate-500 hover:text-slate-700'}`}
            >
              Today
            </button>
            <button 
              onClick={() => setTimeRange('WEEK')}
              className={`px-3 py-1 rounded-md transition-colors ${timeRange === 'WEEK' ? 'bg-white text-slate-800 shadow-3xs' : 'text-slate-500 hover:text-slate-700'}`}
            >
              7 Days
            </button>
            <button 
              onClick={() => setTimeRange('MONTH')}
              className={`px-3 py-1 rounded-md transition-colors ${timeRange === 'MONTH' ? 'bg-white text-slate-800 shadow-3xs' : 'text-slate-500 hover:text-slate-700'}`}
            >
              30 Days
            </button>
          </div>

          {/* Fuel grade */}
          <select 
            value={selectedGradeFilter}
            onChange={(e) => setSelectedGradeFilter(e.target.value)}
            className="text-xs font-bold bg-white border border-slate-200 rounded-lg px-2.5 py-1.5 focus:outline-none"
          >
            <option value="ALL">All Fuel Grades</option>
            <option value="GAS91">GAS91</option>
            <option value="GAS95">GAS95</option>
            <option value="GAS98">GAS98</option>
            <option value="DIESEL">Diesel</option>
          </select>
        </div>
      </div>

      {/* High-Impact Numerical KPI Matrix */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        <div className="bg-white border border-slate-200 rounded-xl p-5 shadow-2xs">
          <div className="text-[11px] font-black text-slate-400 tracking-widest uppercase">Aggregated Volume Sold</div>
          <div className="text-2xl font-mono font-black text-slate-800 mt-2">
            {totalVolume.toLocaleString(undefined, { minimumFractionDigits: 1, maximumFractionDigits: 1 })} L
          </div>
          <div className="flex items-center gap-1.5 text-[10px] text-emerald-600 font-bold mt-2">
            <TrendingUp size={12} />
            <span>Telemetry flow meters validated</span>
          </div>
        </div>

        <div className="bg-white border border-slate-200 rounded-xl p-5 shadow-2xs">
          <div className="text-[11px] font-black text-slate-400 tracking-widest uppercase">Aggregate Cash Flow</div>
          <div className="text-2xl font-mono font-black text-slate-800 mt-2">
            SAR {totalRevenue.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
          </div>
          <div className="flex items-center gap-1.5 text-[10px] text-[#6c5dd3] font-bold mt-2">
            <Coins size={12} />
            <span>Avg ticket: SAR {(totalVolume > 0 ? totalRevenue / (contextTx.length || 1) : 0).toFixed(2)}</span>
          </div>
        </div>

        <div className="bg-white border border-slate-200 rounded-xl p-5 shadow-2xs">
          <div className="text-[11px] font-black text-slate-400 tracking-widest uppercase">Estimated SaaS Platform Margin</div>
          <div className="text-2xl font-mono font-black text-slate-800 mt-2">
            SAR {estimatedProfit.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
          </div>
          <div className="text-[10px] text-slate-500 font-semibold mt-2">
            Computed on average rate of SAR 0.15/L
          </div>
        </div>
      </div>

      {/* 2. ADVANCED PDF SALES REPORT EXPORT PANEL */}
      <div className="bg-white rounded-xl border border-slate-200 shadow-2xs overflow-hidden text-left">
        <button
          onClick={() => setIsExportOpen(!isExportOpen)}
          className="w-full p-4 bg-slate-50 border-b border-slate-200 flex items-center justify-between font-sans cursor-pointer hover:bg-slate-100/50 transition-colors border-none"
        >
          <div className="flex items-center gap-2">
            <FileDown size={18} className="text-[#6c5dd3]" />
            <h4 className="text-xs font-black text-slate-800 uppercase tracking-wider">
              Advanced PDF Sales Report Export
            </h4>
          </div>
          {isExportOpen ? <ChevronUp size={16} className="text-slate-500" /> : <ChevronDown size={16} className="text-slate-500" />}
        </button>

        {isExportOpen && (
          <div className="p-5 space-y-4">
            <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
              <div className="space-y-1.5">
                <label className="text-[10px] font-black text-slate-400 uppercase tracking-wider block">Start Date</label>
                <input
                  type="date"
                  value={pdfStartDate}
                  onChange={(e) => setPdfStartDate(e.target.value)}
                  className="w-full text-xs font-semibold bg-slate-55 border border-slate-200 rounded-lg p-2 focus:outline-none focus:ring-1 focus:ring-indigo-500"
                />
              </div>
              <div className="space-y-1.5">
                <label className="text-[10px] font-black text-slate-400 uppercase tracking-wider block">End Date</label>
                <input
                  type="date"
                  value={pdfEndDate}
                  onChange={(e) => setPdfEndDate(e.target.value)}
                  className="w-full text-xs font-semibold bg-slate-55 border border-slate-200 rounded-lg p-2 focus:outline-none focus:ring-1 focus:ring-indigo-500"
                />
              </div>

              <div className="space-y-1.5">
                <label className="text-[10px] font-black text-slate-400 uppercase tracking-wider block">Station</label>
                <select
                  value={pdfStationFilter}
                  disabled={!isHQ}
                  onChange={(e) => setPdfStationFilter(e.target.value)}
                  className="w-full text-xs font-bold bg-white border border-slate-200 rounded-lg p-2 focus:outline-none disabled:bg-slate-50"
                >
                  <option value="ALL">All Stations</option>
                  {stations.map(s => (
                    <option key={s.id} value={s.id}>{s.name.split('-')[0].trim()}</option>
                  ))}
                </select>
              </div>

              <div className="space-y-1.5">
                <label className="text-[10px] font-black text-slate-400 uppercase tracking-wider block">Fuel Grade</label>
                <select
                  value={pdfGradeFilter}
                  onChange={(e) => setPdfGradeFilter(e.target.value)}
                  className="w-full text-xs font-bold bg-white border border-slate-200 rounded-lg p-2 focus:outline-none"
                >
                  <option value="ALL">All Grades</option>
                  <option value="GAS91">GAS91</option>
                  <option value="GAS95">GAS95</option>
                  <option value="GAS98">GAS98</option>
                  <option value="DIESEL">DIESEL</option>
                </select>
              </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-4 gap-4 pt-1">
              <div className="space-y-1.5">
                <label className="text-[10px] font-black text-slate-400 uppercase tracking-wider block">Pump Label</label>
                <select
                  value={pdfPumpFilter}
                  onChange={(e) => setPdfPumpFilter(e.target.value)}
                  className="w-full text-xs font-bold bg-white border border-slate-200 rounded-lg p-2 focus:outline-none"
                >
                  <option value="ALL">All Pumps</option>
                  <option value="Pump 01">Pump 01</option>
                  <option value="Pump 02">Pump 02</option>
                  <option value="Pump 03">Pump 03</option>
                  <option value="Pump 04">Pump 04</option>
                  <option value="Dispenser 01">Dispenser 01</option>
                  <option value="Dispenser 02">Dispenser 02</option>
                </select>
              </div>

              <div className="space-y-1.5">
                <label className="text-[10px] font-black text-slate-400 uppercase tracking-wider block">Nozzle Index</label>
                <select
                  value={pdfNozzleFilter}
                  onChange={(e) => setPdfNozzleFilter(e.target.value)}
                  className="w-full text-xs font-bold bg-white border border-slate-200 rounded-lg p-2 focus:outline-none"
                >
                  <option value="ALL">All Nozzles</option>
                  <option value="01">Nozzle 01</option>
                  <option value="02">Nozzle 02</option>
                  <option value="A">Nozzle A</option>
                  <option value="B">Nozzle B</option>
                </select>
              </div>

              <div className="space-y-1.5">
                <label className="text-[10px] font-black text-slate-400 uppercase tracking-wider block">Shift</label>
                <select
                  value={pdfShiftFilter}
                  onChange={(e) => setPdfShiftFilter(e.target.value)}
                  className="w-full text-xs font-bold bg-white border border-slate-200 rounded-lg p-2 focus:outline-none"
                >
                  <option value="ALL">All Shifts</option>
                  <option value="Shift 1">Shift 1 (Day)</option>
                  <option value="Shift 2">Shift 2 (Evening)</option>
                  <option value="Shift 3">Shift 3 (Night)</option>
                </select>
              </div>

              <div className="space-y-1.5">
                <label className="text-[10px] font-black text-slate-400 uppercase tracking-wider block">Payment Method</label>
                <select
                  value={pdfPaymentFilter}
                  onChange={(e) => setPdfPaymentFilter(e.target.value)}
                  className="w-full text-xs font-bold bg-white border border-slate-200 rounded-lg p-2 focus:outline-none"
                >
                  <option value="ALL">All Methods</option>
                  <option value="Cash">Cash</option>
                  <option value="Debit Card">Debit Card</option>
                  <option value="Credit Card">Credit Card</option>
                  <option value="NoorKhoy">NoorKhoy</option>
                  <option value="Fleet Account">Fleet Account</option>
                  {customPaymentMethodsList.map(m => (
                    <option key={m} value={m}>{m}</option>
                  ))}
                  <option value="UNPAID">UNPAID / Cashier Suspended</option>
                </select>
              </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4 pt-1">
              <div className="space-y-1.5">
                <label className="text-[10px] font-black text-slate-400 uppercase tracking-wider block">Cashier / Attendant Name</label>
                <input
                  type="text"
                  placeholder="e.g. Saeed Alqahtani, Khalid..."
                  value={pdfCashierFilter}
                  onChange={(e) => setPdfCashierFilter(e.target.value)}
                  className="w-full text-xs font-semibold bg-slate-55 border border-slate-205 rounded-lg p-2 focus:outline-none focus:ring-1 focus:ring-indigo-500"
                />
              </div>

              <div className="space-y-1.5">
                <label className="text-[10px] font-black text-slate-400 uppercase tracking-wider block">Transaction Status</label>
                <select
                  value={pdfStatusFilter}
                  onChange={(e) => setPdfStatusFilter(e.target.value)}
                  className="w-full text-xs font-bold bg-white border border-slate-200 rounded-lg p-2 focus:outline-none"
                >
                  <option value="ALL">All Statuses (STARTED & FINISHED)</option>
                  <option value="FINISHED">FINISHED Only</option>
                  <option value="STARTED">STARTED / Uncompleted</option>
                </select>
              </div>
            </div>

            <div className="pt-2 flex justify-end">
              <button
                type="button"
                onClick={exportPDFReport}
                className="bg-indigo-600 hover:bg-[#5c4eb3] text-white px-5 py-2.5 rounded-lg font-bold text-xs uppercase tracking-wider flex items-center gap-2 cursor-pointer border-none transition-all shadow-xs"
              >
                <FileDown size={14} />
                <span>Export Advanced PDF Sales Report</span>
              </button>
            </div>
          </div>
        )}
      </div>

      {/* Visual Analytics Grid */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* CHART 1: Volume Sold by Fuel Grade (Custom SVGs) */}
        <div className="bg-white rounded-xl border border-slate-200 p-5 shadow-2xs">
          <h4 className="text-xs font-black text-slate-400 tracking-widest uppercase mb-4">
            Volume Output per Fuel Specification
          </h4>

          <div className="space-y-4">
            {(Object.keys(gradeVolumeMap) as FuelGrade[]).map((grade) => {
              const vol = gradeVolumeMap[grade];
              const pctOfMax = maxGradeVol > 0 ? (vol / maxGradeVol) * 100 : 0;
              
              const gradeColors: Record<FuelGrade, string> = {
                GAS91: 'bg-emerald-500',
                GAS95: 'bg-red-500',
                GAS98: 'bg-blue-500',
                DIESEL: 'bg-amber-500'
              };

              return (
                <div key={grade} className="space-y-1">
                  <div className="flex items-center justify-between text-xs font-mono">
                    <span className="font-bold text-slate-700">{grade}</span>
                    <span className="font-black text-slate-800">{vol.toLocaleString()} L</span>
                  </div>
                  <div className="w-full bg-slate-100 rounded-full h-3 overflow-hidden">
                    <div 
                      className={`h-full rounded-full transition-all duration-800 ${gradeColors[grade]}`}
                      style={{ width: `${pctOfMax}%` }}
                    ></div>
                  </div>
                </div>
              );
            })}
          </div>
        </div>

        {/* CHART / SECTION 2: Depending on view: HQ Cross Station VS Station Local Tank alert charts */}
        {isHQ ? (
          /* HQ Station Grid Performances */
          <div className="bg-white rounded-xl border border-slate-200 p-5 shadow-2xs">
            <h4 className="text-xs font-black text-slate-400 tracking-widest uppercase mb-4">
              Cross-Station Tenant Cash Flow Comparison
            </h4>

            <div className="space-y-5">
              {stationPerformanceList.map((station) => {
                const pctOfMaxRevenue = maxRevenue > 0 ? (station.revenueGenerated / maxRevenue) * 100 : 0;

                return (
                  <div key={station.id} className="space-y-1">
                    <div className="flex items-center justify-between text-xs">
                      <div>
                        <span className="font-bold text-slate-800">{station.name}</span>
                        <span className="text-[9px] font-mono font-bold text-slate-400 block">{station.code}</span>
                      </div>
                      <span className="font-mono font-black text-[#6c5dd3]">
                        SAR {station.revenueGenerated.toLocaleString(undefined, { maximumFractionDigits: 0 })}
                      </span>
                    </div>

                    <div className="flex items-center gap-3">
                      <div className="flex-1 bg-slate-100 rounded-full h-2.5 overflow-hidden">
                        <div 
                          className="h-full bg-linear-to-r from-violet-500 to-indigo-500 rounded-full transition-all duration-800"
                          style={{ width: `${pctOfMaxRevenue}%` }}
                        ></div>
                      </div>
                      <div className="text-[10px] font-mono font-black text-slate-600 shrink-0 w-12 text-right">
                        {station.storagePercentage.toFixed(0)}% Cap
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        ) : (
          /* Local Station Tank Ullage space metrics */
          <div className="bg-white rounded-xl border border-slate-200 p-5 shadow-2xs text-left">
            <h4 className="text-xs font-black text-slate-400 tracking-widest uppercase mb-4">
              Local Storage Stock Level Visualizer
            </h4>

            <div className="flex flex-col h-full justify-between">
              <div className="space-y-4">
                <p className="text-xs text-slate-500 leading-relaxed">
                  Remaining safety headroom room volume (Ullage) must be vigilantly monitored prior to dispatching tankers to prevent toxic environmental over-spills.
                </p>

                <div className="grid grid-cols-3 gap-2.5 pt-2">
                  {[...tanks]
                    .filter(t => t.stationId === session.activeStationId)
                    .sort((a, b) => a.label.localeCompare(b.label, undefined, { numeric: true, sensitivity: 'base' }))
                    .map((tank) => {
                    const pctFilled = (tank.currentLevel / tank.capacity) * 100;
                    return (
                      <div key={tank.id} className="bg-slate-50 border border-slate-200 rounded-lg p-2.5 text-center">
                        <div className="text-[10px] font-mono font-black text-slate-600">{tank.label}</div>
                        <div className="text-[9px] font-bold text-slate-400 uppercase mt-0.5">{tank.fuelType}</div>
                        
                        {/* Interactive Circle visual ring representing percentage */}
                        <div className="relative w-12 h-12 mx-auto my-2 flex items-center justify-center">
                          <svg className="absolute w-full h-full transform -rotate-90">
                            <circle cx="24" cy="24" r="20" fill="transparent" stroke="#e2e8f0" strokeWidth="4" />
                            <circle cx="24" cy="24" r="20" fill="transparent" stroke={tank.fuelType === 'GAS91' ? '#10b981' : '#ef4444'} strokeWidth="4" strokeDasharray={`${2 * Math.PI * 20}`} strokeDashoffset={`${2 * Math.PI * 20 * (1 - pctFilled / 100)}`} />
                          </svg>
                          <span className="text-[10px] font-mono font-black text-slate-800">
                            {pctFilled.toFixed(0)}%
                          </span>
                        </div>

                        <div className="text-[10px] font-mono font-black text-slate-500 mt-1">
                          {(tank.capacity - tank.currentLevel).toLocaleString()} L room
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            </div>
          </div>
        )}
      </div>

      {/* DETAILED LEDGER OF FINISHED SALES */}
      <div className="bg-white rounded-xl border border-slate-200 shadow-2xs overflow-hidden text-left">
        <div className="p-4 bg-slate-100 border-b border-slate-200">
          <h4 className="text-xs font-black text-slate-800 tracking-wider uppercase">
            Station Ledger of Historical Sales Dispenses
          </h4>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse text-xs font-mono">
            <thead>
              <tr className="bg-slate-50 border-b border-slate-200 text-slate-500 font-bold">
                <th className="p-3">Ref Code</th>
                {isHQ && <th className="p-3">Tenant Station</th>}
                <th className="p-3">Timestamp</th>
                <th className="p-3">Dispenser Nozzle</th>
                <th className="p-3">Fuel Grade</th>
                <th className="p-3">Payment</th>
                <th className="p-3 text-right">Volume (L)</th>
                <th className="p-3 text-right">Unit Price</th>
                <th className="p-3 text-right">Amount (SAR)</th>
              </tr>
            </thead>
            <tbody>
              {contextTx.slice(0, 10).map((tx) => {
                const associatedStation = stations.find(s => s.id === tx.stationId);
                return (
                  <tr key={tx.id} className="border-b border-slate-100 hover:bg-slate-50 transition-colors">
                    <td className="p-3 font-semibold text-slate-700">#{tx.id.replace('tx-', '')}</td>
                    {isHQ && (
                      <td className="p-3 font-bold text-slate-800">
                        {associatedStation?.name.split('-')[0].trim() || 'Default'}
                      </td>
                    )}
                    <td className="p-3 text-slate-500">{tx.timestamp}</td>
                    <td className="p-3 font-semibold text-slate-600">{tx.nozzleId ? `Nozzle ${tx.nozzleId}` : tx.pumpId.slice(-7)}</td>
                    <td className="p-3 font-bold text-slate-800">{tx.fuelType}</td>
                    <td className="p-3">
                      <span className={`px-2 py-0.5 rounded-full text-[9px] font-black uppercase ${
                        tx.paymentMethod === 'Cash' ? 'bg-emerald-100 text-emerald-800' :
                        tx.paymentMethod === 'Debit Card' || tx.paymentMethod === 'Credit Card' ? 'bg-blue-100 text-blue-800' :
                        tx.paymentMethod === 'NoorKhoy' ? 'bg-purple-100 text-purple-800' :
                        tx.paymentMethod === 'Fleet Account' ? 'bg-amber-100 text-amber-800' :
                        'bg-slate-100 text-slate-700'
                      }`}>
                        {tx.paymentMethod || 'UNPAID'}
                      </span>
                    </td>
                    <td className="p-3 text-right font-bold text-slate-700">{tx.volume.toFixed(1)} L</td>
                    <td className="p-3 text-right text-slate-500">SAR {tx.pricePerLitre.toFixed(2)}</td>
                    <td className="p-3 text-right font-black text-[#6c5dd3]">SAR {tx.amount.toFixed(2)}</td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
};
