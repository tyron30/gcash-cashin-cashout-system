# Phase 6: Deployment

Goal: your store opens the app from any phone at a private web address, over HTTPS, using a
**production** database that holds only real records.

Time needed: about 60-90 minutes the first time.

---

## 0. The plan in one picture

```
 Staff phones / owner laptop  --HTTPS-->  Vercel (the website files)
                                              |
                                              +--HTTPS-->  Supabase PRODUCTION project (the data)

 Your laptop (development)  ----------------------------->  Supabase DEVELOPMENT project (test data)
```

**Use two Supabase projects.** Test records can never be deleted (that is the point of the system),
so the project you tested in (test transactions, sample data, `TEST...` rows) should NOT become
your store's books. Make a fresh **production** project and keep the old one for development.

---

## 1. Pre-flight (on your laptop)

```powershell
cd C:\Projects\gcash-monitor
npm install
npm run preflight
```

It runs the 100 tests, the contrast check, the production build, and the security scan, then prints
**GO** or **NO-GO**. Do not continue on NO-GO. Send me the red text instead.

(This is also the first full production build of the project. If it fails, that is exactly why it exists.)

---

## 2. Create the PRODUCTION Supabase project

1. supabase.com -> **New project**. Name it `gcash-monitor-prod`, region **Singapore**, strong database password (save it in a password manager).
2. **SQL Editor -> New query**, paste ALL of `supabase/setup_all.sql`, **Run**. (This brand-new project needs all six migrations; that file has them.) Expect "Success".
3. Confirm security is on. Run:
   ```sql
   select tablename, rowsecurity from pg_tables where schemaname = 'public' order by 1;
   ```
   Every row must say `true`.
4. **Authentication** settings:
   - Turn **OFF** "Allow new users to sign up".
   - Minimum password length **8+** (12 is better). Turn on leaked-password protection if your plan offers it.
5. **Authentication -> Users -> Add user -> Create new user**: the OWNER's email + strong password, tick **Auto Confirm User**.
6. Make that login the owner. Run (with the real email):
   ```sql
   update public.profiles
   set role = 'admin', is_active = true, full_name = 'Owner Name'
   where id = (select id from auth.users where email = 'owner@yourstore.com')
   returning email, role, is_active;
   ```
   It must return ONE row with `role = admin`.
7. Add staff the same way (Add user), then activate them **inside the app** later (Staff page).
8. Copy the production values from **Project Settings -> API** (also under the **Connect** button):
   - **Project URL** (`https://xxxx.supabase.co`) and note the part before `.supabase.co` (the "project ref")
   - **Publishable key** (`sb_publishable_...`)
   - Never copy the `secret` / `service_role` key anywhere.

**Do NOT run** `seed.sql` or `npm run test:api` on production. Those create fake or test records.
(`rls_tests.sql` is safe on production: it cancels itself and saves nothing.)

---

## 3. Put the website on the internet

### Which host?
**Vercel** is used below. One thing to check: Vercel's free "Hobby" plan is meant for personal,
non-commercial use, and a store's system is commercial, so you may need their paid plan. Read their
current terms. If you prefer a host with a free commercial tier (for example **Cloudflare Pages** or
**Netlify**), the project already includes `public/_headers` and `public/_redirects` for them. The
settings are the same: build command `npm run build`, output folder `dist`, and the same two environment
variables. Tell me if you pick one of those and I will walk you through it.

### Option A (recommended): GitHub + Vercel
Every future update is then "push, and it deploys", with one-click rollback.

1. Install Git (PowerShell): `winget install --id Git.Git -e` (or download from git-scm.com). **Close and reopen PowerShell.**
2. One-time identity:
   ```powershell
   git config --global user.name "Your Name"
   git config --global user.email "you@example.com"
   ```
3. On github.com create a **Private** repository named `gcash-monitor` (leave "Add a README" unticked).
4. Upload the project:
   ```powershell
   cd C:\Projects\gcash-monitor
   git init
   git add .
   git status
   ```
   **Look at the list.** `.env` must NOT appear (it is ignored on purpose). If it does, stop and tell me.
   ```powershell
   git commit -m "GCash Monitor"
   git branch -M main
   git remote add origin https://github.com/YOUR-USERNAME/gcash-monitor.git
   git push -u origin main
   ```
