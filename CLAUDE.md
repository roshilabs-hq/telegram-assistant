# הבוט של המשתמש: הוראות ל-Claude

התיקייה הזו היא עותק של ערכת "עוזר אישי בטלגרם" (https://github.com/roshilabs-hq/telegram-assistant), בחשבון של המשתמש. מדברים איתו בעברית פשוטה. ההקמה: `/start`.

## לפני כל שינוי: `git pull`
העדכון האוטומטי דוחף ל-GitHub, והעותק במחשב נשאר מאחור. לכן לפני כל שינוי בקוד מריצים `git pull`. אם הוא נכשל בגלל שינויים מקומיים, עוצרים ושואלים. לא מוחקים שינויים בלי אישור.

## "תעדכן את הבוט מהערכה"
המשתמש מבקש את זה כשהעדכון האוטומטי לא נכנס, כי הגרסה החדשה מתנגשת עם שינוי שהוא עשה. לריפו שלו אין היסטוריה משותפת עם הערכה, ולכן `git merge` רגיל לא יעבוד. ממזגים את ההבדל בין הגרסה שלו לחדשה, בדיוק כמו `scripts/update.sh`:
1. `git pull`. הגרסה שלו (MINE) היא `version` ב-`package.json`. החדשה (LATEST) היא התג הגבוה ב-`git ls-remote --tags --refs https://github.com/roshilabs-hq/telegram-assistant 'v*'`.
2. `git fetch --no-tags https://github.com/roshilabs-hq/telegram-assistant.git refs/tags/v<MINE>:refs/tags/kit-base refs/tags/v<LATEST>:refs/tags/kit-new`
3. בודקים חתימה על שני התגים: כותבים לקובץ זמני `kit <KEY>`, כשהמפתח לקוח מהשורה `KEY:` ב-`.github/workflows/update.yml`, ומריצים `git -c gpg.ssh.allowedSignersFile=<הקובץ> verify-tag kit-base` ואותו דבר ל-`kit-new`. אם הבדיקה נכשלת, עוצרים ולא ממשיכים.
4. `git diff --binary kit-base kit-new -- . ':!.github/workflows' ':!.github/ISSUE_TEMPLATE' ':!.env*' | git apply --3way`
5. על כל התנגשות מסבירים למשתמש במשפט מה הוא שינה ומה השתנה בערכה, ומחליטים יחד מה נשאר.
6. `npm test`, ואז commit ("🔄 עדכון מהערכה: <MINE> ← <LATEST>") ו-push. Vercel מעלה את הבוט לבד, ואחרי זה מריצים `node scripts/setup.mjs activate`. בסוף מוחקים את שני התגים המקומיים: `git tag -d kit-base kit-new`.

(בריפו של הערכה עצמה, `roshilabs-hq/telegram-assistant`, הסעיף הזה לא חל.)
