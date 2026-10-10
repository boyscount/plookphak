-- ข้อมูลทดสอบสำหรับ Supabase ในเครื่องเท่านั้น (supabase db reset) — ห้ามรันบน production
select public.bootstrap_super_admin('boss', 'test1234', 'บอส');
select public.internal_create_user('admin1', 'test1234', 'แอดมินหนึ่ง', 'admin', null);
update public.app_settings set max_admins = 2;
select public.internal_create_user('somchai', 'test1234', 'ชายหนุ่ม', 'borrower', null);
select public.internal_create_user('nid', 'test1234', 'หนิด', 'borrower', null);

insert into public.loans (borrower_id, principal, borrowed_on, interest_start_on, daily_interest, due_at, hourly_penalty, note)
select id, 5000, current_date - 10, current_date - 9, 50, now() - interval '5 hours 20 minutes', 20, 'ค่าซ่อมรถ'
from public.profiles where username = 'somchai';
-- จ่ายดอกรายวัน ตัดรอบ 17:00: จ่ายดอกวันแรกแล้ว วันนี้ยังไม่จ่าย
insert into public.loans (borrower_id, principal, borrowed_on, interest_start_on, daily_interest, due_at, hourly_penalty, interest_mode, daily_cutoff)
select id, 1500, current_date - 2, current_date - 1, 30, now() + interval '5 days', 20, 'daily', '17:00'
from public.profiles where username = 'nid';
insert into public.payments (loan_id, amount, method, paid_at, status)
select l.id, 30, 'cash', ((current_date - 1)::timestamp + time '12:00') at time zone 'Asia/Bangkok', 'approved'
from public.loans l join public.profiles p on p.id = l.borrower_id where p.username = 'nid';

-- ประวัติจ่ายบางส่วนของชายหนุ่ม ให้กราฟเงินเข้ามีข้อมูล
insert into public.payments (loan_id, amount, method, paid_at, status)
select l.id, v.amount, 'cash', now() - v.ago, 'approved'
from public.loans l join public.profiles p on p.id = l.borrower_id,
  (values (300, interval '8 days'), (450, interval '5 days'), (200, interval '2 days')) as v(amount, ago)
where p.username = 'somchai';
-- หนิดจ่ายดอกรายวันช้าไปหนึ่งวัน
insert into public.payments (loan_id, amount, method, paid_at, status)
select l.id, 30, 'cash', ((current_date)::timestamp + time '09:00') at time zone 'Asia/Bangkok', 'approved'
from public.loans l join public.profiles p on p.id = l.borrower_id where p.username = 'nid';
