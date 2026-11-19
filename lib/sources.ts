/** Official and reference sources behind the tax and banking rules (checked Nov 2026). */
export const SOURCES = {
  purchaseTax: {
    label: "כל זכות: חישוב מס רכישה",
    url: "https://www.kolzchut.org.il/he/%D7%97%D7%99%D7%A9%D7%95%D7%91_%D7%9E%D7%A1_%D7%A8%D7%9B%D7%99%D7%A9%D7%94",
  },
  taxSimulator: { label: "סימולטור מס רכישה של רשות המסים", url: "https://www.gov.il/he/service/real_eatate_taxsimulator" },
  freezeLaw: { label: "החוק שהקפיא את סכומי המס (2024)", url: "https://fs.knesset.gov.il/25/law/25_lsr_5396578.pdf" },
  upgrader: {
    label: "רשות המסים: הוראת ביצוע 2/2026",
    url: "https://www.gov.il/BlobFolder/policy/inst-02-2026-1/he/realestate_inst-02-2026.pdf",
  },
  rentTax: {
    label: "כל זכות: פטור ממס על השכרת דירה",
    url: "https://www.kolzchut.org.il/he/%D7%A4%D7%98%D7%95%D7%A8_%D7%9E%D7%9E%D7%A1_%D7%A2%D7%9C_%D7%94%D7%9B%D7%A0%D7%A1%D7%94_%D7%9E%D7%94%D7%A9%D7%9B%D7%A8%D7%AA_%D7%93%D7%99%D7%A8%D7%94_%D7%9C%D7%9E%D7%92%D7%95%D7%A8%D7%99%D7%9D",
  },
  ownRentDeduction: { label: "החוק: קיזוז שכר דירה במסלול 10%", url: "https://fs.knesset.gov.il/25/law/25_lsr_2572039.pdf" },
  shevach: {
    label: "כל זכות: פטור ממס שבח בדירה יחידה",
    url: "https://www.kolzchut.org.il/he/%D7%A4%D7%98%D7%95%D7%A8_%D7%9E%D7%9E%D7%A1_%D7%A9%D7%91%D7%97_%D7%91%D7%9E%D7%9B%D7%99%D7%A8%D7%AA_%D7%93%D7%99%D7%A8%D7%94_%D7%99%D7%97%D7%99%D7%93%D7%94",
  },
  surtax: { label: "החוק: מס יסף (סעיף 121ב)", url: "https://fs.knesset.gov.il/25/law/25_lsr_5396578.pdf" },
  boi329: { label: "בנק ישראל: הוראה 329 (מגבלות משכנתא)", url: "https://www.boi.org.il/media/ez4npagt/329.pdf" },
  boiQA: { label: "בנק ישראל: שאלות ותשובות על הוראה 329", url: "https://www.boi.org.il/media/emunmobp/202601.pdf" },
  prepay: { label: "בנק ישראל: עמלת פירעון מוקדם", url: "https://www.boi.org.il/media/qy5cow0l/116.pdf" },
  sp500Tax: { label: "ביזפורטל: מיסוי השקעה במדד", url: "https://www.bizportal.co.il/guides/news/article/20038659" },
  inflation: { label: "בנק ישראל: תחזית מקרו", url: "https://www.boi.org.il/media/kwrhjht1/forcast1026h1.pdf" },
} as const;

export type SourceId = keyof typeof SOURCES;
