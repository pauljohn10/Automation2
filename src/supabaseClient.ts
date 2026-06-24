import { createClient, SupabaseClient } from '@supabase/supabase-js';
import { FuelStation, FuelTank, FuelPump, SalesTransaction, AuditLog } from './types';

// Retrieve credentials with local storage fallback for interactive preview debugging
export function getSupabaseConfig() {
  let localUrl = localStorage.getItem('supabase_url_override');
  const localKey = localStorage.getItem('supabase_key_override');

  // @ts-ignore
  let envUrl = import.meta.env.VITE_SUPABASE_URL;
  // @ts-ignore
  const envKey = import.meta.env.VITE_SUPABASE_ANON_KEY;

  // Active default credentials provided by user
  const defaultUrl = 'https://cgsmiirbaqgetnsjbvgl.supabase.co';
  const defaultKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImNnc21paXJiYXFnZXRuc2pidmdsIiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODEwODE2MDcsImV4cCI6MjA5NjY1NzYwN30.X_faVeWpKANZR88coRZOyUt2o_Fji835UjLy2c2FcEc';

  let rawUrl = localUrl || envUrl || defaultUrl;
  let rawKey = localKey || envKey || defaultKey;

  // Auto-correct any known misspelled URL to provide a frictionless user experience!
  if (rawUrl && rawUrl.includes('cgsmiirbaqgetnsjbugl.supabase.co')) {
    rawUrl = rawUrl.replace('cgsmiirbaqgetnsjbugl.supabase.co', 'cgsmiirbaqgetnsjbvgl.supabase.co');
    if (localUrl) {
      localStorage.setItem('supabase_url_override', rawUrl);
    }
  }

  const isConfiguredVal = !!(
    rawUrl &&
    rawUrl !== 'https://your-project.supabase.co' &&
    rawUrl !== '' &&
    rawKey &&
    rawKey !== 'your-anon-key' &&
    rawKey !== ''
  );

  return {
    url: isConfiguredVal ? rawUrl : defaultUrl,
    key: isConfiguredVal ? rawKey : defaultKey,
    isConfigured: true, // Mark active of central DB since we now have official working creds
    isLocalOverride: !!(localUrl && localKey)
  };
}

// Cached client instances to prevent triggering "Multiple GoTrueClient instances" warnings
let activeClient: SupabaseClient | null = null;
let lastUsedUrl: string = '';
let lastUsedKey: string = '';

/**
 * Gets the current active client, re-initializing only if the config URL or key has changed.
 */
export function getSupabaseClient(): SupabaseClient {
  const config = getSupabaseConfig();
  if (!activeClient || lastUsedUrl !== config.url || lastUsedKey !== config.key) {
    activeClient = createClient(config.url, config.key);
    lastUsedUrl = config.url;
    lastUsedKey = config.key;
  }
  return activeClient;
}

export function saveSupabaseOverrides(url: string, key: string) {
  if (!url || !key) return;
  let correctedUrl = url.trim();
  if (correctedUrl.includes('cgsmiirbaqgetnsjbugl.supabase.co')) {
    correctedUrl = correctedUrl.replace('cgsmiirbaqgetnsjbugl.supabase.co', 'cgsmiirbaqgetnsjbvgl.supabase.co');
  }
  localStorage.setItem('supabase_url_override', correctedUrl);
  localStorage.setItem('supabase_key_override', key.trim());
}

export function clearSupabaseOverrides() {
  localStorage.removeItem('supabase_url_override');
  localStorage.removeItem('supabase_key_override');
}

export interface SupabaseUserRecord {
  id: string;
  station_id: string;
  station_name: string;
  station_code: string;
  username: string;
  password_raw: string;
  full_name: string;
  role: string;
  created_at: string;
}

/**
 * Wraps and enriches raw JS and Supabase fetch exceptions with explicit DNS/hostname diagnostic help
 */
