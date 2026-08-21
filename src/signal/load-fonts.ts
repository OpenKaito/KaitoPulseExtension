
import geistMonoWoff2 from "https://fonts.gstatic.com/s/geistmono/v6/or3nQ6H-1_WfwkMZI_qYFrcdmhHkjko.woff2?remote-inline";

import interWoff2 from "https://fonts.gstatic.com/s/inter/v20/UcC73FwrK3iLTeHuS_nVMrMxCp50SjIa1ZL7W0Q5nw.woff2?remote-inline";

const FACES: ReadonlyArray<{ family: string; bytes: string }> = [
  { family: "Geist Mono", bytes: geistMonoWoff2 },
  { family: "Inter", bytes: interWoff2 },
];

function dataUriToArrayBuffer(uri: string): ArrayBuffer {
  const base64 = uri.slice(uri.indexOf(",") + 1);
  const binary = atob(base64);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i);
  return bytes.buffer;
}

let started = false;

export async function ensureSignalFonts(): Promise<void> {
  if (started || typeof document === "undefined" || !("fonts" in document)) return;
  started = true;
  const results = await Promise.allSettled(
    FACES.map(async ({ family, bytes }) => {
      const face = new FontFace(family, dataUriToArrayBuffer(bytes), {
        style: "normal",
        weight: "100 900",
      });
      await face.load();
      document.fonts.add(face);
    }),
  );
  const failed = results.filter((r) => r.status === "rejected");
  if (failed.length > 0) {
    started = false;
    for (const r of failed) {
      console.warn("[signal] font load failed; falling back to system-ui", (r as PromiseRejectedResult).reason);
    }
  }
}
