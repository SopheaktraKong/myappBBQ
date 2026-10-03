import { useEffect, useMemo, useState, useCallback } from "react";
import { Link } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { api, API_BASE } from "@/lib/api";
import { useAppSocket } from "@/lib/useAppSocket";
import { useI18n } from "@/lib/i18n";
import { Flame, Languages, ArrowLeft } from "lucide-react";

function fmt(n) { return `$${n.toFixed(2)}`; }

export default function MenuPreview() {
  const { lang, setLang, t, nameOf, descOf } = useI18n();
  const [categories, setCategories] = useState([]);
  const [items, setItems] = useState([]);
  const [activeCat, setActiveCat] = useState("");

  const loadMenu = useCallback(async () => {
    const { data } = await api.get("/menu");
    setCategories(data.categories);
    setItems(data.items);
    if (data.categories[0]) setActiveCat((c) => c || data.categories[0].id);
  }, []);

  useEffect(() => { loadMenu(); }, [loadMenu]);

  // Live update when owner edits the menu
  useAppSocket((msg) => { if (msg.type === "menu_updated") loadMenu(); });

  const itemsByCat = useMemo(() => {
    const map = {};
    for (const it of items) (map[it.category_id] ||= []).push(it);
    return map;
  }, [items]);

  return (
    <div className={`bbq-bg min-h-screen pb-16 ${lang === "km" ? "font-khmer" : ""}`}>
      {/* Header */}
      <div className="sticky top-0 z-40 backdrop-blur-xl bg-white/80 border-b border-black/5">
        <div className="max-w-2xl mx-auto px-4 py-3 flex items-center justify-between">
          <Link to="/" data-testid="menu-preview-back-btn" className="pill px-3 py-2 border border-black/10 bg-white text-xs font-semibold flex items-center gap-1.5 tap">
            <ArrowLeft className="w-3.5 h-3.5" /> Home
          </Link>
          <div className="text-center">
            <div className="text-[10px] uppercase tracking-[0.2em] font-bold text-neutral-500">Preview</div>
            <div className="font-display font-black text-xl">Menu</div>
          </div>
          <button
            data-testid="menu-preview-lang-toggle"
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
              data-testid={`preview-cat-${c.id}`}
              onClick={() => {
                setActiveCat(c.id);
                document.getElementById(`preview-cat-sec-${c.id}`)?.scrollIntoView({ behavior: "smooth", block: "start" });
              }}
              className={`pill px-4 py-1.5 text-sm font-semibold whitespace-nowrap tap ${activeCat === c.id ? "bg-neutral-900 text-white" : "bg-white text-neutral-700 border border-black/10"}`}
            >
              {nameOf(c)}
            </button>
          ))}
        </div>
      </div>

      {/* Menu */}
      <div className="max-w-2xl mx-auto px-4 pt-4 space-y-8" data-testid="menu-preview-list">
        {categories.length === 0 && (
          <div className="bg-white rounded-2xl p-8 text-center border border-black/5">
            <p className="font-display text-lg font-bold">No menu items yet</p>
            <p className="text-sm text-neutral-600 mt-2">Add categories and items from Admin → Menu.</p>
            <Link to="/admin/menu">
              <Button data-testid="menu-preview-open-admin-btn" className="pill mt-4 bg-[color:var(--chili)] hover:bg-[color:var(--chili-hover)] text-white">
                Open Admin Menu
              </Button>
            </Link>
          </div>
        )}
        {categories.map((c) => (
          <section key={c.id} id={`preview-cat-sec-${c.id}`}>
            <h2 className="font-display font-black text-2xl mb-3 tracking-tight">{nameOf(c)}</h2>
            <div className="space-y-3">
              {(itemsByCat[c.id] || []).map((it) => (
                <article key={it.id} className="bg-white rounded-2xl overflow-hidden border border-black/5 shadow-[0_8px_30px_rgba(0,0,0,0.04)] flex">
                  {it.image_url ? (
                    <img
                      src={it.image_url.startsWith("/api") ? `${API_BASE}${it.image_url}` : it.image_url}
                      alt={it.name_en}
                      className="w-28 h-28 sm:w-32 sm:h-32 object-cover"
                    />
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
                      {!it.available && (
                        <span className="text-xs pill bg-neutral-100 text-neutral-500 px-3 py-1.5">{t("unavailable")}</span>
                      )}
                    </div>
                  </div>
                </article>
              ))}
            </div>
          </section>
        ))}
      </div>
    </div>
  );
}
