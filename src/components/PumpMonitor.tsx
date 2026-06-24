/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState } from 'react';
import { useFuelSystem } from '../context';
import { FuelGrade } from '../types';
import { Play, Sparkles, AlertCircle, RefreshCw, X, ChevronRight, HelpCircle } from 'lucide-react';

export const PumpMonitor: React.FC = () => {
  const { pumps, session, activeStation, dispenseFuel, confirmDispenseTransaction, tanks, transactions } = useFuelSystem();

  // Filter pumps belonging to current active station
  const stationPumps = pumps.filter(p => p.stationId === session.activeStationId);
  const stationTanks = tanks.filter(t => t.stationId === session.activeStationId);
  const stationTx = transactions.filter(tx => tx.stationId === session.activeStationId);

  // Simulation internal values
  const [isCommandDeckOpen, setIsCommandDeckOpen] = useState(false);
  const [selectedPumpId, setSelectedPumpId] = useState<string>('');
  const [selectedGrade, setSelectedGrade] = useState<FuelGrade>('GAS91');
  const [volumeToDispense, setVolumeToDispense] = useState<number>(35);
  const [customVolume, setCustomVolume] = useState<string>('');
  const [simResults, setSimResults] = useState<{ status: 'success' | 'error'; message: string } | null>(null);

  // Directly clicked nozzle volume configuration state
  const [nozzleToConfigure, setNozzleToConfigure] = useState<{ id: string; label: string; fuelType: FuelGrade; dispenserLabel: string } | null>(null);
  const [amountInput, setAmountInput] = useState<string>('50');
  const [modalError, setModalError] = useState<string | null>(null);

  // Initialize selected pump if empty
  React.useEffect(() => {
    if (stationPumps.length > 0 && !selectedPumpId) {
      setSelectedPumpId(stationPumps[0].id);
    }
  }, [stationPumps, selectedPumpId]);

  // Synchronize fuel grade selection with pump/nozzle hardware specification
  React.useEffect(() => {
    const selectedPumpObj = stationPumps.find(p => p.id === selectedPumpId);
    if (selectedPumpObj && selectedPumpObj.fuelType) {
      setSelectedGrade(selectedPumpObj.fuelType);
    }
  }, [selectedPumpId, stationPumps]);

  const handleDispenseTrigger = (e: React.FormEvent) => {
    e.preventDefault();
    setSimResults(null);

    const finalVol = customVolume ? parseFloat(customVolume) : volumeToDispense;

    if (isNaN(finalVol) || finalVol <= 0) {
      setSimResults({ status: 'error', message: 'Please input a valid positive volume.' });
      return;
    }

    const res = dispenseFuel(selectedPumpId, selectedGrade, finalVol);
    if (res.success) {
      setSimResults({ status: 'success', message: res.message });
      // Reset inputs
      setCustomVolume('');
    } else {
      setSimResults({ status: 'error', message: res.message });
    }
  };

  const handleConfigureDispense = (e: React.FormEvent) => {
    e.preventDefault();
    setModalError(null);
    setSimResults(null);

    if (session.role === 'VIEWER') {
      setModalError('Access Denied: Read-only VIEWER profile cannot execute operations.');
      return;
    }

    if (!nozzleToConfigure) return;

    const price = activeStation?.fuelPricing[nozzleToConfigure.fuelType] || 2.18;
    const finalAmount = parseFloat(amountInput);
    if (isNaN(finalAmount) || finalAmount <= 0) {
      setModalError('Please input a valid positive amount.');
      return;
    }

    const finalVol = finalAmount / price;

    // Double check stock bounds on client side to show responsive feedback by summing up all tanks of this grade
    const tanksForNozzle = stationTanks
      .filter(t => t.fuelType === nozzleToConfigure.fuelType)
      .sort((a, b) => a.label.localeCompare(b.label, undefined, { numeric: true, sensitivity: 'base' }));

    if (tanksForNozzle.length === 0) {
      setModalError(`No active storage tank configured for ${nozzleToConfigure.fuelType} at this station.`);
      return;
    }

    const totalStock = tanksForNozzle.reduce((sum, t) => sum + t.currentLevel, 0);

    if (totalStock < finalVol) {
      setModalError(`Insufficient fuel stock available! For SAR ${finalAmount.toFixed(2)}, we need to dispense ${finalVol.toFixed(2)} L, but total stock across matched tanks is currently at ${totalStock.toLocaleString()} Litres.`);
      return;
    }

    const res = dispenseFuel(nozzleToConfigure.id, nozzleToConfigure.fuelType, finalVol);
    if (res.success) {
      setSimResults({ status: 'success', message: res.message });
      setNozzleToConfigure(null); // Close modal on success!
    } else {
      setModalError(res.message);
    }
  };

  const handleNozzleClick = (nozzleId: string, fuelType: FuelGrade, status: 'IDLE' | 'PUMPING' | 'COMPLETED' | 'MAINTENANCE') => {
    setSimResults(null);
    if (session.role === 'VIEWER') {
      alert('Access Denied: Read-only VIEWER profile cannot execute operations.');
      return;
    }
    if (status === 'IDLE') {
      const finalVol = customVolume ? parseFloat(customVolume) : volumeToDispense;
      const vol = isNaN(finalVol) || finalVol <= 0 ? 35 : finalVol;
      const res = dispenseFuel(nozzleId, fuelType, vol);
      if (res.success) {
        setSimResults({ status: 'success', message: res.message });
      } else {
        setSimResults({ status: 'error', message: res.message });
      }
    } else if (status === 'COMPLETED') {
      const res = confirmDispenseTransaction(nozzleId);
      if (res.success) {
        setSimResults({ status: 'success', message: res.message });
      } else {
        setSimResults({ status: 'error', message: res.message });
      }
    }
  };

  const getFuelTextColor = (grade?: FuelGrade) => {
    switch (grade) {
      case 'GAS91': return 'text-emerald-500';
      case 'GAS95': return 'text-rose-500';
      case 'GAS98': return 'text-sky-505';
      case 'DIESEL': return 'text-amber-500';
      default: return 'text-slate-400';
    }
  };

  // Group station pumps by physical dispensers
  const dispensersMap: Record<string, Array<any>> = {};
  stationPumps.forEach((pump, index) => {
    let dispenserKey = 'D01';
    let nozzleLabel = `Nozzle ${String(index + 1).padStart(2, '0')}`;

    if (pump.label.toLowerCase().includes('dispenser')) {
      // Formats like "Dispenser 01 - Pump 1"
      const match = pump.label.match(/Dispenser\s+(\d+)\s*-\s*Pump\s*(\d+)/i);
      if (match) {
        dispenserKey = `D${match[1].padStart(2, '0')}`;
        nozzleLabel = `Nozzle ${match[2].padStart(2, '0')}`;
      }
    } else {
      // Simple "Pump 01" format
      const match = pump.label.match(/\d+/);
      if (match) {
        const idx = parseInt(match[0]);
        const dispNo = Math.ceil(idx / 2);
        const nozzleNo = idx % 2 === 0 ? 2 : 1;
        dispenserKey = `D${String(dispNo).padStart(2, '0')}`;
        nozzleLabel = `Nozzle ${String(nozzleNo).padStart(2, '0')}`;
      }
    }

    if (!dispensersMap[dispenserKey]) {
      dispensersMap[dispenserKey] = [];
    }
    dispensersMap[dispenserKey].push({
      ...pump,
      _nozzleLabel: nozzleLabel,
    });
  });

  const sortedDispenserKeys = Object.keys(dispensersMap).sort();

  // Count nozzles dynamically for top bar
  const numDispensers = sortedDispenserKeys.length;
  const gas91Pumps = stationPumps.filter(p => p.fuelType === 'GAS91').length;
  const gas95Pumps = stationPumps.filter(p => p.fuelType === 'GAS95').length;

  return (
    <div className="p-6 space-y-6 bg-slate-50 min-h-[calc(100vh-64px)] font-sans text-left relative">
      
      {/* 1. SEAMLESS DARK GLASS ASSETS HEADER (IMAGE 2 REPLICA) */}
      <div className="bg-[#1e293b] text-white rounded-xl border border-slate-800 p-5 flex flex-col md:flex-row items-center justify-between gap-4 shadow-md select-none">
        <div className="space-y-1">
          <div className="flex items-center gap-2">
            <span className="w-2.5 h-2.5 rounded-full bg-emerald-500 animate-pulse"></span>
            <h3 className="text-sm font-black tracking-wider uppercase">
              FUEL DISPENSATION ASSETS
            </h3>
          </div>
          <p className="text-[11px] text-slate-400 font-semibold">
            {numDispensers} Dual-Nozzle Island Dispensers | {gas91Pumps} Petrol 91 Nozzles | {gas95Pumps} Petrol 95 Nozzles
          </p>
        </div>

        {/* Dynamic header pills */}
        <div className="flex items-center gap-3">
          <div className="px-3 py-1 bg-emerald-950/50 border border-emerald-500/40 text-emerald-400 rounded-full font-black text-[10px] tracking-wide uppercase">
            {gas91Pumps} x PETROL 91 NOZZLES
          </div>
          {gas95Pumps > 0 && (
            <div className="px-3 py-1 bg-rose-950/50 border border-rose-500/40 text-rose-450 rounded-full font-black text-[10px] tracking-wide uppercase">
              {gas95Pumps} x PETROL 95 NOZZLES
            </div>
          )}
        </div>
      </div>

      {/* 2. DISPENSERS HARDWARE ARRAY (IMAGE 2 REPLICA) */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        {sortedDispenserKeys.map((dispKey) => {
          const matchedNozzles = dispensersMap[dispKey];

          return (
            <div 
              key={dispKey}
              className="bg-white rounded-xl border border-slate-200 overflow-hidden shadow-xs hover:shadow-md transition-all duration-250"
            >
              {/* Card Header Strip */}
              <div className="bg-[#1e293b] px-4 py-2 flex items-center justify-between text-white border-b border-slate-700">
                <span className="text-[11px] font-black tracking-wide uppercase text-slate-100">
                  DISPENSER {dispKey}
                </span>
                <span className="text-[9px] font-bold text-slate-400 tracking-wider uppercase">
                  DUAL NOZZLE ISLAND
                </span>
              </div>

              {/* Card Body - Dual side-by-side nozzle boxes */}
              <div className="p-4 grid grid-cols-2 gap-3.5 bg-slate-50/40">
                {matchedNozzles.map((nozzle) => {
                  const isPumping = nozzle.status === 'PUMPING';
                  const isCompleted = nozzle.status === 'COMPLETED';
                  const vol = nozzle.volumeThisSession || 0.00;
                  const price = activeStation?.fuelPricing[nozzle.fuelType || 'GAS91'] || 2.18;
                  const amount = vol * price;

                  return (
                    <div 
                      key={nozzle.id}
                      onClick={() => {
                        if (session.role === 'VIEWER') {
                          alert('Access Denied: Read-only VIEWER profile cannot initiate nozzle transactions.');
                          return;
                        }
                        if (nozzle.status === 'IDLE') {
                          setNozzleToConfigure({
                            id: nozzle.id,
                            label: nozzle._nozzleLabel || 'Nozzle',
                            fuelType: nozzle.fuelType || 'GAS91',
                            dispenserLabel: `Dispenser ${dispKey}`
                          });
                          setAmountInput('50');
                          setModalError(null);
                        } else if (nozzle.status === 'COMPLETED') {
                          handleNozzleClick(nozzle.id, nozzle.fuelType || 'GAS91', nozzle.status);
                        }
                      }}
                      className={`bg-white rounded-lg border p-3 flex flex-col justify-between space-y-3 transition-all relative group select-none ${
                        isPumping 
                          ? 'border-indigo-500 ring-2 ring-indigo-50 shadow-xs cursor-default' 
                          : isCompleted
                            ? 'border-emerald-500 ring-2 ring-emerald-100 shadow-md cursor-pointer animate-pulse bg-emerald-50/25'
                            : 'border-slate-200 cursor-pointer hover:border-indigo-400 hover:shadow-xs'
                      }`}
                      id={`nozzle-card-${nozzle.id}`}
                    >
                      {/* Nozzle Header Row */}
                      <div className="flex justify-between items-center pb-1.5 border-b border-slate-100">
                        <div className="flex items-center gap-1.5">
                          {/* Paper Page/Nozzle icon representing physical lines */}
                          <div className={`w-1.5 h-1.5 rounded-full ${
                            isPumping 
                              ? 'bg-indigo-600 animate-ping' 
                              : isCompleted 
                                ? 'bg-emerald-500 animate-bounce' 
                                : 'bg-slate-300'
                          }`} />
                          <span className="font-sans font-black text-slate-700 text-[11px] tracking-tight">
                            {nozzle._nozzleLabel}
                          </span>
                        </div>
                        <span className={`text-[9px] font-black tracking-wider ${
                          isPumping 
                            ? 'text-indigo-600 animate-pulse' 
                            : isCompleted
                              ? 'text-emerald-600'
                              : 'text-slate-400'
                        }`}>
                          {nozzle.status}
                        </span>
                      </div>

                      {/* Product Specifications Row */}
                      <div className="flex justify-between items-center text-[10px] font-bold">
                        <span className="text-slate-400 uppercase tracking-tight">PRODUCT</span>
                        <span className={`font-mono font-black tracking-wide ${getFuelTextColor(nozzle.fuelType)}`}>
                          {nozzle.fuelType || 'GAS91'}
                        </span>
                      </div>

                      {/* Amount and Volume Double columns block */}
                      <div className="grid grid-cols-2 gap-1 pt-1.5 border-t border-dashed border-slate-100">
                        <div className="text-left">
                          <span className="block text-[8px] font-semibold text-slate-400 uppercase leading-none pb-1">
                            AMOUNT
                          </span>
                          <span className="font-mono font-black text-slate-800 text-[11px] leading-tight block">
                            {amount.toFixed(2)} <span className="text-[8px] font-sans text-slate-400 font-normal">SAR</span>
                          </span>
                        </div>
                        <div className="text-right">
                          <span className="block text-[8px] font-semibold text-slate-400 uppercase leading-none pb-1">
                            VOLUME
                          </span>
                          <span className="font-mono font-black text-slate-800 text-[11px] leading-tight block">
                            {vol.toFixed(2)} <span className="text-[8px] font-sans text-slate-400 font-normal">L</span>
                          </span>
                        </div>
                      </div>

                      {/* Micro visual animation if active / prompt states */}
                      {isPumping && (
                        <div className="w-full bg-indigo-50 h-1 rounded-full overflow-hidden">
                          <div className="bg-indigo-500 h-1 rounded-full animate-pulse w-full"></div>
                        </div>
                      )}

                      {isCompleted && (
                        <div className="pt-1.5 border-t border-dashed border-emerald-200">
                          <button 
                            type="button"
                            className="w-full bg-emerald-500 hover:bg-emerald-600 text-white font-black text-[9px] uppercase py-1 px-1.5 rounded-md tracking-wider flex items-center justify-center gap-1 shadow-xs transition-colors"
                          >
                            <Sparkles size={10} className="fill-white" />
                            <span>Confirm & Verify</span>
                          </button>
                        </div>
                      )}

                      {nozzle.status === 'IDLE' && (
                        <div className="text-[8px] text-indigo-500 font-black tracking-wider uppercase text-center opacity-0 group-hover:opacity-100 transition-opacity pt-1 border-t border-dashed border-slate-100">
                          Click to Dispense
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            </div>
          );
        })}
      </div>

      {/* 3. REAL-TIME FUEL DISPENSING LOG (IMAGE 2 REPLICA) */}
      <div className="bg-white rounded-xl border border-slate-200 shadow-xs overflow-hidden">
        {/* Table Title Block */}
        <div className="p-4 bg-slate-50 border-b border-slate-200 flex items-center justify-between select-none">
          <div className="flex items-center gap-2">
            <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-ping"></span>
            <h4 className="text-xs font-black text-slate-800 uppercase tracking-wider">
              REAL-TIME FUEL DISPENSING LOG
            </h4>
          </div>
          <span className="text-[9px] font-extrabold text-indigo-600 tracking-widest uppercase">
            ACTIVE CONNECTIONS
          </span>
        </div>

        {/* Logging Table Frame */}
        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse font-mono text-xs text-slate-700">
            <thead>
              <tr className="bg-[#f8fafc] border-b border-slate-200 text-slate-500 font-extrabold text-[10px] tracking-wider uppercase select-none">
                <th className="p-3">TIME</th>
                <th className="p-3">PUMP CODE</th>
                <th className="p-3">NOZZLE NO.</th>
                <th className="p-3">PRODUCT</th>
                <th className="p-3 text-right">PPV (SAR/L)</th>
                <th className="p-3 text-right">VOLUME (L)</th>
                <th className="p-3 text-right">AMOUNT (SAR)</th>
              </tr>
            </thead>
            <tbody>
              {stationTx.length === 0 ? (
                <tr>
                  <td colSpan={7} className="p-8 text-center text-slate-450 font-sans italic text-xs">
                    No physical fuel dispensation records streamed yet. Use the Simulation Command Deck below to trigger nozzle transactions!
                  </td>
                </tr>
              ) : (
                /* Map live finished transactions with high mockup styling */
                stationTx.slice(0, 10).map((tx, index) => {
                  const pumpCode = tx.pumpId.includes('pump-d')
                    ? tx.pumpId.match(/pump-d(\d+)-p(\d+)/)?.[1] || '01'
                    : '01';
                  const nozzleNo = tx.pumpId.includes('pump-d')
                    ? tx.pumpId.match(/pump-d(\d+)-p(\d+)/)?.[2] || '01'
                    : '01';

                  return (
                    <tr 
                      key={tx.id}
                      className={`border-b border-slate-100 hover:bg-slate-50 transition-colors uppercase ${
                        index % 2 === 0 ? 'bg-white' : 'bg-slate-50/30'
                      }`}
                    >
                      <td className="p-3 text-slate-500">
                        {tx.timestamp}
                      </td>
                      <td className="p-3 font-semibold text-slate-800">
                        DISPENER D{pumpCode}
                      </td>
                      <td className="p-3 font-bold text-slate-700">
                        {nozzleNo}
                      </td>
                      <td className={`p-3 font-extrabold ${getFuelTextColor(tx.fuelType)}`}>
                        {tx.fuelType}
                      </td>
                      <td className="p-3 text-right text-slate-600 font-semibold">
                        {tx.pricePerLitre.toFixed(2)}
                      </td>
                      <td className="p-3 text-right text-slate-800 font-black">
                        {tx.volume.toFixed(2)}
                      </td>
                      <td className="p-3 text-right text-indigo-650 font-black text-[13px]">
                        {tx.amount.toFixed(2)}
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* 4. PREMIUM FLOATING SIMULATOR TOGGLE DECK BUTTON */}
      {session.role !== 'VIEWER' && (
        <button
          onClick={() => setIsCommandDeckOpen(true)}
          className="fixed bottom-6 right-6 bg-[#6c5dd3] hover:bg-[#5c4eb3] text-white px-5 py-3 rounded-full flex items-center gap-2 shadow-xl font-bold transition-all z-40 animate-pulse active:scale-95"
        >
          <Sparkles size={16} className="fill-white animate-spin" style={{ animationDuration: '3s' }} />
          <span className="text-xs uppercase tracking-wide">Command Deck Simulator</span>
        </button>
      )}

      {/* SPECIFY VOLUME MODAL FOR PUMP DIRECT CLICK */}
      {nozzleToConfigure && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-xs animate-fade-in text-left">
          {/* Overlay click to close */}
          <div className="absolute inset-0" onClick={() => setNozzleToConfigure(null)} />

          <div className="relative w-full max-w-md bg-white rounded-xl shadow-2xl p-6 z-10 overflow-hidden border border-slate-200">
            {/* Modal Header */}
            <div className="flex items-center justify-between pb-3 border-b border-slate-150">
              <div className="flex items-center gap-2">
                <Play className="text-indigo-600 fill-indigo-600" size={16} />
                <h3 className="font-sans font-black text-slate-800 text-sm uppercase tracking-wider">
                  Configure Fuel Dispensing
                </h3>
              </div>
              <button 
                type="button"
                onClick={() => setNozzleToConfigure(null)}
                className="p-1 rounded-full hover:bg-slate-100 text-slate-400 hover:text-slate-600 transition-colors"
              >
                <X size={18} />
              </button>
            </div>

            {/* Nozzle/Dispenser Info block */}
            <div className="mt-4 bg-slate-50 border border-slate-200/60 rounded-lg p-3 text-xs space-y-1">
              <div className="flex justify-between items-center">
                <span className="text-slate-400 font-semibold uppercase">Location:</span>
                <span className="font-black text-slate-700">{nozzleToConfigure.dispenserLabel}</span>
              </div>
              <div className="flex justify-between items-center">
                <span className="text-slate-400 font-semibold uppercase">Nozzle:</span>
                <span className="font-black text-slate-700">{nozzleToConfigure.label}</span>
              </div>
              <div className="flex justify-between items-center">
                <span className="text-slate-400 font-semibold uppercase">Fuel Product:</span>
                <span className={`font-mono font-black ${getFuelTextColor(nozzleToConfigure.fuelType)}`}>
                  {nozzleToConfigure.fuelType}
                </span>
              </div>
            </div>

            {/* Input Volume form */}
            <form onSubmit={handleConfigureDispense} className="space-y-4 pt-4">
              <div className="space-y-1.5 text-left">
                <label className="text-xs font-black text-slate-700 uppercase tracking-wider block">
                  Enter Fuel Purchase Value (SAR)
                </label>
                
                {/* SAR Amount Input box */}
                <div className="relative">
                  <input
                    type="number"
                    step="any"
                    min="1"
                    required
                    placeholder="Enter amount in Saudi Riyals..."
                    value={amountInput}
                    onChange={(e) => {
                      setAmountInput(e.target.value);
                      setModalError(null);
                    }}
                    className="w-full text-sm font-black bg-slate-50 border border-slate-300 rounded-lg p-3 text-slate-900 pr-12 focus:outline-none focus:ring-2 focus:ring-indigo-500/20"
                    autoFocus
                  />
                  <span className="absolute right-4.5 top-3.5 text-xs font-black text-slate-400 font-mono">SAR</span>
                </div>

                {/* Quick Presets in SAR */}
                <div className="grid grid-cols-4 gap-2 pt-1.5">
                  {[20, 50, 100, 150].map((sarAmt) => (
                    <button
                      key={sarAmt}
                      type="button"
                      onClick={() => {
                        setAmountInput(String(sarAmt));
                        setModalError(null);
                      }}
                      className={`p-2 rounded-lg border text-xs font-mono font-black transition-all ${
                        amountInput === String(sarAmt)
                          ? 'bg-indigo-600 text-white border-indigo-600'
                          : 'bg-white text-slate-700 border-slate-200 hover:bg-slate-50'
                      }`}
                    >
                      SAR {sarAmt}
                    </button>
                  ))}
                </div>
              </div>

              {/* Real-time price prediction & conversion */}
              {(() => {
                const price = activeStation?.fuelPricing[nozzleToConfigure.fuelType] || 2.18;
                const parsedAmt = parseFloat(amountInput) || 0;
                const computedVolume = parsedAmt / price;
                return (
                  <div className="bg-[#efecfe]/50 border border-[#6c5dd3]/20 rounded-lg p-3 text-xs space-y-1 font-mono">
                    <div className="flex justify-between text-slate-600">
                      <span>Rate / Litre:</span>
                      <span className="font-bold text-slate-800">
                        SAR {price.toFixed(2)}
                      </span>
                    </div>
                    <div className="flex justify-between text-slate-600">
                      <span>Target Fuel Value:</span>
                      <span className="font-bold text-slate-800">
                        SAR {parsedAmt.toFixed(2)}
                      </span>
                    </div>
                    <div className="flex justify-between pt-1 border-t border-indigo-150 text-[#6c5dd3]">
                      <span className="font-bold">Calculated Volume:</span>
                      <span className="font-black text-sm text-[#4f46e5]">
                        {computedVolume.toFixed(2)} L
                      </span>
                    </div>
                  </div>
                );
              })()}

              {/* Error warning */}
              {modalError && (
                <div className="p-3 bg-rose-50 border border-rose-200 text-rose-800 rounded-lg text-xs flex gap-2">
                  <div className="shrink-0 pt-0.5">
                    <AlertCircle size={14} />
                  </div>
                  <div className="font-black leading-relaxed">
                    {modalError}
                  </div>
                </div>
              )}

              {/* Dispatch controls */}
              <div className="flex gap-2.5 pt-1">
                <button
                  type="button"
                  onClick={() => setNozzleToConfigure(null)}
                  className="flex-1 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-lg p-2.5 text-xs font-black uppercase tracking-wider transition-colors"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="flex-1 bg-indigo-600 hover:bg-indigo-700 text-white rounded-lg p-2.5 text-xs font-black uppercase tracking-wider transition-colors flex items-center justify-center gap-1.5"
                >
                  <Play size={12} className="fill-white" />
                  <span>Start Dispensing</span>
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* 5. SLIDE-IN SIMULATION DRAWER */}
      {isCommandDeckOpen && (
        <div className="fixed inset-0 z-50 flex justify-end bg-slate-900/40 backdrop-blur-xs animate-fade-in">
          {/* Overlay click to close */}
          <div className="absolute inset-0" onClick={() => setIsCommandDeckOpen(false)} />

          <div className="relative w-full max-w-sm bg-white h-full shadow-2xl p-6 overflow-y-auto flex flex-col justify-between z-10 animate-slide-in-right">
            <div>
              {/* Drawer Header */}
              <div className="flex items-center justify-between pb-4 border-b border-slate-100">
                <div className="flex items-center gap-2">
                  <Sparkles className="text-indigo-600" size={16} />
                  <h3 className="font-sans font-black text-slate-800 text-xs uppercase tracking-wider">
                    SIMULATOR COMMAND DECK
                  </h3>
                </div>
                <button 
                  onClick={() => setIsCommandDeckOpen(false)}
                  className="p-1 rounded-full hover:bg-slate-100 text-slate-400 hover:text-slate-600 transition-colors"
                >
                  <X size={18} />
                </button>
              </div>

              <p className="text-[11px] text-slate-500 mt-2 font-medium leading-relaxed">
                Manually trigger dispensing operations on target dispenser nozzles. The active simulation will instantly stream to the telemetry logs and subtract bulk inventory stocks securely.
              </p>

              {/* Form specs */}
              <form onSubmit={handleDispenseTrigger} className="space-y-4 pt-5">
                {/* Choose Nozzle */}
                <div className="space-y-1.5">
                  <label className="text-xs font-bold text-slate-650 block">
                    Choose Destination Nozzle
                  </label>
                  <select
                    value={selectedPumpId}
                    onChange={(e) => setSelectedPumpId(e.target.value)}
                    className="w-full text-xs font-semibold bg-slate-50 border border-slate-200 rounded-lg p-2.5 text-slate-800 focus:outline-none focus:ring-2 focus:ring-indigo-500/20"
                    required
                  >
                    {stationPumps.map(p => (
                      <option key={p.id} value={p.id}>
                        {p.label} [{p.fuelType || 'GAS91'}]
                      </option>
                    ))}
                  </select>
                </div>

                {/* Choose Fuel Grade */}
                <div className="space-y-1.5">
                  <label className="text-xs font-bold text-slate-650 block">
                    Assigned Fuel Grade
                  </label>
                  <div className="grid grid-cols-2 gap-2">
                    {stationTanks.map(t => (
                      <button
                        key={t.id}
                        type="button"
                        onClick={() => setSelectedGrade(t.fuelType)}
                        className={`p-2 rounded-lg border text-xs font-mono font-bold transition-all text-center flex flex-col items-center gap-1 ${
                          selectedGrade === t.fuelType
                            ? 'border-indigo-500 bg-[#efecfe] text-[#6c5dd3]'
                            : 'border-slate-200 bg-white text-slate-700 hover:bg-slate-50'
                        }`}
                      >
                        <span className="font-extrabold uppercase">{t.fuelType}</span>
                        <span className="text-[9px] text-slate-400 font-normal">
                          Stock: {t.currentLevel.toLocaleString()}L
                        </span>
                      </button>
                    ))}
                  </div>
                </div>

                {/* Choose Volume */}
                <div className="space-y-1.5">
                  <label className="text-xs font-bold text-slate-650 block">
                    Volume To Dispense (Litre)
                  </label>
                  <div className="grid grid-cols-4 gap-2">
                    {[15, 35, 50, 100].map((v) => (
                      <button
                        key={v}
                        type="button"
                        onClick={() => {
                          setVolumeToDispense(v);
                          setCustomVolume('');
                        }}
                        className={`p-1.5 rounded-lg border text-xs font-mono font-bold transition-all ${
                          volumeToDispense === v && !customVolume
                            ? 'bg-slate-800 text-white border-slate-800'
                            : 'bg-white text-slate-700 border-slate-200 hover:bg-slate-50'
                        }`}
                      >
                        {v}L
                      </button>
                    ))}
                  </div>

                  {/* Custom Input */}
                  <div className="relative pt-2">
                    <input
                      type="number"
                      placeholder="Custom volume..."
                      value={customVolume}
                      onChange={(e) => setCustomVolume(e.target.value)}
                      className="w-full text-xs font-semibold bg-slate-50 border border-slate-200 rounded-lg p-2.5 text-slate-800 pr-8 focus:outline-none focus:ring-2 focus:ring-indigo-500/20"
                    />
                    <span className="absolute right-3.5 top-4.5 text-xs font-mono text-slate-400 font-bold">L</span>
                  </div>
                </div>

                {/* Dynamic Price Calculation */}
                <div className="bg-[#f8fafc] border border-slate-200 rounded-lg p-3 text-xs space-y-1 font-mono">
                  <div className="flex justify-between text-slate-500">
                    <span>Rate / Litre:</span>
                    <span className="font-bold text-slate-750">
                      SAR {(activeStation?.fuelPricing[selectedGrade] || 2.18).toFixed(2)}/L
                    </span>
                  </div>
                  <div className="flex justify-between text-slate-500">
                    <span>Sum Volume:</span>
                    <span className="font-bold text-slate-800">
                      {(customVolume ? parseFloat(customVolume) || 0 : volumeToDispense).toFixed(2)} L
                    </span>
                  </div>
                  <div className="flex justify-between pt-1 border-t border-slate-200 text-[#6c5dd3]">
                    <span className="font-bold">Calculated invoice:</span>
                    <span className="font-black">
                      SAR {((customVolume ? parseFloat(customVolume) || 0 : volumeToDispense) * (activeStation?.fuelPricing[selectedGrade] || 2.18)).toFixed(2)}
                    </span>
                  </div>
                </div>

                {/* Submit button */}
                <button
                  type="submit"
                  className="w-full bg-[#6c5dd3] hover:bg-[#5c4eb3] text-white p-2.5 rounded-lg text-xs font-bold transition-all shadow-xs flex items-center justify-center gap-2"
                >
                  <Play size={12} className="fill-white" />
                  <span>Initiate Customer Hook Sale</span>
                </button>
              </form>
            </div>

            {/* Sim outcomes */}
            {simResults && (
              <div className={`mt-4 p-3 rounded-lg border text-xs flex gap-2.5 ${
                simResults.status === 'success'
                  ? 'bg-emerald-50 border-emerald-200 text-emerald-800'
                  : 'bg-rose-50 border-rose-200 text-rose-800'
              }`}>
                <div className="shrink-0 pt-0.5">
                  <AlertCircle size={16} />
                </div>
                <div>
                  <p className="font-black uppercase tracking-wider">
                    {simResults.status === 'success' ? 'DISPATCH SUCCESS' : 'CONTROLLER BLOCK'}
                  </p>
                  <p className="mt-0.5 opacity-90 leading-relaxed font-semibold">
                    {simResults.message}
                  </p>
                </div>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
};

