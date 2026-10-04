import { useEffect, useMemo, useState, useCallback } from "react";
import { useSearchParams } from "react-router-dom";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetTrigger } from "@/components/ui/sheet";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { api, API_BASE } from "@/lib/api";
import { apiError } from "@/lib/apiError";
import { useAppSocket } from "@/lib/useAppSocket";
import { useI18n } from "@/lib/i18n";
import { Flame, Plus, Minus, ShoppingBag, Receipt, Languages, HandPlatter } from "lucide-react";

function fmt(n) { return `$${n.toFixed(2)}`; }

export default function CustomerMenu() {
  const [params] = useSearchParams();
  const tableParam = params.get("table") || "demo";
  const { lang, setLang, t, nameOf, descOf } = useI18n();

  const [categories, setCategories] = useState([]);
  const [items, setItems] = useState([]);
  const [table, setTable] = useState(null);
  const [session, setSession] = useState(null);
  const [orders, setOrders] = useState([]);
  const [totalBill, setTotalBill] = useState(0);
  const [byGuest, setByGuest] = useState({});
  const [activeCat, setActiveCat] = useState("");
  const [cart, setCart] = useState([]);
  const [guestName, setGuestName] = useState(() => localStorage.getItem("bbq_guest") || "");
  const [phone, setPhone] = useState("");
  const [cartOpen, setCartOpen] = useState(false);
  const [billOpen, setBillOpen] = useState(false);
  const [payment, setPayment] = useState(null);
  const [note, setNote] = useState({});
  const [settings, setSettings] = useState({ accept_cash: true, accept_khqr: true, accept_payway: true });

  const loadMenu = useCallback(async () => {
    const { data } = await api.get("/menu");
    setCategories(data.categories);
    setItems(data.items);
    if (data.categories[0]) setActiveCat((c) => c || data.categories[0].id);
  }, []);

  const loadBill = useCallback(async (sid) => {
    if (!sid) return;
    const { data } = await api.get(`/sessions/${sid}`);
    setOrders(data.orders);
    setTotalBill(data.total);
    setByGuest(data.by_guest);
  }, []);

  useEffect(() => {
    (async () => {
      const s = await api.get("/settings").then(r => r.data).catch(() => ({}));
      setSettings({ accept_cash: s.accept_cash ?? true, accept_khqr: s.accept_khqr ?? true, accept_payway: s.accept_payway ?? true });
      // Resolve table by label (customer QR includes label like "T-07")
      const tRes = await api.get("/tables").catch(() => ({ data: [] }));
      let match = tRes.data.find((x) => x.label === tableParam) || tRes.data.find((x) => x.id === tableParam);
      if (!match && tableParam === "demo" && tRes.data[0]) match = tRes.data[0];
      if (!match) {
        toast.error(`Table "${tableParam}" not found — ask staff to open your table.`);
        return;
      }
      if (!session?.id) return;

      const interval = setInterval(() => {
      loadBill(session.id);
    }, 3000);
      setTable(match);
      const sess = await api.post(`/sessions/open?table_id=${match.id}`).then((r) => r.data);
      setSession(sess);
      await loadMenu();
      await loadBill(sess.id);
    })();

    return () => clearInterval(interval);
  }, [tableParam, loadMenu, loadBill]);

  // WebSocket for live updates (menu availability + order status)
  useAppSocket((msg) => {
    if (!session?.id) return;
    if (msg.type === "menu_updated") loadMenu();
    if (msg.type === "order_updated" && msg.order?.session_id === session.id) loadBill(session.id);
    if (msg.type === "new_order" && msg.order?.session_id === session.id) loadBill(session.id);
    if (msg.type === "session_closed" && msg.session_id === session.id) {
      toast.success(t("paid"));
      setPayment(null);
      setBillOpen(false);
      loadBill(session.id);
    }
  });

  const itemsByCat = useMemo(() => {
    const map = {};
    for (const it of items) (map[it.category_id] ||= []).push(it);
    return map;
  }, [items]);

  const cartCount = cart.reduce((s, c) => s + c.quantity, 0);
  const cartSubtotal = cart.reduce((s, c) => s + c.price * c.quantity, 0);

  const addToCart = (it) => {
    setCart((prev) => {
      const found = prev.find((p) => p.item_id === it.id);
      if (found) return prev.map((p) => p.item_id === it.id ? { ...p, quantity: p.quantity + 1 } : p);
      return [...prev, { item_id: it.id, name_en: it.name_en, name_km: it.name_km, price: it.price, quantity: 1 }];
    });
    toast.success(`+ ${nameOf(it)}`);
  };
  const dec = (id) => setCart((prev) => prev.flatMap((p) => p.item_id === id ? (p.quantity > 1 ? [{ ...p, quantity: p.quantity - 1 }] : []) : [p]));
  const inc = (id) => setCart((prev) => prev.map((p) => p.item_id === id ? { ...p, quantity: p.quantity + 1 } : p));

  const submitOrder = async () => {
    if (!session) return;
    if (guestName) localStorage.setItem("bbq_guest", guestName);
    try {
      await api.post("/orders", {
        table_id: table.id,
        session_id: session.id,
        phone,
        guest_name: guestName || "Guest",
        items: cart.map((c) => ({ item_id: c.item_id, quantity: c.quantity, note: note[c.item_id] || "" })),
      });
      setCart([]);
      setNote({});
      setCartOpen(false);
      toast.success(t("orderPlaced"));
      loadBill(session.id);
    } catch (e) {
      toast.error(apiError(e, "Failed"));
    }
  };

  const callStaff = async () => {
    if (!session) return;
    await api.post(`/sessions/${session.id}/call-staff`);
    toast.success(t("staffCalled"));
  };
  const askBill = async () => {
    if (!session) return;
    await api.post(`/sessions/${session.id}/ask-bill`);
    toast.success(t("billRequested"));
    setBillOpen(true);
  };

  const startPay = async (method) => {
    const { data } = await api.post(`/sessions/${session.id}/pay?method=${method}`);
    setPayment(data);
  };

  const mockConfirm = async () => {
    if (!payment) return;
    await api.post(`/payments/${payment.id}/mock-confirm`);
    // WS will fire session_closed
  };

  if (!table) {
    return (
      <div className="min-h-screen bbq-bg flex items-center justify-center p-6">
        <div className="text-center">
          <Flame className="w-10 h-10 text-[color:var(--chili)] mx-auto" />
          <h2 className="font-display font-black text-2xl mt-4">Setting your table…</h2>
          <p className="text-neutral-600 mt-2 text-sm">If this stays here, ask staff to open your table.</p>
        </div>
      </div>
    );
  }

  return (
    <div className={`bbq-bg min-h-screen pb-32 ${lang === "km" ? "font-khmer" : ""}`}>
      {/* Header */}
      <div className="sticky top-0 z-40 backdrop-blur-xl bg-white/80 border-b border-black/5">
        <div className="max-w-2xl mx-auto px-4 py-3 flex items-center justify-between">
          <div>
            <div className="text-[10px] uppercase tracking-[0.2em] font-bold text-neutral-500">{t("table")}</div>
            <div className="font-display font-black text-xl">{table.label}</div>
          </div>
          <button
            data-testid="lang-toggle"
            onClick={() => setLang(lang === "en" ? "km" : "en")}
            className="pill px-3 py-2 border border-black/10 bg-white text-xs font-semibold flex items-center gap-1.5 tap"
          >
            <Languages className="w-3.5 h-3.5" />
            {lang === "en" ? "ខ្មែរ" : "EN"}
          </button>
        </div>
        {/* Category rail */}
        <div className="max-w-2xl mx-auto px-4 pb-3 flex gap-2 overflow-x-auto no-scrollbar">
          {categories.map((c) => (
            <button
              key={c.id}
              data-testid={`cat-${c.id}`}
              onClick={() => {
                setActiveCat(c.id);
                document.getElementById(`cat-sec-${c.id}`)?.scrollIntoView({ behavior: "smooth", block: "start" });
              }}
              className={`pill px-4 py-1.5 text-sm font-semibold whitespace-nowrap tap ${activeCat === c.id ? "bg-neutral-900 text-white" : "bg-white text-neutral-700 border border-black/10"}`}
            >
              {nameOf(c)}
            </button>
          ))}
        </div>
      </div>

      {/* Menu */}
      <div className="max-w-2xl mx-auto px-4 pt-4 pb-56 space-y-8">
        {categories.length === 0 && (
          <div className="bg-white rounded-2xl p-8 text-center border border-black/5">
            <p className="font-display text-lg font-bold">No menu items yet</p>
            <p className="text-sm text-neutral-600 mt-2">The owner will add items shortly.</p>
          </div>
        )}
        {categories.map((c) => (
          <section key={c.id} id={`cat-sec-${c.id}`}>
            <h2 className="font-display font-black text-2xl mb-3 tracking-tight">{nameOf(c)}</h2>
            <div className="space-y-3">
              {(itemsByCat[c.id] || []).map((it) => (
                <article key={it.id} className="bg-white rounded-2xl overflow-hidden border border-black/5 shadow-[0_8px_30px_rgba(0,0,0,0.04)] flex">
                  {it.image_url ? (
                    <img src={it.image_url.startsWith("/api") ? `${API_BASE}${it.image_url}` : it.image_url}
                         alt={it.name_en}
                         className="w-28 h-28 sm:w-32 sm:h-32 object-cover" />
                  ) : (
                    <div className="w-28 h-28 sm:w-32 sm:h-32 bg-gradient-to-br from-amber-50 to-orange-100 flex items-center justify-center">
                      <Flame className="w-8 h-8 text-[color:var(--chili)]/60" />
                    </div>
                  )}
                  <div className="p-3 flex-1 flex flex-col justify-between">
                    <div>
                      <div className="flex items-start justify-between gap-2">
                        <h3 className="font-display font-bold text-base leading-tight">{nameOf(it)}</h3>
                        {it.popular && <Badge className="bg-[color:var(--amber)] text-black hover:bg-[color:var(--amber)] text-[10px] pill">★ {t("popular")}</Badge>}
                      </div>
                      {descOf(it) && <p className="text-xs text-neutral-600 mt-1 line-clamp-2">{descOf(it)}</p>}
                    </div>
                    <div className="flex items-center justify-between mt-2">
                      <div className="font-display font-black">{fmt(it.price)}</div>
                      {it.available ? (
                        <Button
                          data-testid={`add-btn-${it.id}`}
                          size="sm"
                          onClick={() => addToCart(it)}
                          className="pill bg-[color:var(--chili)] hover:bg-[color:var(--chili-hover)] text-white h-9 px-4 tap"
                        >
                          <Plus className="w-4 h-4 mr-1" /> {t("addToCart")}
                        </Button>
                      ) : (
                        <span className="text-xs pill bg-neutral-100 text-neutral-500 px-3 py-1.5">{t("unavailable")}</span>
                      )}
                    </div>
                  </div>
                </article>
              ))}
            </div>
          </section>
        ))}

        {/* Live bill */}
        {orders.length > 0 && (
          <section className="bg-white rounded-2xl p-4 border border-black/5">
            <h3 className="font-display font-bold text-lg flex items-center gap-2"><Receipt className="w-4 h-4" /> {t("yourBill")}</h3>
            <div className="mt-3 space-y-2 text-sm">
              {orders.flatMap((o) => o.items.map((it, idx) => (
                <div key={`${o.id}-${idx}`} className="flex justify-between">
                  <div>
                    <span className="font-semibold">{it.quantity}×</span> {nameOf(it)}
                    <span className="ml-2 text-[10px] uppercase tracking-widest pill px-2 py-0.5 bg-neutral-100 text-neutral-600">{t(it.status)}</span>
                  </div>
                  <div className="font-mono">{fmt(it.price * it.quantity)}</div>
                </div>
              )))}
            </div>
            <div className="border-t border-neutral-100 mt-3 pt-3 flex justify-between font-display font-black text-lg">
              <span>{t("total")}</span><span>{fmt(totalBill)}</span>
            </div>
          </section>
        )}
      </div>

      {/* Floating actions: Call staff / Ask bill */}
      <div className="fixed z-40 bottom-24 right-4 flex flex-col gap-2">
        <button data-testid="call-staff-fab" onClick={callStaff} className="pill bg-white text-black px-4 py-3 shadow-[0_20px_40px_rgba(0,0,0,0.15)] border border-black/10 flex items-center gap-2 tap font-semibold text-sm">
          <HandPlatter className="w-4 h-4" /> {t("callStaff")}
        </button>
        <button data-testid="ask-bill-fab" onClick={askBill} className="pill bg-black text-white px-4 py-3 shadow-[0_20px_40px_rgba(0,0,0,0.2)] flex items-center gap-2 tap font-semibold text-sm">
          <Receipt className="w-4 h-4" /> {t("askBill")}
        </button>
      </div>

      {/* Sticky cart */}
      <div className="fixed bottom-0 left-0 right-0 z-30 sticky-cart">
        <div className="max-w-2xl mx-auto px-4 py-3">
          <Sheet open={cartOpen} onOpenChange={setCartOpen}>
            <SheetTrigger asChild>
              <button data-testid="open-cart-btn" className="w-full pill bg-[color:var(--chili)] hover:bg-[color:var(--chili-hover)] text-white h-14 px-5 flex items-center justify-between tap disabled:opacity-50" disabled={cart.length === 0}>
                <span className="flex items-center gap-2 font-display font-bold text-base">
                  <ShoppingBag className="w-5 h-5" />
                  {cartCount} · {t("cart")}
                </span>
                <span className="font-display font-black text-lg">{fmt(cartSubtotal)}</span>
              </button>
            </SheetTrigger>
            <SheetContent side="bottom" className="rounded-t-3xl max-h-[90vh] overflow-y-auto">
              <SheetHeader><SheetTitle className="font-display text-2xl">{t("cart")}</SheetTitle></SheetHeader>
              <div className="space-y-4 mt-4">
                {cart.length === 0 && <p className="text-center text-neutral-500">{t("empty")}</p>}
                {cart.map((c) => (
                  <div key={c.item_id} className="flex items-start gap-3 border-b border-neutral-100 pb-3">
                    <div className="flex-1">
                      <div className="font-display font-bold">{lang === "km" && c.name_km ? c.name_km : c.name_en}</div>
                      <div className="text-sm text-neutral-600 font-mono">{fmt(c.price)}</div>
                      <Textarea
                        data-testid={`note-${c.item_id}`}
                        value={note[c.item_id] || ""}
                        onChange={(e) => setNote({ ...note, [c.item_id]: e.target.value })}
                        placeholder={t("note")}
                        className="mt-2 text-sm h-16"
                      />
                    </div>
                    <div className="flex items-center gap-2">
                      <Button size="icon" variant="outline" data-testid={`dec-${c.item_id}`} onClick={() => dec(c.item_id)} className="pill h-9 w-9"><Minus className="w-4 h-4" /></Button>
                      <span className="font-display font-black w-6 text-center">{c.quantity}</span>
                      <Button size="icon" variant="outline" data-testid={`inc-${c.item_id}`} onClick={() => inc(c.item_id)} className="pill h-9 w-9"><Plus className="w-4 h-4" /></Button>
                    </div>
                  </div>
                ))}
                <div className="grid grid-cols-2 gap-2">
                  <Input data-testid="guest-name-input" value={guestName} onChange={(e) => setGuestName(e.target.value)} placeholder={t("yourName")} />
                  <Input data-testid="guest-phone-input" value={phone} onChange={(e) => setPhone(e.target.value)} placeholder={t("phone")} />
                </div>
                <Button
                  data-testid="submit-order-btn"
                  disabled={cart.length === 0}
                  onClick={submitOrder}
                  className="w-full pill bg-[color:var(--chili)] hover:bg-[color:var(--chili-hover)] text-white h-12 text-base font-display font-bold"
                >
                  {t("submitOrder")} — {fmt(cartSubtotal)}
                </Button>
              </div>
            </SheetContent>
          </Sheet>
        </div>
      </div>

      {/* Bill / Pay Dialog */}
      <Dialog open={billOpen} onOpenChange={(v) => { setBillOpen(v); if (!v) setPayment(null); }}>
        <DialogContent className="max-w-md">
          <DialogHeader><DialogTitle className="font-display text-2xl">{t("yourBill")}</DialogTitle></DialogHeader>
          {!payment ? (
            <div className="space-y-3">
              {Object.keys(byGuest).length > 0 && (
                <div>
                  <div className="text-xs uppercase tracking-widest font-bold text-neutral-500 mb-1">{t("perGuest")}</div>
                  <div className="space-y-1 text-sm">
                    {Object.entries(byGuest).map(([g, v]) => (
                      <div key={g} className="flex justify-between"><span>{g}</span><span className="font-mono">{fmt(v)}</span></div>
                    ))}
                  </div>
                </div>
              )}
              <div className="flex justify-between font-display font-black text-2xl border-t border-neutral-100 pt-3">
                <span>{t("total")}</span><span>{fmt(totalBill)}</span>
              </div>
              <div className="grid grid-cols-2 gap-2 pt-2">
                {settings.accept_khqr && <Button data-testid="pay-khqr-btn" onClick={() => startPay("khqr")} className="pill h-12 bg-neutral-900 text-white hover:bg-neutral-800">{t("khqr")}</Button>}
                {settings.accept_cash && <Button data-testid="pay-cash-btn" onClick={() => startPay("cash")} variant="outline" className="pill h-12">{t("cash")}</Button>}
              </div>
            </div>
          ) : payment.method === "khqr" ? (
            <div className="text-center space-y-3">
              <p className="font-display font-bold">{t("scanToPay")} · {fmt(payment.amount)}</p>
              <div className="rounded-xl overflow-hidden border border-black/10 bg-white max-w-xs mx-auto">
                <img
                  src={`${API_BASE}${payment.qr_url}`}
                  alt="ABA KHQR"
                  className="w-full h-auto block"
                />
              </div>
              {(payment.owner_name || payment.usd_account || payment.khr_account) && (
                <div className="text-xs text-neutral-600 space-y-0.5">
                  {payment.owner_name && <div className="font-semibold text-neutral-800">{payment.owner_name}</div>}
                  {payment.usd_account && <div>USD · <span className="font-mono">{payment.usd_account}</span></div>}
                  {payment.khr_account && <div>KHR · <span className="font-mono">{payment.khr_account}</span></div>}
                </div>
              )}
              <p className="text-xs text-neutral-500 font-mono break-all">{payment.bill_number}</p>
              <Button data-testid="mock-paid-btn" onClick={mockConfirm} className="pill bg-[color:var(--amber)] text-black hover:bg-amber-500 w-full">
                I&apos;ve paid
              </Button>
            </div>
          ) : (
            <div className="text-center space-y-3">
              <p className="font-display font-bold">{t("cash")} · {fmt(payment.amount)}</p>
              <p className="text-sm text-neutral-600">{t("waitingCash")}</p>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}
