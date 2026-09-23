'use client'

import {
	CircleParking,
	ExternalLink,
	MapPin,
	Navigation,
	Ticket,
	Users,
	type LucideIcon,
} from 'lucide-react'
import { useRouter } from 'next/navigation'
import { useEffect } from 'react'

import { BottomSheet } from '@/components/ui/bottom-sheet'
import { Button } from '@/components/ui/button'
import { Card } from '@/components/ui/card'
import { IconTile } from '@/components/ui/icon-tile'
import { estimateMinutesForMode } from '@/lib/eta'
import { formatDistance } from '@/lib/format'
import { distanceKm } from '@/lib/geo'
import { routeHref } from '@/lib/navigation'
import {
	externalNavigationHref,
	resolveRouteEndpoint,
	type RouteEndpointKind,
} from '@/lib/route-endpoints'
import { DEFAULT_TRANSPORT_MODE, type TransportMode } from '@/lib/transport'
import { useUserLocation } from '@/lib/use-user-location'

// The one «Yo‘nalish» in B SPACE. A lot, a restaurant, a queue desk, a table
// booking, a clinic slot — every one of them opens this, on exactly the
// destination the customer came from, and leaves by one of two doors: the
// route B SPACE calculated, or the navigator on their phone.
//
// It takes a destination id, not a Parking: it used to be parking-only, so
// asking for directions to a café showed the café's car park instead.

const KIND_ICON: Record<RouteEndpointKind, LucideIcon> = {
	me: Navigation,
	saved: MapPin,
	place: MapPin,
	parking: CircleParking,
	queue: Users,
	event: Ticket,
}

export function DirectionsSheet({
	destinationId,
	// Which mode the route page should open on. Callers that already know one
	// pass it; nobody has to, and the shared default covers the rest.
	mode = DEFAULT_TRANSPORT_MODE,
	onClose,
}: {
	destinationId: string | null
	mode?: TransportMode
	onClose: () => void
}) {
	// Mounted only while there is somewhere to go, so the sheet never has to
	// reset itself between two different destinations.
	if (!destinationId) return null
	return (
		<DirectionsSheetBody
			destinationId={destinationId}
			mode={mode}
			onClose={onClose}
		/>
	)
}

function DirectionsSheetBody({
	destinationId,
	mode,
	onClose,
}: {
	destinationId: string
	mode: TransportMode
	onClose: () => void
}) {
	const router = useRouter()
	const { location, status, locate } = useUserLocation()

	useEffect(() => {
		locate()
	}, [locate])

	const destination = resolveRouteEndpoint(destinationId, location)

	// The caller resolves its destination before opening this, so landing
	// here means the catalogs changed underneath a stored reference. Say so
	// rather than quietly routing somewhere else.
	if (!destination) {
		return (
			<BottomSheet title='Yo‘nalish' onClose={onClose}>
				<Card>
					<p className='text-[13px] leading-5 text-ink-2'>
						Bu manzil endi mavjud emas, shuning uchun marshrut qurib
						bo‘lmaydi.
					</p>
				</Card>
			</BottomSheet>
		)
	}

	// Same rule as everywhere else: a fallback fix is Tashkent's centre, not
	// the customer's street, so the estimate is shown as the approximation it
	// is and withheld entirely until there is a position to measure from.
	const located = status === 'ready' || status === 'fallback'
	const km = distanceKm(location, destination)
	const Icon = KIND_ICON[destination.kind]

	return (
		<BottomSheet title='Yo‘nalish' onClose={onClose}>
			<Card>
				<div className='flex items-start gap-3'>
					<IconTile tone='bg-brand-50 text-brand'>
						<Icon className='size-[18px]' />
					</IconTile>
					<div className='min-w-0 flex-1'>
						<p className='truncate text-[14px] font-extrabold text-ink'>
							{destination.title}
						</p>
						{destination.address && (
							<p className='mt-0.5 text-[11.5px] leading-5 text-ink-3'>
								{destination.address}
							</p>
						)}
					</div>
				</div>

				{located && (
					<div className='mt-3 grid grid-cols-2 gap-2 border-t border-line pt-3'>
						<div>
							<p className='text-[11px] text-ink-3'>Masofa</p>
							<p className='mt-0.5 text-[15px] font-black text-ink'>
								{formatDistance(km)}
							</p>
						</div>
						<div>
							<p className='text-[11px] text-ink-3'>Taxminiy vaqt</p>
							<p className='mt-0.5 text-[15px] font-black text-ink'>
								~{estimateMinutesForMode(km, mode)} daq
							</p>
						</div>
					</div>
				)}

				<p className='mt-3 text-[11px] leading-4 text-ink-3'>
					{located
						? 'To‘g‘ri chiziq bo‘yicha taxmin. To‘liq marshrut keyingi ekranda.'
						: 'Masofani ko‘rsatish uchun joylashuvga ruxsat kerak.'}
				</p>
			</Card>

			<div className='mt-3 space-y-2'>
				{/* The route B SPACE calculated — origin, destination, mode, map
				    and everything /transport knows about the trip. */}
				<Button
					variant='outline'
					block
					onClick={() => {
						onClose()
						router.push(routeHref({ mode, destinationId }))
					}}
				>
					<Navigation className='size-4' /> Marshrutni ko‘rish
				</Button>

				{/* The other door: real turn-by-turn, which B SPACE does not do. */}
				<a
					href={externalNavigationHref(location, destination, mode)}
					target='_blank'
					rel='noreferrer'
					className='flex h-11 w-full items-center justify-center gap-[7px] rounded-xl bg-brand text-[14.5px] font-[650] text-white shadow-[0_6px_16px_rgb(108_71_224/.28)]'
				>
					<Navigation className='size-4' /> Navigatsiyani boshlash
					<ExternalLink className='size-3.5' />
				</a>
			</div>
		</BottomSheet>
	)
}
