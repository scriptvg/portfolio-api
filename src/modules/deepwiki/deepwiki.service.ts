const DEEPWIKI_MCP_URL = "https://mcp.deepwiki.com/mcp";

type JsonRpcResponse<T> = {
  jsonrpc: "2.0";
  id: number;
  result?: { content: Array<{ type: string; text: string }> } & T;
  error?: { code: number; message: string };
};

let requestId = 0;

async function callTool<T = unknown>(
  name: string,
  args: Record<string, unknown>
): Promise<string> {
  requestId += 1;
  const res = await fetch(DEEPWIKI_MCP_URL, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Accept: "application/json, text/event-stream"
    },
    body: JSON.stringify({
      jsonrpc: "2.0",
      id: requestId,
      method: "tools/call",
      params: { name, arguments: args }
    })
  });

  if (!res.ok) {
    throw new Error(`DeepWiki MCP HTTP ${res.status}: ${await res.text()}`);
  }

  const raw = await res.text();
  // The MCP endpoint answers as SSE: "event: message\ndata: {...}\n\n".
  // Fall back to raw JSON if no "data:" lines are present.
  const dataLines = raw
    .split("\n")
    .filter(l => l.startsWith("data:"))
    .map(l => l.slice(5).trim());
  const jsonText = dataLines.length > 0 ? dataLines.join("") : raw;

  const payload = JSON.parse(jsonText) as JsonRpcResponse<T>;
  if (payload.error) {
    throw new Error(`DeepWiki MCP error: ${payload.error.message}`);
  }
  return payload.result?.content?.map(c => c.text).join("\n\n") ?? "";
}

const CACHE_TTL_MS = 30 * 60 * 1000; // 30 min
const cache = new Map<string, { value: string; expiresAt: number }>();

async function cached(key: string, loader: () => Promise<string>) {
  const hit = cache.get(key);
  if (hit && hit.expiresAt > Date.now()) {
    return hit.value;
  }
  const value = await loader();
  cache.set(key, { value, expiresAt: Date.now() + CACHE_TTL_MS });
  return value;
}

export const DeepwikiService = {
  readStructure: (repoName: string) =>
    cached(`structure:${repoName}`, () =>
      callTool("read_wiki_structure", { repoName })
    ),
  readContents: (repoName: string) =>
    cached(`contents:${repoName}`, () =>
      callTool("read_wiki_contents", { repoName })
    ),
  ask: (repoName: string, question: string) =>
    callTool("ask_question", { repoName, question }),
  invalidate(repoName: string) {
    cache.delete(`structure:${repoName}`);
    cache.delete(`contents:${repoName}`);
  }
};
