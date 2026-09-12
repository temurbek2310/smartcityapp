'use client'

import { BAY_STATES, bayMap, isBaySelectable } from '@/lib/bay-map'
import { cn } from '@/lib/cn'
import type { Parking } from '@/lib/types'

// City Goo's «Схема мест»: the floor plan for one level, split by the drive
// aisle that runs down the middle of every one of these lots.
export function BayGrid({
	parking,
	level,
	selectedBay,
	heldBay,
	onSelect,
}: {
	parking: Parking
	level: number
	selectedBay?: string | null
	heldBay?: string | null
	onSelect?: (bay: string, state: keyof typeof BAY_STATES) => void
}) {
	const { bays } = bayMap(parking, level, heldBay)
	const half = Math.ceil(Math.ceil(bays.length / 6) / 2) * 6

	const row = (slice: typeof bays) => (
		<div className='grid grid-cols-6 gap-[5px]'>
			{slice.map(bay => {
				const selected = bay.id === selectedBay
				const pickable = isBaySelectable(bay.state)
				const tone = BAY_STATES[bay.state]

				return (
					<button
						key={bay.id}
						type='button'
						aria-label={`${bay.id} · ${level}-daraja · ${tone.label}`}
						disabled={!pickable && !selected}
						aria-pressed={selected}
						onClick={() => onSelect?.(bay.id, bay.state)}
						className={cn(
							'h-[34px] rounded-lg border-[1.5px] font-mono text-[9px] font-black transition-colors',
							selected
								? 'border-brand bg-brand text-white'
								: cn(tone.swatch, tone.text),
							!pickable && !selected && 'cursor-not-allowed',
						)}
					>
						{bay.id}
					</button>
				)
			})}
		</div>
	)

	return (
		<div>
			{row(bays.slice(0, half))}

			<div className='my-2 flex items-center gap-2'>
				<i className='h-0.5 flex-1 bg-[repeating-linear-gradient(90deg,var(--color-line-2)_0_8px,transparent_8px_16px)]' />
				<span className='text-[11px] text-ink-3'>yo‘lak</span>
				<i className='h-0.5 flex-1 bg-[repeating-linear-gradient(90deg,var(--color-line-2)_0_8px,transparent_8px_16px)]' />
			</div>

			{row(bays.slice(half))}

			<div className='mt-3 flex flex-wrap gap-x-3 gap-y-1.5'>
				{(Object.keys(BAY_STATES) as (keyof typeof BAY_STATES)[]).map(state => (
					<span
						key={state}
						className='flex items-center gap-1.5 text-[11px] text-ink-2'
					>
						<i
							className={cn(
								'size-[11px] rounded-[3px] border-[1.5px]',
								BAY_STATES[state].swatch,
							)}
						/>
						{BAY_STATES[state].label}
					</span>
				))}
			</div>
		</div>
	)
}
