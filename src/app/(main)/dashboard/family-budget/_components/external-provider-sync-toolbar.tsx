"use client";

import { createContext, type ReactNode, useCallback, useContext, useEffect, useMemo, useState } from "react";

import { formatDistanceToNow } from "date-fns";
import {
  CheckCircle2,
  ChevronDown,
  Clock,
  Database,
  History,
  Loader2,
  RefreshCw,
  Settings2,
  Sparkles,
} from "lucide-react";
import { toast } from "sonner";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Popover,
  PopoverContent,
  PopoverDescription,
  PopoverHeader,
  PopoverTitle,
  PopoverTrigger,
} from "@/components/ui/popover";

import { getClientSnapshot, hydrateClientFromIDB, syncClientWithServer } from "./external-provider-client";
import type { ExternalProviderSnapshot, ExternalProviderSyncConfig } from "./external-provider-idb";

export interface ExternalProviderSyncContextValue {
  snapshot: ExternalProviderSnapshot | null;
  isSyncing: boolean;
  lastSyncedAt: Date | null;
  syncStatus: "idle" | "syncing" | "reconciling" | "error";
  syncVersion: number;
  hotPullMonths: number;
  autoPollIntervalMinutes: number;
  lastError: string | null;
  triggerSync: (options?: { tier?: "hot" | "warm" | "cold"; force?: boolean }) => Promise<void>;
  updateConfig: (updates: { hot_pull_months?: number; auto_poll_interval_minutes?: number }) => Promise<void>;
}

const ExternalProviderSyncContext = createContext<ExternalProviderSyncContextValue | null>(null);

export function useExternalProviderSync(): ExternalProviderSyncContextValue {
  const ctx = useContext(ExternalProviderSyncContext);
  if (!ctx) {
    throw new Error("useExternalProviderSync must be used within a ExternalProviderSyncProvider");
  }
  return ctx;
}

