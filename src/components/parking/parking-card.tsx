'use client'

import {
	BatteryCharging,
	Car,
	Navigation,
	ShieldCheck,
	Star,
	Umbrella,
} from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Card } from '@/components/ui/card'
import { Meter } from '@/components/ui/meter'
import { parkingAvailability } from '@/lib/availability'
import { cn } from '@/lib/cn'
import { formatDistance, formatUZS } from '@/lib/format'
import type { Parking } from '@/lib/types'

// One row in the parking list. City Goo's list card: tinted thumb carrying
// the level count, name and distance, address, free/total with an occupancy
// bar, price, a strip of amenity facts, then route and book.
export function ParkingCard({
	parking,
	distance,
	onOpen,
	onBook,
	onDirections,
	// Set when this row is the one currently picked on the map above, so the
	// two halves of the screen agree on what is selected.
	selected = false,
}: {
	parking: Parking
	// From the customer's GPS fix; null without one, and then not shown.
	distance: number | null
	onOpen: () => void
	onDirections: () => void
	onBook: () => void
	selected?: boolean
}) {
	const { percent, full, tone } = parkingAvailability(parking)

	return (
		<Card
			variant='bare'
			className={cn(selected && 'ring-2 ring-brand')}
		>
			<button
				type='button'
				onClick={onOpen}
				className='flex w-full min-h-26 text-left'
			>
				<span
					className={cn(
						'grid w-26 shrink-0 place-items-center bg-linear-to-br text-white/60',
						parking.accent,
					)}
				>
					<Car className='size-5' />
					<span className='mt-1 text-[10px] font-bold text-white/75'>
						{parking.levels} daraja
					</span>
				</span>

				<span className='min-w-0 flex-1 px-3 py-2.5'>
					<span className='flex items-start justify-between gap-2'>
						<span className='min-w-0'>
							<span className='block truncate text-[15px] font-extrabold text-ink'>
								{parking.name}
							</span>
							<span className='mt-0.5 block truncate text-[11px] text-ink-3'>
								{parking.address}
							</span>
						</span>
						{distance !== null && (
							<span className='shrink-0 text-[10px] text-ink-3'>
								{formatDistance(distance)}
							</span>
						)}
					</span>

					<span className='mt-2 flex items-baseline justify-between gap-2'>
						<span className={cn('text-[12.5px] font-bold', tone.text)}>
							{full
								? 'Bo‘sh joy yo‘q'
								: `Bo‘sh ${parking.availableSpaces} / ${parking.totalSpaces}`}
						</span>
						<span className='text-[13px] font-extrabold text-ink'>
							{parking.pricePerHour
								? `${formatUZS(parking.pricePerHour)}/soat`
								: 'Bepul'}
						</span>
					</span>

					<Meter value={percent} tone={tone.bar} height={5} className='mt-1.5' />

					<span className='mt-2 flex flex-wrap items-center gap-x-3 gap-y-1 text-[10.5px] text-ink-3'>
						<span className='flex items-center gap-1 font-bold text-ink-2'>
							<Star className='size-3 fill-star text-star' /> {parking.rating}
						</span>
						<span className='flex items-center gap-1'>
							<Umbrella className='size-3' />
							{parking.amenities.includes('Covered') ? 'Yopiq' : 'Ochiq'}
						</span>
						{parking.evChargers > 0 && (
							<span className='flex items-center gap-1'>
								<BatteryCharging className='size-3' /> {parking.evChargers} ta
							</span>
						)}
						{parking.amenities.includes('Security') && (
							<span className='flex items-center gap-1'>
								<ShieldCheck className='size-3' /> Qo‘riqlanadi
							</span>
						)}
						<span>{parking.workingHours}</span>
					</span>
				</span>
			</button>

			<div className='grid grid-cols-2 gap-2 px-3 pb-3'>
				<Button size='sm' variant='outline' onClick={onDirections}>
					<Navigation className='size-3.5' /> Yo‘nalish
				</Button>
				<Button size='sm' variant='primary' disabled={full} onClick={onBook}>
					{full ? 'Joy yo‘q' : 'Bron qilish'}
				</Button>
			</div>
		</Card>
	)
}
