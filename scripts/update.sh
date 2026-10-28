#!/usr/bin/env bash
# מכניס לבוט גרסה חדשה של הערכה. רץ מתוך .github/workflows/update.yml, אחרי שהחתימה על התג אומתה.
# הקובץ הזה מגיע מהתג החתום (/tmp/kit), ולא מהריפו של הלקוח.
# קלט: MINE, LATEST, OWNER, OWNER_ID. רץ בתיקייה של הריפו של הלקוח.
set -euo pipefail

# שינוי של אדם: קומיט שאינו הראשון (העותק ש-Vercel או התבנית יצרו), שהמבצע שלו אינו כלי העדכון,
# ושנוגע במשהו מחוץ ל-.github. אז לא מעדכנים לבד, כדי לא למחוק את השינוי.
root=$(git rev-list --max-parents=0 HEAD | tail -1)
for c in $(git rev-list --no-merges "$root"..HEAD); do
  case "$(git log -1 --format=%ce "$c")" in *github-actions*|*actions-template-sync*) continue ;; esac
  if git diff-tree --no-commit-id --name-only -r "$c" | grep -qv '^\.github/'; then
    echo "::warning::שינית את הקוד של הבוט בעצמך (קומיט $c), ולכן העדכון לגרסה $LATEST לא נכנס לבד. עם Claude Code כותבים: תעדכן את הבוט מהערכה."
    exit 0
  fi
done

rsync -a --delete --exclude .git --exclude .github/workflows --exclude .github/ISSUE_TEMPLATE --exclude '.env*' /tmp/kit/ ./
npm ci --no-audit --no-fund
npm test
rm -rf node_modules

# הכותב הוא בעל הריפו, כי Vercel בחשבון החינמי מעלה רק קוד של בעל החשבון.
# המבצע הוא github-actions, וכך הבדיקה למעלה יודעת שזה עדכון ולא שינוי של אדם.
git add -A
git -c user.name="github-actions[bot]" -c user.email="41898282+github-actions[bot]@users.noreply.github.com" \
  commit -q -m "🔄 עדכון מהערכה: $MINE ← $LATEST" --author="$OWNER <$OWNER_ID+$OWNER@users.noreply.github.com>"
git push origin HEAD
echo "עודכן לגרסה $LATEST. Vercel מעלה את הבוט תוך דקה או שתיים."
