/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState } from 'react';
import { useFuelSystem } from '../context';
import { Truck, Droplet, RefreshCw, AlertTriangle, ShieldCheck } from 'lucide-react';

export const AdminOverride: React.FC = () => {
  const { tanks, session, triggerFuelDelivery, resetTankWater, clearAllData } = useFuelSystem();

  // Selected states
  const [selectedTankId, setSelectedTankId] = useState('');
  const [deliveryL, setDeliveryL] = useState<number>(10000);
  const [replenishMsg, setReplenishMsg] = useState<{ status: 'success' | 'error'; text: string } | null>(null);

  const stationTanks = tanks
    .filter(t => t.stationId === session.activeStationId)
    .sort((a, b) => a.label.localeCompare(b.label, undefined, { numeric: true, sensitivity: 'base' }));

  React.useEffect(() => {
    if (stationTanks.length > 0 && !selectedTankId) {
      setSelectedTankId(stationTanks[0].id);
    }
  }, [stationTanks, selectedTankId]);

  const handleDelivery = (e: React.FormEvent) => {
    e.preventDefault();
    setReplenishMsg(null);

    if (session.role === 'VIEWER' || session.role === 'OPERATOR') {
      setReplenishMsg({ status: 'error', text: 'Access Denied: You do not have permission to trigger fuel delivery simulations.' });
      return;
    }

    if (!selectedTankId) {
      setReplenishMsg({ status: 'error', text: 'Select a valid active underground tank.' });
      return;
    }

    const res = triggerFuelDelivery(selectedTankId, deliveryL);
    if (res.success) {
      setReplenishMsg({ status: 'success', text: res.message });
    } else {
      setReplenishMsg({ status: 'error', text: res.message });
    }
  };

  const handleFactoryReset = () => {
    if (session.role !== 'SUPER_ADMIN') {
      alert('Access Denied: Only SUPER_ADMIN accounts can perform factory resets.');
      return;
    }
    if (window.confirm('WARNING: This will purge all transaction modifications, newly created tenant stations, and local totem variables. Restore master factory seeding?')) {
      clearAllData();
      window.location.reload();
    }
  };

  return (
    <div className="p-6 space-y-6 bg-slate-50 min-h-[calc(100vh-64px)] font-sans text-left">
      {/* Overview */}
      <div className="bg-white rounded-xl border border-slate-200 p-5">
        <h3 className="text-sm font-black text-slate-800 tracking-tight flex items-center gap-2">
          <AlertTriangle className="text-amber-500" size={18} />
          STATION PHYSICAL MAINTENANCE & LOGISTICS OVERRIDERS
        </h3>
        <p className="text-xs text-slate-500 mt-1">
          Perform administrative physical hardware actions including simulated logistics tanker deliveries and underground moisture purges.
        </p>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* TANK replenishment LOGISTICS */}
        <div className="bg-white rounded-xl border border-slate-200 p-5 shadow-2xs space-y-4">
          <h4 className="text-xs font-black text-slate-400 tracking-widest uppercase flex items-center gap-2">
            <Truck size={14} className="text-[#6c5dd3]" />
            Replenishment Tanker Logistics Truck Simulation
          </h4>

          <p className="text-xs text-slate-600 leading-relaxed font-medium">
            Simulate a logistics trailer pulling into the bay. Fuel delivery replenishes tank current volumes and records high-level sensor matrix entry.
          </p>

          <form onSubmit={handleDelivery} className="space-y-4">
            <div className="space-y-1.5">
              <label className="text-xs font-bold text-slate-600 block">Select Target Underground Tank</label>
              <select
                value={selectedTankId}
                onChange={(e) => setSelectedTankId(e.target.value)}
                className="w-full text-xs font-semibold bg-slate-50 border border-slate-200 rounded-lg p-2.5 text-slate-800 focus:outline-none"
                required
              >
                {stationTanks.map(t => {
                  const room = t.capacity - t.currentLevel;
                  return (
                    <option key={t.id} value={t.id}>
                      {t.label} ({t.fuelType}) - Stock: {t.currentLevel.toLocaleString()}L / Cap: {t.capacity.toLocaleString()}L (safety ullage: {room.toLocaleString()}L)
                    </option>
                  );
                })}
              </select>
            </div>

            <div className="space-y-1.5">
              <label className="text-xs font-bold text-slate-600 block">Tanker Payload (Litres)</label>
              <div className="grid grid-cols-4 gap-2">
                {[5000, 10000, 15000, 20000].map((litres) => (
                  <button
                    key={litres}
                    type="button"
                    onClick={() => setDeliveryL(litres)}
                    disabled={session.role === 'VIEWER' || session.role === 'OPERATOR'}
                    className={`p-2 rounded-lg border text-xs font-bold font-mono transition-all disabled:opacity-50 disabled:cursor-not-allowed ${
                      deliveryL === litres
                        ? 'bg-[#6c5dd3] text-white border-[#6c5dd3]'
                        : 'bg-white text-slate-700 border-slate-200 hover:bg-slate-50'
                    }`}
                  >
                    {litres.toLocaleString()} L
                  </button>
                ))}
              </div>
            </div>

            <button
              type="submit"
              disabled={session.role === 'VIEWER' || session.role === 'OPERATOR'}
              className="w-full bg-[#6c5dd3] hover:bg-[#5c4eb3] text-white p-2.5 rounded-lg text-xs font-bold transition-all shadow-xs flex items-center justify-center gap-2 font-sans disabled:opacity-50 disabled:cursor-not-allowed"
            >
              <Truck size={14} />
              <span>Pump Replenishment Tanker Payload</span>
            </button>
          </form>

          {replenishMsg && (
            <div className={`p-3 rounded-lg border text-xs flex gap-2.5 ${
              replenishMsg.status === 'success'
                ? 'bg-emerald-50 border-emerald-250 text-emerald-800'
                : 'bg-red-50 border-red-200 text-red-800'
            }`}>
              <div className="shrink-0 pt-0.5">
                <ShieldCheck size={16} />
              </div>
              <p className="font-semibold leading-relaxed">
                {replenishMsg.text}
              </p>
            </div>
          )}
        </div>

        {/* FACTORY RESET & WATER PURGE */}
        <div className="bg-white rounded-xl border border-slate-200 p-5 shadow-2xs space-y-4">
          <h4 className="text-xs font-black text-slate-400 tracking-widest uppercase flex items-center gap-2">
            <RefreshCw size={14} className="text-amber-500" />
            Underground Hydrostatics & Water Purge
          </h4>

          <p className="text-xs text-slate-600 leading-relaxed font-medium">
            Over long periods of storage, moisture droplets condense inside reservoirs. The moisture separator can purge water sensor levels back to zero.
          </p>

          <div className="space-y-4 pt-2">
            {stationTanks.map((tank) => (
              <div key={tank.id} className="flex items-center justify-between border border-slate-100 rounded-lg p-3 bg-slate-50">
                <div>
                  <div className="text-xs font-black text-slate-700">{tank.label} ({tank.fuelType})</div>
                  <div className="text-[10px] text-slate-400 font-mono">Current Water reading: {tank.waterLevel.toFixed(2)}m</div>
                </div>
                <button
                  onClick={() => {
                    if (session.role === 'VIEWER' || session.role === 'OPERATOR') {
                      alert('Access Denied: You do not have permission to initiate sensor moisture purges.');
                      return;
                    }
                    resetTankWater(tank.id);
                    alert(`Purge triggered for ${tank.label}. Sensor water level reset to 0.00m.`);
                  }}
                  disabled={session.role === 'VIEWER' || session.role === 'OPERATOR'}
                  className="px-3 py-1.5 bg-white border border-slate-200 rounded-md text-[10px] text-slate-700 font-black hover:bg-slate-50 transition-colors shadow-2xs disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  Purge Sensor moisture
                </button>
              </div>
            ))}
          </div>

          <div className="pt-4 border-t border-slate-150 space-y-3">
            <h5 className="text-xs font-bold text-red-700 uppercase flex items-center gap-1">
              <AlertTriangle size={14} /> Danger Zone: Factory Reset Seeding
            </h5>
            <p className="text-[11px] text-slate-500 leading-normal font-semibold">
              Purges all browser session cache registers and re-downloads fresh, dynamic datasets directly from the synchronized live Supabase database.
            </p>
            <button
              onClick={handleFactoryReset}
              disabled={session.role !== 'SUPER_ADMIN'}
              className="px-4 py-2 bg-red-100 hover:bg-red-200 border border-red-200 text-red-800 rounded-lg text-xs font-black transition-all flex items-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed"
            >
              <RefreshCw size={14} />
              Reset Seeding Database
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
