---
id: deploy
title: מעלים את הבוט לאוויר
minutes: 7
check: deploy
---

## למה
הבוט צריך מחשב שדולק 24 שעות ביממה. **Vercel** הוא המחשב באינטרנט שהבוט ירוץ עליו, ו-**Supabase** הוא המחברת שבה הבוט זוכר תזכורות, פתקים ורשימות. בשניהם יש מסלול חינמי שמספיק לבוט אישי. בשלב הזה פותחים את שניהם ומעלים את הבוט.

## מה עושים
### בדפדפן
1. לוחצים על הכפתור: [![Deploy with Vercel](https://vercel.com/button)](https://vercel.com/new/clone?repository-url=https%3A%2F%2Fgithub.com%2Froshilabs-hq%2Ftelegram-assistant&project-name=telegram-assistant&repository-name=telegram-assistant&env=TELEGRAM_TOKEN%2CAI_API_KEY%2CSETUP_PASSWORD&envDescription=%D7%94%D7%98%D7%95%D7%A7%D7%9F%20%D7%9E-BotFather%2C%20%D7%9E%D7%A4%D7%AA%D7%97%20%D7%94-AI%2C%20%D7%95%D7%A1%D7%99%D7%A1%D7%9E%D7%AA%20%D7%94%D7%A7%D7%9E%D7%94%20%D7%A9%D7%AA%D7%91%D7%97%D7%A8%D7%95&envLink=https%3A%2F%2Fgithub.com%2Froshilabs-hq%2Ftelegram-assistant%2Fblob%2Fmain%2Fdocs%2Fbrowser.md%23step-deploy&stores=%5B%7B%22type%22%3A%22integration%22%2C%22integrationSlug%22%3A%22supabase%22%2C%22productSlug%22%3A%22supabase%22%2C%22protocol%22%3A%22storage%22%7D%5D)
2. Vercel מבקש להתחבר. בוחרים **Continue with GitHub**. אם אין לך חשבון GitHub, הוא יעזור לפתוח אחד בחינם. (GitHub הוא המקום שבו נשמר עותק של הקוד, שלך.)
3. **Create Git Repository**: משאירים את השם כמו שהוא, ולוחצים **Create**.
4. **Supabase**: Vercel מציע ליצור מסד נתונים. לוחצים **Add** או **Create**, מאשרים את החיבור לחשבון Supabase (או פותחים אחד), ובאזור (Region) בוחרים **Frankfurt** (הכי קרוב לישראל).
5. **Configure Project**: ממלאים שלושה שדות:
   - `TELEGRAM_TOKEN`: הטוקן מ-BotFather.
   - `AI_API_KEY`: המפתח מהשלב הקודם.
   - `SETUP_PASSWORD`: סיסמה חדשה שבוחרים עכשיו, לפחות 8 תווים. היא תשמש להיכנס לעמוד ההקמה. כדאי לשמור אותה.
6. לוחצים **Deploy** ומחכים דקה או שתיים, עד שמופיעים זיקוקים 🎉.
7. לוחצים **Continue to Dashboard**, ומעתיקים את הכתובת שמופיעה תחת **Domains**, משהו כמו `telegram-assistant-xxxx.vercel.app`. זו הכתובת של הבוט.

### עם Claude Code
1. כותבים ל-Claude: "תעלה את הבוט לאוויר". Claude מוודא ש-GitHub מחובר אצלך (`gh auth status`) ומעלה את הקוד לריפו פרטי חדש בחשבון שלך.
2. Claude פותח לך את [vercel.com/new](https://vercel.com/new). מתחברים עם GitHub, בוחרים את הריפו שנוצר ולוחצים **Import**.
3. תחת **Storage** (או **Integrations**) מוסיפים **Supabase**, ובאזור בוחרים **Frankfurt**.
4. תחת **Environment Variables** מוסיפים את שלושת השדות: `TELEGRAM_TOKEN`, `AI_API_KEY`, `SETUP_PASSWORD` (סיסמה חדשה, לפחות 8 תווים). את הערכים מעתיקים מהקובץ `.env.local` ש-Claude פתח לך. Claude לא רואה אותם.
5. לוחצים **Deploy**, ומעתיקים ל-Claude את הכתובת שמופיעה תחת **Domains**.

> בווינדוס עם שם משתמש בעברית, הפקודה `vercel` בטרמינל קורסת. לכן הפריסה עוברת דרך האתר של Vercel.

## איך יודעים שהצליח
נכנסים לכתובת של הבוט ומוסיפים בסוף `/setup`, למשל `https://telegram-assistant-xxxx.vercel.app/setup`. מופיע עמוד בעברית שמבקש את סיסמת ההקמה. נכנסים, והשורה "מעלים את הבוט לאוויר" מסומנת ✅.

## נתקעתי
- **ב-Deploy כתוב "Build Failed"**: לוחצים **Redeploy**. אם זה חוזר, מצלמים את המסך ופונים אלינו.
- **לא הופיעה הצעה ליצור Supabase**: בדשבורד של הפרויקט ב-Vercel נכנסים ל-**Storage** ‹ **Create Database** ‹ **Supabase** ‹ **Frankfurt** ‹ **Connect**. אחר כך **Deployments** ‹ **Redeploy**.
- **בעמוד ההקמה כתוב "חסרים SUPABASE_URL..."**: Supabase לא חובר לפרויקט. עושים את מה שכתוב בסעיף הקודם.
- **שכחתי את סיסמת ההקמה**: ב-Vercel ‹ **Settings** ‹ **Environment Variables** משנים את `SETUP_PASSWORD`, ואז **Redeploy**. בעמוד ההקמה לוחצים שוב "הפעילו הכול".
