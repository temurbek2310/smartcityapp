'use client'

import { Check, type LucideIcon } from 'lucide-react'

// City Goo's toast: a single element that stays mounted and is toggled with
// a class, so it slides both in and out. Its helper is
// `toast(m, i = 'check')` with the icon drawn at 18px / stroke 1.8 inside a
// #7DE0AE span, which is mirrored here.
export function Toast({
	open,
	message,
	icon: Icon = Check,
}: {
	open: boolean
	message: string
	icon?: LucideIcon
}) {
	return (
		<div className={`citygo-toast ${open ? 'is-on' : ''}`} role='status'>
			<Icon className='size-[18px] shrink-0 text-[#7de0ae]' strokeWidth={1.8} />
			<span className='min-w-0 flex-1'>{message}</span>
		</div>
	)
}
