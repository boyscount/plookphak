-- เตือนใกล้ครบกำหนด / เลยกำหนด ทุก 15 นาที
create extension if not exists pg_cron with schema pg_catalog;

select cron.schedule('plookphak-reminders', '*/15 * * * *', $$select public.run_reminders()$$);
