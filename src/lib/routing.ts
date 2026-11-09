import { isInsideUzbekistan, type Coordinate } from '@/lib/geo'
import type { RouteEndpoint } from '@/lib/route-endpoints'
import type { TransportMode } from '@/lib/transport'

// The one route contract SmartCity speaks. Whatever answers a route request —
// today 2GIS's Routing API behind /api/directions — is normalized into this
// shape on the server, so no screen ever reads a provider's raw payload.
//
// A line, a distance and a duration, plus what 2GIS computed alongside the
// primary route: its other routes, its turn-by-turn maneuvers and its
// per-segment traffic — and, for public transport, the journey's legs.

// The modes /api/directions routes for real — every mode SmartCity offers.
// Car, walking and the scooter go through 2GIS's Routing API
// (lib/two-gis-routing.ts); metro is public transport and goes through its
// own Public Transport API (lib/two-gis-transit.ts). Nothing is estimated.
export const REAL_ROUTING_MODES = ['car', 'walk', 'scooter', 'metro'] as const satisfies readonly TransportMode[]
export type RealRoutingMode = (typeof REAL_ROUTING_MODES)[number]

export function isRealRoutingMode(mode: TransportMode): mode is RealRoutingMode {
	return (REAL_ROUTING_MODES as readonly TransportMode[]).includes(mode)
}

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
	// The provider's other routes between the same points, in its order.
	// Each is whole or absent — an alternative whose line did not parse is
	// dropped, never drawn partially.
	alternatives: RouteAlternative[]
	// The primary route's maneuvers, start to finish.
	maneuvers: RouteManeuver[]
	// The primary route's congestion, in driving order, each stretch with its
	// own line so the map can paint it where it is. Empty when 2GIS reports
	// none (walking and scooter routes carry no traffic).
	traffic: TrafficSegment[]
	// Public transport only: the journey as 2GIS planned it, leg by leg, in
	// travel order — walk to the stop, ride, change, walk to the door. The
	// legs are whole or the route is not a route: a journey missing one of
	// its legs is never shown.
	transitLegs?: TransitLeg[]
}

// --- Public transport legs --------------------------------------------------
//   walk     — on foot, to the first stop, out of the last one, or between
//   ride     — on board a line (a metro line, a bus route, …)
//   transfer — on foot between two platforms while changing lines
export const TRANSIT_LEG_TYPES = ['walk', 'ride', 'transfer'] as const
export type TransitLegType = (typeof TRANSIT_LEG_TYPES)[number]

// SmartCity's own vehicle vocabulary; 2GIS's subtypes are mapped into it on
// the server (lib/two-gis-transit.ts). 'other' is a vehicle 2GIS named that
// this app has no word for — kept, never guessed.
export const TRANSIT_VEHICLES = ['metro', 'bus', 'trolleybus', 'tram', 'shuttle', 'other'] as const
export type TransitVehicle = (typeof TRANSIT_VEHICLES)[number]

const TRANSIT_VEHICLE_LABEL: Record<TransitVehicle, string> = {
	metro: 'Metro',
	bus: 'Avtobus',
	trolleybus: 'Trolleybus',
	tram: 'Tramvay',
	shuttle: 'Marshrutka',
	other: 'Transport',
}

export function transitVehicleLabel(vehicle: TransitVehicle) {
	return TRANSIT_VEHICLE_LABEL[vehicle]
}

export type TransitLineInfo = {
	vehicle: TransitVehicle
	// The line as 2GIS names it — a metro line's name, a bus route's number.
	name: string
	// The line's own colour when 2GIS gives one (metro lines do), as #rrggbb.
	color: string | null
}

export type TransitLeg = {
	type: TransitLegType
	// On board plus waiting at the stop, for a ride.
	durationSeconds: number
	distanceMeters: number
	geometry: RouteCoordinate[]
	// A ride's line; null for a walk or transfer.
	lineInfo: TransitLineInfo | null
	// A ride's boarding and alighting stops, as 2GIS names them.
	fromStop: string | null
	toStop: string | null
	// Stops ridden, when 2GIS lists them.
	stopCount: number | null
}

