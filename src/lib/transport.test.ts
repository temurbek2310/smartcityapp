import { describe, expect, it } from 'vitest'

import { isTransportMode, TRANSPORT_MODES } from './transport'

describe('TRANSPORT_MODES', () => {
	it('carries no travel time of its own', () => {
		// «Avto 15 daq» on Home was a constant, shown before the customer had
		// chosen anywhere to go. Durations belong to a route, so they come from
		// lib/eta against a real destination instead of living on the mode.
		for (const mode of TRANSPORT_MODES) expect(mode).not.toHaveProperty('time')
	})

	it('is exactly the four modes the query string accepts', () => {
		expect(TRANSPORT_MODES.map(mode => mode.id)).toEqual([
			'car',
			'metro',
			'scooter',
			'walk',
		])
		for (const mode of TRANSPORT_MODES) expect(isTransportMode(mode.id)).toBe(true)
	})

	it('rejects anything else a URL might carry', () => {
		for (const value of [null, '', 'bus', 'CAR', 'walking'])
			expect(isTransportMode(value)).toBe(false)
	})
})
