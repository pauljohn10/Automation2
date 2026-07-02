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
-- HIGH-FIDELITY INITIAL PRODUCTION DATA SEEDING
-- Boots pre-configured stations, matching tanks, pumps, pricing policy, and users.
-- ============================================================================

-- Station 1: Abha
INSERT INTO stations (id, name, code, location, manager, status, "fuelPricing", username, password, "dispenserCount", "pumpsPerDispenser")
VALUES (
    'st-01', 
    'Al Noor - Noor Abha', 
    'AN-ABHA-01', 
    'King Abdulaziz Rd, Abha, KSA', 
    'Saeed Alqahtani', 
    'ACTIVE', 
    '{"GAS91": 2.18, "GAS95": 2.33, "GAS98": 2.60, "DIESEL": 1.15}'::jsonb, 
    'abha.supervisor', 
    'password123', 
    2, 
    2
) ON CONFLICT (code) DO NOTHING;

-- Station 2: Riyadh
INSERT INTO stations (id, name, code, location, manager, status, "fuelPricing", username, password, "dispenserCount", "pumpsPerDispenser")
VALUES (
    'st-02', 
    'Desert Oasis - Riyadh North', 
    'DO-RIYD-02', 
    'An Anas Ibn Malik Rd, Riyadh, KSA', 
    'Yousef Al-Harbi', 
    'ACTIVE', 
    '{"GAS91": 2.18, "GAS95": 2.33, "GAS98": 2.60, "DIESEL": 1.15}'::jsonb, 
    'riyadh.supervisor', 
    'password123', 
    1, 
    3
) ON CONFLICT (code) DO NOTHING;

-- Station 3: Jeddah
INSERT INTO stations (id, name, code, location, manager, status, "fuelPricing", username, password, "dispenserCount", "pumpsPerDispenser")
VALUES (
    'st-03', 
    'Red Sea Gate - Jeddah Port', 
    'RS-JEDD-03', 
    'Corniche Road, Jeddah, KSA', 
    'Faisal Al-Zahrani', 
    'ACTIVE', 
    '{"GAS91": 2.18, "GAS95": 2.33, "GAS98": 2.60, "DIESEL": 1.15}'::jsonb, 
    'jeddah.supervisor', 
    'password123', 
    1, 
    2
) ON CONFLICT (code) DO NOTHING;


-- Seed Station 1 Tanks
INSERT INTO fuel_tanks (id, "stationId", label, "fuelType", capacity, "currentLevel", temperature, "waterLevel", "lastMeasurementTime") VALUES
('tank-01-st-01', 'st-01', 'Tank 01', 'GAS91', 45000, 11000, 34.20, 0.00, '10/06 14:07'),
('tank-02-st-01', 'st-01', 'Tank 02', 'GAS95', 45000, 11000, 33.80, 0.00, '10/06 14:07'),
('tank-03-st-01', 'st-01', 'Tank 03', 'DIESEL', 60000, 27500, 32.50, 0.02, '10/06 14:05')
ON CONFLICT (id) DO NOTHING;

-- Seed Station 2 Tanks
INSERT INTO fuel_tanks (id, "stationId", label, "fuelType", capacity, "currentLevel", temperature, "waterLevel", "lastMeasurementTime") VALUES
('tank-01-st-02', 'st-02', 'Tank 01', 'GAS91', 45000, 31000, 35.10, 0.00, '10/06 14:00'),
('tank-02-st-02', 'st-02', 'Tank 02', 'GAS95', 45000, 28500, 34.90, 0.01, '10/06 14:00'),
('tank-03-st-02', 'st-02', 'Tank 03', 'GAS98', 30000, 9800, 34.50, 0.00, '10/06 14:01')
ON CONFLICT (id) DO NOTHING;

-- Seed Station 3 Tanks
INSERT INTO fuel_tanks (id, "stationId", label, "fuelType", capacity, "currentLevel", temperature, "waterLevel", "lastMeasurementTime") VALUES
('tank-01-st-03', 'st-03', 'Tank 01', 'GAS91', 50000, 14200, 31.80, 0.03, '10/06 13:58'),
('tank-02-st-03', 'st-03', 'Tank 02', 'GAS95', 50000, 33100, 31.20, 0.00, '10/06 13:58')
ON CONFLICT (id) DO NOTHING;


-- Seed Station 1 Pumps
INSERT INTO fuel_pumps (id, "stationId", label, status, "fuelType") VALUES
('pump-01-st-01', 'st-01', 'Pump 01', 'IDLE', 'GAS91'),
('pump-02-st-01', 'st-01', 'Pump 02', 'IDLE', 'GAS95'),
('pump-03-st-01', 'st-01', 'Pump 03', 'IDLE', 'DIESEL'),
('pump-04-st-01', 'st-01', 'Pump 04', 'IDLE', 'GAS91')
ON CONFLICT (id) DO NOTHING;

-- Seed Station 2 Pumps
INSERT INTO fuel_pumps (id, "stationId", label, status, "fuelType") VALUES
('pump-01-st-02', 'st-02', 'Pump 01', 'IDLE', 'GAS91'),
('pump-02-st-02', 'st-02', 'Pump 02', 'IDLE', 'GAS95'),
('pump-03-st-02', 'st-02', 'Pump 03', 'IDLE', 'GAS98')
ON CONFLICT (id) DO NOTHING;

