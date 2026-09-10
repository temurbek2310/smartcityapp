'use client'

import { LocateFixed, Route as RouteIcon } from 'lucide-react'

import { ParkingMap } from '@/components/map/parking-map'
import type { Coordinate } from '@/lib/geo'
import type { Parking } from '@/lib/types'

type RouteMapProps = {
	origin: Coordinate
	locating: boolean
	onLocate: () => void
	destination: Parking
	showRoute: boolean
	onToggleRoute: () => void
}

// Reproduces City Goo's map card for the Transport screen using B SPACE's
// real MapLibre/OSM map (see components/map/parking-map.tsx) — no second
// map provider. Zoom controls come from MapLibre's own top-right
// NavigationControl, already built into ParkingMap.
export function RouteMap({
	origin,
	locating,
	onLocate,
	destination,
	showRoute,
	onToggleRoute,
}: RouteMapProps) {
	return (
		<div className='relative overflow-hidden rounded-[2rem] shadow-[0_1px_2px_rgba(16,24,40,.04),0_4px_14px_rgba(16,24,40,.06)]'>
			<ParkingMap
				parkings={[destination]}
				userLocation={origin}
				routeTo={showRoute ? { lat: destination.lat, lng: destination.lng } : undefined}
				className='h-64'
			/>

			<div className='absolute left-3 top-3 z-20 flex flex-col gap-2'>
				<button
					type='button'
					onClick={onToggleRoute}
					aria-label='Marshrut chizig‘ini ko‘rsatish/berkitish'
					className={`grid size-9 place-items-center rounded-xl shadow-[0_1px_2px_rgba(16,24,40,.04),0_4px_14px_rgba(16,24,40,.06)] ${
						showRoute ? 'bg-[#6c47e0] text-white' : 'bg-white text-slate-700'
					}`}
				>
					<RouteIcon className='size-4' />
				</button>
				<button
					type='button'
					onClick={onLocate}
					aria-label='Joylashuvimni aniqlash'
					className='grid size-9 place-items-center rounded-xl bg-white text-[#6c47e0] shadow-[0_1px_2px_rgba(16,24,40,.04),0_4px_14px_rgba(16,24,40,.06)]'
				>
					<LocateFixed className={`size-4 ${locating ? 'animate-pulse' : ''}`} />
				</button>
			</div>
		</div>
	)
}
