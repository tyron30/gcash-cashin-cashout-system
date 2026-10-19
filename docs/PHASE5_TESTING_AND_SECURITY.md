# Phase 5: Security and Testing

This is the quality gate before deployment. Work top to bottom.

## 1. Commands (PowerShell, in `C:\Projects\gcash-monitor`)

| Command | What it proves | Needs |
|---|---|---|
| `npm test` | 100 automated checks of money math, validation, CSV safety, Manila dates, error handling, and the SQL security rules | nothing |
| `npm run check:contrast` | Text colours meet WCAG AA contrast | nothing |
| `npm run build` | The whole app compiles for production | npm install |
| `npm run check:security` | No secrets or risky code in the project or in the built website | run `build` first |
| `npm run test:api` | The REAL Supabase API refuses everything it should (see section 3) | test logins |
| `supabase/tests/rls_tests.sql` | 54 database security checks, saves nothing | SQL Editor |
| `supabase/tests/anon_access_test.ps1` | A logged-out visitor gets nothing | `.env` |

Run `npm test`, `npm run build`, and `npm run check:security` after **every** future change.

## 2. Your 20 required scenarios: how each is verified

"Auto" = repeatable by command. "Manual" = you tap through it (steps in section 4).

| # | Scenario | Verified by |
|---|---|---|
| 1 | Admin can log in and use authorized pages | Manual (4.1) |
| 2 | Staff cannot do admin-only actions | SQL tests 7, 8, 15, 16, 46, 47; API test (staff section); Manual (4.2) |
| 3 | Staff cannot change their own role | SQL tests 9, 10; API test |
| 4 | Valid cash-in saves | SQL test 1; API test; Manual |
| 5 | Valid cash-out saves | SQL tests 3, 23; Manual |
| 6 | Masked names can be recorded | Auto (`validation`); SQL test 1 |
| 7 | Names can be blank | Auto (`validation`); SQL test 3 |
| 8 | Leading zeros preserved | Auto (`validation`, `csv`); SQL test 1 |
| 9 | Invalid amounts rejected | Auto (`validation`); SQL test 4; API test |
| 10 | Duplicate submissions handled safely | SQL test 2; API test; Manual double-tap (4.3) |
| 11 | Dashboard totals update after saving | SQL test 23; API test; Manual |
| 12 | Voided transactions excluded from totals | Auto (`calculations`); SQL tests 25, 26; API test |
| 13 | Historical reports show the correct date | Auto (`date`: midnight, leap day, year end); SQL tests 30, 31 |
| 14 | Totals stay correct after edits/voids | Auto (`calculations`); SQL tests 20-27 |
| 15 | CSV contains only authorized records | Auto (`csv` content + injection); Reports page is owner-only (route AND database); Manual (4.2) |
| 16 | RLS prevents unauthorized access | SQL tests 9-19, 28, 35, 40-50; `anon_access_test.ps1`; API test; `sql-policy` auto test |
| 17 | Mobile layouts have no sideways scrolling | Manual (4.5) |
| 18 | Loading, empty, and error states work | Manual (4.4, offline test) |
| 19 | Many users can record without corrupting totals | Manual two-device test (4.6). Totals are computed by the database from records, never added up in the browser |
| 20 | Closing and reopening are audited | SQL tests 32-39; API audit check |

## 3. API security test (real network path)

The SQL Editor tests cannot see the web API layer. This script signs in as a real staff
account and a real owner account and tries to break in the way a hacker with a browser would.

**It creates a few `TEST...` transactions and voids them. Voided records can never be deleted,
so they stay in History.** Best run on a development project.

```powershell
cd C:\Projects\gcash-monitor
$env:TEST_OWNER_EMAIL = Read-Host 'Owner email'
$env:TEST_OWNER_PASSWORD = [Net.NetworkCredential]::new('', (Read-Host 'Owner password' -AsSecureString)).Password
$env:TEST_STAFF_EMAIL = Read-Host 'Staff email'
$env:TEST_STAFF_PASSWORD = [Net.NetworkCredential]::new('', (Read-Host 'Staff password' -AsSecureString)).Password
npm run test:api
Remove-Item Env:TEST_OWNER_PASSWORD, Env:TEST_STAFF_PASSWORD
```

Passwords stay only in this PowerShell window and are cleared at the end. Every line must say PASS.

## 4. Manual test script

### 4.1 Owner
- [ ] Wrong password shows "Incorrect email or password." (same message for a wrong email)
- [ ] Owner logs in and sees Dashboard, Cash In, Cash Out, History, plus Closing, Reports, Staff, Audit logs, Settings
- [ ] Refresh the page: still logged in. Log out: back at the login page

### 4.2 Staff
- [ ] Staff sees only Dashboard, Cash In, Cash Out, History
- [ ] Typing `/reports`, `/closing`, `/staff`, `/audit-logs`, `/settings` in the address bar shows "You do not have access"
- [ ] On a record, staff has no Edit/Void buttons
- [ ] An account the owner has not activated sees "Waiting for activation"

