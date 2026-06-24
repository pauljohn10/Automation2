/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState } from 'react';
import { useFuelSystem } from '../context';
import { Search, ShieldAlert, Cpu, Calendar, AlertOctagon } from 'lucide-react';

export const AuditDashboard: React.FC = () => {
  const { auditLogs, stations, session } = useFuelSystem();

  // Protect view - only accessible to SUPER_ADMIN, ADMIN, or VIEWER
  const isHQUser = session.role === 'SUPER_ADMIN' || session.role === 'ADMIN' || session.role === 'VIEWER';
  if (!isHQUser) {
    return (
      <div className="p-8 text-center bg-slate-50 min-h-[calc(100vh-64px)] font-sans flex flex-col items-center justify-center text-left">
        <ShieldAlert size={48} className="text-red-500 mb-3" />
        <h3 className="text-sm font-black text-slate-800 uppercase tracking-wider">Access Denied</h3>
        <p className="text-xs text-slate-500 mt-1 max-w-md leading-relaxed">
          The requested audit log ledger is locked and reserved strictly for authorized Central HQ Workspace accounts.
        </p>
      </div>
    );
  }

  // Filter inputs
  const [searchVal, setSearchVal] = useState('');
  const [stationFilter, setStationFilter] = useState('ALL');

  // filter logs
  const filteredLogs = auditLogs.filter(log => {
    // Station scope match
    if (stationFilter !== 'ALL') {
      if (log.stationId !== stationFilter) return false;
    }

    // Search query match
    if (searchVal.trim() !== '') {
      const q = searchVal.toLowerCase();
      const matchAction = log.action.toLowerCase().includes(q);
      const matchDetails = log.details.toLowerCase().includes(q);
      const matchUser = log.user.toLowerCase().includes(q);
      const matchIp = log.ipAddress.toLowerCase().includes(q);

      if (!matchAction && !matchDetails && !matchUser && !matchIp) return false;
    }

    return true;
  });

  const getActionColor = (action: string) => {
    switch (action) {
      case 'PRICE_ADJUSTMENT': return 'bg-amber-100 text-amber-800 border border-amber-200';
      case 'STATION_CREATE': return 'bg-indigo-100 text-[#6c5dd3] border border-indigo-200';
      case 'FUEL_REPLENISHMENT': return 'bg-emerald-100 text-emerald-800 border border-emerald-250';
      case 'FUEL_DISPENSE': return 'bg-blue-100 text-blue-800 border border-blue-200';
      case 'TANK_WATER_RESET': return 'bg-red-100 text-red-800 border border-red-200 font-extrabold animate-pulse';
      default: return 'bg-slate-100 text-slate-700 border border-slate-200';
    }
  };

  return (
    <div className="p-6 space-y-6 bg-slate-50 min-h-[calc(100vh-64px)] font-sans text-left">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 bg-white p-5 rounded-xl border border-slate-200">
        <div>
          <h3 className="text-sm font-black text-slate-800 tracking-tight uppercase flex items-center gap-2">
            <Cpu size={18} className="text-[#6c5dd3]" strokeWidth={2.5} />
            Unified ERP Transactional & Security Audit trail
          </h3>
          <p className="text-xs text-slate-500 mt-1">
            Immutable log ledger capturing physical sensor resets, nozzle flows, pricing overrides, and database operations.
          </p>
        </div>
        <div className="flex items-center gap-1.5 text-xs text-slate-505 bg-slate-100 px-3 py-1 border border-slate-200 rounded-lg font-bold">
          <Calendar size={13} className="text-slate-400" />
          <span>REAL-TIME AUDITING</span>
        </div>
      </div>

      {/* SEARCH AND FILTER BAR */}
      <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-2xs flex flex-col md:flex-row gap-3 items-center justify-between text-xs">
        <div className="relative w-full md:max-w-md">
          <Search className="absolute left-3 top-3 text-slate-400" size={16} />
          <input
            type="text"
            placeholder="Search action logs, admin usernames, IP address, description details..."
            value={searchVal}
            onChange={(e) => setSearchVal(e.target.value)}
            className="w-full bg-slate-50 border border-slate-250 rounded-lg py-2.5 pl-10 pr-4 font-semibold text-slate-800 placeholder-slate-400 focus:outline-none"
          />
        </div>

        {/* Filter station dropdown */}
        <div className="flex items-center gap-2 w-full md:w-auto">
          <label className="font-bold text-slate-600 shrink-0">Filter Tenant:</label>
          <select
            value={stationFilter}
            onChange={(e) => setStationFilter(e.target.value)}
            className="w-full md:w-48 bg-white border border-slate-200 rounded-lg p-2.5 font-semibold text-slate-800 focus:outline-none"
          >
            <option value="ALL">All Stations / HQ</option>
            {stations.map(st => (
              <option key={st.id} value={st.id}>{st.name}</option>
            ))}
          </select>
        </div>
      </div>

      {/* AUDIT LOG TABLE LEDGER */}
      <div className="bg-white rounded-xl border border-slate-200 shadow-2xs overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse text-xs font-mono text-[#2d3748]">
            <thead>
              <tr className="bg-slate-100 border-b border-slate-250 text-slate-600 font-bold">
                <th className="p-3 w-32 border-r border-slate-200">Timestamp</th>
                <th className="p-3 w-44 border-r border-slate-200">Action Module</th>
                <th className="p-3 w-40 border-r border-slate-200">Authorized USR</th>
                <th className="p-3">Audit Log details / Sensor Response Payload</th>
                <th className="p-3 w-32 text-right">Node IP</th>
              </tr>
            </thead>
            <tbody>
              {filteredLogs.length === 0 ? (
                <tr>
                  <td colSpan={5} className="p-12 text-center text-slate-400 font-sans italic text-xs bg-slate-50">
                    No matching audit trail records discovered. Make a change to simulate new security trails.
                  </td>
                </tr>
              ) : (
                filteredLogs.map((log) => {
                  const associatedStation = stations.find(s => s.id === log.stationId);
                  
                  return (
                    <tr key={log.id} className="border-b border-slate-100 hover:bg-slate-50 transition-colors">
                      {/* TIMESTAMP */}
                      <td className="p-3 border-r border-slate-200 text-slate-500 whitespace-nowrap">
                        {log.timestamp}
                      </td>

                      {/* ACTION GRADE BADGE */}
                      <td className="p-3 border-r border-slate-200 whitespace-nowrap">
                        <span className={`inline-block text-[9px] font-black px-1.5 py-0.5 rounded tracking-wide ${getActionColor(log.action)}`}>
                          {log.action}
                        </span>
                      </td>

                      {/* ACTING OPERATOR */}
                      <td className="p-3 border-r border-slate-200">
                        <div className="font-bold text-slate-700 leading-tight">{log.user}</div>
                        <div className="text-[9px] font-semibold text-slate-400 mt-0.5">{log.role}</div>
                      </td>

                      {/* REAL BODY DETAILS */}
                      <td className="p-3 text-[#4a5568] leading-relaxed">
                        {associatedStation && (
                          <span className="inline-block text-[9px] bg-indigo-50/80 text-[#6c5dd3] font-black px-1 py-0.2 rounded mr-1.5 border border-indigo-100">
                            {associatedStation.name.split('-')[0].trim()}
                          </span>
                        )}
                        <span className="font-semibold">{log.details}</span>
                      </td>

                      {/* PHYSICAL LOGICAL COMM IP ADDRESS */}
                      <td className="p-3 text-right text-slate-400 whitespace-nowrap">
                        {log.ipAddress}
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
};
