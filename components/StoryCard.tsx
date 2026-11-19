"use client";

import type { SimResult } from "@/lib/calculator";
import { formatCompactILS, formatILS } from "@/lib/format";

function Step({ when, children }: { when: string; children: React.ReactNode }) {
  return (
    <li className="relative border-r-2 border-slate-100 pb-4 pr-4 last:pb-0">
      <span className="absolute -right-[5px] top-1.5 h-2 w-2 rounded-full bg-slate-300" />
      <p className="text-[12px] font-semibold text-slate-400">{when}</p>
      <p className="mt-0.5 text-[14px] leading-relaxed text-slate-700">{children}</p>
    </li>
  );
}

const B = ({ children }: { children: React.ReactNode }) => <span className="font-semibold text-slate-900">{children}</span>;

/** "What actually happens" in each track, in three steps, with the user's own numbers. */
export default function StoryCard({ result }: { result: SimResult }) {
  const r = result;
  const re = r.realEstate;
  const sp = r.sp500;
  const y = r.inputs.years;
  const matching = r.inputs.cashflowMatching;
  const own = re.initialMonthlyOwn;
  const debtsAtSale = re.remainingMortgage + re.extraLoanRemaining;
  const reTaxAtSale = re.shevachTax + re.surtax + re.sideFundTax;
  const spTaxAtSale = sp.capitalGainsTax + sp.surtax;
  const reMonthlyOut = re.monthlyMortgagePayment + re.extraLoanPayment;

  return (
    <section className="rounded-2xl border border-slate-200 bg-white p-5 sm:p-7">
      <h3 className="text-lg font-bold text-slate-900">מה קורה בכל מסלול</h3>
      <p className="mt-0.5 text-[13px] text-slate-500">אותו כסף, שתי דרכים</p>

      <div className="mt-5 grid gap-6 sm:grid-cols-2 sm:gap-8">
        {/* Apartment */}
        <div>
          <h4 className="mb-3 flex items-center gap-2 text-[15px] font-semibold text-re-ink">
            <span className="h-2.5 w-2.5 rounded-full bg-re" />
            קונים דירה
          </h4>
          <ol>
            <Step when="היום">
              {re.oldHomeNetProceeds > 0 && (
                <>
                  מוכרים את הדירה הקיימת ונשארים עם {formatCompactILS(re.oldHomeNetProceeds)} אחרי עמלות וסגירת המשכנתא.{" "}
                </>
              )}
              קונים דירה ב-<B>{formatCompactILS(re.propertyPrice)}</B> עם משכנתא של {formatCompactILS(re.loanAmount)}
              {re.extraLoanPrincipal > 0 && <> והלוואה של {formatCompactILS(re.extraLoanPrincipal)}</>}. מס רכישה ועלויות:{" "}
              {formatCompactILS(re.purchaseTax + re.closingCosts)}.
            </Step>
            <Step when="כל חודש (בשנה הראשונה)">
              {re.livesInNew ? (
                <>
                  גרים בדירה ומשלמים לבנק {formatILS(reMonthlyOut)}, אבל לא משלמים שכירות של{" "}
                  {formatILS(re.initialMonthlyRentGross)}.{" "}
                </>
              ) : (
                <>
                  {re.rentsOutOld && <>עוברים לגור בדירה החדשה ומשכירים את הישנה. </>}
                  {re.rentsOutBoth && <>גרים במקום אחר ומשכירים את שתי הדירות. </>}
                  משלמים לבנק {formatILS(reMonthlyOut)}, ומהשכירות{re.rentsOutOld ? " של הדירה הישנה" : ""} נשארים{" "}
                  {formatILS(re.initialMonthlyRentNet)}.{" "}
                </>
              )}
              {re.initialMonthlyGap > 0.5 ? (
                <>
                  {re.livesInNew ? "מעבר לשכירות שנחסכה, אתם מוסיפים " : "אתם מוסיפים "}
                  <B>{formatILS(re.initialMonthlyGap)}</B> מהכיס.
                </>
              ) : (
                <>
                  נשארים לכם <B>{formatILS(-re.initialMonthlyGap)}</B>
                  {matching ? ", שמושקעים במדד." : "."}
                </>
              )}
              {re.initialSideDeposit > 0.5 && re.initialMonthlyGap > 0.5 && (
                <> ועוד {formatILS(re.initialSideDeposit)} מושקעים במדד, כדי להשוות להלוואה במסלול ה-S&P.</>
              )}
            </Step>
            <Step when={`אחרי ${y} שנה`}>
              מוכרים ב-{formatCompactILS(re.finalPropertyValue)}
              {debtsAtSale > 1 ? <>, מחזירים לבנק {formatCompactILS(debtsAtSale)}</> : null}
              {reTaxAtSale > 1 ? <> ומשלמים {formatCompactILS(reTaxAtSale)} מס</> : <> (בלי מס שבח)</>}. נשאר לכם{" "}
              <B>{formatCompactILS(re.netWorth)}</B>.
            </Step>
          </ol>
        </div>

        {/* S&P */}
        <div>
          <h4 className="mb-3 flex items-center gap-2 text-[15px] font-semibold text-sp-ink">
            <span className="h-2.5 w-2.5 rounded-full bg-sp" />
            משקיעים ב-S&P 500
          </h4>
          <ol>
            <Step when="היום">
              {re.oldHomeNetProceeds > 0 && <>גם כאן מוכרים את הדירה הקיימת. </>}משקיעים את אותם <B>{formatCompactILS(re.startCapital)}</B> {sp.vehicle === "israeli" ? "בקרן מחקה" : "ב-ETF אירי"}
              {sp.loanPrincipal > 0 && <>, ועוד הלוואה של {formatCompactILS(sp.loanPrincipal)}</>}. בלי מס רכישה ובלי עמלות
              גדולות.
            </Step>
            <Step when="כל חודש (בשנה הראשונה)">
              {re.livesInNew && <>גרים בשכירות ומשלמים {formatILS(re.initialMonthlyRentGross)}. </>}
              {re.rentsOutOld && <>ממשיכים לגור בדירה הישנה. </>}
              {re.rentsOutBoth && <>גרים במקום אחר ומשכירים את הדירה הישנה, כמו במסלול הדירה. </>}
              {sp.loanPrincipal > 0 && <>מחזירים {formatILS(sp.loanPayment)} על ההלוואה. </>}
              {matching ? (
                sp.initialDeposit > 0.5 ? (
                  <>
                    מפקידים <B>{formatILS(sp.initialDeposit)}</B>
                    {sp.loanPrincipal > 0 || re.livesInNew
                      ? " במדד, כך שבסך הכול יוצא מהכיס אותו סכום כמו בדירה."
                      : ", בדיוק הסכום שהייתם מוסיפים לדירה."}
                  </>
                ) : own > 0.5 ? (
                  <>זה אותו סכום שיוצא מהכיס במסלול הדירה.</>
                ) : (
                  re.livesInNew ? (
                    <>לא מפקידים: השכירות היא כל ההוצאה. במסלול הדירה אותו סכום הולך למשכנתא, לתחזוקה ולמדד.</>
                  ) : (
                    <>לא מפקידים כלום, כי הדירה לא דורשת תוספת מהכיס.</>
                  )
                )
              ) : (
                <>לא מפקידים כלום. (ההשקעה החודשית כבויה.)</>
              )}
            </Step>
            <Step when={`אחרי ${y} שנה`}>
              התיק שווה {formatCompactILS(sp.grossValue)}
              {sp.loanRemaining > 1 && <>, מחזירים {formatCompactILS(sp.loanRemaining)} הלוואה</>}
              {spTaxAtSale > 1 && <> ומשלמים {formatCompactILS(spTaxAtSale)} מס</>}. נשאר לכם{" "}
              <B>{formatCompactILS(sp.netWorth)}</B>.
            </Step>
          </ol>
        </div>
      </div>

      {matching && own > 0.5 && (
        <p className="mt-5 border-t border-slate-100 pt-4 text-[13px] leading-relaxed text-slate-500">
          בשני המסלולים יוצא מהכיס אותו סכום: {formatCompactILS(re.startCapital)} היום ועוד כ-
          {formatILS(re.livesInNew ? own + re.initialMonthlyRentGross : own)} בחודש
          {re.livesInNew ? " (בדירה: משכנתא, תחזוקה וביטוח; ב-S&P: שכירות והפקדה)" : ""}. כך ההשוואה הוגנת.
        </p>
      )}
    </section>
  );
}
