import { createElement } from 'react'
import { renderToStaticMarkup } from 'react-dom/server'
import { describe, expect, it, vi } from 'vitest'

import { AiRecommendationCard } from '@/components/transport/ai-recommendation-card'
import { RouteStatus } from '@/components/transport/route-status'
import { RouteSummary } from '@/components/transport/route-summary'
import { DEMO_ROUTE_FACTS } from '@/data/demo-transport'
import { estimateFareUZS, estimateMinutesForMode, fastestMode } from '@/lib/eta'
import { distanceKm } from '@/lib/geo'
import { createRouteLoader, type RouteState } from '@/lib/route-client'
import { externalNavigationHref, resolveRouteEndpoint } from '@/lib/route-endpoints'
import {
	REAL_ROUTING_MODES,
	routeRequestKey,
	type RealRoute,
	type RoutableEndpoint,
	type RouteFailureReason,
} from '@/lib/routing'
import {
	activeFigures,
	activeTransportRoute,
	modeCapabilities,
	modeDurationLabels,
	neutralRecommendationReason,
	REAL_ROUTED_MODES,
	routeLineKind,
	routeMapLayers,
	routeUnavailableMessage,
	transportRecommendation,
	transportRouteRequest,
	type ActiveRoute,
} from '@/lib/transport-route'
import type { TransportMode } from '@/lib/transport'

// Phase 2: walking routed by 2GIS. Every fetch here is a mock — nothing
// reaches /api/directions, let alone 2GIS.

const ORIGIN: RoutableEndpoint = { lat: 41.31108, lng: 69.27968, kind: 'saved', approximate: false }
const DESTINATION: RoutableEndpoint = { lat: 41.3164, lng: 69.2486, kind: 'place', approximate: false }
const MODES: TransportMode[] = ['car', 'metro', 'scooter', 'walk']

// A footpath that bends away from the straight line between the ends.
const REAL_WALK: RealRoute = {
	status: 'ok',
	source: '2gis',
	mode: 'walk',
	distanceMeters: 3120,
	durationSeconds: 2460,
	geometry: [[69.27968, 41.31108], [69.2702, 41.3071], [69.2555, 41.3102], [69.2486, 41.3164]],
}

const haversineKm = distanceKm(ORIGIN, DESTINATION)
const estimateFor = (mode: TransportMode) => ({
	minutes: estimateMinutesForMode(haversineKm, mode),
	distanceKm: haversineKm,
})
const estimatedMinutes = Object.fromEntries(
	MODES.map(mode => [mode, estimateMinutesForMode(haversineKm, mode)]),
) as Record<TransportMode, number>

const walkRequest = transportRouteRequest({ mode: 'walk', origin: ORIGIN, destination: DESTINATION })!
const walkKey = routeRequestKey(walkRequest)

function walkRoute(state: RouteState): ActiveRoute {
	return activeTransportRoute({ mode: 'walk', estimate: estimateFor('walk'), request: walkRequest, state })
}
const REAL = walkRoute({ status: 'ok', key: walkKey, route: REAL_WALK })
const LOADING = walkRoute({ status: 'loading', key: walkKey })
const failed = (reason: RouteFailureReason) => walkRoute({ status: 'unavailable', key: walkKey, reason })

function json(body: unknown) {
	return new Response(JSON.stringify(body), { status: 200 })
}

const statusProps = { onRetry: () => {}, locating: false, onLocate: () => {}, onPickOrigin: () => {} }

