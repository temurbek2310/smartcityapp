import type { ButtonHTMLAttributes, ReactNode } from 'react'

import { cn } from '@/lib/cn'

// City Goo's .chip / .chip.on. Used for filters, categories and any
// single-select row; put a row of these inside HorizontalRail.
export function Chip({
	active = false,
	className,
	children,
	type = 'button',
	...rest
}: {
	active?: boolean
	children?: ReactNode
} & ButtonHTMLAttributes<HTMLButtonElement>) {
	return (
		<button
			type={type}
			className={cn(
				'flex h-9 shrink-0 items-center gap-1.5 whitespace-nowrap rounded-[11px] border px-3.5 text-[13px] font-semibold transition-colors',
				active
					? 'border-brand bg-brand text-white'
					: 'border-line bg-white text-ink-2',
				className,
			)}
			{...rest}
		>
			{children}
		</button>
	)
}
