# Dashboard

[`/dashboard`](../../manager-ui/app/pages/dashboard.vue). The landing page, and
the only page in the console with no permission requirement of its own: you see
whatever your rights let the API answer, and nothing more.

## What it shows

- **Stat cards** -- domains (with an active count), recipients (with an active
  count), aliases, and blocked senders (with an enabled count).
- **Mail disk usage** -- a doughnut of used / free / reserved bytes across the
  whole mail volume.
- **Recipients per domain** -- a horizontal bar chart, top 8 domains by mailbox
  count, domains with none omitted.
- **Recently modified domains** (5) and **recently modified recipients** (6),
  each with a link to the full list, quota and active badge per row.

Both recent lists have a real empty state rather than an empty card: an icon, a
sentence explaining what is missing, and a button that starts the thing you are
missing ("Add a domain", "Add a recipient").

## Two sources, one view

The figures arrive over the WebSocket on the `dashboard` topic, pushed by the
server to anyone allowed to see every domain. That payload is computed with SQL
aggregates plus a disk read, and carries the counts and the small recent and
per-domain lists rather than raw rows.

When that topic never pushes, the page falls back to REST: it fans out over
`/domains`, then `/domains/:id/recipients` and `/domains/:id/aliases` for each
one, plus `/sieve/reject-senders` and `/domains/disk`. The results are folded
into `restSummary`, computed to exactly the same shape as the pushed payload, so
the template reads a single object either way.

The fan-out is the expensive path (one request per domain, twice) and exists so
the dashboard still works for an account the realtime topic does not serve, and
during the window before the first push lands. Every one of its calls catches
its own failure and degrades to an empty array, so a single refused endpoint
blanks one card instead of the page.

The REST path re-runs on the shared refresh tick, so focus, the heartbeat and
the header Refresh button all update it.

## Charts

Chart.js through two client-only wrappers,
[`DoughnutChart.client.vue`](../../manager-ui/app/components/charts/DoughnutChart.client.vue)
and [`BarChart.client.vue`](../../manager-ui/app/components/charts/BarChart.client.vue).
Colours come from [`useChartColors`](../../manager-ui/app/composables/useChartColors.ts)
so both follow the active theme instead of hard-coding palette values that
vanish against a dark background.
