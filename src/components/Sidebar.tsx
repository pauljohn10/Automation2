/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState } from 'react';
import { useFuelSystem } from '../context';
import { 
  Building2, 
  Database, 
  MapPin, 
  Activity, 
  Gauge, 
  FileText, 
  Sparkles, 
  ShieldAlert, 
  Coins, 
  Wrench,
  ToggleLeft,
  LogOut,
  Users,
  ChevronLeft,
  ChevronRight
} from 'lucide-react';

interface SidebarProps {
  currentTab: string;
  setCurrentTab: (tab: string) => void;
}

export const Sidebar: React.FC<SidebarProps> = ({ currentTab, setCurrentTab }) => {
  const { session, activeStation, setSession } = useFuelSystem();
  const [isSidebarCollapsed, setIsSidebarCollapsed] = useState(false);

  const isHQ = (session.role === 'SUPER_ADMIN' || session.role === 'ADMIN' || session.role === 'VIEWER') && !session.isStationContext;

  // Choose branding text and subtext based on current role context
  const mainBranding = isHQ ? 'SAAS ERP' : (activeStation?.name.split('-')[0].trim() || 'STATION');
  const subBranding = isHQ ? 'CENTRAL HQ' : (activeStation?.name.split('-')[1]?.trim() || 'SUPERVISOR');

  const handleLogout = () => {
    setSession({
      ...session,
      isLoggedIn: false
    });
  };

  return (
    <aside className={`relative ${isSidebarCollapsed ? 'w-20' : 'w-64'} bg-white border-r border-[#e2e8f3] flex flex-col h-screen select-none font-sans justify-between transition-all duration-300 z-20`}>
      {/* Floating Neatly Styled Collapse Button */}
      <button
        onClick={() => setIsSidebarCollapsed(!isSidebarCollapsed)}
        className="absolute top-5 -right-3 z-30 w-6 h-6 rounded-full border border-[#e2e8f3] bg-white text-slate-500 hover:text-[#6c5dd3] hover:bg-slate-50 flex items-center justify-center shadow-xs transition-all duration-305 focus:outline-none cursor-pointer"
        title={isSidebarCollapsed ? "Expand Sidebar" : "Collapse Sidebar"}
      >
        {isSidebarCollapsed ? (
          <ChevronRight size={13} className="text-slate-600" />
        ) : (
          <ChevronLeft size={13} className="text-slate-600" />
        )}
      </button>

      {/* Upper Compartment */}
      <div className="flex flex-col">
        {/* Branding Logo Block */}
        <div className={`p-5 border-b border-[#e2e8f3] flex items-center gap-3 ${isSidebarCollapsed ? 'justify-center p-4' : ''}`}>
          <div className="w-9 h-9 rounded-lg bg-linear-to-tr from-[#6c5dd3] to-[#8c7dfc] flex items-center justify-center text-white font-extrabold text-lg shadow-sm shrink-0">
            F
          </div>
          {!isSidebarCollapsed && (
            <div className="animate-fade-in truncate">
              <div className="text-sm font-black text-[#1a202c] tracking-tight leading-none uppercase truncate">
                {mainBranding}
              </div>
              <div className="text-[10px] font-bold text-[#808eb2] tracking-wider uppercase mt-1 truncate">
                {subBranding}
              </div>
            </div>
          )}
        </div>

        {/* User Card Replica from screenshot */}
        <div className={`p-4 mx-3 my-4 bg-linear-to-b from-[#f8fafc] to-[#f1f5f9] rounded-xl border border-[#e2e8f0] shadow-2xs ${isSidebarCollapsed ? 'p-2 mx-2 flex justify-center' : ''}`}>
          <div className="flex items-center gap-3 justify-center w-full">
            <div className="w-9 h-9 rounded-lg bg-[#6c5dd3] flex items-center justify-center text-white font-black text-sm shrink-0">
              {session.name[0] || 'U'}
            </div>
            {!isSidebarCollapsed && (
              <div className="flex-1 min-w-0 animate-fade-in">
                <div className="text-xs font-bold text-[#2d3748] truncate">
                  {session.name}
                </div>
                <span className="inline-block text-[9px] font-black tracking-widest text-[#6c5dd3] bg-[#eeebfe] px-1.5 py-0.5 rounded uppercase mt-0.5 truncate">
                  {session.role === 'SUPER_ADMIN' 
                    ? 'SUPER ADMIN' 
                    : session.role === 'ADMIN' 
                    ? 'HQ ADMIN' 
                    : session.role === 'VIEWER' 
                    ? 'VIEWER (READ-ONLY)' 
                    : session.role === 'OPERATOR'
                    ? 'STATION OPERATOR'
                    : 'STATION SUPERVISOR'}
                </span>
              </div>
            )}
          </div>
        </div>

        {/* Dynamic Navigation Menu Items */}
        <div className="px-3 py-1 space-y-1">
          {!isSidebarCollapsed ? (
            <div className="text-[10px] font-black text-[#a0aec0] tracking-widest uppercase px-3 mb-2">
              {isHQ ? 'Enterprise Management' : 'Station Telemetry'}
            </div>
          ) : (
            <div className="border-t border-[#e2e8f3] my-2" />
          )}

          {isHQ ? (
            /* Super Admin View Tabs */
            <>
              <button
                onClick={() => setCurrentTab('stations_directory')}
                className={`w-full flex items-center gap-3 px-3 py-2 text-xs font-semibold rounded-lg transition-all ${
                  isSidebarCollapsed ? 'justify-center py-2.5' : ''
                } ${
                  currentTab === 'stations_directory'
                    ? 'bg-[#efecfe] text-[#6c5dd3]'
                    : 'text-[#4a5568] hover:bg-[#f7fafc]'
                }`}
                title={isSidebarCollapsed ? "Stations Directory" : undefined}
              >
                <Building2 size={16} className="shrink-0" />
                {!isSidebarCollapsed && <span className="animate-fade-in">Stations Directory</span>}
              </button>

              <button
                onClick={() => setCurrentTab('integrated_metrics')}
                className={`w-full flex items-center gap-3 px-3 py-2 text-xs font-semibold rounded-lg transition-all ${
                  isSidebarCollapsed ? 'justify-center py-2.5' : ''
                } ${
                  currentTab === 'integrated_metrics'
                    ? 'bg-[#efecfe] text-[#6c5dd3]'
                    : 'text-[#4a5568] hover:bg-[#f7fafc]'
                }`}
                title={isSidebarCollapsed ? "Integrated Performance" : undefined}
              >
                <Activity size={16} className="shrink-0" />
                {!isSidebarCollapsed && <span className="animate-fade-in">Integrated Performance</span>}
              </button>

              {(session.role === 'SUPER_ADMIN' || session.role === 'ADMIN' || session.role === 'VIEWER') && (
                <>
                  <button
                    onClick={() => setCurrentTab('global_audit_trail')}
                    className={`w-full flex items-center gap-3 px-3 py-2 text-xs font-semibold rounded-lg transition-all ${
                      isSidebarCollapsed ? 'justify-center py-2.5' : ''
                    } ${
                      currentTab === 'global_audit_trail'
                        ? 'bg-[#efecfe] text-[#6c5dd3]'
                        : 'text-[#4a5568] hover:bg-[#f7fafc]'
                    }`}
                    title={isSidebarCollapsed ? "Global Audit Logs" : undefined}
                  >
                    <FileText size={16} className="shrink-0" />
                    {!isSidebarCollapsed && <span className="animate-fade-in">Global Audit Logs</span>}
                  </button>

                  <button
                    onClick={() => setCurrentTab('user_management')}
                    className={`w-full flex items-center gap-3 px-3 py-2 text-xs font-semibold rounded-lg transition-all ${
                      isSidebarCollapsed ? 'justify-center py-2.5' : ''
                    } ${
                      currentTab === 'user_management'
                        ? 'bg-[#efecfe] text-[#6c5dd3]'
                        : 'text-[#4a5568] hover:bg-[#f7fafc]'
                    }`}
                    title={isSidebarCollapsed ? "User Access Portal" : undefined}
                  >
                    <Users size={16} className="shrink-0" />
                    {!isSidebarCollapsed && <span className="animate-fade-in">User Access Portal</span>}
                  </button>
                </>
              )}
            </>
          ) : (
            /* Station Operator Tabs */
            <>
              <button
                onClick={() => setCurrentTab('tank_monitor')}
                className={`w-full flex items-center gap-3 px-3 py-2 text-xs font-semibold rounded-lg transition-all ${
                  isSidebarCollapsed ? 'justify-center py-2.5' : ''
                } ${
                  currentTab === 'tank_monitor'
                    ? 'bg-[#efecfe] text-[#6c5dd3]'
                    : 'text-[#4a5568] hover:bg-[#f7fafc]'
                }`}
                title={isSidebarCollapsed ? "Tank Monitor" : undefined}
              >
                <Gauge size={16} className="shrink-0" />
                {!isSidebarCollapsed && <span className="animate-fade-in">Tank Monitor</span>}
              </button>

              <button
                onClick={() => setCurrentTab('pump_monitor')}
                className={`w-full flex items-center gap-3 px-3 py-2 text-xs font-semibold rounded-lg transition-all ${
                  isSidebarCollapsed ? 'justify-center py-2.5' : ''
                } ${
                  currentTab === 'pump_monitor'
                    ? 'bg-[#efecfe] text-[#6c5dd3]'
                    : 'text-[#4a5568] hover:bg-[#f7fafc]'
                }`}
                title={isSidebarCollapsed ? "Pump Monitor" : undefined}
              >
                <Activity size={16} className="shrink-0" />
                {!isSidebarCollapsed && <span className="animate-fade-in">Pump Monitor</span>}
              </button>

              <button
                onClick={() => setCurrentTab('tank_reporting')}
                className={`w-full flex items-center gap-3 px-3 py-2 text-xs font-semibold rounded-lg transition-all ${
                  isSidebarCollapsed ? 'justify-center py-2.5' : ''
                } ${
                  currentTab === 'tank_reporting'
                    ? 'bg-[#efecfe] text-[#6c5dd3]'
                    : 'text-[#4a5568] hover:bg-[#f7fafc]'
                }`}
                title={isSidebarCollapsed ? "Tank Reporting Logs" : undefined}
              >
                <FileText size={16} className="shrink-0" />
                {!isSidebarCollapsed && <span className="animate-fade-in">Tank Reporting Logs</span>}
              </button>

              <button
                onClick={() => setCurrentTab('show_prices')}
                className={`w-full flex items-center gap-3 px-3 py-2 text-xs font-semibold rounded-lg transition-all ${
                  isSidebarCollapsed ? 'justify-center py-2.5' : ''
                } ${
                  currentTab === 'show_prices'
                    ? 'bg-[#efecfe] text-[#6c5dd3]'
                    : 'text-[#4a5568] hover:bg-[#f7fafc]'
                }`}
                title={isSidebarCollapsed ? "Show Prices Index" : undefined}
              >
                <Coins size={16} className="shrink-0" />
                {!isSidebarCollapsed && <span className="animate-fade-in">Show Prices Index</span>}
              </button>

              {session.role !== 'OPERATOR' && session.role !== 'VIEWER' && (
                <button
                  onClick={() => setCurrentTab('admin_override')}
                  className={`w-full flex items-center gap-3 px-3 py-2 text-xs font-semibold rounded-lg transition-all ${
                    isSidebarCollapsed ? 'justify-center py-2.5' : ''
                  } ${
                    currentTab === 'admin_override'
                      ? 'bg-[#efecfe] text-[#6c5dd3]'
                      : 'text-[#4a5568] hover:bg-[#f7fafc]'
                  }`}
                  title={isSidebarCollapsed ? "Admin Override Tools" : undefined}
                >
                  <Wrench size={16} className="shrink-0" />
                  {!isSidebarCollapsed && <span className="animate-fade-in">Admin Override Tools</span>}
                </button>
              )}
            </>
          )}
        </div>
      </div>

      {/* Lower Compartment with Reset Mechanism */}
      <div className={`p-4 border-t border-[#e2e8f3] bg-[#f8fafc] ${isSidebarCollapsed ? 'p-2 flex flex-col items-center gap-2' : 'space-y-3'}`}>
        {!isSidebarCollapsed ? (
          <div className="bg-amber-50 rounded-lg p-2.5 border border-amber-200 text-left">
            <div className="text-[10px] font-bold text-amber-800 uppercase flex items-center gap-1.5 leading-none">
              <Sparkles size={11} className="text-amber-600 animate-spin-slow" />
              Active Simulation Desk
            </div>
            <p className="text-[9px] text-[#4a5568] mt-1 font-medium leading-relaxed">
              Pumping fuel, adding fuel loads, or changing prices instantly calculates and renders ERP audit steps & volumes.
            </p>
          </div>
        ) : (
          <div 
            className="w-10 h-10 rounded-lg bg-amber-50 border border-amber-200 flex items-center justify-center text-amber-605 shrink-0"
            title="Active Simulation Desk"
          >
            <Sparkles size={14} className="text-amber-600 animate-spin-slow" />
          </div>
        )}

        <button
          onClick={handleLogout}
          className={`w-full bg-[#fee2e2] hover:bg-[#fecaca] text-[#991b1b] rounded-lg text-xs font-bold transition-all flex items-center justify-center border border-[#fca5a5] ${
            isSidebarCollapsed ? 'h-10 w-10 p-0' : 'p-2 gap-2'
          }`}
          title={isSidebarCollapsed ? "Exit Operational session" : undefined}
        >
          <LogOut size={13} className="shrink-0" />
          {!isSidebarCollapsed && <span>Exit Operational session</span>}
        </button>
      </div>
    </aside>
  );
};
