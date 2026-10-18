<div dir="rtl">

# איך מכבים הכול ומפסיקים לשלם

הבוט רץ בחשבונות שלך, ולכן גם הכיבוי אצלך. מספיק לעשות את שני הסעיפים הראשונים כדי שהבוט יפסיק לעבוד ושלא יהיו יותר חיובים. השאר הוא ניקיון.

## 1. מפסיקים את החיוב על ה-AI (חובה)
זה החיוב היחיד בערכה.
- **Gemini:** ב-[Google AI Studio](https://aistudio.google.com/apikey) מוחקים את המפתח. ב-[Billing](https://console.cloud.google.com/billing) בוחרים את חשבון החיוב ולוחצים **Close billing account**.
- **ChatGPT:** ב-[API keys](https://platform.openai.com/api-keys) מוחקים את המפתח. היתרה שטענת מראש נשארת בחשבון, ולא יורד ממנה יותר כסף.
- **Claude:** ב-[API Keys](https://console.anthropic.com/settings/keys) מוחקים את המפתח. גם כאן היתרה נשארת, ולא יורד ממנה יותר כסף.

## 2. מוחקים את הבוט בטלגרם
ב-[@BotFather](https://t.me/BotFather) שולחים `/deletebot`, בוחרים את הבוט ומאשרים.

## 3. מוחקים את השרת (Vercel ו-Supabase)
1. ב-[vercel.com](https://vercel.com) נכנסים לפרויקט `telegram-assistant`.
2. **Storage** ‹ לוחצים על מסד הנתונים ‹ **Settings** ‹ **Delete**. זה מוחק את כל התזכורות, הפתקים והרשימות.
3. **Settings** ‹ גוללים לתחתית ‹ **Delete Project**.

## 4. מנתקים את Google (רק אם חיברת את התוספת)
1. ב-[הרשאות של חשבון Google](https://myaccount.google.com/permissions) לוחצים על האפליקציה ‹ **Remove access**.
2. ב-[Google Cloud](https://console.cloud.google.com/iam-admin/settings) בוחרים את הפרויקט `telegram-bot` ‹ **Shut down**.

## 5. מוחקים את מפתח הקול (רק אם חיברת את התוספת)
ב-[Groq](https://console.groq.com/keys) מוחקים את המפתח `telegram-bot`.

## 6. מוחקים את עותק הקוד (לא חובה)
ב-GitHub נכנסים לריפו `telegram-assistant` ‹ **Settings** ‹ גוללים לתחתית ‹ **Delete this repository**.

---

את החשבונות עצמם (GitHub, Vercel, Google) אפשר להשאיר. הם חינמיים ולא מחייבים כלום.

</div>
