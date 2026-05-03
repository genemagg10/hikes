# Building TrailTracker: A Real Case Study in AI-Assisted Development

I built TrailTracker — a publicly visible "trail completion" log for the trails around Lafayette, California — over about a day of work with Claude Code, Anthropic's coding-focused AI tool. The path between idea and finished product wasn't a straight line. Four substantial pivots, several "AI confidently wrote bad code" moments, and a few surprises about which decisions I needed to keep for myself.

This is the unedited story. If you're curious about what AI-assisted coding actually feels like in practice — or considering having Maggio Consulting build something similar — this is what the process looks like.

---

## The brief

I wanted a website that:

- Showed every named trail in the Lamorinda area
- Tracked which ones I'd already walked, and how completely
- Updated automatically as I hiked, with no manual logging
- Was publicly visible so friends could follow along

Stack: Next.js on Vercel, Supabase (Postgres + PostGIS for geospatial work), Mapbox for the map. I drove via prose; the agent did the typing, with me reviewing and steering.

---

## Day 1: deploy stuck

The first hour produced a working scaffold — Next.js app, Supabase schema, Mapbox component, an OpenStreetMap "Overpass" query that pulled trails into the database. I imported the repo into Vercel.

And then... no deployment. The `vercel.json` the agent generated used Vercel's *legacy* secret-reference syntax (`@my-secret-name`), which assumes you've added secrets via the deprecated `vercel secrets add` CLI. The build was failing because those legacy secrets didn't exist; the modern approach is just to set Project-level environment variables in the dashboard.

**The lesson:** AI is great at producing plausible-looking config files. But config files are also where vendor APIs change most often, and "plausible" isn't the same as "current." We deleted the env block, let Vercel inject env vars normally, and it deployed.

---

## PostGIS rejected the schema

The `trails` table had a clever-looking generated column:

```sql
bbox box2d generated always as (st_extent(geometry)) stored,
```

Postgres rejected it: *"aggregate functions are not allowed in column generation expressions."* `ST_Extent` is an aggregate — it computes an extent across many rows, like `SUM` or `COUNT`. The right per-row equivalent is `Box2D(geometry)`. Five-minute fix once I fed the error back to the agent.

Worth noticing: I had to be the one running the SQL and reading the error. The agent could not see Supabase's dashboard. **The human is the eyes and the hands.**

---

## Overpass refused the seed request

With the schema fixed, the seed endpoint started fetching trails from Overpass... and immediately hit `406 Not Acceptable`. Overpass throttles anonymous requests aggressively, and Vercel's default `fetch` sends a generic Node User-Agent with no `Accept` header — exactly the profile Overpass refuses. Three lines (User-Agent + `Accept: application/json` + a politeness identifier) and 532 trails loaded.

---

## The Apple Health iceberg

The naive plan: export from Apple Health (a `.zip`), upload to the website, parse in the browser. The agent built that. I tried it with my own export — 200 MB. The browser tab spun for several minutes, then refreshed itself with no data imported.

The browser had run out of memory. Apple Health exports include *every* health record — heart rate samples, step counts, sleep stages — and workouts are a tiny fraction. The XML unzipped to over 1 GB, and `DOMParser.parseFromString` on that string crashes tabs.

**Pivot 2: streaming.** The agent rewrote the importer to read XML in chunks via JSZip's `internalStream`, extracting complete `<Workout>` blocks and parsing each individually. Memory stayed bounded. It worked... slowly.

I sat with the slowness and said: *this is the wrong shape*. Why parse hundreds of MB in a browser when I could have the iPhone push new workouts directly to my server as they happen?

**Pivot 3: from "import" to "push."** The agent built `/api/import`, an authenticated JSON endpoint, plus a `/setup` page with iOS Shortcut instructions. A new workout is now ~5 KB instead of ~200 MB, and the Shortcut runs automatically. The slow zip flow stayed as a fallback.

---

## The Shortcut blind spot

When I went to actually build the iOS Shortcut, the action the agent had told me to use ("Find Workouts") didn't exist by that name in my version of Shortcuts. Apple's exact action names shift across iOS releases — sometimes it's "Find Health Samples" with Sample Type set to Workouts, sometimes a dedicated "Find Workouts." The AI had no way to know which iOS I was running, or to navigate the Shortcuts UI and check.

