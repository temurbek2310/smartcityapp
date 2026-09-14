'use client'

import { RotateCcw, TriangleAlert } from 'lucide-react'
import Link from 'next/link'
import { useEffect } from 'react'

// Every authed screen sits under this. Without it a throw anywhere in a
// client screen unmounts the tree and leaves a blank page — no nav, no way
// back. Realistic sources here are 2GIS MapGL failing to initialise, an old
// WebView without crypto.randomUUID, and any lookup that assumes an id
// exists.
export default function AppError({
	error,
	reset,
}: {
	error: Error & { digest?: string }
	reset: () => void
}) {
	useEffect(() => {
		console.error('[b-space] screen error', error)
	}, [error])

	return (
		<div className='flex min-h-[60dvh] flex-col items-center justify-center px-6 text-center'>
			<span className='grid size-14 place-items-center rounded-2xl bg-warn-bg text-warn'>
				<TriangleAlert className='size-7' />
			</span>

			<h1 className='mt-4 text-[17px] font-black text-ink'>
				Ekranni ochib bo‘lmadi
			</h1>
			<p className='mt-2 max-w-70 text-[12.5px] leading-5 text-ink-3'>
				Ma’lumotlar vaqtincha mavjud emas. Qaytadan urinib ko‘ring — bronlaringiz
				saqlanib qoladi.
			</p>

			{error.digest && (
				<p className='mt-3 font-mono text-[10.5px] text-ink-3 opacity-60'>
					{error.digest}
				</p>
			)}

			<button
				type='button'
				onClick={reset}
				className='mt-5 flex h-11 items-center gap-2 rounded-xl bg-brand px-5 text-[13px] font-black text-white'
			>
				<RotateCcw className='size-4' /> Qayta urinish
			</button>
			<Link
				href='/home'
				className='mt-3 text-[12.5px] font-bold text-ink-2'
			>
				Bosh sahifaga qaytish
			</Link>
		</div>
	)
}
