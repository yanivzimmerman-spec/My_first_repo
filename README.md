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

## Model assumptions

- **Purchase tax**: 2025 brackets. Single apartment: 0% up to ₪1,978,745, then 3.5% / 5% / 8% / 10%. Additional apartment: 8% from the first shekel, 10% above ₪6,055,070. Closing costs are a flat 2%.
- **Mortgage**: Spitzer amortization on price − (equity − purchase tax − closing costs). The term is adjustable (default 25 years).
- **Bank financing limit (enforced)**: the property price is capped so the mortgage never exceeds the Bank of Israel limit, 75% for a single apartment and 50% for an additional one. Equity must also cover purchase tax and closing costs, so ₪350K buys an additional apartment of at most ₪580K. The "max price" switch buys exactly that maximum.
- **Rent**: net yield × current property value, re-priced every year. No tax up to ₪5,654/month (CPI-linked). Above that, a flat 10% on the gross rent.
- **Cash-flow matching** (on by default): when the mortgage payment exceeds net rent, the S&P track invests the difference. When rent exceeds the payment, the surplus goes into an index fund inside the real-estate track. Both tracks therefore put in the same total cash.
- **Liquidation**: every yearly point is a full after-tax sale. Selling costs are 1%. מס שבח is 25% on the real gain for an additional apartment; a single apartment is exempt after 18 months. The S&P track pays 25% on the real gain, with the cost basis indexed to inflation (default 2.5%).

This is a simulation, not investment advice.
