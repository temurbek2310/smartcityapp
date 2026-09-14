'use client'

import {
	CircleParking,
	ExternalLink,
	LocateFixed,
	Navigation,
	QrCode,
} from 'lucide-react'
import { notFound, useParams, useRouter } from 'next/navigation'
import { useEffect, useRef, useState } from 'react'

import { ParkingMap } from '@/components/map/parking-map'
import { AppBar } from '@/components/ui/app-bar'
import { Button } from '@/components/ui/button'
import { Card } from '@/components/ui/card'
import { IconTile } from '@/components/ui/icon-tile'
import { useApp } from '@/context/app-context'
import { getParking } from '@/data/parkings'
import { cn } from '@/lib/cn'
import { formatDistance, formatUZS } from '@/lib/format'
import type { Coordinate } from '@/lib/geo'
import { distanceKm } from '@/lib/geo'
import { useUserLocation } from '@/lib/use-user-location'

type RouteState = {
	status: 'idle' | 'ready' | 'error'
	distanceMeters?: number
	durationSeconds?: number
	coordinates?: Coordinate[]
}

export default function NavigatePage() {
	const params = useParams<{ kind: string; id: string }>()
	const router = useRouter()
	const { reservations } = useApp()
	const { location, status, locate } = useUserLocation()
	const [locateRevision, setLocateRevision] = useState(0)
	const [route, setRoute] = useState<RouteState>({ status: 'idle' })

	useEffect(() => {
		locate()
	}, [locate])

	const reservation =
		params.kind === 'reservation'
			? reservations.find(item => item.id === params.id)
			: undefined

	const parking =
		params.kind === 'reservation'
			? getParking(reservation?.parkingId ?? '')
			: getParking(params.id)

	const locationReady = status === 'ready' || status === 'fallback'

	// Read inside the effect without being a dependency of it: a passive GPS
	// update should not by itself re-fetch the route, only the first fix and
	// an explicit GPS-refresh tap (locateRevision) should.
	const locationRef = useRef(location)
	useEffect(() => {
		locationRef.current = location
	}, [location])

	// Fetch a real road-following route once GPS is available, and again
	// whenever the user taps the GPS-refresh button.
	useEffect(() => {
		if (!parking || !locationReady) return

		let cancelled = false

		fetch('/api/directions', {
			method: 'POST',
			headers: { 'Content-Type': 'application/json' },
			body: JSON.stringify({
				origin: locationRef.current,
				destination: { lat: parking.lat, lng: parking.lng },
			}),
		})
			.then(response => (response.ok ? response.json() : Promise.reject()))
			.then(
				(data: {
					distanceMeters: number
					durationSeconds: number
					coordinates: Coordinate[]
				}) => {
					if (cancelled) return
					setRoute({
						status: 'ready',
						distanceMeters: data.distanceMeters,
						durationSeconds: data.durationSeconds,
						coordinates: data.coordinates,
					})
				},
			)
			.catch(() => {
				if (!cancelled) setRoute({ status: 'error' })
			})

		return () => {
			cancelled = true
		}
	}, [parking, locationReady, locateRevision])

	if (!parking || !['parking', 'reservation'].includes(params.kind)) notFound()

	const straightLineDistance = distanceKm(location, parking)
	// A city-speed estimate, not a routed one — used until (or unless) a real
	// route comes back from the routing API.
	const straightLineEta = Math.max(3, Math.round((straightLineDistance / 30) * 60))

	const hasRealRoute = route.status === 'ready' && route.coordinates
	const distanceLabel = hasRealRoute
		? formatDistance(route.distanceMeters! / 1000)
		: formatDistance(straightLineDistance)
	const etaLabel = hasRealRoute
		? `~${Math.max(1, Math.round(route.durationSeconds! / 60))} daq`
		: `~${straightLineEta} daq`

	return (
		<div className='-mx-5 -mt-6 min-h-[calc(100dvh-var(--spacing-nav))] bg-canvas pb-28 pt-5'>
			<div className='mx-auto w-full max-w-md space-y-3 px-4'>
				<AppBar
					title={parking.name}
					subtitle={parking.address}
					onBack={() => router.back()}
				/>

				<Card variant='bare'>
					<ParkingMap
						parkings={[parking]}
						userLocation={locationReady ? location : undefined}
						locateRevision={locateRevision}
						routeTo={{ lat: parking.lat, lng: parking.lng }}
						routePath={hasRealRoute ? route.coordinates : undefined}
						className='h-[46vh]'
					/>
				</Card>

				<div className='grid grid-cols-3 gap-2'>
					<Card className='text-center'>
						<p className='text-[11px] text-ink-3'>Masofa</p>
						<p className='mt-1 text-[16px] font-black text-ink'>
							{distanceLabel}
						</p>
					</Card>
					<Card className='text-center'>
						<p className='text-[11px] text-ink-3'>Taxminiy vaqt</p>
						<p className='mt-1 text-[16px] font-black text-ink'>{etaLabel}</p>
					</Card>
					<button
						type='button'
						onClick={() => {
							setLocateRevision(current => current + 1)
							locate()
						}}
						className='citygo-pressable rounded-card-lg bg-card p-3.5 text-center shadow-card'
					>
						<LocateFixed
							className={cn(
								'mx-auto size-[18px] text-brand',
								status === 'loading' && 'citygo-refresh-spinner is-refreshing',
							)}
						/>
						<p className='mt-1 text-[11px] font-bold text-ink-2'>GPS</p>
					</button>
				</div>

				<Card>
					<div className='flex items-center gap-3'>
						<IconTile tone='bg-brand-50 text-brand'>
							<CircleParking className='size-[18px]' />
						</IconTile>
						<div className='min-w-0 flex-1'>
							<p className='text-[13px] font-bold text-ink'>
								{parking.availableSpaces > 0
									? `${parking.availableSpaces} joy bo‘sh`
									: 'Bo‘sh joy yo‘q'}
							</p>
							<p className='mt-0.5 text-[11.5px] text-ink-3'>
								{formatUZS(parking.pricePerHour)}/soat · {parking.workingHours}
							</p>
						</div>
						<Button
							size='sm'
							variant='outline'
							onClick={() => router.push(`/parking/${parking.id}`)}
						>
							Ochish
						</Button>
					</div>
				</Card>

				<Card variant='flat'>
					<p className='text-[11.5px] leading-5 text-ink-2'>
						{hasRealRoute
							? 'Marshrut 2GIS orqali hisoblangan — bu jonli navigatsiya emas. To‘liq navigatsiya uchun tashqi navigatorni oching.'
							: 'Xaritadagi chiziq yo‘l bo‘ylab qurilgan marshrut emas — bu yo‘nalish ko‘rinishi. Haqiqiy navigatsiya uchun tashqi navigatorni oching.'}
					</p>
				</Card>

				<Button variant='primary' block onClick={() => router.push(`/transport?parkingId=${parking.id}`)}>
					<Navigation className='size-4' /> Ilovada yo‘lga chiqish
				</Button>

				<a
					href={`https://www.google.com/maps/dir/?api=1&destination=${parking.lat},${parking.lng}`}
					target='_blank'
					rel='noreferrer'
					className='flex h-11 w-full items-center justify-center gap-[7px] rounded-xl bg-brand text-[14.5px] font-[650] text-white shadow-[0_6px_16px_rgb(108_71_224/.28)]'
				>
					<Navigation className='size-4' /> Navigatorni ochish
					<ExternalLink className='size-3.5' />
				</a>

				{reservation && (
					<Button
						variant='outline'
						block
						onClick={() => router.push(`/reservation/${reservation.id}`)}
					>
						<QrCode className='size-4 text-brand' /> Bron QR kodiga qaytish
					</Button>
				)}
			</div>
		</div>
	)
}
