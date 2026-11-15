RESEARCH REPORT: Luma, Netlify AI Gateway, Netlify Blobs, Claude web search for USC, and subscription vs API (no project files were changed)

NETWORK: these hosts are blocked in this session: docs.netlify.com, www.netlify.com, answers.netlify.com, docs.luma.com, docs.lu.ma, help.luma.com, luma.com, lu.ma, api.lu.ma, public-api.luma.com, cdn.jsdelivr.net and unpkg.com. Reachable: platform.claude.com, support.claude.com, api.netlify.com, raw.githubusercontent.com and registry.npmjs.org. To get around the blocks I read Netlify's official GitHub repos (netlify/context-and-tools, netlify/primitives, netlify/open-api), the official npm packages (@anthropic-ai/sdk 1.8.0, @netlify/blobs 11.1.9, @netlify/agent-runner-cli 2.22.0), the live Netlify API, and luma-team/examples on GitHub. A citation marked "(snippet)" means the page is on a blocked host and I only saw a search-result summary of it. Check those items before relying on them.

## 1. LUMA

**Official API**
- Base URL is https://public-api.luma.com. The key goes in the `x-luma-api-key` header. The test call is `GET /v1/users/get-self`.
- You need **Luma Plus**. Each key is scoped to one calendar and gives full access to it. Keys are under the calendar's Settings > Developer > API Keys. Keep the key server-side only. (docs.luma.com/reference/getting-started-with-your-api (snippet); help.luma.com/p/luma-api (snippet))
- Older docs show `api.lu.ma/public/v1/...`. That path is legacy.
- Webhooks are also Plus-only. (help.luma.com/p/webhooks (snippet))

**Rate limits**
- GET and POST share one per-minute budget: 200 requests/min per calendar for calendar keys and OAuth, 500/min per organization for org keys.
- Headers: `X-RateLimit-Limit` and `X-RateLimit-Remaining`. A 429 comes with `Retry-After`. (docs.luma.com/reference/rate-limits (snippet))

**Endpoints** (current names come from the October 2026 changelog, docs.luma.com/reference/changelog (snippet))
- **List a calendar's events:** `GET /v1/calendars/events/list`. The legacy route `GET /v1/calendar/list-events` still exists.
  - Paging uses `pagination_cursor` and `pagination_limit`, then follow `next_cursor`.
  - List entries no longer include `description` or `description_md`. Use `GET /v1/events/get` for those.
  - Org-wide list: `GET /v1/organizations/events/list`. (docs.luma.com/reference/get_v1-calendars-events-list, docs.luma.com/reference/get_v1-organizations-events-list)
- **Create:** `POST /v1/events/create`. Third-party sources (lava.so, pipedream) say `name`, `start_at` and `timezone` are required, with `end_at`, `visibility` and `geo_address_json` optional. Official text says `meeting_url` can't be combined with `geo_address_json`; use `create_meeting` to have Luma make a meeting link. (docs.luma.com/reference/post_v1-events-create (snippet))
- **Update:** `POST /v1/events/update` with `event_id` ("evt-..."). This replaces `/v1/event/update`. (docs.luma.com/reference/post_v1-events-update (snippet))
- **Guests and RSVPs:**
  - `GET /v1/events/guests/list` (path from the docs index), `POST /v1/events/guests/add`, `POST /v1/events/guests/update-status`. (docs.luma.com/reference/post_v1-events-guests-add, docs.luma.com/reference/post_v1-events-guests-update-status (snippets))
  - `approval_status` values: approved, pending_approval, invited, waitlist, declined. (help.luma.com/p/managing-your-guest-list (snippet))
- **Invites:** `POST /v1/events/guests/send-invites`, replacing `/v1/event/send-invites`. It sends an email, plus an SMS if the guest's phone is linked. (docs.luma.com/reference/post_v1-events-guests-send-invites (snippet))
- **Blasts (new in Oct 2026):** `GET /v1/events/blasts/list`, `GET /v1/events/blasts/get`, `POST /v1/events/blasts/create`, `POST /v1/events/blasts/update`, `POST /v1/events/blasts/delete`. I could not see their request parameters.
  - Product rules: blasts can be sent up to 7 days after the event ends, and can be filtered by guest status or ticket type. (help.luma.com/p/sending-or-scheduling-event-blasts (snippet))
