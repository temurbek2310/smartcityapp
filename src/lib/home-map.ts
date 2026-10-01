import { Bike, Bus, TrainFront, TriangleAlert } from 'lucide-react'

import { distanceKm, type Coordinate } from '@/lib/geo'
import { buildMapObjects, type MapObject } from '@/lib/map-objects'
import { routeHref } from '@/lib/navigation'
import type { MapLayerState } from '@/lib/map-layers'
import type { Parking, PlaceCategory } from '@/lib/types'

export type MapLine = {
	id: string
	coordinates: [number, number][]
	color: string
	// Drawing order where lines overlap: higher is on top. Needed because a
	// changed line is re-created, and a new polyline otherwise lands above
	// the ones it should sit under.
	zIndex?: number
}

// Illustrative overlays from the City Goo reference; no live transit feed.
export const HOME_BIKE_LINES: MapLine[] = [{
	id: 'city-bike-lane', color: '#2e90fa',
	coordinates: [[69.2470, 41.3120], [69.2550, 41.3140], [69.2690, 41.3110]],
}]

const OVERLAYS: (MapObject & { layer: 'transit' | 'traffic' | 'bike' })[] = [
	{ kind: 'transit', id: 'metro', layer: 'transit', title: 'Mustaqillik metrosi',
		subtitle: 'Metro', address: 'Mustaqillik maydoni', meta: 'Namuna · poyezd 2 daqiqada',
		tag: 'Metro · 2 daq', lat: 41.3110, lng: 69.2690, distanceKm: 0,
		icon: TrainFront, symbol: 'metro', color: '#12b76a', href: routeHref({ mode: 'metro' }), parkingId: null },
	{ kind: 'transit', id: 'bus-72', layer: 'transit', title: '72-avtobus',
		subtitle: 'Avtobus', address: 'Amir Temur ko‘chasi', meta: 'Namuna · avtobus 4 daqiqada',
		tag: '№72 · 4 daq', lat: 41.3140, lng: 69.2850, distanceKm: 0,
		icon: Bus, color: '#2e90fa', href: routeHref({ mode: 'metro' }), parkingId: null },
	{ kind: 'traffic', id: 'nukus-traffic', layer: 'traffic', title: 'Nukus ko‘chasida tirbandlik',
		subtitle: 'Yo‘l holati', address: 'Nukus ko‘chasi', meta: 'Namuna · taxminan 7 daqiqa kechikish',
		tag: '+7 daq', lat: 41.3000, lng: 69.2800, distanceKm: 0,
		icon: TriangleAlert, color: '#f04438', href: '/news?tab=roads', parkingId: null },
	{ kind: 'bike', id: 'city-bike-lane', layer: 'bike', title: 'Tashkent City velo yo‘lagi',
		subtitle: 'Velosiped yo‘lagi', address: 'Tashkent City bog‘i', meta: 'Namuna · velosiped va skuter yo‘nalishi',
		tag: 'Velo yo‘lak', lat: 41.3140, lng: 69.2550, distanceKm: 0,
		icon: Bike, color: '#2e90fa', href: routeHref({ mode: 'scooter' }), parkingId: null },
]

export function buildHomeMapObjects({ parkings, layers, city, category, origin, favoritePlaceIds }: {
	parkings: Parking[]
	layers: MapLayerState
	city: string
	category: PlaceCategory
	origin: Coordinate
	favoritePlaceIds?: string[]
}) {
	const catalog = buildMapObjects({ parkings, city, placeCategory: category, origin })
		.filter(object => {
			if (object.kind === 'parking') return layers.parking
			if (object.kind === 'event') return layers.events
			// Favorites are scoped to the place catalog. Parking favorites are
			// already applied by the caller when it builds `parkings`; applying
			// place IDs to every map object would accidentally hide all parking
			// pins in the Favorites view.
			return !favoritePlaceIds || object.kind !== 'place' || favoritePlaceIds.includes(object.id)
		})
	const overlays = city === 'Toshkent'
		? OVERLAYS.filter(object => layers[object.layer]).map(object => ({
			...object, distanceKm: distanceKm(origin, object),
		})) : []
	return [...catalog, ...overlays]
}
