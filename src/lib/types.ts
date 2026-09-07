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
