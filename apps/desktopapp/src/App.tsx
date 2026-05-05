import { useEffect, useMemo, useState } from "react";
import type { FormEvent } from "react";
import { APP_NAME } from "@vicina/config";
import {
  DEFAULT_DISCOVERY_RADIUS_MILES,
  DEFAULT_SIGNAL_DURATION_HOURS,
  DISCOVERY_RADIUS_MILES,
  SIGNAL_CATEGORIES,
  SIGNAL_CATEGORY_LABELS,
  type DiscoveryRadiusMiles,
  type SignalCategory,
  type SignalComment,
  type SignalStatus,
  type VicinaProfile,
  type VicinaSignal
} from "@vicina/domain";
import { readDesktopStore, readLegacyLocalStorage, writeDesktopStore } from "./lib/desktopStore";

type CategoryFilter = SignalCategory | "all";
type SignalSort = "nearest" | "soonest" | "newest";
type TimeFilter = "now" | "today" | "all";

interface LatLng {
  lat: number;
  lng: number;
}

interface BrowseArea {
  id: string;
  label: string;
  approximateLocationLabel: string;
  coordinates: LatLng;
}

interface SignalRecord extends VicinaSignal {
  comments: SignalComment[];
  interestedUserIds: string[];
}

interface SignalFilters {
  areaId: string;
  category: CategoryFilter;
  radiusMiles: DiscoveryRadiusMiles;
  sort: SignalSort;
  time: TimeFilter;
}

interface DraftSignal {
  areaId: string;
  category: SignalCategory;
  description: string;
  durationHours: string;
  radiusMiles: DiscoveryRadiusMiles;
  title: string;
}

interface VicinaDesktopBoard {
  blockedAuthorIds: string[];
  reportedSignalIds: string[];
  signals: SignalRecord[];
}

const localUser: VicinaProfile = {
  id: "desktop-user-local",
  displayName: "Local operator",
  bio: "Local Vicina desktop profile.",
  createdAtMs: 0,
  updatedAtMs: 0
};

