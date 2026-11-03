/**
 * English source strings (docs/PLAN.md, section 6). Every other language must have exactly these keys,
 * which TypeScript checks through `Dictionary`. Variables use {name} and must match across languages.
 */
export const en = {
  "button.confirm": "Confirm",
  "button.edit": "Edit",
  "button.cancel": "Cancel",
  "button.undo": "Undo",
  "button.sendAll": "Send all",
  "button.review": "Review",
  "button.notToday": "Not today",
  "button.allHere": "All here",
  "button.notHereYet": "Not here yet",
  "button.problem": "Problem",
  "button.talkToPerson": "Talk to a person",
  "button.refresh": "Refresh",
  "button.tryAgain": "Try again",

  "card.state.draft": "Draft",
  "card.state.awaitingConfirm": "Awaiting confirm",
  "card.state.confirmed": "Confirmed",
  "card.state.sent": "Sent",
  "card.state.seen": "Seen",
  "card.state.accepted": "Accepted",
  "card.state.partial": "Partly accepted",
  "card.state.rejected": "Rejected",
  "card.state.superseded": "Updated, see latest",
  "card.state.expired": "Expired",
  "card.staleTap": "That was an older version. Here's the latest.",

  "offline.banner": "You are offline. Changes will send when you reconnect.",
  "offline.pending": "{count} waiting to send",
  "offline.page.title": "You are offline",
  "offline.page.body": "Check your connection, then try again. Anything you sent will go through once you are back online.",

  "update.ready": "New version ready.",
  "update.gate.title": "Update Tradelink AI to keep ordering",
  "update.gate.body": "This version of Tradelink AI is too old to place orders. Refresh to get the latest version.",

  "push.needsInstall": "To get alerts on iPhone, add Tradelink AI to your Home Screen first.",
} as const satisfies Record<string, string>;

export type MessageKey = keyof typeof en;

/** A complete translation: every key, no extras. */
export type Dictionary = Record<MessageKey, string>;
