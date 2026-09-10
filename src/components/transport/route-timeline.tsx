'use client'

import { ExternalLink, type LucideIcon } from 'lucide-react'

export type TimelineStep = {
	icon: LucideIcon
	tone: string
	title: string
	subtitle: string
	distanceLabel: string
	note?: string
}

type RouteTimelineProps = {
	steps: TimelineStep[]
	navigateHref: string
}

// Reusable vertical route timeline — used once by /transport, kept as its
// own component instead of inline JSX per-step as requested.
export function RouteTimeline({ steps, navigateHref }: RouteTimelineProps) {
	return (
		<section>
			<div className='flex items-baseline justify-between px-1'>
				<h2 className='text-[18px] font-extrabold tracking-[-0.01em] text-slate-950'>
					Marshrut tafsilotlari
				</h2>
				<a
					href={navigateHref}
					target='_blank'
					rel='noreferrer'
					className='inline-flex items-center gap-1 text-[12.5px] font-bold text-[#6c47e0]'
				>
					Yo‘lga chiqish
					<ExternalLink className='size-3.5' />
				</a>
			</div>

			<div className='mt-2.5 rounded-[20px] bg-white p-3.5 shadow-[0_1px_2px_rgba(16,24,40,.04),0_4px_14px_rgba(16,24,40,.06)]'>
				{steps.map((step, index) => {
					const Icon = step.icon
					const isLast = index === steps.length - 1
					return (
						<div key={`${step.title}-${index}`} className='flex gap-3'>
							<div className='flex flex-col items-center'>
								<span
									className='grid size-9 shrink-0 place-items-center rounded-full border-2 bg-white'
									style={{ borderColor: step.tone, color: step.tone }}
								>
									<Icon className='size-4' />
								</span>
								{!isLast && (
									<span className='my-0.5 w-0.5 flex-1 bg-[#eaecf2]' />
								)}
							</div>

							<div className={`min-w-0 flex-1 ${isLast ? 'pb-0' : 'pb-4'}`}>
								<div className='flex items-start justify-between gap-2'>
									<p className='text-[14px] font-extrabold text-slate-950'>
										{step.title}
									</p>
									<span className='shrink-0 pt-0.5 text-[11.5px] font-semibold text-[#8a91a6]'>
										{step.distanceLabel}
									</span>
								</div>
								<p className='mt-0.5 text-[12.5px] text-[#8a91a6]'>
									{step.subtitle}
								</p>
								{step.note && (
									<p className='mt-1 text-[11.5px] leading-5 text-slate-500'>
										{step.note}
									</p>
								)}
							</div>
						</div>
					)
				})}
			</div>
		</section>
	)
}