describe('walking request', () => {
	it('is requested between two real points, as walk', () => {
		expect(walkRequest).toEqual({
			mode: 'walk',
			origin: { lat: ORIGIN.lat, lng: ORIGIN.lng },
			destination: { lat: DESTINATION.lat, lng: DESTINATION.lng },
		})
		expect(walkKey.startsWith('walk:')).toBe(true)
	})

	it('the client and the endpoint agree on which modes are real', () => {
		expect([...REAL_ROUTED_MODES].sort()).toEqual([...REAL_ROUTING_MODES].sort())
		expect([...REAL_ROUTED_MODES].sort()).toEqual(['car', 'scooter', 'walk'])
	})

	it('never sends the approximate city centre — no request at all', () => {
		const centre = resolveRouteEndpoint('me', null)!
		expect(centre.approximate).toBe(true)
		expect(transportRouteRequest({ mode: 'walk', origin: centre, destination: DESTINATION })).toBeNull()
		expect(transportRouteRequest({ mode: 'walk', origin: ORIGIN, destination: centre })).toBeNull()
		const active = activeTransportRoute({
			mode: 'walk',
			estimate: estimateFor('walk'),
			request: null,
			state: { status: 'idle' },
		})
		expect(active).toEqual({ status: 'needs-location' })
		expect(activeFigures(active)).toBeNull()
		expect(routeLineKind(active)).toBe('none')
	})

	it('rejects invalid coordinates', () => {
		expect(
			transportRouteRequest({ mode: 'walk', origin: { ...ORIGIN, lat: Number.NaN }, destination: DESTINATION }),
		).toBeNull()
	})
})

describe('request count per selected mode against a mocked /api/directions', () => {
	it('car, walk and scooter request, metro does not; one walk identity is one request', async () => {
		const fetchImpl = vi.fn<typeof fetch>(async () => json(REAL_WALK))
		const loader = createRouteLoader({ fetch: fetchImpl })

		// Selecting each mode in turn: only the selected mode's request exists.
		const requests = Object.fromEntries(
			MODES.map(mode => [mode, transportRouteRequest({ mode, origin: ORIGIN, destination: DESTINATION })]),
		) as Record<TransportMode, ReturnType<typeof transportRouteRequest>>
		expect(requests.metro).toBeNull()
		expect(requests.scooter?.mode).toBe('scooter')
		expect(requests.car?.mode).toBe('car')
		expect(requests.walk?.mode).toBe('walk')
		// Car and walk between the same ends are different identities.
		expect(routeRequestKey(requests.car!)).not.toBe(routeRequestKey(requests.walk!))

		// StrictMode-style double subscription to the same walk: one request.
		await Promise.all([loader.load(walkRequest), loader.load({ ...walkRequest })])
		expect(fetchImpl).toHaveBeenCalledTimes(1)
		expect(JSON.parse(String(fetchImpl.mock.calls[0][1]?.body)).mode).toBe('walk')

		// retry(): exactly one more.
		await loader.load(walkRequest)
		expect(fetchImpl).toHaveBeenCalledTimes(2)
	})
})

describe('a successful walking route', () => {
	it('uses 2GIS’s distance, duration and geometry, and keeps the source', () => {
		expect(REAL.status).toBe('real')
		const figures = activeFigures(REAL)!
		expect(figures).toEqual({ source: '2gis', minutes: 41, distanceKm: 3.12 })
		// Not the straight line, not distance / 4.8 km/h.
		expect(figures.distanceKm).not.toBeCloseTo(haversineKm, 2)
		expect(figures.minutes).not.toBe(estimateMinutesForMode(haversineKm, 'walk'))
		expect(figures.minutes).not.toBe(Math.round((figures.distanceKm / 4.8) * 60))
		if (REAL.status === 'real') {
			expect(REAL.route.source).toBe('2gis')
			expect(REAL.route.geometry).toBe(REAL_WALK.geometry)
		}
	})

	it('draws one plain line: no demo traffic colours, problem pins or legend', () => {
		expect(routeLineKind(REAL)).toBe('real')
		expect(routeMapLayers({ showRoute: true, lineKind: 'real' })).toEqual({
			line: 'real',
			problemPins: false,
			trafficLegend: false,
		})
	})

	it('costs nothing — no walking value is invented from the real distance', () => {
		const figures = activeFigures(REAL)!
		expect(estimateFareUZS(figures.distanceKm, figures.minutes, 'walk')).toBe(0)
	})

	it('pill: walk is not approximate; unintegrated modes keep ≈', () => {
		const labels = modeDurationLabels({ active: REAL, selected: 'walk', estimatedMinutes })
		expect(labels.walk).toBe('41 daq')
		expect(labels.metro).toBe(`≈${estimatedMinutes.metro} daq`)
		expect(labels.scooter).toBe(`≈${estimatedMinutes.scooter} daq`)
		// Not fetched while walk is selected, so the car is an estimate.
		expect(labels.car).toBe(`≈${estimatedMinutes.car} daq`)
	})

	it('offers the existing 2GIS pedestrian hand-off beside the real route', () => {
		const href = externalNavigationHref({ origin: ORIGIN, destination: DESTINATION, mode: 'walk' })!
		expect(href).toContain('/rsType/pedestrian/')
		if (REAL.status !== 'real') throw new Error('expected real')
		const html = renderToStaticMarkup(
			createElement(RouteStatus, { mode: 'walk', route: REAL, navigateHref: href, ...statusProps }),
		)
		expect(html).toContain('2GIS marshruti')
		expect(html).toContain('41 daq · 3.1 km')
		expect(html).toContain('2GIS’da ochish')
		expect(html).toContain(`href="${href.replaceAll('&', '&amp;')}"`)
	})
})