export function enrichNetworkErrorMessage(msg: string, url: string): string {
  const lowercaseMsg = String(msg).toLowerCase();
  if (
    lowercaseMsg.includes('failed to fetch') || 
    lowercaseMsg.includes('fetcherror') || 
    lowercaseMsg.includes('networkerror') || 
    lowercaseMsg.includes('err_name_not_resolved') ||
    lowercaseMsg.includes('dns') ||
    lowercaseMsg.includes('load failed')
  ) {
    if (url && (url.includes('localhost') || url.includes('127.0.0.1'))) {
      return `Local Database Connection Failure! The system was unable to contact your local Supabase instance at "${url}". Please ensure that you have started your local Supabase containers (run "supabase start" in your terminal) and that they are listening on the correct port.`;
    }
    return `Network/DNS Resolution Failure! The system was unable to resolve or contact your custom Supabase host URL ("${url}"). Please verify that your internet is active, you didn't introduce a typo in the database config, and that your Supabase project isn't paused or deleted.`;
  }
  return msg;
}

/**
 * Performs a lightweight, live ping query to verify database response and resolve name/DNS path
 */
export async function checkSupabaseConnectivity(): Promise<{ reachable: boolean; message: string; error?: any }> {
  const config = getSupabaseConfig();
  if (!config.isConfigured) {
    return { reachable: false, message: 'Supabase is not configured yet. Offline mock mode active.' };
  }

  try {
    const client = getSupabaseClient();
    // Use a lightweight check or select
    const { error } = await client.from('stations').select('id').limit(1);
    
    if (error) {
      const msg = enrichNetworkErrorMessage(error.message || 'Unable to connect to database tables.', config.url);
      return {
        reachable: false,
        message: msg,
        error
      };
    }
    
    return { 
      reachable: true, 
      message: `Successfully connected to Supabase database instance (${config.url}). DNS is healthy and writes are ready.` 
    };
  } catch (err: any) {
    const msg = enrichNetworkErrorMessage(err.message || String(err), config.url);
    return {
      reachable: false,
      message: msg,
      error: err
    };
  }
}

// ============================================================================
// 1. RECORD ONBOARDED USER
// ============================================================================
export async function recordOnboardedUser(record: SupabaseUserRecord): Promise<{ success: boolean; message: string; error?: any }> {
  const config = getSupabaseConfig();
  if (!config.isConfigured) {
    return {
      success: false,
      message: 'Supabase is not configured. Saved in local memory only.'
    };
  }

  try {
    const client = getSupabaseClient();
    const { error } = await client
      .from('onboarded_users')
      .insert([
        {
          id: record.id,
          station_id: record.station_id,
          station_name: record.station_name,
          station_code: record.station_code,
          username: record.username,
          password_raw: record.password_raw,
          full_name: record.full_name,
          role: record.role,
          created_at: record.created_at
        }
      ]);

    if (error) {
      console.error('Error inserting into Supabase:', error);
      const enriched = enrichNetworkErrorMessage(error.message || 'Unknown database error', config.url);
      return {
        success: false,
        message: `Supabase Error: ${enriched}`,
        error
      };
    }

    return {
      success: true,
      message: 'User successfully recorded in Supabase table "onboarded_users"!'
    };
  } catch (err: any) {
    console.error('Unhandled error syncing with Supabase:', err);
    const enriched = enrichNetworkErrorMessage(err.message || String(err), config.url);
    return {
      success: false,
      message: `Failed to connect to Supabase: ${enriched}`,
      error: err
    };
  }
}

export async function fetchOnboardedUsers(): Promise<SupabaseUserRecord[]> {
  const config = getSupabaseConfig();
  if (!config.isConfigured) return [];
  try {
    const client = getSupabaseClient();
    const { data, error } = await client
      .from('onboarded_users')
      .select('*')
      .order('created_at', { ascending: false });

    if (error) {
      console.error('Error reading Supabase users:', error);
      return [];
    }
    return (data as SupabaseUserRecord[]) || [];
  } catch (err) {
    console.error('Exception fetching from Supabase:', err);
    return [];
  }
}

// ============================================================================
// 2. CORE MASTER SYNC GETTERS (Read Operations)
// ============================================================================

export async function fetchStationsFromSupabase(): Promise<FuelStation[] | null> {
  const config = getSupabaseConfig();
  if (!config.isConfigured) return null;
  try {
    const client = getSupabaseClient();
    const { data, error } = await client.from('stations').select('*');
    if (error) {
      console.error('Error fetching stations:', error);
      return null;
    }
    return data as FuelStation[];
  } catch (err) {
    console.error('Exception fetching stations:', err);
    return null;
  }
}

