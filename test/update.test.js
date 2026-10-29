import { test } from "node:test";
import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";

const SCRIPT = resolve("scripts/update.sh").replace(/\\/g, "/");
const tools = spawnSync("bash", ["-c", "command -v git && command -v ssh-keygen"]).status === 0;

/**
 * ערכה עם שתי גרסאות חתומות (1.0.0 ← 1.1.0, שמשנה את b2), ובוט של לקוח בלי היסטוריה משותפת,
 * עם שינוי משלו. מריצים את update.sh כמו ב-GitHub, עם npm מזויף.
 */
function run({ edit, npm = 0, key = "key" }) {
  const T = mkdtempSync(join(tmpdir(), "upd-")).replace(/\\/g, "/");
  const sh = `set -e; cd "$T"
g() { git -c user.name=t -c user.email=t@t -c gpg.format=ssh -c user.signingkey="$T/${key}" "$@"; }
ssh-keygen -q -t ed25519 -N "" -f key; ssh-keygen -q -t ed25519 -N "" -f other
echo "kit $(cat key.pub)" > signers
mkdir bin; BIN=$(cd bin; pwd); printf '#!/bin/sh\\nexit ${npm}\\n' > bin/npm; chmod +x bin/npm
mkdir kit; cd kit; git init -q -b main
printf '{"version":"1.0.0"}\\n' > package.json; printf 'a1\\na2\\na3\\n' > a.txt; printf 'b1\\nb2\\nb3\\n' > b.txt
g add -A; g commit -qm 1; g tag -s v1.0.0 -m 1.0.0
printf '{"version":"1.1.0"}\\n' > package.json; printf 'b1\\nKIT\\nb3\\n' > b.txt
g commit -qam 2; g tag -s v1.1.0 -m 1.1.0
cd ..; git init -q --bare origin.git; mkdir me; cd me; git init -q -b main
git -C ../kit archive v1.0.0 | tar x; g add -A; g commit -qm init
${edit}; g commit -qam mine; g remote add origin ../origin.git; g push -q origin main
MINE=1.0.0 LATEST=1.1.0 KIT="$T/kit" SIGNERS="$T/signers" OWNER=o OWNER_ID=1 PATH="$BIN:$PATH" bash "${SCRIPT}"`;
  const r = spawnSync("bash", ["-c", sh], { env: { ...process.env, T }, encoding: "utf8" });
  const show = (f) => spawnSync("git", ["-C", `${T}/origin.git`, "show", `main:${f}`], { encoding: "utf8" }).stdout;
  const out = { status: r.status, log: r.stdout + r.stderr, a: show("a.txt"), b: show("b.txt"), pkg: show("package.json") };
  rmSync(T, { recursive: true, force: true });
  return out;
}

test("עדכון: שינוי של הלקוח בשורה אחרת נשאר, והגרסה החדשה נכנסת", { skip: !tools }, () => {
  const r = run({ edit: "printf 'MINE\\na2\\na3\\n' > a.txt" });
  assert.equal(r.status, 0, r.log);
  assert.equal(r.a, "MINE\na2\na3\n");
  assert.equal(r.b, "b1\nKIT\nb3\n");
  assert.match(r.pkg, /1\.1\.0/);
});

test("עדכון: שינוי באותה שורה שהערכה שינתה עוצר בלי לדחוף, עם הודעה", { skip: !tools }, () => {
  const r = run({ edit: "printf 'b1\\nMINE\\nb3\\n' > b.txt" });
  assert.equal(r.status, 0, r.log);
  assert.match(r.log, /מתנגשת עם שינוי שעשית/);
  assert.equal(r.b, "b1\nMINE\nb3\n");
  assert.match(r.pkg, /1\.0\.0/);
});

test("עדכון: בדיקות שנכשלות על הקוד הממוזג לא דוחפות כלום", { skip: !tools }, () => {
  const r = run({ edit: "printf 'MINE\\na2\\na3\\n' > a.txt", npm: 1 });
  assert.notEqual(r.status, 0);
  assert.equal(r.b, "b1\nb2\nb3\n");
});

test("עדכון: תג שלא חתום במפתח של הערכה נדחה", { skip: !tools }, () => {
  const r = run({ edit: "printf 'MINE\\na2\\na3\\n' > a.txt", key: "other" });
  assert.notEqual(r.status, 0);
  assert.match(r.log, /allowed|signature/i, r.log);
  assert.equal(r.b, "b1\nb2\nb3\n");
});
