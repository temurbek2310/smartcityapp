import { createElement } from 'react'
import { renderToStaticMarkup } from 'react-dom/server'
import { describe, expect, it, vi } from 'vitest'

import { AiRecommendationCard } from '@/components/transport/ai-recommendation-card'
import { RouteStatus } from '@/components/transport/route-status'
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
	realRouteMapLines,
	REAL_ROUTE_COLOR,
	trafficCongestionMeters,
	transportRecommendation,
	transitMapLines,
	transportRouteRequest,
	type ActiveRoute,
} from '@/lib/transport-route'
import type { TransportMode } from '@/lib/transport'

// Real routing on /transport: the car (Phase 1), walking (Phase 2) and the
// scooter (Phase 3) from 2GIS, metro estimated. Every fetch here is a mock — nothing reaches /api/directions,
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
	alternatives: [],
	maneuvers: [],
	traffic: [],
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

	it('requests metro as itself (Phase 4: 2GIS public transport)', () => {
		expect(transportRouteRequest({ mode: 'metro', origin: ORIGIN, destination: DESTINATION })).toEqual({
			mode: 'metro',
			origin: { lat: ORIGIN.lat, lng: ORIGIN.lng },
			destination: { lat: DESTINATION.lat, lng: DESTINATION.lng },
		})
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
	it('one route identity is one request; retry is exactly one more', async () => {
		const fetchImpl = vi.fn<typeof fetch>(async () => json(REAL))
		const loader = createRouteLoader({ fetch: fetchImpl })

		// Building requests fetches nothing by itself — metro included.
		for (const mode of ['metro'] as const) {
			expect(transportRouteRequest({ mode, origin: ORIGIN, destination: DESTINATION })).not.toBeNull()
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

	it('feeds the road distance into SmartCity’s fuel formula', () => {
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
			createElement(RouteStatus, {
				mode: 'car',
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
			const message = routeUnavailableMessage(reason, 'car')
			expect(message).not.toMatch(/2gis|config|timeout|upstream|key|api/i)
		}
	})

	const href = externalNavigationHref({ origin: ORIGIN, destination: DESTINATION, mode: 'car' })!
	const render = (reason: RouteFailureReason, navigateHref: string | null) => {
		const active = failedCar(reason)
		if (active.status !== 'unavailable') throw new Error('expected unavailable')
		return renderToStaticMarkup(
			createElement(RouteStatus, {
				mode: 'car',
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

describe('no estimated selected mode remains', () => {
	it.each(['metro'] as const)('%s never falls back to the estimate or the demo line', mode => {
		const active = activeTransportRoute({
			mode,
			estimate: estimateFor(mode),
			request: null,
			state: { status: 'idle' },
		})
		expect(active).toEqual({ status: 'needs-location' })
		expect(activeFigures(active)).toBeNull()
		expect(routeLineKind(active)).toBe('none')
	})

	it('the demo layers still describe only the demo line', () => {
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

	it('shows no metro number, never its old estimate, while metro has no real route', () => {
		const metro = activeTransportRoute({
			mode: 'metro',
			estimate: estimateFor('metro'),
			request: null,
			state: { status: 'idle' },
		})
		const labels = modeDurationLabels({ active: metro, selected: 'metro', estimatedMinutes })
		expect(labels.metro).toBeNull()
		for (const mode of MODES.filter(item => item !== 'metro')) {
			expect(labels[mode]).toBe(`≈${estimatedMinutes[mode]} daq`)
		}
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

	it('does not rank metro against the estimates either', () => {
		const metro = activeTransportRoute({
			mode: 'metro',
			estimate: estimateFor('metro'),
			request: null,
			state: { status: 'idle' },
		})
		expect(transportRecommendation({ active: metro, fastest })).toEqual({ kind: 'neutral', minutes: null })
	})
})

describe('public transport on the map', () => {
	const WALK: [number, number][] = [[69.27968, 41.31108], [69.2787, 41.3115]]
	const RIDE: [number, number][] = [[69.2787, 41.3115], [69.21938, 41.33983]]
	const palette = { walk: 'var-walk', ride: 'var-ride' }

	it('draws each leg in its own colour, rides above walking', () => {
		const lines = transitMapLines(
			[
				{ type: 'walk', geometry: WALK },
				{ type: 'ride', geometry: RIDE },
				{ type: 'transfer', geometry: WALK },
			],
			palette,
		)
		expect(lines.map(line => [line.color, line.zIndex])).toEqual([
			['var-walk', 1],
			['var-ride', 2],
			['var-walk', 1],
		])
		expect(lines[1].coordinates).toBe(RIDE)
		expect(new Set(lines.map(line => line.id)).size).toBe(3)
	})

	it('never draws a leg without a line', () => {
		expect(transitMapLines([{ type: 'ride', geometry: [[1, 2]] }], palette)).toEqual([])
	})
})

describe('real traffic on the map', () => {
	const LINE: [number, number][] = [[69.27968, 41.31108], [69.25, 41.33], [69.21938, 41.33983]]
	const SLOW: [number, number][] = [[69.27968, 41.31108], [69.25, 41.33]]
	const JAM: [number, number][] = [[69.25, 41.33], [69.21938, 41.33983]]

	it('draws the whole route in the brand colour, then only slow and jammed stretches over it', () => {
		const lines = realRouteMapLines({
			geometry: LINE,
			traffic: [
				{ speed: 'fast', distanceMeters: 900, geometry: SLOW },
				{ speed: 'slow', distanceMeters: 700, geometry: SLOW },
				{ speed: 'normal', distanceMeters: 300, geometry: JAM },
				{ speed: 'jam', distanceMeters: 500, geometry: JAM },
			],
		})
		expect(lines.map(line => [line.color, line.zIndex])).toEqual([
			[REAL_ROUTE_COLOR, 1],
			['#c99a4b', 2],
			['#b4564e', 2],
		])
		expect(lines[0].coordinates).toBe(LINE)
		expect(new Set(lines.map(line => line.id)).size).toBe(lines.length)
	})

	it('a route without traffic is one plain line', () => {
		expect(realRouteMapLines({ geometry: LINE, traffic: [] })).toEqual([
			{ id: 'route-real', color: REAL_ROUTE_COLOR, coordinates: LINE, zIndex: 1 },
		])
	})

	it('counts slow and jammed metres; no traffic data is null, not zero', () => {
		expect(trafficCongestionMeters({ traffic: [] })).toBeNull()
		expect(trafficCongestionMeters({
			traffic: [
				{ speed: 'fast', distanceMeters: 900, geometry: SLOW },
				{ speed: 'normal', distanceMeters: 400, geometry: SLOW },
			],
		})).toBe(0)
		expect(trafficCongestionMeters({
			traffic: [
				{ speed: 'slow', distanceMeters: 700, geometry: SLOW },
				{ speed: 'normal', distanceMeters: 400, geometry: SLOW },
				{ speed: 'jam', distanceMeters: 500, geometry: JAM },
			],
		})).toBe(1200)
	})
})

describe('AI card traffic line', () => {
	const fastest = { mode: 'car' as const, minutes: 10 }
	const render = (congestionMeters?: number | null) =>
		renderToStaticMarkup(
			createElement(AiRecommendationCard, {
				currentMode: 'car',
				recommendation: transportRecommendation({ active: REAL_CAR, fastest }),
				onSwitch: () => {},
				congestionMeters,
			}),
		)

	it('states 2GIS’s slow and jammed distance, and nothing when there is no traffic data', () => {
		expect(render(1200)).toContain('1,2 km tirbandlik')
		expect(render(0)).toContain('Tirbandlik yo‘q')
		expect(render(null)).not.toContain('irbandlik')
		expect(render()).not.toContain('irbandlik')
	})

	it('no longer says the traffic service is not connected', () => {
		expect(render(1200)).not.toContain('ulanmagan')
	})
})

describe('metro journey card', () => {
	const METRO_ROUTE: RealRoute = {
		status: 'ok',
		source: '2gis',
		mode: 'metro',
		distanceMeters: 7000,
		durationSeconds: 1500,
		geometry: [[69.27968, 41.31108], [69.21938, 41.33983]],
		alternatives: [],
		maneuvers: [],
		traffic: [],
		transitLegs: [
			{
				type: 'walk', durationSeconds: 300, distanceMeters: 400,
				geometry: [[69.27968, 41.31108], [69.2787, 41.3115]],
				lineInfo: null, fromStop: null, toStop: null, stopCount: null,
			},
			{
				type: 'ride', durationSeconds: 1020, distanceMeters: 6300,
				geometry: [[69.2787, 41.3115], [69.21938, 41.33983]],
				lineInfo: { vehicle: 'metro', name: 'Chilonzor yo‘li', color: '#e90101' },
				fromStop: 'Amir Temur xiyoboni', toStop: 'Bunyodkor', stopCount: 3,
			},
		],
	}

	const html = renderToStaticMarkup(
		createElement(RouteStatus, {
			mode: 'metro',
			route: {
				status: 'real',
				route: METRO_ROUTE,
				figures: { source: '2gis', minutes: 25, distanceKm: 7 },
			},
			onRetry: () => {},
			navigateHref: null,
			locating: false,
			onLocate: () => {},
			onPickOrigin: () => {},
		}),
	)

	it('lists 2GIS’s legs: walk with its distance, the line with its stations', () => {
		expect(html).toContain('2GIS marshruti')
		expect(html).toContain('Piyoda')
		expect(html).toContain('Metro · Chilonzor yo‘li')
		expect(html).toContain('Amir Temur xiyoboni → Bunyodkor')
		expect(html).toContain('3 bekat')
		expect(html).toContain('17 daq')
	})

	it('shows none of the demo metro content', () => {
		for (const demo of ['vagon', 'eng bo‘sh', '%', 'Namunaviy']) expect(html).not.toContain(demo)
	})
})
