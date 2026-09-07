export type Coordinate = { lat: number; lng: number };

export const UZBEKISTAN_BOUNDS = {
  north: 45.7,
  south: 37.1,
  west: 55.9,
  east: 73.2,
} as const;

export const TASHKENT_CENTER: Coordinate = { lat: 41.3111, lng: 69.2797 };

export function isInsideUzbekistan({ lat, lng }: Coordinate) {
  return (
    lat >= UZBEKISTAN_BOUNDS.south &&
    lat <= UZBEKISTAN_BOUNDS.north &&
    lng >= UZBEKISTAN_BOUNDS.west &&
    lng <= UZBEKISTAN_BOUNDS.east
  );
}

export function distanceKm(a: Coordinate, b: Coordinate) {
  const radius = 6371;
  const dLat = ((b.lat - a.lat) * Math.PI) / 180;
  const dLng = ((b.lng - a.lng) * Math.PI) / 180;
  const lat1 = (a.lat * Math.PI) / 180;
  const lat2 = (b.lat * Math.PI) / 180;
  const h =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(lat1) * Math.cos(lat2) * Math.sin(dLng / 2) ** 2;
  return 2 * radius * Math.asin(Math.sqrt(h));
}
