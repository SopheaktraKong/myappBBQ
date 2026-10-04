import { useCallback, useEffect, useState } from "react";
import { api, clearAuth, getUser } from "@/lib/api";
import { useAppSocket } from "@/lib/useAppSocket";
import { Button } from "@/components/ui/button";
import { toast } from "sonner";
import { useNavigate } from "react-router-dom";
import { LogOut, Utensils, CheckCircle2, Flame } from "lucide-react";

function minutesAgo(iso) {
  return Math.round((Date.now() - new Date(iso).getTime()) / 60000);
}
function ageClass(iso) {
  const m = minutesAgo(iso);
  if (m < 5) return "ticket-fresh";
  if (m < 12) return "ticket-warn";
  return "ticket-late";
}

export default function KitchenDisplay() {
  const [orders, setOrders] = useState([]);
  const [, tick] = useState(0);
  const nav = useNavigate();
  const user = getUser();

  const load = useCallback(async () => {
    const { data } = await api.get("/orders/kitchen");
    setOrders(data);
  }, []);

  useEffect(() => {
  load(); // Initial load when page opens

  const interval = setInterval(() => {
    load(); // Auto-refresh every 3 seconds
  }, 3000);

  return () => clearInterval(interval); // Clean up timer on exit
}, [load]);
  useEffect(() => {
    const t = setInterval(() => tick((n) => n + 1), 30000);
    return () => clearInterval(t);
  }, []);
  useAppSocket((msg) => {
    if (["new_order", "order_updated", "session_closed"].includes(msg.type)) load();
    if (msg.type === "new_order") toast.success(`New order · ${msg.order.table_label}`);
  });

  const updateItem = async (oid, idx, status) => {
    await api.patch(`/orders/${oid}/item/${idx}?status=${status}`);
    load();
  };

  return (
    <div className="min-h-screen kds-bg">
      <header className="border-b border-neutral-800 px-4 sm:px-6 py-3 sm:py-4 flex items-center justify-between gap-2">
        <div className="flex items-center gap-2 sm:gap-3 min-w-0">
          <Flame className="w-5 h-5 sm:w-6 sm:h-6 text-[color:var(--chili)] shrink-0" />
          <div className="min-w-0">
            <div className="text-[10px] sm:text-xs uppercase tracking-[0.24em] font-bold text-neutral-400">Kitchen</div>
            <h1 className="font-display font-black text-lg sm:text-2xl leading-tight truncate">Live Orders · {orders.length}</h1>
          </div>
        </div>
        <div className="flex items-center gap-2 sm:gap-3">
          <span className="hidden md:inline text-sm text-neutral-400">{user?.name}</span>
          <Button data-testid="kds-logout-btn" onClick={() => { clearAuth(); nav("/staff/login"); }} variant="outline" size="sm" className="pill border-neutral-700 bg-neutral-900 text-white hover:bg-neutral-800 h-9 sm:h-10 px-2.5 sm:px-4">
            <LogOut className="w-4 h-4 sm:mr-2" />
            <span className="hidden sm:inline">Logout</span>
          </Button>
        </div>
      </header>
      <main className="p-4">
        {orders.length === 0 ? (
          <div className="mt-24 text-center text-neutral-500">
            <Utensils className="w-10 h-10 mx-auto opacity-50" />
            <p className="mt-4 font-display text-xl">Kitchen is caught up.</p>
          </div>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 2xl:grid-cols-5 gap-4">
            {orders.map((o) => (
              <div key={o.id} data-testid={`kds-order-${o.id}`} className={`bg-neutral-900 rounded-xl p-4 border border-neutral-800 ${ageClass(o.created_at)}`}>
                <div className="flex items-baseline justify-between mb-3">
                  <div className="font-display font-black text-2xl">{o.table_label}</div>
                  <div className="text-xs uppercase tracking-widest text-neutral-400">{minutesAgo(o.created_at)}m ago</div>
                </div>
                <div className="text-xs text-neutral-500 mb-2 uppercase tracking-widest">{o.guest_name}</div>
                <ul className="space-y-2">
                  {o.items.map((it, idx) => (
                    <li key={`${it.item_id}-${idx}`} className={`p-2 rounded-lg ${it.status === "ready" ? "bg-emerald-950/40" : it.status === "preparing" ? "bg-amber-950/30" : "bg-neutral-800/60"}`}>
                      <div className="flex items-start justify-between gap-2">
                        <div className="flex-1">
                          <div className="font-bold text-lg">{it.quantity}× {it.name_en}</div>
                          {it.note && <div className="text-xs text-amber-300 mt-1">✎ {it.note}</div>}
                        </div>
                        <span className="text-[10px] uppercase tracking-widest text-neutral-400">{it.status}</span>
                      </div>
                      <div className="flex gap-1 mt-2">
                        <Button data-testid={`kds-${o.id}-${idx}-preparing`} size="sm" variant="outline" onClick={() => updateItem(o.id, idx, "preparing")} className="pill h-7 text-[11px] border-neutral-700 bg-neutral-800 text-white hover:bg-neutral-700">Cooking</Button>
                        <Button data-testid={`kds-${o.id}-${idx}-ready`} size="sm" onClick={() => updateItem(o.id, idx, "ready")} className="pill h-7 text-[11px] bg-emerald-600 hover:bg-emerald-500 text-white">
                          <CheckCircle2 className="w-3 h-3 mr-1" /> Ready
                        </Button>
                      </div>
                    </li>
                  ))}
                </ul>
              </div>
            ))}
          </div>
        )}
      </main>
    </div>
  );
}
