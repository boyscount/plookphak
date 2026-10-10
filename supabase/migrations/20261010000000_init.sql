-- Plookphak: บันทึกการยืมเงิน ดอกเบี้ยรายวัน และค่าปรับรายชั่วโมง
-- รันไฟล์นี้ครั้งเดียวใน Supabase SQL Editor (หรือ `supabase db push`)

create extension if not exists pgcrypto with schema extensions;

-- ---------------------------------------------------------------------------
-- Types & tables
-- ---------------------------------------------------------------------------

create type public.app_role as enum ('super_admin', 'admin', 'borrower');
create type public.pay_method as enum ('transfer', 'cash');
create type public.pay_status as enum ('pending', 'approved', 'rejected');

create table public.profiles (
  id          uuid primary key references auth.users (id) on delete cascade,
  username    text not null unique check (username ~ '^[a-z0-9_.-]{3,32}$'),
  aka         text not null check (length(trim(aka)) > 0),
  role        public.app_role not null,
  active      boolean not null default true,
  note        text,
  created_by  uuid references public.profiles (id) on delete set null,
  created_at  timestamptz not null default now()
);

-- แถวเดียว: super admin กำหนดจำนวน admin สูงสุด
create table public.app_settings (
  id          int primary key default 1 check (id = 1),
  max_admins  int not null default 1 check (max_admins >= 0),
  updated_at  timestamptz not null default now()
);
insert into public.app_settings (id) values (1);

create table public.loans (
  id                    uuid primary key default gen_random_uuid(),
  borrower_id           uuid not null references public.profiles (id) on delete cascade,
  principal             numeric(12, 2) not null check (principal > 0),
  borrowed_on           date not null,
  interest_start_on     date not null,
  daily_interest        numeric(12, 2) not null default 0 check (daily_interest >= 0),
  due_at                timestamptz not null,
  hourly_penalty        numeric(12, 2) not null default 0 check (hourly_penalty >= 0),
  note                  text,
  reminded_due_soon_at  timestamptz,
  reminded_overdue_at   timestamptz,
  created_by            uuid references public.profiles (id) on delete set null,
  created_at            timestamptz not null default now(),
  updated_at            timestamptz not null default now()
);
create index on public.loans (borrower_id);

create table public.payments (
  id             uuid primary key default gen_random_uuid(),
  loan_id        uuid not null references public.loans (id) on delete cascade,
  amount         numeric(12, 2) not null check (amount > 0),
  method         public.pay_method not null,
  slip_path      text,
  -- เวลาที่ผู้ยืมอัปโหลดสลิป / เวลาที่รับเงินสด — นาฬิกาค่าปรับหยุดที่เวลานี้
  paid_at        timestamptz not null default now(),
  status         public.pay_status not null default 'pending',
  note           text,
  reject_reason  text,
  submitted_by   uuid references public.profiles (id) on delete set null default auth.uid(),
  reviewed_by    uuid references public.profiles (id) on delete set null,
  reviewed_at    timestamptz,
  created_at     timestamptz not null default now(),
  check (method = 'cash' or slip_path is not null)
);
create index on public.payments (loan_id, paid_at);

create table public.notifications (
  id          bigint generated always as identity primary key,
  user_id     uuid not null references public.profiles (id) on delete cascade,
  title       text not null,
  body        text,
  loan_id     uuid references public.loans (id) on delete cascade,
  read_at     timestamptz,
  created_at  timestamptz not null default now()
);
create index on public.notifications (user_id, created_at desc);

create table public.audit_log (
  id          bigint generated always as identity primary key,
  actor       uuid,
  action      text not null,
  table_name  text not null,
  row_id      text,
  old_data    jsonb,
  new_data    jsonb,
  at          timestamptz not null default now()
);
create index on public.audit_log (at desc);

-- ---------------------------------------------------------------------------
-- Role helpers
-- ---------------------------------------------------------------------------

