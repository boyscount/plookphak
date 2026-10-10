-- สร้างผู้ใช้หลายคนพร้อมกันบน Supabase จริง
-- วิธีใช้: แก้ชื่อ/รหัส/ข้อมูลด้านล่าง → วางใน Supabase → SQL Editor → Run
-- ทั้งไฟล์รันเป็นก้อนเดียว ถ้ามีบรรทัดไหนผิด (เช่น username ซ้ำ) จะไม่สร้างอะไรเลย แก้แล้วรันใหม่ได้
-- username: a-z 0-9 _ . - ยาว 3–32 ตัว · รหัสผ่าน: อย่างน้อย 6 ตัว
-- ห้าม commit ไฟล์นี้หลังใส่รหัสจริง

begin;

-- 1) super admin คนแรก (ข้ามได้ถ้ามีแล้ว — ถ้ามีอยู่แล้วจะ error ให้ลบบรรทัดนี้ออก)
select public.bootstrap_super_admin('boss', 'เปลี่ยนรหัสนี้', 'บอส');

-- 2) จำนวน admin สูงสุด
update public.app_settings set max_admins = 2;

-- 3) admin
select public.internal_create_user('admin1', 'เปลี่ยนรหัสนี้', 'แอดมินหนึ่ง', 'admin', null);

-- 4) ผู้ยืม + รายการยืม (ทำซ้ำบล็อกนี้ตามจำนวนคน)
with b as (
  select public.internal_create_user('somchai', 'เปลี่ยนรหัสนี้', 'ชายหนุ่ม', 'borrower', null) as id
)
insert into public.loans (borrower_id, principal, borrowed_on, interest_start_on, daily_interest, due_at, hourly_penalty, interest_mode, daily_cutoff, note)
select id,
  5000,                          -- จำนวนเงินที่ยืม
  '2026-10-01',                  -- วันที่ยืม
  '2026-10-02',                  -- วันที่เริ่มคิดดอก
  50,                            -- ดอกต่อวัน
  '2026-10-31 18:00+07',         -- วันครบชำระ (เวลาไทย)
  20,                            -- ค่าปรับต่อชั่วโมง
  'with_principal',              -- แบบจ่ายดอก: 'with_principal' = จ่ายดอกพร้อมเงินต้น, 'daily' = จ่ายดอกรายวัน
  '17:00',                       -- เวลาตัดรอบดอกรายวัน (ใช้เฉพาะแบบ daily)
  'ค่าซ่อมรถ'                     -- หมายเหตุ (ใส่ null ถ้าไม่มี)
from b;

-- ผู้ยืมที่ยังไม่มีรายการยืม
select public.internal_create_user('nid', 'เปลี่ยนรหัสนี้', 'หนิด', 'borrower', null);

commit;

-- ตรวจผล
select p.username, p.aka, p.role, p.active, count(l.id) as loans
from public.profiles p left join public.loans l on l.borrower_id = p.id
group by p.id order by p.role, p.username;
