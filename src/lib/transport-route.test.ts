import { createElement } from 'react'
import { renderToStaticMarkup } from 'react-dom/server'
import { describe, expect, it, vi } from 'vitest'

import { CarRouteStatus } from '@/components/transport/car-route-status'
import { estimateFareUZS, estimateFuelCostUZS, estimateMinutesForMode, fastestMode } from '@/lib/eta'
import { distanceKm } from '@/lib/geo'
import { createRouteLoader, deriveRouteState, type RouteState } from '@/lib/route-client'
import { externalNavigationHref, resolveRouteEndpoint } from '@/lib/route-endpoints'
import {
	routeRequestKey,
	type RealRoute,
	type RoutableEndpoint,
	type RouteFailureReason,
} from '@/lib/routing'
import {
	activeFigures,
	activeTransportRoute,
	modeDurationLabels,
	routeLineKind,
	routeMapLayers,
	routeMinutesFromSeconds,
	routeUnavailableMessage,
	transportRecommendation,
	transportRouteRequest,
	type ActiveRoute,
} from '@/lib/transport-route'
import type { TransportMode } from '@/lib/transport'

// Phase 1 of real routing on /transport: the car from 2GIS, everything else
// estimated. Every fetch here is a mock — nothing reaches /api/directions,
// let alone 2GIS.

const ORIGIN: RoutableEndpoint = { lat: 41.31108, lng: 69.27968, kind: 'saved', approximate: false }
const DESTINATION: RoutableEndpoint = { lat: 41.33983, lng: 69.21938, kind: 'place', approximate: false }
const MODES: TransportMode[] = ['car', 'metro', 'scooter', 'walk']

const REAL: RealRoute = {
	status: 'ok',
	source: '2gis',
	mode: 'car',
	distanceMeters: 8350,
	durationSeconds: 1110,
	geometry: [[69.27968, 41.31108], [69.25, 41.33], [69.21938, 41.33983]],
}

const haversineKm = distanceKm(ORIGIN, DESTINATION)
const estimateFor = (mode: TransportMode) => ({
	minutes: estimateMinutesForMode(haversineKm, mode),
	distanceKm: haversineKm,
})
const estimatedMinutes = Object.fromEntries(
	MODES.map(mode => [mode, estimateMinutesForMode(haversineKm, mode)]),
) as Record<TransportMode, number>

const carRequest = transportRouteRequest({ mode: 'car', origin: ORIGIN, destination: DESTINATION })!
const carKey = routeRequestKey(carRequest)

function carRoute(state: RouteState): ActiveRoute {
	return activeTransportRoute({ mode: 'car', estimate: estimateFor('car'), request: carRequest, state })
}
const REAL_CAR = carRoute({ status: 'ok', key: carKey, route: REAL })
const LOADING_CAR = carRoute({ status: 'loading', key: carKey })
const failedCar = (reason: RouteFailureReason) =>
	carRoute({ status: 'unavailable', key: carKey, reason })

function json(body: unknown) {
	return new Response(JSON.stringify(body), { status: 200 })
}

describe('which modes request a real route', () => {
	it('requests the car between two real points', () => {
		expect(carRequest).toEqual({
			mode: 'car',
			origin: { lat: ORIGIN.lat, lng: ORIGIN.lng },
			destination: { lat: DESTINATION.lat, lng: DESTINATION.lng },
		})
	})

	it.each(['metro', 'scooter', 'walk'] as const)('never requests %s', mode => {
		expect(transportRouteRequest({ mode, origin: ORIGIN, destination: DESTINATION })).toBeNull()
	})

	it('never sends the approximate city centre as the car origin', () => {
		const centre = resolveRouteEndpoint('me', null)!
		expect(centre.approximate).toBe(true)
		expect(transportRouteRequest({ mode: 'car', origin: centre, destination: DESTINATION })).toBeNull()
		expect(transportRouteRequest({ mode: 'car', origin: ORIGIN, destination: centre })).toBeNull()
	})

	it('sends a real GPS fix as the car origin', () => {
		const me = resolveRouteEndpoint('me', { lat: 41.3, lng: 69.25 })!
		expect(transportRouteRequest({ mode: 'car', origin: me, destination: DESTINATION })).not.toBeNull()
	})

	it('shows an honest location-needed state, not the estimate, when the car has no real origin', () => {
		const active = activeTransportRoute({
			mode: 'car',
			estimate: estimateFor('car'),
			request: null,
			state: deriveRouteState(null, 0, null),
		})
		expect(active).toEqual({ status: 'needs-location' })
		expect(activeFigures(active)).toBeNull()
		expect(routeLineKind(active)).toBe('none')
	})
})

