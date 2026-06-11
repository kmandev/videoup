# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project

**VideoUp** — a multi-platform short-video upload manager. Users pick clips from cloud storage (Google Drive, Dropbox, OneDrive, or direct URL), write per-platform captions/hashtags/affiliate links, then schedule or instantly post to TikTok, YouTube Shorts, Facebook Reels, Shopee Video, and Lazada. Scheduled posts run entirely in the cloud via Supabase Edge Functions + pg_cron; files live in cloud storage. The UI is Thai + English bilingual.

## Running the app

No build step. Open `index.html` directly in a browser (or serve with any static server):

```sh
npx serve .          # then open http://localhost:3000
# or
python3 -m http.server 8080
```

`auth.html` is the login gate — it writes a `videoup_user` key to `localStorage`. `index.html` redirects to `auth.html` if that key is missing.  
`landing.html` is the public marketing / pricing page (no auth required).

## Architecture

The app is a **plain-HTML + React 18 (CDN) + Babel standalone** prototype — no bundler, no npm. JSX files are loaded as `<script type="text/babel">` tags and transpiled in the browser.

### File layout

| File | Role |
|---|---|
| `index.html` | App shell; loads all scripts in order |
| `auth.html` | Login / signup screen (standalone) |
| `landing.html` | Marketing page (standalone, uses same `styles.css`) |
| `styles.css` | Global styles + CSS custom-property theme system (3 themes: `sunset`, `electric`, `candy`) |
| `tweaks-panel.jsx` | Floating Tweaks panel (theme/accent/radius picker) — must load first |
| `data.jsx` | Mock data: `PLATFORMS`, `VIDEOS`, `POSTS`, `SOURCES`, `DRIVE`, date helpers, `postStatus()`, `platformStats()` — exported to `window` |
| `saas-data.jsx` | Subscription plans (`PLANS`), usage quotas (`USAGE`), `PLAN()` helper — exported to `window` |
| `components.jsx` | Shared primitives exported to `window`: `Icon`, `Btn`, `PlatformBadge`, `PlatformStack`, `StatusBadge`, `VideoThumb`, `Bar` |
| `app.jsx` | Root `App` component: sidebar nav, topbar, routing, toast system, `PostDetail` modal, `PlanChangeModal`, `ReactDOM.createRoot` |
| `screen-dashboard.jsx` | Dashboard: stat cards, platform status row, upcoming queue, activity feed |
| `screen-calendar.jsx` | Calendar: month-grid view + list view, posts by day |
| `screen-create.jsx` | 5-step compose flow: pick video → pick platforms → per-platform content → schedule → cleanup |
| `screen-billing.jsx` | Plan cards, usage bars, billing history |
| `screen-settings.jsx` | Tabbed settings: profile, platform connections, video sources, notifications, defaults |
| `screen-landing.jsx` | Landing page screen component (also used inside `landing.html`) |

### Script load order (index.html)

`tweaks-panel` → `data` → `saas-data` → `components` → `screen-*` (×6) → `app`

All shared symbols (`Icon`, `Btn`, `PLATFORMS`, `POSTS`, `VID`, etc.) are attached to `window` by each file so later files can use them without imports.

### Theme system

CSS custom properties on `:root` define colours/radii. `data-theme` attribute on `<html>` switches between `sunset` (warm orange/pink default), `electric` (violet/blue), and `candy` (hot pink/mint). The Tweaks panel also lets users pick a brand accent colour and corner radius, applied via inline `style.setProperty`.

### Routing

Client-side only: `route` state string in `App` (`"dashboard"` | `"calendar"` | `"create"` | `"billing"` | `"settings"`). No URL changes. `go(routeId)` switches screens and scrolls to top.

### Data flow

UI mock/static data lives in `data.jsx` and `saas-data.jsx`. `postStatus(post)` derives an aggregate status from per-platform statuses. `platformStats()` returns published/failed/scheduled counts per platform. The `CreatePost` → `onPublish(payload)` callback in `App` triggers a toast and navigates to dashboard or calendar.

## Backend (Supabase)

The app runs in two modes, switched automatically by whether `config.js` has credentials:

- **Demo mode** (empty `config.js`): `window.sb` is `null`, UI uses the mock globals from `data.jsx`. `API.*` calls throw `DEMO_MODE`.
- **Live mode**: `supabase-client.js` creates `window.sb`; `api.js` (`window.API`) wraps all CRUD.

### Backend files

| File | Role |
|---|---|
| `config.js` | Holds `SUPABASE_URL` + `SUPABASE_ANON_KEY` (anon key is public-safe — RLS protects data). Committed for Vercel. |
| `supabase-client.js` | Creates `window.sb`, or `null` in demo mode |
| `api.js` | `window.API` — data access layer; every method falls back to `DEMO_MODE` when `sb` is null |
| `db/schema.sql` | Full Postgres schema: profiles, sources, platform_connections, videos, posts, post_platforms, subscriptions, user_settings + RLS + `posts_full` view. Run once in Supabase SQL Editor |
| `supabase/functions/` | Edge Functions (Deno): OAuth, source scanning/upload, publishing, Telegram notifications |
| `vercel.json` | Static deploy config (cleanUrls + security headers) |
| `DEPLOY.md` | Full Thai deployment guide + free-tier stack analysis |

### Auth + guard

`auth.html` uses real Supabase Auth in live mode (email + Google OAuth), mock localStorage in demo mode. `index.html`'s guard checks the Supabase session first, then falls back to the `videoup_user` localStorage key.

### Scheduler model

`pg_cron` calls the `publish-post` Edge Function every minute with `{ due: true }` and a `CRON_SECRET` bearer token. The function (using the **service_role** key, server-side only) polls `posts` where `scheduled_at <= now`, processes each `post_platforms` row (fetch file from cloud source → upload to platform → mark published/failed), aggregates post status, sends Telegram notifications, and runs cleanup. Realtime status flows back to the UI via `API.subscribePosts()`.
