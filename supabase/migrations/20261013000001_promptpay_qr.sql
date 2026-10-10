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
