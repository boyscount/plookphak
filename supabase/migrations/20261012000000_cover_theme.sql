-- ธีม cover ของหน้าโปรไฟล์ (src/components/Cover.tsx) — เปลี่ยนได้เองทุกคน
alter table public.profiles
  add column cover text not null default 'violet' check (cover ~ '^[a-z_]{1,32}$');

create function public.set_my_cover(p_cover text) returns void
language sql security definer set search_path = '' as $$
  update public.profiles set cover = p_cover where id = auth.uid()
$$;
revoke execute on function public.set_my_cover from public, anon;
grant execute on function public.set_my_cover to authenticated;
