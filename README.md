# נדל״ן מול סנופי — Real Estate vs. S&P 500 (Israel)

An interactive Hebrew (RTL) "What-If" simulator. It compares buying a leveraged investment apartment in Israel with putting the same cash into an S&P 500 index fund, after Israeli taxes.

## Run

```bash
npm install
npm run dev      # http://localhost:3000
npm test         # calculator unit + fuzz tests
npm run build
```

## Interface

- Light and dark mode: follows the device setting on first visit; the sun/moon button switches and the choice is remembered (localStorage). An inline script sets the theme before the first paint.
- Feedback: a footer button opens an email to the site owner; the address is also shown and can be copied (mail links don't always work inside embedded pages).

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
- **Live in or rent out** (sole apartment and upgrader): when the buyer lives in the new apartment, the rent they would otherwise pay counts as saved, in full (no vacancy, no rent tax; maintenance and insurance still apply). In the S&P track they live in a rental, and the difference is invested so both tracks spend the same each month.
- **Keep the old apartment and rent it out** (additional apartment): the owner moves into the new apartment and rents out the old one. Tax-wise it is still an additional apartment (8% purchase tax, 50% financing, מס שבח on the new one). Rent is based on the old apartment's value; in the S&P track the owner keeps living in the old apartment, so the old home itself is the same in both tracks.
- **Keep the old apartment and live elsewhere** (additional apartment): both apartments are rented out. The old one is rented in both tracks, so the comparison counts only the extra rent tax the new apartment causes, because the household shares one exemption ceiling (this can exceed 10% of the new rent, as it also ends the old rent's exemption).
- **Rent tax**: exempt up to ₪5,654/month (frozen through 2027, CPI-linked after). Between the ceiling and twice the ceiling, the tapered exemption applies and the rest is taxed at 10% (or the 10% track on gross rent, whichever is cheaper). Above twice the ceiling, 10% applies. A sole-apartment owner who lives in a rental may deduct the rent they pay, up to ₪90K a year, on the 10% track (s.122(f)).
- **S&P 500**: (1 + return) × (1 − fee) − 1, minus dividend withholding drag (0.32%/yr Israeli tracking fund at 25% US withholding, 0.19%/yr Irish ETF at 15%). At sale, 25% on the gain: CPI-indexed basis for a CPI-based Israeli fund (some Israeli funds are dollar-based; check the prospectus), USD-indexed for an Irish ETF under section 88 (assumed flat USD/ILS, so the nominal gain is taxed). Inflation default 2.0% (Bank of Israel forecast for 2027, long-run CPI about 1.9%).
- **Surtax (מס יסף)**: 5% (3% + 2% on capital income) on capital gains above ₪721,560 in the sale year, assuming no other income that year. Apartment sales count only if non-exempt and above ₪5,382,285.
- **Optional add-ons** (the user switches each on or off):
  - *Invest the monthly difference* (on by default): each month both tracks put in the same own money, the larger of the two tracks' outflows (apartment: mortgage + loan − net rent; S&P: its loan payment). Whichever track pays less invests the difference in an index fund. Off: the S&P track gets only the initial equity, and rent surpluses stay as cash.
  - *Loan for the apartment*: described above.
  - *Loan to invest in the S&P* (default 6.5%, 10 years): borrowed money is invested on day one; payments come out of pocket and the remaining balance is subtracted at sale. Interest deductibility against capital gains is not modelled (conservative).
- **Explanations**: the answer card shows three plain-language reasons (both tracks' gains plus the biggest cost) and the break-even yearly price growth at which both tracks end equal.
- **Benchmark additions** (see the calculator benchmark report):
  - *Mortgage*: blended rate by term rule of thumb (4.3% at 10 years + 0.03 points a year), optional tracks: CPI-linked share (real rate, indexed monthly) and variable share with a rate shift from year 2.
  - *S&P in shekels*: dollar return plus a USD/ILS drift (default −0.5%/yr); the Irish ETF's cost basis follows the dollar (section 88).
  - *Owner costs*: renovation reserve 0.5% of value a year, arnona and house committee in the vacant month (₪900), optional management fee, building insurance ₪50/month plus life insurance ₪100 per ₪1M of balance.
  - *Sale*: optional months on the market, building-age drag, notional depreciation (additional apartment), urban renewal (value jump, 25% levy, 3 years without income).
  - *Own rent rule of thumb*: a sole-apartment owner renting it out is assumed to pay about the same rent where they live, deducted on the 10% track (up to ₪90K a year).
  - *Risk gauge per track*: own money a bad year could wipe out = leverage (exposure ÷ own money) × a bad-year drop (single apartment −15%, S&P −35%), shown as five levels, plus extra steps for a borrowed down payment, a mostly variable/CPI-linked mortgage, payment-to-income above 40% or a loan to invest; with plain-language factors.
  - *Outputs*: break-even rent next to break-even price growth, pessimistic/your/optimistic range, today's-money values, a "how conservative are you?" meter (sets price growth, rent growth, S&P return and dollar drift together), source links in the tax explanations, a "what the numbers don't show" card, and a mixed-strategy page (#combo).
- **Not modelled**: US estate tax on US-domiciled ETFs, tax-deferred savings wrappers (קופת גמל להשקעה), the old home's מס שבח above the exemption ceiling, bridge-loan interest, and the old mortgage in the payment-to-income check.

This is a simulation, not investment advice.

### Optional inputs added Nov 2026 (all off by default; the six situation cards are unchanged)
- **Keren hishtalmut** (`hishtalmutAmount`, `hishtalmutFee` 0.6%): part of the cash. The apartment track withdraws it into the purchase; the S&P track leaves it in the fund's equity track: same market return, its own fee, no capital gains tax and no surtax. The breakdown shows what withdrawing it costs (25% of the real gain a regular fund would be taxed on).
- **Rent already received on the current apartment** (`oldHomeRent`, 0 = estimate from value × yield): used for that apartment's rent, the shared exemption ceiling and the tax (move-and-rent-old, two-rentals).
- **Spreading the portfolio sale** (`saleYears`, 1 = all at once): the index portfolios are sold in equal parts over N years and the 5% surtax is computed per year against the yearly threshold; the apartment sale stays in year one.
- **Guided path**: "where do you live today?" (own apartment / elsewhere with ours rented out → `liveElsewhere`), the housing cost (`ownRentPaid`) and the rent received.

`scripts/test-cards.ts` pins the six cards' reference values (balanced profile) and checks 3,000 random inputs and monotonicity.
