# `@varosity/mcp-server`

Stdio MCP server for [Varosity AI](https://varosity.ai). Exposes every Varosity tool (generate video, voice, music, render, list models, list templates, webhooks, …) to any MCP-aware host — Claude Desktop, Cursor, Cowork, Continue, etc.

Under the hood it proxies every JSON-RPC call to `${VAROSITY_API_BASE}/api/mcp` over HTTPS with your `vsk_live_...` bearer token. Zero runtime deps.

## Claude Desktop

Edit `~/Library/Application Support/Claude/claude_desktop_config.json`:

```json
{
  "mcpServers": {
    "varosity": {
      "command": "npx",
      "args": ["-y", "@varosity/mcp-server"],
      "env": {
        "VAROSITY_API_KEY": "vsk_live_..."
      }
    }
  }
}
```

Issue a `vsk_live_...` token at [varosity.ai/app/keys/api-keys](https://varosity.ai/app/keys/api-keys). Restart Claude Desktop.

## Cursor / Cowork / Continue

Any MCP host that supports the `command + args + env` shape works. Point it at `npx -y @varosity/mcp-server` with `VAROSITY_API_KEY` in the env.

## Tools exposed

Full list via `tools/list`. Current surface:

- `list_models`, `list_voices`, `list_templates`
- `list_projects`, `create_project`, `get_project`, `create_project_from_template`
- `generate_video`, `generate_voice`, `generate_music`
- `suggest_model` (Smart Router)
- `get_job`, `render_project`
- `list_webhooks`, `create_webhook`, `test_webhook`, `delete_webhook`

## Alternative: direct HTTP

If your MCP host supports the Streamable HTTP transport, you can skip this package entirely:

```json
{
  "mcpServers": {
    "varosity": {
      "url": "https://varosity.ai/api/mcp",
      "transport": "streamable-http",
      "headers": {
        "Authorization": "Bearer vsk_live_..."
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
