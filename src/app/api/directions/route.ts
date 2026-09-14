import { NextResponse } from 'next/server'
import { z } from 'zod'

import { parseWktLineString } from '@/lib/wkt'

// 2GIS's Routing API is a separate product from MapGL JS — its own REST
// endpoint, called server-side only so its key never reaches the browser and
// so we don't have to think about CORS on a POST-with-body third-party call.
const ROUTING_ENDPOINT = 'https://routing.api.2gis.com/routing/7.0.0/global'

const coordinateSchema = z.object({
	lat: z.number().min(-90).max(90),
	lng: z.number().min(-180).max(180),
})

const requestSchema = z.object({
	origin: coordinateSchema,
	destination: coordinateSchema,
})

type TwoGisGeometry = { selection: string }
type TwoGisManeuver = {
	outcoming_path?: { geometry: TwoGisGeometry[] }
}
type TwoGisRoute = {
	total_distance: number
	total_duration: number
	begin_pedestrian_path?: { geometry: TwoGisGeometry }
	end_pedestrian_path?: { geometry: TwoGisGeometry }
	maneuvers: TwoGisManeuver[]
}
type TwoGisResponse = { result?: TwoGisRoute[] }

// Concatenates every geometry segment 2GIS returns, in order: the pedestrian
// connector from the exact origin to the nearest road, each maneuver's
// road-following segments, then the connector to the exact destination.
// Consecutive segments share their joining point, so every segment after the
// first drops its own first point to avoid a duplicate.
function collectRouteCoordinates(route: TwoGisRoute): [number, number][] {
	const segments: string[] = []

	if (route.begin_pedestrian_path) {
		segments.push(route.begin_pedestrian_path.geometry.selection)
	}
	for (const maneuver of route.maneuvers) {
		if (!maneuver.outcoming_path) continue
		for (const geometry of maneuver.outcoming_path.geometry) {
			segments.push(geometry.selection)
		}
	}
	if (route.end_pedestrian_path) {
		segments.push(route.end_pedestrian_path.geometry.selection)
	}

	const coordinates: [number, number][] = []
	for (const wkt of segments) {
		const points = parseWktLineString(wkt)
		const start = coordinates.length > 0 ? 1 : 0
		coordinates.push(...points.slice(start))
	}
	return coordinates
}

export async function POST(request: Request) {
	const key = process.env.MAPGL_ROUTING_API_KEY
	if (!key) {
		return NextResponse.json(
			{ error: 'MAPGL_ROUTING_API_KEY is not configured' },
			{ status: 500 },
		)
	}

	const body = await request.json().catch(() => null)
	const parsed = requestSchema.safeParse(body)
	if (!parsed.success) {
		return NextResponse.json({ error: 'Invalid request body' }, { status: 400 })
	}

	const { origin, destination } = parsed.data

	let response: Response
	try {
		response = await fetch(`${ROUTING_ENDPOINT}?key=${key}`, {
			method: 'POST',
			headers: { 'Content-Type': 'application/json' },
			body: JSON.stringify({
				points: [
					{ type: 'stop', lon: origin.lng, lat: origin.lat },
					{ type: 'stop', lon: destination.lng, lat: destination.lat },
				],
				transport: 'driving',
				route_mode: 'fastest',
			}),
		})
	} catch {
		return NextResponse.json({ error: 'Routing request failed' }, { status: 502 })
	}

	if (!response.ok) {
		// Most likely cause: the demo key isn't authorized for the Routing
		// product even though it works for MapGL rendering — a 401/403 here
		// means a routing-enabled key is needed, not a code bug.
		return NextResponse.json(
			{ error: `2GIS routing responded ${response.status}` },
			{ status: 502 },
		)
	}

	const data: TwoGisResponse = await response.json().catch(() => ({}))
	const route = data.result?.[0]
	if (!route) {
		return NextResponse.json({ error: 'No route found' }, { status: 404 })
	}

	const coordinates = collectRouteCoordinates(route).map(([lon, lat]) => ({
		lat,
		lng: lon,
	}))

	return NextResponse.json({
		distanceMeters: route.total_distance,
		durationSeconds: route.total_duration,
		coordinates,
	})
}
