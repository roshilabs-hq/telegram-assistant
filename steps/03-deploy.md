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
1. לוחצים על הכפתור: [![Deploy with Vercel](https://vercel.com/button)](https://vercel.com/new/clone?repository-url=https%3A%2F%2Fgithub.com%2Froshilabs-hq%2Ftelegram-assistant&project-name=telegram-assistant&repository-name=telegram-assistant&env=TELEGRAM_TOKEN%2CAI_API_KEY%2CSETUP_PASSWORD&envDescription=BotFather%20token%2C%20AI%20key%2C%20and%20a%20setup%20password%20you%20choose%20%288%2B%20characters%29&envLink=https%3A%2F%2Fgithub.com%2Froshilabs-hq%2Ftelegram-assistant%2Fblob%2Fmain%2Fdocs%2Fbrowser.md%23step-deploy&stores=%5B%7B%22type%22%3A%22integration%22%2C%22integrationSlug%22%3A%22supabase%22%2C%22productSlug%22%3A%22supabase%22%2C%22protocol%22%3A%22storage%22%7D%5D)
2. Vercel מבקש להתחבר. לוחצים **GitHub**, ובחלון של GitHub לוחצים **Authorize**. (GitHub הוא המקום שבו נשמר עותק של הקוד, שלך.) ![](docs/img/deploy-1.png)
   - אם אחרי ההתחברות מופיע **404**, זו תקלה של Vercel: חוזרים להדרכה ולוחצים שוב על הכפתור. ההתחברות כבר נשמרה.
3. ב-**Git Scope** לוחצים **Add GitHub Scope**. נפתח חלון של GitHub: משאירים **All repositories** ולוחצים **Install**. ![](docs/img/deploy-6.png)
4. לוחצים **Create**. Vercel יוצר בחשבון שלך עותק פרטי של הקוד. ![](docs/img/deploy-7.png)
5. **Add Products ‹ Supabase**: לוחצים **Add** ‹ **Accept and Create**. ![](docs/img/deploy-8.png)
6. ב-**Primary Region** בוחרים **Frankfurt, Germany** (הכי קרוב לישראל). התוכנית החינמית (**Free Plan**) כבר מסומנת. לוחצים **Continue** ‹ **Create**, מחכים כחצי דקה ללחצן **Done** ולוחצים עליו. ![](docs/img/deploy-10.png)
7. **Add Environment Variables**: ממלאים שלושה שדות: ![](docs/img/deploy-13.png)
   - `TELEGRAM_TOKEN`: הטוקן מ-BotFather.
   - `AI_API_KEY`: המפתח מהשלב הקודם.
   - `SETUP_PASSWORD`: סיסמה חדשה שבוחרים עכשיו, לפחות 8 תווים. היא תשמש להיכנס לעמוד ההקמה. כדאי לשמור אותה.
8. לוחצים **Deploy** ומחכים כדקה, עד שמופיע **Congratulations!**. ![](docs/img/deploy-14.png)
9. לוחצים **Continue to Project**. תחת **Domains** מופיעה הכתובת של הבוט, משהו כמו `telegram-assistant-xxxx.vercel.app`. מעתיקים אותה.

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
- **אחרי ההתחברות ל-Vercel מופיע 404**: לוחצים שוב על כפתור ה-Deploy בהדרכה. ההתחברות כבר נשמרה, והפעם הטופס ייפתח.
- **ב-Deploy כתוב "Build Failed"**: לוחצים **Redeploy**. אם זה חוזר, מצלמים את המסך ופונים אלינו.
- **לא הופיעה הצעה ליצור Supabase**: בדשבורד של הפרויקט ב-Vercel נכנסים ל-**Storage** ‹ **Create Database** ‹ **Supabase** ‹ **Frankfurt** ‹ **Connect**. אחר כך **Deployments** ‹ **Redeploy**.
- **בעמוד ההקמה כתוב "חסרים SUPABASE_URL..."**: Supabase לא חובר לפרויקט. עושים את מה שכתוב בסעיף הקודם.
- **שכחתי את סיסמת ההקמה**: ב-Vercel ‹ **Settings** ‹ **Environment Variables** משנים את `SETUP_PASSWORD`, ואז **Redeploy**. בעמוד ההקמה לוחצים שוב "הפעילו הכול".
