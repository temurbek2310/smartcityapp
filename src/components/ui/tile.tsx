import type { ButtonHTMLAttributes, ReactNode } from 'react'

import { cn } from '@/lib/cn'

// City Goo's .tile — the icon-over-label square used by Home's category
// grid and the amenities grids. `tone` tints the icon plate; `dimmed`
// renders a capability the venue does not have, which the reference shows
// at .32 opacity rather than hiding.
export function Tile({
	label,
	tone = 'bg-card-2 text-ink-2',
	active = false,
	dimmed = false,
	className,
	children,
	type = 'button',
	...rest
}: {
	label: ReactNode
	tone?: string
	active?: boolean
	dimmed?: boolean
	children?: ReactNode
} & ButtonHTMLAttributes<HTMLButtonElement>) {
	return (
		<button
			type={type}
			className={cn(
				'flex cursor-pointer flex-col items-center gap-[7px] text-center',
				dimmed && 'opacity-[.32]',
				className,
			)}
			{...rest}
		>
			<span
				className={cn(
					'grid size-12 place-items-center rounded-2xl transition-transform active:scale-[.92]',
					tone,
					active && 'shadow-[0_0_0_2.5px_var(--color-brand)]',
				)}
			>
				{children}
			</span>
			<span
				className={cn(
					'text-[11px] leading-[1.25]',
					active ? 'font-[750] text-brand' : 'font-semibold text-ink-2',
				)}
			>
				{label}
			</span>
		</button>
	)
}
