'use client'

import { Search, X } from 'lucide-react'
import type { InputHTMLAttributes, ReactNode } from 'react'

import { cn } from '@/lib/cn'

// City Goo's .search — the 48px pill. The clear button only appears once
// there is something to clear, matching the reference's #qclear.
export function SearchField({
	value,
	onValueChange,
	onClear,
	trailing,
	className,
	...rest
}: {
	value: string
	onValueChange: (next: string) => void
	onClear?: () => void
	trailing?: ReactNode
	className?: string
} & Omit<InputHTMLAttributes<HTMLInputElement>, 'value' | 'onChange'>) {
	return (
		<div
			className={cn(
				'flex h-12 items-center gap-2.5 rounded-[15px] bg-white px-3.5 shadow-card',
				className,
			)}
		>
			<Search className='size-[18px] shrink-0 text-ink-3' />
			<input
				value={value}
				onChange={event => onValueChange(event.target.value)}
				className='min-w-0 flex-1 border-0 bg-transparent text-[14.5px] text-ink outline-none placeholder:text-ink-3'
				{...rest}
			/>
			{value && (
				<button
					type='button'
					aria-label='Tozalash'
					onClick={() => {
						onValueChange('')
						onClear?.()
					}}
					className='grid size-6 shrink-0 place-items-center rounded-full bg-card-2 text-ink-3'
				>
					<X className='size-3.5' />
				</button>
			)}
			{trailing}
		</div>
	)
}
