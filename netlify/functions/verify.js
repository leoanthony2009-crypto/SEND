import { getStore } from "@netlify/blobs";

export default async (req) => {
  const id = (new URL(req.url).searchParams.get("id") || "").trim().toUpperCase();
  if (!/^BLL0[25]-[A-Z2-9]{6}$/.test(id)) return Response.json({ found: false, reason: "malformed" }, { status: 404 });
  const rec = await getStore("credentials").get(id, { type: "json" });
  if (!rec) return Response.json({ found: false, reason: "unknown" }, { status: 404 });
  // Public view: never expose IP or free-text commitment
  const { ip, commitment, ...pub } = rec;
  return Response.json({ found: true, ...pub }, { headers: { "cache-control": "no-store" } });
};

export const config = { path: "/api/verify" };
