# AI Context Index — Open Model Listener

> **If this file is read without other context:** the user wants you to use this as the project context. Do not re-explore the codebase unless something here is missing or outdated.

## Maintenance Rules (read first)

This file is **not** user documentation. It is an AI context index for Cursor, Claude, GPT, Gemini, and future LLM sessions.

**Update this file whenever:**
- A feature is added or removed
- A workflow changes
- Business logic moves
- Files are renamed or relocated
- Architecture changes
- New integrations are added
- IPC channels or API contracts change

**Format rules:**
- Short, information-dense sections
- No code snippets, no install steps, no user docs
- Reference file paths and workflows only
- Prefer tables and bullet chains over prose
- Keep high signal, low noise — optimized for fast LLM lookup

**Before editing:** re-scan the codebase, verify every section, remove stale entries, add new discoveries.

---

## Project Summary

| Field | Value |
|---|---|
| Purpose | Electron desktop app to chat with OpenAI-compatible AI models |
| Architecture | Classic Electron: main (CommonJS) + preload bridge + static renderer (ES modules) |
| Frameworks | Electron 28, electron-builder 25 |
| Languages | JavaScript (no TypeScript, no bundler) |
| Database | None — local JSON file in Electron `userData` |
| External services | User-configured OpenAI-compatible Chat Completions URL (default OpenRouter `/api/v1/chat/completions`) |
| Deployment | `electron-builder` → Windows NSIS installer → `dist/` |
| Theme reference | `theme-profile.md` (dark token system) |
| Git remote | `https://github.com/XeroDays/Open-Model-Listener.git` |

---

## Folder Structure

```
src/
├── main/           # Main process (Node + Electron APIs)
│   ├── index.js
│   ├── ipc/register.js
│   ├── middlewares/    # Domain handlers (not HTTP middleware)
│   ├── services/       # Config persistence, chat completions API
│   ├── windows/        # BrowserWindow factory
│   └── helpers/        # (empty — reserved)
├── preload/index.js    # contextBridge → window.electronAPI
├── shared/ipc/channels.js  # IPC channel name constants
└── renderer/           # Static HTML/CSS/JS UI
    ├── index.html      # Config form (home)
    ├── screens/chat/   # Chat screen
    ├── scripts/        # app.js, chat.js
    ├── styles/         # tokens.css, app.css
    └── assets/icons/   # (empty — reserved)
scripts/start-electron.js
theme-profile.md
.vscode/launch.json
```

---

## Architecture Rules

- **No bundler** — renderer loaded via `BrowserWindow.loadFile()`, no Vite/Webpack.
- **Renderer isolation** — `contextIsolation: true`, `nodeIntegration: false`. Renderer talks to main only via `window.electronAPI`.
- **IPC contract** — channel names defined once in `src/shared/ipc/channels.js` (prefix `oml:`).
- **Middleware = domain handlers** — files in `src/main/middlewares/` bridge IPC to services; not Express-style HTTP middleware.
- **Services own logic** — config persistence (`config-service`), API calls (`ai-service`). Middlewares do not call `fetch` directly.
- **Multi-screen navigation** — separate HTML files + `window.location.href`, not a client-side router.
- **Theme tokens** — all UI colors/spacing from `theme-profile.md` → `tokens.css` → `var(--token)`. No hardcoded hex in components.
- **Config storage** — `user-config.json` in `app.getPath("userData")`, not project root.
- **Chat context** — renderer holds full `messages[]` array; every request sends entire history for multi-turn context.
- **Streaming** — main → renderer via `sender.send` (one-way push), not `ipcMain.handle` return values.
- **Stream batching (two layers)** — `chat-middleware` batches IPC deltas before push; `chat.js` batches DOM updates before paint. Prevents UI freeze on long Ultra High reasoning streams (40k+ chars).
- **OpenRouter reasoning** — only one of `reasoning.effort` OR `reasoning.max_tokens` per request (mutually exclusive). Sent only when `apiUrl` hostname contains `openrouter.ai`.
- **Thinking display** — reasoning tokens streamed separately via `oml:chat-reasoning-delta`; shown in collapsible panel in chat UI; display-only (not stored in `messages[]`). Body DOM updated only when panel is expanded; label char count updates on flush interval.
- **API network logging** — `ai-service.js` logs request/response/stream lifecycle to main-process console; API key always masked.
- **Configurable endpoint** — full chat completions URL from config (`apiUrl`); default OpenRouter. OpenRouter-only headers/body fields gated by hostname.

