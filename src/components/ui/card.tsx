import type { ElementType, ReactNode } from 'react'

import { cn } from '@/lib/cn'

// City Goo's .card, .card.flat and .card.p0.
//
// "bare" is .p0: no padding and clipped, for cards whose first child is a
// full-bleed photo or a list that draws its own dividers.
type CardVariant = 'raised' | 'flat' | 'bare'

const VARIANTS: Record<CardVariant, string> = {
	raised: 'bg-card rounded-card-lg shadow-card p-3.5',
	flat: 'bg-card rounded-card-lg border border-line p-3.5',
	bare: 'bg-card rounded-card-lg shadow-card overflow-hidden',
}

export function Card({
	variant = 'raised',
	as: Tag = 'div',
	className,
	children,
	...rest
}: {
	variant?: CardVariant
	as?: ElementType
	className?: string
	children?: ReactNode
} & Record<string, unknown>) {
	return (
		<Tag className={cn(VARIANTS[variant], className)} {...rest}>
			{children}
		</Tag>
	)
}