5. vercel.com -> sign up with GitHub -> **Add New -> Project** -> import `gcash-monitor`.
6. Settings on the import screen:
   - Framework Preset: **Vite** (detected automatically)
   - Build Command `npm run build`, Output Directory `dist` (defaults are right)
   - **Environment Variables** (Production): add exactly these two with your **PRODUCTION** values from step 2.8:
     - `VITE_SUPABASE_URL`
     - `VITE_SUPABASE_PUBLISHABLE_KEY`
7. Click **Deploy**. You get an address like `https://gcash-monitor-xxxx.vercel.app`.

### Option B: no GitHub (Vercel command line)
```powershell
npm install -g vercel
cd C:\Projects\gcash-monitor
vercel login
vercel            # answer the questions; accept the defaults
vercel env add VITE_SUPABASE_URL production
vercel env add VITE_SUPABASE_PUBLISHABLE_KEY production
vercel --prod
```

### Two things that trip people up
- **Variables are baked in when the site is BUILT.** If you add or change them, you must **redeploy** (Deployments -> the latest -> Redeploy). Changing a variable alone does nothing.
- **Preview deployments** (created for other branches) do not get the production variables. They show the "Supabase is not configured" page. That is intentional, so previews never touch real data.

If Vercel's build fails with a Node version message: Project **Settings -> General -> Node.js Version** -> pick 22.x (or newer), then redeploy.
If visitors see a Vercel login page instead of your app: **Settings -> Deployment Protection**. The production address should be public (the app has its own login).

---

## 4. Verify the live site (automatic)

```powershell
cd C:\Projects\gcash-monitor
npm run verify:deploy -- https://YOUR-SITE.vercel.app --supabase-ref=YOUR_PRODUCTION_PROJECT_REF
```

It checks, from the outside, like a stranger would:
HTTPS and the http-to-https redirect, all the security headers, that refreshing deep links works, that the phone icons load,
that **no secret key is inside the website**, that the site is wired to the **production** database (that is what
`--supabase-ref` checks), and that a logged-out visitor can read and record **nothing**.
Everything must say PASS. Run it again after every deployment.

## 5. Verify Supabase for production (checklist)

- [ ] Every table shows `rowsecurity = true` (step 2.3)
- [ ] **Database -> Advisors -> Security Advisor** reviewed. Warnings that logged-in users can run the `SECURITY DEFINER` functions are expected (each checks the role inside). Anything about "RLS disabled" is not OK
- [ ] Sign-ups are OFF; password rules set
- [ ] **Authentication -> URL Configuration** (Site URL): set to your live address (and your custom domain once you have one)
- [ ] The only key in Vercel is the **publishable** key. The secret key is stored nowhere
- [ ] Optional but recommended: run `supabase/tests/rls_tests.sql` once on production with the owner and a staff email (it saves nothing)
- [ ] **Backups:** check what your Supabase plan includes. For money records, a paid plan with daily backups is the safer choice. Also see "monthly export" in section 9
- [ ] Optional: turn off the `pg_graphql` extension (the app does not use it)

## 6. First real smoke test on the live site

Do this on your own phone, over mobile data (not Wi-Fi), so you test it like a customer-day.

- [ ] Open the address. The login page appears (padlock in the address bar)
- [ ] Log in as the **owner**. Open **Staff**, activate a staff member
- [ ] Log in as **staff** on a second device. They see only Dashboard / Cash In / Cash Out / History
- [ ] Staff records one real **PHP 1** cash-in (no reference needed), then one **PHP 1** cash-out with a reference. Owner sees it on the dashboard
- [ ] Owner **voids** it with the reason "Go-live test". (It stays as a voided row. That is how the system proves the books were never altered.)
- [ ] Owner downloads a CSV and opens it in Excel

---

## 7. Phones and tablets