---

## Feature Registry

### App Bootstrap

Purpose: Start Electron, register IPC, open main window.

Entry Points:
- `package.json` → `src/main/index.js`
- `scripts/start-electron.js`

Primary Files:
- `src/main/index.js`
- `src/main/windows/main-window.js`
- `src/main/ipc/register.js`

Workflow:
App Start → `index.js` → `registerIpcHandlers()` → `createMainWindow()` → load `renderer/index.html`

---

### Configuration Form (Home Screen)

Purpose: Collect and persist API URL, API key, model name, reasoning level.

Entry Points:
- `src/renderer/index.html`
- `src/renderer/scripts/app.js`

Primary Files:
- `src/renderer/index.html`
- `src/renderer/scripts/app.js`
- `src/main/middlewares/config-middleware.js`
- `src/main/services/config-service.js`

Related Files:
- `src/renderer/styles/app.css`
- `src/preload/index.js` (`saveConfig`, `getConfig`)

Dependencies:
- IPC: `oml:save-config`, `oml:get-config`
- Config keys: `apiUrl`, `apiKey`, `model`, `reasoning`

Workflow:
Config Form → `saveConfig` IPC → `config-middleware` → `config-service.set()` → `user-config.json` → navigate to `screens/chat/index.html`

Defaults:
- API URL: `https://openrouter.ai/api/v1/chat/completions`
- Model: `openai/gpt-oss-120b:free`
- Reasoning: `None`

---

### Chat with AI Model

Purpose: Multi-turn streaming conversation with the configured OpenAI-compatible model.

Entry Points:
- `src/renderer/screens/chat/index.html`
- `src/renderer/scripts/chat.js`

Primary Files:
- `src/renderer/scripts/chat.js`
- `src/main/middlewares/chat-middleware.js`
- `src/main/services/ai-service.js`

Related Files:
- `src/renderer/screens/chat/styles/chat.css`
- `src/preload/index.js` (`chatSend`, `onChatDelta`, `onChatReasoningDelta`, `onChatDone`, `onChatError`)

Dependencies:
- Config service (apiUrl, apiKey, model, reasoning)
- OpenAI-compatible streaming API (default OpenRouter)
- IPC: `oml:chat-send`, `oml:chat-delta`, `oml:chat-reasoning-delta`, `oml:chat-done`, `oml:chat-error`

Workflow:
User types message → push to `messages[]` → `chatSend` IPC → `chat-middleware` → load config → `ai-service.streamChat()` → reasoning SSE → collapsible thinking panel → content SSE → AI response bubble → on done, store assistant `content` only in `messages[]`

Send shortcut: Ctrl+Enter

Thinking panel: toggle expand/collapse; auto-collapses when response content starts; label shows char count (locale-formatted)

Stream performance: see **Stream Performance & Batching** section below

---

### Collapsible Thinking Panel

Purpose: Show model reasoning during/after generation in a collapsible dropdown above each AI reply.

Entry Points:
- `src/renderer/scripts/chat.js` → `createAiMessageBlock()`

Primary Files:
- `src/renderer/scripts/chat.js`
- `src/renderer/screens/chat/styles/chat.css`
- `src/main/services/ai-service.js` (parses `delta.reasoning`, `delta.reasoning_content`, `delta.reasoning_details`)

Related Files:
- `src/main/middlewares/chat-middleware.js`
- `src/preload/index.js` (`onChatReasoningDelta`)

Dependencies:
- IPC: `oml:chat-reasoning-delta`
- Reasoning level must be non-None for reasoning-capable models

