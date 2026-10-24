<div dir="rtl">

# 🤖 עוזר אישי בטלגרם

> 🧪 **גרסת בדיקה — עוד לא מוכנה לשימוש. ערכה מוכנה תסומן כאן.**

בוט פרטי בטלגרם שמבין עברית חופשית: מזכיר, זוכר ומסדר.

> "תזכיר לי מחר ב-9 להתקשר לרופא" · "כל יום ראשון ב-8 תזכיר לי להוציא את הפח" · "תוסיף חלב לרשימת הקניות" · "מה הקוד של השער?"

| | |
|---|---|
| ⏱ **זמן הקמה** | כחצי שעה, בלי ידע טכני |
| 💸 **עלות** | חינם (Vercel, Supabase וטלגרם במסלול החינמי). ה-AI בתשלום לפי שימוש: בערך 2–5 דולר בחודש עם Gemini או ChatGPT, ו-15–30 עם Claude |
| 🔒 **פרטיות** | הכול רץ בחשבונות **שלך**, ואנחנו לא רואים את ההודעות. כדי לנסח תשובה, הבוט שולח כל הודעה לספק ה-AI שבחרת (Google, OpenAI או Anthropic) |
| 👤 **מי יכול לדבר עם הבוט** | רק את/ה. הבוט מתעלם מכל השאר |

## מה הבוט יודע לעשות

- ⏰ **תזכורות**, חד-פעמיות או קבועות ("כל יום", "כל שני", "כל חודש"), עם כפתורים: בוצע, עוד 10 דקות, מחר בבוקר
- 📝 **פתקים**: "תרשום ש...", ואחר כך "מה ה...?"
- 🛒 **רשימות**: קניות, משימות, כל רשימה שרוצים
- 🚗 **קישורים מהירים**: ניווט בוויז, חיוג, ווטסאפ עם הודעה מוכנה

**תוספות (לא חובה):** 📆 יומן Google ו-Gmail · 🎙️ הודעות קוליות · ☀️ תדריך בוקר · 🗣️ Siri

## איך תרצו להקים?

כל הדרכים מגיעות לאותו בוט, בחשבונות שלכם.

| | מה זה | מה צריך | |
|---|---|---|---|
| 🧭 **צעד אחרי צעד, מהדפדפן** | כל לחיצה מוסברת, עם צילום מסך ופתרון למה שיכול להיתקע. אפשר גם מהטלפון. יש לכם Claude באפליקציה? [אפשר להיעזר בו](docs/help-from-claude.md) · כחצי שעה | טלגרם, מייל, וכרטיס אשראי לספק ה-AI. את GitHub, Vercel ו-Supabase פותחים בדרך, בחינם | [**מתחילים ←**](docs/browser.md)<br>מכירים את הכלים? [**המדריך המקוצר**](docs/quick.md) (כ-15 דקות) |
| 🤖 **יש לי Claude Code ב-VS Code** | Claude מוביל, בודק כל שלב, ואחר כך משנה את הבוט לפי בקשה · כחצי שעה | Claude Code שכבר עובד אצלכם ב-VS Code (עם Git ו-Node.js), טלגרם, ומפתח AI בתשלום (המוח של הבוט, נפרד מהמנוי ל-Claude) | [**למסלול Claude Code ←**](docs/claude-code.md) |
| 🛠️ **תתקינו לי** | [רושינוביץ](https://roshinovic.co.il) מתקינים את הבוט אצלכם, בחשבונות שלכם. כותבים לנו איפה שנוח | טלגרם וכרטיס אשראי לספק ה-AI. את השאר פותחים יחד | [**💬 וואטסאפ**](https://wa.me/972553048489?text=%D7%94%D7%99%D7%99%2C%20%D7%94%D7%92%D7%A2%D7%AA%D7%99%20%D7%9E%D7%94%D7%A2%D7%A8%D7%9B%D7%94%20%D7%A9%D7%9C%20%D7%94%D7%A2%D7%95%D7%96%D7%A8%20%D7%94%D7%90%D7%99%D7%A9%D7%99%20%D7%91%D7%98%D7%9C%D7%92%D7%A8%D7%9D%20%D7%95%D7%90%D7%A9%D7%9E%D7%97%20%D7%A9%D7%AA%D7%AA%D7%A7%D7%99%D7%A0%D7%95%20%D7%9C%D7%99)<br>[**📸 אינסטגרם**](https://ig.me/m/roshinovic.automation)<br>[**📘 פייסבוק**](https://m.me/1309642178897120) |

לא בטוחים? [**איזו דרך מתאימה לי**](docs/choose-path.md) (שאלה אחת). הפירוט המלא של מה צריך: [**לפני שמתחילים**](docs/choose-path.md#requirements). לא צריך להתקין שום סקיל או תוסף: כל מה שהבוט צריך מגיע בתוך הקוד.

כבר יש לכם טוקן מטלגרם ומפתח AI? אפשר לקפוץ ישר לכפתור:

[![Deploy with Vercel](https://vercel.com/button)](https://vercel.com/new/clone?repository-url=https%3A%2F%2Fgithub.com%2Froshilabs-hq%2Ftelegram-assistant&project-name=telegram-assistant&repository-name=telegram-assistant&env=TELEGRAM_TOKEN%2CAI_API_KEY%2CSETUP_PASSWORD&envDescription=BotFather%20token%2C%20AI%20key%2C%20and%20a%20long%20setup%20password%20%2816%2B%20characters%2C%20best%20generated%20by%20a%20password%20manager%29&envLink=https%3A%2F%2Fgithub.com%2Froshilabs-hq%2Ftelegram-assistant%2Fblob%2Fmain%2Fdocs%2Fbrowser.md%23step-deploy&stores=%5B%7B%22type%22%3A%22integration%22%2C%22integrationSlug%22%3A%22supabase%22%2C%22productSlug%22%3A%22supabase%22%2C%22protocol%22%3A%22storage%22%7D%5D)

## עוד
- [צ'ק ליסט](CHECKLIST.md): כל השלבים ברשימה אחת
- [מילון מונחים](docs/glossary.md): מה זה Vercel, Supabase, טוקן, ועוד
- [איך מכבים הכול ומפסיקים לשלם](docs/turn-off.md)
- [נתקעתם? תמיכה](docs/support.md): מה כלול, ואיך פונים

</div>