- **Images:** `POST /v1/images/create-upload-url`.
- **Full spec:** a third party says it is at https://public-api.luma.com/openapi.json (unverified). The docs index is at https://docs.luma.com/llms.txt.

**Event page URLs**
- `https://luma.com/<slug>`; old `lu.ma` links are still used. Event IDs look like `evt-...` and calendar IDs like `cal-...`.
- Embeds and the checkout button need the `evt-` ID. Some tools don't accept vanity URLs.

**Checkout button** (official repo github.com/luma-team/examples, README fetched)
```html
<button class="luma-checkout--button" type="button" data-luma-action="checkout" data-luma-event-id="evt-YOUR-EVENT-ID">Register for Event</button>
<script id="luma-checkout" src="https://embed.lu.ma/checkout-button.js"></script>
```
- The README writes the script tag as self-closing (`<script .../>`), which is invalid HTML. Use `</script>`.
- Include the script once per page. In a single-page app, call `window.luma && window.luma.initCheckout()` after the buttons render.
- Optional attributes: `data-luma-coupon` and `data-luma-utm-source`. (help.luma.com/p/embed-our-checkout-registration-button-on-your-website (snippet))

**Other embeds**
- Event iframe: `https://luma.com/embed/event/evt-xxx/simple`. Add `?tt=ttyp-xxx` for a specific ticket type.
  - The page receives a postMessage of type `luma:purchase` from the luma.com origin.
  - Apple Pay doesn't work inside embeds. (help.luma.com/p/embed-luma-on-your-website (snippet))
- Calendar embed: copy the code from the calendar's Settings > Embed. I could not confirm the exact URL.
- If the app sets a Content-Security-Policy, it must allow embed.lu.ma scripts and luma.com frames.

**iCal feed**
- Official route: the "Add iCal Subscription" button on a calendar page. The feed includes all published events. (help.luma.com/p/ical-syncing (snippet))
- Third-party sources show the URL pattern `https://api.lu.ma/ics/get?entity=calendar&id=cal-...`. It is not documented by Luma and may change. Fetch it server-side and parse; I didn't test CORS.

**Create-event deep link**
- `https://luma.com/create` (or lu.ma/create) exists. (help.luma.com/p/creating-an-event (snippet))
- There are no documented prefill parameters. To prefill, either copy the title and description to the clipboard and open /create, or use `POST /v1/events/create` with a key.

**Free vs. Plus for a prototype**
- **Free (no Plus):** event links, checkout button, event iframe, calendar embed, iCal import, the /create link.
  - Free plan limits: 5% fee on paid tickets, 3 admins per calendar, 500 invites/newsletters per week.
  - Plus: 0% fee, 5 admins, 5,000 per week (the calendar must be verified to get higher send limits).
  - Plus costs about $59/month billed annually, or $69 month to month. (luma.com/pricing and help.luma.com/p/luma-plus-overview (snippets), and third-party listings; verify)
- **With a Plus key:** sync events into the club's Requested > Scheduled > Announced > Done pipeline; create or update an event from the Schedule sheet; read RSVPs and guest statuses; add guests; send invites; send blasts for the "announce" and "message attendees" steps; receive webhooks.

## 2. NETLIFY AI GATEWAY

**Can a Function call Claude without the user's own key?** Yes. At runtime Netlify injects `ANTHROPIC_API_KEY` and `ANTHROPIC_BASE_URL` into Functions, so `new Anthropic()` works with no arguments.
- Only modern v2/v3 functions get these. A legacy v1 `exports.handler` gets no key and fails with "missing API key".
- `NETLIFY_AI_GATEWAY_KEY` and `NETLIFY_AI_GATEWAY_URL` are always injected, for libraries that need explicit config.
- Raw REST call: `POST ${NETLIFY_AI_GATEWAY_URL minus trailing slash}/anthropic/v1/messages` with `Authorization: Bearer ${NETLIFY_AI_GATEWAY_KEY}`.
- Sources: raw.githubusercontent.com/netlify/context-and-tools/main/skills/netlify-ai-gateway/SKILL.md, and dist/skills/netlify-ai-gateway/SKILL.md inside the npm package @netlify/agent-runner-cli 2.22.0.

