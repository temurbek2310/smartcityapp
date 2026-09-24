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
	// null while the selected mode has no figures to show honestly — a car
	// route still loading, unavailable or waiting for a location fix. The
	// rows then read "—" instead of falling back to the estimate.
	minutes: number | null
	distanceKm: number | null
	costUZS: number | null
	costLabel: string
	// Where time and distance come from: 2GIS for a real car route, the
	// haversine estimate otherwise. The cost is B SPACE's own estimate either
	// way — fed with the 2GIS road distance when there is one.
	source: '2gis' | 'estimate'
	facts: RouteFactRow[]
	// The car park this route suggests, and what to call it. Absent whenever
	// there is nothing to suggest — arriving by metro, on a scooter or on
	// foot needs no parking, so the row is left out rather than emptied.
	parkingSuggestion?: { label: string; parking: Parking }
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
	source,
	facts,
	parkingSuggestion,
}: RouteSummaryProps) {
	const modeInfo = TRANSPORT_MODES.find(item => item.id === mode)

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
				<SummaryRow icon={Clock3} label='Vaqt yo‘lda' value={minutes !== null ? `${minutes} daq` : '—'} />
				<SummaryRow
					icon={RouteIcon}
					label='Masofa'
					value={distanceKm !== null ? `${distanceKm.toFixed(1)} km` : '—'}
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
				{parkingSuggestion && (
					<SummaryRow
						icon={MapPin}
						label={parkingSuggestion.label}
						value={
							parkingSuggestion.parking.availableSpaces > 0
								? `${parkingSuggestion.parking.availableSpaces} joy`
								: 'Joy yo‘q'
						}
						valueClassName={
							parkingAvailability(parkingSuggestion.parking).tone.text
						}
						sublabel={parkingSuggestion.parking.name}
						href={`/parking/${parkingSuggestion.parking.id}`}
					/>
				)}
			</div>

			<div className='mt-2.5 flex items-center justify-between rounded-[16px] bg-white px-3.5 py-3 shadow-card'>
				<span className='text-[13px] text-ink-3'>
					Narx {costLabel && `· ${costLabel}`}
				</span>
				<span className='text-[15px] font-extrabold text-ink'>
					{costUZS === null ? '—' : costUZS > 0 ? `≈ ${formatUZS(costUZS)}` : 'Bepul'}
				</span>
			</div>
			<p className='mt-1.5 px-1 text-[10.5px] text-ink-3'>
				{source === '2gis'
					? 'Vaqt va masofa — 2GIS marshruti. Yoqilg‘i narxi shu masofaga asoslangan B SPACE taxminiy hisobi. Yo‘l holati bo‘yicha qatorlar — namunaviy ma’lumot.'
					: 'Yo‘l holati bo‘yicha qatorlar — namunaviy ma’lumot. Narx va vaqt real masofaga asoslangan taxminiy hisob.'}
			</p>
		</section>
	)
}
