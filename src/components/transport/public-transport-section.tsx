'use client'

import { Bus, Sparkles, TrainFront } from 'lucide-react'

import type {
	DemoBus,
	DemoMetroLine,
	DemoMicroOption,
} from '@/data/demo-transport'

export type PublicTransportTab = 'bus' | 'metro' | 'micro'

const TABS: { id: PublicTransportTab; label: string }[] = [
	{ id: 'bus', label: 'Avtobuslar' },
	{ id: 'metro', label: 'Metro' },
	{ id: 'micro', label: 'Mikromobillik' },
]

function occupancyTone(pct: number) {
	if (pct >= 75)
		return { bar: 'bg-bad', badge: 'bg-bad-bg text-bad', figure: 'text-bad' }
	if (pct >= 45)
		return { bar: 'bg-warn', badge: 'bg-warn-bg text-warn', figure: 'text-warn' }
	return { bar: 'bg-ok', badge: 'bg-ok-bg text-ok', figure: 'text-ok' }
}

// The little standing figure the occupancy row repeats.
function PersonGlyph({ className }: { className: string }) {
	return (
		<svg
			width='12'
			height='12'
			viewBox='0 0 24 24'
			fill='none'
			stroke='currentColor'
			strokeWidth='2.2'
			strokeLinecap='round'
			strokeLinejoin='round'
			className={className}
			aria-hidden='true'
		>
			<circle cx='12' cy='5' r='2.4' />
			<path d='M12 7.5v7M12 14.5 9 21M12 14.5 15 21M8 10h8' />
		</svg>
	)
}

function BusCard({ bus, onOpen }: { bus: DemoBus; onOpen: () => void }) {
	const tone = occupancyTone(bus.occupancyPct)
	// 20 figures, filled in proportion to how full the bus is. City Goo draws
	// this instead of a bar because "14 of 20 people" reads as crowding in a
	// way a 70% bar does not.
	const filled = Math.round(bus.occupancyPct / 5)

	return (
		<button
			type='button'
			onClick={onOpen}
			className={`w-full rounded-[18px] bg-white p-3.5 text-left shadow-card ${
				bus.recommended ? 'ring-2 ring-ok' : ''
			}`}
		>
			{bus.recommended && (
				<span className='mb-2 inline-flex items-center gap-1 rounded-full bg-ok-bg px-2 py-0.5 text-[10px] font-extrabold text-ok'>
					<Sparkles className='size-3' /> AI tavsiya qiladi
				</span>
			)}
			<div className='flex items-center gap-3'>
				<span className='grid size-9 shrink-0 place-items-center rounded-[13px] bg-[#eef2fb] text-info'>
					<Bus className='size-4.5' />
				</span>
				<div className='min-w-0 flex-1'>
					<p className='text-[14px] font-extrabold text-ink'>
						Avtobus {bus.number}
					</p>
					<p className='mt-0.5 text-[11.5px] text-ink-3'>
						{bus.arrivalMin} daqiqada · {bus.stops} bekat
					</p>
				</div>
				<span className={`shrink-0 rounded-full px-2 py-1 text-[11px] font-extrabold ${tone.badge}`}>
					{bus.occupancyPct}%
				</span>
			</div>

			<div className='mt-3 flex flex-wrap gap-1'>
				{Array.from({ length: 20 }, (_, index) => (
					<PersonGlyph
						key={index}
						className={index < filled ? tone.figure : 'text-line-2'}
					/>
				))}
			</div>

			<p className='mt-2 text-[11.5px] text-ink-3'>
				{bus.passengers} yo‘lovchi · {bus.seated} o‘rindiqli / {bus.standing} tik
			</p>
		</button>
	)
}

