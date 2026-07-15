-- ============================================================================
-- ANTIGRAVITY FUEL SYSTEM ERP - SUPABASE DATABASES MASTER SETUP
-- Comprehensive, Production-Ready PostgreSQL Schema for Supabase SQL Editor.
-- Fully synchronized with current system models and fuel tracking modules.
-- Supporting real-time multi-tenant data storage, audits, and sales operations.
-- ============================================================================

-- A. Disable & Cascade Drop Existing Tables to ensure a clean slate setup
DROP TABLE IF EXISTS "onboarded_users" CASCADE;
DROP TABLE IF EXISTS "audit_logs" CASCADE;
DROP TABLE IF EXISTS "sales_transactions" CASCADE;
DROP TABLE IF EXISTS "fuel_pumps" CASCADE;
DROP TABLE IF EXISTS "fuel_tanks" CASCADE;
DROP TABLE IF EXISTS "stations" CASCADE;

-- ----------------------------------------------------------------------------
-- 1. STATIONS TABLE
-- Stores full properties of all fuel stations / tenant profiles.
-- ----------------------------------------------------------------------------
CREATE TABLE stations (
    id TEXT PRIMARY KEY,
    name TEXT NOT NULL,
    code TEXT NOT NULL UNIQUE,
    location TEXT NOT NULL,
    manager TEXT NOT NULL,
    status TEXT NOT NULL DEFAULT 'ACTIVE' CHECK (status IN ('ACTIVE', 'MAINTENANCE', 'INACTIVE')),
    "fuelPricing" JSONB NOT NULL DEFAULT '{"GAS91": 2.18, "GAS95": 2.33, "GAS98": 2.60, "DIESEL": 1.15}'::jsonb,
    username TEXT,
    password TEXT,
    "dispenserCount" INT DEFAULT 2,
    "pumpsPerDispenser" INT DEFAULT 2,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- ----------------------------------------------------------------------------
-- 2. FUEL TANKS TABLE
-- Holds the underground active storage tank specifications.
-- ----------------------------------------------------------------------------
CREATE TABLE fuel_tanks (
    id TEXT PRIMARY KEY,
    "stationId" TEXT NOT NULL REFERENCES stations(id) ON DELETE CASCADE,
    label TEXT NOT NULL, -- e.g., 'Tank 01'
    "fuelType" TEXT NOT NULL, -- 'GAS91', 'GAS95', 'GAS98', 'DIESEL'
    capacity NUMERIC NOT NULL CHECK (capacity > 0),
    "currentLevel" NUMERIC NOT NULL CHECK ("currentLevel" >= 0),
    temperature NUMERIC NOT NULL DEFAULT 34.00,
    "waterLevel" NUMERIC NOT NULL DEFAULT 0.00,
    "lastMeasurementTime" TEXT NOT NULL,
    CONSTRAINT chk_tank_capacity CHECK ("currentLevel" <= capacity)
);

-- ----------------------------------------------------------------------------
-- 3. FUEL PUMPS / DISPENSER NOZZLES TABLE
-- Hardware configuration representing dispenser terminal points.
-- ----------------------------------------------------------------------------
CREATE TABLE fuel_pumps (
    id TEXT PRIMARY KEY,
    "stationId" TEXT NOT NULL REFERENCES stations(id) ON DELETE CASCADE,
    label TEXT NOT NULL, -- e.g., 'Pump 01'
    status TEXT NOT NULL DEFAULT 'IDLE' CHECK (status IN ('IDLE', 'PUMPING', 'COMPLETED', 'MAINTENANCE')),
    "fuelType" TEXT,
    "activeFuelGrade" TEXT,
    "flowRate" NUMERIC DEFAULT 40.00,
    "volumeThisSession" NUMERIC DEFAULT 0.00,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- ----------------------------------------------------------------------------
-- 4. SALES TRANSACTIONS TABLE
-- Complete billing details and dispensing logs.
-- ----------------------------------------------------------------------------
CREATE TABLE sales_transactions (
    id TEXT PRIMARY KEY,
    "stationId" TEXT NOT NULL REFERENCES stations(id) ON DELETE CASCADE,
    timestamp TEXT NOT NULL,
    "pumpId" TEXT NOT NULL,
    "fuelType" TEXT NOT NULL,
    volume NUMERIC NOT NULL CHECK (volume >= 0),
    "heightBefore" NUMERIC,
    "heightAfter" NUMERIC,
    temperature NUMERIC,
    "waterLevel" NUMERIC,
    "pricePerLitre" NUMERIC NOT NULL CHECK ("pricePerLitre" >= 0),
    amount NUMERIC NOT NULL CHECK (amount >= 0),
    status TEXT NOT NULL CHECK (status IN ('STARTED', 'FINISHED')),
    operator TEXT,
    customer TEXT,
    "paymentMethod" TEXT DEFAULT NULL,
    "nozzleId" TEXT DEFAULT NULL,
    "shift" TEXT DEFAULT NULL,
    "discount" NUMERIC DEFAULT 0.00,
    "vat" NUMERIC DEFAULT 0.00,
    "netAmount" NUMERIC DEFAULT NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- ----------------------------------------------------------------------------
-- 5. AUDIT LOGS TABLE
-- Tracks standard supervisor logins, alterations, price adjustments, etc.
-- ----------------------------------------------------------------------------
CREATE TABLE audit_logs (
    id TEXT PRIMARY KEY,
    "stationId" TEXT REFERENCES stations(id) ON DELETE CASCADE, -- Nullable for HQ global admins
    timestamp TEXT NOT NULL,
    "user" TEXT NOT NULL,
    role TEXT NOT NULL,
    action TEXT NOT NULL,
    details TEXT NOT NULL,
    "ipAddress" TEXT NOT NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- ----------------------------------------------------------------------------
-- 6. ONBOARDED USERS TABLE
-- Tracks physical tenant/supervisor allocations.
-- ----------------------------------------------------------------------------
CREATE TABLE onboarded_users (
    id TEXT PRIMARY KEY,
    station_id TEXT NOT NULL REFERENCES stations(id) ON DELETE CASCADE,
    station_name TEXT NOT NULL,
    station_code TEXT NOT NULL,
    username TEXT NOT NULL UNIQUE,
    password_raw TEXT NOT NULL,
    full_name TEXT NOT NULL,
    role TEXT NOT NULL DEFAULT 'supervisor',
    created_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP
);


-- ============================================================================
-- INDEXES FOR INSTANT QUERY SPEEDS & ISOLATION
-- ============================================================================
CREATE INDEX IF NOT EXISTS idx_stations_code ON stations(code);
CREATE INDEX IF NOT EXISTS idx_tanks_station ON fuel_tanks("stationId");
CREATE INDEX IF NOT EXISTS idx_pumps_station ON fuel_pumps("stationId");
CREATE INDEX IF NOT EXISTS idx_transactions_station ON sales_transactions("stationId");
CREATE INDEX IF NOT EXISTS idx_audits_station ON audit_logs("stationId");
CREATE INDEX IF NOT EXISTS idx_onboard_username ON onboarded_users(username);


-- ============================================================================
-- SUPABASE ROW LEVEL SECURITY (RLS) POLICIES
-- Enables open reading/writing for the responsive client application.
-- ============================================================================
ALTER TABLE stations ENABLE ROW LEVEL SECURITY;
ALTER TABLE fuel_tanks ENABLE ROW LEVEL SECURITY;
ALTER TABLE fuel_pumps ENABLE ROW LEVEL SECURITY;
ALTER TABLE sales_transactions ENABLE ROW LEVEL SECURITY;
ALTER TABLE audit_logs ENABLE ROW LEVEL SECURITY;
ALTER TABLE onboarded_users ENABLE ROW LEVEL SECURITY;

-- 1. Stations Access
CREATE POLICY "Allow public select of stations" ON stations FOR SELECT USING (true);
CREATE POLICY "Allow public insert of stations" ON stations FOR INSERT WITH CHECK (true);
CREATE POLICY "Allow public update of stations" ON stations FOR UPDATE USING (true);
CREATE POLICY "Allow public delete of stations" ON stations FOR DELETE USING (true);

-- 2. Fuel Tanks Access
CREATE POLICY "Allow public select of fuel_tanks" ON fuel_tanks FOR SELECT USING (true);
CREATE POLICY "Allow public insert of fuel_tanks" ON fuel_tanks FOR INSERT WITH CHECK (true);
CREATE POLICY "Allow public update of fuel_tanks" ON fuel_tanks FOR UPDATE USING (true);
CREATE POLICY "Allow public delete of fuel_tanks" ON fuel_tanks FOR DELETE USING (true);

-- 3. Fuel Pumps Access
CREATE POLICY "Allow public select of fuel_pumps" ON fuel_pumps FOR SELECT USING (true);
CREATE POLICY "Allow public insert of fuel_pumps" ON fuel_pumps FOR INSERT WITH CHECK (true);
CREATE POLICY "Allow public update of fuel_pumps" ON fuel_pumps FOR UPDATE USING (true);
CREATE POLICY "Allow public delete of fuel_pumps" ON fuel_pumps FOR DELETE USING (true);

-- 4. Sales Transactions Access
CREATE POLICY "Allow public select of sales_transactions" ON sales_transactions FOR SELECT USING (true);
CREATE POLICY "Allow public insert of sales_transactions" ON sales_transactions FOR INSERT WITH CHECK (true);
CREATE POLICY "Allow public update of sales_transactions" ON sales_transactions FOR UPDATE USING (true);
CREATE POLICY "Allow public delete of sales_transactions" ON sales_transactions FOR DELETE USING (true);

-- 5. Audit Logs Access
CREATE POLICY "Allow public select of audit_logs" ON audit_logs FOR SELECT USING (true);
CREATE POLICY "Allow public insert of audit_logs" ON audit_logs FOR INSERT WITH CHECK (true);
CREATE POLICY "Allow public update of audit_logs" ON audit_logs FOR UPDATE USING (true);
CREATE POLICY "Allow public delete of audit_logs" ON audit_logs FOR DELETE USING (true);

-- 6. Onboarded Users Access
CREATE POLICY "Allow public select of onboarded_users" ON onboarded_users FOR SELECT USING (true);
CREATE POLICY "Allow public insert of onboarded_users" ON onboarded_users FOR INSERT WITH CHECK (true);
CREATE POLICY "Allow public update of onboarded_users" ON onboarded_users FOR UPDATE USING (true);
CREATE POLICY "Allow public delete of onboarded_users" ON onboarded_users FOR DELETE USING (true);


-- ============================================================================
--
