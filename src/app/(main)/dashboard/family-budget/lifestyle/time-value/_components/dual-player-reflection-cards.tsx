"use client";

import {
  Gamepad2,
  Heart,
  Laptop,
  PartyPopper,
  ShieldCheck,
  Smartphone,
  Sparkles,
  TrendingUp,
  User,
} from "lucide-react";

import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { Slider } from "@/components/ui/slider";

import type {
  ComputedPlayerScreenTime,
  ComputedTimeValueSummary,
  PlayerId,
  TimeValueMotivatorConfig,
} from "./time-value-types";

interface DualPlayerReflectionCardsProps {
  config: TimeValueMotivatorConfig;
  computed: ComputedTimeValueSummary;
  onChange: (updated: TimeValueMotivatorConfig) => void;
}

export function DualPlayerReflectionCards({ config, computed, onChange }: DualPlayerReflectionCardsProps) {
  const updateMe = (updater: (prev: typeof config.me) => typeof config.me) => {
    onChange({
      ...config,
      me: updater(config.me),
    });
  };

  const updateWife = (updater: (prev: typeof config.wife) => typeof config.wife) => {
    onChange({
      ...config,
      wife: updater(config.wife),
    });
  };

  return (
    <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
      {/* 1. Primary Partner: Me */}
      <PlayerCard
        player="me"
        title={config.me.displayName}
        subtitle="Primary Tech & Workstation"
        devicePhone={config.me.device.primaryPhone}
        deviceGaming={config.me.device.gamingPlatform}
        screenTime={config.me.screenTime}
        computedScreen={computed.me.screenTime}
        reallocation={config.me.reallocation}
        careHours={config.me.care.careHoursPerWeek}
        careReferenceRate={config.me.care.referenceHourlyRatePln}
        careAppreciationMonthlyPln={computed.me.careAppreciationPln}
        careTitle={config.me.care.celebrationTitle}
        onUpdateCare={(hours) =>
          updateMe((prev) => ({
            ...prev,
            care: { ...prev.care, careHoursPerWeek: hours },
          }))
        }
        onUpdateScreenTime={(screenTime) =>
          updateMe((prev) => ({
            ...prev,
            screenTime,
          }))
        }
        onUpdateReallocation={(reallocation) =>
          updateMe((prev) => ({
            ...prev,
            reallocation,
          }))
        }
      />

      {/* 2. Spouse: My Wife */}
      <PlayerCard
        player="wife"
        title={config.wife.displayName}
        subtitle="Household Foundation & Creative Partner"
        devicePhone={config.wife.device.primaryPhone}
        deviceGaming={config.wife.device.gamingPlatform}
        screenTime={config.wife.screenTime}
        computedScreen={computed.wife.screenTime}
        reallocation={config.wife.reallocation}
        careHours={config.wife.care.careHoursPerWeek}
        careReferenceRate={config.wife.care.referenceHourlyRatePln}
        careAppreciationMonthlyPln={computed.wife.careAppreciationPln}
        careTitle={config.wife.care.celebrationTitle}
        isSpouse
        onUpdateCare={(hours) =>
          updateWife((prev) => ({
            ...prev,
            care: { ...prev.care, careHoursPerWeek: hours },
          }))
        }
        onUpdateScreenTime={(screenTime) =>
          updateWife((prev) => ({
            ...prev,
            screenTime,
          }))
        }
        onUpdateReallocation={(reallocation) =>
          updateWife((prev) => ({
            ...prev,
            reallocation,
          }))
        }
      />
    </div>
  );
}

// ---------------------------------------------------------------------------
// Individual Player Card Component
// ---------------------------------------------------------------------------