### 4.3 Recording
- [ ] **Cash Out**: reference `0143872590316` is shown as `0143 872 590316`, and Save is refused without a reference
- [ ] **Cash In**: there is no reference field. Only the amount (and optional name/notes) is needed
- [ ] Amounts `0`, `-5`, `10.123`, `abc` show a clear message and do not save
- [ ] Save with a masked name `JU**** DE**`, then one with no name
- [ ] Double-tap Save quickly: exactly ONE record appears
- [ ] **Cash Out** with the same reference twice: the warning appears; "Save anyway" works
- [ ] Turn off Wi-Fi: the Save button pauses with a warning; turn it on and it works again
- [ ] Dashboard total changes by exactly the amount saved

### 4.4 Owner actions
- [ ] Edit an amount only: History shows ONE change (Amount), not a time change
- [ ] Void with a reason: the total drops and the record stays, struck through
- [ ] Close today: new records are refused; Reopen with a reason: allowed again
- [ ] Audit logs show every action above
- [ ] Reports: pick a range, download the CSV, open it in Excel (references keep their zeros, peso amounts are numbers)
- [ ] Print the Daily Closing report and the Reports page (the menu bars disappear)

### 4.5 Screen sizes (browser: F12 then Ctrl+Shift+M)
For each width, open Dashboard, Cash In, History, a record, Daily Closing, Reports, Staff:
**320, 375, 430, 768, 1024, 1440 px**
- [ ] No horizontal scrollbar on any page
- [ ] The Save button on forms is reachable and not hidden by the bottom bar
- [ ] Under 768 px: bottom bar + menu button. 768+: sidebar. 1024+: tables
- [ ] Dialogs fit the screen and scroll inside themselves
- [ ] Also test on a real phone (iPhone Safari and/or Android Chrome): inputs do not zoom the page when tapped

### 4.6 Two people at once
- [ ] Owner on the laptop, staff on a phone. Staff records 3 transactions. Within about a minute the owner's Dashboard totals update by themselves

### 4.7 Accessibility quick check
- [ ] Use only the keyboard (Tab, Enter, Space, Esc): you can log in, record a transaction, open and close a dialog
- [ ] The focus outline is visible on every button and field
- [ ] Browser zoom 200%: nothing is cut off
- [ ] Optional: Chrome DevTools -> Lighthouse -> Accessibility. Aim for 90+

## 5. Supabase dashboard checks

- [ ] **Database -> Advisors -> Security Advisor**: run it. Expected and OK: warnings that
  logged-in users can run the `SECURITY DEFINER` functions (`create_transaction`, `void_transaction`, ...). That is
  by design: every one of them checks the role inside. Anything else (especially "RLS disabled" or
  "exposed auth.users") must be fixed before going live. Send me the list if unsure.
- [ ] **Authentication**: sign-ups are OFF; minimum password length is 8+; leaked-password protection ON if your plan has it
- [ ] **Project Settings -> API**: only the publishable key is in your `.env`. The secret key is not on any computer or chat
- [ ] **Backups**: check what your plan includes. This system holds money records
- [ ] **Optional**: Database -> Extensions -> turn off `pg_graphql` (the app does not use it)

## 6. Dependency health

```powershell
npm audit --omit=dev
```
"found 0 vulnerabilities" is the goal. Do **not** run `npm audit fix --force` blindly (it can break the app).
Paste the output to me if there are findings.

## 7. Production headers

`vercel.json` adds a strict Content-Security-Policy (the browser may only talk to this site and
`*.supabase.co`), blocks framing (clickjacking), disables camera/mic/location, forces HTTPS, and asks
search engines not to index the site. It takes effect on Vercel (Phase 6). If the deployed site shows a
blank page, press F12 -> Console and send me any line starting with "Refused to...".

## 8. Go / no-go gate before Phase 6

- [ ] `npm test` all green
- [ ] `npm run build` succeeds
- [ ] `npm run check:security` says PASS
- [ ] `rls_tests.sql` all PASS, `anon_access_test.ps1` all PASS, `npm run test:api` all PASS
- [ ] Sections 4.1-4.7 ticked
- [ ] Security Advisor reviewed
- [ ] You know how to deactivate a staff member and reopen a closed day

## 9. Known limits (accepted on purpose)

- **Duplicate-reference warning** shows staff that an older record with the same reference exists (amount and who recorded it) even though they cannot open it. This catches reused receipts.
- **Test records cannot be deleted.** That is the same rule that protects real records.
- **No automatic logout when idle.** Easy to add if the store shares one phone.
- **Closing a day while someone is saving at the same second** is not locked at the database level. The owner should close after the store stops recording.
- **Free-tier limits** (pausing, backups) are a business decision, not a code issue.
