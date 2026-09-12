import { Sparkles } from 'lucide-react'
import type { ReactNode } from 'react'

import { cn } from '@/lib/cn'

// City Goo's .ai — the gradient advice box. It appears on Home, on both
// forecast charts and in the profile stats sheet, always meaning the same
// thing: a suggestion derived from data rather than a fact.
export function AiCallout({
	title = 'AI tavsiya',
	action,
	className,
	children,
}: {
	title?: ReactNode
	action?: ReactNode
	className?: string
	children?: ReactNode
}) {
	return (
		<div
			className={cn(
				'flex gap-[11px] rounded-[15px] border border-[#e4dbfb] bg-linear-[135deg,#f3efff,#edf5ff] p-[13px]',
				className,
			)}
		>
			<span className='grid size-[34px] shrink-0 place-items-center rounded-[11px] bg-brand text-white'>
				<Sparkles className='size-5' />
			</span>

			<div className='min-w-0 flex-1'>
				<div className='text-[12.5px] font-bold text-brand'>{title}</div>
				<div className='mt-1 text-[12.5px] leading-[1.4] text-ink-2'>
					{children}
				</div>
				{action && <div className='mt-3'>{action}</div>}
			</div>
		</div>
	)
}
