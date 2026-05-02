import {
  DEFAULT_DISCOVERY_RADIUS_MILES,
  DEFAULT_SIGNAL_DURATION_HOURS,
  SIGNAL_CATEGORIES,
  SIGNAL_CATEGORY_LABELS,
  type DiscoveryRadiusMiles,
  type SignalCategory,
  type SignalComment,
  type SignalStatus,
  type VicinaProfile,
  type VicinaSignal
} from "@vicina/domain";
import type { LatLng } from "@vicina/shared-types";
import { distanceMiles } from "../utils/location";

export type SignalSort = "nearest" | "soonest" | "newest";
export type TimeFilter = "now" | "today" | "all";
export type CategoryFilter = SignalCategory | "all";

export interface BrowseArea {
  id: string;
  label: string;
  approximateLocationLabel: string;
  coordinates: LatLng;
}

export interface SignalRecord extends VicinaSignal {
  comments: SignalComment[];
  interestedUserIds: string[];
}

export interface SignalFilters {
  areaId: string;
  category: CategoryFilter;
  radiusMiles: DiscoveryRadiusMiles;
  sort: SignalSort;
  time: TimeFilter;
}

export const LOCAL_USER: VicinaProfile = {
  id: "web-user-local",
  displayName: "Jordan",
  bio: "Coffee chats, quick walks, and low-pressure local plans.",
  createdAtMs: 0,
  updatedAtMs: 0
};

export const areaOptions: BrowseArea[] = [
  {
    id: "downtown-winston-salem",
    label: "Downtown Winston-Salem",
    approximateLocationLabel: "near Downtown",
    coordinates: { lat: 36.1, lng: -80.24 }
  },
  {
    id: "innovation-quarter",
    label: "Innovation Quarter",
    approximateLocationLabel: "near the Innovation Quarter",
    coordinates: { lat: 36.102, lng: -80.246 }
  },
  {
    id: "west-end",
    label: "West End",
    approximateLocationLabel: "near West End",
    coordinates: { lat: 36.095, lng: -80.255 }
  },
  {
    id: "downtown-greensboro",
    label: "Downtown Greensboro",
    approximateLocationLabel: "near Downtown Greensboro",
    coordinates: { lat: 36.0726, lng: -79.792 }
  },
  {
    id: "downtown-raleigh",
    label: "Downtown Raleigh",
    approximateLocationLabel: "near Downtown Raleigh",
    coordinates: { lat: 35.7796, lng: -78.6382 }
  }
];

export const DEFAULT_AREA_ID = "downtown-winston-salem";
export const DEFAULT_COORDINATES: LatLng = findArea(DEFAULT_AREA_ID).coordinates;

export const categoryOptions = [
  { label: "All", value: "all" as const },
  ...SIGNAL_CATEGORIES.map((value) => ({
    label: SIGNAL_CATEGORY_LABELS[value],
    value
  }))
];

export const radiusOptions: DiscoveryRadiusMiles[] = [1, 3, 5, 10];

export const timeOptions: { label: string; value: TimeFilter }[] = [
  { label: "Now", value: "now" },
  { label: "Today", value: "today" },
  { label: "Any active", value: "all" }
];

export const sortOptions: { label: string; value: SignalSort }[] = [
  { label: "Nearest", value: "nearest" },
  { label: "Soonest", value: "soonest" },
  { label: "Newest", value: "newest" }
];

const STORAGE_KEY = "vicina.web.signals.v2";

export function findArea(areaId: string): BrowseArea {
  const defaultArea = areaOptions[0];
  if (!defaultArea) {
    throw new Error("At least one Vicina browse area is required.");
  }

  return areaOptions.find((area) => area.id === areaId) ?? defaultArea;
}

export function loadSignals(nowMs = Date.now()): SignalRecord[] {
  if (typeof window === "undefined") {
    return seedSignals(nowMs);
  }

  const stored = window.localStorage.getItem(STORAGE_KEY);
  if (!stored) {
    const seeded = seedSignals(nowMs);
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(seeded));
    return seeded;
  }

  try {
    const parsed = JSON.parse(stored) as SignalRecord[];
    return parsed.map((signal) => expireSignal(signal, nowMs));
  } catch {
    const seeded = seedSignals(nowMs);
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(seeded));
    return seeded;
  }
}

export function saveSignal(signal: SignalRecord): void {
  const signals = loadSignals().filter((existing) => existing.id !== signal.id);
  writeSignals([signal, ...signals]);
}