create function public.my_role() returns public.app_role
language sql stable security definer set search_path = '' as $$
  select role from public.profiles where id = auth.uid() and active
$$;

create function public.is_staff() returns boolean
language sql stable security definer set search_path = '' as $$
  select coalesce(public.my_role() in ('admin', 'super_admin'), false)
$$;

create function public.is_super() returns boolean
language sql stable security definer set search_path = '' as $$
  select coalesce(public.my_role() = 'super_admin', false)
$$;

-- ---------------------------------------------------------------------------
-- Money: ต้องตรงกับ src/lib/loanMath.ts
--   ยอดที่ต้องจ่าย ณ เวลา t = เงินต้น
--     + ดอกต่อวัน × จำนวนวัน (นับวันเริ่มคิดดอกเป็นวันที่ 1, ตามเวลาไทย)
--     + ค่าปรับต่อชั่วโมง × ชั่วโมงเต็มที่เลยวันครบชำระ
-- ---------------------------------------------------------------------------

create function public.loan_owed(p_loan public.loans, p_at timestamptz) returns numeric
language sql immutable set search_path = '' as $$
  select p_loan.principal
    + p_loan.daily_interest
      * greatest(0, ((p_at at time zone 'Asia/Bangkok')::date - p_loan.interest_start_on) + 1)
    + p_loan.hourly_penalty
      * greatest(0, floor(extract(epoch from (p_at - p_loan.due_at)) / 3600))
$$;

-- เวลาที่ยอดจ่ายสะสม (อนุมัติแล้ว + รอตรวจ) ครอบคลุมยอดที่ต้องจ่าย ณ ตอนนั้น
-- คืน null ถ้ายังจ่ายไม่ครบ; สลิปที่ถูกปฏิเสธไม่นับ นาฬิกาจึงเดินต่อย้อนหลัง
create function public.loan_settled_at(p_loan_id uuid) returns timestamptz
language plpgsql stable set search_path = '' as $$
declare
  l public.loans;
  r record;
  total numeric := 0;
begin
  select * into l from public.loans where id = p_loan_id;
  if not found then return null; end if;
  for r in
    select amount, paid_at from public.payments
    where loan_id = p_loan_id and status <> 'rejected'
    order by paid_at, created_at
  loop
    total := total + r.amount;
    if total >= public.loan_owed(l, r.paid_at) then
      return r.paid_at;
    end if;
  end loop;
  return null;
end $$;

-- ---------------------------------------------------------------------------
-- Payment rules
-- ---------------------------------------------------------------------------

create function public.payments_before_insert() returns trigger
language plpgsql security definer set search_path = '' as $$
begin
  new.submitted_by := auth.uid();
  if public.is_staff() then
    -- admin บันทึกเงินสด/โอนแทน: ถือว่าตรวจแล้ว
    new.status := 'approved';
    new.reviewed_by := auth.uid();
    new.reviewed_at := now();
  else
    -- ผู้ยืม: ส่งได้เฉพาะสลิปโอน เวลาเป็นเวลาที่อัปโหลดจริง และต้องรอตรวจ
    new.method := 'transfer';
    new.status := 'pending';
    new.paid_at := now();
    new.reviewed_by := null;
    new.reviewed_at := null;
    new.reject_reason := null;
    if new.slip_path is null or split_part(new.slip_path, '/', 1) <> new.loan_id::text then
      raise exception 'slip_path must be inside the loan folder';
    end if;
  end if;
  return new;
end $$;

create trigger payments_before_insert before insert on public.payments
for each row execute function public.payments_before_insert();

create function public.payments_before_update() returns trigger
language plpgsql set search_path = '' as $$
begin
  if new.status is distinct from old.status then
    new.reviewed_by := auth.uid();
    new.reviewed_at := now();
    if new.status <> 'rejected' then new.reject_reason := null; end if;
  end if;
  return new;
end $$;

