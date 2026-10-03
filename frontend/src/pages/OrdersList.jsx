import { useCallback, useEffect, useMemo, useState } from "react";
import { api, clearAuth, getUser } from "@/lib/api";
import { apiError } from "@/lib/apiError";
import { useAppSocket } from "@/lib/useAppSocket";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { toast } from "sonner";
import { Link, useNavigate } from "react-router-dom";
import { Flame, Search, RefreshCw, LogOut, ArrowLeft, Clock, CheckCircle2, ChefHat, Utensils, Receipt, Eraser } from "lucide-react";

function fmt(n) { return `$${(n || 0).toFixed(2)}`; }
function minutesAgo(iso) { return Math.round((Date.now() - new Date(iso).getTime()) / 60000); }

const STATUS_TINT = {
  received:  { badge: "bg-neutral-100 text-neutral-800 border-neutral-200", accent: "border-l-neutral-400", Icon: Clock },
  preparing: { badge: "bg-amber-50 text-amber-800 border-amber-200",       accent: "border-l-amber-500",   Icon: ChefHat },
  ready:     { badge: "bg-emerald-50 text-emerald-800 border-emerald-200", accent: "border-l-emerald-500", Icon: Utensils },
  served:    { badge: "bg-neutral-100 text-neutral-500 border-neutral-200",accent: "border-l-neutral-300", Icon: CheckCircle2 },
};

const STATUS_OPTIONS = [
  { value: "active", label: "Active orders" },
  { value: "all",    label: "All orders" },
  { value: "received",  label: "Received" },
  { value: "preparing", label: "Preparing" },
  { value: "ready",     label: "Ready" },
  { value: "served",    label: "Served" },
];

