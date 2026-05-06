import type {
  CheckInIntent,
  PilotVenue,
  VicinaCheckIn,
  VicinaSignal,
  VenueMessage,
  VisibilityMode
} from "@vicina/domain";
import type { Id, LatLng, TimestampMs } from "@vicina/shared-types";

export interface CreateMeetupRequest {
  title: string;
  description?: string;
  venueId?: Id;
  anchorLocation?: LatLng;
  visibility: VisibilityMode;
  scheduledForMs: TimestampMs;
}

export interface CreateMeetupResponse {
  meetupId: Id;
  status: "accepted";
}

export interface VicinaVenueState extends PilotVenue {
  activeCheckIns: VicinaCheckIn[];
  messages: VenueMessage[];
}

export interface VicinaStateResponse {
  serverNowMs: TimestampMs;
  venues: VicinaVenueState[];
}

export interface UpsertCheckInRequest {
  venueId: Id;
  userId: Id;
  displayName: string;
  note?: string;
  intent: CheckInIntent;
}

export interface UpsertCheckInResponse {
  checkIn: VicinaCheckIn;
}

export interface DeleteCheckInRequest {
  userId: Id;
}

export interface DeleteCheckInResponse {
  removed: boolean;
}

export interface CreateVenueMessageRequest {
  venueId: Id;
  userId: Id;
  displayName: string;
  body: string;
}

export interface CreateVenueMessageResponse {
  message: VenueMessage;
}

export interface VicinaWorkflowHandoff {
  schema: "tenra-vicina.workflow-handoff.v1";
  exportedAtMs: TimestampMs;
  sourceApp: "vicina";
  workflow: "coordinate-event" | "review-safety" | "publish-local-summary";
  targetApps: Array<"assembly" | "guardrail" | "sentinel" | "proxy">;
  signal?: Pick<
    VicinaSignal,
    "id" | "title" | "description" | "category" | "approximateLocationLabel" | "startsAtMs" | "expiresAtMs"
  >;
  operatorNote: string;
}

export function buildVicinaWorkflowHandoff(input: {
  workflow: VicinaWorkflowHandoff["workflow"];
  signal?: VicinaWorkflowHandoff["signal"] | undefined;
  operatorNote?: string | undefined;
  exportedAtMs?: TimestampMs | undefined;
}): VicinaWorkflowHandoff {
  const targetAppsByWorkflow: Record<VicinaWorkflowHandoff["workflow"], VicinaWorkflowHandoff["targetApps"]> = {
    "coordinate-event": ["assembly", "proxy"],
    "review-safety": ["guardrail", "sentinel"],
    "publish-local-summary": ["assembly", "proxy"]
  };

  const handoff: VicinaWorkflowHandoff = {
    schema: "tenra-vicina.workflow-handoff.v1",
    exportedAtMs: input.exportedAtMs ?? Date.now(),
    sourceApp: "vicina",
    workflow: input.workflow,
    targetApps: targetAppsByWorkflow[input.workflow],
    operatorNote: input.operatorNote ?? "Route this nearby coordination context to the selected suite apps."
  };

  if (input.signal) {
    handoff.signal = input.signal;
  }

  return handoff;
}
