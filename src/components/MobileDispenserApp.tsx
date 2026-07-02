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
  Play,
  CheckCircle2,
  Sparkles
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

  // Bottom Navigation tab: 'pumps' or 'transactions'
  const [activeTab, setActiveTab] = useState<'pumps' | 'transactions'>('pumps');

  // Search & Filter states for Transactions Log page
  const [txSearchText, setTxSearchText] = useState<string>('');
  const [txGradeFilter, setTxGradeFilter] = useState<string>('ALL');
  const [txSortOrder, setTxSortOrder] = useState<'newest' | 'oldest'>('newest');
  
  // Modal states
  const [selectedPump, setSelectedPump] = useState<FuelPump | null>(null);
  const [viewedTx, setViewedTx] = useState<SalesTransaction | null>(null);
  const [isSimulatorOpen, setIsSimulatorOpen] = useState<boolean>(false);

  // Dispenser flow states
  const [amountSAR, setAmountSAR] = useState<string>('50');
  const [customerName, setCustomerName] = useState<string>('');
  const [dispenseError, setDispenseError] = useState<string | null>(null);
  const [selectedNozzle, setSelectedNozzle] = useState<'A' | 'B'>('A');
  
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

  // Auto-calculated helpers
  const getSelectedPumpPrice = (pumpObj: FuelPump, nozzle: 'A' | 'B'): number => {
    const grade = nozzle === 'A' ? 'GAS91' : 'GAS95';
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

    const price = getSelectedPumpPrice(selectedPump, selectedNozzle);
    const amount = parseFloat(amountSAR);
    if (isNaN(amount) || amount <= 0) {
      setDispenseError('Enter a valid purchase amount.');
      return;
    }

    const liters = amount / price;
    const grade = selectedNozzle === 'A' ? 'GAS91' : 'GAS95';

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
  const handleCompleteDispensing = (pumpObj: FuelPump) => {
    setDispenseError(null);

    const grade = pumpObj.activeFuelGrade || pumpObj.fuelType || 'GAS91';
    const price = activeStation?.fuelPricing[grade] || 2.18;
    const vol = pumpObj.volumeThisSession || 0;
    const amt = vol * price;
    const attendant = session.name;

    const res = confirmDispenseTransaction(pumpObj.id, attendant, customerName || undefined);
    if (res.success) {
      // Build receipt
      setCompletedReceipt({
        txNumber: `TX-${Date.now().toString().slice(-8)}`,
        timestamp: new Date().toLocaleDateString('en-US', { month: '2-digit', day: '2-digit' }) + ' ' + new Date().toLocaleTimeString('en-US', { hour12: false, hour: '2-digit', minute: '2-digit' }),
        stationName: activeStation?.name || 'Assigned Station',
        pumpLabel: pumpObj.label,
        fuelType: grade,
        price: price,
        amount: amt,
        liters: vol,
        operator: attendant,
        customer: customerName || undefined
      });
      // Clear inputs
      setSelectedPump(null);
      setAmountSAR('50');
      setCustomerName('');
    } else {
      setDispenseError(res.message);
    }
  };

  // Sync state if active pumping transitions in background
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

  // SVG Custom Nozzle icon matching the mockup shapes
  const renderNozzleBoxSVG = (letter: 'A' | 'B', isActive: boolean, activeColorClass: string) => {
    let borderStyle = 'border-slate-800 bg-[#162032] text-slate-500';
    let iconColor = 'text-slate-500';
    let textColor = 'text-slate-500';

    if (isActive) {
      if (activeColorClass === 'emerald') {
        borderStyle = 'border-emerald-500 bg-emerald-950/20 text-emerald-400';
        iconColor = 'text-emerald-400';
        textColor = 'text-emerald-400';
      } else if (activeColorClass === 'amber') {
        borderStyle = 'border-amber-500 bg-amber-950/20 text-amber-400';
        iconColor = 'text-amber-400';
        textColor = 'text-amber-400';
      } else if (activeColorClass === 'blue') {
        borderStyle = 'border-blue-500 bg-blue-950/20 text-blue-400';
        iconColor = 'text-blue-400';
        textColor = 'text-blue-400';
      }
    }

    return (
      <div className={`w-10 h-11 rounded-lg border flex flex-col items-center justify-between py-1 transition-all ${borderStyle}`}>
        <Fuel size={12} className={iconColor} />
        <span className="text-[8px] font-black mt-0.5 leading-none">{letter}</span>
      </div>
    );
  };

  return (
    <div className="min-h-screen w-full bg-[#090d16] text-[#f1f5f9] flex flex-col justify-between font-sans select-none overflow-x-hidden">
      
      {/* 1. SCROLLABLE CORE VIEWPORT */}
      <div className="flex-1 w-full max-w-md mx-auto flex flex-col min-h-screen pb-20">
        
        {/* App Bar Header */}
        <header className="sticky top-0 bg-[#090d16]/95 backdrop-blur-md px-5 py-4 space-y-3 z-40 border-b border-slate-900 text-left">
          <div className="flex items-center justify-between">
            <h1 className="text-lg font-black text-white tracking-wide">Noor Mobile</h1>
            
            {/* Attendant User Badge Pill */}
            <div className="bg-[#1e293b]/70 border border-slate-800 rounded-full px-3 py-1 flex items-center gap-2">
              <div className="relative">
                <div className="w-6 h-6 rounded-full bg-[#6c5dd3] text-white flex items-center justify-center font-bold uppercase text-[10px]">
                  {session.name.slice(0, 2).toUpperCase()}
                </div>
                <span className="absolute bottom-0 right-0 w-2 h-2 bg-[#22c55e] rounded-full border border-slate-900"></span>
              </div>
              <div className="text-left leading-none">
                <h4 className="text-[10px] font-black text-white truncate max-w-[70px]">{session.name.split('@')[0]}</h4>
                <span className="text-[8px] font-bold text-emerald-400 uppercase tracking-widest block mt-0.5">Operator</span>
              </div>
            </div>
          </div>

          {/* Active Station Context Bar */}
          <div className="flex items-center gap-1.5 text-xs text-slate-400 font-semibold pl-0.5">
            <MapPin size={12} className="text-[#8c7dfc] shrink-0" />
            <span>Active Station: <strong className="text-slate-200">{activeStation?.name || 'Al Noor - Noor Abha'}</strong></span>
          </div>
        </header>

        {/* Dynamic content rendering wrapper */}
        <main className="flex-1 px-5 py-5 space-y-4">
          
          {activeTab === 'pumps' ? (
            /* =========================================================================
               PUMP LIST TAB
               ========================================================================= */
            stationPumps.length === 0 ? (
              <div className="py-16 text-center text-slate-500 italic text-xs font-semibold border border-dashed border-slate-800 rounded-2xl">
                No active dispenser nozzles configured at this station.
              </div>
            ) : (
              stationPumps.map((pump) => {
                const isIdle = pump.status === 'IDLE';
                const isPumping = pump.status === 'PUMPING';
                const isCompleted = pump.status === 'COMPLETED';
                const price = activeStation?.fuelPricing[pump.fuelType || 'GAS91'] || 2.18;

                // Color mappings based on mockup
                let cardBorder = 'border-slate-800 bg-[#111827]/75';
                let nozzleColor = 'grey';

                if (isIdle) {
                  cardBorder = 'border-[#22c55e] shadow-lg shadow-emerald-950/10';
                  nozzleColor = 'emerald';
                } else if (isPumping) {
                  cardBorder = 'border-[#f97316] shadow-lg shadow-orange-950/10';
                  nozzleColor = 'amber';
                } else if (isCompleted) {
                  cardBorder = 'border-[#3b82f6] shadow-lg shadow-blue-950/10';
                  nozzleColor = 'blue';
                }

                return (
                  <div 
                    key={pump.id}
                    className={`border rounded-2xl p-5 text-left transition-all ${cardBorder}`}
                  >
                    <div className="space-y-4">
                      {/* Top Row: Pump details, state bullet & nozzle selector layout */}
                      <div className="flex items-center justify-between">
                        <div className="space-y-1">
                          <h3 className="text-base font-black text-white">{pump.label === 'Nozzle 1' ? 'Pump 01' : pump.label === 'Nozzle 2' ? 'Pump 02' : 'Pump 03'}</h3>
                          <div className="flex items-center gap-1.5 text-xs font-bold leading-none">
                            {isIdle && (
                              <>
                                <span className="w-1.5 h-1.5 bg-[#22c55e] rounded-full"></span>
                                <span className="text-[#22c55e]">Available</span>
                              </>
                            )}
                            {isPumping && (
                              <>
                                <span className="w-1.5 h-1.5 bg-orange-500 rounded-full animate-pulse"></span>
                                <span className="text-orange-500">Dispensing</span>
                              </>
                            )}
                            {isCompleted && (
                              <>
                                <span className="w-1.5 h-1.5 bg-blue-500 rounded-full"></span>
                                <span className="text-blue-500">Pumping Done</span>
                              </>
                            )}
                          </div>
                        </div>

                        {/* Top Right Nozzle selector icons */}
                        <div className="flex items-center gap-1.5">
                          {renderNozzleBoxSVG('A', pump.fuelType === 'GAS91' || pump.activeFuelGrade === 'GAS91', nozzleColor)}
                          {renderNozzleBoxSVG('B', pump.fuelType === 'GAS95' || pump.activeFuelGrade === 'GAS95', nozzleColor)}
                        </div>
                      </div>

                      {/* Middle Row: Layout maps to active dispensing variables */}
                      {isPumping && (
                        <div className="space-y-3 py-1 font-sans">
                          {/* Large orange metrics text */}
                          <div className="text-lg font-bold text-slate-350">
                            <span className="text-2xl font-black text-[#f97316] font-mono">{(pump.volumeThisSession || 0).toFixed(2)}</span> Liters /{' '}
                            <span className="text-slate-400">SAR</span> <span className="text-2xl font-black text-[#f97316] font-mono">{((pump.volumeThisSession || 0) * price).toFixed(2)}</span>
                          </div>

                          {/* Horizontal Progress Bar */}
                          <div className="w-full bg-[#162032] h-2 rounded-full overflow-hidden border border-slate-900">
                            <div 
                              className="bg-orange-500 h-full transition-all duration-300"
                              style={{ width: `${Math.min(100, ((pump.volumeThisSession || 0) / 25) * 100)}%` }} // simulated progress
                            />
                          </div>

                          {/* active user info footer */}
                          <div className="flex items-center gap-2 border-t border-slate-900 pt-2 text-[10px] text-slate-400 font-semibold leading-none">
                            <div className="w-3.5 h-3.5 bg-emerald-600/30 text-emerald-400 flex items-center justify-center rounded font-mono text-[9px]">A</div>
                            <div className="w-4 h-4 rounded-full bg-[#8c7dfc] text-white flex items-center justify-center font-bold text-[8px]">KM</div>
                            <span>Active User: <strong className="text-slate-200">Khalid M.</strong></span>
                          </div>
                        </div>
                      )}

                      {isCompleted && (
                        <div className="space-y-4 font-sans">
                          <div className="text-xs text-slate-350 font-bold border-b border-slate-900 pb-3">
                            Total: <strong className="text-white font-mono">{(pump.volumeThisSession || 0).toFixed(2)} L</strong> •{' '}
                            <span className="text-[#3b82f6] font-mono">SAR {((pump.volumeThisSession || 0) * price).toFixed(2)}</span>
                          </div>

                          {/* solid blue complete action button */}
                          <button
                            onClick={() => handleCompleteDispensing(pump)}
                            className="w-full py-3 bg-[#2563eb] hover:bg-blue-600 text-white rounded-xl text-xs font-black uppercase tracking-wider transition-all shadow-md select-none cursor-pointer border-none text-center"
                          >
                            Complete Transaction
                          </button>

                          {/* Receipt link */}
                          <button
                            onClick={() => {
                              // show previous invoice view template
                              const stubTx: SalesTransaction = {
                                id: `tx-sale-stub-${Date.now()}`,
                                stationId: pump.stationId,
                                timestamp: new Date().toLocaleDateString('en-US', { month: '2-digit', day: '2-digit' }) + ' ' + new Date().toLocaleTimeString('en-US', { hour12: false, hour: '2-digit', minute: '2-digit' }),
                                pumpId: pump.id,
                                fuelType: pump.activeFuelGrade || pump.fuelType || 'GAS91',
                                volume: pump.volumeThisSession || 0,
                                heightBefore: 500,
                                heightAfter: 480,
                                temperature: 32,
                                waterLevel: 0,
                                pricePerLitre: price,
                                amount: (pump.volumeThisSession || 0) * price,
                                status: 'FINISHED',
                                operator: session.name
                              };
                              setViewedTx(stubTx);
                            }}
                            className="w-full text-center text-xs font-bold text-slate-450 hover:text-white transition-colors cursor-pointer select-none bg-transparent border-none py-1 block"
                          >
                            View Receipt
                          </button>
                        </div>
                      )}

                      {isIdle && (
                        /* Split start pump / view logs footer buttons */
                        <div className="grid grid-cols-2 border-t border-slate-900 pt-3 text-xs font-bold text-slate-400">
                          <button
                            onClick={() => {
                              setSelectedPump(pump);
                              setSelectedNozzle('A'); // defaults
                            }}
                            className="flex items-center justify-center gap-1.5 hover:text-white transition-colors cursor-pointer bg-transparent border-none py-1 pr-2 border-r border-slate-900"
                          >
                            <Play size={12} className="text-emerald-500 fill-emerald-500" />
                            <span>Start Pump</span>
                          </button>

                          <button
                            onClick={() => {
                              setActiveTab('transactions');
                              setTxSearchText(pump.id);
                            }}
                            className="flex items-center justify-center gap-1.5 hover:text-white transition-colors cursor-pointer bg-transparent border-none py-1 pl-2"
                          >
                            <ClipboardList size={13} className="text-indigo-400" />
                            <span>View Logs</span>
                          </button>
                        </div>
                      )}
                    </div>
                  </div>
                );
              })
            )
          ) : (
            /* =========================================================================
               TRANSACTIONS LOG TAB
               ========================================================================= */
            <div className="space-y-4 text-left animate-fade-in">
              <div className="bg-[#111827]/75 border border-slate-800 rounded-2xl p-5 space-y-4">
                <div className="space-y-1">
                  <h3 className="text-sm font-black text-white uppercase tracking-wider">Historical Transactions Log</h3>
                  <p className="text-[10px] text-slate-450 font-semibold leading-relaxed">Search, filter, and review completed attendant fueling logs.</p>
                </div>

                {/* Filter forms */}
                <div className="space-y-2">
                  <div className="relative">
                    <Search size={13} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-500" />
                    <input
                      type="text"
                      placeholder="Search TX ID, customer, operator..."
                      value={txSearchText}
                      onChange={(e) => setTxSearchText(e.target.value)}
                      className="w-full bg-[#090d16] border border-slate-800 rounded-xl py-2 pl-9 pr-4 text-xs font-semibold text-white focus:outline-none focus:border-[#8c7dfc] placeholder-slate-600"
                    />
                    {txSearchText && (
                      <button onClick={() => setTxSearchText('')} className="absolute right-3.5 top-1/2 -translate-y-1/2 text-slate-500 hover:text-white">
                        <X size={12} />
                      </button>
                    )}
                  </div>

                  <div className="flex gap-2">
                    <select
                      value={txGradeFilter}
                      onChange={(e) => setTxGradeFilter(e.target.value)}
                      className="flex-1 bg-[#090d16] border border-slate-800 rounded-xl px-2.5 py-2 text-[10px] font-black text-slate-350 outline-none uppercase"
                    >
                      <option value="ALL">All Grades</option>
                      <option value="GAS91">GAS91</option>
                      <option value="GAS95">GAS95</option>
                      <option value="GAS98">GAS98</option>
                      <option value="DIESEL">Diesel</option>
                    </select>

                    <button
                      onClick={() => setTxSortOrder(prev => prev === 'newest' ? 'oldest' : 'newest')}
                      className="flex items-center gap-1.5 px-3 py-2 bg-[#090d16] border border-slate-800 rounded-xl text-[10px] font-black uppercase text-slate-350 hover:bg-[#111827]"
                    >
                      <ArrowUpDown size={11} className="text-[#8c7dfc]" />
                      <span>{txSortOrder === 'newest' ? 'Newest' : 'Oldest'}</span>
                    </button>
                  </div>
                </div>
              </div>

              {/* Transactions List */}
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
                    <div className="py-12 text-center text-slate-500 italic text-xs font-semibold border border-dashed border-slate-850 rounded-2xl">
                      No matching transaction logs found.
                    </div>
                  );
                }

                return (
                  <div className="space-y-3">
                    {sorted.map(tx => {
                      const is91 = tx.fuelType === 'GAS91';
                      const isFinished = tx.status === 'FINISHED';
                      return (
                        <div
                          key={tx.id}
                          onClick={() => setViewedTx(tx)}
                          className="bg-[#111827]/75 border border-slate-850 rounded-2xl p-4 flex justify-between items-center hover:bg-[#162032] transition-all cursor-pointer shadow-xs"
                        >
                          <div className="space-y-1.5 flex-1 min-w-0 pr-3">
                            <div className="flex items-center gap-1.5">
                              <span className="text-[10px] font-mono font-bold text-slate-300 truncate">{tx.id.toUpperCase()}</span>
                              <span className={`px-1.5 py-0.2 rounded text-[7px] font-black uppercase ${
                                isFinished ? 'bg-emerald-500/10 text-emerald-400 border border-emerald-500/20' : 'bg-amber-500/10 text-amber-400 border border-amber-500/20'
                              }`}>
                                {tx.status}
                              </span>
                            </div>
                            
                            <div className="flex items-center gap-1.5 text-[9px] text-slate-500 font-semibold">
                              <span className={`inline-block text-[8px] font-black px-1.5 rounded border uppercase font-mono ${
                                is91 
                                  ? 'bg-[#e6fbf2]/5 text-[#22c55e] border-[#bbf7d0]/20' 
                                  : 'bg-[#fef2f2]/5 text-[#ef4444] border-[#fecaca]/20'
                              }`}>
                                {tx.fuelType}
                              </span>
                              <span className="truncate">{tx.pumpId === 'DELIVERY_BAY' ? 'Replenish' : `Pump ${tx.pumpId.slice(-2)}`}</span>
                              <span>•</span>
                              <span className="truncate">{tx.operator ? tx.operator.split('@')[0] : 'Attendant'}</span>
                            </div>

                            <div className="text-[8px] text-slate-600 font-mono">{tx.timestamp}</div>
                          </div>

                          <div className="text-right flex flex-col justify-center items-end shrink-0">
                            {tx.volume > 0 && (
                              <>
                                <span className="text-xs font-mono font-black text-emerald-400">SAR {tx.amount.toFixed(2)}</span>
                                <span className="text-[9px] text-slate-450 font-bold font-mono">{tx.volume.toFixed(2)} L</span>
                              </>
                            )}
                          </div>
                        </div>
                      );
                    })}
                  </div>
                );
              })()}
            </div>
          )}
        </main>
      </div>

      {/* 2. STICKY BOTTOM TABS MENU NAVIGATION */}
      <nav className="fixed bottom-0 left-0 right-0 max-w-md mx-auto bg-[#0d1321]/95 backdrop-blur-md border-t border-slate-900 grid grid-cols-3 z-45 shrink-0">
        <button
          onClick={() => {
            setActiveTab('pumps');
            setCompletedReceipt(null);
            setSelectedPump(null);
          }}
          className={`py-3 flex flex-col items-center justify-center gap-0.5 border-none cursor-pointer transition-all select-none bg-transparent ${
            activeTab === 'pumps' ? 'text-[#3b82f6]' : 'text-slate-500 hover:text-slate-350'
          }`}
        >
          <Fuel size={16} className={activeTab === 'pumps' ? 'text-[#3b82f6]' : 'text-slate-500'} />
          <span className="text-[8px] font-black uppercase tracking-wider">Pumps</span>
        </button>

        <button
          onClick={() => {
            setActiveTab('transactions');
            setCompletedReceipt(null);
            setSelectedPump(null);
          }}
          className={`py-3 flex flex-col items-center justify-center gap-0.5 border-none cursor-pointer transition-all select-none bg-transparent ${
            activeTab === 'transactions' ? 'text-[#3b82f6]' : 'text-slate-500 hover:text-slate-350'
          }`}
        >
          <ClipboardList size={16} className={activeTab === 'transactions' ? 'text-[#3b82f6]' : 'text-slate-500'} />
          <span className="text-[8px] font-black uppercase tracking-wider">Transactions</span>
        </button>

        <button
          onClick={handleLogout}
          className="py-3 flex flex-col items-center justify-center gap-0.5 border-none cursor-pointer transition-all select-none bg-transparent text-slate-500 hover:text-red-400"
        >
          <LogOut size={16} className="text-slate-500" />
          <span className="text-[8px] font-black uppercase tracking-wider">Exit</span>
        </button>
      </nav>

      {/* 3. FLOATING ACTION BUTTON: COMMAND DECK SIMULATOR */}
      <button
        onClick={() => setIsSimulatorOpen(true)}
        className="fixed bottom-18 right-6 w-11 h-11 bg-[#6c5dd3] hover:bg-[#5c4eb3] text-white rounded-full flex items-center justify-center shadow-lg shadow-indigo-500/20 cursor-pointer border-none select-none z-30 transition-all hover:scale-105 active:scale-95"
        title="Command Deck Simulator"
      >
        <Sparkles size={16} />
      </button>

      {/* =========================================================================
         POPUP SHEET: ATtendant Fueling Setup & presets
         ========================================================================= */}
      {selectedPump && !selectedPump.status.includes('PUMPING') && !selectedPump.status.includes('COMPLETED') && (
        <div className="fixed inset-0 z-50 flex items-end justify-center bg-black/75 backdrop-blur-xs p-4 animate-fade-in">
          <div className="bg-[#111827] border border-slate-850 rounded-t-3xl max-w-sm w-full p-5 space-y-4 text-left relative animate-slide-up">
            
            <button
              onClick={() => {
                setSelectedPump(null);
                setDispenseError(null);
              }}
              className="absolute top-4 right-4 p-1 bg-slate-900 hover:bg-slate-800 border border-slate-800 rounded-full text-slate-500 hover:text-white transition-colors cursor-pointer select-none"
            >
              <X size={14} />
            </button>

            <h3 className="text-sm font-black text-white uppercase tracking-wider border-b border-slate-800 pb-2">
              Start Fueling Simulation
            </h3>

            {/* Nozzle grade switch */}
            <div className="space-y-1.5">
              <span className="text-[9px] font-black text-slate-400 uppercase tracking-wider block">1. Select Nozzle / Product Grade</span>
              <div className="grid grid-cols-2 gap-2">
                <button
                  type="button"
                  onClick={() => setSelectedNozzle('A')}
                  className={`py-3 rounded-xl border text-xs font-mono font-black transition-all cursor-pointer select-none ${
                    selectedNozzle === 'A'
                      ? 'bg-[#102a1e] text-[#22c55e] border-[#22c55e] shadow-md'
                      : 'bg-[#090d16] text-slate-500 border-slate-800 hover:text-slate-350'
                  }`}
                >
                  Nozzle A (GAS91)
                </button>
                <button
                  type="button"
                  onClick={() => setSelectedNozzle('B')}
                  className={`py-3 rounded-xl border text-xs font-mono font-black transition-all cursor-pointer select-none ${
                    selectedNozzle === 'B'
                      ? 'bg-[#3b1212] text-[#ef4444] border-[#ef4444] shadow-md'
                      : 'bg-[#090d16] text-slate-500 border-slate-800 hover:text-slate-350'
                  }`}
                >
                  Nozzle B (GAS95)
                </button>
              </div>
            </div>

            {/* Presets */}
            <div className="space-y-1.5">
              <span className="text-[9px] font-black text-slate-400 uppercase tracking-wider block">2. Select Preset Amount (SAR)</span>
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
                        ? 'bg-[#efecfe]/10 text-[#8c7dfc] border-[#8c7dfc]'
                        : 'bg-[#090d16] text-slate-500 border-slate-850 hover:text-slate-350'
                    }`}
                  >
                    SAR {val}
                  </button>
                ))}
              </div>
            </div>

            {/* Custom Manual Input */}
            <div className="space-y-1">
              <span className="text-[9px] font-black text-slate-400 uppercase tracking-wider block">Or Custom Value (SAR)</span>
              <div className="relative">
                <span className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-500 font-bold font-mono text-[10px]">SAR</span>
                <input
                  type="number"
                  value={amountSAR}
                  onChange={(e) => {
                    setAmountSAR(e.target.value);
                    setDispenseError(null);
                  }}
                  className="w-full bg-[#090d16] text-white border border-slate-800 rounded-lg py-2 pl-12 pr-3 text-xs font-mono font-bold focus:outline-none focus:border-[#8c7dfc]"
                  min="1"
                />
              </div>
            </div>

            <div className="bg-[#090d16] rounded-xl p-3 flex justify-between items-center text-[10px] font-semibold text-slate-500 border border-slate-850">
              <div>
                <span>CALCULATED VOLUME:</span>
                <strong className="block text-slate-200 text-xs font-black font-mono mt-0.5">
                  {calculateLiters(amountSAR, getSelectedPumpPrice(selectedPump, selectedNozzle)).toFixed(2)} L
                </strong>
              </div>
              <div className="text-right">
                <span>UNIT PRICE:</span>
                <strong className="block text-[#8c7dfc] font-bold font-mono mt-0.5">
                  SAR {getSelectedPumpPrice(selectedPump, selectedNozzle).toFixed(2)}/L
                </strong>
              </div>
            </div>

            {dispenseError && (
              <div className="bg-red-500/10 border border-red-500/20 text-red-400 p-2.5 rounded-lg text-[10px] font-semibold flex items-start gap-1">
                <AlertTriangle className="shrink-0 mt-0.5" size={12} />
                <span>{dispenseError}</span>
              </div>
            )}

            <button
              onClick={handleStartDispensing}
              className="w-full py-3 bg-[#6c5dd3] hover:bg-[#5c4eb3] text-white rounded-xl text-xs font-bold uppercase tracking-wider border-none cursor-pointer select-none text-center shadow-md shadow-indigo-900/30"
            >
              Start Dispensing Nozzle
            </button>
          </div>
        </div>
      )}

      {/* =========================================================================
         MODAL INTERFACE: DIGITAL PRINT RECEIPT INSPECTOR
         ========================================================================= */}
      {viewedTx && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/75 backdrop-blur-xs p-4 animate-fade-in">
          <div className="bg-[#111827] border border-slate-800 rounded-2xl overflow-hidden shadow-2xl p-5 max-w-sm w-full font-mono text-xs font-semibold relative text-left">
            
            <button
              onClick={() => setViewedTx(null)}
              className="absolute top-4 right-4 p-1 bg-slate-900 hover:bg-slate-800 border border-slate-800 rounded-full text-slate-500 hover:text-white transition-colors cursor-pointer select-none"
            >
              <X size={14} />
            </button>

            <div className="text-center border-b border-dashed border-slate-800 pb-3 mt-2">
              <span className="font-bold text-slate-350 tracking-wider">NOOR FUEL AUTOMATION</span>
              <div className="text-[10px] text-slate-500 mt-1">
                {stations.find(s => s.id === viewedTx.stationId)?.name || 'Central Telemetry'}
              </div>
            </div>

            <div className="space-y-2 border-b border-dashed border-slate-800 py-3 text-slate-400">
              <div className="flex justify-between">
                <span>TX ID:</span>
                <span className="font-bold text-white text-[10px] truncate max-w-[150px]">{viewedTx.id.toUpperCase()}</span>
              </div>
              <div className="flex justify-between">
                <span>TIMESTAMP:</span>
                <span>{viewedTx.timestamp}</span>
              </div>
              <div className="flex justify-between">
                <span>PUMP ID:</span>
                <span className="font-bold text-white">
                  {viewedTx.pumpId === 'DELIVERY_BAY' ? 'Logistics Bay' : `Dispenser ${viewedTx.pumpId.slice(-2)}`}
                </span>
              </div>
              <div className="flex justify-between">
                <span>FUEL GRADE:</span>
                <span className="font-bold text-[#8c7dfc]">{viewedTx.fuelType}</span>
              </div>
              <div className="flex justify-between">
                <span>PRICE/LITRE:</span>
                <span>SAR {viewedTx.pricePerLitre ? viewedTx.pricePerLitre.toFixed(2) : '2.18'}</span>
              </div>
              <div className="flex justify-between">
                <span>ATTENDANT:</span>
                <span className="font-bold text-indigo-300">{viewedTx.operator ? viewedTx.operator.split('@')[0] : 'Attendant'}</span>
              </div>
              {viewedTx.customer && (
                <div className="flex justify-between">
                  <span>CUSTOMER:</span>
                  <span className="font-bold text-white truncate max-w-[150px]">{viewedTx.customer}</span>
                </div>
              )}
            </div>

            <div className="space-y-2 py-3">
              <div className="flex justify-between text-slate-500 font-sans text-[11px] font-bold">
                <span>VOLUME DELIVERED:</span>
                <span className="text-white font-mono text-sm font-black">{viewedTx.volume.toFixed(2)} L</span>
              </div>
              <div className="flex justify-between text-emerald-400 font-sans text-sm font-bold pt-1.5 border-t border-slate-900">
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
         MODAL INTERFACE: COMPLETED Dispensing confirmation receipt
         ========================================================================= */}
      {completedReceipt && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/75 backdrop-blur-xs p-4 animate-fade-in">
          <div className="bg-[#111827] border border-slate-800 rounded-2xl overflow-hidden shadow-2xl p-5 max-w-sm w-full font-mono text-xs font-semibold relative text-left">
            
            <button
              onClick={() => setCompletedReceipt(null)}
              className="absolute top-4 right-4 p-1 bg-slate-900 hover:bg-slate-800 border border-slate-800 rounded-full text-slate-500 hover:text-white transition-colors cursor-pointer select-none"
            >
              <X size={14} />
            </button>

            <div className="text-center space-y-2 py-4 font-sans">
              <div className="inline-flex items-center justify-center w-14 h-14 rounded-full bg-emerald-500/10 border border-emerald-500/30 text-emerald-400 shadow-xs">
                <CheckCircle size={28} />
              </div>
              <h3 className="text-sm font-black text-white uppercase tracking-wider">Sale Logged & Synced</h3>
              <p className="text-[10px] text-slate-400 font-medium">Inventory updated successfully in database</p>
            </div>

            <div className="border-t border-dashed border-slate-800 pt-3">
              <div className="text-center mb-3">
                <span className="font-bold text-slate-350 tracking-wider">NOOR FUEL AUTOMATION</span>
                <div className="text-[10px] text-slate-550 mt-1">{completedReceipt.stationName}</div>
              </div>

              <div className="space-y-2 border-b border-dashed border-slate-800 pb-3 text-slate-400">
                <div className="flex justify-between">
                  <span>TX ID:</span>
                  <span className="font-bold text-white">{completedReceipt.txNumber}</span>
                </div>
                <div className="flex justify-between">
                  <span>TIMESTAMP:</span>
                  <span>{completedReceipt.timestamp}</span>
                </div>
                <div className="flex justify-between">
                  <span>PUMP NOZZLE:</span>
                  <span className="font-bold text-white">{completedReceipt.pumpLabel}</span>
                </div>
                <div className="flex justify-between">
                  <span>FUEL GRADE:</span>
                  <span className="font-bold text-[#8c7dfc]">{completedReceipt.fuelType}</span>
                </div>
                <div className="flex justify-between">
                  <span>PRICE PER L:</span>
                  <span>SAR {completedReceipt.price.toFixed(2)}</span>
                </div>
                {completedReceipt.customer && (
                  <div className="flex justify-between">
                    <span>CUSTOMER:</span>
                    <span className="font-bold text-white truncate max-w-[150px]">{completedReceipt.customer}</span>
                  </div>
                )}
              </div>

              <div className="space-y-2 py-3">
                <div className="flex justify-between text-slate-500 font-sans text-[11px] font-bold">
                  <span>VOLUME DISPENSED:</span>
                  <span className="text-white font-mono text-sm font-black">{completedReceipt.liters.toFixed(2)} L</span>
                </div>
                <div className="flex justify-between text-emerald-600 font-sans text-sm font-bold pt-1.5 border-t border-slate-900">
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
         COMMAND DECK SIMULATOR DRAWER
         ========================================================================= */}
      {isSimulatorOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/75 backdrop-blur-xs p-4 animate-fade-in">
          <div className="bg-[#111827] border border-slate-850 rounded-2xl overflow-hidden shadow-2xl p-5 max-w-sm w-full font-sans text-xs relative text-left">
            
            <button
              onClick={() => setIsSimulatorOpen(false)}
              className="absolute top-4 right-4 p-1 bg-slate-900 hover:bg-slate-800 border border-slate-800 rounded-full text-slate-500 hover:text-white transition-colors cursor-pointer select-none"
            >
              <X size={14} />
            </button>

            <h3 className="text-sm font-black text-white uppercase tracking-wide mb-3 pr-8 border-b border-slate-850 pb-2 flex items-center gap-1.5">
              <Sparkles size={16} className="text-[#8c7dfc]" />
              <span>COMMAND DECK SIMULATOR</span>
            </h3>

            <p className="text-[10px] text-slate-450 mb-4 font-semibold leading-relaxed">
              Use these tools to simulate live pump actions. Dispensed logs will automatically sync in real-time.
            </p>

            <div className="space-y-3">
              {stationPumps.map(pump => {
                const isIdle = pump.status === 'IDLE';
                return (
                  <div key={pump.id} className="flex justify-between items-center bg-[#090d16] p-2.5 rounded-xl border border-slate-850">
                    <span className="font-bold text-slate-200">{pump.label} ({pump.fuelType})</span>
                    <button
                      disabled={!isIdle}
                      onClick={() => {
                        setIsSimulatorOpen(false);
                        setSelectedPump(pump);
                      }}
                      className={`px-3 py-1.5 rounded-lg text-[10px] font-black uppercase tracking-wider transition-all select-none border-none cursor-pointer ${
                        isIdle 
                          ? 'bg-[#6c5dd3] hover:bg-[#5c4eb3] text-white shadow-xs' 
                          : 'bg-slate-800 text-slate-550 cursor-not-allowed'
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
              className="w-full py-3 bg-[#090d16] hover:bg-[#111827] text-slate-400 rounded-xl text-xs font-bold uppercase tracking-wider select-none cursor-pointer border border-slate-850 text-center font-sans mt-4"
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
