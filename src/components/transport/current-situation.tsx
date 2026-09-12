'use client'

import { ChevronRight, RefreshCw, type LucideIcon } from 'lucide-react'
import { useState } from 'react'

import type { CurrentSituationRow } from '@/data/demo-transport'

const TONE_TEXT: Record<CurrentSituationRow['tone'], string> = {
	ok: 'text-ok',
	warn: 'text-warn',
	bad: 'text-bad',
}

function Row({
	icon: Icon,
	label,
	value,
	tone,
	detail,
}: {
	icon: LucideIcon
	label: string
	value: string
	tone: CurrentSituationRow['tone']
	detail: string
}) {
	const [expanded, setExpanded] = useState(false)
	return (
		<div className='border-t border-line first:border-t-0'>
			<button
				type='button'
				onClick={() => setExpanded(current => !current)}
				className='flex w-full items-center gap-3 px-3.5 py-3 text-left'
			>
				<Icon className={`size-4.5 shrink-0 ${TONE_TEXT[tone]}`} />
				<span className='min-w-0 flex-1 truncate text-[13.5px] text-ink-2'>
					{label}
				</span>
				<span className={`shrink-0 text-[13.5px] font-extrabold ${TONE_TEXT[tone]}`}>
					{value}
				</span>
				<ChevronRight className='size-4 shrink-0 text-ink-3' />
			</button>
			{expanded && (
				<p className='px-3.5 pb-3 text-[11.5px] leading-5 text-ink-3'>
					{detail}
				</p>
			)}
		</div>
	)
}

type CurrentSituationProps = {
	rows: CurrentSituationRow[]
	weatherIcon: LucideIcon
	weatherLabel: string
	weatherDetail: string
	onRefresh: () => void
	refreshing: boolean
}

export function CurrentSituation({
	rows,
	weatherIcon,
	weatherLabel,
	weatherDetail,
	onRefresh,
	refreshing,
}: CurrentSituationProps) {
	return (
		<section>
			<div className='flex items-baseline justify-between px-1'>
				<h2 className='text-[18px] font-extrabold tracking-[-0.01em] text-ink'>
					Hozirgi holat
				</h2>
				<button
					type='button'
					onClick={onRefresh}
					className='citygo-pressable inline-flex items-center gap-1 text-[12.5px] font-bold text-brand'
				>
					<RefreshCw className={`size-3.5 citygo-refresh-spinner ${refreshing ? 'is-refreshing' : ''}`} />
					Yangilash
				</button>
			</div>

			<div className='mt-2.5 overflow-hidden rounded-[20px] bg-white shadow-card'>
				{rows.map(row => (
					<Row
						key={row.label}
						icon={row.icon}
						label={row.label}
						value={row.value}
						tone={row.tone}
						detail={row.detail}
					/>
				))}
				<Row
					icon={weatherIcon}
					label='Ob-havo'
					value={weatherLabel}
					tone='ok'
					detail={weatherDetail}
				/>
			</div>

			<p className='mt-1.5 px-1 text-[10.5px] text-ink-3'>
				Tirbandlik, HTH va yopiq yo‘llar — namunaviy ma’lumot. Ob-havo B SPACE
				ilovasining shahar bo‘yicha statik ma’lumotidan olindi.
			</p>
		</section>
	)
}
