"use client";

import { useEffect, useState } from "react";
import { buildReport, type Report, type VisitorSummary } from "@/lib/track";
import { SITUATIONS } from "@/lib/presets";

const STEP_NAMES = ["מה יש לכם", "מה חשוב לכם", "הבסיס", "דירה או שוק ההון", "התוכנית", "התייעצות עם AI"];
const pct = (n: number, of: number) => (of > 0 ? `${Math.round((n / of) * 100)}%` : "—");

function Bar({ label, n, of }: { label: string; n: number; of: number }) {
  const w = of > 0 ? Math.max(2, (n / of) * 100) : 0;
  return (
    <div>
      <div className="mb-1 flex items-baseline justify-between gap-3 text-[14px]">
        <span className="text-slate-700">{label}</span>
        <span className="tabular-nums text-slate-900">
          <span className="font-semibold">{n}</span> <span className="text-slate-500">({pct(n, of)})</span>
        </span>
      </div>
      <div className="h-2.5 overflow-hidden rounded-full bg-slate-100">
        <div className="h-full rounded-full bg-slate-900" style={{ width: `${w}%` }} />
      </div>
    </div>
  );
}

function Card({ q, a, children }: { q: string; a: string; children: React.ReactNode }) {
  return (
    <section className="rounded-2xl border border-slate-200 bg-white p-5 sm:p-7">
      <h2 className="text-lg font-bold text-slate-900">{q}</h2>
      <p className="mt-1 text-[14px] text-slate-600">{a}</p>
      <div className="mt-5 space-y-4">{children}</div>
    </section>
  );
}

type State = { kind: "loading" } | { kind: "denied" } | { kind: "unavailable" } | { kind: "ok"; report: Report };

/** What testers do with the alpha. Readable by the owner and editors only (db rules). */
export default function StatsView() {
  const [state, setState] = useState<State>({ kind: "loading" });

  useEffect(() => {
    let done = false;
    const timeout = setTimeout(() => !done && setState({ kind: "unavailable" }), 10_000);
    (async () => {
      const c = (window as unknown as { claude?: { use(n: string): Promise<unknown> } }).claude;
      const [db, user] = c
        ? ((await Promise.all([c.use("db"), c.use("user")])) as [
            { collection(p: string): { limit(n: number): { get(): Promise<{ docs: { data(): unknown }[] }> } } } | null,
            { canEdit(): Promise<boolean> } | null,
          ])
        : [null, null];
      if (!db || !user) return setState({ kind: "unavailable" });
      if (!(await user.canEdit())) return setState({ kind: "denied" });
      const snap = await db.collection("events").limit(1000).get();
      setState({ kind: "ok", report: buildReport(snap.docs.map((d) => d.data() as Partial<VisitorSummary>)) });
    })()
      .catch(() => setState({ kind: "unavailable" }))
      .finally(() => {
        done = true;
        clearTimeout(timeout);
      });
    return () => clearTimeout(timeout);
  }, []);

  return (
    <div className="space-y-5">
      <a href="#" className="inline-flex items-center gap-1 text-[14px] font-semibold text-slate-600 hover:text-slate-900">
        → חזרה לאתר
      </a>
      <header>
        <p className="text-[13px] font-semibold text-slate-500">לנו בלבד</p>
        <h1 className="mt-1 text-2xl font-bold text-slate-900 sm:text-[28px]">מה עושים בגרסת האלפא</h1>
        <p className="mt-2 max-w-[65ch] text-[14px] leading-relaxed text-slate-600">
          לא נאסף מידע רגיש. ספירה אנונימית: לחיצות ושלבים בלבד, ותאריך בלי שעה. בלי סכומים, בלי תשובות ובלי שמות. נספרים רק מבקרים מחוברים שיש להם הרשאת כתיבה
          (חברי הארגון או מי ששותף כ״תורם״). מבקרים מבחוץ עם קישור לצפייה בלבד לא נספרים.
        </p>
      </header>

      {state.kind === "loading" && <p className="text-[14px] text-slate-500">טוען…</p>}
      {state.kind === "denied" && <p className="text-[14px] text-slate-600">הדף הזה פתוח רק לבעלי האתר.</p>}
      {state.kind === "unavailable" && (
        <p className="text-[14px] text-slate-600">הנתונים זמינים רק כשפותחים את הדף בתוך claude.ai, מחוברים לחשבון.</p>
      )}
      {state.kind === "ok" &&
        (state.report.visitors === 0 ? (
          <p className="rounded-xl bg-slate-50 p-5 text-[14px] text-slate-600">עוד אין נתונים. אחרי שאנשים ינסו את האתר, הם יופיעו כאן.</p>
        ) : (
          <Stats r={state.report} />
        ))}
    </div>
  );
}

