/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useEffect } from 'react';
import { useFuelSystem } from '../context';
import { Database, ShieldAlert, Cpu, Layers } from 'lucide-react';

interface TopbarProps {
  currentTab: string;
}

export const Topbar: React.FC<TopbarProps> = ({ currentTab }) => {
  const { session, setSession, stations } = useFuelSystem();
  const [timeStr, setTimeStr] = useState('');

  const origRole = session.originalRole || session.role;
  const userRole = origRole;
  const isHQUser = userRole === 'SUPER_ADMIN' || userRole === 'ADMIN';

  useEffect(() => {
    // Exact format clock e.g. "6/10/2026 | 2:16:25 PM"
    const timer = setInterval(() => {
      const now = new Date();
      // Force date of 2026-06-10 to match system time or use current date
      const datePart = `${now.getMonth() + 1}/${now.getDate()}/${now.getFullYear()}`;
      const timePart = now.toLocaleTimeString('en-US', { hour12: true });
      setTimeStr(`${datePart}  |  ${timePart}`);
    }, 1000);

    return () => clearInterval(timer);
  }, []);

  const handleRoleChange = (e: React.ChangeEvent<HTMLSelectElement>) => {
    const val = e.target.value;
    if (val === 'SUPER_ADMIN' || val === 'ADMIN') {
      // Switch back to master corporate HQ workspace
      setSession({
        role: val as any,
        name: session.name,
        activeStationId: session.activeStationId || (stations[0]?.id || 'st-01'),
        isLoggedIn: true,
        originalRole: val as any
      });
    } else if (val.startsWith('STATION_')) {
      const targetStationId = val.replace('STATION_', '');
      const selectedStation = stations.find(s => s.id === targetStationId);
      if (selectedStation) {
        // HQ admins map to local STATION_ADMIN context, viewers map to VIEWERS on that station
        const targetRole = isHQUser ? 'STATION_ADMIN' : 'VIEWER';
        setSession({
          role: targetRole,
          name: isHQUser ? (selectedStation.manager || 'Station Admin') : session.name,
          activeStationId: selectedStation.id,
          isLoggedIn: true,
          originalRole: origRole
        });
      }
    }
  };

  const handleStationChangeInHeader = (e: React.ChangeEvent<HTMLSelectElement>) => {
    setSession({
      ...session,
      activeStationId: e.target.value
    });
  };

  return (
    <header className="h-16 bg-[#f1f3f9] border-b border-[#e2e8f3] px-6 flex items-center justify-between font-sans">
      {/* Tab/Location Label */}
      <div className="flex items-center gap-3">
        <span className="text-xs tracking-wider uppercase font-semibold text-[#5c6883] px-2.5 py-1 bg-white rounded shadow-sm border border-[#e2e8f1]">
          {currentTab.replace('_', ' ')}
        </span>
        
        {/* If Station Admin / Operator, show current isolated view station */}
        {session.role !== 'SUPER_ADMIN' && session.role !== 'ADMIN' && (
          <div className="flex items-center gap-1 text-xs text-[#718096]">
            <Layers size={14} className="text-[#6c5dd3]" />
            <span>Station context:</span>
            <span className="font-bold text-[#2d3748]">
              {stations.find(s => s.id === session.activeStationId)?.name || 'Unknown'}
            </span>
          </div>
        )}
      </div>

      {/* Clock, Status & Multi-Tenant Context Controls */}
      <div className="flex items-center gap-6">
        {/* Device Clock System & DB status indicator */}
        <div className="hidden md:flex items-center gap-3 bg-white px-4 py-1.5 rounded-lg border border-[#e2e8f1] shadow-xs text-xs font-mono">
          <span className="text-[#3a3b45] font-semibold tracking-wide">
            {timeStr || '6/10/2026 | 11:16:42 AM'}
          </span>
          <span className="w-1.5 h-1.5 bg-[#48bb78] rounded-full animate-pulse"></span>
          <span className="text-[10px] text-[#48bb78] font-bold uppercase tracking-wider flex items-center gap-1">
            <Database size={10} /> DATABASE LIVE
          </span>
        </div>

        {/* Quick Simulator / Tenant context tester */}
        {(userRole === 'SUPER_ADMIN' || userRole === 'ADMIN' || userRole === 'VIEWER') && (
          <div className="flex items-center gap-2 bg-[#eaedf5] p-1 rounded-lg border border-[#d2d9eb]">
            <div className="text-[10px] uppercase tracking-wider font-bold text-[#5c6a85] px-2">
              Role Gateway:
            </div>
            <select 
              value={session.role === 'SUPER_ADMIN' || session.role === 'ADMIN' ? session.role : `STATION_${session.activeStationId}`}
              onChange={handleRoleChange}
              className="text-xs bg-white border border-[#c3cce2] rounded px-2 py-1 font-medium text-[#2d3748] focus:outline-none focus:ring-1 focus:ring-[#6c5dd3]"
            >
              {origRole === 'SUPER_ADMIN' && (
                <option value="SUPER_ADMIN">HQ Super Admin (Access All)</option>
              )}
              {origRole === 'ADMIN' && (
                <option value="ADMIN">HQ Corporate Admin (Access All)</option>
              )}
              {stations.map(st => (
                <option key={st.id} value={`STATION_${st.id}`}>
                  {st.manager || 'Station Admin'} ({st.name})
                </option>
              ))}
            </select>

            {/* Quick active station switcher (HQ view context) */}
            {(session.role === 'SUPER_ADMIN' || session.role === 'ADMIN') && (
              <div className="flex items-center gap-1 pl-1 border-l border-[#cbd5e1]">
                <select
                  value={session.activeStationId}
                  onChange={handleStationChangeInHeader}
                  className="text-xs bg-[#e2e8f0] border border-[#cbd5e0] rounded px-2 py-1 font-bold text-[#4a5568] focus:outline-none"
                >
                  {stations.map(st => (
                    <option key={st.id} value={st.id}>🌎 {st.name}</option>
                  ))}
                </select>
              </div>
            )}
          </div>
        )}

        {/* User profile card */}
        <div className="flex items-center gap-3">
          <div className="text-right">
            <div className="text-xs font-bold text-[#2d3748]">{session.name}</div>
            <div className="text-[10px] font-semibold text-[#6c5dd3] tracking-wider uppercase">
              {session.role === 'SUPER_ADMIN' 
                ? 'SUPER ADMIN' 
                : session.role === 'ADMIN' 
                ? 'HQ ADMIN' 
                : session.role === 'VIEWER' 
                ? 'VIEWER (READ-ONLY)' 
                : 'STATION ADMIN'}
            </div>
          </div>
          <div className="w-9 h-9 rounded-full bg-[#6c5dd3] border-2 border-white flex items-center justify-center text-white text-xs font-bold shadow-md">
            {session.name.split(' ').map(n => n[0]).join('')}
          </div>
        </div>
      </div>
    </header>
  );
};
