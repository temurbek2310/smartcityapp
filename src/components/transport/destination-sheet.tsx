'use client'

import { Check, ChevronRight, Search } from 'lucide-react'
import { useCallback, useMemo, useState } from 'react'

import { BottomSheet } from '@/components/ui/bottom-sheet'
import { DEMO_DESTINATIONS } from '@/data/demo-transport'

// City Goo design tokens used by this sheet's rows, copied from
// reference/city go.html rather than approximated:
//   --card #FFF · --card-2 #F7F8FC · --line #EAECF2 · --brand #6C47E0
//   --ink #0F172A · --ink-3 #8A91A6 · --r-lg 18px
//   --sh 0 1px 2px rgba(16,24,40,.04), 0 4px 14px rgba(16,24,40,.06)
const CARD_SHADOW =
	'shadow-[0_1px_2px_rgba(16,24,40,.04),0_4px_14px_rgba(16,24,40,.06)]'

type DestinationSheetProps = {
	open: boolean
	onClose: () => void
	onSelect: (id: string) => void
	// Id of the destination currently driving the route, or null while the
	// screen is still on its default parking.
	selectedId: string | null
	// The live location status the /transport page already derives from
	// useUserLocation — reused here so the sheet never invents an accuracy
	// or a second location system.
	currentLocationLabel: string
}

export function DestinationSheet({ open, ...props }: DestinationSheetProps) {
	// The body is mounted only while the sheet is open, so its search field
	// starts empty on every visit without a state-resetting effect.
	if (!open) return null
	return <DestinationSheetBody {...props} />
}

function DestinationSheetBody({
	onClose,
	onSelect,
	selectedId,
	currentLocationLabel,
}: Omit<DestinationSheetProps, 'open'>) {
	const [query, setQuery] = useState('')

	const subtitleFor = useCallback(
		(id: string, address?: string) =>
			id === 'me' ? currentLocationLabel : (address ?? ''),
		[currentLocationLabel],
	)

	// Filter on exactly the text each row shows, so the live location line
	// is searchable too and nothing matches that the user cannot see.
	const results = useMemo(() => {
		const needle = query.trim().toLowerCase()
		if (!needle) return DEMO_DESTINATIONS
		return DEMO_DESTINATIONS.filter(item =>
			`${item.title} ${subtitleFor(item.id, item.address)}`
				.toLowerCase()
				.includes(needle),
		)
	}, [query, subtitleFor])

	return (
		<BottomSheet title='Qayerga' onClose={onClose} slideUp>
			<div
				className={`mb-3 flex h-12 items-center gap-2.5 rounded-[15px] bg-white px-3.5 ${CARD_SHADOW}`}
			>
				<Search className='size-[19px] shrink-0 text-[#8a91a6]' />
				<input
					value={query}
					onChange={event => setQuery(event.target.value)}
					placeholder='Manzil yoki nomni kiriting'
					aria-label='Manzilni qidirish'
					className='min-w-0 flex-1 border-0 bg-transparent text-[14.5px] text-[#0f172a] outline-none placeholder:text-[#8a91a6]'
				/>
			</div>

			{results.length === 0 ? (
				<p
					className={`rounded-[18px] bg-white px-3.5 py-6 text-center text-[12.5px] leading-[1.4] text-[#8a91a6] ${CARD_SHADOW}`}
				>
					Mos manzil topilmadi.
				</p>
			) : (
				<div
					className={`overflow-hidden rounded-[18px] bg-white ${CARD_SHADOW}`}
				>
					{results.map((item, index) => {
						const Icon = item.icon
						const subtitle = subtitleFor(item.id, item.address)
						const selected = item.id === selectedId

						return (
							<button
								key={item.id}
								type='button'
								onClick={() => onSelect(item.id)}
								aria-current={selected ? 'true' : undefined}
								className={`flex w-full items-center gap-3 px-3.5 py-3 text-left ${
									index > 0 ? 'border-t border-[#eaecf2]' : ''
								}`}
							>
								<span className='grid size-10 shrink-0 place-items-center rounded-xl bg-[#f7f8fc]'>
									<Icon className='size-[18px] text-[#6c47e0]' />
								</span>
								<span className='min-w-0 flex-1'>
									<span className='block truncate text-[14px] font-semibold leading-[1.45] text-[#0f172a]'>
										{item.title}
									</span>
									<span className='mt-0.5 block truncate text-[11px] leading-[1.35] text-[#8a91a6]'>
										{subtitle}
									</span>
								</span>
								{/* City Goo marks the active row of a picker sheet by
								    swapping the chevron for a brand check —
								    ic('check',18,'var(--brand)',2.6). */}
								{selected ? (
									<Check
										className='size-[18px] shrink-0 text-[#6c47e0]'
										strokeWidth={2.6}
									/>
								) : (
									<ChevronRight className='size-[17px] shrink-0 text-[#8a91a6]' />
								)}
							</button>
						)
					})}
				</div>
			)}
		</BottomSheet>
	)
}
