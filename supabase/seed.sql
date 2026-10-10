-- ข้อมูลทดสอบสำหรับ Supabase ในเครื่องเท่านั้น (supabase db reset) — ห้ามรันบน production
select public.bootstrap_super_admin('boss', 'test1234', 'บอส');
select public.internal_create_user('admin1', 'test1234', 'แอดมินหนึ่ง', 'admin', null);
update public.app_settings set max_admins = 2;
select public.internal_create_user('somchai', 'test1234', 'ชายหนุ่ม', 'borrower', null);
select public.internal_create_user('nid', 'test1234', 'หนิด', 'borrower', null);

insert into public.loans (borrower_id, principal, borrowed_on, interest_start_on, daily_interest, due_at, hourly_penalty, note)
select id, 5000, current_date - 10, current_date - 9, 50, now() - interval '5 hours 20 minutes', 20, 'ค่าซ่อมรถ'
from public.profiles where username = 'somchai';
insert into public.loans (borrower_id, principal, borrowed_on, interest_start_on, daily_interest, due_at, hourly_penalty)
select id, 1500, current_date - 2, current_date - 1, 30, now() + interval '2 days 3 hours', 10
from public.profiles where username = 'nid';
