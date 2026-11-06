"use client";

import { useState } from "react";

import Link from "next/link";

import {
  Banknote,
  Briefcase,
  CheckCircle2,
  Clock,
  Coins,
  ExternalLink,
  Gift,
  Laptop,
  Palmtree,
  Plus,
  Rocket,
  Shield,
  Sparkles,
  Trash2,
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
import { Slider } from "@/components/ui/slider";
import { Switch } from "@/components/ui/switch";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";

import type { ComputedTimeValueSummary, FamilyPetProject, TimeValueMotivatorConfig } from "./time-value-types";

interface OpportunityMonetizationStudioProps {
  config: TimeValueMotivatorConfig;
  computed: ComputedTimeValueSummary;
  onChange: (updated: TimeValueMotivatorConfig) => void;
  activeOfferTitle?: string;
}

export function OpportunityMonetizationStudio({
  config,
  computed,
  onChange,
  activeOfferTitle,
}: OpportunityMonetizationStudioProps) {
  const [isAddProjectOpen, setIsAddProjectOpen] = useState(false);
  const [newProject, setNewProject] = useState<Partial<FamilyPetProject>>({
    title: "",
    description: "",
    status: "active",
    allocatedHoursPerWeek: 3,
    monthlyExpenseSavedPln: 150,
    weeklyHouseholdHoursSaved: 1,
    hoursSavedValuedAtPln: 40,
    projectedLaunchMonthlyIncomePln: 0,
    milestoneBountyPln: 1000,
    milestoneCompleted: false,
  });

  const primaryMonetization = config.me.monetization;
  const spouseOpportunity = config.wife.opportunity;

  const handleUpdatePrimary = (updater: (prev: typeof primaryMonetization) => typeof primaryMonetization) => {
    onChange({
      ...config,
      me: {
        ...config.me,
        monetization: updater(config.me.monetization),
      },
    });
  };

  const handleUpdateSpouse = (updater: (prev: typeof spouseOpportunity) => typeof spouseOpportunity) => {
    onChange({
      ...config,
      wife: {
        ...config.wife,
        opportunity: updater(config.wife.opportunity),
      },
    });
  };

  const handleAddProject = () => {
    if (!newProject.title) return;
    const project: FamilyPetProject = {
      id: `pet-${Date.now()}`,
      title: newProject.title ?? "New Family Project",
      description: newProject.description ?? "",
      status: newProject.status ?? "active",
      allocatedHoursPerWeek: newProject.allocatedHoursPerWeek ?? 2,
      monthlyExpenseSavedPln: Number(newProject.monthlyExpenseSavedPln) || 0,
      weeklyHouseholdHoursSaved: Number(newProject.weeklyHouseholdHoursSaved) || 0,
      hoursSavedValuedAtPln: Number(newProject.hoursSavedValuedAtPln) || 40,
      projectedLaunchMonthlyIncomePln: Number(newProject.projectedLaunchMonthlyIncomePln) || 0,
      milestoneBountyPln: Number(newProject.milestoneBountyPln) || 0,
      milestoneCompleted: Boolean(newProject.milestoneCompleted),
      createdAt: new Date().toISOString(),
    };

    onChange({
      ...config,
      petProjects: [...config.petProjects, project],
    });
    setNewProject({
      title: "",
      description: "",
      status: "active",
      allocatedHoursPerWeek: 3,
      monthlyExpenseSavedPln: 150,
      weeklyHouseholdHoursSaved: 1,
      hoursSavedValuedAtPln: 40,
      projectedLaunchMonthlyIncomePln: 0,
      milestoneBountyPln: 1000,
      milestoneCompleted: false,
    });
    setIsAddProjectOpen(false);
  };

  const handleToggleProjectMilestone = (projectId: string) => {
    onChange({
      ...config,
      petProjects: config.petProjects.map((p) =>
        p.id === projectId ? { ...p, milestoneCompleted: !p.milestoneCompleted } : p,
      ),
    });
  };

  const handleDeleteProject = (projectId: string) => {
    onChange({
      ...config,
      petProjects: config.petProjects.filter((p) => p.id !== projectId),
    });
  };

  return (
    <Card className="border-border/60 shadow-xs">
      <CardHeader className="pb-3">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <div className="flex items-center gap-2">
            <Coins className="text-primary size-5" />
            <CardTitle className="text-base font-semibold">Opportunity &amp; Monetization Studio</CardTitle>
          </div>
          <Badge variant="outline" className="text-xs">
            Combined Boost: +{computed.household.totalMonthlyCashflowBoostPln.toLocaleString()} PLN/mo
          </Badge>
        </div>
        <CardDescription className="text-xs">
          Empowering the primary partner with Offer-linked rates and vacation dials, while unlocking freelancing and
          high-leverage family pet projects for the spouse.
        </CardDescription>
      </CardHeader>

      <CardContent>
        <Tabs defaultValue="primary" className="space-y-4">
          <TabsList className="grid grid-cols-2 max-w-md">
            <TabsTrigger value="primary" className="text-xs">
              Primary: Rate &amp; Vacation Dial
            </TabsTrigger>
            <TabsTrigger value="spouse" className="text-xs">
              Spouse: Freelance &amp; Pet Projects
            </TabsTrigger>
          </TabsList>

          {/* 1. PRIMARY PARTNER: OFFER COMPARATOR & VACATION DIAL */}
          <TabsContent value="primary" className="space-y-4">
            <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
              {/* Left Column: Hourly Rate Configuration */}
              <div className="rounded-lg border border-border/50 bg-background/50 p-4 space-y-3.5">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-1.5 font-semibold text-xs">
                    <Laptop className="size-4 text-primary" />
                    <span>Marginal Hourly Rate Configuration</span>
                  </div>
                  {activeOfferTitle && (
                    <Link
                      href="/dashboard/family-budget/offer-comparator"
                      className="text-[11px] text-primary hover:underline flex items-center gap-1"
                    >
                      <span>{activeOfferTitle}</span>
                      <ExternalLink className="size-3" />
                    </Link>
                  )}
                </div>

                <div className="flex items-center justify-between gap-4">
                  <Label htmlFor="rate-source" className="text-xs text-muted-foreground">
                    Sync with Offer Comparator:
                  </Label>
                  <Switch
                    id="rate-source"
                    checked={primaryMonetization.rateSource === "offer_sync"}
                    onCheckedChange={(checked) =>
                      handleUpdatePrimary((prev) => ({
                        ...prev,
                        rateSource: checked ? "offer_sync" : "manual",
                      }))
                    }
                  />
                </div>

                {primaryMonetization.rateSource === "manual" ? (
                  <div className="space-y-1.5">
                    <div className="flex justify-between text-xs">
                      <Label htmlFor="manual-rate">Manual Marginal Net Rate (PLN/hr):</Label>
                      <span className="font-semibold text-primary">{primaryMonetization.manualRatePln} PLN/hr</span>
                    </div>
                    <Input
                      id="manual-rate"
                      type="number"
                      value={primaryMonetization.manualRatePln}
                      onChange={(e) => {
                        const val = Number(e.target.value);
                        handleUpdatePrimary((prev) => ({
                          ...prev,
                          manualRatePln: val,
                        }));
                      }}
                      className="h-8 text-xs"
                    />
                  </div>
                ) : (
                  <div className="rounded-md border border-primary/20 bg-primary/5 p-3 space-y-1 text-xs">
                    <div className="flex justify-between">
                      <span className="text-muted-foreground">Effective Net Hourly Rate:</span>
                      <span className="font-bold text-foreground">
                        {computed.me.cashflow.effectiveHourlyRatePln} PLN / hr
                      </span>
                    </div>
                    <p className="text-[11px] text-muted-foreground">
                      Reflects active Offer Track after B2B tax brackets and social contributions.
                    </p>
                  </div>
                )}

                {/* Primary Reclaimed Cashflow Preview */}
                <div className="border-t border-border/40 pt-2 flex justify-between text-xs">
                  <span className="text-muted-foreground">Reclaimed Drift Cashflow:</span>
                  <span className="font-semibold text-emerald-600 dark:text-emerald-400">
                    +{computed.me.cashflow.monthlySideHustleCashflowPln.toLocaleString()} PLN/mo
                  </span>
                </div>
              </div>

              {/* Right Column: Vacation Relax vs. Day-Off Monetization Dial */}
              <div className="rounded-lg border border-border/50 bg-background/50 p-4 space-y-3.5">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-1.5 font-semibold text-xs">
                    <Palmtree className="size-4 text-amber-500" />
                    <span>Vacation Relax vs. Day-Off Monetization Dial</span>
                  </div>
                  <Badge variant="outline" className="text-[11px] font-normal">
                    {primaryMonetization.annualDaysOffPool} Total Days Off / yr
                  </Badge>
                </div>

                <p className="text-[11px] text-muted-foreground leading-relaxed">
                  Total annual pool combines vacation PTO and Polish state holidays. Protect sacred unplug vacation days
                  for trips, and optionally allocate quiet holidays to side projects or billing.
                </p>

                <div className="space-y-2">
                  <div className="flex justify-between text-xs">
                    <span className="font-medium text-emerald-600 dark:text-emerald-400 flex items-center gap-1">
                      <Shield className="size-3" /> Sacred Unplug Vacation: {computed.household.sacredVacationDays} days
                    </span>
                    <span className="font-medium text-blue-600 dark:text-blue-400">
                      Monetized: {computed.household.monetizedDaysOff} days
                    </span>
                  </div>
                  <Slider
                    value={[primaryMonetization.monetizedDaysOff]}
                    min={0}
                    max={20}
                    step={1}
                    onValueChange={([val]) =>
                      handleUpdatePrimary((prev) => ({
                        ...prev,
                        monetizedDaysOff: val,
                        sacredUnplugDays: Math.max(0, prev.annualDaysOffPool - val),
                      }))
                    }
                  />
                  <div className="flex justify-between text-[10px] text-muted-foreground">
                    <span>0 days monetized (100% sacred rest)</span>
                    <span>20 days max</span>
                  </div>
                </div>

                <div className="rounded-md border border-border/50 bg-muted/20 p-2.5 flex items-center justify-between text-xs">
                  <div>
                    <span className="text-muted-foreground block text-[11px]">Day-Off Monetization Yield:</span>
                    <span className="font-semibold text-foreground">
                      +{computed.me.cashflow.dayOffMonetizationAnnualPln.toLocaleString()} PLN / yr
                    </span>
                  </div>
                  <Badge className="bg-primary/10 text-primary border-primary/25 font-semibold text-xs">
                    +{computed.me.cashflow.dayOffMonetizationMonthlyPln.toLocaleString()} PLN / mo
                  </Badge>
                </div>
              </div>
            </div>
          </TabsContent>

          {/* 2. SPOUSE: FREELANCE & FAMILY PET PROJECTS */}
          <TabsContent value="spouse" className="space-y-4">
            {/* Freelance Track */}
            <div className="rounded-lg border border-border/50 bg-background/50 p-4 space-y-3">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <Briefcase className="size-4 text-primary" />
                  <span className="font-semibold text-xs">Part-Time Freelancing &amp; Micro-Services</span>
                </div>
                <Switch
                  checked={spouseOpportunity.freelance.enabled}
                  onCheckedChange={(checked) =>
                    handleUpdateSpouse((prev) => ({
                      ...prev,
                      freelance: { ...prev.freelance, enabled: checked },
                    }))
                  }
                />
              </div>

              {spouseOpportunity.freelance.enabled && (
                <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 pt-1 text-xs">
                  <div className="space-y-1">
                    <Label htmlFor="freelance-rate">Hourly Freelance Rate (PLN/hr):</Label>
                    <Input
                      id="freelance-rate"
                      type="number"
                      value={spouseOpportunity.freelance.hourlyRatePln}
                      onChange={(e) => {
                        const val = Number(e.target.value);
                        handleUpdateSpouse((prev) => ({
                          ...prev,
                          freelance: { ...prev.freelance, hourlyRatePln: val },
                        }));
                      }}
                      className="h-8 text-xs"
                    />
                  </div>
                  <div className="space-y-1">
                    <Label htmlFor="freelance-desc">Service Description:</Label>
                    <Input
                      id="freelance-desc"
                      value={spouseOpportunity.freelance.activeServicesDescription}
                      onChange={(e) => {
                        const val = e.target.value;
                        handleUpdateSpouse((prev) => ({
                          ...prev,
                          freelance: { ...prev.freelance, activeServicesDescription: val },
                        }));
                      }}
                      className="h-8 text-xs"
                    />
                  </div>
                </div>
              )}
            </div>

            {/* Family Pet Projects & Automation Track */}
            <div className="rounded-lg border border-border/50 bg-background/50 p-4 space-y-3">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <div className="flex items-center gap-2">
                  <Rocket className="size-4 text-purple-500" />
                  <div>
                    <span className="font-semibold text-xs block">Family Pet Projects &amp; Automation</span>
                    <span className="text-[11px] text-muted-foreground">
                      Valuing money saved, household hours saved, future revenue, and milestone bounties.
                    </span>
                  </div>
                </div>

                <div className="flex items-center gap-2">
                  <Dialog open={isAddProjectOpen} onOpenChange={setIsAddProjectOpen}>
                    <DialogTrigger asChild>
                      <Button size="sm" variant="outline" className="h-7 gap-1 text-xs">
                        <Plus className="size-3.5" />
                        <span>Add Pet Project</span>
                      </Button>
                    </DialogTrigger>
                    <DialogContent className="sm:max-w-md">
                      <DialogHeader>
                        <DialogTitle className="text-base">Add Family Pet Project</DialogTitle>
                        <DialogDescription className="text-xs">
                          Define a project that saves family money, reduces chore hours, or generates future revenue.
                        </DialogDescription>
                      </DialogHeader>

                      <div className="space-y-3 py-2 text-xs">
                        <div className="space-y-1">
                          <Label htmlFor="proj-title">Project Title:</Label>
                          <Input
                            id="proj-title"
                            placeholder="e.g. Smart Grocery & Pantry Organizer"
                            value={newProject.title}
                            onChange={(e) => setNewProject({ ...newProject, title: e.target.value })}
                            className="h-8 text-xs"
                          />
                        </div>
                        <div className="grid grid-cols-2 gap-2">
                          <div className="space-y-1">
                            <Label htmlFor="proj-savings">Monthly Money Saved (PLN):</Label>
                            <Input
                              id="proj-savings"
                              type="number"
                              value={newProject.monthlyExpenseSavedPln}
                              onChange={(e) =>
                                setNewProject({ ...newProject, monthlyExpenseSavedPln: Number(e.target.value) })
                              }
                              className="h-8 text-xs"
                            />
                          </div>
                          <div className="space-y-1">
                            <Label htmlFor="proj-hours">Weekly Hours Saved (hrs):</Label>
                            <Input
                              id="proj-hours"
                              type="number"
                              value={newProject.weeklyHouseholdHoursSaved}
                              onChange={(e) =>
                                setNewProject({ ...newProject, weeklyHouseholdHoursSaved: Number(e.target.value) })
                              }
                              className="h-8 text-xs"
                            />
                          </div>
                        </div>
                        <div className="grid grid-cols-2 gap-2">
                          <div className="space-y-1">
                            <Label htmlFor="proj-revenue">Projected Future Income (PLN/mo):</Label>
                            <Input
                              id="proj-revenue"
                              type="number"
                              value={newProject.projectedLaunchMonthlyIncomePln}
                              onChange={(e) =>
                                setNewProject({
                                  ...newProject,
                                  projectedLaunchMonthlyIncomePln: Number(e.target.value),
                                })
                              }
                              className="h-8 text-xs"
                            />
                          </div>
                          <div className="space-y-1">
                            <Label htmlFor="proj-bounty">Milestone Bounty (PLN):</Label>
                            <Input
                              id="proj-bounty"
                              type="number"
                              value={newProject.milestoneBountyPln}
                              onChange={(e) =>
                                setNewProject({ ...newProject, milestoneBountyPln: Number(e.target.value) })
                              }
                              className="h-8 text-xs"
                            />
                          </div>
                        </div>
                      </div>

                      <DialogFooter>
                        <Button type="button" size="sm" onClick={handleAddProject} className="h-8 text-xs">
                          Create Project
                        </Button>
                      </DialogFooter>
                    </DialogContent>
                  </Dialog>
                </div>
              </div>

              {/* Project Cards List */}
              <div className="grid grid-cols-1 gap-2.5 sm:grid-cols-2">
                {config.petProjects.map((project) => (
                  <div
                    key={project.id}
                    className="rounded-lg border border-border/50 bg-muted/10 p-3 space-y-2 text-xs flex flex-col justify-between"
                  >
                    <div>
                      <div className="flex items-start justify-between gap-1">
                        <span className="font-semibold text-foreground">{project.title}</span>
                        <Button
                          variant="ghost"
                          size="icon"
                          onClick={() => handleDeleteProject(project.id)}
                          className="size-6 text-muted-foreground hover:text-destructive"
                        >
                          <Trash2 className="size-3" />
                        </Button>
                      </div>
                      <p className="text-[11px] text-muted-foreground">{project.description}</p>
                    </div>

                    <div className="grid grid-cols-2 gap-1.5 py-1 text-[11px]">
                      {project.monthlyExpenseSavedPln > 0 && (
                        <div className="flex justify-between bg-background/60 p-1 rounded border border-border/30">
                          <span className="text-muted-foreground">Saves:</span>
                          <span className="font-medium text-emerald-600 dark:text-emerald-400">
                            +{project.monthlyExpenseSavedPln} PLN/mo
                          </span>
                        </div>
                      )}
                      {project.weeklyHouseholdHoursSaved > 0 && (
                        <div className="flex justify-between bg-background/60 p-1 rounded border border-border/30">
                          <span className="text-muted-foreground">Frees:</span>
                          <span className="font-medium text-blue-600 dark:text-blue-400">
                            +{project.weeklyHouseholdHoursSaved}h / week
                          </span>
                        </div>
                      )}
                      {project.projectedLaunchMonthlyIncomePln > 0 && (
                        <div className="flex justify-between bg-background/60 p-1 rounded border border-border/30">
                          <span className="text-muted-foreground">Future Rev:</span>
                          <span className="font-medium text-purple-600 dark:text-purple-400">
                            +{project.projectedLaunchMonthlyIncomePln} PLN/mo
                          </span>
                        </div>
                      )}
                    </div>

                    <div className="flex items-center justify-between border-t border-border/40 pt-1.5 text-[11px]">
                      <button
                        type="button"
                        onClick={() => handleToggleProjectMilestone(project.id)}
                        className={`flex items-center gap-1 font-medium transition-colors ${
                          project.milestoneCompleted
                            ? "text-emerald-600 dark:text-emerald-400"
                            : "text-muted-foreground hover:text-foreground"
                        }`}
                      >
                        <CheckCircle2 className="size-3.5" />
                        <span>{project.milestoneCompleted ? "Bounty Claimed!" : "Claim Milestone Bounty"}</span>
                      </button>
                      <Badge variant="outline" className="text-[10px]">
                        +{project.milestoneBountyPln} PLN
                      </Badge>
                    </div>
                  </div>
                ))}
              </div>

              {/* Total Spouse Compound Value Badge */}
              <div className="rounded-md border border-purple-500/20 bg-purple-500/5 p-2.5 flex flex-wrap items-center justify-between gap-2 text-xs">
                <div className="flex items-center gap-1.5">
                  <Sparkles className="size-4 text-purple-600 dark:text-purple-400" />
                  <span className="font-medium">Total Spouse Monthly Opportunity Value:</span>
                </div>
                <span className="font-bold text-foreground">
                  +{computed.household.totalSpouseMonthlyValuePln.toLocaleString()} PLN / mo
                </span>
              </div>
            </div>
          </TabsContent>
        </Tabs>
      </CardContent>
    </Card>
  );
}
