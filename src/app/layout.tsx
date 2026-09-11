import 'maplibre-gl/dist/maplibre-gl.css'
import type { Metadata, Viewport } from 'next'
import './globals.css'

import { InstallAppPrompt } from '@/components/pwa/install-app-prompt'
import { StructuredData } from '@/components/seo/structured-data'
import { AppProvider } from '@/context/app-context'

const siteUrl = process.env.NEXT_PUBLIC_SITE_URL || 'http://localhost:3000'

export const metadata: Metadata = {
	metadataBase: new URL(siteUrl),

	title: {
		default: 'B SPACE — Smart Parking in Uzbekistan',
		template: '%s | B SPACE',
	},

	description:
		'B SPACE — O‘zbekistonda parking topish, bo‘sh joylarni ko‘rish, oldindan bron qilish va parking sessiyasini boshqarish uchun smart parking platformasi.',

	applicationName: 'B SPACE',

	keywords: [
		'B SPACE',
		'parking Uzbekistan',
		'parking Toshkent',
		'Toshkent parking',
		'avtoturargoh',
		'parking bron qilish',
		'smart parking',
		'bo‘sh parking',
	],

	authors: [
		{
			name: 'B SPACE',
		},
	],

	creator: 'B SPACE',
	publisher: 'B SPACE',

	category: 'technology',

	alternates: {
		canonical: '/',
	},

	icons: {
		icon: [
			{
				url: '/icons/icon.svg',
				type: 'image/svg+xml',
			},
		],

		shortcut: '/icons/icon.svg',

		apple: [
			{
				url: '/icons/apple-touch-icon.png',
				sizes: '180x180',
				type: 'image/png',
			},
		],
	},

	manifest: '/manifest.webmanifest',

	openGraph: {
		type: 'website',
		locale: 'uz_UZ',

		url: '/',

		siteName: 'B SPACE',

		title: 'B SPACE — Smart Parking in Uzbekistan',

		description:
			'Parking toping, bo‘sh joylarni tekshiring, bron qiling va parking sessiyangizni B SPACE orqali boshqaring.',

		images: [
			{
				url: '/og/b-space-og.png',
				width: 1200,
				height: 630,
				alt: 'B SPACE Smart Parking Uzbekistan',
			},
		],
	},

	twitter: {
		card: 'summary_large_image',

		title: 'B SPACE — Smart Parking in Uzbekistan',

		description:
			'O‘zbekistonda parking topish va bron qilish uchun smart platforma.',

		images: ['/og/b-space-og.png'],
	},

	robots: {
		index: true,
		follow: true,

		googleBot: {
			index: true,
			follow: true,

			'max-image-preview': 'large',
			'max-snippet': -1,
			'max-video-preview': -1,
		},
	},

	appleWebApp: {
		capable: true,
		title: 'B SPACE',
		statusBarStyle: 'default',
	},

	formatDetection: {
		telephone: false,
		email: false,
		address: false,
	},
}

export const viewport: Viewport = {
	width: 'device-width',
	initialScale: 1,

	themeColor: '#ffffff',

	colorScheme: 'light',
}

export default function RootLayout({
	children,
}: Readonly<{
	children: React.ReactNode
}>) {
	return (
		<html lang='uz'>
			<body>
				<StructuredData />
				<AppProvider>
					{children}

					<InstallAppPrompt />
				</AppProvider>
			</body>
		</html>
	)
}