export function ExternalProviderSyncProvider({ children }: { children: ReactNode }) {
  const [snapshot, setSnapshot] = useState<ExternalProviderSnapshot | null>(null);
  const [isSyncing, setIsSyncing] = useState(false);
  const [lastSyncedAt, setLastSyncedAt] = useState<Date | null>(null);
  const [syncStatus, setSyncStatus] = useState<"idle" | "syncing" | "reconciling" | "error">("idle");
  const [syncVersion, setSyncVersion] = useState(0);
  const [hotPullMonths, setHotPullMonths] = useState(3);
  const [autoPollIntervalMinutes, setAutoPollIntervalMinutes] = useState(0);
  const [lastError, setLastError] = useState<string | null>(null);

  const applyConfig = useCallback((cfg: ExternalProviderSyncConfig | undefined) => {
    if (!cfg) return;
    setSyncVersion(cfg.sync_version);
    setSyncStatus(cfg.sync_status);
    setHotPullMonths(cfg.hot_pull_months ?? 3);
    setAutoPollIntervalMinutes(cfg.auto_poll_interval_minutes ?? 0);
    setLastError(cfg.last_error);
    if (cfg.last_synced_at) {
      setLastSyncedAt(new Date(cfg.last_synced_at));
    }
  }, []);

  const triggerSync = useCallback(
    async (options?: { tier?: "hot" | "warm" | "cold"; force?: boolean }) => {
      setIsSyncing(true);
      setSyncStatus("syncing");
      setLastError(null);

      try {
        const res = await syncClientWithServer({
          tier: options?.tier ?? "hot",
          force: options?.force ?? true,
        });

        const latestSnapshot = getClientSnapshot();
        if (latestSnapshot) {
          setSnapshot(latestSnapshot);
          applyConfig(latestSnapshot.syncConfig);
        } else {
          setSyncVersion(res.syncVersion);
          setSyncStatus("idle");
          setLastSyncedAt(new Date());
        }

        const tierLabel =
          options?.tier === "cold" ? "Full Rebuild" : options?.tier === "warm" ? "Warm Reconcile" : "Hot Pull";
        toast.success(`ExternalProvider data synced (${tierLabel})`);
      } catch (err) {
        const msg = err instanceof Error ? err.message : String(err);
        setSyncStatus("error");
        setLastError(msg);
        toast.error("ExternalProvider sync warning", {
          description: `${msg}. Displaying persistent cached data.`,
        });
      } finally {
        setIsSyncing(false);
      }
    },
    [applyConfig],
  );

  const updateConfig = useCallback(
    async (updates: { hot_pull_months?: number; auto_poll_interval_minutes?: number }) => {
      try {
        const res = await fetch("/api/external-provider/sync/config", {
          method: "PATCH",
          headers: { "Content-Type": "application/json", Accept: "application/json" },
          body: JSON.stringify(updates),
        });

        if (!res.ok) {
          throw new Error(`Failed to update sync config (${res.status})`);
        }

        const data = (await res.json()) as { syncConfig?: ExternalProviderSyncConfig };
        if (data.syncConfig) {
          applyConfig(data.syncConfig);
        }
        toast.success("Sync settings updated");
      } catch (err) {
        const msg = err instanceof Error ? err.message : String(err);
        toast.error("Failed to update sync settings", { description: msg });
      }
    },
    [applyConfig],
  );

  // Initial bootstrap hydration
  useEffect(() => {
    let cancelled = false;

    async function bootstrap() {
      const local = await hydrateClientFromIDB();
      if (!cancelled && local) {
        setSnapshot(local);
        applyConfig(local.syncConfig);
      }

      // Revalidate in background with server
      try {
        await syncClientWithServer({ force: false });
        if (!cancelled) {
          const fresh = getClientSnapshot();
          if (fresh) {
            setSnapshot(fresh);
            applyConfig(fresh.syncConfig);
          }
        }
      } catch {
        // Fallback gracefully to offline/local snapshot
      }
    }

    void bootstrap();

    return () => {
      cancelled = true;
    };
  }, [applyConfig]);

  // Visibility-aware auto-poll timer
  useEffect(() => {
    if (autoPollIntervalMinutes <= 0) return;

    const intervalMs = autoPollIntervalMinutes * 60 * 1000;

    const checkAndPoll = () => {
      if (typeof document !== "undefined" && document.visibilityState !== "visible") {
        return;
      }
      if (isSyncing) return;

      const elapsed = lastSyncedAt ? Date.now() - lastSyncedAt.getTime() : Infinity;
      if (elapsed >= intervalMs) {
        void triggerSync({ tier: "hot", force: false });
      }
    };

    const handleVisibilityChange = () => {
      if (document.visibilityState === "visible") {
        checkAndPoll();
      }
    };

    document.addEventListener("visibilitychange", handleVisibilityChange);
    const intervalId = setInterval(checkAndPoll, 30_000); // Probe every 30s

    return () => {
      document.removeEventListener("visibilitychange", handleVisibilityChange);
      clearInterval(intervalId);
    };
  }, [autoPollIntervalMinutes, lastSyncedAt, isSyncing, triggerSync]);

  const value = useMemo(
    () => ({
      snapshot,
      isSyncing,
      lastSyncedAt,
      syncStatus,
      syncVersion,
      hotPullMonths,
      autoPollIntervalMinutes,
      lastError,
      triggerSync,
      updateConfig,
    }),
    [
      snapshot,
      isSyncing,
      lastSyncedAt,
      syncStatus,
      syncVersion,
      hotPullMonths,
      autoPollIntervalMinutes,
      lastError,
      triggerSync,
      updateConfig,
    ],
  );

  return <ExternalProviderSyncContext.Provider value={value}>{children}</ExternalProviderSyncContext.Provider>;
}

