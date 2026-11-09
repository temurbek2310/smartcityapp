import type { Metadata, Viewport } from 'next'
import { Inter, JetBrains_Mono } from 'next/font/google'
import './globals.css'

import { InstallAppPrompt } from '@/components/pwa/install-app-prompt'
import { StructuredData } from '@/components/seo/structured-data'
import { AppProvider } from '@/context/app-context'
import { LocationProvider } from '@/context/location-context'

// City Goo's typeface. next/font self-hosts the files, so there is no
// request to Google at runtime and nothing for the service worker to miss.
//
// `latin` is the right subset even though the copy is Uzbek: Uzbek Latin
// needs U+02BB (the turned comma in "soʻm", "boʻsh"), which Google includes
// in the latin subset. Cyrillic would ship weight this app never renders.
const inter = Inter({
	subsets: ['latin'],
	variable: '--font-inter',
	display: 'swap',
})

// Reserved for the things that are read as codes rather than prose: the
// session countdown, plates, reservation and booking ids, bay numbers.
const mono = JetBrains_Mono({
	subsets: ['latin'],
	variable: '--font-mono-face',
	display: 'swap',
})

const siteUrl = process.env.NEXT_PUBLIC_SITE_URL || 'http://localhost:3000'

export const metadata: Metadata = {
	metadataBase: new URL(siteUrl),

	title: {
		default: 'SmartCity — Smart Parking in Uzbekistan',
		template: '%s | SmartCity',
	},

	description:
		'SmartCity — O‘zbekistonda parking topish, bo‘sh joylarni ko‘rish, oldindan bron qilish va parking sessiyasini boshqarish uchun smart parking platformasi.',

	applicationName: 'SmartCity',

	keywords: [
		'SmartCity',
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
			name: 'SmartCity',
		},
	],

	creator: 'SmartCity',
	publisher: 'SmartCity',

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

		siteName: 'SmartCity',

		title: 'SmartCity — Smart Parking in Uzbekistan',

		description:
			'Parking toping, bo‘sh joylarni tekshiring, bron qiling va parking sessiyangizni SmartCity orqali boshqaring.',

		images: [
			{
				url: '/og/smartcity-og.png',
				width: 1200,
				height: 630,
				alt: 'SmartCity Smart Parking Uzbekistan',
			},
		],
	},

	twitter: {
		card: 'summary_large_image',

		title: 'SmartCity — Smart Parking in Uzbekistan',

		description:
			'O‘zbekistonda parking topish va bron qilish uchun smart platforma.',

		images: ['/og/smartcity-og.png'],
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
		title: 'SmartCity',
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
		<html lang='uz' className={`${inter.variable} ${mono.variable}`}>
			<body>
				<StructuredData />
				<AppProvider>
					<LocationProvider>
						{children}

						<InstallAppPrompt />
					</LocationProvider>
				</AppProvider>
			</body>
		</html>
	)
}
