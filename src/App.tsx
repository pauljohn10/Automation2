/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useEffect } from 'react';
import { FuelSystemProvider, useFuelSystem } from './context';
import { Sidebar } from './components/Sidebar';
import { Topbar } from './components/Topbar';
import { TankMonitor } from './components/TankMonitor';
import { PumpMonitor } from './components/PumpMonitor';
import { ReportDashboard } from './components/ReportDashboard';
import { ShowPrices } from './components/ShowPrices';
import { AdminOverride } from './components/AdminOverride';
import { StationsDirectory } from './components/StationsDirectory';
import { AuditDashboard } from './components/AuditDashboard';
import { LoginScreen } from './components/LoginScreen';
import { UserManagement } from './components/UserManagement';

function MainLayout() {
  const { session } = useFuelSystem();
  
  // Local active tab routing state
  const [currentTab, setCurrentTab] = useState('stations_directory');

  // Auto-redirect default tabs when the user switches their active gateway role profile context
  useEffect(() => {
    if ((session.role === 'SUPER_ADMIN' || session.role === 'ADMIN' || session.role === 'VIEWER') && !session.isStationContext) {
      setCurrentTab('stations_directory');
    } else {
      setCurrentTab('tank_monitor');
    }
  }, [session.role, session.activeStationId, session.isStationContext]);

  // View router binder
  const renderActiveView = () => {
    switch (currentTab) {
      // Super Admin HQ Views
      case 'stations_directory':
        return <StationsDirectory />;
      case 'integrated_metrics':
        return <ReportDashboard />;
      case 'global_audit_trail':
        return <AuditDashboard />;
      case 'user_management':
        return <UserManagement />;

      // Station Operator Views
      case 'tank_monitor':
        return <TankMonitor />;
      case 'pump_monitor':
        return <PumpMonitor />;
      case 'tank_reporting':
        return <ReportDashboard />;
      case 'show_prices':
        return <ShowPrices />;
      case 'admin_override':
        return <AdminOverride />;

      default:
        return (
          <div className="p-8 text-center text-slate-500 font-sans italic text-xs">
            The requested console module is currently undergoing system maintenance. Select an active telemetry bay.
          </div>
        );
    }
  };

  return (
    <div className="flex h-screen w-screen overflow-hidden bg-slate-100 font-sans">
      {/* Dynamic Command Sidebar */}
      <Sidebar currentTab={currentTab} setCurrentTab={setCurrentTab} />

      {/* Main Container */}
      <div className="flex-1 flex flex-col h-full overflow-hidden">
        {/* Dynamic Telemetry Topbar */}
        <Topbar currentTab={currentTab} />

        {/* Dynamic Modular Screen Content */}
        <main className="flex-1 overflow-y-auto bg-slate-50">
          {renderActiveView()}
        </main>
      </div>
    </div>
  );
}

function AppContent() {
  const { session } = useFuelSystem();

  if (!session.isLoggedIn) {
    return <LoginScreen />;
  }

  return <MainLayout />;
}

export default function App() {
  return (
    <FuelSystemProvider>
      <AppContent />
    </FuelSystemProvider>
  );
}
