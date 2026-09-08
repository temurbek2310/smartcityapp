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
  Reservation,
  UserProfile,
} from "@/lib/types";
import { calculateFinalTotal } from "@/lib/reservation";

const STORAGE_KEY = "b-space-mvp-v1";

const initialState: BSpaceState = {
  hydrated: false,
  onboardingDone: false,
  user: null,
  favorites: [],
  reservations: [],
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

type AppContextValue = BSpaceState & {
  completeOnboarding: () => void;
  login: (profile: UserProfile) => void;
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
          const parsed = JSON.parse(saved) as Omit<BSpaceState, "hydrated">;
          setState({ ...initialState, ...parsed, hydrated: true });
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
      reservations: state.reservations,
      notifications: state.notifications,
    };
    localStorage.setItem(STORAGE_KEY, JSON.stringify(persisted));
  }, [state]);

  useEffect(() => {
    if (!state.hydrated) return;

    const checkTimers = () => {
      const now = Date.now();
      setState((current) => {
        let notifications = current.notifications;
        let changed = false;

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
      user: profile,
      notifications: [
        makeNotification("Xush kelibsiz", `${profile.name}, B SPACE profilingiz tayyor.`, "system"),
        ...current.notifications,
      ],
    }));
  }, []);

  const logout = useCallback(() => {
    setState((current) => ({ ...current, user: null }));
  }, []);

  const resetDemo = useCallback(() => {
    localStorage.removeItem(STORAGE_KEY);
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
        vehiclePlate: state.user.vehiclePlate,
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

  const cancelReservation = useCallback((reservationId: string) => {
    setState((current) => ({
      ...current,
      reservations: current.reservations.map((reservation) =>
        reservation.id === reservationId && reservation.status === "reserved"
          ? { ...reservation, status: "cancelled" as const }
          : reservation,
      ),
      notifications: [
        makeNotification("Bron bekor qilindi", "Parking broni bekor qilindi.", "booking"),
        ...current.notifications,
      ],
    }));
  }, []);

  const enterReservation = useCallback((reservationId: string) => {
    const enteredAt = new Date();
    setState((current) => ({
      ...current,
      reservations: current.reservations.map((reservation) => {
        if (reservation.id !== reservationId || reservation.status !== "reserved") return reservation;
        const bookedEnd = new Date(reservation.endAt).getTime();
        const minimumEnd = enteredAt.getTime() + reservation.durationHours * 3_600_000;
        return {
          ...reservation,
          status: "active" as const,
          enteredAt: enteredAt.toISOString(),
          endAt: new Date(Math.max(bookedEnd, minimumEnd)).toISOString(),
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
    }),
    [
      state,
      completeOnboarding,
      login,
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
    ],
  );

  return <AppContext.Provider value={value}>{children}</AppContext.Provider>;
}

export function useApp() {
  const value = useContext(AppContext);
  if (!value) throw new Error("useApp must be used inside AppProvider");
  return value;
}