export function updateSignal(signal: SignalRecord): void {
  const signals = loadSignals().map((existing) =>
    existing.id === signal.id ? signal : existing
  );
  writeSignals(signals);
}

export function findSignal(signalId: string): SignalRecord | undefined {
  return loadSignals().find((signal) => signal.id === signalId);
}

export function filterSignals(
  signals: SignalRecord[],
  filters: SignalFilters,
  origin: LatLng = findArea(filters.areaId).coordinates,
  nowMs = Date.now()
): SignalRecord[] {
  return signals
    .filter((signal) => signal.status === "active" && signal.contentStatus === "visible")
    .filter((signal) => signal.expiresAtMs > nowMs)
    .filter((signal) => {
      if (filters.category === "all") {
        return true;
      }

      return signal.category === filters.category;
    })
    .filter((signal) => {
      const publicRadius = Math.min(filters.radiusMiles, signal.visibilityRadiusMiles);
      return distanceMiles(origin, signal.coordinates) <= publicRadius;
    })
    .filter((signal) => {
      if (filters.time === "all") {
        return true;
      }

      if (filters.time === "now") {
        return signal.startsAtMs <= nowMs;
      }

      return signal.startsAtMs <= nowMs + 12 * 60 * 60 * 1000;
    })
    .sort((a, b) => {
      if (filters.sort === "newest") {
        return b.createdAtMs - a.createdAtMs;
      }

      if (filters.sort === "soonest") {
        return a.startsAtMs - b.startsAtMs;
      }

      return distanceMiles(origin, a.coordinates) - distanceMiles(origin, b.coordinates);
    });
}

export function createDraftSignal(input: {
  approximateLocationLabel: string;
  category: SignalCategory;
  coordinates: LatLng;
  description: string;
  expiresAtMs: number;
  startsAtMs: number;
  title: string;
  visibilityRadiusMiles: DiscoveryRadiusMiles;
}): SignalRecord {
  const nowMs = Date.now();

  return {
    id: `web-signal-${nowMs}`,
    authorId: LOCAL_USER.id,
    authorDisplayName: LOCAL_USER.displayName,
    title: input.title,
    description: input.description,
    category: input.category,
    approximateLocationLabel: input.approximateLocationLabel,
    coordinates: input.coordinates,
    startsAtMs: input.startsAtMs,
    expiresAtMs: input.expiresAtMs,
    visibilityRadiusMiles: input.visibilityRadiusMiles,
    status: "active",
    contentStatus: "visible",
    comments: [],
    createdAtMs: nowMs,
    interestedUserIds: [],
    updatedAtMs: nowMs
  };
}

export function getInterestCount(signal: SignalRecord): number {
  return signal.interestedUserIds.length;
}

export function getDistanceLabel(signal: SignalRecord, origin: LatLng = DEFAULT_COORDINATES): string {
  const miles = distanceMiles(origin, signal.coordinates);
  if (miles < 0.5) {
    return "within 1 mile";
  }

  const roundedMiles = Math.max(1, Math.round(miles));
  return `within ${roundedMiles} ${roundedMiles === 1 ? "mile" : "miles"}`;
}

