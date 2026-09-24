'use client'

import {
	Camera,
	CircleDot,
	Construction,
	LocateFixed,
	Route as RouteIcon,
	TriangleAlert,
	type LucideIcon,
} from 'lucide-react'

import { useMemo } from 'react'
import { CityMap } from '@/components/map/city-map'
import { cn } from '@/lib/cn'
import type { MapObject } from '@/lib/map-objects'
import type { MapLine } from '@/lib/home-map'
import type { RouteEndpoint } from '@/lib/route-endpoints'

// What City Goo pins on the route: the things that will slow you down, each
// tappable for the reason. They sit on the card rather than on the map itself
// because the map engine owns marker placement and these have no coordinates
// of their own — they describe the route, not a point on it.
export type RouteProblem = {
	id: string
	icon: LucideIcon
	label: string
	title: string
	detail: string
	tone: 'warn' | 'bad' | 'info'
}

export const ROUTE_PROBLEMS: RouteProblem[] = [
	{
		id: 'roadworks',
		icon: Construction,
		label: 'Ta’mir',
		title: 'Yo‘l ta’miri',
		detail:
			'Bunyodkor ko‘chasi bir qatorgacha torayadi. Ishlar 30-maygacha — taxminan 3 daqiqa kechikish.',
		tone: 'warn',
	},
	{
		id: 'crash',
		icon: TriangleAlert,
		label: 'HTH',
		title: 'Yo‘l-transport hodisasi',
		detail:
			'Chorrahada ikki avtomobil to‘qnashgan. O‘ng qator yopiq, xizmatlar yetib keldi — taxminan 6 daqiqa kechikish.',
		tone: 'bad',
	},
	{
		id: 'camera',
		icon: Camera,
		label: 'Kamera',
		title: 'Tezlik kamerasi',
		detail: 'Ushbu qismda tezlik chegarasi 60 km/soat. Kamera ikki tomonga ishlaydi.',
		tone: 'info',
	},
]

const TONES: Record<RouteProblem['tone'], string> = {
	warn: 'bg-warn-bg text-warn',
	bad: 'bg-bad-bg text-bad',
	info: 'bg-info-bg text-info',
}

// Colours the route line is drawn in along its length — City Goo's legend
// for how good each stretch is.
const LEGEND: { label: string; tone: string }[] = [
	{ label: 'Erkin', tone: 'bg-ok' },
	{ label: 'Sekin', tone: 'bg-warn' },
	{ label: 'Tirband', tone: 'bg-bad' },
]

type RouteMapProps = {
	origin: RouteEndpoint
	locating: boolean
	locateRevision: number
	onLocate: () => void
	destination: RouteEndpoint
	showRoute: boolean
	onToggleRoute: () => void
	onOpenProblem: (problem: RouteProblem) => void
}

