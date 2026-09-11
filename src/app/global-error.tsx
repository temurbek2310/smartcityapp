'use client'

// Catches failures in the root layout itself, which (app)/error.tsx sits
// below and therefore cannot see. It replaces the whole document, so unlike
// every other boundary it has to render its own <html> and <body> — and it
// cannot rely on globals.css or the fonts having loaded, which is why the
// styling here is inline and deliberately plain.
export default function GlobalError({
	error,
	reset,
}: {
	error: Error & { digest?: string }
	reset: () => void
}) {
	return (
		<html lang='uz'>
			<body
				style={{
					margin: 0,
					minHeight: '100dvh',
					display: 'grid',
					placeItems: 'center',
					background: '#f3f4f8',
					color: '#0f172a',
					fontFamily:
						'"Inter", -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif',
					padding: '24px',
					textAlign: 'center',
				}}
			>
				<div style={{ maxWidth: 320 }}>
					<h1 style={{ fontSize: 17, fontWeight: 800, margin: 0 }}>
						Ilovani yuklab bo‘lmadi
					</h1>
					<p
						style={{
							marginTop: 8,
							fontSize: 12.5,
							lineHeight: 1.5,
							color: '#8a91a6',
						}}
					>
						Kutilmagan xatolik yuz berdi. Sahifani qaytadan yuklang —
						ma’lumotlaringiz saqlanib qoladi.
					</p>
					{error.digest && (
						<p
							style={{
								marginTop: 12,
								fontSize: 10.5,
								fontFamily: 'ui-monospace, monospace',
								color: '#8a91a6',
								opacity: 0.6,
							}}
						>
							{error.digest}
						</p>
					)}
					<button
						type='button'
						onClick={reset}
						style={{
							marginTop: 20,
							height: 44,
							padding: '0 20px',
							border: 0,
							borderRadius: 12,
							background: '#6c47e0',
							color: '#fff',
							fontSize: 13,
							fontWeight: 800,
							cursor: 'pointer',
						}}
					>
						Qayta urinish
					</button>
				</div>
			</body>
		</html>
	)
}
