/**
 * קישורים שפותחים אפליקציות בטלפון: ניווט בוויז, מפות, חיוג, ווטסאפ עם הודעה מוכנה.
 *
 * הבוט רץ על שרת ולא יכול לגעת בטלפון, ולכן "תנווט לשם" נגמר תמיד בקישור
 * שלוחצים עליו. כל הקישורים כאן הם https, כי טלגרם הופך לכפתור רק http/https.
 * הקישור פותח את האפליקציה המותקנת, ואם היא לא מותקנת, את האתר.
 */

const WA_MAX = 4000;

/**
 * מספר טלפון ← הספרות בפורמט בינלאומי שווטסאפ מצפה לו.
 * מקבל את מה שאנשים באמת מקלידים: 054-123-4567, ‎+972 54 1234567, מספר שהועתק
 * מאנשי הקשר עם רווחים בלתי נראים. מחזיר null במקום לנחש.
 */
export function normalizePhone(raw) {
  if (typeof raw !== "string") return null;

  // מסירים כל מה שאינו ספרה או + בהתחלה, כולל סימני כיווניות שמקלדת עברית משאירה.
  const cleaned = raw
    .replace(/[\s\u00A0\u200B-\u200F\u202A-\u202E\uFEFF()\-.]/g, "")
    .trim();
  if (!/^\+?\d+$/.test(cleaned)) return null;

  const digits = cleaned.replace(/^\+/, "");

  // כבר בפורמט בינלאומי.
  if (digits.startsWith("972")) {
    const local = digits.slice(3);
    return /^[1-9]\d{7,8}$/.test(local) ? `972${local}` : null;
  }
  // פורמט מקומי: 05X-XXXXXXX או 0X-XXXXXXX.
  if (digits.startsWith("0")) {
    const local = digits.slice(1);
    return /^[1-9]\d{7,8}$/.test(local) ? `972${local}` : null;
  }
  // נייד שנכתב בלי האפס בהתחלה.
  if (/^5\d{8}$/.test(digits)) return `972${digits}`;

  // כל השאר כנראה מספר מחו"ל: מעבירים כמו שהוא אם הוא באורך סביר.
  return /^\d{9,15}$/.test(digits) ? digits : null;
}

export function buildActionLink({ action, query, phone, message }) {
  switch (action) {
    case "navigate": {
      if (!query?.trim()) return { ok: false, error: "צריך יעד" };
      // navigate=yes מתחיל נסיעה, ולא רק מציג נקודה במפה.
      return {
        ok: true,
        label: "🚗 פתח בוויז",
        url: `https://waze.com/ul?q=${encodeURIComponent(query.trim())}&navigate=yes`,
      };
    }

    case "map": {
      if (!query?.trim()) return { ok: false, error: "צריך כתובת" };
      return {
        ok: true,
        label: "📍 פתח במפות",
        url: `https://maps.google.com/?q=${encodeURIComponent(query.trim())}`,
      };
    }

    case "call": {
      const num = normalizePhone(phone);
      if (!num) return { ok: false, error: "מספר לא תקין" };
      // טלגרם הופך +מספר ללחיץ בעצמו, אז מחזירים גם את הצורה הפשוטה להצגה.
      return {
        ok: true,
        label: "📞 חייג",
        url: `tel:+${num}`,
        display: `+${num}`,
      };
    }

    case "whatsapp": {
      const num = normalizePhone(phone);
      if (!num) return { ok: false, error: "מספר לא תקין" };
      const text = (message || "").slice(0, WA_MAX);
      // ההודעה נכתבת כאן אבל נשלחת מהחשבון של המשתמש עצמו, אחרי שהוא לוחץ "שלח".
      return {
        ok: true,
        label: "💬 פתח בוואטסאפ",
        url:
          `https://wa.me/${num}` +
          (text ? `?text=${encodeURIComponent(text)}` : ""),
        note: "ההודעה מוכנה בוואטסאפ, נשאר ללחוץ שלח",
      };
    }

    default:
      return { ok: false, error: `פעולה לא מוכרת: ${action}` };
  }
}
