# Trojan Hub with Ask Tommy on the Claude API

Trojan Hub is a student-made USC campus app. This folder holds the built app plus a small server function that lets **Ask Tommy** use Claude, with the API key kept secret on the server.

| Path | What it is |
|---|---|
| `site/index.html` | The whole app in one file |
| `netlify/functions/tommy.mjs` | Tommy's AI translator, served at `/api/tommy`. It holds the key and calls Claude |
| `netlify/functions/tommy-prompt.mjs` | Tommy's command list, generated from the app. Don't edit it by hand |
| `netlify.toml` | Tells Netlify what to publish and where the function is |

## Put it online (GitHub + Netlify)

1. Push this folder to a GitHub repo. Private is fine.
2. On netlify.com, go to **Add new site → Import an existing project → GitHub** and pick the repo. Leave the build settings as they are; `netlify.toml` already sets them. Click **Deploy**.
3. Go to **Site configuration → Environment variables → Add a variable**. Set the key to `ANTHROPIC_API_KEY`, paste the Claude API key as the value, keep all scopes, and save.
4. Go to **Deploys → Trigger deploy → Deploy site** so the function picks up the key.
5. Check it: open `https://<your-site>.netlify.app/api/tommy`. It should show `{"ok":true,...}`.

The key only ever goes in step 3. Don't put it in the HTML, in this repo, or in a chat message.

## Try it

Open the site, tap **Ask Tommy**, and send messages the built-in scripts can't read on their own:

- `yo can you sort out my thurs for me` should give a plan for Thursday
- `anything fun off campus this week` should give outings and field trips
- `where do i go to replace my lost id card` should look the question up
- `who teaches intro to civil engineering` should answer from USC's Schedule of Classes (CE 106, Amy Rechenmacher)

Under each answer, a small **AI → script** tag means Claude translated the message. Crisis and safety messages, such as someone being followed, never go to the server: Tommy answers them on the phone with the real numbers (DPS 213-740-4321, 911, 988).

## How it works and what it costs

- **When Claude is asked.** On this site, Tommy asks Claude first whenever a message isn't one of its exact commands ("plan my day" stays instant and on the phone). Crisis, safety and personal messages (health, mental health, sexual health, immigration, social security numbers) are never sent; Tommy handles them on the phone. Task wording such as "check my grades" can be translated, but the grades themselves never leave the phone: the script shows them there.
- **What the server sees.** The browser sends only the student's message and the last few message-to-command pairs. The server adds Tommy's instructions, asks Claude to turn the message into one Tommy command, and checks that the command exists. It never sends back free text. That means nobody can use your key as a general chatbot, and Claude never sees account data or results.
- **Model and cost.** The model is Claude Haiku 5.5 (`claude-haiku-5-5`) at low effort: its only job is turning a message into a Tommy script. Expect well under a tenth of a cent per message that needs it; prompt caching on the instructions makes repeat calls cheaper. Messages that match a script exactly cost nothing.
- **Changing the model.** Set a `TOMMY_MODEL` environment variable (for example `claude-sonnet-5-5`) and redeploy.
- **Limits.** Each visitor can send about 40 AI messages per 10 minutes. Also set a monthly **spend limit** in the Claude Console, since that's the only hard cap.
- **Turning it off.** Delete the `ANTHROPIC_API_KEY` variable and redeploy. Tommy keeps working on its built-in scripts.

## Rebuilding after the app changes

```bash
node scripts/build-netlify.cjs --project /path/to/trojan-hub-v4 --out ./netlify-site
```

Run this from the Trojan Hub project. It rebuilds the app and regenerates `tommy-prompt.mjs` so the command list matches the app.