Workflow:
Reasoning SSE → `onReasoningDelta` → `CHAT_REASONING_DELTA` (batched IPC) → `reasoningPending` buffer → throttled flush → label update; body update only if `is-open` → user toggles open/close (syncs pending on expand) → content SSE → auto-collapse panel → final response in `.msg-ai`

Performance rules:
- Collapsed panel: no per-token DOM writes to `.msg-thinking-body`
- Expanded panel: body synced on flush interval only
- On done: `renderMathOnly` skipped when reasoning exceeds `REASONING_MATH_MAX_CHARS`; plain `textContent` used instead
- On done with collapsed panel: body cleared (content loaded lazily on next expand via toggle handler)

---

### Stream Performance & Batching

Purpose: Keep renderer responsive during high-volume SSE streams (especially Ultra High reasoning). Introduced after UI freeze at ~43k reasoning chars.

Entry Points:
- `src/renderer/scripts/chat.js` — renderer-side DOM batching
- `src/main/middlewares/chat-middleware.js` — main-process IPC batching

#### Renderer constants (`chat.js`)

| Constant | Value | Role |
|---|---|---|
| `REASONING_UI_FLUSH_MS` | 150 | Max delay before reasoning pending buffer merges into `streamedReasoning` and triggers label/body UI update |
| `CONTENT_UI_FLUSH_MS` | 50 | Max delay before content pending buffer merges into `streamedContent` and updates response bubble |
| `REASONING_MATH_MAX_CHARS` | 12000 | Above this length, thinking body skips KaTeX (`renderMathOnly`) on stream done — plain text only |

#### Renderer state variables (`chat.js`)

| Variable | Type | Role |
|---|---|---|
| `streamedReasoning` | string | Committed reasoning text (flushed from pending); source of truth for label count and expand sync |
| `streamedContent` | string | Committed response text (flushed from pending) |
| `reasoningPending` | string | Incoming reasoning deltas not yet flushed to `streamedReasoning` or DOM |
| `contentPending` | string | Incoming content deltas not yet flushed to `streamedContent` or DOM |
| `reasoningFlushTimer` | timeout id \| null | Active timer for `scheduleReasoningUI`; prevents duplicate flush scheduling |
| `contentFlushTimer` | timeout id \| null | Active timer for `scheduleContentUI` |
| `contentStarted` | boolean | True once first content delta arrives; triggers thinking panel auto-collapse |

#### Renderer helper functions (`chat.js`)

| Function | When called | What it does |
|---|---|---|
| `scheduleReasoningUI()` | Each `onChatReasoningDelta` | Starts 150ms timer if none active |
| `flushReasoningUI()` | Timer fires | Moves `reasoningPending` → `streamedReasoning`; updates label; calls `syncThinkingBody` only if panel open |
| `scheduleContentUI()` | Each `onChatDelta` | Starts 50ms timer if none active |
| `flushContentUI()` | Timer fires | Moves `contentPending` → `streamedContent`; updates bubble; `scrollToBottom` |
| `flushPendingStreamUI()` | Content start, `onChatDone`, `resetTurnState` | Clears timers; drains both pending buffers into committed strings synchronously |
| `syncThinkingBody(aiBlock)` | `flushReasoningUI`, expand toggle | Writes `streamedReasoning` to `.msg-thinking-body` only when `.is-open` |
| `updateThinkingLabel(aiBlock)` | Flush points | Shows `streamedReasoning.length + reasoningPending.length` with locale formatting |

#### Main-process IPC batching (`chat-middleware.js`)

| Symbol | Role |
|---|---|
| `createDeltaBatcher(sender, channel, flushMs)` | Factory; coalesces string chunks into single IPC `{ delta }` payloads every `flushMs` (default 50) |
| `contentBatcher` | Batches `CHAT_DELTA` pushes |
| `reasoningBatcher` | Batches `CHAT_REASONING_DELTA` pushes (only when reasoning ≠ None) |
| `batcher.flush()` | Called on stream done and error to deliver final partial buffer before `CHAT_DONE` / `CHAT_ERROR` |

