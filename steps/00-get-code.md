---
id: get-code
title: מורידים את הקוד ופותחים ב-Claude Code
minutes: 10
check: none
path: claude
---

## בקצרה
1. בריפו של הערכה: **Use this template** ‹ **Private** ‹ **Create**.
2. ב-VS Code: **Clone Repository** עם הכתובת של הריפו החדש.
3. ב-Claude Code כותבים `/start`.

## למה
במסלול הזה Claude עובד איתך על עותק של הקוד שיושב אצלך במחשב. הוא מסביר כל שלב, עושה בעצמו את מה שאפשר, ויכול גם לשנות את הבוט לפי בקשה.

## מה עושים
1. מוודאים שמותקנים: [Node.js](https://nodejs.org) (גרסת LTS), [Git](https://git-scm.com/downloads), [VS Code](https://code.visualstudio.com) והתוסף **Claude Code** ב-VS Code. צריך גם מנוי Claude (Pro ומעלה).
2. נכנסים ל-[הריפו של הערכה](https://github.com/roshilabs-hq/telegram-assistant), לוחצים **Use this template** ‹ **Create a new repository**, נותנים שם, בוחרים **Private**, ולוחצים **Create**.
3. בריפו החדש לוחצים **Code** ומעתיקים את הכתובת.
4. ב-VS Code: **File** ‹ **Clone Repository** (או F1 ← `Git: Clone`), מדביקים את הכתובת ובוחרים תיקייה.
5. כשהתיקייה נפתחת, פותחים את Claude Code (סמל ה-Claude בצד) וכותבים `/start`.

## איך יודעים שהצליח
Claude עונה בעברית ומתחיל להוביל אותך בשלב הבא.

## נתקעתי
- **`/start` לא מוכר**: התיקייה שנפתחה ב-VS Code היא לא תיקיית הריפו עצמה. פותחים בדיוק את התיקייה שיש בה `README.md` ו-`package.json` (**File** ‹ **Open Folder**).
- **אין כפתור Use this template**: צריך להיות מחוברים ל-GitHub.