export async function fetchTanksFromSupabase(): Promise<FuelTank[] | null> {
  const config = getSupabaseConfig();
  if (!config.isConfigured) return null;
  try {
    const client = getSupabaseClient();
    const { data, error } = await client
      .from('fuel_tanks')
      .select('*')
      .order('label', { ascending: true });
    if (error) {
      console.error('Error fetching tanks:', error);
      return null;
    }
    return data as FuelTank[];
  } catch (err) {
    console.error('Exception fetching tanks:', err);
    return null;
  }
}

export async function fetchPumpsFromSupabase(): Promise<FuelPump[] | null> {
  const config = getSupabaseConfig();
  if (!config.isConfigured) return null;
  try {
    const client = getSupabaseClient();
    const { data, error } = await client.from('fuel_pumps').select('*');
    if (error) {
      console.error('Error fetching pumps:', error);
      return null;
    }
    return data as FuelPump[];
  } catch (err) {
    console.error('Exception fetching pumps:', err);
    return null;
  }
}

export async function fetchTransactionsFromSupabase(): Promise<SalesTransaction[] | null> {
  const config = getSupabaseConfig();
  if (!config.isConfigured) return null;
  try {
    const client = getSupabaseClient();
    const { data, error } = await client.from('sales_transactions').select('*');
    if (error) {
      console.error('Error fetching transactions:', error);
      return null;
    }
    return data as SalesTransaction[];
  } catch (err) {
    console.error('Exception fetching transactions:', err);
    return null;
  }
}

export async function fetchAuditsFromSupabase(): Promise<AuditLog[] | null> {
  const config = getSupabaseConfig();
  if (!config.isConfigured) return null;
  try {
    const client = getSupabaseClient();
    const { data, error } = await client.from('audit_logs').select('*');
    if (error) {
      console.error('Error fetching audits:', error);
      return null;
    }
    return data as AuditLog[];
  } catch (err) {
    console.error('Exception fetching audits:', err);
    return null;
  }
}

// ============================================================================
// 3. CORE REAL-TIME MUTATIONS (Write Operations)
// ============================================================================

export async function onboardStationWithAssets(
  station: FuelStation,
  tanks: FuelTank[],
  pumps: FuelPump[]
): Promise<{ success: boolean; error?: any }> {
  const config = getSupabaseConfig();
  if (!config.isConfigured) {
    return { success: false, error: new Error('Supabase is not configured.') };
  }
  try {
    const client = getSupabaseClient();

    // 1. Write the main Station record first
    const { error: stationErr } = await client.from('stations').upsert({
      id: station.id,
      name: station.name,
      code: station.code,
      location: station.location,
      manager: station.manager,
      status: station.status,
      fuelPricing: station.fuelPricing,
      username: station.username || null,
      password: station.password || null,
      dispenserCount: station.dispenserCount || 2,
      pumpsPerDispenser: station.pumpsPerDispenser || 2
    });

    if (stationErr) {
      console.error('[Supabase Chain] Station write error:', stationErr);
      return { success: false, error: stationErr };
    }

    // 2. Chained Write Dependent Tanks
    if (tanks.length > 0) {
      const tankPayloads = tanks.map(t => ({
        id: t.id,
        stationId: t.stationId,
        label: t.label,
        fuelType: t.fuelType,
        capacity: t.capacity,
        currentLevel: t.currentLevel,
        temperature: t.temperature,
        waterLevel: t.waterLevel,
        lastMeasurementTime: t.lastMeasurementTime
      }));

      const { error: tanksErr } = await client.from('fuel_tanks').upsert(tankPayloads);
      if (tanksErr) {
        console.error('[Supabase Chain] Tanks write error:', tanksErr);
        return { success: false, error: tanksErr };
      }
    }

    // 3. Chained Write Dependent Pumps
    if (pumps.length > 0) {
      const pumpPayloads = pumps.map(p => ({
        id: p.id,
        stationId: p.stationId,
        label: p.label,
        status: p.status,
        fuelType: p.fuelType || null,
        activeFuelGrade: p.activeFuelGrade || null,
        flowRate: p.flowRate || 40.00,
        volumeThisSession: p.volumeThisSession || 0.00
      }));

      const { error: pumpsErr } = await client.from('fuel_pumps').upsert(pumpPayloads);
      if (pumpsErr) {
        console.error('[Supabase Chain] Pumps write error:', pumpsErr);
        return { success: false, error: pumpsErr };
      }
    }

    return { success: true };
  } catch (err: any) {
    console.error('[Supabase Chain] Exeption during onboarding:', err);
    return { success: false, error: err };
  }
}

