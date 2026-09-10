'use client'

import { ChevronRight, type LucideIcon } from 'lucide-react'
import Link from 'next/link'

export type RouteNotice = {
	icon: LucideIcon
	tone: 'ok' | 'warn' | 'brand'
	title: string
	message: string
	href?: string
	// Notices that act on this screen (booking the destination parking)
	// pass a handler instead of a link.
	onSelect?: () => void
}

const TONE_BG: Record<RouteNotice['tone'], string> = {
	ok: 'bg-[#e7f8f0] text-[#12b76a]',
	warn: 'bg-[#fef4e5] text-[#f79009]',
	brand: 'bg-[#ede7fe] text-[#6c47e0]',
}

function NoticeCard({ notice }: { notice: RouteNotice }) {
	const Icon = notice.icon
	const content = (
		<div className='flex items-center gap-3 rounded-[18px] bg-white p-3.5 shadow-[0_1px_2px_rgba(16,24,40,.04),0_4px_14px_rgba(16,24,40,.06)]'>
			<span className={`grid size-10 shrink-0 place-items-center rounded-[13px] ${TONE_BG[notice.tone]}`}>
				<Icon className='size-4.5' />
			</span>
			<div className='min-w-0 flex-1'>
				<p className='text-[13.5px] font-extrabold text-slate-950'>
					{notice.title}
				</p>
				<p className='mt-0.5 text-[12px] leading-5 text-[#8a91a6]'>
					{notice.message}
				</p>
			</div>
			{(notice.href || notice.onSelect) && (
				<ChevronRight className='size-4 shrink-0 text-[#8a91a6]' />
			)}
		</div>
	)

	if (notice.onSelect) {
		return (
			<button type='button' onClick={notice.onSelect} className='block w-full text-left'>
				{content}
			</button>
		)
	}
	if (!notice.href) return content
	return <Link href={notice.href}>{content}</Link>
}

export function RouteNotices({ notices }: { notices: RouteNotice[] }) {
	return (
		<section>
			<h2 className='px-1 text-[18px] font-extrabold tracking-[-0.01em] text-slate-950'>
				Bildirishnomalar
			</h2>
			<div className='mt-2.5 space-y-2.5'>
				{notices.map(notice => (
					<NoticeCard key={notice.title} notice={notice} />
				))}
			</div>
		</section>
	)
}
