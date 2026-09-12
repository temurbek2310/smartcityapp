import {
	Bike,
	Bus,
	CircleParking,
	Leaf,
	Ticket,
	TriangleAlert,
	type LucideIcon,
} from 'lucide-react'

// City Goo's LAYERS: what the home map is allowed to draw. Each one is a
// switch the user owns, and each adds its own pins — the map is otherwise
// just the parking list with a background.

export type MapLayerId = 'parking' | 'transit' | 'traffic' | 'events' | 'bike' | 'eco'

export type MapLayer = {
	id: MapLayerId
	label: string
	description: string
	icon: LucideIcon
	tone: string
	// City Goo's three defaults. Bike lanes and air quality stay off because
	// neither has real data behind it yet.
	on: boolean
}

export const MAP_LAYERS: MapLayer[] = [
	{
		id: 'parking',
		label: 'Parkinglar',
		description: 'Real vaqtdagi bo‘sh joylar',
		icon: CircleParking,
		tone: 'bg-brand-50 text-brand',
		on: true,
	},
	{
		id: 'transit',
		label: 'Jamoat transporti',
		description: 'Yaqin avtobus va metro',
		icon: Bus,
		tone: 'bg-ok-bg text-ok',
		on: true,
	},
	{
		id: 'traffic',
		label: 'Tirbandlik va yopilishlar',
		description: 'Ko‘chalar hozir qanchalik band',
		icon: TriangleAlert,
		tone: 'bg-bad-bg text-bad',
		on: true,
	},
	{
		id: 'events',
		label: 'Voqealar',
		description: 'Konsert, yarmarka, sport',
		icon: Ticket,
		tone: 'bg-brand-100 text-brand',
		on: false,
	},
	{
		id: 'bike',
		label: 'Velosiped yo‘laklari',
		description: 'Velosiped va skuter marshrutlari',
		icon: Bike,
		tone: 'bg-info-bg text-info',
		on: false,
	},
	{
		id: 'eco',
		label: 'Ob-havo va ekologiya',
		description: 'Havo sifati, harorat, shamol',
		icon: Leaf,
		tone: 'bg-ok-bg text-ok',
		on: false,
	},
]

export type MapLayerState = Record<MapLayerId, boolean>

export const DEFAULT_LAYERS: MapLayerState = Object.fromEntries(
	MAP_LAYERS.map(layer => [layer.id, layer.on]),
) as MapLayerState

const STORAGE_KEY = 'citygoo-map-layers'

export function readLayers(): MapLayerState {
	try {
		const raw = window.localStorage.getItem(STORAGE_KEY)
		if (!raw) return DEFAULT_LAYERS
		const parsed: unknown = JSON.parse(raw)
		// Merge rather than trust: a stored blob written before a layer existed
		// would otherwise leave that layer undefined.
		if (!parsed || typeof parsed !== 'object') return DEFAULT_LAYERS
		const next = { ...DEFAULT_LAYERS }
		for (const { id } of MAP_LAYERS) {
			const value = (parsed as Record<string, unknown>)[id]
			if (typeof value === 'boolean') next[id] = value
		}
		return next
	} catch {
		return DEFAULT_LAYERS
	}
}

export function writeLayers(layers: MapLayerState) {
	try {
		window.localStorage.setItem(STORAGE_KEY, JSON.stringify(layers))
	} catch {
		// The map still renders correctly from in-memory state.
	}
}

export function activeLayerCount(layers: MapLayerState) {
	return MAP_LAYERS.filter(layer => layers[layer.id]).length
}
