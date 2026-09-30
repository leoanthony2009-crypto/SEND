# Deploying Bloom Learning Lab 05 to Netlify

## Files
- `Adaptive Teaching SEND.dc.html` — the course (served at `/`; rename/copy to `index.html` or add a redirect)
- `PouiChat.dc.html` — Ask POUI widget (mounted by the course). Full setup and change guide: `README.md`
- `support.js`
- `netlify/functions/poui-chat.mjs` — POST `/.netlify/functions/poui-chat` → OpenAI Responses API → `{ reply, responseId }`
- `netlify/functions/_shared/poui-instructions.mjs` — POUI system instructions + per-session context builder
- `netlify/functions/issue.js`, `verify.js`, `revoke.js` — credential functions from Lab 02 (copy from that repo; add course code `BPLF-MC-SEND-05` / ID prefix `BLL05`)
- `netlify.toml`, `package.json`

## Environment variables (Netlify → Site → Environment variables)
- `OPENAI_API_KEY` — required. Never placed in frontend code.
- `OPENAI_MODEL` — required, e.g. `gpt-4.1-mini`.
- `OPENAI_MAX_OUTPUT_TOKENS` — optional, default 900.
- `POUI_VECTOR_STORE_ID` — optional, may be empty. When set, POUI uses `file_search` over that Vector Store (approved PTK resources).
- `ADMIN_KEY` — only for revoking credentials.

## Ask POUI — how it works
- Floating **Ask POUI** button (bottom-right) opens a chat panel (full-screen under 880px).
- New conversation → role picker (teacher / principal / pastoral champion / parent-carer / other-support staff) → chat.
- Each send POSTs `{ message, role, courseWeek, module, previousResponseId }`. The function re-sends the POUI instructions plus a context block, continues the thread with `previous_response_id`, and returns `{ reply, responseId }`. The browser stores `responseId` for the next turn.
- Chat state (role, responseId, messages) lives in `sessionStorage` under `poui-chat-v1`; it never touches course progress (`localStorage` `bloom-lab-05-v1`). **New conversation** clears it.
- Assistant replies render through a safe Markdown-lite renderer (headings, bullets, numbered lists, bold). No HTML from the model is ever injected.

## Course context for POUI
`<main>` carries `data-poui-module` (current module title) and `data-poui-week`. The week comes from the `POUI_WEEK` constant at the top of the logic script — set it to `1`–`4` when this course runs inside the four-week PTK practice cycle; leave `null` otherwise (sent as `null`, never invented). Any element with `data-poui-week` / `data-poui-module` overrides these.

## Local test
`npm i` then `netlify dev` with the env vars in `.env` (not committed). Without a backend the widget shows a calm error state and a **Try again** button.
