# SHAMLOKO BOOST - Phase 1 (phone setup)

## A. Supabase (browser)
1. supabase.com > New project. Wait until ready.
2. (Shared project) Use your existing SHAMLOKO project. SQL Editor > New query. Paste all of `sql/01_core.sql` > Run. It must say Success. It only creates a new `boost` schema and does not touch SHAMLOKO tables.
2b. Project Settings > API > Exposed schemas: add `boost` next to `public`, then Save. (Without this the app gets 'schema not found'.)
3. Do NOT change Authentication settings that SHAMLOKO relies on (Confirm email stays as it is).
4. Project Settings > API: copy the **Project URL** and the **anon / publishable key**. Never put the service_role key in the app.

## B. GitHub (browser)
1. New repository, e.g. `shamloko-boost`. Add file > Create new file.
2. Type each path in the name box (typing `css/style.css` creates the folder), paste the contents, commit:
   `index.html`, `css/style.css`, `js/config.js`, `js/app.js`, `sql/01_core.sql`, `sql/02_make_admin.sql`.
3. Edit `js/config.js`: paste your URL and anon key. Commit.
4. Settings > Pages > Deploy from branch > main > / (root). Open the link after about a minute.
5. Supabase > Authentication > URL Configuration: ADD your BOOST Pages link under Redirect URLs. Do not replace the Site URL.

## C. Test
Register, log in, edit profile, pick genres, become a creator, open Wallet. Then edit `sql/02_make_admin.sql` with your email and run it in SQL Editor to become admin.
