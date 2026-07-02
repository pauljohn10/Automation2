/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState } from 'react';
import { useFuelSystem } from '../context';
import { FuelGrade } from '../types';
import { ShieldAlert, RefreshCw, PenTool, CheckCircle, Info } from 'lucide-react';

export const ShowPrices: React.FC = () => {
  const { session, activeStation, updateLocalPricing } = useFuelSystem();
  const effectiveRole = session.originalRole || session.role;

  // Price change simulation states
  const [editingGrade, setEditingGrade] = useState<FuelGrade | null>(null);
  const [newPriceVal, setNewPriceVal] = useState<string>('');
  const [errorMsg, setErrorMsg] = useState('');
  const [successMsg, setSuccessMsg] = useState('');

  if (!activeStation) {
    return (
      <div className="p-8 text-center text-slate-500 font-sans italic text-xs">
        No active station context. Please switch context upper-right first.
      </div>
    );
  }

  const handlePriceUpdate = (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMsg('');
    setSuccessMsg('');

    if (!editingGrade) return;

    if (effectiveRole === 'VIEWER' || effectiveRole === 'OPERATOR') {
      setErrorMsg('Access Denied: You do not have permission to adjust prices.');
      return;
    }

    const parsedPrice = parseFloat(newPriceVal);
    if (isNaN(parsedPrice) || parsedPrice <= 0) {
      setErrorMsg('Price must be a valid positive index value.');
      return;
    }

    if (parsedPrice > 10) {
      setErrorMsg('Price exceeds safety limit matrix constraint.');
      return;
    }

    updateLocalPricing(activeStation.id, editingGrade, parsedPrice);
    setSuccessMsg(`Successfully locked adjusted value of ${editingGrade} to SAR ${parsedPrice.toFixed(2)}/L.`);
    setEditingGrade(null);
    setNewPriceVal('');
  };

  return (
    <div className="p-6 space-y-6 bg-slate-50 min-h-[calc(100vh-64px)] font-sans text-left">
      {/* Banner */}
      <div className="bg-white rounded-xl border border-slate-200 p-5 flex flex-col md:flex-row items-center justify-between gap-4">
        <div>
          <h3 className="text-sm font-black text-slate-800 tracking-tight flex items-center gap-2">
            ELECTRONIC FUEL DISPLAY LED INDEX
          </h3>
          <p className="text-xs text-slate-500 mt-1">
            Replicates real-time street totem price displays. Prices can be locally overridden by station administrators when authorized.
          </p>
        </div>
        <div className="text-xs bg-[#efecfe] px-3 py-1.5 rounded-lg border border-[#d3cef3] font-bold text-[#6c5dd3] uppercase">
          TENANT ID: {activeStation.code}
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* ELECTRONIC TOTEM POLE PREVIEW */}
        <div className="lg:col-span-2 space-y-4">
          <h4 className="text-xs font-black text-slate-400 tracking-widest uppercase">
            Active Store Totem Signage Preview
          </h4>

          {/* Totem visual body */}
          <div className="max-w-md bg-slate-900 border-4 border-slate-950 rounded-2xl p-6 shadow-xl space-y-6 text-white relative">
            <div className="text-center pb-4 border-b border-slate-800">
              <span className="inline-block text-[10px] font-black tracking-widest bg-emerald-500 text-slate-950 px-2.5 py-0.5 rounded uppercase font-mono">
                TELEMETRY SYNCED
              </span>
              <h2 className="text-sm font-black text-slate-300 mt-1 uppercase leading-none font-sans">
                {activeStation.name}
              </h2>
            </div>

            {/* Price list LEDs */}
            <div className="space-y-4">
              {(Object.keys(activeStation.fuelPricing) as FuelGrade[]).map((grade) => {
                const price = activeStation.fuelPricing[grade];
                
                const gradeColorText = {
                  GAS91: 'text-emerald-400',
                  GAS95: 'text-red-400',
                  GAS98: 'text-blue-400',
                  DIESEL: 'text-amber-400'
                }[grade];

                return (
                  <div key={grade} className="flex items-center justify-between bg-slate-950 border border-slate-800 rounded-lg p-3">
                    <div>
                      <div className={`font-mono text-base font-black ${gradeColorText}`}>{grade}</div>
                      <div className="text-[9px] text-slate-500 font-mono">OCTANE FUEL SPEC</div>
                    </div>
                    
                    <div className="text-right">
                      <div className="text-2xl font-mono text-amber-500 font-bold tracking-widest leading-none">
                        {price.toFixed(2)}
                      </div>
                      <div className="text-[9px] text-slate-500 font-mono uppercase mt-0.5">SAR PER LITRE</div>
                    </div>
                  </div>
                );
              })}
            </div>

            <div className="text-center text-[9px] text-slate-600 font-mono font-medium pt-2 uppercase">
              RESERVOIR PRESSURE COMPLY-LOCK ISO 9001
            </div>
          </div>
        </div>

        {/* LOGISTICS ADJUSTMENT CONTROLLER */}
        <div className="bg-white rounded-xl border border-slate-200 p-5 shadow-xs space-y-4">
          <h4 className="text-xs font-black text-slate-400 tracking-widest uppercase flex items-center gap-2">
            <PenTool size={14} className="text-[#6c5dd3]" />
            Local Totem Adjustment
          </h4>

          <p className="text-xs text-slate-600 leading-relaxed font-medium">
            Subject to localized transport logistics indexes, the station admin is permitted write access to configure live fuel values.
          </p>

          <div className="border border-indigo-100 rounded-lg p-3 bg-linear-to-tr from-indigo-50/50 to-purple-50/50 flex gap-2">
            <Info size={16} className="text-indigo-600 shrink-0 mt-0.5" />
            <p className="text-[10px] text-slate-500 font-semibold leading-normal">
              Any live Totem modification triggers a mandatory entry to the automated ERP Global audit log index for regulatory overview.
            </p>
          </div>

          {(effectiveRole === 'VIEWER' || effectiveRole === 'OPERATOR') && (
            <div className="bg-amber-50 border border-amber-200 rounded-lg p-3.5 text-amber-950 font-bold text-xs flex items-center gap-2">
              <ShieldAlert size={16} className="text-amber-600 shrink-0" />
              <span>Restricted Access: You are authorized to monitor totem index boards but cannot modify pricing nodes.</span>
            </div>
          )}

          {!editingGrade ? (
            <div className="space-y-2.5">
              <label className="text-xs font-bold text-slate-600 block">Select Target Grade to Adjust</label>
              <div className="grid grid-cols-2 gap-2">
                {(Object.keys(activeStation.fuelPricing) as FuelGrade[]).map((grade) => (
                  <button
                    key={grade}
                    onClick={() => {
                      if (effectiveRole === 'VIEWER' || effectiveRole === 'OPERATOR') {
                        alert('Access Denied: You do not have permission to configure pricing totems.');
                        return;
                      }
                      setEditingGrade(grade);
                      setNewPriceVal(activeStation.fuelPricing[grade].toString());
                      setSuccessMsg('');
                      setErrorMsg('');
                    }}
                    disabled={effectiveRole === 'VIEWER' || effectiveRole === 'OPERATOR'}
                    className="p-2.5 rounded-lg border border-slate-200 text-xs font-bold hover:bg-slate-50 text-slate-700 bg-white transition-all text-center flex items-center justify-between disabled:opacity-60 disabled:cursor-not-allowed"
                  >
                    <span>{grade}</span>
                    <span className="font-mono text-slate-400">SAR {activeStation.fuelPricing[grade].toFixed(2)}</span>
                  </button>
                ))}
              </div>
            </div>
          ) : (
            <form onSubmit={handlePriceUpdate} className="space-y-4 border border-[#e2e8f0] rounded-xl p-4 bg-slate-50">
              <div className="flex items-center justify-between">
                <span className="text-xs font-bold text-[#6c5dd3]">Adjusting pricing of {editingGrade}</span>
                <button 
                  type="button" 
                  onClick={() => setEditingGrade(null)} 
                  className="text-[10px] bg-slate-200 hover:bg-slate-300 rounded px-2 py-0.5 font-bold"
                >
                  Cancel
                </button>
              </div>

              <div className="space-y-1.5">
                <label className="text-xs font-bold text-slate-600 block">New price (SAR per Litre)</label>
                <div className="relative">
                  <input
                    type="number"
                    step="0.01"
                    min="0.10"
                    max="10.00"
                    placeholder="e.g. 2.45"
                    value={newPriceVal}
                    onChange={(e) => setNewPriceVal(e.target.value)}
                    className="w-full text-xs font-semibold bg-white border border-slate-250 rounded-lg p-2 pr-12 text-slate-800 focus:outline-none focus:ring-1 focus:ring-[#6c5dd3]"
                    required
                  />
                  <span className="absolute right-3.5 top-2.5 text-xs font-mono text-slate-400 font-bold">L</span>
                </div>
              </div>

              <button
                type="submit"
                className="w-full bg-[#6c5dd3] hover:bg-[#5c4eb3] text-white p-2 rounded-lg text-xs font-bold transition-all"
              >
                Lock New Price Totem
              </button>
            </form>
          )}

          {/* Feedback messages */}
          {errorMsg && (
            <div className="bg-red-50 border border-red-200 rounded p-2.5 text-[10px] text-red-800 font-bold">
              {errorMsg}
            </div>
          )}

          {successMsg && (
            <div className="bg-emerald-50 border border-emerald-250 rounded p-2.5 text-[10px] text-emerald-800 font-bold flex items-center gap-1.5">
              <CheckCircle size={12} className="text-emerald-600" />
              <span>{successMsg}</span>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
