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
	if (pct >= 75) return { bar: 'bg-rose-500', badge: 'bg-rose-50 text-rose-600' }
	if (pct >= 45) return { bar: 'bg-amber-500', badge: 'bg-amber-50 text-amber-600' }
	return { bar: 'bg-emerald-500', badge: 'bg-emerald-50 text-emerald-600' }
}

function BusCard({ bus }: { bus: DemoBus }) {
	const tone = occupancyTone(bus.occupancyPct)
	return (
		<div
			className={`rounded-[18px] bg-white p-3.5 shadow-[0_1px_2px_rgba(16,24,40,.04),0_4px_14px_rgba(16,24,40,.06)] ${
				bus.recommended ? 'ring-2 ring-emerald-400' : ''
			}`}
		>
			{bus.recommended && (
				<span className='mb-2 inline-flex items-center gap-1 rounded-full bg-emerald-50 px-2 py-0.5 text-[10px] font-extrabold text-emerald-700'>
					<Sparkles className='size-3' /> AI tavsiya qiladi
				</span>
			)}
			<div className='flex items-center gap-3'>
				<span className='grid size-9 shrink-0 place-items-center rounded-[13px] bg-[#eef2fb] text-[#2e90fa]'>
					<Bus className='size-4.5' />
				</span>
				<div className='min-w-0 flex-1'>
					<p className='text-[14px] font-extrabold text-slate-950'>
						Avtobus {bus.number}
					</p>
					<p className='mt-0.5 text-[11.5px] text-[#8a91a6]'>
						{bus.arrivalMin} daqiqada · {bus.stops} bekat
					</p>
				</div>
				<span className={`shrink-0 rounded-full px-2 py-1 text-[11px] font-extrabold ${tone.badge}`}>
					{bus.occupancyPct}%
				</span>
			</div>

			<div className='mt-3 h-1.5 overflow-hidden rounded-full bg-[#eaecf2]'>
				<span
					className={`block h-full rounded-full ${tone.bar}`}
					style={{ width: `${bus.occupancyPct}%` }}
				/>
			</div>

			<p className='mt-2 text-[11.5px] text-[#8a91a6]'>
				{bus.passengers} yo‘lovchi · {bus.seated} o‘rindiqli / {bus.standing} tik
			</p>
		</div>
	)
}

function MetroCard({ line }: { line: DemoMetroLine }) {
	const tone = occupancyTone(line.occupancyPct)
	return (
		<div className='rounded-[18px] bg-white p-3.5 shadow-[0_1px_2px_rgba(16,24,40,.04),0_4px_14px_rgba(16,24,40,.06)]'>
			<div className='flex items-center gap-3'>
				<span
					className='grid size-9 shrink-0 place-items-center rounded-[13px] text-white'
					style={{ backgroundColor: line.color }}
				>
					<TrainFront className='size-4.5' />
				</span>
				<div className='min-w-0 flex-1'>
					<p className='text-[14px] font-extrabold text-slate-950'>{line.name}</p>
					<p className='mt-0.5 text-[11.5px] text-[#8a91a6]'>
						{line.arrivalMin} daqiqada · tavsiya etilgan vagon {line.recommendedCar}
					</p>
				</div>
				<span className={`shrink-0 rounded-full px-2 py-1 text-[11px] font-extrabold ${tone.badge}`}>
					{line.occupancyPct}%
				</span>
			</div>
		</div>
	)
}

function MicroCard({ option }: { option: DemoMicroOption }) {
	const Icon = option.icon
	return (
		<div className='flex items-center gap-3 rounded-[18px] bg-white p-3.5 shadow-[0_1px_2px_rgba(16,24,40,.04),0_4px_14px_rgba(16,24,40,.06)]'>
			<span className='grid size-9 shrink-0 place-items-center rounded-[13px] bg-[#f3efff] text-[#6c47e0]'>
				<Icon className='size-4.5' />
			</span>
			<div className='min-w-0 flex-1'>
				<p className='text-[14px] font-extrabold text-slate-950'>{option.title}</p>
				<p className='mt-0.5 text-[11.5px] text-[#8a91a6]'>{option.subtitle}</p>
				<p className='mt-1 text-[11px] font-bold text-emerald-600'>{option.badge}</p>
			</div>
			<span className='shrink-0 text-right text-[11px] text-[#8a91a6]'>
				{option.note}
			</span>
		</div>
	)
}

type PublicTransportSectionProps = {
	activeTab: PublicTransportTab
	onChangeTab: (tab: PublicTransportTab) => void
	buses: DemoBus[]
	metroLines: DemoMetroLine[]
	microOptions: DemoMicroOption[]
}

export function PublicTransportSection({
	activeTab,
	onChangeTab,
	buses,
	metroLines,
	microOptions,
}: PublicTransportSectionProps) {
	return (
		<section>
			<h2 className='px-1 text-[18px] font-extrabold tracking-[-0.01em] text-slate-950'>
				Jamoat transporti
			</h2>

			<div className='mt-2.5 flex gap-1 rounded-[15px] bg-[#f7f8fc] p-1'>
				{TABS.map(tab => (
					<button
						key={tab.id}
						type='button'
						onClick={() => onChangeTab(tab.id)}
						className={`h-9 flex-1 rounded-xl text-[12.5px] font-bold transition ${
							activeTab === tab.id
								? 'bg-white text-slate-950 shadow-[0_1px_3px_rgba(16,24,40,.12)]'
								: 'text-[#8a91a6]'
						}`}
					>
						{tab.label}
					</button>
				))}
			</div>

			<div className='mt-2.5 space-y-2.5'>
				{activeTab === 'bus' &&
					buses.map(bus => <BusCard key={bus.number} bus={bus} />)}
				{activeTab === 'metro' &&
					metroLines.map(line => <MetroCard key={line.name} line={line} />)}
				{activeTab === 'micro' &&
					microOptions.map(option => (
						<MicroCard key={option.title} option={option} />
					))}
			</div>

			<p className='mt-2 px-1 text-[10.5px] text-[#8a91a6]'>
				Namunaviy ma’lumot — jonli avtobus/metro joylashuvi B SPACE MVPda hali
				ulanmagan.
			</p>
		</section>
	)
}
