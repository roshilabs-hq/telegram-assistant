<!-- נוצר אוטומטית מתוך steps/ ו-addons/ — לא לערוך ידנית. להרצה: npm run guide -->
<div dir="rtl">

# המדריך המקוצר: יש לי ניסיון

אותם שלבים כמו [המדריך המלא](browser.md), בלי ההסברים. נתקעים בשלב? הקישור שבסופו פותח את ההסבר המלא שלו.

**צריך:** חשבונות GitHub ו-Vercel, טלגרם, ומפתח AI עם אמצעי תשלום. [הפירוט המלא](choose-path.md#requirements).

<a id="step-create-bot"></a>
### 1. יוצרים בוט בטלגרם · כ-3 דק׳
1. ב-[@BotFather](https://t.me/BotFather) שולחים `/newbot`.
2. נותנים שם, ושם משתמש באנגלית שנגמר ב-`bot`.
3. מעתיקים את הטוקן (`123456789:AAH...`).

[הסבר מלא, צילומי מסך ו"נתקעתי" ←](browser.md#step-create-bot)

<a id="step-ai-key"></a>
### 2. מוציאים מפתח לבינה המלאכותית · כ-10 דק׳
1. מפתח API **בתשלום** מאחד הספקים: [Gemini](https://aistudio.google.com/apikey) (מומלץ, כולל **Set up billing**), [ChatGPT](https://platform.openai.com/api-keys) או [Claude](https://console.anthropic.com/settings/keys).
2. כבר יש חשבון? יוצרים בו מפתח חדש רק לבוט.
3. ב-ChatGPT וב-Claude טוענים יתרה קטנה, בלי טעינה אוטומטית: היתרה היא התקרה. ב-Gemini אפשר רק התראה במייל, לא חסימה.

[הסבר מלא, צילומי מסך ו"נתקעתי" ←](browser.md#step-ai-key)

<a id="step-deploy"></a>
### 3. מעלים את הבוט לאוויר · כ-10 דק׳
> אין GitHub? פותחים בדרך (**Create an account** בחלון ההתחברות). יש Supabase? בכל זאת חדש כאן (2 פרויקטים חינמיים לחשבון).

1. [כפתור ה-Deploy](https://vercel.com/new/clone?repository-url=https%3A%2F%2Fgithub.com%2Froshilabs-hq%2Ftelegram-assistant&project-name=telegram-assistant&repository-name=telegram-assistant&env=TELEGRAM_TOKEN%2CAI_API_KEY%2CSETUP_PASSWORD&envDescription=BotFather%20token%2C%20AI%20key%2C%20and%20a%20long%20setup%20password%20%2816%2B%20characters%2C%20best%20generated%20by%20a%20password%20manager%29&envLink=https%3A%2F%2Fgithub.com%2Froshilabs-hq%2Ftelegram-assistant%2Fblob%2Fmain%2Fdocs%2Fbrowser.md%23step-deploy&stores=%5B%7B%22type%22%3A%22integration%22%2C%22integrationSlug%22%3A%22supabase%22%2C%22productSlug%22%3A%22supabase%22%2C%22protocol%22%3A%22storage%22%7D%5D) ‹ התחברות עם GitHub ‹ **Create**.
2. Supabase: **Add** ‹ **Frankfurt** ‹ **Create** ‹ **Done**.
3. שלושה משתנים: `TELEGRAM_TOKEN`, `AI_API_KEY`, `SETUP_PASSWORD` (ארוכה ואקראית, 16 תווים ומעלה) ‹ **Deploy**.
4. מעתיקים את הכתובת מ-**Domains**.

[הסבר מלא, צילומי מסך ו"נתקעתי" ←](browser.md#step-deploy)

<a id="step-activate"></a>
### 4. לוחצים "הפעילו הכול" · כ-2 דק׳
1. נכנסים ל-`/setup` בכתובת של הבוט, עם סיסמת ההקמה.
2. **🚀 הפעילו הכול**.
3. אם מופיעה תיבת SQL: **העתקה** ‹ עורך ה-SQL של Supabase ‹ **Run**.

[הסבר מלא, צילומי מסך ו"נתקעתי" ←](browser.md#step-activate)

<a id="step-pair"></a>
### 5. מחברים את הבוט אליך · כ-1 דק׳
1. בעמוד ההקמה: **📲 פתיחת הבוט בטלגרם** ‹ **Start**.
2. מהמחשב: שולחים לבוט את שש הספרות שבעמוד ההקמה.

[הסבר מלא, צילומי מסך ו"נתקעתי" ←](browser.md#step-pair)

<a id="step-say-hello"></a>
### 6. שולחים הודעה ראשונה · כ-1 דק׳
1. שולחים לבוט `תזכיר לי בעוד 2 דקות לשתות מים`.
2. אחרי שתי דקות מגיעה תזכורת עם שלושה כפתורים.

[הסבר מלא, צילומי מסך ו"נתקעתי" ←](browser.md#step-say-hello)

## תוספות (לא חובה)

<a id="step-voice"></a>
### 1. הודעות קוליות · כ-4 דק׳
1. מפתח ב-[Groq](https://console.groq.com/keys) (חינם): **Continue with email** ‹ **Create API Key**.
2. ב-Vercel: `GROQ_API_KEY` ‹ **Redeploy**.
3. שולחים לבוט הודעה קולית.

[הסבר מלא, צילומי מסך ו"נתקעתי" ←](browser.md#step-voice)

<a id="step-briefing"></a>
### 2. תדריך בוקר · כ-1 דק׳
1. בעמוד ההקמה ‹ **הגדרות**: שעה לתדריך בוקר, למשל `07:30` ‹ **שמירה**.

[הסבר מלא, צילומי מסך ו"נתקעתי" ←](browser.md#step-briefing)

<a id="step-siri"></a>
### 3. לדבר עם הבוט דרך Siri · כ-6 דק׳
1. בעמוד ההקמה: **הפעלת גישה מ-Siri**.
2. באייפון, קיצור חדש: **הכתבת טקסט** ‹ **קבל תוכן של URL** (`POST`, כותרת `Authorization: Bearer <המפתח>`, JSON עם `text`) ‹ **הקרא טקסט**.

[הסבר מלא, צילומי מסך ו"נתקעתי" ←](browser.md#step-siri)

<a id="step-google"></a>
### 4. יומן Google ו-Gmail · כ-15 דק׳
1. [Google Cloud](https://console.cloud.google.com/projectcreate): פרויקט חדש ‹ **Enable** ל-Gmail API ול-Google Calendar API.
2. Google Auth Platform: **Get started** ‹ **External** ‹ **Clients**: Web application עם כתובת החזרה מעמוד ההקמה.
3. **Branding**: דף בית ו-`/privacy` מעמוד ההקמה ‹ **Audience** ‹ **Publish app**.
4. ב-Vercel: `GOOGLE_CLIENT_ID` ו-`GOOGLE_CLIENT_SECRET` ‹ **Redeploy**.
5. בעמוד ההקמה: **🔗 חיבור לחשבון Google** ‹ **מתקדם** ‹ **כניסה אל ... (לא מאובטח)** ‹ **בחירת הכול**.

[הסבר מלא, צילומי מסך ו"נתקעתי" ←](browser.md#step-google)

<a id="step-updates"></a>
### 5. עדכונים אוטומטיים · כ-2 דק׳
1. ב-GitHub, בריפו `telegram-assistant` שלך: **Settings** ‹ **Actions** ‹ **General**.
2. תחת **Workflow permissions** מסמנים **Allow GitHub Actions to create and approve pull requests** ‹ **Save**.
3. כשמגיעה בקשת עדכון: **Merge pull request** ‹ **Confirm merge**.

[הסבר מלא, צילומי מסך ו"נתקעתי" ←](browser.md#step-updates)

</div>