export type RouteAlternative = {
	distanceMeters: number
	durationSeconds: number
	geometry: RouteCoordinate[]
}

// SmartCity's own maneuver vocabulary. The provider's icon names are mapped
// into it on the server (lib/two-gis-routing.ts); its own comment text is
// English and never shown.
export const MANEUVER_TYPES = [
	'start',
	'straight',
	'slight-left',
	'left',
	'sharp-left',
	'keep-left',
	'slight-right',
	'right',
	'sharp-right',
	'keep-right',
	'u-turn',
	'roundabout',
	'continue',
	'finish',
] as const
export type ManeuverType = (typeof MANEUVER_TYPES)[number]

// 'continue' is a maneuver 2GIS named with an icon this app does not know:
// it is kept (its distance is real) but claims no direction.
const MANEUVER_INSTRUCTION: Record<ManeuverType, string> = {
	start: 'Yo‘lga chiqing',
	straight: 'To‘g‘riga yuring',
	'slight-left': 'Biroz chapga buriling',
	left: 'Chapga buriling',
	'sharp-left': 'Keskin chapga buriling',
	'keep-left': 'Chap tomonda qoling',
	'slight-right': 'Biroz o‘ngga buriling',
	right: 'O‘ngga buriling',
	'sharp-right': 'Keskin o‘ngga buriling',
	'keep-right': 'O‘ng tomonda qoling',
	'u-turn': 'Ortga qayriling',
	roundabout: 'Aylanma harakatga kiring',
	continue: 'Yo‘lda davom eting',
	finish: 'Manzilga yetib keldingiz',
}

export function maneuverInstruction(type: ManeuverType) {
	return MANEUVER_INSTRUCTION[type]
}

export type RouteManeuver = {
	type: ManeuverType
	instruction: string
	// How far the road runs after this maneuver, to the next one. 0 at the
	// finish.
	distanceMeters: number
}

export const TRAFFIC_SPEEDS = ['fast', 'normal', 'slow', 'jam'] as const
export type TrafficSpeed = (typeof TRAFFIC_SPEEDS)[number]