This is a recurring shape: **AI is great at the things it can read (code, docs, error messages) and weak at the things it can't (mobile UIs, third-party dashboards, physical-world feedback).** Recognizing which side of that line a problem sits on is where the human still has the comparative advantage. We updated the docs and added a Node script that trims the zip locally as a guaranteed-working fallback.

---

## Pivot 4: from tracker to showcase

About four hours in, I looked at what I'd built and realized it was *generic*. The site let anyone import their data and see their hikes. Fine, but boring. What I actually wanted was something specific: a public log of my attempt to walk every trail in the area, with trails crossing themselves off as I covered them.

This is the kind of "reframing" question AI tools are bad at suggesting unprompted. The agent will happily build whatever you ask for; deciding what to ask for is your job.

The agent and I designed a `trail_progress` table with completion percentages, a PostGIS trigger that auto-recomputes coverage every time a workout lands, and a UI that color-codes the map (green = complete, amber = in progress, gray = not yet hiked) and shows a "X / 532 trails complete" hero on the dashboard. Same code at the bottom; completely different soul. It took an hour and turned a generic fitness tracker into something I actually wanted to look at.

---

## The dedup problem

The trails page was full of duplicates — "Lafayette-Moraga Regional Trail" appeared eight times because OpenStreetMap splits popular trails into separate `way` entries at intersections and gates. The agent wrote a SQL function that groups by name + area, unions the geometries into a single `MultiLineString`, and stamps the result with a deterministic hash so re-runs are idempotent. Trail count dropped from 532 to about 230 cleanly named trails.

---

## The security oversight

Late in the build I asked: *"When data is imported from the site, can anyone upload to my database?"*

Yes. Yes.

The original RLS policy on `workouts` was `for all using (true)` — meaning anyone with the public anon key (which ships in the site's JavaScript) could write any row. For a generic tool that's defensible; for a personal showcase it means a friend could "complete" trails for me by uploading their own hikes.

The fix: drop the public-write policy, replace it with read-only, and require the existing `IMPORT_TOKEN` for all writes. **This is the kind of thing that's easy to overlook when you're moving fast.** The AI happily wrote permissive policies because that's the path of least resistance. It didn't volunteer "by the way, this means the public can corrupt your data." That's a security review I needed to drive.

---

## Reflections on AI-assisted development

After about a day of building, I have a deployed, public-facing app with real geospatial logic, a precomputed materialized table with triggers, an auth'd push API, and a polished UI. Faster than I'd have built solo.

**Where AI was great:**

- Mechanical work — React components, Tailwind, API plumbing
- PostGIS — recompute functions, spatial indexes, GeoJSON RPCs as solid first drafts
- Iteration speed — "add a 'closest to finishing' panel" went from spec to code in minutes

**Where AI fell short:**

- Vendor specifics that change quickly — Vercel config syntax, Shortcut action names
- Anything outside the code — Supabase UI, iPhone screens, Mapbox renders. I had to be the eyes
- Knowing when to pivot — the agent will keep refining whatever you point it at
- Security and threat modeling — defaults were permissive; I had to ask the question

The biggest unlock isn't speed. It's the *willingness to throw work away*. Each iteration is cheap, so you experiment more — and you notice when an approach is wrong before you've over-invested.

---

## What's next

- **Owner-only push tool** on `/setup` so I can upload trimmed exports directly through `/api/import`
- **Per-trail history** — click a completed trail and see which hikes contributed
- **Streak / consistency view** for the dashboard
- **More regions** beyond Lamorinda — eventually all of EBRPD

---

## A note for clients of Maggio Consulting

If you're considering hiring me to build something for you, this story is representative of how I work: fast, in public, and honest about what AI tooling does and doesn't do.

The parts of building software where AI is most powerful — boilerplate, integration code, the second-pass polish — used to make builds expensive. Those costs are dropping fast. The parts that *aren't* dropping are framing the right problem, recognizing when a design is wrong, making security and architecture choices, and steering toward a finished product instead of a half-finished one. That's the work I do, and AI tooling lets me do more of it per hour than I could a year ago.

If you have a project where the goal is clear but the path isn't, I'd love to hear about it.

— Gene Maggio · Maggio Consulting
