import type { ButtonHTMLAttributes, ReactNode } from 'react'

import { cn } from '@/lib/cn'

// City Goo's .iconbtn — a floating 38px square. `badge` renders the small
// count City Goo puts on the notification bell and the filter button.
export function IconButton({
	label,
	badge,
	className,
	children,
	type = 'button',
	...rest
}: {
	// Icon-only, so an accessible name is required rather than optional.
	label: string
	badge?: number
	children?: ReactNode
} & ButtonHTMLAttributes<HTMLButtonElement>) {
	return (
		<button
			type={type}
			aria-label={label}
			className={cn(
				'relative grid size-[38px] shrink-0 place-items-center rounded-xl bg-white shadow-card',
				className,
			)}
			{...rest}
		>
			{children}
			{badge !== undefined && badge > 0 && (
				<span className='absolute -right-1 -top-1 grid min-w-[18px] place-items-center rounded-full bg-brand px-1 text-[10px] font-black text-white'>
					{badge > 9 ? '9+' : badge}
				</span>
			)}
		</button>
	)
}
