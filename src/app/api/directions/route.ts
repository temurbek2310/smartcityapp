import { NextResponse } from 'next/server'

import { routeUnavailable, type RouteFailureReason, type RouteResult } from '@/lib/routing'
import {
	isRoadRoutingMode,
	normalizeTwoGisResponse,
	parseDirectionsRequest,
	ROUTING_TIMEOUT_MS,
	TWO_GIS_ROUTING_ENDPOINT,
	twoGisRoutingBody,
} from '@/lib/two-gis-routing'
import {
	normalizeTwoGisTransitResponse,
	TWO_GIS_TRANSIT_ENDPOINT,
	twoGisTransitBody,
} from '@/lib/two-gis-transit'

// Car, walking, scooter and public transport routes from 2GIS, normalized
// into SmartCity's RouteResult. The road modes go to the Routing API; metro
// goes to the Public Transport API through its own adapter — one key, two
// products, never one payload read as the other.
// Server-side only: the routing key lives in DGIS_ROUTING_API_KEY, which —
// having no NEXT_PUBLIC_ prefix — is never inlined into a browser bundle. The browser's
// MapGL key (NEXT_PUBLIC_MAPGL_API_KEY) is a different credential for a
// different product and is never used here.
//
// Every answer is a RouteResult, success or not. The provider's own error
// bodies, status text and request URL (which carries the key) never leave
// this handler and are never logged.

// A route request is two coordinates; anything bigger is not one.
const MAX_REQUEST_BYTES = 1024

const FAILURE_STATUS: Record<RouteFailureReason, number> = {
	invalid: 400,
	config: 503,
	timeout: 504,
	upstream: 502,
	no_route: 404,
}

function respond(result: RouteResult, status?: number) {
	return NextResponse.json(result, {
		status: status ?? (result.status === 'ok' ? 200 : FAILURE_STATUS[result.reason]),
		// A route depends on live traffic; nothing between here and the
		// screen should keep a copy.
		headers: { 'Cache-Control': 'no-store' },
	})
}

// Only the reason and, where there is one, the provider's HTTP status — never
// the URL, the key or the provider's body.
function logFailure(reason: RouteFailureReason, upstreamStatus?: number) {
	console.warn(
		`[directions] route unavailable: ${reason}${upstreamStatus ? ` (upstream HTTP ${upstreamStatus})` : ''}`,
	)
}

let warnedSharedKey = false

export async function POST(request: Request) {
	// Browsers label every fetch with where it came from. A page on another
	// site calling this endpoint is refused outright; this is a light
	// same-app guard, not authentication — a non-browser client can omit the
	// header, which is why the request itself is validated as strictly below.
	if (request.headers.get('sec-fetch-site') === 'cross-site') {
		return respond(routeUnavailable('invalid'), 403)
	}

	const key = process.env.DGIS_ROUTING_API_KEY
	if (!key) {
		logFailure('config')
		return respond(routeUnavailable('config'))
	}
	if (!warnedSharedKey && key === process.env.NEXT_PUBLIC_MAPGL_API_KEY) {
		warnedSharedKey = true
		console.warn(
			'[directions] DGIS_ROUTING_API_KEY is the same value as NEXT_PUBLIC_MAPGL_API_KEY, ' +
				'which is shipped to every browser. Use a separate routing key.',
		)
	}

	const text = await request.text().catch(() => null)
	if (text === null || text.length > MAX_REQUEST_BYTES) {
		return respond(routeUnavailable('invalid'))
	}
	let body: unknown
	try {
		body = JSON.parse(text)
	} catch {
		return respond(routeUnavailable('invalid'))
	}
	const routeRequest = parseDirectionsRequest(body)
	if (!routeRequest) return respond(routeUnavailable('invalid'))

	const upstreamCall = isRoadRoutingMode(routeRequest.mode)
		? {
				endpoint: TWO_GIS_ROUTING_ENDPOINT,
				body: twoGisRoutingBody({ ...routeRequest, mode: routeRequest.mode }),
				normalize: (data: unknown) => normalizeTwoGisResponse(data, routeRequest),
			}
		: {
				endpoint: TWO_GIS_TRANSIT_ENDPOINT,
				body: twoGisTransitBody(routeRequest),
				normalize: (data: unknown) => normalizeTwoGisTransitResponse(data, routeRequest),
			}

	// One signal for both ways the upstream call can end early: the timeout,
	// and the customer's own request going away (they changed the route, or
	// left the screen), which is no reason to keep paying for the answer.
	const upstream = new AbortController()
	let timedOut = false
	const timer = setTimeout(() => {
		timedOut = true
		upstream.abort()
	}, ROUTING_TIMEOUT_MS)
	const cancel = () => upstream.abort()
	if (request.signal.aborted) cancel()
	else request.signal.addEventListener('abort', cancel, { once: true })

	try {
		let response: Response
		try {
			response = await fetch(`${upstreamCall.endpoint}?key=${encodeURIComponent(key)}`, {
				method: 'POST',
				headers: { 'Content-Type': 'application/json' },
				body: JSON.stringify(upstreamCall.body),
				signal: upstream.signal,
				cache: 'no-store',
			})
		} catch {
			const reason = timedOut ? 'timeout' : 'upstream'
			if (!request.signal.aborted) logFailure(reason)
			return respond(routeUnavailable(reason))
		}

		// 204: 2GIS found nothing to say — no route between these points.
		if (response.status === 204) return respond(routeUnavailable('no_route'))

		if (!response.ok) {
			// A 401/403 most likely means the key is not authorized for the
			// Routing product (a MapGL-only key), not a code bug.
			logFailure('upstream', response.status)
			return respond(routeUnavailable('upstream'))
		}

		let data: unknown
		try {
			data = await response.json()
		} catch {
			const reason = timedOut ? 'timeout' : 'upstream'
			logFailure(reason)
			return respond(routeUnavailable(reason))
		}

		const result = upstreamCall.normalize(data)
		if (result.status !== 'ok' && result.reason !== 'no_route') logFailure(result.reason)
		return respond(result)
	} finally {
		clearTimeout(timer)
		request.signal.removeEventListener('abort', cancel)
	}
}
