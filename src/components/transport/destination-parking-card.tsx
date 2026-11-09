'use client'

import { CircleParking } from 'lucide-react'
import Link from 'next/link'

import { Badge } from '@/components/ui/badge'
import { parkingAvailability } from '@/lib/availability'
import { reservationStatusLabel } from '@/lib/bookings'
import type { DestinationParking } from '@/lib/destination-parking'
import { formatDistance } from '@/lib/format'
import { reservationHref } from '@/lib/reservation'

type DestinationParkingCardProps = {
	suggestion: DestinationParking
	// What the customer is actually travelling to, so the card can say what
	// the car park is near instead of looking like it replaced it.
	destinationTitle: string
	onReserve: () => void
}

// The one section of the Transport screen backed entirely by real SmartCity
// data — real availability, and a Reserve button that opens the shared
// City Goo booking sheet for this parking, not a City Goo-style toast.
//
// It is a recommendation, not the destination: the heading says which of the
// two it is, and when it is «near» something it names what.
export function DestinationParkingCard({
	suggestion,
	destinationTitle,
	onReserve,
}: DestinationParkingCardProps) {
	const { parking, label, walkKm, walkMinutes, reservation } = suggestion
	const { percent: pct, full, tone } = parkingAvailability(parking)

	return (
		<section className='rounded-[20px] bg-white p-3.5 shadow-card'>
			<div className='flex items-baseline justify-between gap-2'>
				<p className='text-[11px] font-bold uppercase tracking-[.08em] text-ink-3'>
					{label}
				</p>
				{/* The booking's own state, in the words Bron and the booking's
				    own page already use for it. */}
				{reservation && (
					<Badge tone={reservation.status === 'active' ? 'ok' : 'brand'}>
						{reservationStatusLabel(reservation.status)}
					</Badge>
				)}
			</div>

			{/* Straight-line from the destination, and the app's own walking
			    estimate for it. Both come from real coordinates; when the car
			    park is the destination there is no walk and nothing is shown. */}
			{walkKm !== null && walkMinutes !== null && (
				<p className='mt-1 text-[11.5px] text-ink-3'>
					{destinationTitle}’dan {formatDistance(walkKm)} · ≈{walkMinutes} daq
					piyoda
				</p>
			)}

			<div className='mt-3 flex items-center gap-3'>
				<span
					className={`grid size-10 shrink-0 place-items-center rounded-[13px] bg-linear-to-br ${parking.accent} text-white`}
				>
					<CircleParking className='size-5' />
				</span>
				<div className='min-w-0 flex-1'>
					<p className='truncate text-[14.5px] font-extrabold text-ink'>
						{parking.name}
					</p>
					<p className='mt-0.5 truncate text-[11.5px] text-ink-3'>
						{parking.address}
					</p>
				</div>
				<span className={`shrink-0 text-[15px] font-black ${tone.text}`}>
					{pct}%
				</span>
			</div>

			<p className='mt-3 text-[12.5px] text-ink-2'>
				Bo‘sh {parking.availableSpaces} / {parking.totalSpaces} joy
			</p>
			<div className='mt-1.5 h-1.5 overflow-hidden rounded-full bg-line'>
				<span
					className={`block h-full rounded-full ${tone.bar}`}
					style={{ width: `${Math.max(4, pct)}%` }}
				/>
			</div>

			<div className='mt-3 grid grid-cols-2 gap-2'>
				<Link
					href={`/parking/${parking.id}`}
					className='flex h-11 items-center justify-center rounded-[14px] border border-line-2 text-[13px] font-bold text-ink'
				>
					Batafsil
				</Link>

				{/* A lot the customer already holds a live booking for is not one
				    to book again — it is one to open. */}
				{reservation ? (
					<Link
						href={reservationHref(reservation)}
						className='flex h-11 items-center justify-center rounded-[14px] bg-brand text-[13px] font-bold text-white shadow-[0_6px_16px_rgba(108,71,224,.28)]'
					>
						Bronni ko‘rish
					</Link>
				) : full ? (
					<span className='flex h-11 items-center justify-center rounded-[14px] bg-card-2 text-[13px] font-bold text-ink-3'>
						Joy yo‘q
					</span>
				) : (
					<button
						type='button'
						onClick={onReserve}
						className='flex h-11 w-full items-center justify-center rounded-[14px] bg-brand text-[13px] font-bold text-white shadow-[0_6px_16px_rgba(108,71,224,.28)]'
					>
						Band qilish
					</button>
				)}
			</div>
		</section>
	)
}
