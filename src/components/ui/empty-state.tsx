import type { LucideIcon } from 'lucide-react'
import { ChevronRight } from 'lucide-react'
import Link from 'next/link'

import { cn } from '@/lib/cn'

// City Goo's empty card: icon, what is missing, and one way to fix it.
// Every Favorites tab, the bookings list and the parking list share it,
// so the action is required — an empty state with no exit is a dead end.
export function EmptyState({
	icon: Icon,
	title,
	text,
	href,
	action,
	className,
}: {
	icon: LucideIcon
	title: string
	text: string
	href: string
	action: string
	className?: string
}) {
	return (
		<div
			className={cn(
				'rounded-card-lg bg-card px-5 py-7 text-center shadow-card ring-1 ring-line',
				className,
			)}
		>
			<span className='mx-auto grid size-11 place-items-center rounded-[13px] bg-brand-50 text-brand'>
				<Icon className='size-5' />
			</span>
			<h2 className='mt-3 text-[14px] font-extrabold'>{title}</h2>
			<p className='mx-auto mt-2 max-w-67.5 text-[12px] leading-5 text-ink-3'>
				{text}
			</p>
			<Link
				href={href}
				className='mt-4 inline-flex h-9 items-center gap-1.5 rounded-[10px] bg-brand px-4 text-[12px] font-extrabold text-white'
			>
				{action} <ChevronRight className='size-3.5' />
			</Link>
		</div>
	)
}
