const siteUrl = process.env.NEXT_PUBLIC_SITE_URL || 'http://localhost:3000'

export function StructuredData() {
	const data = {
		'@context': 'https://schema.org',

		'@type': 'WebApplication',

		name: 'SmartCity',

		url: siteUrl,

		applicationCategory: 'TravelApplication',

		operatingSystem: 'Web, Android, iOS',

		description:
			'Oʻzbekistonda parking joylarini topish va bron qilish uchun smart parking platformasi.',

		inLanguage: 'uz',

		areaServed: {
			'@type': 'Country',
			name: 'Uzbekistan',
		},

		offers: {
			'@type': 'Offer',
			price: '0',
			priceCurrency: 'UZS',
		},
	}

	return (
		<script
			type='application/ld+json'
			dangerouslySetInnerHTML={{
				__html: JSON.stringify(data),
			}}
		/>
	)
}
