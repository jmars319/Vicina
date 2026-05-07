"use client";

import { useState } from "react";
import {
  type ParsedVicinaWorkflowHandoff,
  vicinaWorkflowHandoffSchema
} from "@vicina/validation";

type VicinaEndpointConfig = Partial<Record<ParsedVicinaWorkflowHandoff["targetApps"][number], string>>;
type VicinaDeliveryStatus = {
  target: ParsedVicinaWorkflowHandoff["targetApps"][number] | "guardrail-decision";
  status: "copied" | "sent" | "failed" | "applied";
  updatedAt: string;
  message: string;
};
type EndpointHealth = Partial<Record<ParsedVicinaWorkflowHandoff["targetApps"][number], string>>;

const endpointStorageKey = "tenra-vicina-suite-endpoints:v1";

function readEndpointConfig(): VicinaEndpointConfig {
  try {
    const raw = window.localStorage.getItem(endpointStorageKey);
    return raw ? JSON.parse(raw) : {};
  } catch {
    return {};
  }
}

function writeEndpointConfig(config: VicinaEndpointConfig) {
  window.localStorage.setItem(endpointStorageKey, JSON.stringify(config));
}

export function WorkflowHandoffInbox() {
  const [handoffJson, setHandoffJson] = useState("");
  const [handoff, setHandoff] = useState<ParsedVicinaWorkflowHandoff | null>(null);
  const [decisionJson, setDecisionJson] = useState("");
  const [endpointConfig, setEndpointConfig] = useState<VicinaEndpointConfig>(readEndpointConfig);
  const [endpointHealth, setEndpointHealth] = useState<EndpointHealth>({});
  const [deliveryStatuses, setDeliveryStatuses] = useState<VicinaDeliveryStatus[]>([]);
  const [message, setMessage] = useState("Paste a Vicina workflow handoff to review the route.");

  function setEndpoint(target: ParsedVicinaWorkflowHandoff["targetApps"][number], value: string) {
    setEndpointConfig((current) => {
      const next = { ...current, [target]: value };
      writeEndpointConfig(next);
      return next;
    });
  }

  function recordDelivery(status: VicinaDeliveryStatus) {
    setDeliveryStatuses((current) => [
      status,
      ...current.filter((entry) => entry.target !== status.target)
    ]);
  }

  async function checkEndpointHealth() {
    const results: EndpointHealth = {};
    await Promise.all(
      (["assembly", "guardrail", "sentinel", "proxy"] as const).map(async (target) => {
        const endpoint = endpointConfig[target]?.trim();
        if (!endpoint) {
          results[target] = "not configured";
          return;
        }
        try {
          const response = await fetch(endpoint, { method: "OPTIONS" });
          results[target] = response.ok || response.status === 405 ? `reachable (${response.status})` : `degraded (${response.status})`;
        } catch (error) {
          results[target] = error instanceof Error ? error.message : "unreachable";
        }
      })
    );
    setEndpointHealth(results);
    setMessage("Endpoint health checked.");
  }

  async function sendToNextApp(target: ParsedVicinaWorkflowHandoff["targetApps"][number]) {
    if (!handoff) return;

    const payload =
      target === "proxy"
        ? {
            clientApp: "vicina",
            surface: "operator-brief",
            profileId: "profile:default",
            purpose: `Shape Vicina ${handoff.workflow} context for operator review.`,
            draftText: [handoff.signal?.title, handoff.signal?.description, handoff.operatorNote].filter(Boolean).join("\n\n"),
            hardConstraints: ["Preserve local context", "Do not invent venue or participant details"],
            traceId: `vicina-${handoff.workflow}-${handoff.exportedAtMs}`
          }
        : target === "guardrail"
          ? {
              schema: "tenra-guardrail.external-action-review.v1",
              exportedAt: new Date().toISOString(),
              sourceApp: "vicina",
              actionKind: "moderation-action",
              actorLabel: "Vicina workflow inbox",
              targetLabel: handoff.signal?.title ?? handoff.workflow,
              summary: handoff.operatorNote,
              evidence: [
                { label: "Workflow", value: handoff.workflow },
                { label: "Targets", value: handoff.targetApps.join(", ") }
              ],
              recommendedDecision: "review",
              traceId: `vicina-${handoff.workflow}-${handoff.exportedAtMs}-guardrail`
            }
          : handoff;

    const endpoint = endpointConfig[target]?.trim();

    try {
      if (endpoint) {
        const response = await fetch(endpoint, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(payload)
        });
        if (!response.ok) {
          throw new Error(await response.text());
        }
        recordDelivery({
          target,
          status: "sent",
          updatedAt: new Date().toISOString(),
          message: endpoint
        });
        setMessage(`Sent ${target} handoff.`);
        return;
      }

      await navigator.clipboard.writeText(JSON.stringify(payload, null, 2));
      recordDelivery({
        target,
        status: "copied",
        updatedAt: new Date().toISOString(),
        message: "No endpoint configured; copied JSON fallback."
      });
      setMessage(`Prepared ${target} handoff JSON.`);
    } catch (error) {
      recordDelivery({
        target,
        status: "failed",
        updatedAt: new Date().toISOString(),
        message: error instanceof Error ? error.message : `Could not send ${target} handoff.`
      });
      setMessage(error instanceof Error ? error.message : `Could not prepare ${target} handoff.`);
    }
  }

  function importGuardrailDecision() {
    try {
      const decision = JSON.parse(decisionJson) as {
        schema?: string;
        decision?: string;
        reason?: string;
        sourceReturn?: {
          app?: string;
          action?: string;
        };
      };

      if (
        decision.schema !== "tenra-guardrail.external-action-decision.v1" ||
        decision.sourceReturn?.app !== "vicina" ||
        decision.sourceReturn.action !== "apply-guardrail-decision"
      ) {
        throw new Error("Decision is not returnable to Vicina.");
      }

      recordDelivery({
        target: "guardrail-decision",
        status: "applied",
        updatedAt: new Date().toISOString(),
        message: [decision.decision, decision.reason].filter(Boolean).join(": ")
      });
      setDecisionJson("");
      setMessage(`Applied Guardrail decision: ${decision.decision}.`);
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Guardrail decision import failed.");
    }
  }

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
      <div className="workflow-inbox__summary">
        {(["assembly", "guardrail", "sentinel", "proxy"] as const).map((target) => (
          <label key={target}>
            <span>{target} endpoint</span>
            <input value={endpointConfig[target] ?? ""} onChange={(event) => setEndpoint(target, event.target.value)} />
            {endpointHealth[target] ? <small>{endpointHealth[target]}</small> : null}
          </label>
        ))}
      </div>
      <div className="workflow-inbox__actions">
        <button type="button" onClick={() => void checkEndpointHealth()}>
          Check endpoint health
        </button>
      </div>
      <label>
        <span>Guardrail decision JSON</span>
        <textarea rows={4} value={decisionJson} onChange={(event) => setDecisionJson(event.target.value)} />
      </label>
      <div className="workflow-inbox__actions">
        <button type="button" onClick={importGuardrailDecision}>
          Apply Guardrail decision
        </button>
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
          <div>
            <dt>Send next</dt>
            <dd>
              {handoff.targetApps.map((target) => (
                <button key={target} type="button" onClick={() => void sendToNextApp(target)}>
                  Send {target}
                </button>
              ))}
            </dd>
          </div>
          <div>
            <dt>Delivery status</dt>
            <dd>
              {deliveryStatuses.length
                ? deliveryStatuses.map((status) => (
                    <span key={`${status.target}-${status.updatedAt}`}>
                      {status.target}: {status.status}
                    </span>
                  ))
                : "No delivery attempt yet"}
            </dd>
          </div>
        </dl>
      ) : null}
    </section>
  );
}
