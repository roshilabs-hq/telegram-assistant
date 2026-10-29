#!/usr/bin/env bash
# מכניס לבוט גרסה חדשה של הערכה. רץ מתוך .github/workflows/update.yml, אחרי שהחתימה על התג אומתה.
# הקובץ הזה מגיע מהתג החתום (/tmp/kit), ולא מהריפו של הלקוח.
# קלט: MINE, LATEST, KIT, OWNER, OWNER_ID. רץ בתיקייה של הריפו של הלקוח.
set -euo pipefail
SIGNERS=${SIGNERS:-/tmp/signers}
stop() { echo "::warning::$1"; exit 0; }

# מיזוג: מה שהשתנה בערכה בין הגרסה של הלקוח לחדשה נכנס לתוך הקוד שלו, ושינויים שהוא עשה נשארים.
# לריפו של הלקוח אין היסטוריה משותפת עם הערכה (Vercel והתבנית יוצרים קומיט ראשון חדש),
# ולכן הבסיס למיזוג הוא התג החתום של הגרסה שלו.
git fetch -q --no-tags "$KIT" "refs/tags/v$MINE:refs/tags/kit-base" "refs/tags/v$LATEST:refs/tags/kit-new" \
  || stop "לא מצאתי בערכה את הגרסה שלך ($MINE), ולכן העדכון לא נכנס לבד. עם Claude Code כותבים: תעדכן את הבוט מהערכה. במסלול הדפדפן כותבים לנו."
for t in kit-base kit-new; do git -c gpg.ssh.allowedSignersFile="$SIGNERS" verify-tag "$t"; done

# התנגשות (אותה שורה שונתה גם אצלך וגם בערכה): לא נוגעים בכלום, והבוט ממשיך בגרסה הקודמת.
git diff --binary kit-base kit-new -- . ':!.github/workflows' ':!.github/ISSUE_TEMPLATE' ':!.env*' \
  | git apply --3way \
  || stop "הגרסה החדשה ($LATEST) מתנגשת עם שינוי שעשית בקוד של הבוט, ולכן שום דבר לא השתנה. עם Claude Code כותבים: תעדכן את הבוט מהערכה."

# הבדיקות רצות על הקוד הממוזג. נכשלו: יוצאים עם שגיאה בלי לדחוף.
npm ci --no-audit --no-fund
npm test
rm -rf node_modules

# הכותב הוא בעל הריפו, כי Vercel בחשבון החינמי מעלה רק קוד של בעל החשבון.
git add -A
git -c user.name="github-actions[bot]" -c user.email="41898282+github-actions[bot]@users.noreply.github.com" \
  commit -q -m "🔄 עדכון מהערכה: $MINE ← $LATEST" --author="$OWNER <$OWNER_ID+$OWNER@users.noreply.github.com>"
git push origin HEAD
echo "עודכן לגרסה $LATEST. Vercel מעלה את הבוט תוך דקה או שתיים."
