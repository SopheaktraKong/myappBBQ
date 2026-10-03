import { useCallback, useEffect, useState } from "react";
import { api, getUser } from "@/lib/api";
import { apiError } from "@/lib/apiError";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Receipt as ReceiptIcon, Search, Eye, Trash2 } from "lucide-react";
import ReceiptDialog from "@/components/app/ReceiptDialog";

function fmt(n) { return `$${(Number(n) || 0).toFixed(2)}`; }
function fmtDate(iso) {
  if (!iso) return "—";
  try {
    const d = new Date(iso);
    return d.toLocaleString("en-GB", { year: "numeric", month: "short", day: "2-digit", hour: "2-digit", minute: "2-digit" });
  } catch { return iso; }
}

export default function AdminReceipts() {
  const [rows, setRows] = useState([]);
  const [q, setQ] = useState("");
  const [loading, setLoading] = useState(false);
  const [open, setOpen] = useState(false);
  const [receipt, setReceipt] = useState(null);
  const [deleting, setDeleting] = useState(null);
  const isOwner = getUser()?.role === "owner";

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const { data } = await api.get("/receipts");
      setRows(data);
    } catch (e) { toast.error(apiError(e, "Failed to load receipts")); }
    finally { setLoading(false); }
  }, []);

  useEffect(() => { load(); }, [load]);

  const openReceipt = async (pid) => {
    try {
      const { data } = await api.get(`/receipts/${pid}`);
      setReceipt(data);
      setOpen(true);
    } catch (e) { toast.error(apiError(e, "Failed to open receipt")); }
  };

  const deleteReceipt = async (r) => {
    if (!window.confirm(`Delete receipt #${r.receipt_id} for Table ${r.table_label}? This cannot be undone.`)) return;
    setDeleting(r.payment_id);
    try {
      await api.delete(`/receipts/${r.payment_id}`);
      toast.success("Receipt deleted");
      setRows((prev) => prev.filter((x) => x.payment_id !== r.payment_id));
    } catch (e) { toast.error(apiError(e, "Failed to delete")); }
    finally { setDeleting(null); }
  };

  const filtered = rows.filter((r) => {
    if (!q) return true;
    const n = q.toLowerCase();
    return (
      (r.receipt_id || "").toLowerCase().includes(n) ||
      (r.table_label || "").toLowerCase().includes(n) ||
      (r.method || "").toLowerCase().includes(n)
    );
  });

  const total = filtered.reduce((s, r) => s + (r.amount || 0), 0);

  return (
    <div className="p-4 sm:p-8 max-w-5xl">
      <div className="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-3 mb-5 sm:mb-6">
        <div>
          <p className="uppercase text-xs tracking-[0.24em] font-bold text-neutral-500">History</p>
          <h1 className="font-display font-black text-3xl sm:text-4xl">Receipts</h1>
        </div>
        <div className="relative w-full sm:w-72">
          <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-neutral-400" />
          <Input
            data-testid="receipts-search"
            value={q}
            onChange={(e) => setQ(e.target.value)}
            placeholder="Search by ID, table, method"
            className="pl-9 h-10 pill"
          />
        </div>
      </div>

      <div className="grid grid-cols-3 gap-2 sm:gap-3 mb-4">
        <div className="bg-white rounded-2xl p-3 sm:p-4 border border-black/5">
          <div className="text-[10px] sm:text-xs uppercase tracking-widest font-bold text-neutral-500">Receipts</div>
          <div className="font-display font-black text-xl sm:text-2xl mt-1 sm:mt-2">{filtered.length}</div>
        </div>
        <div className="bg-white rounded-2xl p-3 sm:p-4 border border-black/5">
          <div className="text-[10px] sm:text-xs uppercase tracking-widest font-bold text-neutral-500">Total paid</div>
          <div className="font-display font-black text-xl sm:text-2xl mt-1 sm:mt-2">{fmt(total)}</div>
        </div>
        <div className="bg-white rounded-2xl p-3 sm:p-4 border border-black/5">
          <div className="text-[10px] sm:text-xs uppercase tracking-widest font-bold text-neutral-500">Latest</div>
          <div className="font-display font-black text-xs sm:text-sm mt-1 sm:mt-2">{filtered[0] ? fmtDate(filtered[0].paid_at) : "—"}</div>
        </div>
      </div>

      <div className="bg-white rounded-2xl border border-black/5 overflow-hidden">
        {loading && <div className="p-6 text-sm text-neutral-500">Loading…</div>}
        {!loading && filtered.length === 0 && (
          <div className="p-10 text-center text-sm text-neutral-500">
            <ReceiptIcon className="w-10 h-10 mx-auto text-neutral-300" />
            <p className="mt-2">No paid receipts yet.</p>
          </div>
        )}
        {!loading && filtered.length > 0 && (
          <div className="divide-y divide-neutral-100">
            {filtered.map((r) => (
              <div key={r.payment_id} className="p-3 sm:p-4 flex items-center gap-3 sm:gap-4" data-testid={`receipt-row-${r.payment_id}`}>
                <div className="w-9 h-9 sm:w-10 sm:h-10 rounded-full bg-emerald-50 text-emerald-700 flex items-center justify-center shrink-0">
                  <ReceiptIcon className="w-4 h-4" />
                </div>
                <div className="flex-1 min-w-0">
                  <div className="font-semibold text-sm sm:text-base truncate">#{r.receipt_id}<span className="text-neutral-400 font-normal"> · T{r.table_label}</span></div>
                  <div className="text-[11px] sm:text-xs text-neutral-500 mt-0.5 flex items-center gap-2">
                    <span>{fmtDate(r.paid_at)}</span>
                    <span className="uppercase font-bold tracking-widest sm:hidden">· {r.method}</span>
                  </div>
                </div>
                <div className="hidden sm:block text-xs uppercase font-bold tracking-widest text-neutral-500 w-16 text-right">{r.method}</div>
                <div className="font-display font-black text-base sm:text-lg w-20 sm:w-24 text-right font-mono">{fmt(r.amount)}</div>
                <Button
                  data-testid={`receipt-view-${r.payment_id}`}
                  size="sm"
                  variant="outline"
                  onClick={() => openReceipt(r.payment_id)}
                  className="pill h-9 px-2 sm:px-3"
                >
                  <Eye className="w-3.5 h-3.5 sm:mr-1.5" />
                  <span className="hidden sm:inline">View</span>
                </Button>
                {isOwner && (
                  <Button
                    data-testid={`receipt-delete-${r.payment_id}`}
                    size="sm"
                    variant="ghost"
                    onClick={() => deleteReceipt(r)}
                    disabled={deleting === r.payment_id}
                    title="Delete receipt"
                    className="pill text-red-600 hover:bg-red-50 hover:text-red-700 disabled:opacity-40 h-9 w-9 p-0"
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                  </Button>
                )}
              </div>
            ))}
          </div>
        )}
      </div>

      <ReceiptDialog open={open} onOpenChange={setOpen} receipt={receipt} />
    </div>
  );
}