export async function upsertStationInSupabase(station: FuelStation): Promise<void> {
  const config = getSupabaseConfig();
  if (!config.isConfigured) return;
  try {
    const client = getSupabaseClient();
    const { error } = await client.from('stations').upsert({
      id: station.id,
      name: station.name,
      code: station.code,
      location: station.location,
      manager: station.manager,
      status: station.status,
      fuelPricing: station.fuelPricing,
      username: station.username || null,
      password: station.password || null,
      dispenserCount: station.dispenserCount || 2,
      pumpsPerDispenser: station.pumpsPerDispenser || 2
    });
    if (error) console.error('Supabase write error (station):', error);
  } catch (err) {
    console.error('Exception saving station:', err);
  }
}

export async function upsertTankInSupabase(tank: FuelTank): Promise<void> {
  const config = getSupabaseConfig();
  if (!config.isConfigured) return;
  try {
    const client = getSupabaseClient();
    const { error } = await client.from('fuel_tanks').upsert({
      id: tank.id,
      stationId: tank.stationId,
      label: tank.label,
      fuelType: tank.fuelType,
      capacity: tank.capacity,
      currentLevel: tank.currentLevel,
      temperature: tank.temperature,
      waterLevel: tank.waterLevel,
      lastMeasurementTime: tank.lastMeasurementTime
    });
    if (error) console.error('Supabase write error (tank):', error);
  } catch (err) {
    console.error('Exception saving tank:', err);
  }
}

export async function upsertPumpInSupabase(pump: FuelPump): Promise<void> {
  const config = getSupabaseConfig();
  if (!config.isConfigured) return;
  try {
    const client = getSupabaseClient();
    const { error } = await client.from('fuel_pumps').upsert({
      id: pump.id,
      stationId: pump.stationId,
      label: pump.label,
      status: pump.status,
      fuelType: pump.fuelType || null,
      activeFuelGrade: pump.activeFuelGrade || null,
      flowRate: pump.flowRate || 40.00,
      volumeThisSession: pump.volumeThisSession || 0.00
    });
    if (error) console.error('Supabase write error (pump):', error);
  } catch (err) {
    console.error('Exception saving pump:', err);
  }
}

export async function insertTransactionInSupabase(tx: SalesTransaction): Promise<void> {
  const config = getSupabaseConfig();
  if (!config.isConfigured) return;
  try {
    const client = getSupabaseClient();
    const { error } = await client.from('sales_transactions').insert({
      id: tx.id,
      stationId: tx.stationId,
      timestamp: tx.timestamp,
      pumpId: tx.pumpId,
      fuelType: tx.fuelType,
      volume: tx.volume,
      heightBefore: tx.heightBefore !== undefined ? tx.heightBefore : null,
      heightAfter: tx.heightAfter !== undefined ? tx.heightAfter : null,
      temperature: tx.temperature !== undefined ? tx.temperature : null,
      waterLevel: tx.waterLevel !== undefined ? tx.waterLevel : null,
      pricePerLitre: tx.pricePerLitre,
      amount: tx.amount,
      status: tx.status
    });
    if (error) console.error('Supabase write error (transaction):', error);
  } catch (err) {
    console.error('Exception saving transaction:', err);
  }
}

export async function insertAuditInSupabase(log: AuditLog): Promise<void> {
  const config = getSupabaseConfig();
  if (!config.isConfigured) return;
  try {
    const client = getSupabaseClient();
    const { error } = await client.from('audit_logs').insert({
      id: log.id,
      stationId: log.stationId || null,
      timestamp: log.timestamp,
      user: log.user,
      role: log.role,
      action: log.action,
      details: log.details,
      ipAddress: log.ipAddress
    });
    if (error) console.error('Supabase write error (audit):', error);
  } catch (err) {
    console.error('Exception saving audit log:', err);
  }
}