const areaOptions: BrowseArea[] = [
  {
    id: "downtown-winston-salem",
    label: "Downtown Winston-Salem",
    approximateLocationLabel: "near Downtown Winston-Salem",
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

const defaultAreaId = "downtown-winston-salem";
const legacySignalStorageKey = "vicina.desktop.signals.v1";
const storageKey = "vicina.desktop.board.v2";

const categoryOptions: Array<{ label: string; value: CategoryFilter }> = [
  { label: "All", value: "all" },
  ...SIGNAL_CATEGORIES.map((category) => ({
    label: SIGNAL_CATEGORY_LABELS[category],
    value: category
  }))
];

const timeOptions: Array<{ label: string; value: TimeFilter }> = [
  { label: "Now", value: "now" },
  { label: "Today", value: "today" },
  { label: "Any active", value: "all" }
];

const sortOptions: Array<{ label: string; value: SignalSort }> = [
  { label: "Nearest", value: "nearest" },
  { label: "Soonest", value: "soonest" },
  { label: "Newest", value: "newest" }
];

const defaultFilters: SignalFilters = {
  areaId: defaultAreaId,
  category: "all",
  radiusMiles: DEFAULT_DISCOVERY_RADIUS_MILES,
  sort: "nearest",
  time: "now"
};

const defaultDraft: DraftSignal = {
  areaId: defaultAreaId,
  category: "food-coffee",
  description: "",
  durationHours: String(DEFAULT_SIGNAL_DURATION_HOURS),
  radiusMiles: DEFAULT_DISCOVERY_RADIUS_MILES,
  title: ""
};

export default function App() {
  const [signals, setSignals] = useState<SignalRecord[]>(() => seedSignals(Date.now()));
  const [filters, setFilters] = useState<SignalFilters>(defaultFilters);
  const [selectedSignalId, setSelectedSignalId] = useState<string>(() => signals[0]?.id ?? "");
  const [draft, setDraft] = useState<DraftSignal>(defaultDraft);
  const [commentBody, setCommentBody] = useState("");
  const [reportedSignalIds, setReportedSignalIds] = useState<string[]>([]);
  const [blockedAuthorIds, setBlockedAuthorIds] = useState<string[]>([]);
  const [isStoreReady, setIsStoreReady] = useState(false);

  const selectedArea = findArea(filters.areaId);

  useEffect(() => {
    let cancelled = false;

    readDesktopStore<VicinaDesktopBoard>(storageKey)
      .then((storedBoard) => {
        if (cancelled) return;

        const legacySignals = readLegacyLocalStorage<SignalRecord[]>(legacySignalStorageKey);
        const nowMs = Date.now();

        if (storedBoard?.signals.length) {
          const nextSignals = storedBoard.signals.map((signal) => expireSignal(signal, nowMs));
          setSignals(nextSignals);
          setReportedSignalIds(Array.isArray(storedBoard.reportedSignalIds) ? storedBoard.reportedSignalIds : []);
          setBlockedAuthorIds(Array.isArray(storedBoard.blockedAuthorIds) ? storedBoard.blockedAuthorIds : []);
          setSelectedSignalId(nextSignals[0]?.id ?? "");
        } else if (Array.isArray(legacySignals) && legacySignals.length > 0) {
          const nextSignals = legacySignals.map((signal) => expireSignal(signal, nowMs));
          setSignals(nextSignals);
          setSelectedSignalId(nextSignals[0]?.id ?? "");
        }

        setIsStoreReady(true);
      })
      .catch(() => {
        if (!cancelled) {
          setIsStoreReady(true);
        }
      });

    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    if (!isStoreReady) return;

    void writeDesktopStore(storageKey, {
      blockedAuthorIds,
      reportedSignalIds,
      signals
    } satisfies VicinaDesktopBoard);
  }, [blockedAuthorIds, isStoreReady, reportedSignalIds, signals]);

  const visibleSignals = useMemo(
    () =>
      filterSignals(signals, filters, selectedArea.coordinates).filter(
        (signal) => !blockedAuthorIds.includes(signal.authorId)
      ),
    [blockedAuthorIds, filters, selectedArea.coordinates, signals]
  );

  const selectedSignal =
    visibleSignals.find((signal) => signal.id === selectedSignalId) ?? visibleSignals[0];

  function persistSignals(nextSignals: SignalRecord[]) {
    setSignals(nextSignals);
  }

  function handleCreateSignal(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();

    const title = draft.title.trim();
    const description = draft.description.trim();
    if (!title || !description) {
      return;
    }

    const area = findArea(draft.areaId);
    const nowMs = Date.now();
    const durationHours = clamp(Number(draft.durationHours) || DEFAULT_SIGNAL_DURATION_HOURS, 1, 24);
    const signal = makeSignal({
      id: `desktop-signal-${nowMs}`,
      authorId: localUser.id,
      authorDisplayName: localUser.displayName,
      title,
      description,
      category: draft.category,
      approximateLocationLabel: area.approximateLocationLabel,
      coordinates: area.coordinates,
      startsAtMs: nowMs,
      expiresAtMs: nowMs + durationHours * 60 * 60 * 1000,
      visibilityRadiusMiles: draft.radiusMiles,
      createdAtMs: nowMs,
      updatedAtMs: nowMs
    });

    const nextSignals = [signal, ...signals];
    persistSignals(nextSignals);
    setSelectedSignalId(signal.id);
    setFilters((current) => ({ ...current, areaId: draft.areaId, category: "all", time: "all" }));
    setDraft(defaultDraft);
  }

  function handleToggleInterest(signal: SignalRecord) {
    const hasInterest = signal.interestedUserIds.includes(localUser.id);
    const nextSignal: SignalRecord = {
      ...signal,
      interestedUserIds: hasInterest
        ? signal.interestedUserIds.filter((id) => id !== localUser.id)
        : [...signal.interestedUserIds, localUser.id],
      updatedAtMs: Date.now()
    };

    persistSignals(replaceSignal(signals, nextSignal));
  }

  function handleAddComment(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!selectedSignal) {
      return;
    }

    const body = commentBody.trim();
    if (!body) {
      return;
    }

    const nowMs = Date.now();
    const comment: SignalComment = {
      id: `desktop-comment-${nowMs}`,
      signalId: selectedSignal.id,
      authorId: localUser.id,
      authorDisplayName: localUser.displayName,
      body,
      contentStatus: "visible",
      createdAtMs: nowMs,
      updatedAtMs: nowMs
    };

    const nextSignal: SignalRecord = {
      ...selectedSignal,
      comments: [...selectedSignal.comments, comment],
      updatedAtMs: nowMs
    };

    persistSignals(replaceSignal(signals, nextSignal));
    setCommentBody("");
  }

  function handleReportSignal(signal: SignalRecord) {
    if (!reportedSignalIds.includes(signal.id)) {
      setReportedSignalIds([...reportedSignalIds, signal.id]);
    }
  }

  function handleBlockAuthor(signal: SignalRecord) {
    if (signal.authorId === localUser.id || blockedAuthorIds.includes(signal.authorId)) {
      return;
    }

    setBlockedAuthorIds([...blockedAuthorIds, signal.authorId]);
  }

  return (
    <main className="desktop-shell">
      <aside className="app-rail" aria-label="Vicina desktop navigation">
        <div>
          <p className="brand-mark">V</p>
          <h1>{APP_NAME}</h1>
          <p className="rail-copy">Local coordination for nearby plans and low-pressure meetups.</p>
        </div>

        <label className="field">
          <span>Browse area</span>
          <select
            value={filters.areaId}
            onChange={(event) =>
              setFilters({ ...filters, areaId: event.target.value, sort: "nearest" })
            }
          >
            {areaOptions.map((area) => (
              <option key={area.id} value={area.id}>
                {area.label}
              </option>
            ))}
          </select>
        </label>

        <div className="rail-metrics" aria-label="Signal summary">
          <div>
            <span>Active</span>
            <strong>{visibleSignals.length}</strong>
          </div>
          <div>
            <span>Reports</span>
            <strong>{reportedSignalIds.length}</strong>
          </div>
          <div>
            <span>Blocked</span>
            <strong>{blockedAuthorIds.length}</strong>
          </div>
        </div>
      </aside>

      <section className="signal-column" aria-label="Nearby signals">
        <header className="section-header">
          <div>
            <p>Nearby signals</p>
            <h2>{selectedArea.label}</h2>
          </div>
          <span>{filters.radiusMiles} mi</span>
        </header>

        <div className="filter-grid">
          <label className="field">
            <span>Category</span>
            <select
              value={filters.category}
              onChange={(event) =>
                setFilters({ ...filters, category: event.target.value as CategoryFilter })
              }
            >
              {categoryOptions.map((option) => (
                <option key={option.value} value={option.value}>
                  {option.label}
                </option>
              ))}
            </select>
          </label>

          <label className="field">
            <span>Time</span>
            <select
              value={filters.time}
              onChange={(event) =>
                setFilters({ ...filters, time: event.target.value as TimeFilter })
              }
            >
              {timeOptions.map((option) => (
                <option key={option.value} value={option.value}>
                  {option.label}
                </option>
              ))}
            </select>
          </label>

          <label className="field">
            <span>Sort</span>
            <select
              value={filters.sort}
              onChange={(event) =>
                setFilters({ ...filters, sort: event.target.value as SignalSort })
              }
            >
              {sortOptions.map((option) => (
                <option key={option.value} value={option.value}>
                  {option.label}
                </option>
              ))}
            </select>
          </label>

          <label className="field">
            <span>Radius</span>
            <select
              value={filters.radiusMiles}
              onChange={(event) =>
                setFilters({
                  ...filters,
                  radiusMiles: Number(event.target.value) as DiscoveryRadiusMiles
                })
              }
            >
              {DISCOVERY_RADIUS_MILES.map((radius) => (
                <option key={radius} value={radius}>
                  {radius} miles
                </option>
              ))}
            </select>
          </label>
        </div>

        <div className="signal-list">
          {visibleSignals.map((signal) => (
            <button
              className={`signal-row ${selectedSignal?.id === signal.id ? "is-selected" : ""}`}
              key={signal.id}
              onClick={() => setSelectedSignalId(signal.id)}
              type="button"
            >
              <span>{SIGNAL_CATEGORY_LABELS[signal.category]}</span>
              <strong>{signal.title}</strong>
              <small>
                {formatRelativeStart(signal.startsAtMs)} ·{" "}
                {getDistanceLabel(signal, selectedArea.coordinates)}
              </small>
            </button>
          ))}

          {visibleSignals.length === 0 ? (
            <div className="empty-state">
              <strong>No active signals in this view.</strong>
              <span>Adjust the filters or create a signal for the selected area.</span>
            </div>
          ) : null}
        </div>
      </section>

      <section className="detail-column" aria-label="Selected signal">
        {selectedSignal ? (
          <article className="detail-panel">
            <header className="detail-header">
              <div>
                <p>{SIGNAL_CATEGORY_LABELS[selectedSignal.category]}</p>
                <h2>{selectedSignal.title}</h2>
              </div>
              <span>{getDistanceLabel(selectedSignal, selectedArea.coordinates)}</span>
            </header>

            <p className="description">{selectedSignal.description}</p>

            <dl className="detail-list">
              <div>
                <dt>Host</dt>
                <dd>{selectedSignal.authorDisplayName}</dd>
              </div>
              <div>
                <dt>Window</dt>
                <dd>{formatSignalWindow(selectedSignal.startsAtMs, selectedSignal.expiresAtMs)}</dd>
              </div>
              <div>
                <dt>Location</dt>
                <dd>{selectedSignal.approximateLocationLabel}</dd>
              </div>
              <div>
                <dt>Interest</dt>
                <dd>{selectedSignal.interestedUserIds.length}</dd>
              </div>
            </dl>

            {reportedSignalIds.includes(selectedSignal.id) ? (
              <p className="status-note">Reported for review.</p>
            ) : null}

            <div className="action-row">
              <button
                className="primary-action"
                onClick={() => handleToggleInterest(selectedSignal)}
                type="button"
              >
                {selectedSignal.interestedUserIds.includes(localUser.id)
                  ? "Interest added"
                  : "Add interest"}
              </button>
              <button onClick={() => handleReportSignal(selectedSignal)} type="button">
                Report
              </button>
              <button
                disabled={selectedSignal.authorId === localUser.id}
                onClick={() => handleBlockAuthor(selectedSignal)}
                type="button"
              >
                Block host
              </button>
            </div>

            <section className="comments" aria-label="Signal replies">
              <h3>Replies</h3>
              <div className="comment-list">
                {selectedSignal.comments.map((comment) => (
                  <div className="comment" key={comment.id}>
                    <strong>{comment.authorDisplayName}</strong>
                    <p>{comment.body}</p>
                  </div>
                ))}
                {selectedSignal.comments.length === 0 ? (
                  <p className="muted">No replies yet.</p>
                ) : null}
              </div>

              <form className="comment-form" onSubmit={handleAddComment}>
                <input
                  aria-label="Reply"
                  onChange={(event) => setCommentBody(event.target.value)}
                  placeholder="Add a reply"
                  value={commentBody}
                />
                <button type="submit">Send</button>
              </form>
            </section>
          </article>
        ) : (
          <div className="detail-panel empty-state">
            <strong>Select a signal.</strong>
            <span>Nearby activity will appear here.</span>
          </div>
        )}

        <form className="create-panel" onSubmit={handleCreateSignal}>
          <header className="section-header compact">
            <div>
              <p>Create</p>
              <h2>New signal</h2>
            </div>
          </header>

          <div className="form-grid">
            <label className="field wide">
              <span>Title</span>
              <input
                onChange={(event) => setDraft({ ...draft, title: event.target.value })}
                placeholder="Coffee, walk, study block"
                value={draft.title}
              />
            </label>

            <label className="field">
              <span>Area</span>
              <select
                value={draft.areaId}
                onChange={(event) => setDraft({ ...draft, areaId: event.target.value })}
              >
                {areaOptions.map((area) => (
                  <option key={area.id} value={area.id}>
                    {area.label}
                  </option>
                ))}
              </select>
            </label>

            <label className="field">
              <span>Category</span>
              <select
                value={draft.category}
                onChange={(event) =>
                  setDraft({ ...draft, category: event.target.value as SignalCategory })
                }
              >
                {SIGNAL_CATEGORIES.map((category) => (
                  <option key={category} value={category}>
                    {SIGNAL_CATEGORY_LABELS[category]}
                  </option>
                ))}
              </select>
            </label>

            <label className="field">
              <span>Visible radius</span>
              <select
                value={draft.radiusMiles}
                onChange={(event) =>
                  setDraft({
                    ...draft,
                    radiusMiles: Number(event.target.value) as DiscoveryRadiusMiles
                  })
                }
              >
                {DISCOVERY_RADIUS_MILES.map((radius) => (
                  <option key={radius} value={radius}>
                    {radius} miles
                  </option>
                ))}
              </select>
            </label>

            <label className="field">
              <span>Hours active</span>
              <input
                max="24"
                min="1"
                onChange={(event) => setDraft({ ...draft, durationHours: event.target.value })}
                type="number"
                value={draft.durationHours}
              />
            </label>

            <label className="field wide">
              <span>Description</span>
              <textarea
                onChange={(event) => setDraft({ ...draft, description: event.target.value })}
                placeholder="Add the practical details."
                rows={3}
                value={draft.description}
              />
            </label>
          </div>

          <button className="primary-action" type="submit">
            Create signal
          </button>
        </form>
      </section>
    </main>
  );
}

function findArea(areaId: string): BrowseArea {
  const fallbackArea = areaOptions[0];
  if (!fallbackArea) {
    throw new Error("At least one Vicina browse area is required.");
  }

  return areaOptions.find((area) => area.id === areaId) ?? fallbackArea;
}

function filterSignals(
  signals: SignalRecord[],
  filters: SignalFilters,
  origin: LatLng,
  nowMs = Date.now()
): SignalRecord[] {
  return signals
    .filter((signal) => signal.status === "active" && signal.contentStatus === "visible")
    .filter((signal) => signal.expiresAtMs > nowMs)
    .filter((signal) => filters.category === "all" || signal.category === filters.category)
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
      approximateLocationLabel: "near Downtown Winston-Salem",
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

function replaceSignal(signals: SignalRecord[], nextSignal: SignalRecord): SignalRecord[] {
  return signals.map((signal) => (signal.id === nextSignal.id ? nextSignal : signal));
}

function expireSignal(signal: SignalRecord, nowMs: number): SignalRecord {
  if (signal.expiresAtMs > nowMs || signal.status !== "active") {
    return signal;
  }

  return { ...signal, status: "expired" };
}

function getDistanceLabel(signal: SignalRecord, origin: LatLng): string {
  const miles = distanceMiles(origin, signal.coordinates);
  if (miles < 0.5) {
    return "within 1 mile";
  }

  const roundedMiles = Math.max(1, Math.round(miles));
  return `within ${roundedMiles} ${roundedMiles === 1 ? "mile" : "miles"}`;
}

function distanceMiles(from: LatLng, to: LatLng): number {
  const earthRadiusMiles = 3958.8;
  const lat1 = toRadians(from.lat);
  const lat2 = toRadians(to.lat);
  const deltaLat = toRadians(to.lat - from.lat);
  const deltaLng = toRadians(to.lng - from.lng);

  const a =
    Math.sin(deltaLat / 2) * Math.sin(deltaLat / 2) +
    Math.cos(lat1) * Math.cos(lat2) * Math.sin(deltaLng / 2) * Math.sin(deltaLng / 2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  return earthRadiusMiles * c;
}

function toRadians(degrees: number): number {
  return degrees * (Math.PI / 180);
}

function formatRelativeStart(startsAtMs: number, nowMs = Date.now()): string {
  const deltaMinutes = Math.round((startsAtMs - nowMs) / 60000);

  if (deltaMinutes <= -5) {
    return "live";
  }

  if (deltaMinutes <= 5) {
    return "starting now";
  }

  if (deltaMinutes < 60) {
    return `in ${deltaMinutes} min`;
  }

  const hours = Math.round(deltaMinutes / 60);
  return `in ${hours} hr`;
}

function formatSignalWindow(startsAtMs: number, expiresAtMs: number): string {
  const starts = new Intl.DateTimeFormat(undefined, {
    hour: "numeric",
    minute: "2-digit"
  }).format(startsAtMs);
  const expires = new Intl.DateTimeFormat(undefined, {
    hour: "numeric",
    minute: "2-digit"
  }).format(expiresAtMs);

  return `${starts} to ${expires}`;
}

function clamp(value: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, value));
}