create trigger payments_before_update before update on public.payments
for each row execute function public.payments_before_update();

create function public.loans_before_update() returns trigger
language plpgsql set search_path = '' as $$
begin
  new.updated_at := now();
  if new.due_at is distinct from old.due_at then
    new.reminded_due_soon_at := null;
    new.reminded_overdue_at := null;
  end if;
  return new;
end $$;

create trigger loans_before_update before update on public.loans
for each row execute function public.loans_before_update();

-- ---------------------------------------------------------------------------
-- Notifications (ในแอป, แท็บ "กิจกรรม")
-- ---------------------------------------------------------------------------

create function public.notify_staff(p_title text, p_body text, p_loan uuid) returns void
language sql security definer set search_path = '' as $$
  insert into public.notifications (user_id, title, body, loan_id)
  select id, p_title, p_body, p_loan from public.profiles
  where role in ('admin', 'super_admin') and active
$$;

create function public.notify_user(p_user uuid, p_title text, p_body text, p_loan uuid) returns void
language sql security definer set search_path = '' as $$
  insert into public.notifications (user_id, title, body, loan_id)
  values (p_user, p_title, p_body, p_loan)
$$;

create function public.fmt_baht(n numeric) returns text
language sql immutable set search_path = '' as $$
  select trim(to_char(n, 'FM999,999,990.00')) || ' บาท'
$$;

create function public.payments_after_write() returns trigger
language plpgsql security definer set search_path = '' as $$
declare
  b public.profiles;
begin
  select p.* into b from public.loans l join public.profiles p on p.id = l.borrower_id
  where l.id = new.loan_id;

  if tg_op = 'INSERT' and new.status = 'pending' then
    perform public.notify_staff(
      b.aka || ' ส่งสลิปใหม่',
      'ยอด ' || public.fmt_baht(new.amount) || ' รอตรวจสอบ', new.loan_id);
  elsif tg_op = 'INSERT' then
    perform public.notify_user(b.id, 'บันทึกการชำระแล้ว',
      public.fmt_baht(new.amount) || ' (' || case new.method when 'cash' then 'เงินสด' else 'โอน' end || ')',
      new.loan_id);
  elsif new.status is distinct from old.status and new.status = 'approved' then
    perform public.notify_user(b.id, 'สลิปผ่านการตรวจแล้ว',
      'ยอด ' || public.fmt_baht(new.amount), new.loan_id);
  elsif new.status is distinct from old.status and new.status = 'rejected' then
    perform public.notify_user(b.id, 'สลิปไม่ผ่าน',
      coalesce(new.reject_reason, 'กรุณาส่งสลิปใหม่') || ' — ค่าปรับเดินต่อจนกว่าจะส่งสลิปที่ถูกต้อง',
      new.loan_id);
  end if;
  return new;
end $$;

create trigger payments_after_write after insert or update on public.payments
for each row execute function public.payments_after_write();

create function public.loans_after_insert() returns trigger
language plpgsql security definer set search_path = '' as $$
begin
  perform public.notify_user(new.borrower_id, 'มีรายการยืมใหม่',
    'เงินต้น ' || public.fmt_baht(new.principal) || ' ครบชำระ '
      || to_char(new.due_at at time zone 'Asia/Bangkok', 'DD/MM/YYYY HH24:MI'),
    new.id);
  return new;
end $$;

create trigger loans_after_insert after insert on public.loans
for each row execute function public.loans_after_insert();

-- เรียกจาก pg_cron ทุก 15 นาที: เตือนก่อนครบ 24 ชม. และเตือนเมื่อเริ่มโดนปรับ
create function public.run_reminders() returns void
language plpgsql security definer set search_path = '' as $$
declare
  l record;
