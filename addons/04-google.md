---
id: google
title: יומן Google ו-Gmail
minutes: 15
check: google
---

## למה
הבוט יכול לקבוע פגישות ביומן ("קבע לי מחר ב-10 פגישה עם דני"), לענות "מה יש לי היום", לחפש ולקרוא מיילים, להכין טיוטות תשובה ולשלוח מיילים. כל שליחה ומחיקה מחכה לאישור שלך. הגישה ניתנת דרך "אפליקציה" שפותחים אצלך ב-Google, ורק את/ה מחובר/ת אליה.

זה השלב הכי ארוך בערכה, כי Google דורש כמה אישורים. עוברים עליו פעם אחת, ולוקח כרבע שעה.

## מה עושים
**חלק א׳: פותחים פרויקט ב-Google Cloud (פעם אחת)**
1. נכנסים ל-[Google Cloud Console](https://console.cloud.google.com) עם אותו חשבון Google שהיומן שלו. אם מופיע חלון תנאי שימוש, מסמנים ומאשרים.
2. למעלה לוחצים על בחירת הפרויקט ‹ **New Project**. בשם כותבים `telegram-bot` ולוחצים **Create**. מחכים כמה שניות ובוחרים בפרויקט החדש.
3. מפעילים את שני השירותים, כל אחד בלחיצה על **Enable**:
   - [Gmail API](https://console.cloud.google.com/apis/library/gmail.googleapis.com)
   - [Google Calendar API](https://console.cloud.google.com/apis/library/calendar-json.googleapis.com)

**חלק ב׳: מסך ההסכמה**
1. נכנסים ל-[Google Auth Platform](https://console.cloud.google.com/auth/overview) ולוחצים **Get started**.
2. **App name**: `העוזר שלי`. **User support email**: המייל שלך. **Next**.
3. **Audience**: בוחרים **External**. **Next**.
4. **Contact information**: המייל שלך. **Next**, מסמנים את ההסכמה ולוחצים **Create**.
5. בתפריט מימין (או משמאל) נכנסים ל-**Audience** ולוחצים **Publish app** ‹ **Confirm**.

> 💡 **למה Publish?** בלי זה, Google מנתק את החיבור כל 7 ימים. אחרי Publish האפליקציה נשארת שלך ופרטית: אף אחד לא יכול להשתמש בה בלי הסיסמה שלו, ו-Google לא צריך לאשר אותה בשביל שימוש אישי.

**חלק ג׳: מפתחות**
1. בתפריט נכנסים ל-**Clients** ‹ **Create client**.
2. **Application type**: בוחרים **Web application**. בשם כותבים `telegram-bot`.
3. תחת **Authorized redirect URIs** לוחצים **Add URI**, ומדביקים את הכתובת מעמוד ההקמה. בתוספת "יומן Google ו-Gmail" יש כפתור **העתקה** בדיוק בשביל זה.
4. לוחצים **Create**. בחלון שנפתח מופיעים **Client ID** ו-**Client secret**. מעתיקים את שניהם. ה-secret מוצג פעם אחת בלבד, אז כדאי לשמור אותו עכשיו.

**חלק ד׳: מכניסים את המפתחות לבוט**
### בדפדפן
1. ב-Vercel ‹ הפרויקט ‹ **Settings** ‹ **Environment Variables** מוסיפים שני משתנים:
   - `GOOGLE_CLIENT_ID`: ה-Client ID.
   - `GOOGLE_CLIENT_SECRET`: ה-Client secret.
2. **Deployments** ‹ שלוש נקודות ליד הפריסה העליונה ‹ **Redeploy**, ומחכים שיסתיים.
3. בעמוד ההקמה מרעננים, ובתוספת "יומן Google ו-Gmail" לוחצים **🔗 חיבור לחשבון Google**.
4. בוחרים את החשבון.
5. מופיע מסך אזהרה **"Google hasn't verified this app"**. זה צפוי: זו האפליקציה שלך, ו-Google מציג את האזהרה לכל אפליקציה אישית. לוחצים **Advanced** (מתקדם) ‹ **Go to העוזר שלי (unsafe)**.
6. **מסמנים את כל התיבות** (יומן ומייל) ולוחצים **Continue**.

### עם Claude Code
1. כותבים ל-Claude: `/add-google`. Claude מלווה אותך בחלקים א׳ עד ג׳, ופותח לך את `.env.local` כדי להדביק בו את שני המפתחות.
2. Claude מוסיף את המפתחות ל-Vercel יחד איתך דרך הדשבורד, ואז עושים **Redeploy**.
3. בעמוד ההקמה לוחצים **🔗 חיבור לחשבון Google**, ועוברים את מסך האזהרה כמו שמתואר במסלול הדפדפן (סעיפים 4–6).

## איך יודעים שהצליח
מופיע עמוד "✅ יומן ו-Gmail מחוברים" עם המייל שלך, ובעמוד ההקמה התוספת מסומנת ✅. שולחים לבוט "מה יש לי מחר?", והוא עונה עם האירועים מהיומן.

## נתקעתי
- **"Error 400: redirect_uri_mismatch"**: הכתובת ב-Google Cloud לא זהה בדיוק לזו שבעמוד ההקמה. ב-**Clients** פותחים את הלקוח, מוחקים את הכתובת ומדביקים שוב מכפתור ההעתקה. אחרי השמירה מחכים חמש דקות.
- **"Access blocked: ... has not completed the Google verification process"**: האפליקציה עוד במצב בדיקה. ב-**Audience** לוחצים **Publish app**.
- **"Gmail API has not been used in project..."**: שכחנו להפעיל את אחד השירותים בחלק א׳ (סעיף 3).
- **הבוט אומר שהחיבור ל-Google פג**: בעמוד ההקמה לוחצים **חיבור מחדש**. זה קורה אם שינית סיסמה ב-Google או הסרת את הגישה.
- **לא סימנתי את כל התיבות**: לוחצים שוב על החיבור בעמוד ההקמה ומסמנים הכול.
