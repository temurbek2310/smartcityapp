import type { ReactNode } from 'react'

import { cn } from '@/lib/cn'

// City Goo's .sq — the rounded square that leads almost every list row.
// Tone classes are passed in whole ("bg-ok-bg text-ok") because callers
// tint it from data far more often than from a fixed set.
export function IconTile({
	size = 40,
	tone = 'bg-card-2 text-ink-2',
	className,
	children,
}: {
	size?: number
	tone?: string
	className?: string
	children?: ReactNode
}) {
	return (
		<span
			style={{ width: size, height: size, flex: `0 0 ${size}px` }}
			className={cn(
				'grid place-items-center rounded-xl',
				tone,
				className,
			)}
		>
			{children}
		</span>
	)
}
