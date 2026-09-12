import type { ReactNode } from 'react'

import { cn } from '@/lib/cn'

// City Goo's .sec-head — the title row above every section, with an
// optional count badge and a trailing action link.
export function SectionHeader({
	title,
	count,
	action,
	onAction,
	href,
	className,
}: {
	title: ReactNode
	count?: number
	action?: ReactNode
	onAction?: () => void
	href?: string
	className?: string
}) {
	return (
		<div
			className={cn('flex items-baseline justify-between gap-3', className)}
		>
			<h2 className='m-0 flex items-baseline gap-2 text-[18px] font-[750] tracking-[-.3px]'>
				{title}
				{count !== undefined && (
					<span className='text-[13px] font-semibold text-ink-3'>{count}</span>
				)}
			</h2>

			{action &&
				(href ? (
					<a
						href={href}
						className='flex items-center gap-0.5 text-[13px] font-semibold text-brand'
					>
						{action}
					</a>
				) : (
					<button
						type='button'
						onClick={onAction}
						className='flex items-center gap-0.5 text-[13px] font-semibold text-brand'
					>
						{action}
					</button>
				))}
		</div>
	)
}