#### Lifecycle sync points

| Event | Action |
|---|---|
| Reasoning delta arrives | Append to `reasoningPending` → `scheduleReasoningUI` |
| First content delta | `flushPendingStreamUI` → collapse thinking panel → `scheduleContentUI` |
| User expands thinking | Drain `reasoningPending` into `streamedReasoning` → full `textContent` sync |
| Stream done | `flushPendingStreamUI` → conditional math render → `resetTurnState` clears all buffers |
| Error | `removeCurrentAiBlock` → `resetTurnState` via `flushPendingStreamUI` |

#### Future utilization

- **Tune flush intervals** — lower `REASONING_UI_FLUSH_MS` for snappier label; raise for weaker hardware; expose as advanced setting
- **Reuse batching pattern** — tool-call streams, multi-modal deltas, or future side-channel IPC (e.g. citations, token usage live meter) should use same pending-buffer + timer + `flushOnDone` pattern
- **IPC batching reuse** — `createDeltaBatcher` can wrap any high-frequency `sender.send` channel
- **Lazy render threshold** — `REASONING_MATH_MAX_CHARS` pattern applies to response bubble too if `renderRichContent` becomes slow on huge replies
- **Virtualized thinking view** — if reasoning grows past ~100k chars, replace full `textContent` with chunked/virtual scroll while keeping same pending-buffer ingest
- **Metrics UI** — wire `ai-service` stream stats (see API logging section) to a debug panel without changing ingest path
- **Abort/cancel** — `flushPendingStreamUI` is the single drain point to call before tearing down an in-flight turn

---

### API Network Logging

Purpose: Observable chat-completions request/response/stream lifecycle in main-process console (terminal / Debug Console).

Entry Points:
- `src/main/services/ai-service.js` → `streamChat()`
- `src/main/middlewares/chat-middleware.js` → `SendMessage` entry log

Log prefixes: `[ai-service]`, `[chat-middleware]`

#### Request log (`streamChat → request`)

Fields: url (configured `apiUrl`), method, model, stream, masked apiKey, messageCount, promptChars, roles, reasoning options (OpenRouter only), header summary (key masked)

#### Response log (`streamChat ← response`)

Fields: model, status, statusText, ok, elapsedMs, contentType

#### Stream stats object (internal, logged on done)

| Field | Meaning |
|---|---|
| `startedAt` | `Date.now()` at request start |
| `deltaCount` | Content delta events received |
| `deltaChars` | Total content characters streamed |
| `reasoningCount` | Reasoning delta events received |
| `reasoningChars` | Total reasoning characters streamed |
| `sseChunks` | Raw SSE read chunks from `ReadableStream` |
| `lastUsage` | Token usage object from final SSE chunk (when the provider sends it) |
| `timeToFirstByteMs` | Request start → HTTP response headers |
| `timeToFirstContentMs` | Request start → first content delta |
| `timeToFirstReasoningMs` | Request start → first reasoning delta |

#### Completion / error logs

- `streamChat ✓ done` — all stats fields + `totalElapsedMs`
- `streamChat ✗ HTTP error` — status + response body snippet (800 chars)
- `streamChat ✗ API error in stream` — inline SSE error object
- `streamChat ✗ exception` — network/parse failures

#### Helpers

| Function | Role |
|---|---|
| `maskApiKey(key)` | Shows `sk-o...xxxx`; never logs full key |
| `summarizeMessages(messages)` | messageCount, promptChars, roles — for request log without dumping prompt text |
| `resolveApiUrl(apiUrl)` | Validates http/https URL; returns `{ url }` or `{ error }` |
| `isOpenRouterUrl(apiUrl)` | True when hostname contains `openrouter.ai` |

#### Future utilization

- Pipe stats to renderer debug overlay or status bar (IPC channel e.g. `oml:chat-stats`)
- Persist last request metrics per session for support diagnostics
- Alert on slow `timeToFirstByteMs` or stuck streams (no delta for N seconds)
- Correlate with renderer flush timings to diagnose end-to-end latency
- Add log level env flag without removing structured fields

