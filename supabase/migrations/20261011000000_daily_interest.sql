-- แบบจ่ายดอก 2 แบบ: จ่ายดอกพร้อมเงินต้น (เดิม) / จ่ายดอกรายวัน ก่อนเวลาตัดรอบทุกวัน
-- รันต่อจาก 20261010000001_cron.sql ใน Supabase SQL Editor (หรือ `supabase db push`)

alter table public.loans
  add column interest_mode text not null default 'with_principal'
    check (interest_mode in ('with_principal', 'daily')),
  add column daily_cutoff time not null default '17:00',
  add column reminded_daily_on date;

-- ---------------------------------------------------------------------------
-- ยอด ณ เวลา p_at — ต้องตรงกับ src/lib/loanMath.ts
--   with_principal: ค่าปรับ = ชม.เต็มที่เลยวันครบชำระ
--   daily: ค่าปรับเดินเมื่อยอดที่ถึงกำหนดแล้ว (ดอกที่เลยตัดรอบ + เงินต้นที่เลยวันครบ)
--          มากกว่ายอดที่จ่าย; แต่ละช่วงที่ค้างนับชั่วโมงเต็ม; คิดรวมก้อนเดียวไม่ว่าค้างกี่วัน
--          เวลาเท่ากัน นับการจ่ายก่อน (จ่ายตรงเวลาตัดรอบถือว่าทัน)
-- ---------------------------------------------------------------------------

create function public.loan_totals(p_loan_id uuid, p_at timestamptz)
returns table (
  total numeric, interest numeric, days int, penalty numeric, penalty_hours int,
  base_due numeric, paid numeric, arrears_since timestamptz
)
language plpgsql stable set search_path = '' as $$
declare
  l public.loans;
  ev record;
  v_hours int := 0;
begin
  select * into l from public.loans where id = p_loan_id;
  if not found then return; end if;

  days := greatest(0, ((p_at at time zone 'Asia/Bangkok')::date - l.interest_start_on) + 1);
  interest := l.daily_interest * days;
  base_due := 0;
  paid := 0;
  arrears_since := null;

  if l.interest_mode = 'daily' then
    for ev in
      select e.at, e.kind, e.amount from (
        select p.paid_at as at, 0 as kind, p.created_at as seq, p.amount
        from public.payments p
        where p.loan_id = l.id and p.status <> 'rejected' and p.paid_at <= p_at
        union all
        select ((l.interest_start_on + g)::timestamp + l.daily_cutoff) at time zone 'Asia/Bangkok',
               1, null, l.daily_interest
        from generate_series(0, ((p_at at time zone 'Asia/Bangkok')::date - l.interest_start_on)) g
        union all
        select l.due_at, 1, null, l.principal
      ) e
      where e.at <= p_at
      order by e.at, e.kind, e.seq
    loop
      if ev.kind = 0 then paid := paid + ev.amount; else base_due := base_due + ev.amount; end if;
      if paid < base_due and arrears_since is null then
        arrears_since := ev.at;
      elsif paid >= base_due and arrears_since is not null then
        v_hours := v_hours + floor(extract(epoch from (ev.at - arrears_since)) / 3600)::int;
        arrears_since := null;
      end if;
    end loop;
    if arrears_since is not null then
      v_hours := v_hours + floor(extract(epoch from (p_at - arrears_since)) / 3600)::int;
    end if;
    penalty_hours := v_hours;
  else
    penalty_hours := greatest(0, floor(extract(epoch from (p_at - l.due_at)) / 3600))::int;
  end if;

  penalty := l.hourly_penalty * penalty_hours;
  total := l.principal + interest + penalty;
  return next;
end $$;

-- เวลาที่จ่ายครบทั้งหมด (อนุมัติแล้ว + รอตรวจ) หรือ null
create or replace function public.loan_settled_at(p_loan_id uuid) returns timestamptz
language plpgsql stable set search_path = '' as $$
declare
  r record;
  cum numeric := 0;
  owed numeric;
begin
  for r in
    select amount, paid_at from public.payments
    where loan_id = p_loan_id and status <> 'rejected'
    order by paid_at, created_at
  loop
    cum := cum + r.amount;
    select t.total into owed from public.loan_totals(p_loan_id, r.paid_at) t;
    if cum >= owed then return r.paid_at; end if;
  end loop;
  return null;
end $$;

drop function public.loan_owed(public.loans, timestamptz);

-- ---------------------------------------------------------------------------
-- เตือน: เพิ่มเตือนดอกรายวันก่อนตัดรอบ 2 ชม. และเตือนค้างทุกครั้งที่เริ่มค้างรอบใหม่
-- ---------------------------------------------------------------------------

