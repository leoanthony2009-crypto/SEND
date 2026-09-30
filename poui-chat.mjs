// POST /.netlify/functions/poui-chat  →  { reply, responseId }
// Secrets live only in Netlify environment variables: OPENAI_API_KEY (required), OPENAI_MODEL (required),
// POUI_VECTOR_STORE_ID (optional, may be empty — enables file_search over approved PTK resources).
import OpenAI from 'openai';
import { POUI_INSTRUCTIONS, buildContext } from './_shared/poui-instructions.mjs';

const ROLES = new Set(['teacher', 'principal', 'pastoral_champion', 'parent_carer', 'support_staff']);
const MAX_MESSAGE = 4000;
const SAFE_RE = /^\s*(?:#{1,4}\s*|\*\*)?\s*immediate safety comes first/im;
const JSON_HEADERS = { 'content-type': 'application/json; charset=utf-8', 'cache-control': 'no-store' };

const json = (status, body) => new Response(JSON.stringify(body), { status, headers: JSON_HEADERS });

function validate(body) {
  if (!body || typeof body !== 'object') return { error: 'Invalid request body.' };
  const message = typeof body.message === 'string' ? body.message.trim() : '';
  if (!message) return { error: 'Please enter a message.' };
  if (message.length > MAX_MESSAGE) return { error: `Message is too long (max ${MAX_MESSAGE} characters).` };
  const role = ROLES.has(body.role) ? body.role : 'support_staff';
  const w = Number(body.courseWeek);
  const courseWeek = Number.isInteger(w) && w >= 1 && w <= 4 ? w : null;
  const module = typeof body.module === 'string' && body.module.trim() ? body.module.trim().slice(0, 120) : null;
  const previousResponseId = typeof body.previousResponseId === 'string' && /^[A-Za-z0-9_-]{6,128}$/.test(body.previousResponseId) ? body.previousResponseId : null;
  return { value: { message, role, courseWeek, module, previousResponseId } };
}

export default async (request) => {
  if (request.method === 'OPTIONS') return new Response(null, { status: 204, headers: { allow: 'POST, OPTIONS' } });
  if (request.method !== 'POST') return json(405, { error: 'Method not allowed.' });

  const apiKey = process.env.OPENAI_API_KEY;
  const model = process.env.OPENAI_MODEL;
  if (!apiKey || !model) {
    console.error('poui-chat: OPENAI_API_KEY or OPENAI_MODEL is not configured');
    return json(503, { error: 'POUI is not configured yet. Please contact the course administrator.' });
  }

  let body;
  try { body = await request.json(); } catch { return json(400, { error: 'Request body must be JSON.' }); }
  const { error, value } = validate(body);
  if (error) return json(400, { error });

  const openai = new OpenAI({ apiKey });
  const params = {
    model,
    instructions: `${POUI_INSTRUCTIONS}\n\n${buildContext(value)}`,
    input: value.message,
    max_output_tokens: Number(process.env.OPENAI_MAX_OUTPUT_TOKENS) || 900,
    store: true,
  };
  if (value.previousResponseId) params.previous_response_id = value.previousResponseId;
  // Optional PTK knowledge base: an OpenAI Vector Store of approved resources.
  const vectorStoreId = (process.env.POUI_VECTOR_STORE_ID || '').trim();
  if (vectorStoreId) params.tools = [{ type: 'file_search', vector_store_ids: [vectorStoreId], max_num_results: 6 }];

  try {
    const response = await openai.responses.create(params);
    const reply = (response.output_text || '').trim();
    if (!reply) throw new Error('empty output_text');
    return json(200, { reply, responseId: response.id, safeguarding: SAFE_RE.test(reply) });
  } catch (err) {
    // A stale/unknown previous_response_id (e.g. expired or from another environment) — retry once without it.
    const status = err && (err.status || err.statusCode);
    if (value.previousResponseId && (status === 400 || status === 404)) {
      try {
        delete params.previous_response_id;
        const response = await openai.responses.create(params);
        const reply = (response.output_text || '').trim();
        if (reply) return json(200, { reply, responseId: response.id, safeguarding: SAFE_RE.test(reply), conversationRestarted: true });
      } catch (err2) { console.error('poui-chat retry failed:', err2 && err2.message); }
    }
    console.error('poui-chat error:', status, err && err.message);
    if (status === 429) return json(429, { error: 'POUI is busy right now. Please try again in a moment.' });
    return json(502, { error: 'POUI could not respond just now. Please try again.' });
  }
};

export const config = { path: '/.netlify/functions/poui-chat' };
