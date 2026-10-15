// Keep-alive / health check for uptime pingers (cron-job.org, UptimeRobot).
// Deliberately doesn't touch the database so pings don't keep Neon's compute awake.
export const loader = () =>
  new Response("ok", {
    headers: { "Content-Type": "text/plain", "Cache-Control": "no-store" },
  });
