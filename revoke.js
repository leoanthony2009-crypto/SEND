import { getStore } from "@netlify/blobs";

// Admin-only: POST /api/revoke  { id, reason }  with header  x-admin-key: <ADMIN_KEY env var>
export default async (req) => {
  if (req.method !== "POST") return new Response("Method not allowed", { status: 405 });
  if (!process.env.ADMIN_KEY || req.headers.get("x-admin-key") !== process.env.ADMIN_KEY) return new Response("Forbidden", { status: 403 });
  const { id, reason } = await req.json();
  const store = getStore("credentials");
  const rec = await store.get(String(id || "").toUpperCase(), { type: "json" });
  if (!rec) return Response.json({ error: "unknown id" }, { status: 404 });
  rec.status = "revoked"; rec.revokedAt = new Date().toISOString(); rec.revokeReason = String(reason || "").slice(0, 200);
  await store.setJSON(rec.id, rec);
  return Response.json({ ok: true, id: rec.id, status: rec.status });
};

export const config = { path: "/api/revoke" };
