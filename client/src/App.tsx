import { Navigate, Route, Routes, useParams } from "react-router-dom";
import ProtectedRoute from "./components/ProtectedRoute";
import AppLayout from "./components/AppLayout";
import LoginPage from "./pages/LoginPage";
import DashboardPage from "./pages/DashboardPage";
import OrdersPage from "./pages/OrdersPage";
import CustomersPage from "./pages/CustomersPage";
import MembershipPage from "./pages/MembershipPage";
import BarbersPage from "./pages/BarbersPage";
import ServicesPage from "./pages/ServicesPage";
import HistoryPage from "./pages/HistoryPage";
import InvoicesPage from "./pages/InvoicesPage";
import ReportsPage from "./pages/ReportsPage";
import SettingsPage from "./pages/SettingsPage";
import DetailBookingPage from "./pages/DetailBookingPage";
import RefundPage from "./pages/RefundPage";
export default function App() {
  return (
    <Routes>
      <Route path="/login" element={<LoginPage />} />
      <Route
        element={
          <ProtectedRoute>
            <AppLayout />
          </ProtectedRoute>
        }
      >
        <Route path="/" element={<DashboardPage />} />
        <Route path="/orders" element={<OrdersPage />} />
        <Route path="/bookings" element={<Navigate to="/orders?jenis=BOOKING&periode=SEMUA" replace />} />
        <Route path="/bookings/:id" element={<RuteBookingLama />} />
        <Route path="/orders/booking/:id" element={<DetailBookingPage />} />
        <Route path="/refunds" element={<RefundPage />} />
        <Route path="/orders/new" element={<Navigate to="/orders" replace />} />
        <Route path="/orders/:id" element={<RutePesananLama />} />
        <Route
          path="/orders/:id/payment"
          element={<RutePesananLama />}
        />
        <Route path="/customers" element={<CustomersPage />} />
        <Route path="/membership" element={<MembershipPage />} />
        <Route path="/barbers" element={<BarbersPage />} />
        <Route path="/services" element={<ServicesPage />} />
        <Route path="/history" element={<HistoryPage />} />
        <Route path="/invoices" element={<InvoicesPage />} />
        <Route path="/reports" element={<ReportsPage />} />
        <Route path="/settings" element={<SettingsPage />} />
      </Route>
      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  );
}
function RuteBookingLama(){const {id}=useParams();return <Navigate to={`/orders/booking/${id}`} replace/>;}
function RutePesananLama(){const {id}=useParams();return <Navigate to={`/orders?pesananId=${id}`} replace/>;}
