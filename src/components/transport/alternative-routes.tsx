'use client'

const TONE_TEXT: Record<'ok' | 'warn' | 'bad', string> = {
	ok: 'text-emerald-600',
	warn: 'text-amber-600',
	bad: 'text-rose-500',
}

export type AlternativeRoute = {
	title: string
	distanceKm: number
	minutes: number
	trafficLabel: string
	trafficTone: 'ok' | 'warn' | 'bad'
	note: string
	best?: boolean
}

type AlternativeRoutesProps = {
	routes: AlternativeRoute[]
	selectedIndex: number
	onSelect: (index: number) => void
}

export function AlternativeRoutes({
	routes,
	selectedIndex,
	onSelect,
}: AlternativeRoutesProps) {
	return (
		<section>
			<h2 className='px-1 text-[18px] font-extrabold tracking-[-0.01em] text-slate-950'>
				Muqobil marshrutlar
			</h2>

			<div className='mt-2.5 space-y-2.5'>
				{routes.map((route, index) => {
					const selected = index === selectedIndex
					return (
						<button
							key={route.title}
							type='button'
							onClick={() => onSelect(index)}
							className={`flex w-full items-start gap-3 rounded-[18px] bg-white p-3.5 text-left shadow-card ring-2 ${
								selected ? 'ring-brand' : 'ring-transparent'
							}`}
						>
							<span
								className={`grid size-9 shrink-0 place-items-center rounded-[13px] text-[13px] font-black ${
									selected
										? 'bg-brand text-white'
										: 'bg-card-2 text-slate-500'
								}`}
							>
								{index + 1}
							</span>

							<div className='min-w-0 flex-1'>
								<div className='flex items-start justify-between gap-2'>
									<p className='text-[14px] font-extrabold text-slate-950'>
										{route.title}
									</p>
									{route.best && (
										<span className='shrink-0 rounded-full bg-ok-bg px-2 py-0.5 text-[10px] font-extrabold text-emerald-700'>
											Tezroq
										</span>
									)}
								</div>
								<div className='mt-1 flex items-center gap-2 text-[12.5px]'>
									<span className='text-ink-3'>
										{route.distanceKm.toFixed(1)} km
									</span>
									<span className={`font-extrabold ${TONE_TEXT[route.trafficTone]}`}>
										{route.minutes} daq
									</span>
								</div>
								<p className={`mt-0.5 text-[12px] font-semibold ${TONE_TEXT[route.trafficTone]}`}>
									{route.trafficLabel}
								</p>
								<p className='mt-1 text-[11.5px] text-ink-3'>{route.note}</p>
							</div>
						</button>
					)
				})}
			</div>
		</section>
	)
}
