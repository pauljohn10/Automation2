/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState } from 'react';
import { useFuelSystem } from '../context';
import { FuelStation } from '../types';
import { ShieldCheck, MapPin, Key, User, Building, HelpCircle, Lock, Server, Sparkles, Database, Settings, Trash2, Building2 } from 'lucide-react';
import { getSupabaseClient, getSupabaseConfig, saveSupabaseOverrides, clearSupabaseOverrides, getSupabaseAdminClient } from '../supabaseClient';

export const LoginScreen: React.FC = () => {
  const { stations, setSession, addCustomAuditLog, refreshAllFromSupabase } = useFuelSystem();
  
  const [loginMode, setLoginMode] = useState<'station' | 'corporate'>('station');
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [errorMsg, setErrorMsg] = useState('');
  const [showHelper, setShowHelper] = useState(true);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [showCredentialsModal, setShowCredentialsModal] = useState(false);

  // Database configuration overrides states
  const [showDbConfig, setShowDbConfig] = useState(false);
  const [dbConfig, setDbConfig] = useState(getSupabaseConfig());
  const [inputUrl, setInputUrl] = useState(getSupabaseConfig().isLocalOverride ? localStorage.getItem('supabase_url_override') || '' : '');
  const [inputKey, setInputKey] = useState(getSupabaseConfig().isLocalOverride ? localStorage.getItem('supabase_key_override') || '' : '');
  const [configSuccessMsg, setConfigSuccessMsg] = useState<string | null>(null);

  const handleSaveConfig = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!inputUrl.trim() || !inputKey.trim()) return;
    saveSupabaseOverrides(inputUrl, inputKey);
    const updated = getSupabaseConfig();
    setDbConfig(updated);
    setConfigSuccessMsg('Credentials linked! Connecting...');
    
    const res = await refreshAllFromSupabase();
    if (res.success) {
      setConfigSuccessMsg('Connected successfully!');
    } else {
      setConfigSuccessMsg(`Linked, but connection alert: ${res.message}`);
    }
    
    setTimeout(() => {
      setConfigSuccessMsg(null);
      setShowDbConfig(false);
    }, 2500);
  };

  const handleClearConfig = async () => {
    clearSupabaseOverrides();
    setInputUrl('');
    setInputKey('');
    const updated = getSupabaseConfig();
    setDbConfig(updated);
    setConfigSuccessMsg('Credentials cleared. Defaulting to system environment...');
    
    await refreshAllFromSupabase();
    
    setConfigSuccessMsg('Using default environment database.');
    setTimeout(() => {
      setConfigSuccessMsg(null);
    }, 2000);
  };

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
      const lowerUser = cleanUser.toLowerCase();

      // 1. Check HQ Super Admin local bypass
      if (lowerUser === 'admin' && cleanPass === 'password123') {
        const defaultStationId = stations[0]?.id || 'st-01';
        setSession({
          role: 'SUPER_ADMIN',
          name: 'HQ Super Admin',
          activeStationId: defaultStationId,
          isLoggedIn: true,
          originalRole: 'SUPER_ADMIN',
          isStationContext: false
        });
        addCustomAuditLog('SUPER_ADMIN_LOGIN', 'HQ super admin logged in from security terminal.', defaultStationId);
        return;
      }

      // 2. Check Custom Station supervisor credentials local bypass
      const matchedStationByCustomCreds = stations.find(
        st => st.username && st.username.trim().toLowerCase() === lowerUser && st.password === cleanPass
      );

      // Block onboarded station supervisors / operators from Central HQ Workspace
      const isOnboardedStationUser = stations.some(
        st => st.id.startsWith('st-onboard-') && st.username && st.username.trim().toLowerCase() === lowerUser
      );

      let isOnboardedDbUser = false;
      try {
        const stored = sessionStorage.getItem('fuel_system_onboarded_users_fallback');
        if (stored) {
          const fallbackList = JSON.parse(stored);
          isOnboardedDbUser = fallbackList.some(
            (u: any) => u.username && u.username.trim().toLowerCase() === lowerUser && u.station_id.startsWith('st-onboard-')
          );
        }
      } catch {}

      if (isOnboardedStationUser || isOnboardedDbUser || (matchedStationByCustomCreds && matchedStationByCustomCreds.id.startsWith('st-onboard-'))) {
        setErrorMsg('Access Denied. Onboarded Station accounts must sign in through the Station Operator gateway.');
        return;
      }

      if (matchedStationByCustomCreds) {
        setSession({
          role: 'STATION_ADMIN',
          name: matchedStationByCustomCreds.manager || `${matchedStationByCustomCreds.name} Supervisor`,
          activeStationId: matchedStationByCustomCreds.id,
          isLoggedIn: true,
          originalRole: 'STATION_ADMIN',
          isStationContext: true
        });
        addCustomAuditLog(
          'SUPERVISOR_LOGIN', 
          `Supervisor "${matchedStationByCustomCreds.manager}" successfully authenticated via station supervisor account.`, 
          matchedStationByCustomCreds.id
        );
        return;
      }

      // 3. Block station operator accounts from signing in on the Central HQ Workspace tab
      const isOperatorUser = [
        'noor5', 'noor2', 'noor237', 'noor56', 'noor1'
      ].includes(lowerUser);

      if (isOperatorUser) {
        setErrorMsg('Access Denied. Station Operator accounts must sign in through the Station Operator gateway.');
        return;
      }

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
          const adminClient = getSupabaseAdminClient();
          const dbClient = adminClient || client;
          const { data: profile, error: profileErr } = await dbClient
            .from('user_profiles')
            .select('role')
            .eq('id', userId)
            .maybeSingle();

          const resolvedRole = profile?.role || data.user.user_metadata?.role;

          if (resolvedRole) {
            const role = resolvedRole; // 'SUPER_ADMIN' | 'ADMIN' | 'VIEWER'
            const defaultStationId = stations[0]?.id || 'st-01';

            setSession({
              role: role as any,
              name: userEmail,
              activeStationId: defaultStationId,
              isLoggedIn: true,
              originalRole: role as any,
              isStationContext: false
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
              if (onboardedUser.station_id.startsWith('st-onboard-')) {
                setErrorMsg('Access Denied. Onboarded Station accounts must sign in through the Station Operator gateway.');
                setIsSubmitting(false);
                return;
              }

              setSession({
                role: 'STATION_ADMIN',
                name: onboardedUser.full_name || userEmail,
                activeStationId: onboardedUser.station_id || stations[0]?.id || 'st-01',
                isLoggedIn: true,
                originalRole: 'STATION_ADMIN',
                isStationContext: true
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
                role: 'ADMIN',
                name: userEmail,
                activeStationId: defaultStationId,
                isLoggedIn: true,
                originalRole: 'ADMIN',
                isStationContext: false
              });
              addCustomAuditLog(
                'AUTH_FALLBACK',
                `Redirecting user "${userEmail}" to default Corporate ADMIN dashboard (No profile record matches associated tenant UID).`,
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

    // Check if user is a newly onboarded station supervisor or operator
    const isOnboardedStationUser = stations.some(
      st => st.id.startsWith('st-onboard-') && st.username && st.username.trim().toLowerCase() === lowerUser
    );

    let isOnboardedDbUser = false;
    try {
      const stored = sessionStorage.getItem('fuel_system_onboarded_users_fallback');
      if (stored) {
        const fallbackList = JSON.parse(stored);
        isOnboardedDbUser = fallbackList.some(
          (u: any) => u.username && u.username.trim().toLowerCase() === lowerUser && u.station_id.startsWith('st-onboard-')
        );
      }
    } catch {}

    const isAllowedOnboarded = isOnboardedStationUser || isOnboardedDbUser;

    // 1. Block covered corporate roles (HQ Super Admin, Admin, Supervisor, Viewer) from standard Station Operator tab
    // BUT allow newly onboarded station accounts!
    if (
      !isAllowedOnboarded && (
        lowerUser === 'admin' || 
        lowerUser.includes('admin') || 
        lowerUser.includes('supervisor') || 
        lowerUser.includes('viewer')
      )
    ) {
      setErrorMsg('Access Denied. Corporate HQ Accounts (HQ Admins, Super Admins, Supervisors, and Viewers) must exclusively sign in through the Central HQ Workspace gateway.');
      return;
    }

    // 2. Check Custom Station supervisor credentials for newly onboarded stations (from stations state)
    const matchedOnboardedStation = stations.find(
      st => st.id.startsWith('st-onboard-') && st.username && st.username.trim().toLowerCase() === lowerUser && st.password === cleanPass
    );

    if (matchedOnboardedStation) {
      setSession({
        role: 'STATION_ADMIN',
        name: matchedOnboardedStation.manager || `${matchedOnboardedStation.name} Supervisor`,
        activeStationId: matchedOnboardedStation.id,
        isLoggedIn: true,
        originalRole: 'STATION_ADMIN',
        isStationContext: true
      });

      addCustomAuditLog(
        'SUPERVISOR_LOGIN',
        `Supervisor "${matchedOnboardedStation.manager}" successfully authenticated via station operator gateway.`,
        matchedOnboardedStation.id
      );
      return;
    }

    // 3. Check newly onboarded users from sessionStorage fallback
    if (isOnboardedDbUser) {
      let localOnboarded: any[] = [];
      try {
        const stored = sessionStorage.getItem('fuel_system_onboarded_users_fallback');
        if (stored) localOnboarded = JSON.parse(stored);
      } catch {}
      
      const matchedOnboardedLocalUser = localOnboarded.find(
        u => u.username && u.username.trim().toLowerCase() === lowerUser && u.password_raw === cleanPass
      );

      if (matchedOnboardedLocalUser && matchedOnboardedLocalUser.station_id.startsWith('st-onboard-')) {
        setSession({
          role: matchedOnboardedLocalUser.role === 'supervisor' ? 'STATION_ADMIN' : 'OPERATOR',
          name: matchedOnboardedLocalUser.full_name || matchedOnboardedLocalUser.username,
          activeStationId: matchedOnboardedLocalUser.station_id,
          isLoggedIn: true,
          originalRole: matchedOnboardedLocalUser.role === 'supervisor' ? 'STATION_ADMIN' : 'OPERATOR',
          isStationContext: true
        });

        addCustomAuditLog(
          matchedOnboardedLocalUser.role === 'supervisor' ? 'SUPERVISOR_LOGIN' : 'OPERATOR_LOGIN',
          `${matchedOnboardedLocalUser.role === 'supervisor' ? 'Supervisor' : 'Operator'} "${matchedOnboardedLocalUser.full_name}" authenticated via station operator gateway (offline).`,
          matchedOnboardedLocalUser.station_id
        );
        return;
      }
    }

    // 4. Try online check for onboarded users database table
    try {
      const client = getSupabaseClient();
      const { data: dbOnboardedUser } = await client
        .from('onboarded_users')
        .select('*')
        .eq('username', lowerUser)
        .eq('password_raw', cleanPass)
        .maybeSingle();

      if (dbOnboardedUser && dbOnboardedUser.station_id.startsWith('st-onboard-')) {
        setSession({
          role: dbOnboardedUser.role === 'supervisor' ? 'STATION_ADMIN' : 'OPERATOR',
          name: dbOnboardedUser.full_name || dbOnboardedUser.username,
          activeStationId: dbOnboardedUser.station_id,
          isLoggedIn: true,
          originalRole: dbOnboardedUser.role === 'supervisor' ? 'STATION_ADMIN' : 'OPERATOR',
          isStationContext: true
        });

        addCustomAuditLog(
          dbOnboardedUser.role === 'supervisor' ? 'SUPERVISOR_LOGIN' : 'OPERATOR_LOGIN',
          `${dbOnboardedUser.role === 'supervisor' ? 'Supervisor' : 'Operator'} "${dbOnboardedUser.full_name}" authenticated via station operator gateway.`,
          dbOnboardedUser.station_id
        );
        return;
      }
    } catch (err) {
      console.warn("DB check for operator fallback skipped/failed:", err);
    }

    // 5. Check Custom Station Operator credentials (hardcoded operators)
    const matchedOperator = [
      { username: 'noor5', password: '123', stationName: 'Huseniya', stationCode: 'huseniya' },
      { username: 'noor2', password: 'asd', stationName: 'Matar', stationCode: 'matar' },
      { username: 'noor237', password: '123', stationName: 'Malik Fahd', stationCode: 'matar' }, // Malik Fahd mapped to Matar as standard fallback
      { username: 'noor56', password: '123', stationName: 'Makkah', stationCode: 'makkah' },
      { username: 'noor1', password: '123', stationName: 'Arissa', stationCode: 'arissa' }
    ].find(op => op.username === lowerUser && op.password === cleanPass);

    if (matchedOperator) {
      const station = stations.find(s => 
        s.name.toLowerCase().includes(matchedOperator.stationCode) ||
        s.name.toLowerCase().includes(matchedOperator.stationName.toLowerCase()) ||
        s.code.toLowerCase() === matchedOperator.stationCode
      );

      const targetStationId = station?.id || `st-operator-${matchedOperator.stationCode}`;
      
      setSession({
        role: 'OPERATOR',
        name: `Operator (${matchedOperator.stationName})`,
        activeStationId: targetStationId,
        isLoggedIn: true,
        originalRole: 'OPERATOR',
        isStationContext: true
      });

      addCustomAuditLog(
        'OPERATOR_LOGIN',
        `Station operator successfully authenticated for ${matchedOperator.stationName} station.`,
        targetStationId
      );
      return;
    }

    // No credentials matched
    setErrorMsg('System Access Denied. The credentials entered are invalid. Please verify and try again.');
  };

  return (
    <div className="min-h-screen w-screen flex items-center justify-center bg-[#090d16] font-sans selection:bg-[#6c5dd3] selection:text-white relative overflow-y-auto py-12 px-4">
      {/* Decorative background grid and glowing orbs */}
      <div className="absolute inset-0 bg-[linear-gradient(to_right,#1e293b0a_1px,transparent_1px),linear-gradient(to_bottom,#1e293b0a_1px,transparent_1px)] bg-[size:4rem_4rem] [mask-image:radial-gradient(ellipse_60%_50%_at_50%_40%,#000_70%,transparent_100%)] pointer-events-none" />
      <div className="absolute top-[-10%] left-[-10%] w-[50%] h-[50%] rounded-full bg-[#6c5dd3]/8 blur-[120px] pointer-events-none animate-pulse duration-5000" />
      <div className="absolute bottom-[-10%] right-[-10%] w-[50%] h-[50%] rounded-full bg-indigo-500/8 blur-[120px] pointer-events-none animate-pulse duration-5000" />

      {/* Discreet Sandbox Credentials Floating Help Trigger */}
      <div className="absolute top-4 right-4 z-40">
        <button
          type="button"
          onClick={() => setShowCredentialsModal(true)}
          className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-black uppercase bg-[#131a2c]/85 border border-[#242f4c] text-indigo-300 hover:text-white hover:bg-[#6c5dd3]/20 hover:border-[#6c5dd3]/40 transition-all cursor-pointer shadow-md select-none"
        >
          <HelpCircle size={14} className="text-[#6c5dd3]" />
          <span>Sandbox Accounts</span>
        </button>
      </div>

      {/* Main Login Card */}
      <div className="max-w-md w-full bg-[#111827]/70 backdrop-blur-xl border border-slate-800 rounded-2xl p-8 shadow-2xl relative z-10 space-y-6">
        {/* Branding & Logo */}
        <div className="text-center space-y-2">
          <div className="inline-flex w-12 h-12 rounded-xl bg-linear-to-tr from-[#6c5dd3] to-[#8c7dfc] items-center justify-center text-white shadow-lg shadow-[#6c5dd3]/20 border border-white/10">
            <Server size={22} className="animate-pulse" />
          </div>
          <div>
            <h1 className="text-lg font-black text-slate-100 tracking-tight uppercase leading-none">PetroLogic ERP</h1>
            <p className="text-[10px] text-slate-400 font-mono tracking-widest uppercase mt-1">Enterprise Fuel Suite</p>
          </div>
        </div>

        {/* Improved Role Selection */}
        <div className="space-y-2.5">
          <label className="text-[10px] font-black uppercase text-slate-500 tracking-wider block text-left">Gateway Access Point</label>
          <div className="grid grid-cols-2 gap-3">
            {/* Option 1: Station Operator */}
            <button
              type="button"
              onClick={() => {
                setLoginMode('station');
                setErrorMsg('');
              }}
              className={`p-3.5 rounded-xl border text-left transition-all flex flex-col justify-between h-24 cursor-pointer select-none ${
                loginMode === 'station'
                  ? 'border-[#6c5dd3] bg-[#6c5dd3]/10 text-white shadow-inner shadow-[#6c5dd3]/10'
                  : 'border-slate-800 bg-[#131c2e]/20 text-slate-400 hover:border-slate-700 hover:text-slate-200'
              }`}
            >
              <div className="flex items-center justify-between w-full">
                <MapPin size={18} className={loginMode === 'station' ? 'text-[#8c7dfc]' : 'text-slate-500'} />
                <span className={`w-1.5 h-1.5 rounded-full ${loginMode === 'station' ? 'bg-emerald-400 animate-ping' : 'bg-transparent'}`} />
              </div>
              <div>
                <span className="text-xs font-black uppercase tracking-wider block">Station Operator</span>
                <span className="text-[8px] text-slate-500 mt-0.5 block leading-tight font-medium">Local telemetry & pumps</span>
              </div>
            </button>

            {/* Option 2: Central HQ */}
            <button
              type="button"
              onClick={() => {
                setLoginMode('corporate');
                setErrorMsg('');
              }}
              className={`p-3.5 rounded-xl border text-left transition-all flex flex-col justify-between h-24 cursor-pointer select-none ${
                loginMode === 'corporate'
                  ? 'border-[#6c5dd3] bg-[#6c5dd3]/10 text-white shadow-inner shadow-[#6c5dd3]/10'
                  : 'border-slate-800 bg-[#131c2e]/20 text-slate-400 hover:border-slate-700 hover:text-slate-200'
              }`}
            >
              <div className="flex items-center justify-between w-full">
                <Building2 size={18} className={loginMode === 'corporate' ? 'text-[#8c7dfc]' : 'text-slate-500'} />
                <span className={`w-1.5 h-1.5 rounded-full ${loginMode === 'corporate' ? 'bg-indigo-400 animate-ping' : 'bg-transparent'}`} />
              </div>
              <div>
                <span className="text-xs font-black uppercase tracking-wider block">Central HQ</span>
                <span className="text-[8px] text-slate-500 mt-0.5 block leading-tight font-medium">Corporate ERP workspace</span>
              </div>
            </button>
          </div>
        </div>

        {/* Login Form */}
        <form onSubmit={handleLoginSubmit} className="space-y-4">
          {errorMsg && (
            <div className="bg-red-500/10 border border-red-500/20 rounded-xl p-3 text-xs text-red-400 font-bold flex items-start gap-2.5">
              <Lock size={15} className="shrink-0 mt-0.5 text-red-500" />
              <span>{errorMsg}</span>
            </div>
          )}

          <div className="space-y-1.5 text-left">
            <label className="text-[10px] font-black uppercase text-slate-400 tracking-wider">
              {loginMode === 'corporate' ? 'Corporate Email' : 'Operator Username'}
            </label>
            <div className="relative">
              <span className="absolute inset-y-0 left-0 flex items-center pl-3.5 text-slate-500">
                <User size={15} />
              </span>
              <input
                type="text"
                placeholder={loginMode === 'corporate' ? 'operator@centralhq.com' : 'e.g. noor2'}
                value={username}
                onChange={(e) => setUsername(e.target.value)}
                className="w-full bg-[#131a2c]/40 text-white border border-slate-800 rounded-xl py-3 pl-10 pr-3 text-xs font-semibold placeholder-slate-600 focus:outline-none focus:ring-1 focus:ring-[#6c5dd3] focus:border-[#6c5dd3] transition-all"
                required
                disabled={isSubmitting}
              />
            </div>
          </div>

          <div className="space-y-1.5 text-left">
            <label className="text-[10px] font-black uppercase text-slate-400 tracking-wider">
              {loginMode === 'corporate' ? 'Corporate Password' : 'Operator Passphrase'}
            </label>
            <div className="relative">
              <span className="absolute inset-y-0 left-0 flex items-center pl-3.5 text-slate-500">
                <Key size={15} />
              </span>
              <input
                type="password"
                placeholder="••••••••"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                className="w-full bg-[#131a2c]/40 text-white border border-slate-800 rounded-xl py-3 pl-10 pr-3 text-xs font-semibold placeholder-slate-600 focus:outline-none focus:ring-1 focus:ring-[#6c5dd3] focus:border-[#6c5dd3] transition-all"
                required
                disabled={isSubmitting}
              />
            </div>
          </div>

          <button
            type="submit"
            disabled={isSubmitting}
            className="w-full bg-linear-to-r from-[#6c5dd3] to-[#8c7dfc] hover:from-[#5c4eb3] hover:to-[#7c6dfc] text-white py-3 rounded-xl text-xs font-black transition-all shadow-lg shadow-[#6c5dd3]/10 disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2 uppercase tracking-widest cursor-pointer mt-2 select-none"
          >
            {isSubmitting ? (
              <>
                <span className="w-3.5 h-3.5 rounded-full border-2 border-white border-t-transparent animate-spin"></span>
                <span>Verifying Credentials...</span>
              </>
            ) : (
              <span>Sign In to Terminal</span>
            )}
          </button>
        </form>

        {/* Collapsible Database Connection Overrides */}
        <div className="pt-2 border-t border-slate-800/50">
          <button
            type="button"
            onClick={() => setShowDbConfig(!showDbConfig)}
            className="w-full flex items-center justify-between text-slate-500 hover:text-slate-350 transition-colors cursor-pointer py-1.5 px-1 rounded-lg text-[9px] uppercase font-bold tracking-wider select-none"
          >
            <span className="flex items-center gap-1.5">
              <Database size={12} className="text-[#6c5dd3]" />
              Database Server Override
            </span>
            <span className={`px-1.5 py-0.5 rounded text-[8px] font-black uppercase tracking-wide border ${
              dbConfig.isLocalOverride 
                ? 'bg-amber-500/10 text-amber-400 border-amber-500/25' 
                : 'bg-slate-900 text-slate-500 border-slate-800'
            }`}>
              {dbConfig.isLocalOverride ? 'Active Override' : 'System Default'}
            </span>
          </button>

          {showDbConfig && (
            <form onSubmit={handleSaveConfig} className="space-y-3 pt-3 border-t border-slate-800/80 mt-2 text-xs animate-fade-in text-left">
              <div className="flex flex-wrap items-center gap-2 pb-1">
                <span className="text-[9px] font-bold text-slate-500 uppercase tracking-wide">Presets:</span>
                <button
                  type="button"
                  onClick={() => {
                    setInputUrl('http://localhost:54321');
                    setInputKey('eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InRlbXAiLCJyb2xlIjoiYW5vbiIsImlhdCI6MTU2MTM3MTE0MSwiZXhwIjoxOTA2OTQ3MTQxfQ.standard-anon-key');
                  }}
                  className="bg-slate-800/80 hover:bg-slate-700 text-indigo-300 border border-slate-700 px-2 py-0.5 rounded text-[9px] font-bold transition-all flex items-center gap-1 cursor-pointer"
                >
                  <Server size={9} />
                  Localhost Preset (54321)
                </button>
              </div>

              <div className="space-y-1">
                <label className="text-[9px] font-bold text-slate-400 block uppercase">Project Endpoint URL</label>
                <input
                  type="url"
                  required
                  placeholder="https://your-project.supabase.co"
                  value={inputUrl}
                  onChange={(e) => setInputUrl(e.target.value)}
                  className="w-full bg-[#0b0f19] text-white border border-[#242f4c] rounded-lg py-2 px-3 text-xs font-mono focus:outline-none focus:ring-1 focus:ring-[#6c5dd3]"
                />
              </div>

              <div className="space-y-1">
                <label className="text-[9px] font-bold text-slate-400 block uppercase font-mono">Anon Key / API Token</label>
                <input
                  type="password"
                  required
                  placeholder="eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9..."
                  value={inputKey}
                  onChange={(e) => setInputKey(e.target.value)}
                  className="w-full bg-[#0b0f19] text-white border border-[#242f4c] rounded-lg py-2 px-3 text-xs font-mono focus:outline-none focus:ring-1 focus:ring-[#6c5dd3]"
                />
              </div>

              <div className="flex items-center justify-between pt-2.5 gap-2 border-t border-slate-800/80">
                <button
                  type="button"
                  onClick={handleClearConfig}
                  className="text-slate-500 hover:text-red-400 flex items-center gap-1 text-[9px] font-black uppercase tracking-wider cursor-pointer select-none"
                >
                  <Trash2 size={11} />
                  Reset Defaults
                </button>
                <button
                  type="submit"
                  className="bg-[#6c5dd3] hover:bg-[#5c4eb3] text-white px-3 py-1.5 rounded-lg text-[9px] font-black uppercase tracking-wider transition-colors cursor-pointer select-none"
                >
                  Connect
                </button>
              </div>
            </form>
          )}

          {configSuccessMsg && (
            <div className="p-2.5 bg-emerald-500/10 border border-emerald-500/30 rounded-lg text-[10px] text-emerald-450 font-semibold flex items-center gap-2 mt-2">
              <span>{configSuccessMsg}</span>
            </div>
          )}
        </div>

        {/* Security indicators footer */}
        <div className="text-center space-y-1 pt-4 border-t border-slate-800/40">
          <div className="flex items-center justify-center gap-1 text-[9px] font-mono text-slate-500 uppercase tracking-widest">
            <ShieldCheck size={11} className="text-indigo-400" />
            <span>Encrypted TLS Gateway</span>
          </div>
          <p className="text-[8px] text-slate-650 leading-normal text-center">
            This system is restricted to authorized personnel only. All access, events, and sensor calibrations are logged and monitored.
          </p>
        </div>
      </div>

      {/* Sandbox credentials modal */}
      {showCredentialsModal && (
        <div className="fixed inset-0 bg-[#090d16]/80 backdrop-blur-md flex items-center justify-center p-4 z-50 animate-fade-in">
          <div className="bg-[#111827] border border-slate-805 rounded-2xl max-w-lg w-full overflow-hidden shadow-2xl transform scale-100 transition-all duration-300">
            <div className="bg-slate-900/50 border-b border-slate-800 px-6 py-4 flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Sparkles size={16} className="text-amber-400 animate-pulse" />
                <h3 className="text-xs font-black text-slate-200 uppercase tracking-wider">
                  Developer Sandbox Accounts
                </h3>
              </div>
              <button
                type="button"
                onClick={() => setShowCredentialsModal(false)}
                className="text-slate-400 hover:text-white transition-colors text-[10px] font-black uppercase bg-slate-800/80 px-2.5 py-1.5 rounded-lg border border-slate-700 cursor-pointer select-none"
              >
                Close
              </button>
            </div>

            <div className="p-6 space-y-4 max-h-[75vh] overflow-y-auto text-left text-xs">
              <p className="text-slate-450 leading-relaxed font-semibold">
                Use these pre-configured sandbox credentials to test the dashboard. Click any card to automatically fill the login form and select the correct gateway.
              </p>

              <div className="space-y-4">
                <div className="space-y-2">
                  <span className="text-[9px] font-black uppercase text-indigo-400 tracking-wider">HQ Enterprise Accounts:</span>
                  <div 
                    onClick={() => {
                      setUsername('admin');
                      setPassword('password123');
                      setLoginMode('corporate');
                      setShowCredentialsModal(false);
                      setErrorMsg('');
                    }}
                    className="bg-[#182235] hover:bg-[#1e2b43] p-3.5 border border-indigo-950/60 rounded-xl flex items-center justify-between cursor-pointer transition-all hover:scale-[1.01]"
                  >
                    <div>
                      <span className="font-bold text-slate-200 text-xs">HQ Super Admin (Local Bypass)</span>
                      <p className="text-[9px] text-slate-500 font-mono mt-0.5">Central HQ Gateway</p>
                    </div>
                    <div className="text-right font-mono text-[9px] space-y-0.5 text-slate-400">
                      <div>User: <span className="bg-slate-900 px-1.5 py-0.5 rounded text-slate-200">admin</span></div>
                      <div className="mt-0.5">Pass: <span className="bg-slate-900 px-1.5 py-0.5 rounded text-emerald-400">password123</span></div>
                    </div>
                  </div>
                </div>

                <div className="space-y-2">
                  <div className="flex items-center justify-between">
                    <span className="text-[9px] font-black uppercase text-slate-500 tracking-wider">Station Operators (Local Bypass):</span>
                    <span className="text-[8px] bg-emerald-500/10 text-emerald-300 border border-emerald-500/20 px-1.5 py-0.5 rounded font-mono font-bold uppercase tracking-wider">Station Operator Gateway Only</span>
                  </div>
                  
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    {[
                      { name: 'Huseniya', user: 'noor5', pass: '123' },
                      { name: 'Matar', user: 'noor2', pass: 'asd' },
                      { name: 'Malik Fahd', user: 'noor237', pass: '123' },
                      { name: 'Makkah', user: 'noor56', pass: '123' },
                      { name: 'Arissa (Najran)', user: 'noor1', pass: '123' }
                    ].map(op => (
                      <div
                        key={op.user}
                        onClick={() => {
                          setUsername(op.user);
                          setPassword(op.pass);
                          setLoginMode('station');
                          setShowCredentialsModal(false);
                          setErrorMsg('');
                        }}
                        className="bg-[#131a2c] hover:bg-[#1b253f] p-3 border border-slate-800 rounded-xl space-y-1.5 cursor-pointer transition-all hover:scale-[1.01] text-left"
                      >
                        <span className="font-bold text-slate-350 block truncate">{op.name}</span>
                        <div className="font-mono text-[9px] text-slate-550 space-y-0.5">
                          <div>User: <span className="bg-slate-900 px-1.5 py-0.5 rounded text-slate-200">{op.user}</span></div>
                          <div className="mt-0.5">Pass: <span className="bg-slate-900 px-1.5 py-0.5 rounded text-emerald-400">{op.pass}</span></div>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>

                {/* Dynamic Station Supervisors list from Supabase */}
                {stations.filter(st => {
                  const uname = (st.username || '').trim().toLowerCase();
                  return uname !== 'noor5' && uname !== 'noor2' && uname !== 'noor237' && uname !== 'noor56' && uname !== 'noor1';
                }).length > 0 && (
                  <div className="space-y-2">
                    <span className="text-[9px] font-black uppercase text-slate-500 tracking-wider">Dynamic Station Supervisors (Supabase):</span>
                    <div className="space-y-2">
                      {stations
                        .filter(st => {
                          const uname = (st.username || '').trim().toLowerCase();
                          return uname !== 'noor5' && uname !== 'noor2' && uname !== 'noor237' && uname !== 'noor56' && uname !== 'noor1';
                        })
                        .map(st => {
                          const supervisorUser = st.username || `${st.code.toLowerCase()}.supervisor`;
                          const supervisorPass = st.password || 'password123';
                          const isOnboarded = st.id.startsWith('st-onboard-');
                          return (
                            <div
                              key={st.id}
                              onClick={() => {
                                setUsername(supervisorUser);
                                setPassword(supervisorPass);
                                setLoginMode(isOnboarded ? 'station' : 'corporate');
                                setShowCredentialsModal(false);
                                setErrorMsg('');
                              }}
                              className="bg-[#131a2c] hover:bg-[#1b253f] p-3 border border-slate-800 rounded-xl flex items-center justify-between cursor-pointer transition-all hover:scale-[1.01]"
                            >
                              <div>
                                <span className="font-bold text-slate-300 block">{st.name}</span>
                                <span className="text-[8px] text-slate-500 font-mono">Mgr: {st.manager || 'No Manager'}</span>
                                {isOnboarded && (
                                  <span className="inline-block mt-1 px-1.5 py-0.5 rounded text-[7px] font-black uppercase tracking-wider bg-[#6c5dd3]/10 text-indigo-400 border border-[#6c5dd3]/20">
                                    Operator Gateway Only
                                  </span>
                                )}
                              </div>
                              <div className="text-right font-mono text-[9px] text-slate-450 space-y-0.5">
                                <div>User: <span className="bg-slate-900 px-1.5 py-0.5 rounded text-slate-200">{supervisorUser}</span></div>
                                <div className="mt-0.5">Pass: <span className="bg-slate-900 px-1.5 py-0.5 rounded text-emerald-400">{supervisorPass}</span></div>
                              </div>
                            </div>
                          );
                        })}
                    </div>
                  </div>
                )}
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

