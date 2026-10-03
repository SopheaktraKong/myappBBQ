/**
 * Safely extract a human-readable string from any axios error, including
 * FastAPI/Pydantic 422 validation errors where `detail` is an array of
 * { type, loc, msg, input, ctx } objects — which would otherwise crash
 * React with "Objects are not valid as a React child".
 */
export function apiError(e, fallback = "Something went wrong") {
  const d = e?.response?.data?.detail;
  if (typeof d === "string") return d;
  if (Array.isArray(d)) {
    return d
      .map((it) => {
        if (typeof it === "string") return it;
        const field = Array.isArray(it?.loc) ? it.loc.filter((p) => p !== "body").join(".") : "";
        const msg = it?.msg || it?.type || "invalid input";
        return field ? `${field}: ${msg}` : msg;
      })
      .filter(Boolean)
      .join("; ");
  }
  if (d && typeof d === "object") {
    try { return JSON.stringify(d); } catch { return fallback; }
  }
  return e?.message || fallback;
}
