import type {
  AgentActionDiff,
  AgentActionProposal,
  AgentReadResult,
} from "./agent-types";

export type ChatListItem = {
  id: string;
  title: string;
  status: string;
  createdAt: string;
  updatedAt: string;
};

export type ChatMessageDto = {
  id: string;
  role: string;
  content: string;
  metadata?: unknown;
  createdAt: string;
};

export type AgentStepDto = {
  id: string;
  label: string;
  status: string;
  detail?: unknown;
  order: number;
  createdAt: string;
};

export type ActionExecutionDto = {
  id: string;
  status: string;
  result?: unknown;
  conflict?: unknown;
  error?: string | null;
  createdAt: string;
};

export type ActionProposalDto = {
  id: string;
  type: string;
  status: string;
  title: string;
  summary: string;
  hotelId: string;
  affectedRowsCount: number;
  assumptions: string[];
  warnings: string[];
  diffs: AgentActionDiff[];
  pmsPayload: AgentActionProposal["pmsPayload"];
  createdAt: string;
  updatedAt: string;
  executions: ActionExecutionDto[];
};

export type ReadResultDto = {
  id: string;
  type: AgentReadResult["type"];
  title: string;
  summary: string;
  hotelId?: string | null;
  matchedRowsCount: number;
  columns: string[];
  rows: Record<string, unknown>[];
  toolCalls: AgentReadResult["toolCalls"];
  createdAt: string;
};

export type UploadedFileDto = {
  id: string;
  fileName: string;
  contentType: string;
  size: number;
  createdAt: string;
};

export type ChatDetailsDto = {
  chat: ChatListItem;
  messages: ChatMessageDto[];
  uploadedFiles: UploadedFileDto[];
  agentSteps: AgentStepDto[];
  readResults: ReadResultDto[];
  actionProposals: ActionProposalDto[];
};
