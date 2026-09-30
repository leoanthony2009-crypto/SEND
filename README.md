# Bloom Learning Lab 05 — Adaptive Teaching for SEND, with **Ask POUI**

An interactive micro course (single-page Design Component, no build step) with an embedded AI pastoral assistant, **Ask POUI**, served by a Netlify Function that calls the OpenAI Responses API. No API key ever reaches the browser.

## Project structure
```
Adaptive Teaching SEND.dc.html      the course (mounts <dc-import name="PouiChat">)
PouiChat.dc.html                    Ask POUI: floating button, chat panel, role selector, message renderer
support.js                          component runtime
netlify/functions/poui-chat.mjs     POST /.netlify/functions/poui-chat → OpenAI → { reply, responseId, safeguarding }
netlify/functions/_shared/poui-instructions.mjs   POUI system instructions + per-session context block
netlify.toml · package.json · DEPLOY.md
```
The framework is one component per `.dc.html` file, so `PouiChat.dc.html` is the equivalent of `PouiChat` + `PouiRoleSelector` + `PouiMessage`: the role selector is its own template block, and message rendering is the `renderMessage()` function at the top of its logic.

## Netlify environment variables (required — set in Netlify → Site configuration → Environment variables)
| Variable | Purpose |
| --- | --- |
| `OPENAI_API_KEY` | Your OpenAI secret key. Server-side only. |
| `OPENAI_MODEL` | Model name, e.g. `gpt-4.1-mini`. |
| `POUI_VECTOR_STORE_ID` | Optional. May be empty at first. When set, POUI uses `file_search` over that Vector Store of approved PTK resources. |
| `OPENAI_MAX_OUTPUT_TOKENS` | Optional, default `900`. |

**Never** commit these values to source control. Locally, put them in a `.env` file that is git-ignored.

## Setup
1. `npm install`
2. Create an API key at platform.openai.com → API keys.
3. In Netlify add `OPENAI_API_KEY`.
4. Add `OPENAI_MODEL`.
5. (Later) create a Vector Store in the OpenAI dashboard, upload approved PTK resources, and add its id as `POUI_VECTOR_STORE_ID`. POUI works fully without it.
6. Push to Git → Netlify → Add new site → Import. Build command empty, publish directory `.`, functions `netlify/functions` (already in `netlify.toml`). Serve `Adaptive Teaching SEND.dc.html` at `/` (rename to `index.html` or add a redirect).
7. Test the function:
   ```
   curl -X POST https://YOUR-SITE.netlify.app/.netlify/functions/poui-chat \
     -H 'content-type: application/json' \
     -d '{"message":"A pupil walks out whenever writing starts.","role":"teacher","courseWeek":1,"module":"The Five-a-day","previousResponseId":null}'
   ```
   Expect `{"reply":"…","responseId":"resp_…","safeguarding":false}`. A `GET` returns 405; an empty message returns 400.
8. Verify no key in the browser: open DevTools → Sources and search the page and `PouiChat.dc.html` for `sk-`. Nothing should match; the browser only calls `/.netlify/functions/poui-chat`.
9. Test on a phone: under 880px the chat opens full-screen; role buttons are ≥52px tall; Send stays beside the input.
10. Test conversations: pick a role → send → follow-up (uses `previousResponseId`) → **New conversation** (asks to confirm if you have sent messages) → role picker again. Course progress is untouched (`localStorage` key `bloom-lab-05-v1`; chat uses `sessionStorage` key `poui-chat-v1`).

Local: `npx netlify dev` with `.env` populated. Without a backend the widget shows a calm error and **Try again**.

## Changing things later (no redesign needed)
- **POUI instructions** — edit `netlify/functions/_shared/poui-instructions.mjs` (`POUI_INSTRUCTIONS`, role/week context in `buildContext`). Redeploy.
- **Suggested prompts** — `POUI_SUGGESTIONS` at the top of `PouiChat.dc.html` (three per role).
- **Role options** — `POUI_ROLES` / `POUI_OTHER_ROLE` in `PouiChat.dc.html`, plus `POUI_WELCOME` for the welcome line. Keep role ids in `ROLES` in `poui-chat.mjs` in sync.
- **Privacy / scope messages** — `POUI_PRIVACY_NOTE`, `POUI_SCOPE_NOTE` in `PouiChat.dc.html`.
- **Course week / module** — the course passes `course-module` (current module title) and `course-week` to `<dc-import name="PouiChat">` and also stamps `data-poui-module` / `data-poui-week` on `<main>`. Set `POUI_WEEK` (top of the course logic) to `1`–`4` when the course runs inside the four-week PTK cycle; leave `null` and `null` is sent. Any page can override by declaring `data-poui-week="2" data-poui-module="…"` on an element.
- **Message length** — `POUI_MAX_MESSAGE` (frontend) and `MAX_MESSAGE` (function) are both 4000; change together.

## Safety behaviour
- Frontend: empty-message prevention, 4000-character limit with counter, Send disabled while waiting, 45 s timeout, friendly errors only.
- Function: POST only, JSON validation, role whitelist, week 1–4 or null, `previousResponseId` format check, one retry without a stale response id, generic error messages (no API errors, stack traces, env values or prompts returned).
- Safeguarding: when POUI’s reply begins `## Immediate safety comes first`, the function flags `safeguarding: true` and the chat shows that reply in a calm, bordered card with a shield icon and heading. The interface never diagnoses or contacts external services.
- Assistant replies are rendered by a Markdown-lite renderer (headings, bullets, numbered lists, bold). No model HTML is ever injected.
