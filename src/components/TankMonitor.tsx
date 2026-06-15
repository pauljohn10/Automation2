/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState } from 'react';
import { useFuelSystem } from '../context';
import { FuelTank } from '../types';
import { AlertTriangle, Droplet, X, RotateCw } from 'lucide-react';

// Helper function to dynamically calculate/shift time values based on late-update timestamp
const getShiftedTime = (timeStr: string, minutesToSubtract: number = 20): string => {
  try {
    if (!timeStr) return "10/06 13:47";
    
    const parts = timeStr.trim().split(/\s+/);
    if (parts.length === 2) {
      const datePart = parts[0]; 
      const timePart = parts[1];
      
      const dateSubparts = datePart.split('/');
      const timeSubparts = timePart.split(':');
      
      if (dateSubparts.length >= 2 && timeSubparts.length >= 2) {
        const month = parseInt(dateSubparts[0], 10) - 1;
        const day = parseInt(dateSubparts[1], 10);
        const year = dateSubparts[2] ? parseInt(dateSubparts[2], 10) : new Date().getFullYear();
        
        const hour = parseInt(timeSubparts[0], 10);
        const minute = parseInt(timeSubparts[1], 10);
        
        const d = new Date(year, month, day, hour, minute);
        if (!isNaN(d.getTime())) {
          d.setMinutes(d.getMinutes() - minutesToSubtract);
          const mm = String(d.getMonth() + 1).padStart(2, '0');
          const dd = String(d.getDate()).padStart(2, '0');
          const hh = String(d.getHours()).padStart(2, '0');
          const min = String(d.getMinutes()).padStart(2, '0');
          return `${mm}/${dd} ${hh}:${min}`;
        }
      }
    }
    
    const parsed = Date.parse(timeStr);
    if (!isNaN(parsed)) {
      const d = new Date(parsed - minutesToSubtract * 60000);
      const mm = String(d.getMonth() + 1).padStart(2, '0');
      const dd = String(d.getDate()).padStart(2, '0');
      const hh = String(d.getHours()).padStart(2, '0');
      const min = String(d.getMinutes()).padStart(2, '0');
      return `${mm}/${dd} ${hh}:${min}`;
    }
  } catch (e) {
    console.error("Error shifting time", e);
  }
  return "10/06 13:47";
};

