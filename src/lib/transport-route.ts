import type { RouteState } from '@/lib/route-client'
import {
	isRetryableFailure,
	realRouteRequest,
	type RealRoute,
	type RoutableEndpoint,
	type RouteFailureReason,
	type RouteRequest,
} from '@/lib/routing'
import type { TransportMode } from '@/lib/transport'

// Phase 1 of real routing on /transport: the car is routed by 2GIS, every
// other mode is still the haversine estimate from lib/eta.ts. The two are
// kept apart here — this module decides which one the screen is showing for
// the selected mode and never blends them into one number.

// Only the car is integrated. Metro, scooter and walking never reach
// /api/directions — not even to fill in their own pill — so the selected
// mode is the only thing ever fetched.
export const REAL_ROUTED_MODES: readonly TransportMode[] = ['car']

export function isRealRoutedMode(mode: TransportMode) {
	return REAL_ROUTED_MODES.includes(mode)
}

// The request /transport hands useRoute(): null unless the mode is routed
// for real *and* both ends are real points (see realRouteRequest — the
// approximate city centre never qualifies).
export function transportRouteRequest({
	mode,
	origin,
	destination,
}: {
	mode: TransportMode
	origin: RoutableEndpoint | null | undefined
	destination: RoutableEndpoint | null | undefined
}): RouteRequest | null {
	if (!isRealRoutedMode(mode)) return null
	return realRouteRequest({ origin, destination, mode })
}

// Minutes as the screen prints them. Never 0: a route that exists takes
// time, and "0 daq" reads as a bug.
export function routeMinutesFromSeconds(durationSeconds: number) {
	return Math.max(1, Math.round(durationSeconds / 60))
}

export function routeKmFromMeters(distanceMeters: number) {
	return distanceMeters / 1000
}

export type EstimatedFigures = { source: 'estimate'; minutes: number; distanceKm: number }
export type RealFigures = { source: '2gis'; minutes: number; distanceKm: number }

// What the screen shows for the *selected* mode.
//   estimate       — a mode that is not routed for real: lib/eta.ts as before
//   real           — 2GIS answered for this exact request
//   loading        — a real request is open; nothing is shown as its answer
//   unavailable    — 2GIS could not give a route; never replaced by the demo
//   needs-location — the car was asked for, but the origin (or destination)
//                    is not a real point, so nothing was requested
export type ActiveRoute =
	| { status: 'estimate'; figures: EstimatedFigures }
	| { status: 'real'; figures: RealFigures; route: RealRoute }
	| { status: 'loading' }
	| { status: 'unavailable'; reason: RouteFailureReason; retryable: boolean }
	| { status: 'needs-location' }

export function activeTransportRoute({
	mode,
	estimate,
	request,
	state,
}: {
	mode: TransportMode
	estimate: { minutes: number; distanceKm: number }
	request: RouteRequest | null
	state: RouteState
}): ActiveRoute {
	if (!isRealRoutedMode(mode)) {
		return { status: 'estimate', figures: { source: 'estimate', ...estimate } }
	}
	if (!request || state.status === 'idle') return { status: 'needs-location' }
	if (state.status === 'loading') return { status: 'loading' }
	if (state.status === 'unavailable') {
		return {
			status: 'unavailable',
			reason: state.reason,
			retryable: isRetryableFailure(state.reason),
		}
	}
	return {
		status: 'real',
		route: state.route,
		figures: {
			source: '2gis',
			minutes: routeMinutesFromSeconds(state.route.durationSeconds),
			distanceKm: routeKmFromMeters(state.route.distanceMeters),
		},
	}
}

// Minutes and kilometres for the selected mode, or null while there are
// none to show honestly (car loading, unavailable or waiting for a fix).
export function activeFigures(active: ActiveRoute): EstimatedFigures | RealFigures | null {
	return active.status === 'estimate' || active.status === 'real' ? active.figures : null
}

// The duration on each mode pill. A real duration is printed as it is; an
// estimate carries "≈" so the two never look alike in the same row. The
// selected car without a real answer shows no number at all rather than
// its old estimate — "…" while it is being fetched.
export function modeDurationLabels({
	active,
	selected,
	estimatedMinutes,
}: {
	active: ActiveRoute
	selected: TransportMode
	estimatedMinutes: Record<TransportMode, number>
}): Record<TransportMode, string | null> {
	const labels = {} as Record<TransportMode, string | null>
	for (const mode of Object.keys(estimatedMinutes) as TransportMode[]) {
		if (mode !== selected || active.status === 'estimate') {
			labels[mode] = `≈${estimatedMinutes[mode]} daq`
		} else if (active.status === 'real') {
			labels[mode] = `${active.figures.minutes} daq`
		} else if (active.status === 'loading') {
			labels[mode] = '…'
		} else {
			labels[mode] = null
		}
	}
	return labels
}

// «AI tavsiyasi». Ranking modes is only honest when every number in the
// ranking comes from the same source. The estimates rank against each
// other exactly as before; a real car route is never ranked against them,
// and neither is a car that has no answer yet.
export type TransportRecommendation =
	| {
			kind: 'ranked'
			currentMinutes: number
			fastestMode: TransportMode
			fastestMinutes: number
	  }
	| { kind: 'neutral'; minutes: number | null }

export function transportRecommendation({
	active,
	fastest,
}: {
	active: ActiveRoute
	fastest: { mode: TransportMode; minutes: number }
}): TransportRecommendation {
	if (active.status === 'estimate') {
		return {
			kind: 'ranked',
			currentMinutes: active.figures.minutes,
			fastestMode: fastest.mode,
			fastestMinutes: fastest.minutes,
		}
	}
	return {
		kind: 'neutral',
		minutes: active.status === 'real' ? active.figures.minutes : null,
	}
}

// What RouteMap draws. The demo line (straight, painted in illustrative
// traffic colours, with problem pins placed along it and the legend that
// explains the colours) belongs to estimated modes only. A real route is
// one plain line; a car still waiting for, or denied, a real route gets no
// line at all — never the demo line standing in for it.
export type RouteLineKind = 'demo' | 'real' | 'none'

export function routeMapLayers({
	showRoute,
	lineKind,
}: {
	showRoute: boolean
	lineKind: RouteLineKind
}) {
	const line: RouteLineKind = showRoute ? lineKind : 'none'
	return {
		line,
		problemPins: line === 'demo',
		trafficLegend: line === 'demo',
	}
}

export function routeLineKind(active: ActiveRoute): RouteLineKind {
	if (active.status === 'estimate') return 'demo'
	if (active.status === 'real') return 'real'
	return 'none'
}

// Customer-facing words for a car route that could not be had. Coarse on
// purpose: the reason decides the sentence and whether retrying is offered,
// never what the provider said.
export function routeUnavailableMessage(reason: RouteFailureReason) {
	if (reason === 'no_route') return 'Bu manzillar orasida avtomobil marshruti topilmadi'
	if (reason === 'config' || reason === 'invalid') return 'Marshrut hozircha mavjud emas'
	return 'Marshrutni yuklab bo‘lmadi'
}
