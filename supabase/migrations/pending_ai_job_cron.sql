-- Runs the job runner every minute (docs/PLAN.md section 2.2): pg_cron calls /api/jobs/run through
-- pg_net. The route needs no secret because it only runs jobs that are already due; scheduling the
-- same job name again replaces the schedule, so this file can be re-applied.
select cron.schedule(
  'tradelink-ai-jobs-tick',
  '* * * * *',
  $$
  select net.http_post(
    url := 'https://tradelink-nine.vercel.app/api/jobs/run',
    headers := '{"Content-Type":"application/json"}'::jsonb,
    body := '{}'::jsonb,
    timeout_milliseconds := 55000
  );
  $$
);
