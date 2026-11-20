"use client";

import type { ReactNode } from "react";
import { ExternalLink, AlertTriangle } from "lucide-react";
import { CONTACT_EMAIL } from "@/lib/config";
import { RULES, staleRules } from "@/lib/rules";
import { SOURCES } from "@/lib/sources";
import { DEFAULT_INPUTS } from "@/lib/calculator";

export type InfoPage = "terms" | "privacy" | "rules" | "a11y";

export const INFO_PAGES: { id: InfoPage; title: string }[] = [
  { id: "rules", title: "איך זה מחושב" },
  { id: "terms", title: "תנאי שימוש" },
  { id: "privacy", title: "מדיניות פרטיות" },
  { id: "a11y", title: "הצהרת נגישות" },
];

/** Placeholder a lawyer must replace before the site is public. */
const LAWYER = "[להשלמה ע״י עו״ד]";
const FILL = "[להשלמה]";

function Section({ title, children }: { title: string; children: ReactNode }) {
  return (
    <section className="border-t border-slate-200 pt-5 first:border-t-0 first:pt-0">
      <h2 className="text-lg font-bold text-slate-900">{title}</h2>
      <div className="mt-2 space-y-2 text-[14.5px] leading-relaxed text-slate-700">{children}</div>
    </section>
  );
}

function Todo({ text = LAWYER }: { text?: string }) {
  return <mark className="rounded bg-amber-100 px-1 font-semibold text-amber-900">{text}</mark>;
}

const fmtDate = (iso: string) => {
  const [y, m, d] = iso.split("-");
  return `${Number(d)}.${Number(m)}.${y}`;
};

function Terms() {
  return (
    <>
      <Section title="אופי השירות">
        <p>
          נדל״ן מול סנופי הוא כלי סימולציה. הוא מחשב מה קורה לפי נתונים והנחות שהמשתמש בוחר, ומסביר את החישוב. הוא לא ממליץ, לא
          נותן הוראות פעולה ולא מעדיף שום מוצר, גוף או נותן שירות.
        </p>
        <p>
          <Todo />
        </p>
      </Section>
      <Section title="אין ייעוץ">
        <p>
          השירות אינו ייעוץ השקעות, שיווק השקעות, ייעוץ מס או ייעוץ משכנתאות, ואינו מתחשב בנתונים ובצרכים האישיים של כל משתמש.
          לפני כל החלטה כדאי להתייעץ עם בעל רישיון.
        </p>
        <p>
          <Todo />
        </p>
      </Section>
      <Section title="הגבלת אחריות">
        <p>
          <Todo />
        </p>
      </Section>
      <Section title="דיוק ועדכניות הנתונים">
        <p>
          כללי המס והבנקאות מפושטים, ונבדקו בתאריכים שמופיעים בדף ״איך זה מחושב״. כללים משתנים, והוראות שעה עלולות לפוג. תשואות
          עבר אינן מבטיחות תשואות עתידיות.
        </p>
        <p>
          <Todo />
        </p>
      </Section>
      <Section title="קניין רוחני">
        <p>
          <Todo />
        </p>
      </Section>
    </>
  );
}

function Privacy() {
  return (
    <>
      <Section title="מה נאסף">
        <p>רק ספירה אנונימית של השימוש באתר, לכל ביקור בנפרד (בחלק מהגרסאות של האתר אין ספירה בכלל):</p>
        <ul className="list-disc space-y-1 ps-5">
          <li>על איזה כרטיס מצב לחצו (אחד משישה שמות קבועים) וכמה פעמים.</li>
          <li>האם נכנסו למסלול המודרך, ומאיזה כפתור.</li>
          <li>עד איזה שלב במסלול המודרך הגיעו (מספר בין 1 ל-6).</li>
          <li>האם לחצו על העתקה או שיתוף, ועל פתיחת השילוב.</li>
          <li>התאריך של הביקור, בלי שעה.</li>
        </ul>
      </Section>
      <Section title="מה לא נאסף">
        <p>
          לא נאספים סכומים, תשובות, טקסט חופשי, שמות, כתובות מייל, מספרי טלפון או מזהה משתמש. כל מה שאתם מזינים נשאר בדפדפן שלכם.
          הפרומפט ל-AI נוצר בדפדפן, ונשלח רק אם אתם מעתיקים ומדביקים אותו בעצמכם.
        </p>
        <p>
          קישור לסיכום (אם יוצרים אותו) כולל את המספרים שלכם בתוך הכתובת עצמה. הוא לא נשמר אצלנו, ומי שמקבל את הקישור יכול לראות
          אותם.
        </p>
      </Section>
      <Section title="איפה זה נשמר">
        <p>
          הספירה נשמרת במאגר הנתונים של העמוד בשירות שבו האתר מתארח. בעלי האתר קוראים אותה בדף פנימי, ומבחינה טכנית גם מבקרים
          מחוברים עם הרשאת כתיבה יכולים לגשת אליה. היא כוללת רק מונים ותאריכים, בלי שום פרט מזהה. נספרים רק מבקרים מחוברים שיש
          להם הרשאת כתיבה. מחוץ לשירות הזה, האתר לא סופר כלום.
        </p>
        <p>
          <Todo />
        </p>
      </Section>
      <Section title="יצירת קשר">
        <p>
          שאלות על פרטיות: <a className="font-semibold underline underline-offset-2" href={`mailto:${CONTACT_EMAIL}`}>{CONTACT_EMAIL}</a>
        </p>
      </Section>
    </>
  );
}

