
import { createHash } from "node:crypto";
import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { resolve } from "node:path";
import { Buffer } from "node:buffer";
import process from "node:process";
import type { Plugin } from "vite";

const SUFFIX = "?remote-inline";

const SPEC_RE = /(["'])(https?:\/\/[^"'\s]+)\?remote-inline\1/g;

const REWRITTEN_PREFIX = "virtual:remote-inline/";

const VIRTUAL_PREFIX = "\0remote-inline:";
const CACHE_DIR = resolve(process.cwd(), "node_modules/.cache/remote-inline");

const encodeUrl = (url: string): string => Buffer.from(url, "utf8").toString("base64url");
const decodeUrl = (token: string): string => Buffer.from(token, "base64url").toString("utf8");

export function remoteInline(): Plugin {
  return {
    name: "remote-inline",
    enforce: "pre",
    transform(code, id) {
      if (id.startsWith(VIRTUAL_PREFIX) || !code.includes(SUFFIX)) return null;
      SPEC_RE.lastIndex = 0;
      if (!SPEC_RE.test(code)) return null;
      SPEC_RE.lastIndex = 0;

      return code.replace(SPEC_RE, (_m, quote: string, url: string) =>
        `${quote}${REWRITTEN_PREFIX}${encodeUrl(url)}${quote}`);
    },
    resolveId(id) {
      if (!id.startsWith(REWRITTEN_PREFIX)) return null;
      return VIRTUAL_PREFIX + id.slice(REWRITTEN_PREFIX.length);
    },
    async load(id) {
      if (!id.startsWith(VIRTUAL_PREFIX)) return null;
      const dataUri = await fetchAsDataUri(decodeUrl(id.slice(VIRTUAL_PREFIX.length)));
      return `export default ${JSON.stringify(dataUri)};`;
    },
  };
}

const FETCH_RETRIES = 3;
const RETRY_DELAY_MS = 500;

async function fetchWithRetry(url: string): Promise<Response> {
  for (let attempt = 0; ; attempt++) {
    try {
      return await fetch(url);
    } catch (error) {
      if (attempt >= FETCH_RETRIES) throw error;
      await new Promise((r) => setTimeout(r, RETRY_DELAY_MS * (attempt + 1)));
    }
  }
}

async function fetchAsDataUri(url: string): Promise<string> {
  const cacheFile = resolve(CACHE_DIR, createHash("sha256").update(url).digest("hex"));
  if (existsSync(cacheFile)) return readFileSync(cacheFile, "utf8");

  const res = await fetchWithRetry(url);
  if (!res.ok) {
    throw new Error(`[remote-inline] ${res.status} ${res.statusText} for ${url}`);
  }
  const mime = res.headers.get("content-type")?.split(";")[0]?.trim() || "application/octet-stream";
  const base64 = Buffer.from(await res.arrayBuffer()).toString("base64");
  const dataUri = `data:${mime};base64,${base64}`;

  mkdirSync(CACHE_DIR, { recursive: true });
  writeFileSync(cacheFile, dataUri, "utf8");
  return dataUri;
}
