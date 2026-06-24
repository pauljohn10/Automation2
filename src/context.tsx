/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { createContext, useContext, useState, useEffect } from 'react';
import { FuelStation, FuelTank, FuelPump, SalesTransaction, AuditLog, UserSession, FuelGrade } from './types';
import { INITIAL_STATIONS, INITIAL_TANKS, INITIAL_PUMPS, INITIAL_TRANSACTIONS, INITIAL_AUDIT_LOGS } from './mockData';
import {
  getSupabaseConfig,
  getSupabaseClient,
  fetchStationsFromSupabase,
  fetchTanksFromSupabase,
  fetchPumpsFromSupabase,
  fetchTransactionsFromSupabase,
  fetchAuditsFromSupabase,
  upsertStationInSupabase,
  upsertTankInSupabase,
  upsertPumpInSupabase,
  onboardStationWithAssets,
  insertTransactionInSupabase,
  insertAuditInSupabase,
  clearAllDataFromSupabase,
  deleteStationFromSupabase,
  fetchOnboardedUsers,
  fetchUserProfiles,
  syncAllDataBulk,
  SupabaseUserRecord,
  SupabaseUserProfile
} from './supabaseClient';

interface FuelSystemContextType {
  stations: FuelStation[];
  tanks: FuelTank[];
  pumps: FuelPump[];
  transactions: SalesTransaction[];
  auditLogs: AuditLog[];
  session: UserSession;
  activeStation: FuelStation | undefined;
  isLoading: boolean;
  
  // Setters/Mutations
  setSession: (session: UserSession) => void;
  addStation: (station: FuelStation, stationTanks: FuelTank[], stationPumps?: FuelPump[]) => Promise<{ success: boolean; error?: any }>;
  deleteStation: (stationId: string) => Promise<{ success: boolean; error?: any }>;
  updateStationStatus: (stationId: string, status: 'ACTIVE' | 'MAINTENANCE' | 'INACTIVE') => void;
  updateLocalPricing: (stationId: string, grade: FuelGrade, price: number) => void;
  resetTankWater: (tankId: string) => void;
  triggerFuelDelivery: (tankId: string, volume: number) => { success: boolean; message: string };
  dispenseFuel: (pumpId: string, grade: FuelGrade, volume: number) => { success: boolean; message: string };
  confirmDispenseTransaction: (pumpId: string) => { success: boolean; message: string };
  addCustomAuditLog: (action: string, details: string, stationId?: string) => void;
  clearAllData: () => void;
  refreshAllFromSupabase: () => Promise<{ success: boolean; message: string }>;
  updateTankLevel: (tankId: string, level: number) => Promise<{ success: boolean; message: string }>;
}

const FuelSystemContext = createContext<FuelSystemContextType | undefined>(undefined);