describe('request count against a mocked /api/directions', () => {
	it('one route identity is one request; non-car modes are none; retry is exactly one more', async () => {
		const fetchImpl = vi.fn<typeof fetch>(async () => json(REAL))
		const loader = createRouteLoader({ fetch: fetchImpl })

		// Walk, metro and scooter produce no request at all.
		for (const mode of ['walk', 'metro', 'scooter'] as const) {
			expect(transportRouteRequest({ mode, origin: ORIGIN, destination: DESTINATION })).toBeNull()
		}
		expect(fetchImpl).not.toHaveBeenCalled()

		// Two renders build two request objects (and GPS-scale jitter) for the
		// same route: one key, one shared request.
		const first = transportRouteRequest({ mode: 'car', origin: ORIGIN, destination: DESTINATION })!
		const again = transportRouteRequest({
			mode: 'car',
			origin: { ...ORIGIN, lat: ORIGIN.lat + 0.000001 },
			destination: { ...DESTINATION },
		})!
		expect(routeRequestKey(again)).toBe(routeRequestKey(first))
		await Promise.all([loader.load(first), loader.load(again)])
		expect(fetchImpl).toHaveBeenCalledTimes(1)

		// retry() is a new revision of the same key: one more request, not two.
		await loader.load(first)
		expect(fetchImpl).toHaveBeenCalledTimes(2)

		// A changed destination is a new identity.
		const moved = transportRouteRequest({
			mode: 'car',
			origin: ORIGIN,
			destination: { ...DESTINATION, lat: 41.2570, lng: 69.2810 },
		})!
		expect(routeRequestKey(moved)).not.toBe(routeRequestKey(first))
		await loader.load(moved)
		expect(fetchImpl).toHaveBeenCalledTimes(3)
	})

	it('a remount that rejoins before the deferred abort shares the open request', async () => {
		// useRoute's cleanup aborts a microtask late, so React's StrictMode
		// mount → unmount → mount in development is still one request.
		const fetchImpl = vi.fn<typeof fetch>(async () => json(REAL))
		const loader = createRouteLoader({ fetch: fetchImpl })
		const first = new AbortController()
		const firstLoad = loader.load(carRequest, first.signal)
		queueMicrotask(() => first.abort())
		const second = loader.load(carRequest, new AbortController().signal)
		await expect(firstLoad).rejects.toThrow()
		await expect(second).resolves.toEqual(REAL)
		expect(fetchImpl).toHaveBeenCalledTimes(1)
	})
})

describe('a successful car route', () => {
	it('replaces the car distance and duration with 2GIS’s and keeps the source', () => {
		expect(REAL_CAR.status).toBe('real')
		const figures = activeFigures(REAL_CAR)!
		expect(figures).toEqual({ source: '2gis', minutes: 19, distanceKm: 8.35 })
		expect(figures.distanceKm).not.toBeCloseTo(haversineKm, 1)
		expect(figures.minutes).not.toBe(estimateMinutesForMode(haversineKm, 'car'))
		if (REAL_CAR.status === 'real') {
			expect(REAL_CAR.route.source).toBe('2gis')
			expect(REAL_CAR.route.geometry).toBe(REAL.geometry)
		}
	})

	it('selects the real geometry for the map, without demo traffic, pins or legend', () => {
		expect(routeLineKind(REAL_CAR)).toBe('real')
		expect(routeMapLayers({ showRoute: true, lineKind: 'real' })).toEqual({
			line: 'real',
			problemPins: false,
			trafficLegend: false,
		})
	})

	it('feeds the road distance into B SPACE’s fuel formula', () => {
		const figures = activeFigures(REAL_CAR)!
		expect(estimateFareUZS(figures.distanceKm, figures.minutes, 'car')).toBe(estimateFuelCostUZS(8.35))
	})
})

