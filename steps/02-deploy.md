---
id: deploy
title: מעלים את הבוט לאוויר
minutes: 10
check: deploy
lost: **מתברברים?** לא נורא, זה קורה לכולם. חוזרים לכפתור ה-**Deploy** ומתחילים שוב. מה שכבר עשית נשמר. (אחרי הלחיצה האחרונה על **Deploy** כבר לא חוזרים: מחכים שהבנייה תסתיים.)
---

## בקצרה
### בדפדפן
> אין GitHub? פותחים בדרך (**Create an account** בחלון ההתחברות). יש Supabase? בכל זאת חדש כאן. בחינם יש עד 2 פרויקטים פעילים **לאדם**, כולל מה שכבר יש לך.

1. [כפתור ה-Deploy](https://vercel.com/new/clone?repository-url=https%3A%2F%2Fgithub.com%2Froshilabs-hq%2Ftelegram-assistant&project-name=telegram-assistant&repository-name=telegram-assistant&env=TELEGRAM_TOKEN%2CSETUP_PASSWORD&envDescription=BotFather%20token%20and%20a%20long%20setup%20password%20%2816%2B%20characters%2C%20best%20generated%20by%20a%20password%20manager%29&envLink=https%3A%2F%2Fgithub.com%2Froshilabs-hq%2Ftelegram-assistant%2Fblob%2Fmain%2Fdocs%2Fbrowser.md%23step-deploy&stores=%5B%7B%22type%22%3A%22integration%22%2C%22integrationSlug%22%3A%22supabase%22%2C%22productSlug%22%3A%22supabase%22%2C%22protocol%22%3A%22storage%22%7D%5D) ‹ התחברות עם GitHub ‹ **Create**.
2. Supabase: **Add** ‹ **Frankfurt** ‹ **Create** ‹ **Done**.
3. שני משתנים: `TELEGRAM_TOKEN`, `SETUP_PASSWORD` (ארוכה ואקראית, 16 תווים ומעלה) ‹ **Deploy**. (המפתח של Claude בא בסוף, בעמוד ההקמה.)
4. **Continue to Project** ‹ **Visit** ‹ **לעמוד ההקמה**.

### עם Claude Code
1. Claude מריץ את ההעלאה בעצמו.
2. אם נפתח דפדפן (התחברות ל-Vercel, או אישור של Supabase), מאשרים שם.

## למה
הבוט צריך מחשב שדולק 24 שעות ביממה. **Vercel** הוא המחשב באינטרנט שהבוט ירוץ עליו, ו-**Supabase** הוא המחברת שבה הבוט זוכר תזכורות, פתקים ורשימות. בשניהם יש מסלול חינמי שמספיק לבוט אישי. בשלב הזה פותחים את שניהם ומעלים את הבוט.

## מה עושים
### בדפדפן
> 🌐 **בשלב הזה נפתחים כמה אתרים באנגלית.** המסך אצלך שונה מהתמונה? לא מנחשים על מה ללחוץ. מחפשים את המילה המודגשת שכתובה בצעד. היא לא מופיעה? פותחים "נתקעתי" לפני שממשיכים. **הלכת לאיבוד באמצע?** חוזרים לכפתור ה-Deploy שבצעד 1 ומתחילים שוב. מה שכבר עשית נשמר.

1. **סיימנו עם טלגרם.** חוזרים ללשונית של ההדרכה בדפדפן (לא בטלגרם). לוחצים כאן על הכפתור השחור **Deploy**: [![Deploy with Vercel](https://vercel.com/button)](https://vercel.com/new/clone?repository-url=https%3A%2F%2Fgithub.com%2Froshilabs-hq%2Ftelegram-assistant&project-name=telegram-assistant&repository-name=telegram-assistant&env=TELEGRAM_TOKEN%2CSETUP_PASSWORD&envDescription=BotFather%20token%20and%20a%20long%20setup%20password%20%2816%2B%20characters%2C%20best%20generated%20by%20a%20password%20manager%29&envLink=https%3A%2F%2Fgithub.com%2Froshilabs-hq%2Ftelegram-assistant%2Fblob%2Fmain%2Fdocs%2Fbrowser.md%23step-deploy&stores=%5B%7B%22type%22%3A%22integration%22%2C%22integrationSlug%22%3A%22supabase%22%2C%22productSlug%22%3A%22supabase%22%2C%22protocol%22%3A%22storage%22%7D%5D)
   - לא רואים את הכפתור? [לוחצים כאן](https://vercel.com/new/clone?repository-url=https%3A%2F%2Fgithub.com%2Froshilabs-hq%2Ftelegram-assistant&project-name=telegram-assistant&repository-name=telegram-assistant&env=TELEGRAM_TOKEN%2CSETUP_PASSWORD&envDescription=BotFather%20token%20and%20a%20long%20setup%20password%20%2816%2B%20characters%2C%20best%20generated%20by%20a%20password%20manager%29&envLink=https%3A%2F%2Fgithub.com%2Froshilabs-hq%2Ftelegram-assistant%2Fblob%2Fmain%2Fdocs%2Fbrowser.md%23step-deploy&stores=%5B%7B%22type%22%3A%22integration%22%2C%22integrationSlug%22%3A%22supabase%22%2C%22productSlug%22%3A%22supabase%22%2C%22protocol%22%3A%22storage%22%7D%5D).
2. Vercel מבקש להתחבר. לוחצים **GitHub**. (GitHub הוא המקום שבו נשמר עותק של הקוד, שלך, בחינם.) ![](docs/img/deploy-1.png)
   - **יש לך GitHub:** מתחברים, ובחלון של GitHub לוחצים **Authorize**.
   - **אין לך GitHub:** בחלון של GitHub לוחצים **Create an account**. **יש לך Gmail? הכי פשוט ללחוץ Continue with Google** ולבחור את החשבון שלך, בלי סיסמה חדשה. אחרת ממלאים מייל, סיסמה ושם משתמש באנגלית. אם מופיעה חידה ("Verify you are human"), פותרים אותה. מקלידים את הקוד שמגיע במייל, ובסוף לוחצים **Authorize**. ממשיכים רק כשמופיע המסך **New Project** של Vercel. לא חזרת אליו לבד? לוחצים שוב על כפתור ה-Deploy בהדרכה.
   - **יש לך כבר Vercel** (נכנסת בעבר עם מייל או Google): מתחברים כמו תמיד. בסעיף הבא מחברים אליו את GitHub.
   - אם אחרי ההתחברות מופיע **404**, זו תקלה של Vercel: חוזרים להדרכה ולוחצים שוב על הכפתור. ההתחברות כבר נשמרה.
   - **יש לך חשבון של עבודה** ב-Vercel או ב-GitHub: הבוט נוצר בחשבון שמחובר עכשיו. בודקים בפינה השמאלית העליונה של Vercel, ובשדה **Git Scope**, שמופיע השם **האישי** שלך ולא של העבודה. אם לא, מחליפים שם (לוחצים על השם ובוחרים את החשבון האישי), או מתחברים לחשבון האישי בחלון גלישה בסתר.
   - אם מופיע מסך **Secure Your Account with 2FA**: זו לא שגיאה. Vercel מציע אבטחה בשני שלבים, כלומר קוד נוסף בכל כניסה, וזה מומלץ. כדי לא להוסיף באמצע ההקמה עוד אפליקציה, אפשר ללחוץ למטה **Skip securing my account**, **ולהפעיל את זה מיד אחרי שהבוט עובד** (בהגדרות החשבון ב-Vercel ‹ **Authentication**). ![](docs/img/deploy-2fa.png)
3. ב-**Git Scope** לוחצים **Add GitHub Scope**. נפתח חלון של GitHub: משאירים **All repositories**, גוללים למטה ולוחצים **Install**. זה נותן ל-Vercel גישה לקוד בחשבון ה-GitHub שלך. בחשבון חדש אין בו עדיין כלום חוץ מהבוט, וזה בטוח. **בחשבון קיים עם פרויקטים אחרים:** Vercel יוכל לקרוא גם אותם (הוא לא משנה אותם בלי שתחבר/י אותם אליו). מי שלא רוצה את זה פותח/ת חשבון GitHub חדש רק לבוט. (בחירה של חלק מהריפואים בלבד לא עובדת כאן: Vercel לא יוכל ליצור את עותק הקוד החדש.) ![](docs/img/deploy-6.png)
   - **במקום Git Scope מופיעים כפתורים GitHub / GitLab / Bitbucket** (קורה למי שכבר יש לו Vercel): לוחצים **GitHub**, ושם החשבון שלך מופיע לבד. ממשיכים לסעיף הבא. ![](docs/img/deploy-providers.png)
4. לוחצים **Create**. Vercel יוצר בחשבון שלך עותק פרטי של הקוד. ![](docs/img/deploy-7.png)
5. **Add Products ‹ Supabase**: לוחצים **Add** ‹ **Accept and Create**. ![](docs/img/deploy-8.png)
   - **יש לך כבר Supabase:** בכל זאת יוצרים כאן חדש **(מומלץ)**. הוא נפתח בלחיצה, בלי הרשמה, ולא נוגע בפרויקטים הקיימים שלך. אצל מי שכבר יצר Supabase דרך Vercel אין מסך **Accept and Create**, ועוברים ישר לבחירת האזור.
   - **שימו לב:** בחינם אפשר להחזיק **2 פרויקטים פעילים ב-Supabase לאדם**, גם כשהם נפתחים דרך Vercel, וכולל מה שכבר יש לך. זה הבוט השלישי? ראו "נתקעתי".
6. נפתח חלון באנגלית. הוא פותח את "המחברת" של הבוט, בחינם. ב-**Primary Region** בוחרים **Frankfurt, Germany** (ברירת המחדל היא Washington, צריך להחליף) (הכי קרוב לישראל). בשדה **Public Environment Variables Prefix** לא נוגעים. גוללים למטה ובודקים שמסומן **Supabase Free Plan**. **מופיע מחיר בדולרים לחודש (Pro, Team)? עוצרים ולא מאשרים**, וקוראים "נתקעתי". לוחצים **Continue** ‹ **Create**, מחכים כחצי דקה ללחצן **Done** ולוחצים עליו. ![](docs/img/deploy-10.png)
7. **Add Environment Variables**: יש שתי שורות. בכל שורה לוחצים על התיבה הריקה מימין (**Value**) וממלאים: ![](docs/img/deploy-13.png)
   - `TELEGRAM_TOKEN`: מדביקים (לחיצה ארוכה בתיבה ‹ **הדבק** / **Paste**) את הטוקן מ-BotFather, של הבוט **החדש** שיצרת בשלב הראשון. (מי שכבר יש לו בוט אחר: לא הטוקן שלו. כל בוט מחובר להתקנה אחת.)
   - `SETUP_PASSWORD`: ממציאים סיסמה חדשה, **16 תווים ומעלה**. היא המפתח לעמוד ההקמה, ומי שמנחש אותה יכול להשתלט על הבוט. באשף יש סיסמה מוכנה, עם כפתור העתקה. בלי האשף, הכי פשוט: ארבע מילים באנגלית ומספר, צמודים, למשל `BlueCatEatsPizza2026` (אבל לא בדיוק זו). לא סיסמה שכבר יש לך במקום אחר. **כותבים אותה בפתק** ליד הטוקן: עוד רגע נכנסים איתה.
   <!-- wizard:password -->
   - לא לוחצים **Deploy** לפני ששתי השורות מלאות. (את המפתח של Claude, "המוח", מוסיפים רק בסוף, בעמוד ההקמה. בינתיים לא צריך כרטיס אשראי.)
8. לוחצים **Deploy** ומחכים חצי דקה עד דקה, עד שמופיע **Congratulations!**. ![](docs/img/deploy-14.png)
9. גוללים למטה (בטלפון הכפתור בתחתית) ולוחצים **Continue to Project**.
10. לוחצים **Visit**. נפתח עמוד "העוזר האישי פועל". לוחצים בו **לעמוד ההקמה**. ![](docs/img/deploy-15.png)
    - הכתובת של הבוט מופיעה תחת **Domains**, משהו כמו `telegram-assistant-xxxx.vercel.app`. (לא הכתובת הארוכה שתחת **Deployment**.)

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
- **כתוב "There is already an account associated with your GitHub email"**: כבר יש לך Vercel עם אותו מייל. לוחצים **Login with Email**, מקלידים את המייל, ומקלידים את הקוד שמגיע במייל. אחר כך לוחצים שוב על כפתור ה-Deploy בהדרכה, וממשיכים מהסעיף של **Git Scope**.
- **אחרי ההתחברות ל-Vercel מופיע 404**: לוחצים שוב על כפתור ה-Deploy בהדרכה. ההתחברות כבר נשמרה, והפעם הטופס ייפתח.
- **כתוב "A repository named telegram-assistant already exists"**: יש לך כבר עותק קוד (ריפו) בשם הזה ב-GitHub. בשדה **Private Repository Name** כותבים שם אחר, למשל `telegram-assistant-2` (ואם גם הוא תפוס, `telegram-assistant-3`), ולוחצים שוב **Create**. גם הכתובת של הבוט תהיה בשם הזה. ![](docs/img/deploy-exists.png)
- **Vercel לא מצליח ליצור את הריפו, או כתוב שאין לו גישה**: בעבר נתת ל-Vercel גישה לחלק מעותקי הקוד שלך ב-GitHub, ולא לכולם. ב-GitHub ‹ **Settings** ‹ **Applications** ‹ **Vercel** ‹ **Configure** בוחרים **All repositories** ושומרים, ולוחצים שוב על כפתור ה-Deploy.
- **בחלון של Supabase כתוב "Upgrade your plan", ומופיעות רק תוכניות בתשלום (Pro, Team)**: כבר יש לך 2 פרויקטים חינמיים פעילים ב-Supabase. **לא בוחרים תוכנית בתשלום.** סוגרים את החלון, מפנים מקום, ולוחצים שוב **Add**: ![](docs/img/supabase-limit.png)
  - בוט ישן שלא צריך: מוחקים אותו לפי [איך מכבים הכול](docs/turn-off.md), סעיף 3.
  - פרויקט אחר ב-[Supabase](https://supabase.com/dashboard) שלא בשימוש: נכנסים אליו ‹ **Pause project**. פרויקט מושהה לא נספר.
- **ב-Deploy כתוב "Build Failed"**: ההעלאה לא הושלמה, ושום דבר לא נמחק. לוחצים **Redeploy** אם הוא מופיע במסך. אם זה חוזר, **לא מוחקים את הפרויקט ולא פותחים חשבון חדש**. מצלמים את המסך ופונים אלינו.
- **לא הופיעה הצעה ליצור Supabase**: בדשבורד של הפרויקט ב-Vercel נכנסים ל-**Storage** ‹ **Create Database** ‹ **Supabase** ‹ **Frankfurt** ‹ **Connect**. אחר כך **Deployments** ‹ **Redeploy**.
- **בעמוד ההקמה כתוב "חסרים SUPABASE_URL..."**: Supabase לא חובר לפרויקט. עושים את מה שכתוב בסעיף הקודם.
- **שכחתי את סיסמת ההקמה**: ב-Vercel ‹ **Settings** ‹ **Environment Variables** משנים את `SETUP_PASSWORD`, ואז **Redeploy**. בעמוד ההקמה לוחצים שוב "הפעילו הכול".
