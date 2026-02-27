export function parseAuthor(author: string): { name: string; url?: string } {
  const match = author.match(/^(.+?)\s*<(.+?)>$/);
  if (match) {
    return { name: match[1].trim(), url: match[2].trim() };
  }
  return { name: author };
}

/** Returns true if versionA >= versionB (semver comparison) */
export function versionGte(versionA: string, versionB: string): boolean {
  const parse = (v: string) => v.split(".").map((n) => parseInt(n, 10) || 0);
  const a = parse(versionA);
  const b = parse(versionB);
  const len = Math.max(a.length, b.length);
  for (let i = 0; i < len; i++) {
    const diff = (a[i] ?? 0) - (b[i] ?? 0);
    if (diff !== 0) return diff > 0;
  }
  return true;
}