// Reproduces City Goo's map card for the Transport screen using B SPACE's
// real 2GIS-powered map (see components/map/city-map.tsx) — no second map
// provider. CityMap disables 2GIS's default zoom buttons consistently with
// the other maps in the app.
export function RouteMap({
	origin,
	locating,
	locateRevision,
	onLocate,
	destination,
	showRoute,
	onToggleRoute,
	onOpenProblem,
}: RouteMapProps) {
	const isGpsOrigin = origin.kind === 'me' && !origin.approximate
	const { objects, lines } = useMemo(() => {
		const pointAt = (fraction: number) => ({
			lat: origin.lat + (destination.lat - origin.lat) * fraction,
			lng: origin.lng + (destination.lng - origin.lng) * fraction,
		})
		const destinationPin: MapObject = {
			...destination, kind: 'place', subtitle: 'Manzil', meta: destination.address,
			tag: destination.title, distanceKm: 0, icon: RouteIcon,
			color: '#6c47e0', href: '',
		}
		const problems: MapObject[] = showRoute ? ROUTE_PROBLEMS.map((problem, index) => ({
			...pointAt((index + 1) / 4), id: problem.id, kind: 'traffic',
			title: problem.title, subtitle: 'Namunaviy yo‘l holati', address: '',
			meta: problem.detail, tag: problem.label, distanceKm: 0,
			icon: problem.icon, symbol: problem.id === 'camera' ? 'camera' : 'traffic',
			color: { warn: '#f79009', bad: '#f04438', info: '#2e90fa' }[problem.tone],
			href: '', parkingId: null,
		})) : []
		const routeLines: MapLine[] = showRoute
			? ['#12b76a', '#f79009', '#f04438', '#12b76a'].map((color, index) => {
				const from = pointAt(index / 4), to = pointAt((index + 1) / 4)
				return { id: `route-${index}`, color,
					coordinates: [[from.lng, from.lat], [to.lng, to.lat]] }
			}) : []
		// The blue dot is the customer, so it is drawn for a GPS fix only. Any
		// other start — a picked place, or the approximate city centre the
		// demo route begins at without a fix — is a plain pin saying what it is.
		const originPin: MapObject[] = isGpsOrigin ? [] : [{
			...origin, kind: 'place', subtitle: 'Boshlanish', meta: origin.address,
			tag: origin.approximate ? 'Toshkent markazi — taxminiy' : origin.title,
			distanceKm: 0, icon: CircleDot, color: '#667085', href: '',
		}]
		return { objects: [...problems, ...originPin, destinationPin], lines: routeLines }
	}, [origin, destination, showRoute, isGpsOrigin])

	return (
		<div className='overflow-hidden rounded-[2rem] bg-card shadow-card'>
			<div className='relative'>
				<CityMap
					objects={objects}
					userLocation={isGpsOrigin ? origin : undefined}
					lines={lines}
					viewportKey={`${origin.lat},${origin.lng}:${destination.lat},${destination.lng}`}
					locateRevision={locateRevision}
					onSelect={object => {
						const problem = ROUTE_PROBLEMS.find(item => item.id === object.id)
						if (problem) onOpenProblem(problem)
					}}
					className='h-64'
				/>

				<div className='absolute left-3 top-3 z-20 flex flex-col gap-2'>
					<button
						type='button'
						onClick={onToggleRoute}
						aria-label='Marshrut chizig‘ini ko‘rsatish/berkitish'
						className={cn(
							'citygo-pressable grid size-9 place-items-center rounded-xl shadow-card',
							showRoute ? 'bg-brand text-white' : 'bg-white text-ink-2',
						)}
					>
						<RouteIcon className='size-4' />
					</button>
					<button
						type='button'
						onClick={onLocate}
						aria-label='Joylashuvimni aniqlash'
						className='citygo-pressable grid size-9 place-items-center rounded-xl bg-white text-brand shadow-card'
					>
						<LocateFixed className={cn('size-4', locating && 'citygo-refresh-spinner is-refreshing')} />
					</button>
				</div>

				{showRoute && (
					<div className='pointer-events-none absolute bottom-3 left-3 z-20 flex gap-2.5 rounded-[9px] bg-white/95 px-2.5 py-1.5 shadow-card'>
						{LEGEND.map(item => (
							<span
								key={item.label}
								className='flex items-center gap-1.5 text-[10.5px] font-semibold text-ink-2'
							>
								<i className={cn('h-1 w-4 rounded-full', item.tone)} />
								{item.label}
							</span>
						))}
					</div>
				)}
			</div>

			<div className='flex gap-2 p-2.5'>
				{ROUTE_PROBLEMS.map(problem => (
					<button
						key={problem.id}
						type='button'
						onClick={() => onOpenProblem(problem)}
						className='flex flex-1 items-center justify-center gap-1.5 rounded-xl bg-card-2 px-2 py-2 text-[11.5px] font-bold text-ink-2'
					>
						<span
							className={cn(
								'grid size-6 shrink-0 place-items-center rounded-lg',
								TONES[problem.tone],
							)}
						>
							<problem.icon className='size-3.5' />
						</span>
						{problem.label}
					</button>
				))}
			</div>
			<p className='px-3 pb-3 text-[10.5px] leading-4 text-ink-3'>
				Namunaviy yo‘nalish va yo‘l holati. Yo‘l bo‘ylab navigatsiya uchun 2GISni oching.
			</p>
		</div>
	)
}
