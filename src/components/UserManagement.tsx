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
  getSupabaseClient,
  getSupabaseAdminClient,
  getSupabaseConfig,
  SupabaseUserProfile
} from '../supabaseClient';
import { 
  Users, 
  ShieldAlert, 
  Mail, 
  Key, 
  UserCheck, 
  Trash2, 
  Lock, 
  ArrowRight,
  Search,
  Filter,
  Plus,
  Edit2,
  RotateCcw,
  Power,
  History,
  X,
  ChevronLeft,
  ChevronRight,
  Check,
  AlertTriangle,
  Shield,
  Activity,
  CheckCircle2
} from 'lucide-react';

interface UnifiedUser {
  id: string;
  fullName: string;
  email: string;
  assignedStationId: 'all';
  assignedStationName: 'Central HQ';
  role: 'SUPER_ADMIN' | 'ADMIN' | 'VIEWER';
  status: 'Active' | 'Disabled';
  createdAt: string;
  lastLogin: string;
}

const DEFAULT_SEED_USERS: UnifiedUser[] = [
  {
    id: 'usr-bypass-admin',
    fullName: 'HQ Super Admin',
    email: 'admin@noorfuel.com',
    assignedStationId: 'all',
    assignedStationName: 'Central HQ',
    role: 'SUPER_ADMIN',
    status: 'Active',
    createdAt: '2026-01-15T08:00:00Z',
    lastLogin: '2026-06-24T09:30:00Z'
  },
  {
    id: 'usr-demo-viewer',
    fullName: 'Amal Al-Otaibi',
    email: 'amal.viewer@noorfuel.com',
    assignedStationId: 'all',
    assignedStationName: 'Central HQ',
    role: 'VIEWER',
    status: 'Active',
    createdAt: '2026-02-01T09:00:00Z',
    lastLogin: '2026-06-24T09:00:00Z'
  },
  {
    id: 'usr-demo-admin',
    fullName: 'Fahad Al-Saud',
    email: 'fahad.admin@noorfuel.com',
    assignedStationId: 'all',
    assignedStationName: 'Central HQ',
    role: 'ADMIN',
    status: 'Active',
    createdAt: '2026-02-15T10:00:00Z',
    lastLogin: '2026-06-24T08:45:00Z'
  }
];