---

### Dark Theme System

Purpose: Consistent dark UI tokens for all screens.

Entry Points:
- `theme-profile.md` (AI/human reference)
- `src/renderer/styles/tokens.css` (CSS variables)

Primary Files:
- `theme-profile.md`
- `src/renderer/styles/tokens.css`

Related Files:
- `src/renderer/styles/app.css`
- `src/renderer/screens/chat/styles/chat.css`

---

## Workflow Registry

### Save Configuration

Trigger: User submits config form on home screen.

Flow:
`app.js` form submit → validate `apiUrl` (`http:`/`https:`) → `electronAPI.saveConfig({ apiUrl, apiKey, model, reasoning })` → `ipc/register.js` → `config-middleware.SaveConfig` → `config-service.set()` × 4 → write `user-config.json` → redirect to chat screen

Files:
- `src/renderer/scripts/app.js`
- `src/main/ipc/register.js`
- `src/main/middlewares/config-middleware.js`
- `src/main/services/config-service.js`

---

### Load Saved Configuration

Trigger: Home screen `DOMContentLoaded`.

Flow:
`app.js` → `electronAPI.getConfig(key)` × 4 → `config-middleware.GetConfig` → `config-service.get()` → pre-fill form fields

Files:
- `src/renderer/scripts/app.js`
- `src/main/middlewares/config-middleware.js`
- `src/main/services/config-service.js`

---

### Send Chat Message (Streaming)

Trigger: User clicks Send or Ctrl+Enter on chat screen.

Flow:
`chat.js` → append user bubble + push to `messages[]` → `electronAPI.chatSend({ messages })` → `chat-middleware.SendMessage` (entry log) → read config (`apiUrl`, apiKey, model, reasoning) → `buildReasoningOptions()` → `ai-service.streamChat()` (request/response logs) → configured URL SSE → `createDeltaBatcher` → `CHAT_REASONING_DELTA` + `CHAT_DELTA` (batched IPC) → `chat.js` pending buffers + throttled DOM → batcher flush → `CHAT_DONE` → `renderRichContent` on response → store assistant `content` in `messages[]` (reasoning not persisted)

Files:
- `src/renderer/scripts/chat.js`
- `src/main/middlewares/chat-middleware.js`
- `src/main/services/ai-service.js`
- `src/main/services/config-service.js`

---

### Chat Error Handling

Trigger: Provider HTTP error, stream error, or missing config.

Flow:
`ai-service` logs `[ai-service]` error → `onError` callback → `chat-middleware` logs `[chat-middleware]` error → `sender.send(CHAT_ERROR)` → renderer shows error bubble, removes incomplete AI block (thinking panel + response)

Files:
- `src/main/services/ai-service.js`
- `src/main/middlewares/chat-middleware.js`
- `src/renderer/scripts/chat.js`

---

## File Responsibility Map

