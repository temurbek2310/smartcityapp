'use client'

import { ChevronRight, Clock3, MapPin, Route as RouteIcon } from 'lucide-react'
import Link from 'next/link'
import { useState } from 'react'

import type { RouteFactRow } from '@/data/demo-transport'
import { parkingAvailability } from '@/lib/availability'
import { formatUZS } from '@/lib/format'
import { TRANSPORT_MODES, type TransportMode } from '@/lib/transport'
import type { Parking } from '@/lib/types'

type RouteSummaryProps = {
	mode: TransportMode
	minutes: number
	distanceKm: number
	costUZS: number
	costLabel: string
	facts: RouteFactRow[]
	destination: Parking
}

function SummaryRow({
	icon: Icon,
	label,
	value,
	valueClassName = 'text-ink',
	sublabel,
	onClick,
	explain,
	href,
}: {
	icon: RouteFactRow['icon']
	label: string
	value: string
	valueClassName?: string
	sublabel?: string
	onClick?: () => void
	explain?: string
	href?: string
}) {
	const [expanded, setExpanded] = useState(false)
	const interactive = Boolean(onClick || explain || href)

	const row = (
		<div
			className={`flex items-center gap-3 px-3.5 py-3 ${interactive ? 'cursor-pointer' : ''}`}
			onClick={() => {
				onClick?.()
				if (explain) setExpanded(current => !current)
			}}
		>
			<Icon className='size-4.5 shrink-0 text-ink-3' />
			<span className='min-w-0 flex-1 truncate text-[13.5px] text-ink-2'>
				{label}
			</span>
			<span className={`shrink-0 text-right text-[13.5px] font-extrabold ${valueClassName}`}>
				{value}
				{sublabel && (
					<span className='ml-1 font-medium text-ink-3'>({sublabel})</span>
				)}
			</span>
			{interactive && (
				<ChevronRight className='size-4 shrink-0 text-ink-3' />
			)}
		</div>
	)

	return (
		<div className='border-t border-line first:border-t-0'>
			{href ? (
				<Link href={href}>{row}</Link>
			) : (
				row
			)}
			{explain && expanded && (
				<p className='px-3.5 pb-3 text-[11.5px] leading-5 text-ink-3'>
					{explain}
				</p>
			)}
		</div>
	)
}

export function RouteSummary({
	mode,
	minutes,
	distanceKm,
	costUZS,
	costLabel,
	facts,
	destination,
}: RouteSummaryProps) {
	const modeInfo = TRANSPORT_MODES.find(item => item.id === mode)
	const availabilityTone = parkingAvailability(destination).tone.text

	return (
		<section>
			<div className='flex items-baseline justify-between px-1'>
				<h2 className='text-[18px] font-extrabold tracking-[-0.01em] text-ink'>
					Marshrut xulosasi
				</h2>
				{modeInfo && (
					<span className='rounded-full bg-card-2 px-2.5 py-1 text-[11px] font-bold text-ink-2'>
						{modeInfo.label}
					</span>
				)}
			</div>

			<div className='mt-2.5 overflow-hidden rounded-[20px] bg-white shadow-card'>
				<SummaryRow icon={Clock3} label='Vaqt yo‘lda' value={`${minutes} daq`} />
				<SummaryRow
					icon={RouteIcon}
					label='Masofa'
					value={`${distanceKm.toFixed(1)} km`}
				/>
				{facts.map(fact => (
					<SummaryRow
						key={fact.label}
						icon={fact.icon}
						label={fact.label}
						value={fact.value}
						sublabel={fact.sublabel}
						explain={fact.explain}
					/>
				))}
				<SummaryRow
					icon={MapPin}
					label='Manzildagi parkovka'
					value={
						destination.availableSpaces > 0
							? `${destination.availableSpaces} joy`
							: 'Joy yo‘q'
					}
					valueClassName={availabilityTone}
					sublabel={`${destination.totalSpaces} tadan`}
					href={`/parking/${destination.id}`}
				/>
			</div>

			<div className='mt-2.5 flex items-center justify-between rounded-[16px] bg-white px-3.5 py-3 shadow-card'>
				<span className='text-[13px] text-ink-3'>
					Narx {costLabel && `· ${costLabel}`}
				</span>
				<span className='text-[15px] font-extrabold text-ink'>
					{costUZS > 0 ? `≈ ${formatUZS(costUZS)}` : 'Bepul'}
				</span>
			</div>
			<p className='mt-1.5 px-1 text-[10.5px] text-ink-3'>
				Yo‘l holati bo‘yicha qatorlar — namunaviy ma’lumot. Narx va vaqt real
				masofaga asoslangan taxminiy hisob.
			</p>
		</section>
	)
}
