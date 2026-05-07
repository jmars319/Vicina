# Suite Handoff Standard

Generated from `tenra Registry/contracts/handoff-catalog.json` by `tenra Registry/scripts/generate-suite-contract-docs.mjs`.

## App Role

workflow handoff orchestrator

keep unique; route workflow signals to Assembly, Guardrail, Sentinel, and Proxy through explicit handoffs.

## Standalone Mode

Runs as a complete workflow orchestration app with local workflow state, handoff timelines, endpoint health, and operator notes.

## Accepted Inputs

- No accepted suite contract is registered yet.

## Emitted Outputs

- `tenra-vicina.workflow-handoff.v1` to tenra Assembly, tenra Guardrail, tenra Sentinel, tenra Proxy

## Standard Controls

- schema badge
- endpoint health
- workflow timeline
- preview payload
- history

## Status Vocabulary

- `draft`: Payload or route exists locally but has not been previewed.
- `previewed`: Payload was built and inspected without delivery.
- `queued`: Delivery is waiting for an endpoint, retry, or operator action.
- `sent`: Producer posted or exported the payload successfully.
- `accepted`: Consumer parsed and retained the payload.
- `rejected`: Consumer refused the payload for schema, routing, safety, or policy reasons.
- `failed`: Delivery failed before acceptance or rejection was known.
- `replayed`: Registry or a producer regenerated a prior payload for another delivery attempt.
- `received`: Consumer acknowledged receipt back to the source app.
- `dismissed`: Operator intentionally removed an item from an inbox, queue, or retry list.

## Local Storage

Prefix: `tenra.vicina`

- `tenra.vicina.workflowHandoffHistory.v1`
- `tenra.vicina.endpointHealth.v1`

## Endpoints

- No suite HTTP endpoint is documented for this app yet.
