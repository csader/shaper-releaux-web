import { strToU8, zipSync } from "fflate";
import type { GeneratedFile } from "../types";

function triggerDownload(blob: Blob, filename: string) {
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  a.click();
  URL.revokeObjectURL(url);
}

function mimeTypeFor(filename: string): string {
  return filename.endsWith(".txt") ? "text/plain" : "image/svg+xml";
}

export function downloadFile(file: GeneratedFile) {
  triggerDownload(new Blob([file.content], { type: mimeTypeFor(file.name) }), file.name);
}

export function downloadAllAsZip(files: GeneratedFile[], zipName: string) {
  const entries: Record<string, Uint8Array> = {};
  for (const f of files) entries[f.name] = strToU8(f.content);
  const zipped = zipSync(entries);
  triggerDownload(new Blob([zipped], { type: "application/zip" }), zipName);
}
