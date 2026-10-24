---
id: deploy
title: מעלים את הבוט לאוויר
minutes: 10
check: deploy
---

## בקצרה
### בדפדפן
> אין GitHub? פותחים בדרך (**Create an account** בחלון ההתחברות). יש Supabase? בכל זאת חדש כאן (2 פרויקטים חינמיים לחשבון).

1. [כפתור ה-Deploy](https://vercel.com/new/clone?repository-url=https%3A%2F%2Fgithub.com%2Froshilabs-hq%2Ftelegram-assistant&project-name=telegram-assistant&repository-name=telegram-assistant&env=TELEGRAM_TOKEN%2CAI_API_KEY%2CSETUP_PASSWORD&envDescription=BotFather%20token%2C%20AI%20key%2C%20and%20a%20long%20setup%20password%20%2816%2B%20characters%2C%20best%20generated%20by%20a%20password%20manager%29&envLink=https%3A%2F%2Fgithub.com%2Froshilabs-hq%2Ftelegram-assistant%2Fblob%2Fmain%2Fdocs%2Fbrowser.md%23step-deploy&stores=%5B%7B%22type%22%3A%22integration%22%2C%22integrationSlug%22%3A%22supabase%22%2C%22productSlug%22%3A%22supabase%22%2C%22protocol%22%3A%22storage%22%7D%5D) ‹ התחברות עם GitHub ‹ **Create**.
2. Supabase: **Add** ‹ **Frankfurt** ‹ **Create** ‹ **Done**.
3. שלושה משתנים: `TELEGRAM_TOKEN`, `AI_API_KEY`, `SETUP_PASSWORD` (ארוכה ואקראית, 16 תווים ומעלה) ‹ **Deploy**.
4. מעתיקים את הכתובת מ-**Domains**.

### עם Claude Code
1. Claude מריץ את ההעלאה בעצמו.
2. אם נפתח דפדפן (התחברות ל-Vercel, או אישור של Supabase), מאשרים שם.

## למה
הבוט צריך מחשב שדולק 24 שעות ביממה. **Vercel** הוא המחשב באינטרנט שהבוט ירוץ עליו, ו-**Supabase** הוא המחברת שבה הבוט זוכר תזכורות, פתקים ורשימות. בשניהם יש מסלול חינמי שמספיק לבוט אישי. בשלב הזה פותחים את שניהם ומעלים את הבוט.

## מה עושים
### בדפדפן
1. לוחצים על הכפתור: [![Deploy with Vercel](https://vercel.com/button)](https://vercel.com/new/clone?repository-url=https%3A%2F%2Fgithub.com%2Froshilabs-hq%2Ftelegram-assistant&project-name=telegram-assistant&repository-name=telegram-assistant&env=TELEGRAM_TOKEN%2CAI_API_KEY%2CSETUP_PASSWORD&envDescription=BotFather%20token%2C%20AI%20key%2C%20and%20a%20long%20setup%20password%20%2816%2B%20characters%2C%20best%20generated%20by%20a%20password%20manager%29&envLink=https%3A%2F%2Fgithub.com%2Froshilabs-hq%2Ftelegram-assistant%2Fblob%2Fmain%2Fdocs%2Fbrowser.md%23step-deploy&stores=%5B%7B%22type%22%3A%22integration%22%2C%22integrationSlug%22%3A%22supabase%22%2C%22productSlug%22%3A%22supabase%22%2C%22protocol%22%3A%22storage%22%7D%5D)
2. Vercel מבקש להתחבר. לוחצים **GitHub**. (GitHub הוא המקום שבו נשמר עותק של הקוד, שלך, בחינם.) ![](docs/img/deploy-1.png)
   - **יש לך GitHub:** מתחברים, ובחלון של GitHub לוחצים **Authorize**.
   - **אין לך GitHub:** בחלון של GitHub לוחצים **Create an account**. ממלאים מייל, סיסמה ושם משתמש באנגלית, ומקלידים את הקוד שמגיע במייל. בסוף לוחצים **Authorize**.
   - **יש לך כבר Vercel** (נכנסת בעבר עם מייל או Google): מתחברים כמו תמיד. בסעיף הבא מחברים אליו את GitHub.
   - אם אחרי ההתחברות מופיע **404**, זו תקלה של Vercel: חוזרים להדרכה ולוחצים שוב על הכפתור. ההתחברות כבר נשמרה.
   - אם מופיע מסך **Secure Your Account with 2FA** (אבטחה בשני שלבים), לוחצים למטה **Skip securing my account**. אפשר להגדיר את זה אחר כך. ![](docs/img/deploy-2fa.png)
3. ב-**Git Scope** לוחצים **Add GitHub Scope**. נפתח חלון של GitHub: משאירים **All repositories** ולוחצים **Install**. זה נותן ל-Vercel גישה לחשבון ה-GitHub שלך, ובחשבון חדש אין בו עדיין כלום חוץ מהבוט. ![](docs/img/deploy-6.png)
   - **במקום Git Scope מופיעים כפתורים GitHub / GitLab / Bitbucket** (קורה למי שכבר יש לו Vercel): לוחצים **GitHub**, ושם החשבון שלך מופיע לבד. ממשיכים לסעיף הבא. ![](docs/img/deploy-providers.png)
4. לוחצים **Create**. Vercel יוצר בחשבון שלך עותק פרטי של הקוד. ![](docs/img/deploy-7.png)
5. **Add Products ‹ Supabase**: לוחצים **Add** ‹ **Accept and Create**. ![](docs/img/deploy-8.png)
   - **יש לך כבר Supabase:** בכל זאת יוצרים כאן חדש **(מומלץ)**. הוא נפתח בלחיצה, בלי הרשמה, ולא נוגע בפרויקטים הקיימים שלך. בחשבון קיים יש מגבלה של 2 פרויקטים חינמיים, ופרויקט שלישי לא ייפתח. אצל מי שכבר יצר Supabase דרך Vercel אין מסך **Accept and Create**, ועוברים ישר לבחירת האזור.
6. ב-**Primary Region** בוחרים **Frankfurt, Germany** (ברירת המחדל היא Washington, צריך להחליף) (הכי קרוב לישראל). התוכנית החינמית (**Free Plan**) כבר מסומנת. לוחצים **Continue** ‹ **Create**, מחכים כחצי דקה ללחצן **Done** ולוחצים עליו. ![](docs/img/deploy-10.png)
7. **Add Environment Variables**: ממלאים שלושה שדות: ![](docs/img/deploy-13.png)
   - `TELEGRAM_TOKEN`: הטוקן מ-BotFather, של הבוט **החדש** שיצרת בשלב הראשון. (מי שכבר יש לו בוט אחר: לא הטוקן שלו. כל בוט מחובר להתקנה אחת.)
   - `AI_API_KEY`: המפתח מהשלב הקודם.
   - `SETUP_PASSWORD`: סיסמה חדשה, ארוכה ואקראית (16 תווים ומעלה). היא המפתח לעמוד ההקמה, ומי שמנחש אותה יכול להשתלט על הבוט. הכי פשוט: לתת לדפדפן או למנהל הסיסמאות ליצור אחת ולשמור אותה שם. לא משתמשים בסיסמה שכבר יש לך במקום אחר.
8. לוחצים **Deploy** ומחכים כדקה, עד שמופיע **Congratulations!**. ![](docs/img/deploy-14.png)
9. לוחצים **Continue to Project**. תחת **Domains** מופיעה הכתובת של הבוט, משהו כמו `telegram-assistant-xxxx.vercel.app`. מעתיקים אותה.

### עם Claude Code
1. כשמגיעים לשלב הזה, Claude מריץ את ההעלאה: הוא יוצר פרויקט ב-Vercel, מחבר אותו לעותק שלך ב-GitHub (בשביל העדכונים), מחבר מסד נתונים ב-Supabase בפרנקפורט, ומעביר את שלושת הסודות מ-`.env.local`. הוא לא רואה אותם.
2. **אם עוד לא התחברת ל-Vercel,** נפתח דפדפן. מתחברים עם GitHub (אין חשבון Vercel? הוא נפתח בדרך), ומאשרים.
3. **אם Supabase מבקש אישור,** נפתח דפדפן. מאשרים, ואומרים ל-Claude להמשיך.
4. בסוף Claude כותב את הכתובת של הבוט, משהו כמו `telegram-assistant-xxxx.vercel.app`.

> גם במחשב ששמו בעברית זה עובד. הכלי של Vercel נשבר מזה, ו-Claude עוקף את זה לבד.

## איך יודעים שהצליח
נכנסים לכתובת של הבוט ומוסיפים בסוף `/setup`, למשל `https://telegram-assistant-xxxx.vercel.app/setup`. מופיע עמוד בעברית שמבקש את סיסמת ההקמה. נכנסים, והשורה "מעלים את הבוט לאוויר" מסומנת ✅.

> כדי לחזור לפרויקט ב-Vercel בעתיד (למשל להוסיף מפתח): נכנסים ל-[vercel.com](https://vercel.com), מתחברים עם GitHub, ולוחצים על `telegram-assistant`.

## נתקעתי
- **אחרי ההתחברות ל-Vercel מופיע 404**: לוחצים שוב על כפתור ה-Deploy בהדרכה. ההתחברות כבר נשמרה, והפעם הטופס ייפתח.
- **כתוב "A repository named telegram-assistant already exists"**: יש לך כבר עותק קוד (ריפו) בשם הזה ב-GitHub. בשדה **Private Repository Name** כותבים שם אחר, למשל `telegram-assistant-2`, ולוחצים שוב **Create**. גם הכתובת של הבוט תהיה בשם הזה. ![](docs/img/deploy-exists.png)
- **Vercel לא מצליח ליצור את הריפו, או כתוב שאין לו גישה**: בעבר נתת ל-Vercel גישה לחלק מעותקי הקוד שלך ב-GitHub, ולא לכולם. ב-GitHub ‹ **Settings** ‹ **Applications** ‹ **Vercel** ‹ **Configure** בוחרים **All repositories** ושומרים, ולוחצים שוב על כפתור ה-Deploy.
- **ב-Supabase כתוב שהגעת למגבלת הפרויקטים**: בחרת ארגון Supabase קיים. בוחרים במקום זה ליצור חדש, כמו בסעיף 5.
- **ב-Deploy כתוב "Build Failed"**: לוחצים **Redeploy**. אם זה חוזר, מצלמים את המסך ופונים אלינו.
- **לא הופיעה הצעה ליצור Supabase**: בדשבורד של הפרויקט ב-Vercel נכנסים ל-**Storage** ‹ **Create Database** ‹ **Supabase** ‹ **Frankfurt** ‹ **Connect**. אחר כך **Deployments** ‹ **Redeploy**.
- **בעמוד ההקמה כתוב "חסרים SUPABASE_URL..."**: Supabase לא חובר לפרויקט. עושים את מה שכתוב בסעיף הקודם.
- **שכחתי את סיסמת ההקמה**: ב-Vercel ‹ **Settings** ‹ **Environment Variables** משנים את `SETUP_PASSWORD`, ואז **Redeploy**. בעמוד ההקמה לוחצים שוב "הפעילו הכול".
