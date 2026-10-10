# Deploy Plookphak (ฟรีทั้งหมด)

มี 4 ขั้น ขั้นที่ต้องล็อกอินบัญชีต้องทำเองในเบราว์เซอร์

## 1. Supabase — ฐานข้อมูล

1. https://supabase.com → **New project**
   - ชื่อ: `plookphak` · Region: **Southeast Asia (Singapore)** · ตั้ง database password เก็บไว้
2. **Authentication → Sign In / Providers**
   - ปิด **Allow new users to sign up** (กันคนนอกสมัครเอง)
   - **Email** provider ต้อง *เปิด* ไว้ (ระบบล็อกอินด้วย username ที่แปลงเป็นอีเมลภายใน)
3. สร้างตารางทั้งหมด เลือกได้ 1 วิธี
   - **ง่ายสุด:** SQL Editor → วางไฟล์ `supabase/migrations/20261010000000_init.sql` → Run แล้วทำซ้ำกับ `…01_cron.sql`
   - **CLI:**
     ```bash
     npx supabase login
     npx supabase link --project-ref <project-ref>
     npx supabase db push
     ```
4. สร้าง super admin คนแรก ใน SQL Editor (ใส่ชื่อ/รหัสของคุณเอง ทำได้ครั้งเดียว)
   ```sql
   select public.bootstrap_super_admin('ชื่อผู้ใช้', 'รหัสผ่าน', 'ชื่อเล่น');
   ```
5. **Project Settings → API** จด `Project URL` กับ `publishable` (หรือ `anon`) key

   อยากสร้างหลายคนพร้อมกัน (admin, ผู้ยืม, รายการยืม) ใช้ `supabase/create-users.sql` แทน: แก้ชื่อ/รหัสแล้ววางใน SQL Editor

> ห้ามรัน `supabase/seed.sql` บน production เพราะเป็นบัญชีทดสอบ

## 2. GitHub

สร้าง repo ว่างชื่อ `plookphak` ใต้บัญชี `boyscount` (Private ได้) แล้ว push ผ่าน SSH

```bash
git remote add origin git@github.com:boyscount/plookphak.git
git push -u origin main
```

## 3. Cloudflare Pages — หน้าเว็บ

1. Cloudflare dashboard → **Workers & Pages → Create → Pages → Connect to Git** → เลือก `boyscount/plookphak`
2. ตั้งค่า build
   - Project name: `plookphak` → ได้ `https://plookphak.pages.dev`
   - Framework preset: **React (Vite)** · Build command: `npm run build` · Output: `dist`
   - Environment variables:
     - `VITE_SUPABASE_URL` = Project URL
     - `VITE_SUPABASE_ANON_KEY` = publishable key
     - `NODE_VERSION` = `22`
3. Save and Deploy ต่อจากนี้ push ขึ้น `main` แล้ว deploy ให้อัตโนมัติ

ถ้ามีโดเมนของตัวเองใน Cloudflare แล้ว (แบบ named tunnel ของ ClipQueue) ผูกเพิ่มได้ที่ **Custom domains** เช่น `plookphak.<โดเมน>`

## 4. กัน Supabase หลับ

Supabase ฟรีจะหยุด project ถ้าไม่มีใครใช้ 7 วัน `.github/workflows/keepalive.yml` จะเรียก API ทุก 3 วันให้
ตั้งค่าใน GitHub repo → **Settings → Secrets and variables → Actions** ใส่ `SUPABASE_URL` กับ `SUPABASE_ANON_KEY`

(GitHub ปิด scheduled workflow ถ้า repo ไม่มี commit 60 วัน มันจะส่งอีเมลเตือนก่อน กดเปิดใหม่ได้)

## หลัง deploy

1. เปิด `https://plookphak.pages.dev` ล็อกอินด้วย super admin
2. โปรไฟล์ → จัดการ admin → ตั้งจำนวน admin → สร้าง admin
3. admin กดปุ่ม **+** → เพิ่มผู้ยืม (สร้างบัญชี + รายการยืมพร้อมกัน) แล้วส่ง username/รหัสให้เพื่อนทางแชต
4. บนมือถือ: Safari → แชร์ → **เพิ่มไปยังหน้าจอโฮม** จะเปิดเต็มจอเหมือนแอป
