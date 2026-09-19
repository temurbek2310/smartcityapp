import { describe, expect, it } from 'vitest'

import { PARKINGS } from '@/data/parkings'
import { PLACES } from '@/data/places'
import { QUEUE_ORGS } from '@/data/queue-orgs'
import { bookingRows } from '@/lib/bookings'
import { initialState, USER_ACTIVITY_KEYS } from '@/lib/initial-state'

// A fresh install has to look like a fresh install. The app used to open on
// two notifications nobody had been sent, a favourite place nobody had saved
// and a number plate belonging to nobody — a new customer's first impression
// was of an account someone else had already been using.
describe('a new customer starts with nothing of their own', () => {
	it.each(USER_ACTIVITY_KEYS)('has no %s', key => {
		expect(initialState[key]).toEqual([])
	})

	// Written separately from the loop: the loop proves each listed store is
	// empty, this proves the list still names every store there is. A new
	// collection added to the state without being listed would otherwise be
	// seeded freely and no test would notice.
	it('leaves nothing but preferences and the empty stores', () => {
		const arrays = Object.entries(initialState)
			.filter(([, value]) => Array.isArray(value))
			.map(([key]) => key)
		expect(arrays.sort()).toEqual([...USER_ACTIVITY_KEYS].sort())
	})

	it('is signed out and has not been onboarded', () => {
		expect(initialState.user).toBeNull()
		expect(initialState.onboardingDone).toBe(false)
		expect(initialState.hydrated).toBe(false)
	})

	// The Booking Center reads all three stores at once, so this is the same
	// emptiness the customer actually sees on /bookings.
	it('shows an empty Booking Center', () => {
		expect(bookingRows(initialState)).toEqual([])
	})

	// Preferences are not activity: which notifications a new account would
	// accept is a default, not something anyone did.
	it('still keeps its notification defaults', () => {
		expect(initialState.notificationPrefs).toEqual({
			bookingReminders: true,
			freeSpaces: true,
			queueTurn: true,
			roadClosures: true,
			cityEvents: false,
			partnerOffers: false,
		})
	})
})

// The other half of the bargain: emptying the account must not empty the
// shop. A customer with no history still needs somewhere to book.
describe('the catalogs survive an empty account', () => {
	it('still has parkings, places and queue organisations to book', () => {
		expect(PARKINGS.length).toBeGreaterThan(0)
		expect(PLACES.length).toBeGreaterThan(0)
		expect(QUEUE_ORGS.length).toBeGreaterThan(0)
	})

	it('still has a price and a coordinate for every parking', () => {
		for (const parking of PARKINGS) {
			// Zero is a real tariff — the catalog has free lots, and the parking
			// filters have a «free» chip for exactly them.
			expect(parking.pricePerHour).toBeGreaterThanOrEqual(0)
			expect(Number.isFinite(parking.lat)).toBe(true)
			expect(Number.isFinite(parking.lng)).toBe(true)
		}
	})
})
