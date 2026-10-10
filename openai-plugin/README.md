# ChatGPT plugin package

The ZIP that `platform.openai.com/plugins` accepts (Agent Plugins format): `plugin.json`, `mcp.json`, `assets/icon.svg`.
It points ChatGPT at the hosted server, `https://varosity.ai/api/mcp`; sign-in is OAuth, discovered from the server.

```bash
./build.sh                                  # varosity-openai-plugin.zip, enough for the upload checks
DEMO_URL=https://youtu.be/... ./build.sh    # adds the demo video link, required to submit for review
```

Edit listing text and the review test cases in `plugin.json`, then rebuild and re-upload; the portal treats imported
test cases as read-only.

## Submission steps (in order)

1. **Verify identity** — platform.openai.com → Settings → Organization → General → Verifications → Business → Start.
   Nothing can be uploaded before this. Use the name "Varosity Inc." so it matches `developerName`.
2. **Upload** `varosity-openai-plugin.zip` at platform.openai.com/plugins and fix any automated findings.
3. **Domain check** — the portal shows a token. Set it in Vercel as `OPENAI_APPS_CHALLENGE` (Production) and redeploy;
   it is then served at `https://varosity.ai/.well-known/openai-apps-challenge`.
4. **Review details** — reviewer test account (password sign-in, no MFA or email codes, funded, with a project named
   "Reviewer demo" holding two rendered shots — test case 5 expects it) and the notes in the maintainer runbook.
5. **Demo video** — 2–3 minutes: connect in ChatGPT, the consent screen with the spend cap, list models, one image, one
   video with status polling, disconnect. Rebuild with `DEMO_URL=` and re-upload.
6. **Submit for review**, then **Publish** once approved.

## Not verified yet

- The portal's own validation of this ZIP (upload is blocked until step 1).
- Whether `mcp.json` needs an explicit OAuth block. The published schema does not allow one on a server entry, and
  ChatGPT's custom-server flow discovered OAuth on its own (tested 2026-10-09), so it is left out. If the portal's
  "Complete MCP setup" check asks for it, the documented shape is
  `extensions["com.openai"].auth = { "type": "oauth", "client": { "mode": "cimd" } }` on the server entry.
- `category: "Creativity"` is taken from the directory's section name.
