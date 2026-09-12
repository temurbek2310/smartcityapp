import { fileURLToPath } from 'node:url'
import { defineConfig } from 'vitest/config'

// Unit tests for src/lib only — the pure, DOM-free layer. Component and
// end-to-end coverage would need a browser environment; this is deliberately
// the cheap half, because it is where the bugs actually were.
export default defineConfig({
	resolve: {
		alias: {
			'@': fileURLToPath(new URL('./src', import.meta.url)),
		},
	},
	test: {
		include: ['src/**/*.test.ts'],
		environment: 'node',
	},
})
