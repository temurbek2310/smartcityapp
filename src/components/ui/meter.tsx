import { cn } from '@/lib/cn'

// City Goo's .bar — the occupancy/progress rail under parking and queue
// cards. `tone` is a background class, normally taken straight from
// parkingAvailability().tone.bar or occupancyTone().
export function Meter({
	value,
	tone = 'bg-brand',
	height = 7,
	className,
}: {
	value: number
	tone?: string
	height?: number
	className?: string
}) {
	const clamped = Math.max(0, Math.min(100, value))
	return (
		<div
			style={{ height }}
			className={cn('overflow-hidden rounded-full bg-line', className)}
		>
			<i
				style={{ width: `${clamped}%` }}
				className={cn('block h-full rounded-full transition-[width] duration-400', tone)}
			/>
		</div>
	)
}
