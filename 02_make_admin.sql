-- Run ONCE after you have registered in the app. Replace the email, then Run.
insert into boost.user_roles(user_id, role)
select id, 'admin' from auth.users where email = 'YOUR_EMAIL_HERE' on conflict do nothing;