export function ExternalProviderSyncToolbar() {
  const {
    isSyncing,
    lastSyncedAt,
    syncStatus,
    hotPullMonths,
    autoPollIntervalMinutes,
    lastError,
    triggerSync,
    updateConfig,
  } = useExternalProviderSync();

  const formattedRelativeTime = useMemo(() => {
    if (!lastSyncedAt) return "Never synced";
    try {
      return formatDistanceToNow(lastSyncedAt, { addSuffix: true });
    } catch {
      return "Recently";
    }
  }, [lastSyncedAt]);

  const statusBadge = useMemo(() => {
    if (isSyncing || syncStatus === "syncing") {
      return (
        <Badge variant="outline" className="gap-1.5 border-primary/30 bg-primary/10 text-primary">
          <Loader2 className="size-3 animate-spin" />
          <span>Syncing with ExternalProvider…</span>
        </Badge>
      );
    }

    if (syncStatus === "reconciling") {
      return (
        <Badge
          variant="outline"
          className="gap-1.5 border-amber-500/30 bg-amber-500/10 text-amber-600 dark:text-amber-400"
        >
          <Loader2 className="size-3 animate-spin" />
          <span>Reconciling with ExternalProvider…</span>
        </Badge>
      );
    }

    if (syncStatus === "error" || lastError) {
      return (
        <Badge variant="outline" className="gap-1.5 border-destructive/30 bg-destructive/10 text-destructive">
          <span className="size-1.5 rounded-full bg-destructive" />
          <span>Stale · showing cached data</span>
        </Badge>
      );
    }

    return (
      <Badge
        variant="outline"
        className="gap-1.5 border-emerald-500/30 bg-emerald-500/10 text-emerald-600 dark:text-emerald-400"
      >
        <CheckCircle2 className="size-3" />
        <span>Synced · {formattedRelativeTime}</span>
      </Badge>
    );
  }, [isSyncing, syncStatus, lastError, formattedRelativeTime]);

  return (
    <div className="flex flex-wrap items-center justify-between gap-2 rounded-lg border border-border/60 bg-card/60 px-3.5 py-2 text-xs shadow-xs">
      <div className="flex items-center gap-2">
        <Database className="size-4 text-muted-foreground" />
        <span className="font-medium text-foreground">ExternalProvider Sync Engine</span>
        {statusBadge}
      </div>

      <div className="flex items-center gap-1.5">
        <Button
          variant="outline"
          size="sm"
          className="h-7 gap-1.5 px-2.5 text-xs font-medium"
          disabled={isSyncing}
          onClick={() => triggerSync({ tier: "hot", force: true })}
        >
          <RefreshCw className={`size-3.5 ${isSyncing ? "animate-spin" : ""}`} />
          <span>Pull Fresh Data</span>
        </Button>

        <Popover>
          <PopoverTrigger asChild>
            <Button variant="ghost" size="sm" className="h-7 w-7 p-0" title="Sync settings and tier actions">
              <Settings2 className="size-3.5 text-muted-foreground" />
              <span className="sr-only">Sync Settings</span>
            </Button>
          </PopoverTrigger>
          <PopoverContent align="end" className="w-80 gap-3 p-4">
            <PopoverHeader className="gap-1 pb-1">
              <PopoverTitle className="text-sm font-semibold">Synchronization Controls</PopoverTitle>
              <PopoverDescription className="text-xs text-muted-foreground">
                Manage tiered synchronization, hot window size, and automatic background refresh.
              </PopoverDescription>
            </PopoverHeader>

            <div className="space-y-3 pt-1">
              {/* Sync Actions */}
              <div className="space-y-1.5">
                <span className="text-[11px] font-semibold text-muted-foreground uppercase tracking-wider">
                  Sync Tiers
                </span>
                <div className="grid grid-cols-1 gap-1.5">
                  <Button
                    variant="outline"
                    size="sm"
                    className="justify-start gap-2 h-8 text-xs font-normal"
                    disabled={isSyncing}
                    onClick={() => triggerSync({ tier: "hot", force: true })}
                  >
                    <Sparkles className="size-3.5 text-primary" />
                    <span>Hot Pull (Recent transactions)</span>
                  </Button>
                  <Button
                    variant="outline"
                    size="sm"
                    className="justify-start gap-2 h-8 text-xs font-normal"
                    disabled={isSyncing}
                    onClick={() => triggerSync({ tier: "warm", force: true })}
                  >
                    <Clock className="size-3.5 text-amber-500" />
                    <span>Warm Reconcile (Trailing 12 months)</span>
                  </Button>
                  <Button
                    variant="outline"
                    size="sm"
                    className="justify-start gap-2 h-8 text-xs font-normal"
                    disabled={isSyncing}
                    onClick={() => triggerSync({ tier: "cold", force: true })}
                  >
                    <History className="size-3.5 text-blue-500" />
                    <span>Rebuild Full History (All-time archive)</span>
                  </Button>
                </div>
              </div>

              {/* Hot Pull Window */}
              <div className="space-y-1.5 pt-1">
                <span className="text-[11px] font-semibold text-muted-foreground uppercase tracking-wider">
                  Hot Pull Window
                </span>
                <div className="grid grid-cols-4 gap-1">
                  {[1, 3, 6, 12].map((m) => (
                    <Button
                      key={m}
                      variant={hotPullMonths === m ? "default" : "outline"}
                      size="sm"
                      className="h-7 text-xs font-medium"
                      onClick={() => updateConfig({ hot_pull_months: m })}
                    >
                      {m}m
                    </Button>
                  ))}
                </div>
              </div>

              {/* Auto Poll Interval */}
              <div className="space-y-1.5 pt-1">
                <span className="text-[11px] font-semibold text-muted-foreground uppercase tracking-wider">
                  Auto-Pull While Page Open
                </span>
                <div className="grid grid-cols-4 gap-1">
                  {[
                    { label: "Off", value: 0 },
                    { label: "5m", value: 5 },
                    { label: "15m", value: 15 },
                    { label: "60m", value: 60 },
                  ].map((item) => (
                    <Button
                      key={item.value}
                      variant={autoPollIntervalMinutes === item.value ? "default" : "outline"}
                      size="sm"
                      className="h-7 text-xs font-medium"
                      onClick={() => updateConfig({ auto_poll_interval_minutes: item.value })}
                    >
                      {item.label}
                    </Button>
                  ))}
                </div>
              </div>
            </div>
          </PopoverContent>
        </Popover>
      </div>
    </div>
  );
}
