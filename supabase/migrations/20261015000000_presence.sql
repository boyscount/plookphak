-- ใครออนไลน์อยู่: แอปส่ง heartbeat ทุก ~1 นาทีตอนเปิดหน้าจออยู่ และบอก "ออกไปแล้ว" ตอนสลับแอป/ปิดแท็บ
-- ตารางนี้อ่านตรง ๆ ไม่ได้ ต้องอ่านผ่าน presence_list() ซึ่งกรองตามบทบาท:
--   super admin เห็นทุกคน · admin เห็นทุกคนยกเว้น super admin · ผู้ยืมไม่เห็นใคร
create table if not exists public.presence (
  user_id      uuid primary key references public.profiles (id) on delete cascade,
  last_seen_at timestamptz not null default now(),
  away         boolean not null default false
);
alter table public.presence enable row level security;
revoke all on public.presence from anon, authenticated;

create or replace function public.touch_presence(p_away boolean default false) returns void
language sql security definer set search_path = '' as $$
  insert into public.presence (user_id, last_seen_at, away)
  select p.id, now(), p_away from public.profiles p where p.id = auth.uid() and p.active
  on conflict (user_id) do update set last_seen_at = excluded.last_seen_at, away = excluded.away
$$;
revoke execute on function public.touch_presence from public, anon;
grant execute on function public.touch_presence to authenticated;

-- online = ยังเปิดแอปอยู่ และส่ง heartbeat มาภายใน 2 นาที
create or replace function public.presence_list()
returns table (user_id uuid, last_seen_at timestamptz, online boolean)
language sql stable security definer set search_path = '' as $$
  select pr.user_id, pr.last_seen_at, (not pr.away and pr.last_seen_at > now() - interval '2 minutes')
  from public.presence pr
  join public.profiles p on p.id = pr.user_id
  where public.is_super() or (public.is_staff() and p.role <> 'super_admin')
$$;
revoke execute on function public.presence_list from public, anon;
grant execute on function public.presence_list to authenticated;
