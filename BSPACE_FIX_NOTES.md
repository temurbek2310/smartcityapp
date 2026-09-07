# B SPACE — Fix notes

This package contains the corrected Home + map interaction requested during the MVP review.

## Main corrections

- Auth steps submit with Enter through real HTML forms.
- Bottom navigation is Home / Bookings / Favorites / Profile.
- Smart Map is integrated on Home immediately after search.
- Parking markers stay geographically anchored while panning and zooming.
- Marker numbers show available spaces; teal = available, amber = low, red = full.
- Clicking either a result card or a map marker opens the same B SPACE Focus state.
- Focus state zooms to the parking and shows availability, distance, price, directions, reserve, details and a better-nearby suggestion when useful.
- Favorites cards navigate correctly even outside Home.
- `/map` is now a legacy redirect to `/home`.
- Development GPS uses the Tashkent demo position because the development Windows device has location blocked by organization policy; production builds use real browser geolocation.
- Development unregisters stale service workers so old PWA caches do not interfere with Next.js HMR/assets.

## Quick test

1. `pnpm install`
2. `pnpm dev`
3. Complete onboarding and log in with OTP `123456`.
4. Confirm Home order is Search → Map → Nearby results.
5. Drag and zoom the map repeatedly; markers should remain attached to the same map positions.
6. Click a marker and a result card; both should open B SPACE Focus.
7. Use Directions, Reserve and Details from Focus.
8. Test Favorites, booking, QR entry, active session, extension, exit and receipt.
9. For a production/PWA check run `pnpm build` then `pnpm start`.
