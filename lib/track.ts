/**
 * Anonymous usage counts for the alpha (artifact `db` capability).
 *
 * One document per visit at events/<random id>, holding counters only: which cards were
 * clicked, how far the guided path went, what was copied. No amounts, no answers, no names.
 * Works only where the viewer can write (signed-in visitors with Contributor access or
 * organization members); everywhere else (the Next site, signed-out or view-only visitors)
 * every call is a silent no-op.
 */

export interface VisitorSummary {
  first: string;
  last: string;
  visits: number;
  cards: Record<string, number>;
  guideCard: number;
  guideLink: number;
  /** Highest guided step reached, 1–6 (0 = never opened) */
  maxStep: number;
  steps: Record<string, number>;
  promptCopy: number;
  planCopy: number;
  planLink: number;
  toSimulator: number;
  share: number;
  combo: number;
}

export type TrackEvent =
  | { type: "card"; id: string }
  | { type: "guideCard" | "guideLink" | "promptCopy" | "planCopy" | "planLink" | "toSimulator" | "share" | "combo" }
  | { type: "step"; step: number };

const empty = (now: string): VisitorSummary => ({
  first: now,
  last: now,
  visits: 0,
  cards: {},
  guideCard: 0,
  guideLink: 0,
  maxStep: 0,
  steps: {},
  promptCopy: 0,
  planCopy: 0,
  planLink: 0,
  toSimulator: 0,
  share: 0,
  combo: 0,
});

/** Shown on the site, next to the disclaimer. */
export const PRIVACY_NOTE =
  "פרטיות: האתר לא אוסף מידע רגיש. הסכומים והתשובות שאתם מזינים נשארים אצלכם בדפדפן ולא נשמרים אצלנו. אנחנו סופרים רק שימוש אנונימי, כמו על אילו כפתורים לוחצים ועד איזה שלב מגיעים, בלי סכומים, בלי תשובות, בלי שמות ובלי מזהה משתמש.";

/** The situation cards' fixed names: the only text a usage record can hold. */
export const CARD_IDS = ["firstHome", "firstInvest", "upgrade", "secondInvest", "moveRentOld", "twoRentals"];

/** Day only (YYYY-MM-DD): no exact times are kept. */
const today = () => new Date().toISOString().slice(0, 10);

/** Pure: apply one event to a summary (tested). Steps count once per visit. */
export function applyEvent(s: VisitorSummary, e: TrackEvent, seenSteps: Set<number>): VisitorSummary {
  const next: VisitorSummary = { ...s, cards: { ...s.cards }, steps: { ...s.steps } };
  switch (e.type) {
    case "card":
      // Only the six fixed card names are ever stored
      if (!CARD_IDS.includes(e.id)) break;
      next.cards[e.id] = (next.cards[e.id] ?? 0) + 1;
      break;
    case "step": {
      const n = Math.round(e.step);
      if (n < 1 || n > 6) break;
      next.maxStep = Math.max(next.maxStep, n);
      if (!seenSteps.has(n)) {
        seenSteps.add(n);
        next.steps[String(n)] = (next.steps[String(n)] ?? 0) + 1;
      }
      break;
    }
    default:
      next[e.type] += 1;
  }
  return next;
}

type DocRef = { get(): Promise<{ exists: boolean; data(): unknown }>; set(d: Record<string, unknown>): Promise<void> };
type ClaudeLike = { use(name: string): Promise<unknown> };

let ready: Promise<DocRef | null> | null = null;
let summary: VisitorSummary | null = null;
let dirty = false;
let writing = false;
let disabled = false;
let timer: ReturnType<typeof setTimeout> | null = null;
const seenSteps = new Set<number>();

/** Random per-visit id (kept for this tab's session only). */
function visitId(): string {
  const make = () =>
    typeof crypto !== "undefined" && "randomUUID" in crypto
      ? crypto.randomUUID().replace(/-/g, "")
      : Math.random().toString(36).slice(2) + Math.random().toString(36).slice(2);
  try {
    const k = "visit-id";
    const v = sessionStorage.getItem(k) || make();
    sessionStorage.setItem(k, v);
    return v;
  } catch {
    return make();
  }
}