export const FuelSystemProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [stations, setStations] = useState<FuelStation[]>(() => INITIAL_STATIONS);
  const [tanks, setTanks] = useState<FuelTank[]>(() => INITIAL_TANKS);
  const [pumps, setPumps] = useState<FuelPump[]>(() => INITIAL_PUMPS);
  const [transactions, setTransactions] = useState<SalesTransaction[]>(() => INITIAL_TRANSACTIONS);
  const [auditLogs, setAuditLogs] = useState<AuditLog[]>(() => INITIAL_AUDIT_LOGS);
  const [isLoading, setIsLoading] = useState<boolean>(false);

  // Use state sessionStorage fallback instead of persistent localStorage
  const [session, setSessionState] = useState<UserSession>(() => {
    try {
      const saved = sessionStorage.getItem('fuel_user_session');
      return saved ? JSON.parse(saved) : {
        role: 'SUPER_ADMIN',
        name: 'HQ Super Admin',
        activeStationId: ''
      };
    } catch {
      return {
        role: 'SUPER_ADMIN',
        name: 'HQ Super Admin',
        activeStationId: ''
      };
    }
  });

  const setSession = (newSession: UserSession) => {
    setSessionState(newSession);
    try {
      sessionStorage.setItem('fuel_user_session', JSON.stringify(newSession));
    } catch {}
  };

  const activeStation = stations.find(s => s.id === session.activeStationId);

  // Load and sync entire operational state from live Supabase Tables on mount
  useEffect(() => {
    refreshAllFromSupabase();
  }, []);

  const refreshAllFromSupabase = async (): Promise<{ success: boolean; message: string }> => {
    const config = getSupabaseConfig();
    if (!config.isConfigured) {
      return { success: false, message: 'Supabase credentials are not configured yet.' };
    }

    setIsLoading(true);
    try {
      console.log('Downloading master datasets from Supabase Tables...');
      const [dbStations, dbTanks, dbPumps, dbTransactions, dbAudits, dbOnboarded, dbProfiles] = await Promise.all([
        fetchStationsFromSupabase(),
        fetchTanksFromSupabase(),
        fetchPumpsFromSupabase(),
        fetchTransactionsFromSupabase(),
        fetchAuditsFromSupabase(),
        fetchOnboardedUsers(),
        fetchUserProfiles()
      ]);

      // Load local custom users from localStorage
      let localUserProfiles: SupabaseUserProfile[] = [];
      try {
        const stored = localStorage.getItem('petrologic_custom_users');
        if (stored) {
          const parsed = JSON.parse(stored) as any[];
          localUserProfiles = parsed
            .filter(u => u.role === 'SUPER_ADMIN' || u.role === 'ADMIN' || u.role === 'VIEWER')
            .map(u => ({ id: u.id, email: u.email, role: u.role }));
        }
      } catch {}

      // Load local onboarded users from sessionStorage
      let localOnboardedUsers: SupabaseUserRecord[] = [];
      try {
        const stored = sessionStorage.getItem('fuel_system_onboarded_users_fallback');
        if (stored) {
          localOnboardedUsers = JSON.parse(stored) as SupabaseUserRecord[];
        }
      } catch {}

      // Determine if local state is just the default initialized mock data
      const isDefaultMockData = 
        stations.length === INITIAL_STATIONS.length &&
        stations.every(s => INITIAL_STATIONS.some(is => is.id === s.id)) &&
        tanks.length === INITIAL_TANKS.length &&
        pumps.length === INITIAL_PUMPS.length;

      let mergedStations = stations;
      let mergedTanks = tanks;
      let mergedPumps = pumps;
      let mergedTransactions = transactions;
      let mergedAudits = auditLogs;
      let mergedOnboarded = localOnboardedUsers;
      let mergedProfiles = localUserProfiles;

      const hasDbData = dbStations && dbStations.length > 0;

      if (hasDbData) {
        if (isDefaultMockData) {
          // Unidirectional pull (overwrite local state with DB state)
          mergedStations = dbStations;
          mergedTanks = dbTanks || [];
          mergedPumps = dbPumps || [];
          mergedTransactions = dbTransactions || [];
          mergedAudits = dbAudits || [];
          mergedOnboarded = dbOnboarded || [];
          mergedProfiles = dbProfiles || [];
        } else {
          // Bidirectional merge
          const mergeLists = <T extends { id: string }>(localList: T[], dbList: T[]): T[] => {
            const mergedMap = new Map<string, T>();
            dbList.forEach(item => mergedMap.set(item.id, item));
            localList.forEach(item => mergedMap.set(item.id, item));
            return Array.from(mergedMap.values());
          };

          const mergeStations = (localList: FuelStation[], dbList: FuelStation[]): FuelStation[] => {
            const mergedMap = new Map<string, FuelStation>();
            dbList.forEach(item => mergedMap.set(item.code.toLowerCase(), item));
            localList.forEach(item => {
              const existing = mergedMap.get(item.code.toLowerCase());
              if (existing) {
                mergedMap.set(item.code.toLowerCase(), {
                  ...item,
                  id: existing.id
                });
              } else {
                mergedMap.set(item.code.toLowerCase(), item);
              }
            });
            return Array.from(mergedMap.values());
          };

          const mergeOnboardedUsers = (localList: SupabaseUserRecord[], dbList: SupabaseUserRecord[]): SupabaseUserRecord[] => {
            const mergedMap = new Map<string, SupabaseUserRecord>();
            dbList.forEach(item => mergedMap.set(item.username.toLowerCase(), item));
            localList.forEach(item => {
              const existing = mergedMap.get(item.username.toLowerCase());
              if (existing) {
                mergedMap.set(item.username.toLowerCase(), {
                  ...item,
                  id: existing.id
                });
              } else {
                mergedMap.set(item.username.toLowerCase(), item);
              }
            });
            return Array.from(mergedMap.values());
          };

          const mergeUserProfiles = (localList: SupabaseUserProfile[], dbList: SupabaseUserProfile[]): SupabaseUserProfile[] => {
            const mergedMap = new Map<string, SupabaseUserProfile>();
            dbList.forEach(item => mergedMap.set(item.email.toLowerCase(), item));
            localList.forEach(item => {
              const existing = mergedMap.get(item.email.toLowerCase());
              if (existing) {
                mergedMap.set(item.email.toLowerCase(), {
                  ...item,
                  id: existing.id
                });
              } else {
                mergedMap.set(item.email.toLowerCase(), item);
              }
            });
            return Array.from(mergedMap.values());
          };

          mergedStations = mergeStations(stations, dbStations);
          mergedTanks = mergeLists(tanks, dbTanks || []);
          mergedPumps = mergeLists(pumps, dbPumps || []);
          mergedTransactions = mergeLists(transactions, dbTransactions || []);
          mergedAudits = mergeLists(auditLogs, dbAudits || []);
          mergedOnboarded = mergeOnboardedUsers(localOnboardedUsers, dbOnboarded || []);
          mergedProfiles = mergeUserProfiles(localUserProfiles, dbProfiles || []);
        }
      } else {
        // DB is empty, push local state to seed it
        console.log('Supabase tables are empty. Seeding database with current local state...');
      }

      // Perform a full bulk sync across all records
      const syncRes = await syncAllDataBulk({
        stations: mergedStations,
        tanks: mergedTanks,
        pumps: mergedPumps,
        transactions: mergedTransactions,
        audits: mergedAudits,
        onboardedUsers: mergedOnboarded,
        userProfiles: mergedProfiles
      });

      if (!syncRes.success) {
        console.warn('Supabase bulk upload warning:', syncRes.message);
      }

      // Update React state
      if (mergedStations.length > 0) {
        setStations(mergedStations);
        setSessionState(prev => {
          const exists = mergedStations.some(s => s.id === prev.activeStationId);
          if (!prev.activeStationId || !exists) {
            const updated = {
              ...prev,
              activeStationId: mergedStations[0].id
            };
            try {
              sessionStorage.setItem('fuel_user_session', JSON.stringify(updated));
            } catch {}
            return updated;
          }
          return prev;
        });
      }
      setTanks(mergedTanks);
      setPumps(mergedPumps);
      setTransactions(mergedTransactions.sort((a, b) => b.id.localeCompare(a.id)));
      setAuditLogs(mergedAudits.sort((a, b) => b.id.localeCompare(a.id)));

      // Update sessionStorage / localStorage cache
      try {
        sessionStorage.setItem('fuel_system_onboarded_users_fallback', JSON.stringify(mergedOnboarded));
      } catch {}

      try {
        const stored = localStorage.getItem('petrologic_custom_users');
        let fullCustomUsers: any[] = stored ? JSON.parse(stored) : [];
        const updatedCustomUsers = mergedProfiles.map(p => {
          const match = fullCustomUsers.find(cu => cu.id === p.id);
          return {
            id: p.id,
            fullName: match?.fullName || p.email.split('@')[0].toUpperCase(),
            email: p.email,
            assignedStationId: 'all',
            assignedStationName: 'Central HQ',
            role: p.role,
            status: match?.status || 'Active',
            createdAt: match?.createdAt || new Date().toISOString(),
            lastLogin: match?.lastLogin || new Date().toISOString()
          };
        });
        localStorage.setItem('petrologic_custom_users', JSON.stringify(updatedCustomUsers));
      } catch {}

      setIsLoading(false);
      return { success: true, message: 'All systems loaded and synchronized successfully!' };
    } catch (err: any) {
      console.error('Core synchronizer exception:', err);
      setIsLoading(false);
      return { success: false, message: err.message || 'Verification or link failure.' };
    }
  };

  const addCustomAuditLog = (action: string, details: string, stationId?: string) => {
    const newLog: AuditLog = {
      id: `aud-${Date.now()}`,
      stationId,
      timestamp: new Date().toLocaleDateString('en-US', { month: '2-digit', day: '2-digit' }) + ' ' + new Date().toLocaleTimeString('en-US', { hour12: false, hour: '2-digit', minute: '2-digit' }),
      user: session.name,
      role: session.role,
      action,
      details,
      ipAddress: '192.168.10.' + Math.floor(Math.random() * 254 + 1)
    };
    setAuditLogs(prev => [newLog, ...prev]);
    insertAuditInSupabase(newLog); // Push to Cloud DB
  };

  const addStation = (station: FuelStation, stationTanks: FuelTank[], stationPumps?: FuelPump[]): Promise<{ success: boolean; error?: any }> => {
    setStations(prev => [...prev, station]);
    setTanks(prev => [...prev, ...stationTanks]);
    
    // Auto-create standard pumps or use provided dynamic pumps for the new station
    const newPumps: FuelPump[] = stationPumps || [
      { id: `pump-01-${station.id}`, stationId: station.id, label: 'Pump 01', status: 'IDLE' },
      { id: `pump-02-${station.id}`, stationId: station.id, label: 'Pump 02', status: 'IDLE' }
    ];
    setPumps(prev => [...prev, ...newPumps]);

    // Push entities to Supabase sequentially in background to conform with Foreign Key constraints
    return onboardStationWithAssets(station, stationTanks, newPumps)
      .then((res) => {
        if (res.success) {
          console.log(`[Supabase Onboarding Master Sync] Successfully provisioned Station "${station.name}", and synchronized its child Tanks and Pumps with the backend DB.`);
          addCustomAuditLog(
            'STATION_CREATE',
            `Registered new SaaS enterprise tenant station "${station.name}" with ${stationTanks.length} storage tanks and ${newPumps.length} dispenser pumps.`,
            station.id
          );
        } else {
          console.error('[Supabase Onboarding Master Sync] Failed to sync child assets:', res.error);
        }
        return res;
      })
      .catch((err) => {
        console.error('[Supabase Onboarding Master Sync] Fatal exception writing to DB:', err);
        return { success: false, error: err };
      });
  };

  const deleteStation = async (stationId: string): Promise<{ success: boolean; error?: any }> => {
    const station = stations.find(s => s.id === stationId);
    const stationName = station ? station.name : 'Unknown Station';

    // Update local state
    setStations(prev => prev.filter(s => s.id !== stationId));
    setTanks(prev => prev.filter(t => t.stationId !== stationId));
    setPumps(prev => prev.filter(p => p.stationId !== stationId));

    addCustomAuditLog(
      'STATION_DELETION',
      `Permanently deleted fuel station "${stationName}" and terminated all associated tanks, pumps, and supervisor accounts.`,
      undefined
    );

    try {
      await deleteStationFromSupabase(stationId);
      return { success: true };
    } catch (err: any) {
      console.error('[Supabase Onboarding Master Sync] Error deleting station from database:', err);
      return { success: false, error: err };
    }
  };

  const updateStationStatus = (stationId: string, status: 'ACTIVE' | 'MAINTENANCE' | 'INACTIVE') => {
    setStations(prev => prev.map(s => {
      if (s.id === stationId) {
        const updated = { ...s, status };
        upsertStationInSupabase(updated);
        return updated;
      }
      return s;
    }));
    addCustomAuditLog(
      'STATION_STATUS_CHANGE',
      `Station standard operational status changed to ${status}.`,
      stationId
    );
  };

  const updateLocalPricing = (stationId: string, grade: FuelGrade, price: number) => {
    setStations(prev => prev.map(s => {
      if (s.id === stationId) {
        const updated = {
          ...s,
          fuelPricing: {
            ...s.fuelPricing,
            [grade]: price
          }
        };
        upsertStationInSupabase(updated);
        return updated;
      }
      return s;
    }));
    addCustomAuditLog(
      'PRICE_ADJUSTMENT',
      `Updated local sales price index of ${grade} to ${price.toFixed(2)} L/SAR.`,
      stationId
    );
  };

  const resetTankWater = (tankId: string) => {
    const tank = tanks.find(t => t.id === tankId);
    if (!tank) return;

    setTanks(prev => prev.map(t => {
      if (t.id === tankId) {
        const updated = {
          ...t,
          waterLevel: 0.00,
          lastMeasurementTime: new Date().toLocaleDateString('en-US', { month: '2-digit', day: '2-digit' }) + ' ' + new Date().toLocaleTimeString('en-US', { hour12: false, hour: '2-digit', minute: '2-digit' })
        };
        upsertTankInSupabase(updated);
        return updated;
      }
      return t;
    }));

    addCustomAuditLog(
      'TANK_WATER_RESET',
      `Cleared accumulated moisture level (0.00m) in storage ${tank.label} via Admin override standard reset.`,
      tank.stationId
    );
  };

  const triggerFuelDelivery = (tankId: string, volume: number) => {
    const tankIndex = tanks.findIndex(t => t.id === tankId);
    if (tankIndex === -1) return { success: false, message: 'Tank not found' };
    
    const tank = tanks[tankIndex];
    const targetCapacity = tank.capacity;
    const currentLevel = tank.currentLevel;
    const roomAvailable = targetCapacity - currentLevel;

    if (volume <= 0) {
      return { success: false, message: 'Delivery volume must be greater than 0' };
    }

    if (volume > roomAvailable) {
      return { 
        success: false, 
        message: `Delivery volume exceeds remaining safety space in tank. Safe ullage limit is ${roomAvailable.toLocaleString()} Litres.` 
      };
    }

    const timestamp = new Date().toLocaleDateString('en-US', { month: '2-digit', day: '2-digit' }) + ' ' + new Date().toLocaleTimeString('en-US', { hour12: false, hour: '2-digit', minute: '2-digit' });

    // Update in-memory & Supabase
    setTanks(prev => prev.map(t => {
      if (t.id === tankId) {
        const updated = {
          ...t,
          currentLevel: t.currentLevel + volume,
          lastMeasurementTime: timestamp
        };
        upsertTankInSupabase(updated);
        return updated;
      }
      return t;
    }));

    // Register a specific replenishment transaction log
    const txStartId = `tx-delivery-start-${Date.now()}`;
    const txEndId = `tx-delivery-end-${Date.now()}`;
    const pricePerL = activeStation?.fuelPricing[tank.fuelType] || 2.18;

    const startTx: SalesTransaction = {
      id: txStartId,
      stationId: tank.stationId,
      timestamp: timestamp,
      pumpId: 'DELIVERY_BAY',
      fuelType: tank.fuelType,
      volume: 0,
      heightBefore: Math.round((currentLevel / targetCapacity) * 1000),
      heightAfter: Math.round((currentLevel / targetCapacity) * 1000),
      temperature: tank.temperature + (Math.random() * 0.4 - 0.2),
      waterLevel: tank.waterLevel,
      pricePerLitre: pricePerL,
      amount: 0,
      status: 'STARTED'
    };

    const endTx: SalesTransaction = {
      id: txEndId,
      stationId: tank.stationId,
      timestamp: timestamp,
      pumpId: 'DELIVERY_BAY',
      fuelType: tank.fuelType,
      volume: volume,
      heightBefore: Math.round((currentLevel / targetCapacity) * 1000),
      heightAfter: Math.round(((currentLevel + volume) / targetCapacity) * 1000),
      temperature: tank.temperature,
      waterLevel: tank.waterLevel,
      pricePerLitre: pricePerL,
      amount: volume * pricePerL,
      status: 'FINISHED'
    };

    setTransactions(prev => [startTx, endTx, ...prev]);

    // Save logs to database
    insertTransactionInSupabase(startTx);
    insertTransactionInSupabase(endTx);

    addCustomAuditLog(
      'FUEL_REPLENISHMENT',
      `Secured high-capacity logistics delivery of ${volume.toLocaleString()}L of ${tank.fuelType} into ${tank.label}.`,
      tank.stationId
    );

    return { success: true, message: `Successfully transferred ${volume.toLocaleString()} L of ${tank.fuelType} into ${tank.label}.` };
  };

  const dispenseFuel = (pumpId: string, grade: FuelGrade, volume: number) => {
    // Check if pump belongs to active station
    const pump = pumps.find(p => p.id === pumpId);
    if (!pump) return { success: false, message: 'Pump setup error' };

    // Find all tanks supplying this fuel grade at this station, sorted alphabetically
    const candidateTanks = tanks
      .filter(t => t.stationId === pump.stationId && t.fuelType === grade)
      .sort((a, b) => a.label.localeCompare(b.label, undefined, { numeric: true, sensitivity: 'base' }));

    if (candidateTanks.length === 0) {
      return { success: false, message: `No active storage tank configured for ${grade} at this station.` };
    }

    const totalAvailable = candidateTanks.reduce((sum, t) => sum + t.currentLevel, 0);
    if (totalAvailable < volume) {
      return { success: false, message: `Insufficient fuel stock available! Total stock across matched tanks is only ${totalAvailable.toLocaleString()} Litres.` };
    }

    // Set the first active tank with stock as the representative tank for starting metric reference
    const supplyTank = candidateTanks.find(t => t.currentLevel > 0) || candidateTanks[0];

    const actualStation = stations.find(s => s.id === pump.stationId);
    const unitPrice = actualStation?.fuelPricing[grade] || 2.18;
    
    const timestamp = new Date().toLocaleDateString('en-US', { month: '2-digit', day: '2-digit' }) + ' ' + new Date().toLocaleTimeString('en-US', { hour12: false, hour: '2-digit', minute: '2-digit' });

    // 1. Record start transaction
    const txStartId = `tx-sale-start-${Date.now()}`;
    const heightBefore = Math.round((supplyTank.currentLevel / supplyTank.capacity) * 1000);

    const startTx: SalesTransaction = {
      id: txStartId,
      stationId: pump.stationId,
      timestamp: timestamp,
      pumpId: pump.id,
      fuelType: grade,
      volume: 0,
      heightBefore: heightBefore,
      heightAfter: heightBefore,
      temperature: supplyTank.temperature,
      waterLevel: supplyTank.waterLevel,
      pricePerLitre: unitPrice,
      amount: 0,
      status: 'STARTED'
    };

    setTransactions(prev => [startTx, ...prev]);
    insertTransactionInSupabase(startTx);

    // 2. Transition pump status from IDLE to PUMPING
    const pumpingPumpState = {
      ...pump,
      status: 'PUMPING' as const,
      activeFuelGrade: grade,
      volumeThisSession: 0.00
    };
    setPumps(prev => prev.map(p => p.id === pumpId ? pumpingPumpState : p));
    upsertPumpInSupabase(pumpingPumpState);

    let currentVolume = 0;
    const duration = 2000; // 2 seconds to complete the simulation
    const intervalTime = 100; // 100ms interval
    const totalSteps = duration / intervalTime;
    const increment = volume / totalSteps;

    const intervalId = setInterval(() => {
      currentVolume += increment;
      if (currentVolume >= volume) {
        currentVolume = volume;
        clearInterval(intervalId);

        // Deduct remaining fuel volume from active storage tank(s) sequentially
        let rem = volume;
        const updatedTanks = [...tanks];
        const affectedTanksToSave: any[] = [];
        const deductionLogs: string[] = [];

        candidateTanks.forEach(candidate => {
          if (rem <= 0) return;

          const idxInFull = updatedTanks.findIndex(t => t.id === candidate.id);
          if (idxInFull === -1) return;

          const t = updatedTanks[idxInFull];
          const available = t.currentLevel;

          let deduct = 0;
          if (available >= rem) {
            deduct = rem;
            rem = 0;
          } else {
            deduct = available;
            rem -= available;
          }

          if (deduct > 0) {
            const nextLevel = Math.max(0, t.currentLevel - deduct);
            const updatedTank = {
              ...t,
              currentLevel: nextLevel,
              lastMeasurementTime: new Date().toLocaleDateString('en-US', { month: '2-digit', day: '2-digit' }) + ' ' + new Date().toLocaleTimeString('en-US', { hour12: false, hour: '2-digit', minute: '2-digit' })
            };
            updatedTanks[idxInFull] = updatedTank;
            affectedTanksToSave.push(updatedTank);
            deductionLogs.push(`${deduct.toFixed(2)}L from ${t.label}`);
          }
        });

        setTanks(updatedTanks);

        // Save each affected tank update to Supabase
        affectedTanksToSave.forEach(updatedTank => {
          upsertTankInSupabase(updatedTank);
        });

        // Transition pump status from PUMPING to COMPLETED
        const completedPumpState = {
          ...pump,
          status: 'COMPLETED' as const,
          activeFuelGrade: grade,
          volumeThisSession: volume
        };
        setPumps(prevPumps => prevPumps.map(p => p.id === pumpId ? completedPumpState : p));
        upsertPumpInSupabase(completedPumpState);

        addCustomAuditLog(
          'FUEL_DISPENSE_AUTO_DEDUCTED',
          `Dispensing completed for ${volume.toFixed(2)}L of ${grade} at ${pump.label}. Sequentially deducted: ${deductionLogs.join(' and ')}. Awaiting manual supervisor verification.`,
          pump.stationId
        );
      } else {
        // Continuous in-memory updates
        setPumps(prevPumps => prevPumps.map(p => p.id === pumpId ? {
          ...p,
          volumeThisSession: currentVolume
        } : p));
      }
    }, intervalTime);

    return { 
      success: true, 
      message: `Dispensing of ${volume.toFixed(2)}L (${grade}) initiated on ${pump.label}. Counting up live ...` 
    };
  };

  const confirmDispenseTransaction = (pumpId: string) => {
    const pump = pumps.find(p => p.id === pumpId);
    if (!pump) return { success: false, message: 'Pump setup error' };
    if (pump.status !== 'COMPLETED') {
      return { success: false, message: 'Pump is not in completed state' };
    }

    const grade = pump.activeFuelGrade || 'GAS91';
    const volume = pump.volumeThisSession || 0;
    const actualStation = stations.find(s => s.id === pump.stationId);
    const unitPrice = actualStation?.fuelPricing[grade] || 2.18;
    const finalBill = volume * unitPrice;
    
    const timestamp = new Date().toLocaleDateString('en-US', { month: '2-digit', day: '2-digit' }) + ' ' + new Date().toLocaleTimeString('en-US', { hour12: false, hour: '2-digit', minute: '2-digit' });

    // Use current active or representative tank index
    const candidateTanks = tanks
      .filter(t => t.stationId === pump.stationId && t.fuelType === grade)
      .sort((a, b) => a.label.localeCompare(b.label, undefined, { numeric: true, sensitivity: 'base' }));
    const supplyTank = candidateTanks.find(t => t.currentLevel > 0) || candidateTanks[0];

    const heightBefore = supplyTank ? Math.round(((supplyTank.currentLevel + volume) / supplyTank.capacity) * 1000) : 588;
    const heightAfter = supplyTank ? Math.round((supplyTank.currentLevel / supplyTank.capacity) * 1000) : 588;

    // 1. Records finish transaction log
    const txEndId = `tx-sale-end-${Date.now()}`;
    const endTx: SalesTransaction = {
      id: txEndId,
      stationId: pump.stationId,
      timestamp: timestamp,
      pumpId: pump.id,
      fuelType: grade,
      volume: volume,
      heightBefore: heightBefore,
      heightAfter: heightAfter,
      temperature: (supplyTank?.temperature || 33.8) + 0.1,
      waterLevel: supplyTank?.waterLevel || 0.00,
      pricePerLitre: unitPrice,
      amount: finalBill,
      status: 'FINISHED'
    };

    setTransactions(prev => [endTx, ...prev]);
    insertTransactionInSupabase(endTx);

    // 2. Save central AuditLog
    addCustomAuditLog(
      'FUEL_DISPENSE',
      `Dispensed and confirmed transaction for ${volume.toFixed(2)}L of ${grade} at ${pump.label}. Invoice value: SAR ${finalBill.toFixed(2)}.`,
      pump.stationId
    );

    // 3. Reset pump status to IDLE
    const idlePumpState = {
      ...pump,
      status: 'IDLE' as const,
      activeFuelGrade: undefined,
      volumeThisSession: undefined
    };
    setPumps(prev => prev.map(p => p.id === pumpId ? idlePumpState : p));
    upsertPumpInSupabase(idlePumpState);

    return { 
      success: true, 
      message: `Transaction verified for ${pump.label}! Total: SAR ${finalBill.toFixed(2)}.` 
    };
  };

  const updateTankLevel = async (tankId: string, level: number): Promise<{ success: boolean; message: string }> => {
    const config = getSupabaseConfig();
    let dbSuccess = false;
    let errorMessage = '';
    const timestamp = new Date().toLocaleDateString('en-US', { month: '2-digit', day: '2-digit' }) + ' ' + new Date().toLocaleTimeString('en-US', { hour12: false, hour: '2-digit', minute: '2-digit' });

    if (config.isConfigured) {
      try {
        const client = getSupabaseClient();
        const { error } = await client
          .from('fuel_tanks')
          .update({
            currentLevel: level,
            lastMeasurementTime: timestamp
          })
          .eq('id', tankId);
        if (error) {
          console.error('Supabase write error (tank level):', error);
          errorMessage = error.message;
        } else {
          dbSuccess = true;
        }
      } catch (err: any) {
        console.error('Exception writing tank level to Supabase:', err);
        errorMessage = err.message || 'Network exception';
      }
    }

    const tank = tanks.find(t => t.id === tankId);
    if (!tank) return { success: false, message: 'Tank not found' };

    const updated = {
      ...tank,
      currentLevel: level,
      lastMeasurementTime: timestamp
    };

    setTanks(prev => prev.map(t => t.id === tankId ? updated : t));

    addCustomAuditLog(
      'TANK_LEVEL_UPDATE',
      `Manual telemetry alignment: updated ${tank.label} level to ${level.toLocaleString()} Liters.`,
      tank.stationId
    );

    return { 
      success: true, 
      message: dbSuccess ? 'Tank level configuration synchronized successfully with Supabase.' : `Local update applied. Supabase sync offline: ${errorMessage}` 
    };
  };

  const clearAllData = () => {
    clearAllDataFromSupabase();

    setStations(INITIAL_STATIONS);
    setTanks(INITIAL_TANKS);
    setPumps(INITIAL_PUMPS);
    setTransactions(INITIAL_TRANSACTIONS);
    setAuditLogs(INITIAL_AUDIT_LOGS);
    setSessionState({
      role: 'SUPER_ADMIN',
      name: 'HQ Super Admin',
      activeStationId: ''
    });
    try {
      sessionStorage.removeItem('fuel_user_session');
    } catch {}
  };

  return (
    <FuelSystemContext.Provider value={{
      stations,
      tanks,
      pumps,
      transactions,
      auditLogs,
      session,
      activeStation,
      isLoading,
      setSession,
      addStation,
      deleteStation,
      updateStationStatus,
      updateLocalPricing,
      resetTankWater,
      triggerFuelDelivery,
      dispenseFuel,
      confirmDispenseTransaction,
      addCustomAuditLog,
      clearAllData,
      refreshAllFromSupabase,
      updateTankLevel
    }}>
      {children}
    </FuelSystemContext.Provider>
  );
};

export const useFuelSystem = () => {
  const context = useContext(FuelSystemContext);
  if (!context) {
    throw new Error('useFuelSystem must be used inside high fidelity FuelSystemProvider');
  }
  return context;
};
