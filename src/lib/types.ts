export type ParkingAmenity =
  | "CCTV"
  | "EV Charging"
  | "Valet"
  | "Covered"
  | "Accessible"
  | "Security"
  | "Bike Parking"
  | "Car Wash";

// When a lot fills up, expressed as a shape rather than the reference's
// eight hand-written percentages. occupancyForecast() turns it into a
// curve, so a real dataset can supply one enum per lot instead of 56
// numbers nobody can maintain.
export type PeakProfile = "morning" | "midday" | "evening" | "night";

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

  levels: number;
  // 0 means the tariff is not offered, which is how the detail grid renders
  // a dash rather than a price.
  pricePerDay: number;
  pricePerMonth: number;
  rating: number;
  reviewCount: number;
  // Counts, not flags: the amenity grid shows "6 ta" and the advanced
  // filter needs to compare against a number.
  evChargers: number;
  accessibleSpaces: number;
  // Whether the barrier reads the plate. The booking sheet used to infer
  // this from the presence of a camera, which told people with any CCTV lot
  // that the barrier would open for them automatically.
  plateRecognition: boolean;
  // Clearance in metres; null where the lot is open-air.
  maxHeightM: number | null;
  entranceNote: string;
  paymentMethods: string[];
  peakProfile: PeakProfile;
};

export type UserProfile = {
  name: string;
  phone: string;
  // Signup always asks for one, so a profile created by this app has it.
  // Optional all the same, because a profile restored from localStorage was
  // not necessarily written by this build, and claiming a string that is not
  // there is what crashed every screen that formats a plate.
  vehiclePlate?: string;
  // Set at signup so the profile can say how long someone has been here.
  // Optional because blobs written before this existed have no value, and
  // inventing a join date would be a lie rather than a default.
  joinedAt?: string;
  premium?: boolean;
};

// Which notifications the user actually wants. These are real switches, not
// decoration: the booking reminder gates the 30/10-minute timer alerts that
// app-context generates.
export type NotificationPrefId =
  | "bookingReminders"
  | "freeSpaces"
  | "queueTurn"
  | "roadClosures"
  | "cityEvents"
  | "partnerOffers";

export type ReservationStatus = "reserved" | "active" | "completed" | "cancelled";

