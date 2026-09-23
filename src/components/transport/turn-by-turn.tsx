'use client'

import { ChevronLeft, ChevronRight, ExternalLink, X } from 'lucide-react'
import { useEffect, useState } from 'react'

import type { TimelineStep } from '@/components/transport/route-timeline'
import { cn } from '@/lib/cn'
import { formatDistance, formatTime } from '@/lib/format'

// City Goo's navBox — the full-screen navigator behind "Yo'lga chiqish".
// It steps through the route the screen already computed rather than
// inventing a second one, so the minutes here and the minutes on the card
// can never disagree.
export function TurnByTurn({
	steps,
	minutes,
	navigateHref,
	onClose,
	onComplete,
}: {
	steps: TimelineStep[]
	minutes: number
	// The app has no road graph, so the hand-off to 2GIS stays available from
	// inside the navigator rather than being dropped. null when 2GIS has no
	// route type for the mode (scooter): the route then stays in B SPACE and
	// says so, instead of opening 2GIS on a different vehicle.
	navigateHref: string | null
	onClose: () => void
	onComplete?: () => void
}) {
	const [index, setIndex] = useState(0)

	// Escape leaves the navigator, like any full-screen overlay.
	useEffect(() => {
		const onKey = (event: KeyboardEvent) => {
			if (event.key === 'Escape') onClose()
		}
		window.addEventListener('keydown', onKey)
		const previousOverflow = document.body.style.overflow
		document.body.style.overflow = 'hidden'
		return () => {
			window.removeEventListener('keydown', onKey)
			document.body.style.overflow = previousOverflow
		}
	}, [onClose])

	// Deferred so the arrival clock does not differ between the server's
	// render and the client's.
	const [now, setNow] = useState<number | null>(null)
	useEffect(() => {
		const timer = window.setTimeout(() => setNow(Date.now()), 0)
		const clock = window.setInterval(() => setNow(Date.now()), 15_000)
		return () => { window.clearTimeout(timer); window.clearInterval(clock) }
	}, [])

	if (steps.length === 0) return null

	const current = steps[Math.min(index, steps.length - 1)]
	const maneuverDistance = current.distanceKm == null ? current.distanceLabel
		: formatDistance(Math.max(0, current.distanceKm - (steps[index - 1]?.distanceKm ?? 0)))
	const remainingSteps = steps.length - index - 1
	const Icon = current.icon

	// Arrival scales with how much of the route is left, so it moves as you
	// advance instead of standing still.
	const arrival =
		now === null
			? null
			: new Date(
					now + minutes * 60000 * ((remainingSteps + 1) / steps.length),
				)

	const last = index >= steps.length - 1

	return (
		<div
			role='dialog'
			aria-modal='true'
			aria-label='Navigatsiya'
			// h-dvh rather than inset-0: a horizontal scrollbar shrinks the fixed
			// viewport below the dynamic one, and inset-0 then stops a few pixels
			// short of the bottom nav, which shows through underneath.
			className='fixed inset-x-0 top-0 z-100 mx-auto flex h-dvh w-full max-w-md flex-col bg-ink text-white'
		>
			<div className='px-5 pb-4 pt-[max(1.25rem,env(safe-area-inset-top))]'>
				<div className='flex items-center justify-between gap-3'>
					<span className='rounded-[7px] bg-white/14 px-2 py-1 text-[11.5px] font-bold'>
						{index + 1} / {steps.length}-qadam
					</span>
					<button
						type='button'
						onClick={onClose}
						className='inline-flex items-center gap-1.5 rounded-[7px] bg-white/14 px-2 py-1 text-[11.5px] font-bold'
					>
						<X className='size-3' /> Yakunlash
					</button>
				</div>

				<div className='mt-5 flex items-center gap-4'>
					<span
						className='grid size-16 shrink-0 place-items-center rounded-[22px]'
						style={{ backgroundColor: current.tone }}
					>
						<Icon className='size-8 text-white' />
					</span>
					<div className='min-w-0 flex-1'>
						<p className='text-[24px] font-extrabold leading-tight tracking-[-0.02em]'>
							{current.title}
						</p>
						<p className='mt-1 text-[14px] text-white/70'>{current.subtitle}</p>
					</div>
				</div>

				<div className='mt-5 grid grid-cols-3 gap-3'>
					{[
						{ value: maneuverDistance, label: 'manyovrgacha' },
						{ value: String(minutes), label: 'daqiqa yo‘lda' },
						{
							value: arrival ? formatTime(arrival) : '—',
							label: 'yetib borish',
						},
					].map(tile => (
						<div
							key={tile.label}
							className='rounded-[14px] bg-white/9 px-2 py-3 text-center'
						>
							<p className='font-mono text-[19px] font-extrabold'>
								{tile.value}
							</p>
							<p className='mt-1 text-[10.5px] text-white/60'>{tile.label}</p>
						</div>
					))}
				</div>
			</div>

			<div className='min-h-0 flex-1 overflow-y-auto px-5'>
				<p className='py-2 text-[11px] font-bold uppercase tracking-[.14em] text-white/45'>
					Keyingi
				</p>
				{steps.map((step, stepIndex) => (
					<div
						key={`${step.title}-${stepIndex}`}
						className={cn(
							'flex items-center gap-3 border-t border-white/8 py-3',
							stepIndex <= index && 'opacity-40',
						)}
					>
						<span className='grid size-8 shrink-0 place-items-center rounded-[11px] bg-white/11'>
							<step.icon className='size-4' />
						</span>
						<span className='min-w-0 flex-1'>
							<span className='block truncate text-[13.5px] font-semibold'>
								{step.title}
							</span>
							<span className='mt-0.5 block truncate text-[11px] text-white/60'>
								{step.subtitle}
							</span>
						</span>
						<span className='shrink-0 font-mono text-[11.5px] text-white/60'>
							{step.distanceLabel}
						</span>
					</div>
				))}

				{navigateHref ? (
					<a
						href={navigateHref}
						target='_blank'
						rel='noreferrer'
						className='mt-3 flex items-center justify-center gap-1.5 rounded-xl bg-white/9 py-2.5 text-[12.5px] font-semibold text-white/75'
					>
						2GISda navigatsiyani boshlash
						<ExternalLink className='size-3.5' />
					</a>
				) : (
					<p className='mt-3 rounded-xl bg-white/9 px-3 py-2.5 text-center text-[12px] leading-5 text-white/65'>
						2GIS skuter marshrutini ochmaydi — navigatsiya B SPACE’da davom etadi.
					</p>
				)}
			</div>

			<div className='flex gap-2.5 px-5 pb-[max(1.5rem,env(safe-area-inset-bottom))] pt-3.5'>
				<button
					type='button'
					disabled={index === 0}
					onClick={() => { setNow(Date.now()); setIndex(value => Math.max(0, value - 1)) }}
					className='inline-flex h-11 shrink-0 items-center gap-1.5 rounded-xl bg-white/14 px-4 text-[14px] font-[650] disabled:opacity-35'
				>
					<ChevronLeft className='size-4' /> Ortga
				</button>
				<button
					type='button'
					onClick={() => {
						setNow(Date.now())
						if (last) (onComplete ?? onClose)()
						else setIndex(value => value + 1)
					}}
					className='inline-flex h-11 flex-1 items-center justify-center gap-1.5 rounded-xl bg-brand text-[14px] font-[650]'
				>
					{last ? 'Yakunlash' : 'Keyingi qadam'}
					<ChevronRight className='size-4' />
				</button>
			</div>
		</div>
	)
}