describe('route minutes', () => {
	it('never shows 0 minutes and rounds to the nearest minute', () => {
		expect(routeMinutesFromSeconds(0)).toBe(1)
		expect(routeMinutesFromSeconds(20)).toBe(1)
		expect(routeMinutesFromSeconds(89)).toBe(1)
		expect(routeMinutesFromSeconds(91)).toBe(2)
		expect(routeMinutesFromSeconds(1110)).toBe(19)
	})
})

describe('a car route that is loading', () => {
	it('has no figures, no line, and does not reuse the estimate', () => {
		expect(LOADING_CAR).toEqual({ status: 'loading' })
		expect(activeFigures(LOADING_CAR)).toBeNull()
		expect(routeLineKind(LOADING_CAR)).toBe('none')
		expect(routeMapLayers({ showRoute: true, lineKind: 'none' })).toEqual({
			line: 'none',
			problemPins: false,
			trafficLegend: false,
		})
	})

	it('shows no car minutes on its pill while loading', () => {
		const labels = modeDurationLabels({ active: LOADING_CAR, selected: 'car', estimatedMinutes })
		expect(labels.car).toBe('…')
		expect(labels.car).not.toContain(String(estimatedMinutes.car))
	})

	it('announces itself in the status card without any distance or time', () => {
		const html = renderToStaticMarkup(
			createElement(CarRouteStatus, {
				route: { status: 'loading' },
				onRetry: () => {},
				navigateHref: null,
				locating: false,
				onLocate: () => {},
				onPickOrigin: () => {},
			}),
		)
		expect(html).toContain('Marshrut hisoblanmoqda')
		expect(html).not.toMatch(/\d+ (daq|km)/)
	})
})

describe('a car route that failed', () => {
	it('draws no line — never the demo line in its place', () => {
		for (const reason of ['config', 'invalid', 'timeout', 'upstream', 'no_route'] as const) {
			const active = failedCar(reason)
			expect(active.status).toBe('unavailable')
			expect(activeFigures(active)).toBeNull()
			expect(routeLineKind(active)).toBe('none')
		}
	})

	it('offers retry only where retrying can help', () => {
		expect(failedCar('timeout')).toMatchObject({ retryable: true })
		expect(failedCar('upstream')).toMatchObject({ retryable: true })
		expect(failedCar('config')).toMatchObject({ retryable: false })
		expect(failedCar('invalid')).toMatchObject({ retryable: false })
		expect(failedCar('no_route')).toMatchObject({ retryable: false })
	})

	it('keeps provider internals out of the message', () => {
		for (const reason of ['config', 'invalid', 'timeout', 'upstream', 'no_route'] as const) {
			const message = routeUnavailableMessage(reason)
			expect(message).not.toMatch(/2gis|config|timeout|upstream|key|api/i)
		}
	})

	const href = externalNavigationHref({ origin: ORIGIN, destination: DESTINATION, mode: 'car' })!
	const render = (reason: RouteFailureReason, navigateHref: string | null) => {
		const active = failedCar(reason)
		if (active.status !== 'unavailable') throw new Error('expected unavailable')
		return renderToStaticMarkup(
			createElement(CarRouteStatus, {
				route: active,
				onRetry: () => {},
				navigateHref,
				locating: false,
				onLocate: () => {},
				onPickOrigin: () => {},
			}),
		)
	}

	it('renders Qayta urinish and the existing 2GIS hand-off for a retryable failure', () => {
		const html = render('timeout', href)
		expect(html).toContain('Qayta urinish')
		expect(html).toContain('2GIS’da ochish')
		expect(html).toContain(`href="${href.replaceAll('&', '&amp;')}"`)
	})

	it('does not pretend retry fixes a missing configuration', () => {
		const html = render('config', href)
		expect(html).not.toContain('Qayta urinish')
		expect(html).toContain('2GIS’da ochish')
	})

	it('leaves the 2GIS action out when there is no hand-off link', () => {
		expect(render('upstream', null)).not.toContain('2GIS’da ochish')
	})
})

