# GCash Monitor (Phase 6: ready to deploy)

## First time
1. Finish the database setup in `supabase/README.md` (including migration 6).
2. Copy `.env.example` to `.env` and fill in your Supabase URL and PUBLISHABLE key.
3. Run:

       npm install
       npm run dev

Open http://localhost:5173 and log in with the owner account you created.
After changing `.env`, stop (Ctrl + C) and start again.

## Phone on the same Wi-Fi
    npm run dev -- --host

## Notes
- All data now lives in Supabase. Nothing is stored in the browser except the login session.
- Never put the Supabase secret / service_role key in this project.

## Checks
    npm test                 # 132 automated checks
    npm run build            # does it compile?
    npm run check:security   # secrets / risky code scan (after build)
    npm run check:contrast   # accessibility colour contrast

Full guide: `docs/PHASE5_TESTING_AND_SECURITY.md`

## Deploying
    npm run preflight        # tests + build + security scan, prints GO / NO-GO
    npm run verify:deploy -- https://your-site --supabase-ref=PROJECTREF

Full guide: `docs/PHASE6_DEPLOYMENT.md`

## How the store workflow maps to the app

| | Cash In | Cash Out |
|---|---|---|
| What happens | Customer gives their GCash number, staff sends the money, receipt is photographed | Customer sends GCash to the store, staff reads the reference from the receipt |
| Reference number | **Not needed** (no field) | **Required** (copied from the receipt) |
| Amount | Required | Required |
| Sender / receiver name | Optional | Optional |
| Duplicate-reference warning | n/a | Yes |
| Fee (service charge) | From the owner's fee table | From the owner's fee table |
| Customer pays | amount + fee | amount + fee |

The rule is enforced in the database too (migration 7), not just in the form.

## Fees and charges
The owner builds the fee table on **Fees & Charges** (for example: up to ₱100 → ₱10, up to ₱500 → ₱15).
Each tier covers amounts above the previous tier up to its own limit. The fee is the same for cash-in and
cash-out and is added to the amount (₱500 + ₱15 = ₱515). The **database** works out the fee, so staff cannot
change it. Each record keeps the fee it was charged, so changing the table never changes old records.
**Fees Collected** is shown separately from the money moved, and voided records earn no fee.
