import { useState } from "react";
import { NavLink, Outlet, useNavigate, useLocation } from "react-router-dom";
import { clearAuth, getUser } from "@/lib/api";
import { Button } from "@/components/ui/button";
import { Sheet, SheetContent, SheetTrigger } from "@/components/ui/sheet";
import { Flame, LayoutDashboard, UtensilsCrossed, QrCode, Users, Settings, LogOut, ExternalLink, ClipboardList, Home, Receipt, Menu as MenuIcon } from "lucide-react";

const nav = [
  { to: "/", label: "Home", icon: Home, end: true, tid: "nav-home" },
  { to: "/admin", label: "Dashboard", icon: LayoutDashboard, end: true, tid: "nav-dashboard" },
  { to: "/admin/menu", label: "Menu", icon: UtensilsCrossed, tid: "nav-menu" },
  { to: "/admin/tables", label: "Tables & QR", icon: QrCode, tid: "nav-tables" },
  { to: "/admin/receipts", label: "Receipts", icon: Receipt, tid: "nav-receipts" },
  { to: "/admin/staff", label: "Staff", icon: Users, tid: "nav-staff" },
  { to: "/admin/settings", label: "Settings", icon: Settings, tid: "nav-settings" },
];

function SidebarContent({ onItemClick, onLogout, user }) {
  return (
    <>
      <div className="flex items-center gap-2 px-2 py-3">
        <Flame className="w-5 h-5 text-[color:var(--chili)]" />
        <div>
          <div className="font-display font-black text-lg leading-none">BBQ Nights</div>
          <div className="text-[10px] uppercase tracking-widest text-neutral-500 mt-0.5">Owner Console</div>
        </div>
      </div>
      <nav className="mt-4 space-y-1">
        {nav.map((n) => (
          <NavLink
            key={n.to}
            to={n.to}
            end={n.end}
            data-testid={n.tid}
            onClick={onItemClick}
            className={({ isActive }) => `flex items-center gap-3 px-3 py-2 rounded-lg text-sm font-semibold ${isActive ? "bg-neutral-900 text-white" : "text-neutral-700 hover:bg-neutral-100"}`}
          >
            <n.icon className="w-4 h-4" /> {n.label}
          </NavLink>
        ))}
        <NavLink to="/orders" data-testid="nav-orders-view" onClick={onItemClick} className={({ isActive }) => `flex items-center gap-3 px-3 py-2 rounded-lg text-sm font-semibold ${isActive ? "bg-neutral-900 text-white" : "text-neutral-700 hover:bg-neutral-100"}`}>
          <ClipboardList className="w-4 h-4" /> Orders
        </NavLink>
        <NavLink to="/kitchen" data-testid="nav-kitchen-view" onClick={onItemClick} className={({ isActive }) => `flex items-center gap-3 px-3 py-2 rounded-lg text-sm font-semibold ${isActive ? "bg-neutral-900 text-white" : "text-neutral-700 hover:bg-neutral-100"}`}>
          <ExternalLink className="w-4 h-4" /> Kitchen View
        </NavLink>
        <NavLink to="/waiter" data-testid="nav-waiter-view" onClick={onItemClick} className={({ isActive }) => `flex items-center gap-3 px-3 py-2 rounded-lg text-sm font-semibold ${isActive ? "bg-neutral-900 text-white" : "text-neutral-700 hover:bg-neutral-100"}`}>
          <ExternalLink className="w-4 h-4" /> Waiter View
        </NavLink>
      </nav>
      <div className="mt-auto border-t border-neutral-100 pt-4">
        <div className="text-sm px-3">
          <div className="font-semibold">{user?.name}</div>
          <div className="text-xs text-neutral-500 truncate">{user?.email}</div>
        </div>
        <Button data-testid="admin-logout-btn" onClick={onLogout} variant="outline" className="w-full mt-3 pill">
          <LogOut className="w-4 h-4 mr-2" /> Logout
        </Button>
      </div>
    </>
  );
}

export default function AdminShell() {
  const navigate = useNavigate();
  const user = getUser();
  const [open, setOpen] = useState(false);
  const location = useLocation();
  const title = nav.find((n) => n.to === location.pathname)?.label || "Admin";
  const handleLogout = () => { clearAuth(); navigate("/staff/login"); };

  return (
    <div className="min-h-screen bg-[color:var(--bg-admin)] md:flex">
      {/* Desktop sidebar */}
      <aside className="hidden md:flex w-60 bg-white border-r border-black/5 flex-col p-4 shrink-0">
        <SidebarContent onLogout={handleLogout} user={user} />
      </aside>

      {/* Mobile top bar */}
      <header className="md:hidden sticky top-0 z-30 bg-white border-b border-black/5 px-4 py-3 flex items-center gap-3">
        <Sheet open={open} onOpenChange={setOpen}>
          <SheetTrigger asChild>
            <button data-testid="admin-mobile-menu-btn" className="pill w-10 h-10 flex items-center justify-center border border-black/10 bg-white tap">
              <MenuIcon className="w-5 h-5" />
            </button>
          </SheetTrigger>
          <SheetContent side="left" className="w-72 p-4 flex flex-col">
            <SidebarContent onItemClick={() => setOpen(false)} onLogout={handleLogout} user={user} />
          </SheetContent>
        </Sheet>
        <div className="flex items-center gap-2 flex-1 min-w-0">
          <Flame className="w-5 h-5 text-[color:var(--chili)] shrink-0" />
          <div className="min-w-0">
            <div className="text-[10px] uppercase tracking-widest font-bold text-neutral-500 leading-none">Owner</div>
            <div className="font-display font-black text-base leading-tight truncate">{title}</div>
          </div>
        </div>
      </header>

      <main className="flex-1 overflow-y-auto">
        <Outlet />
      </main>
    </div>
  );
}
