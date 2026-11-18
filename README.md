# נדל״ן מול סנופי — Real Estate vs. S&P 500 (Israel)

An interactive Hebrew (RTL) "What-If" simulator. It compares buying a leveraged investment apartment in Israel with putting the same cash into an S&P 500 index fund, after Israeli taxes.

## Run

```bash
npm install
npm run dev      # http://localhost:3000
npm test         # calculator unit + fuzz tests
npm run build
```

## Structure

| Path | Purpose |
|---|---|
| `lib/calculator.ts` | Pure month-by-month engine: Spitzer mortgage, rent and rental tax, מס רכישה, מס שבח, real capital-gains tax, cash-flow matching |
| `lib/format.ts` | ₪ / % formatting (LTR-isolated for RTL text) |
| `lib/url.ts` | Share-link encoding (only non-default values) |
| `lib/presets.ts` | Quick scenarios |
| `components/` | Control panel, verdict, Recharts chart, breakdown table |
| `scripts/test-calculator.ts` | Sanity tests + 3,000-case NaN/Infinity fuzz |

## Model assumptions (Israeli rules as of late 2026)

The full source review is in a local research report; each rule below was checked against 2025-2026 sources.

- **Apartment type**
  - *Single apartment*: single-apartment purchase-tax brackets (0% to ₪1,978,745, then 3.5% / 5% / 8% / 10%; amounts frozen until 15.1.2028), 75% max financing, exempt from מס שבח after 18 months up to a ₪5,008,000 sale price. Above the ceiling, the matching share of the gain is taxed at 25%.
  - *Upgrader*: single-apartment purchase tax (assumes the old home is sold within 24 months), 70% max financing, exempt on sale.
  - *Additional apartment*: 8% purchase tax from the first shekel, 10% above ₪6,055,070 (a temporary order for purchases up to 10.2.2027), 50% max financing, 25% מס שבח on the real gain.
- **Bank limit (enforced)**: the price is capped so cash covers the down payment, purchase tax and buying costs (Directive 329: 75% when owning no other apartment, including an upgrader who sells first; 70% for an upgrader who buys first; 50% otherwise). An optional check compares housing payments with income (50% maximum, above 40% banks are cautious).
- **Transaction costs**: broker 2% (optional) plus lawyer 0.5%, each plus 18% VAT, on both purchase and sale. Buying also adds ₪10,000 fixed (appraiser, mortgage advisor, bank fees).
- **Mortgage**: Spitzer, one average rate (default 4.8%), term up to 30 years.
- **Down-payment loan (optional)**: a personal / "any purpose" loan (default 7.5%, 10 years) added to the cash for the purchase. Its payments count as out-of-pocket, so with matching on the S&P track invests the same amount. The remaining balance is subtracted at sale. Banks check where the equity comes from, and since February 2026 all housing credit counts toward the 50% payment-to-income limit.
- **Rent**: the yield is gross on the purchase price; rent grows by its own rate (default 3%/yr). One vacant month a year, 8% maintenance and ₪150/month insurance are deducted.
- **Rent tax**: exempt up to ₪5,654/month (frozen through 2027, CPI-linked after). Between the ceiling and twice the ceiling, the cheaper of the tapered exemption (remainder at a 31% marginal rate) and 10% of gross rent applies. Above twice the ceiling, 10% applies. A sole-apartment owner who lives in a rental may deduct the rent they pay, up to ₪90K a year, on the 10% track (s.122(f)).
- **S&P 500**: (1 + return) × (1 − fee) − 1, minus dividend withholding drag (0.32%/yr Israeli tracking fund at 25% US withholding, 0.19%/yr Irish ETF at 15%). At sale, 25% on the gain: CPI-indexed basis for a CPI-based Israeli fund (some Israeli funds are dollar-based; check the prospectus), USD-indexed for an Irish ETF under section 88 (assumed flat USD/ILS, so the nominal gain is taxed). Inflation default 2.0% (Bank of Israel forecast for 2027, long-run CPI about 1.9%).
- **Surtax (מס יסף)**: 5% (3% + 2% on capital income) on capital gains above ₪721,560 in the sale year, assuming no other income that year. Apartment sales count only if non-exempt and above ₪5,382,285.
- **Optional add-ons** (the user switches each on or off):
  - *Invest the monthly difference* (on by default): each month both tracks put in the same own money, the larger of the two tracks' outflows (apartment: mortgage + loan − net rent; S&P: its loan payment). Whichever track pays less invests the difference in an index fund. Off: the S&P track gets only the initial equity, and rent surpluses stay as cash.
  - *Loan for the apartment*: described above.
  - *Loan to invest in the S&P* (default 6.5%, 10 years): borrowed money is invested on day one; payments come out of pocket and the remaining balance is subtracted at sale. Interest deductibility against capital gains is not modelled (conservative).
- **Explanations**: the answer card shows three plain-language reasons (both tracks' gains plus the biggest cost) and the break-even yearly price growth at which both tracks end equal.
- **Not modelled**: notional depreciation the Tax Authority deducts on rented apartments (under legal challenge), the household-level rent ceiling across several properties, the ₪90K deduction for owners who rent their own home, the track mix of a real mortgage, and US estate tax on US-domiciled ETFs.

This is a simulation, not investment advice.
