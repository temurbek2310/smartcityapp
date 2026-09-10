'use client'

import { X } from 'lucide-react'
import { useEffect, type ReactNode } from 'react'

// Generic bottom sheet used by Home's sheets and the /transport filters
// panel — kept in one place so both stay visually identical.
export function BottomSheet({
	title,
	onClose,
	children,
	// Opt-in City Goo slide-up. Off by default so every sheet that already
	// uses this component keeps appearing exactly as it does today.
	slideUp = false,
}: {
	title: string
	onClose: () => void
	children: ReactNode
	slideUp?: boolean
}) {
	// Sheet mechanics belong to the primitive, not to each feature sheet:
	// Escape to close and a background scroll lock while one is open.
	useEffect(() => {
		function handleKeyDown(event: KeyboardEvent) {
			if (event.key === 'Escape') onClose()
		}

		const previousOverflow = document.body.style.overflow
		document.body.style.overflow = 'hidden'
		document.addEventListener('keydown', handleKeyDown)

		return () => {
			document.body.style.overflow = previousOverflow
			document.removeEventListener('keydown', handleKeyDown)
		}
	}, [onClose])

	return (
		<>
			<button
				type='button'
				aria-label='Oynani yopish'
				className={`fixed inset-0 z-70 bg-slate-950/45 backdrop-blur-[2px] ${
					slideUp ? 'animate-scrim-in' : ''
				}`}
				onClick={onClose}
			/>
			<section
				className={`fixed inset-x-0 bottom-0 z-80 mx-auto max-h-[88dvh] w-full max-w-md overflow-hidden rounded-t-[28px] bg-slate-50 shadow-2xl ${
					slideUp ? 'animate-sheet-up' : ''
				}`}
			>
				<div className='mx-auto mt-2.5 h-1 w-10 rounded-full bg-slate-300' />
				<div className='flex items-center justify-between gap-3 px-4 pb-3 pt-3'>
					<h2 className='text-xl font-black tracking-tight text-slate-950'>
						{title}
					</h2>
					<button
						type='button'
						onClick={onClose}
						className='grid size-10 place-items-center rounded-xl bg-white text-slate-700 shadow-sm ring-1 ring-slate-200'
						aria-label='Yopish'
					>
						<X className='size-5' />
					</button>
				</div>
				<div className='max-h-[calc(88dvh-68px)] overflow-y-auto px-4 pb-7'>
					{children}
				</div>
			</section>
		</>
	)
}
