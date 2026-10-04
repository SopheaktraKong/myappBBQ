import { Link, useNavigate } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Flame, QrCode, ChefHat, Users, LogOut, LayoutDashboard, ArrowRight } from "lucide-react";
import { getUser, clearAuth } from "@/lib/api";

export default function Landing() {
  const user = getUser();
  const nav = useNavigate();
  const isOwner = user?.role === "owner";

  return (
    <div className="bbq-bg min-h-screen">
      <header className="max-w-6xl mx-auto px-6 py-6 flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Flame className="w-6 h-6 text-[color:var(--chili)]" />
          <span className="font-display font-black text-xl tracking-tight">BBQ Nights</span>
        </div>
        <div className="flex items-center gap-2">
          {user && (
            <>
              <span className="hidden sm:inline text-sm text-neutral-600 px-2">
                {user.name} <span className="text-[10px] uppercase tracking-widest text-neutral-400 ml-1">{user.role}</span>
              </span>
              <Button data-testid="landing-logout-btn" variant="outline" className="pill" onClick={() => { clearAuth(); nav("/staff/login"); }}>
                <LogOut className="w-4 h-4 mr-2" /> Logout
              </Button>
            </>
          )}
        </div>
      </header>

      <section className="max-w-6xl mx-auto px-6 pt-6 pb-10 grid md:grid-cols-2 gap-10 items-center">
        <div>
          <p className="uppercase text-xs tracking-[0.24em] font-bold text-[color:var(--chili)]">Scan · Order · Feast</p>
          <h1 className="font-display font-black text-5xl sm:text-6xl leading-[0.95] tracking-tight mt-4">
            Grill nights,<br/>zero waiting.
          </h1>
          <p className="mt-6 text-lg text-neutral-700 max-w-md">
            Guests scan the table QR, browse the menu in Khmer or English, and pay by ABA QR or cash, while the kitchen sees every order instantly.
          </p>
          <div className="mt-8 flex flex-wrap gap-3">
            {isOwner && (
              <Link to="/admin">
                <Button data-testid="landing-admin-btn" className="pill h-12 px-6 bg-[color:var(--chili)] hover:bg-[color:var(--chili-hover)] text-white text-base">
                  <LayoutDashboard className="w-4 h-4 mr-2" /> Admin Console
                </Button>
              </Link>
            )}
            {(isOwner || user?.role === "waiter") && (
              <Link to="/waiter">
                <Button data-testid="landing-waiter-btn" variant={user?.role === "waiter" ? "default" : "outline"} className={`pill h-12 px-6 text-base ${user?.role === "waiter" ? "bg-[color:var(--chili)] hover:bg-[color:var(--chili-hover)] text-white" : ""}`}>
                  Waiter View
                </Button>
              </Link>
            )}
            <Link to="/kitchen">
              <Button data-testid="landing-kitchen-btn" variant={user?.role === "kitchen" ? "default" : "outline"} className={`pill h-12 px-6 text-base ${user?.role === "kitchen" ? "bg-[color:var(--chili)] hover:bg-[color:var(--chili-hover)] text-white" : ""}`}>
                Kitchen Display
              </Button>
            </Link>
            {(isOwner || user?.role === "waiter") && (
              <Link to="/menu-preview">
                <Button data-testid="landing-try-menu-btn" variant="outline" className="pill h-12 px-6 text-base">
                  <QrCode className="w-4 h-4 mr-2" /> View menu
                </Button>
              </Link>
            )}
          </div>
        </div>

        <div className="relative">
          <img
            src="https://images.unsplash.com/photo-1720720581218-e20039f18828?crop=entropy&cs=srgb&fm=jpg&ixid=M3w3NTY2Njd8MHwxfHNlYXJjaHwxfHxjYW1ib2RpYW4lMjBiYnElMjBmb29kfGVufDB8fHx8MTc4NzgzOTk4NHww&ixlib=rb-4.1.0&q=85"
            alt="BBQ grill"
            className="rounded-3xl shadow-[0_30px_60px_rgba(0,0,0,0.15)] object-cover w-full aspect-[4/5]"
          />
          
        </div>
      </section>

      {/* Owner-only quick access to Staff management */}
      {isOwner && (
        <section className="max-w-6xl mx-auto px-4 sm:px-6 pb-10 sm:pb-14">
          <Link to="/admin/staff" data-testid="landing-manage-staff-card" className="block group">
            <div className="bg-white rounded-2xl border border-black/5 p-5 sm:p-7 flex flex-col sm:flex-row sm:items-center gap-4 sm:gap-5 shadow-[0_8px_30px_rgba(0,0,0,0.04)] hover:shadow-[0_20px_40px_rgba(0,0,0,0.08)] transition-shadow">
              <div className="flex items-center gap-4 sm:gap-5 flex-1 min-w-0">
                <div className="w-12 h-12 sm:w-14 sm:h-14 rounded-2xl bg-red-50 text-[color:var(--chili)] flex items-center justify-center shrink-0">
                  <Users className="w-5 h-5 sm:w-6 sm:h-6" />
                </div>
                <div className="flex-1 min-w-0">
                  <p className="uppercase text-[10px] tracking-[0.24em] font-bold text-neutral-500">Team</p>
                  <h2 className="font-display font-black text-lg sm:text-2xl mt-0.5">Manage Staff</h2>
                  <p className="text-sm text-neutral-600 mt-1">Add waiters and kitchen accounts, set passwords, remove staff.</p>
                </div>
              </div>
              <div className="pill h-11 px-5 bg-[color:var(--chili)] group-hover:bg-[color:var(--chili-hover)] text-white font-semibold text-sm flex items-center justify-center gap-2 shrink-0 w-full sm:w-auto">
                Open
                <ArrowRight className="w-4 h-4 transition-transform group-hover:translate-x-0.5" />
              </div>
            </div>
          </Link>
        </section>
      )}

      <section className="max-w-6xl mx-auto px-6 pb-24 grid md:grid-cols-3 gap-6">
        {[
          { Icon: QrCode, title: "One QR per table", desc: "Auto-tagged menu, shared bill, no app install." },
          { Icon: ChefHat, title: "Kitchen sees live", desc: "Orders land instantly on the KDS screen, sorted by time." },
          { Icon: Users, title: "Group ordering", desc: "Everyone at the table adds — bill splits per guest." },
        ].map(({ Icon, title, desc }) => (
          <div key={title} className="bg-white rounded-2xl p-6 border border-black/5 shadow-[0_8px_30px_rgba(0,0,0,0.04)]">
            <Icon className="w-6 h-6 text-[color:var(--chili)]" />
            <h3 className="font-display font-bold text-lg mt-4">{title}</h3>
            <p className="text-sm text-neutral-600 mt-2">{desc}</p>
          </div>
        ))}
      </section>
    </div>
  );
}
