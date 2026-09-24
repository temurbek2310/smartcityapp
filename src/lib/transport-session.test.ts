import { describe, expect, it } from 'vitest'

import {
	openTransportSession,
	recordTransportSync,
	transportSessionFor,
} from '@/lib/transport-session'

const CAR = 'mode=car&target=magic-city'
const METRO = 'mode=metro&target=magic-city'
const WALK = 'mode=walk&target=magic-city'
const HUMO = 'mode=car&target=humo-arena'

describe('transport session', () => {
	it('keeps the same mount for the URL sync the view does itself', () => {
		const opened = openTransportSession(CAR)
		const written = recordTransportSync(opened, METRO)
		// The render in between: the session knows, the router does not yet.
		expect(transportSessionFor(written, CAR).key).toBe(opened.key)
		// The router catches up.
		const caughtUp = transportSessionFor(written, METRO)
		expect(caughtUp.key).toBe(opened.key)
		expect(caughtUp.inFlight).toEqual([])
	})

	it('survives several writes before the router catches up', () => {
		let session = openTransportSession(CAR)
		session = recordTransportSync(session, METRO)
		session = recordTransportSync(session, WALK)
		for (const query of [CAR, METRO, WALK]) {
			expect(transportSessionFor(session, query).key).toBe(openTransportSession(CAR).key)
		}
	})

	it('starts over for a query somebody else set', () => {
		const session = transportSessionFor(recordTransportSync(openTransportSession(CAR), METRO), METRO)
		const external = transportSessionFor(session, HUMO)
		expect(external.key).not.toBe(session.key)
		expect(external.synced).toBe(HUMO)
		// Once caught up, even the view's own earlier query is external again —
		// and a new mount, although the query matches the one it opened with.
		const back = transportSessionFor(session, CAR)
		expect(back.key).not.toBe(session.key)
		expect(back.synced).toBe(CAR)
	})

	it('returns the same object when nothing changes', () => {
		const session = openTransportSession(CAR)
		expect(transportSessionFor(session, CAR)).toBe(session)
		expect(recordTransportSync(session, CAR)).toBe(session)
	})
})
