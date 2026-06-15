/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState } from 'react';
import { useFuelSystem } from '../context';
import { FuelStation } from '../types';
import { ShieldCheck, MapPin, Key, User, Building, HelpCircle, Lock, Server, Sparkles } from 'lucide-react';
import { getSupabaseClient } from '../supabaseClient';

export const LoginScreen: React.FC = () => {
  const { stations, setSession, addCustomAuditLog } = useFuelSystem();
  
  const [loginMode, setLoginMode] = useState<'station' | 'corporate'>('station');
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [errorMsg, setErrorMsg] = useState('');
  const [showHelper, setShowHelper] = useState(true);
  const [isSubmitting, setIsSubmitting] = useState(false);

  // Submit handler supporting dual gateway entry
  const handleLoginSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMsg('');

    const cleanUser = username.trim();
    const cleanPass = password.trim();

    if (!cleanUser || !cleanPass) {
      setErrorMsg(
        loginMode === 'corporate' 
          ? 'Please enter both your corporate email and secure password.' 
          : 'Please enter both your supervisor username and security passphrase.'
      );
      return;
    }

    // A. CENTRAL HQ WORKSPACE GATEWAY MODE (Supabase Auth integration)
    if (loginMode === 'corporate') {
      setIsSubmitting(true);
      try {
        const client = getSupabaseClient();
        
        // 1. Authenticate with Supabase Auth using email and password
        const { data, error } = await client.auth.signInWithPassword({
          email: cleanUser,
          password: cleanPass
        });

        if (error) {
          setErrorMsg(`HQ Authentication Denied: ${error.message}`);
          setIsSubmitting(false);
          return;
        }

        if (data?.user) {
          const userId = data.user.id;
          const userEmail = data.user.email || cleanUser;

          // 2. Lookup role from user_profiles table immediately after successful auth session
          const { data: profile, error: profileErr } = await client
            .from('user_profiles')
            .select('role')
            .eq('id', userId)
            .maybeSingle();

          if (profile && !profileErr) {
            const role = profile.role; // 'SUPER_ADMIN' | 'ADMIN' | 'VIEWER'
            const defaultStationId = stations[0]?.id || 'st-01';

            setSession({
              role: role as any,
              name: userEmail,
              activeStationId: defaultStationId,
              isLoggedIn: true,
              originalRole: role as any
            });

            addCustomAuditLog(
              'HQ_AUTH_SUCCESS',
              `Authorized dynamic corporate session established for user "${userEmail}" with access role "${role}".`,
              defaultStationId
            );
            setIsSubmitting(false);
            return;
          } else {
            // "If the account does not exist in user_profiles but belongs to a station cluster -> Fallback cleanly to the standard individual Fuel Station Operator / Supervisor Command dashboard."
            const { data: onboardedUser } = await client
              .from('onboarded_users')
              .select('*')
              .eq('id', userId)
              .maybeSingle();

            if (onboardedUser) {
              setSession({
                role: 'STATION_ADMIN',
                name: onboardedUser.full_name || userEmail,
                activeStationId: onboardedUser.station_id || stations[0]?.id || 'st-01',
                isLoggedIn: true,
                originalRole: 'STATION_ADMIN'
              });

              addCustomAuditLog(
                'STATION_AUTH_SUCCESS',
                `Redirecting user "${userEmail}" dynamically to unified Fuel Station Operator dashboard context.`,
                onboardedUser.station_id
              );
              setIsSubmitting(false);
              return;
            } else {
              // No user profile nor onboarded_user record exists. Assign default corporate ADMIN or report problem
              const defaultStationId = stations[0]?.id || 'st-01';
              setSession({
                role: 'STATION_ADMIN',
                name: userEmail,
                activeStationId: defaultStationId,
                isLoggedIn: true,
                originalRole: 'STATION_ADMIN'
              });
              addCustomAuditLog(
                'AUTH_FALLBACK',
                `Redirecting user "${userEmail}" to default Station Operator dashboard (No profile record matches associated tenant UID).`,
                defaultStationId
              );
              setIsSubmitting(false);
              return;
            }
          }
        }
      } catch (err: any) {
        setErrorMsg(`Administrative workspace gateway error: ${err.message || String(err)}`);
      } finally {
        setIsSubmitting(false);
      }
      return;
    }

    // B. STANDARD LOCAL STATION OPERATOR GATEWAY MODE
    const lowerUser = cleanUser.toLowerCase();

    // 1. Check HQ Super Admin (Legacy local credential bypass)
    if (lowerUser === 'admin' && cleanPass === 'password123') {
      const defaultStationId = stations[0]?.id || 'st-01';
      setSession({
        role: 'SUPER_ADMIN',
        name: 'HQ Super Admin',
        activeStationId: defaultStationId,
        isLoggedIn: true,
        originalRole: 'SUPER_ADMIN'
      });
      addCustomAuditLog('SUPER_ADMIN_LOGIN', 'HQ super admin logged in from security terminal.', defaultStationId);
      return;
    }

    // 2. Check Custom Station supervisor credentials
    const matchedStationByCustomCreds = stations.find(
      st => st.username && st.username.trim().toLowerCase() === lowerUser && st.password === cleanPass
    );

    if (matchedStationByCustomCreds) {
      setSession({
        role: 'STATION_ADMIN',
        name: matchedStationByCustomCreds.manager || `${matchedStationByCustomCreds.name} Supervisor`,
        activeStationId: matchedStationByCustomCreds.id,
        isLoggedIn: true,
        originalRole: 'STATION_ADMIN'
      });
      addCustomAuditLog(
        'SUPERVISOR_LOGIN', 
        `Supervisor "${matchedStationByCustomCreds.manager}" successfully authenticated via station supervisor account.`, 
        matchedStationByCustomCreds.id
      );
      return;
    }

    // No credentials matched
    setErrorMsg('System Access Denied. The supervisor username or password entered is invalid. Please verify and try again.');
  };

  return (
    <div className="min-h-screen w-screen flex flex-col md:flex-row bg-[#0f172a] font-sans selection:bg-[#6c5dd3] selection:text-white overflow-y-auto text-left">
      {/* Visual background banner deck */}
      <div className="w-full md:w-5/12 bg-linear-to-b from-[#1e1b4b] to-[#0f172a] text-white p-8 md:p-12 flex flex-col justify-between border-b md:border-b-0 md:border-r border-[#1e293b] min-h-[300px] md:min-h-0">
        <div className="space-y-4">
          <div className="flex items-center gap-2.5">
            <div className="w-9 h-9 rounded-lg bg-[#6c5dd3] flex items-center justify-center shadow-lg shadow-[#6c5dd3]/30">
              <Server size={18} className="text-white" />
            </div>
            <div>
              <h1 className="text-sm font-black uppercase tracking-wider text-slate-100">Antigravity Fuel Sys</h1>
              <p className="text-[10px] text-slate-400 uppercase tracking-widest font-mono">Enterprise ERP Suite</p>
            </div>
          </div>

          <div className="pt-8 w-full">
            <h2 className="text-2xl font-bold tracking-tight leading-tight text-white block">
              Multi-Station Fuel Management & Smart Dispatches
            </h2>
            <p className="text-xs text-slate-400 mt-2.5 leading-relaxed">
              Unlock absolute control over fuel distribution, intelligent ATG level calibrations, and live dispenser node monitoring across all your network stations.
            </p>
          </div>
        </div>

        <div className="space-y-3 pt-6 md:pt-0">
          <div className="flex items-center gap-3 bg-white/5 border border-white/10 p-3 rounded-lg text-xs leading-normal font-mono text-indigo-200">
            <ShieldCheck size={16} className="text-indigo-400 shrink-0" />
            <span>Strict data isolation tenant security active. Cross-tenant queries are blocked.</span>
          </div>

          <div className="text-[10px] text-slate-500 font-mono flex items-center justify-between">
            <span>SaaS Core Node: v4.2.0-STABLE</span>
            <span>Riyadh HQ Server</span>
          </div>
        </div>
      </div>

      {/* Login Form Panel */}
      <div className="flex-1 flex items-center justify-center p-6 md:p-12 bg-[#0b0f19]">
        <div className="max-w-md w-full space-y-6">
          <div className="text-left">
            <h3 className="text-lg font-black text-white tracking-tight uppercase">
              {loginMode === 'corporate' ? 'Central HQ Workspace' : 'Login to Supervisor Command'}
            </h3>
            <p className="text-xs text-slate-400 mt-1">
              {loginMode === 'corporate' 
                ? 'Authentication gateway for Corporate HQ Admins, Supervisors, and read-only Viewers.' 
                : 'Enter your designated retail station supervisor or HQ administrator gateway passphrase.'}
            </p>
          </div>

          {/* Dual-Gateway Mode Selector Tab Panel */}
          <div className="grid grid-cols-2 p-1.5 bg-[#131a2c] rounded-xl border border-[#242f4c]">
            <button
              type="button"
              onClick={() => {
                setLoginMode('station');
                setErrorMsg('');
              }}
              className={`py-2 text-xs font-black uppercase rounded-lg tracking-wider transition-all flex items-center justify-center gap-1.5 ${
                loginMode === 'station'
                  ? 'bg-[#6c5dd3] text-white shadow-md'
                  : 'text-slate-400 hover:text-white'
              }`}
            >
              <span>Station Operator</span>
            </button>
            <button
              type="button"
              onClick={() => {
                setLoginMode('corporate');
                setErrorMsg('');
              }}
              className={`py-2 text-xs font-black uppercase rounded-lg tracking-wider transition-all flex items-center justify-center gap-1.5 ${
                loginMode === 'corporate'
                  ? 'bg-[#6c5dd3] text-white shadow-md'
                  : 'text-slate-400 hover:text-white'
              }`}
            >
              <Sparkles size={11} className={loginMode === 'corporate' ? 'text-amber-300 animate-pulse' : ''} />
              <span>Central HQ Workspace</span>
            </button>
          </div>

          {errorMsg && (
            <div className="bg-red-500/10 border border-red-500/30 rounded-xl p-3.5 text-xs text-red-400 font-bold flex items-center gap-3">
              <Lock size={16} className="shrink-0" />
              <span>{errorMsg}</span>
            </div>
          )}

          <form onSubmit={handleLoginSubmit} className="space-y-4">
            <div className="space-y-1.5">
              <label className="text-xs font-bold text-slate-300 block">
                {loginMode === 'corporate' ? 'Corporate Email Address' : 'Supervisor Username / Email'}
              </label>
              <div className="relative">
                <span className="absolute inset-y-0 left-0 flex items-center pl-3 text-slate-500">
                  <User size={15} />
                </span>
                <input
                  type={loginMode === 'corporate' ? 'email' : 'text'}
                  placeholder={loginMode === 'corporate' ? 'operator@centralhq.com' : 'e.g. supervisor_username'}
                  value={username}
                  onChange={(e) => setUsername(e.target.value)}
                  className="w-full bg-[#131a2c] text-white border border-[#242f4c] rounded-lg py-2.5 pl-9 pr-3 text-xs font-medium focus:outline-none focus:ring-1 focus:ring-[#6c5dd3]"
                  required
                  disabled={isSubmitting}
                />
              </div>
            </div>

            <div className="space-y-1.5">
              <label className="text-xs font-bold text-slate-300 block">
                {loginMode === 'corporate' ? 'Security Password' : 'Security Passphrase'}
              </label>
              <div className="relative">
                <span className="absolute inset-y-0 left-0 flex items-center pl-3 text-slate-500">
                  <Key size={15} />
                </span>
                <input
                  type="password"
                  placeholder="••••••••"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  className="w-full bg-[#131a2c] text-white border border-[#242f4c] rounded-lg py-2.5 pl-9 pr-3 text-xs font-medium focus:outline-none focus:ring-1 focus:ring-[#6c5dd3]"
                  required
                  disabled={isSubmitting}
                />
              </div>
            </div>

            <button
              type="submit"
              disabled={isSubmitting}
              className="w-full bg-[#6c5dd3] hover:bg-[#5c4eb3] text-white py-2.5 rounded-lg text-xs font-bold transition-all shadow-md shadow-[#6c5dd3]/20 disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2 uppercase tracking-wider"
            >
              {isSubmitting ? (
                <>
                  <span className="w-3.5 h-3.5 rounded-full border-2 border-white border-t-transparent animate-spin"></span>
                  <span>Verifying Credentials...</span>
                </>
              ) : (
                <span>Sign In to command console</span>
              )}
            </button>
          </form>

          {/* Quick Access Credentials helper block */}
          {showHelper && (
            <div className="bg-slate-900/80 border border-slate-800 rounded-xl p-4 space-y-3">
              <div className="flex items-center justify-between">
                <span className="text-[10px] uppercase font-bold text-slate-300 tracking-wider flex items-center gap-1.5">
                  <HelpCircle size={13} className="text-indigo-400" />
                  Available Gateway Accounts
                </span>
                <button 
                  onClick={() => setShowHelper(false)} 
                  className="text-[10px] text-slate-500 hover:text-slate-300"
                >
                  Hide helper
                </button>
              </div>

              <div className="space-y-2 text-[11px] text-slate-400">
                <div className="bg-[#101423] p-2 border border-indigo-950/50 rounded flex items-center justify-between">
                  <div>
                    <span className="font-bold text-slate-200">HQ Super Admin (Local Bypass)</span>
                    <p className="text-[9px] text-[#805ad5] uppercase font-mono tracking-widest mt-0.5">Unified Local control</p>
                  </div>
                  <div className="text-right font-mono text-[10px]">
                    <div>User: <span className="bg-slate-800 text-white px-1 rounded">admin</span></div>
                    <div className="mt-0.5">Pass: <span className="bg-slate-800 text-emerald-300 px-1 rounded">password123</span></div>
                  </div>
                </div>

                <div className="space-y-1.5">
                  <span className="text-[9px] uppercase font-black text-slate-500 block">Station Supervisors:</span>
                  
                  {stations.map(st => {
                    const fallbackUser = `${st.code.toLowerCase()}.supervisor`;
                    return (
                      <div key={st.id} className="bg-[#111625] p-2 border border-slate-800 rounded flex items-center justify-between gap-2.5">
                        <div className="truncate shrink-0" style={{ maxWidth: '40%' }}>
                          <span className="font-bold text-slate-300 block truncate">{st.name}</span>
                          <span className="text-[9px] text-slate-500 font-bold block mt-0.5">{st.manager || 'No Mgr'}</span>
                        </div>
                        <div className="text-right font-mono text-[9px] text-slate-400 truncate flex-1 leading-snug">
                          <div>User: <span className="bg-slate-800 text-slate-200 px-1 rounded">{st.username || fallbackUser}</span></div>
                          <div className="mt-0.5">Pass: <span className="bg-slate-800 text-emerald-400 px-1 rounded">{st.password || 'password123'}</span></div>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
