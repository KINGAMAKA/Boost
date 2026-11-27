-- SHAMLOKO BOOST Phase 2: catalogue + manual deposit funding.
-- Safe to re-run. All objects remain inside boost; no public-schema objects are changed.

create table if not exists boost.service_catalog (
  id uuid primary key default gen_random_uuid(),
  side text not null check (side in ('earner','creator')),
  service_key text not null,
  title text not null,
  description text not null,
  status text not null default 'coming_soon' check (status in ('live','coming_soon')),
  reward_min numeric(12,2),
  reward_max numeric(12,2),
  sort_order integer not null default 100,
  created_at timestamptz not null default now(),
  unique(side, service_key),
  check (reward_min is null or reward_min >= 0),
  check (reward_max is null or reward_max >= reward_min)
);

insert into boost.service_catalog(side,service_key,title,description,status,reward_min,reward_max,sort_order) values
('earner','discover_artist','Discover an Artist','Listen to music from emerging artists, then answer short questions about the track. Rewards are credited after review.','coming_soon',1.50,1.50,10),
('earner','compete','Compete','Enter creative competitions across music, photography, design, video, slogans and writing. Prizes are shown before you enter.','coming_soon',null,null,20),
('earner','complete','Complete tasks','Complete paid reviews, surveys and other structured tasks.','coming_soon',null,null,30),
('earner','video_review','Video review','Watch a short video, rate it and leave one useful comment.','coming_soon',1.00,1.00,40),
('earner','music_review','Music review','Write a short, considered review of a track.','coming_soon',1.50,1.50,50),
('earner','content_rating','Content rating','Rate a post, image or design.','coming_soon',0.50,0.50,60),
('earner','audience_survey','Audience survey','Answer a short survey for a creator or brand.','coming_soon',0.50,0.50,70),
('earner','content_comparison','Content comparison','Choose the stronger of two options and explain why.','coming_soon',1.00,1.00,80),
('earner','website_testing','Website/app testing','Follow steps and submit a bug or user-experience report.','coming_soon',2.00,2.00,90),
('earner','product_feedback','Product feedback','Try a product or idea and give structured feedback.','coming_soon',2.50,2.50,100),
('earner','focus_group','Focus group','Give deeper written answers in a small group.','coming_soon',5.00,15.00,110),
('earner','promo_content','Create promo content','Create original promotional content for a brand. External likes, views or follows are not paid actions.','coming_soon',10.00,50.00,120),
('creator','sample_music','Sample your music to listeners','Upload up to three tracks, choose genres and a listener target. Receive preference splits, chorus and replay feedback, and written responses.','coming_soon',null,null,10),
('creator','run_competition','Run a competition','Fund a prize pool, publish rules and dates, receive entries and select winners.','coming_soon',null,null,20),
('creator','get_reviews','Get reviews','Collect structured reviews of your music, video, design or product.','coming_soon',null,null,30),
('creator','audience_survey','Audience survey','Ask a target audience your own questions.','coming_soon',null,null,40),
('creator','content_comparison','Content comparison (A/B)','Find out which of two creative versions your audience prefers.','coming_soon',null,null,50),
('creator','testing_feedback','Website/app testing and product feedback','Get usability reports and structured product feedback.','coming_soon',null,null,60),
('creator','focus_group','Focus group','Recruit a small group for deeper written responses.','coming_soon',null,null,70),
('creator','promo_content','Promo content','Hire earners to create original promotional content.','coming_soon',null,null,80)
on conflict (side,service_key) do update set
 title=excluded.title, description=excluded.description, status=excluded.status,
 reward_min=excluded.reward_min, reward_max=excluded.reward_max, sort_order=excluded.sort_order;

create table if not exists boost.deposit_requests (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references boost.profiles(id) on delete restrict,
  amount numeric(12,2) not null check (amount >= 50),
  payment_method text not null default 'manual',
  payment_reference text,
  user_note text,
  status text not null default 'pending' check (status in ('pending','confirmed','rejected')),
  admin_note text,
  reviewed_by uuid,
  reviewed_at timestamptz,
  created_at timestamptz not null default now()
);
create index if not exists deposit_requests_status_created_idx
 on boost.deposit_requests(status, created_at asc);
create index if not exists deposit_requests_user_created_idx
 on boost.deposit_requests(user_id, created_at desc);

alter table boost.service_catalog enable row level security;
alter table boost.deposit_requests enable row level security;

drop policy if exists service_catalog_read on boost.service_catalog;
create policy service_catalog_read on boost.service_catalog
 for select to authenticated using (true);

drop policy if exists deposit_requests_read on boost.deposit_requests;
create policy deposit_requests_read on boost.deposit_requests
 for select to authenticated using (user_id = auth.uid() or boost.is_admin());

-- No direct INSERT/UPDATE/DELETE grants on deposit requests or ledger.
revoke all on boost.deposit_requests from anon, authenticated;
grant select on boost.service_catalog to authenticated;
grant select on boost.deposit_requests to authenticated;

