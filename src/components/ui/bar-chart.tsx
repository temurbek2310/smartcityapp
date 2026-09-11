'use client'

import { cn } from '@/lib/cn'

// City Goo's .bars — the hourly occupancy chart used by both the parking
// forecast and the queue load view. Bars are tappable where the caller
// supplies onSelect, which is how the reference opens its per-hour sheets.
export type Bar = {
	label: string
	// 0-100. A zero-height bar means "closed", drawn as a flat stub.
	value: number
	tone: string
}

export function BarChart({
	bars,
	height = 80,
	onSelect,
	className,
}: {
	bars: Bar[]
	height?: number
	onSelect?: (index: number) => void
	className?: string
}) {
	return (
		<div
			style={{ height }}
			className={cn('flex items-end gap-1.5', className)}
		>
			{bars.map((bar, index) => {
				const Wrapper = onSelect ? 'button' : 'div'
				return (
					<Wrapper
						key={bar.label + index}
						{...(onSelect
							? { type: 'button' as const, onClick: () => onSelect(index) }
							: {})}
						className='flex h-full flex-1 flex-col items-center justify-end gap-[5px]'
					>
						<i
							style={{ height: `${Math.max(2, Math.min(100, bar.value))}%` }}
							className={cn('block w-full rounded-t-md rounded-b-[3px]', bar.tone)}
						/>
						<span className='text-[9.5px] font-semibold text-ink-3'>
							{bar.label}
						</span>
					</Wrapper>
				)
			})}
		</div>
	)
}
