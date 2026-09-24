'use client'

import { ExternalLink, LocateFixed, MapPin, RotateCw, TriangleAlert } from 'lucide-react'

import { Button } from '@/components/ui/button'
import { Card } from '@/components/ui/card'
import { routeUnavailableMessage, type ActiveRoute } from '@/lib/transport-route'

type PendingCarRoute = Extract<ActiveRoute, { status: 'loading' | 'unavailable' | 'needs-location' }>

// What /transport says while the car has no real route to show. Sits where
// the route's numbers would be read from, so the "—" in the summary is
// explained right above it. There is deliberately no estimate in here: the
// car's old straight-line figures are not offered in place of a real route.
export function CarRouteStatus({
	route,
	onRetry,
	navigateHref,
	locating,
	onLocate,
	onPickOrigin,
}: {
	route: PendingCarRoute
	onRetry: () => void
	// The existing 2GIS hand-off link (externalNavigationHref), when there is one.
	navigateHref: string | null
	locating: boolean
	onLocate: () => void
	onPickOrigin: () => void
}) {
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
							{locating ? 'Joylashuv aniqlanmoqda…' : 'Avtomobil marshruti uchun joylashuv kerak'}
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
						{routeUnavailableMessage(route.reason)}
					</p>
					<p className='mt-1 text-[12.5px] leading-5 text-ink-3'>
						Avtomobil marshruti ko‘rsatilmaydi — taxminiy chiziq uning o‘rnini
						bosmaydi.
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
					{navigateHref && (
						<a
							href={navigateHref}
							target='_blank'
							rel='noreferrer'
							className='inline-flex h-[34px] items-center justify-center gap-1.5 rounded-[9px] bg-card-2 px-[13px] text-[12.5px] font-bold text-ink'
						>
							2GIS’da ochish <ExternalLink className='size-3.5' />
						</a>
					)}
				</div>
			)}
		</Card>
	)
}
