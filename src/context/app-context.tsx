"use client";

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from "react";
import type {
  AppNotification,
  BSpaceState,
  NotificationPrefId,
  QueueTicket,
  Reservation,
  SavedRoute,
  ServiceBooking,
  UserProfile,
} from "@/lib/types";
import type { ServiceBookingDraft } from "@/lib/bookings";
import { hydrateUserProfile } from "@/lib/persisted-profile";
import { formatUzbekPlate } from "@/lib/plate";
import { calculateFinalTotal } from "@/lib/reservation";
import { clearAccountStorage } from "@/lib/account-storage";

const STORAGE_KEY = "b-space-mvp-v1";

const initialState: BSpaceState = {
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
  // Defaults mirror City Goo's: the things that affect a booking you already
  // made are on, marketing is off.
  notificationPrefs: {
    bookingReminders: true,
    freeSpaces: true,
    queueTurn: true,
    roadClosures: true,
    cityEvents: false,
    partnerOffers: false,
  },
  notifications: [
    {
      id: "full-parking-demo",
      title: "Alternativ parking",
      message: "Next Mall Parking hozir FULL. Tashkent City Parkingda bo'sh joylar mavjud.",
      createdAt: new Date().toISOString(),
      read: false,
      type: "parking",
    },
    {
      id: "welcome-system",
      title: "B SPACE MVP",
      message: "Demo rejim tayyor. Uzbekistan bo'ylab parkinglarni sinab ko'ring.",
      createdAt: new Date().toISOString(),
      read: false,
      type: "system",
    },
  ],
};

type CreateReservationInput = {
  parkingId: string;
  startAt: string;
  durationHours: number;
  pricePerHour: number;
};

type TakeQueueTicketInput = {
  orgId: string;
  serviceId: string;
  number: string;
  position: number;
  etaMinutes: number;
  windowNumber: number;
  notify: boolean;
};

// Built by lib/bookings' serviceBookingDraft(), which is also where the
// reverse mapping into a Booking Center row lives — so a field the sheet
// stops sending cannot quietly go missing from the row that reads it.
type CreateServiceBookingInput = ServiceBookingDraft;

type AppContextValue = BSpaceState & {
  completeOnboarding: () => void;
  login: (profile: UserProfile) => void;
  updateProfile: (patch: Partial<UserProfile>) => void;
  setNotificationPref: (id: NotificationPrefId, enabled: boolean) => void;
  logout: () => void;
  resetDemo: () => void;
  toggleFavorite: (parkingId: string) => void;
  createReservation: (input: CreateReservationInput) => Reservation;
  cancelReservation: (reservationId: string) => void;
  enterReservation: (reservationId: string) => void;
  extendReservation: (reservationId: string, hours?: number) => void;
  exitReservation: (reservationId: string) => Reservation | undefined;
  markNotificationRead: (notificationId: string) => void;
  markAllNotificationsRead: () => void;
  unreadCount: number;

  toggleQueueOrgFavorite: (orgId: string) => void;
  toggleEventFavorite: (eventId: string) => void;
  saveRoute: (route: Omit<SavedRoute, "id" | "createdAt">) => SavedRoute;
  removeRoute: (routeId: string) => void;

  takeQueueTicket: (input: TakeQueueTicketInput) => QueueTicket;
  advanceQueueTicket: (ticketId: string) => void;
  completeQueueTicket: (ticketId: string) => void;
  cancelQueueTicket: (ticketId: string) => void;

  createServiceBooking: (input: CreateServiceBookingInput) => ServiceBooking;
  cancelServiceBooking: (bookingId: string) => void;
};

const AppContext = createContext<AppContextValue | null>(null);

function uid(prefix: string) {
  const value = typeof crypto !== "undefined" && "randomUUID" in crypto
    ? crypto.randomUUID()
    : Math.random().toString(36).slice(2);
  return `${prefix}-${value}`;
}

function makeNotification(
  title: string,
  message: string,
  type: AppNotification["type"],
  id = uid("notification"),
): AppNotification {
  return { id, title, message, type, createdAt: new Date().toISOString(), read: false };
}