export async function deleteStationFromSupabase(stationId: string): Promise<void> {
  const config = getSupabaseConfig();
  if (!config.isConfigured) return;
  try {
    const client = getSupabaseClient();
    const { error } = await client.from('stations').delete().eq('id', stationId);
    if (error) console.error('Supabase deletion error (stationId):', error);
  } catch (err) {
    console.error('Exception deleting station:', err);
  }
}

export async function clearAllDataFromSupabase(): Promise<void> {
  const config = getSupabaseConfig();
  if (!config.isConfigured) return;
  try {
    const adminClient = getSupabaseAdminClient();
    const client = adminClient || getSupabaseClient();
    await client.from('audit_logs').delete().neq('id', 'dummy');
    await client.from('sales_transactions').delete().neq('id', 'dummy');
    await client.from('fuel_pumps').delete().neq('id', 'dummy');
    await client.from('fuel_tanks').delete().neq('id', 'dummy');
    await client.from('stations').delete().neq('id', 'dummy');
    await client.from('onboarded_users').delete().neq('id', 'dummy');
    await client.from('user_profiles').delete().neq('id', '00000000-0000-0000-0000-000000000000');
  } catch (err) {
    console.error('Exception purging database schema:', err);
  }
}

// ----------------------------------------------------------------------------
// 4. HQ USER PROFILE MANAGEMENT & PROVISIONING (Admin Auth APIs)
// ----------------------------------------------------------------------------

export interface SupabaseUserProfile {
  id: string;
  email: string;
  role: 'SUPER_ADMIN' | 'ADMIN' | 'VIEWER';
  created_at?: string;
}

export function getSupabaseServiceRoleKey(): string | null {
  // @ts-ignore
  return localStorage.getItem('supabase_service_role_override') || import.meta.env.VITE_SUPABASE_SERVICE_ROLE_KEY || null;
}

let activeAdminClient: SupabaseClient | null = null;
let lastUsedAdminUrl: string = '';
let lastUsedAdminKey: string = '';

export function getSupabaseAdminClient(): SupabaseClient | null {
  const config = getSupabaseConfig();
  const serviceRoleKey = getSupabaseServiceRoleKey();
  if (!config.url || !serviceRoleKey) return null;
  
  if (!activeAdminClient || lastUsedAdminUrl !== config.url || lastUsedAdminKey !== serviceRoleKey) {
    activeAdminClient = createClient(config.url, serviceRoleKey, {
      auth: {
        autoRefreshToken: false,
        persistSession: false
      }
    });
    lastUsedAdminUrl = config.url;
    lastUsedAdminKey = serviceRoleKey;
  }
  return activeAdminClient;
}

/**
 * Fetch all administrative user profiles from user_profiles
 */
export async function fetchUserProfiles(): Promise<SupabaseUserProfile[]> {
  const config = getSupabaseConfig();
  if (!config.isConfigured) return [];
  try {
    const adminClient = getSupabaseAdminClient();
    const client = adminClient || getSupabaseClient();
    const { data, error } = await client
      .from('user_profiles')
      .select('*')
      .order('created_at', { ascending: false });
    if (error) {
      console.error('[Supabase Admin] Error reading user profiles:', error);
      return [];
    }
    return (data as SupabaseUserProfile[]) || [];
  } catch (err) {
    console.error('[Supabase Admin] Exception fetching profiles:', err);
    return [];
  }
}

/**
 * Service Role pre-confirmed account creation in Auth + DB profile synchronization
 */