describe('walking demo sections', () => {
	it('walking hides every walking demo extra', () => {
		expect(modeCapabilities('walk')).toEqual({
			realRoute: true,
			roadProblems: false,
			demoFacts: false,
			demoTimeline: false,
			demoTip: false,
			alternatives: 'hidden',
		})
	})

	it('the car keeps its Phase 1 sections; metro is unchanged', () => {
		expect(modeCapabilities('car')).toEqual({
			realRoute: true,
			roadProblems: true,
			demoFacts: true,
			demoTimeline: true,
			demoTip: true,
			alternatives: 'demo-labelled',
		})
		for (const mode of ['metro'] as const) {
			expect(modeCapabilities(mode)).toEqual({
				realRoute: false,
				roadProblems: true,
				demoFacts: true,
				demoTimeline: true,
				demoTip: true,
				alternatives: 'selectable',
			})
		}
	})

	it('the summary of a real walk shows 2GIS time and distance and no steps, kcal, path or crossings', () => {
		const figures = activeFigures(REAL)!
		const html = renderToStaticMarkup(
			createElement(RouteSummary, {
				mode: 'walk',
				minutes: figures.minutes,
				distanceKm: figures.distanceKm,
				costUZS: 0,
				costLabel: '',
				source: '2gis',
				facts: modeCapabilities('walk').demoFacts ? DEMO_ROUTE_FACTS.walk : [],
			}),
		)
		expect(html).toContain('41 daq')
		expect(html).toContain('3.1 km')
		expect(html).toContain('Vaqt va masofa — 2GIS marshruti.')
		expect(html).toContain('Bepul')
		for (const fake of ['Qadamlar', 'kkal', 'Piyodalar yo‘lagi', 'O‘tish joylari', 'Yoqilg‘i', 'namunaviy']) {
			expect(html).not.toContain(fake)
		}
	})
})

describe('a walking route that is loading', () => {
	it('has no figures and no line, and the pill shows no estimate', () => {
		expect(LOADING).toEqual({ status: 'loading' })
		expect(activeFigures(LOADING)).toBeNull()
		expect(routeLineKind(LOADING)).toBe('none')
		const labels = modeDurationLabels({ active: LOADING, selected: 'walk', estimatedMinutes })
		expect(labels.walk).toBe('…')
	})

	it('the status card and summary say nothing that looks like an answer', () => {
		const status = renderToStaticMarkup(
			createElement(RouteStatus, { mode: 'walk', route: { status: 'loading' }, navigateHref: null, ...statusProps }),
		)
		expect(status).toContain('Marshrut hisoblanmoqda')
		expect(status).not.toMatch(/\d+ (daq|km)/)
		const summary = renderToStaticMarkup(
			createElement(RouteSummary, {
				mode: 'walk',
				minutes: null,
				distanceKm: null,
				costUZS: null,
				costLabel: '',
				source: null,
				facts: [],
			}),
		)
		expect(summary).not.toMatch(/\d+ (daq|km)/)
		expect(summary).not.toContain('taxminiy')
	})
})