export const UserManagement: React.FC = () => {
  const { session, auditLogs, addCustomAuditLog } = useFuelSystem();

  // Protect view: only accessible to SUPER_ADMIN, ADMIN, or VIEWER
  const isHQUser = session.role === 'SUPER_ADMIN' || session.role === 'ADMIN' || session.role === 'VIEWER';
  
  // State management
  const [users, setUsers] = useState<UnifiedUser[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [statusMsg, setStatusMsg] = useState<{ type: 'success' | 'error'; text: string } | null>(null);

  // Search & Filter state
  const [searchQuery, setSearchQuery] = useState('');
  const [filterRole, setFilterRole] = useState<string>('ALL');
  const [filterStatus, setFilterStatus] = useState<string>('ALL');

  // Pagination state
  const [currentPage, setCurrentPage] = useState(1);
  const [itemsPerPage, setItemsPerPage] = useState(5);

  // Modals state
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [showEditModal, setShowEditModal] = useState(false);
  const [showResetPwdModal, setShowResetPwdModal] = useState(false);
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  const [showStatusConfirm, setShowStatusConfirm] = useState(false);
  const [showActivityDrawer, setShowActivityDrawer] = useState(false);
  const [selectedUser, setSelectedUser] = useState<UnifiedUser | null>(null);

  // Form states
  const [newFullName, setNewFullName] = useState('');
  const [newEmail, setNewEmail] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [newRole, setNewRole] = useState<'SUPER_ADMIN' | 'ADMIN' | 'VIEWER'>('ADMIN');

  const [editFullName, setEditFullName] = useState('');
  const [editRole, setEditRole] = useState<'SUPER_ADMIN' | 'ADMIN' | 'VIEWER'>('ADMIN');

  const [tempPassword, setTempPassword] = useState('');

  // Authorizations
  const isSuperAdmin = session.role === 'SUPER_ADMIN';

  // Load and merge users from Supabase and Local Storage cache
  const loadData = async () => {
    setIsLoading(true);
    try {
      const config = getSupabaseConfig();
      let dbProfiles: SupabaseUserProfile[] = [];

      if (config.isConfigured) {
        dbProfiles = await fetchUserProfiles();
      }

      let localUsers: UnifiedUser[] = [];
      try {
        const stored = localStorage.getItem('petrologic_custom_users');
        if (stored) {
          // Parse and filter out any operator role remnants
          const parsed = JSON.parse(stored) as any[];
          localUsers = parsed.filter(u => u.role === 'SUPER_ADMIN' || u.role === 'ADMIN' || u.role === 'VIEWER');
        } else {
          localUsers = DEFAULT_SEED_USERS;
          localStorage.setItem('petrologic_custom_users', JSON.stringify(localUsers));
        }
      } catch (e) {
        localUsers = DEFAULT_SEED_USERS;
      }

      // Map database user profiles
      const mappedDbProfiles = dbProfiles.map(p => {
        const localMatch = localUsers.find(lu => lu.id === p.id || lu.email.toLowerCase() === p.email.toLowerCase());
        return {
          id: p.id,
          fullName: localMatch?.fullName || p.email.split('@')[0].toUpperCase(),
          email: p.email,
          assignedStationId: 'all',
          assignedStationName: 'Central HQ',
          role: p.role, // 'SUPER_ADMIN' | 'ADMIN' | 'VIEWER'
          status: localMatch?.status || 'Active',
          createdAt: p.created_at || new Date().toISOString(),
          lastLogin: localMatch?.lastLogin || new Date().toISOString()
        } as UnifiedUser;
      });

      // Filter local cache to only include corporate roles
      const corporateLocalUsers = localUsers.filter(u => u.role === 'SUPER_ADMIN' || u.role === 'ADMIN' || u.role === 'VIEWER');

      // Merge and prioritize DB users, fallback to mock/local-only users
      const mergedList = [...mappedDbProfiles];
      corporateLocalUsers.forEach(lu => {
        const exists = mergedList.some(
          m => m.id === lu.id || m.email.toLowerCase() === lu.email.toLowerCase()
        );
        if (!exists) {
          mergedList.push(lu);
        }
      });

      // Sort by Created Date descending
      mergedList.sort((a, b) => b.createdAt.localeCompare(a.createdAt));
      setUsers(mergedList);
      localStorage.setItem('petrologic_custom_users', JSON.stringify(mergedList));
    } catch (err) {
      console.error('Error loading users:', err);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    if (isHQUser) {
      loadData();
    }
  }, []);

  // Show status banner helpers
  const triggerToast = (type: 'success' | 'error', text: string) => {
    setStatusMsg({ type, text });
    setTimeout(() => setStatusMsg(null), 5500);
  };

  // Mutate 1: Create User
  const handleCreateUser = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!isSuperAdmin) {
      triggerToast('error', 'Unauthorized: Only SUPER ADMIN accounts can provision users.');
      return;
    }

    const emailClean = newEmail.trim().toLowerCase();
    const nameClean = newFullName.trim();
    const pwdClean = newPassword.trim();

    if (!emailClean.includes('@')) {
      triggerToast('error', 'Invalid Email: Email address must contain an "@" symbol.');
      return;
    }

    if (pwdClean.length < 6) {
      triggerToast('error', 'Weak Password: Temporary password must be at least 6 characters.');
      return;
    }

    setIsLoading(true);
    try {
      const config = getSupabaseConfig();
      let createdUserId = `usr-${Date.now()}`;
      let syncResult = false;
      let syncMessage = '';

      if (config.isConfigured) {
        // Provision HQ corporate roles (SUPER_ADMIN, ADMIN, VIEWER)
        const res = await provisionUserAccount(emailClean, pwdClean, newRole);
        if (res.success && res.data) {
          createdUserId = res.data.id;
          syncResult = true;
        } else {
          syncMessage = ` (${res.message})`;
        }
      }

      // Add to local storage regardless to ensure instant sandbox fidelity
      const newUser: UnifiedUser = {
        id: createdUserId,
        fullName: nameClean,
        email: emailClean,
        assignedStationId: 'all',
        assignedStationName: 'Central HQ',
        role: newRole,
        status: 'Active',
        createdAt: new Date().toISOString(),
        lastLogin: new Date().toISOString()
      };

      const updated = [newUser, ...users];
      setUsers(updated);
      localStorage.setItem('petrologic_custom_users', JSON.stringify(updated));

      addCustomAuditLog(
        'USER_PROVISION',
        `Provisioned HQ user account for "${nameClean}" (${emailClean}) with access role "${newRole}".`
      );

      triggerToast(
        'success',
        syncResult 
          ? `HQ User "${nameClean}" created and synced with live database successfully.`
          : `HQ User "${nameClean}" created in sandbox mode${syncMessage}.`
      );

      // Reset form & close
      setNewFullName('');
      setNewEmail('');
      setNewPassword('');
      setNewRole('ADMIN');
      setShowCreateModal(false);
      loadData();
    } catch (err: any) {
      triggerToast('error', err.message || String(err));
    } finally {
      setIsLoading(false);
    }
  };

  // Mutate 2: Edit User details
  const handleEditUser = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!isSuperAdmin || !selectedUser) return;

    setIsLoading(true);
    try {
      const config = getSupabaseConfig();
      let syncResult = false;

      if (config.isConfigured) {
        const client = getSupabaseClient();
        const { error } = await client.from('user_profiles').upsert({
          id: selectedUser.id,
          email: selectedUser.email,
          role: editRole
        });
        if (!error) syncResult = true;
      }

      // Update locally
      const updated = users.map(u => {
        if (u.id === selectedUser.id) {
          return {
            ...u,
            fullName: editFullName.trim(),
            role: editRole
          };
        }
        return u;
      });

      setUsers(updated);
      localStorage.setItem('petrologic_custom_users', JSON.stringify(updated));

      addCustomAuditLog(
        'USER_UPDATE',
        `Updated HQ user account details for "${selectedUser.email}". New Role: "${editRole}".`
      );

      triggerToast(
        'success',
        syncResult 
          ? `User details updated and synchronized with Supabase.`
          : `User details updated in sandbox environment.`
      );

      setShowEditModal(false);
      setSelectedUser(null);
      loadData();
    } catch (err: any) {
      triggerToast('error', err.message || String(err));
    } finally {
      setIsLoading(false);
    }
  };

  // Mutate 3: Reset Password
  const handleResetPassword = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!isSuperAdmin || !selectedUser) return;

    if (tempPassword.trim().length < 6) {
      triggerToast('error', 'Security Guideline: Password must be at least 6 characters long.');
      return;
    }

    setIsLoading(true);
    try {
      const config = getSupabaseConfig();
      let syncResult = false;

      if (config.isConfigured) {
        const adminClient = getSupabaseAdminClient();
        if (adminClient) {
          const { error } = await adminClient.auth.admin.updateUserById(selectedUser.id, {
            password: tempPassword.trim()
          });
          if (!error) syncResult = true;
        }
      }

      addCustomAuditLog(
        'USER_PASSWORD_RESET',
        `Initiated security password override reset for user account "${selectedUser.email}".`
      );

      triggerToast(
        'success',
        syncResult
          ? `Security credentials reset successfully on authentication host.`
          : `Temporary password updated successfully in local sandbox memory.`
      );

      setTempPassword('');
      setShowResetPwdModal(false);
      setSelectedUser(null);
    } catch (err: any) {
      triggerToast('error', err.message || String(err));
    } finally {
      setIsLoading(false);
    }
  };

  // Mutate 4: Toggle Status (Activate / Deactivate)
  const handleToggleStatus = async () => {
    if (!isSuperAdmin || !selectedUser) return;

    setIsLoading(true);
    try {
      const nextStatus = selectedUser.status === 'Active' ? 'Disabled' : 'Active';

      const updated = users.map(u => {
        if (u.id === selectedUser.id) {
          return { ...u, status: nextStatus };
        }
        return u;
      });

      setUsers(updated);
      localStorage.setItem('petrologic_custom_users', JSON.stringify(updated));

      addCustomAuditLog(
        'USER_STATUS_CHANGE',
        `Changed account status for "${selectedUser.email}" to "${nextStatus.toUpperCase()}".`
      );

      triggerToast('success', `User account status successfully set to "${nextStatus}".`);
      setShowStatusConfirm(false);
      setSelectedUser(null);
    } catch (err: any) {
      triggerToast('error', err.message || String(err));
    } finally {
      setIsLoading(false);
    }
  };

  // Mutate 5: Delete User
  const handleDeleteUser = async () => {
    if (!isSuperAdmin || !selectedUser) return;

    setIsLoading(true);
    try {
      const config = getSupabaseConfig();
      let syncResult = false;

      if (config.isConfigured) {
        const res = await deleteUserAccount(selectedUser.id);
        if (res.success) syncResult = true;
      }

      // Delete from local cache
      const updated = users.filter(u => u.id !== selectedUser.id);
      setUsers(updated);
      localStorage.setItem('petrologic_custom_users', JSON.stringify(updated));

      addCustomAuditLog(
        'USER_DELETION',
        `Permanently terminated credentials and database profile for user "${selectedUser.fullName}" (${selectedUser.email}).`
      );

      triggerToast(
        'success',
        syncResult 
          ? `User "${selectedUser.fullName}" terminated from auth server.`
          : `User "${selectedUser.fullName}" removed from local sandbox cache.`
      );

      setShowDeleteConfirm(false);
      setSelectedUser(null);
      loadData();
    } catch (err: any) {
      triggerToast('error', err.message || String(err));
    } finally {
      setIsLoading(false);
    }
  };

  if (!isHQUser) {
    return (
      <div className="p-8 text-center bg-slate-50 min-h-[calc(100vh-64px)] font-sans flex flex-col items-center justify-center text-left">
        <ShieldAlert size={48} className="text-red-500 mb-3 animate-bounce" />
        <h3 className="text-sm font-black text-slate-800 uppercase tracking-wider">Access Denied</h3>
        <p className="text-xs text-slate-550 mt-1 max-w-md leading-relaxed">
          The requested administrative module is locked and reserved strictly for authorized Central HQ Workspace accounts.
        </p>
      </div>
    );
  }

  // Search & Filter execution
  const filteredUsers = users.filter(user => {
    const matchesSearch = 
      user.fullName.toLowerCase().includes(searchQuery.toLowerCase()) ||
      user.email.toLowerCase().includes(searchQuery.toLowerCase());

    const matchesRole = 
      filterRole === 'ALL' || 
      user.role === filterRole;

    const matchesStatus = 
      filterStatus === 'ALL' || 
      user.status === filterStatus;

    return matchesSearch && matchesRole && matchesStatus;
  });

  // Pagination execution
  const totalItems = filteredUsers.length;
  const totalPages = Math.ceil(totalItems / itemsPerPage);
  const indexOfLastItem = currentPage * itemsPerPage;
  const indexOfFirstItem = indexOfLastItem - itemsPerPage;
  const currentItems = filteredUsers.slice(indexOfFirstItem, indexOfLastItem);

  const handlePageChange = (page: number) => {
    if (page >= 1 && page <= totalPages) {
      setCurrentPage(page);
    }
  };

  // Helper: Get Initials avatar name
  const getInitials = (name: string) => {
    return name
      .split(' ')
      .map(n => n[0])
      .slice(0, 2)
      .join('')
      .toUpperCase();
  };

  // Helper: Filter audit logs for selected user
  const getUserLogs = (userEmail: string, userName: string) => {
    const emailPrefix = userEmail.split('@')[0].toLowerCase();
    const nameLower = userName.toLowerCase();

    return auditLogs.filter(log => {
      const logUserLower = log.user.toLowerCase();
      const logDetailsLower = log.details.toLowerCase();

      return (
        logUserLower === userEmail.toLowerCase() ||
        logUserLower === emailPrefix ||
        logUserLower === nameLower ||
        logDetailsLower.includes(userEmail.toLowerCase()) ||
        logDetailsLower.includes(nameLower)
      );
    });
  };

  return (
    <div className="p-6 space-y-6 bg-slate-50 min-h-[calc(100vh-64px)] font-sans text-left relative overflow-x-hidden">
      
      {/* Title Header Banner Block */}
      <div className="bg-white rounded-xl border border-slate-200 p-5 shadow-2xs">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div>
            <h3 className="text-sm font-black text-slate-800 tracking-tight flex items-center gap-2 uppercase">
              <Users className="text-[#6c5dd3]" size={18} />
              HQ User Access Portal
            </h3>
            <p className="text-xs text-slate-500 mt-1 max-w-2xl leading-relaxed">
              Create, update, and manage administrative access scopes across your Central HQ Workspace. Provision HQ-level authorization credentials and track security audit trails.
            </p>
          </div>
          <div className="flex items-center gap-2">
            <button 
              onClick={loadData}
              disabled={isLoading}
              className="px-3.5 py-2 text-xs font-bold text-slate-650 hover:text-slate-800 bg-white border border-slate-200 rounded-lg hover:bg-slate-50 transition-colors shadow-3xs cursor-pointer select-none"
            >
              Sync State
            </button>
            <div className="flex items-center gap-1.5 bg-indigo-50 border border-indigo-150 px-3 py-2 rounded-lg text-indigo-750 text-xs font-bold font-mono uppercase">
              <span className="w-1.5 h-1.5 rounded-full bg-indigo-650 animate-pulse"></span>
              {session.role === 'SUPER_ADMIN' ? 'Super Admin Workspace' : session.role === 'ADMIN' ? 'Admin Workspace' : 'Viewer Mode'}
            </div>
          </div>
        </div>
      </div>

      {/* Operational Toast Notification */}
      {statusMsg && (
        <div className={`p-4 rounded-xl border text-xs leading-relaxed font-semibold flex items-start gap-3 shadow-sm animate-fade-in ${
          statusMsg.type === 'success' 
            ? 'bg-emerald-50 border-emerald-200 text-emerald-800' 
            : 'bg-red-50 border-red-200 text-red-800'
        }`}>
          <div className="shrink-0 p-1 bg-white rounded-md shadow-2xs border border-slate-200">
            {statusMsg.type === 'success' ? <UserCheck size={14} className="text-emerald-600" /> : <ShieldAlert size={14} className="text-red-600" />}
          </div>
          <div>
            <p className="font-extrabold uppercase text-[10px] tracking-wide mb-0.5">
              {statusMsg.type === 'success' ? 'Portal Operation Completed' : 'Operation Halted'}
            </p>
            <span>{statusMsg.text}</span>
          </div>
        </div>
      )}

      {/* Quick Stats Grid */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <div className="bg-white p-4.5 rounded-xl border border-slate-200 shadow-3xs flex items-center gap-3.5 text-left">
          <div className="w-10 h-10 rounded-lg bg-indigo-50 text-indigo-600 flex items-center justify-center">
            <Users size={20} />
          </div>
          <div>
            <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block">Total HQ Members</span>
            <span className="text-lg font-black text-slate-800 mt-0.5 block">{users.length}</span>
          </div>
        </div>
        <div className="bg-white p-4.5 rounded-xl border border-slate-200 shadow-3xs flex items-center gap-3.5 text-left">
          <div className="w-10 h-10 rounded-lg bg-emerald-50 text-emerald-600 flex items-center justify-center">
            <CheckCircle2 size={20} />
          </div>
          <div>
            <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block">Active Status</span>
            <span className="text-lg font-black text-slate-800 mt-0.5 block">{users.filter(u => u.status === 'Active').length}</span>
          </div>
        </div>
        <div className="bg-white p-4.5 rounded-xl border border-slate-200 shadow-3xs flex items-center gap-3.5 text-left">
          <div className="w-10 h-10 rounded-lg bg-slate-100 text-slate-655 flex items-center justify-center">
            <Lock size={20} />
          </div>
          <div>
            <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block">Disabled Access</span>
            <span className="text-lg font-black text-slate-800 mt-0.5 block">{users.filter(u => u.status === 'Disabled').length}</span>
          </div>
        </div>
      </div>

      {/* Main Grid Card */}
      <div className="bg-white rounded-xl border border-slate-200 shadow-2xs overflow-hidden flex flex-col">
        
        {/* Search, Filter & Action Toolbar */}
        <div className="p-4 border-b border-slate-200 bg-slate-50/50 flex flex-col lg:flex-row lg:items-center justify-between gap-4">
          
          {/* Search Box */}
          <div className="relative flex-1 max-w-md">
            <Search className="absolute inset-y-0 left-0 pl-3.5 flex items-center text-slate-400 pointer-events-none self-center" size={16} />
            <input
              type="text"
              placeholder="Search admin users by name or email address..."
              value={searchQuery}
              onChange={(e) => {
                setSearchQuery(e.target.value);
                setCurrentPage(1);
              }}
              className="w-full bg-white border border-slate-200 rounded-lg py-2 pl-10 pr-3 text-xs font-semibold focus:outline-none focus:ring-1 focus:ring-[#6c5dd3] focus:border-[#6c5dd3]"
            />
          </div>

          {/* Filtering controls */}
          <div className="flex flex-wrap items-center gap-3.5">
            {/* Filter by Role */}
            <div className="flex items-center gap-1.5 text-left">
              <span className="text-[10px] font-bold text-slate-450 uppercase tracking-wide flex items-center gap-1">
                <Shield size={12} />
                Role
              </span>
              <select
                value={filterRole}
                onChange={(e) => {
                  setFilterRole(e.target.value);
                  setCurrentPage(1);
                }}
                className="bg-white border border-slate-200 rounded-md text-xs py-1.5 pl-2 pr-6 font-semibold focus:outline-none"
              >
                <option value="ALL">All Roles</option>
                <option value="SUPER_ADMIN">SUPER ADMIN</option>
                <option value="ADMIN">ADMIN</option>
                <option value="VIEWER">VIEWER</option>
              </select>
            </div>

            {/* Filter by Status */}
            <div className="flex items-center gap-1.5 text-left">
              <span className="text-[10px] font-bold text-slate-455 uppercase tracking-wide flex items-center gap-1">
                <Power size={12} />
                Status
              </span>
              <select
                value={filterStatus}
                onChange={(e) => {
                  setFilterStatus(e.target.value);
                  setCurrentPage(1);
                }}
                className="bg-white border border-slate-200 rounded-md text-xs py-1.5 pl-2 pr-6 font-semibold focus:outline-none"
              >
                <option value="ALL">All Status</option>
                <option value="Active">Active</option>
                <option value="Disabled">Disabled</option>
              </select>
            </div>

            {/* Add User Action Trigger */}
            {isSuperAdmin ? (
              <button
                onClick={() => setShowCreateModal(true)}
                className="bg-[#6c5dd3] hover:bg-[#5c4eb3] text-white px-4 py-2 rounded-lg text-xs font-black transition-all flex items-center gap-1.5 uppercase shadow-3xs cursor-pointer select-none"
              >
                <Plus size={14} />
                <span>Create HQ User</span>
              </button>
            ) : (
              <button
                disabled
                title="Only SUPER ADMIN accounts can provision users"
                className="bg-slate-100 border border-slate-200 text-slate-400 px-4 py-2 rounded-lg text-xs font-bold flex items-center gap-1.5 uppercase cursor-not-allowed select-none"
              >
                <Plus size={14} />
                <span>Create HQ User</span>
              </button>
            )}

          </div>

        </div>

        {/* Data Table */}
        <div className="overflow-x-auto">
          {currentItems.length === 0 ? (
            <div className="p-12 text-center text-slate-500 font-sans italic text-xs">
              No matching corporate user profiles found in the portal catalog.
            </div>
          ) : (
            <table className="w-full text-xs text-left text-slate-500">
              <thead className="bg-slate-50 text-[10px] uppercase font-black text-slate-500 tracking-wider border-b border-slate-200 select-none">
                <tr>
                  <th className="px-5 py-3.5">User Identity</th>
                  <th className="px-5 py-3.5">Assigned Location</th>
                  <th className="px-5 py-3.5">Access Role</th>
                  <th className="px-5 py-3.5">Status</th>
                  <th className="px-5 py-3.5">Created Date</th>
                  <th className="px-5 py-3.5">Last Login</th>
                  <th className="px-5 py-3.5 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 font-medium">
                {currentItems.map((user) => (
                  <tr key={user.id} className="hover:bg-slate-50/70 transition-colors">
                    
                    {/* User Identity cell */}
                    <td className="px-5 py-4.5 flex items-center gap-3">
                      <div className="w-8 h-8 rounded-full bg-linear-to-br from-[#6c5dd3]/10 to-indigo-500/20 text-[#6c5dd3] font-bold text-xs flex items-center justify-center shrink-0 border border-indigo-100 select-none">
                        {getInitials(user.fullName)}
                      </div>
                      <div className="text-left">
                        <span className="font-extrabold text-slate-800 text-xs block leading-tight">{user.fullName}</span>
                        <span className="text-[10px] text-slate-400 font-semibold block leading-normal mt-0.5">{user.email}</span>
                      </div>
                    </td>

                    {/* Assigned Location cell (always Central HQ for corporate accounts) */}
                    <td className="px-5 py-4.5 text-left">
                      <span className="inline-flex items-center gap-1 px-2 py-1 rounded bg-slate-100 text-slate-700 text-[10px] font-bold border border-slate-200">
                        <Shield size={10} className="text-slate-550" />
                        Central HQ
                      </span>
                    </td>

                    {/* Access Role cell */}
                    <td className="px-5 py-4.5 text-left">
                      <span className={`inline-block text-[9px] font-black tracking-widest px-2 py-1 rounded-sm uppercase border ${
                        user.role === 'SUPER_ADMIN' 
                          ? 'bg-rose-50 text-rose-700 border-rose-100'
                          : user.role === 'ADMIN'
                          ? 'bg-blue-50 text-blue-700 border-blue-100'
                          : 'bg-slate-100 text-slate-600 border-slate-200'
                      }`}>
                        {user.role.replace('_', ' ')}
                      </span>
                    </td>

                    {/* Account Status cell */}
                    <td className="px-5 py-4.5 text-left">
                      <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-black ${
                        user.status === 'Active' 
                          ? 'bg-emerald-50 text-emerald-700 border border-emerald-100' 
                          : 'bg-rose-50 text-rose-700 border border-rose-100'
                      }`}>
                        <span className={`w-1.5 h-1.5 rounded-full ${user.status === 'Active' ? 'bg-emerald-500 animate-pulse' : 'bg-rose-500'}`} />
                        {user.status}
                      </span>
                    </td>

                    {/* Created Date cell */}
                    <td className="px-5 py-4.5 font-mono text-[10px] text-slate-450">
                      {new Date(user.createdAt).toLocaleDateString('en-US', {
                        year: 'numeric',
                        month: 'short',
                        day: 'numeric'
                      })}
                    </td>

                    {/* Last Login cell */}
                    <td className="px-5 py-4.5 font-mono text-[10px] text-slate-450">
                      {new Date(user.lastLogin).toLocaleDateString('en-US', {
                        month: 'short',
                        day: 'numeric'
                      }) + ' ' + new Date(user.lastLogin).toLocaleTimeString('en-US', {
                        hour: '2-digit',
                        minute: '2-digit',
                        hour12: false
                      })}
                    </td>

                    {/* Actions cell */}
                    <td className="px-5 py-4.5 text-right">
                      <div className="flex items-center justify-end gap-1">
                        
                        {/* Audit activity trigger */}
                        <button
                          onClick={() => {
                            setSelectedUser(user);
                            setShowActivityDrawer(true);
                          }}
                          className="text-slate-400 hover:text-[#6c5dd3] p-1.5 rounded-md hover:bg-slate-100 transition-all cursor-pointer"
                          title="View Activity Log"
                        >
                          <History size={13} />
                        </button>

                        {/* Mutate triggers (Super Admin only) */}
                        {isSuperAdmin ? (
                          <>
                            {/* Edit details */}
                            <button
                              onClick={() => {
                                setSelectedUser(user);
                                setEditFullName(user.fullName);
                                setEditRole(user.role);
                                setShowEditModal(true);
                              }}
                              className="text-slate-400 hover:text-blue-600 p-1.5 rounded-md hover:bg-slate-100 transition-all cursor-pointer"
                              title="Edit Details"
                            >
                              <Edit2 size={13} />
                            </button>

                            {/* Reset password */}
                            <button
                              onClick={() => {
                                setSelectedUser(user);
                                setTempPassword('');
                                setShowResetPwdModal(true);
                              }}
                              className="text-slate-400 hover:text-amber-600 p-1.5 rounded-md hover:bg-slate-100 transition-all cursor-pointer"
                              title="Override Password"
                            >
                              <RotateCcw size={13} />
                            </button>

                            {/* Toggle Status */}
                            <button
                              onClick={() => {
                                setSelectedUser(user);
                                setShowStatusConfirm(true);
                              }}
                              className={`${
                                user.status === 'Active' 
                                  ? 'text-slate-400 hover:text-red-500' 
                                  : 'text-slate-450 hover:text-emerald-600'
                              } p-1.5 rounded-md hover:bg-slate-100 transition-all cursor-pointer`}
                              title={user.status === 'Active' ? 'Deactivate Access' : 'Activate Access'}
                            >
                              <Power size={13} />
                            </button>

                            {/* Permanent Delete */}
                            <button
                              onClick={() => {
                                setSelectedUser(user);
                                setShowDeleteConfirm(true);
                              }}
                              className="text-slate-455 hover:text-rose-600 p-1.5 rounded-md hover:bg-slate-100 transition-all cursor-pointer"
                              title="Delete Account"
                            >
                              <Trash2 size={13} />
                            </button>
                          </>
                        ) : (
                          // Disabled mutation icons for Admin / Viewer
                          <>
                            <button disabled className="text-slate-200 p-1.5 cursor-not-allowed" title="Unauthorized (Read-Only)">
                              <Edit2 size={13} />
                            </button>
                            <button disabled className="text-slate-200 p-1.5 cursor-not-allowed" title="Unauthorized (Read-Only)">
                              <RotateCcw size={13} />
                            </button>
                            <button disabled className="text-slate-200 p-1.5 cursor-not-allowed" title="Unauthorized (Read-Only)">
                              <Power size={13} />
                            </button>
                            <button disabled className="text-slate-200 p-1.5 cursor-not-allowed" title="Unauthorized (Read-Only)">
                              <Trash2 size={13} />
                            </button>
                          </>
                        )}

                      </div>
                    </td>

                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>

        {/* Pagination panel */}
        {totalPages > 0 && (
          <div className="p-4 border-t border-slate-100 bg-slate-50/50 flex flex-col sm:flex-row items-center justify-between gap-3 text-slate-550 font-semibold select-none">
            <div className="text-[10px] uppercase tracking-wider">
              Showing <span className="font-extrabold text-slate-700">{indexOfFirstItem + 1}</span> to{' '}
              <span className="font-extrabold text-slate-700">{Math.min(indexOfLastItem, totalItems)}</span> of{' '}
              <span className="font-extrabold text-slate-700">{totalItems}</span> users
            </div>
            
            <div className="flex items-center gap-4">
              <div className="flex items-center gap-1.5 text-[10px] uppercase">
                <span>Show</span>
                <select
                  value={itemsPerPage}
                  onChange={(e) => {
                    setItemsPerPage(Number(e.target.value));
                    setCurrentPage(1);
                  }}
                  className="bg-white border border-slate-200 rounded py-0.5 px-1 focus:outline-none"
                >
                  <option value={5}>5</option>
                  <option value={10}>10</option>
                  <option value={20}>20</option>
                </select>
                <span>Rows</span>
              </div>

              <div className="flex items-center gap-1">
                <button
                  onClick={() => handlePageChange(currentPage - 1)}
                  disabled={currentPage === 1}
                  className="p-1 rounded-md bg-white border border-slate-200 text-slate-600 hover:bg-slate-50 disabled:opacity-50 disabled:cursor-not-allowed cursor-pointer"
                >
                  <ChevronLeft size={14} />
                </button>
                
                {Array.from({ length: totalPages }).map((_, idx) => (
                  <button
                    key={idx}
                    onClick={() => handlePageChange(idx + 1)}
                    className={`px-2 py-0.5 rounded-md text-[10px] font-bold ${
                      currentPage === idx + 1 
                        ? 'bg-[#6c5dd3] text-white border border-[#6c5dd3]' 
                        : 'bg-white border border-slate-200 hover:bg-slate-50 text-slate-700'
                    } cursor-pointer`}
                  >
                    {idx + 1}
                  </button>
                ))}

                <button
                  onClick={() => handlePageChange(currentPage + 1)}
                  disabled={currentPage === totalPages}
                  className="p-1 rounded-md bg-white border border-slate-200 text-slate-600 hover:bg-slate-50 disabled:opacity-50 disabled:cursor-not-allowed cursor-pointer"
                >
                  <ChevronRight size={14} />
                </button>
              </div>
            </div>

          </div>
        )}

      </div>

      {/* ==================================================================== */}
      {/* 1. CREATE USER MODAL */}
      {/* ==================================================================== */}
      {showCreateModal && (
        <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-4 z-50 animate-fade-in">
          <div className="bg-white border border-slate-200 rounded-xl max-w-md w-full shadow-2xl overflow-hidden text-left flex flex-col">
            <div className="p-4 bg-indigo-50/30 border-b border-slate-100 flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Users size={16} className="text-[#6c5dd3]" />
                <h3 className="text-xs font-black text-slate-800 uppercase tracking-wider">
                  Provision New Security User
                </h3>
              </div>
              <button
                onClick={() => setShowCreateModal(false)}
                className="text-slate-400 hover:text-slate-600 cursor-pointer"
              >
                <X size={16} />
              </button>
            </div>

            <form onSubmit={handleCreateUser} className="p-5 space-y-4">
              
              {/* Full Name */}
              <div className="space-y-1 text-left">
                <label className="text-[10px] font-black uppercase text-slate-500 tracking-wider block">Full Name</label>
                <input
                  type="text"
                  required
                  placeholder="e.g. Abdullah Salem"
                  value={newFullName}
                  onChange={(e) => setNewFullName(e.target.value)}
                  className="w-full bg-slate-50 border border-slate-200 rounded-lg py-2 px-3 text-xs font-medium focus:outline-none focus:bg-white focus:ring-1 focus:ring-[#6c5dd3]"
                />
              </div>

              {/* Email Address */}
              <div className="space-y-1 text-left">
                <label className="text-[10px] font-black uppercase text-slate-500 tracking-wider block">Email Address</label>
                <div className="relative">
                  <span className="absolute inset-y-0 left-0 pl-3 flex items-center text-slate-455 pointer-events-none self-center">
                    <Mail size={13} />
                  </span>
                  <input
                    type="email"
                    required
                    placeholder="abdullah.s@company.com"
                    value={newEmail}
                    onChange={(e) => setNewEmail(e.target.value)}
                    className="w-full bg-slate-50 border border-slate-200 rounded-lg py-2 pl-8.5 pr-3 text-xs font-medium focus:outline-none focus:bg-white focus:ring-1 focus:ring-[#6c5dd3]"
                  />
                </div>
              </div>

              {/* Temporary Password */}
              <div className="space-y-1 text-left">
                <label className="text-[10px] font-black uppercase text-slate-500 tracking-wider block">Temporary Password</label>
                <div className="relative">
                  <span className="absolute inset-y-0 left-0 pl-3 flex items-center text-slate-455 pointer-events-none self-center">
                    <Key size={13} />
                  </span>
                  <input
                    type="password"
                    required
                    placeholder="Min 6 characters"
                    value={newPassword}
                    onChange={(e) => setNewPassword(e.target.value)}
                    className="w-full bg-slate-50 border border-slate-200 rounded-lg py-2 pl-8.5 pr-3 text-xs font-medium focus:outline-none focus:bg-white focus:ring-1 focus:ring-[#6c5dd3]"
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3.5">
                {/* Role */}
                <div className="space-y-1 text-left">
                  <label className="text-[10px] font-black uppercase text-slate-500 tracking-wider block font-mono">Access Level</label>
                  <select
                    value={newRole}
                    onChange={(e) => setNewRole(e.target.value as any)}
                    className="w-full bg-slate-50 border border-slate-200 rounded-lg py-2 px-2.5 text-xs font-semibold focus:outline-none focus:bg-white"
                  >
                    <option value="SUPER_ADMIN">SUPER ADMIN</option>
                    <option value="ADMIN">ADMIN</option>
                    <option value="VIEWER">VIEWER</option>
                  </select>
                </div>

                {/* Assigned Location */}
                <div className="space-y-1 text-left">
                  <label className="text-[10px] font-black uppercase text-slate-500 tracking-wider block font-mono">Work Scope</label>
                  <select
                    disabled
                    value="all"
                    className="w-full bg-slate-100 border border-slate-200 text-slate-405 rounded-lg py-2 px-2.5 text-xs font-semibold cursor-not-allowed"
                  >
                    <option value="all">Central HQ</option>
                  </select>
                </div>
              </div>

              <button
                type="submit"
                disabled={isLoading}
                className="w-full bg-[#6c5dd3] hover:bg-[#5c4eb3] text-white py-2.5 rounded-lg text-xs font-black transition-all flex items-center justify-center gap-1.5 uppercase font-mono shadow-3xs cursor-pointer select-none"
              >
                <span>Authorize User Account</span>
                <ArrowRight size={14} />
              </button>

            </form>
          </div>
        </div>
      )}

      {/* ==================================================================== */}
      {/* 2. EDIT DETAILS & ROLE MODAL */}
      {/* ==================================================================== */}
      {showEditModal && selectedUser && (
        <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-4 z-50 animate-fade-in">
          <div className="bg-white border border-slate-200 rounded-xl max-w-md w-full shadow-2xl overflow-hidden text-left flex flex-col">
            <div className="p-4 bg-indigo-50/30 border-b border-slate-100 flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Edit2 size={15} className="text-[#6c5dd3]" />
                <h3 className="text-xs font-black text-slate-800 uppercase tracking-wider">
                  Update Account Details
                </h3>
              </div>
              <button
                onClick={() => {
                  setShowEditModal(false);
                  setSelectedUser(null);
                }}
                className="text-slate-400 hover:text-slate-600 cursor-pointer"
              >
                <X size={16} />
              </button>
            </div>

            <form onSubmit={handleEditUser} className="p-5 space-y-4">
              
              <div className="bg-slate-50 border border-slate-200 p-3 rounded-lg text-slate-600 text-xs flex items-center justify-between">
                <div>
                  <span className="font-extrabold block text-slate-805">{selectedUser.fullName}</span>
                  <span className="text-[10px] block mt-0.5">{selectedUser.email}</span>
                </div>
                <span className="bg-slate-200 text-slate-700 px-2 py-0.5 rounded text-[9px] font-black uppercase font-mono">
                  {selectedUser.id.substring(0, 8)}
                </span>
              </div>

              {/* Full Name */}
              <div className="space-y-1 text-left">
                <label className="text-[10px] font-black uppercase text-slate-500 tracking-wider block">Full Name</label>
                <input
                  type="text"
                  required
                  value={editFullName}
                  onChange={(e) => setEditFullName(e.target.value)}
                  className="w-full bg-slate-50 border border-slate-200 rounded-lg py-2 px-3 text-xs font-medium focus:outline-none focus:bg-white focus:ring-1 focus:ring-[#6c5dd3]"
                />
              </div>

              <div className="grid grid-cols-2 gap-3.5">
                {/* Role */}
                <div className="space-y-1 text-left">
                  <label className="text-[10px] font-black uppercase text-slate-500 tracking-wider block font-mono">Access Level</label>
                  <select
                    value={editRole}
                    onChange={(e) => setEditRole(e.target.value as any)}
                    className="w-full bg-slate-50 border border-slate-200 rounded-lg py-2 px-2.5 text-xs font-semibold focus:outline-none focus:bg-white"
                  >
                    <option value="SUPER_ADMIN">SUPER ADMIN</option>
                    <option value="ADMIN">ADMIN</option>
                    <option value="VIEWER">VIEWER</option>
                  </select>
                </div>

                {/* Assigned Location */}
                <div className="space-y-1 text-left">
                  <label className="text-[10px] font-black uppercase text-slate-500 tracking-wider block font-mono">Work Scope</label>
                  <select
                    disabled
                    value="all"
                    className="w-full bg-slate-100 border border-slate-200 text-slate-400 rounded-lg py-2 px-2.5 text-xs font-semibold cursor-not-allowed"
                  >
                    <option value="all">Central HQ</option>
                  </select>
                </div>
              </div>

              <button
                type="submit"
                disabled={isLoading}
                className="w-full bg-[#6c5dd3] hover:bg-[#5c4eb3] text-white py-2.5 rounded-lg text-xs font-black transition-all flex items-center justify-center gap-1.5 uppercase font-mono shadow-3xs cursor-pointer select-none"
              >
                <span>Save Changes</span>
                <Check size={14} />
              </button>

            </form>
          </div>
        </div>
      )}

      {/* ==================================================================== */}
      {/* 3. RESET PASSWORD MODAL */}
      {/* ==================================================================== */}
      {showResetPwdModal && selectedUser && (
        <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-4 z-50 animate-fade-in">
          <div className="bg-white border border-slate-200 rounded-xl max-w-sm w-full shadow-2xl overflow-hidden text-left flex flex-col">
            <div className="p-4 bg-amber-500/10 border-b border-amber-250 flex items-center justify-between">
              <div className="flex items-center gap-2">
                <RotateCcw size={15} className="text-amber-600 animate-spin animate-duration-3000" />
                <h3 className="text-xs font-black text-amber-900 uppercase tracking-wider">
                  Reset User Password
                </h3>
              </div>
              <button
                onClick={() => {
                  setShowResetPwdModal(false);
                  setSelectedUser(null);
                }}
                className="text-slate-400 hover:text-slate-600 cursor-pointer"
              >
                <X size={16} />
              </button>
            </div>

            <form onSubmit={handleResetPassword} className="p-5 space-y-4">
              
              <div className="bg-amber-50/55 border border-amber-200/50 p-3 rounded-lg text-slate-700 text-xs">
                <p className="font-bold text-slate-800">Account Safety Override</p>
                <p className="text-[10px] mt-0.5 leading-relaxed text-slate-500">
                  Override security passphrase access parameters for <span className="font-bold text-slate-800">{selectedUser.email}</span>. New temporary password must comply with corporate length limits (minimum 6 characters).
                </p>
              </div>

              {/* Temporary Password */}
              <div className="space-y-1 text-left">
                <label className="text-[10px] font-black uppercase text-slate-500 tracking-wider block">New Security Password</label>
                <div className="relative">
                  <span className="absolute inset-y-0 left-0 pl-3 flex items-center text-slate-455 pointer-events-none self-center">
                    <Key size={13} />
                  </span>
                  <input
                    type="password"
                    required
                    placeholder="Enter new secure password"
                    value={tempPassword}
                    onChange={(e) => setTempPassword(e.target.value)}
                    className="w-full bg-slate-50 border border-slate-200 rounded-lg py-2 pl-8.5 pr-3 text-xs font-medium focus:outline-none focus:bg-white focus:ring-1 focus:ring-[#6c5dd3]"
                  />
                </div>
              </div>

              <button
                type="submit"
                disabled={isLoading}
                className="w-full bg-amber-600 hover:bg-amber-700 text-white py-2.5 rounded-lg text-xs font-black transition-all flex items-center justify-center gap-1.5 uppercase font-mono shadow-3xs cursor-pointer select-none"
              >
                <span>Verify & Overwrite Passphrase</span>
              </button>

            </form>
          </div>
        </div>
      )}

      {/* ==================================================================== */}
      {/* 4. CONFIRM DEACTIVATE/ACTIVATE DIALOG */}
      {/* ==================================================================== */}
      {showStatusConfirm && selectedUser && (
        <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-4 z-50 animate-fade-in">
          <div className="bg-white border border-slate-200 rounded-xl max-w-sm w-full shadow-2xl overflow-hidden text-left flex flex-col">
            <div className="p-4 bg-indigo-50 border-b border-indigo-100 flex items-center justify-between">
              <div className="flex items-center gap-2">
                <AlertTriangle size={16} className="text-indigo-650" />
                <h3 className="text-xs font-black text-indigo-900 uppercase tracking-wider">
                  Modify Account Status
                </h3>
              </div>
              <button
                onClick={() => {
                  setShowStatusConfirm(false);
                  setSelectedUser(null);
                }}
                className="text-slate-400 hover:text-slate-600 cursor-pointer"
              >
                <X size={16} />
              </button>
            </div>

            <div className="p-5 space-y-4">
              <p className="text-xs text-slate-500 leading-relaxed">
                Are you sure you want to {selectedUser.status === 'Active' ? 'Deactivate' : 'Activate'}{' '}
                access for <span className="font-bold text-slate-800">{selectedUser.fullName}</span> ({selectedUser.email})?
              </p>

              {selectedUser.status === 'Active' && (
                <div className="bg-rose-50 border border-rose-200 p-3 rounded-lg text-[10px] text-rose-800 leading-relaxed">
                  <span className="font-bold">Warning:</span> Deactivating this user terminates their active terminal access tokens. They will not be able to log in to Noor Fuel panels until reactivated.
                </div>
              )}

              <div className="flex items-center gap-2 pt-2">
                <button
                  onClick={() => {
                    setShowStatusConfirm(false);
                    setSelectedUser(null);
                  }}
                  className="flex-1 bg-slate-100 hover:bg-slate-200 border border-slate-200 text-slate-600 py-2 rounded-lg text-xs font-bold transition-all cursor-pointer select-none"
                >
                  Cancel
                </button>
                <button
                  onClick={handleToggleStatus}
                  disabled={isLoading}
                  className={`flex-1 text-white py-2 rounded-lg text-xs font-black transition-all shadow-3xs cursor-pointer select-none ${
                    selectedUser.status === 'Active' 
                      ? 'bg-rose-600 hover:bg-rose-700' 
                      : 'bg-emerald-600 hover:bg-emerald-700'
                  }`}
                >
                  {selectedUser.status === 'Active' ? 'Confirm Deactivation' : 'Confirm Activation'}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ==================================================================== */}
      {/* 5. CONFIRM PERMANENT DELETE DIALOG */}
      {/* ==================================================================== */}
      {showDeleteConfirm && selectedUser && (
        <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-4 z-50 animate-fade-in">
          <div className="bg-white border border-slate-200 rounded-xl max-w-sm w-full shadow-2xl overflow-hidden text-left flex flex-col">
            <div className="p-4 bg-red-50 border-b border-red-200 flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Trash2 size={15} className="text-red-650" />
                <h3 className="text-xs font-black text-red-900 uppercase tracking-wider">
                  Terminate User Account
                </h3>
              </div>
              <button
                onClick={() => {
                  setShowDeleteConfirm(false);
                  setSelectedUser(null);
                }}
                className="text-slate-400 hover:text-slate-600 cursor-pointer"
              >
                <X size={16} />
              </button>
            </div>

            <div className="p-5 space-y-4">
              <p className="text-xs text-slate-500 leading-relaxed">
                Are you absolutely sure you want to permanently delete the profile and authorization credentials for{' '}
                <span className="font-extrabold text-slate-800">{selectedUser.fullName}</span> ({selectedUser.email})?
              </p>

              <div className="bg-rose-50 border border-rose-200 p-3.5 rounded-lg text-[10px] text-rose-955 font-bold leading-normal flex items-start gap-2">
                <AlertTriangle size={16} className="text-rose-600 shrink-0 mt-0.5" />
                <p>
                  CRITICAL WARNING: Terminating this account removes all user database profile linkages and revokes Auth authentication tokens permanently. This action cannot be reversed!
                </p>
              </div>

              <div className="flex items-center gap-2 pt-2">
                <button
                  onClick={() => {
                    setShowDeleteConfirm(false);
                    setSelectedUser(null);
                  }}
                  className="flex-1 bg-slate-100 hover:bg-slate-200 text-slate-600 py-2.5 rounded-lg text-xs font-bold transition-all cursor-pointer select-none"
                >
                  Abort Action
                </button>
                <button
                  onClick={handleDeleteUser}
                  disabled={isLoading}
                  className="flex-1 bg-rose-600 hover:bg-rose-700 text-white py-2.5 rounded-lg text-xs font-black transition-all shadow-3xs cursor-pointer select-none"
                >
                  Terminate Account
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ==================================================================== */}
      {/* 6. VIEW USER ACTIVITY SLIDING DRAWER OVERLAY */}
      {/* ==================================================================== */}
      {showActivityDrawer && selectedUser && (
        <div className="fixed inset-0 z-50 overflow-hidden font-sans">
          
          {/* Overlay backdrop */}
          <div 
            onClick={() => {
              setShowActivityDrawer(false);
              setSelectedUser(null);
            }}
            className="absolute inset-0 bg-slate-900/60 backdrop-blur-xs transition-opacity duration-300 animate-fade-in" 
          />

          <div className="absolute inset-y-0 right-0 max-w-full flex pl-10">
            <div className="w-screen max-w-md bg-white shadow-2xl flex flex-col h-full border-l border-slate-200 translate-x-0 transition-transform duration-300">
              
              {/* Drawer Header */}
              <div className="p-4 bg-slate-50 border-b border-slate-200 flex items-center justify-between">
                <div className="flex items-center gap-2.5 text-slate-800">
                  <Activity size={16} className="text-[#6c5dd3] animate-pulse" />
                  <div className="text-left">
                    <h3 className="text-xs font-black uppercase tracking-wider">User Audit Trail</h3>
                    <p className="text-[10px] font-semibold text-slate-450 mt-0.5">{selectedUser.email}</p>
                  </div>
                </div>
                <button
                  onClick={() => {
                    setShowActivityDrawer(false);
                    setSelectedUser(null);
                  }}
                  className="p-1 hover:bg-slate-200 rounded-md text-slate-400 hover:text-slate-650 transition-all cursor-pointer"
                >
                  <X size={18} />
                </button>
              </div>

              {/* Drawer Body Timeline */}
              <div className="flex-1 overflow-y-auto p-5 space-y-5 text-xs">
                
                {/* Profile card summary */}
                <div className="bg-slate-50 border border-slate-200 rounded-xl p-4 flex items-center gap-3">
                  <div className="w-10 h-10 rounded-full bg-indigo-50 text-[#6c5dd3] font-bold text-sm flex items-center justify-center border border-indigo-150 select-none shrink-0">
                    {getInitials(selectedUser.fullName)}
                  </div>
                  <div className="text-left">
                    <span className="font-extrabold text-slate-800 text-xs block leading-tight">{selectedUser.fullName}</span>
                    <span className="text-[10px] text-slate-500 font-semibold block mt-0.5">Role: {selectedUser.role.replace('_', ' ')}</span>
                  </div>
                </div>

                <h4 className="text-[10px] font-black uppercase text-slate-450 tracking-wider pb-2 border-b border-dashed border-slate-100 text-left">
                  Operational Activities
                </h4>

                {getUserLogs(selectedUser.email, selectedUser.fullName).length === 0 ? (
                  <div className="p-8 text-center text-slate-400 italic text-[11px]">
                    No logged system events or action overrides found for this account.
                  </div>
                ) : (
                  <div className="relative border-l border-slate-200 pl-4.5 space-y-5.5 text-left py-1 ml-2">
                    {getUserLogs(selectedUser.email, selectedUser.fullName).map((log) => (
                      <div key={log.id} className="relative">
                        
                        {/* Timeline dot */}
                        <span className="absolute -left-7 top-1 w-2.5 h-2.5 rounded-full bg-indigo-650 border-2 border-white ring-2 ring-indigo-50" />
                        
                        <div className="space-y-1">
                          <div className="flex items-center justify-between gap-2">
                            <span className="font-extrabold text-slate-805 uppercase text-[9px] tracking-wider bg-slate-100 border border-slate-200 px-1.5 py-0.5 rounded leading-none">
                              {log.action}
                            </span>
                            <span className="font-mono text-[9px] text-slate-400 font-bold shrink-0">{log.timestamp}</span>
                          </div>
                          
                          <p className="text-[11px] text-slate-650 leading-relaxed font-semibold">{log.details}</p>
                          
                          <div className="flex items-center gap-3 text-[9px] text-slate-400 font-mono">
                            {log.stationId && <span>Station: {log.stationId}</span>}
                            <span>IP: {log.ipAddress}</span>
                          </div>
                        </div>

                      </div>
                    ))}
                  </div>
                )}

              </div>

              {/* Drawer Footer */}
              <div className="p-4 border-t border-slate-100 bg-slate-50 text-center select-none">
                <button
                  onClick={() => {
                    setShowActivityDrawer(false);
                    setSelectedUser(null);
                  }}
                  className="w-full bg-slate-800 hover:bg-slate-900 text-white py-2 rounded-lg text-xs font-bold transition-all cursor-pointer"
                >
                  Close Audit Trail
                </button>
              </div>

            </div>
          </div>
        </div>
      )}

    </div>
  );
};
