'use client'

import { ExternalLink, Map, MapPin, Navigation } from 'lucide-react'
import { useRouter } from 'next/navigation'
import { useEffect } from 'react'

import { BottomSheet } from '@/components/ui/bottom-sheet'
import { Button } from '@/components/ui/button'
import { Card } from '@/components/ui/card'
import { IconTile } from '@/components/ui/icon-tile'
import { estimateMinutesForMode } from '@/lib/eta'
import { formatDistance } from '@/lib/format'
import { distanceKm } from '@/lib/geo'
import { externalNavigationHref } from '@/lib/route-endpoints'
import type { Parking } from '@/lib/types'
import { useUserLocation } from '@/lib/use-user-location'

// «Yo'nalish» used to be a whole screen away — map, GPS fix, route fetch —
// for a customer who most often just wants to know how far it is. This is the
// light half of that: the distance the app can already work out, and the two
// explicit ways on. Nothing here estimates anything the app does not already
// estimate elsewhere, and neither button navigates on its own.
export function DirectionsSheet({
	parking,
	// A reservation id sends the map screen to the booking-aware variant,
	// which knows to offer the way back to the booking.
	reservationId,
	onClose,
}: {
	parking: Parking
	reservationId?: string
	onClose: () => void
}) {
	const router = useRouter()
	const { location, status, locate } = useUserLocation()

	useEffect(() => {
		locate()
	}, [locate])

	// Same rule the map screen uses: a fallback fix is Tashkent's centre, not
	// the customer's street, so both are shown as the approximations they are.
	const located = status === 'ready' || status === 'fallback'
	const km = distanceKm(location, parking)

	return (
		<BottomSheet title='Yo‘nalish' onClose={onClose}>
			<Card>
				<div className='flex items-start gap-3'>
					<IconTile tone='bg-brand-50 text-brand'>
						<MapPin className='size-[18px]' />
					</IconTile>
					<div className='min-w-0 flex-1'>
						<p className='truncate text-[14px] font-extrabold text-ink'>
							{parking.name}
						</p>
						<p className='mt-0.5 text-[11.5px] leading-5 text-ink-3'>
							{parking.address}
						</p>
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
								~{estimateMinutesForMode(km, 'car')} daq
							</p>
						</div>
					</div>
				)}

				<p className='mt-3 text-[11px] leading-4 text-ink-3'>
					{located
						? 'To‘g‘ri chiziq bo‘yicha taxmin. Aniq marshrut xaritada hisoblanadi.'
						: 'Masofani ko‘rsatish uchun joylashuvga ruxsat kerak.'}
				</p>
			</Card>

			<div className='mt-3 space-y-2'>
				<Button
					variant='outline'
					block
					onClick={() => {
						onClose()
						router.push(
							reservationId
								? `/navigate/reservation/${reservationId}`
								: `/navigate/parking/${parking.id}`,
						)
					}}
				>
					<Map className='size-4' /> Marshrutni ko‘rish
				</Button>

				{/* The heavy option, and only on an explicit tap. */}
				<a
					href={externalNavigationHref(location, parking, 'car')}
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
