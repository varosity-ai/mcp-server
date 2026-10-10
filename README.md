# `@varosity/mcp-server`

Stdio MCP server for [Varosity AI](https://varosity.ai) — one API key for 60+ video, image, voice, and music models. Exposes every Varosity tool (generate video, images, voice, music, storyboards, render, list models, templates, webhooks, …) to any MCP-aware host — Claude Desktop, Cursor, Cowork, Continue, etc.

Copy-paste setup for each agent host: **<https://varosity.ai/connect>**.

Under the hood it proxies every JSON-RPC call to `${VAROSITY_API_BASE}/api/mcp` over HTTPS with your `vsk_...` bearer token. Zero runtime deps.

## Claude Desktop

Edit `~/Library/Application Support/Claude/claude_desktop_config.json`:

```json
{
  "mcpServers": {
    "varosity": {
      "command": "npx",
      "args": ["-y", "@varosity/mcp-server"],
      "env": {
        "VAROSITY_API_KEY": "vsk_..."
      }
    }
  }
}
```

Issue a `vsk_...` token at [varosity.ai/app/keys/api-keys](https://varosity.ai/app/keys/api-keys). Restart Claude Desktop.

## Cursor / Cowork / Continue

Any MCP host that supports the `command + args + env` shape works. Point it at `npx -y @varosity/mcp-server` with `VAROSITY_API_KEY` in the env.

## Tools exposed

40+ tools. This package is a pure proxy, so the live list (with input schemas) always comes from `tools/list`. Current surface:

- **Discover** — `list_models`, `list_voices`, `suggest_model` (Smart Route), `refresh_skills`
- **Video** — `generate_video`, `get_job`, `pick_reference_images`, `render_shot`, `render_project`
- **Images** — `generate_image`
- **Voice & audio** — `generate_voice`, `clone_voice`, `design_voice`, `voice_changer`, `sound_effect`, `transcribe_audio`, `clip_audio`
- **Music** — `generate_music`
- **Projects & templates** — `list_projects`, `get_project`, `create_project`, `delete_project`, `list_templates`, `create_project_from_template`
- **Storyboards** — `plan_storyboard`, `suggest_storyboard_mode`, `generate_storyboard_grid`, `generate_storyboard_keyframes`, `regenerate_keyframe`, `generate_storyboard_audio`, `render_storyboard`
- **Brand agents** — `list_brand_agents`, `run_brand_agent`, `plan_brand_run`, `generate_creative_bible`, `generate_end_card`, `gate_decide`
- **Webhooks** — `list_webhooks`, `create_webhook`, `test_webhook`, `delete_webhook`
- **Provenance** — `verify_asset`, `govern_asset`

`generate_video` returns a `jobId`; poll `get_job` until `status` is `succeeded`, then read `outputUrl`.

## Alternative: direct HTTP

If your MCP host supports the Streamable HTTP transport, you can skip this package entirely:

```json
{
  "mcpServers": {
    "varosity": {
      "url": "https://varosity.ai/api/mcp",
      "transport": "streamable-http",
      "headers": {
        "Authorization": "Bearer vsk_..."
      }
    }
  }
}
```

This stdio package exists for hosts that only support the `command`-spawned stdio transport.

## Self-host / point at a different deploy

Set `VAROSITY_API_BASE` in the env block to override the default `https://varosity.ai`.

## Publish

```bash
cd packages/mcp-server
pnpm build
npm publish --access public
```