export const TankMonitor: React.FC = () => {
  const { tanks, transactions, session, resetTankWater, updateTankLevel } = useFuelSystem();

  // Modal and custom notifier states
  const [selectedTankId, setSelectedTankId] = useState<string | null>(null);
  const [inputValue, setInputValue] = useState<string>('');
  const [validationError, setValidationError] = useState<string | null>(null);
  const [isSaving, setIsSaving] = useState(false);
  const [successNotif, setSuccessNotif] = useState<string | null>(null);

  // Active status simulated temperature state (Rule 1: chemical/physical drift fluctuations)
  const [simulatedTemps, setSimulatedTemps] = useState<Record<string, number>>({});

  // Active authenticated fuel station account session info
  const activeStationAccount = session.role === 'STATION_ADMIN' ? { id: session.activeStationId } : null;

  // Filter tanks for current station
  const stationTanks = tanks.filter(t => t.stationId === session.activeStationId);
  const sortedTanks = [...stationTanks].sort((a, b) => a.label.localeCompare(b.label, undefined, { numeric: true, sensitivity: 'base' }));

  // Automated background ticker simulation (fluctuating between 31.50°C and 35.80°C)
  React.useEffect(() => {
    setSimulatedTemps(prev => {
      const next = { ...prev };
      let updated = false;
      sortedTanks.forEach(tank => {
        if (next[tank.id] === undefined) {
          // Initialize distinct temperatures per tank so they do not start identical
          let initialTemp = 34.00;
          if (tank.label.includes('02') || tank.fuelType === 'GAS95') {
            initialTemp = 34.50;
          } else if (tank.label.includes('03') || tank.fuelType === 'DIESEL') {
            initialTemp = 32.20;
          } else {
            initialTemp = 33.10;
          }
          // Slight distinct starting micro-variation
          initialTemp += (Math.random() * 0.4 - 0.2);
          next[tank.id] = parseFloat(initialTemp.toFixed(2));
          updated = true;
        }
      });
      return updated ? next : prev;
    });

    const interval = setInterval(() => {
      setSimulatedTemps(prev => {
        const next = { ...prev };
        sortedTanks.forEach(tank => {
          const current = next[tank.id] !== undefined ? next[tank.id] : 34.00;
          // Step variance micro-adjustments strictly between ±0.02°C and ±0.05°C
          const step = 0.02 + Math.random() * 0.03;
          const direction = Math.random() < 0.5 ? -1 : 1;
          let newTemp = current + step * direction;

          // Stay strictly within operational limits 31.50°C and 35.80°C
          if (newTemp > 35.80) {
            newTemp = current - step;
          } else if (newTemp < 31.5) {
            newTemp = current + step;
          }

          next[tank.id] = parseFloat(newTemp.toFixed(2));
        });
        return next;
      });
    }, 2000); // Ticker runs every 2 seconds for a smoother responsive drift effect

    return () => clearInterval(interval);
  }, [sortedTanks.map(t => t.id).join(',')]);

  const stationTx = transactions
    .filter(tx => tx.stationId === session.activeStationId)
    // Only show standard start/finish phases related to physical dispensers
    .slice(0, 15);

  const getFuelColor = (type: string) => {
    switch (type) {
      case 'GAS91': return '#00df00'; // Vibrant High-Saturation Bright Green
      case 'GAS95': return '#ff0000'; // Vibrant Solid Bright Primary Red
      case 'GAS98': return '#3b82f6'; // Blue
      case 'DIESEL': return '#ffff00'; // Pure Flat High-Saturation Bright Yellow
      default: return '#6b7280';
    }
  };

  const getFuelBgGradient = (type: string) => {
    switch (type) {
      case 'GAS91': return 'linear-gradient(to top, #00a000 0%, #00df00 80%, #5dff5d 100%)';
      case 'GAS95': return 'linear-gradient(to top, #c00000 0%, #ff0000 80%, #ff5d5d 100%)';
      case 'GAS98': return 'linear-gradient(to top, #1d4ed8 0%, #3b82f6 80%, #60a5fa 100%)';
      case 'DIESEL': return 'linear-gradient(to top, #c4c400 0%, #ffff00 80%, #ffff77 100%)';
      default: return 'linear-gradient(to top, #4b5563, #9ca3af)';
    }
  };

  // Handler for tank click (Rule 2)
  const handleTankClick = (tank: FuelTank) => {
    if (session.role === 'VIEWER') {
      alert('Access Denied: Read-only VIEWER profile cannot configure tank telemetry.');
      return;
    }
    const currentId = tank.stationId;
    // Strictly restrict click trigger to active authenticated fuel station account session
    if (activeStationAccount && activeStationAccount.id === currentId) {
      setSelectedTankId(tank.id);
      setInputValue(String(tank.currentLevel));
      setValidationError(null);
    }
  };

  // Handler modal submit (Rule 3 & 4)
  const handleSaveChanges = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedTankId) return;

    const numValue = parseFloat(inputValue);
    // Frontend validation: value must not be less than 0 and cannot exceed 45000 Liters
    if (isNaN(numValue) || inputValue.trim() === '' || numValue < 0 || numValue > 45000) {
      setValidationError('Value must be a valid number between 0 and 45,000 Liters.');
      return;
    }

    setIsSaving(true);
    setValidationError(null);

    try {
      const res = await updateTankLevel(selectedTankId, numValue);
      if (res.success) {
        setSuccessNotif(`Successfully updated volume asset to ${numValue.toLocaleString()} L.`);
        setTimeout(() => setSuccessNotif(null), 4000);
        setSelectedTankId(null);
      } else {
        setValidationError(res.message);
      }
    } catch (err: any) {
      setValidationError(err.message || 'An error occurred while uploading. Please check Database connection.');
    } finally {
      setIsSaving(false);
    }
  };

  const selectedTank = tanks.find(t => t.id === selectedTankId);

  return (
    <div className="p-6 space-y-6 bg-slate-50 min-h-[calc(100vh-64px)] font-sans relative">
      {/* Dynamic Alerts Banner */}
      {stationTanks.some(t => t.waterLevel > 0.01) && (
        <div className="bg-amber-50 border-l-4 border-amber-500 text-amber-900 p-4 rounded-r-lg shadow-2xs flex items-center justify-between">
          <div className="flex items-center gap-3">
            <AlertTriangle className="text-amber-600 shrink-0" size={20} />
            <div>
              <p className="text-xs font-bold uppercase tracking-wider">Moisture Advisory</p>
              <p className="text-xs text-amber-700 mt-0.5">Water condensation detected in underground reservoirs. Recommended action: Trigger "Admin Reset / Purge" command.</p>
            </div>
          </div>
        </div>
      )}

      {/* Tank Hardware Cards - Grid arrangement exact replication */}
      <div className="grid grid-cols-1 xl:grid-cols-2 gap-6">
        {sortedTanks.map((tank) => {
          const filledPct = (tank.currentLevel / tank.capacity) * 100;
          const ullage = tank.capacity - tank.currentLevel;
          const fuelColor = getFuelColor(tank.fuelType);

          // Render click border states strictly for verified fuel station account operator
          const currentStationId = tank.stationId;
          const isAuthorized = activeStationAccount !== null && activeStationAccount.id === currentStationId && session.role !== 'VIEWER';
          const isHighlighted = tank.label === 'Tank 02';

          return (
            <div 
              key={tank.id} 
              onClick={() => handleTankClick(tank)}
              className={`bg-white rounded-xl shadow-xs transition-all duration-250 p-5 flex flex-col justify-between ${
                isHighlighted 
                  ? 'border-2 border-[#ca1880]' 
                  : 'border border-[#cbd5e1] hover:border-[#ca1880]'
              } ${
                isAuthorized ? 'cursor-pointer' : ''
              }`}
            >
              {/* Header metrics */}
              <div className="flex items-center justify-between mb-4 pb-2 border-b border-dashed border-slate-100">
                <div className="flex items-center gap-2">
                  <svg viewBox="0 0 24 24" className="w-[15px] h-[15px] text-indigo-500 fill-none stroke-current" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                    <rect x="5" y="6" width="14" height="14" rx="2" />
                    <path d="M9 2h6v4H9z" />
                    <path d="M13 10l-2 3h4l-2 3" />
                  </svg>
                  <h4 className="text-sm font-black text-slate-850 tracking-tight flex items-center gap-1.5 uppercase">
                    {tank.label} 
                    <span className="text-[9px] bg-indigo-50 text-indigo-600 px-1.5 py-0.5 rounded-full font-black uppercase tracking-wider">
                      {tank.fuelType}
                    </span>
                  </h4>
                </div>
                <div className="text-[10px] font-bold text-slate-400 font-mono">
                  {tank.lastMeasurementTime}
                </div>
              </div>

              {/* Physical Cylinder Gauge & Variables box */}
              <div className="grid grid-cols-1 sm:grid-cols-12 gap-5 items-center">
                
                {/* HORIZONTAL CAPSULE VESSEL ILLUSTRATION (Image 2 replica) */}
                <div className="sm:col-span-5 h-[130px] border border-[#cbd5e1] bg-white rounded-lg flex items-center justify-center relative p-3 shrink-0 select-none shadow-2xs">
                  {/* Self-contained unified container guaranteeing that caps, capsule, and feet never drift apart on resize */}
                  <div className="relative w-[150px] h-[98px]">
                    {/* Inlet Cap positioned on the left side of capsule top */}
                    <div className="absolute top-[2px] left-[18px] w-6 h-3 bg-slate-400 border border-slate-600 rounded-t-sm z-20 shadow-3xs" />
                    
                    {/* Outer horizontal container */}
                    <div className="absolute top-[10px] left-0 w-[150px] h-[78px] rounded-[24px] border-2 border-slate-500 bg-white shadow-[inset_0_2px_6px_rgba(0,0,0,0.1)] overflow-hidden flex items-end z-10">
                      {/* Level fill segment - (Rule 1: renders completely empty when value is 0) */}
                      <div 
                        className="w-full absolute bottom-0 left-0 right-0 transition-all duration-[1200ms] ease-out"
                        style={{ 
                          height: tank.currentLevel === 0 ? '0%' : `${filledPct}%`, 
                          background: getFuelBgGradient(tank.fuelType),
                        }}
                      >
                        {/* Fluid wave shining effect */}
                        <div className="absolute top-0 left-0 right-0 h-1 bg-white opacity-35 animate-pulse" />
                      </div>

                      {/* Highlights overlay (shining glass cylinder reflection) */}
                      <div className="absolute inset-0 bg-linear-to-b from-white/20 via-transparent to-black/10 pointer-events-none rounded-[22px]" />
                      <div className="absolute left-1 right-1 top-1 bottom-1 border border-white/5 rounded-[22px] pointer-events-none" />

                      {/* Moisture content layer on the bottom */}
                      {tank.waterLevel > 0 && (
                        <div className="absolute bottom-0 inset-x-0 h-2 bg-blue-500/85 animate-pulse flex items-center justify-center text-[7px] text-white font-mono uppercase font-black tracking-widest leading-none">
                          WATER
                        </div>
                      )}
                    </div>

                    {/* Metal feet support stands */}
                    <div className="w-[114px] absolute bottom-0 left-[18px] z-5 flex justify-between px-2">
                      <div className="w-[14px] h-[10px] bg-slate-400 rounded-b-xs border border-slate-550" />
                      <div className="w-[14px] h-[10px] bg-slate-400 rounded-b-xs border border-slate-550" />
                    </div>
                  </div>
                </div>

                {/* TELEMETRY READINGS COLUMN */}
                <div className="sm:col-span-7 bg-white font-sans space-y-1.5 text-xs">
                  <div className="flex justify-between items-center text-slate-400 text-[11px] select-none pb-1.5 border-b border-slate-100">
                    <span className="font-extrabold uppercase tracking-wide">CAPACITY:</span>
                    <span className="font-bold text-slate-800 text-[13px]">{tank.capacity.toLocaleString()} <span className="font-normal text-xs text-slate-400">L</span></span>
                  </div>
                  
                  <div className="flex justify-between items-center text-[#475569] text-[11px] select-none pt-0.5 pb-1.5 border-b border-slate-100">
                    <span className="font-bold">Percent:</span>
                    <span className="font-extrabold text-slate-800 text-sm">{filledPct.toFixed(1)}%</span>
                  </div>

                  <div className="flex justify-between items-center text-[#475569] text-[11px] select-none pt-0.5 pb-1.5 border-b border-slate-100">
                    <span className="font-bold">Fuel Level:</span>
                    <span className="font-black text-slate-900 text-sm">{tank.currentLevel.toLocaleString()} <span className="font-normal text-xs text-slate-450">L</span></span>
                  </div>

                  <div className="flex justify-between items-center text-[#ca1880] text-[11px] select-none pt-0.5 pb-1.5 border-b border-slate-100">
                    <span className="font-bold">Ullage:</span>
                    <span className="font-black text-[#ca1880] text-sm">{ullage.toLocaleString()} <span className="font-normal text-xs">L</span></span>
                  </div>

                  <div className="flex justify-between items-center text-[#475569] text-[11px] select-none pt-0.5">
                    <span className="font-bold">Temp:</span>
                    <span className="font-bold text-slate-850 text-sm">
                      {(simulatedTemps[tank.id] !== undefined ? simulatedTemps[tank.id] : tank.temperature).toFixed(2)}
                      <span className="font-normal text-xs text-slate-400">°C</span>
                    </span>
                  </div>
                </div>
              </div>

              {/* Moisture warning controls */}
              {tank.waterLevel > 0 && (
                <div className="mt-3 bg-amber-50 rounded border border-amber-200 p-2 flex items-center justify-between">
                  <div className="flex items-center gap-1.5 text-[10px] text-amber-800 font-bold">
                    <Droplet size={12} />
                    <span>Moisture Content: {(tank.waterLevel * 1000).toFixed(0)} mL detected.</span>
                  </div>
                  <button 
                    onClick={(e) => {
                      e.stopPropagation(); // prevent opening configuration modal on click
                      if (session.role === 'VIEWER') {
                        alert('Access Denied: Read-only VIEWER profile cannot initiate moisture purges.');
                        return;
                      }
                      resetTankWater(tank.id);
                    }}
                    disabled={session.role === 'VIEWER'}
                    className="text-[10px] font-black text-amber-900 bg-amber-200 hover:bg-amber-300 px-2 py-1 rounded transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                  >
                    Purge Water
                  </button>
                </div>
              )}
            </div>
          );
        })}
      </div>

      {/* TELEMETRY TRANSACTION DETAIL TABLE REPLICA */}
      <div className="bg-white border border-[#cbd5e1] overflow-hidden">
        {/* Dense telemetry table replicating screenshot EXACTLY */}
        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse font-mono text-xs text-[#2c3d5a]">
            <thead>
              <tr className="bg-[#f1f5f9] border-b border-[#cbd5e1] text-slate-700 font-bold text-[11px] select-none">
                <th className="p-3 border-r border-[#cbd5e1] w-16">TANK</th>
                <th className="p-3 border-r border-[#cbd5e1] text-center w-10"></th>
                <th className="p-3 border-r border-[#cbd5e1]">STATE</th>
                <th className="p-3 border-r border-[#cbd5e1]">TIME</th>
                <th className="p-3 border-r border-[#cbd5e1] text-right">VOLUME</th>
                <th className="p-3 border-r border-[#cbd5e1] text-right">HEIGHT</th>
                <th className="p-3 border-r border-[#cbd5e1] text-right font-semibold">TEMP.</th>
                <th className="p-3 border-r border-[#cbd5e1] text-right">WATER</th>
                <th className="p-3 text-right">AMOUNT(15°)</th>
              </tr>
            </thead>
            <tbody>
              {(() => {
                // For each tank on the active station, build a grouped block of 2 rows syncing with the live tank context state
                return sortedTanks.map((tank, tIdx) => {
                  const tankNum = tank.label.replace(/[^0-9]/g, '') || '01';
                  const bgRowClass = tIdx % 2 === 1 ? 'bg-[#eff6ff]' : 'bg-white';
                  
                  // Distinct physical calibration factors per tank to represent real hardware sensor variations and prevent duplicate row appearance
                  let probeFullHeightMm = 1323.00;
                  let volumeShift = 500.00;
                  let tempStartedOffset = 0.30;
                  let tempFinishedOffset = 0.00;
                  const coeff15 = tank.fuelType === 'DIESEL' ? 0.00085 : 0.00115;

                  if (tank.label.includes('02') || tank.fuelType === 'GAS95') {
                    probeFullHeightMm = 1321.50;
                    volumeShift = 485.00;
                    tempStartedOffset = 0.20;
                    tempFinishedOffset = 0.05;
                  } else if (tank.label.includes('03') || tank.fuelType === 'DIESEL') {
                    probeFullHeightMm = 1326.80;
                    volumeShift = 520.00;
                    tempStartedOffset = 0.25;
                    tempFinishedOffset = -0.10;
                  } else {
                    // Tank 01 or fallback
                    probeFullHeightMm = 1324.20;
                    volumeShift = 460.00;
                    tempStartedOffset = 0.35;
                    tempFinishedOffset = 0.00;
                  }

                  // Programmatic sensor equations for volume and water displacement
                  const finishedVolume = tank.currentLevel;
                  const startedVolume = Math.max(0, tank.currentLevel - volumeShift);
                  
                  // Programmatic millimeter (mm) height sensor displacement conversion equation (e.g. Probe Factor * Capacity Ratio)
                  const startedHeight = (startedVolume / (tank.capacity || 45000)) * probeFullHeightMm;
                  const finishedHeight = (finishedVolume / (tank.capacity || 45000)) * probeFullHeightMm;

                  // Use active simulated temperature state if available
                  const currentTemp = simulatedTemps[tank.id] !== undefined ? simulatedTemps[tank.id] : tank.temperature;

                  const startedAmount15 = startedVolume * (1 - coeff15 * ((currentTemp + tempStartedOffset) - 15));
                  const finishedAmount15 = finishedVolume * (1 - coeff15 * ((currentTemp + tempFinishedOffset) - 15));

                  return (
                    <React.Fragment key={tank.id}>
                      {/* FIRST ROW: STARTED */}
                      <tr className={`${bgRowClass} font-bold border-b border-[#cbd5e1]`}>
                        {/* Tank Number */}
                        <td rowSpan={2} className="p-3 border-r border-[#cbd5e1] text-slate-800 font-extrabold text-xs text-center align-middle select-none border-b border-[#cbd5e1]">
                          {tankNum}
                        </td>
                        {/* + Symbol in its own cell */}
                        <td rowSpan={2} className="p-3 border-r border-[#cbd5e1] text-blue-600 text-center font-black text-sm align-middle select-none border-b border-[#cbd5e1]">
                          +
                        </td>
                        {/* STARTED specs */}
                        <td className="p-3 border-r border-[#cbd5e1] text-blue-700 font-bold text-xs select-none">
                          STARTED
                        </td>
                        <td className="p-3 border-r border-[#cbd5e1] text-[#1a202c] font-semibold">
                          {getShiftedTime(tank.lastMeasurementTime, 20)}
                        </td>
                        <td className="p-3 border-r border-[#cbd5e1] text-right text-slate-900 font-mono">
                          {startedVolume.toFixed(2)}
                        </td>
                        <td className="p-3 border-r border-[#cbd5e1] text-right text-slate-900 font-mono">
                          {startedHeight.toFixed(2)}
                        </td>
                        <td className="p-3 border-r border-[#cbd5e1] text-right text-slate-900 font-mono">
                          {(currentTemp + tempStartedOffset).toFixed(2)}
                        </td>
                        <td className="p-3 border-r border-[#cbd5e1] text-right text-slate-500 font-mono">
                          {tank.waterLevel.toFixed(2)}
                        </td>
                        <td className="p-3 text-right text-slate-500 font-mono">
                          {startedAmount15.toFixed(2)}
                        </td>
                      </tr>
 
                      {/* SECOND ROW: FINISHED */}
                      <tr className={`${bgRowClass} font-bold border-b border-[#cbd5e1]`}>
                        {/* FINISHED specs */}
                        <td className="p-3 border-r border-[#cbd5e1] text-slate-800 font-bold text-xs select-none border-b border-[#cbd5e1]">
                          FINISHED
                        </td>
                        <td className="p-3 border-r border-[#cbd5e1] text-[#1a202c] font-semibold border-b border-[#cbd5e1]">
                          {tank.lastMeasurementTime}
                        </td>
                        <td className="p-3 border-r border-[#cbd5e1] text-right text-slate-900 font-extrabold border-b border-[#cbd5e1]">
                          {finishedVolume.toFixed(2)}
                        </td>
                        <td className="p-3 border-r border-[#cbd5e1] text-right text-slate-900 font-mono border-b border-[#cbd5e1]">
                          {finishedHeight.toFixed(2)}
                        </td>
                        <td className="p-3 border-r border-[#cbd5e1] text-right text-slate-900 font-mono border-b border-[#cbd5e1]">
                          {(currentTemp + tempFinishedOffset).toFixed(2)}
                        </td>
                        <td className="p-3 border-r border-[#cbd5e1] text-right text-slate-500 font-mono border-b border-[#cbd5e1]">
                          {tank.waterLevel.toFixed(2)}
                        </td>
                        <td className="p-3 text-right text-slate-950 font-extrabold text-xs border-b border-[#cbd5e1] font-mono">
                          {finishedAmount15.toFixed(2)}
                        </td>
                      </tr>
                    </React.Fragment>
                  );
                });
              })()}
            </tbody>
          </table>
        </div>
      </div>

      {/* Custom Overlay Allocation Modal (Rule 3) */}
      {selectedTank && (
        <div id="tank-config-modal-overlay" className="fixed inset-0 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-4 z-50 transition-all">
          <div 
            id="tank-config-modal" 
            className="bg-white rounded-2xl shadow-xl border border-slate-200 max-w-md w-full overflow-hidden transform scale-100 transition-all duration-300"
          >
            {/* Modal Header */}
            <div className="bg-slate-50 border-b border-slate-100 px-6 py-4 flex items-center justify-between">
              <div className="flex items-center gap-2">
                <svg viewBox="0 0 24 24" className="w-[18px] h-[18px] text-indigo-600 fill-none stroke-current" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                  <rect x="5" y="6" width="14" height="14" rx="2" />
                  <path d="M9 2h6v4H9z" />
                  <path d="M13 10l-2 3h4l-2 3" />
                </svg>
                <h3 className="text-sm font-black text-slate-800 tracking-tight uppercase">
                  Update Station Tank Volume Asset
                </h3>
              </div>
              <button 
                onClick={() => setSelectedTankId(null)}
                className="text-slate-400 hover:text-slate-600 transition-colors p-1 rounded-full hover:bg-slate-100"
                aria-label="Close Modal"
              >
                <X size={16} />
              </button>
            </div>

            {/* Modal Body / Form */}
            <form onSubmit={handleSaveChanges} className="p-6 space-y-4">
              <div className="bg-indigo-50/50 rounded-lg p-3.5 border border-indigo-100 space-y-2">
                <div className="flex justify-between items-center text-xs">
                  <span className="font-extrabold text-[#475569] uppercase tracking-wide">Target Fuel Asset:</span>
                  <span className="font-black text-slate-800">{selectedTank.label} ({selectedTank.fuelType})</span>
                </div>
                <div className="flex justify-between items-center text-xs">
                  <span className="font-bold text-[#475569]">Max Tank Capacity:</span>
                  <span className="font-extrabold text-indigo-700 font-mono">45,000 L</span>
                </div>
                <div className="flex justify-between items-center text-xs">
                  <span className="font-bold text-[#475569]">Previous Fuel Level:</span>
                  <span className="font-mono text-slate-700 font-bold">{selectedTank.currentLevel.toLocaleString()} L</span>
                </div>
              </div>

              <div className="space-y-1.5">
                <label htmlFor="fuel-level-input" className="block text-xs font-black text-slate-700 uppercase tracking-wider">
                  Enter Actual Fuel Level Volume (Liters)
                </label>
                <div className="relative">
                  <input
                    id="fuel-level-input"
                    type="number"
                    step="any"
                    min="0"
                    max="45000"
                    value={inputValue}
                    onChange={(e) => {
                      setInputValue(e.target.value);
                      if (validationError) setValidationError(null);
                    }}
                    className="w-full bg-slate-50 border border-slate-200 rounded-lg px-4 py-2.5 text-sm font-semibold text-slate-800 font-mono focus:bg-white focus:outline-hidden focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 transition-all placeholder:text-slate-400"
                    placeholder="e.g. 15000"
                    required
                    disabled={isSaving}
                  />
                  <span className="absolute right-3.5 top-1/2 -translate-y-1/2 text-xs font-bold text-slate-400 font-mono">L</span>
                </div>
                <p className="text-[10px] text-slate-400 font-medium">
                  Specify physical automatic tank gauge (ATG) or custom dipstick calibration telemetry readings.
                </p>
              </div>

              {validationError && (
                <div className="bg-red-50 border-l-4 border-red-500 text-red-900 p-3 rounded-r-lg text-xs font-bold font-sans flex items-start gap-2">
                  <AlertTriangle className="text-red-600 shrink-0 mt-0.5" size={14} />
                  <span>{validationError}</span>
                </div>
              )}

              {/* Modal Footer Controls */}
              <div className="flex items-center gap-3 pt-3 border-t border-slate-100">
                <button
                  type="button"
                  onClick={() => setSelectedTankId(null)}
                  disabled={isSaving}
                  className="flex-1 text-xs font-bold text-slate-600 bg-slate-100 hover:bg-slate-200 py-2.5 px-4 rounded-lg transition-colors duration-200"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={isSaving || session.role === 'VIEWER'}
                  className="flex-1 text-xs font-black text-white bg-indigo-600 hover:bg-indigo-700 py-2.5 px-4 rounded-lg shadow-sm transition-all duration-200 flex items-center justify-center gap-1.5 disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  {isSaving ? (
                    <>
                      <RotateCw className="animate-spin" size={12} />
                      <span>Saving Sync...</span>
                    </>
                  ) : (
                    <span>Save Changes</span>
                  )}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Floating success toast notifier */}
      {successNotif && (
        <div className="fixed bottom-6 right-6 bg-slate-900 text-white rounded-lg px-4 py-3 shadow-lg border border-slate-800 z-50 flex items-center gap-2.5 text-xs font-semibold animate-bounce-subtle">
          <svg className="w-4 h-4 text-emerald-400 shrink-0" fill="none" stroke="currentColor" strokeWidth="3" viewBox="0 0 24 24">
            <polyline points="20 6 9 17 4 12" />
          </svg>
          <span>{successNotif}</span>
        </div>
      )}
    </div>
  );
};
