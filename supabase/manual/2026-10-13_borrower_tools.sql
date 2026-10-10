-- รันใน Supabase → SQL Editor ครั้งเดียว (รวม 2 ไฟล์: 20261013000000_borrower_tools + 20261013000001_promptpay_qr)
-- ถ้ารันแล้วขึ้นว่ามีอยู่แล้ว (already exists) แปลว่าเคยรันไปแล้ว ไม่ต้องรันซ้ำ
begin;

-- เครื่องมือฝั่งผู้ยืม: QR พร้อมเพย์ของผู้ให้ยืม + คำขอเลื่อนวัน/ขอผ่อน

-- ---------------------------------------------------------------------------
-- พร้อมเพย์ (ผู้ยืมทุกคนอ่านได้จาก app_settings อยู่แล้ว)
-- ---------------------------------------------------------------------------
alter table public.app_settings
  add column promptpay_id text check (promptpay_id is null or promptpay_id ~ '^\d{10}$|^\d{13}$|^\d{15}$'),
  add column promptpay_name text;

-- admin ตั้งได้ (ไม่ต้องเปิดสิทธิ์แก้ทั้งแถวให้ admin)
create function public.set_promptpay(p_id text, p_name text) returns void
language plpgsql security definer set search_path = '' as $$
begin
  if not public.is_staff() then raise exception 'ไม่มีสิทธิ์'; end if;
  update public.app_settings
  set promptpay_id = nullif(regexp_replace(coalesce(p_id, ''), '\D', '', 'g'), ''),
      promptpay_name = nullif(trim(coalesce(p_name, '')), ''),
      updated_at = now()
  where id = 1;
end $$;
revoke execute on function public.set_promptpay from public, anon;
grant execute on function public.set_promptpay to authenticated;

-- ---------------------------------------------------------------------------
-- คำขอเลื่อนวันครบกำหนด / ขอผ่อน
-- ---------------------------------------------------------------------------
create table public.loan_requests (
  id              uuid primary key default gen_random_uuid(),
  loan_id         uuid not null references public.loans (id) on delete cascade,
  borrower_id     uuid not null references public.profiles (id) on delete cascade default auth.uid(),
  kind            text not null check (kind in ('extend', 'installment')),
  proposed_due_at timestamptz,
  installments    int check (installments is null or installments between 2 and 24),
  message         text not null check (length(trim(message)) > 0),
  status          text not null default 'pending' check (status in ('pending', 'approved', 'rejected')),
  admin_note      text,
  decided_by      uuid references public.profiles (id) on delete set null,
  decided_at      timestamptz,
  created_at      timestamptz not null default now(),
  check (kind <> 'extend' or proposed_due_at is not null),
  check (kind <> 'installment' or installments is not null)
);
create index on public.loan_requests (loan_id, created_at desc);

alter table public.loan_requests enable row level security;
revoke all on public.loan_requests from anon;

create policy requests_select on public.loan_requests for select to authenticated
  using (borrower_id = auth.uid() or public.is_staff());
-- ผู้ยืมส่งคำขอได้เฉพาะรายการของตัวเอง สถานะเริ่มที่ pending เสมอ
create policy requests_insert on public.loan_requests for insert to authenticated
  with check (
    borrower_id = auth.uid() and status = 'pending'
    and exists (select 1 from public.loans l where l.id = loan_id and l.borrower_id = auth.uid())
  );
create policy requests_update on public.loan_requests for update to authenticated
  using (public.is_staff()) with check (public.is_staff());
create policy requests_delete on public.loan_requests for delete to authenticated
  using (public.is_staff() or (borrower_id = auth.uid() and status = 'pending'));

create function public.loan_requests_before_write() returns trigger
language plpgsql security definer set search_path = '' as $$
begin
  if tg_op = 'INSERT' then
    new.status := 'pending';
    new.decided_by := null;
    new.decided_at := null;
    new.admin_note := null;
  elsif new.status is distinct from old.status then
    new.decided_by := auth.uid();
    new.decided_at := now();
  end if;
  return new;
end $$;

create trigger loan_requests_before_write before insert or update on public.loan_requests
for each row execute function public.loan_requests_before_write();

-- แจ้งเตือน + อนุมัติเลื่อนวัน = เปลี่ยนวันครบกำหนดให้เลย
create function public.loan_requests_after_write() returns trigger
language plpgsql security definer set search_path = '' as $$
declare
  who text;
  what text;
begin
  select aka into who from public.profiles where id = new.borrower_id;
  what := case new.kind
    when 'extend' then 'ขอเลื่อนวันครบกำหนดเป็น ' || to_char(new.proposed_due_at at time zone 'Asia/Bangkok', 'DD/MM/YYYY HH24:MI')
    else 'ขอผ่อน ' || new.installments || ' งวด'
  end;

  if tg_op = 'INSERT' then
    perform public.notify_staff(who || ' ' || what, new.message, new.loan_id);
  elsif new.status is distinct from old.status then
    if new.status = 'approved' and new.kind = 'extend' then
      update public.loans set due_at = new.proposed_due_at where id = new.loan_id;
    end if;
    perform public.notify_user(new.borrower_id,
      case new.status when 'approved' then 'คำขอได้รับอนุมัติ ✅' else 'คำขอไม่ได้รับอนุมัติ' end,
      what || coalesce(' — ' || new.admin_note, ''), new.loan_id);
  end if;
  return new;
end $$;

create trigger loan_requests_after_write after insert or update on public.loan_requests
for each row execute function public.loan_requests_after_write();

create trigger audit after insert or update or delete on public.loan_requests
for each row execute function public.audit();

-- เก็บข้อมูลจาก QR พร้อมเพย์ของผู้ให้ยืม (อ่านจากรูปที่ admin อัปโหลด)
-- แอปเอาไปใส่ยอดเงินแล้วสร้าง QR ใหม่ให้ผู้ยืมสแกน — ใช้ได้ทั้ง QR ส่วนตัวและ QR ร้านค้า
alter table public.app_settings
  add column promptpay_payload text check (promptpay_payload is null or (promptpay_payload ~ '^000201' and length(promptpay_payload) <= 512));

create function public.set_promptpay_qr(p_payload text, p_name text) returns void
language plpgsql security definer set search_path = '' as $$
begin
  if not public.is_staff() then raise exception 'ไม่มีสิทธิ์'; end if;
  update public.app_settings
  set promptpay_payload = nullif(trim(coalesce(p_payload, '')), ''),
      promptpay_name = coalesce(nullif(trim(coalesce(p_name, '')), ''), promptpay_name),
      updated_at = now()
  where id = 1;
end $$;
revoke execute on function public.set_promptpay_qr from public, anon;
grant execute on function public.set_promptpay_qr to authenticated;

commit;
