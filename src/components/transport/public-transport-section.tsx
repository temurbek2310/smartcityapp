'use client'

import type { DemoMicroOption } from '@/data/demo-transport'

// The demo bus and metro tabs are gone (Phase 4): public transport is now
// 2GIS's own journey under «Metro» (TransitRouteStatus). What remains is the
// list of micromobility options, which describes kinds of vehicle, not live
// operator data.

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

export function PublicTransportSection({
	microOptions,
}: {
	microOptions: DemoMicroOption[]
}) {
	return (
		<section>
			<h2 className='px-1 text-[18px] font-extrabold tracking-[-0.01em] text-ink'>
				Mikromobillik
			</h2>

			<div className='mt-2.5 space-y-2.5'>
				{microOptions.map(option => (
					<MicroCard key={option.title} option={option} />
				))}
			</div>
		</section>
	)
}
