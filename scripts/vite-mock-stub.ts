
import { existsSync } from "node:fs";
import { resolve, sep } from "node:path";
import type { Plugin } from "vite";

const MOCK_MODULES = ["popup-data", "hover-card", "settings"] as const;

const MOCK_DIR = resolve("src/mock");

function mockName(source: string, importer: string | undefined): string | undefined {

  if (source.startsWith(MOCK_DIR + sep)) {
    const rest = source.slice(MOCK_DIR.length + 1).replace(/\.(ts|tsx|js|mjs)$/, '');
    return known(rest);
  }

  const aliased = /^(?:@|~)\/mock\/([a-z0-9-]+)$/.exec(source);
  if (aliased) return known(aliased[1]);

  const relative = /^\.{1,2}\/([a-z0-9-]+)$/.exec(source);
  if (relative && (importer ?? '').startsWith(MOCK_DIR + sep)) return known(relative[1]);
  return undefined;
}

function known(name: string): string | undefined {
  return (MOCK_MODULES as readonly string[]).includes(name) ? name : undefined;
}

export function mockStub(active: boolean): Plugin {
  return {
    name: "kaito-mock-stub",

    enforce: "pre",
    resolveId(source, importer) {
      if (!active) return null;

      if ((importer ?? '').endsWith('.stub.ts')) return null;
      const name = mockName(source, importer);
      if (!name) return null;
      const stub = resolve(MOCK_DIR, `${name}.stub.ts`);

      if (!existsSync(stub)) {
        this.error(`[kaito-mock-stub] ${source} has no stub at ${stub} — a release build must not resolve the real mock module`);
      }
      return stub;
    },
  };
}