create or replace function boost.request_deposit(
 p_amount numeric,
 p_payment_method text default 'manual',
 p_payment_reference text default null,
 p_user_note text default null
) returns uuid
language plpgsql security definer
set search_path = boost
as $$
declare v_id uuid;
begin
 if auth.uid() is null then raise exception 'Not signed in'; end if;
 if p_amount is null or p_amount < 50 or p_amount > 100000 then
   raise exception 'Deposit amount must be between K50 and K100,000';
 end if;
 if p_payment_method is null or length(trim(p_payment_method)) = 0 then
   raise exception 'Choose a payment method';
 end if;
 insert into boost.deposit_requests(user_id,amount,payment_method,payment_reference,user_note)
 values(auth.uid(),round(p_amount,2),left(trim(p_payment_method),40),nullif(left(trim(coalesce(p_payment_reference,'')),120),''),
        nullif(left(trim(coalesce(p_user_note,'')),500),''))
 returning id into v_id;
 insert into boost.notifications(user_id,title,body)
 values(auth.uid(),'Deposit request received','Your deposit request has been submitted and is awaiting manual confirmation.');
 return v_id;
end $$;

create or replace function boost.confirm_deposit(p_request_id uuid, p_admin_note text default null)
returns void
language plpgsql security definer
set search_path = boost
as $$
declare v_req boost.deposit_requests%rowtype;
begin
 if auth.uid() is null or not boost.is_admin() then raise exception 'Admin access required'; end if;
 select * into v_req from boost.deposit_requests where id=p_request_id for update;
 if not found then raise exception 'Deposit request not found'; end if;
 if v_req.status <> 'pending' then raise exception 'This deposit request has already been reviewed'; end if;

 -- Unique reference makes the credit idempotent; the row lock prevents concurrent review.
 insert into boost.wallet_transactions(user_id,bucket,amount,type,reference,note,created_by)
 values(v_req.user_id,'available',v_req.amount,'deposit_credit','deposit:'||v_req.id::text,
        'Deposit confirmed'||case when nullif(trim(coalesce(p_admin_note,'')),'') is null then '' else ': '||left(trim(p_admin_note),500) end,auth.uid())
 on conflict(reference) do nothing;

 update boost.deposit_requests set status='confirmed',admin_note=nullif(left(trim(coalesce(p_admin_note,'')),500),''),
 reviewed_by=auth.uid(),reviewed_at=now() where id=v_req.id;
 insert into boost.admin_audit_logs(admin_id,action,target,details)
 values(auth.uid(),'confirm_deposit',v_req.id::text,jsonb_build_object('user_id',v_req.user_id,'amount',v_req.amount));
 insert into boost.notifications(user_id,title,body)
 values(v_req.user_id,'Deposit confirmed','Your deposit of K'||to_char(v_req.amount,'FM999,999,990.00')||' has been added to your available wallet balance.');
end $$;

create or replace function boost.reject_deposit(p_request_id uuid, p_admin_note text default null)
returns void
language plpgsql security definer
set search_path = boost
as $$
declare v_req boost.deposit_requests%rowtype;
begin
 if auth.uid() is null or not boost.is_admin() then raise exception 'Admin access required'; end if;
 select * into v_req from boost.deposit_requests where id=p_request_id for update;
 if not found then raise exception 'Deposit request not found'; end if;
 if v_req.status <> 'pending' then raise exception 'This deposit request has already been reviewed'; end if;
 update boost.deposit_requests set status='rejected',
 admin_note=nullif(left(trim(coalesce(p_admin_note,'')),500),''),
 reviewed_by=auth.uid(),reviewed_at=now() where id=v_req.id;
 insert into boost.admin_audit_logs(admin_id,action,target,details)
 values(auth.uid(),'reject_deposit',v_req.id::text,jsonb_build_object('user_id',v_req.user_id,'amount',v_req.amount,'note',left(coalesce(p_admin_note,''),500)));
 insert into boost.notifications(user_id,title,body)
 values(v_req.user_id,'Deposit request not approved','Your deposit request was not approved. Check the request details or contact support.');
end $$;

revoke all on function boost.request_deposit(numeric,text,text,text) from public, anon;
revoke all on function boost.confirm_deposit(uuid,text) from public, anon;
revoke all on function boost.reject_deposit(uuid,text) from public, anon;
grant execute on function boost.request_deposit(numeric,text,text,text) to authenticated;
grant execute on function boost.confirm_deposit(uuid,text) to authenticated;
grant execute on function boost.reject_deposit(uuid,text) to authenticated;

-- Explicitly preserve ledger immutability for browser users.
revoke insert, update, delete on boost.wallet_transactions from anon, authenticated;
revoke insert, update, delete on boost.deposit_requests from anon, authenticated;

-- Verification queries to run separately after SQL reports Success:
-- select side,service_key,title,status,reward_min,reward_max from boost.service_catalog order by side,sort_order;
-- select id,amount,status,created_at from boost.deposit_requests order by created_at desc limit 10;
-- select routine_name from information_schema.routines where routine_schema='boost'
--   and routine_name in ('request_deposit','confirm_deposit','reject_deposit');
