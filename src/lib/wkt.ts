// A small parser for the one WKT shape 2GIS's Routing API returns: a
// LINESTRING of "lon lat" pairs. No dependency needed for this — the format
// is fixed and simple enough to split by hand.
//
// Strict on purpose. Anything that is not a well-formed LINESTRING with at
// least two finite points returns null, never a partial or guessed line: a
// route drawn from half-read geometry would be worse than no route at all.
const LINESTRING = /^\s*LINESTRING\s*\(([^()]*)\)\s*$/i
const NUMBER = /^[+-]?(?:\d+\.?\d*|\.\d+)(?:e[+-]?\d+)?$/i

export function parseWktLineString(wkt: unknown): [number, number][] | null {
	if (typeof wkt !== 'string') return null
	const match = LINESTRING.exec(wkt)
	if (!match) return null

	const points: [number, number][] = []
	for (const pair of match[1].split(',')) {
		const parts = pair.trim().split(/\s+/)
		// Exactly "lon lat": a missing coordinate, a stray Z value or an
		// empty entry between two commas all make the geometry unreadable.
		if (parts.length !== 2 || !parts.every(part => NUMBER.test(part))) return null
		const [lon, lat] = parts.map(Number)
		if (!Number.isFinite(lon) || !Number.isFinite(lat)) return null
		if (lon < -180 || lon > 180 || lat < -90 || lat > 90) return null
		points.push([lon, lat])
	}

	// A LINESTRING is either empty or has at least two points.
	return points.length >= 2 ? points : null
}

// Joins consecutive segments into one line. 2GIS's segments usually share
// their joining point — the last point of one is the first of the next — and
// that duplicate is dropped. Segments that do not touch are kept whole
// rather than losing a real point.
export function joinLineSegments(segments: [number, number][][]): [number, number][] {
	const line: [number, number][] = []
	for (const segment of segments) {
		for (const point of segment) {
			const last = line[line.length - 1]
			if (last && last[0] === point[0] && last[1] === point[1]) continue
			line.push(point)
		}
	}
	return line
}
