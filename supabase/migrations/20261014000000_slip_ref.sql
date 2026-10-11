-- กันสลิปซ้ำ: เก็บข้อความใน QR ของสลิปธนาคาร (มีเลขอ้างอิงธุรกรรมไม่ซ้ำกัน)
-- อ่าน QR ในเครื่องผู้ใช้ตอนเลือกรูป ถ้าอ่านไม่ได้จะเป็น null (ยังส่งได้ ผู้ดูแลตรวจด้วยตา)
alter table public.payments
  add column if not exists slip_ref text check (slip_ref is null or length(slip_ref) <= 512);

-- สลิปเดียวกันใช้ได้ครั้งเดียว (ยกเว้นรายการที่ถูกปฏิเสธไปแล้ว ส่งใหม่ได้)
create unique index if not exists payments_slip_ref_uniq
  on public.payments (slip_ref)
  where slip_ref is not null and status <> 'rejected';