| Responsibility | File |
|---|---|
| App bootstrap | `src/main/index.js` |
| Window creation | `src/main/windows/main-window.js` |
| IPC handler registration | `src/main/ipc/register.js` |
| IPC channel constants | `src/shared/ipc/channels.js` |
| Preload bridge (renderer API) | `src/preload/index.js` |
| Config save/load (middleware) | `src/main/middlewares/config-middleware.js` |
| Chat send (middleware) | `src/main/middlewares/chat-middleware.js` |
| IPC delta batching | `src/main/middlewares/chat-middleware.js` → `createDeltaBatcher()` |
| Reasoning level mapping | `src/main/middlewares/chat-middleware.js` → `buildReasoningOptions()` |
| Stream DOM batching | `src/renderer/scripts/chat.js` → pending buffers + flush helpers |
| API network logging | `src/main/services/ai-service.js` → `maskApiKey`, `summarizeMessages`, stream stats |
| API URL resolve / OpenRouter extras | `src/main/services/ai-service.js` → `resolveApiUrl`, `isOpenRouterUrl`, `DEFAULT_API_URL` |
| Config persistence (key/value JSON) | `src/main/services/config-service.js` |
| OpenAI-compatible streaming API | `src/main/services/ai-service.js` |
| Reasoning delta parsing | `src/main/services/ai-service.js` → `extractReasoningDeltas()` |
| Thinking panel UI | `src/renderer/scripts/chat.js`, `src/renderer/screens/chat/styles/chat.css` |
| Health check placeholder | `src/main/middlewares/app-middleware.js` |
| Home screen UI + form logic | `src/renderer/index.html`, `src/renderer/scripts/app.js` |
| Chat screen UI + message logic | `src/renderer/screens/chat/index.html`, `src/renderer/scripts/chat.js` |
| Global styles + form styles | `src/renderer/styles/app.css` |
| Chat-specific styles | `src/renderer/screens/chat/styles/chat.css` |
| Markdown + LaTeX rendering | `src/renderer/scripts/rich-render.js`, `src/renderer/vendor/marked.esm.js`, `src/renderer/vendor/katex/` |
| CSS design tokens | `src/renderer/styles/tokens.css` |
| Theme token reference (AI) | `theme-profile.md` |
| Dev launcher | `scripts/start-electron.js` |
| Debug config (Play button) | `.vscode/launch.json` |
| Windows build config | `package.json` → `build` block |

---

## Data Flow Map

### Config Flow
```
Renderer (app.js)
  → preload (saveConfig / getConfig)
  → ipcMain.handle
  → config-middleware
  → config-service
  → user-config.json (Electron userData)
```

### Chat Flow (request)
```
Renderer (chat.js) — holds messages[]
  → preload (chatSend)
  → ipcMain.handle (CHAT_SEND)
  → chat-middleware.SendMessage
  → config-service.get(apiUrl, apiKey, model, reasoning)
  → ai-service.streamChat
  → fetch configured apiUrl
```

### Chat Flow (streaming response)
```
Provider SSE (OpenAI-compatible)
  → ai-service (parse data: lines — content + reasoning; accumulate stats)
  → chat-middleware (createDeltaBatcher — 50ms coalesce)
  → sender.send(CHAT_REASONING_DELTA | CHAT_DELTA)
  → batcher.flush() on done/error
  → sender.send(CHAT_DONE | CHAT_ERROR)
  → preload subscribe
  → chat.js (reasoningPending / contentPending → throttled flush → thinking panel / response bubble)
```

---

## Integration Registry

### OpenAI-compatible Chat Completions

| Field | Value |
|---|---|
| Purpose | AI chat completions (streaming) |
| Endpoint | User-configured full URL (`apiUrl`); default `https://openrouter.ai/api/v1/chat/completions` |
| Auth | Bearer token from user config (`apiKey`) when present |
| Files | `src/main/services/ai-service.js`, `src/main/middlewares/chat-middleware.js` |
| Entry point | `ai-service.streamChat()` |
| Common headers | `Content-Type`, `Authorization` (if apiKey set) |
| OpenRouter-only extras | `HTTP-Referer`, `X-Title`, body `usage.include`, body `reasoning` — applied only when hostname contains `openrouter.ai` |
| Streaming | SSE `data:` lines, `[DONE]` terminator |
| Reasoning request | Optional `reasoning` object — effort OR max_tokens, never both (OpenRouter only) |
| Reasoning response | `delta.reasoning`, `delta.reasoning_content`, or `delta.reasoning_details[].text` |
| Helpers | `resolveApiUrl()`, `isOpenRouterUrl()`, `DEFAULT_API_URL` |

Reasoning level mapping (`chat-middleware.buildReasoningOptions`):

| UI Label | API payload |
|---|---|
| None | `{ effort: "none", exclude: true }` |
| Low | `{ effort: "low" }` |
| Medium | `{ effort: "medium" }` |
| High | `{ effort: "high" }` |
| Ultra High | `{ max_tokens: 16000 }` |

