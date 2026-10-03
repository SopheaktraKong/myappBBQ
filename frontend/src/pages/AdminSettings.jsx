import { useEffect, useState } from "react";
import { api } from "@/lib/api";
import { apiError } from "@/lib/apiError";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { toast } from "sonner";

export default function AdminSettings() {
  const [s, setS] = useState({ accept_cash: true, accept_khqr: true, tax_inclusive: true, restaurant_name: "BBQ Nights" });

  useEffect(() => {
    api.get("/settings").then((r) => setS((prev) => ({ ...prev, ...r.data })));
  }, []);

  const save = async () => {
    try {
      await api.put("/settings", { ...s, accept_payway: false });
      toast.success("Settings saved");
    } catch (e) { toast.error(apiError(e, "Failed")); }
  };

  return (
    <div className="p-4 sm:p-8 max-w-3xl">
      <p className="uppercase text-xs tracking-[0.24em] font-bold text-neutral-500">Preferences</p>
      <h1 className="font-display font-black text-3xl sm:text-4xl mb-5 sm:mb-6">Settings</h1>

      <div className="bg-white rounded-2xl p-6 border border-black/5 space-y-5">
        <div>
          <Label>Restaurant Name</Label>
          <Input data-testid="setting-name" value={s.restaurant_name} onChange={(e) => setS({ ...s, restaurant_name: e.target.value })} />
        </div>
        <div className="border-t border-neutral-100 pt-5">
          <h3 className="font-display font-bold text-lg mb-3">Payment methods</h3>
          <div className="space-y-3">
            <label className="flex items-center justify-between"><span>Accept Cash</span><Switch data-testid="setting-cash" checked={s.accept_cash} onCheckedChange={(v) => setS({ ...s, accept_cash: v })} /></label>
            <label className="flex items-center justify-between"><span>Accept KHQR (ABA)</span><Switch data-testid="setting-khqr" checked={s.accept_khqr} onCheckedChange={(v) => setS({ ...s, accept_khqr: v })} /></label>
          </div>
        </div>
        <Button data-testid="setting-save-btn" onClick={save} className="pill bg-[color:var(--chili)] hover:bg-[color:var(--chili-hover)] text-white">Save Settings</Button>
      </div>
    </div>
  );
}
