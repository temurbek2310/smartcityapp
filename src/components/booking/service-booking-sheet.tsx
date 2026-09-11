'use client'

import { Minus, Plus } from 'lucide-react'
import { useState } from 'react'

import { BottomSheet } from '@/components/ui/bottom-sheet'
import { Button } from '@/components/ui/button'
import { Card } from '@/components/ui/card'
import { Chip } from '@/components/ui/chip'
import { KeyValue, KeyValueList } from '@/components/ui/key-value'
import { useApp } from '@/context/app-context'
import { getParking } from '@/data/parkings'
import { getPlace } from '@/data/places'
import type { ServiceBookingKind } from '@/lib/types'

// Tables, cinema seats, clinic slots and event tickets. Parking and queues
// have their own flows because they have their own lifecycles; these four
// only need a time, a count and a confirmation, so one sheet covers them.
//
// Home already had this UI, but it ended in a toast and stored nothing —
// the booking never existed. It writes a real ServiceBooking now, which is
// why it shows up in the Booking Center.

const SLOTS = ['11:30', '12:00', '12:30', '13:00', '14:00', '18:00', '19:00', '20:00']

const COPY: Record<
	ServiceBookingKind,
	{ title: string; countLabel: string; unit: string; confirm: string }
> = {
	table: {
		title: 'Stol bron qilish',
		countLabel: 'Mehmonlar',
		unit: 'kishi',
		confirm: 'Stolni bron qilish',
	},
	cinema: {
		title: 'Kino chiptasi',
		countLabel: 'Chiptalar',
		unit: 'ta',
		confirm: 'Chiptani olish',
	},
	clinic: {
		title: 'Klinikaga yozilish',
		countLabel: 'Bemorlar',
		unit: 'kishi',
		confirm: 'Qabulga yozilish',
	},
	event: {
		title: 'Tadbirga bron',
		countLabel: 'Chiptalar',
		unit: 'ta',
		confirm: 'Chiptani olish',
	},
}

export function ServiceBookingSheet({
	kind,
	refId,
	venueName,
	onClose,
	onNotify,
}: {
	kind: ServiceBookingKind
	// A place or an event id — whatever the card that opened this refers to.
	refId: string
	venueName?: string
	onClose: () => void
	onNotify: (message: string) => void
}) {
	const { createServiceBooking } = useApp()
	const [slot, setSlot] = useState(SLOTS[2])
	const [count, setCount] = useState(2)

	const copy = COPY[kind]
	const place = getPlace(refId)
	const title = venueName ?? place?.title ?? copy.title
	// Every service booking still points at somewhere to park, which is the
	// whole reason this app is the one making the booking.
	const parking = place?.parkingId ? getParking(place.parkingId) : undefined

	return (
		<BottomSheet title={copy.title} onClose={onClose}>
			<Card>
				<p className='text-[15px] font-extrabold text-ink'>{title}</p>
				{place && (
					<p className='mt-1 text-[12px] text-ink-3'>{place.address}</p>
				)}
			</Card>

			<Card className='mt-3'>
				<p className='text-[14px] font-bold text-ink'>Vaqt</p>
				<div className='mt-3 grid grid-cols-4 gap-2'>
					{SLOTS.map(option => (
						<Chip
							key={option}
							active={slot === option}
							onClick={() => setSlot(option)}
							className='justify-center'
						>
							{option}
						</Chip>
					))}
				</div>
			</Card>

			<Card className='mt-3'>
				<div className='flex items-center justify-between gap-3'>
					<p className='text-[14px] font-bold text-ink'>{copy.countLabel}</p>
					<div className='flex items-center gap-3'>
						<button
							type='button'
							aria-label='Kamaytirish'
							onClick={() => setCount(Math.max(1, count - 1))}
							className='grid size-10 place-items-center rounded-xl bg-card-2 text-ink'
						>
							<Minus className='size-4' />
						</button>
						<strong className='min-w-10 text-center text-[17px] font-black text-ink'>
							{count}
						</strong>
						<button
							type='button'
							aria-label='Ko‘paytirish'
							onClick={() => setCount(Math.min(12, count + 1))}
							className='grid size-10 place-items-center rounded-xl bg-card-2 text-ink'
						>
							<Plus className='size-4' />
						</button>
					</div>
				</div>
			</Card>

			<Card className='mt-3'>
				<KeyValueList>
					<KeyValue label='Vaqt' value={`Bugun, ${slot}`} />
					<KeyValue label={copy.countLabel} value={`${count} ${copy.unit}`} />
					{parking && <KeyValue label='Yaqin parking' value={parking.name} />}
					<KeyValue label='Joyni ushlab turamiz' value='15 daqiqa' />
				</KeyValueList>
			</Card>

			<Button
				variant='primary'
				block
				className='mt-4'
				onClick={() => {
					const booking = createServiceBooking({
						kind,
						refId,
						title,
						subtitle: `${count} ${copy.unit} · ${slot}`,
						whenLabel: `Bugun, ${slot}`,
					})
					onClose()
					onNotify(`${title} · ${booking.code}`)
				}}
			>
				{copy.confirm}
			</Button>
			<p className='mt-2 text-center text-[11px] text-ink-3'>
				Bir soat oldin bepul bekor qilish mumkin
			</p>
		</BottomSheet>
	)
}