-- Seed Station 3 Pumps
INSERT INTO fuel_pumps (id, "stationId", label, status, "fuelType") VALUES
('pump-01-st-03', 'st-03', 'Pump 01', 'IDLE', 'GAS91'),
('pump-02-st-03', 'st-03', 'Pump 02', 'IDLE', 'GAS95')
ON CONFLICT (id) DO NOTHING;


-- Seed Sales Transactions
INSERT INTO sales_transactions (id, "stationId", timestamp, "pumpId", "fuelType", volume, "heightBefore", "heightAfter", temperature, "waterLevel", "pricePerLitre", amount, status) VALUES
('tx-100', 'st-01', '10/06 13:47', 'pump-01-st-01', 'GAS91', 0.00, 588.00, 588.00, 34.50, 0.00, 2.18, 0.00, 'STARTED'),
('tx-101', 'st-01', '10/06 14:07', 'pump-01-st-01', 'GAS91', 500.00, 588.00, 616.00, 34.20, 0.00, 2.18, 1090.00, 'FINISHED'),
('tx-102', 'st-01', '10/06 13:47', 'pump-02-st-01', 'GAS95', 0.00, 588.00, 588.00, 34.10, 0.00, 2.33, 0.00, 'STARTED'),
('tx-103', 'st-01', '10/06 14:07', 'pump-02-st-01', 'GAS95', 500.00, 588.00, 616.00, 33.80, 0.00, 2.33, 1165.00, 'FINISHED'),
('tx-104', 'st-01', '10/06 10:30', 'pump-03-st-01', 'DIESEL', 120.00, NULL, NULL, NULL, NULL, 1.15, 138.00, 'FINISHED'),
('tx-105', 'st-01', '10/06 11:15', 'pump-01-st-01', 'GAS91', 45.00, NULL, NULL, NULL, NULL, 2.18, 98.10, 'FINISHED'),
('tx-106', 'st-01', '10/06 12:40', 'pump-02-st-01', 'GAS95', 50.00, NULL, NULL, NULL, NULL, 2.33, 116.50, 'FINISHED'),
('tx-201', 'st-02', '10/06 09:15', 'pump-01-st-02', 'GAS91', 38.00, NULL, NULL, NULL, NULL, 2.18, 82.84, 'FINISHED'),
('tx-202', 'st-02', '10/06 11:45', 'pump-02-st-02', 'GAS95', 62.00, NULL, NULL, NULL, NULL, 2.33, 144.46, 'FINISHED'),
('tx-203', 'st-02', '10/06 13:20', 'pump-03-st-02', 'GAS98', 55.00, NULL, NULL, NULL, NULL, 2.60, 143.00, 'FINISHED'),
('tx-301', 'st-03', '10/06 08:30', 'pump-01-st-03', 'GAS91', 42.00, NULL, NULL, NULL, NULL, 2.18, 91.56, 'FINISHED'),
('tx-302', 'st-03', '10/06 12:10', 'pump-02-st-03', 'GAS95', 75.00, NULL, NULL, NULL, NULL, 2.33, 174.75, 'FINISHED')
ON CONFLICT (id) DO NOTHING;


-- Seed Audit Logs
INSERT INTO audit_logs (id, "stationId", timestamp, "user", role, action, details, "ipAddress") VALUES
('aud-001', 'st-01', '10/06 08:00', 'Saeed Alqahtani', 'STATION_ADMIN', 'STATION_ONLINE', 'Abha station hardware communication channel successfully initialized.', '192.168.10.45'),
('aud-002', 'st-01', '10/06 08:15', 'Saeed Alqahtani', 'STATION_ADMIN', 'TANK_HEIGHT_CALIBRATION', 'Automatic Tank Gauge (ATG) heights calibrated with high precision (GAS91, GAS95).', '192.168.10.45'),
('aud-003', 'st-02', '10/06 09:00', 'Yousef Al-Harbi', 'STATION_ADMIN', 'PRICE_SYNC', 'Synchronized local fuel pricing index with central HQ directive.', '192.168.12.112'),
('aud-004', NULL, '10/06 10:00', 'HQ Administrator', 'SUPER_ADMIN', 'STATION_REGISTER', 'Created and deployed new tenant profile "Red Sea Gate - Jeddah Port" (code RS-JEDD-03).', '10.0.1.5')
ON CONFLICT (id) DO NOTHING;


-- Seed Supervisor Users
INSERT INTO onboarded_users (id, station_id, station_name, station_code, username, password_raw, full_name, role) VALUES
('usr-seed-01', 'st-01', 'Al Noor - Noor Abha', 'AN-ABHA-01', 'abha.supervisor', 'password123', 'Saeed Alqahtani (Supervisor)', 'supervisor'),
('usr-seed-02', 'st-02', 'Desert Oasis - Riyadh North', 'DO-RIYD-02', 'riyadh.supervisor', 'password123', 'Yousef Al-Harbi (Supervisor)', 'supervisor'),
('usr-seed-03', 'st-03', 'Red Sea Gate - Jeddah Port', 'RS-JEDD-03', 'jeddah.supervisor', 'password123', 'Faisal Al-Zahrani (Supervisor)', 'supervisor')
ON CONFLICT (username) DO NOTHING;
