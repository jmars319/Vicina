# Module Manifest

Generated from `tenra Registry/contracts/handoff-catalog.json` by `tenra Registry/scripts/generate-suite-contract-docs.mjs`.

## Standalone Mode

Runs as a complete workflow orchestration app with local workflow state, handoff timelines, endpoint health, and operator notes.

## Required Suite Dependencies

- None

## Optional Suite Dependencies

- tenra Assembly: Optional workflow-to-draft handoff.
- tenra Guardrail: Optional workflow review handoff.
- tenra Sentinel: Optional risk lookup handoff.
- tenra Proxy: Optional workflow output shaping.

## Provides

- workflow handoff
- destination timeline
- endpoint health

## Consumes

- module health
- handoff acknowledgements

## Contracts

Emits:

- `tenra-vicina.workflow-handoff.v1`

Accepts:

- None

## Rules

- Each app must remain complete and usable without another tenra app running.
- Suite integrations are optional module links, not required runtime dependencies.
- Shared functions should be exposed through explicit local APIs, exports, imports, or schemas.
- No app may read another app's private filesystem, database, or localStorage state.
- Registry can index and audit the module graph, but it must not become a hidden runtime bus.
