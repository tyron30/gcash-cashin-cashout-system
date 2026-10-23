# Supabase setup (Phase 3)

Everything here builds the secure database. The React app is **not** connected yet
(that is Phase 4), so nothing in the app changes until then.

## Files

| File | What it does |
|------|--------------|
| `migrations/..0100_core_tables.sql` | Tables, constraints, indexes. RLS switched on. |
| `migrations/..0200_helpers_and_triggers.sql` | Role checks, Manila business date, delete protection, locked days, new-login profiles. |
| `migrations/..0300_rls_policies.sql` | Who can read which rows. Removes default permissions. |
| `migrations/..0400_rpc_functions.sql` | The approved actions: record, edit, void, totals, closing, staff access. |
| `migrations/..0500_function_permissions.sql` | Only the approved functions can be called, and only when logged in. |
| `migrations/..0800_fee_tiers.sql` | Owner-defined fee table (up to X pesos = fee Y). The database adds the fee to every transaction. **Run once if you already ran migrations 1-7.** |
| `migrations/..0700_reference_only_for_cash_out.sql` | Reference number is required for cash-out only; cash-in has none. **Run once if you already ran migrations 1-6.** |
| `migrations/..0600_search_and_staff_functions.sql` | Phase 4: History search, totals for filters, owner-only staff list. **Run once if you already ran migrations 1-5.** |
| `setup_all.sql` | All eight migrations joined into ONE file (for a brand-new project only). |
| `bootstrap_owner.sql` | Make the first owner and activate staff. Run by hand. |
| `seed.sql` | OPTIONAL fake data. Development project only. |
| `tests/rls_tests.sql` | 68 security checks (46-50 need migration 6, 51-54 migration 7, 55-68 migration 8). Saves nothing. |
| `tests/anon_access_test.ps1` | Confirms a logged-out visitor gets nothing. |

## How the security works (short version)

- **Roles live in the database** (`profiles.role`), never in the browser.
- **Row Level Security** is on for every table. Logged-out visitors get nothing.
- **Staff** can only see today's transactions (change `staff_history_days` in `store_settings`).
- **Nobody writes to the money tables directly.** The app calls approved functions that
  check the role, validate again, and write the audit log in the same step.
- **Nothing is deleted.** A trigger refuses `DELETE`. Mistakes are voided with a reason.
- **The audit log is append-only.** Not even the owner can edit it.
- **The business date is set by the database** from the timestamp, in Asia/Manila time.
- **A closed day is locked** until the owner reopens it (with a reason).
- **New logins start inactive.** A stranger who signs up can do nothing.

## Step 1. Create the project

1. Go to https://supabase.com, sign up, then **New project**.
2. Name: `gcash-monitor`. Choose a **strong database password** and save it in a password manager.
3. Region: pick the closest to the Philippines (Singapore).
4. Wait until the project finishes setting up.

> This system holds financial records. Before real use, check your Supabase plan's
> backup and pausing rules (free projects can pause when unused and have limited backups).

## Step 2. Auth settings

In the dashboard, **Authentication**:

1. **Sign In / Providers**: turn **OFF** "Allow new users to sign up". Only you create accounts.
2. Keep the **Email** provider on.
3. Set the **minimum password length to 8 or more**. If your plan offers leaked-password
   protection, turn it on.

## Step 3. Build the database

1. **SQL Editor** -> **New query**.
2. Open `supabase/setup_all.sql`, copy everything, paste, click **Run**.
3. Expect "Success. No rows returned". If there is an error, send me the exact message.
4. Check security is on. Run this; every row must say `true`:
   ```sql
   select tablename, rowsecurity from pg_tables where schemaname = 'public' order by 1;
   ```

## Step 4. Create the owner

1. **Authentication -> Users -> Add user -> Create new user**. Email + password.
   Tick **Auto Confirm User**.
2. Open `bootstrap_owner.sql`, put the same email in STEP 2, run that block.
   It must return ONE row with `role = admin`, `is_active = true`.

## Step 5. Create a staff login

Same as above (Add user), then run STEP 3 of `bootstrap_owner.sql` with their email.
(Phase 4 adds a Staff page so you can do this inside the app.)

Never delete a login that has transactions. Deactivate it instead.

## Step 6. Environment variables

1. In `C:\Projects\gcash-monitor`, copy `.env.example` to a new file named `.env`:
   ```powershell
   Copy-Item .env.example .env
   ```
2. Dashboard -> **Project Settings -> API** (or the **Connect** button). Copy the
   **Project URL** and the **publishable key** into `.env`.
3. **Never** use the `secret` / `service_role` key in the frontend.
4. `.env` is already in `.gitignore`, so it will not be uploaded by accident.

## Step 7. Test the security

1. **Database test:** open `tests/rls_tests.sql`, replace the two emails (owner and staff),
   paste into the SQL Editor, Run. You will see an "error" with a report. That is intentional.
   Every line must say `PASS`. It saves nothing.
2. **Visitor test** (needs `.env` from Step 6):
   ```powershell
   cd C:\Projects\gcash-monitor
   powershell -ExecutionPolicy Bypass -File .\supabase\tests\anon_access_test.ps1
   ```

## Step 8. Sample data (optional, development project only)

Paste `seed.sql` into the SQL Editor and run it. It only works if an owner exists and there
are no transactions yet. **Never run it on the project your store really uses.**

## Already ran migrations 1-7? Add service fees

Open `migrations/20261014000800_fee_tiers.sql`, paste it into the SQL Editor, and Run. Do **not** re-run `setup_all.sql`. Existing records are kept (they get a fee of 0.00, because no fee was charged when they were recorded). Then, in the app, the owner opens **Fees & Charges** and enters the fee table.

## Already ran migrations 1-6? Upgrade to the cash-in/cash-out reference rule

Open `migrations/20261014000700_reference_only_for_cash_out.sql`, paste it into the SQL Editor, and Run. Do **not** re-run `setup_all.sql`. Existing records are kept (old cash-in records that already have a reference keep it).

## Already ran migrations 1-5? (Phase 4 upgrade)

Open `migrations/20261014000600_search_and_staff_functions.sql`, paste it into the SQL Editor, and Run. Do NOT run `setup_all.sql` again on a project that already has the tables.

## How Phase 4 connected the app

| Phase 2 service function | Becomes (Supabase) |
|---|---|
| `signIn` / `signOut` | `supabase.auth.signInWithPassword` / `signOut`, then read `profiles` |
| `createTransaction` | `rpc('create_transaction', ...)` |
| `findDuplicateReference` | `rpc('find_duplicate_references', ...)` |
| `updateTransaction` / `voidTransaction` | `rpc('update_transaction')` / `rpc('void_transaction')` |
| `listTransactions` | `from('transactions').select(...)` with filters and `.range()` |
| `getDashboardData` | `rpc('daily_totals')` + latest rows |
| `getDailyReport` | `rpc('daily_totals')`, `rpc('staff_totals')`, `from('daily_closings')` |
| `saveClosing` / `reopenDay` | `rpc('save_daily_closing')` / `rpc('reopen_business_day')` |
| `getRangeReport` | `rpc('daily_totals')` + rows for the CSV |

## Adding your own functions later

Postgres lets everyone run a new function by default. After creating one, run:

```sql
revoke execute on function public.your_function(args) from public, anon;
grant execute on function public.your_function(args) to authenticated;
```