function claude(): ClaudeLike | null {
  if (typeof window === "undefined") return null;
  const c = (window as unknown as { claude?: ClaudeLike }).claude;
  return c && typeof c.use === "function" ? c : null;
}

function init(): Promise<DocRef | null> {
  if (ready) return ready;
  ready = (async () => {
    const c = claude();
    if (!c) return null;
    const [db, user] = (await Promise.all([c.use("db"), c.use("user")])) as [
      { doc(p: string): DocRef } | null,
      { can(n: string): Promise<boolean | null> } | null,
    ];
    if (!db || !user) return null;
    if ((await user.can("data.write")) === false) return null;
    // A random id for this visit: never the account id, so a record can't be tied to a person
    const ref = db.doc(`events/${visitId()}`);
    const now = today();
    try {
      const snap = await ref.get();
      const prev = snap.exists ? (snap.data() as Partial<VisitorSummary>) : null;
      summary = { ...empty(now), ...(prev ?? {}), last: now };
      summary.visits = (prev?.visits ?? 0) + 1;
      dirty = true;
      schedule();
    } catch {
      return null;
    }
    return ref;
  })().catch(() => null);
  return ready;
}

function schedule() {
  if (timer) clearTimeout(timer);
  timer = setTimeout(flush, 1500);
}

async function flush() {
  timer = null;
  if (disabled || writing || !dirty || !summary) return;
  const ref = await init();
  if (!ref) return;
  writing = true;
  dirty = false;
  try {
    await ref.set({ ...summary });
  } catch (e) {
    // A refused write means this viewer can't record: stop for this visit
    if ((e as { code?: string })?.code === "invalid_argument") disabled = true;
  } finally {
    writing = false;
    if (dirty) schedule();
  }
}

/** Record one event; never throws, never blocks. */
export function track(e: TrackEvent) {
  if (disabled) return;
  void init().then((ref) => {
    if (!ref || !summary) return;
    summary = applyEvent({ ...summary, last: today() }, e, seenSteps);
    dirty = true;
    schedule();
  });
}

/** Start counting this visit (call once on load). */
export function startTracking() {
  void init();
}

// ---------------------------------------------------------------------------
// Report (the stats page and tests)
// ---------------------------------------------------------------------------

export interface Report {
  visitors: number;
  visits: number;
  usedCards: number;
  openedGuide: number;
  viaCard: number;
  viaLink: number;
  /** Visitors who reached each guided step 1–6 */
  funnel: number[];
  promptCopiers: number;
  planCopiers: number;
  toSimulator: number;
  sharers: number;
  comboUsers: number;
  cardCounts: Record<string, number>;
  lastSeen: string | null;
}

export function buildReport(rows: Partial<VisitorSummary>[]): Report {
  const r: Report = {
    visitors: rows.length,
    visits: 0,
    usedCards: 0,
    openedGuide: 0,
    viaCard: 0,
    viaLink: 0,
    funnel: [0, 0, 0, 0, 0, 0],
    promptCopiers: 0,
    planCopiers: 0,
    toSimulator: 0,
    sharers: 0,
    comboUsers: 0,
    cardCounts: {},
    lastSeen: null,
  };
  for (const s of rows) {
    r.visits += s.visits ?? 0;
    const cards = s.cards ?? {};
    if (Object.values(cards).some((n) => n > 0)) r.usedCards++;
    for (const [k, n] of Object.entries(cards)) r.cardCounts[k] = (r.cardCounts[k] ?? 0) + n;
    if ((s.maxStep ?? 0) > 0) r.openedGuide++;
    if ((s.guideCard ?? 0) > 0) r.viaCard++;
    if ((s.guideLink ?? 0) > 0) r.viaLink++;
    for (let i = 0; i < 6; i++) if ((s.maxStep ?? 0) >= i + 1) r.funnel[i]++;
    if ((s.promptCopy ?? 0) > 0) r.promptCopiers++;
    if ((s.planCopy ?? 0) > 0 || (s.planLink ?? 0) > 0) r.planCopiers++;
    if ((s.toSimulator ?? 0) > 0) r.toSimulator++;
    if ((s.share ?? 0) > 0) r.sharers++;
    if ((s.combo ?? 0) > 0) r.comboUsers++;
    if (s.last && (!r.lastSeen || s.last > r.lastSeen)) r.lastSeen = s.last;
  }
  return r;
}
