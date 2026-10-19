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
    npm test                 # 85 automated checks
    npm run build            # does it compile?
    npm run check:security   # secrets / risky code scan (after build)
    npm run check:contrast   # accessibility colour contrast

Full guide: `docs/PHASE5_TESTING_AND_SECURITY.md`

## Deploying
    npm run preflight        # tests + build + security scan, prints GO / NO-GO
    npm run verify:deploy -- https://your-site --supabase-ref=PROJECTREF

Full guide: `docs/PHASE6_DEPLOYMENT.md`
