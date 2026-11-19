/** What the numbers can't show: risks and alternatives that aren't in the calculation. */
export default function RisksCard() {
  const apartment = [
    "כל הכסף בנכס אחד: שכונה, בניין או שוכר בעייתי משפיעים ישירות.",
    "קשה למכור מהר: מכירה לוקחת חודשים, ואי אפשר למכור רק חלק.",
    "מינוף: ירידה של 10% במחיר יכולה למחוק שליש מההון העצמי.",
    "ניהול: תיקונים, שוכרים, חוזים, ועד בית.",
    "יתרון למי שגר בדירה: הגנה מעליית שכר הדירה וביטחון בדיור.",
  ];
  const sp = [
    "תנודות: שנה גרועה יכולה להוריד 30% עד 50%, ומי שמוכר בזמן ירידה מפסיד.",
    "שער הדולר משפיע על התשואה בשקלים.",
    "הלוואה להשקעה: בירידה חדה הבנק יכול לדרוש החזר או למכור.",
    "קל למכור בכל יום, וגם חלק. מפוזר על 500 חברות, ובלי ניהול.",
    "קופת גמל להשקעה דוחה את המס עד המשיכה (לא מחושב כאן).",
  ];
  return (
    <section className="rounded-2xl border border-slate-200 bg-white p-5 sm:p-7">
      <h3 className="text-lg font-bold text-slate-900">מה המספרים לא מראים</h3>
      <p className="mt-0.5 text-[13px] text-slate-500">סיכונים ויתרונות שלא נכנסים לחישוב, אבל חשובים להחלטה</p>
      <div className="mt-4 grid gap-5 sm:grid-cols-2">
        <div>
          <h4 className="mb-2 flex items-center gap-2 text-[14px] font-semibold text-re-ink">
            <span className="h-2 w-2 rounded-full bg-re" /> דירה
          </h4>
          <ul className="space-y-1.5 text-[13.5px] leading-relaxed text-slate-600">
            {apartment.map((t) => (
              <li key={t} className="flex gap-2">
                <span className="text-slate-300">•</span>
                {t}
              </li>
            ))}
          </ul>
        </div>
        <div>
          <h4 className="mb-2 flex items-center gap-2 text-[14px] font-semibold text-sp-ink">
            <span className="h-2 w-2 rounded-full bg-sp" /> S&P 500
          </h4>
          <ul className="space-y-1.5 text-[13.5px] leading-relaxed text-slate-600">
            {sp.map((t) => (
              <li key={t} className="flex gap-2">
                <span className="text-slate-300">•</span>
                {t}
              </li>
            ))}
          </ul>
        </div>
      </div>
    </section>
  );
}
