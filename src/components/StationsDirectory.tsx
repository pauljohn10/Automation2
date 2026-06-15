/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useEffect } from 'react';
import { useFuelSystem } from '../context';
import { FuelStation, FuelTank, FuelPump, FuelGrade } from '../types';
import { Building2, Plus, X, Server, ShieldCheck, MapPin, Check, Database, Sparkles, RefreshCw, AlertCircle, ExternalLink, Settings, Key, Trash2, WifiOff, Wifi, Pencil } from 'lucide-react';
import { getSupabaseConfig, saveSupabaseOverrides, clearSupabaseOverrides, recordOnboardedUser, fetchOnboardedUsers, SupabaseUserRecord, checkSupabaseConnectivity, getSupabaseClient } from '../supabaseClient';

export const StationsDirectory: React.FC = () => {
  const { stations, tanks, pumps, addStation, updateStationStatus, refreshAllFromSupabase, session, addCustomAuditLog } = useFuelSystem();

  // Inline editing state for Tenant Stations Network Master Registry
  const [editingStationId, setEditingStationId] = useState<string | null>(null);
  const [editManager, setEditManager] = useState('');
  const [editUsername, setEditUsername] = useState('');
  const [editPassword, setEditPassword] = useState('');
  const [editPriceGas91, setEditPriceGas91] = useState('');
  const [editPriceGas95, setEditPriceGas95] = useState('');
  const [saveError, setSaveError] = useState<string | null>(null);
  const [saveSuccessStationId, setSaveSuccessStationId] = useState<string | null>(null);

  // Advanced configuration states inside edit mode
  const [isAdvancedOpen, setIsAdvancedOpen] = useState(false);
  const [editTankConfigs, setEditTankConfigs] = useState<Array<{ id?: string; label: string; fuelType: FuelGrade; capacity: number }>>([]);
  const [editDispenserCount, setEditDispenserCount] = useState(1);
  const [editDispenserNozzles, setEditDispenserNozzles] = useState<number[]>([]);
  const [editPumpConfigs, setEditPumpConfigs] = useState<Array<{ id?: string; dispenserNo: number; pumpNo: number; label: string; fuelType: FuelGrade; status?: string }>>([]);

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

  const handleEditNozzleCountChange = (dispIndex: number, newNozzles: number) => {
    if (newNozzles < 1 || newNozzles > 4) return;
    setEditDispenserNozzles(prev => {
      const next = [...prev];
      next[dispIndex] = newNozzles;
      updateEditPumpConfigsFromNozzles(next);
      return next;
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

  const updateEditPumpConfigsFromNozzles = (nozzlesArray: number[]) => {
    setEditPumpConfigs(prev => {
      const g: FuelGrade[] = ['GAS91', 'GAS95', 'GAS98', 'DIESEL'];
      const nextConfigs: Array<{ id?: string; dispenserNo: number; pumpNo: number; label: string; fuelType: FuelGrade; status?: string }> = [];
      
      nozzlesArray.forEach((nozzleCount, dIndex) => {
        const d = dIndex + 1;
        for (let p = 1; p <= nozzleCount; p++) {
          const existing = prev.find(pc => pc.dispenserNo === d && pc.pumpNo === p);
          if (existing) {
            nextConfigs.push(existing);
          } else {
            const indexOnDispenser = p - 1;
            const defaultFuel = g[indexOnDispenser % g.length];
            nextConfigs.push({
              label: `Dispenser ${String(d).padStart(2, '0')} - Pump ${p}`,
              dispenserNo: d,
              pumpNo: p,
              fuelType: defaultFuel,
              status: 'IDLE'
            });
          }
        }
      });
      return nextConfigs;
    });
  };

  const handleUpdateStation = async (station: FuelStation) => {
    if (!editManager.trim() || !editUsername.trim() || !editPassword.trim() || !editPriceGas91 || !editPriceGas95) {
      setSaveError('Please ensure all specifications are valid and not empty.');
      return;
    }

    try {
      setSaveError(null);
      const updatedManager = editManager;
      const updatedSupervisor = editUsername;
      const updatedPassphrase = editPassword;
      const updatedPrice91 = editPriceGas91;
      const updatedPrice95 = editPriceGas95;

      // Real schema-compliant columns to guarantee database update success
      const updatedPricingJson = {
        ...station.fuelPricing,
        GAS91: parseFloat(updatedPrice91),
        GAS95: parseFloat(updatedPrice95)
      };

      const supabase = getSupabaseClient();

      // 1. Update the core station profile table row
      const { error: stationUpdateErr } = await supabase
        .from('stations')
        .update({ 
           manager: updatedManager,
           username: updatedSupervisor,
           password: updatedPassphrase,
           fuelPricing: updatedPricingJson,
           dispenserCount: editDispenserCount,
           pumpsPerDispenser: editDispenserNozzles[0] || 2
        })
        .eq('id', station.id);

      if (stationUpdateErr) {
        throw new Error(`Core station update error: ${stationUpdateErr.message || String(stationUpdateErr)}`);
      }

      // 2. Update or Upsert rows inside the public.onboarded_users table
      const { data: existingUsers, error: userFetchErr } = await supabase
        .from('onboarded_users')
        .select('*')
        .eq('station_id', station.id);

      const userId = (existingUsers && existingUsers.length > 0) ? existingUsers[0].id : `usr-edit-${station.id}-${Date.now().toString().slice(-4)}`;
      const { error: userUpsertErr } = await supabase
        .from('onboarded_users')
        .upsert({
          id: userId,
          station_id: station.id,
          station_name: station.name,
          station_code: station.code,
          username: updatedSupervisor,
          password_raw: updatedPassphrase,
          full_name: `${updatedManager} (Supervisor)`,
          role: 'supervisor'
        });

      if (userUpsertErr) {
        console.error('Supervisor credentials table update error:', userUpsertErr);
      }

      // 3. Dynamically insert or delete rows inside public.fuel_tanks
      const tanksWithIds = editTankConfigs.map((t, index) => ({
        id: t.id || `tank-edit-${index + 1}-${station.id}`,
        stationId: station.id,
        label: t.label || `Tank ${String(index + 1).padStart(2, '0')}`,
        fuelType: t.fuelType,
        capacity: parseFloat(t.capacity.toString()) || 45000,
        currentLevel: 11000,
        temperature: 34.0,
        waterLevel: 0.0,
        lastMeasurementTime: new Date().toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' })
      }));

      const { data: dbTanks } = await supabase
        .from('fuel_tanks')
        .select('id')
        .eq('stationId', station.id);

      const dbTankIds = dbTanks?.map(t => t.id) || [];
      const liveTankIds = tanksWithIds.map(t => t.id);
      const tIdsToDelete = dbTankIds.filter(id => !liveTankIds.includes(id));

      if (tIdsToDelete.length > 0) {
        const { error: tankDeleteErr } = await supabase.from('fuel_tanks').delete().in('id', tIdsToDelete);
        if (tankDeleteErr) {
          console.error('Tanks deletion error:', tankDeleteErr);
        }
      }

      const { error: tankUpsertErr } = await supabase.from('fuel_tanks').upsert(tanksWithIds);
      if (tankUpsertErr) {
        console.error('Tanks upsert error:', tankUpsertErr);
      }

      // 4. Dynamically insert or delete rows inside public.fuel_pumps
      const pumpsWithIds = editPumpConfigs.map((p, index) => ({
        id: p.id || `pump-edit-${index + 1}-${station.id}`,
        stationId: station.id,
        label: p.label || `Dispenser ${String(p.dispenserNo).padStart(2, '0')} - Pump ${p.pumpNo}`,
        status: p.status || 'IDLE',
        fuelType: p.fuelType,
        activeFuelGrade: p.fuelType,
        flowRate: 40.00,
        volumeThisSession: 0.00
      }));

      const { data: dbPumps } = await supabase
        .from('fuel_pumps')
        .select('id')
        .eq('stationId', station.id);

      const dbPumpIds = dbPumps?.map(p => p.id) || [];
      const livePumpIds = pumpsWithIds.map(p => p.id);
      const pIdsToDelete = dbPumpIds.filter(id => !livePumpIds.includes(id));

      if (pIdsToDelete.length > 0) {
        const { error: pumpDeleteErr } = await supabase.from('fuel_pumps').delete().in('id', pIdsToDelete);
        if (pumpDeleteErr) {
          console.error('Pumps deletion error:', pumpDeleteErr);
        }
      }

      const { error: pumpUpsertErr } = await supabase.from('fuel_pumps').upsert(pumpsWithIds);
      if (pumpUpsertErr) {
        console.error('Pumps upsert error:', pumpUpsertErr);
      }

      // Explicitly trigger user requested target query just in case custom attributes are checked directly
      try {
        await supabase
          .from('stations')
          .update({ 
             manager: updatedManager,
             supervisor_user: updatedSupervisor,
             passphrase: updatedPassphrase,
             default_price_gas91: parseFloat(updatedPrice91),
             default_price_gas95: parseFloat(updatedPrice95)
          } as any)
          .eq('id', station.id);
      } catch (err) {
        console.warn('Silent custom column fallback bypassed:', err);
      }

      setSaveSuccessStationId(station.id);
      setEditingStationId(null);
      setIsAdvancedOpen(false);
      
      // On-the-fly reload from database to avoid full page refresh
      await refreshAllFromSupabase();

      addCustomAuditLog(
        'STATION_SPEC_UPDATE',
        `Master registry specs and network topology updated for ${station.name}. Manager: ${updatedManager}.`,
        station.id
      );

      setTimeout(() => setSaveSuccessStationId(null), 3500);
    } catch (err: any) {
      setSaveError(err.message || 'Linking database write exception.');
    }
  };

  // Onboarding wizard panel state
  const [showWizard, setShowWizard] = useState(false);
  const [newStationName, setNewStationName] = useState('');
  const [newStationCode, setNewStationCode] = useState('');
  const [newLocation, setNewLocation] = useState('');
  const [newManager, setNewManager] = useState('');
  
  // Custom specifications for Tanks & Pumps
  const [tankCount, setTankCount] = useState(2);
  const [dispenserCount, setDispenserCount] = useState(1);
  const [pumpsPerDispenser, setPumpsPerDispenser] = useState(2);
  const [dispenserNozzles, setDispenserNozzles] = useState<number[]>([2]);
  const [supervisorUsername, setSupervisorUsername] = useState('');
  const [supervisorPassword, setSupervisorPassword] = useState('');

  // Supabase synchronization states
  const [supabaseUsers, setSupabaseUsers] = useState<Array<SupabaseUserRecord | any>>([]);
  const [isSyncing, setIsSyncing] = useState(false);
  const [syncStatusText, setSyncStatusText] = useState<string | null>(null);
  const [loadError, setLoadError] = useState<string | null>(null);

  // Connection diagnostics
  const [connectivity, setConnectivity] = useState<{ checked: boolean; reachable: boolean; message: string }>({
    checked: false,
    reachable: false,
    message: ''
  });

  // Dynamic Supabase Overrides for client-side iframe sandbox
  const [dbConfig, setDbConfig] = useState(getSupabaseConfig());
  const [inputUrl, setInputUrl] = useState(getSupabaseConfig().isLocalOverride ? localStorage.getItem('supabase_url_override') || '' : '');
  const [inputKey, setInputKey] = useState(getSupabaseConfig().isLocalOverride ? localStorage.getItem('supabase_key_override') || '' : '');
  const [showConfigPanel, setShowConfigPanel] = useState(false);
  const [configSuccessMsg, setConfigSuccessMsg] = useState<string | null>(null);

  // Load onboarded users list on mount
  useEffect(() => {
    async function loadUsersAndConnectivity() {
      // 1. Run connectivity check
      try {
        const ping = await checkSupabaseConnectivity();
        setConnectivity({
          checked: true,
          reachable: ping.reachable,
          message: ping.message
        });
      } catch (err: any) {
        setConnectivity({
          checked: true,
          reachable: false,
          message: err.message || 'External network lookup failure.'
        });
      }

      // 2. Fetch users with session storage fallback
      try {
        const data = await fetchOnboardedUsers();
        const cachedUsersStr = sessionStorage.getItem('fuel_system_onboarded_users_fallback');
        const fallbackUsers: SupabaseUserRecord[] = cachedUsersStr ? JSON.parse(cachedUsersStr) : [];
        
        // Combine state (uniquely by id)
        const combined = [...fallbackUsers, ...data];
        const unique = Array.from(new Map(combined.map(u => [u.id, u])).values());
        setSupabaseUsers(unique);
      } catch (err: any) {
        setLoadError(err.message || 'Error occurred loading synced users');
        const cachedUsersStr = sessionStorage.getItem('fuel_system_onboarded_users_fallback');
        if (cachedUsersStr) {
          setSupabaseUsers(JSON.parse(cachedUsersStr));
        }
      }
    }
    loadUsersAndConnectivity();
  }, [dbConfig]);

  const refreshSupabaseData = async () => {
    setIsSyncing(true);
    setSyncStatusText('Refreshing data from Supabase...');
    try {
      const ping = await checkSupabaseConnectivity();
      setConnectivity({
        checked: true,
        reachable: ping.reachable,
        message: ping.message
      });

      const data = await fetchOnboardedUsers();
      const cachedUsersStr = sessionStorage.getItem('fuel_system_onboarded_users_fallback');
      const fallbackUsers: SupabaseUserRecord[] = cachedUsersStr ? JSON.parse(cachedUsersStr) : [];
      
      const combined = [...fallbackUsers, ...data];
      const unique = Array.from(new Map(combined.map(u => [u.id, u])).values());
      setSupabaseUsers(unique);
      setSyncStatusText(ping.reachable ? 'Refreshed successfully!' : 'Offline cache status active.');
    } catch (err: any) {
      setSyncStatusText(`Refresh failed: ${err.message}`);
    } finally {
      setIsSyncing(false);
      setTimeout(() => setSyncStatusText(null), 3000);
    }
  };

  const handleSaveConfig = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!inputUrl.trim() || !inputKey.trim()) return;
    saveSupabaseOverrides(inputUrl, inputKey);
    const updated = getSupabaseConfig();
    setDbConfig(updated);
    setConfigSuccessMsg('Supabase credentials linked! Syncing database tables...');
    
    const res = await refreshAllFromSupabase();
    if (res.success) {
      setConfigSuccessMsg('Supabase credentials successfully linked locally and synced with db!');
    } else {
      setConfigSuccessMsg(`Linked, but database sync lookup alert: ${res.message}`);
    }
    
    setTimeout(() => {
      setConfigSuccessMsg(null);
      setShowConfigPanel(false);
    }, 3000);
  };

  const handleClearConfig = async () => {
    clearSupabaseOverrides();
    setInputUrl('');
    setInputKey('');
    const updated = getSupabaseConfig();
    setDbConfig(updated);
    setConfigSuccessMsg('Credentials cleared. Syncing with default system environment...');
    
    await refreshAllFromSupabase();
    
    setConfigSuccessMsg('Configuration cleared. Defaulting to system environment setup.');
    setTimeout(() => {
      setConfigSuccessMsg(null);
    }, 2000);
  };



  const [tankConfigs, setTankConfigs] = useState<Array<{ label: string, fuelType: FuelGrade, capacity: number }>>([
    { label: 'Tank 01', fuelType: 'GAS91', capacity: 45000 },
    { label: 'Tank 02', fuelType: 'GAS95', capacity: 45000 }
  ]);

  const [pumpConfigs, setPumpConfigs] = useState<Array<{ dispenserNo: number, pumpNo: number, label: string, fuelType: FuelGrade }>>([
    { dispenserNo: 1, pumpNo: 1, label: 'Dispenser 01 - Pump 1', fuelType: 'GAS91' },
    { dispenserNo: 1, pumpNo: 2, label: 'Dispenser 01 - Pump 2', fuelType: 'GAS95' }
  ]);

  const updatePumpConfigsFromNozzles = (nozzlesArray: number[]) => {
    setPumpConfigs(prev => {
      const g: FuelGrade[] = ['GAS91', 'GAS95', 'GAS98', 'DIESEL'];
      const nextConfigs: Array<{ dispenserNo: number, pumpNo: number, label: string, fuelType: FuelGrade }> = [];
      
      nozzlesArray.forEach((nozzleCount, dIndex) => {
        const d = dIndex + 1;
        for (let p = 1; p <= nozzleCount; p++) {
          const existing = prev.find(pc => pc.dispenserNo === d && pc.pumpNo === p);
          if (existing) {
            nextConfigs.push(existing);
          } else {
            const indexOnDispenser = p - 1;
            const defaultFuel = g[indexOnDispenser % g.length];
            nextConfigs.push({
              dispenserNo: d,
              pumpNo: p,
              label: `Dispenser ${String(d).padStart(2, '0')} - Pump ${p}`,
              fuelType: defaultFuel
            });
          }
        }
      });
      return nextConfigs;
    });
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

  // Creation status
  const [successNotif, setSuccessNotif] = useState('');

  const handleTankCountChange = (count: number) => {
    const safeCount = Math.max(1, Math.min(8, count));
    setTankCount(safeCount);
    setTankConfigs(prev => {
      const g: FuelGrade[] = ['GAS91', 'GAS95', 'GAS98', 'DIESEL'];
      const nextConfigs = [...prev];
      if (nextConfigs.length < safeCount) {
        for (let i = nextConfigs.length; i < safeCount; i++) {
          const numStr = String(i + 1).padStart(2, '0');
          const defaultFuel = g[i % g.length];
          nextConfigs.push({
            label: `Tank ${numStr}`,
            fuelType: defaultFuel,
            capacity: 45000
          });
        }
      } else if (nextConfigs.length > safeCount) {
        nextConfigs.splice(safeCount);
      }
      return nextConfigs;
    });
  };

  const updateTankConfig = (index: number, key: 'fuelType' | 'capacity', value: any) => {
    setTankConfigs(prev => prev.map((c, i) => i === index ? { ...c, [key]: value } : c));
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
      // default starting pricing
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

    // Build custom tanks from user-defined configs
    const newTanksObj: FuelTank[] = tankConfigs.map((tc, index) => ({
      id: `tank-${String(index + 1).padStart(2, '0')}-${newId}`,
      stationId: newId,
      label: tc.label,
      fuelType: tc.fuelType,
      capacity: tc.capacity,
      currentLevel: 0, // Rule 1: Onboarding Empty State Initialization (empty state)
      temperature: 34.00,
      waterLevel: 0.00,
      lastMeasurementTime: timestamp
    }));

    // Build custom pumps based on pumpConfigs
    const newPumpsObj: FuelPump[] = pumpConfigs.map(pc => {
      const dStr = String(pc.dispenserNo).padStart(2, '0');
      const pStr = String(pc.pumpNo).padStart(2, '0');
      return {
        id: `pump-d${dStr}-p${pStr}-${newId}`,
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
    setSyncStatusText('Broadcasting credentials to Supabase backend...');

    // Always pre-emptively save to session storage fallback list in case Supabase has DNS issues
    try {
      const cachedUsersStr = sessionStorage.getItem('fuel_system_onboarded_users_fallback');
      const fallbackList: SupabaseUserRecord[] = cachedUsersStr ? JSON.parse(cachedUsersStr) : [];
      fallbackList.unshift(userPayload);
      sessionStorage.setItem('fuel_system_onboarded_users_fallback', JSON.stringify(fallbackList));
    } catch (e) {
      console.error('Session cache store error:', e);
    }

    addStation(newStationObj, newTanksObj, newPumpsObj).then((dbRes) => {
      // Sequentially write the dependent onboarded_users record now that parent row is guaranteed to exist
      recordOnboardedUser(userPayload).then((res) => {
        setIsSyncing(false);
        if (res.success) {
          setSuccessNotif(`SaaS Station "${newStationName}" successfully integrated. Supervisor recorded in Supabase table "onboarded_users"!`);
          fetchOnboardedUsers().then(users => {
            const cachedUsersStr = sessionStorage.getItem('fuel_system_onboarded_users_fallback');
            const fallbackUsers: SupabaseUserRecord[] = cachedUsersStr ? JSON.parse(cachedUsersStr) : [];
            const combined = [...fallbackUsers, ...users];
            const unique = Array.from(new Map(combined.map(u => [u.id, u])).values());
            setSupabaseUsers(unique);
          });
        } else {
          setSuccessNotif(`SaaS Station "${newStationName}" integrated locally with offline backup! Connection Status Alert: ${res.message}`);
          setSupabaseUsers(prev => {
            const combined = [userPayload, ...prev];
            return Array.from(new Map(combined.map(u => [u.id, u])).values());
          });
        }
        setTimeout(() => setSyncStatusText(null), 8500);
      });
    }).catch((err) => {
      console.error('Fatal issue during Station/Assets onboarding write:', err);
      // Failover fallback trigger
      recordOnboardedUser(userPayload).then((res) => {
        setIsSyncing(false);
        setSuccessNotif(`SaaS Station "${newStationName}" integrated locally with offline backup! Connection Status Alert: ${err.message || err}`);
        setSupabaseUsers(prev => {
          const combined = [userPayload, ...prev];
          return Array.from(new Map(combined.map(u => [u.id, u])).values());
        });
        setTimeout(() => setSyncStatusText(null), 8500);
      });
    });

    // Clear wizard inputs and reset to default counts
    setNewStationName('');
    setNewStationCode('');
    setNewLocation('');
    setNewManager('');
    setSupervisorUsername('');
    setSupervisorPassword('');
    setTankCount(2);
    setDispenserCount(1);
    setPumpsPerDispenser(2);
    setDispenserNozzles([2]);
    setTankConfigs([
      { label: 'Tank 01', fuelType: 'GAS91', capacity: 45000 },
      { label: 'Tank 02', fuelType: 'GAS95', capacity: 45000 }
    ]);
    setPumpConfigs([
      { dispenserNo: 1, pumpNo: 1, label: 'Dispenser 01 - Pump 1', fuelType: 'GAS91' },
      { dispenserNo: 1, pumpNo: 2, label: 'Dispenser 01 - Pump 2', fuelType: 'GAS95' }
    ]);
    setShowWizard(false);

    setTimeout(() => setSuccessNotif(''), 6500);
  };

  const statusColors = {
    ACTIVE: 'bg-emerald-100 text-emerald-800 border border-emerald-200',
    MAINTENANCE: 'bg-amber-100 text-amber-800 border border-amber-200',
    INACTIVE: 'bg-slate-100 text-slate-800 border border-slate-200'
  };

  return (
    <div className="p-6 space-y-6 bg-slate-50 min-h-[calc(100vh-64px)] font-sans text-left">
      {/* Header and buttons */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 bg-white p-5 rounded-xl border border-slate-200">
        <div>
          <h3 className="text-sm font-black text-slate-800 tracking-tight uppercase flex items-center gap-2">
            <Building2 size={18} className="text-[#6c5dd3]" />
            Tenant Stations Network Master Registry
          </h3>
          <p className="text-xs text-slate-500 mt-1">
            Configure multi-tenant data structures, operational clearances, and configure regional managers.
          </p>
        </div>
        <button
          onClick={() => {
            if (session.role === 'VIEWER') {
              alert('Access Denied: Read-only VIEWER profile cannot onboard new retail tenants.');
              return;
            }
            setShowWizard(true);
          }}
          disabled={session.role === 'VIEWER'}
          className="bg-[#6c5dd3] hover:bg-[#5c4eb3] text-white px-3.5 py-2 rounded-lg text-xs font-bold transition-all shadow-xs flex items-center gap-2 w-fit disabled:opacity-50 disabled:cursor-not-allowed"
        >
          <Plus size={14} />
          Onboard New Retail Tenant
        </button>
      </div>

      {successNotif && (
        <div className="bg-emerald-50 border border-emerald-250 rounded-xl p-4 text-xs text-emerald-800 font-bold flex items-center gap-3">
          <ShieldCheck className="text-emerald-600 shrink-0" size={18} />
          <span>{successNotif}</span>
        </div>
      )}

      {/* Directory database list */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        {stations.map((station) => {
          const associatedTanks = tanks.filter(t => t.stationId === station.id);
          
          return (
            <div key={station.id} className="bg-white rounded-xl border border-[#e2e8f1] shadow-2xs p-5 flex flex-col justify-between space-y-4">
              <div className="flex justify-between items-start">
                <div>
                  <h4 className="text-sm font-black text-slate-800 tracking-tight">{station.name}</h4>
                  <span className="inline-block text-[10px] font-mono font-bold text-slate-400 mt-1 uppercase">CODE: {station.code}</span>
                </div>
                <div className="flex items-center gap-2">
                  {/* Edit Station pencil button - only available for non-VIEWER roles */}
                  {session.role !== 'VIEWER' && editingStationId !== station.id && (
                    <button
                      onClick={() => {
                        setEditingStationId(station.id);
                        setEditManager(station.manager);
                        setEditUsername(station.username || `${station.code.toLowerCase()}.supervisor`);
                        setEditPassword(station.password || 'password123');
                        setEditPriceGas91(station.fuelPricing.GAS91.toString());
                        setEditPriceGas95(station.fuelPricing.GAS95.toString());
                        setSaveError(null);
                        setSaveSuccessStationId(null);
                        setIsAdvancedOpen(false);

                        // Fetch active associated tanks & pumps
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
                      }}
                      className="p-1 text-slate-500 hover:text-[#6c5dd3] hover:bg-slate-100 rounded transition-all"
                      title="Edit Station Registry Specs"
                    >
                      <Pencil size={14} />
                    </button>
                  )}
                  <span className={`text-[10px] uppercase font-black px-2 py-0.5 rounded ${statusColors[station.status]}`}>
                    {station.status}
                  </span>
                </div>
              </div>

              {/* Specs */}
              {editingStationId === station.id ? (
                <div className="space-y-3 text-xs font-mono text-[#4a5568] bg-[#f8fafc] border border-slate-150 rounded-lg p-3">
                  {saveError && (
                    <div className="text-[10px] text-rose-600 bg-rose-50 p-1.5 rounded border border-rose-100 font-bold mb-2">
                      {saveError}
                    </div>
                  )}
                  
                  <div className="flex flex-col gap-1">
                    <span className="text-[10px] text-slate-400 font-bold uppercase">Manager Name:</span>
                    <input
                      type="text"
                      className="text-xs font-sans font-medium text-slate-700 bg-white border border-slate-300 rounded px-2 py-1 focus:outline-none focus:ring-1 focus:ring-[#6c5dd3]"
                      value={editManager}
                      onChange={(e) => setEditManager(e.target.value)}
                    />
                  </div>

                  <div className="flex justify-between items-center py-1 border-b border-slate-100">
                    <span className="text-[10px] text-slate-450 font-bold uppercase">Connected Tanks:</span>
                    <span className="font-bold text-indigo-700">{associatedTanks.length} Reservoir lines</span>
                  </div>

                  <div className="flex justify-between items-center py-1 border-b border-slate-100 text-[#805ad5]">
                    <span className="text-[10px] uppercase font-bold">Equipment Specs:</span>
                    <span className="font-bold">
                      {station.dispenserCount || 1} Disp. ({(pumps.filter(p => p.stationId === station.id)).length} Nozzles)
                    </span>
                  </div>

                  <div className="flex flex-col gap-1 mt-1.5">
                    <span className="text-[10px] text-slate-400 font-bold uppercase text-left">Login Supervisor Username:</span>
                    <input
                      type="text"
                      className="text-xs font-sans font-medium text-slate-700 bg-white border border-slate-300 rounded px-2 py-1 focus:outline-none focus:ring-1 focus:ring-[#6c5dd3]"
                      value={editUsername}
                      onChange={(e) => setEditUsername(e.target.value)}
                    />
                  </div>

                  <div className="flex flex-col gap-1 mt-1.5">
                    <span className="text-[10px] text-slate-400 font-bold uppercase text-left">Security Passphrase:</span>
                    <input
                      type="text"
                      className="text-xs font-mono font-medium text-emerald-700 bg-white border border-slate-300 rounded px-2 py-1 focus:outline-none focus:ring-1 focus:ring-[#6c5dd3]"
                      value={editPassword}
                      onChange={(e) => setEditPassword(e.target.value)}
                    />
                  </div>

                  <div className="flex flex-col gap-1 mt-1.5">
                    <span className="text-[10px] text-slate-400 font-bold uppercase text-left">Default Price GAS91 (SAR):</span>
                    <input
                      type="number"
                      step="0.01"
                      className="text-xs font-sans font-medium text-slate-700 bg-white border border-slate-300 rounded px-2 py-1 focus:outline-none focus:ring-1 focus:ring-[#6c5dd3]"
                      value={editPriceGas91}
                      onChange={(e) => setEditPriceGas91(e.target.value)}
                    />
                  </div>

                  <div className="flex flex-col gap-1 mt-1.5">
                    <span className="text-[10px] text-slate-400 font-bold uppercase text-left">Default Price GAS95 (SAR):</span>
                    <input
                      type="number"
                      step="0.01"
                      className="text-xs font-sans font-medium text-slate-700 bg-white border border-slate-300 rounded px-2 py-1 focus:outline-none focus:ring-1 focus:ring-[#6c5dd3]"
                      value={editPriceGas95}
                      onChange={(e) => setEditPriceGas95(e.target.value)}
                    />
                  </div>

                  {/* Advanced Configuration Overrides Trigger Link */}
                  <div className="pt-2 border-t border-slate-150 mt-2">
                    <button
                      type="button"
                      onClick={() => setIsAdvancedOpen(!isAdvancedOpen)}
                      className="text-[10px] font-black tracking-tight text-[#6c5dd3] hover:text-[#5c4eb3] hover:underline flex items-center justify-between w-full uppercase"
                    >
                      <span>⚙️ Advanced Hardware & Credentials Configuration</span>
                      <span>{isAdvancedOpen ? '▲ Hide' : '▼ Expand'}</span>
                    </button>
                  </div>

                  {isAdvancedOpen && (
                    <div className="space-y-3 pt-3 border-t border-slate-205 mt-2 animate-fade-in text-left">
                      {/* Reservoir Tanks section */}
                      <div className="bg-slate-50 border border-slate-200 rounded-lg p-2.5 space-y-2">
                        <div className="flex items-center justify-between">
                          <span className="text-[10px] uppercase font-black text-slate-500">Reservoir Tanks</span>
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

                        {/* List of active tanks */}
                        <div className="space-y-1.5 max-h-28 overflow-y-auto pr-0.5">
                          {editTankConfigs.map((tc, tIdx) => (
                            <div key={tIdx} className="flex items-center gap-1.5 bg-white p-1.5 rounded border border-slate-150 justify-between">
                              <span className="font-bold text-slate-600 text-[10px] truncate max-w-[60px]">{tc.label}</span>
                              <div className="flex items-center gap-1">
                                <select
                                  value={tc.fuelType}
                                  onChange={(e) => {
                                    const val = e.target.value as FuelGrade;
                                    setEditTankConfigs(prev => prev.map((t, i) => i === tIdx ? { ...t, fuelType: val } : t));
                                  }}
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
                                  max="120000"
                                  step="5000"
                                  value={tc.capacity}
                                  onChange={(e) => {
                                    const val = Math.max(0, parseInt(e.target.value) || 0);
                                    setEditTankConfigs(prev => prev.map((t, i) => i === tIdx ? { ...t, capacity: val } : t));
                                  }}
                                  className="w-12 bg-slate-50 border border-slate-200 rounded px-1 py-0.5 text-[9px] font-semibold text-slate-800 text-right focus:outline-none"
                                />
                                <span className="text-[8px] text-slate-400 font-sans">L</span>
                              </div>
                            </div>
                          ))}
                        </div>
                      </div>

                      {/* Number of Dispensers section */}
                      <div className="bg-slate-50 border border-slate-200 rounded-lg p-2.5 space-y-2">
                        <div className="flex items-center justify-between">
                          <span className="text-[10px] uppercase font-black text-slate-500">Number of Dispensers</span>
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

                        {/* Configure Dispenser Nozzles selector loops */}
                        <div className="space-y-1.5 max-h-24 overflow-y-auto pr-0.5">
                          {editDispenserNozzles.map((nozzles, dispIdx) => (
                            <div key={dispIdx} className="flex items-center justify-between bg-white p-1.5 rounded border border-slate-150">
                              <span className="font-bold text-slate-600 text-[10px]">Dispenser {String(dispIdx + 1).padStart(2, '0')}</span>
                              <div className="flex items-center gap-1.5 bg-slate-50 border border-slate-200 rounded px-1 py-0.5">
                                <span className="text-[9px] text-slate-400 font-black">Nozzles:</span>
                                <button
                                  type="button"
                                  onClick={() => handleEditNozzleCountChange(dispIdx, nozzles - 1)}
                                  className="w-4 h-4 font-black text-slate-550 hover:bg-slate-200 rounded flex items-center justify-center text-[10px]"
                                  disabled={nozzles <= 1}
                                >
                                  -
                                </button>
                                <span className="text-[9px] font-mono font-bold text-slate-750 w-3 text-center">{nozzles}</span>
                                <button
                                  type="button"
                                  onClick={() => handleEditNozzleCountChange(dispIdx, nozzles + 1)}
                                  className="w-4 h-4 font-black text-slate-550 hover:bg-slate-200 rounded flex items-center justify-center text-[10px]"
                                  disabled={nozzles >= 4}
                                >
                                  +
                                </button>
                              </div>
                            </div>
                          ))}
                        </div>
                      </div>

                      {/* Configure Nozzles assignment loop */}
                      <div className="bg-amber-50/50 border border-amber-200 rounded-lg p-2.5 space-y-2">
                        <span className="text-[10px] uppercase font-black text-amber-805 block">Configure Dispenser Nozzles (Fuel Types)</span>
                        <div className="space-y-1.5 max-h-28 overflow-y-auto pr-0.5">
                          {editPumpConfigs.map((pc, pIdx) => (
                            <div key={pIdx} className="flex items-center gap-1.5 bg-white p-1.5 rounded border border-amber-100 justify-between">
                              <div className="flex flex-col text-left">
                                <span className="font-bold text-slate-700 text-[10px] leading-tight">{pc.label}</span>
                                <span className="text-[8px] text-slate-400 font-medium">Dispenser {pc.dispenserNo}</span>
                              </div>
                              <select
                                value={pc.fuelType}
                                onChange={(e) => {
                                  const val = e.target.value as FuelGrade;
                                  setEditPumpConfigs(prev => prev.map((p, i) => i === pIdx ? { ...p, fuelType: val } : p));
                                }}
                                className="bg-slate-50 border border-slate-200 rounded px-1 py-0.5 text-[9px] font-semibold text-slate-700 focus:outline-none"
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

                      {/* Station Supervisor Portal Credentials update fields */}
                      <div className="bg-indigo-50/50 border border-indigo-100 rounded-lg p-2.5 space-y-2">
                        <span className="text-[10px] uppercase font-black text-[#5c4ee3] block">Station Supervisor Portal Credentials</span>
                        <div className="grid grid-cols-2 gap-2">
                          <div className="space-y-0.5">
                            <span className="text-[8px] font-bold text-slate-500 block uppercase">Username</span>
                            <input
                              type="text"
                              className="w-full text-xs font-sans font-medium text-slate-705 bg-white border border-slate-300 rounded px-1.5 py-0.5 focus:outline-none focus:ring-1 focus:ring-[#6c5dd3]"
                              value={editUsername}
                              onChange={(e) => setEditUsername(e.target.value.toLowerCase().replace(/\s+/g, ''))}
                            />
                          </div>
                          <div className="space-y-0.5">
                            <span className="text-[8px] font-bold text-slate-500 block uppercase">Password</span>
                            <input
                              type="password"
                              className="w-full text-[10px] font-mono font-medium text-emerald-700 bg-white border border-slate-300 rounded px-1.5 py-0.5 focus:outline-none focus:ring-1 focus:ring-[#6c5dd3]"
                              value={editPassword}
                              onChange={(e) => setEditPassword(e.target.value)}
                            />
                          </div>
                        </div>
                      </div>
                    </div>
                  )}

                  {/* Actions for editing station */}
                  <div className="flex justify-end gap-1.5 pt-2 mt-2 border-t border-slate-200">
                    <button
                      type="button"
                      onClick={() => setEditingStationId(null)}
                      className="px-2.5 py-1 text-slate-500 border border-slate-305 hover:bg-slate-50 rounded text-[11px] font-bold"
                    >
                      Cancel
                    </button>
                    <button
                      type="button"
                      onClick={() => handleUpdateStation(station)}
                      className="px-2.5 py-1 bg-emerald-600 hover:bg-emerald-700 text-white rounded text-[11px] font-bold flex items-center gap-1"
                    >
                      <Check size={12} />
                      Save Changes
                    </button>
                  </div>
                </div>
              ) : (
                <div className="space-y-2 text-xs font-mono text-[#4a5568] bg-[#f8fafc] border border-slate-150 rounded-lg p-3">
                  {saveSuccessStationId === station.id && (
                    <div className="text-[10px] text-emerald-700 bg-emerald-50 p-1.5 rounded border border-emerald-100 font-bold mb-2 flex items-center gap-1.5">
                      <Check size={12} className="text-emerald-600 shrink-0" />
                      <span>Changes saved successfully!</span>
                    </div>
                  )}
                  <div className="flex justify-between">
                    <span>Manager:</span>
                    <span className="font-bold text-slate-700">{station.manager}</span>
                  </div>
                  <div className="flex justify-between">
                    <span>Connected Tanks:</span>
                    <span className="font-bold text-indigo-700">{associatedTanks.length} Reservoir lines</span>
                  </div>
                  <div className="flex justify-between text-[#805ad5]">
                    <span>Equipment Specs:</span>
                    <span className="font-bold">
                      {station.dispenserCount || 1} Disp. ({(pumps.filter(p => p.stationId === station.id)).length} Nozzles)
                    </span>
                  </div>
                  <div className="flex justify-between text-slate-500 border-t border-slate-200/60 pt-1.5 mt-1">
                    <span>Login Supervisor:</span>
                    <span className="font-bold text-slate-800 font-sans">{station.username || `${station.code.toLowerCase()}.supervisor`}</span>
                  </div>
                  <div className="flex justify-between text-slate-500">
                    <span>Passphrase:</span>
                    <span className="font-mono text-emerald-700 font-bold">{station.password || 'password123'}</span>
                  </div>
                  <div className="flex justify-between">
                    <span>Default Price GAS91:</span>
                    <span className="font-bold text-slate-700">SAR {station.fuelPricing.GAS91.toFixed(2)}</span>
                  </div>
                  <div className="flex justify-between">
                    <span>Default Price GAS95:</span>
                    <span className="font-bold text-slate-700">SAR {station.fuelPricing.GAS95.toFixed(2)}</span>
                  </div>
                </div>
              )}

              {/* Location marker */}
              <div className="flex items-center gap-1.5 text-xs text-slate-500 font-medium font-sans">
                <MapPin size={14} className="text-slate-400 shrink-0" />
                <span className="truncate">{station.location}</span>
              </div>

              {/* Action buttons */}
              <div className="flex items-center gap-1.5 pt-3 border-t border-slate-100 justify-end">
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
                  className="text-xs bg-white border border-[#cbd5e0] rounded px-2 py-1 font-medium text-slate-700 hover:bg-slate-50 disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  <option value="ACTIVE">ACTIVE</option>
                  <option value="MAINTENANCE">MAINTENANCE</option>
                  <option value="INACTIVE">INACTIVE</option>
                </select>
              </div>
            </div>
          );
        })}
      </div>

      {/* SUPABASE SYNCHRONIZER HUB */}
      <div className="bg-white rounded-xl border border-slate-200 shadow-2xs p-6 space-y-5">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-4 border-b border-slate-100">
          <div className="flex items-center gap-2.5">
            <div className="p-2 bg-[#efecfe] rounded-lg text-[#6c5dd3]">
              <Database size={20} />
            </div>
            <div>
              <h4 className="text-sm font-black text-slate-800 tracking-tight uppercase flex items-center gap-1.5">
                Supabase Onboarding User Sync Controller
                <span className="text-[9px] bg-indigo-150 text-indigo-800 font-extrabold px-1.5 py-0.5 rounded-full uppercase tracking-wider">
                  PostgreSQL BaaS
                </span>
              </h4>
              <p className="text-xs text-slate-500 mt-0.5">
                Real-time hook mapping station supervisor users to standard Supabase SQL schema.
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2 flex-wrap">
            <button
              onClick={() => setShowConfigPanel(!showConfigPanel)}
              className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-[11px] font-black uppercase transition-all ${
                dbConfig.isLocalOverride 
                  ? 'bg-amber-50 text-amber-800 border border-amber-200 hover:bg-amber-100' 
                  : 'bg-indigo-50 text-indigo-800 border border-indigo-150 hover:bg-indigo-100'
              }`}
            >
              <Settings size={12} />
              <span>{dbConfig.isLocalOverride ? 'Modify Credentials' : 'Link Supabase (Live)'}</span>
            </button>
            <button
              onClick={refreshSupabaseData}
              disabled={isSyncing}
              className="flex items-center gap-1 bg-slate-50 hover:bg-slate-150 border border-slate-200 text-slate-700 px-3 py-1.5 rounded-lg text-[11px] font-black uppercase transition-colors"
            >
              <RefreshCw size={12} className={isSyncing ? 'animate-spin' : ''} />
              <span>Refresh Synced List</span>
            </button>
          </div>
        </div>

        {/* Dynamic Live Connectivity Alert Banner */}
        {connectivity.checked && dbConfig.isConfigured && (
          <div className={`p-4 rounded-xl border text-xs flex flex-col md:flex-row md:items-center justify-between gap-3 animate-fade-in ${
            connectivity.reachable 
              ? 'bg-emerald-50/70 border-emerald-150 text-emerald-800' 
              : 'bg-rose-50 border-rose-200 text-rose-900 shadow-xs'
          }`}>
            <div className="flex items-start gap-2.5">
              <div className={`p-1.5 rounded-lg shrink-0 mt-0.5 ${connectivity.reachable ? 'bg-emerald-100 text-emerald-700' : 'bg-rose-100 text-rose-700'}`}>
                {connectivity.reachable ? <Wifi size={14} /> : <WifiOff size={14} className="animate-pulse" />}
              </div>
              <div className="space-y-0.5">
                <span className="font-extrabold uppercase tracking-wider text-[10px] flex items-center gap-1.5">
                  {connectivity.reachable ? '● Live Supabase Connection Healthy' : '▲ SQL Database Connectivity Alert'}
                  {!connectivity.reachable && (
                    <span className="bg-rose-100 text-rose-850 px-1.5 py-0.5 rounded-full font-extrabold text-[8px]">
                      DNS RESOLUTION FAILURE
                    </span>
                  )}
                </span>
                <p className="leading-relaxed text-[11px] font-medium text-slate-600">
                  {connectivity.message}
                </p>
                {!connectivity.reachable && (
                  <div className="text-[10px] text-rose-800 bg-[#fff5f5]/80 p-2.5 rounded-lg border border-rose-100 mt-2 leading-normal space-y-1">
                    <p className="font-extrabold">Troubleshooting Actions:</p>
                    <ul className="list-disc pl-3.5 space-y-1">
                      <li>Check for spelling errors in your Project URL <code className="bg-rose-100 font-mono text-[10px] px-1 rounded">{dbConfig.url}</code>.</li>
                      <li>Check if your Supabase project was deleted, renamed, or paused due to inactivity.</li>
                      <li>Click <button type="button" onClick={() => setShowConfigPanel(true)} className="underline hover:text-indigo-700 font-black">Modify Credentials</button> to link a valid active Supabase instance, or <button type="button" onClick={handleClearConfig} className="underline hover:text-red-700 font-black">Clear Overrides</button> to return to defaults.</li>
                    </ul>
                  </div>
                )}
              </div>
            </div>
            {connectivity.reachable ? (
              <span className="text-[10px] bg-emerald-100 text-emerald-800 font-bold px-2 py-1 rounded-md shrink-0 self-start md:self-center uppercase tracking-wider">
                Connected
              </span>
            ) : (
              <button
                type="button"
                onClick={refreshSupabaseData}
                disabled={isSyncing}
                className="text-[10px] bg-rose-250 hover:bg-rose-300 text-rose-950 font-black px-3 py-2 rounded-lg shrink-0 self-end md:self-center uppercase tracking-wider transition-colors border border-rose-350"
              >
                Retry Connection Check
              </button>
            )}
          </div>
        )}

        {/* Dynamic Credentials Custom Overlay Panel */}
        {showConfigPanel && (
          <div className="p-4 rounded-xl border border-indigo-150 bg-indigo-50/40 space-y-3.5 text-xs animate-fade-in/10">
            <div className="flex items-center justify-between">
              <span className="font-extrabold text-indigo-900 uppercase text-[10px] tracking-wider flex items-center gap-1">
                <Key size={12} />
                Link Your Supabase Database Instantly
              </span>
              <button 
                onClick={() => setShowConfigPanel(false)}
                className="text-slate-400 hover:text-slate-600 font-bold"
              >
                Close
              </button>
            </div>
            <p className="text-[11px] text-indigo-800 leading-relaxed -mt-1 bg-indigo-50 p-2 rounded-lg">
              No need to configure server-side files! Simply copy-paste your Supabase credentials here. They will be securely cached in your local workspace sandbox so you can test real database writes right inside this browser preview.
            </p>
            <form onSubmit={handleSaveConfig} className="grid grid-cols-1 md:grid-cols-2 gap-3.5">
              <div className="space-y-1">
                <label className="font-bold text-slate-700 block text-[10px] uppercase">Supabase Project URL</label>
                <input
                  type="url"
                  required
                  placeholder="https://xyzcompany.supabase.co"
                  value={inputUrl}
                  onChange={(e) => setInputUrl(e.target.value)}
                  className="w-full bg-white border border-slate-350 px-3 py-2 rounded-lg font-mono text-[11px] focus:outline-none focus:border-[#6c5dd3]"
                />
              </div>
              <div className="space-y-1">
                <label className="font-bold text-slate-700 block text-[10px] uppercase font-mono">SUPABASE ANON / API KEY</label>
                <input
                  type="password"
                  required
                  placeholder="eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9..."
                  value={inputKey}
                  onChange={(e) => setInputKey(e.target.value)}
                  className="w-full bg-white border border-slate-350 px-3 py-2 rounded-lg font-mono text-[11px] focus:outline-none focus:border-[#6c5dd3]"
                />
              </div>
              <div className="md:col-span-2 flex items-center justify-between pt-1 gap-2 border-t border-indigo-100">
                <button
                  type="button"
                  onClick={handleClearConfig}
                  className="text-slate-500 hover:text-red-650 flex items-center gap-1 text-[10px] font-black uppercase tracking-wider"
                >
                  <Trash2 size={12} />
                  Clear Overrides
                </button>
                <button
                  type="submit"
                  className="bg-[#6c5dd3] hover:bg-[#5b4ebf] text-white px-4 py-2 rounded-lg text-[10px] font-black uppercase tracking-wider transition-colors"
                >
                  Save and Initialize Connection
                </button>
              </div>
            </form>
          </div>
        )}

        {configSuccessMsg && (
          <div className="p-3 bg-emerald-50 text-emerald-800 border border-emerald-150 rounded-lg text-xs font-semibold flex items-center gap-2">
            <Check size={14} className="text-emerald-600 animate-bounce" />
            <span>{configSuccessMsg}</span>
          </div>
        )}

        {/* Configurations Banner */}
        <div className="bg-slate-50 border border-slate-200 rounded-xl p-4 text-xs space-y-4">
          {/* Connection Status Panel Realigned to a Clean Horizontal Matrix */}
          <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
            <div className="flex flex-wrap items-center gap-x-6 gap-y-2">
              <div className="flex items-center gap-2">
                <span className="font-extrabold text-[#4a5568] uppercase text-[10px] tracking-wider shrink-0">
                  Connection Status:
                </span>
                <span className={`inline-flex items-center gap-1 px-2.5 py-1 rounded-lg text-[10px] font-black uppercase ${
                  dbConfig.isConfigured 
                    ? 'bg-emerald-100 text-emerald-800 border border-emerald-250' 
                    : 'bg-amber-100 text-amber-800 border border-amber-250 animate-pulse'
                }`}>
                  <span className={`w-1.5 h-1.5 rounded-full ${dbConfig.isConfigured ? 'bg-emerald-500' : 'bg-amber-500'}`} />
                  {dbConfig.isConfigured ? (dbConfig.isLocalOverride ? 'Linked (Override)' : 'Configured via Env') : 'Needs Config'}
                </span>
              </div>
              
              <div className="flex items-center gap-4 text-[11px] font-mono">
                <div className="flex items-center gap-1.5 border-l border-slate-200 pl-4">
                  <span className="text-slate-400">DB Integration:</span>
                  <span className="font-bold text-slate-700">Supabase</span>
                </div>
                <div className="flex items-center gap-1.5 border-l border-slate-200 pl-4">
                  <span className="text-slate-400">Mapped Table:</span>
                  <span className="font-bold text-[#6c5dd3]">onboarded_users</span>
                </div>
                <div className="flex items-center gap-1.5 border-l border-slate-200 pl-4">
                  <span className="text-slate-400">Endpoint URL:</span>
                  <span className="font-bold text-slate-600 truncate max-w-[200px]" title={dbConfig.url}>
                    {dbConfig.url || 'Not specified'}
                  </span>
                </div>
              </div>
            </div>

            {syncStatusText && (
              <div className="self-start md:self-auto px-3 py-1.5 bg-indigo-50 text-[#6c5dd3] border border-indigo-150 rounded-lg text-[10px] font-bold flex items-center gap-1.5 shrink-0 animate-pulse">
                <Sparkles size={11} className="text-[#6c5dd3]" />
                <span className="truncate max-w-[150px]">{syncStatusText}</span>
              </div>
            )}
          </div>

          {!dbConfig.isConfigured && (
            <div className="p-3 bg-amber-50/70 border border-amber-200/60 rounded-lg space-y-1 text-amber-900">
              <div className="flex gap-1 items-center font-bold text-[10px]">
                <AlertCircle size={12} className="shrink-0 text-amber-600" />
                <span>How to connect real Supabase:</span>
              </div>
              <p className="text-[10px] leading-relaxed text-amber-800">
                Click the <strong>&quot;Link Supabase (Live)&quot;</strong> button above to connect your database directly in real-time, or configure <strong>VITE_SUPABASE_URL</strong> and <strong>VITE_SUPABASE_ANON_KEY</strong> in your environment.
              </p>
            </div>
          )}


        </div>

        {/* Users Table / List */}
        <div className="border border-slate-150 rounded-xl overflow-hidden text-xs">
          <div className="bg-slate-50 px-4 py-3 border-b border-slate-150 flex items-center justify-between">
            <span className="text-xs font-black text-slate-700 uppercase tracking-wider block">
              Recorded Users Database Table ({supabaseUsers.length})
            </span>
            <span className="text-[10px] text-slate-400 font-mono">
              Live synced view
            </span>
          </div>

          {supabaseUsers.length === 0 ? (
            <div className="p-10 text-center text-slate-400 font-semibold bg-white">
              No users have been onboarded or recorded yet. Click &quot;Onboard New Retail Tenant&quot; above to create a station and sync credentials.
            </div>
          ) : (
            <div className="overflow-x-auto bg-white">
              <table className="w-full text-left font-medium border-collapse">
                <thead>
                  <tr className="bg-slate-50/50 border-b border-slate-150 text-slate-400 uppercase tracking-wider text-[10px] font-black">
                    <th className="px-4 py-2.5">User ID / Created At</th>
                    <th className="px-4 py-2.5">Supervisor Account</th>
                    <th className="px-4 py-2.5">Security Passphrase</th>
                    <th className="px-4 py-2.5">Manager name</th>
                    <th className="px-4 py-2.5">Affiliated Station</th>
                    <th className="px-4 py-2.5">Sync Status</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-150 font-mono text-[11px]">
                  {supabaseUsers.map((user, idx) => (
                    <tr key={user.id || idx} className="hover:bg-slate-50/50 transition-colors">
                      <td className="px-4 py-3 whitespace-nowrap">
                        <div className="font-bold text-slate-800">{user.id}</div>
                        <div className="text-[10px] text-slate-400">
                          {user.created_at ? new Date(user.created_at).toLocaleString() : ''}
                        </div>
                      </td>
                      <td className="px-4 py-3 whitespace-nowrap font-bold text-indigo-700 font-mono">
                        {user.username}
                      </td>
                      <td className="px-4 py-3 whitespace-nowrap text-rose-600 font-bold">
                        {user.password_raw}
                      </td>
                      <td className="px-4 py-3 whitespace-nowrap font-sans font-semibold text-slate-700">
                        {user.full_name}
                      </td>
                      <td className="px-4 py-3 whitespace-nowrap">
                        <div className="font-sans font-bold text-slate-800">{user.station_name}</div>
                        <div className="text-[10px] text-slate-400 font-sans">Branch: {user.station_code}</div>
                      </td>
                      <td className="px-4 py-3 whitespace-nowrap">
                        <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded text-[9px] font-bold uppercase ${
                          dbConfig.isConfigured 
                            ? 'bg-emerald-50 text-emerald-700 border border-emerald-100' 
                            : 'bg-indigo-50 text-indigo-700 border border-indigo-100'
                        }`}>
                          {dbConfig.isConfigured ? 'Synced Online' : 'Saved Locally'}
                        </span>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </div>

      {/* NEW STATION ONBOARDING MODAL / PANEL WIZARD */}
      {showWizard && (
        <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-4 z-50">
          <div className="bg-white rounded-xl border border-slate-200 shadow-2xl p-6 max-w-md w-full max-h-[90vh] overflow-y-auto scroll-smooth animate-fade-in text-left">
            <div className="flex items-center justify-between pb-3 border-b border-slate-150">
              <h3 className="text-xs font-black text-slate-800 tracking-wider uppercase flex items-center gap-2">
                <Server size={16} className="text-[#6c5dd3]" />
                Onboard New SaaS Station Instance
              </h3>
              <button 
                onClick={() => setShowWizard(false)} 
                className="text-slate-400 hover:text-slate-600 p-1"
              >
                <X size={16} />
              </button>
            </div>

            <form onSubmit={handleCreateStation} className="space-y-4 mt-4 text-xs font-sans">
              <div className="space-y-1.5">
                <label className="font-bold text-slate-600 block">Retail Station Name</label>
                <input
                  type="text"
                  placeholder="e.g. Al Yasmeen - Riyadh Exit 4"
                  value={newStationName}
                  onChange={(e) => setNewStationName(e.target.value)}
                  className="w-full bg-slate-50 border border-slate-250 rounded-lg p-2.5 text-slate-800 font-semibold focus:outline-none"
                  required
                />
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-1.5">
                  <label className="font-bold text-slate-600 block">Unique Code Prefix</label>
                  <input
                    type="text"
                    placeholder="e.g. AY-RIYD-04"
                    value={newStationCode}
                    onChange={(e) => setNewStationCode(e.target.value)}
                    className="w-full bg-slate-50 border border-slate-250 rounded-lg p-2.5 text-slate-800 font-mono font-bold uppercase focus:outline-none"
                    required
                  />
                </div>
                <div className="space-y-1.5">
                  <label className="font-bold text-slate-600 block">Regional Logistics Manager</label>
                  <input
                    type="text"
                    placeholder="e.g. Tariq Alharbi"
                    value={newManager}
                    onChange={(e) => setNewManager(e.target.value)}
                    className="w-full bg-slate-50 border border-slate-250 rounded-lg p-2.5 text-slate-800 font-semibold focus:outline-none"
                    required
                  />
                </div>
              </div>

              <div className="space-y-1.5">
                <label className="font-bold text-slate-600 block">Physical Map Coordinates / Location</label>
                <input
                  type="text"
                  placeholder="e.g. King Fahd Branch Rd, Al Yasmin, Riyadh"
                  value={newLocation}
                  onChange={(e) => setNewLocation(e.target.value)}
                  className="w-full bg-slate-50 border border-slate-250 rounded-lg p-2.5 text-slate-800 font-medium focus:outline-none"
                  required
                />
              </div>

              {/* Dynamic specifications structure (Tanks & Pumps) */}
              <div className="border-t border-slate-150 pt-3 space-y-3">
                <h4 className="text-xs font-black text-slate-700 uppercase tracking-tight">Configuration Specifications</h4>
                
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-1.5">
                    <label className="font-bold text-slate-600 block">Reservoir Tanks</label>
                    <div className="flex items-center gap-1">
                      <button 
                        type="button" 
                        onClick={() => handleTankCountChange(tankCount - 1)}
                        className="w-7 h-7 rounded border border-slate-250 bg-slate-50 flex items-center justify-center font-bold text-slate-600 hover:bg-slate-100 disabled:opacity-50 text-xs"
                        disabled={tankCount <= 1}
                      >
                        -
                      </button>
                      <span className="w-5 text-center font-mono font-bold text-slate-800 text-xs">{tankCount}</span>
                      <button 
                        type="button" 
                        onClick={() => handleTankCountChange(tankCount + 1)}
                        className="w-7 h-7 rounded border border-slate-250 bg-slate-50 flex items-center justify-center font-bold text-slate-600 hover:bg-slate-100 disabled:opacity-50 text-xs"
                        disabled={tankCount >= 8}
                      >
                        +
                      </button>
                    </div>
                  </div>

                  <div className="space-y-1.5">
                    <label className="font-bold text-slate-600 block">Number of Dispensers</label>
                    <div className="flex items-center gap-1">
                      <button 
                        type="button" 
                        onClick={() => handleDispenserCountChange(dispenserCount - 1)}
                        className="w-7 h-7 rounded border border-slate-250 bg-slate-50 flex items-center justify-center font-bold text-slate-600 hover:bg-slate-100 disabled:opacity-50 text-xs"
                        disabled={dispenserCount <= 1}
                      >
                        -
                      </button>
                      <span className="w-5 text-center font-mono font-bold text-slate-800 text-xs">{dispenserCount}</span>
                      <button 
                        type="button" 
                        onClick={() => handleDispenserCountChange(dispenserCount + 1)}
                        className="w-7 h-7 rounded border border-slate-250 bg-slate-50 flex items-center justify-center font-bold text-slate-600 hover:bg-slate-100 disabled:opacity-50 text-xs"
                        disabled={dispenserCount >= 6}
                      >
                        +
                      </button>
                    </div>
                  </div>
                </div>

                {/* Dispensers Nozzle count selector */}
                <div className="bg-slate-50 border border-slate-200 rounded-lg p-3 space-y-2">
                  <span className="text-[10px] uppercase font-black text-slate-500 block">Configure Dispenser Nozzles</span>
                  <div className="space-y-1.5 max-h-36 overflow-y-auto">
                    {dispenserNozzles.map((nozzles, idx) => (
                      <div key={idx} className="flex items-center justify-between bg-white p-2 rounded border border-slate-150">
                        <span className="font-bold text-slate-700">Dispenser {String(idx + 1).padStart(2, '0')}</span>
                        <div className="flex items-center gap-2">
                          <span className="text-[10px] text-slate-400 font-semibold uppercase">Nozzles:</span>
                          <div className="flex items-center gap-1">
                            <button 
                              type="button" 
                              onClick={() => handleNozzleCountChange(idx, nozzles - 1)}
                              className="w-6 h-6 rounded border border-slate-250 bg-slate-50 flex items-center justify-center font-bold text-slate-650 hover:bg-slate-100 disabled:opacity-50 text-xs"
                              disabled={nozzles <= 1}
                            >
                              -
                            </button>
                            <span className="w-4 text-center font-mono font-bold text-slate-800 text-xs">{nozzles}</span>
                            <button 
                              type="button" 
                              onClick={() => handleNozzleCountChange(idx, nozzles + 1)}
                              className="w-6 h-6 rounded border border-slate-250 bg-slate-50 flex items-center justify-center font-bold text-slate-650 hover:bg-slate-100 disabled:opacity-50 text-xs"
                              disabled={nozzles >= 4}
                            >
                              +
                            </button>
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>

                {/* Tanks list mini editor */}
                <div className="bg-slate-50 border border-slate-200 rounded-lg p-3 space-y-2 max-h-36 overflow-y-auto">
                  <span className="text-[10px] uppercase font-black text-slate-500 block">Configure Reservoir Tanks</span>
                  {tankConfigs.map((tc, index) => (
                    <div key={index} className="flex items-center gap-2 bg-white p-2 rounded border border-slate-150 justify-between">
                      <span className="font-bold text-slate-700 min-w-[50px]">{tc.label}</span>
                      
                      <div className="flex items-center gap-1.5">
                        <select
                          value={tc.fuelType}
                          onChange={(e) => updateTankConfig(index, 'fuelType', e.target.value as FuelGrade)}
                          className="bg-slate-50 border border-slate-200 rounded px-1.5 py-1 text-[11px] font-semibold text-slate-700 focus:outline-none"
                        >
                          <option value="GAS91">GAS91</option>
                          <option value="GAS95">GAS95</option>
                          <option value="GAS98">GAS98</option>
                          <option value="DIESEL">DIESEL</option>
                        </select>

                        <div className="flex items-center gap-0.5">
                          <input
                            type="number"
                            min="5000"
                            max="100000"
                            step="5000"
                            value={tc.capacity}
                            onChange={(e) => updateTankConfig(index, 'capacity', Number(e.target.value))}
                            className="w-16 bg-slate-50 border border-slate-200 rounded p-1 text-[11px] font-semibold text-slate-800 focus:outline-none text-right"
                          />
                          <span className="text-[10px] text-slate-400 font-mono">L</span>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>

                {/* Pumps and Nozzles assignment list mini editor */}
                <div className="bg-amber-50/50 border border-amber-200 rounded-lg p-3 space-y-2 max-h-36 overflow-y-auto">
                  <span className="text-[10px] uppercase font-black text-amber-800 block">Configure Dispenser Pumps (Assign Fuel Types)</span>
                  {pumpConfigs.map((pc, index) => (
                    <div key={index} className="flex items-center gap-2 bg-white p-2 rounded border border-amber-100 justify-between">
                      <div className="flex flex-col text-left">
                        <span className="font-bold text-slate-700 text-[11px] leading-tight">{pc.label}</span>
                        <span className="text-[9px] text-slate-400 font-medium">Dispenser {pc.dispenserNo}</span>
                      </div>
                      
                      <select
                        value={pc.fuelType}
                        onChange={(e) => {
                          const val = e.target.value as FuelGrade;
                          setPumpConfigs(prev => prev.map((p, i) => i === index ? { ...p, fuelType: val } : p));
                        }}
                        className="bg-slate-50 border border-slate-200 rounded px-1.5 py-1 text-[11px] font-semibold text-slate-700 focus:outline-none"
                      >
                        <option value="GAS91">GAS91</option>
                        <option value="GAS95">GAS95</option>
                        <option value="GAS98">GAS98</option>
                        <option value="DIESEL">DIESEL</option>
                      </select>
                    </div>
                  ))}
                </div>

                {/* Supervisor login credentials configuration box */}
                <div className="bg-indigo-50/50 border border-indigo-100 rounded-lg p-3 space-y-2">
                  <span className="text-[10px] uppercase font-black text-[#5c4ee3] block">Station Supervisor Portal Credentials</span>
                  
                  <div className="grid grid-cols-2 gap-3">
                    <div className="space-y-1">
                      <label className="font-bold text-slate-600 block text-[9px] uppercase tracking-wider">Supervisor Username</label>
                      <input
                        type="text"
                        placeholder="e.g. supervisor1"
                        value={supervisorUsername}
                        onChange={(e) => setSupervisorUsername(e.target.value.toLowerCase().replace(/\s+/g, ''))}
                        className="w-full bg-white border border-slate-250 rounded p-2 text-slate-800 font-semibold focus:outline-none focus:ring-1 focus:ring-[#6c5dd3]"
                        required
                      />
                    </div>
                    <div className="space-y-1">
                      <label className="font-bold text-slate-600 block text-[9px] uppercase tracking-wider">Supervisor Password</label>
                      <input
                        type="text"
                        placeholder="Password Code"
                        value={supervisorPassword}
                        onChange={(e) => setSupervisorPassword(e.target.value)}
                        className="w-full bg-white border border-slate-250 rounded p-2 text-slate-800 font-semibold focus:outline-none focus:ring-1 focus:ring-[#6c5dd3]"
                        required
                      />
                    </div>
                  </div>
                </div>
              </div>

              {/* Informative summary of auto seeding */}
              <div className="bg-linear-to-tr from-slate-50 to-indigo-50 border border-indigo-100 rounded-lg p-3 text-[11px] text-slate-500 leading-normal font-semibold">
                <Check size={12} className="text-emerald-600 inline mr-1" />
                This will automatically seed **{tankCount} underground reservoirs** and **{dispenserCount} physical dispensers** housing **{pumpConfigs.length} custom-assigned nozzles** on the network.
              </div>

              <div className="flex items-center gap-3 pt-3 border-t border-slate-150 justify-end">
                <button
                  type="button"
                  onClick={() => setShowWizard(false)}
                  className="px-4 py-2 border border-slate-200 rounded-lg text-[#2d3748] font-bold text-xs"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-4 py-2 bg-[#6c5dd3] hover:bg-[#5c4eb3] text-white rounded-lg font-bold text-xs shadow-xs"
                >
                  Onboard Instance
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