**Precedence if the site already sets ANTHROPIC_API_KEY**
- Netlify never overrides a key or base URL set at project or team level. The check is per provider: if you set `ANTHROPIC_API_KEY`, Netlify sets neither `ANTHROPIC_API_KEY` nor `ANTHROPIC_BASE_URL`. The SDK then calls api.anthropic.com with your key.
- The gateway pair is still injected. To force the gateway anyway (my inference from the REST path; untested): `new Anthropic({ apiKey: process.env.NETLIFY_AI_GATEWAY_KEY, baseURL: process.env.NETLIFY_AI_GATEWAY_URL.replace(/\/$/, "") + "/anthropic" })`.
- Variables set in netlify.toml are not visible to functions. A variable needs the Functions scope, set in the UI or CLI. (netlify-functions skill in the same repo)

**Models** (live call to GET https://api.netlify.com/api/v1/ai-gateway/providers/detailed on 2026-11-15; USD per million tokens)

| Model | Input | Output | Cache read | Cache write |
|---|---|---|---|---|
| claude-opus-5-5 | 4 | 20 | 0.2 | 5 |
| claude-sonnet-5-5 | 2 | 10 | 0.2 (Anthropic lists 0.10) | 2.5 |
| claude-haiku-5-5 | 0.10 | 0.50 | 0.01 | 0.12 |

- All three models you asked about are available.
- Haiku 5.5 costs $0.50/$2.50 above 100K tokens.
- Also available: claude-fable-5, 5-1, 5-2; opus-5; opus-4-5 through 4-8; sonnet-5; sonnet-4-5 and 4-6; haiku-4-5.
- Netlify says not to hardcode the list; read this endpoint instead.

**Pricing on the Free plan**
- Tokens are priced at provider rates, then converted at 180 credits per $1. (context-and-tools skill; docs.netlify.com .../pricing-for-ai-features (snippet))
- The Free plan has 300 credits per month (netlify.com/pricing (snippet); verify). The same pool pays for:
  - 15 credits per production deploy
  - 20 credits per GB of bandwidth
  - 10 credits per GB-hour of compute
  - 2 credits per 10,000 web requests
  (docs.netlify.com .../how-credits-work (snippet))
- So at most about $1.67/month of model usage. That is about 83K Opus 5.5 output tokens, or about 3.3M Haiku 5.5 output tokens.
- When credits run out on Free, usage stops: no auto-recharge (snippet).
- Usage is visible under Team settings > Billing > Usage.

**Limits**
- Per team, per minute, in credits: Free 90, Personal 450, Pro 1,800, Enterprise 9,000.
- Input is capped at 200k tokens per request.
- No pass-through or custom headers, so `anthropic-beta` features don't work through the gateway. That includes server-side `fallbacks` and compaction.
- No batch inference. Anthropic prompt caching is limited to the default 5-minute cache.
- Function limits: 60 s for synchronous functions, and streamed responses are also capped at 60 s and 20 MB. Background functions get 15 minutes. Buffered payloads are capped at 6 MB.
- Runtime only: gateway calls fail from build scripts.
- Not callable from the browser.
- Requires at least one production deploy, also for `netlify dev` and `@netlify/vite-plugin`.

**How to enable it** (a site showing `ai_gateway_disabled`)
1. Be on a credit-based plan: Free, Personal or Pro. Legacy plans aren't eligible. Enterprise has AI features off by default; go through the account manager.
2. Turn AI features on. This needs a Team Owner. Path: Project configuration > Build & deploy > Build with AI > Manage AI features. (agent-runner skill; docs.netlify.com/build/build-with-ai/manage-ai-features (snippet))
3. Run `netlify deploy --prod` at least once.
4. Use v2 function syntax.
5. Don't set your own ANTHROPIC_API_KEY.

**Netlify API** (github.com/netlify/open-api swagger.yml)
- `GET /api/v1/ai-gateway/providers` (no auth).
- `GET /api/v1/sites/{site_id}/ai-gateway/token` and `GET /api/v1/accounts/{account_id}/ai-gateway/token`. These return `{token, url, expires_at}`, or 404 "AI Gateway not available for this site". This is the programmatic check.
- The spec doesn't define `ai_gateway_disabled` (site `capabilities` is a free-form object) and has no endpoint to toggle AI features.

**@anthropic-ai/sdk 1.8.0 and the gateway** (checked in the SDK source and a mocked run)
- 1.8.0 sends `Authorization: Bearer <key>`, not `x-api-key`, and `anthropic-version: 2026-10-21` (1.0.0 was the first release to send that version), to `${ANTHROPIC_BASE_URL}/v1/messages`.
- Netlify's own REST example uses Bearer, so auth should work.
- Netlify doesn't document whether the gateway accepts version 2026-10-21. Test one request after deploying.
  - Fallback: `new Anthropic({ defaultHeaders: { "anthropic-version": "2023-06-01" } })`. In 1.8.0, defaultHeaders override the SDK's default.
  - If a proxy ever needed `x-api-key`, Anthropic documents: `new Anthropic({ apiKey, defaultHeaders: { "X-Api-Key": apiKey, Authorization: null } })`. (platform.claude.com/docs/en/api/migration-2026-10-21?sdk_languages=typescript)
- Whether the web search tool works through the gateway is undocumented; Netlify's pricing lists only tokens. Test it. If it fails, call search through a direct Console key.

## 3. NETLIFY BLOBS (Functions v2)

**Package:** `@netlify/blobs`, latest 11.1.9 on npm (Nov 2026). Ships ESM and CJS. The package requires Node >= 22.12.0 (its README still says 16+).
- Functions run the build's Node version, falling back to Node 24. If the build is pinned below 22.12, set `AWS_LAMBDA_JS_RUNTIME` in the UI.
- In v2 functions the site ID and token are injected automatically. A v1 Lambda-style handler must call `connectLambda(event)`.

```js
import { getStore } from "@netlify/blobs";
export default async (req) => {
  const store = getStore({ name: "club-data", consistency: "strong" }); // or getStore("club-data")
  const w = await store.setJSON(`votes/${reqId}/${userId}`, { at: Date.now() }, { onlyIfNew: true }); // {modified, etag?}
  const obj = await store.get("requests/r1", { type: "json" });      // null when missing
  const { blobs } = await store.list({ prefix: `votes/${reqId}/` });  // [{ key, etag }]
  return Response.json({ votes: blobs.length });
};
export const config = { path: "/api/vote" };
```

**API** (from the 11.1.9 types)
- `set(key, string|Blob|ArrayBuffer, {metadata, onlyIfNew | onlyIfMatch})` and `setJSON` both overwrite and return `{modified, etag?}`.
- `get(key, {type: text|json|arrayBuffer|blob|stream, consistency})`.
- `getWithMetadata` and `getMetadata` return null when the key is missing.
- `list({prefix, directories, paginate})` returns `{blobs, directories}`. Pages hold up to 1,000 entries; by default it returns all pages.
- Also: `delete`, `deleteAll`, `getDeployStore`, `listStores`.

**Consistency**
- Default is eventual: new writes are visible immediately, but updates and deletes take up to 60 s to reach every location.
- `consistency: "strong"` can be set per store or per read. The CLI always uses strong.

**Concurrency**
- Last write wins, and Netlify says not to build counters or read-modify-write logic on a key. For votes and dues, write one key per voter or payment with `onlyIfNew` and count with `list` (my suggestion).

**Footguns**
- `getStore` is site-wide: deploy previews read and write production data. Use `getDeployStore` or a separate store name for previews.
- Site-wide stores default to region us-east-2, per call.
- No TTL and no access control: the function is the only gate.

**Limits:** objects up to 5 GB; metadata up to 2 KB; keys up to 600 bytes with no leading "/"; store names up to 64 bytes with no "/" or ":".
(Sources: raw.githubusercontent.com/netlify/context-and-tools/main/skills/netlify-blobs/SKILL.md; raw.githubusercontent.com/netlify/primitives/main/packages/blobs/README.md; npm @netlify/blobs 11.1.9)

**Free-tier limits:** I found no Blobs-specific quota or meter. The how-credits-work meters (snippet) don't name Blobs, and Netlify's knowledge base says Blobs draws from the credit pool with no published per-GB rate (snippet). Treat this as unverified. Calls to the function itself still count as requests and compute.

## 4. CLAUDE WEB SEARCH LIMITED TO USC

Sources: the bundled skill (shared/tool-use-concepts.md, typescript/claude-api/tool-use.md, typescript/claude-api/README.md, shared/api-version-migration.md), plus live pages platform.claude.com/docs/en/agents-and-tools/tool-use/web-search-tool and .../server-tools.

**Tool type for claude-opus-5-5**
- `web_search_20260209`: dynamic filtering; this is the bundled skill's choice.
- `web_search_20260318`: newest, per the live docs. Same as 20260209 plus `response_inclusion` ("full" by default, or "excluded").
- The basic `web_search_20250305` is also accepted. It is the only one on Vertex and on Foundry hosted on Azure.
- SDK 1.8.0 has both `WebSearchTool20260209` and `WebSearchTool20260318`.
- On the 20260209+ versions, `allowed_callers` defaults to `["code_execution_20260120"]`. Code execution is provisioned automatically, costs nothing beyond tokens, and is not eligible for zero data retention. Don't add your own code_execution tool. Set `allowed_callers: ["direct"]` to turn filtering off.

**allowed_domains**
- `["usc.edu"]` covers subdomains such as dps.usc.edu and viterbi.usc.edu.
- `"dps.usc.edu"` alone covers only that subdomain.
- No scheme. Wildcards are allowed only in the path (e.g. `usc.edu/*`). A path suffix works for search.
- Can't be combined with `blocked_domains` (400).
- Must be a subset of the organization-level allowed list, which may be an issue through Netlify's gateway since that organization is Netlify's.
- Results from other domains are silently dropped. USC sites on non-usc.edu domains must be listed explicitly.

**max_uses**
- Caps searches per turn, and a turn can span several pause_turn resumes. Failed searches count.
- Going over returns a result with error `max_uses_exceeded`. With dynamic filtering, the code-execution run ends with an error instead.

**Response format**
- `server_tool_use` (`id` "srvtoolu_...", `input.query`), then `web_search_tool_result`.
  - Its `content` is either an array of `web_search_result` `{url, title, page_age, encrypted_content}`, or an error object `{type: "web_search_tool_result_error", error_code}`.
  - Error codes: too_many_requests, invalid_tool_input, max_uses_exceeded, query_too_long, request_too_large, unavailable.
  - Errors come back as HTTP 200. No results is an empty list, not an error.
- Answer `text` blocks carry `citations[]` of `{type: "web_search_result_location", url, title, encrypted_index, cited_text}`. `cited_text` is at most 150 characters.
- `usage.server_tool_use.web_search_requests` counts the searches.
- When showing API output directly to users, the citations must be shown.
- For later turns, send the assistant blocks back unchanged, including `encrypted_content`.
- On API 2026-10-21 (SDK 1.x), a `text` block with citations inside a **user** message returns 400.

**pause_turn**
- Send the paused assistant content back unchanged, with the same tools. It can pause again: keep every paused response in order and cap the number of resumes.
- `client.beta.messages.toolRunner` resumes on its own (SDK 0.121.0 and later).
- If Claude calls a client tool in the same turn, `stop_reason` is "tool_use" instead. Reply with only the `tool_result` blocks.

**Pricing:** $10 per 1,000 searches plus tokens. Search results are billed as input tokens, in later turns too. Failed searches are free. The `cited_text`, `title` and `url` fields are not billed.

**Organization setting:** web search is on unless an admin turns it off on the Console Capabilities page; then the request returns 400 `invalid_request_error`.

**Opus 5.5 rules that affect this code**
- No `temperature`: it is removed from SDK 1.x and from API 2026-10-21.
- Thinking is always on; omit the `thinking` parameter.
- Effort defaults to medium.
- Forcing a tool with `tool_choice` any or tool returns 400, so steer it from the system prompt.
- Structured outputs (`output_config.format`) return 400 when citations are on, and web search citations are always on. Expect that combination to fail (untested). For a "flag this for the script" feature, use a strict client tool instead.
- Server-side `fallbacks` (beta `server-side-fallback-2026-07-01`, `fallbacks: "default"`; present in 1.8.0's beta types) is recommended on a direct key, but can't pass through the Netlify gateway.

**Minimal Node example.** It passes strict `tsc` against @anthropic-ai/sdk 1.8.0 and ran correctly on a mocked fetch: the pause_turn resume, the Bearer header and version 2026-10-21 were observed, and citations were extracted. Files: /tmp/claude-0/-home-user/be3b6c8f-ab79-560b-ad3e-b16af1176ed0/scratchpad/sdk-check/usc-answer.mjs and /tmp/claude-0/-home-user/be3b6c8f-ab79-560b-ad3e-b16af1176ed0/scratchpad/sdk-check/test-mock.mjs
```js
// netlify/functions/usc-answer.mjs
import Anthropic from "@anthropic-ai/sdk";
const client = new Anthropic({ timeout: 50_000, maxRetries: 1 }); // gateway-injected or own ANTHROPIC_API_KEY; stay under 60 s
/** @type {Anthropic.WebSearchTool20260318} */
const USC_WEB_SEARCH = { type: "web_search_20260318", name: "web_search", max_uses: 3, allowed_domains: ["usc.edu"] };
const SYSTEM = "You answer questions from USC students. Use web_search, which only returns usc.edu pages. " +
  "Answer only from what those pages say. If they do not answer the question, say so plainly.";
/** @param {Anthropic.MessageParam[]} messages */
function ask(messages) {
  return client.messages.create({ model: "claude-opus-5-5", max_tokens: 2048, output_config: { effort: "low" },
    system: SYSTEM, tools: [USC_WEB_SEARCH], messages });
}
/** @param {Request} req */
export default async (req) => {
  const body = await req.json().catch(() => ({}));
  const question = String(body?.question ?? "").slice(0, 2000);
  if (!question) return Response.json({ error: "question is required" }, { status: 400 });
  /** @type {Anthropic.MessageParam[]} */
  const messages = [{ role: "user", content: question }];
  try {
    let res = await ask(messages);
    for (let n = 0; res.stop_reason === "pause_turn" && n < 2; n++) {
      messages.push({ role: "assistant", content: res.content }); // resend paused turn unchanged
      res = await ask(messages);
    }
    if (res.stop_reason === "refusal") return Response.json({ answer: null, sources: [], stop_reason: res.stop_reason });
    let answer = ""; /** @type {Map<string, string | null>} */ const sources = new Map();
    for (const block of res.content) {
      if (block.type === "web_search_tool_result" && !Array.isArray(block.content)) console.warn("web_search error:", block.content.error_code);
      if (block.type !== "text") continue;
      answer += block.text;
      for (const c of block.citations ?? []) if (c.type === "web_search_result_location") sources.set(c.url, c.title);
    }
    return Response.json({ answer, sources: [...sources].map(([url, title]) => ({ url, title })),
      searches: res.usage.server_tool_use?.web_search_requests ?? 0, stop_reason: res.stop_reason });
  } catch (err) {
    if (err instanceof Anthropic.APIError) return Response.json({ error: `Claude API ${err.status ?? ""}`.trim() }, { status: 502 });
    throw err;
  }
};
export const config = { path: "/api/usc-answer", method: "POST" };
```
The scratchpad file is the same code with comments and the line breaks I used for the type check.

## 5. DOES A CLAUDE.AI SUBSCRIPTION GIVE FREE API ACCESS?

**A paid plan alone does not include API or Console access.** "A paid Claude subscription enhances your chat experience, and the Claude API is billed separately." (support.claude.com/en/articles/9876003)

**Exception: monthly Claude API credits**

| Plan | Monthly credit |
|---|---|
| Max | $100 |
| Ultra | $200 |
| Team | $20 per Standard seat, $100 per Premium seat, pooled and capped at $500 |
| Free, Pro, Enterprise | not eligible |

(platform.claude.com/docs/en/about-claude/api-credits-for-subscribers; support.claude.com/en/articles/17154008)
- **Claiming:** on claude.ai go to Settings > Billing (Team: Organization settings > Billing) > API credits > link a Console organization. Each plan links to one organization, and only support can change the link. New subscribers wait 7 days.
- **Refresh:** each billing cycle, with no rollover.
- **What they cover:** the Claude API (Messages and Batches), Managed Agents, the Agent SDK and the Console playground.
- **What they don't cover:** Claude Code, extra usage in the Claude apps, Bedrock, Vertex, Foundry, and Claude Platform on AWS.
- **When they run out:** requests stop. Nothing is charged to the Claude plan unless the organization has purchased credits or auto-reload.
- **Rate tier:** the linked organization moves up to at least the Start tier, or the Build tier if the credits exceed $200.
- Web search fees are Claude API usage, so they should draw on these credits; the page doesn't say so explicitly.

**How to use the credits in this app:** create a key in the linked Console organization and set it as the Netlify env var `ANTHROPIC_API_KEY` with Functions scope, in the UI or CLI. Netlify then stops injecting the gateway variables for Anthropic and the SDK calls api.anthropic.com directly. The user does this step; the key should never be pasted in chat.

**The Netlify AI Gateway is a separate free path.** It is billed to Netlify credits, not the Claude plan.

**claude.ai artifacts, `window.claude` `sample` capability**
- It spends the **viewer's** own Claude usage. The first call in a view asks the viewer for consent. Answers are cached for 5 minutes, and a flood of calls is rejected as `rate_limited`.
- The creator pays nothing and needs no API key. On Team and Enterprise, people in the organization use shared artifacts at no cost to the creator. Viewers sign in with their own Claude account.
- `sample` has no web access: each call sees only what the page sends plus page-defined tools. It cannot do the USC web search by itself.
- Sources: support.claude.com/en/articles/9487310-what-are-artifacts-and-how-do-i-use-them, and the bundled artifact-capabilities contract 0.2.96 sample.d.ts ("A call that reaches Claude spends the VIEWER's own Claude usage").

**Recommendation for the parent**
- If the user is on Max, Ultra or Team: claim the API credits and use a direct key. That route documents web search, beta fallbacks and 1M context.
- Otherwise use the Netlify AI Gateway, which needs no key but gives only about $1.67/month of model usage on the Free plan.
- Before building, test once after deploying: (a) whether the gateway accepts `anthropic-version` 2026-10-21, and (b) whether web search works through it.

**Needs the user's permission or action**
- Netlify: a Team Owner turns on AI features; one production deploy; a Netlify personal access token if you want to call the token endpoint.
- Anthropic: claim the credits, create a key, set the env var.
- Luma: Luma Plus and a calendar API key.
- This session: allow public-api.luma.com, api.lu.ma and docs.netlify.com if live testing or full docs are needed.

**Downloaded sources for reference:** /tmp/claude-0/-home-user/be3b6c8f-ab79-560b-ad3e-b16af1176ed0/scratchpad/netlify-src (ai-gateway-SKILL.md, blobs-SKILL.md, functions-SKILL.md, providers-detailed.json, swagger.yml) and /tmp/claude-0/-home-user/be3b6c8f-ab79-560b-ad3e-b16af1176ed0/scratchpad/dl-agentrunner/x/package/dist/skills/netlify-ai-gateway/SKILL.md