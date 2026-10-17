---
id: google
title: יומן Google ו-Gmail
minutes: 15
check: google
---

## למה
הבוט יכול לקבוע פגישות ביומן ("קבע לי מחר ב-10 פגישה עם דני"), לענות "מה יש לי היום", לחפש ולקרוא מיילים, להכין טיוטות תשובה ולשלוח מיילים. כל שליחה ומחיקה מחכה לאישור שלך. הגישה ניתנת דרך "אפליקציה" שפותחים אצלך ב-Google, ורק את/ה מחובר/ת אליה.

זה השלב הכי ארוך בערכה, כי Google דורש כמה אישורים. עוברים עליו פעם אחת, ולוקח כרבע שעה. **כדאי לעשות אותו ממחשב**: האתר של Google Cloud כמעט לא שמיש בטלפון.

כל המסכים של Google Cloud באנגלית. ההדרכה כותבת בדיוק על מה ללחוץ.

## מה עושים
**חלק א׳: פותחים פרויקט ב-Google Cloud (פעם אחת)**
1. נכנסים ל-[יצירת פרויקט ב-Google Cloud](https://console.cloud.google.com/projectcreate) עם אותו חשבון Google שהיומן שלו.
   - בכניסה הראשונה מופיע חלון **Welcome**: מסמנים את תיבת תנאי השימוש ולוחצים **Agree and continue**. ![](docs/img/google-1.png)
   - אם מופיע פס של ניסיון חינם (**Free Trial**), לוחצים **Dismiss**. לא צריך כרטיס אשראי.
2. ב-**Project name** כותבים `telegram-bot` ולוחצים **Create**. מחכים כמה שניות עד שהפרויקט נבחר (השם שלו מופיע למעלה). ![](docs/img/google-2.png)
3. מפעילים את שני השירותים. בכל קישור לוחצים **Enable** ומחכים שהעמוד מתחלף: ![](docs/img/google-3.png)
   - [Gmail API](https://console.cloud.google.com/apis/library/gmail.googleapis.com)
   - [Google Calendar API](https://console.cloud.google.com/apis/library/calendar-json.googleapis.com)

   אם בועה כחולה מכסה את הכפתור ("Click on the menu anytime..."), לוחצים בה **Got it**.

**חלק ב׳: מסך ההסכמה**
1. נכנסים ל-[Google Auth Platform](https://console.cloud.google.com/auth/overview) ולוחצים **Get started**. ![](docs/img/google-4.png)
2. **App name**: `העוזר שלי`. **User support email**: בוחרים את המייל שלך מהרשימה. **Next**.
3. **Audience**: בוחרים **External**. **Next**.
4. **Contact Information**: כותבים את המייל שלך. **Next**.
5. **Finish**: מסמנים **I agree...** ולוחצים **Create**. ![](docs/img/google-5.png)

**חלק ג׳: מפתחות**
1. בתפריט משמאל נכנסים ל-**Clients** ‹ **Create client**.
2. **Application type**: בוחרים **Web application**. ב-**Name** כותבים `telegram-bot`.
3. תחת **Authorized redirect URIs** לוחצים **Add URI**, ומדביקים את **כתובת החזרה** מעמוד ההקמה. בתוספת "יומן Google ו-Gmail" יש לה כפתור **העתקה**. ![](docs/img/google-6.png)
4. לוחצים **Create**. בחלון שנפתח מופיעים **Client ID** ו-**Client secret**, וליד כל אחד כפתור העתקה. **מעתיקים את שניהם עכשיו** למקום שמור (למשל פתק בטלפון). ה-secret מוצג רק פעם אחת: אחרי שסוגרים את החלון או מרעננים, אי אפשר להעתיק אותו שוב.

**חלק ד׳: מפרסמים את האפליקציה**
1. בתפריט נכנסים ל-**Branding**. ממלאים שני שדות, מתוך כפתורי ההעתקה בעמוד ההקמה: ![](docs/img/google-7.png)
   - **Application home page**: הכתובת של הבוט.
   - **Application privacy policy link**: הכתובת של הבוט עם `/privacy` בסוף. הבוט כבר מציג שם מדיניות פרטיות.
   - תחת **Authorized domains** הכתובת של הבוט כבר מופיעה (Google הוסיף אותה בחלק ג׳). אם לא, לוחצים **Add domain** ומדביקים אותה בלי `https://` ובלי `/` בסוף.
2. לוחצים **Save** (בתחתית העמוד).
3. בתפריט נכנסים ל-**Audience** ולוחצים **Publish app** ‹ **Confirm**. ![](docs/img/google-8.png) הסטטוס משתנה ל-**In production**.

> 💡 **למה Publish?** בלי זה, Google מנתק את החיבור כל 7 ימים. אחרי Publish האפליקציה נשארת שלך ופרטית: אף אחד לא יכול להשתמש בה בלי הסיסמה שלו, ו-Google לא צריך לאשר אותה בשביל שימוש אישי. בלי לוגו, ולכן גם בלי בדיקה של Google.

**חלק ה׳: מכניסים את המפתחות לבוט**
### בדפדפן
1. ב-Vercel ‹ הפרויקט ‹ **Settings** ‹ **Environment Variables** מוסיפים שני משתנים:
   - `GOOGLE_CLIENT_ID`: ה-Client ID.
   - `GOOGLE_CLIENT_SECRET`: ה-Client secret.
2. **Deployments** ‹ שלוש נקודות ליד הפריסה העליונה ‹ **Redeploy**, ומחכים שיסתיים.
3. בעמוד ההקמה מרעננים, ובתוספת "יומן Google ו-Gmail" לוחצים **🔗 חיבור לחשבון Google**.
4. בוחרים את החשבון. ![](docs/img/google-9.png)
5. מופיע מסך אזהרה **"Google לא אימתה את האפליקציה הזו"**. זה צפוי: זו האפליקציה שלך, ו-Google מציג את האזהרה לכל אפליקציה אישית. לוחצים **מתקדם**, ואז למטה **כניסה אל telegram-assistant-xxxx.vercel.app (לא מאובטח)**. (באנגלית: **Advanced** ‹ **Go to ... (unsafe)**.) ![](docs/img/google-11.png)
6. במסך **"כניסה אל ..."** לוחצים **המשך**. ![](docs/img/google-12.png)
7. **מסמנים "בחירת הכול"** (יומן ומייל) ולוחצים **המשך**. ![](docs/img/google-13.png)

> 💡 במסכים האלה Google מציג את הכתובת של הבוט, ולא את השם "העוזר שלי". זה תקין.

### עם Claude Code
1. כותבים ל-Claude: `/add-google`. Claude מלווה אותך בחלקים א׳ עד ד׳, ופותח לך את `.env.local` כדי להדביק בו את שני המפתחות.
2. Claude מוסיף את המפתחות ל-Vercel יחד איתך דרך הדשבורד, ואז עושים **Redeploy**.
3. בעמוד ההקמה לוחצים **🔗 חיבור לחשבון Google**, ועוברים את מסך האזהרה כמו שמתואר במסלול הדפדפן (סעיפים 4–7).

## איך יודעים שהצליח
מופיע עמוד "✅ יומן ו-Gmail מחוברים" עם המייל שלך ![](docs/img/google-14.png), ובעמוד ההקמה התוספת מסומנת ✅. שולחים לבוט "קבע לי מחר ב-10 פגישה עם דני", ואחר כך "מה יש לי מחר?". הבוט עונה עם הפגישה מהיומן. כשמבקשים למחוק, הבוט שואל קודם ומוחק רק אחרי "כן".

## נתקעתי
- **הכפתור Publish app אפור, וכתוב "complete your configuration on the Branding page"**: ב-**Branding** חסרים דף הבית או מדיניות הפרטיות (חלק ד׳, סעיף 1), או שלא לחצת **Save**.
- **ב-Branding כתוב "Missing domain"**: לוחצים **Add domain** ומדביקים את הכתובת של הבוט בלי `https://`.
- **"Error 400: redirect_uri_mismatch"**: הכתובת ב-Google Cloud לא זהה בדיוק לזו שבעמוד ההקמה. ב-**Clients** פותחים את הלקוח, מוחקים את הכתובת ומדביקים שוב מכפתור ההעתקה. אחרי השמירה מחכים חמש דקות.
- **"Access blocked: ... has not completed the Google verification process"**: האפליקציה עוד במצב בדיקה. ב-**Audience** לוחצים **Publish app**.
- **"Gmail API has not been used in project..."**: שכחנו להפעיל את אחד השירותים בחלק א׳ (סעיף 3).
- **איבדתי את ה-Client secret**: Google כבר לא מציג אותו שוב. ב-**Clients** פותחים את הלקוח ולוחצים **Add secret**, מעתיקים את החדש, ואת הישן מכבים (**Disable**) ומוחקים.
- **הבוט אומר שהחיבור ל-Google פג**: בעמוד ההקמה לוחצים **חיבור מחדש**. זה קורה אם שינית סיסמה ב-Google או הסרת את הגישה.
- **לא סימנתי את כל התיבות**: לוחצים שוב על החיבור בעמוד ההקמה ומסמנים הכול.
