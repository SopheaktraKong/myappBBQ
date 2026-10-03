import axios from "axios";

export const API_BASE = process.env.REACT_APP_BACKEND_URL;
export const API = `${API_BASE}/api`;

export const api = axios.create({ baseURL: API });

api.interceptors.request.use((config) => {
  const token = localStorage.getItem("bbq_token");
  if (token) config.headers.Authorization = `Bearer ${token}`;
  return config;
});

// Global 401 handler — expired/invalid token → force re-login instead of bubbling
// unhandled axios errors up as "Uncaught runtime errors" in the dev overlay.
let redirecting = false;
api.interceptors.response.use(
  (r) => r,
  (err) => {
    const status = err?.response?.status;
    const url = err?.config?.url || "";
    // Auth endpoints handle 401 themselves (bad login attempt) — skip.
    const isAuthCall = url.includes("/auth/login") || url.includes("/auth/register");
    if (status === 401 && !isAuthCall) {
      if (!redirecting) {
        redirecting = true;
        try { localStorage.removeItem("bbq_token"); localStorage.removeItem("bbq_user"); } catch { /* noop */ }
        const from = window.location.pathname + window.location.search;
        if (!window.location.pathname.startsWith("/staff/login") && !window.location.pathname.startsWith("/menu")) {
          window.location.replace(`/staff/login?expired=1&from=${encodeURIComponent(from)}`);
        }
      }
      // Return a pending promise so callers never see the 401 and no unhandled
      // rejection surfaces in the CRA runtime-error overlay — the redirect
      // will unmount everything anyway.
      return new Promise(() => {});
    }
    return Promise.reject(err);
  }
);

export function setAuth(token, user) {
  localStorage.setItem("bbq_token", token);
  localStorage.setItem("bbq_user", JSON.stringify(user));
  redirecting = false;
}
export function clearAuth() {
  localStorage.removeItem("bbq_token");
  localStorage.removeItem("bbq_user");
}
export function getUser() {
  try { return JSON.parse(localStorage.getItem("bbq_user") || "null"); } catch { return null; }
}
export function getToken() { return localStorage.getItem("bbq_token"); }

export function wsUrl() {
  const base = API_BASE.replace(/^http/, "ws");
  return `${base}/api/ws`;
}
