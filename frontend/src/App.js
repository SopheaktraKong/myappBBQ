import "@/App.css";
import { BrowserRouter, Routes, Route, Navigate, useLocation } from "react-router-dom";
import { Toaster } from "sonner";
import { I18nProvider } from "@/lib/i18n";
import Landing from "@/pages/Landing";
import CustomerMenu from "@/pages/CustomerMenu";
import MenuPreview from "@/pages/MenuPreview";
import KitchenDisplay from "@/pages/KitchenDisplay";
import WaiterView from "@/pages/WaiterView";
import OrdersList from "@/pages/OrdersList";
import AdminLogin from "@/pages/AdminLogin";
import AdminShell from "@/pages/AdminShell";
import AdminDashboard from "@/pages/AdminDashboard";
import AdminMenu from "@/pages/AdminMenu";
import AdminTables from "@/pages/AdminTables";
import AdminStaff from "@/pages/AdminStaff";
import AdminReceipts from "@/pages/AdminReceipts";
import AdminSettings from "@/pages/AdminSettings";
import { getUser } from "@/lib/api";

function RequireAuth({ roles, children }) {
  const u = getUser();
  const loc = useLocation();
  if (!u) return <Navigate to="/staff/login" replace state={{ from: loc.pathname + loc.search }} />;
  if (roles && !roles.includes(u.role)) return <Navigate to="/staff/login" replace />;
  return children;
}

function App() {
  return (
    <I18nProvider>
      <Toaster position="top-center" richColors closeButton />
      <BrowserRouter>
        <Routes>
          <Route path="/staff/login" element={<AdminLogin />} />
          {/* Customer QR flow is public — guests do not need to log in */}
          <Route path="/menu" element={<CustomerMenu />} />
          <Route path="/menu-preview" element={<RequireAuth roles={["owner","waiter"]}><MenuPreview /></RequireAuth>} />
          <Route path="/" element={<RequireAuth roles={["owner","waiter","kitchen"]}><Landing /></RequireAuth>} />
          <Route path="/kitchen" element={<RequireAuth roles={["owner","kitchen","waiter"]}><KitchenDisplay /></RequireAuth>} />
          <Route path="/waiter" element={<RequireAuth roles={["owner","waiter"]}><WaiterView /></RequireAuth>} />
          <Route path="/orders" element={<RequireAuth roles={["owner","waiter"]}><OrdersList /></RequireAuth>} />
          <Route path="/admin" element={<RequireAuth roles={["owner"]}><AdminShell /></RequireAuth>}>
            <Route index element={<AdminDashboard />} />
            <Route path="menu" element={<AdminMenu />} />
            <Route path="tables" element={<AdminTables />} />
            <Route path="staff" element={<AdminStaff />} />
            <Route path="receipts" element={<AdminReceipts />} />
            <Route path="settings" element={<AdminSettings />} />
          </Route>
        </Routes>
      </BrowserRouter>
    </I18nProvider>
  );
}

export default App;