---

## IPC Channel Registry

| Channel | Direction | Purpose |
|---|---|---|
| `oml:ping` | invoke → return | Health check |
| `oml:save-config` | invoke → return | Save apiUrl, apiKey, model, reasoning |
| `oml:get-config` | invoke → return | Read config by key |
| `oml:chat-send` | invoke → return | Start streaming chat |
| `oml:chat-delta` | main → renderer push | Stream response content delta |
| `oml:chat-reasoning-delta` | main → renderer push | Stream reasoning/thinking delta |
| `oml:chat-done` | main → renderer push | Stream complete |
| `oml:chat-error` | main → renderer push | Error message |

---

## Dependency Impact Map

### config-service.js
Changing may impact: config form save/load, chat API URL/key/model/reasoning retrieval

### config-middleware.js
Changing may impact: home screen form, IPC save/get handlers

### ai-service.js
Changing may impact: all chat streaming, error logging, request URL, OpenRouter-only extras (`resolveApiUrl`, `isOpenRouterUrl`)

### chat-middleware.js
Changing may impact: reasoning level mapping, chat error forwarding, stream push to renderer, IPC batching intervals, flush-on-done ordering

### chat.js (stream state)
Changing may impact: thinking panel responsiveness, char count display, content/reasoning flush timing, math render threshold for thinking body. Key symbols: `REASONING_UI_FLUSH_MS`, `CONTENT_UI_FLUSH_MS`, `REASONING_MATH_MAX_CHARS`, `reasoningPending`, `contentPending`, `flushPendingStreamUI`

### channels.js
Changing may impact: preload, register.js, chat-middleware — all IPC wiring must stay in sync

### preload/index.js
Changing may impact: all renderer scripts (`app.js`, `chat.js`)

### tokens.css / theme-profile.md
Changing may impact: all UI screens and future components

---

## Known Conventions

- **Naming:** IPC channels prefixed `oml:`; middleware files suffixed `-middleware.js`; services suffixed `-service.js`
- **Module system:** CommonJS in main/preload; ES modules (`type="module"`) in renderer scripts
- **Screen pattern:** `screens/<name>/index.html` + `../../scripts/<name>.js` + local `styles/<name>.css`
- **Empty reserved dirs:** `src/main/helpers/`, `src/renderer/screens/` (placeholder), `src/renderer/assets/icons/`, `build/`
- **Logging:** `[service-name]` or `[middleware-name]` prefix; `ai-service` uses `console.log` for request/response/done and `console.error` for failures; API keys always masked via `maskApiKey()`
- **Stream batching defaults:** IPC 50ms (`createDeltaBatcher`), reasoning DOM 150ms, content DOM 50ms, thinking math cap 12000 chars
- **CSP:** `default-src 'self'; script-src 'self'; style-src 'self'` on all HTML pages
- **No tests** currently in project
- **No .env** — API key stored via config form, not environment variables
- **Rich chat rendering** — `rich-render.js` uses vendored `marked` (Markdown) + KaTeX (math); renders after stream completes; preprocesses AI `[...]` bracket math → `\[...\]`; supports `\boxed{}`, headings, lists, fenced code blocks, inline code, LaTeX `\(...\)` / `\[...\]`

---

## Config Keys (user-config.json)

| Key | Type | Example |
|---|---|---|
| `apiUrl` | string | `https://openrouter.ai/api/v1/chat/completions` |
| `apiKey` | string | Provider API key |
| `model` | string | `openai/gpt-oss-120b:free` |
| `reasoning` | string | `None`, `Low`, `Medium`, `High`, `Ultra High` |

Storage path: `app.getPath("userData")/user-config.json`

---

## Scripts

| Command | Purpose |
|---|---|
| `npm start` | Dev launch via `scripts/start-electron.js` |
| `npm run build` | electron-builder (all platforms) |
| `npm run build:win` | Windows NSIS installer |

Debug: VS Code/Cursor Play button → `.vscode/launch.json` → "Debug Main Process"
