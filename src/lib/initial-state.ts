import type { SmartCityState } from "@/lib/types";

// What a customer who has never used SmartCity has. Every collection here is
// empty on purpose: a fresh install must not look as though someone else has
// already been favouriting places, booking parking and taking queue tickets
// in it. The catalogs (parkings, places, queue organisations, prices,
// coordinates) are real content and live in src/data — none of them belong
// here, because none of them are things this customer did.
//
// It sits in lib rather than inside AppProvider so the emptiness is a fact a
// test can assert, not a claim about a React file.
export const initialState: SmartCityState = {
  hydrated: false,
  onboardingDone: false,
  user: null,
  favorites: [],
  favoriteQueueOrgs: [],
  favoriteEvents: [],
  savedRoutes: [],
  reservations: [],
  queueTickets: [],
  serviceBookings: [],
  // The one thing a new account does start with, and it is a preference, not
  // activity: the notifications that affect a booking you made are on,
  // marketing is off. Nothing has happened yet to notify anyone about.
  notificationPrefs: {
    bookingReminders: true,
    freeSpaces: true,
    queueTurn: true,
    roadClosures: true,
    cityEvents: false,
    partnerOffers: false,
  },
  notifications: [],
};

// The parts of the state that record something the customer did. A fresh
// install has none of them, and `resetDemo` has to put every one of them back
// to empty — which is easy to get wrong by hand each time a new store is
// added, and is why the list is written down once here.
export const USER_ACTIVITY_KEYS = [
  "favorites",
  "favoriteQueueOrgs",
  "favoriteEvents",
  "savedRoutes",
  "reservations",
  "queueTickets",
  "serviceBookings",
  "notifications",
] as const satisfies readonly (keyof SmartCityState)[];

// What signing out leaves behind. There is no account id to keep anything
// under, so everything the signed-out person did — bookings and their
// history included — goes, or the next person to sign in on this device
// would see it. The profile goes, and notification preferences return to
// their defaults: they were this person's choices.
//
// Built from initialState rather than by blanking a list, so a store added
// later is cleared by default. Only device facts carry over: whether this
// device has seen onboarding, and whether the running app has hydrated.
//
// Logout is only allowed with no live booking (liveBookingCount), so this
// never discards a booking someone still needs.
export function loggedOutState(current: SmartCityState): SmartCityState {
  return {
    ...initialState,
    notificationPrefs: { ...initialState.notificationPrefs },
    hydrated: current.hydrated,
    onboardingDone: current.onboardingDone,
  };
}
