/** Convert FormData to a plain object of strings, dropping empty values and files. */
export function formToObject(fd: FormData): Record<string, string> {
  const out: Record<string, string> = {};
  for (const [k, v] of fd.entries()) {
    if (typeof v === "string" && v.trim() !== "" && !k.startsWith("$")) out[k] = v;
  }
  return out;
}