begin
  for l in
    select lo.*, p.aka from public.loans lo join public.profiles p on p.id = lo.borrower_id
    where p.active and public.loan_settled_at(lo.id) is null
  loop
    if l.reminded_due_soon_at is null and now() between l.due_at - interval '24 hours' and l.due_at then
      perform public.notify_user(l.borrower_id, 'ใกล้ครบกำหนดชำระ',
        'ครบชำระ ' || to_char(l.due_at at time zone 'Asia/Bangkok', 'DD/MM/YYYY HH24:MI'), l.id);
      update public.loans set reminded_due_soon_at = now() where id = l.id;
    end if;
    if l.reminded_overdue_at is null and now() >= l.due_at + interval '1 hour' then
      perform public.notify_user(l.borrower_id, 'เลยกำหนดชำระ เริ่มคิดค่าปรับแล้ว',
        'ค่าปรับ ' || public.fmt_baht(l.hourly_penalty) || ' ต่อชั่วโมง จนกว่าจะส่งสลิปที่ถูกต้อง', l.id);
      perform public.notify_staff(l.aka || ' เลยกำหนดชำระ', 'เริ่มคิดค่าปรับรายชั่วโมงแล้ว', l.id);
      update public.loans set reminded_overdue_at = now() where id = l.id;
    end if;
  end loop;
end $$;

-- ---------------------------------------------------------------------------
-- Audit log (super admin ดู)
-- ---------------------------------------------------------------------------

create function public.audit() returns trigger
language plpgsql security definer set search_path = '' as $$
begin
  insert into public.audit_log (actor, action, table_name, row_id, old_data, new_data)
  values (
    auth.uid(), lower(tg_op), tg_table_name,
    coalesce((case when tg_op = 'DELETE' then to_jsonb(old) else to_jsonb(new) end) ->> 'id', ''),
    case when tg_op = 'INSERT' then null else to_jsonb(old) end,
    case when tg_op = 'DELETE' then null else to_jsonb(new) end
  );
  return null;
end $$;

create trigger audit after insert or update or delete on public.profiles
for each row execute function public.audit();
create trigger audit after insert or update or delete on public.loans
for each row execute function public.audit();
create trigger audit after insert or update or delete on public.payments
for each row execute function public.audit();
create trigger audit after update on public.app_settings
for each row execute function public.audit();

-- ---------------------------------------------------------------------------
-- Accounts (username + password, สร้างโดย admin เท่านั้น)
-- อีเมลภายในเป็น <username>@plookphak.local — ผู้ใช้ไม่เห็น
-- ---------------------------------------------------------------------------

create function public.internal_create_user(
  p_username text, p_password text, p_aka text, p_role public.app_role, p_creator uuid
) returns uuid
language plpgsql security definer set search_path = '' as $$
declare
  uid uuid := gen_random_uuid();
  mail text;
begin
  p_username := lower(trim(p_username));
  if p_username !~ '^[a-z0-9_.-]{3,32}$' then
    raise exception 'ชื่อผู้ใช้ต้องเป็น a-z 0-9 _ . - ยาว 3–32 ตัว';
  end if;
  if length(coalesce(p_password, '')) < 6 then
    raise exception 'รหัสผ่านต้องยาวอย่างน้อย 6 ตัว';
  end if;
  if exists (select 1 from public.profiles where username = p_username) then
    raise exception 'ชื่อผู้ใช้นี้ถูกใช้แล้ว';
  end if;
  mail := p_username || '@plookphak.local';

  insert into auth.users (
    instance_id, id, aud, role, email, encrypted_password, email_confirmed_at,
    raw_app_meta_data, raw_user_meta_data, created_at, updated_at,
    confirmation_token, email_change, email_change_token_new, recovery_token
  ) values (
    '00000000-0000-0000-0000-000000000000', uid, 'authenticated', 'authenticated', mail,
    extensions.crypt(p_password, extensions.gen_salt('bf')), now(),
    '{"provider":"email","providers":["email"]}', jsonb_build_object('username', p_username),
    now(), now(), '', '', '', ''
  );
  insert into auth.identities (provider_id, user_id, identity_data, provider, last_sign_in_at, created_at, updated_at)
  values (uid::text, uid, jsonb_build_object('sub', uid::text, 'email', mail, 'email_verified', true),
          'email', now(), now(), now());
  insert into public.profiles (id, username, aka, role, created_by)
  values (uid, p_username, trim(p_aka), p_role, p_creator);
  return uid;
