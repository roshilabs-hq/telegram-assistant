import pkg from "../package.json" with { type: "json" };

/** הגרסה שרצה עכשיו, ומה הגרסה האחרונה של הערכה. */
export const VERSION = pkg.version;
const UPSTREAM = "https://raw.githubusercontent.com/roshilabs-hq/telegram-assistant/main/package.json";

/** האם a חדשה מ-b (SemVer פשוט: שובר.תוספת.תיקון). */
export function isNewer(a, b) {
  const pa = String(a).split(".").map(Number);
  const pb = String(b).split(".").map(Number);
  for (let i = 0; i < 3; i++) if ((pa[i] || 0) !== (pb[i] || 0)) return (pa[i] || 0) > (pb[i] || 0);
  return false;
}

/** הגרסה האחרונה שפורסמה. null אם GitHub לא ענה (לא מפילים את עמוד ההקמה בגלל זה). */
export async function latestVersion(fetchImpl = fetch) {
  try {
    const r = await fetchImpl(UPSTREAM, { signal: AbortSignal.timeout(3000) });
    return r.ok ? (await r.json()).version || null : null;
  } catch {
    return null;
  }
}

/** הריפו של הלקוח ב-GitHub, מהמשתנים ש-Vercel מוסיף לבד. null מחוץ ל-Vercel. */
export function ownRepo() {
  const owner = process.env.VERCEL_GIT_REPO_OWNER;
  const slug = process.env.VERCEL_GIT_REPO_SLUG;
  return owner && slug ? `https://github.com/${owner}/${slug}` : null;
}
