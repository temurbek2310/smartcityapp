'use client'

import { Star, Utensils } from 'lucide-react'
import { useState } from 'react'

import { ServiceBookingSheet } from '@/components/booking/service-booking-sheet'
import { BottomSheet } from '@/components/ui/bottom-sheet'
import { Card } from '@/components/ui/card'
import { IconTile } from '@/components/ui/icon-tile'
import { tableBookablePlaces } from '@/data/places'
import { cn } from '@/lib/cn'
import { formatDistance } from '@/lib/format'

// The generic «Stol bron qilish» — the one reached from the Home services
// rail and from Bron → Yangi bron, where no restaurant is in context.
//
// Both used to pass a fixed 'urban-food', so a customer who meant Coffee Lab
// got an Urban Food booking without ever being asked. Opening a restaurant
// first and booking from its own sheet stays direct; only the generic
// shortcut asks which venue, and both shortcuts share this flow so they
// cannot drift apart.
//
// Mount it conditionally: unmounting is what clears a half-made choice, so
// reopening always starts at the picker.

export function RestaurantPickerSheet({
	onSelect,
	onClose,
}: {
	onSelect: (placeId: string) => void
	onClose: () => void
}) {
	const restaurants = tableBookablePlaces()

	return (
		<BottomSheet title='Restoran tanlang' onClose={onClose}>
			<p className='mb-3 text-xs leading-5 text-ink-3'>
				Stol bron qilish uchun restoranni tanlang.
			</p>

			<div className='space-y-2'>
				{restaurants.map(place => (
					<button
						key={place.id}
						type='button'
						onClick={() => onSelect(place.id)}
						className='flex w-full items-center gap-3 rounded-card-lg bg-card p-3 text-left shadow-card'
					>
						<IconTile tone={cn('bg-linear-to-br text-white/70', place.accent)}>
							<Utensils className='size-[18px]' />
						</IconTile>
						<span className='min-w-0 flex-1'>
							<span className='block truncate text-[14px] font-semibold text-ink'>
								{place.title}
							</span>
							<span className='mt-0.5 block truncate text-[11px] text-ink-3'>
								{place.subtitle}
							</span>
							<span className='mt-0.5 block truncate text-[11px] text-ink-3'>
								{place.address} · {formatDistance(place.distanceKm)}
							</span>
						</span>
						<span className='flex shrink-0 items-center gap-1 text-[11.5px] font-bold text-ink-2'>
							<Star className='size-3 fill-star text-star' />
							{place.rating}
						</span>
					</button>
				))}

				{restaurants.length === 0 && (
					<Card className='text-center'>
						<p className='text-[13px] text-ink-3'>Restoran topilmadi</p>
					</Card>
				)}
			</div>
		</BottomSheet>
	)
}

export function TableBookingFlow({
	onClose,
	onNotify,
}: {
	onClose: () => void
	onNotify: (message: string) => void
}) {
	const [placeId, setPlaceId] = useState<string | null>(null)

	if (!placeId) {
		return <RestaurantPickerSheet onSelect={setPlaceId} onClose={onClose} />
	}

	// One sheet at a time: the picker is replaced rather than stacked, and
	// nothing is stored until the booking sheet's own confirm button.
	return (
		<ServiceBookingSheet
			kind='table'
			refId={placeId}
			onClose={onClose}
			onNotify={onNotify}
		/>
	)
}
