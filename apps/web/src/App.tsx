import { Navigate, Route, Routes } from 'react-router-dom';
import { AppLayout } from '@/app/layout';
import { AppProviders } from '@/app/providers';
import { ProtectedRoute } from '@/app/ProtectedRoute';
import { RequireRoutePermission } from '@/app/RequireRoutePermission';
import { SystemStatusPage } from '@/app/SystemStatusPage';
import { AnalyticsPage } from '@/features/analytics/pages/AnalyticsPage';
import { LoginPage } from '@/features/auth/pages/LoginPage';
import { DashboardPage } from '@/features/dashboard/pages/DashboardPage';
import { AirlinesPage } from '@/features/masterdata/pages/AirlinesPage';
import { AirportsPage } from '@/features/masterdata/pages/AirportsPage';
import { CommoditiesPage } from '@/features/masterdata/pages/CommoditiesPage';
import { ConsigneesPage } from '@/features/masterdata/pages/ConsigneesPage';
import { FlightsPage } from '@/features/masterdata/pages/FlightsPage';
import { ShippersPage } from '@/features/masterdata/pages/ShippersPage';
import { ProfilePage } from '@/features/profile/pages/ProfilePage';
import { RateTablePage } from '@/features/rates/pages/RateTablePage';
import { SchedulePage } from '@/features/shipments/pages/SchedulePage';
import { ShipmentViewPage } from '@/features/shipments/pages/ShipmentViewPage';
import { UserAdminPage } from '@/features/users/pages/UserAdminPage';

function App() {
  return (
    <AppProviders>
      <Routes>
        <Route path="/login" element={<LoginPage />} />
        <Route
          path="/*"
          element={
            <ProtectedRoute>
              <AppLayout>
                <Routes>
                  {/* "/" is not its own page — it redirects to the one canonical
                      Dashboard URL so the nav's "Dashboard" link (which points at
                      /dashboard) is correctly marked active however a user arrives
                      here (bare "/", a bookmark, or the post-login default). */}
                  <Route path="/" element={<Navigate to="/dashboard" replace />} />
                  <Route path="/dashboard" element={<DashboardPage />} />
                  <Route path="/shipments" element={<SchedulePage />} />
                  <Route path="/shipments/:id" element={<ShipmentViewPage />} />
                  {/* Self-service — no permission gate, every authenticated
                      user has exactly one profile: their own. */}
                  <Route path="/profile" element={<ProfilePage />} />
                  <Route
                    path="/users"
                    element={
                      <RequireRoutePermission permission="identity.user.manage">
                        <UserAdminPage />
                      </RequireRoutePermission>
                    }
                  />
                  {/* Technical/admin page, kept out of the primary business nav —
                      reached via the ProfileMenu's "System Status" item instead
                      (see PrimaryNavigation/ProfileMenu). */}
                  <Route
                    path="/settings/system-status"
                    element={
                      <RequireRoutePermission permission="identity.user.manage">
                        <SystemStatusPage />
                      </RequireRoutePermission>
                    }
                  />
                  <Route
                    path="/masterdata/shippers"
                    element={
                      // Broader than masterdata.manage — see masterdata.shipper.create.
                      <RequireRoutePermission permission="masterdata.shipper.create">
                        <ShippersPage />
                      </RequireRoutePermission>
                    }
                  />
                  <Route
                    path="/masterdata/consignees"
                    element={
                      // Broader than masterdata.manage — see masterdata.consignee.create.
                      <RequireRoutePermission permission="masterdata.consignee.create">
                        <ConsigneesPage />
                      </RequireRoutePermission>
                    }
                  />
                  <Route
                    path="/masterdata/airlines"
                    element={
                      // Broader than masterdata.manage — see masterdata.airline.create.
                      <RequireRoutePermission permission="masterdata.airline.create">
                        <AirlinesPage />
                      </RequireRoutePermission>
                    }
                  />
                  <Route
                    path="/masterdata/airports"
                    element={
                      // Broader than masterdata.manage — see masterdata.airport.create.
                      <RequireRoutePermission permission="masterdata.airport.create">
                        <AirportsPage />
                      </RequireRoutePermission>
                    }
                  />
                  <Route
                    path="/masterdata/commodities"
                    element={
                      <RequireRoutePermission permission="masterdata.commodity.create">
                        <CommoditiesPage />
                      </RequireRoutePermission>
                    }
                  />
                  <Route
                    path="/masterdata/flights"
                    element={
                      // Broader than masterdata.manage — see masterdata.flight.create.
                      <RequireRoutePermission permission="masterdata.flight.create">
                        <FlightsPage />
                      </RequireRoutePermission>
                    }
                  />
                  <Route
                    path="/rates"
                    element={
                      <RequireRoutePermission permission="rate.table.manage">
                        <RateTablePage />
                      </RequireRoutePermission>
                    }
                  />
                  <Route
                    path="/analytics"
                    element={
                      <RequireRoutePermission permission="analytics.view">
                        <AnalyticsPage />
                      </RequireRoutePermission>
                    }
                  />
                </Routes>
              </AppLayout>
            </ProtectedRoute>
          }
        />
      </Routes>
    </AppProviders>
  );
}

export default App;
