/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

export type FuelGrade = 'GAS91' | 'GAS95' | 'GAS98' | 'DIESEL';

export interface FuelStation {
  id: string;
  name: string;
  code: string;
  location: string;
  manager: string;
  status: 'ACTIVE' | 'MAINTENANCE' | 'INACTIVE';
  fuelPricing: Record<FuelGrade, number>; // price per Litre
  username?: string;
  password?: string;
  dispenserCount?: number;
  pumpsPerDispenser?: number;
}

export interface FuelTank {
  id: string;
  stationId: string;
  label: string; // e.g., "Tank 01", "Tank 02"
  fuelType: FuelGrade;
  capacity: number; // e.g., 45000
  currentLevel: number; // e.g., 11000
  temperature: number; // e.g., 34.2
  waterLevel: number; // e.g., 0.00 in meters/milliliters
  lastMeasurementTime: string;
}

export interface FuelPump {
  id: string;
  stationId: string;
  label: string; // e.g., "Pump 01", "Pump 02"
  status: 'IDLE' | 'PUMPING' | 'COMPLETED' | 'MAINTENANCE';
  fuelType?: FuelGrade; // assigned fuel type for this pump/nozzle
  activeFuelGrade?: FuelGrade;
  flowRate?: number; // L/min when pumping
  volumeThisSession?: number; // transient L
}

export interface SalesTransaction {
  id: string;
  stationId: string;
  timestamp: string;
  pumpId: string;
  fuelType: FuelGrade;
  volume: number;
  heightBefore?: number;
  heightAfter?: number;
  temperature?: number;
  waterLevel?: number;
  pricePerLitre: number;
  amount: number;
  status: 'STARTED' | 'FINISHED';
  operator?: string;
  customer?: string;
}

export interface AuditLog {
  id: string;
  stationId?: string; // empty for HQ actions
  timestamp: string;
  user: string;
  role: string;
  action: string;
  details: string;
  ipAddress: string;
}

export interface UserSession {
  role: 'SUPER_ADMIN' | 'ADMIN' | 'VIEWER' | 'STATION_ADMIN' | 'OPERATOR';
  name: string;
  activeStationId: string; // station current selection (if multi-station)
  isLoggedIn?: boolean;
  originalRole?: 'SUPER_ADMIN' | 'ADMIN' | 'VIEWER' | 'STATION_ADMIN' | 'OPERATOR';
  isStationContext?: boolean;
  isMobilePreview?: boolean;
}
