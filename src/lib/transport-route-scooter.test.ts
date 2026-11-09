import { createElement } from 'react'
import { renderToStaticMarkup } from 'react-dom/server'
import { describe, expect, it, vi } from 'vitest'

import { AiRecommendationCard } from '@/components/transport/ai-recommendation-card'
import { PublicTransportSection } from '@/components/transport/public-transport-section'
import { RouteStatus } from '@/components/transport/route-status'
import { RouteSummary } from '@/components/transport/route-summary'
import {
	DEMO_ALTERNATIVE_ROUTES,
	DEMO_DRIVING_TIPS,
	DEMO_MICRO_OPTIONS,
	DEMO_ROUTE_FACTS,
	DEMO_ROUTE_TIMELINE,
} from '@/data/demo-transport'
import { destinationParkingFor } from '@/lib/destination-parking'
import { estimateFareUZS, estimateMinutesForMode, fastestMode } from '@/lib/eta'
import { distanceKm } from '@/lib/geo'
import { destinationIdFrom } from '@/lib/navigation'
import { createRouteLoader, type RouteState } from '@/lib/route-client'
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
	modeCapabilities,
	modeDurationLabels,
	routeLineKind,
	routeMapLayers,
	routeUnavailableMessage,
	transportRecommendation,
	transportRouteRequest,
	type ActiveRoute,
} from '@/lib/transport-route'
import type { TransportMode } from '@/lib/transport'

// Phase 3: the scooter routed by 2GIS. Every fetch here is a mock — nothing
// reaches /api/directions, let alone 2GIS.

// Magic City → Coffee Lab, the pair the feasibility check routed.
const ORIGIN: RoutableEndpoint = { lat: 41.2846, lng: 69.2215, kind: 'place', approximate: false }
const DESTINATION: RoutableEndpoint = { lat: 41.3105, lng: 69.2801, kind: 'place', approximate: false }
const MODES: TransportMode[] = ['car', 'metro', 'scooter', 'walk']