export default function OrdersList() {
  const [orders, setOrders] = useState([]);
  const [q, setQ] = useState("");
  const [status, setStatus] = useState("active");
  const [loading, setLoading] = useState(false);
  const [, tick] = useState(0);
  const nav = useNavigate();
  const user = getUser();
  const isAdmin = user?.role === "owner";

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const { data } = await api.get("/orders");
      setOrders(data);
    } catch (e) { toast.error(apiError(e, "Failed to load orders")); }
    finally { setLoading(false); }
  }, []);

  useEffect(() => { load(); }, [load]);
  useEffect(() => { const t = setInterval(() => tick((n) => n + 1), 30000); return () => clearInterval(t); }, []);
  useAppSocket((msg) => {
    if (["new_order", "order_updated", "session_closed", "payment_created", "orders_cleared"].includes(msg.type)) load();
    if (msg.type === "new_order") toast.success(`New order · ${msg.order.table_label}`);
  });

  const list = useMemo(() => {
    let out = orders;
    if (status === "active") out = out.filter((o) => o.status !== "served");
    else if (status !== "all") out = out.filter((o) => o.status === status);
    if (q) {
      const needle = q.toLowerCase();
      out = out.filter((o) =>
        (o.table_label || "").toLowerCase().includes(needle) ||
        (o.guest_name || "").toLowerCase().includes(needle) ||
        (o.items || []).some((it) => (it.name_en || "").toLowerCase().includes(needle))
      );
    }
    return out;
  }, [orders, q, status]);

  const stats = useMemo(() => orders.reduce(
    (acc, o) => {
      acc.total += 1;
      acc[o.status] = (acc[o.status] || 0) + 1;
      acc.revenue += (o.subtotal || 0);
      return acc;
    },
    { total: 0, received: 0, preparing: 0, ready: 0, served: 0, revenue: 0 }
  ), [orders]);

  const updateItem = async (oid, idx, newStatus) => {
    try {
      await api.patch(`/orders/${oid}/item/${idx}?status=${newStatus}`);
      load();
    } catch (e) { toast.error(apiError(e, "Failed")); }
  };

  const [clearing, setClearing] = useState(false);
  const clearAll = async () => {
    const activeCount = orders.filter((o) => o.status !== "served").length;
    if (activeCount === 0) { toast.info("No active orders to clear"); return; }
    if (!window.confirm(`Clear all ${activeCount} active order${activeCount === 1 ? "" : "s"}? They will be marked as served.`)) return;
    setClearing(true);
    try {
      const { data } = await api.post("/orders/clear-all?mode=active");
      toast.success(`Cleared ${data.cleared} order${data.cleared === 1 ? "" : "s"}`);
      load();
    } catch (e) { toast.error(apiError(e, "Failed to clear orders")); }
    finally { setClearing(false); }
  };

  return (
    <div className="min-h-screen bg-[color:var(--bg-admin)]">
      <header className="bg-white border-b border-black/5 px-4 sm:px-6 py-3 sm:py-4 flex items-center justify-between gap-2 sticky top-0 z-30">
        <div className="flex items-center gap-2 sm:gap-3 min-w-0">
          <Link to={isAdmin ? "/admin" : "/"} data-testid="orders-back-link" className="pill w-9 h-9 flex items-center justify-center hover:bg-neutral-100 shrink-0">
            <ArrowLeft className="w-4 h-4" />
          </Link>
          <Flame className="w-5 h-5 text-[color:var(--chili)] shrink-0 hidden sm:block" />
          <div className="min-w-0">
            <div className="text-[10px] sm:text-xs uppercase tracking-[0.24em] font-bold text-neutral-500 leading-none">Live Orders</div>
            <h1 className="font-display font-black text-lg sm:text-2xl leading-tight truncate">Orders · {stats.total}</h1>
          </div>
        </div>
        <div className="flex items-center gap-1.5 sm:gap-2">
          <Button
            data-testid="orders-clear-all-btn"
            variant="outline"
            size="sm"
            onClick={clearAll}
            disabled={clearing || stats.total === 0 || (stats.received + stats.preparing + stats.ready) === 0}
            className="pill border-neutral-300 text-neutral-800 hover:bg-neutral-100 disabled:opacity-40 disabled:cursor-not-allowed h-9 sm:h-10 px-2.5 sm:px-4"
            title="Mark all active orders as served"
          >
            <Eraser className="w-4 h-4 sm:mr-2" />
            <span className="hidden sm:inline">{clearing ? "Clearing…" : "Clear all"}</span>
          </Button>
          <Button data-testid="orders-refresh-btn" variant="outline" size="icon" onClick={load} className="pill h-9 w-9 sm:h-10 sm:w-10">
            <RefreshCw className={`w-4 h-4 ${loading ? "animate-spin" : ""}`} />
          </Button>
          <span className="hidden lg:inline text-sm text-neutral-600 px-2">{user?.name}</span>
          <Button data-testid="orders-logout-btn" onClick={() => { clearAuth(); nav("/staff/login"); }} variant="outline" size="sm" className="pill h-9 sm:h-10 px-2.5 sm:px-4">
            <LogOut className="w-4 h-4 sm:mr-2" />
            <span className="hidden sm:inline">Logout</span>
          </Button>
        </div>
      </header>

      <main className="p-4 sm:p-6 max-w-6xl mx-auto">
        {/* Stat cards */}
        <div className="grid grid-cols-2 sm:grid-cols-5 gap-3 mb-5">
          {[
            { key: "received",  label: "Received",  count: stats.received  || 0 },
            { key: "preparing", label: "Preparing", count: stats.preparing || 0 },
            { key: "ready",     label: "Ready",     count: stats.ready     || 0 },
            { key: "served",    label: "Served",    count: stats.served    || 0 },
            { key: "revenue",   label: "Revenue",   count: fmt(stats.revenue) },
          ].map((s) => (
            <div key={s.key} className="bg-white rounded-2xl border border-black/5 p-4">
              <div className="text-xs uppercase tracking-widest font-bold text-neutral-500">{s.label}</div>
              <div className="font-display font-black text-2xl mt-2">{s.count}</div>
            </div>
          ))}
        </div>

        {/* Filters */}
        <div className="flex flex-col sm:flex-row sm:items-center gap-2 mb-4">
          <div className="relative flex-1">
            <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-neutral-400" />
            <Input
              data-testid="orders-search"
              value={q}
              onChange={(e) => setQ(e.target.value)}
              placeholder="Search by table, guest or item"
              className="pl-9 h-10 pill"
            />
          </div>
          <Select value={status} onValueChange={setStatus}>
            <SelectTrigger data-testid="orders-status-filter" className="w-full sm:w-52 pill h-10"><SelectValue /></SelectTrigger>
            <SelectContent>
              {STATUS_OPTIONS.map((o) => <SelectItem key={o.value} value={o.value}>{o.label}</SelectItem>)}
            </SelectContent>
          </Select>
        </div>

        {/* Orders list */}
        {list.length === 0 ? (
          <div className="bg-white rounded-2xl border border-black/5 p-12 text-center">
            <Receipt className="w-10 h-10 text-neutral-300 mx-auto" />
            <p className="font-display font-bold text-lg mt-3">No orders {status === "active" ? "in progress" : "found"}</p>
            <p className="text-sm text-neutral-500 mt-1">
              {q ? "Try a different search or filter." : "New orders will appear here in real time."}
            </p>
          </div>
        ) : (
          <div className="space-y-3">
            {list.map((o) => {
              const tint = STATUS_TINT[o.status] || STATUS_TINT.received;
              return (
                <article
                  key={o.id}
                  data-testid={`order-${o.id}`}
                  className={`bg-white rounded-2xl border border-black/5 border-l-4 ${tint.accent} p-4 sm:p-5`}
                >
                  <header className="flex items-start justify-between gap-3 mb-3">
                    <div>
                      <div className="flex items-center gap-2 flex-wrap">
                        <span className="text-[10px] uppercase tracking-[0.24em] font-bold text-neutral-500">Table</span>
                        <span className="font-display font-black text-xl leading-none">{o.table_label}</span>
                        <Badge className={`text-[10px] pill border ${tint.badge}`}>
                          <tint.Icon className="w-3 h-3 mr-1" /> {o.status}
                        </Badge>
                      </div>
                      <div className="text-xs text-neutral-500 mt-1">
                        {o.guest_name} · {minutesAgo(o.created_at)}m ago
                        {o.phone && <span> · {o.phone}</span>}
                      </div>
                    </div>
                    <div className="text-right">
                      <div className="font-display font-black text-lg font-mono">{fmt(o.subtotal)}</div>
                      <div className="text-xs text-neutral-500">{o.items.length} item{o.items.length === 1 ? "" : "s"}</div>
                    </div>
                  </header>

                  <ul className="divide-y divide-neutral-100">
                    {o.items.map((it, idx) => {
                      const it_tint = STATUS_TINT[it.status] || STATUS_TINT.received;
                      const canAdvance = it.status !== "served";
                      const nextStatus = it.status === "received" ? "preparing" : it.status === "preparing" ? "ready" : "served";
                      const nextLabel = it.status === "received" ? "Cook" : it.status === "preparing" ? "Ready" : "Served";
                      return (
                        <li key={`${it.item_id}-${idx}`} className="py-2 flex items-center gap-3">
                          <div className="flex-1 min-w-0">
                            <div className="font-semibold">
                              <span className="text-neutral-500 font-mono mr-1">{it.quantity}×</span>
                              {it.name_en}
                              {it.name_km && <span className="text-neutral-400 font-normal ml-1">· {it.name_km}</span>}
                            </div>
                            {it.note && <div className="text-xs text-amber-700 mt-0.5">✎ {it.note}</div>}
                          </div>
                          <Badge className={`text-[10px] pill border ${it_tint.badge}`}>{it.status}</Badge>
                          <div className="w-16 text-right font-mono text-sm text-neutral-700">{fmt(it.price * it.quantity)}</div>
                          {canAdvance && (
                            <Button
                              data-testid={`order-${o.id}-item-${idx}-advance`}
                              size="sm"
                              onClick={() => updateItem(o.id, idx, nextStatus)}
                              className="pill h-8 text-[11px] bg-neutral-900 hover:bg-neutral-800 text-white"
                            >
                              {nextLabel}
                            </Button>
                          )}
                        </li>
                      );
                    })}
                  </ul>
                </article>
              );
            })}
          </div>
        )}
      </main>
    </div>
  );
}
