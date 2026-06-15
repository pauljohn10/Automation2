/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useEffect } from 'react';
import { useFuelSystem } from '../context';
import { 
  fetchUserProfiles, 
  provisionUserAccount, 
  deleteUserAccount, 
  SupabaseUserProfile, 
  getSupabaseServiceRoleKey,
  getSupabaseConfig
} from '../supabaseClient';
import { 
  Users, 
  ShieldAlert, 
  Mail, 
  Key, 
  UserCheck, 
  Database, 
  Trash2, 
  Copy, 
  Check, 
  Lock, 
  ArrowRight,
  Sparkles,
  Info
} from 'lucide-react';

export const UserManagement: React.FC = () => {
  const { session, addCustomAuditLog } = useFuelSystem();

  // Protect view - only SUPER_ADMIN
  if (session.role !== 'SUPER_ADMIN') {
    return (
      <div className="p-8 text-center bg-slate-50 min-h-[calc(100vh-64px)] font-sans flex flex-col items-center justify-center">
        <ShieldAlert size={48} className="text-red-500 mb-3" />
        <h3 className="text-sm font-black text-slate-800 uppercase tracking-wider">Access Denied</h3>
        <p className="text-xs text-slate-500 mt-1 max-w-md leading-relaxed">
          The requested administrative module is locked and reserved strictly for authorized Central HQ Super Administrators.
        </p>
      </div>
    );
  }

  // State Management
  const [profiles, setProfiles] = useState<SupabaseUserProfile[]>([]);
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [role, setRole] = useState<'ADMIN' | 'VIEWER'>('VIEWER');
  const [serviceRoleInput, setServiceRoleInput] = useState('');
  
  // Status and logs
  const [isLoading, setIsLoading] = useState(false);
  const [statusMsg, setStatusMsg] = useState<{ type: 'success' | 'error'; text: string } | null>(null);
  const [isCopied, setIsCopied] = useState(false);

  // Load existing profiles & service role configuration on init
  const loadData = async () => {
    setIsLoading(true);
    const users = await fetchUserProfiles();
    setProfiles(users);
    setIsLoading(false);
  };

  useEffect(() => {
    loadData();
    const currentKey = getSupabaseServiceRoleKey() || '';
    setServiceRoleInput(currentKey);
  }, []);

  // Save Service Role Key
  const handleSaveServiceRole = (e: React.FormEvent) => {
    e.preventDefault();
    localStorage.setItem('supabase_service_role_override', serviceRoleInput.trim());
    setStatusMsg({
      type: 'success',
      text: 'Supabase Service Role Key updated successfully. Ready to run live Auth administrative actions.'
    });
    setTimeout(() => setStatusMsg(null), 4000);
    loadData();
  };

  // Submit User Account Promise Chain (Tier 1 & Tier 2)
  const handleCreateUser = async (e: React.FormEvent) => {
    e.preventDefault();
    setStatusMsg(null);

    const cleanEmail = email.trim();
    const cleanPass = password.trim();

    if (!cleanEmail || !cleanPass) {
      setStatusMsg({ type: 'error', text: 'Please fill in both email and initial password fields.' });
      return;
    }

    if (cleanPass.length < 6) {
      setStatusMsg({ type: 'error', text: 'Security guidelines require password length of at least 6 characters.' });
      return;
    }

    setIsLoading(true);
    try {
      const res = await provisionUserAccount(cleanEmail, cleanPass, role);
      if (res.success) {
        setStatusMsg({ type: 'success', text: res.message });
        setEmail('');
        setPassword('');
        addCustomAuditLog(
          'USER_PROVISION',
          `Successfully provisioned dynamic role "${role}" for team account "${cleanEmail}" on live database system.`,
          ''
        );
        loadData();
      } else {
        setStatusMsg({ type: 'error', text: res.message });
      }
    } catch (err: any) {
      setStatusMsg({ type: 'error', text: err.message || String(err) });
    } finally {
      setIsLoading(false);
    }
  };

  // Delete matching account row
  const handleDeleteUserProfile = async (id: string, userEmail: string) => {
    if (window.confirm(`Are you absolutely sure you want to terminate user account "${userEmail}"? This action is permanent.`)) {
      setIsLoading(true);
      const res = await deleteUserAccount(id);
      if (res.success) {
        setStatusMsg({ type: 'success', text: `Account "${userEmail}" terminated successfully.` });
        addCustomAuditLog('USER_DELETION', `Terminated role access for "${userEmail}" (${id})`, '');
        loadData();
      } else {
        setStatusMsg({ type: 'error', text: res.message });
      }
      setIsLoading(false);
    }
  };

  // SQL Script text for Supabase SQL Editor
  const sqlScriptText = `-- 1. Create public.user_profiles table referencing auth.users
CREATE TABLE IF NOT EXISTS public.user_profiles (
  id uuid PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  email text UNIQUE NOT NULL,
  role text NOT NULL CHECK (role IN ('SUPER_ADMIN', 'ADMIN', 'VIEWER')),
  created_at timestamp with time zone DEFAULT now()
);

-- 2. Enable Row Level Security (RLS)
ALTER TABLE public.user_profiles ENABLE ROW LEVEL SECURITY;

-- 3. Policy: Only SUPER_ADMIN profiles can manage all records
CREATE POLICY "Super Admins Full Access" ON public.user_profiles
  FOR ALL
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.user_profiles 
      WHERE user_profiles.id = auth.uid() AND user_profiles.role = 'SUPER_ADMIN'
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.user_profiles 
      WHERE user_profiles.id = auth.uid() AND user_profiles.role = 'SUPER_ADMIN'
    )
  );

-- 4. Enable other authenticated users to read their own roles
CREATE POLICY "Users read own profile" ON public.user_profiles
  FOR SELECT
  TO authenticated
  USING (id = auth.uid());`;

  const copyToClipboard = () => {
    navigator.clipboard.writeText(sqlScriptText);
    setIsCopied(true);
    setTimeout(() => setIsCopied(false), 2000);
  };

  const sysConfig = getSupabaseConfig();

  return (
    <div className="p-6 space-y-6 bg-slate-50 min-h-[calc(100vh-64px)] font-sans text-left">
      
      {/* Title Header Banner Block */}
      <div className="bg-white rounded-xl border border-slate-200 p-5 shadow-2xs">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div>
            <h3 className="text-sm font-black text-slate-800 tracking-tight flex items-center gap-2 uppercase">
              <Users className="text-[#6c5dd3]" size={18} />
              HQ Dual-Tiered Multi-User Provisioning Portal
            </h3>
            <p className="text-xs text-slate-500 mt-1 max-w-2xl leading-relaxed">
              Programmatically pre-confirm, create, and dispatch secure access permissions across your enterprise station team without logging out of your active control dashboard.
            </p>
          </div>
          <div className="flex items-center gap-1.5 self-start bg-indigo-50 border border-indigo-150 px-3 py-1.5 rounded-lg text-indigo-700 text-xs font-bold leading-none font-mono uppercase">
            <span className="w-1.5 h-1.5 rounded-full bg-indigo-600 animate-pulse"></span>
            Super Admin Active
          </div>
        </div>
      </div>

      {statusMsg && (
        <div className={`p-4 rounded-xl border text-xs leading-relaxed font-semibold flex items-start gap-3 shadow-2xs ${
          statusMsg.type === 'success' 
            ? 'bg-emerald-50 border-emerald-200 text-emerald-800' 
            : 'bg-red-50 border-red-200 text-red-800'
        }`}>
          <div className="shrink-0 p-1 bg-white rounded-md shadow-2xs border border-slate-200">
            {statusMsg.type === 'success' ? <UserCheck size={14} className="text-emerald-600" /> : <ShieldAlert size={14} className="text-red-600" />}
          </div>
          <div>
            <p className="font-extrabold uppercase text-[10px] tracking-wide mb-0.5">
              {statusMsg.type === 'success' ? 'Operation Completed' : 'Operation Halted'}
            </p>
            <span>{statusMsg.text}</span>
          </div>
        </div>
      )}

      {/* Primary Layout Grid */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
        
        {/* Left Column - Provision & Table catalog (8 grid width) */}
        <div className="lg:col-span-7 space-y-6">
          
          {/* Section 1: Provisioning Form */}
          <div className="bg-white rounded-xl border border-slate-200 p-5 shadow-2xs space-y-4">
            <div className="flex items-center gap-2.5 pb-3 border-b border-dashed border-slate-100">
              <div className="w-7 h-7 rounded-lg bg-indigo-50 text-[#6c5dd3] flex items-center justify-center">
                <Users size={14} />
              </div>
              <div>
                <h4 className="text-xs font-black text-slate-800 uppercase tracking-wider">Account Creation form</h4>
                <p className="text-[10px] text-slate-400 font-medium">Binds directly to auth.users and public.user_profiles</p>
              </div>
            </div>

            <form onSubmit={handleCreateUser} className="space-y-4">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                
                {/* Email address */}
                <div className="space-y-1.5">
                  <label className="text-xs font-bold text-slate-600 block">User Email Address</label>
                  <div className="relative">
                    <span className="absolute inset-y-0 left-0 flex items-center pl-3 text-slate-400">
                      <Mail size={14} />
                    </span>
                    <input
                      type="email"
                      required
                      placeholder="operator@station.com"
                      value={email}
                      onChange={(e) => setEmail(e.target.value)}
                      className="w-full bg-slate-50 border border-slate-200 rounded-lg py-2 pl-9 pr-3 text-xs font-medium focus:outline-none focus:bg-white focus:ring-1 focus:ring-[#6c5dd3]"
                    />
                  </div>
                </div>

                {/* Password input */}
                <div className="space-y-1.5">
                  <label className="text-xs font-bold text-slate-600 block">Initial Password</label>
                  <div className="relative">
                    <span className="absolute inset-y-0 left-0 flex items-center pl-3 text-slate-400">
                      <Key size={14} />
                    </span>
                    <input
                      type="password"
                      required
                      placeholder="Min 6 characters"
                      value={password}
                      onChange={(e) => setPassword(e.target.value)}
                      className="w-full bg-slate-50 border border-slate-200 rounded-lg py-2 pl-9 pr-3 text-xs font-medium focus:outline-none focus:bg-white focus:ring-1 focus:ring-[#6c5dd3]"
                    />
                  </div>
                </div>

              </div>

              {/* Account role dropdown */}
              <div className="space-y-1.5">
                <label className="text-xs font-bold text-slate-600 block">Account Access Role</label>
                <div className="flex gap-4">
                  {/* ADMIN choice card */}
                  <div 
                    onClick={() => setRole('ADMIN')}
                    className={`flex-1 p-3.5 rounded-lg border-2 text-left cursor-pointer transition-all ${
                      role === 'ADMIN'
                        ? 'border-indigo-500 bg-indigo-50/30'
                        : 'border-slate-250 bg-slate-50 hover:bg-slate-100/50'
                    }`}
                  >
                    <div className="flex items-center justify-between">
                      <span className="text-xs font-extrabold text-slate-800">ADMIN</span>
                      <div className={`w-3.5 h-3.5 rounded-full border border-slate-300 flex items-center justify-center ${
                        role === 'ADMIN' ? 'bg-indigo-600 border-indigo-600' : ''
                      }`}>
                        {role === 'ADMIN' && <span className="w-1.5 h-1.5 rounded-full bg-white"></span>}
                      </div>
                    </div>
                    <p className="text-[10px] text-slate-500 mt-1 leading-snug">
                      Authorized to manage physical level overlays, calibrate ATG sensors, dispatch tanker logistics, and modify pricing nodes.
                    </p>
                  </div>

                  {/* VIEWER choice card */}
                  <div 
                    onClick={() => setRole('VIEWER')}
                    className={`flex-1 p-3.5 rounded-lg border-2 text-left cursor-pointer transition-all ${
                      role === 'VIEWER'
                        ? 'border-indigo-500 bg-indigo-50/30'
                        : 'border-slate-250 bg-slate-50 hover:bg-slate-100/50'
                    }`}
                  >
                    <div className="flex items-center justify-between">
                      <span className="text-xs font-extrabold text-slate-800">VIEWER</span>
                      <div className={`w-3.5 h-3.5 rounded-full border border-slate-300 flex items-center justify-center ${
                        role === 'VIEWER' ? 'bg-indigo-600 border-indigo-600' : ''
                      }`}>
                        {role === 'VIEWER' && <span className="w-1.5 h-1.5 rounded-full bg-white"></span>}
                      </div>
                    </div>
                    <p className="text-[10px] text-slate-500 mt-1 leading-snug">
                      Strictly Read-Only access. All interactive state-mutating forms, level configuration modals, and purges are locked.
                    </p>
                  </div>
                </div>
              </div>

              {/* Provision button */}
              <button
                type="submit"
                disabled={isLoading}
                className="w-full bg-[#6c5dd3] hover:bg-[#5c4eb3] text-white py-2.5 rounded-lg text-xs font-black transition-all flex items-center justify-center gap-2 font-mono uppercase shadow-2xs"
              >
                <span>Create User Account</span>
                <ArrowRight size={14} />
              </button>
            </form>
          </div>

          {/* Section 2: Catalog list of dynamic user_profiles */}
          <div className="bg-white rounded-xl border border-slate-200 shadow-2xs overflow-hidden">
            <div className="p-4 bg-slate-100 border-b border-slate-200 flex items-center justify-between">
              <div>
                <h4 className="text-xs font-black text-slate-800 uppercase tracking-wider">Dynamic User Database Catalog</h4>
                <p className="text-[10px] text-slate-400 font-semibold font-mono tracking-wider">Table: public.user_profiles</p>
              </div>
              <button 
                onClick={loadData}
                className="px-2.5 py-1 text-[10px] font-bold text-slate-600 hover:text-[#6c5dd3] bg-white border border-slate-200 rounded-md transition-colors"
                disabled={isLoading}
              >
                Refresh Rows
              </button>
            </div>

            <div className="overflow-x-auto">
              {profiles.length === 0 ? (
                <div className="p-8 text-center text-slate-500 font-sans italic text-xs">
                  No matches discovered in table "user_profiles". Verify the custom SQL script is configured.
                </div>
              ) : (
                <table className="w-full text-xs text-left text-slate-500">
                  <thead className="bg-slate-50 text-[10px] uppercase font-black text-slate-500 tracking-wider border-b border-slate-100">
                    <tr>
                      <th className="px-4 py-3">Account Email</th>
                      <th className="px-4 py-3">Assigned Role</th>
                      <th className="px-4 py-3">UUID</th>
                      <th className="px-4 py-3 text-right">Access Terminal</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100 font-medium">
                    {profiles.map((prof) => (
                      <tr key={prof.id} className="hover:bg-slate-50/50">
                        <td className="px-4 py-3 font-bold text-slate-800">{prof.email}</td>
                        <td className="px-4 py-3">
                          <span className={`inline-block text-[9px] font-black tracking-widest px-2 py-0.5 rounded uppercase ${
                            prof.role === 'SUPER_ADMIN' 
                              ? 'bg-red-50 text-red-600 border border-red-100'
                              : prof.role === 'ADMIN'
                              ? 'bg-indigo-50 text-[#6c5dd3] border border-indigo-100'
                              : 'bg-slate-100 text-slate-600 border border-slate-200'
                          }`}>
                            {prof.role}
                          </span>
                        </td>
                        <td className="px-4 py-3 font-mono text-[10px] text-slate-400">{prof.id}</td>
                        <td className="px-4 py-3 text-right">
                          <button
                            onClick={() => handleDeleteUserProfile(prof.id, prof.email)}
                            disabled={isLoading}
                            className="text-slate-400 hover:text-red-600 p-1 rounded-md hover:bg-slate-100 transition-all"
                            title="Terminate Account Access"
                          >
                            <Trash2 size={13} />
                          </button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              )}
            </div>
          </div>

        </div>

        {/* Right Column - Service Role Overrides & Copyable SQL (5 grid width) */}
        <div className="lg:col-span-5 space-y-6">
          
          {/* Section 1: Supabase Service Role Config */}
          <div className="bg-white rounded-xl border border-slate-200 p-5 shadow-2xs space-y-4">
            <div className="flex items-center gap-2.5 pb-2.5 border-b border-slate-100">
              <div className="w-7 h-7 rounded-lg bg-indigo-50 text-[#6c5dd3] flex items-center justify-center">
                <Database size={14} />
              </div>
              <div>
                <h4 className="text-xs font-black text-slate-800 uppercase tracking-wider">Service Role Override</h4>
                <p className="text-[10px] text-slate-400 font-medium">Allows secure auth actions on loopback</p>
              </div>
            </div>

            <p className="text-xs text-slate-500 leading-relaxed font-semibold">
              To dynamically manage users in your custom live database without forcing your current browser session to logout, provide your Supabase Project's <span className="text-indigo-650">Service Role Key</span> (a.k.a `service_role` secret).
            </p>

            <form onSubmit={handleSaveServiceRole} className="space-y-3">
              <div className="space-y-1.5">
                <label className="text-[10px] font-black uppercase text-slate-500 tracking-wider">Supabase Service Role Key</label>
                <div className="relative">
                  <span className="absolute inset-y-0 left-0 flex items-center pl-3 text-slate-400">
                    <Lock size={14} />
                  </span>
                  <input
                    type="password"
                    placeholder="eyJhbGciOiJIUzI1NiIsIn..."
                    value={serviceRoleInput}
                    onChange={(e) => setServiceRoleInput(e.target.value)}
                    className="w-full bg-slate-50 border border-slate-200 rounded-lg py-2 pl-9 pr-3 text-xs font-mono focus:outline-none focus:bg-white focus:ring-1 focus:ring-[#6c5dd3]"
                  />
                </div>
              </div>

              <div className="flex items-center justify-between text-[10px] bg-slate-50 p-2.5 rounded-lg border border-slate-150">
                <span className="font-bold text-slate-500">Supabase Connection URL:</span>
                <span className="font-mono text-slate-700 truncate max-w-[200px]" title={sysConfig.url}>{sysConfig.url}</span>
              </div>

              <button
                type="submit"
                className="w-full bg-slate-100 hover:bg-slate-200 text-slate-700 p-2 rounded-lg text-xs font-bold transition-all flex items-center justify-center gap-1.5 border border-slate-250 cursor-pointer"
              >
                <span>Save Service Key Override</span>
              </button>
            </form>
          </div>

          {/* Section 2: SQL Editor configuration */}
          <div className="bg-white rounded-xl border border-slate-200 p-5 shadow-2xs space-y-3">
            <div className="flex items-center justify-between pb-2 border-b border-dashed border-slate-100">
              <div className="flex items-center gap-2">
                <Database size={15} className="text-emerald-600" />
                <h4 className="text-xs font-black text-slate-800 uppercase tracking-wider">SQL Table Setup Script</h4>
              </div>
              <button
                onClick={copyToClipboard}
                className="flex items-center gap-1 px-2.5 py-1 text-[10px] font-black text-[#6c5dd3] bg-indigo-50 hover:bg-[#6c5dd3] hover:text-white rounded-md transition-all self-center shadow-3xs"
              >
                {isCopied ? (
                  <>
                    <Check size={12} />
                    <span>Copied!</span>
                  </>
                ) : (
                  <>
                    <Copy size={12} />
                    <span>Copy SQL</span>
                  </>
                )}
              </button>
            </div>

            <p className="text-xs text-slate-500 leading-relaxed font-semibold">
              Open your Supabase Dashboard, select the <span className="text-emerald-700 font-bold">SQL Editor</span> tab, paste this clean code, and execute it to create the matching table structure and bind row-level security guardrails seamlessly:
            </p>

            <div className="relative">
              <pre className="text-[10px] text-slate-300 bg-[#0f172a] p-4.5 rounded-lg overflow-x-auto font-mono max-h-[350px] leading-relaxed border border-slate-950 shadow-inner">
                <code>{sqlScriptText}</code>
              </pre>
            </div>

            <div className="bg-amber-50 rounded-lg p-3 border border-amber-200 text-left text-amber-950 flex gap-2">
              <Info size={14} className="text-amber-600 shrink-0 mt-0.5" />
              <p className="text-[10px] leading-relaxed font-semibold">
                Tip: Row-level security checks use a custom filter so only <code className="bg-amber-100 px-1 rounded text-amber-900 border border-amber-200 font-mono text-[9px]">SUPER_ADMIN</code> sessions can modify user access.
              </p>
            </div>
          </div>

        </div>

      </div>

    </div>
  );
};
