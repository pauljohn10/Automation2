/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useEffect } from 'react';
import { Capacitor } from '@capacitor/core';
import { useFuelSystem } from '../context';
import { FuelGrade, FuelPump } from '../types';
import { LogOut, Fuel, MapPin, User, DollarSign, CheckCircle, RefreshCw, ArrowLeft, AlertTriangle } from 'lucide-react';

export const MobileDispenserApp: React.FC = () => {
  const { 
    pumps, 
    session, 
    stations, 
    tanks, 
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

  // States
  const [selectedPump, setSelectedPump] = useState<FuelPump | null>(null);
  const [amountSAR, setAmountSAR] = useState<string>('50');
  const [customerName, setCustomerName] = useState<string>('');
  const [dispenseError, setDispenseError] = useState<string | null>(null);
  
  // Completed transaction receipt state
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

  // Handle preset taps
  const applyPreset = (val: number) => {
    setAmountSAR(String(val));
    setDispenseError(null);
  };

  // Get pricing for selected pump grade
  const getSelectedPumpPrice = (pumpObj: FuelPump): number => {
    const grade = pumpObj.fuelType || 'GAS91';
    return activeStation?.fuelPricing[grade] || 2.18;
  };

  // Calculate liters based on price
  const calculateLiters = (amountStr: string, price: number): number => {
    const amt = parseFloat(amountStr);
    if (isNaN(amt) || amt <= 0) return 0;
    return amt / price;
  };

  // Check pump color
  const getStatusColorClass = (status: FuelPump['status']) => {
    switch (status) {
      case 'IDLE': return 'bg-emerald-500/10 text-emerald-400 border-emerald-500/25';
      case 'PUMPING': return 'bg-amber-500/10 text-amber-400 border-amber-500/25 animate-pulse';
      case 'COMPLETED': return 'bg-blue-500/10 text-blue-400 border-blue-500/25';
      case 'MAINTENANCE': return 'bg-slate-800 text-slate-500 border-slate-700';
      default: return 'bg-slate-800 text-slate-500 border-slate-700';
    }
  };

  const getStatusName = (status: FuelPump['status']) => {
    switch (status) {
      case 'IDLE': return 'Available';
      case 'PUMPING': return 'Dispensing';
      case 'COMPLETED': return 'Pumping Done';
      case 'MAINTENANCE': return 'Offline';
      default: return 'Offline';
    }
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

  return (
    <div className="min-h-screen w-full bg-[#0b0f19] text-slate-100 flex items-center justify-center font-sans">
      <div className="max-w-md w-full min-h-screen bg-[#0d1321] border-x border-slate-800 flex flex-col justify-between shadow-2xl relative">
        
        {/* Mobile App Bar Header */}
        <header className="sticky top-0 bg-[#111827]/90 backdrop-blur-md border-b border-slate-800 px-5 py-4 flex items-center justify-between z-30">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-lg bg-linear-to-tr from-[#6c5dd3] to-[#8c7dfc] flex items-center justify-center text-white font-extrabold text-sm shadow-md">
              M
            </div>
            <div className="text-left leading-none">
              <h2 className="text-xs font-black uppercase tracking-wider text-slate-100">Noor Mobile</h2>
              <span className="text-[9px] text-[#8c7dfc] font-bold tracking-widest uppercase">Dispenser Portal</span>
            </div>
          </div>
          
          <div className="flex items-center gap-2">
            {session.isMobilePreview && !Capacitor.isNativePlatform() && (
              <button
                onClick={handleBackToAdmin}
                className="px-2.5 py-1 bg-indigo-950/80 hover:bg-indigo-900 border border-indigo-500/30 text-[9px] font-black uppercase tracking-wider rounded text-indigo-300 transition-colors"
                title="Return to Admin Web Panel"
              >
                Web Admin
              </button>
            )}
            <button 
              onClick={handleLogout}
              className="p-1.5 bg-red-950/20 hover:bg-red-950/40 border border-red-500/20 rounded-lg text-red-400 hover:text-red-300 transition-colors cursor-pointer"
              title="Logout Attendant Session"
            >
              <LogOut size={15} />
            </button>
          </div>
        </header>

        {/* Attendant Context Banner */}
        <div className="bg-[#182235] border-b border-slate-850 px-5 py-3 flex justify-between items-center text-left">
          <div className="space-y-0.5 flex-1 min-w-0">
            <span className="text-[8px] font-bold text-slate-500 uppercase tracking-widest block">Active Station:</span>
            {session.role !== 'OPERATOR' ? (
              <select
                value={session.activeStationId}
                onChange={(e) => setSession({ ...session, activeStationId: e.target.value })}
                className="bg-[#0f172a] text-slate-200 border border-slate-700 rounded px-1.5 py-0.5 text-xs font-semibold focus:outline-none focus:border-[#8c7dfc] max-w-[200px]"
              >
                {stations.map(st => (
                  <option key={st.id} value={st.id}>
                    {st.name}
                  </option>
                ))}
              </select>
            ) : (
              <div className="text-xs font-black text-slate-200 flex items-center gap-1 truncate">
                <MapPin size={11} className="text-[#8c7dfc] shrink-0" />
                <span className="truncate">{activeStation?.name || 'No Active Station Context'}</span>
              </div>
            )}
          </div>
          <div className="text-right space-y-0.5">
            <span className="text-[8px] font-bold text-slate-500 uppercase tracking-widest block">Attendant:</span>
            <div className="text-xs font-black text-indigo-300 flex items-center gap-1 justify-end">
              <User size={11} />
              <span>{session.name.split('@')[0]}</span>
            </div>
          </div>
        </div>

        {/* Main Work Area */}
        <main className="flex-1 overflow-y-auto px-5 py-6">
          {completedReceipt ? (
            /* =========================================================================
               TRANSACTION RECEIPT SCREEN
               ========================================================================= */
            <div className="space-y-6 text-left animate-fade-in">
              <div className="text-center space-y-2 py-4">
                <div className="inline-flex items-center justify-center w-14 h-14 rounded-full bg-emerald-500/10 border border-emerald-500/30 text-emerald-400 shadow-md">
                  <CheckCircle size={28} className="animate-pulse" />
                </div>
                <h3 className="text-sm font-black text-slate-100 uppercase tracking-wider">Sale Complete & Synced</h3>
                <p className="text-[10px] text-slate-400 font-medium">Underground inventory updated in real time</p>
              </div>

              {/* Receipt Node Block */}
              <div className="bg-[#111827] border border-slate-800 rounded-xl overflow-hidden shadow-lg p-5 space-y-4 font-mono text-xs font-semibold">
                <div className="text-center border-b border-dashed border-slate-800 pb-3">
                  <span className="font-bold text-slate-350 tracking-wider">NOOR FUEL AUTOMATION</span>
                  <div className="text-[9px] text-slate-550 mt-1">{completedReceipt.stationName}</div>
                </div>

                <div className="space-y-2 border-b border-dashed border-slate-800 pb-4">
                  <div className="flex justify-between">
                    <span className="text-slate-550">TX ID:</span>
                    <span className="font-bold text-slate-300">{completedReceipt.txNumber}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-slate-555">TIMESTAMP:</span>
                    <span className="text-slate-350">{completedReceipt.timestamp}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-slate-555">PUMP NOZZLE:</span>
                    <span className="font-extrabold text-slate-300">{completedReceipt.pumpLabel}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-slate-555">FUEL GRADE:</span>
                    <span className="font-extrabold text-[#8c7dfc]">{completedReceipt.fuelType}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-slate-555">PRICE PER L:</span>
                    <span className="text-slate-350">SAR {completedReceipt.price.toFixed(2)}</span>
                  </div>
                  {completedReceipt.customer && (
                    <div className="flex justify-between">
                      <span className="text-slate-555">CUSTOMER:</span>
                      <span className="text-indigo-300 font-bold truncate max-w-[150px]">{completedReceipt.customer}</span>
                    </div>
                  )}
                </div>

                <div className="space-y-2">
                  <div className="flex justify-between text-slate-400">
                    <span>LITERS PUMPED:</span>
                    <span className="text-slate-200 font-black text-sm">{completedReceipt.liters.toFixed(2)} L</span>
                  </div>
                  <div className="flex justify-between text-emerald-400 pt-1.5 border-t border-slate-900">
                    <span className="font-bold">TOTAL AMOUNT:</span>
                    <span className="font-black text-base">SAR {completedReceipt.amount.toFixed(2)}</span>
                  </div>
                </div>
              </div>

              <button
                onClick={() => setCompletedReceipt(null)}
                className="w-full py-4 bg-linear-to-r from-[#6c5dd3] to-[#8c7dfc] hover:from-[#5c4eb3] hover:to-[#7c6dfc] text-white rounded-xl text-xs font-black uppercase tracking-widest transition-all shadow-md select-none cursor-pointer text-center"
              >
                Return to Pumps List
              </button>
            </div>
          ) : selectedPump ? (
            /* =========================================================================
               DISPENSING FLOW CONTROLLER SCREEN
               ========================================================================= */
            <div className="space-y-5 text-left animate-fade-in">
              {/* Back link */}
              <button
                onClick={() => {
                  setSelectedPump(null);
                  setDispenseError(null);
                }}
                className="flex items-center gap-1.5 text-xs text-slate-400 hover:text-white transition-colors cursor-pointer select-none font-bold"
              >
                <ArrowLeft size={14} />
                <span>Cancel & Return</span>
              </button>

              {/* Pump Details */}
              <div className="bg-[#111827] border border-slate-800 rounded-xl p-4 flex items-center justify-between shadow-sm">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-lg bg-[#1a2333] flex items-center justify-center text-indigo-400 border border-slate-850">
                    <Fuel size={20} />
                  </div>
                  <div>
                    <h4 className="text-xs font-black uppercase tracking-wide text-slate-200">{selectedPump.label}</h4>
                    <span className="text-[9px] bg-indigo-950 text-indigo-300 border border-indigo-900 px-1.5 py-0.5 rounded font-black tracking-wider uppercase inline-block mt-0.5">
                      {selectedPump.fuelType}
                    </span>
                  </div>
                </div>
                <div className="text-right">
                  <span className="text-[8px] font-bold text-slate-500 uppercase tracking-widest block">Grade Price:</span>
                  <span className="font-mono text-sm font-extrabold text-emerald-400">SAR {getSelectedPumpPrice(selectedPump).toFixed(2)}/L</span>
                </div>
              </div>

              {selectedPump.status === 'PUMPING' ? (
                /* SIMULATED PUMPING IN PROGRESS PROGRESS VIEW */
                <div className="bg-[#111827] border border-slate-800 rounded-xl p-5 space-y-6 text-center shadow-lg">
                  <div className="space-y-2">
                    <span className="text-[9px] font-bold text-amber-400 bg-amber-950/40 border border-amber-500/20 px-2 py-0.5 rounded-full inline-block uppercase tracking-wider animate-pulse">
                      PUMPING IN PROGRESS
                    </span>
                    <h3 className="text-xs font-black text-slate-450 uppercase tracking-widest">Attendant Control Panel</h3>
                  </div>

                  <div className="py-4 space-y-2">
                    <div className="text-3xl font-black font-mono text-slate-200 tracking-tight">
                      {(selectedPump.volumeThisSession || 0).toFixed(2)} <span className="text-xs text-slate-500 font-normal">Liters</span>
                    </div>
                    <div className="text-xl font-bold font-mono text-emerald-400">
                      SAR {((selectedPump.volumeThisSession || 0) * getSelectedPumpPrice(selectedPump)).toFixed(2)}
                    </div>
                  </div>

                  {/* Flow rate stats */}
                  <div className="bg-[#0b0f19] border border-slate-850 rounded-lg p-3 grid grid-cols-2 gap-2 text-xs">
                    <div className="text-left space-y-0.5">
                      <span className="text-[8px] font-bold text-slate-500 uppercase block">Flow Rate:</span>
                      <span className="font-mono font-bold text-slate-350">40.0 L/min</span>
                    </div>
                    <div className="text-right space-y-0.5">
                      <span className="text-[8px] font-bold text-slate-500 uppercase block">Target Liters:</span>
                      <span className="font-mono font-bold text-indigo-350">
                        {calculateLiters(amountSAR, getSelectedPumpPrice(selectedPump)).toFixed(2)} L
                      </span>
                    </div>
                  </div>

                  <div className="w-full bg-slate-850 h-1.5 rounded-full overflow-hidden">
                    <div 
                      className="bg-linear-to-r from-amber-500 to-yellow-400 h-full transition-all duration-300"
                      style={{ 
                        width: `${Math.min(100, ((selectedPump.volumeThisSession || 0) / calculateLiters(amountSAR, getSelectedPumpPrice(selectedPump))) * 100)}%` 
                      }}
                    />
                  </div>
                </div>
              ) : selectedPump.status === 'COMPLETED' ? (
                /* SIMULATED PUMPING COMPLETED */
                <div className="bg-[#111827] border border-slate-800 rounded-xl p-5 space-y-5 text-center shadow-lg animate-fade-in">
                  <div className="space-y-1">
                    <span className="text-[9px] font-black text-blue-400 bg-blue-950 border border-blue-900 px-2 py-0.5 rounded-full inline-block uppercase tracking-wider">
                      FLOW LIMIT REACHED
                    </span>
                    <h3 className="text-xs font-black text-slate-200 uppercase tracking-widest mt-1">Dispensing Session Complete</h3>
                  </div>

                  <div className="py-3 bg-[#0b0f19] border border-slate-850 rounded-lg space-y-1 font-mono">
                    <div className="text-2xl font-black text-slate-100">
                      {(selectedPump.volumeThisSession || 0).toFixed(2)} L
                    </div>
                    <div className="text-lg font-bold text-emerald-400">
                      SAR {((selectedPump.volumeThisSession || 0) * getSelectedPumpPrice(selectedPump)).toFixed(2)}
                    </div>
                  </div>

                  {/* Customer details verification */}
                  <div className="space-y-1 text-left">
                    <label className="text-[9px] font-bold text-slate-405 uppercase tracking-wider block">Customer Name (Optional)</label>
                    <input
                      type="text"
                      placeholder="e.g. Saudi Aramco Logistics"
                      value={customerName}
                      onChange={(e) => setCustomerName(e.target.value)}
                      className="w-full bg-[#0b0f19] text-slate-200 border border-slate-850 rounded-lg py-2 px-3 text-xs font-semibold focus:outline-none focus:border-[#8c7dfc]"
                    />
                  </div>

                  {dispenseError && (
                    <div className="bg-red-500/10 border border-red-500/20 text-red-400 p-3 rounded-lg text-[10px] font-bold text-left flex items-start gap-1.5">
                      <AlertTriangle className="shrink-0 mt-0.5" size={13} />
                      <span>{dispenseError}</span>
                    </div>
                  )}

                  <button
                    onClick={handleCompleteDispensing}
                    className="w-full py-4 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl text-xs font-black uppercase tracking-widest transition-all shadow-md select-none cursor-pointer text-center font-sans"
                  >
                    Complete Dispensing & Sync
                  </button>
                </div>
              ) : (
                /* IDLE / INPUT SALE DETAILS FORM */
                <div className="space-y-5 animate-fade-in">
                  {/* Preset Quick Taps */}
                  <div className="space-y-2">
                    <label className="text-[10px] font-black uppercase text-slate-405 tracking-wider">Select Preconfigured SAR Amount</label>
                    <div className="grid grid-cols-3 gap-2">
                      {[10, 20, 50, 100, 150, 200].map(preset => (
                        <button
                          key={preset}
                          type="button"
                          onClick={() => applyPreset(preset)}
                          className={`py-3 rounded-xl border text-xs font-mono font-black transition-all cursor-pointer select-none ${
                            amountSAR === String(preset)
                              ? 'bg-[#6c5dd3] text-white border-[#6c5dd3] shadow-md shadow-[#6c5dd3]/20'
                              : 'bg-[#111827] text-slate-400 border-slate-800 hover:text-slate-200 hover:bg-[#1a2333]'
                          }`}
                        >
                          SAR {preset}
                        </button>
                      ))}
                    </div>
                  </div>

                  {/* Manual input */}
                  <div className="space-y-1.5">
                    <label className="text-[10px] font-black uppercase text-slate-405 tracking-wider">Or Enter Custom Amount (SAR)</label>
                    <div className="relative">
                      <span className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-550 text-xs font-bold font-mono">SAR</span>
                      <input
                        type="number"
                        placeholder="e.g. 80"
                        value={amountSAR}
                        onChange={(e) => {
                          setAmountSAR(e.target.value);
                          setDispenseError(null);
                        }}
                        className="w-full bg-[#111827] border border-slate-800 rounded-xl py-3 pl-12 pr-3 text-xs font-mono font-bold text-white focus:outline-none focus:border-[#8c7dfc]"
                        required
                        min="1"
                      />
                    </div>
                  </div>

                  {/* Auto Calculated Liters Panel */}
                  <div className="bg-[#111827] border border-slate-800 rounded-xl p-4 flex items-center justify-between shadow-inner">
                    <div className="space-y-0.5">
                      <span className="text-[9px] font-bold text-slate-500 uppercase tracking-widest block">Calculated Volume:</span>
                      <div className="text-lg font-black text-slate-150 font-mono">
                        {calculateLiters(amountSAR, getSelectedPumpPrice(selectedPump)).toFixed(2)} <span className="text-xs text-slate-400 font-semibold uppercase">Liters</span>
                      </div>
                    </div>
                    <div className="text-right">
                      <span className="text-[9px] font-bold text-slate-500 uppercase tracking-widest block">Nozzle Fuel:</span>
                      <span className="text-xs font-black text-[#8c7dfc] uppercase">{selectedPump.fuelType}</span>
                    </div>
                  </div>

                  {dispenseError && (
                    <div className="bg-red-500/10 border border-red-500/20 text-red-400 p-3 rounded-lg text-[10px] font-bold flex items-start gap-1.5">
                      <AlertTriangle className="shrink-0 mt-0.5" size={13} />
                      <span>{dispenseError}</span>
                    </div>
                  )}

                  <button
                    onClick={handleStartDispensing}
                    className="w-full py-4 bg-linear-to-r from-[#6c5dd3] to-[#8c7dfc] hover:from-[#5c4eb3] hover:to-[#7c6dfc] text-white rounded-xl text-xs font-black uppercase tracking-widest transition-all shadow-md select-none cursor-pointer text-center font-sans"
                  >
                    Start Dispensing Fuel
                  </button>
                </div>
              )}
            </div>
          ) : (
            /* =========================================================================
               MAIN SCREEN: LIST OF ASSIGNED STATION PUMPS
               ========================================================================= */
            <div className="space-y-5 text-left animate-fade-in">
              <div className="space-y-1">
                <h3 className="text-sm font-black text-slate-200 uppercase tracking-wider">Dispenser Terminals</h3>
                <p className="text-[10px] text-slate-500 font-semibold leading-relaxed">Select an active pump nozzle below to configure fueling transactions.</p>
              </div>

              {stationPumps.length === 0 ? (
                <div className="py-12 text-center text-slate-500 italic text-xs font-medium border border-dashed border-slate-800 rounded-xl">
                  No active fuel pumps configured at this station.
                </div>
              ) : (
                <div className="grid grid-cols-1 gap-4">
                  {stationPumps.map((pump) => {
                    const price = activeStation?.fuelPricing[pump.fuelType || 'GAS91'] || 2.18;
                    const statusClass = getStatusColorClass(pump.status);
                    const isOffline = pump.status === 'MAINTENANCE';

                     let cardBorderClass = 'border-slate-800';
                     let cardBgClass = 'bg-[#111827]';
                     let pulseClass = '';

                     if (pump.status === 'IDLE') {
                       cardBorderClass = 'border-emerald-500/20 hover:border-emerald-500/40 bg-[#111827]';
                     } else if (pump.status === 'PUMPING') {
                       cardBorderClass = 'border-amber-500/60 shadow-lg';
                       cardBgClass = 'bg-[#181410]';
                       pulseClass = 'animate-pulse';
                     } else if (pump.status === 'COMPLETED') {
                       cardBorderClass = 'border-blue-500/60 shadow-lg';
                       cardBgClass = 'bg-[#101423]';
                     } else if (isOffline) {
                       cardBorderClass = 'border-slate-850';
                       cardBgClass = 'bg-[#111827] opacity-40';
                     }

                     return (
                       <div
                         key={pump.id}
                         onClick={() => {
                           if (isOffline) return;
                           setSelectedPump(pump);
                         }}
                         className={`border rounded-xl p-4 flex items-center justify-between transition-all hover:bg-[#161f33] ${cardBgClass} ${cardBorderClass} ${pulseClass} ${
                           isOffline ? 'cursor-not-allowed' : 'cursor-pointer'
                         }`}
                       >
                         <div className="flex items-center gap-3.5">
                           {/* Left icon wrapper */}
                           <div className={`w-10 h-10 rounded-lg bg-[#141b2a] flex items-center justify-center border border-slate-800 ${
                             isOffline ? 'text-slate-600' : 'text-[#8c7dfc]'
                           }`}>
                             <Fuel size={18} />
                           </div>
                           
                           {/* Pump info */}
                           <div className="space-y-0.5">
                             <h4 className="text-xs font-black text-slate-200 uppercase tracking-wide">{pump.label}</h4>
                             <div className="flex items-center gap-1.5">
                               <span className="text-[9px] font-extrabold text-indigo-400 bg-indigo-950 px-1.5 py-0.5 rounded border border-indigo-900 uppercase font-mono">
                                 {pump.fuelType || 'GAS91'}
                               </span>
                               <span className="text-[9px] text-slate-500 font-medium font-semibold">SAR {price.toFixed(2)}/L</span>
                             </div>
                           </div>
                         </div>

                         {/* Right status pill & metrics */}
                         <div className="text-right flex flex-col justify-center items-end">
                           {pump.status === 'PUMPING' ? (
                             <div className="flex flex-col items-end gap-1">
                               <span className="px-2.5 py-0.5 rounded-full text-[9px] font-black uppercase tracking-wider border bg-amber-500/10 text-amber-400 border-amber-500/25">
                                 Dispensing
                               </span>
                               <span className="text-xs font-black text-slate-200 font-mono">
                                 {(pump.volumeThisSession || 0).toFixed(2)} L
                               </span>
                               <span className="text-[9px] font-bold text-emerald-400 font-mono">
                                 SAR {((pump.volumeThisSession || 0) * price).toFixed(2)}
                               </span>
                             </div>
                           ) : pump.status === 'COMPLETED' ? (
                             <div className="flex flex-col items-end gap-1.5">
                               <span className="px-2.5 py-0.5 rounded-full text-[9px] font-black uppercase tracking-wider border bg-blue-500/10 text-blue-400 border-blue-500/25">
                                 Pumping Done
                               </span>
                               <button 
                                 onClick={(e) => {
                                   e.stopPropagation();
                                   setSelectedPump(pump);
                                 }}
                                 className="px-2.5 py-1 bg-blue-600 hover:bg-blue-700 text-white rounded-lg text-[8px] font-black uppercase tracking-wider border-none cursor-pointer shadow-md select-none transition-all font-sans"
                               >
                                 Verify & Complete
                               </button>
                             </div>
                           ) : (
                             <span className={`px-2.5 py-1 rounded-full text-[9px] font-black uppercase tracking-wider border ${statusClass}`}>
                               {getStatusName(pump.status)}
                             </span>
                           )}
                         </div>
                       </div>
                     );
                   })}
                </div>
              )}
            </div>
          )}
        </main>

        {/* Footer Info */}
        <footer className="sticky bottom-0 bg-[#0d1321] border-t border-slate-850 px-5 py-3 text-center">
          <div className="flex items-center justify-center gap-1 text-[8px] font-mono text-slate-550 uppercase tracking-widest">
            <span>Live Sync: Supabase Database Endpoint</span>
            <span className="w-1.5 h-1.5 bg-[#48bb78] rounded-full animate-ping"></span>
          </div>
        </footer>
      </div>
    </div>
  );
};
export default MobileDispenserApp;
