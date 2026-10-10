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
/** Keep in sync with package.json — reported to the host in `initialize`. */
const VERSION = "0.1.2";
const PROTOCOL_VERSIONS = ["2025-06-18", "2025-03-26", "2024-11-05"];

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

/** An error that already carries the JSON-RPC code to report. */
class RpcError extends Error {
  constructor(
    readonly code: number,
    message: string,
  ) {
    super(message);
  }
}

/** Matches the server's own limit, so the proxy never gives up on a call the server is still running (and billing). */
const UPSTREAM_TIMEOUT_MS = 300_000;

async function proxyToHttp(method: string, params: unknown): Promise<unknown> {
  if (!API_KEY) {
    throw new RpcError(
      -32001,
      "VAROSITY_API_KEY is not set — add it to the MCP host config's env block.",
    );
  }
  const res = await fetch(`${BASE}/api/mcp`, {
    method: "POST",
    signal: AbortSignal.timeout(UPSTREAM_TIMEOUT_MS),
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
  // The upstream normally answers with a JSON-RPC envelope, but a gateway
  // error (HTML 502) or the rate limiter (`{ error: "…" }`) does not. Always
  // turn those into a real error: a reply with neither result nor error is
  // invalid JSON-RPC and strict hosts drop the connection.
  const body = (await res.json().catch(() => null)) as
    | { result?: unknown; error?: unknown }
    | null;
  const err = body?.error;
  if (err && typeof err === "object") {
    const e = err as { code?: unknown; message?: unknown };
    throw new RpcError(
      typeof e.code === "number" ? e.code : -32000,
      typeof e.message === "string" && e.message ? e.message : `Varosity returned HTTP ${res.status}`,
    );
  }
  if (typeof err === "string" && err) throw new RpcError(-32000, err);
  if (!res.ok || !body || body.result === undefined) {
    throw new RpcError(-32000, `Varosity returned HTTP ${res.status} with no usable body`);
  }
  return body.result;
}

/**
 * The tool catalog without credentials, from the public server card. Lets a
 * host (or a directory scanner) list the tools before a key is configured;
 * calling a tool still needs VAROSITY_API_KEY.
 */
async function publicToolList(): Promise<unknown> {
  const res = await fetch(`${BASE}/.well-known/mcp/server-card.json`, {
    signal: AbortSignal.timeout(UPSTREAM_TIMEOUT_MS),
  });
  if (!res.ok) throw new Error(`Could not load the Varosity tool list (HTTP ${res.status})`);
  const card = (await res.json()) as { tools?: unknown[] };
  return { tools: card.tools ?? [] };
}

async function handle(req: JsonRpcRequest): Promise<void> {
  // Notifications (no id — e.g. notifications/initialized) must never get a
  // response; replying breaks strict JSON-RPC clients.
  if (req.id === undefined || req.method.startsWith("notifications/")) return;

  try {
    switch (req.method) {
      case "initialize": {
        const requested = (req.params as { protocolVersion?: unknown } | undefined)?.protocolVersion;
        respond(req.id, {
          protocolVersion:
            typeof requested === "string" && PROTOCOL_VERSIONS.includes(requested)
              ? requested
              : PROTOCOL_VERSIONS[0],
          capabilities: { tools: {} },
          serverInfo: {
            name: "Varosity AI (stdio proxy)",
            version: VERSION,
          },
        });
        return;
      }

      case "ping":
        respond(req.id, { ok: true });
        return;

      case "tools/list": {
        respond(req.id, API_KEY ? await proxyToHttp(req.method, req.params) : await publicToolList());
        return;
      }

      case "tools/call": {
        const result = await proxyToHttp(req.method, req.params);
        respond(req.id, result);
        return;
      }

      // Unknown methods — forward anyway. The HTTP endpoint returns a
      // JSON-RPC -32601 if it doesn't know the method, which we surface
      // as-is.
      default:
        respond(req.id, await proxyToHttp(req.method, req.params));
        return;
    }
  } catch (err) {
    respondError(
      req.id,
      err instanceof RpcError ? err.code : -32000,
      err instanceof Error ? err.message : "Unknown error",
    );
  }
}

// Main stdio loop. One JSON-RPC message per line.
const pending = new Set<Promise<void>>();
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
  // Anything that is not a request object with a method (null, a stray
  // response, a batch) is refused here rather than crashing in handle().
  if (Array.isArray(req)) {
    respondError(null, -32600, "Batch requests are not supported");
    return;
  }
  const shaped = req as { id?: unknown; method?: unknown } | null;
  if (!shaped || typeof shaped !== "object" || typeof shaped.method !== "string") {
    const id = shaped && typeof shaped === "object" ? shaped.id : undefined;
    if (typeof id === "string" || typeof id === "number") respondError(id, -32600, "Invalid Request");
    return;
  }
  const task = handle(req)
    .catch(() => {})
    .finally(() => pending.delete(task));
  pending.add(task);
});

// Exit when stdin closes (MCP host shutdown) — but only after in-flight
// requests have answered. Exiting immediately dropped the reply to any
// request still waiting on the network (e.g. a scanner that pipes
// initialize + tools/list and closes stdin).
rl.on("close", () => {
  // Never outlive the host by more than a few seconds over a stalled request.
  setTimeout(() => process.exit(0), 10_000).unref();
  void Promise.allSettled([...pending]).then(() => process.exit(0));
});