export type Reservation = {
  id: string;
  parkingId: string;
  userPhone: string;
  // The plate as it stood when the booking was made. Absent when the profile
  // had none to copy — the booking records that honestly instead of inventing
  // a vehicle, and the screens show «—».
  vehiclePlate?: string;
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

// Everything City Goo lets you hold at once. Parking keeps its own richer
// shape below rather than being flattened into this union — it is the only
// one with an entry/exit lifecycle, a QR at both ends and a metered total.
export type BookingKind =
  | "parking"
  | "queue"
  | "table"
  | "cinema"
  | "clinic"
  | "event";

// waiting → called → arrived → served, or cancelled from any live status.
// «Men keldim» is called → arrived: the customer checked in, the service has
// not happened yet. A ticket booked for later starts one step earlier, as
// scheduled, and the clock alone moves it into the line (or out of it, as a
// no-show). Meanings in full live with the rules in booking-lifecycle.
export type QueueTicketStatus =
  | "scheduled"
  | "waiting"
  | "called"
  | "arrived"
  | "served"
  | "cancelled";

export type QueueTicket = {
  id: string;
  orgId: string;
  serviceId: string;
  // The printed number, e.g. "A-14".
  number: string;
  // How many people are ahead right now, and how many there were on issue —
  // the pair is what the progress bar needs.
  position: number;
  initialPosition: number;
  // Current estimate, which walks down to zero as the queue moves — and the
  // estimate given at issue, which is what the history row reports. Without
  // the second, a finished ticket claims you waited no time at all.
  etaMinutes: number;
  initialEtaMinutes: number;
  // The window, desk or specialist's number the ticket is served at.
  windowNumber: number;
  notify: boolean;
  status: QueueTicketStatus;
  createdAt: string;
  closedAt?: string;
  // The moment booked in advance, as the ISO string of a Tashkent wall-clock
  // instant. Absent on a live ticket — taken «Hozir» — and on every ticket
  // persisted before advance booking existed; both read exactly as before.
  scheduledAt?: string;
  // The QueueDesk chosen in the sheet. Absent on a live ticket the
  // organisation assigns a window to, and on legacy blobs.
  deskId?: string;
};

export type ServiceBookingKind = Exclude<BookingKind, "parking" | "queue">;

// upcoming → active → completed on the clock alone: before its start, from
// its start, and from start + duration (booking-lifecycle's reconciliation
// writes each step). Either live status → cancelled by the customer.
export type ServiceBookingStatus = "upcoming" | "active" | "completed" | "cancelled";

// Tables, cinema seats, clinic slots and event tickets. Their lifecycle is
// only live, then over or cancelled, so one shape covers all four and the
// kind only decides the icon and the copy.
export type ServiceBooking = {
  id: string;
  kind: ServiceBookingKind;
  // The place or event this refers to, so the card can link somewhere.
  refId: string;
  title: string;
  subtitle: string;
  code: string;
  whenLabel: string;
  // The moment actually reserved. The label above is only what the sheet
  // wrote at the time; this is what Bron re-derives its date and time from,
  // so a table booked for tomorrow evening stops reading as "Bugun, 12:30".
  // Optional because a blob persisted before this field existed has none —
  // those keep falling back to their stored label.
  startAt?: string;
  // When the booking ends. No flow writes it yet; expectedEndAt() prefers it
  // over the duration below the moment one does.
  endAt?: string;
  // How long the booking holds its venue. Every booking the sheet creates
  // carries it — the table the customer's own choice, the other kinds their
  // lifecycle default. Optional only because blobs persisted before it
  // existed have none, and those fall back to the kind's default.
  durationMinutes?: number;
  // Where in the venue: «Asosiy zal», «Veranda». Tables only.
  seatingArea?: string;
  status: ServiceBookingStatus;
  createdAt: string;
};

export type AppNotification = {
  id: string;
  title: string;
  message: string;
  createdAt: string;
  read: boolean;
  type: "booking" | "timer" | "parking" | "payment" | "system" | "queue";
};

export type SmartCityState = {
  hydrated: boolean;
  onboardingDone: boolean;
  user: UserProfile | null;
  // Parking favorites. Places, queue organisations, routes and events keep
  // their own lists so each Favorites tab can be emptied independently.
  favorites: string[];
  favoriteQueueOrgs: string[];
  favoriteEvents: string[];
  savedRoutes: SavedRoute[];
  reservations: Reservation[];
  queueTickets: QueueTicket[];
  serviceBookings: ServiceBooking[];
  notifications: AppNotification[];
  notificationPrefs: Record<NotificationPrefId, boolean>;
};

// A route the user chose to keep from /transport, replayed by tapping it in
// Favorites. City Goo stores the endpoints rather than a computed route, so
// distance and time are recalculated on replay instead of going stale.
export type SavedRoute = {
  id: string;
  title: string;
  from: string;
  to: string;
  mode: string;
  // The route's own endpoints as resolveRouteEndpoint() ids — the place the
  // customer was going, never the car park suggested beside it.
  destinationId?: string;
  originId?: string;
  // Legacy: routes saved before destinationId existed recorded only the lot
  // nearest their destination. Read for those alone, never written.
  parkingId?: string;
  createdAt: string;
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
  // Approximate Tashkent coordinates, to be replaced wholesale when the real
  // dataset lands. They exist so /map can plot places, parkings, queues and
  // events on one surface — deriving a place's position from its parking put
  // every venue sharing a lot on the same pixel.
  lat: number;
  lng: number;
  distanceKm: number;
  free?: number;
  total?: number;
  // No wait time here: a venue's wait is its queue desk's (QUEUE_ORGS), and
  // a venue without one has no line to wait in.
  busy: number;
  address: string;
  phone: string;
  tags: string[];
  accent: string;
  parkingId?: string;
};

// A dated thing happening in the city. Demo content, but every event
// points at a real parking so the only action it offers is one SmartCity
// can actually fulfil.
export type CityEvent = {
  id: string
  when: string
  time: string
  title: string
  place: string
  category: string
  price: string
  description: string
  accent: string
  parkingId: string
}

// --- Electronic queues -------------------------------------------------
// An organisation you can take a numbered ticket at. Demo content, but each
// one is anchored to a real parking so "take a ticket" and "park nearby" are
// the same journey.
export type QueueCategory = "cafe" | "bank" | "clinic" | "gov" | "auto";

export type QueueService = {
  id: string;
  title: string;
  avgWaitMinutes: number;
  // Letter the printed ticket number starts with, e.g. "V" -> "V-08".
  prefix: string;
  windows: number;
  // How long one customer holds a desk — the length of a bookable slot.
  // Not avgWaitMinutes: that is the wait in line, not the service itself.
  serviceMinutes: number;
  // Whether a ticket can be booked for later. Lines that only make sense
  // live — takeaway, a free table — are false and keep «Hozir» only.
  bookable: boolean;
};

// Where a ticket is served: a numbered window, a desk, or a named specialist.
// The kind only decides the copy; availability treats all three alike.
export type QueueDeskKind = "window" | "desk" | "specialist";

export type QueueDesk = {
  id: string;
  // The printed number — what QueueTicket.windowNumber stores.
  number: number;
  // «3-oyna», «2-stol», «Dr. Karimova».
  label: string;
  kind: QueueDeskKind;
  // The specialist's role, shown under the name: «Terapevt».
  role?: string;
  // The services this desk handles. One desk can serve several lines.
  serviceIds: string[];
};

export type QueueForecastPoint = {
  inMinutes: number;
  waitMinutes: number;
  deltaLabel: string;
  tone: "ok" | "warn" | "bad";
};

export type QueueOrg = {
  id: string;
  title: string;
  category: QueueCategory;
  address: string;
  // The venue this desk belongs to. Every organisation is a place first:
  // title, address, position, rating, accent and parking are read from it,
  // never stored a second time.
  placeId: string;
  parkingId: string;
  // Approximate, like Place.lat/lng above — see the note there.
  lat: number;
  lng: number;
  distanceKm: number;
  rating: number;
  reviewCount: number;
  open: boolean;
  // "HH:mm", Tashkent. The first and last moment the doors are open; the
  // last bookable slot is the one that still ends by closeTime.
  openTime: string;
  closeTime: string;
  // People in line right now, and the wait that implies.
  waiting: number;
  waitMinutes: number;
  windows: number;
  accent: string;
  forecast: QueueForecastPoint[];
  // Load percentage at each QUEUE_HOURS slot; 0 means closed.
  hourlyLoad: number[];
  services: QueueService[];
  // Every window, desk and specialist. Each service's desks are the ones
  // whose serviceIds name it, and there are exactly service.windows of them.
  desks: QueueDesk[];
  tip: string;
};

// --- City news ---------------------------------------------------------
// Roads and city notices. affectedParkingIds is the part that earns the
// feed its place in a parking app: a closure can say which lots it reaches,
// so the item links somewhere actionable instead of being read-only.
export type NewsCategory = "road" | "city";

export type NewsSeverity = "closure" | "roadworks" | "incident" | "info";

export type NewsItem = {
  id: string;
  category: NewsCategory;
  severity: NewsSeverity;
  title: string;
  summary: string;
  body: string;
  timeLabel: string;
  affectedStreets: string[];
  affectedParkingIds: string[];
  detourAdvice?: string;
};

// --- Profile ------------------------------------------------------------
export type PaymentMethod = {
  id: string;
  title: string;
  masked: string;
  primary: boolean;
};

export type PremiumPerk = {
  title: string;
  description: string;
};
