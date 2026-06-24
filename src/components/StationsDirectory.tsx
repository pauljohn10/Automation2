/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useEffect } from 'react';
import { useFuelSystem } from '../context';
import { FuelStation, FuelTank, FuelPump, FuelGrade } from '../types';
import { 
  Building2, Plus, X, Server, ShieldCheck, MapPin, Check, 
  Database, Sparkles, RefreshCw, AlertCircle, Settings, Key, 
  Trash2, WifiOff, Wifi, Pencil, Eye, EyeOff, User, Layers, 
  Droplet, Lock, Copy, CheckCircle2, ChevronRight, Fuel, Shield
} from 'lucide-react';
import { 
  getSupabaseConfig, saveSupabaseOverrides, clearSupabaseOverrides, 
  recordOnboardedUser, fetchOnboardedUsers, SupabaseUserRecord, 
  checkSupabaseConnectivity, getSupabaseClient 
} from '../supabaseClient';

export const StationsDirectory: React.FC = () => {
  const { 
    stations, tanks, pumps, addStation, deleteStation, 
    updateStationStatus, refreshAllFromSupabase, session, addCustomAuditLog 
  } = useFuelSystem();

  // Protect view: only accessible to SUPER_ADMIN, ADMIN, or VIEWER
  const isHQUser = session.role === 'SUPER_ADMIN' || session.role === 'ADMIN' || session.role === 'VIEWER';
  if (!isHQUser) {
    return (
      <div className="p-8 text-center bg-slate-50 min-h-[calc(100vh-64px)] font-sans flex flex-col items-center justify-center">
        <Building2 size={48} className="text-rose-500 mb-3 animate-pulse" />
        <h3 className="text-sm font-black text-slate-800 uppercase tracking-wider">Access Denied</h3>
        <p className="text-xs text-slate-500 mt-1 max-w-md leading-relaxed">
          The requested Tenant Stations Network Master Registry is locked and reserved strictly for authorized HQ Corporate Administrators.
        </p>
      </div>
    );
  }

  // Modals visibility states
  const [showWizard, setShowWizard] = useState(false);
  const [editingStation, setEditingStation] = useState<FuelStation | null>(null);
  const [stationToDelete, setStationToDelete] = useState<FuelStation | null>(null);
  const [showSyncSettings, setShowSyncSettings] = useState(false);
  const [showSupervisorRegistry, setShowSupervisorRegistry] = useState(false);

  // Password visibility states (masked by default)
  const [showPasswordMap, setShowPasswordMap] = useState<Record<string, boolean>>({});

  // Search and Filter states
  const [searchQuery, setSearchQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState<'ALL' | 'ACTIVE' | 'MAINTENANCE' | 'INACTIVE'>('ALL');

  // Deletion confirmation code input
  const [deleteConfirmCode, setDeleteConfirmCode] = useState('');

  // Save/operation notifications
  const [saveError, setSaveError] = useState<string | null>(null);
  const [successNotif, setSuccessNotif] = useState('');
  const [saveSuccessStationId, setSaveSuccessStationId] = useState<string | null>(null);

  // Supabase states
  const [supabaseUsers, setSupabaseUsers] = useState<Array<SupabaseUserRecord | any>>([]);
  const [isSyncing, setIsSyncing] = useState(false);
  const [syncStatusText, setSyncStatusText] = useState<string | null>(null);
  const [connectivity, setConnectivity] = useState<{ checked: boolean; reachable: boolean; message: string }>({
    checked: false, reachable: false, message: ''
  });
  const [dbConfig, setDbConfig] = useState(getSupabaseConfig());
  const [inputUrl, setInputUrl] = useState(getSupabaseConfig().isLocalOverride ? localStorage.getItem('supabase_url_override') || '' : '');
  const [inputKey, setInputKey] = useState(getSupabaseConfig().isLocalOverride ? localStorage.getItem('supabase_key_override') || '' : '');

  // -------------------------------------------------------------
  // Wizard (Onboarding Form) States
  // -------------------------------------------------------------
  const [wizardTab, setWizardTab] = useState<'general' | 'assets' | 'credentials' | 'pricing'>('general');
  const [newStationName, setNewStationName] = useState('');
  const [newStationCode, setNewStationCode] = useState('');
  const [newLocation, setNewLocation] = useState('');
  const [newManager, setNewManager] = useState('');
  const [supervisorUsername, setSupervisorUsername] = useState('');
  const [supervisorPassword, setSupervisorPassword] = useState('');
  const [tankCount, setTankCount] = useState(2);
  const [dispenserCount, setDispenserCount] = useState(1);
  const [pumpsPerDispenser, setPumpsPerDispenser] = useState(2);
  const [dispenserNozzles, setDispenserNozzles] = useState<number[]>([2]);
  const [tankConfigs, setTankConfigs] = useState<Array<{ label: string, fuelType: FuelGrade, capacity: number }>>([
    { label: 'Tank 01', fuelType: 'GAS91', capacity: 45000 },
    { label: 'Tank 02', fuelType: 'GAS95', capacity: 45000 }
  ]);
  const [pumpConfigs, setPumpConfigs] = useState<Array<{ dispenserNo: number, pumpNo: number, label: string, fuelType: FuelGrade }>>([
    { dispenserNo: 1, pumpNo: 1, label: 'Dispenser 01 - Pump 1', fuelType: 'GAS91' },
    { dispenserNo: 1, pumpNo: 2, label: 'Dispenser 01 - Pump 2', fuelType: 'GAS95' }
  ]);

  // -------------------------------------------------------------
  // Edit Modal States
  // -------------------------------------------------------------
  const [editTab, setEditTab] = useState<'general' | 'assets' | 'credentials' | 'pricing'>('general');
  const [editName, setEditName] = useState('');
  const [editCode, setEditCode] = useState('');
  const [editManager, setEditManager] = useState('');
  const [editLocation, setEditLocation] = useState('');
  const [editUsername, setEditUsername] = useState('');
  const [editPassword, setEditPassword] = useState('');
  const [editPriceGas91, setEditPriceGas91] = useState('');
  const [editPriceGas95, setEditPriceGas95] = useState('');
  const [editTankConfigs, setEditTankConfigs] = useState<Array<{ id?: string; label: string; fuelType: FuelGrade; capacity: number }>>([]);
  const [editDispenserCount, setEditDispenserCount] = useState(1);
  const [editDispenserNozzles, setEditDispenserNozzles] = useState<number[]>([]);
  const [editPumpConfigs, setEditPumpConfigs] = useState<Array<{ id?: string; dispenserNo: number; pumpNo: number; label: string; fuelType: FuelGrade; status?: string }>>([]);

  // Fetch users & connection check on mount
  useEffect(() => {
    loadUsersAndConnectivity();
  }, [dbConfig]);

  const loadUsersAndConnectivity = async () => {
    try {
      const ping = await checkSupabaseConnectivity();
      setConnectivity({ checked: true, reachable: ping.reachable, message: ping.message });
    } catch (err: any) {
      setConnectivity({ checked: true, reachable: false, message: err.message || 'Connection test failed.' });
    }

    try {
      const data = await fetchOnboardedUsers();
      const cachedUsersStr = sessionStorage.getItem('fuel_system_onboarded_users_fallback');
      const fallbackUsers: SupabaseUserRecord[] = cachedUsersStr ? JSON.parse(cachedUsersStr) : [];
      const combined = [...fallbackUsers, ...data];
      const unique = Array.from(new Map(combined.map(u => [u.id, u])).values());
      setSupabaseUsers(unique);
    } catch (err) {
      const cachedUsersStr = sessionStorage.getItem('fuel_system_onboarded_users_fallback');
      if (cachedUsersStr) {
        setSupabaseUsers(JSON.parse(cachedUsersStr));
      }
    }
  };

  const refreshSupabaseData = async () => {
    setIsSyncing(true);
    setSyncStatusText('Refreshing cloud database state...');
    try {
      await loadUsersAndConnectivity();
      setSyncStatusText('Refreshed successfully.');
    } catch (err: any) {
      setSyncStatusText(`Refresh failed: ${err.message}`);
    } finally {
      setIsSyncing(false);
      setTimeout(() => setSyncStatusText(null), 3000);
    }
  };

  // Toggle Password Masking
  const togglePasswordVisibility = (stationId: string) => {
    setShowPasswordMap(prev => ({
      ...prev,
      [stationId]: !prev[stationId]
    }));
  };

  // -------------------------------------------------------------
  // Wizard Handlers
  // -------------------------------------------------------------
  const handleTankCountChange = (count: number) => {
    const safeCount = Math.max(1, Math.min(8, count));
    setTankCount(safeCount);
    setTankConfigs(prev => {
      const fuels: FuelGrade[] = ['GAS91', 'GAS95', 'GAS98', 'DIESEL'];
      const next = [...prev];
      if (next.length < safeCount) {
        for (let i = next.length; i < safeCount; i++) {
          next.push({
            label: `Tank ${String(i + 1).padStart(2, '0')}`,
            fuelType: fuels[i % fuels.length],
            capacity: 45000
          });
        }
      } else if (next.length > safeCount) {
        next.splice(safeCount);
      }
      return next;
    });
  };

  const updateTankConfig = (index: number, key: 'fuelType' | 'capacity', value: any) => {
    setTankConfigs(prev => prev.map((c, i) => i === index ? { ...c, [key]: value } : c));
  };

  const handleDispenserCountChange = (count: number) => {
    const safeCount = Math.max(1, Math.min(6, count));
    setDispenserCount(safeCount);
    setDispenserNozzles(prev => {
      let nextNozzles = [...prev];
      if (nextNozzles.length < safeCount) {
        for (let i = nextNozzles.length; i < safeCount; i++) {
          nextNozzles.push(2);
        }
      } else if (nextNozzles.length > safeCount) {
        nextNozzles = nextNozzles.slice(0, safeCount);
      }
      updatePumpConfigsFromNozzles(nextNozzles);
      return nextNozzles;
    });
  };

  const handleNozzleCountChange = (dispenserIndex: number, count: number) => {
    const safeNozzles = Math.max(1, Math.min(4, count));
    setDispenserNozzles(prev => {
      const nextNozzles = [...prev];
      nextNozzles[dispenserIndex] = safeNozzles;
      updatePumpConfigsFromNozzles(nextNozzles);
      return nextNozzles;
    });
  };

  const updatePumpConfigsFromNozzles = (nozzlesArray: number[]) => {
    setPumpConfigs(prev => {
      const fuels: FuelGrade[] = ['GAS91', 'GAS95', 'GAS98', 'DIESEL'];
      const nextConfigs: Array<{ dispenserNo: number, pumpNo: number, label: string, fuelType: FuelGrade }> = [];
      
      nozzlesArray.forEach((nozzleCount, dIndex) => {
        const d = dIndex + 1;
        for (let p = 1; p <= nozzleCount; p++) {
          const existing = prev.find(pc => pc.dispenserNo === d && pc.pumpNo === p);
          if (existing) {
            nextConfigs.push(existing);
          } else {
            const indexOnDispenser = p - 1;
            nextConfigs.push({
              dispenserNo: d,
              pumpNo: p,
              label: `Dispenser ${String(d).padStart(2, '0')} - Pump ${p}`,
              fuelType: fuels[indexOnDispenser % fuels.length]
            });
          }
        }
      });
      return nextConfigs;
    });
  };

  const handleCreateStation = (e: React.FormEvent) => {
    e.preventDefault();
    setSuccessNotif('');

    if (!newStationName || !newStationCode || !newLocation || !newManager || !supervisorUsername || !supervisorPassword) {
      alert('Please fill out all onboarding fields, including supervisor credentials.');
      return;
    }

    const newId = `st-onboard-${Date.now()}`;
    const newStationObj: FuelStation = {
      id: newId,
      name: newStationName,
      code: newStationCode.toUpperCase(),
      location: newLocation,
      manager: newManager,
      status: 'ACTIVE',
      fuelPricing: {
        GAS91: 2.18,
        GAS95: 2.33,
        GAS98: 2.60,
        DIESEL: 1.15
      },
      username: supervisorUsername,
      password: supervisorPassword,
      dispenserCount: dispenserCount,
      pumpsPerDispenser: pumpsPerDispenser
    };

    const timestamp = new Date().toLocaleDateString('en-US', { month: '2-digit', day: '2-digit' }) + ' ' + new Date().toLocaleTimeString('en-US', { hour12: false, hour: '2-digit', minute: '2-digit' });

    const newTanksObj: FuelTank[] = tankConfigs.map((tc, index) => ({
      id: `tank-${String(index + 1).padStart(2, '0')}-${newId}`,
      stationId: newId,
      label: tc.label,
      fuelType: tc.fuelType,
      capacity: tc.capacity,
      currentLevel: 0, 
      temperature: 34.00,
      waterLevel: 0.00,
      lastMeasurementTime: timestamp
    }));

    const newPumpsObj: FuelPump[] = pumpConfigs.map(pc => {
      const dStr = String(pc.dispenserNo).padStart(2, '0');
      return {
        id: `pump-d${dStr}-p${pc.pumpNo}-${newId}`,
        stationId: newId,
        label: `Dispenser ${dStr} - Pump ${pc.pumpNo}`,
        status: 'IDLE',
        fuelType: pc.fuelType
      };
    });

    const userPayload: SupabaseUserRecord = {
      id: `usr-${Date.now()}`,
      station_id: newId,
      station_name: newStationName,
      station_code: newStationCode.toUpperCase(),
      username: supervisorUsername,
      password_raw: supervisorPassword,
      full_name: `${newManager} (Supervisor)`,
      role: 'supervisor',
      created_at: new Date().toISOString()
    };

    setIsSyncing(true);

    try {
      const cachedUsersStr = sessionStorage.getItem('fuel_system_onboarded_users_fallback');
      const fallbackList: SupabaseUserRecord[] = cachedUsersStr ? JSON.parse(cachedUsersStr) : [];
      fallbackList.unshift(userPayload);
      sessionStorage.setItem('fuel_system_onboarded_users_fallback', JSON.stringify(fallbackList));
    } catch (err) {
      console.error('Session cache error:', err);
    }

    addStation(newStationObj, newTanksObj, newPumpsObj).then((dbRes) => {
      recordOnboardedUser(userPayload).then((res) => {
        setIsSyncing(false);
        if (res.success) {
          setSuccessNotif(`Station "${newStationName}" successfully onboarded and cloud synced.`);
          loadUsersAndConnectivity();
        } else {
          setSuccessNotif(`Station "${newStationName}" onboarded locally (Offline Mode).`);
          setSupabaseUsers(prev => {
            const combined = [userPayload, ...prev];
            return Array.from(new Map(combined.map(u => [u.id, u])).values());
          });
        }
      });
    }).catch((err) => {
      recordOnboardedUser(userPayload).then(() => {
        setIsSyncing(false);
        setSuccessNotif(`Station "${newStationName}" onboarded locally (Error: ${err.message || err})`);
      });
    });

    // Reset Form Fields
    setNewStationName('');
    setNewStationCode('');
    setNewLocation('');
    setNewManager('');
    setSupervisorUsername('');
    setSupervisorPassword('');
    setTankCount(2);
    setDispenserCount(1);
    setTankConfigs([
      { label: 'Tank 01', fuelType: 'GAS91', capacity: 45000 },
      { label: 'Tank 02', fuelType: 'GAS95', capacity: 45000 }
    ]);
    setPumpConfigs([
      { dispenserNo: 1, pumpNo: 1, label: 'Dispenser 01 - Pump 1', fuelType: 'GAS91' },
      { dispenserNo: 1, pumpNo: 2, label: 'Dispenser 01 - Pump 2', fuelType: 'GAS95' }
    ]);
    setShowWizard(false);
    setWizardTab('general');
    setTimeout(() => setSuccessNotif(''), 6000);
  };

  // -------------------------------------------------------------
  // Edit Form Handlers
  // -------------------------------------------------------------
  const openEditModal = (station: FuelStation) => {
    setEditingStation(station);
    setEditName(station.name);
    setEditCode(station.code);
    setEditManager(station.manager);
    setEditLocation(station.location);
    setEditUsername(station.username || `${station.code.toLowerCase()}.supervisor`);
    setEditPassword(station.password || 'password123');
    setEditPriceGas91(station.fuelPricing.GAS91.toString());
    setEditPriceGas95(station.fuelPricing.GAS95.toString());
    setSaveError(null);
    setEditTab('general');

    const stationTanks = tanks.filter(t => t.stationId === station.id);
    setEditTankConfigs(stationTanks.map(t => ({
      id: t.id,
      label: t.label,
      fuelType: t.fuelType,
      capacity: t.capacity
    })));

    const stationDispenserCount = station.dispenserCount || 1;
    setEditDispenserCount(stationDispenserCount);

    const stationPumps = pumps.filter(p => p.stationId === station.id);
    const nozzlesArray: number[] = [];
    for (let d = 1; d <= stationDispenserCount; d++) {
      const count = stationPumps.filter(p => {
        const dispenserNoMatch = p.label.match(/Dispenser\s*(\d+)/i) || p.label.match(/Disp\s*(\d+)/i);
        const dispNo = dispenserNoMatch ? parseInt(dispenserNoMatch[1]) : 1;
        return dispNo === d;
      }).length;
      nozzlesArray.push(count || 2);
    }
    setEditDispenserNozzles(nozzlesArray);

    setEditPumpConfigs(stationPumps.map((p, idx) => {
      const dispenserNoMatch = p.label.match(/Dispenser\s*(\d+)/i) || p.label.match(/Disp\s*(\d+)/i);
      const dispNo = dispenserNoMatch ? parseInt(dispenserNoMatch[1]) : 1;
      const pumpNoMatch = p.label.match(/Pump\s*(\d+)/i) || p.label.match(/Nozzle\s*(\d+)/i);
      const pumpNo = pumpNoMatch ? parseInt(pumpNoMatch[1]) : (idx % 2 + 1);
      return {
        id: p.id,
        label: p.label,
        dispenserNo: dispNo,
        pumpNo: pumpNo,
        fuelType: p.fuelType as FuelGrade,
        status: p.status
      };
    }));
  };

  const handleEditTankCountChange = (newCount: number) => {
    if (newCount < 1 || newCount > 8) return;
    setEditTankConfigs(prev => {
      if (newCount > prev.length) {
        const next = [...prev];
        for (let i = prev.length; i < newCount; i++) {
          next.push({
            label: `Tank ${String(i + 1).padStart(2, '0')}`,
            fuelType: 'GAS91',
            capacity: 45000
          });
        }
        return next;
      } else if (newCount < prev.length) {
        return prev.slice(0, newCount);
      }
      return prev;
    });
  };

  const handleEditDispenserCountChange = (newCount: number) => {
    if (newCount < 1 || newCount > 6) return;
    setEditDispenserCount(newCount);
    setEditDispenserNozzles(prev => {
      let next = [...prev];
      if (newCount > prev.length) {
        for (let i = prev.length; i < newCount; i++) {
          next.push(2);
        }
      } else if (newCount < prev.length) {
        next = next.slice(0, newCount);
      }
      updateEditPumpConfigsFromNozzles(next);
      return next;
    });
  };

  const handleEditNozzleCountChange = (dispIndex: number, newNozzles: number) => {
    if (newNozzles < 1 || newNozzles > 4) return;
    setEditDispenserNozzles(prev => {
      const next = [...prev];
      next[dispIndex] = newNozzles;
      updateEditPumpConfigsFromNozzles(next);
      return next;
    });
  };

  const updateEditPumpConfigsFromNozzles = (nozzlesArray: number[]) => {
    setEditPumpConfigs(prev => {
      const fuels: FuelGrade[] = ['GAS91', 'GAS95', 'GAS98', 'DIESEL'];
      const nextConfigs: Array<{ id?: string; dispenserNo: number; pumpNo: number; label: string; fuelType: FuelGrade; status?: string }> = [];
      
      nozzlesArray.forEach((nozzleCount, dIndex) => {
        const d = dIndex + 1;
        for (let p = 1; p <= nozzleCount; p++) {
          const existing = prev.find(pc => pc.dispenserNo === d && pc.pumpNo === p);
          if (existing) {
            nextConfigs.push(existing);
          } else {
            const indexOnDispenser = p - 1;
            nextConfigs.push({
              label: `Dispenser ${String(d).padStart(2, '0')} - Pump ${p}`,
              dispenserNo: d,
              pumpNo: p,
              fuelType: fuels[indexOnDispenser % fuels.length],
              status: 'IDLE'
            });
          }
        }
      });
      return nextConfigs;
    });
  };

  const handleUpdateStationSave = async () => {
    if (!editingStation) return;
    if (!editManager.trim() || !editUsername.trim() || !editPassword.trim() || !editPriceGas91 || !editPriceGas95) {
      setSaveError('Please ensure all required fields are valid and not empty.');
      return;
    }

    try {
      setSaveError(null);
      const updatedPricingJson = {
        ...editingStation.fuelPricing,
        GAS91: parseFloat(editPriceGas91),
        GAS95: parseFloat(editPriceGas95)
      };

      const supabase = getSupabaseClient();

      // 1. Update Core Station specs
      const { error: stationUpdateErr } = await supabase
        .from('stations')
        .update({
          name: editName,
          manager: editManager,
          location: editLocation,
          username: editUsername,
          password: editPassword,
          fuelPricing: updatedPricingJson,
          dispenserCount: editDispenserCount,
          pumpsPerDispenser: editDispenserNozzles[0] || 2
        })
        .eq('id', editingStation.id);

      if (stationUpdateErr) {
        throw new Error(`Station specifications update failed: ${stationUpdateErr.message}`);
      }

      // 2. Sync credentials row
      const { data: existingUsers } = await supabase
        .from('onboarded_users')
        .select('*')
        .eq('station_id', editingStation.id);

      const userId = (existingUsers && existingUsers.length > 0) ? existingUsers[0].id : `usr-edit-${editingStation.id}-${Date.now().toString().slice(-4)}`;
      await supabase
        .from('onboarded_users')
        .upsert({
          id: userId,
          station_id: editingStation.id,
          station_name: editName,
          station_code: editCode.toUpperCase(),
          username: editUsername,
          password_raw: editPassword,
          full_name: `${editManager} (Supervisor)`,
          role: 'supervisor'
        });

      // 3. Sync Tanks (inserts/deletes)
      const tanksWithIds = editTankConfigs.map((t, index) => ({
        id: t.id || `tank-edit-${index + 1}-${editingStation.id}`,
        stationId: editingStation.id,
        label: t.label || `Tank ${String(index + 1).padStart(2, '0')}`,
        fuelType: t.fuelType,
        capacity: parseFloat(t.capacity.toString()) || 45050,
        currentLevel: 11000,
        temperature: 34.0,
        waterLevel: 0.0,
        lastMeasurementTime: new Date().toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' })
      }));

      const { data: dbTanks } = await supabase.from('fuel_tanks').select('id').eq('stationId', editingStation.id);
      const dbTankIds = dbTanks?.map(t => t.id) || [];
      const liveTankIds = tanksWithIds.map(t => t.id);
      const tIdsToDelete = dbTankIds.filter(id => !liveTankIds.includes(id));

      if (tIdsToDelete.length > 0) {
        await supabase.from('fuel_tanks').delete().in('id', tIdsToDelete);
      }
      await supabase.from('fuel_tanks').upsert(tanksWithIds);

      // 4. Sync Pumps (inserts/deletes)
      const pumpsWithIds = editPumpConfigs.map((p, index) => ({
        id: p.id || `pump-edit-${index + 1}-${editingStation.id}`,
        stationId: editingStation.id,
        label: p.label || `Dispenser ${String(p.dispenserNo).padStart(2, '0')} - Pump ${p.pumpNo}`,
        status: p.status || 'IDLE',
        fuelType: p.fuelType,
        activeFuelGrade: p.fuelType,
        flowRate: 40.00,
        volumeThisSession: 0.00
      }));

      const { data: dbPumps } = await supabase.from('fuel_pumps').select('id').eq('stationId', editingStation.id);
      const dbPumpIds = dbPumps?.map(p => p.id) || [];
      const livePumpIds = pumpsWithIds.map(p => p.id);
      const pIdsToDelete = dbPumpIds.filter(id => !livePumpIds.includes(id));

      if (pIdsToDelete.length > 0) {
        await supabase.from('fuel_pumps').delete().in('id', pIdsToDelete);
      }
      await supabase.from('fuel_pumps').upsert(pumpsWithIds);

      // Custom column fallbacks
      try {
        await supabase
          .from('stations')
          .update({
            manager: editManager,
            supervisor_user: editUsername,
            passphrase: editPassword,
            default_price_gas91: parseFloat(editPriceGas91),
            default_price_gas95: parseFloat(editPriceGas95)
          } as any)
          .eq('id', editingStation.id);
      } catch (err) {
        console.warn('Fallback settings warning: ', err);
      }

      setSaveSuccessStationId(editingStation.id);
      setEditingStation(null);
      await refreshAllFromSupabase();

      addCustomAuditLog(
        'STATION_SPEC_UPDATE',
        `Updated operational specs for station "${editName}" (${editCode.toUpperCase()}).`,
        editingStation.id
      );

      setTimeout(() => setSaveSuccessStationId(null), 3500);
    } catch (err: any) {
      setSaveError(err.message || 'Failed saving updates.');
    }
  };

  // -------------------------------------------------------------
  // Deletion Handler
  // -------------------------------------------------------------
  const handleDeleteStationTrigger = async () => {
    if (!stationToDelete) return;
    if (deleteConfirmCode.toUpperCase() !== stationToDelete.code.toUpperCase()) {
      alert('Verification code prefix mismatch. Re-enter exact station code.');
      return;
    }

    try {
      const stationName = stationToDelete.name;
      const res = await deleteStation(stationToDelete.id);
      if (res.success) {
        setSuccessNotif(`Station "${stationName}" and child database assets permanently deleted.`);
        setStationToDelete(null);
        setDeleteConfirmCode('');
        await refreshAllFromSupabase();
        setTimeout(() => setSuccessNotif(''), 6000);
      } else {
        alert(`Deletion Error: ${res.error?.message || 'Sync failed.'}`);
      }
    } catch (err: any) {
      alert(`Fatal: ${err.message || err}`);
    }
  };

  // -------------------------------------------------------------
  // DB Sync Overrides Form Handler
  // -------------------------------------------------------------
  const handleSaveConfig = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!inputUrl.trim() || !inputKey.trim()) return;
    saveSupabaseOverrides(inputUrl, inputKey);
    const updated = getSupabaseConfig();
    setDbConfig(updated);
    
    setIsSyncing(true);
    const res = await refreshAllFromSupabase();
    setIsSyncing(false);
    if (res.success) {
      alert('Live Supabase connectivity linked and synced.');
      setShowSyncSettings(false);
    } else {
      alert(`Linked credentials but sync check reported error: ${res.message}`);
    }
  };

  const handleClearConfig = async () => {
    clearSupabaseOverrides();
    setInputUrl('');
    setInputKey('');
    setDbConfig(getSupabaseConfig());
    
    setIsSyncing(true);
    await refreshAllFromSupabase();
    setIsSyncing(false);
    alert('Overrides cleared. Defaulting to system environment values.');
    setShowSyncSettings(false);
  };

  // Filter stations based on search queries
  const filteredStations = stations.filter(station => {
    const matchesSearch = 
      station.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
      station.code.toLowerCase().includes(searchQuery.toLowerCase()) ||
      station.location.toLowerCase().includes(searchQuery.toLowerCase()) ||
      station.manager.toLowerCase().includes(searchQuery.toLowerCase());
    
    const matchesStatus = statusFilter === 'ALL' || station.status === statusFilter;
    return matchesSearch && matchesStatus;
  });

  const statusColors: Record<string, string> = {
    ACTIVE: 'bg-emerald-50 text-emerald-700 border border-emerald-250',
    MAINTENANCE: 'bg-amber-50 text-amber-700 border border-amber-250',
    INACTIVE: 'bg-slate-100 text-slate-700 border border-slate-200'
  };

  const isSuperAdmin = session.role === 'SUPER_ADMIN';

  return (
    <div className="p-6 space-y-6 bg-slate-50 min-h-[calc(100vh-64px)] font-sans text-left">
      {/* Top Banner / Actions Control */}
      <div className="flex flex-col xl:flex-row xl:items-center justify-between gap-4 bg-white p-6 rounded-xl border border-slate-200 shadow-2xs">
        <div className="space-y-1">
          <h3 className="text-sm font-black text-slate-800 tracking-tight uppercase flex items-center gap-2">
            <Building2 size={18} className="text-[#6c5dd3]" />
            Retail Stations Master Registry
          </h3>
          <p className="text-xs text-slate-500 leading-normal">
            Configure retail network tenants, review inventory storage capacities, map pumps, and manage localized supervisor login keys.
          </p>
        </div>

        <div className="flex items-center gap-2 flex-wrap">
          {/* Cloud Sync Status Indicator */}
          <div className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg border text-[10px] font-bold uppercase transition-all ${
            connectivity.reachable 
              ? 'bg-emerald-50 text-emerald-800 border-emerald-200' 
              : 'bg-amber-50 text-amber-800 border-amber-200 animate-pulse'
          }`}>
            <span className={`w-2 h-2 rounded-full ${connectivity.reachable ? 'bg-emerald-500' : 'bg-amber-500'}`} />
            <span>{connectivity.reachable ? 'Cloud Sync Online' : 'Local Sandbox Mode'}</span>
          </div>

          <button
            onClick={() => setShowSupervisorRegistry(true)}
            className="flex items-center gap-1.5 bg-slate-50 hover:bg-slate-100 border border-slate-200 text-slate-700 px-3 py-1.5 rounded-lg text-[11px] font-black uppercase transition-colors"
          >
            <Shield size={12} className="text-slate-500" />
            <span>Supervisors List</span>
          </button>

          {isSuperAdmin && (
            <button
              onClick={() => setShowSyncSettings(true)}
              className="flex items-center gap-1.5 bg-indigo-50 hover:bg-indigo-100 border border-indigo-150 text-indigo-700 px-3 py-1.5 rounded-lg text-[11px] font-black uppercase transition-colors"
            >
              <Settings size={12} />
              <span>DB Connection</span>
            </button>
          )}

          <button
            onClick={refreshSupabaseData}
            disabled={isSyncing}
            className="flex items-center gap-1 bg-slate-50 hover:bg-slate-100 border border-slate-200 text-slate-750 p-2 rounded-lg transition-colors"
            title="Refresh Directory Data"
          >
            <RefreshCw size={14} className={isSyncing ? 'animate-spin' : ''} />
          </button>

          {isSuperAdmin ? (
            <button
              onClick={() => setShowWizard(true)}
              className="bg-[#6c5dd3] hover:bg-[#5c4eb3] text-white px-3.5 py-2 rounded-lg text-[11px] font-black transition-all shadow-xs flex items-center gap-2 uppercase"
            >
              <Plus size={14} />
              Onboard Station
            </button>
          ) : (
            <div className="text-[10px] text-slate-400 bg-slate-100 border border-slate-200 px-3 py-2 rounded-lg font-bold select-none cursor-not-allowed">
              Onboarding Locked (Super Admin Only)
            </div>
          )}
        </div>
      </div>

      {/* Operation Status Notifications */}
      {successNotif && (
        <div className="bg-emerald-50 border border-emerald-250 rounded-xl p-4 text-xs text-emerald-800 font-bold flex items-center gap-3 animate-fade-in shadow-2xs">
          <ShieldCheck className="text-emerald-600 shrink-0 animate-bounce" size={18} />
          <span>{successNotif}</span>
        </div>
      )}

      {syncStatusText && (
        <div className="bg-indigo-50 border border-indigo-200 rounded-xl p-3 text-xs text-indigo-800 font-bold flex items-center gap-2 animate-pulse shadow-2xs">
          <Sparkles className="text-[#6c5dd3]" size={16} />
          <span>{syncStatusText}</span>
        </div>
      )}

      {/* Filter and Search Bar */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 bg-white p-4 rounded-xl border border-slate-200 shadow-2xs">
        <div className="flex-1 max-w-md relative">
          <input
            type="text"
            placeholder="Search stations by name, code, manager, or location..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full bg-slate-50 border border-slate-250 rounded-lg py-2 pl-3 pr-8 text-xs text-slate-800 placeholder-slate-405 font-medium focus:outline-none focus:bg-white focus:ring-1 focus:ring-[#6c5dd3]"
          />
          {searchQuery && (
            <button 
              onClick={() => setSearchQuery('')}
              className="absolute right-2.5 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600"
            >
              <X size={14} />
            </button>
          )}
        </div>

        <div className="flex items-center gap-2">
          <span className="text-[10px] text-slate-400 font-extrabold uppercase shrink-0">Filter Status:</span>
          <div className="flex bg-slate-50 border border-slate-200 rounded-lg p-1">
            {(['ALL', 'ACTIVE', 'MAINTENANCE', 'INACTIVE'] as const).map(option => (
              <button
                key={option}
                onClick={() => setStatusFilter(option)}
                className={`px-3 py-1 rounded-md text-[10px] font-black uppercase transition-all ${
                  statusFilter === option 
                    ? 'bg-white text-slate-800 shadow-3xs font-extrabold' 
                    : 'text-slate-400 hover:text-slate-700'
                }`}
              >
                {option}
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* Directory Grid */}
      {filteredStations.length === 0 ? (
        <div className="bg-white rounded-xl border border-slate-200 p-12 text-center text-slate-400 font-semibold shadow-2xs flex flex-col items-center justify-center space-y-2">
          <Building2 size={36} className="text-slate-300" />
          <p className="text-xs">No station matches your active search queries or status filter.</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {filteredStations.map((station) => {
            const associatedTanks = tanks.filter(t => t.stationId === station.id);
            const totalCapacity = associatedTanks.reduce((sum, t) => sum + t.capacity, 0);
            const stationPumps = pumps.filter(p => p.stationId === station.id);
            const isPasswordVisible = showPasswordMap[station.id] || false;

            return (
              <div 
                key={station.id} 
                className="bg-white rounded-xl border border-slate-200 shadow-2xs p-5 flex flex-col justify-between space-y-4 hover:shadow-xs transition-shadow relative overflow-hidden"
              >
                {/* Save status notification overlay */}
                {saveSuccessStationId === station.id && (
                  <div className="absolute inset-0 bg-emerald-500/10 backdrop-blur-2xs flex items-center justify-center p-4 z-10 transition-opacity animate-fade-in">
                    <div className="bg-white border border-emerald-200 rounded-lg p-3 text-xs text-emerald-800 font-bold shadow-md flex items-center gap-1.5">
                      <CheckCircle2 size={16} className="text-emerald-500 shrink-0" />
                      <span>Specifications saved!</span>
                    </div>
                  </div>
                )}

                {/* Card Header */}
                <div className="flex justify-between items-start gap-2">
                  <div className="space-y-0.5">
                    <span className="text-[9px] font-black uppercase text-[#6c5dd3] tracking-widest block">Station Tenant</span>
                    <h4 className="text-sm font-black text-slate-800 tracking-tight leading-tight">{station.name}</h4>
                    <span className="inline-block text-[10px] font-mono font-black bg-slate-50 border border-slate-200 text-slate-500 px-1.5 py-0.5 rounded uppercase mt-1">
                      CODE: {station.code}
                    </span>
                  </div>

                  <span className={`text-[10px] uppercase font-black px-2 py-0.5 rounded-full ${statusColors[station.status] || 'bg-slate-100 text-slate-800'}`}>
                    {station.status}
                  </span>
                </div>

                {/* Card Content Grid */}
                <div className="grid grid-cols-1 gap-2 pt-2 border-t border-slate-100 text-xs font-semibold text-slate-500">
                  <div className="flex items-center gap-2">
                    <MapPin size={14} className="text-slate-400 shrink-0" />
                    <span className="text-slate-700 truncate" title={station.location}>{station.location}</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <User size={14} className="text-slate-400 shrink-0" />
                    <span className="text-slate-700">{station.manager}</span>
                  </div>
                </div>

                {/* Assets Summary Panel */}
                <div className="bg-slate-55 border border-slate-200 rounded-lg p-3 grid grid-cols-2 gap-2 text-xs font-semibold">
                  <div className="space-y-1 border-r border-slate-200 pr-2">
                    <span className="text-[9px] uppercase font-black text-slate-400 tracking-wider block">Reservoirs</span>
                    <div className="flex items-center gap-1.5 text-slate-700">
                      <Droplet size={14} className="text-indigo-500" />
                      <div>
                        <div className="font-bold">{associatedTanks.length} Tanks</div>
                        <div className="text-[9px] text-slate-400 font-mono">{(totalCapacity / 1000).toFixed(0)}k Liters</div>
                      </div>
                    </div>
                  </div>

                  <div className="space-y-1 pl-2">
                    <span className="text-[9px] uppercase font-black text-slate-400 tracking-wider block">Hardware</span>
                    <div className="flex items-center gap-1.5 text-slate-700">
                      <Server size={14} className="text-[#6c5dd3]" />
                      <div>
                        <div className="font-bold">{station.dispenserCount || 1} Dispenser</div>
                        <div className="text-[9px] text-slate-400 font-mono">{stationPumps.length} Nozzles</div>
                      </div>
                    </div>
                  </div>
                </div>

                {/* Retail Pricing Panel */}
                <div className="border-t border-slate-100 pt-2 text-xs font-semibold">
                  <span className="text-[9px] uppercase font-black text-slate-400 tracking-wider block mb-1">Pricing Benchmarks (SAR)</span>
                  <div className="flex items-center gap-3 text-slate-700">
                    <div className="bg-slate-50 border border-slate-200 px-2 py-1 rounded flex items-center gap-1">
                      <span className="text-[9px] font-black text-slate-400 uppercase font-sans">91</span>
                      <span className="font-mono font-bold text-slate-700">{station.fuelPricing.GAS91.toFixed(2)}</span>
                    </div>
                    <div className="bg-slate-50 border border-slate-200 px-2 py-1 rounded flex items-center gap-1">
                      <span className="text-[9px] font-black text-slate-400 uppercase font-sans">95</span>
                      <span className="font-mono font-bold text-slate-700">{station.fuelPricing.GAS95.toFixed(2)}</span>
                    </div>
                  </div>
                </div>

                {/* supervisor Credentials Masked Toggle Box */}
                <div className="bg-indigo-50/50 border border-indigo-100 rounded-lg p-3 text-xs space-y-1">
                  <div className="flex items-center justify-between text-slate-400">
                    <span className="text-[9px] uppercase font-black tracking-wider block">Supervisor Account</span>
                    <button
                      onClick={() => togglePasswordVisibility(station.id)}
                      className="text-[#6c5dd3] hover:text-[#5c4eb3] p-0.5 rounded hover:bg-indigo-50 transition-colors"
                      title={isPasswordVisible ? 'Mask passphrase' : 'Show supervisor credentials'}
                    >
                      {isPasswordVisible ? <EyeOff size={13} /> : <Eye size={13} />}
                    </button>
                  </div>

                  <div className="flex flex-col gap-1 text-slate-700 font-medium font-sans">
                    <div className="flex items-center justify-between">
                      <span className="text-slate-450 text-[10px]">Username:</span>
                      <span className="font-bold font-mono text-slate-800">{station.username || `${station.code.toLowerCase()}.supervisor`}</span>
                    </div>
                    <div className="flex items-center justify-between">
                      <span className="text-slate-450 text-[10px]">Passphrase:</span>
                      <span className="font-mono text-emerald-700 font-bold">
                        {isPasswordVisible ? (station.password || 'password123') : '••••••••'}
                      </span>
                    </div>
                  </div>
                </div>

                {/* Card Actions Footer */}
                <div className="flex items-center justify-between gap-1.5 pt-3 border-t border-slate-100 mt-2">
                  <select
                    value={station.status}
                    onChange={(e) => {
                      if (session.role === 'VIEWER') {
                        alert('Access Denied: Read-only VIEWER profile cannot modify station status.');
                        return;
                      }
                      updateStationStatus(station.id, e.target.value as any);
                    }}
                    disabled={session.role === 'VIEWER'}
                    className="text-xs bg-white border border-[#cbd5e0] rounded-lg px-2.5 py-1.5 font-bold text-slate-750 hover:bg-slate-50 disabled:opacity-50 disabled:cursor-not-allowed focus:outline-none"
                  >
                    <option value="ACTIVE">ACTIVE</option>
                    <option value="MAINTENANCE">MAINTENANCE</option>
                    <option value="INACTIVE">INACTIVE</option>
                  </select>

                  <div className="flex items-center gap-1">
                    {session.role !== 'VIEWER' && (
                      <button
                        onClick={() => openEditModal(station)}
                        className="p-1.5 text-slate-500 hover:text-indigo-650 hover:bg-slate-100 rounded-lg transition-all border border-slate-200"
                        title="Edit Station Specifications"
                      >
                        <Pencil size={13} />
                      </button>
                    )}
                    
                    {isSuperAdmin && (
                      <button
                        onClick={() => {
                          setStationToDelete(station);
                          setDeleteConfirmCode('');
                        }}
                        className="p-1.5 text-rose-500 hover:text-rose-700 hover:bg-rose-50 rounded-lg transition-all border border-rose-200"
                        title="Delete Station and assets"
                      >
                        <Trash2 size={13} />
                      </button>
                    )}
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* ========================================================= */}
      {/* 1. ONBOARD NEW STATION INSTANCE WIZARD MODAL */}
      {/* ========================================================= */}
      {showWizard && (
        <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-4 z-50 animate-fade-in">
          <div className="bg-white rounded-xl border border-slate-200 shadow-2xl p-6 max-w-md w-full max-h-[90vh] overflow-y-auto scroll-smooth flex flex-col justify-between text-left">
            
            {/* Modal Header */}
            <div className="flex items-center justify-between pb-3 border-b border-slate-150">
              <div className="flex items-center gap-2">
                <div className="p-1.5 bg-[#efecfe] text-[#6c5dd3] rounded-lg">
                  <Building2 size={16} />
                </div>
                <h3 className="text-xs font-black text-slate-800 tracking-wider uppercase">
                  Onboard Station Instance
                </h3>
              </div>
              <button 
                onClick={() => { setShowWizard(false); setWizardTab('general'); }} 
                className="text-slate-400 hover:text-slate-650 p-1 rounded-md"
              >
                <X size={16} />
              </button>
            </div>

            {/* Modal Steps Tabs Navigation */}
            <div className="flex border-b border-slate-100 mt-3 text-[10px] font-black uppercase text-slate-400 select-none">
              {(['general', 'assets', 'credentials', 'pricing'] as const).map(tab => (
                <button
                  key={tab}
                  type="button"
                  onClick={() => setWizardTab(tab)}
                  className={`flex-1 text-center py-2 border-b-2 transition-all ${
                    wizardTab === tab 
                      ? 'border-[#6c5dd3] text-[#6c5dd3] font-black' 
                      : 'border-transparent hover:text-slate-655'
                  }`}
                >
                  {tab}
                </button>
              ))}
            </div>

            {/* Form */}
            <form onSubmit={handleCreateStation} className="space-y-4 mt-4 text-xs font-sans flex-1">
              
              {/* Tab 1: General Specs */}
              {wizardTab === 'general' && (
                <div className="space-y-3 animate-fade-in">
                  <div className="space-y-1">
                    <label className="font-bold text-slate-600 block uppercase text-[9px] tracking-wider">Station Name</label>
                    <input
                      type="text"
                      placeholder="e.g. Riyadh Exit 4 - Al Yasmeen"
                      value={newStationName}
                      onChange={(e) => setNewStationName(e.target.value)}
                      className="w-full bg-slate-50 border border-slate-250 rounded-lg p-2.5 text-slate-800 font-semibold focus:outline-none focus:bg-white focus:ring-1 focus:ring-[#6c5dd3]"
                      required
                    />
                  </div>

                  <div className="grid grid-cols-2 gap-3">
                    <div className="space-y-1">
                      <label className="font-bold text-slate-600 block uppercase text-[9px] tracking-wider">Branch Code</label>
                      <input
                        type="text"
                        placeholder="e.g. RY-YAS-04"
                        value={newStationCode}
                        onChange={(e) => setNewStationCode(e.target.value)}
                        className="w-full bg-slate-50 border border-slate-250 rounded-lg p-2.5 text-slate-850 font-mono font-bold uppercase focus:outline-none focus:bg-white focus:ring-1 focus:ring-[#6c5dd3]"
                        required
                      />
                    </div>
                    <div className="space-y-1">
                      <label className="font-bold text-slate-600 block uppercase text-[9px] tracking-wider">Logistics Manager</label>
                      <input
                        type="text"
                        placeholder="e.g. Tariq Alharbi"
                        value={newManager}
                        onChange={(e) => setNewManager(e.target.value)}
                        className="w-full bg-slate-50 border border-slate-250 rounded-lg p-2.5 text-slate-800 font-semibold focus:outline-none focus:bg-white focus:ring-1 focus:ring-[#6c5dd3]"
                        required
                      />
                    </div>
                  </div>

                  <div className="space-y-1">
                    <label className="font-bold text-slate-600 block uppercase text-[9px] tracking-wider">Physical Location / Address</label>
                    <input
                      type="text"
                      placeholder="e.g. King Fahd Branch Rd, Al Yasmin, Riyadh"
                      value={newLocation}
                      onChange={(e) => setNewLocation(e.target.value)}
                      className="w-full bg-slate-50 border border-slate-250 rounded-lg p-2.5 text-slate-800 font-medium focus:outline-none focus:bg-white focus:ring-1 focus:ring-[#6c5dd3]"
                      required
                    />
                  </div>
                </div>
              )}

              {/* Tab 2: Inventory & Hardware configuration */}
              {wizardTab === 'assets' && (
                <div className="space-y-3.5 animate-fade-in">
                  {/* Tanks Specs */}
                  <div className="bg-slate-55 border border-slate-200 rounded-lg p-3 space-y-2.5 text-left">
                    <div className="flex items-center justify-between">
                      <span className="text-[10px] uppercase font-black text-slate-600">Storage Reservoir Lines</span>
                      <div className="flex items-center gap-1 bg-white border border-slate-200 rounded px-1">
                        <button 
                          type="button" 
                          onClick={() => handleTankCountChange(tankCount - 1)}
                          className="w-5 h-5 font-bold hover:bg-slate-100 rounded text-slate-500 text-xs flex items-center justify-center"
                          disabled={tankCount <= 1}
                        >
                          -
                        </button>
                        <span className="w-5 text-center font-mono font-bold text-slate-800 text-[11px]">{tankCount}</span>
                        <button 
                          type="button" 
                          onClick={() => handleTankCountChange(tankCount + 1)}
                          className="w-5 h-5 font-bold hover:bg-slate-100 rounded text-slate-500 text-xs flex items-center justify-center"
                          disabled={tankCount >= 8}
                        >
                          +
                        </button>
                      </div>
                    </div>

                    <div className="space-y-1.5 max-h-32 overflow-y-auto pr-0.5">
                      {tankConfigs.map((tc, index) => (
                        <div key={index} className="flex items-center gap-2 bg-white p-2 rounded border border-slate-150 justify-between">
                          <span className="font-bold text-slate-700 min-w-[50px]">{tc.label}</span>
                          <div className="flex items-center gap-1.5">
                            <select
                              value={tc.fuelType}
                              onChange={(e) => updateTankConfig(index, 'fuelType', e.target.value as FuelGrade)}
                              className="bg-slate-50 border border-slate-200 rounded px-1 py-0.5 text-[9px] font-semibold text-slate-700 focus:outline-none"
                            >
                              <option value="GAS91">GAS91</option>
                              <option value="GAS95">GAS95</option>
                              <option value="GAS98">GAS98</option>
                              <option value="DIESEL">DIESEL</option>
                            </select>
                            <input
                              type="number"
                              min="5000"
                              max="100000"
                              step="5000"
                              value={tc.capacity}
                              onChange={(e) => updateTankConfig(index, 'capacity', Number(e.target.value))}
                              className="w-14 bg-slate-50 border border-slate-200 rounded px-1 py-0.5 text-[9px] font-semibold text-slate-800 text-right focus:outline-none"
                            />
                            <span className="text-[9px] text-slate-400">L</span>
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>

                  {/* Dispensers Specs */}
                  <div className="bg-slate-55 border border-slate-200 rounded-lg p-3 space-y-2.5 text-left">
                    <div className="flex items-center justify-between">
                      <span className="text-[10px] uppercase font-black text-slate-600">Dispensers Count</span>
                      <div className="flex items-center gap-1 bg-white border border-slate-200 rounded px-1">
                        <button 
                          type="button" 
                          onClick={() => handleDispenserCountChange(dispenserCount - 1)}
                          className="w-5 h-5 font-bold hover:bg-slate-100 rounded text-slate-500 text-xs flex items-center justify-center"
                          disabled={dispenserCount <= 1}
                        >
                          -
                        </button>
                        <span className="w-5 text-center font-mono font-bold text-slate-800 text-[11px]">{dispenserCount}</span>
                        <button 
                          type="button" 
                          onClick={() => handleDispenserCountChange(dispenserCount + 1)}
                          className="w-5 h-5 font-bold hover:bg-slate-100 rounded text-slate-500 text-xs flex items-center justify-center"
                          disabled={dispenserCount >= 6}
                        >
                          +
                        </button>
                      </div>
                    </div>

                    <div className="space-y-1.5 max-h-24 overflow-y-auto pr-0.5">
                      {dispenserNozzles.map((nozzles, idx) => (
                        <div key={idx} className="flex items-center justify-between bg-white p-2 rounded border border-slate-150">
                          <span className="font-bold text-slate-705">Dispenser {String(idx + 1).padStart(2, '0')}</span>
                          <div className="flex items-center gap-1 bg-slate-50 border border-slate-200 rounded px-1 py-0.5">
                            <span className="text-[8px] font-black text-slate-400 uppercase mr-1">Nozzles:</span>
                            <button 
                              type="button" 
                              onClick={() => handleNozzleCountChange(idx, nozzles - 1)}
                              className="w-4 h-4 hover:bg-slate-200 font-bold rounded flex items-center justify-center text-[10px] text-slate-555"
                              disabled={nozzles <= 1}
                            >
                              -
                            </button>
                            <span className="w-3 text-center font-mono text-[9px] text-slate-850 font-bold">{nozzles}</span>
                            <button 
                              type="button" 
                              onClick={() => handleNozzleCountChange(idx, nozzles + 1)}
                              className="w-4 h-4 hover:bg-slate-200 font-bold rounded flex items-center justify-center text-[10px] text-slate-555"
                              disabled={nozzles >= 4}
                            >
                              +
                            </button>
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                </div>
              )}

              {/* Tab 3: Security & Credentials */}
              {wizardTab === 'credentials' && (
                <div className="space-y-3.5 animate-fade-in">
                  <div className="bg-indigo-50/50 border border-indigo-100 rounded-lg p-4 space-y-3">
                    <span className="text-[10px] uppercase font-black text-[#5c4ee3] block">Station Supervisor Portal Access</span>
                    
                    <div className="space-y-1">
                      <label className="font-bold text-slate-655 block text-[9px] uppercase tracking-wider">Supervisor Username</label>
                      <input
                        type="text"
                        placeholder="e.g. riyadh.supervisor"
                        value={supervisorUsername}
                        onChange={(e) => setSupervisorUsername(e.target.value.toLowerCase().replace(/\s+/g, ''))}
                        className="w-full bg-white border border-slate-250 rounded-lg p-2.5 text-slate-800 font-semibold focus:outline-none focus:ring-1 focus:ring-[#6c5dd3]"
                        required
                      />
                    </div>

                    <div className="space-y-1">
                      <label className="font-bold text-slate-655 block text-[9px] uppercase tracking-wider">Temporary Password Code</label>
                      <input
                        type="text"
                        placeholder="Security Passphrase"
                        value={supervisorPassword}
                        onChange={(e) => setSupervisorPassword(e.target.value)}
                        className="w-full bg-white border border-slate-250 rounded-lg p-2.5 text-slate-800 font-semibold focus:outline-none focus:ring-1 focus:ring-[#6c5dd3]"
                        required
                      />
                    </div>
                  </div>
                </div>
              )}

              {/* Tab 4: Pricing Confirmation */}
              {wizardTab === 'pricing' && (
                <div className="space-y-3.5 animate-fade-in text-slate-500 text-xs leading-normal">
                  <div className="bg-linear-to-tr from-slate-50 to-indigo-50 border border-indigo-100 rounded-lg p-4 font-semibold text-slate-600 space-y-2">
                    <h5 className="font-black text-slate-800 uppercase tracking-tight text-[10px] text-indigo-705">Preloaded Standard Pricing Index</h5>
                    <ul className="list-disc pl-4 space-y-1 text-[11px]">
                      <li>GAS91: 2.18 SAR / Liter</li>
                      <li>GAS95: 2.33 SAR / Liter</li>
                      <li>GAS98: 2.60 SAR / Liter</li>
                      <li>DIESEL: 1.15 SAR / Liter</li>
                    </ul>
                    <p className="text-[10px] text-slate-400 font-normal leading-snug">
                      Pricing coefficients can be adjusted locally by regional supervisors or modified by admins after onboarding is completed.
                    </p>
                  </div>

                  <div className="bg-slate-50 border border-slate-200 rounded-lg p-3 text-[10px] leading-relaxed flex items-start gap-2">
                    <CheckCircle2 size={16} className="text-emerald-500 shrink-0 mt-0.5" />
                    <span>
                      Ready to initialize **{newStationName || 'unnamed'}** station registry structure with **{tankCount} tanks** and **{pumpConfigs.length} dispenser nozzles** on Supabase.
                    </span>
                  </div>
                </div>
              )}

              {/* Wizard Action Buttons */}
              <div className="flex items-center gap-2 pt-4 border-t border-slate-150 justify-end">
                {wizardTab !== 'general' && (
                  <button
                    type="button"
                    onClick={() => {
                      if (wizardTab === 'pricing') setWizardTab('credentials');
                      else if (wizardTab === 'credentials') setWizardTab('assets');
                      else if (wizardTab === 'assets') setWizardTab('general');
                    }}
                    className="px-3.5 py-2 border border-slate-200 rounded-lg text-slate-605 font-bold"
                  >
                    Back
                  </button>
                )}

                {wizardTab !== 'pricing' ? (
                  <button
                    type="button"
                    onClick={() => {
                      if (wizardTab === 'general') setWizardTab('assets');
                      else if (wizardTab === 'assets') setWizardTab('credentials');
                      else if (wizardTab === 'credentials') setWizardTab('pricing');
                    }}
                    className="px-4 py-2 bg-slate-800 text-white rounded-lg font-bold hover:bg-slate-900 transition-colors"
                  >
                    Continue
                  </button>
                ) : (
                  <button
                    type="submit"
                    className="px-4 py-2 bg-[#6c5dd3] hover:bg-[#5c4eb3] text-white rounded-lg font-bold shadow-xs transition-colors"
                  >
                    Onboard Instance
                  </button>
                )}
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ========================================================= */}
      {/* 2. EDIT STATION INSTANCE SPECIFICATIONS MODAL */}
      {/* ========================================================= */}
      {editingStation && (
        <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-4 z-50 animate-fade-in">
          <div className="bg-white rounded-xl border border-slate-200 shadow-2xl p-6 max-w-md w-full max-h-[90vh] overflow-y-auto scroll-smooth flex flex-col justify-between text-left">
            
            {/* Modal Header */}
            <div className="flex items-center justify-between pb-3 border-b border-slate-150">
              <div className="flex items-center gap-2">
                <div className="p-1.5 bg-[#efecfe] text-[#6c5dd3] rounded-lg">
                  <Pencil size={16} />
                </div>
                <div>
                  <h3 className="text-xs font-black text-slate-800 tracking-wider uppercase">
                    Edit Station Specs
                  </h3>
                  <span className="text-[10px] text-slate-400 font-mono">ID: {editingStation.id}</span>
                </div>
              </div>
              <button 
                onClick={() => setEditingStation(null)} 
                className="text-slate-400 hover:text-slate-650 p-1 rounded-md"
              >
                <X size={16} />
              </button>
            </div>

            {/* Tabs for Edit Mode */}
            <div className="flex border-b border-slate-100 mt-3 text-[10px] font-black uppercase text-slate-400 select-none">
              {(['general', 'assets', 'credentials', 'pricing'] as const).map(tab => (
                <button
                  key={tab}
                  type="button"
                  onClick={() => setEditTab(tab)}
                  className={`flex-1 text-center py-2 border-b-2 transition-all ${
                    editTab === tab 
                      ? 'border-[#6c5dd3] text-[#6c5dd3] font-black' 
                      : 'border-transparent hover:text-slate-655'
                  }`}
                >
                  {tab}
                </button>
              ))}
            </div>

            {saveError && (
              <div className="text-[10px] text-rose-600 bg-rose-50 p-2 rounded-lg border border-rose-100 font-bold mt-3">
                {saveError}
              </div>
            )}

            {/* Edit Form */}
            <div className="space-y-4 mt-4 text-xs font-sans flex-1">

              {/* Edit Tab 1: General */}
              {editTab === 'general' && (
                <div className="space-y-3 animate-fade-in">
                  <div className="space-y-1">
                    <label className="font-bold text-slate-600 block uppercase text-[9px] tracking-wider">Station Name</label>
                    <input
                      type="text"
                      className="w-full bg-slate-50 border border-slate-250 rounded-lg p-2.5 text-slate-800 font-semibold focus:outline-none focus:bg-white focus:ring-1 focus:ring-[#6c5dd3]"
                      value={editName}
                      onChange={(e) => setEditName(e.target.value)}
                    />
                  </div>

                  <div className="grid grid-cols-2 gap-3">
                    <div className="space-y-1">
                      <label className="font-bold text-slate-600 block uppercase text-[9px] tracking-wider">Branch Code</label>
                      <input
                        type="text"
                        className="w-full bg-slate-100 border border-slate-250 rounded-lg p-2.5 text-slate-400 font-mono font-bold uppercase select-none cursor-not-allowed"
                        value={editCode}
                        disabled
                      />
                    </div>
                    <div className="space-y-1">
                      <label className="font-bold text-slate-600 block uppercase text-[9px] tracking-wider">Logistics Manager</label>
                      <input
                        type="text"
                        className="w-full bg-slate-50 border border-slate-250 rounded-lg p-2.5 text-slate-800 font-semibold focus:outline-none focus:bg-white focus:ring-1 focus:ring-[#6c5dd3]"
                        value={editManager}
                        onChange={(e) => setEditManager(e.target.value)}
                      />
                    </div>
                  </div>

                  <div className="space-y-1">
                    <label className="font-bold text-slate-600 block uppercase text-[9px] tracking-wider">Physical Location</label>
                    <input
                      type="text"
                      className="w-full bg-slate-50 border border-slate-250 rounded-lg p-2.5 text-slate-800 font-medium focus:outline-none focus:bg-white focus:ring-1 focus:ring-[#6c5dd3]"
                      value={editLocation}
                      onChange={(e) => setEditLocation(e.target.value)}
                    />
                  </div>
                </div>
              )}

              {/* Edit Tab 2: Assets */}
              {editTab === 'assets' && (
                <div className="space-y-3.5 animate-fade-in">
                  
                  {/* Tanks Configuration */}
                  <div className="bg-slate-55 border border-slate-200 rounded-lg p-3 space-y-2">
                    <div className="flex items-center justify-between">
                      <span className="text-[10px] uppercase font-black text-slate-600">Storage Reservoir Lines</span>
                      <div className="flex items-center gap-1 bg-white border border-slate-200 rounded px-1">
                        <button
                          type="button"
                          onClick={() => handleEditTankCountChange(editTankConfigs.length - 1)}
                          className="w-5 h-5 font-bold hover:bg-slate-100 rounded text-slate-500 text-xs flex items-center justify-center"
                          disabled={editTankConfigs.length <= 1}
                        >
                          -
                        </button>
                        <span className="text-[10px] font-bold text-slate-800 font-mono w-4 text-center">{editTankConfigs.length}</span>
                        <button
                          type="button"
                          onClick={() => handleEditTankCountChange(editTankConfigs.length + 1)}
                          className="w-5 h-5 font-bold hover:bg-slate-100 rounded text-slate-500 text-xs flex items-center justify-center"
                          disabled={editTankConfigs.length >= 8}
                        >
                          +
                        </button>
                      </div>
                    </div>

                    <div className="space-y-1.5 max-h-32 overflow-y-auto pr-0.5">
                      {editTankConfigs.map((tc, tIdx) => (
                        <div key={tIdx} className="flex items-center gap-2 bg-white p-2 rounded border border-slate-150 justify-between">
                          <span className="font-bold text-slate-600 truncate max-w-[65px]">{tc.label}</span>
                          <div className="flex items-center gap-1">
                            <select
                              value={tc.fuelType}
                              onChange={(e) => {
                                const val = e.target.value as FuelGrade;
                                setEditTankConfigs(prev => prev.map((t, i) => i === tIdx ? { ...t, fuelType: val } : t));
                              }}
                              className="bg-slate-55 border border-slate-200 rounded px-1 py-0.5 text-[9px] font-semibold text-slate-750 focus:outline-none"
                            >
                              <option value="GAS91">GAS91</option>
                              <option value="GAS95">GAS95</option>
                              <option value="GAS98">GAS98</option>
                              <option value="DIESEL">DIESEL</option>
                            </select>
                            <input
                              type="number"
                              min="5000"
                              max="120000"
                              step="5000"
                              value={tc.capacity}
                              onChange={(e) => {
                                const val = Math.max(0, parseInt(e.target.value) || 0);
                                setEditTankConfigs(prev => prev.map((t, i) => i === tIdx ? { ...t, capacity: val } : t));
                              }}
                              className="w-14 bg-slate-55 border border-slate-200 rounded px-1 py-0.5 text-[9px] font-semibold text-slate-800 text-right focus:outline-none"
                            />
                            <span className="text-[9px] text-slate-400">L</span>
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>

                  {/* Dispensers Configuration */}
                  <div className="bg-slate-55 border border-slate-200 rounded-lg p-3 space-y-2">
                    <div className="flex items-center justify-between">
                      <span className="text-[10px] uppercase font-black text-slate-600">Dispensers Count</span>
                      <div className="flex items-center gap-1 bg-white border border-slate-200 rounded px-1">
                        <button
                          type="button"
                          onClick={() => handleEditDispenserCountChange(editDispenserCount - 1)}
                          className="w-5 h-5 font-bold hover:bg-slate-100 rounded text-slate-500 text-xs flex items-center justify-center"
                          disabled={editDispenserCount <= 1}
                        >
                          -
                        </button>
                        <span className="text-[10px] font-bold text-slate-800 font-mono w-4 text-center">{editDispenserCount}</span>
                        <button
                          type="button"
                          onClick={() => handleEditDispenserCountChange(editDispenserCount + 1)}
                          className="w-5 h-5 font-bold hover:bg-slate-100 rounded text-slate-500 text-xs flex items-center justify-center"
                          disabled={editDispenserCount >= 6}
                        >
                          +
                        </button>
                      </div>
                    </div>

                    <div className="space-y-1.5 max-h-24 overflow-y-auto pr-0.5">
                      {editDispenserNozzles.map((nozzles, dispIdx) => (
                        <div key={dispIdx} className="flex items-center justify-between bg-white p-2 rounded border border-slate-150">
                          <span className="font-bold text-slate-650">Dispenser {String(dispIdx + 1).padStart(2, '0')}</span>
                          <div className="flex items-center gap-1 bg-slate-55 border border-slate-200 rounded px-1 py-0.5">
                            <span className="text-[8px] font-black text-slate-400 uppercase mr-1">Nozzles:</span>
                            <button
                              type="button"
                              onClick={() => handleEditNozzleCountChange(dispIdx, nozzles - 1)}
                              className="w-4 h-4 font-black text-slate-500 hover:bg-slate-200 rounded flex items-center justify-center text-[10px]"
                              disabled={nozzles <= 1}
                            >
                              -
                            </button>
                            <span className="text-[9px] font-mono font-bold text-slate-750 w-3 text-center">{nozzles}</span>
                            <button
                              type="button"
                              onClick={() => handleEditNozzleCountChange(dispIdx, nozzles + 1)}
                              className="w-4 h-4 font-black text-slate-500 hover:bg-slate-200 rounded flex items-center justify-center text-[10px]"
                              disabled={nozzles >= 4}
                            >
                              +
                            </button>
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>

                  {/* Nozzles Assignment */}
                  <div className="bg-amber-50/50 border border-amber-200 rounded-lg p-3 space-y-2 max-h-36 overflow-y-auto">
                    <span className="text-[10px] uppercase font-black text-amber-805 block">Dispenser Nozzles Fuel Mapping</span>
                    {editPumpConfigs.map((pc, pIdx) => (
                      <div key={pIdx} className="flex items-center gap-2 bg-white p-2 rounded border border-amber-100 justify-between">
                        <div className="flex flex-col text-left">
                          <span className="font-bold text-slate-700 leading-tight">{pc.label}</span>
                          <span className="text-[9px] text-slate-400 font-medium">Dispenser {pc.dispenserNo}</span>
                        </div>
                        <select
                          value={pc.fuelType}
                          onChange={(e) => {
                            const val = e.target.value as FuelGrade;
                            setEditPumpConfigs(prev => prev.map((p, i) => i === pIdx ? { ...p, fuelType: val } : p));
                          }}
                          className="bg-slate-55 border border-slate-200 rounded px-1.5 py-1 text-[10px] font-semibold text-slate-705 focus:outline-none"
                        >
                          <option value="GAS91">GAS91</option>
                          <option value="GAS95">GAS95</option>
                          <option value="GAS98">GAS98</option>
                          <option value="DIESEL">DIESEL</option>
                        </select>
                      </div>
                    ))}
                  </div>

                </div>
              )}

              {/* Edit Tab 3: Credentials */}
              {editTab === 'credentials' && (
                <div className="space-y-3.5 animate-fade-in">
                  <div className="bg-indigo-50/50 border border-indigo-100 rounded-lg p-4 space-y-3">
                    <span className="text-[10px] uppercase font-black text-[#5c4ee3] block">Modify Portal Credentials</span>
                    
                    <div className="space-y-1">
                      <label className="font-bold text-slate-655 block text-[9px] uppercase tracking-wider">Supervisor Username</label>
                      <input
                        type="text"
                        className="w-full bg-white border border-slate-250 rounded-lg p-2.5 text-slate-800 font-semibold focus:outline-none focus:ring-1 focus:ring-[#6c5dd3]"
                        value={editUsername}
                        onChange={(e) => setEditUsername(e.target.value.toLowerCase().replace(/\s+/g, ''))}
                      />
                    </div>

                    <div className="space-y-1">
                      <label className="font-bold text-slate-655 block text-[9px] uppercase tracking-wider">Security Passphrase</label>
                      <input
                        type="text"
                        className="w-full bg-white border border-slate-250 rounded-lg p-2.5 text-slate-800 font-semibold focus:outline-none focus:ring-1 focus:ring-[#6c5dd3]"
                        value={editPassword}
                        onChange={(e) => setEditPassword(e.target.value)}
                      />
                    </div>
                  </div>
                </div>
              )}

              {/* Edit Tab 4: Pricing */}
              {editTab === 'pricing' && (
                <div className="space-y-3 animate-fade-in">
                  <div className="grid grid-cols-2 gap-4 bg-slate-50 border border-slate-200 rounded-lg p-4">
                    <div className="space-y-1">
                      <label className="font-bold text-slate-600 block uppercase text-[9px] tracking-wider">Default Price GAS91 (SAR)</label>
                      <input
                        type="number"
                        step="0.01"
                        className="w-full bg-white border border-slate-250 rounded-lg p-2.5 text-slate-800 font-semibold focus:outline-none focus:ring-1 focus:ring-[#6c5dd3]"
                        value={editPriceGas91}
                        onChange={(e) => setEditPriceGas91(e.target.value)}
                      />
                    </div>
                    <div className="space-y-1">
                      <label className="font-bold text-slate-600 block uppercase text-[9px] tracking-wider">Default Price GAS95 (SAR)</label>
                      <input
                        type="number"
                        step="0.01"
                        className="w-full bg-white border border-slate-250 rounded-lg p-2.5 text-slate-800 font-semibold focus:outline-none focus:ring-1 focus:ring-[#6c5dd3]"
                        value={editPriceGas95}
                        onChange={(e) => setEditPriceGas95(e.target.value)}
                      />
                    </div>
                  </div>
                </div>
              )}

              {/* Edit Action Buttons */}
              <div className="flex items-center gap-2 pt-4 border-t border-slate-150 justify-end">
                <button
                  onClick={() => setEditingStation(null)}
                  className="px-3.5 py-2 border border-slate-200 rounded-lg text-[#2d3748] font-bold"
                >
                  Cancel
                </button>
                <button
                  onClick={handleUpdateStationSave}
                  className="px-4 py-2 bg-emerald-600 hover:bg-emerald-700 text-white rounded-lg font-bold shadow-xs transition-colors flex items-center gap-1"
                >
                  <Check size={14} />
                  Save Changes
                </button>
              </div>

            </div>
          </div>
        </div>
      )}

      {/* ========================================================= */}
      {/* 3. DELETE CONFIRMATION MODAL */}
      {/* ========================================================= */}
      {stationToDelete && (
        <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-4 z-50 animate-fade-in">
          <div className="bg-white rounded-xl border border-slate-200 shadow-2xl p-6 max-w-sm w-full text-left">
            <div className="flex items-start gap-3">
              <div className="p-2 bg-rose-100 text-rose-600 rounded-lg shrink-0">
                <AlertCircle size={20} />
              </div>
              <div className="space-y-1">
                <h4 className="text-sm font-black text-slate-800 uppercase tracking-wide">Delete Station Instance</h4>
                <p className="text-xs text-slate-500 leading-normal">
                  Warning: Deleting station **&quot;{stationToDelete.name}&quot;** ({stationToDelete.code}) will permanently terminate all associated reservoirs, dispensers, logs, and supervisor credentials.
                </p>
              </div>
            </div>

            <div className="mt-4 bg-slate-50 border border-slate-200 rounded-lg p-3 text-xs text-slate-600 space-y-2">
              <span className="font-semibold block text-slate-500 uppercase text-[9px] tracking-wider">Verification Required</span>
              <p className="leading-snug">To confirm this action, please type the station code prefix <code className="bg-slate-200 font-mono text-[10px] px-1 rounded font-bold text-slate-800">{stationToDelete.code}</code> below:</p>
              <input
                type="text"
                className="w-full bg-white border border-slate-300 rounded-lg p-2 font-mono font-bold uppercase focus:outline-none focus:ring-1 focus:ring-rose-500"
                placeholder={stationToDelete.code}
                value={deleteConfirmCode}
                onChange={(e) => setDeleteConfirmCode(e.target.value)}
              />
            </div>

            <div className="flex items-center gap-2 mt-4 justify-end">
              <button
                onClick={() => { setStationToDelete(null); setDeleteConfirmCode(''); }}
                className="px-3.5 py-2 border border-slate-200 rounded-lg text-xs font-bold text-slate-650"
              >
                Cancel
              </button>
              <button
                onClick={handleDeleteStationTrigger}
                disabled={deleteConfirmCode.toUpperCase() !== stationToDelete.code.toUpperCase()}
                className="px-4 py-2 bg-rose-600 hover:bg-rose-700 text-white rounded-lg text-xs font-bold transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-1.5"
              >
                <Trash2 size={13} />
                Confirm Deletion
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ========================================================= */}
      {/* 4. DB CONNECTION SYNC SETTINGS MODAL */}
      {/* ========================================================= */}
      {showSyncSettings && (
        <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-4 z-50 animate-fade-in">
          <div className="bg-white rounded-xl border border-slate-200 shadow-2xl p-6 max-w-md w-full text-left">
            <div className="flex items-center justify-between pb-3 border-b border-slate-150">
              <div className="flex items-center gap-2">
                <Database size={16} className="text-[#6c5dd3]" />
                <h3 className="text-xs font-black text-slate-800 uppercase tracking-wider">
                  Supabase DB Connection Settings
                </h3>
              </div>
              <button onClick={() => setShowSyncSettings(false)} className="text-slate-400 hover:text-slate-655 p-1">
                <X size={16} />
              </button>
            </div>

            <div className="mt-3 bg-indigo-50 border border-indigo-150 p-3 rounded-lg text-xs text-indigo-900 leading-relaxed font-semibold">
              These settings link your browser preview locally to a live PostgreSQL BaaS database. If overrides are cleared, defaults from project environment variables will be used.
            </div>

            <form onSubmit={handleSaveConfig} className="space-y-3.5 mt-4 text-xs font-sans">
              <div className="flex items-center gap-2 pb-1">
                <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wide">Quick Presets:</span>
                <button
                  type="button"
                  onClick={() => {
                    setInputUrl('http://localhost:54321');
                    setInputKey('eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InRlbXAiLCJyb2xlIjoiYW5vbiIsImlhdCI6MTU2MTM3MTE0MSwiZXhwIjoxOTA2OTQ3MTQxfQ.standard-anon-key');
                  }}
                  className="bg-indigo-50 hover:bg-indigo-100 text-[#6c5dd3] border border-indigo-200 px-2 py-0.5 rounded text-[9px] font-bold transition-all"
                >
                  Localhost (http://localhost:54321)
                </button>
              </div>

              <div className="space-y-1">
                <label className="font-bold text-slate-700 block text-[10px] uppercase">Supabase Project URL</label>
                <input
                  type="url"
                  required
                  placeholder="https://xyzcompany.supabase.co"
                  value={inputUrl}
                  onChange={(e) => setInputUrl(e.target.value)}
                  className="w-full bg-slate-50 border border-slate-350 px-3 py-2 rounded-lg font-mono text-[11px] focus:outline-none focus:bg-white focus:ring-1 focus:ring-[#6c5dd3]"
                />
              </div>

              <div className="space-y-1">
                <label className="font-bold text-slate-700 block text-[10px] uppercase font-mono">Anon / API Key</label>
                <input
                  type="password"
                  required
                  placeholder="eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9..."
                  value={inputKey}
                  onChange={(e) => setInputKey(e.target.value)}
                  className="w-full bg-slate-50 border border-slate-350 px-3 py-2 rounded-lg font-mono text-[11px] focus:outline-none focus:bg-white focus:ring-1 focus:ring-[#6c5dd3]"
                />
              </div>

              {connectivity.checked && (
                <div className={`p-3 rounded-lg border text-[11px] leading-snug flex items-start gap-2 ${
                  connectivity.reachable ? 'bg-emerald-50 border-emerald-100 text-emerald-800' : 'bg-rose-50 border-rose-100 text-rose-900'
                }`}>
                  {connectivity.reachable ? <Wifi size={14} className="shrink-0 mt-0.5" /> : <WifiOff size={14} className="shrink-0 mt-0.5" />}
                  <div>
                    <span className="font-bold block uppercase text-[9px]">Connectivity Status</span>
                    <span>{connectivity.message}</span>
                  </div>
                </div>
              )}

              <div className="flex items-center justify-between pt-2 border-t border-slate-150 mt-4">
                <button
                  type="button"
                  onClick={handleClearConfig}
                  className="text-rose-600 hover:text-rose-800 flex items-center gap-1 text-[10px] font-black uppercase tracking-wider"
                >
                  <Trash2 size={12} />
                  Clear Overrides
                </button>
                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    onClick={() => setShowSyncSettings(false)}
                    className="px-3.5 py-2 border border-slate-205 rounded-lg text-slate-650 font-bold"
                  >
                    Close
                  </button>
                  <button
                    type="submit"
                    className="bg-[#6c5dd3] hover:bg-[#5b4ebf] text-white px-4 py-2 rounded-lg font-bold uppercase transition-colors"
                  >
                    Save & Sync
                  </button>
                </div>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ========================================================= */}
      {/* 5. SUPERVISOR ACCOUNTS DRAWER/MODAL */}
      {/* ========================================================= */}
      {showSupervisorRegistry && (
        <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-4 z-50 animate-fade-in">
          <div className="bg-white rounded-xl border border-slate-200 shadow-2xl p-6 max-w-4xl w-full text-left max-h-[90vh] flex flex-col justify-between">
            <div className="flex items-center justify-between pb-3 border-b border-slate-150">
              <div className="flex items-center gap-2">
                <Shield className="text-[#6c5dd3]" size={18} />
                <div>
                  <h3 className="text-xs font-black text-slate-800 uppercase tracking-wider">
                    Supervisor Security Accounts List
                  </h3>
                  <span className="text-[10px] text-slate-450">Active logins mapped to Supabase database table `onboarded_users`</span>
                </div>
              </div>
              <button onClick={() => setShowSupervisorRegistry(false)} className="text-slate-405 hover:text-slate-600 p-1">
                <X size={16} />
              </button>
            </div>

            <div className="flex-1 overflow-y-auto mt-4 border border-slate-150 rounded-lg">
              {supabaseUsers.length === 0 ? (
                <div className="p-8 text-center text-slate-400 font-semibold bg-slate-55 text-xs">
                  No active supervisor users detected.
                </div>
              ) : (
                <table className="w-full text-left font-medium border-collapse text-xs">
                  <thead>
                    <tr className="bg-slate-50 border-b border-slate-150 text-slate-400 uppercase tracking-wider text-[9px] font-black">
                      <th className="px-4 py-2">ID / Created At</th>
                      <th className="px-4 py-2">Username</th>
                      <th className="px-4 py-2">Passphrase Code</th>
                      <th className="px-4 py-2">Manager / Affiliated Station</th>
                      <th className="px-4 py-2">Status</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-150 font-mono text-[11px] text-slate-700 bg-white">
                    {supabaseUsers.map((user, idx) => (
                      <tr key={user.id || idx} className="hover:bg-slate-50/50">
                        <td className="px-4 py-2.5 whitespace-nowrap">
                          <div className="font-bold text-slate-800">{user.id}</div>
                          <div className="text-[9px] text-slate-404">
                            {user.created_at ? new Date(user.created_at).toLocaleDateString() : ''}
                          </div>
                        </td>
                        <td className="px-4 py-2.5 font-bold text-indigo-700">{user.username}</td>
                        <td className="px-4 py-2.5 text-rose-600 font-bold font-mono">{user.password_raw}</td>
                        <td className="px-4 py-2.5 font-sans">
                          <div className="font-semibold text-slate-800">{user.full_name}</div>
                          <div className="text-[10px] text-slate-450">{user.station_name} ({user.station_code})</div>
                        </td>
                        <td className="px-4 py-2.5">
                          <span className="inline-block px-2 py-0.5 rounded text-[8px] font-black bg-emerald-50 text-emerald-700 border border-emerald-100 uppercase">
                            Active Sync
                          </span>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              )}
            </div>

            <div className="flex items-center justify-end mt-4 pt-3 border-t border-slate-150">
              <button
                onClick={() => setShowSupervisorRegistry(false)}
                className="px-4 py-2 bg-slate-800 hover:bg-slate-900 text-white rounded-lg text-xs font-bold transition-colors"
              >
                Close list
              </button>
            </div>
          </div>
        </div>
      )}

    </div>
  );
};
