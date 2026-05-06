import {
  CHECK_IN_INTENTS,
  CONTENT_STATUSES,
  DISCOVERY_RADIUS_MILES,
  MAX_SIGNAL_DURATION_MS,
  PILOT_VENUES,
  SIGNAL_CATEGORIES,
  SIGNAL_STATUSES,
  VISIBILITY_MODES
} from "@vicina/domain";
import { z } from "zod";

export const latLngSchema = z.object({
  lat: z.number().min(-90).max(90),
  lng: z.number().min(-180).max(180)
});

export const createMeetupRequestSchema = z.object({
  title: z.string().trim().min(3).max(120),
  description: z.string().trim().max(500).optional(),
  venueId: z.string().trim().min(1).optional(),
  anchorLocation: latLngSchema.optional(),
  visibility: z.enum(VISIBILITY_MODES),
  scheduledForMs: z.number().int().nonnegative()
});

export type ParsedCreateMeetupRequest = z.infer<typeof createMeetupRequestSchema>;

export function parseCreateMeetupRequest(input: unknown): ParsedCreateMeetupRequest {
  return createMeetupRequestSchema.parse(input);
}

const venueIds = PILOT_VENUES.map((venue) => venue.id);

const userIdentitySchema = z.object({
  userId: z.string().trim().min(3).max(120),
  displayName: z.string().trim().min(1).max(60)
});

export const upsertCheckInRequestSchema = userIdentitySchema.extend({
  venueId: z.string().trim().refine((value) => venueIds.includes(value), {
    message: "Unknown venueId"
  }),
  note: z.string().trim().max(140).optional(),
  intent: z.enum(CHECK_IN_INTENTS)
});

export const deleteCheckInRequestSchema = z.object({
  userId: z.string().trim().min(3).max(120)
});

export const createVenueMessageRequestSchema = userIdentitySchema.extend({
  venueId: z.string().trim().refine((value) => venueIds.includes(value), {
    message: "Unknown venueId"
  }),
  body: z.string().trim().min(1).max(280)
});

export const signalCategorySchema = z.enum(SIGNAL_CATEGORIES);
export const signalStatusSchema = z.enum(SIGNAL_STATUSES);
export const contentStatusSchema = z.enum(CONTENT_STATUSES);

export const discoveryRadiusMilesSchema = z.number().refine(
  (value): value is (typeof DISCOVERY_RADIUS_MILES)[number] =>
    DISCOVERY_RADIUS_MILES.includes(value as (typeof DISCOVERY_RADIUS_MILES)[number]),
  {
    message: "Radius must be 1, 3, 5, or 10 miles"
  }
);

export const createSignalRequestSchema = z
  .object({
    title: z.string().trim().min(3).max(80),
    description: z.string().trim().min(1).max(240),
    category: signalCategorySchema,
    approximateLocationLabel: z.string().trim().min(3).max(80),
    coordinates: latLngSchema,
    startsAtMs: z.number().int().nonnegative(),
    expiresAtMs: z.number().int().nonnegative(),
    visibilityRadiusMiles: discoveryRadiusMilesSchema
  })
  .superRefine((value, context) => {
    if (value.expiresAtMs <= value.startsAtMs) {
      context.addIssue({
        code: z.ZodIssueCode.custom,
        message: "Expiration must be after the start time",
        path: ["expiresAtMs"]
      });
    }

    if (value.expiresAtMs - value.startsAtMs > MAX_SIGNAL_DURATION_MS) {
      context.addIssue({
        code: z.ZodIssueCode.custom,
        message: "Signals can last at most 24 hours",
        path: ["expiresAtMs"]
      });
    }
  });

export const createSignalCommentRequestSchema = z.object({
  signalId: z.string().trim().min(1),
  body: z.string().trim().min(1).max(280)
});

export const reportSignalRequestSchema = z.object({
  signalId: z.string().trim().min(1),
  reason: z.string().trim().min(3).max(80),
  details: z.string().trim().max(500).optional()
});

export const vicinaWorkflowHandoffSchema = z.object({
  schema: z.literal("tenra-vicina.workflow-handoff.v1"),
  exportedAtMs: z.number().int().nonnegative(),
  sourceApp: z.literal("vicina"),
  workflow: z.enum(["coordinate-event", "review-safety", "publish-local-summary"]),
  targetApps: z.array(z.enum(["assembly", "guardrail", "sentinel", "proxy"])).min(1),
  signal: z
    .object({
      id: z.string().trim().min(1),
      title: z.string().trim().min(1),
      description: z.string().trim().min(1),
      category: signalCategorySchema,
      approximateLocationLabel: z.string().trim().min(1),
      startsAtMs: z.number().int().nonnegative(),
      expiresAtMs: z.number().int().nonnegative()
    })
    .optional(),
  operatorNote: z.string().trim().min(1).max(1000)
});

export type ParsedUpsertCheckInRequest = z.infer<typeof upsertCheckInRequestSchema>;
export type ParsedDeleteCheckInRequest = z.infer<typeof deleteCheckInRequestSchema>;
export type ParsedCreateVenueMessageRequest = z.infer<
  typeof createVenueMessageRequestSchema
>;
export type ParsedCreateSignalRequest = z.infer<typeof createSignalRequestSchema>;
export type ParsedCreateSignalCommentRequest = z.infer<
  typeof createSignalCommentRequestSchema
>;
export type ParsedReportSignalRequest = z.infer<typeof reportSignalRequestSchema>;
export type ParsedVicinaWorkflowHandoff = z.infer<typeof vicinaWorkflowHandoffSchema>;
