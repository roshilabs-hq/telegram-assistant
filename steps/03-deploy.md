---
id: deploy
title: מעלים את הבוט לאוויר
minutes: 10
check: deploy
---

## בקצרה
### בדפדפן
> אין GitHub? פותחים בדרך (**Create an account** בחלון ההתחברות). יש Supabase? בכל זאת חדש כאן (2 פרויקטים חינמיים לחשבון).

1. [כפתור ה-Deploy](https://vercel.com/new/clone?repository-url=https%3A%2F%2Fgithub.com%2Froshilabs-hq%2Ftelegram-assistant&project-name=telegram-assistant&repository-name=telegram-assistant&env=TELEGRAM_TOKEN%2CAI_API_KEY%2CSETUP_PASSWORD&envDescription=BotFather%20token%2C%20AI%20key%2C%20and%20a%20setup%20password%20you%20choose%20%288%2B%20characters%29&envLink=https%3A%2F%2Fgithub.com%2Froshilabs-hq%2Ftelegram-assistant%2Fblob%2Fmain%2Fdocs%2Fbrowser.md%23step-deploy&stores=%5B%7B%22type%22%3A%22integration%22%2C%22integrationSlug%22%3A%22supabase%22%2C%22productSlug%22%3A%22supabase%22%2C%22protocol%22%3A%22storage%22%7D%5D) ‹ התחברות עם GitHub ‹ **Create**.
2. Supabase: **Add** ‹ **Frankfurt** ‹ **Create** ‹ **Done**.
3. שלושה משתנים: `TELEGRAM_TOKEN`, `AI_API_KEY`, `SETUP_PASSWORD` (8 תווים לפחות) ‹ **Deploy**.
4. מעתיקים את הכתובת מ-**Domains**.

### עם Claude Code
1. [vercel.com/new](https://vercel.com/new) ‹ **Import** של הריפו מהתבנית ‹ שלושת המשתנים מ-`.env.local` ‹ **Deploy**.
2. **Storage** ‹ Supabase חדש ב-Frankfurt ‹ **Redeploy**.
3. נותנים ל-Claude את הכתובת מ-**Domains**.

## למה
הבוט צריך מחשב שדולק 24 שעות ביממה. **Vercel** הוא המחשב באינטרנט שהבוט ירוץ עליו, ו-**Supabase** הוא המחברת שבה הבוט זוכר תזכורות, פתקים ורשימות. בשניהם יש מסלול חינמי שמספיק לבוט אישי. בשלב הזה פותחים את שניהם ומעלים את הבוט.

## מה עושים
### בדפדפן
1. לוחצים על הכפתור: [![Deploy with Vercel](https://vercel.com/button)](https://vercel.com/new/clone?repository-url=https%3A%2F%2Fgithub.com%2Froshilabs-hq%2Ftelegram-assistant&project-name=telegram-assistant&repository-name=telegram-assistant&env=TELEGRAM_TOKEN%2CAI_API_KEY%2CSETUP_PASSWORD&envDescription=BotFather%20token%2C%20AI%20key%2C%20and%20a%20setup%20password%20you%20choose%20%288%2B%20characters%29&envLink=https%3A%2F%2Fgithub.com%2Froshilabs-hq%2Ftelegram-assistant%2Fblob%2Fmain%2Fdocs%2Fbrowser.md%23step-deploy&stores=%5B%7B%22type%22%3A%22integration%22%2C%22integrationSlug%22%3A%22supabase%22%2C%22productSlug%22%3A%22supabase%22%2C%22protocol%22%3A%22storage%22%7D%5D)
2. Vercel מבקש להתחבר. לוחצים **GitHub**. (GitHub הוא המקום שבו נשמר עותק של הקוד, שלך, בחינם.) ![](docs/img/deploy-1.png)
   - **יש לך GitHub:** מתחברים, ובחלון של GitHub לוחצים **Authorize**.
   - **אין לך GitHub:** בחלון של GitHub לוחצים **Create an account**. ממלאים מייל, סיסמה ושם משתמש באנגלית, ומקלידים את הקוד שמגיע במייל. בסוף לוחצים **Authorize**.
   - **יש לך כבר Vercel** (נכנסת בעבר עם מייל או Google): מתחברים כמו תמיד. בסעיף הבא מחברים אליו את GitHub.
   - אם אחרי ההתחברות מופיע **404**, זו תקלה של Vercel: חוזרים להדרכה ולוחצים שוב על הכפתור. ההתחברות כבר נשמרה.
3. ב-**Git Scope** לוחצים **Add GitHub Scope**. נפתח חלון של GitHub: משאירים **All repositories** ולוחצים **Install**. זה נותן ל-Vercel גישה לחשבון ה-GitHub שלך, ובחשבון חדש אין בו עדיין כלום חוץ מהבוט. ![](docs/img/deploy-6.png)
   - **כבר מופיע שם החשבון שלך ב-Git Scope** (חיברת בעבר): לא צריך להוסיף. ממשיכים לסעיף הבא.
4. לוחצים **Create**. Vercel יוצר בחשבון שלך עותק פרטי של הקוד. ![](docs/img/deploy-7.png)
5. **Add Products ‹ Supabase**: לוחצים **Add** ‹ **Accept and Create**. ![](docs/img/deploy-8.png)
   - **יש לך כבר Supabase:** בכל זאת יוצרים כאן חדש **(מומלץ)**. הוא נפתח בלחיצה, בלי הרשמה, ולא נוגע בפרויקטים הקיימים שלך. בחשבון קיים יש מגבלה של 2 פרויקטים חינמיים, ופרויקט שלישי לא ייפתח.
6. ב-**Primary Region** בוחרים **Frankfurt, Germany** (הכי קרוב לישראל). התוכנית החינמית (**Free Plan**) כבר מסומנת. לוחצים **Continue** ‹ **Create**, מחכים כחצי דקה ללחצן **Done** ולוחצים עליו. ![](docs/img/deploy-10.png)
7. **Add Environment Variables**: ממלאים שלושה שדות: ![](docs/img/deploy-13.png)
   - `TELEGRAM_TOKEN`: הטוקן מ-BotFather.
   - `AI_API_KEY`: המפתח מהשלב הקודם.
   - `SETUP_PASSWORD`: סיסמה חדשה שבוחרים עכשיו, לפחות 8 תווים. היא תשמש להיכנס לעמוד ההקמה. כדאי לשמור אותה.
8. לוחצים **Deploy** ומחכים כדקה, עד שמופיע **Congratulations!**. ![](docs/img/deploy-14.png)
9. לוחצים **Continue to Project**. תחת **Domains** מופיעה הכתובת של הבוט, משהו כמו `telegram-assistant-xxxx.vercel.app`. מעתיקים אותה.

### עם Claude Code
1. כותבים ל-Claude: "תעלה את הבוט לאוויר". Claude פותח לך את [vercel.com/new](https://vercel.com/new).
2. מתחברים עם GitHub (מי שאין לו חשבון Vercel, נפתח לו אחד בדרך). ברשימה בוחרים את הריפו שיצרת בשלב "מורידים את הקוד" ולוחצים **Import**.
3. תחת **Environment Variables** מוסיפים שלושה שדות: `TELEGRAM_TOKEN`, `AI_API_KEY`, `SETUP_PASSWORD`. את הערכים מעתיקים מהקובץ `.env.local` ש-Claude פתח לך. Claude לא רואה אותם.
4. לוחצים **Deploy** ומחכים לסיום.
5. בדשבורד של הפרויקט: **Storage** ‹ **Create Database** ‹ **Supabase** ‹ **Frankfurt** ‹ **Create**. גם מי שכבר יש לו Supabase יוצר כאן חדש **(מומלץ)**, בגלל המגבלה של 2 פרויקטים חינמיים בחשבון.
6. **Deployments** ‹ שלוש נקודות ליד הפריסה העליונה ‹ **Redeploy**, כדי שהבוט יכיר את Supabase.
7. מעתיקים ל-Claude את הכתובת שמופיעה תחת **Domains**.

> בווינדוס עם שם משתמש בעברית, הפקודה `vercel` בטרמינל קורסת. לכן הפריסה עוברת דרך האתר של Vercel.

## איך יודעים שהצליח
נכנסים לכתובת של הבוט ומוסיפים בסוף `/setup`, למשל `https://telegram-assistant-xxxx.vercel.app/setup`. מופיע עמוד בעברית שמבקש את סיסמת ההקמה. נכנסים, והשורה "מעלים את הבוט לאוויר" מסומנת ✅.

> כדי לחזור לפרויקט ב-Vercel בעתיד (למשל להוסיף מפתח): נכנסים ל-[vercel.com](https://vercel.com), מתחברים עם GitHub, ולוחצים על `telegram-assistant`.

## נתקעתי
- **אחרי ההתחברות ל-Vercel מופיע 404**: לוחצים שוב על כפתור ה-Deploy בהדרכה. ההתחברות כבר נשמרה, והפעם הטופס ייפתח.
- **כתוב שהריפו `telegram-assistant` כבר קיים**: יש לך כבר עותק קוד (ריפו) בשם הזה ב-GitHub. בשדה **Repository Name** כותבים שם אחר, למשל `telegram-assistant-2`.
- **Vercel לא מצליח ליצור את הריפו, או כתוב שאין לו גישה**: בעבר נתת ל-Vercel גישה לחלק מעותקי הקוד שלך ב-GitHub, ולא לכולם. ב-GitHub ‹ **Settings** ‹ **Applications** ‹ **Vercel** ‹ **Configure** בוחרים **All repositories** ושומרים, ולוחצים שוב על כפתור ה-Deploy.
- **ב-Supabase כתוב שהגעת למגבלת הפרויקטים**: בחרת ארגון Supabase קיים. בוחרים במקום זה ליצור חדש, כמו בסעיף 5.
- **ב-Deploy כתוב "Build Failed"**: לוחצים **Redeploy**. אם זה חוזר, מצלמים את המסך ופונים אלינו.
- **לא הופיעה הצעה ליצור Supabase**: בדשבורד של הפרויקט ב-Vercel נכנסים ל-**Storage** ‹ **Create Database** ‹ **Supabase** ‹ **Frankfurt** ‹ **Connect**. אחר כך **Deployments** ‹ **Redeploy**.
- **בעמוד ההקמה כתוב "חסרים SUPABASE_URL..."**: Supabase לא חובר לפרויקט. עושים את מה שכתוב בסעיף הקודם.
- **שכחתי את סיסמת ההקמה**: ב-Vercel ‹ **Settings** ‹ **Environment Variables** משנים את `SETUP_PASSWORD`, ואז **Redeploy**. בעמוד ההקמה לוחצים שוב "הפעילו הכול".