describe('a walking route that failed', () => {
	const href = externalNavigationHref({ origin: ORIGIN, destination: DESTINATION, mode: 'walk' })!
	const render = (reason: RouteFailureReason) => {
		const active = failed(reason)
		if (active.status !== 'unavailable') throw new Error('expected unavailable')
		return renderToStaticMarkup(
			createElement(RouteStatus, { mode: 'walk', route: active, navigateHref: href, ...statusProps }),
		)
	}

	it('draws no straight line in its place and shows no number', () => {
		for (const reason of ['config', 'invalid', 'timeout', 'upstream', 'no_route'] as const) {
			const active = failed(reason)
			expect(activeFigures(active)).toBeNull()
			expect(routeLineKind(active)).toBe('none')
			expect(modeDurationLabels({ active, selected: 'walk', estimatedMinutes }).walk).toBeNull()
		}
	})

	it('offers Qayta urinish for a retryable failure, and the 2GIS hand-off', () => {
		const html = render('timeout')
		expect(html).toContain('Qayta urinish')
		expect(html).toContain('2GIS’da ochish')
		expect(html).toContain('Piyoda marshruti ko‘rsatilmaydi')
	})

	it('does not offer retry for no_route, and names it as walking', () => {
		const html = render('no_route')
		expect(html).not.toContain('Qayta urinish')
		expect(html).toContain('Bu manzillar orasida piyoda marshruti topilmadi')
		expect(routeUnavailableMessage('no_route', 'car')).toBe('Bu manzillar orasida avtomobil marshruti topilmadi')
	})

	it('asks for a location, as walking, when the origin is not real', () => {
		const html = renderToStaticMarkup(
			createElement(RouteStatus, { mode: 'walk', route: { status: 'needs-location' }, navigateHref: null, ...statusProps }),
		)
		expect(html).toContain('Piyoda marshruti uchun joylashuv kerak')
	})
})

describe('AI tavsiyasi next to a real walking route', () => {
	const fastest = fastestMode(haversineKm, MODES)

	it('does not rank the real walk against estimates', () => {
		expect(transportRecommendation({ active: REAL, fastest })).toEqual({ kind: 'neutral', minutes: 41 })
		expect(transportRecommendation({ active: LOADING, fastest })).toEqual({ kind: 'neutral', minutes: null })
		expect(transportRecommendation({ active: failed('upstream'), fastest })).toEqual({ kind: 'neutral', minutes: null })
	})

	it('renders no "faster" claim and no switch button', () => {
		const html = renderToStaticMarkup(
			createElement(AiRecommendationCard, {
				currentMode: 'walk',
				recommendation: transportRecommendation({ active: REAL, fastest }),
				onSwitch: () => {},
			}),
		)
		expect(html).toContain('41 daq')
		expect(html).not.toContain('tezroq')
		expect(html).not.toContain('Almashtirish')
		expect(html).not.toContain('Eng yaxshi variant')
	})

	it('explains which number is 2GIS’s — the car’s wording is unchanged', () => {
		expect(neutralRecommendationReason('walk')).toMatch(/^Piyoda marshruti 2GIS orqali hisoblanadi, avto, metro va skuter vaqti esa/)
		expect(neutralRecommendationReason('car')).toBe(
			'Avtomobil marshruti 2GIS orqali hisoblanadi, metro, skuter va piyoda vaqti esa o‘rtacha shahar tezligiga asoslangan taxminiy hisob. Turli manbadagi raqamlarni solishtirib tavsiya berilmaydi.',
		)
	})
})
