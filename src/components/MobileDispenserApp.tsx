/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useEffect } from 'react';
import { Capacitor } from '@capacitor/core';
import { useFuelSystem } from '../context';
import { FuelGrade, FuelPump, SalesTransaction } from '../types';
import { 
  LogOut, 
  Fuel, 
  MapPin, 
  User, 
  DollarSign, 
  CheckCircle, 
  RefreshCw, 
  ArrowLeft, 
  AlertTriangle, 
  Receipt, 
  Search, 
  SlidersHorizontal, 
  ArrowUpDown, 
  X, 
  Calendar, 
  ClipboardList,
  Menu,
  Activity,
  FileText,
  Sparkles,
  Database
} from 'lucide-react';

export const MobileDispenserApp: React.FC = () => {
  const { 
    pumps, 
    session, 
    stations, 
    tanks, 
    transactions,
    setSession, 
    dispenseFuel, 
    confirmDispenseTransaction 
  } = useFuelSystem();

  // Find active station context
  const activeStation = stations.find(s => s.id === session.activeStationId);
  
  // Filter pumps belonging to current active station
  const stationPumps = pumps
    .filter(p => p.stationId === session.activeStationId)
    .sort((a, b) => a.label.localeCompare(b.label, undefined, { numeric: true, sensitivity: 'base' }));

  const stationTanks = tanks.filter(t => t.stationId === session.activeStationId);

  // Layout Tab Routing state: 'pump_monitor' or 'transactions'
  const [activeTab, setActiveTab] = useState<'pump_monitor' | 'transactions'>('pump_monitor');

  // Sidebar Drawer state for mobile viewports
  const [isDrawerOpen, setIsDrawerOpen] = useState<boolean>(false);

  // Search & Filter state for Transactions page
  const [txSearchText, setTxSearchText] = useState<string>('');
  const [txGradeFilter, setTxGradeFilter] = useState<string>('ALL');
  const [txSortOrder, setTxSortOrder] = useState<'newest' | 'oldest'>('newest');
  
  // Modal inspectors
  const [selectedPump, setSelectedPump] = useState<FuelPump | null>(null);
  const [viewedTx, setViewedTx] = useState<SalesTransaction | null>(null);
  const [isSimulatorOpen, setIsSimulatorOpen] = useState<boolean>(false);

  // Dispenser input states
  const [amountSAR, setAmountSAR] = useState<string>('50');
  const [customerName, setCustomerName] = useState<string>('');
  const [dispenseError, setDispenseError] = useState<string | null>(null);
  
  // Completed receipt display state
  const [completedReceipt, setCompletedReceipt] = useState<{
    txNumber: string;
    timestamp: string;
    stationName: string;
    pumpLabel: string;
    fuelType: FuelGrade;
    price: number;
    amount: number;
    liters: number;
    operator: string;
    customer?: string;
  } | null>(null);

  // Dynamic values helper
  const getSelectedPumpPrice = (pumpObj: FuelPump): number => {
    const grade = pumpObj.fuelType || 'GAS91';
    return activeStation?.fuelPricing[grade] || 2.18;
  };

  const calculateLiters = (amountStr: string, price: number): number => {
    const amt = parseFloat(amountStr);
    if (isNaN(amt) || amt <= 0) return 0;
    return amt / price;
  };

  // Start dispensing action
  const handleStartDispensing = () => {
    if (!selectedPump) return;
    setDispenseError(null);

    const price = getSelectedPumpPrice(selectedPump);
    const amount = parseFloat(amountSAR);
    if (isNaN(amount) || amount <= 0) {
      setDispenseError('Enter a valid purchase amount.');
      return;
    }

    const liters = amount / price;
    const grade = selectedPump.fuelType || 'GAS91';

    // Verify stock
    const matchingTanks = stationTanks.filter(t => t.fuelType === grade);
    const totalStock = matchingTanks.reduce((sum, t) => sum + t.currentLevel, 0);

    if (totalStock < liters) {
      setDispenseError(`Stock limit exceeded. Station stock has ${totalStock.toFixed(1)} L, but this sale requires ${liters.toFixed(1)} L.`);
      return;
    }

    const res = dispenseFuel(selectedPump.id, grade, liters);
    if (!res.success) {
      setDispenseError(res.message);
    }
  };

  // Complete dispensing action
  const handleCompleteDispensing = () => {
    if (!selectedPump) return;
    setDispenseError(null);

    const grade = selectedPump.activeFuelGrade || selectedPump.fuelType || 'GAS91';
    const price = activeStation?.fuelPricing[grade] || 2.18;
    const vol = selectedPump.volumeThisSession || 0;
    const amt = vol * price;
    const attendant = session.name;

    const res = confirmDispenseTransaction(selectedPump.id, attendant, customerName || undefined);
    if (res.success) {
      // Build receipt
      setCompletedReceipt({
        txNumber: `TX-${Date.now().toString().slice(-8)}`,
        timestamp: new Date().toLocaleDateString('en-US', { month: '2-digit', day: '2-digit' }) + ' ' + new Date().toLocaleTimeString('en-US', { hour12: false, hour: '2-digit', minute: '2-digit' }),
        stationName: activeStation?.name || 'Assigned Station',
        pumpLabel: selectedPump.label,
        fuelType: grade,
        price: price,
        amount: amt,
        liters: vol,
        operator: attendant,
        customer: customerName || undefined
      });
      // Clear selections
      setSelectedPump(null);
      setAmountSAR('50');
      setCustomerName('');
    } else {
      setDispenseError(res.message);
    }
  };

  // Syncer to auto-update selected pump state details if active pumping transitions in background
  useEffect(() => {
    if (selectedPump) {
      const livePump = pumps.find(p => p.id === selectedPump.id);
      if (livePump) {
        setSelectedPump(livePump);
      }
    }
  }, [pumps, selectedPump?.id]);

  const handleLogout = () => {
    setSession({
      ...session,
      isLoggedIn: false
    });
  };

  const handleBackToAdmin = () => {
    setSession({
      ...session,
      isMobilePreview: false
    });
  };

  // Render Sidebar Content (shared between persistent desktop/tablet layout and sliding mobile drawer)
  const renderSidebar = () => {
    const activeClass = 'bg-[#efecfe] text-[#6c5dd3] border-l-4 border-[#6c5dd3] font-bold';
    const inactiveClass = 'text-slate-650 hover:bg-slate-50 border-l-4 border-transparent';

    return (
      <div className="h-full flex flex-col justify-between bg-white text-slate-800">
        <div className="space-y-6">
          {/* Logo & Brand Header */}
          <div className="p-5 border-b border-slate-100 flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-[#6c5dd3] flex items-center justify-center text-white font-black text-xl shadow-md">
              F
            </div>
            <div className="text-left leading-tight">
              <h1 className="text-sm font-black tracking-wider text-slate-900 uppercase">
                {activeStation?.name.split('-')[0].trim() || 'JAMA'}
              </h1>
              <span className="text-[10px] text-slate-500 font-extrabold tracking-widest uppercase block">
                SUPERVISOR
              </span>
            </div>
          </div>

          {/* Attendant User Profile Card */}
          <div className="px-4">
            <div className="bg-[#f5f3ff] border border-[#ddd6fe] rounded-xl p-3.5 flex items-center gap-3">
              <div className="w-8 h-8 rounded-full bg-[#6c5dd3] text-white font-bold flex items-center justify-center uppercase text-sm">
                {session.name.slice(0, 1)}
              </div>
              <div className="text-left min-w-0 flex-1">
                <h4 className="text-xs font-black text-slate-900 truncate">{session.name.split('@')[0]}</h4>
                <span className="text-[8px] font-black text-[#6c5dd3] tracking-wider uppercase block mt-0.5">
                  STATION ATTENDANT
                </span>
              </div>
            </div>
          </div>

          {/* Navigation Links */}
          <div className="space-y-1">
            <div className="text-[9px] font-black text-slate-400 tracking-widest uppercase px-5 mb-2.5">
              STATION TELEMETRY
            </div>
            
            <button
              onClick={() => {
                setActiveTab('pump_monitor');
                setIsDrawerOpen(false);
              }}
              className={`w-full flex items-center gap-3.5 px-5 py-3 text-xs transition-all ${
                activeTab === 'pump_monitor' ? activeClass : inactiveClass
              }`}
            >
              <Fuel size={16} className="shrink-0" />
              <span>Pump Monitor</span>
            </button>

            <button
              onClick={() => {
                setActiveTab('transactions');
                setIsDrawerOpen(false);
              }}
              className={`w-full flex items-center gap-3.5 px-5 py-3 text-xs transition-all ${
                activeTab === 'transactions' ? activeClass : inactiveClass
              }`}
            >
              <ClipboardList size={16} className="shrink-0" />
              <span>Transactions Log</span>
            </button>
          </div>
        </div>

        {/* Bottom Helper & Logout Exit Button */}
        <div className="p-4 space-y-3.5 border-t border-slate-100 bg-slate-50/50">
          <div className="bg-[#fef3c7] border border-[#fde68a] rounded-xl p-3 text-[10px] font-semibold text-[#92400e] text-left leading-relaxed">
            <div className="font-bold text-[#b45309] uppercase tracking-wide mb-0.5 flex items-center gap-1">
              <Sparkles size={11} />
              <span>ACTIVE SIMULATION DESK</span>
            </div>
            Pumping fuel, adding loads, or changing prices instantly calculates and renders ERP audit steps & volumes.
          </div>

          {session.isMobilePreview && !Capacitor.isNativePlatform() && (
            <button
              onClick={handleBackToAdmin}
              className="w-full py-2 bg-slate-100 hover:bg-slate-200 border border-slate-300 text-[10px] font-black uppercase text-slate-700 tracking-wider rounded-lg transition-colors select-none"
            >
              Return to Web Admin
            </button>
          )}

          <button
            onClick={handleLogout}
            className="w-full flex items-center justify-center gap-2 py-2.5 bg-white hover:bg-red-50/30 border border-red-200 hover:border-red-300 text-xs font-bold text-red-600 rounded-xl transition-all cursor-pointer select-none"
          >
            <LogOut size={14} />
            <span>Exit Attendant Session</span>
          </button>
        </div>
      </div>
    );
  };

  return (
    <div className="min-h-screen w-full bg-[#f1f5f9] text-slate-800 flex font-sans select-none overflow-x-hidden">
      
      {/* 1. PERSISTENT SIDEBAR - DISPLAYED ON TABLET/DESKTOP VIEWPORTS (>= 1024px) */}
      <aside className="hidden lg:block w-64 shrink-0 border-r border-[#e2e8f0] shadow-sm bg-white h-screen sticky top-0">
        {renderSidebar()}
      </aside>

      {/* 2. MAIN WORKSPACE CONTENT CONTAINER */}
      <div className="flex-1 min-w-0 flex flex-col min-h-screen">
        
        {/* Top Header Bar */}
        <header className="sticky top-0 bg-white border-b border-[#e2e8f0] px-5 py-4 z-40">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              {/* Hamburger drawer trigger (visible only on mobile viewports < 1024px) */}
              <button
                onClick={() => setIsDrawerOpen(true)}
                className="lg:hidden p-1.5 hover:bg-slate-100 border border-slate-200 rounded-lg text-slate-600 animate-fade-in"
              >
                <Menu size={18} />
              </button>
              <h2 className="text-base font-black text-slate-900 tracking-wide uppercase">
                {activeTab === 'pump_monitor' ? 'PUMP MONITOR' : 'TRANSACTIONS HISTORY'}
              </h2>
              
              {/* Context Tag */}
              <div className="hidden sm:flex items-center gap-1.5 px-3 py-1 bg-slate-100 border border-slate-200 rounded-full text-xs font-semibold text-slate-600">
                <MapPin size={11} className="text-[#6c5dd3]" />
                <span>Station context: <strong className="text-slate-800">{activeStation?.name.split('-')[0].trim().toLowerCase() || 'jama'}</strong></span>
              </div>
            </div>

            <div className="flex items-center gap-3">
              {/* Database sync tag */}
              <div className="flex items-center gap-1.5 px-3 py-1 bg-[#f0fdf4] border border-[#bbf7d0] rounded-full text-[10px] font-black text-[#166534] uppercase tracking-wider">
                <span className="w-1.5 h-1.5 bg-[#22c55e] rounded-full animate-pulse"></span>
                <span>Database Live</span>
              </div>
              
              {/* Current Date/Time */}
              <div className="hidden md:block text-xs font-mono font-bold text-slate-500">
                {new Date().toLocaleDateString('en-US', { month: '2-digit', day: '2-digit', year: 'numeric' })} | {new Date().toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit', hour12: true })}
              </div>

              {/* Attendant avatar circle tag */}
              <div className="flex items-center gap-2">
                <span className="hidden sm:block text-xs font-bold text-slate-700">{session.name.split('@')[0]}</span>
                <div className="w-8 h-8 rounded-full bg-[#6c5dd3] text-white flex items-center justify-center font-bold uppercase text-xs shadow-xs">
                  {session.name.slice(0, 1)}
                </div>
              </div>
            </div>
          </div>
        </header>

        {/* Content Body Container */}
        <main className="flex-1 p-5 space-y-6">
          
          {activeTab === 'pump_monitor' ? (
            /* =========================================================================
               PUMP MONITOR TAB
               ========================================================================= */
            <>
              {/* Top Banner Card: FUEL DISPENSATION ASSETS */}
              <div className="bg-[#0d1321] rounded-2xl p-5 text-white flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 border border-slate-850 shadow-md">
                <div className="space-y-1 text-left">
                  <div className="flex items-center gap-2 text-sm font-black uppercase tracking-wider text-slate-100">
                    <span className="w-2.5 h-2.5 bg-[#22c55e] rounded-full"></span>
                    <span>Fuel Dispensation Assets</span>
                  </div>
                  <p className="text-xs text-slate-400 font-semibold leading-relaxed">
                    1 Dual-Nozzle Island Dispensers | 1 Petrol 91 Nozzles | 1 Petrol 95 Nozzles
                  </p>
                </div>

                <div className="flex items-center gap-2 shrink-0">
                  <span className="px-3 py-1 bg-[#102a1e] border border-[#22c55e]/30 rounded-lg text-[10px] font-black text-[#22c55e] uppercase tracking-wider font-mono">
                    1 x Petrol 91 Nozzles
                  </span>
                  <span className="px-3 py-1 bg-[#3b1212] border border-[#ef4444]/30 rounded-lg text-[10px] font-black text-[#ef4444] uppercase tracking-wider font-mono">
                    1 x Petrol 95 Nozzles
                  </span>
                </div>
              </div>

              {/* Dispenser Cards Layout */}
              <div className="bg-[#0d1321] rounded-2xl overflow-hidden border border-slate-850 shadow-lg text-left">
                {/* Header */}
                <div className="bg-[#121927] border-b border-slate-850 px-5 py-3.5 flex justify-between items-center text-xs font-black uppercase text-slate-200 tracking-wider font-mono">
                  <span>DISPENSER D01</span>
                  <span className="text-slate-400 font-semibold text-[10px]">DUAL NOZZLE ISLAND</span>
                </div>

                {/* Nodes Grid columns */}
                <div className="p-5 grid grid-cols-1 md:grid-cols-2 gap-5 bg-slate-900/30">
                  {stationPumps.map((pump) => {
                    const price = activeStation?.fuelPricing[pump.fuelType || 'GAS91'] || 2.18;
                    const is91 = pump.fuelType === 'GAS91';
                    const isPumping = pump.status === 'PUMPING';
                    const isCompleted = pump.status === 'COMPLETED';

                    // Node styling based on state
                    let nodeBorder = 'border-slate-800';
                    let nodeBg = 'bg-white';
                    let statusLabel = 'Available';
                    let statusColor = 'bg-[#22c55e]';
                    let statusTextClass = 'text-[#22c55e]';

                    if (isPumping) {
                      nodeBorder = 'border-amber-500';
                      nodeBg = 'bg-amber-50/20';
                      statusLabel = 'Dispensing';
                      statusColor = 'bg-amber-500 animate-pulse';
                      statusTextClass = 'text-amber-500 font-black animate-pulse';
                    } else if (isCompleted) {
                      nodeBorder = 'border-blue-500';
                      nodeBg = 'bg-blue-50/20';
                      statusLabel = 'Pumping Done';
                      statusColor = 'bg-blue-500';
                      statusTextClass = 'text-blue-500 font-black';
                    }

                    return (
                      <div
                        key={pump.id}
                        onClick={() => setSelectedPump(pump)}
                        className={`border rounded-xl p-5 ${nodeBg} ${nodeBorder} hover:shadow-md transition-all cursor-pointer relative shadow-sm`}
                      >
                        <div className="space-y-4">
                          {/* Nozzle Header Row */}
                          <div className="flex items-center justify-between border-b border-slate-100 pb-3">
                            <div className="flex items-center gap-2">
                              <span className={`w-2 h-2 rounded-full ${statusColor}`}></span>
                              <span className="text-xs font-black text-slate-800 uppercase tracking-wide">
                                {pump.label === 'Nozzle 1' ? 'Nozzle 01' : 'Nozzle 02'}
                              </span>
                            </div>
                            <span className={`text-[10px] font-black uppercase tracking-wider ${statusTextClass}`}>
                              {statusLabel}
                            </span>
                          </div>

                          {/* Nozzle operational fields */}
                          <div className="grid grid-cols-3 gap-3 items-center">
                            <div>
                              <span className="text-[8px] font-bold text-slate-400 uppercase tracking-widest block">PRODUCT</span>
                              <span className={`inline-block text-[10px] font-black px-2 py-0.5 rounded border uppercase mt-1 font-mono ${
                                is91 
                                  ? 'bg-[#e6fbf2] text-[#22c55e] border-[#bbf7d0]' 
                                  : 'bg-[#fef2f2] text-[#ef4444] border-[#fecaca]'
                              }`}>
                                {pump.fuelType || 'GAS91'}
                              </span>
                            </div>

                            <div>
                              <span className="text-[8px] font-bold text-slate-400 uppercase tracking-widest block">AMOUNT</span>
                              <span className="text-xs font-black font-mono text-[#6c5dd3] block mt-1">
                                {isPumping || isCompleted 
                                  ? `SAR ${((pump.volumeThisSession || 0) * price).toFixed(2)}` 
                                  : '0.00 SAR'}
                              </span>
                            </div>

                            <div className="text-right">
                              <span className="text-[8px] font-bold text-slate-400 uppercase tracking-widest block">VOLUME</span>
                              <span className="text-xs font-extrabold font-mono text-slate-600 block mt-1">
                                {isPumping || isCompleted 
                                  ? `${(pump.volumeThisSession || 0).toFixed(2)} L` 
                                  : '0.00 L'}
                              </span>
                            </div>
                          </div>

                          {/* Quick tap actions */}
                          {isCompleted && (
                            <button
                              onClick={(e) => {
                                e.stopPropagation();
                                setSelectedPump(pump);
                              }}
                              className="w-full py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg text-[9px] font-black uppercase tracking-wider border-none cursor-pointer shadow-xs select-none mt-2 font-sans transition-all text-center"
                            >
                              Verify & Complete
                            </button>
                          )}
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>

              {/* Table Log: REAL-TIME FUEL DISPENSING LOG */}
              <div className="bg-white rounded-2xl border border-[#e2e8f0] shadow-sm overflow-hidden text-left">
                <div className="bg-slate-50 border-b border-[#e2e8f0] px-5 py-4 flex justify-between items-center">
                  <h3 className="text-xs font-black text-slate-800 uppercase tracking-wider">
                    ● Real-Time Fuel Dispensing Log
                  </h3>
                  <span className="text-[9px] font-black text-[#6c5dd3] bg-[#efecfe] px-2 py-0.5 rounded-full uppercase tracking-wider">
                    Active Connections
                  </span>
                </div>

                <div className="overflow-x-auto">
                  <table className="w-full min-w-[650px] border-collapse font-sans text-xs">
                    <thead>
                      <tr className="border-b border-[#e2e8f0] bg-slate-50/50 text-[10px] font-black text-slate-400 uppercase tracking-wider">
                        <th className="px-5 py-3 text-left">Time</th>
                        <th className="px-5 py-3 text-left">Pump Code</th>
                        <th className="px-5 py-3 text-left">Nozzle No.</th>
                        <th className="px-5 py-3 text-left">Product</th>
                        <th className="px-5 py-3 text-left">PPU (SAR/L)</th>
                        <th className="px-5 py-3 text-right">Volume (L)</th>
                        <th className="px-5 py-3 text-right">Amount (SAR)</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100 font-medium">
                      {(() => {
                        const logs = transactions
                          .filter(t => t.stationId === session.activeStationId)
                          .sort((a, b) => b.timestamp.localeCompare(a.timestamp))
                          .slice(0, 10);

                        if (logs.length === 0) {
                          return (
                            <tr>
                              <td colSpan={7} className="px-5 py-10 text-center text-slate-400 italic">
                                No dispensing transaction records indexed yet.
                              </td>
                            </tr>
                          );
                        }

                        return logs.map((tx) => {
                          const is91 = tx.fuelType === 'GAS91';
                          const isFinished = tx.status === 'FINISHED';
                          return (
                            <tr key={tx.id} className="hover:bg-slate-50/50">
                              <td className="px-5 py-3.5 text-slate-400 font-mono">{tx.timestamp}</td>
                              <td className="px-5 py-3.5 text-slate-800 font-bold uppercase">{tx.pumpId === 'DELIVERY_BAY' ? 'Replenish' : `Dispenser ${tx.pumpId.slice(-2)}`}</td>
                              <td className="px-5 py-3.5 text-slate-600 font-bold font-mono">
                                {tx.pumpId === 'DELIVERY_BAY' ? '-' : tx.id.slice(-2) || '01'}
                              </td>
                              <td className="px-5 py-3.5">
                                <span className={`inline-block text-[9px] font-black px-2 py-0.5 rounded border uppercase font-mono ${
                                  is91 
                                    ? 'bg-[#e6fbf2] text-[#22c55e] border-[#bbf7d0]' 
                                    : 'bg-[#fef2f2] text-[#ef4444] border-[#fecaca]'
                                }`}>
                                  {tx.fuelType}
                                </span>
                              </td>
                              <td className="px-5 py-3.5 text-slate-600 font-mono">SAR {tx.pricePerLitre ? tx.pricePerLitre.toFixed(2) : '2.18'}</td>
                              <td className="px-5 py-3.5 text-right font-mono text-slate-700 font-bold">
                                {isFinished ? `${tx.volume.toFixed(2)} L` : '0.00 L'}
                              </td>
                              <td className="px-5 py-3.5 text-right font-mono text-emerald-600 font-black">
                                {isFinished ? `SAR ${tx.amount.toFixed(2)}` : '0.00 SAR'}
                              </td>
                            </tr>
                          );
                        });
                      })()}
                    </tbody>
                  </table>
                </div>
              </div>
            </>
          ) : (
            /* =========================================================================
               TRANSACTIONS HISTORICAL LOG TAB
               ========================================================================= */
            <div className="space-y-4 text-left">
              <div className="bg-white rounded-2xl border border-[#e2e8f0] shadow-sm p-5 space-y-4">
                <div className="space-y-1">
                  <h3 className="text-sm font-black text-slate-800 uppercase tracking-wider">Historical Transactions Log</h3>
                  <p className="text-[11px] text-slate-500 font-semibold leading-relaxed">Search, filter, and review completed sales and volume tallies.</p>
                </div>

                {/* Query inputs block */}
                <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                  <div className="relative">
                    <Search size={14} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400" />
                    <input
                      type="text"
                      placeholder="Search TX ID, attendant name, customer..."
                      value={txSearchText}
                      onChange={(e) => setTxSearchText(e.target.value)}
                      className="w-full bg-slate-50 border border-slate-200 rounded-xl py-2.5 pl-10 pr-4 text-xs font-semibold text-slate-800 focus:outline-none focus:border-[#6c5dd3] focus:bg-white placeholder-slate-400"
                    />
                    {txSearchText && (
                      <button onClick={() => setTxSearchText('')} className="absolute right-3.5 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600">
                        <X size={12} />
                      </button>
                    )}
                  </div>

                  <select
                    value={txGradeFilter}
                    onChange={(e) => setTxGradeFilter(e.target.value)}
                    className="bg-slate-50 border border-slate-200 rounded-xl px-3 py-2 text-xs font-semibold text-slate-700 focus:outline-none focus:border-[#6c5dd3] focus:bg-white uppercase"
                  >
                    <option value="ALL">All Products</option>
                    <option value="GAS91">GAS91 Only</option>
                    <option value="GAS95">GAS95 Only</option>
                    <option value="GAS98">GAS98 Only</option>
                    <option value="DIESEL">Diesel Only</option>
                  </select>

                  <button
                    onClick={() => setTxSortOrder(prev => prev === 'newest' ? 'oldest' : 'newest')}
                    className="flex items-center justify-center gap-2 px-3 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-xs font-black uppercase text-slate-650 hover:bg-slate-100"
                  >
                    <ArrowUpDown size={13} className="text-[#6c5dd3]" />
                    <span>Date: {txSortOrder === 'newest' ? 'Newest First' : 'Oldest First'}</span>
                  </button>
                </div>
              </div>

              {/* Transactions list Table */}
              <div className="bg-white rounded-2xl border border-[#e2e8f0] shadow-sm overflow-hidden">
                <div className="overflow-x-auto">
                  <table className="w-full min-w-[700px] border-collapse font-sans text-xs">
                    <thead>
                      <tr className="border-b border-[#e2e8f0] bg-slate-50 text-[10px] font-black text-slate-400 uppercase tracking-wider">
                        <th className="px-5 py-3 text-left">Time</th>
                        <th className="px-5 py-3 text-left">Transaction ID</th>
                        <th className="px-5 py-3 text-left">Nozzle / Pump</th>
                        <th className="px-5 py-3 text-left">Product</th>
                        <th className="px-5 py-3 text-left">Attendant</th>
                        <th className="px-5 py-3 text-right">Volume (L)</th>
                        <th className="px-5 py-3 text-right">Amount (SAR)</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100 font-medium">
                      {(() => {
                        const stationTxs = transactions.filter(t => t.stationId === session.activeStationId);
                        
                        const filtered = stationTxs.filter(t => {
                          const matchSearch = 
                            !txSearchText || 
                            t.id.toLowerCase().includes(txSearchText.toLowerCase()) ||
                            (t.operator && t.operator.toLowerCase().includes(txSearchText.toLowerCase())) ||
                            (t.customer && t.customer.toLowerCase().includes(txSearchText.toLowerCase())) ||
                            t.pumpId.toLowerCase().includes(txSearchText.toLowerCase());
                          
                          const matchGrade = txGradeFilter === 'ALL' || t.fuelType === txGradeFilter;
                          
                          return matchSearch && matchGrade;
                        });

                        const sorted = [...filtered].sort((a, b) => {
                          return txSortOrder === 'newest'
                            ? b.timestamp.localeCompare(a.timestamp)
                            : a.timestamp.localeCompare(b.timestamp);
                        });

                        if (sorted.length === 0) {
                          return (
                            <tr>
                              <td colSpan={7} className="px-5 py-10 text-center text-slate-400 italic">
                                No matching sales transaction logs found.
                              </td>
                            </tr>
                          );
                        }

                        return sorted.map((tx) => {
                          const is91 = tx.fuelType === 'GAS91';
                          const isFinished = tx.status === 'FINISHED';
                          return (
                            <tr
                              key={tx.id}
                              onClick={() => setViewedTx(tx)}
                              className="hover:bg-slate-50/80 cursor-pointer transition-colors"
                            >
                              <td className="px-5 py-3.5 text-slate-400 font-mono">{tx.timestamp}</td>
                              <td className="px-5 py-3.5 text-slate-800 font-bold font-mono uppercase">{tx.id.toUpperCase()}</td>
                              <td className="px-5 py-3.5 text-slate-600 font-bold">
                                {tx.pumpId === 'DELIVERY_BAY' ? 'Replenish' : `Pump ${tx.pumpId.slice(-2)}`}
                              </td>
                              <td className="px-5 py-3.5">
                                <span className={`inline-block text-[9px] font-black px-2 py-0.5 rounded border uppercase font-mono ${
                                  is91 
                                    ? 'bg-[#e6fbf2] text-[#22c55e] border-[#bbf7d0]' 
                                    : 'bg-[#fef2f2] text-[#ef4444] border-[#fecaca]'
                                }`}>
                                  {tx.fuelType}
                                </span>
                              </td>
                              <td className="px-5 py-3.5 text-indigo-500 font-bold truncate max-w-[120px]">{tx.operator ? tx.operator.split('@')[0] : 'Attendant'}</td>
                              <td className="px-5 py-3.5 text-right font-mono text-slate-700 font-bold">
                                {isFinished ? `${tx.volume.toFixed(2)} L` : '0.00 L'}
                              </td>
                              <td className="px-5 py-3.5 text-right font-mono text-emerald-600 font-black">
                                {isFinished ? `SAR ${tx.amount.toFixed(2)}` : '0.00 SAR'}
                              </td>
                            </tr>
                          );
                        });
                      })()}
                    </tbody>
                  </table>
                </div>
              </div>
            </div>
          )}
        </main>
      </div>

      {/* 3. SLIDING NAVIGATION SIDEBAR DRAWER - MOBILE SCREEN SIZE ONLY (< 1024px) */}
      {isDrawerOpen && (
        <div className="fixed inset-0 z-50 flex lg:hidden animate-fade-in">
          {/* Backdrop mask */}
          <div 
            onClick={() => setIsDrawerOpen(false)}
            className="fixed inset-0 bg-black/60 backdrop-blur-xs transition-opacity duration-300"
          ></div>
          
          {/* Drawer container body */}
          <div className="relative w-64 bg-white shadow-2xl h-full z-50 flex flex-col transition-transform duration-300 animate-slide-right">
            <button 
              onClick={() => setIsDrawerOpen(false)}
              className="absolute top-4 right-4 p-1 bg-slate-100 hover:bg-slate-200 border border-slate-200 rounded-full text-slate-500 hover:text-slate-800 transition-colors cursor-pointer"
            >
              <X size={14} />
            </button>
            <div className="flex-1 overflow-y-auto">
              {renderSidebar()}
            </div>
          </div>
        </div>
      )}

      {/* 4. FLOATING SIMULATOR ACTIVATOR BUTTON */}
      <button
        onClick={() => setIsSimulatorOpen(true)}
        className="fixed bottom-6 right-6 px-4 py-3 bg-[#6c5dd3] hover:bg-[#5c4eb3] text-white rounded-full flex items-center gap-2 shadow-lg shadow-indigo-500/20 text-xs font-black uppercase tracking-wider cursor-pointer border-none select-none z-30 transition-all hover:scale-105 active:scale-95 animate-fade-in"
      >
        <Sparkles size={14} />
        <span>Command Deck Simulator</span>
      </button>

      {/* =========================================================================
         MODAL INTERFACE: DISPENSER LANE PANEL SELECTOR & SIMULATOR
         ========================================================================= */}
      {selectedPump && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/75 backdrop-blur-xs p-4 animate-fade-in">
          <div className="bg-white border border-slate-200 rounded-2xl overflow-hidden shadow-2xl p-5 max-w-sm w-full font-sans text-xs relative text-left">
            
            {/* Close */}
            <button
              onClick={() => {
                setSelectedPump(null);
                setDispenseError(null);
              }}
              className="absolute top-4 right-4 p-1 bg-slate-100 hover:bg-slate-200 border border-slate-200 rounded-full text-slate-500 hover:text-slate-800 transition-colors cursor-pointer select-none"
            >
              <X size={14} />
            </button>

            <h3 className="text-sm font-black text-slate-900 uppercase tracking-wide mb-3 pr-8 border-b border-slate-100 pb-2">
              Nozzle Control No.{selectedPump.label.slice(-2)}
            </h3>

            {/* State logic display */}
            {selectedPump.status === 'PUMPING' ? (
              <div className="space-y-4">
                <div className="bg-amber-50 border border-amber-200 rounded-xl p-3 text-center space-y-1">
                  <span className="text-[9px] font-black text-amber-600 uppercase tracking-wider animate-pulse">
                    ⚡ Fueling in progress
                  </span>
                  <div className="text-2xl font-black font-mono text-slate-800">
                    {(selectedPump.volumeThisSession || 0).toFixed(2)} L
                  </div>
                  <div className="text-xs font-bold text-[#6c5dd3] font-mono">
                    SAR {((selectedPump.volumeThisSession || 0) * getSelectedPumpPrice(selectedPump)).toFixed(2)}
                  </div>
                </div>

                <div className="bg-slate-50 rounded-lg p-3 grid grid-cols-2 gap-2 text-[10px] font-semibold text-slate-500">
                  <div>
                    <span>FLOW RATE:</span>
                    <strong className="block text-slate-800 font-bold font-mono">40.0 L/min</strong>
                  </div>
                  <div className="text-right">
                    <span>TARGET LITERS:</span>
                    <strong className="block text-slate-800 font-bold font-mono">
                      {calculateLiters(amountSAR, getSelectedPumpPrice(selectedPump)).toFixed(2)} L
                    </strong>
                  </div>
                </div>

                <div className="w-full bg-slate-100 h-2 rounded-full overflow-hidden">
                  <div 
                    className="bg-amber-500 h-full transition-all duration-300"
                    style={{ 
                      width: `${Math.min(100, ((selectedPump.volumeThisSession || 0) / calculateLiters(amountSAR, getSelectedPumpPrice(selectedPump))) * 100)}%` 
                    }}
                  />
                </div>
              </div>
            ) : selectedPump.status === 'COMPLETED' ? (
              <div className="space-y-4">
                <div className="bg-blue-50 border border-blue-200 rounded-xl p-3 text-center space-y-1">
                  <span className="text-[9px] font-black text-blue-600 uppercase tracking-wider">
                    ✓ Dispense Session Completed
                  </span>
                  <div className="text-2xl font-black font-mono text-slate-850">
                    {(selectedPump.volumeThisSession || 0).toFixed(2)} L
                  </div>
                  <div className="text-xs font-bold text-emerald-600 font-mono">
                    SAR {((selectedPump.volumeThisSession || 0) * getSelectedPumpPrice(selectedPump)).toFixed(2)}
                  </div>
                </div>

                <div className="space-y-1">
                  <label className="text-[9px] font-bold text-slate-500 uppercase tracking-wider block">Customer Tag (Optional)</label>
                  <input
                    type="text"
                    placeholder="e.g. Aramco Transport"
                    value={customerName}
                    onChange={(e) => setCustomerName(e.target.value)}
                    className="w-full bg-slate-50 text-slate-800 border border-slate-200 rounded-lg py-2 px-3 text-xs font-semibold focus:outline-none focus:border-[#6c5dd3] focus:bg-white"
                  />
                </div>

                {dispenseError && (
                  <div className="bg-red-50 border border-red-200 text-red-600 p-2.5 rounded-lg text-[10px] font-semibold flex items-start gap-1">
                    <AlertTriangle className="shrink-0 mt-0.5" size={12} />
                    <span>{dispenseError}</span>
                  </div>
                )}

                <button
                  onClick={handleCompleteDispensing}
                  className="w-full py-3 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl text-xs font-bold uppercase tracking-widest cursor-pointer select-none border-none text-center"
                >
                  Verify and Complete
                </button>
              </div>
            ) : (
              <div className="space-y-4">
                {/* Preset selectors */}
                <div className="space-y-1.5">
                  <span className="text-[9px] font-bold text-slate-400 uppercase tracking-wider">Select Preconfigured Amount</span>
                  <div className="grid grid-cols-3 gap-1.5">
                    {[10, 20, 50, 100, 150, 200].map(val => (
                      <button
                        key={val}
                        onClick={() => {
                          setAmountSAR(String(val));
                          setDispenseError(null);
                        }}
                        className={`py-2 rounded-lg border text-xs font-mono font-bold cursor-pointer select-none transition-all ${
                          amountSAR === String(val)
                            ? 'bg-[#efecfe] text-[#6c5dd3] border-[#6c5dd3]'
                            : 'bg-slate-50 text-slate-500 border-slate-200 hover:bg-slate-100'
                        }`}
                      >
                        SAR {val}
                      </button>
                    ))}
                  </div>
                </div>

                {/* Custom Value */}
                <div className="space-y-1">
                  <span className="text-[9px] font-bold text-slate-400 uppercase tracking-wider">Custom Value (SAR)</span>
                  <div className="relative">
                    <span className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 font-bold font-mono">SAR</span>
                    <input
                      type="number"
                      value={amountSAR}
                      onChange={(e) => {
                        setAmountSAR(e.target.value);
                        setDispenseError(null);
                      }}
                      className="w-full bg-slate-50 text-slate-800 border border-slate-200 rounded-lg py-2 pl-12 pr-3 text-xs font-mono font-bold focus:outline-none focus:border-[#6c5dd3] focus:bg-white"
                      min="1"
                    />
                  </div>
                </div>

                {/* Liters Info Panel */}
                <div className="bg-slate-50 rounded-xl p-3 flex justify-between items-center text-[10px] font-semibold text-slate-500 border border-slate-100">
                  <div>
                    <span>CALCULATED VOLUME:</span>
                    <strong className="block text-slate-800 text-xs font-black font-mono mt-0.5">
                      {calculateLiters(amountSAR, getSelectedPumpPrice(selectedPump)).toFixed(2)} L
                    </strong>
                  </div>
                  <div className="text-right">
                    <span>UNIT PRICE:</span>
                    <strong className="block text-[#6c5dd3] font-bold font-mono mt-0.5">
                      SAR {getSelectedPumpPrice(selectedPump).toFixed(2)}/L
                    </strong>
                  </div>
                </div>

                {dispenseError && (
                  <div className="bg-red-50 border border-red-200 text-red-600 p-2.5 rounded-lg text-[10px] font-semibold flex items-start gap-1">
                    <AlertTriangle className="shrink-0 mt-0.5" size={12} />
                    <span>{dispenseError}</span>
                  </div>
                )}

                <button
                  onClick={handleStartDispensing}
                  className="w-full py-3 bg-[#6c5dd3] hover:bg-[#5c4eb3] text-white rounded-xl text-xs font-bold uppercase tracking-wider border-none cursor-pointer select-none text-center"
                >
                  Start Dispensing
                </button>
              </div>
            )}
          </div>
        </div>
      )}

      {/* =========================================================================
         MODAL INTERFACE: DIGITAL PRINT RECEIPT INSPECTOR
         ========================================================================= */}
      {viewedTx && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/75 backdrop-blur-xs p-4 animate-fade-in">
          <div className="bg-white border border-slate-200 rounded-2xl overflow-hidden shadow-2xl p-5 max-w-sm w-full font-mono text-xs font-semibold relative text-left">
            
            <button
              onClick={() => setViewedTx(null)}
              className="absolute top-4 right-4 p-1 bg-slate-100 hover:bg-slate-200 border border-slate-200 rounded-full text-slate-500 hover:text-white transition-colors cursor-pointer select-none"
            >
              <X size={14} />
            </button>

            <div className="text-center border-b border-dashed border-slate-200 pb-3 mt-2">
              <span className="font-bold text-slate-800 tracking-wider">NOOR FUEL AUTOMATION</span>
              <div className="text-[10px] text-slate-400 mt-1">
                {stations.find(s => s.id === viewedTx.stationId)?.name || 'Central Telemetry'}
              </div>
            </div>

            <div className="space-y-2 border-b border-dashed border-slate-200 py-3 text-slate-600">
              <div className="flex justify-between">
                <span>TX ID:</span>
                <span className="font-bold text-slate-800">{viewedTx.id.toUpperCase()}</span>
              </div>
              <div className="flex justify-between">
                <span>TIMESTAMP:</span>
                <span>{viewedTx.timestamp}</span>
              </div>
              <div className="flex justify-between">
                <span>PUMP ID:</span>
                <span className="font-bold text-slate-800">
                  {viewedTx.pumpId === 'DELIVERY_BAY' ? 'Logistics Bay' : `Dispenser ${viewedTx.pumpId.slice(-2)}`}
                </span>
              </div>
              <div className="flex justify-between">
                <span>FUEL GRADE:</span>
                <span className="font-bold text-[#6c5dd3]">{viewedTx.fuelType}</span>
              </div>
              <div className="flex justify-between">
                <span>PRICE/LITRE:</span>
                <span>SAR {viewedTx.pricePerLitre ? viewedTx.pricePerLitre.toFixed(2) : '2.18'}</span>
              </div>
              <div className="flex justify-between">
                <span>ATTENDANT:</span>
                <span className="font-bold text-slate-800">{viewedTx.operator ? viewedTx.operator.split('@')[0] : 'Attendant'}</span>
              </div>
              {viewedTx.customer && (
                <div className="flex justify-between">
                  <span>CUSTOMER:</span>
                  <span className="font-bold text-slate-800 truncate max-w-[150px]">{viewedTx.customer}</span>
                </div>
              )}
            </div>

            <div className="space-y-2 py-3">
              <div className="flex justify-between text-slate-500 font-sans text-[11px] font-bold">
                <span>VOLUME DELIVERED:</span>
                <span className="text-slate-800 font-mono text-sm font-black">{viewedTx.volume.toFixed(2)} L</span>
              </div>
              <div className="flex justify-between text-emerald-600 font-sans text-sm font-bold pt-1.5 border-t border-slate-100">
                <span>TOTAL AMOUNT:</span>
                <span className="font-mono font-black">SAR {viewedTx.amount.toFixed(2)}</span>
              </div>
            </div>

            <button
              onClick={() => setViewedTx(null)}
              className="w-full py-3 bg-[#6c5dd3] hover:bg-[#5c4eb3] text-white rounded-xl text-xs font-bold uppercase tracking-wider transition-all shadow-md select-none cursor-pointer border-none text-center font-sans mt-2"
            >
              Dismiss Receipt
            </button>
          </div>
        </div>
      )}

      {/* =========================================================================
         MODAL INTERFACE: COMPLETED Dispensing Session Confirmation Receipt
         ========================================================================= */}
      {completedReceipt && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/75 backdrop-blur-xs p-4 animate-fade-in">
          <div className="bg-white border border-slate-200 rounded-2xl overflow-hidden shadow-2xl p-5 max-w-sm w-full font-mono text-xs font-semibold relative text-left">
            
            <button
              onClick={() => setCompletedReceipt(null)}
              className="absolute top-4 right-4 p-1 bg-slate-100 hover:bg-slate-200 border border-slate-200 rounded-full text-slate-500 hover:text-white transition-colors cursor-pointer select-none"
            >
              <X size={14} />
            </button>

            <div className="text-center space-y-2 py-4 font-sans">
              <div className="inline-flex items-center justify-center w-14 h-14 rounded-full bg-emerald-50 border border-emerald-200 text-emerald-500 shadow-xs">
                <CheckCircle size={28} />
              </div>
              <h3 className="text-sm font-black text-slate-800 uppercase tracking-wider">Sale Logged & Synced</h3>
              <p className="text-[10px] text-slate-500 font-medium">Inventory updated successfully in database</p>
            </div>

            <div className="border-t border-dashed border-slate-200 pt-3">
              <div className="text-center mb-3">
                <span className="font-bold text-slate-800 tracking-wider">NOOR FUEL AUTOMATION</span>
                <div className="text-[10px] text-slate-400 mt-1">{completedReceipt.stationName}</div>
              </div>

              <div className="space-y-2 border-b border-dashed border-slate-200 pb-3 text-slate-600">
                <div className="flex justify-between">
                  <span>TX ID:</span>
                  <span className="font-bold text-slate-800">{completedReceipt.txNumber}</span>
                </div>
                <div className="flex justify-between">
                  <span>TIMESTAMP:</span>
                  <span>{completedReceipt.timestamp}</span>
                </div>
                <div className="flex justify-between">
                  <span>PUMP NOZZLE:</span>
                  <span className="font-bold text-slate-800">{completedReceipt.pumpLabel}</span>
                </div>
                <div className="flex justify-between">
                  <span>FUEL GRADE:</span>
                  <span className="font-bold text-[#6c5dd3]">{completedReceipt.fuelType}</span>
                </div>
                <div className="flex justify-between">
                  <span>PRICE PER L:</span>
                  <span>SAR {completedReceipt.price.toFixed(2)}</span>
                </div>
                {completedReceipt.customer && (
                  <div className="flex justify-between">
                    <span>CUSTOMER:</span>
                    <span className="font-bold text-slate-800 truncate max-w-[150px]">{completedReceipt.customer}</span>
                  </div>
                )}
              </div>

              <div className="space-y-2 py-3">
                <div className="flex justify-between text-slate-500 font-sans text-[11px] font-bold">
                  <span>VOLUME DISPENSED:</span>
                  <span className="text-slate-800 font-mono text-sm font-black">{completedReceipt.liters.toFixed(2)} L</span>
                </div>
                <div className="flex justify-between text-emerald-600 font-sans text-sm font-bold pt-1.5 border-t border-slate-100">
                  <span>TOTAL AMOUNT:</span>
                  <span className="font-mono font-black">SAR {completedReceipt.amount.toFixed(2)}</span>
                </div>
              </div>
            </div>

            <button
              onClick={() => setCompletedReceipt(null)}
              className="w-full py-3 bg-[#6c5dd3] hover:bg-[#5c4eb3] text-white rounded-xl text-xs font-bold uppercase tracking-wider transition-all shadow-md select-none cursor-pointer border-none text-center font-sans mt-2"
            >
              Verify & Return
            </button>
          </div>
        </div>
      )}

      {/* =========================================================================
         MODAL INTERFACE: AUTOMATED SIMULATOR PANEL (COMMAND DECK)
         ========================================================================= */}
      {isSimulatorOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/75 backdrop-blur-xs p-4 animate-fade-in">
          <div className="bg-white border border-slate-200 rounded-2xl overflow-hidden shadow-2xl p-5 max-w-sm w-full font-sans text-xs relative text-left">
            
            <button
              onClick={() => setIsSimulatorOpen(false)}
              className="absolute top-4 right-4 p-1 bg-slate-100 hover:bg-slate-200 border border-slate-200 rounded-full text-slate-500 hover:text-slate-800 transition-colors cursor-pointer select-none"
            >
              <X size={14} />
            </button>

            <h3 className="text-sm font-black text-slate-900 uppercase tracking-wide mb-3 pr-8 border-b border-slate-100 pb-2 flex items-center gap-1.5">
              <Sparkles size={16} className="text-[#6c5dd3]" />
              <span>COMMAND DECK SIMULATOR</span>
            </h3>

            <p className="text-[10px] text-slate-500 mb-4 font-semibold leading-relaxed">
              Use these tools to simulate live pump actions. Dispensed logs will automatically sync in real-time.
            </p>

            <div className="space-y-3">
              {stationPumps.map(pump => {
                const isIdle = pump.status === 'IDLE';
                return (
                  <div key={pump.id} className="flex justify-between items-center bg-slate-50 p-2.5 rounded-xl border border-slate-200">
                    <span className="font-bold text-slate-700">{pump.label} ({pump.fuelType})</span>
                    <button
                      disabled={!isIdle}
                      onClick={() => {
                        setIsSimulatorOpen(false);
                        setSelectedPump(pump);
                      }}
                      className={`px-3 py-1.5 rounded-lg text-[10px] font-black uppercase tracking-wider transition-all select-none border-none cursor-pointer ${
                        isIdle 
                          ? 'bg-[#6c5dd3] hover:bg-[#5c4eb3] text-white shadow-xs' 
                          : 'bg-slate-200 text-slate-400 cursor-not-allowed'
                      }`}
                    >
                      {isIdle ? 'Simulate Fueling' : 'Pumping...'}
                    </button>
                  </div>
                );
              })}
            </div>

            <button
              onClick={() => setIsSimulatorOpen(false)}
              className="w-full py-3 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-xl text-xs font-bold uppercase tracking-wider select-none cursor-pointer border border-slate-300 text-center font-sans mt-4"
            >
              Dismiss
            </button>
          </div>
        </div>
      )}
    </div>
  );
};
export default MobileDispenserApp;
