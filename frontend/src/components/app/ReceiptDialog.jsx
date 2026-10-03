import { useRef } from "react";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent } from "@/components/ui/dialog";
import { Printer, Download, CheckCircle2 } from "lucide-react";
import jsPDF from "jspdf";

function fmt(n) { return `$${(Number(n) || 0).toFixed(2)}`; }
function fmtDate(iso) {
  if (!iso) return "";
  try {
    const d = new Date(iso);
    return d.toLocaleString("en-GB", { year: "numeric", month: "short", day: "2-digit", hour: "2-digit", minute: "2-digit" });
  } catch { return iso; }
}

export default function ReceiptDialog({ open, onOpenChange, receipt }) {
  const printRef = useRef(null);

  if (!receipt) return null;

  const handlePrint = () => {
    const node = printRef.current;
    if (!node) { window.print(); return; }
    const win = window.open("", "_blank", "width=380,height=640");
    if (!win) { window.print(); return; }
    win.document.write(`
      <html><head><title>Receipt ${receipt.receipt_id}</title>
      <style>
        * { box-sizing: border-box; font-family: 'Courier New', monospace; }
        body { margin: 0; padding: 12px; color: #000; font-size: 12px; }
        .center { text-align: center; }
        .row { display: flex; justify-content: space-between; gap: 8px; }
        .b { font-weight: 700; }
        .lg { font-size: 16px; }
        .xl { font-size: 20px; }
        hr { border: none; border-top: 1px dashed #000; margin: 8px 0; }
        .stamp { display: inline-block; border: 2px solid #10a86b; color: #10a86b; padding: 2px 10px; font-weight: 800; letter-spacing: 2px; transform: rotate(-6deg); }
        table { width: 100%; border-collapse: collapse; }
        td { padding: 2px 0; vertical-align: top; }
        .right { text-align: right; }
        @media print { body { padding: 0; } }
      </style></head><body>${node.innerHTML}</body></html>`);
    win.document.close();
    setTimeout(() => { win.focus(); win.print(); win.close(); }, 300);
  };

  const handleDownload = () => {
    const doc = new jsPDF({ unit: "mm", format: [80, 180 + receipt.items.length * 6] });
    const w = 80;
    let y = 8;
    doc.setFont("courier", "bold");
    doc.setFontSize(14);
    doc.text(receipt.restaurant_name, w / 2, y, { align: "center" }); y += 6;
    doc.setFont("courier", "normal");
    doc.setFontSize(9);
    doc.text("Receipt", w / 2, y, { align: "center" }); y += 4;
    doc.text(`#${receipt.receipt_id}`, w / 2, y, { align: "center" }); y += 5;
    doc.text(`Table: ${receipt.table_label}`, 4, y);
    doc.text(fmtDate(receipt.paid_at || receipt.created_at), w - 4, y, { align: "right" }); y += 4;
    if (receipt.guest_name) { doc.text(`Guest: ${receipt.guest_name}`, 4, y); y += 4; }
    doc.text("------------------------------", w / 2, y, { align: "center" }); y += 4;
    doc.setFont("courier", "bold");
    doc.text("Item", 4, y);
    doc.text("Total", w - 4, y, { align: "right" }); y += 4;
    doc.setFont("courier", "normal");
    doc.text("------------------------------", w / 2, y, { align: "center" }); y += 4;
    for (const it of receipt.items) {
      const name = (it.name_en || "").slice(0, 22);
      doc.text(`${it.quantity}x ${name}`, 4, y);
      doc.text(fmt(it.line_total), w - 4, y, { align: "right" }); y += 4;
      doc.setFontSize(8);
      doc.text(`   @ ${fmt(it.price)}`, 4, y); y += 4;
      doc.setFontSize(9);
    }
    doc.text("------------------------------", w / 2, y, { align: "center" }); y += 4;
    doc.setFont("courier", "bold");
    doc.setFontSize(11);
    doc.text("TOTAL", 4, y);
    doc.text(fmt(receipt.total), w - 4, y, { align: "right" }); y += 6;
    doc.setFont("courier", "normal");
    doc.setFontSize(9);
    doc.text(`Method: ${(receipt.method || "").toUpperCase()}`, 4, y); y += 4;
    doc.text(`Status: ${(receipt.status || "").toUpperCase()}`, 4, y); y += 6;
    doc.setFont("courier", "bold");
    doc.text("*** PAID ***", w / 2, y, { align: "center" }); y += 6;
    doc.setFont("courier", "normal");
    doc.setFontSize(8);
    doc.text("Thank you — see you again!", w / 2, y, { align: "center" });
    doc.save(`receipt-${receipt.receipt_id}.pdf`);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md p-0 overflow-hidden flex flex-col max-h-[90vh]" data-testid="receipt-dialog">
        {/* Header */}
        <div className="flex items-center gap-2 px-4 pt-4 pb-2 shrink-0">
          <div className="w-9 h-9 rounded-full bg-emerald-50 flex items-center justify-center">
            <CheckCircle2 className="w-5 h-5 text-emerald-600" />
          </div>
          <div>
            <div className="font-display font-black text-lg leading-none">Receipt</div>
            <div className="text-[11px] text-neutral-500 mt-0.5">#{receipt.receipt_id}</div>
          </div>
        </div>

        {/* Printable body (scrollable) */}
        <div ref={printRef} className="bg-white px-5 pt-2 pb-4 text-[13px] font-mono text-neutral-800 overflow-y-auto flex-1 min-h-0">
          <div className="center text-center">
            <div className="b font-bold text-lg">{receipt.restaurant_name}</div>
            <div className="text-neutral-500 text-xs mt-0.5">Receipt #{receipt.receipt_id}</div>
          </div>
          <hr className="my-3 border-dashed border-neutral-300" />
          <div className="flex justify-between text-xs">
            <span>Table <b>{receipt.table_label}</b></span>
            <span>{fmtDate(receipt.paid_at || receipt.created_at)}</span>
          </div>
          {receipt.guest_name && (
            <div className="text-xs mt-1">Guest: <b>{receipt.guest_name}</b></div>
          )}
          <hr className="my-3 border-dashed border-neutral-300" />
          <table className="w-full">
            <tbody>
              {receipt.items.map((it, idx) => (
                <tr key={idx} className="align-top">
                  <td className="py-1 pr-2">
                    <div className="font-semibold">{it.quantity}× {it.name_en}</div>
                    <div className="text-[11px] text-neutral-500">@ {fmt(it.price)}</div>
                    {it.note && <div className="text-[11px] text-amber-700">✎ {it.note}</div>}
                  </td>
                  <td className="py-1 text-right font-mono whitespace-nowrap">{fmt(it.line_total)}</td>
                </tr>
              ))}
            </tbody>
          </table>
          <hr className="my-3 border-dashed border-neutral-300" />
          <div className="flex justify-between">
            <span>Subtotal</span><span>{fmt(receipt.subtotal)}</span>
          </div>
          <div className="flex justify-between font-display font-black text-xl mt-2">
            <span>TOTAL</span><span>{fmt(receipt.total)}</span>
          </div>
          <div className="flex justify-between text-xs mt-2 text-neutral-600">
            <span>Method</span><span className="uppercase font-bold">{receipt.method}</span>
          </div>
          <div className="flex items-center justify-center mt-4">
            <span className="stamp inline-block border-2 border-emerald-600 text-emerald-700 px-3 py-0.5 font-black tracking-[0.3em]" style={{ transform: "rotate(-6deg)" }}>PAID</span>
          </div>
          <div className="center text-center text-xs text-neutral-500 mt-4">
            Thank you — see you again!
          </div>
        </div>

        {/* Actions */}
        <div className="px-4 pb-4 pt-2 grid grid-cols-2 gap-2 border-t border-neutral-100 shrink-0 bg-white">
          <Button data-testid="receipt-print-btn" onClick={handlePrint} className="pill bg-neutral-900 hover:bg-neutral-800 text-white h-11">
            <Printer className="w-4 h-4 mr-2" /> Print
          </Button>
          <Button data-testid="receipt-download-btn" onClick={handleDownload} variant="outline" className="pill h-11">
            <Download className="w-4 h-4 mr-2" /> Download PDF
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
