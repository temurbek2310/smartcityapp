// Runs the booking-time tests under several host timezones. Booking times are
// Tashkent wall clock; a rule that only holds on a phone set to Tashkent is
// the bug this guards against, so one host zone proves nothing.
//
//   npm run test:tz            the time-sensitive files
//   npm run test:tz -- --all   the whole suite
import { spawnSync } from 'node:child_process'

const ZONES = ['Asia/Tashkent', 'UTC', 'America/New_York', 'Asia/Kolkata']
const FILES = [
	'src/lib/tashkent-time.test.ts',
	'src/lib/parking-time.test.ts',
	'src/lib/service-slots.test.ts',
	'src/lib/bookings.test.ts',
	'src/lib/booking-journey.test.ts',
	'src/lib/booking-lifecycle.test.ts',
	'src/lib/booking-conflicts.test.ts',
	'src/lib/format.test.ts',
]
const files = process.argv.includes('--all') ? [] : FILES

let failed = false
for (const zone of ZONES) {
	console.log(`\n=== TZ=${zone} ===`)
	const result = spawnSync('npx', ['vitest', 'run', ...files], {
		stdio: 'inherit',
		shell: process.platform === 'win32',
		env: { ...process.env, TZ: zone },
	})
	if (result.status !== 0) failed = true
}
process.exit(failed ? 1 : 0)