function Rules() {
  const stale = staleRules().length > 0;
  const d = DEFAULT_INPUTS;
  return (
    <>
      <div role="note" className="flex gap-2 rounded-lg bg-amber-50 px-3.5 py-2.5 text-[14px] leading-relaxed text-amber-900">
        <AlertTriangle size={16} className="mt-1 shrink-0" aria-hidden />
        <span>
          כללי מס ובנקאות משתנים, והוראות שעה (כמו מס הרכישה על דירה נוספת) עלולות לפוג. לכל כלל רשום מתי נבדק לאחרונה.
          {stale && " חלק מהכללים נבדקו לפני יותר משנה, וייתכן שהנתונים לא עדכניים."}
        </span>
      </div>
      <Section title="איך החישוב עובד">
        <p>
          החישוב עובר חודש אחרי חודש על שני מסלולים עם אותו כסף בהתחלה. בסוף כל שנה הוא בודק כמה היה נשאר בכיס אילו מכרו הכול:
          אחרי מכירת הדירה, סילוק המשכנתא וכל המסים.
        </p>
        <ul className="list-disc space-y-1 ps-5">
          <li>אם המסלולים דורשים הוצאה חודשית שונה, ההפרש מושקע במדד במסלול הזול יותר, כך ששניהם מקבלים אותו כסף.</li>
          <li>שכר הדירה: חודש ריק אחד בשנה, תחזוקה 8% משכר הדירה, ושיפוצים 0.5% משווי הדירה בשנה.</li>
          <li>עלויות קנייה ומכירה: תיווך 2% ועורך דין 0.5% בכל צד (ועוד מע״מ), ועוד ₪10,000 קבועים בקנייה.</li>
          <li>
            הנחות ברירת המחדל: מחירי דירות +{d.appreciation}% בשנה, שכר דירה +{d.rentGrowth}% בשנה, S&P 500 {d.spReturn}% בשנה
            בדולרים, הדולר נחלש {Math.abs(d.fxDrift)}% בשנה, אינפלציה {d.inflation}% בשנה. אפשר לשנות כל אחת מהן.
          </li>
          <li>הריבית על המשכנתא לפי כלל אצבע: כ-4.3% למשכנתא ל-10 שנים, ועוד 0.03% לכל שנה נוספת.</li>
        </ul>
      </Section>
      <Section title="כללי המס והבנקאות">
        <div className="overflow-x-auto">
          <table className="w-full min-w-[420px] text-[13.5px]">
            <caption className="sr-only">כללי המס והבנקאות בחישוב, הערכים, המקורות ותאריך הבדיקה</caption>
            <thead>
              <tr className="text-right text-slate-600">
                <th scope="col" className="py-2 pe-3 font-semibold">כלל</th>
                <th scope="col" className="py-2 pe-3 font-semibold">ערך בחישוב</th>
                <th scope="col" className="py-2 font-semibold">נבדק לאחרונה</th>
              </tr>
            </thead>
            <tbody>
              {RULES.map((r) => (
                <tr key={r.id} className="border-t border-slate-200 align-top">
                  <th scope="row" className="py-2 pe-3 text-right font-semibold text-slate-900">
                    {r.title}
                  </th>
                  <td className="py-2 pe-3 text-slate-700">
                    {r.value}
                    {r.expires && <span className="block text-amber-900">הוראת שעה עד {fmtDate(r.expires)}</span>}
                    {r.sources.length > 0 && (
                      <span className="mt-1 flex flex-wrap gap-x-3 gap-y-1">
                        {r.sources.map((s) => (
                          <a
                            key={s}
                            href={SOURCES[s].url}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="inline-flex items-center gap-1 text-slate-600 underline underline-offset-2 hover:text-slate-900"
                          >
                            {SOURCES[s].label}
                            <ExternalLink size={11} aria-hidden />
                            <span className="sr-only">(נפתח בחלון חדש)</span>
                          </a>
                        ))}
                      </span>
                    )}
                  </td>
                  <td className="py-2 tabular-nums text-slate-700">{fmtDate(r.checked)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </Section>
      <Section title="מה לא נכלל">
        <ul className="list-disc space-y-1 ps-5">
          <li>הכנסות נוספות באותה שנה (לצורך מס יסף), מס הכנסה על משכורת וזיכויים אישיים.</li>
          <li>אירועים מיוחדים: ירידות חדות, ריבית שקופצת לאורך זמן, שוכר שלא משלם.</li>
          <li>תשואות, ריביות ואינפלציה קבועות לאורך כל התקופה, בלי תנודות.</li>
        </ul>
      </Section>
    </>
  );
}

function Accessibility() {
  return (
    <>
      <Section title="מחויבות לנגישות">
        <p>
          אנחנו עובדים כדי שהאתר יהיה נגיש לכולם, לפי תקנות שוויון זכויות לאנשים עם מוגבלות (התאמות נגישות לשירות) והתקן הישראלי
          5568, ברמה AA.
        </p>
      </Section>
      <Section title="מה עשינו">
        <ul className="list-disc space-y-1 ps-5">
          <li>תוויות נגישות לכל השדות והכפתורים.</li>
          <li>ניווט מלא במקלדת, עם סימון ברור של המקום שבו נמצאים.</li>
          <li>ניגודיות צבעים לפי רמה AA, במצב בהיר ובמצב כהה.</li>
          <li>לגרפים יש חלופה טקסטואלית: תיאור במילים וטבלת מספרים.</li>
        </ul>
      </Section>
      <Section title="מה עוד לא נגיש">
        <p>
          <Todo text={FILL} />
        </p>
      </Section>
      <Section title="רכז הנגישות ויצירת קשר">
        <p>
          שם: <Todo text={FILL} />
        </p>
        <p>
          טלפון: <Todo text={FILL} />
        </p>
        <p>
          מייל: <a className="font-semibold underline underline-offset-2" href={`mailto:${CONTACT_EMAIL}`}>{CONTACT_EMAIL}</a>
        </p>
      </Section>
      <Section title="תאריך עדכון ההצהרה">
        <p>
          <Todo text={FILL} />
        </p>
      </Section>
    </>
  );
}

/** One of the info pages, with a back button. */
export function InfoPageView({ page, onBack }: { page: InfoPage; onBack: () => void }) {
  const title = INFO_PAGES.find((p) => p.id === page)?.title ?? "";
  return (
    <article className="space-y-5">
      <button type="button" onClick={onBack} className="inline-flex items-center gap-1 text-[14px] font-semibold text-slate-600 hover:text-slate-900">
        → חזרה
      </button>
      <h1 className="text-2xl font-bold text-slate-900 sm:text-[28px]">{title}</h1>
      <div className="space-y-6 rounded-2xl border border-slate-200 bg-white p-5 sm:p-7">
        {page === "terms" && <Terms />}
        {page === "privacy" && <Privacy />}
        {page === "rules" && <Rules />}
        {page === "a11y" && <Accessibility />}
      </div>
    </article>
  );
}

/** Footer links to the info pages. */
export function InfoLinks({ onOpen }: { onOpen: (page: InfoPage) => void }) {
  return (
    <nav aria-label="מידע על האתר" className="flex flex-wrap gap-x-4 gap-y-1">
      {INFO_PAGES.map((p) => (
        <a
          key={p.id}
          href={`#${p.id}`}
          onClick={(e) => {
            e.preventDefault();
            onOpen(p.id);
          }}
          className="underline decoration-slate-400 underline-offset-2 hover:text-slate-900"
        >
          {p.title}
        </a>
      ))}
    </nav>
  );
}
