import { z } from "zod";

/**
 * Screen-time ingestion contract, shared by the web UI and mobile/automation clients
 * (e.g. weekly Android Digital Wellbeing / iOS Screen Time export).
 */

const hours = z
  .number()
  .finite()
  .min(0)
  .max(24 * 7);

export const screenLogPlayerSchema = z.enum(["me", "wife"]);

export const screenLogSchema = z.object({
  /** Monday (or any week anchor) of the reported week, `YYYY-MM-DD`. */
  weekStartDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "weekStartDate must be YYYY-MM-DD"),
  player: screenLogPlayerSchema,
  gamingTotalHours: hours.optional(),
  socialTotalHours: hours.optional(),
  /** Free-form origin label, e.g. "android-digital-wellbeing". */
  source: z.string().max(64).optional(),
});
export type ScreenLogDto = z.infer<typeof screenLogSchema>;

export const screenLogBatchSchema = z.object({
  logs: z.array(screenLogSchema).min(1).max(104),
});
export type ScreenLogBatchDto = z.infer<typeof screenLogBatchSchema>;
