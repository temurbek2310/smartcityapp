'use client'

import { cn } from '@/lib/cn'

// City Goo's .sw. Rendered as a real checkbox so it is reachable by
// keyboard and announced correctly; the pill and knob are drawn over it.
export function Switch({
	checked,
	onChange,
	label,
	className,
}: {
	checked: boolean
	onChange: (next: boolean) => void
	// Visually hidden, but a switch with no name is unusable non-visually.
	label: string
	className?: string
}) {
	return (
		<label className={cn('relative inline-flex cursor-pointer', className)}>
			<input
				type='checkbox'
				role='switch'
				checked={checked}
				onChange={event => onChange(event.target.checked)}
				className='peer sr-only'
			/>
			<span className='sr-only'>{label}</span>
			<span
				aria-hidden
				className={cn(
					'block h-[26px] w-11 rounded-full transition-colors peer-focus-visible:outline peer-focus-visible:outline-2 peer-focus-visible:outline-offset-2 peer-focus-visible:outline-brand',
					checked ? 'bg-brand' : 'bg-line-2',
				)}
			>
				<i
					className={cn(
						'absolute left-[3px] top-[3px] size-5 rounded-full bg-white shadow-[0_1px_3px_rgb(0_0_0/.2)] transition-transform',
						checked && 'translate-x-[18px]',
					)}
				/>
			</span>
		</label>
	)
}