function Stats({ r }: { r: Report }) {
  const cards = SITUATIONS.map((s) => ({ s, n: r.cardCounts[s.id] ?? 0 })).sort((a, b) => b.n - a.n);
  const totalCardClicks = cards.reduce((a, x) => a + x.n, 0);
  return (
    <>
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        {[
          ["מבקרים", r.visitors],
          ["ביקורים", r.visits],
          ["פתחו את המסלול המודרך", r.openedGuide],
          ["העתיקו את הפרומפט", r.promptCopiers],
        ].map(([label, n]) => (
          <div key={label} className="rounded-xl border border-slate-200 bg-white p-4">
            <p className="text-[12.5px] text-slate-500">{label}</p>
            <p className="mt-1 text-2xl font-bold tabular-nums text-slate-900">{n}</p>
          </div>
        ))}
      </div>

      <Card q="1. איך אנשים נכנסים?" a="כרטיסי המצב מול ״לא בטוחים? בואו נעבור על זה יחד״, ומתוך המבקרים.">
        <Bar label="לחצו על כרטיס מצב" n={r.usedCards} of={r.visitors} />
        <Bar label="נכנסו למסלול מהכרטיס ״לא בטוחים?״" n={r.viaCard} of={r.visitors} />
        <Bar label="נכנסו למסלול מהקישור שמתחת לתשובה" n={r.viaLink} of={r.visitors} />
        <div className="border-t border-slate-100 pt-4">
          <p className="mb-3 text-[13px] font-semibold text-slate-500">הכרטיסים הפופולריים (לחיצות)</p>
          <div className="space-y-3">
            {cards.map(({ s, n }) => (
              <Bar key={s.id} label={s.title} n={n} of={totalCardClicks} />
            ))}
          </div>
        </div>
      </Card>

      <Card q="2. איפה מפסיקים במסלול המודרך?" a={`מתוך ${r.openedGuide} שפתחו אותו: כמה הגיעו לכל שלב.`}>
        {STEP_NAMES.map((name, i) => (
          <Bar key={name} label={`${i + 1}. ${name}`} n={r.funnel[i]} of={r.openedGuide} />
        ))}
      </Card>

      <Card q="3. משתמשים בפרומפט ל-AI?" a={`מתוך ${r.funnel[5]} שהגיעו לשלב האחרון.`}>
        <Bar label="העתיקו את הפרומפט" n={r.promptCopiers} of={r.funnel[5]} />
        <Bar label="העתיקו את התוכנית או קישור אליה" n={r.planCopiers} of={r.funnel[4]} />
      </Card>

      <Card q="ועוד" a="מתוך כל המבקרים.">
        <Bar label="עברו מהמסלול לסימולטור המלא" n={r.toSimulator} of={r.visitors} />
        <Bar label="שיחקו עם השילוב, חלק בדירה וחלק במדד" n={r.comboUsers} of={r.visitors} />
        <Bar label="שיתפו את התוצאה" n={r.sharers} of={r.visitors} />
      </Card>
      {r.lastSeen && (
        <p className="text-[12px] text-slate-500">ביקור אחרון: {r.lastSeen}. הנתונים נטענים מחדש בכל כניסה לדף.</p>
      )}
    </>
  );
}
