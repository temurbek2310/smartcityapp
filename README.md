# SMART CITY v1.0

A mobile-first smart parking MVP for **Uzbekistan only**, built with Next.js 16, React 19, TypeScript, Tailwind CSS 4, Zod, MapLibre GL JS and QR generation.

This package is intentionally **zero-config demo mode**: unzip it, install dependencies, and run it without creating API keys or external accounts.

## Run

Requirements: Node.js 20.9+ and pnpm 10.

```bash
pnpm install
pnpm dev
```

Open: http://localhost:3000

If pnpm is not installed:

```bash
npm install -g pnpm@10
```

## First login

The authentication flow simulates SMS delivery so the MVP works without an SMS provider.

1. Complete the 3 onboarding screens.
2. Enter any 9-digit Uzbekistan mobile number after the fixed `+998` prefix, e.g. `90 123 45 67`.
3. Use demo OTP: **123456**.
4. Enter your name and vehicle plate.

Your data persists in browser `localStorage` until you reset demo data from Profile.

## MVP flow implemented

- 3-screen onboarding
- +998 phone login + simulated SMS OTP
- User profile + vehicle plate
- Home dashboard
- Manual GPS button with Tashkent fallback
- Search by parking/place name
- Smart map directly under Home search
- Stable parking pins with live availability numbers
- Parking Focus quick view when a result or marker is selected
- Parking detail, pricing, working hours and amenities
- Favorites
- Date/time/duration reservation
- Automatic price calculation
- Reservation QR + booking ID + countdown
- Navigation preview, distance and ETA
- External navigator handoff
- Simulated entry QR scan
- Active parking timer
- +1 hour parking extension
- 30/10 minute in-app timer reminders while the app is open
- Exit QR
- Simulated gate exit and mock payment
- Payment receipt
- Booking history filters: Active / Completed / Cancelled
- Notification center
- FULL parking demo with alternative parking suggestion

## Uzbekistan-only map scope

The MVP constrains the MapLibre map to an Uzbekistan bounding box. Production builds use browser geolocation when the user taps the GPS button. If GPS is unavailable, denied, times out, or is outside the MVP bounds, the app falls back to central Tashkent.

For this project’s local development environment, GPS is intentionally simulated at Tashkent because the development Windows device has OS location blocked by organization policy. Production builds use real browser GPS.

Map rendering uses MapLibre GL JS with OpenStreetMap raster tiles, so base-map tiles require an internet connection. No map API key is required.

## What is simulated — on purpose

A fully self-contained download cannot genuinely provide external infrastructure. These integration boundaries are simulated in v1:

- **SMS:** fixed OTP `123456` instead of a real SMS gateway.
- **Parking operator feed:** seeded parking/capacity data instead of live hardware/operator data.
- **Gate scanner:** buttons simulate entry/exit QR scans.
- **Road routing:** the in-app map shows a direction preview; the external navigator button can open Google Maps.
- **Payments:** a mock payment provider creates a receipt without charging real money.
- **Persistence:** browser localStorage rather than a multi-user production database.

The UI/business flow is structured so those boundaries can later be replaced by real providers.

## Production upgrade path

When moving beyond the self-contained MVP demo:

1. PostgreSQL + PostGIS + Drizzle for shared users, parking inventory and atomic reservations.
2. Better Auth + a Uzbekistan-capable SMS gateway for real OTP.
3. Operator/admin service or gate hardware integration for live availability and QR validation.
4. Production map/geocoding/routing provider.
5. Uzbekistan payment provider behind a `PaymentService` adapter.
6. Durable background jobs for reservation expiration and push/SMS reminders.
7. Playwright/Vitest, monitoring and CI/CD.

## Main routes

```text
/welcome
/home
/map  (legacy route redirects to /home)
/parking/:id
/reserve/:id
/reservation/:id
/navigate/:kind/:id
/session/:id
/receipt/:id
/bookings
/favorites
/notifications
/profile
```

## Reset

Open **Profile → Reset demo data** to restart onboarding and clear reservations/favorites/notifications.
