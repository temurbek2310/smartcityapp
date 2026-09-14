// A small parser for the one WKT shape 2GIS's Routing API returns: a
// LINESTRING of "lon lat" pairs. No dependency needed for this — the format
// is fixed and simple enough to split by hand.
export function parseWktLineString(wkt: string): [number, number][] {
	const match = /LINESTRING\s*\(([^)]*)\)/i.exec(wkt)
	if (!match) return []

	return match[1]
		.split(',')
		.map(pair => pair.trim())
		.filter(Boolean)
		.map(pair => {
			const [lon, lat] = pair.split(/\s+/).map(Number)
			return [lon, lat] as [number, number]
		})
}
