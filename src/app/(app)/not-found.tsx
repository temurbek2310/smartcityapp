import { MapPinOff } from 'lucide-react'
import Link from 'next/link'

// Reached by notFound() from the dynamic screens when an id names nothing —
// a parking, reservation or receipt that does not exist.
export default function AppNotFound() {
	return (
		<div className='flex min-h-[60dvh] flex-col items-center justify-center px-6 text-center'>
			<span className='grid size-14 place-items-center rounded-2xl bg-card-2 text-ink-3'>
				<MapPinOff className='size-7' />
			</span>
			<h1 className='mt-4 text-[17px] font-black text-ink'>Topilmadi</h1>
			<p className='mt-2 max-w-70 text-[12.5px] leading-5 text-ink-3'>
				Bu sahifa mavjud emas yoki o‘chirilgan bo‘lishi mumkin.
			</p>
			<Link
				href='/home'
				className='mt-5 flex h-11 items-center rounded-xl bg-brand px-5 text-[13px] font-black text-white'
			>
				Bosh sahifaga qaytish
			</Link>
		</div>
	)
}
