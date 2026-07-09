import type {
  AgentTaskState,
  EntityId,
  ExecutionResult,
  PreparedPriceCapacityPayload,
} from "../../shared/agent-types";

export type AgentAuditLog = {
  id: string;
  createdAt: string;
  actionType: string;
  selectedHotel?: EntityId;
  originalFileName?: string;
  preparedPayload?: PreparedPriceCapacityPayload;
  approvedBy?: string;
  executedAt?: string;
  result?: ExecutionResult;
};

declare global {
  var agentAuditLogs: AgentAuditLog[] | undefined;
}

/**
 * Append an in-memory audit log for an executed agent action.
 * @param state - Agent task state.
 * @param result - Execution result.
 * @returns Audit log.
 */
export function appendAgentAuditLog(
  state: AgentTaskState,
  result: ExecutionResult,
): AgentAuditLog {
  const logs = getAgentAuditLogs();
  const log = {
    id: `audit-${Date.now()}`,
    createdAt: new Date().toISOString(),
    actionType: "PRICE_CAPACITY_UPSERT",
    selectedHotel: state.selectedHotel?.id,
    originalFileName: state.uploadedFile?.name,
    preparedPayload: state.preparedPayload,
    approvedBy: "demo-user",
    executedAt: new Date().toISOString(),
    result,
  };

  logs.push(log);
  return log;
}

/**
 * Read in-memory audit logs.
 * @returns Audit logs.
 */
export function getAgentAuditLogs(): AgentAuditLog[] {
  globalThis.agentAuditLogs ??= [];
  return globalThis.agentAuditLogs;
}
