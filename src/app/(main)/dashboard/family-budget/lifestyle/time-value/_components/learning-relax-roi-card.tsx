"use client";

import Link from "next/link";

import { BookOpen, CheckCircle2, ExternalLink, GraduationCap, HeartPulse, Sparkles, TrendingUp } from "lucide-react";

import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { Slider } from "@/components/ui/slider";

import type { ComputedTimeValueSummary, TimeValueMotivatorConfig } from "./time-value-types";

interface LearningRelaxRoiCardProps {
  config: TimeValueMotivatorConfig;
  computed: ComputedTimeValueSummary;
  onChange: (updated: TimeValueMotivatorConfig) => void;
}

export function LearningRelaxRoiCard({ config, computed, onChange }: LearningRelaxRoiCardProps) {
  const learningRoi = computed.learningRoi;
  const totalRelaxHours = computed.household.totalWeeklyRelaxHours;
  const totalLearningHours = computed.household.totalWeeklyLearningHours;

  return (
    <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
      {/* 1. Learning Subscription ROI & Career Lift */}
      <Card className="border-border/60 shadow-xs flex flex-col justify-between">
        <CardHeader className="pb-3">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <div className="flex items-center gap-2">
              <GraduationCap className="text-blue-500 size-5" />
              <div>
                <CardTitle className="text-base font-semibold">Learning Subscription ROI &amp; Skill Growth</CardTitle>
                <CardDescription className="text-xs">
                  Connected to ExternalProvider Learning expenses (#platform, #course, #tutor, #books).
                </CardDescription>
              </div>
            </div>

            <Link
              href="/dashboard/family-budget/lifestyle/learning"
              className="text-xs text-primary hover:underline flex items-center gap-1 font-medium"
            >
              <span>Learning Dashboard</span>
              <ExternalLink className="size-3" />
            </Link>
          </div>
        </CardHeader>

        <CardContent className="space-y-4">
          <div className="grid grid-cols-2 gap-3 text-xs">
            <div className="rounded-md border border-border/50 bg-background/50 p-2.5">
              <span className="text-muted-foreground block text-[11px]">Monthly Learning Spend:</span>
              <span className="font-semibold text-foreground text-sm">
                ~{learningRoi.monthlyExternalProviderLearningSpendPln.toLocaleString()} PLN / mo
              </span>
            </div>

            <div className="rounded-md border border-border/50 bg-background/50 p-2.5">
              <span className="text-muted-foreground block text-[11px]">Active Study Time:</span>
              <span className="font-semibold text-blue-600 dark:text-blue-400 text-sm">
                {totalLearningHours} hrs / week
              </span>
            </div>
          </div>

          <div className="rounded-lg border border-blue-500/20 bg-blue-500/5 p-3 space-y-1.5 text-xs">
            <div className="flex justify-between items-center">
              <span className="text-muted-foreground font-medium">Effective Active Cost per Study Hour:</span>
              <span className="font-bold text-foreground">
                {learningRoi.activeCostPerStudyHourPln > 0
                  ? `${learningRoi.activeCostPerStudyHourPln} PLN / hr`
                  : "0 PLN (Self-study / Free resources)"}
              </span>
            </div>
            <p className="text-[11px] text-muted-foreground leading-relaxed">
              Every hour of reclaimed drift invested in studying amortizes recurring platform subscriptions into
              high-yield career assets.
            </p>
          </div>

          <div className="space-y-2 pt-1 border-t border-border/40">
            <div className="flex justify-between text-xs">
              <Label className="text-xs text-muted-foreground">
                Projected Career Rate Compounding (+{config.learningProjectedRateGrowthPct}%):
              </Label>
              <span className="font-semibold text-emerald-600 dark:text-emerald-400">
                +{learningRoi.projectedCareerRateLiftPln} PLN / hr lift
              </span>
            </div>
            <Slider
              value={[config.learningProjectedRateGrowthPct]}
              min={1}
              max={20}
              step={1}
              onValueChange={([val]) =>
                onChange({
                  ...config,
                  learningProjectedRateGrowthPct: val,
                })
              }
            />
            <div className="flex justify-between text-[10px] text-muted-foreground">
              <span>+1% (Conservative)</span>
              <span>+20% (Senior / Staff Upskill)</span>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* 2. Proper Restorative Relax & Wellness Balance */}
      <Card className="border-border/60 shadow-xs flex flex-col justify-between">
        <CardHeader className="pb-3">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <div className="flex items-center gap-2">
              <HeartPulse className="text-emerald-500 size-5" />
              <div>
                <CardTitle className="text-base font-semibold">Restorative Relax &amp; Wellness Balance</CardTitle>
                <CardDescription className="text-xs">
                  Swapping low-quality doom scrolling for intentional offline recovery &amp; couple wellness.
                </CardDescription>
              </div>
            </div>

            <Link
              href="/dashboard/family-budget/lifestyle/health-sport"
              className="text-xs text-primary hover:underline flex items-center gap-1 font-medium"
            >
              <span>Health &amp; Sport</span>
              <ExternalLink className="size-3" />
            </Link>
          </div>
        </CardHeader>

        <CardContent className="space-y-4">
          <div className="rounded-lg border border-emerald-500/25 bg-emerald-500/5 p-3.5 space-y-2 text-xs">
            <div className="flex justify-between items-center">
              <span className="font-semibold text-emerald-700 dark:text-emerald-300 flex items-center gap-1.5">
                <Sparkles className="size-4" />
                Household Restorative Time
              </span>
              <Badge className="bg-emerald-500/15 text-emerald-600 dark:text-emerald-400 border-emerald-500/30 text-xs">
                {totalRelaxHours} hrs / week
              </Badge>
            </div>
            <p className="text-[11px] text-muted-foreground leading-relaxed">
              Intentional offline recharge (Pilates, massage, reading, long walks, quality couple time) prevents burnout
              and guarantees that side hustles do not erode mental and physical health.
            </p>
          </div>

          <div className="grid grid-cols-2 gap-3 text-xs">
            <div className="rounded-md border border-border/50 bg-background/50 p-2.5 space-y-1">
              <span className="text-muted-foreground block text-[11px]">Me (Intentional Relax):</span>
              <span className="font-semibold text-foreground">
                {config.me.reallocation.properRelaxHours} hrs / week
              </span>
            </div>
            <div className="rounded-md border border-border/50 bg-background/50 p-2.5 space-y-1">
              <span className="text-muted-foreground block text-[11px]">Wife (Intentional Relax):</span>
              <span className="font-semibold text-foreground">
                {config.wife.reallocation.properRelaxHours} hrs / week
              </span>
            </div>
          </div>

          <div className="rounded-md border border-border/50 bg-muted/20 p-3 flex items-center justify-between text-xs">
            <div className="flex items-center gap-2">
              <CheckCircle2 className="size-4 text-emerald-500" />
              <span className="font-medium text-foreground">Zero-Guilt Rest Protected</span>
            </div>
            <span className="text-muted-foreground text-[11px]">
              {computed.household.totalWeeklyJoyHours}h joyful screen time + {totalRelaxHours}h proper wellness
            </span>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
