// Shared between the Home weather sheet and the /transport current-situation
// section so both read the same city snapshot instead of two copies drifting.
export type CityMeta = {
	temp: number
	sky: string
	population: string
}

export const CITY_META: Record<string, CityMeta> = {
	Toshkent: { temp: 26, sky: 'Ochiq', population: '2,9 mln' },
	Samarqand: { temp: 24, sky: 'Bulutli', population: '560 ming' },
	Buxoro: { temp: 29, sky: 'Ochiq', population: '280 ming' },
	Namangan: { temp: 23, sky: 'Yengil yomg‘ir', population: '650 ming' },
	Andijon: { temp: 25, sky: 'Ochiq', population: '450 ming' },
}
