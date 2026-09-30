import { getStore } from "@netlify/blobs";

const ALPHABET = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789"; // no 0/O/1/I
const newId = () => "BLL05-" + Array.from(crypto.getRandomValues(new Uint8Array(6)), b => ALPHABET[b % ALPHABET.length]).join("");

export default async (req) => {
  if (req.method !== "POST") return new Response("Method not allowed", { status: 405 });
  let body; try { body = await req.json(); } catch { return Response.json({ error: "bad json" }, { status: 400 }); }
  const name = String(body.name || "").trim().slice(0, 120);
  if (name.length < 2) return Response.json({ error: "name required" }, { status: 400 });
  const store = getStore("credentials");
  let id; for (let i = 0; i < 5; i++) { id = newId(); if (!(await store.get(id))) break; }
  const record = {
    id, status: "valid", recipient: name,
    issuer: "Bloom Learning Labs", course: "Adaptive Teaching for SEND", courseCode: "BPLF-MC-SEND-05 v1.0",
    level: "Foundation", hours: 0.67, skills: ["Noticing barriers not labels", "EEF Five-a-day adaptive strategies", "Teacher–TA scaffolding partnership", "Assess–plan–do–review"],
    issueDate: String(body.date || "").slice(0, 40), issuedAt: new Date().toISOString(), expires: null,
    commitment: String(body.commitment || "").slice(0, 300), quizScore: Number(body.quizScore) || 0,
    ip: req.headers.get("x-nf-client-connection-ip") || null
  };
  await store.setJSON(id, record);
  return Response.json({ id, verifyUrl: new URL("/verify?id=" + id, req.url).toString() });
};

export const config = { path: "/api/issue" };
