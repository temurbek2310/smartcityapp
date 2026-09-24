'use client'

import { LocateFixed, MapPinOff } from 'lucide-react'

import { useLocation } from '@/context/location-context'
import { cn } from '@/lib/cn'
import { locationProblem } from '@/lib/location'

// The one line a screen shows about location while it has no fix: an
// invitation before anything was asked, the reason after an attempt failed.
// Silent while a fix exists, is being fetched, or the browser has not yet
// said what it allows.
export function LocationNotice({ className }: { className?: string }) {
	const location = useLocation()
	if (location.position || location.status === 'loading') return null
	if (location.permission === 'checking') return null

	const problem = locationProblem(location)
	const denied = location.permission === 'denied' || location.error === 'denied'

	if (!problem) {
		return (
			<div className={cn('flex items-center gap-3 rounded-2xl bg-brand-50 p-3', className)}>
				<LocateFixed className='size-4 shrink-0 text-brand' />
				<p className='min-w-0 flex-1 text-xs leading-5 text-ink-2'>
					Joylashuv aniqlanmagan — masofalar ko‘rsatilmaydi.
				</p>
				<button
					type='button'
					onClick={location.requestLocation}
					className='shrink-0 text-xs font-black text-brand'
				>
					Joylashuvni yoqish
				</button>
			</div>
		)
	}

	return (
		<div
			role='status'
			className={cn('flex items-start gap-3 rounded-2xl bg-warn-bg p-3', className)}
		>
			<MapPinOff className='mt-0.5 size-4 shrink-0 text-warn' />
			<p className='min-w-0 flex-1 text-xs leading-5 text-warn'>
				<b className='font-black'>{problem.title}.</b> {problem.text}
			</p>
			{location.error !== 'unsupported' && location.error !== 'outside-uzbekistan' && (
				<button
					type='button'
					onClick={denied ? () => void location.recheckLocation() : location.requestLocation}
					className='shrink-0 text-xs font-black text-warn underline'
				>
					{denied ? 'Qayta tekshirish' : 'Qayta urinish'}
				</button>
			)}
		</div>
	)
}