**Share with staff:** send them the address plus their own email and password (one login per person, never share the owner's).

**Add to the home screen** (opens like an app, full screen):

| Device | Steps |
|---|---|
| iPhone / iPad | Open the address in **Safari** -> Share button -> **Add to Home Screen** -> Add |
| Android | Open in **Chrome** -> menu (three dots) -> **Install app** or **Add to Home screen** |
| Laptop / PC | Chrome or Edge -> address bar install icon, or just bookmark it |

Notes:
- The first time from the home-screen icon, staff log in once again (it keeps its own session, separate from the browser).
- The app needs internet to save. With no signal it shows a warning and keeps what you typed. It never pretends a record saved.
- On a shared counter phone: set a screen lock. If a phone is lost, **deactivate that person on the Staff page**. Access stops immediately, even though they stay logged in.

Copy-paste message for staff:
> Open https://YOUR-ADDRESS on your phone. Log in with your email and the password I gave you. Then tap Share -> Add to Home Screen (iPhone) or the menu -> Install app (Android).

---

## 8. Your own domain and HTTPS

HTTPS is automatic and free on Vercel (on the `.vercel.app` address and on your own domain). A custom domain is optional but looks professional (`gcash.yourstore.com`).

1. Buy a domain from any registrar.
2. Vercel -> your project -> **Settings -> Domains -> Add**. Use a **subdomain** such as `gcash.yourstore.com`.
3. Vercel shows the DNS record to create. Use **exactly what Vercel displays** (for a subdomain it is normally a `CNAME`). Add it at your registrar's DNS page.
4. Wait a few minutes (sometimes up to a few hours). Vercel shows a green check and issues the HTTPS certificate by itself.
5. Update Supabase **Authentication -> URL Configuration -> Site URL** to the new address.
6. Run: `npm run verify:deploy -- https://gcash.yourstore.com --supabase-ref=YOUR_PROD_REF`

Why a subdomain instead of the bare domain: the site sends an HTTPS-only rule (HSTS) that includes subdomains. On `gcash.yourstore.com` that only affects the app. On the bare `yourstore.com` it would also force HTTPS on every other subdomain you own (like a mail or older site), which could break them.

---

## 9. Running it day to day

**Updating the app**
```powershell
npm test
npm run build
git add .
git commit -m "What I changed"
git push
npm run verify:deploy -- https://YOUR-ADDRESS --supabase-ref=YOUR_PROD_REF
```
(Vercel deploys by itself on `git push`.)

**Changing the database:** never edit old migration files. Add a new numbered file, try it on the DEVELOPMENT project first, then run it on production in the SQL Editor, then deploy the matching code.

**Rolling back a bad update:** Vercel -> Deployments -> choose the last good one -> promote / instant rollback. Database changes are not undone by this, which is why they are tested first.

| When | Do this |
|---|---|
| Every close | Owner reviews the day, enters counted cash, closes the day |
| Weekly | Owner skims **Audit logs** and the voided records |
| Monthly | **Reports -> CSV** for the month, saved somewhere outside the app (your own backup) |
| Staff leaves / phone lost | **Staff page -> Manage -> turn off "Account is active"**. Never delete a login that has records |
| Staff forgets password | See below |

**Password reset.** The app has no "forgot password" screen yet. First look in Supabase **Authentication -> Users**, click the person, and use any reset or password option shown. If there is none that works, an advanced fallback in the SQL Editor (change it immediately after, and try it on a test account first):
```sql
update auth.users
set encrypted_password = extensions.crypt('NEW-STRONG-PASSWORD', extensions.gen_salt('bf'))
where email = 'person@example.com';
```
I can build a proper owner-only password reset in a later update (it needs a small server function).

**If a key or password may have leaked:** Supabase -> Project Settings -> API -> rotate/regenerate the keys, put the new publishable key in Vercel, redeploy, then change the owner password.

---

## 10. Troubleshooting

| What you see | Cause and fix |
|---|---|
| "Supabase is not configured" page on the live site | The two variables were missing when it was built. Add them in Vercel, then **Redeploy** |
| "Unsafe key detected" | A secret key was used. Replace it with the publishable key, redeploy, and rotate the secret key in Supabase |
| Blank white page | F12 -> Console. Lines starting "Refused to..." mean the security policy blocked something. Send me the line |
| Page not found when refreshing `/transactions` | `vercel.json` was not deployed. Check it is in the repository |
| Login says "Incorrect email or password" for a correct login | You are using the dev login on the production database (or the reverse). Logins are per project |
| "Waiting for activation" | The owner must activate the person on the Staff page |
| Works on Wi-Fi, not on mobile data | Almost always a typo in the Supabase URL variable. Run `verify:deploy` |
| `verify:deploy` says the site uses a different project | You shipped the dev keys. Fix the Vercel variables and redeploy |
| Build fails on Vercel | Copy the last 20 lines of the build log to me |

---

## 11. Go-live checklist

- [ ] `npm run preflight` says GO
- [ ] Production Supabase project created, `setup_all.sql` run, RLS all `true`
- [ ] Owner account is `admin`; sign-ups are OFF
- [ ] Vercel variables are the PRODUCTION values
- [ ] `npm run verify:deploy` all PASS with `--supabase-ref`
- [ ] Section 6 smoke test done
- [ ] Staff accounts created and activated; each person logged in once on their own device
- [ ] You know how to void, close/reopen a day, and deactivate a person
- [ ] A monthly CSV export is in your calendar
