---
id: get-code
title: מדביקים שורה אחת ב-Claude Code
minutes: 2
check: none
path: claude
---

## בקצרה
ב-Claude Code, בתיקייה ריקה, מדביקים:
```
תקים לי את העוזר האישי בטלגרם לפי https://raw.githubusercontent.com/roshilabs-hq/telegram-assistant/main/.claude/commands/start.md
```

## למה
מכאן Claude עושה בעצמו כל מה שאפשר לעשות מתוך המחשב: יוצר לך עותק של הקוד ב-GitHub, מייצר סיסמה, בודק את מה שהדבקת, מעלה את הבוט לאוויר ומפעיל אותו. אתה לוחץ רק באתרים שרק אתה יכול: BotFather, ספק ה-AI, ואישור בדפדפן.

## מה עושים
1. המסלול הזה מניח ש-Claude Code כבר מותקן ועובד אצלך ב-VS Code, עם Git ו-Node.js. עוד לא? [המסלול מהדפדפן](browser.md) מגיע לאותו בוט בלי להתקין כלום.
2. צריך חשבון [GitHub](https://github.com). **אין לך?** לוחצים [**Sign up**](https://github.com/signup), ממלאים מייל, סיסמה ושם משתמש באנגלית, ומקלידים את הקוד שמגיע במייל.
3. ב-VS Code פותחים תיקייה ריקה (**File** ‹ **Open Folder**), ופותחים את Claude Code (סמל ה-Claude בצד).
4. מדביקים את השורה, ושולחים:
   ```
   תקים לי את העוזר האישי בטלגרם לפי https://raw.githubusercontent.com/roshilabs-hq/telegram-assistant/main/.claude/commands/start.md
   ```

## איך יודעים שהצליח
Claude עונה בעברית, שואל כמה הסבר אתה רוצה, ומתחיל לבדוק מה מותקן אצלך.

## נתקעתי
- **Claude לא פותח את הקישור:** מדביקים את השורה שוב, ומוסיפים בסוף "תקרא את הקובץ בקישור ותעבוד לפיו".
- **Claude אומר שאין לו GitHub CLI:** זה בסדר. הוא ישלח לך קישור, ושם לוחצים **Create repository**.
