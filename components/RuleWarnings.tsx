import { AlertTriangle } from "lucide-react";
import type { ApartmentType } from "@/lib/calculator";
import { staleRules, additionalTaxOrderExpired } from "@/lib/rules";

/**
 * Notices about the tax rules themselves: values not checked for over a year, and the
 * additional-apartment purchase tax after its temporary order has ended.
 */
export default function RuleWarnings({ apartmentType, onRules }: { apartmentType: ApartmentType; onRules?: () => void }) {
  const stale = staleRules().length > 0;
  const orderEnded = apartmentType === "additional" && additionalTaxOrderExpired();
  if (!stale && !orderEnded) return null;
  return (
    <div role="note" className="mt-4 space-y-1.5 rounded-lg bg-amber-50 px-3.5 py-2.5 text-[13.5px] leading-relaxed text-amber-900">
      {stale && (
        <p className="flex gap-2">
          <AlertTriangle size={16} className="mt-0.5 shrink-0" aria-hidden />
          <span>
            ייתכן שהנתונים לא עדכניים: חלק מכללי המס נבדקו לפני יותר משנה.
            {onRules && (
              <>
                {" "}
                <button type="button" onClick={onRules} className="font-semibold underline underline-offset-2">
                  איך זה מחושב
                </button>
              </>
            )}
          </span>
        </p>
      )}
      {orderEnded && (
        <p className="flex gap-2">
          <AlertTriangle size={16} className="mt-0.5 shrink-0" aria-hidden />
          <span>
            מס הרכישה על דירה נוספת (8% ו-10%) נקבע בהוראת שעה שהסתיימה ב-10.2.2027. השיעור עשוי להשתנות, והחישוב עדיין
            משתמש בשיעורים האלה.
          </span>
        </p>
      )}
    </div>
  );
}
