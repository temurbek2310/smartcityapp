'use client'

import { ChevronLeft } from 'lucide-react'
import type { ReactNode } from 'react'

import { cn } from '@/lib/cn'

// The screen header City Goo puts on every secondary screen: back, title
// over subtitle, one optional trailing action. Generalised out of
// TransportHeader, which was this exact shape bound to one screen —
// /parking, /queues and /news all need it too.
export function AppBar({
	title,
	subtitle,
	onBack,
	action,
	className,
}: {
	title: string
	subtitle?: string
	onBack?: () => void
	action?: ReactNode
	className?: string
}) {
	return (
		<div className={cn('flex items-center gap-3', className)}>
			{onBack && (
				<button
					type='button'
					onClick={onBack}
					aria-label='Ortga'
					className='citygo-pressable grid size-11 shrink-0 place-items-center rounded-2xl bg-white text-ink-2 shadow-card'
				>
					<ChevronLeft className='size-5' />
				</button>
			)}

			<div className='min-w-0 flex-1'>
				<h1 className='truncate text-[20px] font-extrabold tracking-[-0.02em] text-ink'>
					{title}
				</h1>
				{subtitle && (
					<p className='mt-0.5 truncate text-[12.5px] text-ink-3'>{subtitle}</p>
				)}
			</div>

			{action}
		</div>
	)
}
