import type { MetadataRoute } from 'next'

export default function manifest(): MetadataRoute.Manifest {
	return {
		id: '/',

		name: 'SmartCity — Smart Parking Uzbekistan',

		short_name: 'SmartCity',

		description:
			'O‘zbekistonda parking topish, bron qilish va parking sessiyasini boshqarish uchun smart platforma.',

		start_url: '/',

		scope: '/',

		display: 'standalone',

		background_color: '#f7fafc',

		theme_color: '#ffffff',

		orientation: 'portrait',

		categories: ['navigation', 'travel', 'utilities'],

		lang: 'uz',

		icons: [
			{
				src: '/icons/icon.svg',
				sizes: 'any',
				type: 'image/svg+xml',
				purpose: 'any',
			},

			{
				src: '/icons/maskable-icon.svg',
				sizes: 'any',
				type: 'image/svg+xml',
				purpose: 'maskable',
			},

			{
				src: '/icons/apple-touch-icon.png',
				sizes: '180x180',
				type: 'image/png',
				purpose: 'any',
			},
		],
	}
}
