'use client'

import { CircleParking, X } from 'lucide-react'
import Link from 'next/link'

import { cn } from '@/lib/cn'
import { formatUZS } from '@/lib/format'
import type { Parking } from '@/lib/types'

// The card that answers "which pin did I just tap". Home has had it for a
// while; /parking had the selection state and the highlighted pin but nothing
// that showed what was selected, so its map read as decoration.
//
// Shared rather than copied so the two maps cannot drift: a customer who
// learns the Home map should recognise this one immediately. The host decides
// where it sits, because each map has its own controls to stay clear of.
//
// With no onBook it is exactly the one-row card Home already showed. /parking
// needs booking as well, and four controls on one row do not fit a 360px
// phone, so the actions drop to their own row when there are two of them.
export function SelectedParkingCard({
	parking,
	onClose,
	onBook,
	className,
}: {
	parking: Parking
	onClose: () => void
	onBook?: () => void
	className?: string
}) {
	const full = parking.availableSpaces <= 0

	const facts = (
		<>
			<span
				className={cn(
					'grid size-10 shrink-0 place-items-center rounded-xl bg-linear-to-br text-white',
					parking.accent,
				)}
			>
				<CircleParking className='size-5' />
			</span>
			<div className='min-w-0 flex-1'>
				<p className='truncate text-sm font-black text-ink'>{parking.name}</p>
				<p className='mt-0.5 text-[10px] font-semibold text-ink-3'>
					{full ? 'TO‘LA' : `${parking.availableSpaces} bo‘sh joy`} ·{' '}
					{formatUZS(parking.pricePerHour)}/soat
				</p>
			</div>
		</>
	)

	const open = (
		<Link
			href={`/parking/${parking.id}`}
			className='inline-flex h-9 shrink-0 items-center justify-center rounded-xl bg-brand px-3 text-[11px] font-black text-white'
		>
			Ochish
		</Link>
	)

	const close = (
		<button
			type='button'
			onClick={onClose}
			className='grid size-8 shrink-0 place-items-center rounded-lg bg-card-2 text-ink-3'
			aria-label='Kartani yopish'
		>
			<X className='size-4' />
		</button>
	)

	return (
		<div
			className={cn(
				'animate-map-card-in z-20 rounded-2xl bg-white p-3 shadow-xl ring-1 ring-line',
				className,
			)}
		>
			{onBook ? (
				<>
					<div className='flex items-center gap-2'>
						{facts}
						{close}
					</div>
					<div className='mt-2.5 grid grid-cols-2 gap-2'>
						{open}
						<button
							type='button'
							onClick={onBook}
							disabled={full}
							className='inline-flex h-9 items-center justify-center rounded-xl bg-ink px-3 text-[11px] font-black text-white disabled:opacity-45'
						>
							{full ? 'Joy yo‘q' : 'Bron qilish'}
						</button>
					</div>
				</>
			) : (
				<div className='flex items-center gap-2'>
					{facts}
					{open}
					{close}
				</div>
			)}
		</div>
	)
}
