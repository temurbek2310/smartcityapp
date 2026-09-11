import type { ReactNode } from 'react'

import { cn } from '@/lib/cn'

// City Goo's .badge with its six tones. Status only — for anything
// tappable use Chip.
export type BadgeTone = 'ok' | 'warn' | 'bad' | 'info' | 'brand' | 'gray'

const TONES: Record<BadgeTone, string> = {
	ok: 'bg-ok-bg text-ok',
	warn: 'bg-warn-bg text-warn',
	bad: 'bg-bad-bg text-bad',
	info: 'bg-info-bg text-info',
	brand: 'bg-brand-100 text-brand',
	gray: 'bg-card-2 text-ink-2',
}

export function Badge({
	tone = 'gray',
	className,
	children,
}: {
	tone?: BadgeTone
	className?: string
	children?: ReactNode
}) {
	return (
		<span
			className={cn(
				'inline-flex h-[22px] items-center gap-1 rounded-[7px] px-2 text-[11.5px] font-bold',
				TONES[tone],
				className,
			)}
		>
			{children}
		</span>
	)
}
