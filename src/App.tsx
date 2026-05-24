import { BrowserRouter, Routes, Route, Navigate } from "react-router-dom";
import { AuthProvider } from "./context/AuthContext";
import ProtectedRoute from "./routes/ProtectedRoute";

import LoginPage from "./pages/auth/LoginPage";
import CustomerHome from "./pages/customer/CustomerHome";
import AgentDashboard from "./pages/agent/AgentDashboard";
import AdminDashboard from "./pages/admin/AdminDashboard";
import PlatformDashboard from "./pages/platform/PlatformDashboard";


export default function App() {
  return (
    <AuthProvider>
      <BrowserRouter>
        <Routes>
          {/* Public route */}
          <Route path="/login" element={<LoginPage />} />

          {/* Customer App */}
          {/* Customer App */}
          <Route
            path="/app/*"
            element={<CustomerHome />}
          />

          {/* Delivery Agent App */}
          <Route
            path="/agent/*"
            element={
              <ProtectedRoute allowedRoles={["agent"]}>
                <AgentDashboard />
              </ProtectedRoute>
            }
          />

          {/* Tenant Admin Panel */}
          <Route
            path="/admin/*"
            element={
              <ProtectedRoute allowedRoles={["admin", "tenant_admin", "delivery_manager", "account_manager", "data_manager", "view_only"]}>
                <AdminDashboard />
              </ProtectedRoute>
            }
          />

          {/* Platform Super Admin Panel */}
          <Route
            path="/platform/*"
            element={
              <ProtectedRoute allowedRoles={["platform_super_admin"]}>
                <PlatformDashboard />
              </ProtectedRoute>
            }
          />

          {/* Default: redirect to login */}
          <Route path="*" element={<Navigate to="/login" replace />} />
        </Routes>
      </BrowserRouter>
    </AuthProvider>
  );
}
