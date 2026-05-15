#!/usr/bin/env node
/**
 * Varosity MCP Server — stdio transport.
 *
 * Claude Desktop / Cursor / any MCP host can spawn this process and
 * speak JSON-RPC 2.0 over stdio. It proxies every call to the
 * hosted HTTP endpoint at ${VAROSITY_API_BASE}/api/mcp (default
 * https://varosity.ai).
 *
 * Zero runtime deps — the MCP wire protocol is line-delimited
 * JSON-RPC 2.0 which Node handles natively (readline + fetch).
 *
 * Claude Desktop config (paste into claude_desktop_config.json):
 *
 *   {
 *     "mcpServers": {
 *       "varosity": {
 *         "command": "npx",
 *         "args": ["-y", "@varosity/mcp-server"],
 *         "env": { "VAROSITY_API_KEY": "vsk_live_..." }
 *       }
 *     }
 *   }
 *
 * The key never leaves your machine's MCP host config; the stdio
 * server reads it from env and forwards as Authorization: Bearer.
 */

import { createInterface } from "node:readline";

const BASE = process.env.VAROSITY_API_BASE ?? "https://varosity.ai";
const API_KEY = process.env.VAROSITY_API_KEY;

type JsonRpcRequest = {
  jsonrpc: "2.0";
  id?: string | number | null;
  method: string;
  params?: unknown;
};

type JsonRpcResponse = {
  jsonrpc: "2.0";
  id: string | number | null;
  result?: unknown;
  error?: { code: number; message: string };
};

function write(res: JsonRpcResponse): void {
  process.stdout.write(JSON.stringify(res) + "\n");
}

function respond(
  id: string | number | null | undefined,
  result: unknown,
): void {
  write({ jsonrpc: "2.0", id: id ?? null, result });
}

function respondError(
  id: string | number | null | undefined,
  code: number,
  message: string,
): void {
  write({ jsonrpc: "2.0", id: id ?? null, error: { code, message } });
}

async function proxyToHttp(method: string, params: unknown): Promise<unknown> {
  if (!API_KEY) {
    throw new Error(
      "VAROSITY_API_KEY is not set — add it to the MCP host config's env block.",
    );
  }
  const res = await fetch(`${BASE}/api/mcp`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${API_KEY}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      jsonrpc: "2.0",
      id: 1,
      method,
      params,
    }),
  });
  const body = (await res.json().catch(() => ({}))) as JsonRpcResponse;
  if (body.error) {
    throw new Error(body.error.message);
  }
  return body.result;
}

async function handle(req: JsonRpcRequest): Promise<void> {
  try {
    switch (req.method) {
      case "initialize":
        respond(req.id, {
          protocolVersion: "2024-11-05",
          capabilities: { tools: {} },
          serverInfo: {
            name: "Varosity AI (stdio proxy)",
            version: "0.1.0",
          },
        });
        return;

      case "ping":
        respond(req.id, { ok: true });
        return;

      case "tools/list":
      case "tools/call": {
        const result = await proxyToHttp(req.method, req.params);
        respond(req.id, result);
        return;
      }

      // Unknown methods — forward anyway. The HTTP endpoint returns a
      // JSON-RPC -32601 if it doesn't know the method, which we surface
      // as-is.
      default:
        try {
          const result = await proxyToHttp(req.method, req.params);
          respond(req.id, result);
        } catch (err) {
          respondError(
            req.id,
            -32601,
            err instanceof Error ? err.message : `Method not found: ${req.method}`,
          );
        }
        return;
    }
  } catch (err) {
    respondError(
      req.id,
      -32000,
      err instanceof Error ? err.message : "Unknown error",
    );
  }
}

// Main stdio loop. One JSON-RPC message per line.
const rl = createInterface({ input: process.stdin });
rl.on("line", (line) => {
  const trimmed = line.trim();
  if (!trimmed) return;
  let req: JsonRpcRequest;
  try {
    req = JSON.parse(trimmed) as JsonRpcRequest;
  } catch {
    respondError(null, -32700, "Parse error");
    return;
  }
  void handle(req);
});

// Exit cleanly when stdin closes (MCP host shutdown).
rl.on("close", () => process.exit(0));