function seedSignals(nowMs: number): SignalRecord[] {
  const baseStartMs = nowMs - 18 * 60 * 1000;
  const baseExpiresMs = baseStartMs + DEFAULT_SIGNAL_DURATION_HOURS * 60 * 60 * 1000;

  return [
    makeSignal({
      id: "seed-coffee",
      authorDisplayName: "Ana",
      title: "Coffee and a quick reset",
      description: "Open table for a short chat or co-working hour before the next block.",
      category: "food-coffee",
      approximateLocationLabel: "near Downtown",
      coordinates: { lat: 36.1, lng: -80.24 },
      startsAtMs: baseStartMs,
      expiresAtMs: baseExpiresMs,
      interestedUserIds: ["seed-marco", "seed-jules"],
      comments: [
        {
          id: "comment-coffee-1",
          signalId: "seed-coffee",
          authorId: "seed-marco",
          authorDisplayName: "Marco",
          body: "I can stop by for 20 minutes.",
          contentStatus: "visible",
          createdAtMs: nowMs - 7 * 60 * 1000,
          updatedAtMs: nowMs - 7 * 60 * 1000
        }
      ]
    }),
    makeSignal({
      id: "seed-games",
      authorDisplayName: "Marco",
      title: "Casual board games tonight",
      description: "Bringing two lightweight games. Drop in if you want a low-key table.",
      category: "games",
      approximateLocationLabel: "near the Innovation Quarter",
      coordinates: { lat: 36.102, lng: -80.246 },
      startsAtMs: nowMs + 42 * 60 * 1000,
      expiresAtMs: nowMs + 5 * 60 * 60 * 1000,
      visibilityRadiusMiles: 5,
      interestedUserIds: ["seed-ana"]
    }),
    makeSignal({
      id: "seed-walk",
      authorDisplayName: "Jules",
      title: "Walk before the next work block",
      description: "Relaxed loop outside. Good for a quick screen break.",
      category: "outdoors",
      approximateLocationLabel: "near Bailey Park",
      coordinates: { lat: 36.099, lng: -80.238 },
      startsAtMs: nowMs + 24 * 60 * 1000,
      expiresAtMs: nowMs + 2 * 60 * 60 * 1000,
      visibilityRadiusMiles: 3
    }),
    makeSignal({
      id: "seed-study",
      authorDisplayName: "Nina",
      title: "Quiet study block",
      description: "A focused hour with room for one or two people.",
      category: "study-work",
      approximateLocationLabel: "near West End",
      coordinates: { lat: 36.095, lng: -80.255 },
      startsAtMs: nowMs + 90 * 60 * 1000,
      expiresAtMs: nowMs + 4 * 60 * 60 * 1000,
      visibilityRadiusMiles: 5
    }),
    makeSignal({
      id: "seed-greensboro",
      authorDisplayName: "Sam",
      title: "Lunch walk downtown",
      description: "Grabbing something quick and walking a few blocks if anyone wants company.",
      category: "food-coffee",
      approximateLocationLabel: "near Downtown Greensboro",
      coordinates: { lat: 36.0726, lng: -79.792 },
      startsAtMs: nowMs + 35 * 60 * 1000,
      expiresAtMs: nowMs + 3 * 60 * 60 * 1000,
      visibilityRadiusMiles: 3
    }),
    makeSignal({
      id: "seed-raleigh",
      authorDisplayName: "Mika",
      title: "Low-key live set",
      description: "Heading over early and open to meeting before the first act starts.",
      category: "music-nightlife",
      approximateLocationLabel: "near Downtown Raleigh",
      coordinates: { lat: 35.7796, lng: -78.6382 },
      startsAtMs: nowMs + 2 * 60 * 60 * 1000,
      expiresAtMs: nowMs + 6 * 60 * 60 * 1000,
      visibilityRadiusMiles: 5
    })
  ];
}

function makeSignal(
  input: Partial<SignalRecord> &
    Pick<
      SignalRecord,
      | "approximateLocationLabel"
      | "authorDisplayName"
      | "category"
      | "coordinates"
      | "description"
      | "expiresAtMs"
      | "id"
      | "startsAtMs"
      | "title"
    >
): SignalRecord {
  const createdAtMs = input.createdAtMs ?? input.startsAtMs - 15 * 60 * 1000;

  return {
    authorId: input.authorId ?? `profile-${input.authorDisplayName.toLowerCase()}`,
    authorDisplayName: input.authorDisplayName,
    category: input.category,
    comments: input.comments ?? [],
    contentStatus: input.contentStatus ?? "visible",
    coordinates: input.coordinates,
    createdAtMs,
    description: input.description,
    expiresAtMs: input.expiresAtMs,
    id: input.id,
    interestedUserIds: input.interestedUserIds ?? [],
    status: (input.status ?? "active") as SignalStatus,
    title: input.title,
    approximateLocationLabel: input.approximateLocationLabel,
    startsAtMs: input.startsAtMs,
    updatedAtMs: input.updatedAtMs ?? createdAtMs,
    visibilityRadiusMiles: input.visibilityRadiusMiles ?? DEFAULT_DISCOVERY_RADIUS_MILES
  };
}

function expireSignal(signal: SignalRecord, nowMs: number): SignalRecord {
  if (signal.expiresAtMs > nowMs || signal.status !== "active") {
    return signal;
  }

  return { ...signal, status: "expired" };
}

function writeSignals(signals: SignalRecord[]): void {
  if (typeof window === "undefined") {
    return;
  }

  window.localStorage.setItem(STORAGE_KEY, JSON.stringify(signals));
}
