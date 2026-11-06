"use client";

import { useState } from "react";

import Link from "next/link";

import {
  Clock,
  Compass,
  ExternalLink,
  Heart,
  Home,
  Palmtree,
  PiggyBank,
  Plus,
  Sparkles,
  Target,
  Trash2,
  TrendingUp,
} from "lucide-react";

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
import { Progress } from "@/components/ui/progress";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";

import { evaluatePersonalGoals } from "./time-value-engine";
import type { ComputedTimeValueSummary, GoalOwner, PersonalGoal, TimeValueMotivatorConfig } from "./time-value-types";

interface GoalAcceleratorsGridProps {
  config: TimeValueMotivatorConfig;
  computed: ComputedTimeValueSummary;
  onChange: (updated: TimeValueMotivatorConfig) => void;
}

export function GoalAcceleratorsGrid({ config, computed, onChange }: GoalAcceleratorsGridProps) {
  const [isAddGoalOpen, setIsAddGoalOpen] = useState(false);
  const [newGoal, setNewGoal] = useState<Partial<PersonalGoal>>({
    title: "",
    category: "travel",
    targetAmountPln: 3000,
    currentSavedPln: 0,
    owner: "wife",
    notes: "",
  });

  const mortgage = computed.mortgageAcceleration;
  const evaluatedGoals = evaluatePersonalGoals(
    config.personalGoals,
    computed.wife.cashflow.monthlySideHustleCashflowPln,
    computed.household.totalMonthlyCashflowBoostPln,
  );

  const handleAddGoal = () => {
    if (!newGoal.title) return;
    const goal: PersonalGoal = {
      id: `goal-${Date.now()}`,
      title: newGoal.title ?? "New Goal",
      category: newGoal.category ?? "travel",
      targetAmountPln: Number(newGoal.targetAmountPln) || 1000,
      currentSavedPln: Number(newGoal.currentSavedPln) || 0,
      owner: (newGoal.owner as GoalOwner) ?? "wife",
      notes: newGoal.notes ?? "",
      createdAt: new Date().toISOString(),
    };

    onChange({
      ...config,
      personalGoals: [...config.personalGoals, goal],
    });
    setNewGoal({
      title: "",
      category: "travel",
      targetAmountPln: 3000,
      currentSavedPln: 0,
      owner: "wife",
      notes: "",
    });
    setIsAddGoalOpen(false);
  };

  const handleDeleteGoal = (goalId: string) => {
    onChange({
      ...config,
      personalGoals: config.personalGoals.filter((g) => g.id !== goalId),
    });
  };

  return (
    <div className="space-y-6">
      {/* 1. 1st Mortgage Down Payment & Finishing Accelerator */}
      <Card className="border-border/60 shadow-xs">
        <CardHeader className="pb-3">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <div className="flex items-center gap-2">
              <Home className="text-primary size-5" />
              <div>
                <CardTitle className="text-base font-semibold">
                  1st Mortgage Down Payment (*Wkład własny*) &amp; Finishing Accelerator
                </CardTitle>
                <CardDescription className="text-xs">
                  How reclaimed household drift time accelerates signing Umowa deweloperska and Key Handover.
                </CardDescription>
              </div>
            </div>

            <Link
              href="/dashboard/family-budget/mortgage"
              className="text-xs text-primary hover:underline flex items-center gap-1 font-medium"
            >
              <span>View Mortgage Simulator</span>
              <ExternalLink className="size-3" />
            </Link>
          </div>
        </CardHeader>

        <CardContent className="space-y-4">
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
            {/* Milestone 1: Signing / Wkład Własny */}
            <div className="rounded-lg border border-border/50 bg-background/50 p-3.5 space-y-2">
              <div className="flex justify-between items-center text-xs">
                <span className="font-semibold flex items-center gap-1.5">
                  <PiggyBank className="size-4 text-emerald-500" />
                  Milestone 1: Signing
                </span>
                <Badge variant="outline" className="text-[10px]">
                  Gap: {mortgage.milestone1GapPln.toLocaleString()} PLN
                </Badge>
              </div>
              <div className="space-y-1">
                <div className="flex justify-between text-xs">
                  <span className="text-muted-foreground">Baseline Timeline:</span>
                  <span className="font-medium">{mortgage.baselineMonthsMilestone1} months</span>
                </div>
                <div className="flex justify-between text-xs">
                  <span className="text-emerald-600 dark:text-emerald-400 font-medium">Accelerated:</span>
                  <span className="font-bold text-emerald-600 dark:text-emerald-400">
                    {mortgage.acceleratedMonthsMilestone1} months
                  </span>
                </div>
              </div>
              <div className="border-t border-border/40 pt-1.5 flex justify-between text-xs">
                <span className="text-muted-foreground font-medium">Time Shaved Off:</span>
                <Badge className="bg-emerald-500/15 text-emerald-600 dark:text-emerald-400 border-emerald-500/30 text-xs">
                  -{mortgage.monthsSavedMilestone1} months
                </Badge>
              </div>
            </div>

            {/* Milestone 2: Key Handover & Finishing */}
            <div className="rounded-lg border border-border/50 bg-background/50 p-3.5 space-y-2">
              <div className="flex justify-between items-center text-xs">
                <span className="font-semibold flex items-center gap-1.5">
                  <Clock className="size-4 text-blue-500" />
                  Milestone 2: Key Handover
                </span>
                <Badge variant="outline" className="text-[10px]">
                  Gap: {mortgage.totalGapPln.toLocaleString()} PLN
                </Badge>
              </div>
              <div className="space-y-1">
                <div className="flex justify-between text-xs">
                  <span className="text-muted-foreground">Baseline Timeline:</span>
                  <span className="font-medium">{mortgage.baselineMonthsMilestone2} months</span>
                </div>
                <div className="flex justify-between text-xs">
                  <span className="text-blue-600 dark:text-blue-400 font-medium">Accelerated:</span>
                  <span className="font-bold text-blue-600 dark:text-blue-400">
                    {mortgage.acceleratedMonthsMilestone2} months
                  </span>
                </div>
              </div>
              <div className="border-t border-border/40 pt-1.5 flex justify-between text-xs">
                <span className="text-muted-foreground font-medium">Time Shaved Off:</span>
                <Badge className="bg-blue-500/15 text-blue-600 dark:text-blue-400 border-blue-500/30 text-xs">
                  -{mortgage.monthsSavedMilestone2} months
                </Badge>
              </div>
            </div>

            {/* Unlocked Apartment Floor Area */}
            <div className="rounded-lg border border-primary/20 bg-primary/5 p-3.5 space-y-2 flex flex-col justify-between">
              <div>
                <span className="text-xs font-semibold text-foreground flex items-center gap-1.5">
                  <Sparkles className="size-4 text-primary" />
                  Apartment Area Unlocked
                </span>
                <p className="text-[11px] text-muted-foreground pt-1">
                  At the configured {mortgage.pricePerSqmPln.toLocaleString()} PLN/m² market price.
                </p>
              </div>
              <div className="rounded border border-primary/25 bg-background/80 p-2 text-center">
                <span className="text-xl font-bold text-primary">+{mortgage.unlockedSqmPerYear} m²</span>
                <span className="block text-[10px] text-muted-foreground">funded per year from reclaimed drift</span>
              </div>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* 2. Historical Trip Benchmarks & Dream Trips */}
      <Card className="border-border/60 shadow-xs">
        <CardHeader className="pb-3">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <div className="flex items-center gap-2">
              <Palmtree className="text-amber-500 size-5" />
              <div>
                <CardTitle className="text-base font-semibold">Dream Trip Benchmarks</CardTitle>
                <CardDescription className="text-xs">
                  Real vacation episodes from ExternalProvider transactions evaluated against annual reclaimed cashflow.
                </CardDescription>
              </div>
            </div>
            <Link
              href="/dashboard/family-budget/lifestyle/trips-concerts"
              className="text-xs text-primary hover:underline flex items-center gap-1 font-medium"
            >
              <span>Explore Trips &amp; Concerts</span>
              <ExternalLink className="size-3" />
            </Link>
          </div>
        </CardHeader>

        <CardContent>
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
            {computed.tripBenchmarks.map((trip) => (
              <div
                key={trip.id}
                className="rounded-lg border border-border/50 bg-muted/10 p-3 space-y-2 text-xs flex flex-col justify-between"
              >
                <div>
                  <div className="flex justify-between items-start gap-1">
                    <span className="font-semibold text-foreground">{trip.name}</span>
                    <Badge variant="outline" className="text-[10px]">
                      {trip.totalCostPln.toLocaleString()} PLN
                    </Badge>
                  </div>
                  <span className="text-[10px] text-muted-foreground">Historical Trip Benchmark</span>
                </div>

                <div className="border-t border-border/40 pt-2 space-y-1">
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">Yearly Multiplier:</span>
                    <span className="font-bold text-amber-600 dark:text-amber-400">
                      {trip.multiplierPerYear}x / year
                    </span>
                  </div>
                  <div className="flex justify-between text-[11px]">
                    <span className="text-muted-foreground">Funded in:</span>
                    <span className="font-medium text-foreground">{trip.monthsToFund} months</span>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>

      {/* 3. Personal / Her-Preference Goals Manager */}
      <Card className="border-border/60 shadow-xs">
        <CardHeader className="pb-3">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <div className="flex items-center gap-2">
              <Target className="text-rose-500 size-5" />
              <div>
                <CardTitle className="text-base font-semibold">Personal &amp; Her-Preference Goals</CardTitle>
                <CardDescription className="text-xs">
                  Rewarding self-directed goals funded through spouse freelancing, bounties, and household drift.
                </CardDescription>
              </div>
            </div>

            <Dialog open={isAddGoalOpen} onOpenChange={setIsAddGoalOpen}>
              <DialogTrigger asChild>
                <Button size="sm" variant="outline" className="h-7 gap-1 text-xs">
                  <Plus className="size-3.5" />
                  <span>Add Personal Goal</span>
                </Button>
              </DialogTrigger>
              <DialogContent className="sm:max-w-md">
                <DialogHeader>
                  <DialogTitle className="text-base">Add Personal / Preference Goal</DialogTitle>
                  <DialogDescription className="text-xs">
                    Create a dedicated reward wishlist item (spa weekend, gadget, course, etc.).
                  </DialogDescription>
                </DialogHeader>

                <div className="space-y-3 py-2 text-xs">
                  <div className="space-y-1">
                    <Label htmlFor="goal-title">Goal Title:</Label>
                    <Input
                      id="goal-title"
                      placeholder="e.g. Rome Weekend & Spa"
                      value={newGoal.title}
                      onChange={(e) => setNewGoal({ ...newGoal, title: e.target.value })}
                      className="h-8 text-xs"
                    />
                  </div>
                  <div className="grid grid-cols-2 gap-2">
                    <div className="space-y-1">
                      <Label htmlFor="goal-target">Target Amount (PLN):</Label>
                      <Input
                        id="goal-target"
                        type="number"
                        value={newGoal.targetAmountPln}
                        onChange={(e) => setNewGoal({ ...newGoal, targetAmountPln: Number(e.target.value) })}
                        className="h-8 text-xs"
                      />
                    </div>
                    <div className="space-y-1">
                      <Label htmlFor="goal-saved">Current Saved (PLN):</Label>
                      <Input
                        id="goal-saved"
                        type="number"
                        value={newGoal.currentSavedPln}
                        onChange={(e) => setNewGoal({ ...newGoal, currentSavedPln: Number(e.target.value) })}
                        className="h-8 text-xs"
                      />
                    </div>
                  </div>
                  <div className="space-y-1">
                    <Label htmlFor="goal-owner">Goal Owner:</Label>
                    <Select
                      value={newGoal.owner}
                      onValueChange={(val: GoalOwner) => setNewGoal({ ...newGoal, owner: val })}
                    >
                      <SelectTrigger id="goal-owner" className="h-8 text-xs">
                        <SelectValue placeholder="Select owner" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="wife" className="text-xs">
                          My Wife (Her Preference)
                        </SelectItem>
                        <SelectItem value="shared" className="text-xs">
                          Shared Household
                        </SelectItem>
                        <SelectItem value="me" className="text-xs">
                          Me
                        </SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                </div>

                <DialogFooter>
                  <Button type="button" size="sm" onClick={handleAddGoal} className="h-8 text-xs">
                    Save Goal
                  </Button>
                </DialogFooter>
              </DialogContent>
            </Dialog>
          </div>
        </CardHeader>

        <CardContent>
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
            {evaluatedGoals.map((goal) => {
              const pct = Math.min(100, Math.round((goal.currentSavedPln / goal.targetAmountPln) * 100));
              const isWife = goal.owner === "wife";

              return (
                <div
                  key={goal.id}
                  className="rounded-lg border border-border/50 bg-background/50 p-3.5 space-y-2.5 text-xs flex flex-col justify-between"
                >
                  <div className="space-y-1">
                    <div className="flex items-start justify-between gap-1">
                      <div className="flex items-center gap-1.5">
                        {isWife && <Heart className="size-3.5 text-rose-500" />}
                        <span className="font-semibold text-foreground">{goal.title}</span>
                      </div>
                      <Button
                        variant="ghost"
                        size="icon"
                        onClick={() => handleDeleteGoal(goal.id)}
                        className="size-6 text-muted-foreground hover:text-destructive"
                      >
                        <Trash2 className="size-3" />
                      </Button>
                    </div>
                    {goal.notes && <p className="text-[11px] text-muted-foreground">{goal.notes}</p>}
                  </div>

                  <div className="space-y-1.5">
                    <div className="flex justify-between text-[11px]">
                      <span className="text-muted-foreground">
                        {goal.currentSavedPln.toLocaleString()} / {goal.targetAmountPln.toLocaleString()} PLN
                      </span>
                      <span className="font-semibold">{pct}%</span>
                    </div>
                    <Progress value={pct} className="h-1.5" />
                  </div>

                  <div className="border-t border-border/40 pt-2 flex items-center justify-between text-[11px]">
                    <Badge variant={isWife ? "secondary" : "outline"} className="text-[10px]">
                      {isWife ? "Her Choice" : goal.owner}
                    </Badge>
                    <span className="text-muted-foreground font-medium">
                      {goal.isFunded ? "100% Funded!" : `~${goal.monthsToFund} mos to goal`}
                    </span>
                  </div>
                </div>
              );
            })}
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
