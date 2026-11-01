export const enc = encodeURIComponent;
export const SEV = ["Critical", "High", "Medium", "Low"];
export const SEV_COLOR = { Critical: "#fb7185", High: "#f59e0b", Medium: "#a78bfa", Low: "#34d399" };
export const sevRank = (f) => { const i = SEV.indexOf(f.severity); return i < 0 ? 2 : i; };
export const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

export async function api(path, opts) {
  const r = await fetch(path, opts);
  let j = {};
  try { j = await r.json(); } catch { /* empty body */ }
  if (!r.ok) throw new Error(typeof j.detail === "string" ? j.detail : `Request failed (${r.status})`);
  return j;
}
export const post = (path, body) =>
  api(path, { method: "POST", headers: { "Content-Type": "application/json" }, body: body ? JSON.stringify(body) : undefined });
