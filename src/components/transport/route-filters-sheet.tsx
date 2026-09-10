'use client'

import { BottomSheet } from '@/components/ui/bottom-sheet'

export type RouteFilterId =
	| 'avoidTraffic'
	| 'avoidToll'
	| 'avoidUnpaved'
	| 'preferHighway'
	| 'evStops'

export const ROUTE_FILTERS: { id: RouteFilterId; label: string; sublabel: string }[] = [
	{ id: 'avoidTraffic', label: 'Tirbandlikdan qochish', sublabel: 'Band bo‘lgan yo‘llarni aylanib o‘tish' },
	{ id: 'avoidToll', label: 'Pullik yo‘llardan qochish', sublabel: 'Faqat bepul uchastkalar' },
	{ id: 'avoidUnpaved', label: 'Yomon qoplamadan qochish', sublabel: 'Chuqurlik va grunt yo‘llarni aylanib o‘tish' },
	{ id: 'preferHighway', label: 'Magistrallarni afzal ko‘rish', sublabel: 'Svetoforlar kamroq' },
	{ id: 'evStops', label: 'Yo‘ldagi EV-zaryadlash', sublabel: 'Marshrut bo‘yicha stansiyalarni ko‘rsatish' },
]

type RouteFiltersSheetProps = {
	open: boolean
	onClose: () => void
	filters: Record<RouteFilterId, boolean>
	onToggle: (id: RouteFilterId) => void
}

export function RouteFiltersSheet({
	open,
	onClose,
	filters,
	onToggle,
}: RouteFiltersSheetProps) {
	if (!open) return null

	return (
		<BottomSheet title='Marshrut filtrlari' onClose={onClose}>
			<div className='space-y-2'>
				{ROUTE_FILTERS.map(filter => {
					const on = filters[filter.id]
					return (
						<button
							key={filter.id}
							type='button'
							onClick={() => onToggle(filter.id)}
							className='flex w-full items-center gap-3 rounded-2xl bg-white p-3.5 text-left shadow-sm ring-1 ring-slate-200'
						>
							<span className='min-w-0 flex-1'>
								<span className='block text-[13.5px] font-bold text-slate-950'>
									{filter.label}
								</span>
								<span className='mt-0.5 block text-[11.5px] text-slate-400'>
									{filter.sublabel}
								</span>
							</span>
							<span
								className={`relative h-6.5 w-11 shrink-0 rounded-full transition ${
									on ? 'bg-[#6c47e0]' : 'bg-slate-200'
								}`}
							>
								<span
									className={`absolute top-0.75 size-5 rounded-full bg-white shadow transition ${
										on ? 'left-5' : 'left-0.75'
									}`}
								/>
							</span>
						</button>
					)
				})}
			</div>
			<p className='mt-4 text-[11.5px] leading-5 text-slate-400'>
				B SPACE MVPda hali real yo‘l grafigi yo‘q, shu sababli filtrlar
				muqobil marshrutlar ro‘yxatini qayta tartiblaydi — yangi marshrut
				hisoblanmaydi.
			</p>
		</BottomSheet>
	)
}
