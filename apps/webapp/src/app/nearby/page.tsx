"use client";

import { useState } from "react";
import { DEFAULT_DISCOVERY_RADIUS_MILES } from "@vicina/domain";
import { PageShell } from "@/components/layout/PageShell";
import { SignalCard } from "@/components/signal/SignalCard";
import { SignalFilters } from "@/components/signal/SignalFilters";
import {
  DEFAULT_AREA_ID,
  findArea,
  filterSignals,
  loadSignals,
  type SignalFilters as SignalFiltersValue
} from "@/lib/mock/signals";

const defaultFilters: SignalFiltersValue = {
  areaId: DEFAULT_AREA_ID,
  category: "all",
  radiusMiles: DEFAULT_DISCOVERY_RADIUS_MILES,
  sort: "nearest",
  time: "all"
};

export default function NearbyPage() {
  const [filters, setFilters] = useState<SignalFiltersValue>(defaultFilters);
  const [signals] = useState(() => loadSignals());
  const selectedArea = findArea(filters.areaId);
  const visibleSignals = filterSignals(signals, filters, selectedArea.coordinates);

  return (
    <PageShell>
      <section className="page-hero page-hero--compact">
        <div>
          <h1>Nearby signals</h1>
          <p>Active local plans around {selectedArea.label}, sorted only by distance or time.</p>
        </div>
      </section>
      <SignalFilters filters={filters} onChange={setFilters} />
      <section className="signal-list" aria-label="Active nearby signals">
        {visibleSignals.map((signal) => (
          <SignalCard key={signal.id} origin={selectedArea.coordinates} signal={signal} />
        ))}
        {visibleSignals.length === 0 ? (
          <div className="empty-state">
            <h2>No active signals in this view.</h2>
            <p>Try a wider radius, another category, or a nearby area.</p>
          </div>
        ) : null}
      </section>
    </PageShell>
  );
}
