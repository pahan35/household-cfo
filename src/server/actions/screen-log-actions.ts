"use server";

import { screenLogBatchSchema } from "@/lib/schemas/screen-log";
import { ingestScreenLogs } from "@/server/services/screen-log-service";

import { authActionClient } from "./action-client";

export const ingestScreenLogsAction = authActionClient
  .inputSchema(screenLogBatchSchema)
  .action(({ parsedInput, ctx }) => ingestScreenLogs(ctx.auth, parsedInput.logs));
