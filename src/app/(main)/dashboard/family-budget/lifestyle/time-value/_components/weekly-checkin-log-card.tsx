"use client";

import { useRef, useState } from "react";

import {
  Calendar,
  CheckCircle2,
  Download,
  FileText,
  History,
  PartyPopper,
  Plus,
  RotateCcw,
  Upload,
} from "lucide-react";
import { toast } from "sonner";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

import type { ComputedTimeValueSummary, TimeValueMotivatorConfig, WeeklyCheckInEntry } from "./time-value-types";

interface WeeklyCheckInLogCardProps {
  config: TimeValueMotivatorConfig;
  computed: ComputedTimeValueSummary;
  onAddLog: (entry: WeeklyCheckInEntry) => void;
  onExportJson: () => void;
  onImportJson: (json: string) => void;
  onResetDefaults: () => void;
}

export function WeeklyCheckInLogCard({
  config,
  computed,
  onAddLog,
  onExportJson,
  onImportJson,
  onResetDefaults,
}: WeeklyCheckInLogCardProps) {
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [isLogOpen, setIsLogOpen] = useState(false);

  // Form state initialized from current simulation snapshot
  const [weekStartDate, setWeekStartDate] = useState(
    new Date(Date.now() - 7 * 24 * 3600 * 1000).toISOString().split("T")[0],
  );
  const [coupleNotes, setCoupleNotes] = useState("");

  const handleCreateLog = () => {
    const entry: WeeklyCheckInEntry = {
      id: `log-${Date.now()}`,
      weekStartDate,
      loggedAt: new Date().toISOString(),
      me: {
        careHours: config.me.care.careHoursPerWeek,
        gamingTotalHours: config.me.screenTime.gamingTotalHours,
        gamingJoyHours: config.me.screenTime.gamingJoyHours,
        socialTotalHours: config.me.screenTime.socialTotalHours,
        socialJoyHours: config.me.screenTime.socialJoyHours,
        actualSideHustleHours: config.me.reallocation.sideHustleHours,
        actualLearningHours: config.me.reallocation.learningHours,
        actualRelaxHours: config.me.reallocation.properRelaxHours,
        reflectionNotes: "Logged from interactive sliders snapshot.",
      },
      wife: {
        careHours: config.wife.care.careHoursPerWeek,
        gamingTotalHours: config.wife.screenTime.gamingTotalHours,
        gamingJoyHours: config.wife.screenTime.gamingJoyHours,
        socialTotalHours: config.wife.screenTime.socialTotalHours,
        socialJoyHours: config.wife.screenTime.socialJoyHours,
        actualSideHustleHours: config.wife.reallocation.sideHustleHours,
        actualLearningHours: config.wife.reallocation.learningHours,
        actualRelaxHours: config.wife.reallocation.properRelaxHours,
        reflectionNotes: "Logged from interactive sliders snapshot.",
      },
      coupleCelebrationNotes: coupleNotes || "Empathetic weekly reflection completed!",
      totalHouseholdDriftReclaimedHours: computed.household.totalWeeklyReclaimedHours,
      totalHouseholdExtraCashflowPln: computed.household.totalMonthlyCashflowBoostPln,
    };

    onAddLog(entry);
    setCoupleNotes("");
    setIsLogOpen(false);
    toast.success("Weekly check-in log recorded!");
  };

  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = (event) => {
      try {
        const text = event.target?.result as string;
        onImportJson(text);
        toast.success("Time & Opportunity state imported successfully!");
      } catch (err) {
        toast.error(err instanceof Error ? err.message : "Failed to import JSON file");
      }
    };
    reader.readAsText(file);
    if (fileInputRef.current) {
      fileInputRef.current.value = "";
    }
  };

  return (
    <Card className="border-border/60 shadow-xs">
      <CardHeader className="pb-3">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div className="flex items-center gap-2">
            <History className="text-primary size-5" />
            <div>
              <CardTitle className="text-base font-semibold">Weekly Check-In History &amp; Backup</CardTitle>
              <CardDescription className="text-xs">
                Log weekly Joy vs. Drift reflections, celebrate wins together, and export/import configuration.
              </CardDescription>
            </div>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            {/* Log This Week Dialog */}
            <Dialog open={isLogOpen} onOpenChange={setIsLogOpen}>
              <DialogTrigger asChild>
                <Button size="sm" className="h-8 gap-1.5 text-xs">
                  <Plus className="size-3.5" />
                  <span>Log This Week&apos;s Check-In</span>
                </Button>
              </DialogTrigger>
              <DialogContent className="sm:max-w-md">
                <DialogHeader>
                  <DialogTitle className="text-base">Record Weekly Household Check-In</DialogTitle>
                  <DialogDescription className="text-xs">
                    Snapshots current care hours, Joy vs. Drift hours, and extra cashflow into your historical log.
                  </DialogDescription>
                </DialogHeader>

                <div className="space-y-3 py-2 text-xs">
                  <div className="space-y-1">
                    <Label htmlFor="week-date">Week Start Date (Monday):</Label>
                    <Input
                      id="week-date"
                      type="date"
                      value={weekStartDate}
                      onChange={(e) => setWeekStartDate(e.target.value)}
                      className="h-8 text-xs"
                    />
                  </div>

                  <div className="rounded-md border border-border/50 bg-muted/20 p-2.5 space-y-1">
                    <span className="font-semibold text-foreground block">Current Weekly Snapshot:</span>
                    <div className="grid grid-cols-2 gap-2 text-[11px] text-muted-foreground pt-1">
                      <div>
                        <span>Reclaimed Drift: </span>
                        <strong className="text-foreground">{computed.household.totalWeeklyReclaimedHours}h</strong>
                      </div>
                      <div>
                        <span>Total Care: </span>
                        <strong className="text-foreground">{computed.household.totalWeeklyCareHours}h</strong>
                      </div>
                      <div>
                        <span>Proper Relax: </span>
                        <strong className="text-foreground">{computed.household.totalWeeklyRelaxHours}h</strong>
                      </div>
                      <div>
                        <span>Monthly Boost: </span>
                        <strong className="text-emerald-600 dark:text-emerald-400">
                          +{computed.household.totalMonthlyCashflowBoostPln.toLocaleString()} PLN
                        </strong>
                      </div>
                    </div>
                  </div>

                  <div className="space-y-1">
                    <Label htmlFor="couple-notes">Couple Celebration &amp; Reflection Notes:</Label>
                    <Input
                      id="couple-notes"
                      placeholder="e.g. Great balance this week! Finished module, enjoyed console co-op."
                      value={coupleNotes}
                      onChange={(e) => setCoupleNotes(e.target.value)}
                      className="h-8 text-xs"
                    />
                  </div>
                </div>

                <DialogFooter>
                  <Button type="button" size="sm" onClick={handleCreateLog} className="h-8 text-xs">
                    Save Check-In
                  </Button>
                </DialogFooter>
              </DialogContent>
            </Dialog>

            {/* Export JSON */}
            <Button type="button" variant="outline" size="sm" onClick={onExportJson} className="h-8 gap-1.5 text-xs">
              <Download className="size-3.5" />
              <span>Export JSON</span>
            </Button>

            {/* Import JSON */}
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={() => fileInputRef.current?.click()}
              className="h-8 gap-1.5 text-xs"
            >
              <Upload className="size-3.5" />
              <span>Import JSON</span>
            </Button>
            <input type="file" ref={fileInputRef} onChange={handleFileUpload} accept=".json" className="hidden" />

            {/* Reset */}
            <Button
              type="button"
              variant="ghost"
              size="sm"
              onClick={onResetDefaults}
              className="h-8 gap-1 text-xs text-muted-foreground hover:text-destructive"
            >
              <RotateCcw className="size-3.5" />
              <span>Reset</span>
            </Button>
          </div>
        </div>
      </CardHeader>

      <CardContent>
        {config.weeklyLogs.length === 0 ? (
          <div className="text-center py-8 text-xs text-muted-foreground">
            No check-in entries logged yet. Click &quot;Log This Week&apos;s Check-In&quot; to save your first
            reflection!
          </div>
        ) : (
          <div className="space-y-3">
            {config.weeklyLogs.map((log) => (
              <div key={log.id} className="rounded-lg border border-border/50 bg-background/50 p-3 space-y-2 text-xs">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <div className="flex items-center gap-2">
                    <Calendar className="size-4 text-primary" />
                    <span className="font-semibold text-foreground">Week of {log.weekStartDate}</span>
                    <Badge variant="outline" className="text-[10px]">
                      {new Date(log.loggedAt).toLocaleDateString()}
                    </Badge>
                  </div>

                  <div className="flex items-center gap-2">
                    <Badge className="bg-emerald-500/15 text-emerald-600 dark:text-emerald-400 border-emerald-500/30 text-[11px]">
                      +{log.totalHouseholdExtraCashflowPln.toLocaleString()} PLN / mo
                    </Badge>
                    <Badge variant="secondary" className="text-[11px]">
                      {log.totalHouseholdDriftReclaimedHours}h Reclaimed
                    </Badge>
                  </div>
                </div>

                {log.coupleCelebrationNotes && (
                  <div className="rounded border border-border/30 bg-muted/20 p-2 text-[11px] text-muted-foreground flex items-center gap-1.5">
                    <PartyPopper className="size-3.5 text-primary shrink-0" />
                    <span>{log.coupleCelebrationNotes}</span>
                  </div>
                )}

                <div className="grid grid-cols-1 gap-2 sm:grid-cols-2 pt-1 text-[11px] text-muted-foreground">
                  <div>
                    <strong className="text-foreground">Me: </strong>
                    {log.me.gamingJoyHours}h joyful gaming, {log.me.socialJoyHours}h joyful social |{" "}
                    {log.me.actualSideHustleHours}h side gig, {log.me.actualLearningHours}h study
                  </div>
                  <div>
                    <strong className="text-foreground">My Wife: </strong>
                    {log.wife.careHours}h care | {log.wife.gamingJoyHours}h joyful gaming, {log.wife.socialJoyHours}h
                    joyful social | {log.wife.actualSideHustleHours}h gig/pet project
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </CardContent>
    </Card>
  );
}
