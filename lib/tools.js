import { tool } from "ai";
import { z } from "zod";
import * as store from "./db.js";
import { RECURRENCE_KINDS } from "./time.js";
import { buildActionLink } from "./links.js";

/**
 * הכלים שהמודל יכול להפעיל. כל כלי מקבל את chatId מבחוץ (closure) ולא מהמודל,
 * כך שאין דרך לגרום לבוט לקרוא או לכתוב בשיחה של מישהו אחר.
 *
 * @param ctx.chatId   הצ'אט של הבעלים
 * @param ctx.offset   ההיסט מ-UTC כרגע, למשל "+03:00", לתיאורי הזמנים
 * @param ctx.onLink   נקרא עם כל קישור שנוצר, כדי להציג אותו ככפתור
 * @param ctx.status   פונקציה שמחזירה מצב מערכת (system_status)
 */
export function buildTools({ chatId, offset, onLink = () => {}, status = async () => ({}) }) {
  const iso = (what) => `${what}, בפורמט ISO 8601 עם ה-offset ${offset}. לדוגמה 2026-07-16T09:00:00${offset}`;
  const recurrence = {
    recurrence_kind: z
      .enum(RECURRENCE_KINDS)
      .optional()
      .describe("ריק = חד-פעמית. daily כל יום, weekly כל שבוע (באותו יום בשבוע כמו due_at), monthly, yearly."),
    recurrence_interval: z.number().int().min(1).optional().describe('כל כמה יחידות. "כל יומיים" = daily עם 2.'),
    recurrence_until: z.string().optional().describe(iso("מתי הסדרה נגמרת (לא חובה)")),
  };

  return {
    create_reminder: tool({
      description:
        "קובע תזכורת שתישלח בזמן מסוים. לתזכורת חוזרת הוסף/י recurrence_kind — due_at הוא המופע הראשון והשאר מחושבים ממנו.",
      inputSchema: z.object({
        text: z.string().describe("תוכן התזכורת"),
        due_at: z.string().describe(iso("זמן המופע הראשון")),
        ...recurrence,
      }),
      execute: (input) => store.createReminder(chatId, input),
    }),

    list_reminders: tool({
      description: "כל התזכורות הפתוחות, כולל פרטי החזרתיות.",
      inputSchema: z.object({}),
      execute: () => store.listReminders(chatId),
    }),

    update_reminder: tool({
      description:
        'משנה תזכורת קיימת לפי id: טקסט, זמן או חזרתיות. עדיף על מחיקה ויצירה מחדש. כדי להפוך חוזרת לחד-פעמית: recurrence_kind="none".',
      inputSchema: z.object({
        id: z.number(),
        text: z.string().optional(),
        due_at: z.string().optional().describe(iso("זמן חדש")),
        recurrence_kind: z.enum([...RECURRENCE_KINDS, "none"]).optional(),
        recurrence_interval: z.number().int().min(1).optional(),
        recurrence_until: z.string().optional(),
      }),
      execute: (input) => store.updateReminder(chatId, input),
    }),

    complete_reminder: tool({
      description: "מסמן תזכורת כבוצעה לפי id. בתזכורת חוזרת זה מסיים את כל הסדרה.",
      inputSchema: z.object({ id: z.number() }),
      execute: ({ id }) => store.completeReminder(chatId, id),
    }),

    delete_reminder: tool({
      description: "מוחק תזכורת לגמרי לפי id. אם המשתמש רק סיים אותה, complete_reminder עדיף.",
      inputSchema: z.object({ id: z.number() }),
      execute: ({ id }) => store.deleteReminder(chatId, id),
    }),

    save_note: tool({
      description:
        "שומר מידע לזיכרון ארוך טווח: שמות, טלפונים, העדפות, החלטות. בשמירת מייל של אדם כלול/י את השם ואת המילה 'מייל'.",
      inputSchema: z.object({ content: z.string(), category: z.string().optional() }),
      execute: (input) => store.saveNote(chatId, input),
    }),

    search_notes: tool({
      description:
        "מחפש בפתקים. כשהמאגר קטן הוא מחזיר את כולם (complete=true) — עבור/י עליהם ובחר/י בעצמך, ואל תחפש/י שוב במילה אחרת.",
      inputSchema: z.object({ query: z.string() }),
      execute: ({ query }) => store.searchNotes(chatId, query),
    }),

    update_note: tool({
      description: "מעדכן תוכן או קטגוריה של פתק לפי id.",
      inputSchema: z.object({ id: z.number(), content: z.string().optional(), category: z.string().optional() }),
      execute: (input) => store.updateNote(chatId, input),
    }),

    delete_note: tool({
      description: "מוחק פתק לפי id. מצא/י את ה-id קודם עם search_notes.",
      inputSchema: z.object({ id: z.number() }),
      execute: ({ id }) => store.deleteNote(chatId, id),
    }),

    lists_all: tool({
      description: "שמות כל הרשימות וכמה פריטים פתוחים בכל אחת.",
      inputSchema: z.object({}),
      execute: () => store.listsAll(chatId),
    }),

    list_show: tool({
      description: "מציג רשימה לפי שם. הפריטים חוזרים כ-text מוכן, פריט בשורה — שלח/י אותו כמו שהוא.",
      inputSchema: z.object({ list_name: z.string() }),
      execute: ({ list_name }) => store.listShow(chatId, list_name),
    }),

    list_add: tool({
      description:
        'מוסיף פריטים לרשימה. רשימה שלא קיימת נוצרת — אל תשאל/י קודם. בלי שם מפורש: "קניות".',
      inputSchema: z.object({ list_name: z.string(), items: z.array(z.string()) }),
      execute: ({ list_name, items }) => store.listAdd(chatId, list_name, items),
    }),

    list_check: tool({
      description: 'מסמן פריטים כבוצעו ("קניתי חלב"). עם undo: true מחזיר אותם לרשימה.',
      inputSchema: z.object({ list_name: z.string(), items: z.array(z.string()), undo: z.boolean().optional() }),
      execute: ({ list_name, items, undo }) => store.listCheck(chatId, list_name, items, undo === true),
    }),

    list_remove: tool({
      description: "מוחק פריטים מרשימה, או את כל הרשימה עם whole_list: true (רק אחרי אישור של המשתמש).",
      inputSchema: z.object({
        list_name: z.string(),
        items: z.array(z.string()).optional(),
        whole_list: z.boolean().optional(),
      }),
      execute: ({ list_name, items, whole_list }) => store.listRemove(chatId, list_name, items, whole_list === true),
    }),

    action_link: tool({
      description:
        "קישור שפותח אפליקציה בטלפון: ניווט בוויז (navigate), מפות (map), חיוג (call) או ווטסאפ עם הודעה מוכנה (whatsapp). " +
        "קרא/י לכלי מחדש בכל בקשה ואל תעתיק/י כתובת מהודעה קודמת. הקישור מוצג ככפתור מתחת להודעה, אז אל תכתוב/י אותו בטקסט. " +
        "בחיוג אין כפתור — ציין/י את המספר עצמו.",
      inputSchema: z.object({
        action: z.enum(["navigate", "map", "call", "whatsapp"]),
        query: z.string().optional().describe("יעד או כתובת, ל-navigate ול-map"),
        phone: z.string().optional().describe("מספר טלפון, ל-call ול-whatsapp"),
        message: z.string().optional().describe("נוסח ההודעה, ל-whatsapp"),
      }),
      execute: async (input) => {
        const out = buildActionLink(input);
        if (out.ok && out.url?.startsWith("https://")) onLink({ label: out.label, url: out.url });
        return out;
      },
    }),

    system_status: tool({
      description:
        'בדיקת בריאות של הבוט עצמו: האם התזמון רץ, כמה תזכורות פתוחות ובאיחור, איזה מודל AI. לשאלות כמו "הכל עובד?". דווח/י בקצרה ורק על מה שחורג.',
      inputSchema: z.object({}),
      execute: () => status(),
    }),
  };
}
