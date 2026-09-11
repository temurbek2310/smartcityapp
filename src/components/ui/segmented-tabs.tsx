'use client'

import { cn } from '@/lib/cn'

// City Goo's .tabs — the inset segmented control. For a scrolling row of
// many options use Chip instead; this is for two or three.
export function SegmentedTabs<T extends string>({
	items,
	value,
	onChange,
	className,
}: {
	items: { id: T; label: string; count?: number }[]
	value: T
	onChange: (next: T) => void
	className?: string
}) {
	return (
		<div
			className={cn('flex gap-1 rounded-[13px] bg-card-2 p-1', className)}
			role='tablist'
		>
			{items.map(item => {
				const active = item.id === value
				return (
					<button
						key={item.id}
						type='button'
						role='tab'
						aria-selected={active}
						onClick={() => onChange(item.id)}
						className={cn(
							'h-9 flex-1 rounded-[10px] text-[13px] font-[650] transition-colors',
							active
								? 'bg-white text-ink shadow-[0_1px_3px_rgb(16_24_40/.12)]'
								: 'text-ink-2',
						)}
					>
						{item.label}
						{item.count !== undefined && item.count > 0 && (
							<span className='ml-1 text-ink-3'>{item.count}</span>
						)}
					</button>
				)
			})}
		</div>
	)
}
