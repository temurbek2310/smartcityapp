import { getEvent } from '@/data/events'
import { getParking } from '@/data/parkings'
import { getPlace } from '@/data/places'
import { getQueueOrg } from '@/data/queue-orgs'
import { mapObjectKey } from '@/lib/map-objects'
import { isTransportMode, type TransportMode } from '@/lib/transport'
import type { SavedRoute } from '@/lib/types'

// One navigation system for the whole app.
//
// Every «Yo‘nalish» in B SPACE — a lot, a café, a queue desk, a table
// booking, a parking reservation — ends up here, turns whatever the customer
// was looking at into a single destination id, and opens the one route
// screen with it. Before this, each surface built its own link: a place
// routed to its car park, a queue routed to its car park, and /transport
// fell back to Magic City whenever a caller forgot to say where to.
//
// The id is mapObjectKey()'s 'kind:id' (or a saved landmark's own id), which
// is exactly what resolveRouteEndpoint() reads back into coordinates. Nothing
// here invents a destination: a reference that cannot be resolved returns
// null, and the caller is expected to ask rather than guess.

// Everything the app can name a destination by. Each case is a reference the
// caller already holds — never a coordinate, so no screen can route
// somewhere the catalogs do not actually contain.
export type DestinationSource =
	| { from: 'parking'; parkingId: string | null | undefined }
	| { from: 'place'; placeId: string | null | undefined }
	| { from: 'queueOrg'; orgId: string | null | undefined }
	| { from: 'event'; eventId: string | null | undefined }
	// A ServiceBooking's refId: a place for a table, a film or a clinic slot,
	// an event for a ticket. The booking itself does not record which.
	| { from: 'serviceBooking'; refId: string | null | undefined }
	// Already a map key ('place:coffee-lab'), from the map or the picker.
	| { from: 'mapObject'; key: string | null | undefined }

export function destinationIdFrom(source: DestinationSource): string | null {
	switch (source.from) {
		case 'parking':
			return source.parkingId && getParking(source.parkingId)
				? mapObjectKey({ kind: 'parking', id: source.parkingId })
				: null

		case 'place':
			return source.placeId && getPlace(source.placeId)
				? mapObjectKey({ kind: 'place', id: source.placeId })
				: null

		// A queue desk is a venue first: when it names a place in the catalog,
		// the route goes to that place, so «Coffee Lab navbati» and «Coffee
		// Lab» are the same destination. Desks with no place of their own —
		// the government offices — keep their own recorded position.
		case 'queueOrg': {
			const org = source.orgId ? getQueueOrg(source.orgId) : undefined
			if (!org) return null
			return (
				destinationIdFrom({ from: 'place', placeId: org.placeId }) ??
				mapObjectKey({ kind: 'queue', id: org.id })
			)
		}

		// An event's map pin is deliberately nudged off its venue so the two
		// markers do not land on the same pixel, so it is not a position to
		// drive to. The lot the event is anchored to is, and it is real.
		case 'event': {
			const event = source.eventId ? getEvent(source.eventId) : undefined
			return event
				? destinationIdFrom({ from: 'parking', parkingId: event.parkingId })
				: null
		}

		case 'serviceBooking':
			return (
				destinationIdFrom({ from: 'place', placeId: source.refId }) ??
				destinationIdFrom({ from: 'event', eventId: source.refId })
			)

		case 'mapObject':
			return source.key || null
	}
}

// --- The URL ------------------------------------------------------------
// One writer and one reader, so a link built on Home, in Bron or on the map
// is the same link, and refreshing or sharing it restores the same trip.
//
// The spellings are the ones already in the app: ?parkingId= for a lot,
// ?target= for anything else, ?mode= for the transport mode. ?from= is the
// origin, which only travels when it is something other than the live GPS.

const PARKING_PREFIX = 'parking:'

export type RouteParams = {
	mode: TransportMode | null
	// null means "nowhere chosen yet" — a real state the route screen has to
	// handle by asking, not by picking somewhere.
	destinationId: string | null
	originId: string | null
}

export function routeHref({
	destinationId,
	mode,
	originId,
}: {
	destinationId?: string | null
	mode?: TransportMode | null
	originId?: string | null
} = {}) {
	const query = new URLSearchParams()

	if (mode) query.set('mode', mode)

	if (destinationId?.startsWith(PARKING_PREFIX)) {
		query.set('parkingId', destinationId.slice(PARKING_PREFIX.length))
	} else if (destinationId) {
		query.set('target', destinationId)
	}

	// 'me' is the default, so writing it would only make the link longer.
	if (originId && originId !== 'me') query.set('from', originId)

	const search = query.toString()
	return search ? `/transport?${search}` : '/transport'
}

export function readRouteParams(params: {
	get: (key: string) => string | null
}): RouteParams {
	const mode = params.get('mode')
	const target = params.get('target')
	const parkingId = params.get('parkingId')

	return {
		mode: isTransportMode(mode) ? mode : null,
		destinationId: target || (parkingId ? `${PARKING_PREFIX}${parkingId}` : null),
		originId: params.get('from'),
	}
}

// «Qayta qurish» on a saved route: the same trip, to the same place. A route
// saved before destinationId existed only knows its parking, so that is the
// one case that still replays to a lot.
export function savedRouteHref(
	route: Pick<SavedRoute, 'mode' | 'destinationId' | 'originId' | 'parkingId'>,
) {
	return routeHref({
		mode: isTransportMode(route.mode) ? route.mode : null,
		destinationId:
			route.destinationId ??
			destinationIdFrom({ from: 'parking', parkingId: route.parkingId }),
		originId: route.originId,
	})
}
