// Ask Tommy's AI translator on the Claude API, as a Netlify Function at /api/tommy.
//
// The browser (js/ta/ai-api.js) sends only the student's words, plus the last few message -> command pairs.
// This function owns Tommy's translator instructions, calls Claude with the key kept in the site's
// ANTHROPIC_API_KEY environment variable, and returns ONE validated Tommy command: {"cmd": "...", "args": {...}}.
// It never returns free text, so the key can't be used as a general-purpose chatbot.
//
//   GET  /api/tommy  -> {"ok": true|false, "model": "..."}   (ok = an API key is configured)
//   POST /api/tommy  {"text": "...", "now": "...", "earlier": [{"text": "...", "line": "..."}]}
//                    -> {"cmd": "plan.day", "args": {"day": "thursday"}}   or {"cmd": null} when nothing fits
//
// tommy-prompt.mjs is generated from the app's own command catalogue by scripts/build-netlify.mjs.
import Anthropic from "@anthropic-ai/sdk";
import { SYSTEM, COMMANDS } from "./tommy-prompt.mjs";

const MODEL = process.env.TOMMY_MODEL || "claude-opus-5-5";
const MAX_BODY = 20_000;               // bytes
const LIMIT = 40, WINDOW_MS = 10 * 60_000; // per visitor, per function instance (best effort; your Console spend limit is the hard cap)
const hits = new Map();
let client = null;

const json = (status, obj) =>
  new Response(JSON.stringify(obj), { status, headers: { "content-type": "application/json", "cache-control": "no-store" } });

const clean = (s, n) => String(s ?? "").replace(/[\u0000-\u0008\u000b-\u001f\u007f]/g, " ").slice(0, n);

function tooMany(ip) {
  const now = Date.now();
  const recent = (hits.get(ip) || []).filter((t) => now - t < WINDOW_MS);
  recent.push(now);
  hits.set(ip, recent);
  if (hits.size > 5000) hits.clear();
  return recent.length > LIMIT;
}

// Claude's reply -> {cmd, args} with a known command and only that command's argument names; otherwise null.
export function parseCommand(raw) {
  const a = raw.indexOf("{"), b = raw.lastIndexOf("}");
  if (a < 0 || b <= a) return null;
  let obj;
  try { obj = JSON.parse(raw.slice(a, b + 1)); } catch { return null; }
  if (!obj || typeof obj.cmd !== "string") return null;
  const cmd = obj.cmd.trim();
  if (cmd === "none" || !Object.hasOwn(COMMANDS, cmd)) return null;
  const args = {};
  const given = obj.args && typeof obj.args === "object" && !Array.isArray(obj.args) ? obj.args : {};
  for (const k of COMMANDS[cmd]) {
    const v = given[k];
    if (typeof v === "string") args[k] = v.slice(0, 500);
    else if (typeof v === "number" || typeof v === "boolean") args[k] = v;
  }
  return { cmd, args };
}

async function translate(body) {
  client ??= new Anthropic(); // reads ANTHROPIC_API_KEY
  const earlier = (Array.isArray(body.earlier) ? body.earlier : []).slice(-6)
    .map((e) => `- "${clean(e?.text, 200)}" -> ${clean(e?.line, 200)}`).join("\n") || "(nothing yet)";
  const params = {
    model: MODEL,
    max_tokens: 2000,
    output_config: { effort: "low" }, // a one-line translation; thinking stays short
    system: [{ type: "text", text: SYSTEM, cache_control: { type: "ephemeral" } }], // instructions + catalogue are identical every call
    messages: [{ role: "user", content: `NOW: ${clean(body.now, 80)}\n\nEARLIER\n${earlier}\n\nSTUDENT MESSAGE\n${clean(body.text, 1000)}` }],
  };
  let response;
  try {
    // If a safety classifier declines, the API retries on a fallback model inside the same call.
    response = await client.beta.messages.create({ ...params, betas: ["server-side-fallback-2026-07-01"], fallbacks: "default" });
  } catch (e) {
    if (!(e instanceof Anthropic.BadRequestError)) throw e;
    response = await client.messages.create(params); // same request without the fallback beta
  }
  if (response.stop_reason === "refusal") return { cmd: null };
  const raw = response.content.filter((b) => b.type === "text").map((b) => b.text).join("");
  return parseCommand(raw) ?? { cmd: null };
}

export default async (req) => {
  if (req.method === "GET") return json(200, { ok: Boolean(process.env.ANTHROPIC_API_KEY), model: MODEL });
  if (req.method !== "POST") return json(405, { error: "Use POST." });
  if (!process.env.ANTHROPIC_API_KEY) return json(503, { error: "This site has no ANTHROPIC_API_KEY yet." });

  // Browsers on other websites can't use this endpoint (Origin must be this site; tools without an Origin are rate-limited).
  const origin = req.headers.get("origin");
  if (origin) {
    let host = "";
    try { host = new URL(origin).host; } catch { host = ""; }
    const own = [req.headers.get("x-forwarded-host"), req.headers.get("host")];
    try { own.push(new URL(req.url).host); } catch { /* relative url */ }
    if (!host || !own.includes(host)) return json(403, { error: "Not allowed from this origin." });
  }
  const ip = req.headers.get("x-nf-client-connection-ip") || req.headers.get("x-forwarded-for") || "unknown";
  if (tooMany(ip)) return json(429, { error: "Too many messages. Try again in a few minutes." });

  const raw = await req.text();
  if (raw.length > MAX_BODY) return json(413, { error: "Message too long." });
  let body;
  try { body = JSON.parse(raw); } catch { return json(400, { error: "Send JSON." }); }
  if (!body || typeof body.text !== "string" || !body.text.trim()) return json(400, { error: "text is required" });

  try {
    return json(200, await translate(body));
  } catch (e) {
    const status = e instanceof Anthropic.RateLimitError ? 429
      : e instanceof Anthropic.AuthenticationError || e instanceof Anthropic.PermissionDeniedError ? 503
      : 502;
    console.error("tommy translate failed:", e?.status ?? "", e?.message ?? e);
    return json(status, { error: status === 429 ? "Busy. Try again in a moment." : "Translator unavailable." });
  }
};

export const config = { path: "/api/tommy" };
