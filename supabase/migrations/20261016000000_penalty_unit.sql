-- ค่าปรับต่อวัน (เฉพาะแบบจ่ายดอกพร้อมเงินต้น)
-- penalty_unit = 'hour' (เดิม) | 'day': เลยกำหนดปุ๊บปรับทันที แล้วปรับเพิ่มทุก 24 ชม. ดอกรายวันยังเดินต่อ
-- ยอดต่อหน่วยยังเก็บใน hourly_penalty (ชื่อเดิม) · รายการเดิมทั้งหมดเป็น 'hour' ยอดไม่เปลี่ยน
-- แบบจ่ายดอกรายวันไม่สนค่านี้ ปรับรายชั่วโมงเสมอ
-- คอลัมน์ penalty_hours ที่ loan_totals คืนมา = จำนวนครั้งที่ปรับ (ชั่วโมง หรือวัน)

alter table public.loans
  add column if not exists penalty_unit text not null default 'hour' check (penalty_unit in ('hour', 'day'));

create or replace function public.loan_totals(p_loan_id uuid, p_at timestamptz)
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
    if l.penalty_unit = 'day' then
      -- ปรับต่อวัน: เลยกำหนดปุ๊บนับ 1 ทันที แล้ว +1 ทุก 24 ชม.
      penalty_hours := case when p_at > l.due_at
        then floor(extract(epoch from (p_at - l.due_at)) / 86400)::int + 1 else 0 end;
    else
      penalty_hours := greatest(0, floor(extract(epoch from (p_at - l.due_at)) / 3600))::int;
    end if;
  end if;

  penalty := l.hourly_penalty * penalty_hours;
  total := l.principal + interest + penalty;
  return next;
end $$;

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
    elsif l.reminded_overdue_at is null
          and now() >= l.due_at + make_interval(hours => (l.penalty_unit <> 'day')::int) then
      perform public.notify_user(l.borrower_id, 'เลยกำหนดชำระ เริ่มคิดค่าปรับแล้ว',
        'ค่าปรับ ' || public.fmt_baht(l.hourly_penalty)
          || case when l.penalty_unit = 'day' then ' ต่อวัน' else ' ต่อชั่วโมง' end
          || ' จนกว่าจะส่งสลิปที่ถูกต้อง', l.id);
      perform public.notify_staff(l.aka || ' เลยกำหนดชำระ',
        case when l.penalty_unit = 'day' then 'เริ่มคิดค่าปรับรายวันแล้ว' else 'เริ่มคิดค่าปรับรายชั่วโมงแล้ว' end, l.id);
      update public.loans set reminded_overdue_at = now() where id = l.id;
    end if;
  end loop;
end $$;
revoke execute on function public.run_reminders from public, anon, authenticated;

create or replace function public.loans_before_update() returns trigger
language plpgsql set search_path = '' as $$
begin
  new.updated_at := now();
  if new.due_at is distinct from old.due_at
     or new.interest_mode is distinct from old.interest_mode
     or new.daily_cutoff is distinct from old.daily_cutoff
     or new.penalty_unit is distinct from old.penalty_unit then
    new.reminded_due_soon_at := null;
    new.reminded_overdue_at := null;
    new.reminded_daily_on := null;
  end if;
  return new;
end $$;

