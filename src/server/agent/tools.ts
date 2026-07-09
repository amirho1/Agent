import { tool } from "@langchain/core/tools";
import { z } from "zod";
import type {
  AgentTaskState,
  EntityId,
  ExtractedRateSheet,
  Hotel,
} from "../../shared/agent-types";
import type { ServerConfig } from "../config";
import {
  getExistingPriceCapacity,
  listChildrenCategories,
  listHotels,
  listRatePlans,
  listRoomTypes,
} from "../dummy-pms/client";
import { parseRateSheetText } from "../rate-sheets/parser";
import { searchKnowledgeBase } from "../rag-kbs/client";
import { executeApprovedPriceCapacityUpdate } from "../price-updates/execution";
import { matchRoomsAndRatePlans } from "../price-updates/matching";
import { preparePriceUpdateWorkflow } from "../price-updates/workflow";
import { preparePriceCapacityUpsert } from "../price-updates/prepare";
import { validatePriceUpdate } from "../price-updates/validation";

/**
 * Create all LangChain tools for the hotel operations agent.
 * @param config - Server config.
 * @param taskState - Mutable task state.
 * @returns Tool map.
 */
export function createAgentTools(
  config: ServerConfig,
  taskState: AgentTaskState,
) {
  const searchKnowledgeBaseTool = tool(
    async ({ query }) => {
      return searchKnowledgeBase(config, query);
    },
    {
      name: "searchKnowledgeBaseTool",
      description:
        "Search RAG-KBS for documentation, business rules, PMS field definitions, and usage guides.",
      schema: z.object({
        query: z.string().min(1),
      }),
    },
  );

  const listHotelsTool = tool(
    async () => {
      return listHotels(config);
    },
    {
      name: "listHotelsTool",
      description: "List live hotels from dummy-PMS.",
      schema: z.object({}),
    },
  );

  const listRoomTypesTool = tool(
    async ({ hotelId }) => {
      return listRoomTypes(config, hotelId);
    },
    {
      name: "listRoomTypesTool",
      description: "List live room type providers for a hotel.",
      schema: z.object({
        hotelId: z.union([z.string(), z.number()]),
      }),
    },
  );

  const listRatePlansTool = tool(
    async ({ hotelId }) => {
      return listRatePlans(config, hotelId);
    },
    {
      name: "listRatePlansTool",
      description: "List live rate plans for a hotel.",
      schema: z.object({
        hotelId: z.union([z.string(), z.number()]),
      }),
    },
  );

  const listChildrenCategoriesTool = tool(
    async ({ hotelId }) => {
      return listChildrenCategories(config, hotelId);
    },
    {
      name: "listChildrenCategoriesTool",
      description: "List live children categories for a hotel.",
      schema: z.object({
        hotelId: z.union([z.string(), z.number()]),
      }),
    },
  );

  const getExistingPriceCapacityTool = tool(
    async ({ hotelId, from, to }) => {
      return getExistingPriceCapacity(config, hotelId, from, to);
    },
    {
      name: "getExistingPriceCapacityTool",
      description:
        "Get existing live price-capacity records for a hotel date range.",
      schema: z.object({
        hotelId: z.union([z.string(), z.number()]),
        from: z.string().min(1),
        to: z.string().min(1),
      }),
    },
  );

  const parseRateSheetTool = tool(
    async ({ text }) => {
      return parseRateSheetText(text);
    },
    {
      name: "parseRateSheetTool",
      description: "Parse a text or Markdown rate sheet into normalized JSON.",
      schema: z.object({
        text: z.string().min(1),
      }),
    },
  );

  const matchRoomsAndRatePlansTool = tool(
    async ({ extractedRateSheet, hotelId }) => {
      const [roomTypes, ratePlans] = await Promise.all([
        listRoomTypes(config, hotelId),
        listRatePlans(config, hotelId),
      ]);
      return matchRoomsAndRatePlans(
        extractedRateSheet as ExtractedRateSheet,
        roomTypes,
        ratePlans,
      );
    },
    {
      name: "matchRoomsAndRatePlansTool",
      description:
        "Match extracted rooms and rate plans against live PMS room and rate-plan data.",
      schema: z.object({
        hotelId: z.union([z.string(), z.number()]),
        extractedRateSheet: z.any(),
      }),
    },
  );

  const validatePriceUpdateTool = tool(
    async ({ hotelId, matchedRows }) => {
      return validatePriceUpdate(hotelId, matchedRows);
    },
    {
      name: "validatePriceUpdateTool",
      description: "Validate matched price update rows before preparation.",
      schema: z.object({
        hotelId: z.union([z.string(), z.number()]),
        matchedRows: z.array(z.any()),
      }),
    },
  );

  const preparePriceCapacityUpsertTool = tool(
    async ({ hotel, extractedRateSheet }) => {
      const result = await preparePriceUpdateWorkflow(
        config,
        hotel as Hotel,
        extractedRateSheet as ExtractedRateSheet,
        taskState,
      );
      Object.assign(taskState, result.taskState);
      return result;
    },
    {
      name: "preparePriceCapacityUpsertTool",
      description:
        "Prepare a draft PMS price-capacity upsert payload and review diff. This never executes writes.",
      schema: z.object({
        hotel: z.any(),
        extractedRateSheet: z.any(),
      }),
    },
  );

  const executePriceCapacityUpsertTool = tool(
    async () => {
      return executeApprovedPriceCapacityUpdate(config, taskState);
    },
    {
      name: "executePriceCapacityUpsertTool",
      description:
        "Execute an already prepared and explicitly approved PMS price-capacity upsert payload.",
      schema: z.object({}),
    },
  );

  return {
    searchKnowledgeBaseTool,
    listHotelsTool,
    listRoomTypesTool,
    listRatePlansTool,
    listChildrenCategoriesTool,
    getExistingPriceCapacityTool,
    parseRateSheetTool,
    matchRoomsAndRatePlansTool,
    validatePriceUpdateTool,
    preparePriceCapacityUpsertTool,
    executePriceCapacityUpsertTool,
  };
}

/**
 * Build a draft payload directly from matched rows for tests and tools.
 * @param hotelId - Hotel ID.
 * @param matchedRows - Matched rows.
 * @param validationIssues - Validation issues.
 * @returns Prepared payload.
 */
export function prepareDraftPayload(
  hotelId: EntityId,
  matchedRows: Parameters<typeof preparePriceCapacityUpsert>[1],
  validationIssues: Parameters<typeof preparePriceCapacityUpsert>[2],
) {
  return preparePriceCapacityUpsert(hotelId, matchedRows, validationIssues);
}
