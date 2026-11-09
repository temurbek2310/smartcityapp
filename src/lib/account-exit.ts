import { liveBookingCount } from '@/lib/booking-lifecycle'
import { initialState, loggedOutState } from '@/lib/initial-state'
import type { SmartCityState } from '@/lib/types'

// Logout, account deletion and the demo reset all end this person's use of the device, and
// with no backend to restore anything, both would destroy a live booking for
// good — a parking QR, an active session the car needs to leave the lot, a
// queue ticket, a table. So all three are refused while anything is live, by
// the same rule, and none offers a way round it.
//
// These decide; the store's resetDemo() stays the unconditional primitive
// that a caller runs only once its decision has come back ok.

export type AccountExit =
	| { ok: true; state: SmartCityState }
	| { ok: false; live: number }

function unlessLive(current: SmartCityState, next: () => SmartCityState): AccountExit {
	const live = liveBookingCount(current)
	return live > 0 ? { ok: false, live } : { ok: true, state: next() }
}

// Signing out keeps the device facts (onboarding) — see loggedOutState.
export function logOut(current: SmartCityState): AccountExit {
	return unlessLive(current, () => loggedOutState(current))
}

// The state resetDemo() sets.
const freshInstall = (): SmartCityState => ({ ...initialState, hydrated: true })

// Deleting the account is a fresh install.
export function deleteAccount(current: SmartCityState): AccountExit {
	return unlessLive(current, freshInstall)
}

// «Demo ma’lumotlarini tozalash»: also a fresh install, and just as
// destructive to a live booking.
export function resetDemoData(current: SmartCityState): AccountExit {
	return unlessLive(current, freshInstall)
}