export function AppProvider({ children }: { children: ReactNode }) {
  const [state, setState] = useState<BSpaceState>(initialState);

  useEffect(() => {
    const timer = window.setTimeout(() => {
      try {
        const saved = localStorage.getItem(STORAGE_KEY);
        if (saved) {
          const parsed = JSON.parse(saved) as Partial<Omit<BSpaceState, "hydrated">>;
          // A blob written before the booking registry existed simply has no
          // key for these, and the spread leaves the empty defaults in place.
          setState({
            ...initialState,
            ...parsed,
            // The profile is the one part that needs more than a spread: an
            // older build stored the vehicle under a different key, and the
            // value is still good.
            user: hydrateUserProfile(parsed.user),
            hydrated: true,
          });
        } else {
          setState((current) => ({ ...current, hydrated: true }));
        }
      } catch {
        setState((current) => ({ ...current, hydrated: true }));
      }
    }, 0);

    return () => window.clearTimeout(timer);
  }, []);

  useEffect(() => {
    if (!state.hydrated) return;
    const persisted: Omit<BSpaceState, "hydrated"> = {
      onboardingDone: state.onboardingDone,
      user: state.user,
      favorites: state.favorites,
      favoriteQueueOrgs: state.favoriteQueueOrgs,
      favoriteEvents: state.favoriteEvents,
      savedRoutes: state.savedRoutes,
      reservations: state.reservations,
      queueTickets: state.queueTickets,
      serviceBookings: state.serviceBookings,
      notifications: state.notifications,
      notificationPrefs: state.notificationPrefs,
    };
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(persisted));
    } catch {
      // Keep the current session usable when browser storage is unavailable.
    }
  }, [state]);

  useEffect(() => {
    if (!state.hydrated) return;

    const checkTimers = () => {
      const now = Date.now();
      setState((current) => {
        let notifications = current.notifications;
        let changed = false;

        if (!current.notificationPrefs.bookingReminders) return current;

        for (const reservation of current.reservations) {
          if (reservation.status !== "active") continue;
          const remaining = new Date(reservation.endAt).getTime() - now;
          const alerts = [
            { minutes: 30, threshold: 30 * 60_000 },
            { minutes: 10, threshold: 10 * 60_000 },
          ];

          for (const alert of alerts) {
            const id = `timer-${alert.minutes}-${reservation.id}`;
            if (
              remaining > 0 &&
              remaining <= alert.threshold &&
              !notifications.some((item) => item.id === id)
            ) {
              notifications = [
                makeNotification(
                  "Parking vaqti tugamoqda",
                  `${alert.minutes} daqiqadan kam vaqt qoldi. Zarur bo'lsa parking vaqtini uzaytiring.`,
                  "timer",
                  id,
                ),
                ...notifications,
              ];
              changed = true;
            }
          }
        }

        return changed ? { ...current, notifications } : current;
      });
    };

    const initialTimer = window.setTimeout(checkTimers, 0);
    const timer = window.setInterval(checkTimers, 30_000);
    return () => {
      window.clearTimeout(initialTimer);
      window.clearInterval(timer);
    };
  }, [state.hydrated]);

  const completeOnboarding = useCallback(() => {
    setState((current) => ({ ...current, onboardingDone: true }));
  }, []);

  const login = useCallback((profile: UserProfile) => {
    setState((current) => ({
      ...current,
      onboardingDone: true,
      user: { joinedAt: new Date().toISOString(), premium: false, ...profile },
      notifications: [
        makeNotification("Xush kelibsiz", `${profile.name}, B SPACE profilingiz tayyor.`, "system"),
        ...current.notifications,
      ],
    }));
  }, []);

  // Partial edits from the profile screen — plate, premium — without the
  // caller having to rebuild the whole profile.
  const updateProfile = useCallback((patch: Partial<UserProfile>) => {
    setState((current) =>
      current.user ? { ...current, user: { ...current.user, ...patch } } : current,
    );
  }, []);

  const setNotificationPref = useCallback(
    (id: NotificationPrefId, enabled: boolean) => {
      setState((current) => ({
        ...current,
        notificationPrefs: { ...current.notificationPrefs, [id]: enabled },
      }));
    },
    [],
  );

  const logout = useCallback(() => {
    setState((current) => ({ ...current, user: null }));
  }, []);

  const resetDemo = useCallback(() => {
    clearAccountStorage(localStorage);
    setState({ ...initialState, hydrated: true, notifications: [] });
  }, []);

  const toggleFavorite = useCallback((parkingId: string) => {
    setState((current) => ({
      ...current,
      favorites: current.favorites.includes(parkingId)
        ? current.favorites.filter((id) => id !== parkingId)
        : [...current.favorites, parkingId],
    }));
  }, []);

  const createReservation = useCallback(
    (input: CreateReservationInput) => {
      if (!state.user) throw new Error("User must be logged in");
      const start = new Date(input.startAt);
      const end = new Date(start.getTime() + input.durationHours * 3_600_000);
      const reservation: Reservation = {
        id: uid("booking"),
        parkingId: input.parkingId,
        userPhone: state.user.phone,
        // Copied through the formatter rather than raw. A profile hydrated
        // from a blob this build did not write can have no plate, and the
        // reservation was silently taking the undefined with it — which is
        // how a freshly made booking, not only a legacy one, reached the
        // session screen with nothing to format. It is left off entirely
        // rather than stored as an empty string, so "no plate" has one shape.
        vehiclePlate: formatUzbekPlate(state.user.vehiclePlate) || undefined,
        startAt: start.toISOString(),
        endAt: end.toISOString(),
        durationHours: input.durationHours,
        pricePerHour: input.pricePerHour,
        estimatedTotal: input.durationHours * input.pricePerHour,
        status: "reserved",
        createdAt: new Date().toISOString(),
      };
      setState((current) => ({
        ...current,
        reservations: [reservation, ...current.reservations],
        notifications: [
          makeNotification(
            "Bron tasdiqlandi",
            "Parking joyingiz saqlandi. QR kod orqali kirishingiz mumkin.",
            "booking",
          ),
          ...current.notifications,
        ],
      }));
      return reservation;
    },
    [state.user],
  );

  // Only a booking the driver has not entered yet can be cancelled. Once the
  // car is inside, the session is ended by exiting — exitReservation() meters
  // and closes it. The notification used to be pushed whether or not the map
  // changed anything, so cancelling an active session announced a cancellation
  // that never happened.
  const cancelReservation = useCallback((reservationId: string) => {
    setState((current) => {
      const target = current.reservations.find(
        (reservation) => reservation.id === reservationId,
      );
      if (target?.status !== "reserved") return current;

      return {
        ...current,
        reservations: current.reservations.map((reservation) =>
          reservation.id === reservationId
            ? { ...reservation, status: "cancelled" as const }
            : reservation,
        ),
        notifications: [
          makeNotification("Bron bekor qilindi", "Parking broni bekor qilindi.", "booking"),
          ...current.notifications,
        ],
      };
    });
  }, []);

  const enterReservation = useCallback((reservationId: string) => {
    const enteredAt = new Date();
    setState((current) => ({
      ...current,
      reservations: current.reservations.map((reservation) => {
        if (reservation.id !== reservationId || reservation.status !== "reserved") return reservation;
        // The paid window runs from the moment the car is actually inside.
        // Arriving late must not eat into it — but the previous
        // max(bookedEnd, enteredAt + duration) also meant arriving *early*
        // silently stretched it to the booked end, handing a 2h booking
        // entered an hour early a 3h+ timer it had not paid for.
        // calculateFinalTotal() meters from enteredAt, so the two agree now.
        return {
          ...reservation,
          status: "active" as const,
          enteredAt: enteredAt.toISOString(),
          endAt: new Date(
            enteredAt.getTime() + reservation.durationHours * 3_600_000,
          ).toISOString(),
        };
      }),
      notifications: [
        makeNotification("Parking boshlandi", "Kirish tasdiqlandi va parking taymeri ishga tushdi.", "parking"),
        ...current.notifications,
      ],
    }));
  }, []);

  const extendReservation = useCallback((reservationId: string, hours = 1) => {
    setState((current) => ({
      ...current,
      reservations: current.reservations.map((reservation) =>
        reservation.id === reservationId && reservation.status === "active"
          ? {
              ...reservation,
              endAt: new Date(new Date(reservation.endAt).getTime() + hours * 3_600_000).toISOString(),
              durationHours: reservation.durationHours + hours,
              estimatedTotal: reservation.estimatedTotal + hours * reservation.pricePerHour,
            }
          : reservation,
      ),
      notifications: [
        makeNotification("Vaqt uzaytirildi", `Parking vaqti ${hours} soatga uzaytirildi.`, "timer"),
        ...current.notifications,
      ],
    }));
  }, []);

  const exitReservation = useCallback((reservationId: string) => {
    let completed: Reservation | undefined;
    const exitedAt = new Date();
    setState((current) => {
      const reservations = current.reservations.map((reservation) => {
        if (reservation.id !== reservationId || reservation.status !== "active") return reservation;
        completed = {
          ...reservation,
          status: "completed" as const,
          exitedAt: exitedAt.toISOString(),
          finalTotal: calculateFinalTotal(reservation, exitedAt),
        };
        return completed;
      });
      return {
        ...current,
        reservations,
        notifications: [
          makeNotification("To'lov muvaffaqiyatli", "Parking sessiyasi yakunlandi va chek yaratildi.", "payment"),
          ...current.notifications,
        ],
      };
    });
    return completed;
  }, []);

  // Each Favorites tab owns its own list so emptying one leaves the rest.
  const toggleQueueOrgFavorite = useCallback((orgId: string) => {
    setState((current) => ({
      ...current,
      favoriteQueueOrgs: current.favoriteQueueOrgs.includes(orgId)
        ? current.favoriteQueueOrgs.filter((id) => id !== orgId)
        : [...current.favoriteQueueOrgs, orgId],
    }));
  }, []);

  const toggleEventFavorite = useCallback((eventId: string) => {
    setState((current) => ({
      ...current,
      favoriteEvents: current.favoriteEvents.includes(eventId)
        ? current.favoriteEvents.filter((id) => id !== eventId)
        : [...current.favoriteEvents, eventId],
    }));
  }, []);

  const saveRoute = useCallback((route: Omit<SavedRoute, "id" | "createdAt">) => {
    const saved: SavedRoute = { ...route, id: uid("route"), createdAt: new Date().toISOString() };
    setState((current) => ({
      ...current,
      // Endpoints identify a route; saving the same pair twice would give
      // the tab two rows that replay identically.
      savedRoutes: [
        saved,
        ...current.savedRoutes.filter(
          (item) => !(item.from === route.from && item.to === route.to && item.mode === route.mode),
        ),
      ],
    }));
    return saved;
  }, []);

  const removeRoute = useCallback((routeId: string) => {
    setState((current) => ({
      ...current,
      savedRoutes: current.savedRoutes.filter((route) => route.id !== routeId),
    }));
  }, []);

  const takeQueueTicket = useCallback((input: TakeQueueTicketInput) => {
    const ticket: QueueTicket = {
      ...input,
      id: uid("ticket"),
      initialPosition: input.position,
      initialEtaMinutes: input.etaMinutes,
      status: "waiting",
      createdAt: new Date().toISOString(),
    };
    setState((current) => ({
      ...current,
      queueTickets: [ticket, ...current.queueTickets],
      notifications: [
        makeNotification(
          "Navbatga yozildingiz",
          `Talon ${ticket.number} · taxminan ${ticket.etaMinutes} daqiqa.`,
          "queue",
        ),
        ...current.notifications,
      ],
    }));
    return ticket;
  }, []);

  // Demo: the queue only moves when the user asks it to. A real feed would
  // push this instead.
  const advanceQueueTicket = useCallback((ticketId: string) => {
    setState((current) => {
      let called = false;
      const queueTickets = current.queueTickets.map((ticket) => {
        if (ticket.id !== ticketId || ticket.status !== "waiting") return ticket;
        const step = 1 + Math.floor(Math.random() * 2);
        const position = Math.max(0, ticket.position - step);
        called = position === 0;
        return {
          ...ticket,
          position,
          etaMinutes: position * 3,
          status: called ? ("called" as const) : ticket.status,
        };
      });

      return {
        ...current,
        queueTickets,
        notifications: called
          ? [
              makeNotification("Navbatingiz keldi", "Ko‘rsatilgan oynaga yaqinlashing.", "queue"),
              ...current.notifications,
            ]
          : current.notifications,
      };
    });
  }, []);

  const closeQueueTicket = useCallback(
    (ticketId: string, status: "served" | "cancelled") => {
      setState((current) => ({
        ...current,
        queueTickets: current.queueTickets.map((ticket) =>
          ticket.id === ticketId && (ticket.status === "waiting" || ticket.status === "called")
            ? { ...ticket, status, closedAt: new Date().toISOString() }
            : ticket,
        ),
      }));
    },
    [],
  );

  const completeQueueTicket = useCallback(
    (ticketId: string) => closeQueueTicket(ticketId, "served"),
    [closeQueueTicket],
  );

  const cancelQueueTicket = useCallback(
    (ticketId: string) => closeQueueTicket(ticketId, "cancelled"),
    [closeQueueTicket],
  );

  const createServiceBooking = useCallback((input: CreateServiceBookingInput) => {
    const prefix = { table: "TB", cinema: "CN", clinic: "CL", event: "EV" }[input.kind];
    const booking: ServiceBooking = {
      ...input,
      id: uid("booking"),
      code: `${prefix}-${Math.floor(1000 + Math.random() * 8999)}`,
      status: "active",
      createdAt: new Date().toISOString(),
    };
    setState((current) => ({
      ...current,
      serviceBookings: [booking, ...current.serviceBookings],
      notifications: [
        makeNotification("Bron tasdiqlandi", `${booking.title} · ${booking.code}`, "booking"),
        ...current.notifications,
      ],
    }));
    return booking;
  }, []);

  const cancelServiceBooking = useCallback((bookingId: string) => {
    setState((current) => ({
      ...current,
      serviceBookings: current.serviceBookings.map((booking) =>
        booking.id === bookingId && booking.status === "active"
          ? { ...booking, status: "cancelled" as const }
          : booking,
      ),
    }));
  }, []);

  const markNotificationRead = useCallback((notificationId: string) => {
    setState((current) => ({
      ...current,
      notifications: current.notifications.map((notification) =>
        notification.id === notificationId ? { ...notification, read: true } : notification,
      ),
    }));
  }, []);

  const markAllNotificationsRead = useCallback(() => {
    setState((current) => ({
      ...current,
      notifications: current.notifications.map((notification) => ({ ...notification, read: true })),
    }));
  }, []);

  const value = useMemo<AppContextValue>(
    () => ({
      ...state,
      completeOnboarding,
      login,
      updateProfile,
      setNotificationPref,
      logout,
      resetDemo,
      toggleFavorite,
      createReservation,
      cancelReservation,
      enterReservation,
      extendReservation,
      exitReservation,
      markNotificationRead,
      markAllNotificationsRead,
      unreadCount: state.notifications.filter((notification) => !notification.read).length,
      toggleQueueOrgFavorite,
      toggleEventFavorite,
      saveRoute,
      removeRoute,
      takeQueueTicket,
      advanceQueueTicket,
      completeQueueTicket,
      cancelQueueTicket,
      createServiceBooking,
      cancelServiceBooking,
    }),
    [
      state,
      completeOnboarding,
      login,
      updateProfile,
      setNotificationPref,
      logout,
      resetDemo,
      toggleFavorite,
      createReservation,
      cancelReservation,
      enterReservation,
      extendReservation,
      exitReservation,
      markNotificationRead,
      markAllNotificationsRead,
      toggleQueueOrgFavorite,
      toggleEventFavorite,
      saveRoute,
      removeRoute,
      takeQueueTicket,
      advanceQueueTicket,
      completeQueueTicket,
      cancelQueueTicket,
      createServiceBooking,
      cancelServiceBooking,
    ],
  );

  return <AppContext.Provider value={value}>{children}</AppContext.Provider>;
}

export function useApp() {
  const value = useContext(AppContext);
  if (!value) throw new Error("useApp must be used inside AppProvider");
  return value;
}