// A path that bends away from the straight line between the ends.
const REAL_SCOOTER: RealRoute = {
	status: 'ok',
	source: '2gis',
	mode: 'scooter',
	distanceMeters: 7314,
	durationSeconds: 2138,
	geometry: [[69.2215, 41.2846], [69.24, 41.29], [69.26, 41.3], [69.2801, 41.3105]],
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

const scooterRequest = transportRouteRequest({ mode: 'scooter', origin: ORIGIN, destination: DESTINATION })!
const scooterKey = routeRequestKey(scooterRequest)

function scooterRoute(state: RouteState): ActiveRoute {
	return activeTransportRoute({ mode: 'scooter', estimate: estimateFor('scooter'), request: scooterRequest, state })
}
const REAL = scooterRoute({ status: 'ok', key: scooterKey, route: REAL_SCOOTER })
const LOADING = scooterRoute({ status: 'loading', key: scooterKey })
const failed = (reason: RouteFailureReason) => scooterRoute({ status: 'unavailable', key: scooterKey, reason })

function json(body: unknown) {
	return new Response(JSON.stringify(body), { status: 200 })
}

const statusProps = { onRetry: () => {}, locating: false, onLocate: () => {}, onPickOrigin: () => {} }

// The words the scooter demo sections use — battery, bike-lane share,
// dangerous crossings — none of which 2GIS supplies.
const SCOOTER_DEMO_WORDS = ['zaryad', 'Velodoʻrajka', 'velo-yo‘lak', 'Xavfli', 'xavfsiz', 'Xavfsiz']

describe('scooter request', () => {
	it('is requested between two real points, as scooter', () => {
		expect(scooterRequest).toEqual({
			mode: 'scooter',
			origin: { lat: ORIGIN.lat, lng: ORIGIN.lng },
			destination: { lat: DESTINATION.lat, lng: DESTINATION.lng },
		})
		expect(scooterKey.startsWith('scooter:')).toBe(true)
	})

	it('sends a real GPS fix as the origin', () => {
		const me = resolveRouteEndpoint('me', { lat: 41.3, lng: 69.25 })!
		expect(transportRouteRequest({ mode: 'scooter', origin: me, destination: DESTINATION })?.mode).toBe('scooter')
	})

	it('never sends the approximate city centre — no request, an honest location-needed state', () => {
		const centre = resolveRouteEndpoint('me', null)!
		expect(centre.approximate).toBe(true)
		expect(transportRouteRequest({ mode: 'scooter', origin: centre, destination: DESTINATION })).toBeNull()
		expect(transportRouteRequest({ mode: 'scooter', origin: ORIGIN, destination: centre })).toBeNull()
		const active = activeTransportRoute({
			mode: 'scooter',
			estimate: estimateFor('scooter'),
			request: null,
			state: { status: 'idle' },
		})
		expect(active).toEqual({ status: 'needs-location' })
		expect(activeFigures(active)).toBeNull()
		expect(routeLineKind(active)).toBe('none')
		const html = renderToStaticMarkup(
			createElement(RouteStatus, { mode: 'scooter', route: { status: 'needs-location' }, navigateHref: null, ...statusProps }),
		)
		expect(html).toContain('Skuter marshruti uchun joylashuv kerak')
	})

	it('rejects invalid coordinates', () => {
		expect(
			transportRouteRequest({ mode: 'scooter', origin: { ...ORIGIN, lng: Number.NaN }, destination: DESTINATION }),
		).toBeNull()
	})
})

describe('request count per selected mode against a mocked /api/directions', () => {
	it('car, walk, scooter and metro each request as themselves', () => {
		const requests = Object.fromEntries(
			MODES.map(mode => [mode, transportRouteRequest({ mode, origin: ORIGIN, destination: DESTINATION })]),
		) as Record<TransportMode, ReturnType<typeof transportRouteRequest>>
		expect(requests.car?.mode).toBe('car')
		expect(requests.walk?.mode).toBe('walk')
		expect(requests.scooter?.mode).toBe('scooter')
		expect(requests.metro?.mode).toBe('metro')
		// Three routed modes between the same ends are three identities: no
		// mode's route is ever served from another's.
		const keys = new Set([requests.car!, requests.walk!, requests.scooter!].map(routeRequestKey))
		expect(keys.size).toBe(3)
	})

	it('one scooter identity is one request (StrictMode double subscription); retry is one more', async () => {
		const fetchImpl = vi.fn<typeof fetch>(async () => json(REAL_SCOOTER))
		const loader = createRouteLoader({ fetch: fetchImpl })

		const again = transportRouteRequest({
			mode: 'scooter',
			origin: { ...ORIGIN, lat: ORIGIN.lat + 0.000001 },
			destination: { ...DESTINATION },
		})!
		expect(routeRequestKey(again)).toBe(scooterKey)
		await Promise.all([loader.load(scooterRequest), loader.load(again)])
		expect(fetchImpl).toHaveBeenCalledTimes(1)
		expect(JSON.parse(String(fetchImpl.mock.calls[0][1]?.body)).mode).toBe('scooter')

		await loader.load(scooterRequest)
		expect(fetchImpl).toHaveBeenCalledTimes(2)
	})
})

describe('a successful scooter route', () => {
	it('uses 2GIS’s distance, duration and geometry, and keeps the source', () => {
		expect(REAL.status).toBe('real')
		const figures = activeFigures(REAL)!
		expect(figures).toEqual({ source: '2gis', minutes: 36, distanceKm: 7.314 })
		// Not the straight line, not distance / 21 km/h.
		expect(figures.distanceKm).not.toBeCloseTo(haversineKm, 2)
		expect(figures.minutes).not.toBe(estimateMinutesForMode(haversineKm, 'scooter'))
		expect(figures.minutes).not.toBe(Math.round((figures.distanceKm / 21) * 60))
		if (REAL.status === 'real') {
			expect(REAL.route.source).toBe('2gis')
			expect(REAL.route.mode).toBe('scooter')
			expect(REAL.route.geometry).toBe(REAL_SCOOTER.geometry)
		}
	})

	it('never prints 0 daq for a very short route', () => {
		const short = scooterRoute({
			status: 'ok',
			key: scooterKey,
			route: { ...REAL_SCOOTER, distanceMeters: 40, durationSeconds: 12 },
		})
		expect(activeFigures(short)!.minutes).toBe(1)
	})

	it('draws one plain line: no demo traffic colours, problem pins or legend', () => {
		expect(routeLineKind(REAL)).toBe('real')
		expect(routeMapLayers({ showRoute: true, lineKind: 'real' })).toEqual({
			line: 'real',
			problemPins: false,
			trafficLegend: false,
		})
		expect(modeCapabilities('scooter').roadProblems).toBe(false)
	})

	it('pill: scooter is not approximate; unselected metro keeps ≈', () => {
		const labels = modeDurationLabels({ active: REAL, selected: 'scooter', estimatedMinutes })
		expect(labels.scooter).toBe('36 daq')
		expect(labels.metro).toBe(`≈${estimatedMinutes.metro} daq`)
		// Not fetched while scooter is selected, so these are estimates.
		expect(labels.car).toBe(`≈${estimatedMinutes.car} daq`)
		expect(labels.walk).toBe(`≈${estimatedMinutes.walk} daq`)
	})

	it('has no 2GIS hand-off, so the status card names the route and offers no button', () => {
		const href = externalNavigationHref({ origin: ORIGIN, destination: DESTINATION, mode: 'scooter' })
		expect(href).toBeNull()
		if (REAL.status !== 'real') throw new Error('expected real')
		const html = renderToStaticMarkup(
			createElement(RouteStatus, { mode: 'scooter', route: REAL, navigateHref: href, ...statusProps }),
		)
		expect(html).toContain('2GIS marshruti')
		expect(html).toContain('36 daq · 7.3 km')
		expect(html).not.toContain('2GIS’da ochish')
		expect(html).not.toContain('<a')
	})
})

describe('scooter demo sections', () => {
	it('the demo tables do hold battery, bike-lane and crossing claims (what is being hidden)', () => {
		const demo = JSON.stringify([
			DEMO_ROUTE_FACTS.scooter.map(({ label, value, sublabel, explain }) => ({ label, value, sublabel, explain })),
			DEMO_DRIVING_TIPS.scooter,
			DEMO_ROUTE_TIMELINE.scooter.map(({ title, subtitle, note }) => ({ title, subtitle, note })),
			DEMO_ALTERNATIVE_ROUTES.scooter,
		])
		expect(demo).toContain('zaryad')
		expect(demo).toContain('90%')
		expect(demo).toContain('Xavfli')
	})

	it('the scooter hides every demo extra: facts, tip, timeline and its navigator, alternatives, road chips', () => {
		expect(modeCapabilities('scooter')).toEqual({
			realRoute: true,
			roadProblems: false,
			demoFacts: false,
			demoTimeline: false,
			demoTip: false,
			alternatives: 'hidden',
		})
	})

	it('the summary of a real scooter route shows 2GIS time and distance, no battery or lane share, and an honestly labelled fare', () => {
		const figures = activeFigures(REAL)!
		const cost = estimateFareUZS(figures.distanceKm, figures.minutes, 'scooter')
		const html = renderToStaticMarkup(
			createElement(RouteSummary, {
				mode: 'scooter',
				minutes: figures.minutes,
				distanceKm: figures.distanceKm,
				costUZS: cost,
				costLabel: 'ijara',
				source: '2gis',
				facts: modeCapabilities('scooter').demoFacts ? DEMO_ROUTE_FACTS.scooter : [],
			}),
		)
		expect(html).toContain('36 daq')
		expect(html).toContain('7.3 km')
		expect(html).toContain('Vaqt va masofa — 2GIS marshruti.')
		// SmartCity's unlock + per-minute estimate, fed with the 2GIS duration,
		// said to be an estimate and not an operator's fare.
		expect(cost).toBe(1_800 + 36 * 230)
		expect(html).toContain('≈')
		expect(html).toContain('Ijara narxi shu vaqtga asoslangan SmartCity taxminiy hisobi, operator tarifi emas.')
		for (const fake of [...SCOOTER_DEMO_WORDS, 'Skuter zaryadi', '75%', '90%', 'namunaviy']) {
			expect(html).not.toContain(fake)
		}
	})

	it('the car’s summary footer is unchanged by the scooter fare line', () => {
		const html = renderToStaticMarkup(
			createElement(RouteSummary, {
				mode: 'car',
				minutes: 19,
				distanceKm: 8.35,
				costUZS: 9_000,
				costLabel: 'yoqilg‘i',
				source: '2gis',
				facts: [],
			}),
		)
		expect(html).toContain('Yoqilg‘i narxi shu masofaga asoslangan SmartCity taxminiy hisobi.')
		expect(html).not.toContain('Ijara narxi')
	})
})

describe('a scooter route that is loading', () => {
	it('has no figures and no line, and the pill shows no 21 km/h estimate', () => {
		expect(LOADING).toEqual({ status: 'loading' })
		expect(activeFigures(LOADING)).toBeNull()
		expect(routeLineKind(LOADING)).toBe('none')
		const labels = modeDurationLabels({ active: LOADING, selected: 'scooter', estimatedMinutes })
		expect(labels.scooter).toBe('…')
	})

	it('the status card says nothing that looks like an answer', () => {
		const html = renderToStaticMarkup(
			createElement(RouteStatus, { mode: 'scooter', route: { status: 'loading' }, navigateHref: null, ...statusProps }),
		)
		expect(html).toContain('Marshrut hisoblanmoqda')
		expect(html).not.toMatch(/\d+ (daq|km)/)
	})
})

describe('a scooter route that failed', () => {
	const render = (reason: RouteFailureReason) => {
		const active = failed(reason)
		if (active.status !== 'unavailable') throw new Error('expected unavailable')
		return renderToStaticMarkup(
			createElement(RouteStatus, { mode: 'scooter', route: active, navigateHref: null, ...statusProps }),
		)
	}

	it('draws no straight line in its place and shows no number', () => {
		for (const reason of ['config', 'invalid', 'timeout', 'upstream', 'no_route'] as const) {
			const active = failed(reason)
			expect(activeFigures(active)).toBeNull()
			expect(routeLineKind(active)).toBe('none')
			expect(modeDurationLabels({ active, selected: 'scooter', estimatedMinutes }).scooter).toBeNull()
			expect(render(reason)).not.toContain('2GIS’da ochish')
		}
	})

	it('offers Qayta urinish for a retryable failure', () => {
		for (const reason of ['timeout', 'upstream'] as const) {
			const html = render(reason)
			expect(html).toContain('Qayta urinish')
			expect(html).toContain('Skuter marshruti ko‘rsatilmaydi')
		}
	})

	it('does not offer retry for no_route, config or invalid, and names no_route as the scooter', () => {
		for (const reason of ['no_route', 'config', 'invalid'] as const) {
			expect(render(reason)).not.toContain('Qayta urinish')
		}
		expect(routeUnavailableMessage('no_route', 'scooter')).toBe('Bu manzillar orasida skuter marshruti topilmadi')
	})
})

describe('no safety claim anywhere a scooter route is described', () => {
	it('the status, summary and AI texts avoid safe / stair-free / guaranteed wording', () => {
		if (REAL.status !== 'real') throw new Error('expected real')
		const figures = activeFigures(REAL)!
		const texts = [
			renderToStaticMarkup(createElement(RouteStatus, { mode: 'scooter', route: REAL, navigateHref: null, ...statusProps })),
			renderToStaticMarkup(
				createElement(RouteSummary, {
					mode: 'scooter',
					minutes: figures.minutes,
					distanceKm: figures.distanceKm,
					costUZS: 0,
					costLabel: 'ijara',
					source: '2gis',
					facts: [],
				}),
			),
			renderToStaticMarkup(
				createElement(AiRecommendationCard, {
					currentMode: 'scooter',
					recommendation: transportRecommendation({ active: REAL, fastest: fastestMode(haversineKm, MODES) }),
					onSwitch: () => {},
				}),
			),
		].join(' ')
		for (const word of ['xavfsiz', 'Xavfsiz', 'zinapoya', 'Zinapoya', 'Stairsiz', 'kafolat', 'velo', 'Velo']) {
			expect(texts).not.toContain(word)
		}
	})
})

describe('AI tavsiyasi next to a real scooter route', () => {
	const fastest = fastestMode(haversineKm, MODES)

	it('does not rank the real scooter against the metro estimate', () => {
		expect(transportRecommendation({ active: REAL, fastest })).toEqual({ kind: 'neutral', minutes: 36 })
		expect(transportRecommendation({ active: LOADING, fastest })).toEqual({ kind: 'neutral', minutes: null })
		expect(transportRecommendation({ active: failed('timeout'), fastest })).toEqual({ kind: 'neutral', minutes: null })
	})

	it('renders no "faster" claim and no switch button', () => {
		const html = renderToStaticMarkup(
			createElement(AiRecommendationCard, {
				currentMode: 'scooter',
				recommendation: transportRecommendation({ active: REAL, fastest }),
				onSwitch: () => {},
			}),
		)
		expect(html).toContain('36 daq')
		expect(html).not.toContain('tezroq')
		expect(html).not.toContain('Metro tezroq')
		expect(html).not.toContain('Almashtirish')
		expect(html).not.toContain('Eng yaxshi variant')
	})

	it('metro is no longer an estimate, so it is not ranked either', () => {
		const metro = activeTransportRoute({ mode: 'metro', estimate: estimateFor('metro'), request: null, state: { status: 'idle' } })
		expect(transportRecommendation({ active: metro, fastest }).kind).toBe('neutral')
	})
})

describe('nearby parking with the scooter', () => {
	it('offers no nearby parking for a place destination', () => {
		const place = resolveRouteEndpoint(destinationIdFrom({ from: 'place', placeId: 'coffee-lab' })!, null)!
		expect(place.kind).toBe('place')
		expect(destinationParkingFor({ destination: place, mode: 'scooter', reservations: [] })).toBeNull()
		// The car still gets its suggestion for the same place.
		expect(destinationParkingFor({ destination: place, mode: 'car', reservations: [] })).not.toBeNull()
	})

	it('a parking destination stays the destination, and is routed to its own coordinate', () => {
		const lot = resolveRouteEndpoint(destinationIdFrom({ from: 'parking', parkingId: 'magic-city' })!, null)!
		expect(lot.kind).toBe('parking')
		const suggestion = destinationParkingFor({ destination: lot, mode: 'scooter', reservations: [] })
		expect(suggestion?.kind).toBe('destination')
		expect(suggestion?.parking.id).toBe('magic-city')
		const request = transportRouteRequest({ mode: 'scooter', origin: ORIGIN, destination: lot })!
		expect(request.destination).toEqual({ lat: lot.lat, lng: lot.lng })
	})
})

describe('Mikromobillik: no fake operator data next to a real scooter route', () => {
	const html = renderToStaticMarkup(
		createElement(PublicTransportSection, { microOptions: DEMO_MICRO_OPTIONS }),
	)

	it('shows no charge level, nearest-vehicle distance, free docks, lane share, shade or path condition', () => {
		for (const fake of ['Zaryad', 'zaryad', 'Eng yaqin punkt', 'Ijara punkti', 'bo‘sh joy', 'velo-yo‘lak', 'soyada', 'Yo‘lak yaxshi holatda', '%']) {
			expect(html).not.toContain(fake)
		}
		// A distance to a vehicle — not the word «metro» in the section's footer.
		expect(html).not.toMatch(/\d+\s*metr\b/)
	})

	it('still lists the options themselves, and generic walking information', () => {
		expect(html).toContain('Elektro skuter')
		expect(html).toContain('Velosiped')
		expect(html).toContain('Piyoda')
		expect(html).toContain('Qo‘shimcha ijaraga hojat yo‘q')
	})
})
