# Installing the Varosity MCP server (for AI agents)

1. The user needs a Varosity API key (`vsk_...`). They create one at https://varosity.ai/app/keys/api-keys (sign-up is free; generation spends prepaid credits or their own provider keys). Ask the user for it; do not invent one.
2. Add this to the host's MCP settings:

```json
{
  "mcpServers": {
    "varosity": {
      "command": "npx",
      "args": ["-y", "@varosity/mcp-server"],
      "env": { "VAROSITY_API_KEY": "vsk_..." }
    }
  }
}
```

Hosts that support remote servers can skip the package and use `https://varosity.ai/api/mcp` (Streamable HTTP) with OAuth sign-in or the header `Authorization: Bearer vsk_...`.

3. Verify: call `list_models`. It is free and returns the model catalog.

Network: the server talks only to `https://varosity.ai`. No telemetry, no hooks.
