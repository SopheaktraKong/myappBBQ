import { useCallback, useEffect, useRef, useState } from "react";
import { api, getUser } from "@/lib/api";
import { apiError } from "@/lib/apiError";
import { useAppSocket } from "@/lib/useAppSocket";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import QRCode from "qrcode";
import { toast } from "sonner";
import { Plus, Trash2, Printer, QrCode as QrIcon, Eraser, Users } from "lucide-react";

function fmt(n) { return `$${(n || 0).toFixed(2)}`; }

export default function AdminTables() {
  const [tables, setTables] = useState([]);
  const [open, setOpen] = useState(false);
  const [form, setForm] = useState({ label: "", seats: 4 });
  const [qrOpen, setQrOpen] = useState(false);
  const [qrData, setQrData] = useState(null);
  const [clearing, setClearing] = useState(null);
  const canvasRef = useRef(null);
  const user = getUser();
  const canClear = user && (user.role === "owner" || user.role === "waiter");

  const load = useCallback(async () => {
    try {
      const { data } = await api.get("/tables");
      setTables(data);
    } catch (e) { toast.error(apiError(e, "Failed to load tables")); }
  }, []);
  useEffect(() => { load(); }, [load]);
  useAppSocket((msg) => {
    if (["new_order", "session_opened", "session_closed", "payment_created", "order_updated"].includes(msg.type)) load();
  });

  const save = async () => {
    try {
      await api.post("/tables", { label: form.label, seats: parseInt(form.seats) });
      toast.success("Table created");
      setOpen(false); setForm({ label: "", seats: 4 }); load();
    } catch (e) { toast.error(apiError(e, "Failed")); }
  };

  const del = async (id) => {
    if (!window.confirm("Delete table?")) return;
    try { await api.delete(`/tables/${id}`); toast.success("Deleted"); load(); }
    catch (e) { toast.error(apiError(e, "Failed")); }
  };

  const clearTable = async (t) => {
    if (!window.confirm(`Clear table ${t.label}? This closes the current bill without a payment.`)) return;
    setClearing(t.id);
    try {
      await api.post(`/tables/${t.id}/clear`);
      toast.success(`Table ${t.label} is now free`);
      load();
    } catch (e) { toast.error(apiError(e, "Failed to clear table")); }
    finally { setClearing(null); }
  };

  const showQR = async (t) => {
    const url = `${window.location.origin}/?table=${encodeURIComponent(t.label)}`;
    setQrData({ table: t, url });
    setQrOpen(true);
    setTimeout(async () => {
      const el = document.getElementById("qr-canvas");
      if (el) await QRCode.toCanvas(el, url, { width: 320, margin: 2, color: { dark: "#0A0A0A", light: "#FFFFFF" } });
    }, 50);
  };

  const printQR = () => window.print();

  return (
    <div className="p-4 sm:p-8 max-w-6xl">
      <div className="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-3 mb-5 sm:mb-6">
        <div>
          <p className="uppercase text-xs tracking-[0.24em] font-bold text-neutral-500">Floor Plan</p>
          <h1 className="font-display font-black text-3xl sm:text-4xl">Tables & QR</h1>
        </div>
        <Button data-testid="add-table-btn" onClick={() => setOpen(true)} className="pill bg-[color:var(--chili)] hover:bg-[color:var(--chili-hover)] text-white w-full sm:w-auto"><Plus className="w-4 h-4 mr-2" /> New Table</Button>
      </div>

      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-4">
        {tables.map((t) => {
          const occupied = !!t.session;
          return (
            <div key={t.id} className={`rounded-2xl p-3 sm:p-5 border ${occupied ? "bg-amber-50 border-amber-200" : "bg-white border-black/5"}`}>
              <div className="flex items-start justify-between">
                <div className="min-w-0">
                  <div className="text-[10px] uppercase tracking-widest text-neutral-500">Table</div>
                  <div className="font-display font-black text-2xl sm:text-3xl truncate">{t.label}</div>
                  <div className="text-xs text-neutral-500 mt-1">{t.seats} seats</div>
                </div>
                <Button data-testid={`table-delete-${t.label}`} size="icon" variant="ghost" className="h-8 w-8 shrink-0" onClick={() => del(t.id)}><Trash2 className="w-4 h-4 text-red-600" /></Button>
              </div>

              <div className="mt-3 text-xs">
                {occupied ? (
                  <div className="flex items-center gap-1.5 text-amber-700 font-semibold uppercase tracking-widest">
                    <Users className="w-3 h-3" />
                    <span>Occupied</span>
                    <span className="ml-auto font-mono text-neutral-700 normal-case tracking-normal">{fmt(t.total)}</span>
                  </div>
                ) : (
                  <div className="flex items-center gap-1.5">
                    <span className="w-1.5 h-1.5 rounded-full bg-emerald-500" />
                    <span className="text-emerald-700 font-semibold uppercase tracking-widest">Free</span>
                  </div>
                )}
              </div>

              <div className="flex flex-col sm:flex-row gap-2 mt-3">
                <Button data-testid={`table-qr-${t.label}`} onClick={() => showQR(t)} variant="outline" className="w-full sm:flex-1 pill h-9 text-xs px-2">
                  <QrIcon className="w-3.5 h-3.5 mr-1.5" /> QR
                </Button>
                {canClear && (
                  <Button
                    data-testid={`table-clear-${t.label}`}
                    onClick={() => clearTable(t)}
                    disabled={!occupied || clearing === t.id}
                    className="w-full sm:flex-1 pill h-9 text-xs px-2 bg-neutral-900 hover:bg-neutral-800 text-white disabled:opacity-40 disabled:cursor-not-allowed"
                    title={occupied ? "Close current bill without payment" : "Table already free"}
                  >
                    <Eraser className="w-3.5 h-3.5 mr-1.5" />
                    {clearing === t.id ? "Clearing…" : "Clear"}
                  </Button>
                )}
              </div>
            </div>
          );
        })}
      </div>

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent>
          <DialogHeader><DialogTitle>New Table</DialogTitle></DialogHeader>
          <div className="space-y-3">
            <div><Label>Label (e.g. T-01, A5)</Label><Input data-testid="table-label" value={form.label} onChange={(e) => setForm({ ...form, label: e.target.value })} /></div>
            <div><Label>Seats</Label><Input data-testid="table-seats" type="number" value={form.seats} onChange={(e) => setForm({ ...form, seats: e.target.value })} /></div>
            <Button data-testid="table-save-btn" onClick={save} className="w-full pill bg-[color:var(--chili)] hover:bg-[color:var(--chili-hover)] text-white">Create</Button>
          </div>
        </DialogContent>
      </Dialog>

      <Dialog open={qrOpen} onOpenChange={setQrOpen}>
        <DialogContent className="max-w-md print:shadow-none">
          <DialogHeader><DialogTitle>Table {qrData?.table.label} · Scan to Order</DialogTitle></DialogHeader>
          <div className="text-center space-y-3">
            <canvas id="qr-canvas" ref={canvasRef} className="mx-auto rounded-lg border border-black/10" />
            <div className="print:hidden">
              <Button data-testid="print-qr-btn" onClick={printQR} className="pill w-full bg-neutral-900 text-white"><Printer className="w-4 h-4 mr-2" />Print</Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
