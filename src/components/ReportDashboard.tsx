/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState } from 'react';
import { useFuelSystem } from '../context';
import { FuelStation, FuelGrade } from '../types';
import { BarChart, TrendingUp, AlertTriangle, Coins, Filter, Calendar, Layers } from 'lucide-react';

export const ReportDashboard: React.FC = () => {
  const { transactions, stations, tanks, session } = useFuelSystem();
  
  // States
  const [selectedGradeFilter, setSelectedGradeFilter] = useState<string>('ALL');
  const [timeRange, setTimeRange] = useState<'TODAY' | 'WEEK' | 'MONTH'>('TODAY');

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
                    <td className="p-3 font-semibold text-slate-600">{tx.pumpId}</td>
                    <td className="p-3 font-bold text-slate-800">{tx.fuelType}</td>
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