end $$;
revoke execute on function public.internal_create_user from public, anon, authenticated;

create function public.create_account(
  p_username text, p_password text, p_aka text, p_role public.app_role default 'borrower'
) returns uuid
language plpgsql security definer set search_path = '' as $$
declare
  admin_count int;
  quota int;
begin
  if p_role = 'borrower' then
    if not public.is_staff() then raise exception 'ไม่มีสิทธิ์'; end if;
  elsif p_role = 'admin' then
    if not public.is_super() then raise exception 'เฉพาะ super admin เพิ่ม admin ได้'; end if;
    select count(*) into admin_count from public.profiles where role = 'admin' and active;
    select max_admins into quota from public.app_settings;
    if admin_count >= quota then
      raise exception 'admin เต็มโควตาแล้ว (% คน) — เพิ่มโควตาก่อน', quota;
    end if;
  else
    raise exception 'สร้าง super admin จากหน้าเว็บไม่ได้';
  end if;
  return public.internal_create_user(p_username, p_password, p_aka, p_role, auth.uid());
end $$;

-- ตรวจว่าผู้เรียกจัดการบัญชีนี้ได้ไหม: admin จัดการผู้ยืม, super จัดการ admin/ผู้ยืม
create function public.assert_can_manage(p_user uuid) returns public.app_role
language plpgsql stable security definer set search_path = '' as $$
declare
  target public.app_role;
begin
  select role into target from public.profiles where id = p_user;
  if target is null then raise exception 'ไม่พบผู้ใช้'; end if;
  if target = 'borrower' and public.is_staff() then return target; end if;
  if target = 'admin' and public.is_super() then return target; end if;
  raise exception 'ไม่มีสิทธิ์';
end $$;
revoke execute on function public.assert_can_manage from public, anon;

create function public.set_password(p_user uuid, p_password text) returns void
language plpgsql security definer set search_path = '' as $$
begin
  perform public.assert_can_manage(p_user);
  if length(coalesce(p_password, '')) < 6 then raise exception 'รหัสผ่านต้องยาวอย่างน้อย 6 ตัว'; end if;
  update auth.users set encrypted_password = extensions.crypt(p_password, extensions.gen_salt('bf')),
    updated_at = now() where id = p_user;
end $$;

create function public.set_account_active(p_user uuid, p_active boolean) returns void
language plpgsql security definer set search_path = '' as $$
declare
  target public.app_role := public.assert_can_manage(p_user);
  admin_count int;
  quota int;
begin
  if p_active and target = 'admin' then
    select count(*) into admin_count from public.profiles where role = 'admin' and active and id <> p_user;
    select max_admins into quota from public.app_settings;
    if admin_count >= quota then raise exception 'admin เต็มโควตาแล้ว (% คน)', quota; end if;
  end if;
  update public.profiles set active = p_active where id = p_user;
  update auth.users set banned_until = case when p_active then null else 'infinity'::timestamptz end
  where id = p_user;
  if not p_active then
    delete from auth.sessions where user_id = p_user;
  end if;
end $$;

-- รันเองครั้งเดียวใน SQL Editor: select public.bootstrap_super_admin('ชื่อผู้ใช้', 'รหัสผ่าน', 'ชื่อเล่น');
create function public.bootstrap_super_admin(p_username text, p_password text, p_aka text) returns uuid
language plpgsql security definer set search_path = '' as $$
begin
  if exists (select 1 from public.profiles where role = 'super_admin') then
    raise exception 'มี super admin อยู่แล้ว';
  end if;
  return public.internal_create_user(p_username, p_password, p_aka, 'super_admin', null);