function MetroCard({ line }: { line: DemoMetroLine }) {
	const tone = occupancyTone(line.occupancyPct)
	return (
		<div className='rounded-[18px] bg-white p-3.5 shadow-card'>
			<div className='flex items-center gap-3'>
				<span
					className='grid size-9 shrink-0 place-items-center rounded-[13px] text-white'
					style={{ backgroundColor: line.color }}
				>
					<TrainFront className='size-4.5' />
				</span>
				<div className='min-w-0 flex-1'>
					<p className='text-[14px] font-extrabold text-ink'>{line.name}</p>
					<p className='mt-0.5 text-[11.5px] text-ink-3'>
						{line.arrivalMin} daqiqada · tavsiya etilgan vagon {line.recommendedCar}
					</p>
				</div>
				<span className={`shrink-0 rounded-full px-2 py-1 text-[11px] font-extrabold ${tone.badge}`}>
					{line.occupancyPct}%
				</span>
			</div>

			<div className='mt-3 flex gap-1.5'>
				{line.cars.map((car, index) => {
					const carTone = occupancyTone(car)
					return (
						<div key={index} className='flex-1 text-center'>
							<div
								className={`grid h-[26px] place-items-center rounded-md border-[1.5px] ${carTone.badge} ${
									index + 1 === line.recommendedCar
										? 'border-current'
										: 'border-transparent'
								}`}
							>
								<TrainFront className='size-3.5' />
							</div>
							<p className={`mt-1 text-[10px] font-bold ${carTone.figure}`}>
								{car}%
							</p>
							<p className='text-[10px] text-ink-3'>№{index + 1}</p>
						</div>
					)
				})}
			</div>

			<div className='mt-3 flex items-center gap-2.5 rounded-[14px] bg-brand-50 p-2.5'>
				<span className='grid size-6 shrink-0 place-items-center rounded-[9px] bg-brand text-white'>
					<Sparkles className='size-3.5' />
				</span>
				<p className='text-[12.5px] font-semibold text-ink-2'>
					{line.recommendedCar}-vagonga chiqing — eng bo‘sh.
				</p>
			</div>
		</div>
	)
}

function MicroCard({ option }: { option: DemoMicroOption }) {
	const Icon = option.icon
	return (
		<div className='flex items-center gap-3 rounded-[18px] bg-white p-3.5 shadow-card'>
			<span className='grid size-9 shrink-0 place-items-center rounded-[13px] bg-[#f3efff] text-brand'>
				<Icon className='size-4.5' />
			</span>
			<div className='min-w-0 flex-1'>
				<p className='text-[14px] font-extrabold text-ink'>{option.title}</p>
				{option.subtitle && <p className='mt-0.5 text-[11.5px] text-ink-3'>{option.subtitle}</p>}
				{option.badge && <p className='mt-1 text-[11px] font-bold text-ok'>{option.badge}</p>}
			</div>
			{option.note && (
				<span className='shrink-0 text-right text-[11px] text-ink-3'>
					{option.note}
				</span>
			)}
		</div>
	)
}

type PublicTransportSectionProps = {
	activeTab: PublicTransportTab
	onChangeTab: (tab: PublicTransportTab) => void
	buses: DemoBus[]
	onOpenBus: (bus: DemoBus) => void
	metroLines: DemoMetroLine[]
	microOptions: DemoMicroOption[]
}

export function PublicTransportSection({
	activeTab,
	onChangeTab,
	buses,
	onOpenBus,
	metroLines,
	microOptions,
}: PublicTransportSectionProps) {
	return (
		<section>
			<h2 className='px-1 text-[18px] font-extrabold tracking-[-0.01em] text-ink'>
				Jamoat transporti
			</h2>

			<div className='mt-2.5 flex gap-1 rounded-[15px] bg-card-2 p-1'>
				{TABS.map(tab => (
					<button
						key={tab.id}
						type='button'
						onClick={() => onChangeTab(tab.id)}
						className={`h-9 flex-1 rounded-xl text-[12.5px] font-bold transition duration-200 ${
							activeTab === tab.id
								? 'bg-white text-ink shadow-[0_1px_3px_rgba(16,24,40,.12)]'
								: 'text-ink-3'
						}`}
					>
						{tab.label}
					</button>
				))}
			</div>

			<div className='mt-2.5 space-y-2.5'>
				{activeTab === 'bus' &&
					buses.map(bus => (
						<BusCard key={bus.number} bus={bus} onOpen={() => onOpenBus(bus)} />
					))}
				{activeTab === 'metro' &&
					metroLines.map(line => <MetroCard key={line.name} line={line} />)}
				{activeTab === 'micro' &&
					microOptions.map(option => (
						<MicroCard key={option.title} option={option} />
					))}
			</div>

			<p className='mt-2 px-1 text-[10.5px] text-ink-3'>
				Namunaviy ma’lumot — jonli avtobus/metro joylashuvi B SPACE MVPda hali
				ulanmagan.
			</p>
		</section>
	)
}
