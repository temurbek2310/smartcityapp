import { UZBEKISTAN_BOUNDS, type Coordinate } from '@/lib/geo'
import type { MapLine } from '@/lib/home-map'

// Pure camera and overlay maths for CityMap, kept out of the component so it
// can be tested without a map engine.

export type LngLatBounds = {
	southWest: [number, number]
	northEast: [number, number]
}

// Where the camera should go to show a set of points.
//   bounds — fit these (padding and max zoom are the map's business)
//   point  — everything is one spot; centre on it at the map's close zoom
export type CameraFrame =
	| { kind: 'bounds'; bounds: LngLatBounds }
	| { kind: 'point'; center: Coordinate }

function clamp(value: number, min: number, max: number) {
	return Math.min(max, Math.max(min, value))
}

// The map cannot pan outside Uzbekistan (its maxBounds), so neither can a
// frame: a stray point outside the country is pulled to the border rather
// than stretching the fit towards somewhere the camera may not go.
function clampToUzbekistan({ lat, lng }: Coordinate): Coordinate {
	return {
		lat: clamp(lat, UZBEKISTAN_BOUNDS.south, UZBEKISTAN_BOUNDS.north),
		lng: clamp(lng, UZBEKISTAN_BOUNDS.west, UZBEKISTAN_BOUNDS.east),
	}
}

export function boundsOfPoints(points: Coordinate[]): LngLatBounds | null {
	const usable = points.filter(point => Number.isFinite(point.lat) && Number.isFinite(point.lng))
	if (usable.length === 0) return null
	let south = Infinity, north = -Infinity, west = Infinity, east = -Infinity
	for (const point of usable.map(clampToUzbekistan)) {
		south = Math.min(south, point.lat)
		north = Math.max(north, point.lat)
		west = Math.min(west, point.lng)
		east = Math.max(east, point.lng)
	}
	return { southWest: [west, south], northEast: [east, north] }
}

// MapLine coordinates are [lng, lat].
export function lineCoordinatesAsPoints(lines: Pick<MapLine, 'coordinates'>[]): Coordinate[] {
	return lines.flatMap(line => line.coordinates.map(([lng, lat]) => ({ lat, lng })))
}

// Everything a route view has to keep on screen: the whole line — including
// where a real road route bulges away from the straight path between its
// ends — and both ends themselves, whether or not a line is drawn. No spread
// limit: a Tashkent → Samarkand route is framed like any other.
export function routeFrame({
	origin,
	destination,
	lines = [],
}: {
	origin?: Coordinate | null
	destination?: Coordinate | null
	lines?: Pick<MapLine, 'coordinates'>[]
}): CameraFrame | null {
	const points = [
		...(origin ? [origin] : []),
		...(destination ? [destination] : []),
		...lineCoordinatesAsPoints(lines),
	]
	const bounds = boundsOfPoints(points)
	if (!bounds) return null
	const [west, south] = bounds.southWest
	const [east, north] = bounds.northEast
	// Closer than ~10 m in both directions: there is nothing to fit.
	if (north - south < 1e-4 && east - west < 1e-4) {
		return { kind: 'point', center: { lat: (north + south) / 2, lng: (east + west) / 2 } }
	}
	return { kind: 'bounds', bounds }
}

// A stable string for a frame, so the map refits when — and only when — what
// it has to show actually changed.
export function cameraFrameKey(frame: CameraFrame | null) {
	if (!frame) return ''
	const n = (value: number) => value.toFixed(5)
	return frame.kind === 'point'
		? `p:${n(frame.center.lat)},${n(frame.center.lng)}`
		: `b:${frame.bounds.southWest.map(n).join(',')}:${frame.bounds.northEast.map(n).join(',')}`
}

// --- Overlay line updates ------------------------------------------------------
// 2GIS Polylines cannot be edited after creation, so a line whose geometry or
// style changed is replaced. The signature is everything that is drawn: the
// same id with new coordinates or a new colour is a different line on screen.
export function mapLineSignature(line: MapLine) {
	return `${line.color}|${line.coordinates.map(([lng, lat]) => `${lng},${lat}`).join(';')}`
}

// What to change to go from the lines on the map (id → signature) to `next`:
// ids to destroy — gone, or changed — and lines to create — new, or changed.
// Unchanged lines are left alone so nothing flickers.
export function diffMapLines(current: ReadonlyMap<string, string>, next: MapLine[]) {
	const nextById = new Map(next.map(line => [line.id, line]))
	const remove: string[] = []
	const add: MapLine[] = []
	for (const [id, signature] of current) {
		const line = nextById.get(id)
		if (!line || mapLineSignature(line) !== signature) remove.push(id)
	}
	for (const line of nextById.values()) {
		if (current.get(line.id) !== mapLineSignature(line)) add.push(line)
	}
	return { remove, add }
}
