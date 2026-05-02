import Link from "next/link";
import { SIGNAL_CATEGORY_LABELS } from "@vicina/domain";
import type { LatLng } from "@vicina/shared-types";
import type { SignalRecord } from "@/lib/mock/signals";
import { getDistanceLabel, getInterestCount } from "@/lib/mock/signals";
import { formatRelativeStart, formatSignalWindow } from "@/lib/utils/time";

interface SignalCardProps {
  origin?: LatLng;
  signal: SignalRecord;
}

export function SignalCard({ origin, signal }: SignalCardProps) {
  return (
    <Link className="signal-card" href={`/signal/${signal.id}`}>
      <div className="signal-card__top">
        <span className="tag">{SIGNAL_CATEGORY_LABELS[signal.category]}</span>
        <span className="signal-card__time">{formatRelativeStart(signal.startsAtMs)}</span>
      </div>
      <div className="signal-card__body">
        <h3>{signal.title}</h3>
        <p>{signal.description}</p>
      </div>
      <div className="signal-card__meta">
        <span>{signal.approximateLocationLabel}</span>
        <span>{getDistanceLabel(signal, origin)}</span>
        <span>{formatSignalWindow(signal.startsAtMs, signal.expiresAtMs)}</span>
      </div>
      <div className="signal-card__footer">
        <span>{getInterestCount(signal)} interested</span>
        <span>{signal.comments.length} replies</span>
      </div>
    </Link>
  );
}
