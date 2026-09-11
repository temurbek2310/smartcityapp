export type ParkingAmenity =
  | "CCTV"
  | "EV Charging"
  | "Valet"
  | "Covered"
  | "Accessible";

export type Parking = {
  id: string;
  name: string;
  city: string;
  district: string;
  address: string;
  lat: number;
  lng: number;
  pricePerHour: number;
  totalSpaces: number;
  availableSpaces: number;
  workingHours: string;
  description: string;
  amenities: ParkingAmenity[];
  accent: string;
};

export type UserProfile = {
  name: string;
  phone: string;
  vehiclePlate: string;
};

export type ReservationStatus = "reserved" | "active" | "completed" | "cancelled";

export type Reservation = {
  id: string;
  parkingId: string;
  userPhone: string;
  vehiclePlate: string;
  startAt: string;
  endAt: string;
  durationHours: number;
  pricePerHour: number;
  estimatedTotal: number;
  finalTotal?: number;
  status: ReservationStatus;
  createdAt: string;
  enteredAt?: string;
  exitedAt?: string;
};

export type AppNotification = {
  id: string;
  title: string;
  message: string;
  createdAt: string;
  read: boolean;
  type: "booking" | "timer" | "parking" | "payment" | "system";
};

export type BSpaceState = {
  hydrated: boolean;
  onboardingDone: boolean;
  user: UserProfile | null;
  favorites: string[];
  reservations: Reservation[];
  notifications: AppNotification[];
};

// Demo places (cafés, clinics, malls) that Home and Favorites browse. Each
// one points at a real Parking — the place is the destination, the parking
// is what actually gets booked.
export type PlaceCategory =
  | "all"
  | "food"
  | "parking"
  | "health"
  | "shops"
  | "fun"
  | "buildings"
  | "services"
  | "tourism";

export type Place = {
  id: string;
  title: string;
  category: PlaceCategory;
  subtitle: string;
  rating: number;
  reviews: number;
  distanceKm: number;
  free?: number;
  total?: number;
  queue?: number;
  busy: number;
  address: string;
  phone: string;
  tags: string[];
  accent: string;
  parkingId?: string;
};
