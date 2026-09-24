import { describe, expect, it } from 'vitest'

import { resolveRouteEndpoint } from '@/lib/route-endpoints'
import {
	canRequestRealRoute,
	isRealRoute,
	isRetryableFailure,
	parseRouteResult,
	realRouteGeometry,
	realRouteRequest,
	routeRequestKey,
	routeUnavailable,
	type RealRoute,
	type RouteRequest,
} from '@/lib/routing'

const AMIR_TEMUR = { lat: 41.31108, lng: 69.27968 }
const HUMO_ARENA = { lat: 41.33983, lng: 69.21938 }
const GPS = { lat: 41.30012, lng: 69.24031 }

function request(overrides: Partial<RouteRequest> = {}): RouteRequest {
	return { origin: AMIR_TEMUR, destination: HUMO_ARENA, mode: 'car', ...overrides }
}

const REAL: RealRoute = {
	status: 'ok',
	source: '2gis',
	mode: 'car',
	distanceMeters: 6400,
	durationSeconds: 840,
	geometry: [[69.27968, 41.31108], [69.25, 41.33], [69.21938, 41.33983]],
}

describe('routeRequestKey', () => {
	it('is deterministic', () => {
		expect(routeRequestKey(request())).toBe(routeRequestKey(request()))
		expect(routeRequestKey(request())).toBe('car:41.31108,69.27968>41.33983,69.21938')
	})

	it('ignores GPS jitter below ~1 m', () => {
		const jittered = request({
			origin: { lat: AMIR_TEMUR.lat + 0.0000021, lng: AMIR_TEMUR.lng - 0.0000018 },
		})
		expect(routeRequestKey(jittered)).toBe(routeRequestKey(request()))
	})

	it('changes with a real move', () => {
		const moved = request({ origin: { lat: AMIR_TEMUR.lat + 0.0002, lng: AMIR_TEMUR.lng } })
		expect(routeRequestKey(moved)).not.toBe(routeRequestKey(request()))
	})

	it('differs by mode', () => {
		expect(routeRequestKey(request({ mode: 'walk' }))).not.toBe(routeRequestKey(request()))
	})

	it('differs by destination, and by direction', () => {
		expect(routeRequestKey(request({ destination: GPS }))).not.toBe(routeRequestKey(request()))
		expect(
			routeRequestKey(request({ origin: HUMO_ARENA, destination: AMIR_TEMUR })),
		).not.toBe(routeRequestKey(request()))
	})

	it('keys -0 and 0 the same', () => {
		const a = request({ origin: { lat: 41.3, lng: -0.000001 } })
		const b = request({ origin: { lat: 41.3, lng: 0 } })
		expect(routeRequestKey(a)).toBe(routeRequestKey(b))
	})
})

describe('canRequestRealRoute', () => {
	it('allows a real GPS fix', () => {
		const me = resolveRouteEndpoint('me', GPS)!
		expect(me.approximate).toBe(false)
		expect(canRequestRealRoute(me)).toBe(true)
	})

	it('allows a place picked from the catalog', () => {
		const picked = resolveRouteEndpoint('humo-arena', null)!
		expect(canRequestRealRoute(picked)).toBe(true)
	})

	it('never allows the approximate centre that stands in for a missing fix', () => {
		const me = resolveRouteEndpoint('me', null)!
		expect(me.approximate).toBe(true)
		expect(canRequestRealRoute(me)).toBe(false)
	})

	it('refuses points outside Uzbekistan and non-numbers', () => {
		expect(canRequestRealRoute({ lat: 55.75, lng: 37.62, kind: 'saved', approximate: false })).toBe(false)
		expect(canRequestRealRoute({ lat: NaN, lng: 69.2, kind: 'saved', approximate: false })).toBe(false)
		expect(canRequestRealRoute(null)).toBe(false)
	})
})

describe('realRouteRequest', () => {
	it('builds a normalized request from two real ends', () => {
		const origin = resolveRouteEndpoint('me', { lat: 41.300121234, lng: 69.240311111 })!
		const destination = resolveRouteEndpoint('humo-arena', null)!
		expect(realRouteRequest({ origin, destination, mode: 'car' })).toEqual({
			origin: { lat: 41.30012, lng: 69.24031 },
			destination: { lat: destination.lat, lng: destination.lng },
			mode: 'car',
		})
	})

	it('is null when either end is the approximate centre', () => {
		const approximate = resolveRouteEndpoint('me', null)!
		const place = resolveRouteEndpoint('humo-arena', null)!
		expect(realRouteRequest({ origin: approximate, destination: place, mode: 'car' })).toBeNull()
		expect(realRouteRequest({ origin: place, destination: approximate, mode: 'car' })).toBeNull()
	})
})

describe('failure model', () => {
	it('retries only what can change on retry', () => {
		expect(isRetryableFailure('timeout')).toBe(true)
		expect(isRetryableFailure('upstream')).toBe(true)
		expect(isRetryableFailure('invalid')).toBe(false)
		expect(isRetryableFailure('config')).toBe(false)
		expect(isRetryableFailure('no_route')).toBe(false)
	})
})

// Once a route is presented as real, a failure is a failure: there is no path
// from an unavailable result to any geometry, least of all the demo line.
describe('no silent fake fallback', () => {
	it('only a 2GIS answer is a real route', () => {
		expect(isRealRoute(REAL)).toBe(true)
		expect(realRouteGeometry(REAL)).toBe(REAL.geometry)
	})

	it('an unavailable result yields no geometry at all', () => {
		for (const reason of ['invalid', 'config', 'timeout', 'upstream', 'no_route'] as const) {
			expect(isRealRoute(routeUnavailable(reason))).toBe(false)
			expect(realRouteGeometry(routeUnavailable(reason))).toBeNull()
		}
		expect(realRouteGeometry(null)).toBeNull()
	})

	it('a result claiming another source is not accepted as real', () => {
		expect(parseRouteResult({ ...REAL, source: 'estimate' })).toEqual(routeUnavailable('upstream'))
	})
})

describe('parseRouteResult', () => {
	it('accepts a well-formed route', () => {
		expect(parseRouteResult(JSON.parse(JSON.stringify(REAL)))).toEqual(REAL)
	})

	it('keeps a known failure reason and nothing else from the body', () => {
		expect(parseRouteResult({ status: 'unavailable', reason: 'timeout', message: 'x' })).toEqual({
			status: 'unavailable',
			reason: 'timeout',
		})
		expect(parseRouteResult({ status: 'unavailable', reason: 'boom' })).toEqual(routeUnavailable('upstream'))
	})

	it('treats anything unreadable as an upstream failure', () => {
		for (const body of [null, 'html', 42, {}, { ...REAL, geometry: [[1, 2]] }, { ...REAL, geometry: [[1, 'a'], [2, 3]] }, { ...REAL, distanceMeters: -1 }]) {
			expect(parseRouteResult(body)).toEqual(routeUnavailable('upstream'))
		}
	})
})
