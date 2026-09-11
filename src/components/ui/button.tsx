import type { ButtonHTMLAttributes, ReactNode } from 'react'

import { cn } from '@/lib/cn'

// City Goo's .btn and its modifiers. The default (no variant) is City Goo's
// bare .btn — a card-2 fill, used for secondary actions inside sheets.
type ButtonVariant = 'primary' | 'outline' | 'ghost'
type ButtonSize = 'xs' | 'sm' | 'md'

const SIZES: Record<ButtonSize, string> = {
	md: 'h-11 px-[18px] text-[14.5px] rounded-xl',
	sm: 'h-[34px] px-[13px] text-[12.5px] rounded-[9px]',
	xs: 'h-7 px-2.5 text-[11.5px] rounded-lg',
}

const VARIANTS: Record<ButtonVariant, string> = {
	primary: 'bg-brand text-white shadow-[0_6px_16px_rgb(108_71_224/.28)]',
	outline: 'bg-white border-[1.5px] border-line-2 text-ink',
	ghost: 'bg-card-2 text-ink',
}

export function Button({
	variant = 'ghost',
	size = 'md',
	block = false,
	danger = false,
	className,
	children,
	type = 'button',
	...rest
}: {
	variant?: ButtonVariant
	size?: ButtonSize
	block?: boolean
	// City Goo tints destructive actions rather than giving them a variant.
	danger?: boolean
	children?: ReactNode
} & ButtonHTMLAttributes<HTMLButtonElement>) {
	return (
		<button
			type={type}
			className={cn(
				'inline-flex items-center justify-center gap-[7px] font-[650] transition-transform active:scale-[.975] disabled:pointer-events-none disabled:opacity-45',
				SIZES[size],
				VARIANTS[variant],
				block && 'flex w-full',
				danger &&
					(variant === 'primary'
						? 'bg-bad text-white shadow-none'
						: 'text-bad'),
				className,
			)}
			{...rest}
		>
			{children}
		</button>
	)
}
