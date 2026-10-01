'use client'

import { ExternalLink, LocateFixed, MapPin, RotateCw, Route as RouteIcon, TriangleAlert } from 'lucide-react'

import { CarRouteStatus } from '@/components/transport/car-route-status'
import { TransitRouteStatus } from '@/components/transport/transit-route-status'
import { Button } from '@/components/ui/button'
import { Card } from '@/components/ui/card'
import type { RealRoute } from '@/lib/routing'
import type { TransportMode } from '@/lib/transport'
import { routeNoun, routeUnavailableMessage, type ActiveRoute } from '@/lib/transport-route'

type RouteStatusState = Extract<ActiveRoute, { status: 'loading' | 'unavailable' | 'needs-location' | 'real' }>

// The existing 2GIS hand-off (externalNavigationHref) — never a second link
// builder.
function OpenIn2Gis({ href }: { href: string }) {
	return (
		<a
			href={href}
			target='_blank'
			rel='noreferrer'
			className='inline-flex h-[34px] items-center justify-center gap-1.5 rounded-[9px] bg-card-2 px-[13px] text-[12.5px] font-bold text-ink'
		>
			2GIS’da ochish <ExternalLink className='size-3.5' />
		</a>
	)
}

// What /transport says about a real-routed mode (car, walking, scooter, metro)
// whose route is not simply "there": loading, unavailable, or waiting for a
// real origin. Sits where the route's numbers would be read from, so the "—"
// in the summary is explained right above it. There is deliberately no
// estimate in here: the old straight-line figures are not offered in place
// of a real route.
//
// For a route that *is* there, this row is where the route is named as
// 2GIS's — and where «2GIS’da ochish» lives when there is a hand-off. The
// scooter has none, so it gets no button. For the car it is followed by
// 2GIS's alternatives and maneuvers (CarRouteStatus); for metro, by the
// journey's legs (TransitRouteStatus).
export function RouteStatus({
	mode,
	route,
	onRetry,
	navigateHref,
	locating,
	onLocate,
	onPickOrigin,
	carRoutes,
}: {
	mode: TransportMode
	route: RouteStatusState
	onRetry: () => void
	// The existing 2GIS hand-off link (externalNavigationHref), when there is one.
	navigateHref: string | null
	locating: boolean
	onLocate: () => void
	onPickOrigin: () => void
	// The car's full 2GIS answer and which of its routes is on screen.
	carRoutes?: { route: RealRoute; selectedIndex: number; onSelect: (index: number) => void }
}) {
	const noun = routeNoun(mode)

	if (route.status === 'real') {
		const summary = (
			<Card className='flex items-center gap-3'>
				<span className='grid size-10 shrink-0 place-items-center rounded-2xl bg-brand-50 text-brand'>
					<RouteIcon className='size-5' />
				</span>
				<div className='min-w-0 flex-1'>
					<p className='text-[14px] font-extrabold text-ink'>2GIS marshruti</p>
					<p className='mt-0.5 text-[12.5px] text-ink-3'>
						{route.figures.minutes} daq · {route.figures.distanceKm.toFixed(1)} km
					</p>
				</div>
				{navigateHref && <OpenIn2Gis href={navigateHref} />}
			</Card>
		)
		if (mode === 'metro' && route.route.transitLegs) {
			return (
				<div className='space-y-3'>
					{summary}
					<TransitRouteStatus legs={route.route.transitLegs} />
				</div>
			)
		}
		if (mode !== 'car' || !carRoutes) return summary
		return (
			<div className='space-y-3'>
				{summary}
				<CarRouteStatus {...carRoutes} />
			</div>
		)
	}

	if (route.status === 'loading') {
		return (
			<Card className='flex items-center gap-3' role='status' aria-live='polite'>
				<span className='size-5 shrink-0 animate-spin rounded-full border-2 border-brand/25 border-t-brand' />
				<div className='min-w-0 flex-1'>
					<p className='text-[14px] font-extrabold text-ink'>Marshrut hisoblanmoqda…</p>
					<div className='mt-1.5 h-2 w-2/3 animate-pulse rounded-full bg-card-2' />
				</div>
			</Card>
		)
	}

	if (route.status === 'needs-location') {
		return (
			<Card>
				<div className='flex items-start gap-3'>
					<span className='grid size-10 shrink-0 place-items-center rounded-2xl bg-warn-bg text-warn'>
						<LocateFixed className='size-5' />
					</span>
					<div className='min-w-0 flex-1'>
						<p className='text-[14px] font-extrabold text-ink'>
							{locating ? 'Joylashuv aniqlanmoqda…' : `${noun} uchun joylashuv kerak`}
						</p>
						<p className='mt-1 text-[12.5px] leading-5 text-ink-3'>
							Marshrut haqiqiy boshlanish nuqtasidan quriladi. Joylashuvga ruxsat
							bering yoki boshlanish joyini tanlang.
						</p>
					</div>
				</div>
				<div className='mt-3 flex gap-2'>
					<Button variant='primary' size='sm' disabled={locating} onClick={onLocate}>
						<LocateFixed className='size-3.5' /> Joylashuvni aniqlash
					</Button>
					<Button size='sm' onClick={onPickOrigin}>
						<MapPin className='size-3.5' /> Boshlanish joyi
					</Button>
				</div>
			</Card>
		)
	}

	return (
		<Card role='alert'>
			<div className='flex items-start gap-3'>
				<span className='grid size-10 shrink-0 place-items-center rounded-2xl bg-bad-bg text-bad'>
					<TriangleAlert className='size-5' />
				</span>
				<div className='min-w-0 flex-1'>
					<p className='text-[14px] font-extrabold text-ink'>
						{routeUnavailableMessage(route.reason, mode)}
					</p>
					<p className='mt-1 text-[12.5px] leading-5 text-ink-3'>
						{noun} ko‘rsatilmaydi — taxminiy chiziq uning o‘rnini bosmaydi.
					</p>
				</div>
			</div>
			{(route.retryable || navigateHref) && (
				<div className='mt-3 flex gap-2'>
					{route.retryable && (
						<Button variant='primary' size='sm' onClick={onRetry}>
							<RotateCw className='size-3.5' /> Qayta urinish
						</Button>
					)}
					{navigateHref && <OpenIn2Gis href={navigateHref} />}
				</div>
			)}
		</Card>
	)
}
