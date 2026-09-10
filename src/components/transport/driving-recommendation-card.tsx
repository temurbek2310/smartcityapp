'use client'

type DrivingRecommendationCardProps = {
	title: string
	explain: string
	value: string
	unit: string
}

export function DrivingRecommendationCard({
	title,
	explain,
	value,
	unit,
}: DrivingRecommendationCardProps) {
	return (
		<section className='flex items-center gap-3 rounded-[20px] bg-white p-4 shadow-[0_1px_2px_rgba(16,24,40,.04),0_4px_14px_rgba(16,24,40,.06)]'>
			<div className='min-w-0 flex-1'>
				<p className='text-[11.5px] font-extrabold text-[#6c47e0]'>
					Tavsiya · AI
				</p>
				<p className='mt-1 text-[16px] font-extrabold text-slate-950'>{title}</p>
				<p className='mt-1 text-[12.5px] leading-5 text-slate-500'>{explain}</p>
			</div>

			<div className='grid shrink-0 place-items-center rounded-[16px] bg-[#e7f8f0] px-4 py-3 text-center'>
				<p className='text-[19px] font-black leading-tight text-[#12b76a]'>
					{value}
				</p>
				<p className='mt-0.5 text-[10.5px] font-bold text-[#0d9257]'>{unit}</p>
			</div>
		</section>
	)
}
