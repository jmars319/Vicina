"use client";

import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import {
  DEFAULT_SIGNAL_DURATION_HOURS,
  DISCOVERY_RADIUS_MILES,
  SIGNAL_CATEGORIES,
  SIGNAL_CATEGORY_LABELS,
  type DiscoveryRadiusMiles,
  type SignalCategory
} from "@vicina/domain";
import { createSignalRequestSchema } from "@vicina/validation";
import { PageShell } from "@/components/layout/PageShell";
import { Button } from "@/components/ui/Button";
import { Card } from "@/components/ui/Card";
import { Chip } from "@/components/ui/Chip";
import { Input, Textarea } from "@/components/ui/Input";
import {
  DEFAULT_AREA_ID,
  areaOptions,
  createDraftSignal,
  findArea,
  saveSignal
} from "@/lib/mock/signals";

const durationOptions = [1, 4, 8, 24] as const;

export default function CreatePage() {
  const router = useRouter();
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [category, setCategory] = useState<SignalCategory>("general");
  const [areaId, setAreaId] = useState(DEFAULT_AREA_ID);
  const selectedArea = findArea(areaId);
  const [locationLabel, setLocationLabel] = useState(selectedArea.approximateLocationLabel);
  const [radiusMiles, setRadiusMiles] = useState<DiscoveryRadiusMiles>(3);
  const [durationHours, setDurationHours] = useState(DEFAULT_SIGNAL_DURATION_HOURS);
  const [message, setMessage] = useState("");

  const categoryChoices = useMemo(
    () =>
      SIGNAL_CATEGORIES.map((value) => ({
        label: SIGNAL_CATEGORY_LABELS[value],
        value
      })),
    []
  );

  function selectArea(nextAreaId: string) {
    const nextArea = findArea(nextAreaId);
    setAreaId(nextArea.id);
    setLocationLabel(nextArea.approximateLocationLabel);
  }

  function submitSignal() {
    const nowMs = Date.now();
    const parsed = createSignalRequestSchema.safeParse({
      title,
      description,
      category,
      approximateLocationLabel: locationLabel,
      coordinates: selectedArea.coordinates,
      startsAtMs: nowMs,
      expiresAtMs: nowMs + durationHours * 60 * 60 * 1000,
      visibilityRadiusMiles: radiusMiles
    });

    if (!parsed.success) {
      setMessage(parsed.error.issues[0]?.message ?? "Check the signal details.");
      return;
    }

    const signal = createDraftSignal(parsed.data);
    saveSignal(signal);
    router.push(`/signal/${signal.id}`);
  }

  return (
    <PageShell>
      <section className="page-hero page-hero--compact">
        <div>
          <h1>Create signal</h1>
          <p>Use approximate location and a short time window.</p>
        </div>
      </section>
      <Card className="form-card">
        <div className="privacy-note">
          Vicina shares approximate nearby activity, not exact user location.
        </div>
        <label className="field">
          <span>Area</span>
          <select
            className="input"
            onChange={(event) => selectArea(event.target.value)}
            value={areaId}
          >
            {areaOptions.map((area) => (
              <option key={area.id} value={area.id}>
                {area.label}
              </option>
            ))}
          </select>
        </label>
        <Input
          label="Title"
          maxLength={80}
          onChange={(event) => setTitle(event.target.value)}
          placeholder="Coffee before the next meeting"
          value={title}
        />
        <Textarea
          label="Description"
          maxLength={240}
          onChange={(event) => setDescription(event.target.value)}
          placeholder="A short note about what is happening."
          value={description}
        />
        <Input
          label="Approximate area"
          maxLength={80}
          onChange={(event) => setLocationLabel(event.target.value)}
          placeholder="near Downtown"
          value={locationLabel}
        />
        <div className="choice-group">
          <span>Category</span>
          <div className="chip-row">
            {categoryChoices.map((choice) => (
              <Chip
                active={choice.value === category}
                key={choice.value}
                onClick={() => setCategory(choice.value)}
              >
                {choice.label}
              </Chip>
            ))}
          </div>
        </div>
        <div className="choice-grid">
          <div className="choice-group">
            <span>Radius</span>
            <div className="chip-row">
              {DISCOVERY_RADIUS_MILES.map((radius) => (
                <Chip
                  active={radius === radiusMiles}
                  key={radius}
                  onClick={() => setRadiusMiles(radius)}
                >
                  {radius} mi
                </Chip>
              ))}
            </div>
          </div>
          <div className="choice-group">
            <span>Expires</span>
            <div className="chip-row">
              {durationOptions.map((duration) => (
                <Chip
                  active={duration === durationHours}
                  key={duration}
                  onClick={() => setDurationHours(duration)}
                >
                  {duration}h
                </Chip>
              ))}
            </div>
          </div>
        </div>
        {message ? <p className="form-message">{message}</p> : null}
        <Button onClick={submitSignal}>Create signal</Button>
      </Card>
    </PageShell>
  );
}
