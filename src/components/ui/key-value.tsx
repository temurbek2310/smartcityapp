import type { ReactNode } from 'react'

import { cn } from '@/lib/cn'

// City Goo's .kv — the label/value rows that make up every price breakdown,
// ticket summary and receipt. Rows draw their own divider between siblings,
// so the list needs no separators of its own.
export function KeyValueList({
	className,
	children,
}: {
	className?: string
	children?: ReactNode
}) {
	return <div className={className}>{children}</div>
}

export function KeyValue({
	label,
	value,
	className,
}: {
	label: ReactNode
	value: ReactNode
	className?: string
}) {
	return (
		<div
			className={cn(
				'flex justify-between gap-3 py-[9px] text-[13px] [&+&]:border-t [&+&]:border-line',
				className,
			)}
		>
			<span className='text-ink-2'>{label}</span>
			<b className='text-right font-[650]'>{value}</b>
		</div>
	)
}
