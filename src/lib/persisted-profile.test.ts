import { describe, expect, it } from 'vitest'

import { hydrateUserProfile } from './persisted-profile'
import { displayUzbekPlate } from './plate'

// The blob captured from a real browser: an older build stored the vehicle
// under `plate`, so the customer's own valid plate was sitting in storage
// while every screen showed «—» and new reservations copied nothing forward.
const legacy = { name: 'Test', phone: '+998901234567', plate: '01 A 777 AA' }

describe('hydrateUserProfile', () => {
	it('carries a legacy plate across to the current field', () => {
		expect(hydrateUserProfile(legacy)).toEqual({
			name: 'Test',
			phone: '+998901234567',
			plate: '01 A 777 AA',
			vehiclePlate: '01 A 777 AA',
		})
	})

	it('normalises a legacy plate on the way across', () => {
		expect(hydrateUserProfile({ ...legacy, plate: '01a777aa' })?.vehiclePlate)
			.toBe('01 A 777 AA')
	})

	// The migration must never be what breaks a profile that was already fine.
	it('leaves a current-format profile untouched', () => {
		const current = {
			name: 'Test',
			phone: '+998901234567',
			vehiclePlate: '10 A 019 BB',
			joinedAt: '2026-01-01T00:00:00.000Z',
			premium: true,
		}
		expect(hydrateUserProfile(current)).toBe(current)
	})

	it('prefers the current field when a stale legacy one is alongside it', () => {
		expect(
			hydrateUserProfile({ ...legacy, vehiclePlate: '10 A 019 BB' })?.vehiclePlate,
		).toBe('10 A 019 BB')
	})

	// Inventing a plate would be worse than showing none: it is handed to the
	// venue so security recognises the car.
	it('invents nothing when neither field carries a plate', () => {
		for (const user of [
			{ name: 'Test', phone: '+998901234567' },
			{ name: 'Test', phone: '+998901234567', plate: '' },
			{ name: 'Test', phone: '+998901234567', plate: '   ' },
			{ name: 'Test', phone: '+998901234567', plate: 42 },
			{ name: 'Test', phone: '+998901234567', vehiclePlate: '' },
		]) {
			expect(hydrateUserProfile(user)?.vehiclePlate ?? '').toBe('')
		}
	})

	it('keeps every other field it does not understand', () => {
		const hydrated = hydrateUserProfile({ ...legacy, premium: true, nickname: 'T' })
		expect(hydrated).toMatchObject({ premium: true, nickname: 'T', name: 'Test' })
	})

	it('has nothing to hydrate when no profile was stored', () => {
		for (const value of [null, undefined, 'nonsense', 7]) {
			expect(hydrateUserProfile(value)).toBeNull()
		}
	})

	// The defensive display path still has to hold up the case this cannot fix.
	it('still leaves a genuinely plate-less profile safe to render', () => {
		const hydrated = hydrateUserProfile({ name: 'Test', phone: '+998901234567' })
		expect(() => displayUzbekPlate(hydrated?.vehiclePlate)).not.toThrow()
		expect(displayUzbekPlate(hydrated?.vehiclePlate)).toBe('—')
	})
})
