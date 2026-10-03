import { useCallback, useEffect, useState } from "react";
import { api, API_BASE, clearAuth, getUser } from "@/lib/api";
import { apiError } from "@/lib/apiError";
import { useAppSocket } from "@/lib/useAppSocket";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import ReceiptDialog from "@/components/app/ReceiptDialog";
import { toast } from "sonner";
import { Link, useNavigate } from "react-router-dom";
import { LogOut, Bell, Users, Receipt, DollarSign, Eraser, ClipboardList, CheckCircle2 } from "lucide-react";

function fmt(n) { return `$${(n || 0).toFixed(2)}`; }

export default function WaiterView() {
  const [tables, setTables] = useState([]);
  const [openTable, setOpenTable] = useState(null);
  const [sessionData, setSessionData] = useState(null);
  const [payments, setPayments] = useState([]);
  const [khqrPayment, setKhqrPayment] = useState(null);
  const [receipt, setReceipt] = useState(null);
  const [receiptOpen, setReceiptOpen] = useState(false);
  const nav = useNavigate();
  const user = getUser();

  const load = useCallback(async () => {
    const { data } = await api.get("/tables");
    setTables(data);
  }, []);

  useEffect(() => { load(); }, [load]);
  useAppSocket((msg) => {
    if (["new_order","order_updated","call_staff","ask_bill","session_opened","session_closed","payment_created"].includes(msg.type)) load();
    if (msg.type === "call_staff") toast.info(`Call staff · ${msg.session?.table_label}`);
    if (msg.type === "ask_bill") toast.info(`Bill requested · ${msg.session?.table_label}`);
  });

  const openDetails = async (table) => {
    setOpenTable(table);
    if (table.session) {
      const { data } = await api.get(`/sessions/${table.session.id}`);
      setSessionData(data);
      // Fetch payments for this session
      // The list_payments API is minimal; we filter server-side is not needed for MVP
    } else {
      setSessionData(null);
    }
  };

  const clearAttention = async (sid) => {
    await api.post(`/sessions/${sid}/clear-attention`);
    load();
    if (openTable) openDetails(openTable);
  };

  const showReceipt = async (paymentId) => {
    try {
      const { data } = await api.get(`/receipts/${paymentId}`);
      setReceipt(data);
      setReceiptOpen(true);
    } catch (e) { toast.error(apiError(e, "Failed to load receipt")); }
  };

  const confirmCash = async (paymentId) => {
    await api.post(`/payments/${paymentId}/confirm-cash`);
    toast.success("Cash confirmed");
    load();
    setOpenTable(null);
    showReceipt(paymentId);
  };

  const createPayment = async (sid, method) => {
    const { data } = await api.post(`/sessions/${sid}/pay?method=${method}`);
    if (method === "cash") {
      await confirmCash(data.id);
    } else {
      // KHQR: show QR for customer to scan, wait for staff to click "Done payment"
      setKhqrPayment(data);
    }
  };

  const confirmKhqr = async () => {
    if (!khqrPayment) return;
    const pid = khqrPayment.id;
    try {
      await api.post(`/payments/${pid}/mock-confirm`);
      toast.success("Payment completed");
      setKhqrPayment(null);
      load();
      setOpenTable(null);
      showReceipt(pid);
    } catch (e) { toast.error(apiError(e, "Failed to confirm payment")); }
  };

  const clearTable = async (t) => {
    if (!t?.session?.id) return;
    if (!window.confirm(`Clear table ${t.label}? This closes the current bill without a payment.`)) return;
    try {
      await api.post(`/sessions/${t.session.id}/clear`);
      toast.success(`Table ${t.label} is now free`);
      load(); setOpenTable(null);
    } catch (e) { toast.error(apiError(e, "Failed to clear table")); }
  };

  return (
    <div className="min-h-screen bg-[color:var(--bg-admin)]">
      <header className="bg-white border-b border-black/5 px-4 sm:px-6 py-3 sm:py-4 flex items-center justify-between gap-2">
        <div className="min-w-0">
          <div className="text-[10px] sm:text-xs uppercase tracking-[0.24em] font-bold text-neutral-500">Waiter</div>
          <h1 className="font-display font-black text-xl sm:text-2xl truncate">Table Map</h1>
        </div>
        <div className="flex items-center gap-1.5 sm:gap-3">
          <Link to="/orders" data-testid="waiter-orders-link">
            <Button variant="outline" size="sm" className="pill sm:h-10 h-9 px-2.5 sm:px-4">
              <ClipboardList className="w-4 h-4 sm:mr-2" />
              <span className="hidden sm:inline">Orders</span>
            </Button>
          </Link>
          <span className="hidden md:inline text-sm text-neutral-600">{user?.name}</span>
          <Button data-testid="waiter-logout-btn" onClick={() => { clearAuth(); nav("/staff/login"); }} variant="outline" size="sm" className="pill sm:h-10 h-9 px-2.5 sm:px-4">
            <LogOut className="w-4 h-4 sm:mr-2" />
            <span className="hidden sm:inline">Logout</span>
          </Button>
        </div>
      </header>
      <main className="p-4 sm:p-6 max-w-6xl mx-auto">
        {tables.length === 0 && (
          <div className="bg-white rounded-2xl p-12 text-center border border-black/5">
            <p className="font-display text-lg font-bold">No tables yet</p>
            <p className="text-sm text-neutral-600 mt-2">Ask the owner to create tables.</p>
          </div>
        )}
        <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-4">
          {tables.map((t) => {
            const occupied = !!t.session;
            const attention = t.needs_staff;
            return (
              <button
                key={t.id}
                data-testid={`waiter-table-${t.label}`}
                onClick={() => openDetails(t)}
                className={`rounded-2xl p-4 text-left border transition-transform hover:-translate-y-0.5 ${attention ? "bg-red-50 border-red-300" : occupied ? "bg-amber-50 border-amber-200" : "bg-white border-black/5"}`}
              >
                <div className="flex items-start justify-between">
                  <div>
                    <div className="text-[10px] uppercase tracking-widest text-neutral-500">Table</div>
                    <div className="font-display font-black text-2xl">{t.label}</div>
                  </div>
                  {attention ? <Bell className="w-5 h-5 text-red-600 animate-pulse" /> :
                    occupied ? <Users className="w-5 h-5 text-amber-600" /> :
                    <div className="w-2 h-2 rounded-full bg-emerald-500 mt-1" />}
                </div>
                <div className="mt-3 text-sm">
                  {occupied ? (
                    <>
                      <div className="text-neutral-600">{t.order_count} order{t.order_count === 1 ? "" : "s"}</div>
                      <div className="font-display font-bold text-lg mt-1">{fmt(t.total)}</div>
                      {attention && <div className="text-xs text-red-700 font-bold mt-1 uppercase tracking-wider">Needs attention</div>}
                    </>
                  ) : (
                    <div className="text-emerald-700 font-semibold text-xs uppercase tracking-widest">Free</div>
                  )}
                </div>
              </button>
            );
          })}
        </div>
      </main>

      <Dialog open={!!openTable} onOpenChange={(v) => !v && setOpenTable(null)}>
        <DialogContent className="max-w-lg">
          <DialogHeader><DialogTitle className="font-display text-2xl">Table {openTable?.label}</DialogTitle></DialogHeader>
          {openTable && (
            openTable.session && sessionData ? (
              <div className="space-y-3">
                {openTable.needs_staff && (
                  <div className="bg-red-50 border border-red-200 rounded-lg p-3 flex items-center justify-between">
                    <div className="text-sm font-semibold text-red-800 flex items-center gap-2"><Bell className="w-4 h-4" /> Guest needs attention</div>
                    <Button data-testid="clear-attention-btn" size="sm" onClick={() => clearAttention(openTable.session.id)} variant="outline" className="pill">Clear</Button>
                  </div>
                )}
                <div className="max-h-64 overflow-y-auto space-y-2 text-sm">
                  {sessionData.orders.flatMap((o) => o.items.map((it, idx) => (
                    <div key={`${o.id}-${idx}`} className="flex justify-between border-b border-neutral-100 pb-1">
                      <span>{it.quantity}× {it.name_en} <span className="text-[10px] uppercase text-neutral-500 ml-1">{it.status}</span></span>
                      <span className="font-mono">{fmt(it.price * it.quantity)}</span>
                    </div>
                  )))}
                </div>
                <div className="flex justify-between font-display font-black text-xl border-t pt-2">
                  <span>Total</span><span>{fmt(sessionData.total)}</span>
                </div>
                <div className="grid grid-cols-2 gap-2 pt-2">
                  <Button data-testid="waiter-close-cash" onClick={() => createPayment(openTable.session.id, "cash")} className="pill bg-emerald-600 hover:bg-emerald-500 text-white h-11"><DollarSign className="w-4 h-4 mr-1" /> Cash</Button>
                  <Button data-testid="waiter-close-khqr" onClick={() => createPayment(openTable.session.id, "khqr")} className="pill bg-neutral-900 text-white h-11">KHQR</Button>
                </div>
                <Button
                  data-testid="waiter-clear-table"
                  variant="outline"
                  onClick={() => clearTable(openTable)}
                  className="pill w-full h-10 border-neutral-300 text-neutral-700 hover:bg-neutral-100"
                >
                  <Eraser className="w-4 h-4 mr-2" /> Clear table (no payment)
                </Button>
              </div>
            ) : (
              <p className="text-neutral-600 text-sm">Table is free.</p>
            )
          )}
        </DialogContent>
      </Dialog>

      {/* KHQR scan dialog */}
      <Dialog open={!!khqrPayment} onOpenChange={(v) => !v && setKhqrPayment(null)}>
        <DialogContent className="max-w-md" data-testid="waiter-khqr-dialog">
          <DialogHeader><DialogTitle className="font-display text-2xl">Scan to pay · {fmt(khqrPayment?.amount)}</DialogTitle></DialogHeader>
          {khqrPayment && (
            <div className="space-y-3">
              <div className="rounded-xl overflow-hidden border border-black/10 bg-white">
                <img
                  src={`${API_BASE}${khqrPayment.qr_url}`}
                  alt="ABA KHQR"
                  className="w-full h-auto block"
                  data-testid="waiter-khqr-image"
                />
              </div>
              {(khqrPayment.owner_name || khqrPayment.usd_account || khqrPayment.khr_account) && (
                <div className="text-xs text-neutral-600 space-y-0.5 text-center">
                  {khqrPayment.owner_name && <div className="font-semibold text-neutral-800">{khqrPayment.owner_name}</div>}
                  {khqrPayment.usd_account && <div>USD · <span className="font-mono">{khqrPayment.usd_account}</span></div>}
                  {khqrPayment.khr_account && <div>KHR · <span className="font-mono">{khqrPayment.khr_account}</span></div>}
                </div>
              )}
              <Button
                data-testid="waiter-khqr-done-btn"
                onClick={confirmKhqr}
                className="w-full pill h-12 bg-emerald-600 hover:bg-emerald-500 text-white font-display font-bold"
              >
                <CheckCircle2 className="w-5 h-5 mr-2" /> Done payment
              </Button>
            </div>
          )}
        </DialogContent>
      </Dialog>

      <ReceiptDialog open={receiptOpen} onOpenChange={setReceiptOpen} receipt={receipt} />
    </div>
  );
}
