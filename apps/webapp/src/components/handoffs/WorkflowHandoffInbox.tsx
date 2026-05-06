"use client";

import { useState } from "react";
import {
  type ParsedVicinaWorkflowHandoff,
  vicinaWorkflowHandoffSchema
} from "@vicina/validation";

export function WorkflowHandoffInbox() {
  const [handoffJson, setHandoffJson] = useState("");
  const [handoff, setHandoff] = useState<ParsedVicinaWorkflowHandoff | null>(null);
  const [message, setMessage] = useState("Paste a Vicina workflow handoff to review the route.");

  function importHandoff() {
    if (!handoffJson.trim()) {
      setMessage("Paste a Vicina workflow handoff before importing.");
      return;
    }

    try {
      const parsed = vicinaWorkflowHandoffSchema.safeParse(JSON.parse(handoffJson));

      if (!parsed.success) {
        setHandoff(null);
        setMessage(parsed.error.issues[0]?.message ?? "Workflow handoff import failed.");
        return;
      }

      setHandoff(parsed.data);
      setMessage(`Imported ${parsed.data.schema} for ${parsed.data.targetApps.join(", ")}.`);
    } catch (error) {
      setHandoff(null);
      setMessage(error instanceof Error ? error.message : "Workflow handoff import failed.");
    }
  }

  return (
    <section className="workflow-inbox" aria-label="Workflow handoff inbox">
      <div className="workflow-inbox__header">
        <span>Suite inbox</span>
        <h2>Workflow handoff</h2>
      </div>
      <label>
        <span>Handoff JSON</span>
        <textarea
          rows={6}
          value={handoffJson}
          onChange={(event) => setHandoffJson(event.target.value)}
        />
      </label>
      <div className="workflow-inbox__actions">
        <button type="button" onClick={importHandoff}>
          Import handoff
        </button>
        <p>{message}</p>
      </div>
      {handoff ? (
        <dl className="workflow-inbox__summary">
          <div>
            <dt>Workflow</dt>
            <dd>{handoff.workflow}</dd>
          </div>
          <div>
            <dt>Targets</dt>
            <dd>{handoff.targetApps.join(", ")}</dd>
          </div>
          <div>
            <dt>Signal</dt>
            <dd>{handoff.signal?.title ?? "No signal attached"}</dd>
          </div>
          <div>
            <dt>Operator note</dt>
            <dd>{handoff.operatorNote}</dd>
          </div>
        </dl>
      ) : null}
    </section>
  );
}