interface PlayerCardProps {
  player: PlayerId;
  title: string;
  subtitle: string;
  devicePhone: string;
  deviceGaming: string;
  screenTime: TimeValueMotivatorConfig["me"]["screenTime"];
  computedScreen: ComputedPlayerScreenTime;
  reallocation: TimeValueMotivatorConfig["me"]["reallocation"];
  careHours: number;
  careReferenceRate: number;
  careAppreciationMonthlyPln: number;
  careTitle: string;
  isSpouse?: boolean;
  onUpdateCare: (hours: number) => void;
  onUpdateScreenTime: (screenTime: TimeValueMotivatorConfig["me"]["screenTime"]) => void;
  onUpdateReallocation: (reallocation: TimeValueMotivatorConfig["me"]["reallocation"]) => void;
}

function PlayerCard({
  player,
  title,
  subtitle,
  devicePhone,
  deviceGaming,
  screenTime,
  computedScreen,
  reallocation,
  careHours,
  careReferenceRate,
  careAppreciationMonthlyPln,
  careTitle,
  isSpouse = false,
  onUpdateCare,
  onUpdateScreenTime,
  onUpdateReallocation,
}: PlayerCardProps) {
  return (
    <Card className="border-border/60 shadow-xs flex flex-col justify-between">
      <CardHeader className="pb-3">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <div className="flex items-center gap-2.5">
            <div
              className={`flex size-9 items-center justify-center rounded-lg ${
                isSpouse
                  ? "bg-rose-500/10 text-rose-600 dark:text-rose-400"
                  : "bg-blue-500/10 text-blue-600 dark:text-blue-400"
              }`}
            >
              {isSpouse ? <Heart className="size-5" /> : <User className="size-5" />}
            </div>
            <div>
              <CardTitle className="text-base font-semibold">{title}</CardTitle>
              <CardDescription className="text-xs">{subtitle}</CardDescription>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <Badge variant="outline" className="text-[11px] font-normal gap-1">
              <Smartphone className="size-3 text-muted-foreground" />
              {devicePhone}
            </Badge>
            <Badge variant="outline" className="text-[11px] font-normal gap-1">
              {isSpouse ? (
                <Gamepad2 className="size-3 text-muted-foreground" />
              ) : (
                <Laptop className="size-3 text-muted-foreground" />
              )}
              {deviceGaming}
            </Badge>
          </div>
        </div>
      </CardHeader>

      <CardContent className="space-y-5">
        {/* Foundation Section: Partner & Home Care (Prominently featured, especially for spouse) */}
        {isSpouse ? (
          <div className="rounded-lg border border-rose-500/25 bg-rose-500/5 p-3.5 space-y-3">
            <div className="flex items-start justify-between gap-2">
              <div className="space-y-1">
                <div className="flex items-center gap-1.5 text-xs font-semibold text-rose-700 dark:text-rose-300">
                  <Sparkles className="size-4" />
                  <span>Foundational Partner &amp; Home Care Recognition</span>
                </div>
                <p className="text-[11px] text-muted-foreground leading-relaxed">
                  Celebrates 3+ years of household management, cooking, errands, and emotional anchoring. This
                  foundational contribution enables our household stability and is{" "}
                  <strong className="text-foreground">never treated as drift time</strong>.
                </p>
              </div>
              <Badge
                variant="outline"
                className="border-rose-500/30 bg-rose-500/10 text-rose-600 dark:text-rose-400 text-[11px] shrink-0"
              >
                ~{careAppreciationMonthlyPln.toLocaleString()} PLN/mo value
              </Badge>
            </div>

            <div className="space-y-1.5">
              <div className="flex justify-between text-xs font-medium">
                <span className="text-muted-foreground">Weekly Care &amp; Support Hours:</span>
                <span className="text-rose-600 dark:text-rose-400 font-semibold">{careHours} hrs/week</span>
              </div>
              <Slider
                value={[careHours]}
                min={5}
                max={45}
                step={1}
                onValueChange={([val]) => onUpdateCare(val)}
                className="py-1"
              />
              <div className="flex justify-between text-[10px] text-muted-foreground">
                <span>5 hrs (Baseline support)</span>
                <span>{careReferenceRate} PLN/hr appreciative reference</span>
                <span>45 hrs (Full-time household manager)</span>
              </div>
            </div>
          </div>
        ) : (
          <div className="rounded-lg border border-border/50 bg-muted/20 p-3 space-y-2">
            <div className="flex items-center justify-between text-xs">
              <span className="font-medium flex items-center gap-1.5">
                <ShieldCheck className="size-3.5 text-blue-500" />
                {careTitle}
              </span>
              <span className="text-muted-foreground font-medium">{careHours} hrs/week</span>
            </div>
            <Slider
              value={[careHours]}
              min={0}
              max={25}
              step={1}
              onValueChange={([val]) => onUpdateCare(val)}
              className="py-0.5"
            />
          </div>
        )}

        {/* Joy vs. Drift Screen Time Reflection */}
        <div className="space-y-3">
          <div className="flex items-center justify-between">
            <Label className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
              Joy vs. Drift Screen-Time Reflection
            </Label>
            {computedScreen.isAllJoyCelebration ? (
              <Badge className="bg-emerald-500/15 text-emerald-600 dark:text-emerald-400 border-emerald-500/30 text-[11px] gap-1">
                <PartyPopper className="size-3.5" /> 100% Joyful Recharge Week!
              </Badge>
            ) : (
              <Badge variant="secondary" className="text-[11px] font-normal">
                {computedScreen.joyfulHours}h Joy / {computedScreen.driftHours}h Drift
              </Badge>
            )}
          </div>

          {/* Gaming Time Slider */}
          <div className="rounded-md border border-border/50 p-2.5 space-y-2 bg-background/50">
            <div className="flex justify-between items-center text-xs">
              <span className="font-medium flex items-center gap-1.5">
                <Gamepad2 className="size-3.5 text-primary" />
                {isSpouse ? "Mobile & Casual Games" : "PC & Console Gaming"}
              </span>
              <span className="text-muted-foreground">
                {screenTime.gamingTotalHours}h total ({screenTime.gamingJoyHours}h joyful)
              </span>
            </div>

            <div className="space-y-1">
              <div className="flex justify-between text-[11px] text-muted-foreground">
                <span>Total Gaming per week:</span>
                <span className="font-semibold text-foreground">{screenTime.gamingTotalHours} hrs</span>
              </div>
              <Slider
                value={[screenTime.gamingTotalHours]}
                min={0}
                max={30}
                step={0.5}
                onValueChange={([val]) =>
                  onUpdateScreenTime({
                    ...screenTime,
                    gamingTotalHours: val,
                    gamingJoyHours: Math.min(val, screenTime.gamingJoyHours),
                  })
                }
              />
            </div>

            <div className="space-y-1 pt-1">
              <div className="flex justify-between text-[11px] text-muted-foreground">
                <span className="text-emerald-600 dark:text-emerald-400 font-medium flex items-center gap-1">
                  <ShieldCheck className="size-3" /> Recharging &amp; Joyful portion:
                </span>
                <span className="font-semibold text-emerald-600 dark:text-emerald-400">
                  {screenTime.gamingJoyHours} hrs
                </span>
              </div>
              <Slider
                value={[screenTime.gamingJoyHours]}
                min={0}
                max={screenTime.gamingTotalHours || 1}
                step={0.5}
                onValueChange={([val]) =>
                  onUpdateScreenTime({
                    ...screenTime,
                    gamingJoyHours: val,
                  })
                }
              />
            </div>
          </div>

          {/* Social Media Slider */}
          <div className="rounded-md border border-border/50 p-2.5 space-y-2 bg-background/50">
            <div className="flex justify-between items-center text-xs">
              <span className="font-medium flex items-center gap-1.5">
                <Smartphone className="size-3.5 text-purple-500" />
                Social Media (Instagram, Threads, etc.)
              </span>
              <span className="text-muted-foreground">
                {screenTime.socialTotalHours}h total ({screenTime.socialJoyHours}h joyful)
              </span>
            </div>

            <div className="space-y-1">
              <div className="flex justify-between text-[11px] text-muted-foreground">
                <span>Total Social per week:</span>
                <span className="font-semibold text-foreground">{screenTime.socialTotalHours} hrs</span>
              </div>
              <Slider
                value={[screenTime.socialTotalHours]}
                min={0}
                max={25}
                step={0.5}
                onValueChange={([val]) =>
                  onUpdateScreenTime({
                    ...screenTime,
                    socialTotalHours: val,
                    socialJoyHours: Math.min(val, screenTime.socialJoyHours),
                  })
                }
              />
            </div>

            <div className="space-y-1 pt-1">
              <div className="flex justify-between text-[11px] text-muted-foreground">
                <span className="text-emerald-600 dark:text-emerald-400 font-medium flex items-center gap-1">
                  <ShieldCheck className="size-3" /> Inspiring / Joyful connection:
                </span>
                <span className="font-semibold text-emerald-600 dark:text-emerald-400">
                  {screenTime.socialJoyHours} hrs
                </span>
              </div>
              <Slider
                value={[screenTime.socialJoyHours]}
                min={0}
                max={screenTime.socialTotalHours || 1}
                step={0.5}
                onValueChange={([val]) =>
                  onUpdateScreenTime({
                    ...screenTime,
                    socialJoyHours: val,
                  })
                }
              />
            </div>
          </div>
        </div>

        {/* 3-Way Drift Reallocation Portfolio */}
        <div className="space-y-3 pt-1 border-t border-border/40">
          <div className="flex items-center justify-between">
            <Label className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
              3-Way Reallocation Portfolio
            </Label>
            <span className="text-[11px] font-medium text-primary">{computedScreen.driftHours}h Drift Reallocated</span>
          </div>

          <div className="grid grid-cols-1 gap-2.5 sm:grid-cols-3">
            {/* 1. Side Hustle / Pet Projects */}
            <div className="rounded-md border border-border/50 bg-muted/15 p-2.5 space-y-1.5">
              <div className="flex justify-between items-center text-xs">
                <span className="font-medium text-emerald-600 dark:text-emerald-400">
                  {isSpouse ? "Pet Project / Gig" : "Side Hustle"}
                </span>
                <span className="font-semibold">{reallocation.sideHustleHours}h</span>
              </div>
              <Slider
                value={[reallocation.sideHustleHours]}
                min={0}
                max={Math.max(10, computedScreen.driftHours)}
                step={0.5}
                onValueChange={([val]) =>
                  onUpdateReallocation({
                    ...reallocation,
                    sideHustleHours: val,
                  })
                }
              />
              <span className="text-[10px] text-muted-foreground block text-right">
                @{reallocation.focusEfficiencyPct}% focus efficiency
              </span>
            </div>

            {/* 2. Skill Learning */}
            <div className="rounded-md border border-border/50 bg-muted/15 p-2.5 space-y-1.5">
              <div className="flex justify-between items-center text-xs">
                <span className="font-medium text-blue-600 dark:text-blue-400">Skill Study</span>
                <span className="font-semibold">{reallocation.learningHours}h</span>
              </div>
              <Slider
                value={[reallocation.learningHours]}
                min={0}
                max={Math.max(8, computedScreen.driftHours)}
                step={0.5}
                onValueChange={([val]) =>
                  onUpdateReallocation({
                    ...reallocation,
                    learningHours: val,
                  })
                }
              />
              <span className="text-[10px] text-muted-foreground block text-right">Courses, certs &amp; tutor</span>
            </div>

            {/* 3. Proper Relax & Wellness */}
            <div className="rounded-md border border-border/50 bg-muted/15 p-2.5 space-y-1.5">
              <div className="flex justify-between items-center text-xs">
                <span className="font-medium text-amber-600 dark:text-amber-400">Proper Relax</span>
                <span className="font-semibold">{reallocation.properRelaxHours}h</span>
              </div>
              <Slider
                value={[reallocation.properRelaxHours]}
                min={0}
                max={Math.max(8, computedScreen.driftHours)}
                step={0.5}
                onValueChange={([val]) =>
                  onUpdateReallocation({
                    ...reallocation,
                    properRelaxHours: val,
                  })
                }
              />
              <span className="text-[10px] text-muted-foreground block text-right">Pilates, reading &amp; walks</span>
            </div>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
