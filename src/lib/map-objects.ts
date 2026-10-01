import { CircleParking, MapPin, Ticket, type LucideIcon } from 'lucide-react'

import { EVENTS } from '@/data/events'
import { PLACES } from '@/data/places'
import { getQueueOrgByPlace } from '@/data/queue-orgs'
import { distanceKm, type Coordinate } from '@/lib/geo'
import { formatUZS } from '@/lib/format'
import type { Parking, PlaceCategory } from '@/lib/types'
import { searchMatches } from '@/lib/search'

// One list of everything the city map can plot. Each screen already owns its
// own catalog and its own sort; the map is the one surface that has to show
// them side by side, so the union lives here rather than inside the screen.

export type MapCatalogKind = 'place' | 'parking' | 'queue' | 'event'
export type MapObjectKind = MapCatalogKind | 'transit' | 'traffic' | 'bike'
export type MapSymbol = MapObjectKind | 'food' | 'shops' | 'health' | 'fun' | 'camera' | 'metro'

export type MapObject = {
	kind: MapObjectKind
	id: string
	title: string
	subtitle: string
	address: string
	// The one line under the title in the list and on the card.
	meta: string
	// The short pill on the pin, when the object has a number worth reading
	// from the map itself.
	tag: string | null
	lat: number
	lng: number
	distanceKm: number
	icon: LucideIcon
	// Hex, not a class: it is written straight onto a DOM marker the map
	// engine owns, which never sees Tailwind's stylesheet.
	color: string
	symbol?: MapSymbol
	// Where "Ochish" goes.
	href: string
	// The parking every object routes through — the app's rule that a demo
	// place's actions always land on a real lot.
	parkingId: string | null
}

export const MAP_CATEGORIES: { id: MapCatalogKind | 'all'; label: string }[] = [
	{ id: 'all', label: 'Barchasi' },
	{ id: 'place', label: 'Joylar' },
	{ id: 'parking', label: 'Parkinglar' },
	{ id: 'queue', label: 'Navbatlar' },
	{ id: 'event', label: 'Voqealar' },
]

const BRAND = '#6c47e0'
const EVENT = '#7c3aed'
const OK = '#12b76a'
const WARN = '#f79009'
const BAD = '#f04438'

// City Goo's freeColorHex(): ≥30% free reads comfortable, ≥15% tight.
function freeColor(percent: number) {
	if (percent >= 30) return OK
	if (percent >= 15) return WARN
	return BAD
}

function placeObjects(origin: Coordinate | undefined): MapObject[] {
	return PLACES.map(place => ({
		kind: 'place' as const,
		id: place.id,
		title: place.title,
		subtitle: place.subtitle,
		address: place.address,
		meta: `★ ${place.rating} · ${place.reviews} sharh · ${place.subtitle}`,
		tag: place.free != null ? `${place.free} joy` : null,
		lat: place.lat,
		lng: place.lng,
		distanceKm: origin
			? distanceKm(origin, { lat: place.lat, lng: place.lng })
			: place.distanceKm,
		icon: MapPin,
		color: BRAND,
		symbol: (['food', 'shops', 'health', 'fun'] as string[]).includes(place.category)
			? place.category as MapSymbol : 'place',
		href: `/home?place=${place.id}`,
		parkingId: place.parkingId ?? null,
	}))
}

function parkingObjects(
	parkings: Parking[],
	origin: Coordinate | undefined,
): MapObject[] {
	return parkings.map(parking => {
		const percent = parking.totalSpaces
			? Math.round((parking.availableSpaces / parking.totalSpaces) * 100)
			: 0

		return {
			kind: 'parking' as const,
			id: parking.id,
			title: parking.name,
			subtitle: 'Parking',
			address: parking.address,
			meta: `${parking.totalSpaces} dan ${parking.availableSpaces} bo‘sh · ${formatUZS(parking.pricePerHour)}/soat`,
			tag: parking.availableSpaces > 0 ? `${parking.availableSpaces} joy` : 'TO‘LA',
			lat: parking.lat,
			lng: parking.lng,
			distanceKm: origin ? distanceKm(origin, parking) : 0,
			icon: CircleParking,
			color: freeColor(percent),
			href: `/parking/${parking.id}`,
			parkingId: parking.id,
		}
	})
}

// Events have no address of their own — they borrow the venue's parking, the
// way City Goo's EV_GEO borrows the venue's coordinates.
function eventObjects(
	parkings: Parking[],
	origin: Coordinate | undefined,
): MapObject[] {
	return EVENTS.flatMap(event => {
		const parking = parkings.find(item => item.id === event.parkingId)
		if (!parking) return []

		return [
			{
				kind: 'event' as const,
				id: event.id,
				title: event.title,
				subtitle: event.category,
				address: event.place,
				meta: `${event.when}, ${event.time} · ${event.price}`,
				tag: event.time,
				// Nudged off the lot so the event pin and its parking pin do not
				// land on the same pixel.
				lat: parking.lat + 0.0016,
				lng: parking.lng + 0.0016,
				distanceKm: origin ? distanceKm(origin, parking) : 0,
				icon: Ticket,
				color: EVENT,
				href: `/home?event=${event.id}`,
				parkingId: parking.id,
			},
		]
	})
}

// A queue desk is a venue first (QueueOrg.placeId, 1:1), so it has no pin of
// its own — a second marker on the same spot was the same place drawn
// twice. «Navbatlar» is the places that keep a live queue.
export function inMapCategory(
	object: Pick<MapObject, 'kind' | 'id'>,
	category: MapCatalogKind | 'all',
) {
	if (category === 'all') return true
	if (category === 'queue')
		return object.kind === 'place' && Boolean(getQueueOrgByPlace(object.id))
	return object.kind === category
}

export function buildMapObjects({
	parkings,
	category = 'all',
	query = '',
	origin,
	city,
	placeCategory = 'all',
}: {
	parkings: Parking[]
	category?: MapCatalogKind | 'all'
	query?: string
	origin?: Coordinate
	city?: string
	placeCategory?: PlaceCategory
}): MapObject[] {
	const all = [
		...(category === 'all' || category === 'place' || category === 'queue'
			? placeObjects(origin).filter(object =>
				inMapCategory(object, category) &&
				(!city || city === 'Toshkent') && (placeCategory === 'all' ||
					PLACES.find(place => place.id === object.id)?.category === placeCategory))
			: []),
		...(category === 'all' || category === 'parking'
			? parkingObjects(parkings.filter(parking => !city || parking.city === city), origin)
			: []),
		...(category === 'all' || category === 'event'
			? eventObjects(parkings.filter(parking => !city || parking.city === city), origin)
			: []),
	]

	const needle = query.trim().toLowerCase()
	const matched = needle
		? all.filter(object =>
				searchMatches(`${object.title} ${object.address} ${object.subtitle}`, needle),
			)
		: all

	return matched.sort((a, b) => a.distanceKm - b.distanceKm)
}

export function mapObjectKey(object: Pick<MapObject, 'kind' | 'id'>) {
	return `${object.kind}:${object.id}`
}
