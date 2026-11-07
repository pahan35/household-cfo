import { type NextRequest, NextResponse } from "next/server";

import type {
  PersonalGoal,
  TimeValueMotivatorConfig,
  WeeklyCheckInEntry,
} from "@/app/(main)/dashboard/family-budget/lifestyle/time-value/_components/time-value-types";
import { isAuthBypassActive } from "@/server/auth/config";
import { getSessionFromRequest } from "@/server/auth/session";
import { getTimeValueStore } from "@/server/lifestyle/time-value-db";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

interface TimeValueRequestBody {
  action?: "save_config" | "upsert_log" | "upsert_goal";
  config?: TimeValueMotivatorConfig;
  entry?: WeeklyCheckInEntry;
  goal?: PersonalGoal;
}

function jsonError(message: string, status: number): NextResponse {
  return NextResponse.json({ error: { message } }, { status });
}

function getErrorMessage(err: unknown, fallback: string): string {
  if (err instanceof Error) return err.message;
  return fallback;
}

async function verifyAuth(request: NextRequest): Promise<boolean> {
  if (isAuthBypassActive()) {
    return true;
  }
  const session = await getSessionFromRequest(request);
  return Boolean(session);
}

export async function GET(request: NextRequest): Promise<NextResponse> {
  if (!(await verifyAuth(request))) {
    return jsonError("Unauthorized", 401);
  }

  const { searchParams } = new URL(request.url);
  const action = searchParams.get("action");
  const store = getTimeValueStore();

  try {
    if (action === "logs") {
      const weeklyLogs = await store.listWeeklyLogs();
      return NextResponse.json({ weeklyLogs });
    }

    if (action === "goals") {
      const goals = await store.listGoals();
      return NextResponse.json({ goals });
    }

    const config = await store.loadConfig();
    return NextResponse.json({ config });
  } catch (err) {
    return jsonError(getErrorMessage(err, "Failed to load time-value state"), 500);
  }
}

export async function POST(request: NextRequest): Promise<NextResponse> {
  if (!(await verifyAuth(request))) {
    return jsonError("Unauthorized", 401);
  }

  let body: TimeValueRequestBody = {};
  try {
    const text = await request.text();
    if (text.trim().length > 0) {
      body = JSON.parse(text) as TimeValueRequestBody;
    }
  } catch {
    return jsonError("Invalid JSON body", 400);
  }

  const store = getTimeValueStore();

  try {
    if (body.action === "upsert_log" || body.entry) {
      if (!body.entry || !body.entry.weekStartDate) {
        return jsonError("Weekly log entry with weekStartDate is required", 400);
      }
      const savedEntry = await store.upsertWeeklyLog(body.entry);
      return NextResponse.json({ entry: savedEntry });
    }

    if (body.action === "upsert_goal" || body.goal) {
      if (!body.goal || !body.goal.title) {
        return jsonError("Personal goal with title is required", 400);
      }
      const savedGoal = await store.upsertGoal(body.goal);
      return NextResponse.json({ goal: savedGoal });
    }

    if (body.action === "save_config" || body.config) {
      if (!body.config || !body.config.me || !body.config.wife) {
        return jsonError("Complete time value motivator config is required", 400);
      }
      const savedConfig = await store.saveConfig(body.config);
      return NextResponse.json({ config: savedConfig });
    }

    return jsonError("Invalid action or missing payload", 400);
  } catch (err) {
    return jsonError(getErrorMessage(err, "Failed to update time-value state"), 500);
  }
}

export async function DELETE(request: NextRequest): Promise<NextResponse> {
  if (!(await verifyAuth(request))) {
    return jsonError("Unauthorized", 401);
  }

  const { searchParams } = new URL(request.url);
  const weekStartDate = searchParams.get("weekStartDate");
  const goalId = searchParams.get("goalId");
  const store = getTimeValueStore();

  try {
    if (weekStartDate) {
      const deleted = await store.deleteWeeklyLog(weekStartDate);
      return NextResponse.json({ success: deleted });
    }

    if (goalId) {
      const deleted = await store.deleteGoal(goalId);
      return NextResponse.json({ success: deleted });
    }

    return jsonError("weekStartDate or goalId parameter is required", 400);
  } catch (err) {
    return jsonError(getErrorMessage(err, "Failed to delete time-value entity"), 500);
  }
}
