import { z } from "zod";

export const agentModeSchema = z.enum([
  "knowledge_answer",
  "pms_lookup",
  "file_extraction",
  "price_update_preparation",
  "approval_required",
  "execute_approved_action",
  "general_chat",
]);

export const agentTaskStateSchema = z
  .object({
    selectedHotel: z.any().optional(),
    uploadedFile: z.any().optional(),
    extractedRateSheet: z.any().optional(),
    matchedRows: z.array(z.any()).optional(),
    validationIssues: z.array(z.any()).optional(),
    diffRows: z.array(z.any()).optional(),
    preparedPayload: z.any().optional(),
    approvalStatus: z.enum(["pending", "approved", "rejected"]).optional(),
    executionResult: z.any().optional(),
    auditId: z.string().optional(),
  })
  .passthrough();

export const chatRequestSchema = z
  .object({
    message: z.string().trim().min(1),
    taskState: agentTaskStateSchema.optional(),
  })
  .strict();

export const agentClassificationSchema = z
  .object({
    mode: agentModeSchema,
    reason: z.string().min(1),
    clarificationQuestion: z.string().optional(),
  })
  .strict();

export const agentMessageSchema = z
  .object({
    message: z.string().min(1),
  })
  .strict();

export const uploadResponseSchema = z
  .object({
    taskState: agentTaskStateSchema,
  })
  .passthrough();

export type AgentClassification = z.infer<typeof agentClassificationSchema>;
export type ChatRequestInput = z.infer<typeof chatRequestSchema>;