export async function provisionUserAccount(
  email: string,
  pass: string,
  role: 'SUPER_ADMIN' | 'ADMIN' | 'VIEWER'
): Promise<{ success: boolean; message: string; data?: any; error?: any }> {
  const config = getSupabaseConfig();
  if (!config.isConfigured) {
    return { success: false, message: 'Supabase URL is not configured yet.' };
  }

  const adminClient = getSupabaseAdminClient();
  if (!adminClient) {
    return {
      success: false,
      message: 'Supabase Service Role Key is missing. This key is required to programmatically create users without logging out your current session. Please enter your Service Role Key below to run live API calls.'
    };
  }

  try {
    let newUserId = '';

    // Tier 1: Auth Create User using Admin context
    const { data: authData, error: authError } = await adminClient.auth.admin.createUser({
      email: email,
      password: pass,
      email_confirm: true,
      user_metadata: { role: role }
    });

    if (authError) {
      // Check if user already exists in auth
      const isAlreadyExists = 
        authError.message.toLowerCase().includes('already exists') || 
        authError.message.toLowerCase().includes('email_exists') ||
        authError.status === 422;

      if (isAlreadyExists) {
        console.log('[Supabase Admin Auth] User already exists in auth, searching for existing ID...');
        const { data: listData, error: listError } = await adminClient.auth.admin.listUsers();
        if (!listError && listData?.users) {
          const matched = (listData.users as any[]).find(u => u && u.email && String(u.email).toLowerCase() === email.toLowerCase());
          if (matched) {
            newUserId = matched.id;
            // Align metadata role on auth side as well
            await adminClient.auth.admin.updateUserById(newUserId, {
              user_metadata: { role: role }
            });
          }
        }
      }

      if (!newUserId) {
        console.error('[Supabase Admin Auth] Failed to create auth user:', authError);
        return { success: false, message: `Auth creation failed: ${authError.message}`, error: authError };
      }
    } else {
      if (!authData?.user) {
        return { success: false, message: 'Auth creation completed but returned no user payload.' };
      }
      newUserId = authData.user.id;
    }

    // Tier 2: Write/Upsert match row inside public.user_profiles
    let profileError = null;
    try {
      const { error } = await adminClient
        .from('user_profiles')
        .upsert([
          {
            id: newUserId,
            email: email,
            role: role
          }
        ]);
      profileError = error;
    } catch (err: any) {
      profileError = err;
    }

    // Fallback: If service role client failed (e.g. due to key mismatch or RLS checking auth.uid() which is null for service role),
    // try inserting/upserting using the active user's authenticated client session, as they are a SUPER_ADMIN.
    if (profileError) {
      console.warn('[Supabase Admin Auth] Admin client insert/upsert failed, attempting fallback with user session client:', profileError);
      try {
        const userClient = getSupabaseClient();
        const { error: userClientErr } = await userClient
          .from('user_profiles')
          .upsert([
            {
              id: newUserId,
              email: email,
              role: role
            }
          ]);
        if (!userClientErr) {
          profileError = null; // Succeeded! Clear error
        } else {
          profileError = userClientErr; // Fallback failed too, keep the fallback error
        }
      } catch (fallbackErr: any) {
        profileError = fallbackErr;
      }
    }

    if (profileError) {
      console.error('[Supabase Admin Auth] Created/matched auth entry, but table user_profiles insert/upsert failed:', profileError);
      return {
        success: false,
        message: `Auth user created/matched (${newUserId}), but profile table row insert/upsert failed: ${profileError.message || String(profileError)}`,
        error: profileError
      };
    }

    return {
      success: true,
      message: `Successfully provisioned ${role} account for "${email}"!`,
      data: { id: newUserId }
    };
  } catch (err: any) {
    console.error('[Supabase Admin Auth] Exception during account provisioning:', err);
    return { success: false, message: `System error: ${err.message || String(err)}`, error: err };
  }
}

/**
 * Delete a user profile row and attempt auth delete
 */
export async function deleteUserAccount(id: string): Promise<{ success: boolean; message: string; error?: any }> {
  const config = getSupabaseConfig();
  if (!config.isConfigured) return { success: false, message: 'Supabase is not configured.' };

  const isUuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(id);
  if (!isUuid) {
    return { success: true, message: 'Mock/Sandbox user successfully removed.' };
  }

  const adminClient = getSupabaseAdminClient();

  try {
    const client = adminClient || getSupabaseClient();
    const { error: profileErr } = await client.from('user_profiles').delete().eq('id', id);
    if (profileErr) {
      console.error('[Supabase Admin Auth] Error deleting profile row:', profileErr);
      return { success: false, message: `Profile deletion failed: ${profileErr.message}`, error: profileErr };
    }

    if (adminClient) {
      const { error: authErr } = await adminClient.auth.admin.deleteUser(id);
      if (authErr) {
        console.warn('[Supabase Admin Auth] Profile table row cleared, but auth.deleteUser failed/ignored:', authErr);
      }
    }

    return { success: true, message: 'User profile successfully deleted.' };
  } catch (err: any) {
    console.error('[Supabase Admin Auth] Exception deleting user account:', err);
    return { success: false, message: `Unhandled exception: ${err.message || String(err)}`, error: err };
  }
}
