-- รันใน Supabase → SQL Editor ครั้งเดียว (ซ้ำได้ ไม่พัง)
begin;

alter table public.payments
  add column if not exists slip_ref text check (slip_ref is null or length(slip_ref) <= 512);

create unique index if not exists payments_slip_ref_uniq
  on public.payments (slip_ref)
  where slip_ref is not null and status <> 'rejected';

commit;
