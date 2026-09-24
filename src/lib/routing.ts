import { isInsideUzbekistan, type Coordinate } from '@/lib/geo'
import type { RouteEndpoint } from '@/lib/route-endpoints'
import type { TransportMode } from '@/lib/transport'

// The one route contract B SPACE speaks. Whatever answers a route request —
// today 2GIS's Routing API behind /api/directions — is normalized into this
// shape on the server, so no screen ever reads a provider's raw payload.
//
// Deliberately small: a line, a distance and a duration. No steps, no
// alternatives, no traffic segments, no transit legs — each of those arrives
// with the phase that actually renders it.

// [lng, lat] — the order MapLine.coordinates and 2GIS both use.
export type RouteCoordinate = [number, number]

export type RouteRequest = {
	origin: Coordinate
	destination: Coordinate
	mode: TransportMode
}

// Why no route is shown. Kept coarse on purpose: a customer is told the same
// thing for all of them, and none of them carries the provider's own error
// text, which is neither translated nor safe to echo.
//   invalid  — the request itself was refused (bad shape, outside Uzbekistan)
//   config   — the server has no routing key
//   timeout  — the provider did not answer in time
//   upstream — the provider failed, or answered with something unreadable
//   no_route — the provider answered, and there is no route between the points
export type RouteFailureReason =
	| 'invalid'
	| 'config'
	| 'timeout'
	| 'upstream'
	| 'no_route'

export const ROUTE_FAILURE_REASONS: readonly RouteFailureReason[] = [
	'invalid',
	'config',
	'timeout',
	'upstream',
	'no_route',
]

// A route the provider actually computed. `source` is part of the type, not a
// label bolted on later: only a 2GIS answer can be a RealRoute, so nothing
// estimated in the app can ever be passed where a real route is expected.
export type RealRoute = {
	status: 'ok'
	source: '2gis'
	mode: TransportMode
	distanceMeters: number
	durationSeconds: number
	geometry: RouteCoordinate[]
}

export type RouteUnavailable = {
	status: 'unavailable'
	reason: RouteFailureReason
}

export type RouteResult = RealRoute | RouteUnavailable

export function routeUnavailable(reason: RouteFailureReason): RouteUnavailable {
	return { status: 'unavailable', reason }
}

// Whether trying the same request again could plausibly give a different
// answer. A refused request or a missing key will not fix itself on retry.
export function isRetryableFailure(reason: RouteFailureReason) {
	return reason === 'timeout' || reason === 'upstream'
}

// --- No silent fake fallback ----------------------------------------------
// The demo route on /transport — a straight line, haversine distance, a
// per-mode speed — is an *estimate*, and stays a separate concept. Once a
// screen presents a route as real, a 2GIS failure must surface as a failure:
// the only geometry these helpers ever hand back is geometry 2GIS returned.
// There is intentionally no function here that turns an unavailable result
// into a straight line.
export function isRealRoute(result: RouteResult | null | undefined): result is RealRoute {
	return result?.status === 'ok' && result.source === '2gis'
}

export function realRouteGeometry(result: RouteResult | null | undefined): RouteCoordinate[] | null {
	return isRealRoute(result) ? result.geometry : null
}

// --- Request identity -----------------------------------------------------
// Five decimal places is ~1.1 m on the ground: finer than any road decision,
// coarser than the jitter a phone's GPS produces between two reads of the
// same spot. Every request is rounded before it is keyed *and* before it is
// sent, so the key always describes exactly the request that went out.
const COORDINATE_DECIMALS = 5
const COORDINATE_SCALE = 10 ** COORDINATE_DECIMALS

export function normalizeCoordinateValue(value: number) {
	// `|| 0` folds -0 into 0 so a point on the rounding boundary keys once.
	return Math.round(value * COORDINATE_SCALE) / COORDINATE_SCALE || 0
}

export function normalizeCoordinate({ lat, lng }: Coordinate): Coordinate {
	return { lat: normalizeCoordinateValue(lat), lng: normalizeCoordinateValue(lng) }
}

