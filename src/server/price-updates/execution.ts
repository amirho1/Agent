import type { AgentTaskState, ExecutionResult } from "../../shared/agent-types";
import type { ServerConfig } from "../config";
import { appendAgentAuditLog } from "../audit/audit-log";
import { upsertPriceCapacity } from "../dummy-pms/client";

/**
 * Execute an approved price-capacity update through dummy-PMS.
 * @param config - Server config.
 * @param state - Current task state.
 * @returns Execution result with audit ID.
 */
export async function executeApprovedPriceCapacityUpdate(
  config: ServerConfig,
  state: AgentTaskState,
): Promise<ExecutionResult> {
  if (state.approvalStatus !== "approved") {
    throw new Error("Approval is required before executing a PMS update.");
  }

  if (!state.preparedPayload || state.preparedPayload.items.length === 0) {
    throw new Error("No prepared payload is available for execution.");
  }

  const result = await upsertPriceCapacity(config, state.preparedPayload);
  const auditLog = appendAgentAuditLog(state, result);

  return {
    ...result,
    failed: result.failed ?? 0,
    errors: result.errors ?? [],
    auditId: auditLog.id,
  };
}