create or replace function public.run_reminders() returns void
language plpgsql security definer set search_path = '' as $$
declare
  l record;
  t record;
  today date := (now() at time zone 'Asia/Bangkok')::date;
  cutoff timestamptz;
begin
  for l in
    select lo.*, p.aka from public.loans lo join public.profiles p on p.id = lo.borrower_id
    where p.active and public.loan_settled_at(lo.id) is null
  loop
    -- ใกล้ครบคืนเงินต้น
    if l.reminded_due_soon_at is null and now() between l.due_at - interval '24 hours' and l.due_at then
      perform public.notify_user(l.borrower_id, 'ใกล้ครบกำหนดชำระ',
        'ครบชำระ ' || to_char(l.due_at at time zone 'Asia/Bangkok', 'DD/MM/YYYY HH24:MI'), l.id);
      update public.loans set reminded_due_soon_at = now() where id = l.id;
    end if;

    if l.interest_mode = 'daily' then
      -- ดอกวันนี้ยังไม่จ่าย ก่อนตัดรอบ 2 ชม.
      cutoff := (today::timestamp + l.daily_cutoff) at time zone 'Asia/Bangkok';
      if today >= l.interest_start_on and (l.reminded_daily_on is null or l.reminded_daily_on < today)
         and now() between cutoff - interval '2 hours' and cutoff then
        select * into t from public.loan_totals(l.id, cutoff);
        if t.base_due > t.paid then
          perform public.notify_user(l.borrower_id, 'ดอกวันนี้ยังไม่ได้จ่าย',
            'ต้องจ่าย ' || public.fmt_baht(t.base_due - t.paid) || ' ภายใน '
              || to_char(l.daily_cutoff, 'HH24:MI') || ' น.', l.id);
          update public.loans set reminded_daily_on = today where id = l.id;
        end if;
      end if;

      -- เริ่มค้างครบ 1 ชม. (แจ้งครั้งเดียวต่อรอบที่ค้าง)
      select * into t from public.loan_totals(l.id, now());
      if t.arrears_since is null then
        if l.reminded_overdue_at is not null then
          update public.loans set reminded_overdue_at = null where id = l.id;
        end if;
      elsif l.reminded_overdue_at is null and now() >= t.arrears_since + interval '1 hour' then
        perform public.notify_user(l.borrower_id, 'ค้างชำระ เริ่มคิดค่าปรับแล้ว',
          'ค้าง ' || public.fmt_baht(t.base_due - t.paid) || ' · ค่าปรับ '
            || public.fmt_baht(l.hourly_penalty) || ' ต่อชั่วโมง จนกว่าจะส่งสลิป', l.id);
        perform public.notify_staff(l.aka || ' ค้างดอกรายวัน', 'เริ่มคิดค่าปรับรายชั่วโมงแล้ว', l.id);
        update public.loans set reminded_overdue_at = now() where id = l.id;
      end if;
    elsif l.reminded_overdue_at is null and now() >= l.due_at + interval '1 hour' then
      perform public.notify_user(l.borrower_id, 'เลยกำหนดชำระ เริ่มคิดค่าปรับแล้ว',
        'ค่าปรับ ' || public.fmt_baht(l.hourly_penalty) || ' ต่อชั่วโมง จนกว่าจะส่งสลิปที่ถูกต้อง', l.id);
      perform public.notify_staff(l.aka || ' เลยกำหนดชำระ', 'เริ่มคิดค่าปรับรายชั่วโมงแล้ว', l.id);
      update public.loans set reminded_overdue_at = now() where id = l.id;
    end if;
  end loop;
end $$;
revoke execute on function public.run_reminders from public, anon, authenticated;

-- เปลี่ยนแบบจ่ายดอกหรือเวลาตัดรอบ → รีเซ็ตการเตือน
create or replace function public.loans_before_update() returns trigger
language plpgsql set search_path = '' as $$
begin
  new.updated_at := now();
  if new.due_at is distinct from old.due_at
     or new.interest_mode is distinct from old.interest_mode
     or new.daily_cutoff is distinct from old.daily_cutoff then
    new.reminded_due_soon_at := null;
    new.reminded_overdue_at := null;
    new.reminded_daily_on := null;
  end if;
  return new;
end $$;

-- บันทึกจาก SQL Editor / backend (ไม่มีผู้ใช้ล็อกอิน) เชื่อถือค่าที่ส่งมา เช่น ย้ายประวัติจากกระดาษ
-- ฝั่งเว็บยังโดนกฎเดิมทั้งหมด (anon insert ไม่ได้อยู่แล้วจาก RLS)
create or replace function public.payments_before_insert() returns trigger
language plpgsql security definer set search_path = '' as $$
begin
  if auth.uid() is null then
    return new;
  end if;
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
