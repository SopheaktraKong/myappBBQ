import { useCallback, useEffect, useState } from "react";
import { api, getUser, setAuth, getToken } from "@/lib/api";
import { apiError } from "@/lib/apiError";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { toast } from "sonner";
import { Plus, Trash2, Pencil, UserCircle, Search, ShieldCheck, ChefHat, HandPlatter } from "lucide-react";

const roleIcons = { owner: ShieldCheck, waiter: HandPlatter, kitchen: ChefHat };
const roleTint = {
  owner: "bg-red-50 text-[color:var(--chili)] border-red-100",
  waiter: "bg-amber-50 text-amber-700 border-amber-100",
  kitchen: "bg-emerald-50 text-emerald-700 border-emerald-100",
};

const emptyCreate = { username: "", email: "", name: "", password: "", role: "waiter" };

export function StaffManager({ compact = false }) {
  const me = getUser();
  const [staff, setStaff] = useState([]);
  const [q, setQ] = useState("");

  // Add dialog
  const [addOpen, setAddOpen] = useState(false);
  const [addForm, setAddForm] = useState(emptyCreate);
  const [saving, setSaving] = useState(false);

  // Edit dialog
  const [editOpen, setEditOpen] = useState(false);
  const [editTarget, setEditTarget] = useState(null);
  const [editForm, setEditForm] = useState({ username: "", email: "", name: "", password: "", role: "waiter" });
  const [updating, setUpdating] = useState(false);

  const load = useCallback(async () => {
    try {
      const { data } = await api.get("/auth/staff");
      setStaff(data);
    } catch (e) { toast.error(apiError(e, "Failed to load staff")); }
  }, []);
  useEffect(() => { load(); }, [load]);

  const create = async () => {
    if (!addForm.username || !addForm.password || !addForm.name) {
      toast.error("Name, username and password are required");
      return;
    }
    setSaving(true);
    try {
      const payload = { ...addForm, email: addForm.email?.trim() || undefined };
      await api.post("/auth/register", payload);
      toast.success(`Added ${addForm.name}`);
      setAddOpen(false); setAddForm(emptyCreate); load();
    } catch (e) { toast.error(apiError(e, "Failed")); }
    finally { setSaving(false); }
  };

  const openEdit = (s) => {
    setEditTarget(s);
    setEditForm({
      username: s.username || "",
      email: s.email || "",
      name: s.name || "",
      password: "",
      role: s.role || "waiter",
    });
    setEditOpen(true);
  };

  const saveEdit = async () => {
    if (!editTarget) return;
    if (!editForm.username || !editForm.name) {
      toast.error("Name and username are required");
      return;
    }
    setUpdating(true);
    try {
      const body = {
        username: editForm.username,
        email: editForm.email?.trim() || undefined,
        name: editForm.name,
        role: editForm.role,
      };
      if (editForm.password) body.password = editForm.password;
      const { data } = await api.patch(`/auth/staff/${editTarget.id}`, body);
      toast.success(`Updated ${editForm.name}`);
      // If we edited ourselves, refresh the cached user so header + menus reflect it
      if (editTarget.id === me?.id && data && data.id) {
        setAuth(getToken(), { id: data.id, username: data.username, email: data.email, role: data.role, name: data.name });
      }
      setEditOpen(false); setEditTarget(null); load();
    } catch (e) { toast.error(apiError(e, "Failed")); }
    finally { setUpdating(false); }
  };

  const del = async (s) => {
    if (!window.confirm(`Remove ${s.name}? They will no longer be able to sign in.`)) return;
    try {
      await api.delete(`/auth/staff/${s.id}`); toast.success("Removed"); load();
    } catch (e) { toast.error(apiError(e, "Failed")); }
  };

  const list = staff.filter((s) => {
    if (!q) return true;
    const needle = q.toLowerCase();
    return (
      (s.name || "").toLowerCase().includes(needle) ||
      (s.username || "").toLowerCase().includes(needle) ||
      (s.role || "").toLowerCase().includes(needle)
    );
  });

  const stats = staff.reduce(
    (acc, s) => { acc[s.role] = (acc[s.role] || 0) + 1; acc.total += 1; return acc; },
    { total: 0, owner: 0, waiter: 0, kitchen: 0 }
  );

  return (
    <div className={compact ? "" : ""}>
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 mb-4">
        <div>
          <p className="uppercase text-xs tracking-[0.24em] font-bold text-neutral-500">Team</p>
          <h2 className="font-display font-black text-2xl sm:text-3xl">Manage Staff</h2>
        </div>
        <div className="flex items-center gap-2 w-full sm:w-auto">
          <div className="relative flex-1 sm:flex-none">
            <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-neutral-400" />
            <Input
              data-testid="staff-search"
              value={q}
              onChange={(e) => setQ(e.target.value)}
              placeholder="Search by name, username, role"
              className="pl-9 h-10 pill w-full sm:w-64"
            />
          </div>
          <Button data-testid="add-staff-btn" onClick={() => setAddOpen(true)} className="pill bg-[color:var(--chili)] hover:bg-[color:var(--chili-hover)] text-white h-10">
            <Plus className="w-4 h-4 mr-2" /> Add Staff
          </Button>
        </div>
      </div>

      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mb-4">
        <StatCard label="Total" value={stats.total} tint="bg-neutral-100 text-neutral-800" />
        <StatCard label="Owners" value={stats.owner || 0} tint="bg-red-50 text-[color:var(--chili)]" />
        <StatCard label="Waiters" value={stats.waiter || 0} tint="bg-amber-50 text-amber-700" />
        <StatCard label="Kitchen" value={stats.kitchen || 0} tint="bg-emerald-50 text-emerald-700" />
      </div>

      <div className="bg-white rounded-2xl border border-black/5 divide-y divide-neutral-100 overflow-hidden">
        {list.length === 0 && (
          <div className="p-8 text-center text-sm text-neutral-500">
            {q ? "No matches" : "No staff yet — add your first team member."}
          </div>
        )}
        {list.map((s) => {
          const Icon = roleIcons[s.role] || UserCircle;
          return (
            <div key={s.id} className="p-4 flex items-center gap-3">
              <div className={`w-10 h-10 rounded-full flex items-center justify-center border ${roleTint[s.role] || "bg-neutral-50 text-neutral-500 border-neutral-100"}`}>
                <Icon className="w-4 h-4" />
              </div>
              <div className="flex-1 min-w-0">
                <div className="font-semibold flex items-center gap-2 flex-wrap">
                  {s.name}
                  <span className={`text-[10px] uppercase tracking-widest pill px-2 py-0.5 border ${roleTint[s.role] || "bg-neutral-100 text-neutral-700 border-neutral-200"}`}>{s.role}</span>
                  {s.id === me?.id && <span className="text-[10px] uppercase tracking-widest text-[color:var(--chili)]">You</span>}
                </div>
                <div className="text-sm text-neutral-500 truncate">
                  <span className="font-mono">{s.username || "—"}</span>
                  {s.email && <span className="text-neutral-400"> · {s.email}</span>}
                </div>
              </div>
              <div className="flex items-center gap-1">
                <Button
                  data-testid={`staff-edit-${s.username || s.id}`}
                  size="icon"
                  variant="ghost"
                  onClick={() => openEdit(s)}
                  title="Edit staff"
                >
                  <Pencil className="w-4 h-4 text-neutral-600" />
                </Button>
                {s.id !== me?.id && (
                  <Button
                    data-testid={`staff-delete-${s.username || s.email}`}
                    size="icon"
                    variant="ghost"
                    onClick={() => del(s)}
                    title="Remove staff"
                  >
                    <Trash2 className="w-4 h-4 text-red-600" />
                  </Button>
                )}
              </div>
            </div>
          );
        })}
      </div>

      {/* Add dialog */}
      <Dialog open={addOpen} onOpenChange={setAddOpen}>
        <DialogContent>
          <DialogHeader><DialogTitle className="font-display text-2xl">Add Staff</DialogTitle></DialogHeader>
          <div className="space-y-3">
            <div>
              <Label>Full Name</Label>
              <Input data-testid="staff-name" value={addForm.name} onChange={(e) => setAddForm({ ...addForm, name: e.target.value })} placeholder="Sopha Sok" />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <Label>Username</Label>
                <Input data-testid="staff-username" value={addForm.username} onChange={(e) => setAddForm({ ...addForm, username: e.target.value })} placeholder="sopha" autoComplete="off" />
              </div>
              <div>
                <Label>Password</Label>
                <Input data-testid="staff-password" type="password" value={addForm.password} onChange={(e) => setAddForm({ ...addForm, password: e.target.value })} autoComplete="new-password" />
              </div>
            </div>
            <div>
              <Label>Email (optional)</Label>
              <Input data-testid="staff-email" type="email" value={addForm.email} onChange={(e) => setAddForm({ ...addForm, email: e.target.value })} placeholder="sopha@bbq.example" />
            </div>
            <div>
              <Label>Role</Label>
              <Select value={addForm.role} onValueChange={(v) => setAddForm({ ...addForm, role: v })}>
                <SelectTrigger data-testid="staff-role"><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="waiter">Waiter</SelectItem>
                  <SelectItem value="kitchen">Kitchen</SelectItem>
                  <SelectItem value="owner">Owner (full admin)</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <Button data-testid="staff-save-btn" disabled={saving} onClick={create} className="w-full pill bg-[color:var(--chili)] hover:bg-[color:var(--chili-hover)] text-white h-11 mt-1">
              {saving ? "Adding…" : "Add staff account"}
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      {/* Edit dialog */}
      <Dialog open={editOpen} onOpenChange={(v) => { setEditOpen(v); if (!v) setEditTarget(null); }}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle className="font-display text-2xl">
              Edit {editTarget?.name || "Staff"}
            </DialogTitle>
          </DialogHeader>
          <div className="space-y-3">
            <div>
              <Label>Full Name</Label>
              <Input data-testid="edit-staff-name" value={editForm.name} onChange={(e) => setEditForm({ ...editForm, name: e.target.value })} />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <Label>Username</Label>
                <Input data-testid="edit-staff-username" value={editForm.username} onChange={(e) => setEditForm({ ...editForm, username: e.target.value })} autoComplete="off" />
              </div>
              <div>
                <Label>New Password <span className="text-neutral-400 font-normal">· leave blank to keep</span></Label>
                <Input data-testid="edit-staff-password" type="password" value={editForm.password} onChange={(e) => setEditForm({ ...editForm, password: e.target.value })} placeholder="••••••" autoComplete="new-password" />
              </div>
            </div>
            <div>
              <Label>Email (optional)</Label>
              <Input data-testid="edit-staff-email" type="email" value={editForm.email} onChange={(e) => setEditForm({ ...editForm, email: e.target.value })} />
            </div>
            <div>
              <Label>Role</Label>
              <Select
                value={editForm.role}
                onValueChange={(v) => setEditForm({ ...editForm, role: v })}
                disabled={editTarget?.id === me?.id}
              >
                <SelectTrigger data-testid="edit-staff-role"><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="waiter">Waiter</SelectItem>
                  <SelectItem value="kitchen">Kitchen</SelectItem>
                  <SelectItem value="owner">Owner (full admin)</SelectItem>
                </SelectContent>
              </Select>
              {editTarget?.id === me?.id && (
                <p className="text-xs text-neutral-500 mt-1">You cannot change your own role.</p>
              )}
            </div>
            <Button data-testid="edit-staff-save-btn" disabled={updating} onClick={saveEdit} className="w-full pill bg-[color:var(--chili)] hover:bg-[color:var(--chili-hover)] text-white h-11 mt-1">
              {updating ? "Saving…" : "Save changes"}
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}

function StatCard({ label, value, tint }) {
  return (
    <div className="bg-white rounded-2xl border border-black/5 p-4">
      <div className={`text-xs uppercase tracking-widest font-bold inline-block px-2 py-0.5 rounded-full ${tint}`}>{label}</div>
      <div className="font-display font-black text-2xl mt-2">{value}</div>
    </div>
  );
}