export type TrafficSegment = {
	speed: TrafficSpeed
	distanceMeters: number
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

// One of the provider's routes promoted to the one the screen shows. Index 0
// is the primary route itself; any other index is that alternative, still a
// 2GIS route — its line, distance and duration replace the primary's whole.
// The maneuvers and traffic describe the primary line only, so they do not
// travel with an alternative. An index with no alternative is the primary.
export function routeVariant(route: RealRoute, index: number): RealRoute {
	const alternative = index > 0 ? route.alternatives[index - 1] : undefined
	if (!alternative) return route
	return {
		...route,
		distanceMeters: alternative.distanceMeters,
		durationSeconds: alternative.durationSeconds,
		geometry: alternative.geometry,
		maneuvers: [],
		traffic: [],
		transitLegs: undefined,
	}
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

function isNonNegativeNumber(value: unknown): value is number {
	return typeof value === 'number' && Number.isFinite(value) && value >= 0
}

function isRouteLine(value: unknown): value is RouteCoordinate[] {
	return Array.isArray(value) && value.length >= 2 && value.every(isCoordinatePair)
}

// The extras are read item by item: a malformed item is dropped on its own,
// and a missing list is an empty one. The primary route itself is still
// all-or-nothing.
function listOf<T>(value: unknown, read: (item: Record<string, unknown>) => T | null): T[] {
	if (!Array.isArray(value)) return []
	const items: T[] = []
	for (const item of value) {
		if (!item || typeof item !== 'object') continue
		const parsed = read(item as Record<string, unknown>)
		if (parsed) items.push(parsed)
	}
	return items
}

function readAlternative(item: Record<string, unknown>): RouteAlternative | null {
	if (!isNonNegativeNumber(item.distanceMeters) || !isNonNegativeNumber(item.durationSeconds)) return null
	if (!isRouteLine(item.geometry)) return null
	return {
		distanceMeters: item.distanceMeters,
		durationSeconds: item.durationSeconds,
		geometry: item.geometry,
	}
}

// The instruction is re-derived from the type rather than trusted off the
// wire, so the screen only ever prints SmartCity's own Uzbek sentences.
function readManeuver(item: Record<string, unknown>): RouteManeuver | null {
	if (!MANEUVER_TYPES.includes(item.type as ManeuverType)) return null
	if (!isNonNegativeNumber(item.distanceMeters)) return null
	const type = item.type as ManeuverType
	return { type, instruction: maneuverInstruction(type), distanceMeters: item.distanceMeters }
}

function readTrafficSegment(item: Record<string, unknown>): TrafficSegment | null {
	if (!TRAFFIC_SPEEDS.includes(item.speed as TrafficSpeed)) return null
	if (!isNonNegativeNumber(item.distanceMeters)) return null
	if (!isRouteLine(item.geometry)) return null
	return { speed: item.speed as TrafficSpeed, distanceMeters: item.distanceMeters, geometry: item.geometry }
}

function isStopName(value: unknown): value is string {
	return typeof value === 'string' && value.trim().length > 0
}

export const HEX_COLOR = /^#[0-9a-f]{6}$/i

function readLineInfo(value: unknown): TransitLineInfo | null {
	if (!value || typeof value !== 'object') return null
	const line = value as Record<string, unknown>
	if (!TRANSIT_VEHICLES.includes(line.vehicle as TransitVehicle)) return null
	if (typeof line.name !== 'string') return null
	const color = typeof line.color === 'string' && HEX_COLOR.test(line.color) ? line.color : null
	return { vehicle: line.vehicle as TransitVehicle, name: line.name, color }
}

function readTransitLeg(item: unknown): TransitLeg | null {
	if (!item || typeof item !== 'object') return null
	const leg = item as Record<string, unknown>
	if (!TRANSIT_LEG_TYPES.includes(leg.type as TransitLegType)) return null
	if (!isNonNegativeNumber(leg.durationSeconds) || !isNonNegativeNumber(leg.distanceMeters)) return null
	if (!isRouteLine(leg.geometry)) return null
	const type = leg.type as TransitLegType
	const lineInfo = type === 'ride' ? readLineInfo(leg.lineInfo) : null
	// A ride without its line is not a ride anybody could take.
	if (type === 'ride' && !lineInfo) return null
	return {
		type,
		durationSeconds: leg.durationSeconds,
		distanceMeters: leg.distanceMeters,
		geometry: leg.geometry,
		lineInfo,
		fromStop: isStopName(leg.fromStop) ? leg.fromStop : null,
		toStop: isStopName(leg.toStop) ? leg.toStop : null,
		stopCount: isNonNegativeNumber(leg.stopCount) && Number.isInteger(leg.stopCount) ? leg.stopCount : null,
	}
}

// Unlike the other extras, the legs are all-or-nothing: one unreadable leg
// makes the whole list unreadable. Absent is undefined; present-but-broken
// is null.
function readTransitLegs(value: unknown): TransitLeg[] | null | undefined {
	if (value === undefined) return undefined
	if (!Array.isArray(value) || value.length === 0) return null
	const legs: TransitLeg[] = []
	for (const item of value) {
		const leg = readTransitLeg(item)
		if (!leg) return null
		legs.push(leg)
	}
	return legs.some(leg => leg.type === 'ride') ? legs : null
}

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
		isNonNegativeNumber(body.distanceMeters) &&
		isNonNegativeNumber(body.durationSeconds) &&
		isRouteLine(body.geometry)
	) {
		// A public transport route is its legs; without them it is not one.
		const transitLegs = readTransitLegs(body.transitLegs)
		if (transitLegs === null) return routeUnavailable('upstream')
		if (body.mode === 'metro' && !transitLegs) return routeUnavailable('upstream')
		return {
			status: 'ok',
			source: '2gis',
			mode: body.mode as TransportMode,
			distanceMeters: body.distanceMeters,
			durationSeconds: body.durationSeconds,
			geometry: body.geometry,
			alternatives: listOf(body.alternatives, readAlternative),
			maneuvers: listOf(body.maneuvers, readManeuver),
			traffic: listOf(body.traffic, readTrafficSegment),
			...(transitLegs ? { transitLegs } : {}),
		}
	}

	return routeUnavailable('upstream')
}