describe('estimated modes', () => {
	it.each(['metro', 'scooter', 'walk'] as const)('%s keeps the estimate and the demo line', mode => {
		const active = activeTransportRoute({
			mode,
			estimate: estimateFor(mode),
			request: null,
			state: { status: 'idle' },
		})
		expect(active).toEqual({ status: 'estimate', figures: { source: 'estimate', ...estimateFor(mode) } })
		expect(routeLineKind(active)).toBe('demo')
		expect(routeMapLayers({ showRoute: true, lineKind: 'demo' })).toEqual({
			line: 'demo',
			problemPins: true,
			trafficLegend: true,
		})
	})

	it('hides every layer when the route line is toggled off', () => {
		expect(routeMapLayers({ showRoute: false, lineKind: 'demo' })).toEqual({
			line: 'none',
			problemPins: false,
			trafficLegend: false,
		})
	})
})

describe('mode pills', () => {
	it('mark estimates with ≈ and print the real car time without it', () => {
		const labels = modeDurationLabels({ active: REAL_CAR, selected: 'car', estimatedMinutes })
		expect(labels.car).toBe('19 daq')
		expect(labels.metro).toBe(`≈${estimatedMinutes.metro} daq`)
		expect(labels.scooter).toBe(`≈${estimatedMinutes.scooter} daq`)
		expect(labels.walk).toBe(`≈${estimatedMinutes.walk} daq`)
	})

	it('shows no car number when the real route failed', () => {
		const labels = modeDurationLabels({ active: failedCar('upstream'), selected: 'car', estimatedMinutes })
		expect(labels.car).toBeNull()
	})

	it('shows every mode as an estimate when car is not selected', () => {
		const walk = activeTransportRoute({
			mode: 'walk',
			estimate: estimateFor('walk'),
			request: null,
			state: { status: 'idle' },
		})
		const labels = modeDurationLabels({ active: walk, selected: 'walk', estimatedMinutes })
		for (const mode of MODES) expect(labels[mode]).toBe(`≈${estimatedMinutes[mode]} daq`)
	})
})

describe('AI tavsiyasi and the fastest mode', () => {
	const fastest = fastestMode(haversineKm, MODES)

	it('does not rank estimates against a real car route', () => {
		expect(transportRecommendation({ active: REAL_CAR, fastest })).toEqual({ kind: 'neutral', minutes: 19 })
	})

	it('does not rank anything while the car has no answer', () => {
		expect(transportRecommendation({ active: LOADING_CAR, fastest })).toEqual({ kind: 'neutral', minutes: null })
		expect(transportRecommendation({ active: failedCar('timeout'), fastest })).toEqual({ kind: 'neutral', minutes: null })
	})

	it('still ranks when every number is an estimate', () => {
		const metro = activeTransportRoute({
			mode: 'metro',
			estimate: estimateFor('metro'),
			request: null,
			state: { status: 'idle' },
		})
		expect(transportRecommendation({ active: metro, fastest })).toEqual({
			kind: 'ranked',
			currentMinutes: estimatedMinutes.metro,
			fastestMode: fastest.mode,
			fastestMinutes: fastest.minutes,
		})
	})
})
