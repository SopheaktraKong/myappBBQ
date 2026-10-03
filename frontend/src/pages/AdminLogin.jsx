import { useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { api, setAuth, clearAuth } from "@/lib/api";
import { apiError } from "@/lib/apiError";
import { useNavigate, useLocation, useSearchParams } from "react-router-dom";
import { toast } from "sonner";
import { Flame, ShieldCheck, HandPlatter } from "lucide-react";

const MODES = [
  { key: "admin", label: "Admin", Icon: ShieldCheck, roles: ["owner"] },
  { key: "staff", label: "Staff", Icon: HandPlatter, roles: ["waiter", "kitchen"] },
];

export default function AdminLogin() {
  const [mode, setMode] = useState("admin");
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const nav = useNavigate();
  const loc = useLocation();
  const [params] = useSearchParams();
  const expired = params.get("expired") === "1";
  const fromQuery = params.get("from");
  const nextPath = loc.state?.from || fromQuery || null;

  useEffect(() => {
    if (expired) toast.info("Session expired — please sign in again");
  }, [expired]);

  const current = MODES.find((m) => m.key === mode);

  const submit = async (e) => {
    e.preventDefault();
    setLoading(true);
    try {
      const { data } = await api.post("/auth/login", { username, password });
      if (!current.roles.includes(data.user.role)) {
        clearAuth();
        toast.error(`This account is not a ${current.label.toLowerCase()} account.`);
        return;
      }
      setAuth(data.token, data.user);
      toast.success(`Welcome, ${data.user.name}`);
      if (nextPath) return nav(nextPath, { replace: true });
      if (data.user.role === "owner") nav("/", { replace: true });
      else if (data.user.role === "kitchen") nav("/kitchen", { replace: true });
      else nav("/waiter", { replace: true });
    } catch (err) {
      toast.error(apiError(err, "Login failed"));
    } finally {
      setLoading(false);
    }
  };

  const switchMode = (k) => {
    setMode(k);
    setUsername("");
    setPassword("");
  };

  return (
    <div className="min-h-screen bbq-bg flex items-center justify-center p-6">
      <div className="w-full max-w-sm">
        <div className="flex items-center gap-2 mb-8">
          <Flame className="w-6 h-6 text-[color:var(--chili)]" />
          <span className="font-display font-black text-xl tracking-tight">BBQ Nights</span>
        </div>

        <h1 className="font-display font-black text-4xl tracking-tight">Sign in</h1>

        <div className="mt-6 grid grid-cols-2 gap-1 p-1 bg-neutral-100 rounded-full">
          {MODES.map((m) => (
            <button
              key={m.key}
              type="button"
              data-testid={`mode-${m.key}-btn`}
              onClick={() => switchMode(m.key)}
              className={`pill h-10 flex items-center justify-center gap-2 text-sm font-semibold transition-colors ${
                mode === m.key ? "bg-white text-neutral-900 shadow-sm" : "text-neutral-500 hover:text-neutral-800"
              }`}
            >
              <m.Icon className="w-4 h-4" />
              {m.label}
            </button>
          ))}
        </div>

        <form onSubmit={submit} className="mt-6 space-y-4">
          <div className="space-y-1.5">
            <Label htmlFor="username" className="text-xs uppercase tracking-widest text-neutral-500">Username</Label>
            <Input
              id="username"
              data-testid="login-username-input"
              value={username}
              onChange={(e) => setUsername(e.target.value)}
              required
              autoComplete="username"
              className="h-11"
            />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="password" className="text-xs uppercase tracking-widest text-neutral-500">Password</Label>
            <Input
              id="password"
              data-testid="login-password-input"
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              required
              autoComplete="current-password"
              className="h-11"
            />
          </div>
          <Button
            data-testid="login-submit-btn"
            type="submit"
            disabled={loading}
            className="w-full pill bg-[color:var(--chili)] hover:bg-[color:var(--chili-hover)] text-white h-11 mt-2"
          >
            {loading ? "Signing in…" : `Sign in as ${current.label}`}
          </Button>
        </form>
      </div>
    </div>
  );
}
