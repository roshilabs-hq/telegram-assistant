// נוצר אוטומטית מתוך steps/ ו-addons/ — לא לערוך ידנית. להרצה: npm run guide
export const STEPS = [
  {
    "id": "get-code",
    "kind": "step",
    "title": "מורידים את הקוד ופותחים ב-Claude Code",
    "minutes": 10,
    "check": "none",
    "only": "claude"
  },
  {
    "id": "create-bot",
    "kind": "step",
    "title": "יוצרים בוט בטלגרם",
    "minutes": 3,
    "check": "telegram_token",
    "only": "both"
  },
  {
    "id": "ai-key",
    "kind": "step",
    "title": "מוציאים מפתח לבינה המלאכותית",
    "minutes": 5,
    "check": "ai_key",
    "only": "both"
  },
  {
    "id": "deploy",
    "kind": "step",
    "title": "מעלים את הבוט לאוויר",
    "minutes": 7,
    "check": "deploy",
    "only": "both"
  },
  {
    "id": "activate",
    "kind": "step",
    "title": "לוחצים \"הפעילו הכול\"",
    "minutes": 2,
    "check": "activate",
    "only": "both"
  },
  {
    "id": "pair",
    "kind": "step",
    "title": "מחברים את הבוט אליך",
    "minutes": 1,
    "check": "owner",
    "only": "both"
  },
  {
    "id": "say-hello",
    "kind": "step",
    "title": "שולחים הודעה ראשונה",
    "minutes": 1,
    "check": "none",
    "only": "both"
  }
];

export const ADDONS = [
  {
    "id": "voice",
    "kind": "addon",
    "title": "הודעות קוליות",
    "minutes": 4,
    "check": "voice",
    "only": "both"
  },
  {
    "id": "briefing",
    "kind": "addon",
    "title": "תדריך בוקר",
    "minutes": 1,
    "check": "briefing",
    "only": "both"
  },
  {
    "id": "siri",
    "kind": "addon",
    "title": "לדבר עם הבוט דרך Siri",
    "minutes": 6,
    "check": "ask",
    "only": "both"
  },
  {
    "id": "google",
    "kind": "addon",
    "title": "יומן Google ו-Gmail",
    "minutes": 15,
    "check": "google",
    "only": "both"
  }
];