end $$;
revoke execute on function public.bootstrap_super_admin from public, anon, authenticated;

revoke execute on function public.run_reminders from public, anon, authenticated;
revoke execute on function public.notify_staff from public, anon, authenticated;
revoke execute on function public.notify_user from public, anon, authenticated;

-- ---------------------------------------------------------------------------
-- Row Level Security
-- ---------------------------------------------------------------------------

alter table public.profiles enable row level security;
alter table public.app_settings enable row level security;
alter table public.loans enable row level security;
alter table public.payments enable row level security;
alter table public.notifications enable row level security;
alter table public.audit_log enable row level security;

revoke all on all tables in schema public from anon;

-- profiles: เห็นตัวเอง, staff เห็นทุกคน; แก้ได้แค่ชื่อเล่น/โน้ต
create policy profiles_select on public.profiles for select to authenticated
  using (id = auth.uid() or public.is_staff());
revoke update on public.profiles from authenticated;
grant update (aka, note) on public.profiles to authenticated;
create policy profiles_update on public.profiles for update to authenticated
  using ((role = 'borrower' and public.is_staff()) or public.is_super() or id = auth.uid() and public.is_staff())
  with check (true);
revoke insert, delete on public.profiles from authenticated;

create policy settings_select on public.app_settings for select to authenticated using (true);
create policy settings_update on public.app_settings for update to authenticated
  using (public.is_super()) with check (public.is_super());

-- loans: ผู้ยืมเห็นเฉพาะของตัวเอง, staff จัดการทั้งหมด
create policy loans_select on public.loans for select to authenticated
  using (borrower_id = auth.uid() or public.is_staff());
create policy loans_write on public.loans for all to authenticated
  using (public.is_staff()) with check (public.is_staff());

-- payments: ผู้ยืมส่งสลิปของตัวเองได้อย่างเดียว
create policy payments_select on public.payments for select to authenticated
  using (public.is_staff() or exists (
    select 1 from public.loans l where l.id = loan_id and l.borrower_id = auth.uid()));
create policy payments_insert on public.payments for insert to authenticated
  with check (public.is_staff() or exists (
    select 1 from public.loans l where l.id = loan_id and l.borrower_id = auth.uid()));
create policy payments_update on public.payments for update to authenticated
  using (public.is_staff()) with check (public.is_staff());
create policy payments_delete on public.payments for delete to authenticated
  using (public.is_staff());

create policy notifications_select on public.notifications for select to authenticated
  using (user_id = auth.uid());
revoke insert, update, delete on public.notifications from authenticated;
grant update (read_at) on public.notifications to authenticated;
create policy notifications_update on public.notifications for update to authenticated
  using (user_id = auth.uid()) with check (user_id = auth.uid());

create policy audit_select on public.audit_log for select to authenticated using (public.is_super());
revoke insert, update, delete on public.audit_log from authenticated;

-- ---------------------------------------------------------------------------
-- Storage: สลิปเก็บแบบ private ที่ slips/<loan_id>/<file>
-- ---------------------------------------------------------------------------

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('slips', 'slips', false, 5242880, array['image/jpeg', 'image/png', 'image/webp', 'image/heic'])
on conflict (id) do nothing;

create policy slips_read on storage.objects for select to authenticated
  using (bucket_id = 'slips' and (public.is_staff() or exists (
    select 1 from public.loans l
    where l.id::text = (storage.foldername(name))[1] and l.borrower_id = auth.uid())));

create policy slips_upload on storage.objects for insert to authenticated
  with check (bucket_id = 'slips' and (public.is_staff() or exists (
    select 1 from public.loans l
    where l.id::text = (storage.foldername(name))[1] and l.borrower_id = auth.uid())));

create policy slips_delete on storage.objects for delete to authenticated
  using (bucket_id = 'slips' and public.is_staff());
