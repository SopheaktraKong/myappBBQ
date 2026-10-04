import { useEffect, useState, useCallback, useMemo } from "react";
import { api, API_BASE } from "@/lib/api";
import { apiError } from "@/lib/apiError";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Switch } from "@/components/ui/switch";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { toast } from "sonner";
import { Plus, Pencil, Trash2, ImagePlus } from "lucide-react";

export default function AdminMenu() {
  const [cats, setCats] = useState([]);
  const [items, setItems] = useState([]);
  const [catOpen, setCatOpen] = useState(false);
  const [itemOpen, setItemOpen] = useState(false);
  const [editItem, setEditItem] = useState(null);
  const [editCat, setEditCat] = useState(null);
  const [catForm, setCatForm] = useState({ name_en: "", name_km: "", sort_order: 0 });
  const [itemForm, setItemForm] = useState({ category_id: "", name_en: "", name_km: "", description_en: "", description_km: "", price: 0, image_url: "", available: true, popular: false });

  const load = useCallback(async () => {
    const { data } = await api.get("/menu");
    setCats(data.categories); setItems(data.items);
  }, []);
  useEffect(() => { load(); }, [load]);

  const itemsByCat = useMemo(() => {
    const map = {};
    for (const it of items) (map[it.category_id] ||= []).push(it);
    return map;
  }, [items]);

  const openNewCat = () => { setEditCat(null); setCatForm({ name_en: "", name_km: "", sort_order: cats.length }); setCatOpen(true); };
  const openEditCat = (c) => { setEditCat(c); setCatForm({ name_en: c.name_en, name_km: c.name_km || "", sort_order: c.sort_order || 0 }); setCatOpen(true); };
  const saveCat = async () => {
    try {
      if (editCat) await api.put(`/categories/${editCat.id}`, catForm);
      else await api.post("/categories", catForm);
      toast.success("Saved");
      setCatOpen(false); load();
    } catch (e) { toast.error(apiError(e, "Failed")); }
  };
  const delCat = async (id) => {
    if (!window.confirm("Delete category and all its items?")) return;
    try { await api.delete(`/categories/${id}`); toast.success("Deleted"); load(); }
    catch (e) { toast.error(apiError(e, "Failed")); }
  };

  const openNewItem = () => { setEditItem(null); setItemForm({ category_id: cats[0]?.id || "", name_en: "", name_km: "", description_en: "", description_km: "", price: 0, image_url: "", available: true, popular: false }); setItemOpen(true); };
  const openEditItem = (it) => { setEditItem(it); setItemForm({ ...it }); setItemOpen(true); };
  const saveItem = async () => {
    try {
      const body = { ...itemForm, price: parseFloat(itemForm.price) };
      if (editItem) await api.put(`/menu/items/${editItem.id}`, body);
      else await api.post("/menu/items", body);
      toast.success("Saved"); setItemOpen(false); load();
    } catch (e) { toast.error(apiError(e, "Failed")); }
  };
  const delItem = async (id) => {
    if (!window.confirm("Delete item?")) return;
    try { await api.delete(`/menu/items/${id}`); toast.success("Deleted"); load(); }
    catch (e) { toast.error(apiError(e, "Failed")); }
  };
  const toggleAvail = async (it) => {
    try {
      await api.patch(`/menu/items/${it.id}/availability?available=${!it.available}`);
      load();
    } catch (e) { toast.error(apiError(e, "Failed")); }
  };

  const uploadImage = async (e) => {
    const f = e.target.files?.[0];
    if (!f) return;
    const fd = new FormData(); fd.append("file", f);
    try {
      const { data } = await api.post("/upload/image", fd, { headers: { "Content-Type": "multipart/form-data" } });
      setItemForm((s) => ({ ...s, image_url: data.url }));
      toast.success("Image uploaded");
    } catch { toast.error("Upload failed"); }
  };

  return (
    <div className="p-4 sm:p-8 max-w-6xl">
      <div className="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-3 mb-5 sm:mb-6">
        <div>
          <p className="uppercase text-xs tracking-[0.24em] font-bold text-neutral-500">Menu</p>
          <h1 className="font-display font-black text-3xl sm:text-4xl">Categories & Items</h1>
        </div>
        <div className="flex gap-2">
          <Button data-testid="add-category-btn" variant="outline" onClick={openNewCat} className="pill flex-1 sm:flex-none"><Plus className="w-4 h-4 mr-2" /> Category</Button>
          <Button data-testid="add-item-btn" onClick={openNewItem} disabled={cats.length === 0} className="pill bg-[color:var(--chili)] hover:bg-[color:var(--chili-hover)] text-white flex-1 sm:flex-none"><Plus className="w-4 h-4 mr-2" /> Menu Item</Button>
        </div>
      </div>

      {cats.map((c) => (
        <section key={c.id} className="bg-white rounded-2xl p-5 border border-black/5 mb-4">
          <div className="flex items-center justify-between mb-3">
            <div>
              <h2 className="font-display font-bold text-xl">{c.name_en} {c.name_km && <span className="text-neutral-400 font-normal text-base">· {c.name_km}</span>}</h2>
            </div>
            <div className="flex gap-1">
              <Button data-testid={`cat-edit-${c.id}`} size="sm" variant="ghost" onClick={() => openEditCat(c)}><Pencil className="w-4 h-4" /></Button>
              <Button data-testid={`cat-delete-${c.id}`} size="sm" variant="ghost" onClick={() => delCat(c.id)}><Trash2 className="w-4 h-4 text-red-600" /></Button>
            </div>
          </div>
          <div className="divide-y divide-neutral-100">
            {(itemsByCat[c.id] || []).map((it) => (
              <div key={it.id} className="py-3 flex items-center gap-3">
                {it.image_url ? (
                  <img src={it.image_url.startsWith("/api") ? `${API_BASE}${it.image_url}` : it.image_url} alt="" className="w-14 h-14 rounded-lg object-cover" />
                ) : <div className="w-14 h-14 rounded-lg bg-neutral-100" />}
                <div className="flex-1 min-w-0">
                  <div className="font-semibold truncate">{it.name_en} {it.name_km && <span className="text-neutral-400">· {it.name_km}</span>}</div>
                  <div className="text-sm text-neutral-500 font-mono">${it.price.toFixed(2)}</div>
                </div>
                <div className="flex items-center gap-3">
                  <div className="flex items-center gap-2">
                    <span className="text-xs text-neutral-500">Available</span>
                    <Switch data-testid={`avail-${it.id}`} checked={it.available} onCheckedChange={() => toggleAvail(it)} />
                  </div>
                  <Button data-testid={`item-edit-${it.id}`} size="sm" variant="ghost" onClick={() => openEditItem(it)}><Pencil className="w-4 h-4" /></Button>
                  <Button data-testid={`item-delete-${it.id}`} size="sm" variant="ghost" onClick={() => delItem(it.id)}><Trash2 className="w-4 h-4 text-red-600" /></Button>
                </div>
              </div>
            ))}
            {(itemsByCat[c.id] || []).length === 0 && <p className="text-sm text-neutral-500 py-3">No items in this category.</p>}
          </div>
        </section>
      ))}
      {cats.length === 0 && (
        <div className="bg-white rounded-2xl p-12 text-center border border-black/5">
          <p className="font-display text-lg font-bold">Start with a category</p>
          <p className="text-sm text-neutral-600 mt-2">e.g. Skewers, Sides, Drinks</p>
          <Button className="mt-4 pill bg-[color:var(--chili)] hover:bg-[color:var(--chili-hover)] text-white" onClick={openNewCat}><Plus className="w-4 h-4 mr-2" />New category</Button>
        </div>
      )}

      <Dialog open={catOpen} onOpenChange={setCatOpen}>
        <DialogContent>
          <DialogHeader><DialogTitle>{editCat ? "Edit" : "New"} Category</DialogTitle></DialogHeader>
          <div className="space-y-3">
            <div><Label>Name (English)</Label><Input data-testid="cat-name-en" value={catForm.name_en} onChange={(e) => setCatForm({ ...catForm, name_en: e.target.value })} /></div>
            <div><Label>Name (Khmer)</Label><Input data-testid="cat-name-km" value={catForm.name_km} onChange={(e) => setCatForm({ ...catForm, name_km: e.target.value })} className="font-khmer" /></div>
            <div><Label>Sort Order</Label><Input type="number" value={catForm.sort_order} onChange={(e) => setCatForm({ ...catForm, sort_order: parseInt(e.target.value || "0") })} /></div>
            <Button data-testid="cat-save-btn" onClick={saveCat} className="w-full pill bg-[color:var(--chili)] hover:bg-[color:var(--chili-hover)] text-white">Save</Button>
          </div>
        </DialogContent>
      </Dialog>

      <Dialog open={itemOpen} onOpenChange={setItemOpen}>
        <DialogContent className="max-w-lg">
          <DialogHeader><DialogTitle>{editItem ? "Edit" : "New"} Menu Item</DialogTitle></DialogHeader>
          <div className="space-y-3 max-h-[70vh] overflow-y-auto">
            <div>
              <Label>Category</Label>
              <Select value={itemForm.category_id} onValueChange={(v) => setItemForm({ ...itemForm, category_id: v })}>
                <SelectTrigger data-testid="item-cat-select"><SelectValue placeholder="Choose category" /></SelectTrigger>
                <SelectContent>{cats.map((c) => <SelectItem key={c.id} value={c.id}>{c.name_en}</SelectItem>)}</SelectContent>
              </Select>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div><Label>Name (EN)</Label><Input data-testid="item-name-en" value={itemForm.name_en} onChange={(e) => setItemForm({ ...itemForm, name_en: e.target.value })} /></div>
              <div><Label>Name (KH)</Label><Input data-testid="item-name-km" value={itemForm.name_km} onChange={(e) => setItemForm({ ...itemForm, name_km: e.target.value })} className="font-khmer" /></div>
            </div>
            <div><Label>Description (EN)</Label><Textarea value={itemForm.description_en} onChange={(e) => setItemForm({ ...itemForm, description_en: e.target.value })} /></div>
            <div><Label>Description (KH)</Label><Textarea value={itemForm.description_km} onChange={(e) => setItemForm({ ...itemForm, description_km: e.target.value })} className="font-khmer" /></div>
            <div className="grid grid-cols-2 gap-3">
              <div><Label>Price (USD)</Label><Input data-testid="item-price" type="number" step="0.01" value={itemForm.price} onChange={(e) => setItemForm({ ...itemForm, price: e.target.value })} /></div>
              <div>
                <Label>Image</Label>
                <label className="pill h-10 px-4 border border-neutral-200 flex items-center gap-2 text-sm cursor-pointer hover:bg-neutral-50 w-fit">
                  <ImagePlus className="w-4 h-4" /> Upload
                  <input data-testid="item-image-upload" type="file" accept="image/*" className="hidden" onChange={uploadImage} />
                </label>
              </div>
            </div>
            {itemForm.image_url && (
              <img src={itemForm.image_url.startsWith("/api") ? `${API_BASE}${itemForm.image_url}` : itemForm.image_url} alt="" className="w-32 h-32 rounded-lg object-cover" />
            )}
            <div className="flex items-center gap-6">
              <label className="flex items-center gap-2"><Switch data-testid="item-available" checked={itemForm.available} onCheckedChange={(v) => setItemForm({ ...itemForm, available: v })} /> Available</label>
              <label className="flex items-center gap-2"><Switch data-testid="item-popular" checked={itemForm.popular} onCheckedChange={(v) => setItemForm({ ...itemForm, popular: v })} /> Popular</label>
            </div>
            <Button data-testid="item-save-btn" onClick={saveItem} className="w-full pill bg-[color:var(--chili)] hover:bg-[color:var(--chili-hover)] text-white">Save</Button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
