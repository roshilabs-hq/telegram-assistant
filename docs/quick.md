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

<a id="step-deploy"></a>
### 2. מעלים את הבוט לאוויר · כ-10 דק׳
> אין GitHub? פותחים בדרך (**Create an account** בחלון ההתחברות). יש Supabase? בכל זאת חדש כאן. בחינם יש עד 2 פרויקטים פעילים **לאדם**, כולל מה שכבר יש לך.

1. [כפתור ה-Deploy](https://vercel.com/new/clone?repository-url=https%3A%2F%2Fgithub.com%2Froshilabs-hq%2Ftelegram-assistant&project-name=telegram-assistant&repository-name=telegram-assistant&env=TELEGRAM_TOKEN%2CSETUP_PASSWORD&envDescription=BotFather%20token%20and%20a%20long%20setup%20password%20%2816%2B%20characters%2C%20best%20generated%20by%20a%20password%20manager%29&envLink=https%3A%2F%2Fgithub.com%2Froshilabs-hq%2Ftelegram-assistant%2Fblob%2Fmain%2Fdocs%2Fbrowser.md%23step-deploy&stores=%5B%7B%22type%22%3A%22integration%22%2C%22integrationSlug%22%3A%22supabase%22%2C%22productSlug%22%3A%22supabase%22%2C%22protocol%22%3A%22storage%22%7D%5D) ‹ התחברות עם GitHub ‹ **Create**.
2. Supabase: **Add** ‹ **Frankfurt** ‹ **Create** ‹ **Done**.
3. שני משתנים: `TELEGRAM_TOKEN`, `SETUP_PASSWORD` (ארוכה ואקראית: לפחות 8 תווים, ומומלץ 16 ומעלה) ‹ **Deploy**. (המפתח של Claude בא בסוף, בעמוד ההקמה.)
4. **Continue to Project** ‹ **Visit** ‹ **לעמוד ההקמה**.

[הסבר מלא, צילומי מסך ו"נתקעתי" ←](browser.md#step-deploy)

<a id="step-activate"></a>
### 3. לוחצים "הפעילו הכול" · כ-2 דק׳
1. נכנסים ל-`/setup` בכתובת של הבוט, עם סיסמת ההקמה.
2. **🚀 הפעילו הכול**.
3. אם מופיעה תיבת SQL: **העתקה** ‹ עורך ה-SQL של Supabase ‹ **Run**.

[הסבר מלא, צילומי מסך ו"נתקעתי" ←](browser.md#step-activate)

<a id="step-pair"></a>
### 4. מחברים את הבוט אליך · כ-1 דק׳
1. בעמוד ההקמה: **📲 פתיחת הבוט בטלגרם** ‹ **Start**.
2. מהמחשב: שולחים לבוט את שש הספרות שבעמוד ההקמה.

[הסבר מלא, צילומי מסך ו"נתקעתי" ←](browser.md#step-pair)

<a id="step-ai-key"></a>
### 5. מוסיפים לבוט מוח · כ-10 דק׳
1. ב-[Claude Console](https://platform.claude.com) נרשמים (**Individual**), וטוענים **$5** (לא את ה-20 שמסומנים מראש). ב-5 דולר אין טעינה אוטומטית, וכך היתרה היא התקרה.
2. ב-**API keys** לוחצים **Create key**, ואז **Continue with an API key**. ב-**Expires** בוחרים **Never** (ברירת המחדל, 30 יום, עוצרת את הבוט אחרי חודש), ומעתיקים את המפתח (מתחיל ב-`sk-ant-`). כבר יש חשבון? יוצרים בו מפתח חדש רק לבוט.
3. בעמוד ההקמה מדביקים בתיבה **המפתח של Claude** ‹ **🧠 שמירה ובדיקה**.

[הסבר מלא, צילומי מסך ו"נתקעתי" ←](browser.md#step-ai-key)

<a id="step-say-hello"></a>
### 6. שולחים הודעה ראשונה · כ-1 דק׳
1. שולחים לבוט `תזכיר לי בעוד 2 דקות לשתות מים`.
2. אחרי שתי דקות מגיעה תזכורת עם שלושה כפתורים.

[הסבר מלא, צילומי מסך ו"נתקעתי" ←](browser.md#step-say-hello)

## תוספות (לא חובה)

<a id="step-voice"></a>
### 1. הודעות קוליות · כ-4 דק׳
1. מפתח ב-[Groq](https://console.groq.com/keys) (חינם): **Continue with email** ‹ **Create API Key**.
2. בעמוד ההקמה, בתוספת "הודעות קוליות": מדביקים את המפתח ‹ **שמירה ובדיקה**.
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
### 4. יומן Google ו-Gmail · כ-5 דק׳
1. בעמוד ההקמה, בתוספת "יומן Google ו-Gmail": **העתקה** של הקוד.
2. [script.google.com/create](https://script.google.com/create): מוחקים את מה שכתוב, מדביקים, ושומרים (Ctrl+S).
3. **פריסה** ‹ **פריסה חדשה** ‹ ⚙️ ‹ **אפליקציית אינטרנט** ‹ "למי יש גישה": **כולם** ‹ **פריסה**.
4. **הרשאת גישה** ‹ החשבון ‹ **Advanced** ‹ **Go to ... (unsafe)** ‹ **Select all** ‹ **Continue**.
5. מעתיקים את **כתובת ה-URL**, מדביקים בעמוד ההקמה ולוחצים **חיבור**.

[הסבר מלא, צילומי מסך ו"נתקעתי" ←](browser.md#step-google)

<a id="step-updates"></a>
### 5. עדכונים אוטומטיים · כ-1 דק׳
בעמוד ההקמה **הפעלת עדכונים אוטומטיים (פעם אחת)** ‹ **Commit changes...** ‹ **Commit changes**. מכאן העדכונים נכנסים לבד, והבוט מודיע לך בטלגרם.

[הסבר מלא, צילומי מסך ו"נתקעתי" ←](browser.md#step-updates)

</div>