export function normalizeRouteRequest(request: RouteRequest): RouteRequest {
	return {
		origin: normalizeCoordinate(request.origin),
		destination: normalizeCoordinate(request.destination),
		mode: request.mode,
	}
}

// Deterministic identity for a route request: mode, then origin, then
// destination. Suitable as a dedup or cache key; direction matters, so A→B
// and B→A are different routes.
export function routeRequestKey(request: RouteRequest) {
	const { origin, destination, mode } = normalizeRouteRequest(request)
	const point = ({ lat, lng }: Coordinate) =>
		`${lat.toFixed(COORDINATE_DECIMALS)},${lng.toFixed(COORDINATE_DECIMALS)}`
	return `${mode}:${point(origin)}>${point(destination)}`
}

// --- Which endpoints may reach a routing provider -------------------------
// 'me' without a GPS fix resolves to the approximate Tashkent centre so the
// demo estimate has somewhere to start. That point is not where anybody is,
// and it must never become a real route's origin (or destination): a real
// route from the city centre would be a confident answer to a question
// nobody asked. Same rule externalNavigationOrigin() applies to the 2GIS
// hand-off link.
export type RoutableEndpoint = Coordinate & Pick<RouteEndpoint, 'kind' | 'approximate'>

export function canRequestRealRoute(endpoint: RoutableEndpoint | null | undefined): boolean {
	if (!endpoint) return false
	if (endpoint.approximate) return false
	if (!Number.isFinite(endpoint.lat) || !Number.isFinite(endpoint.lng)) return false
	return isInsideUzbekistan(endpoint)
}

// The request a real route would be built from, or null when either end is
// not a real point. Callers that get null keep showing the estimate — or,
// once a real route has been promised, say that one is not available.
export function realRouteRequest({
	origin,
	destination,
	mode,
}: {
	origin: RoutableEndpoint | null | undefined
	destination: RoutableEndpoint | null | undefined
	mode: TransportMode
}): RouteRequest | null {
	if (!origin || !destination) return null
	if (!canRequestRealRoute(origin) || !canRequestRealRoute(destination)) return null
	return normalizeRouteRequest({
		origin: { lat: origin.lat, lng: origin.lng },
		destination: { lat: destination.lat, lng: destination.lng },
		mode,
	})
}

// --- Reading a result off the wire -----------------------------------------
// The browser's side of the contract: /api/directions answers with a
// RouteResult, and anything that is not one — an HTML error page, a proxy's
// body, a truncated response — is treated as an upstream failure rather than
// trusted.
function isCoordinatePair(value: unknown): value is RouteCoordinate {
	return (
		Array.isArray(value) &&
		value.length === 2 &&
		Number.isFinite(value[0]) &&
		Number.isFinite(value[1])
	)
}

const MODES: readonly TransportMode[] = ['car', 'metro', 'scooter', 'walk']

export function parseRouteResult(value: unknown): RouteResult {
	if (!value || typeof value !== 'object') return routeUnavailable('upstream')
	const body = value as Record<string, unknown>

	if (body.status === 'unavailable') {
		return ROUTE_FAILURE_REASONS.includes(body.reason as RouteFailureReason)
			? routeUnavailable(body.reason as RouteFailureReason)
			: routeUnavailable('upstream')
	}

	if (
		body.status === 'ok' &&
		body.source === '2gis' &&
		MODES.includes(body.mode as TransportMode) &&
		typeof body.distanceMeters === 'number' &&
		Number.isFinite(body.distanceMeters) &&
		body.distanceMeters >= 0 &&
		typeof body.durationSeconds === 'number' &&
		Number.isFinite(body.durationSeconds) &&
		body.durationSeconds >= 0 &&
		Array.isArray(body.geometry) &&
		body.geometry.length >= 2 &&
		body.geometry.every(isCoordinatePair)
	) {
		return {
			status: 'ok',
			source: '2gis',
			mode: body.mode as TransportMode,
			distanceMeters: body.distanceMeters,
			durationSeconds: body.durationSeconds,
			geometry: body.geometry as RouteCoordinate[],
		}
	}

	return routeUnavailable('upstream')
}
