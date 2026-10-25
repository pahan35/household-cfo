"use client";

import { useEffect, useState } from "react";

import {
  Briefcase,
  Calendar,
  Check,
  Coins,
  DollarSign,
  HeartPulse,
  Layers,
  Plus,
  Scale,
  Sparkles,
  Trash2,
  TrendingUp,
} from "lucide-react";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Sheet, SheetContent, SheetDescription, SheetFooter, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { Slider } from "@/components/ui/slider";
import { Switch } from "@/components/ui/switch";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";

import type { BenefitCeilingsSummary } from "./benefit-matcher";
import type {
  BenefitCategory,
  BenefitCoverageTier,
  BenefitItem,
  ComparatorGlobalConfig,
  EquityGrant,
  EquityType,
  OfferRevision,
  OfferTrack,
  OfferTrackStatus,
  RatePeriod,
  SideGigAddon,
  TaxProfile,
  TaxRegime,
  TimeOffModelType,
  TimeOffPolicy,
  ZusStage,
} from "./offer-types";

export interface OfferRevisionSheetProps {
  isOpen: boolean;
  onOpenChange: (open: boolean) => void;
  track: OfferTrack | null;
  revision: OfferRevision | null;
  isNewTrack?: boolean;
  ceilings?: BenefitCeilingsSummary;
  onSave: (track: OfferTrack, revision: OfferRevision) => void;
  config: ComparatorGlobalConfig;
  liveRates?: Record<string, number>;
}

export function OfferRevisionSheet({
  isOpen,
  onOpenChange,
  track,
  revision,
  isNewTrack = false,
  ceilings,
  onSave,
  config,
  liveRates = {},
}: OfferRevisionSheetProps) {
  // Track fields
  const [companyName, setCompanyName] = useState("");
  const [roleTitle, setRoleTitle] = useState("");
  const [status, setStatus] = useState<OfferTrackStatus>("negotiating");

  // Revision fields
  const [revisionTitle, setRevisionTitle] = useState("");
  const [effectiveDate, setEffectiveDate] = useState("2025-01");
  const [ratePeriod, setRatePeriod] = useState<RatePeriod>("monthly");
  const [rateAmount, setRateAmount] = useState<number>(20000);
  const [currency, setCurrency] = useState("PLN");
  const [expectedWeeklyHours, setExpectedWeeklyHours] = useState(40);
  const [allowsSideGig, setAllowsSideGig] = useState(true);

  // Time-Off fields
  const [timeOffModel, setTimeOffModel] = useState<TimeOffModelType>("model_b_combined");
  const [paidVacationDays, setPaidVacationDays] = useState(26);
  const [paidSickDays, setPaidSickDays] = useState(5);
  const [sickPayPct, setSickPayPct] = useState(80);
  const [combinedPtoDays, setCombinedPtoDays] = useState(26);
  const [holidaysDeducted, setHolidaysDeducted] = useState(false);
  const [plannedVacationDays, setPlannedVacationDays] = useState(24);
  const [estimatedSickDays, setEstimatedSickDays] = useState(5);

  // Tax Profile fields
  const [taxRegime, setTaxRegime] = useState<TaxRegime>("b2b_ryczalt");
  const [ryczaltRatePct, setRyczaltRatePct] = useState(12);
  const [zusStage, setZusStage] = useState<ZusStage>("duzy_zus");
  const [accountingCostPln, setAccountingCostPln] = useState(250);
  const [voluntarySickness, setVoluntarySickness] = useState(true);

  // PFRON rebate
  const [pfronEnabled, setPfronEnabled] = useState(false);
  const [pfronPct, setPfronPct] = useState(60);

  // UoP fields
  const [uopAkup, setUopAkup] = useState(true);
  const [uopCreativeWorkPct, setUopCreativeWorkPct] = useState(80);
  const [uopPpkEmployeePct, setUopPpkEmployeePct] = useState(2);
  const [uopPpkEmployerPct, setUopPpkEmployerPct] = useState(1.5);
  const [uopDisability, setUopDisability] = useState(false);

  // Benefits & Equity
  const [benefits, setBenefits] = useState<BenefitItem[]>([]);
  const [equityGrants, setEquityGrants] = useState<EquityGrant[]>([]);

  // Side-Gig Addon
  const [sideGigEnabled, setSideGigEnabled] = useState(false);
  const [sideGigRole, setSideGigRole] = useState("Technical Advisor / Consulting");
  const [sideGigAmount, setSideGigAmount] = useState(150);
  const [sideGigCurrency, setSideGigCurrency] = useState("PLN");
  const [sideGigHours, setSideGigHours] = useState(10);

  // Synchronize internal state when modal opens
  useEffect(() => {
    if (!isOpen) return;

    if (track) {
      setCompanyName(track.companyName);
      setRoleTitle(track.roleTitle);
      setStatus(track.status);
    } else {
      setCompanyName("New Company");
      setRoleTitle("Senior Engineer");
      setStatus("negotiating");
    }

    if (revision) {
      setRevisionTitle(revision.title);
      setEffectiveDate(revision.effectiveDate || "2025-01");
      setRatePeriod(revision.rateSpec.period);
      setRateAmount(revision.rateSpec.amount);
      setCurrency(revision.rateSpec.currency);
      setExpectedWeeklyHours(revision.expectedWeeklyHours || 40);
      setAllowsSideGig(revision.allowsSideGig ?? true);

      // Time off
      setTimeOffModel(revision.timeOff.model);
      if (revision.timeOff.model === "model_a_separate") {
        setPaidVacationDays(revision.timeOff.paidVacationDays);
        setPaidSickDays(revision.timeOff.paidSickDays);
        setSickPayPct(revision.timeOff.sickPayPct);
      } else if (revision.timeOff.model === "model_b_combined") {
        setCombinedPtoDays(revision.timeOff.combinedPtoDays);
        setHolidaysDeducted(revision.timeOff.stateHolidaysDeductedFromPool);
      } else {
        setPlannedVacationDays(revision.timeOff.plannedVacationDays);
        setEstimatedSickDays(revision.timeOff.estimatedSickDays);
      }

      // Tax profile
      setTaxRegime(revision.taxProfile.regime);
      if (revision.taxProfile.regime === "b2b_ryczalt") {
        setRyczaltRatePct(revision.taxProfile.ryczaltRatePct);
        setZusStage(revision.taxProfile.zusStage);
        setAccountingCostPln(revision.taxProfile.monthlyAccountingCostPln);
        setVoluntarySickness(revision.taxProfile.voluntarySickness);
        setPfronEnabled(revision.taxProfile.pfronRebate.enabled);
        setPfronPct(revision.taxProfile.pfronRebate.percentage || 60);
      } else if (revision.taxProfile.regime === "uop") {
        setUopAkup(revision.taxProfile.hasAkup);
        setUopCreativeWorkPct(revision.taxProfile.creativeWorkPct);
        setUopPpkEmployeePct(revision.taxProfile.ppkEmployeePct);
        setUopPpkEmployerPct(revision.taxProfile.ppkEmployerPct);
        setUopDisability(revision.taxProfile.disabilityRights?.enabled || false);
      }

      setBenefits(revision.benefits || []);
      setEquityGrants(revision.equityGrants || []);

      if (revision.sideGig) {
        setSideGigEnabled(revision.sideGig.enabled);
        setSideGigRole(revision.sideGig.roleTitle);
        setSideGigAmount(revision.sideGig.rateSpec.amount);
        setSideGigCurrency(revision.sideGig.rateSpec.currency);
        setSideGigHours(revision.sideGig.hoursPerWeek);
      } else {
        setSideGigEnabled(false);
      }
    } else {
      // Default new revision
      setRevisionTitle("Rev 1: Initial Offer");
      setEffectiveDate("2025-01");
      setRatePeriod("monthly");
      setRateAmount(22000);
      setCurrency("PLN");
      setBenefits([]);
      setEquityGrants([]);
      setSideGigEnabled(false);
    }
  }, [isOpen, track, revision]);

  const handleAddBenefit = () => {
    const newBen: BenefitItem = {
      id: `ben-${Date.now()}`,
      name: "Private Health Package",
      category: "health",
      nominalValuePln: 350,
      monthlyBudgetOffsetPln: ceilings?.breakdowns.health.coveredPrimaryMonthlyPln || 250,
      subjectiveUtilityWeightPct: 20,
      tier: "family",
      spouseCopayMonthlyPln: 0,
      linkedExternalProviderCategory: "Medicine",
    };
    setBenefits([...benefits, newBen]);
  };

  const handleRemoveBenefit = (id: string) => {
    setBenefits(benefits.filter((b) => b.id !== id));
  };

  const handleAddEquity = () => {
    const newEq: EquityGrant = {
      id: `eq-${Date.now()}`,
      type: "rsu",
      isLiquid: true,
      totalGrantValue: 20000,
      currency: "USD",
      vestingYears: 4,
      cliffMonths: 12,
      volatilityDiscountPct: 15,
      belkaTaxPct: 19,
    };
    setEquityGrants([...equityGrants, newEq]);
  };

  const handleRemoveEquity = (id: string) => {
    setEquityGrants(equityGrants.filter((e) => e.id !== id));
  };

  const handleSave = () => {
    const trackId = track?.id ?? `track-${Date.now()}`;
    const revId = revision?.id ?? `rev-${Date.now()}`;

    // Construct time-off policy
    let timeOff: TimeOffPolicy;
    if (timeOffModel === "model_a_separate") {
      timeOff = {
        model: "model_a_separate",
        paidVacationDays,
        paidSickDays,
        sickPayPct,
        paidStateHolidays: config.defaultStateHolidaysCount || 13,
      };
    } else if (timeOffModel === "model_b_combined") {
      timeOff = {
        model: "model_b_combined",
        combinedPtoDays,
        stateHolidaysDeductedFromPool: holidaysDeducted,
        paidStateHolidaysCount: config.defaultStateHolidaysCount || 13,
      };
    } else {
      timeOff = {
        model: "model_c_unpaid",
        plannedVacationDays,
        estimatedSickDays,
        stateHolidaysTaken: config.defaultStateHolidaysCount || 13,
      };
    }

    // Construct tax profile
    let taxProfile: TaxProfile;
    if (taxRegime === "b2b_ryczalt") {
      taxProfile = {
        regime: "b2b_ryczalt",
        ryczaltRatePct,
        zusStage,
        monthlyAccountingCostPln: accountingCostPln,
        voluntarySickness,
        pfronRebate: {
          enabled: pfronEnabled,
          type: "percentage",
          percentage: pfronPct,
          fixedAmountPln: 0,
        },
      };
    } else if (taxRegime === "uop") {
      taxProfile = {
        regime: "uop",
        hasAkup: uopAkup,
        creativeWorkPct: uopCreativeWorkPct,
        ppkEmployeePct: uopPpkEmployeePct,
        ppkEmployerPct: uopPpkEmployerPct,
        jointTaxFiling: false,
        disabilityRights: {
          enabled: uopDisability,
          statutoryHoursPerWeek: 35,
          extraVacationDays: 10,
        },
      };
    } else if (taxRegime === "b2b_liniowy") {
      taxProfile = {
        regime: "b2b_liniowy",
        pitRatePct: 19,
        healthRatePct: 4.9,
        monthlyDeductibleCostsPln: 500,
        monthlyAccountingCostPln: accountingCostPln,
        zusStage,
        voluntarySickness,
        pfronRebate: { enabled: pfronEnabled, type: "percentage", percentage: pfronPct, fixedAmountPln: 0 },
      };
    } else if (taxRegime === "b2b_skala") {
      taxProfile = {
        regime: "b2b_skala",
        monthlyDeductibleCostsPln: 500,
        monthlyAccountingCostPln: accountingCostPln,
        zusStage,
        voluntarySickness,
        pfronRebate: { enabled: pfronEnabled, type: "percentage", percentage: pfronPct, fixedAmountPln: 0 },
      };
    } else {
      taxProfile = {
        regime: "custom",
        effectiveTaxRatePct: 20,
        staticMonthlyCostPln: 500,
      };
    }

    // Side gig
    let sideGig: SideGigAddon | undefined;
    if (sideGigEnabled) {
      sideGig = {
        enabled: true,
        roleTitle: sideGigRole,
        rateSpec: { period: "hourly", amount: sideGigAmount, currency: sideGigCurrency },
        hoursPerWeek: sideGigHours,
        taxProfile: {
          regime: "b2b_ryczalt",
          ryczaltRatePct: 12,
          zusStage: "duzy_zus",
          monthlyAccountingCostPln: 0,
          voluntarySickness: false,
          pfronRebate: { enabled: false, type: "percentage", percentage: 0, fixedAmountPln: 0 },
        },
      };
    }

    const savedRevision: OfferRevision = {
      id: revId,
      trackId,
      title: revisionTitle,
      effectiveDate,
      rateSpec: { period: ratePeriod, amount: rateAmount, currency },
      timeOff,
      taxProfile,
      benefits,
      equityGrants,
      sideGig,
      expectedWeeklyHours,
      allowsSideGig,
      createdAt: revision?.createdAt ?? new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };

    const existingRevisions = track?.revisions ?? [];
    const revIndex = existingRevisions.findIndex((r) => r.id === revId);
    let updatedRevisions: OfferRevision[];

    if (revIndex >= 0) {
      updatedRevisions = [...existingRevisions];
      updatedRevisions[revIndex] = savedRevision;
    } else {
      updatedRevisions = [...existingRevisions, savedRevision];
    }

    const savedTrack: OfferTrack = {
      id: trackId,
      companyName,
      roleTitle,
      status,
      activeRevisionId: revId,
      revisions: updatedRevisions,
      createdAt: track?.createdAt ?? new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };

    onSave(savedTrack, savedRevision);
    onOpenChange(false);
  };

  return (
    <Sheet open={isOpen} onOpenChange={onOpenChange}>
      <SheetContent className="w-full sm:max-w-xl md:max-w-2xl overflow-y-auto">
        <SheetHeader className="pb-2 border-b">
          <div className="flex items-center gap-2">
            <Scale className="size-5 text-primary" />
            <SheetTitle className="text-base font-semibold">
              {isNewTrack ? "Create New Offer Track" : revision ? `Edit ${revision.title}` : "New Offer Revision"}
            </SheetTitle>
          </div>
          <SheetDescription className="text-xs">
            Configure rates, Polish tax regime, time-off model, benefits, and side-gig capacity.
          </SheetDescription>
        </SheetHeader>

        <Tabs defaultValue="rate" className="mt-4">
          <TabsList className="grid w-full grid-cols-4 h-9 text-xs">
            <TabsTrigger value="rate">Rate &amp; Role</TabsTrigger>
            <TabsTrigger value="timeoff">Time-Off</TabsTrigger>
            <TabsTrigger value="tax">Tax &amp; ZUS</TabsTrigger>
            <TabsTrigger value="benefits">Benefits &amp; Perks</TabsTrigger>
          </TabsList>

          {/* TAB 1: Rate & Role */}
          <TabsContent value="rate" className="space-y-4 pt-3 text-xs">
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <Label className="text-xs font-medium">Company / Employer</Label>
                <Input
                  value={companyName}
                  onChange={(e) => setCompanyName(e.target.value)}
                  className="h-8 text-xs"
                  placeholder="e.g. Acme Corp"
                />
              </div>

              <div className="space-y-1.5">
                <Label className="text-xs font-medium">Role Title</Label>
                <Input
                  value={roleTitle}
                  onChange={(e) => setRoleTitle(e.target.value)}
                  className="h-8 text-xs"
                  placeholder="e.g. Staff Software Engineer"
                />
              </div>
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <Label className="text-xs font-medium">Revision Label</Label>
                <Input
                  value={revisionTitle}
                  onChange={(e) => setRevisionTitle(e.target.value)}
                  className="h-8 text-xs"
                  placeholder="e.g. Rev 1: Initial Offer"
                />
              </div>

              <div className="space-y-1.5">
                <Label className="text-xs font-medium">Effective Date (YYYY-MM)</Label>
                <Input
                  value={effectiveDate}
                  onChange={(e) => setEffectiveDate(e.target.value)}
                  className="h-8 text-xs font-mono"
                  placeholder="2025-01"
                />
              </div>
            </div>

            <div className="rounded-lg border bg-muted/20 p-3 space-y-3">
              <span className="font-semibold text-foreground text-xs block">Base Compensation</span>
              <div className="grid grid-cols-3 gap-2.5">
                <div className="space-y-1.5">
                  <Label className="text-[11px] text-muted-foreground">Period</Label>
                  <Select value={ratePeriod} onValueChange={(v: RatePeriod) => setRatePeriod(v)}>
                    <SelectTrigger className="h-8 text-xs">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="hourly">Hourly</SelectItem>
                      <SelectItem value="monthly">Monthly</SelectItem>
                      <SelectItem value="annual">Annual</SelectItem>
                    </SelectContent>
                  </Select>
                </div>

                <div className="space-y-1.5">
                  <Label className="text-[11px] text-muted-foreground">Gross Amount</Label>
                  <Input
                    type="number"
                    value={rateAmount || ""}
                    onChange={(e) => setRateAmount(parseFloat(e.target.value) || 0)}
                    className="h-8 text-xs font-mono"
                  />
                </div>

                <div className="space-y-1.5">
                  <Label className="text-[11px] text-muted-foreground">Currency</Label>
                  <Select value={currency} onValueChange={(v) => setCurrency(v)}>
                    <SelectTrigger className="h-8 text-xs font-mono font-semibold">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="PLN">PLN (Base)</SelectItem>
                      <SelectItem value="USD">USD (Buffered)</SelectItem>
                      <SelectItem value="EUR">EUR (Buffered)</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>
            </div>

            <div className="grid grid-cols-2 gap-3 pt-1">
              <div className="space-y-1.5">
                <Label className="text-xs font-medium">Expected Weekly Working Hours</Label>
                <Input
                  type="number"
                  value={expectedWeeklyHours}
                  onChange={(e) => setExpectedWeeklyHours(parseInt(e.target.value, 10) || 40)}
                  className="h-8 text-xs font-mono"
                />
              </div>

              <div className="flex items-center justify-between rounded-lg border p-2.5">
                <div className="flex flex-col">
                  <span className="font-medium text-xs">Allows Side-Gig</span>
                  <span className="text-[10px] text-muted-foreground">No strict exclusivity</span>
                </div>
                <Switch checked={allowsSideGig} onCheckedChange={setAllowsSideGig} />
              </div>
            </div>
          </TabsContent>

          {/* TAB 2: Time-Off */}
          <TabsContent value="timeoff" className="space-y-4 pt-3 text-xs">
            <div className="space-y-1.5">
              <Label className="text-xs font-medium">Time-Off Model</Label>
              <Select value={timeOffModel} onValueChange={(v: TimeOffModelType) => setTimeOffModel(v)}>
                <SelectTrigger className="h-8 text-xs">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="model_a_separate">Model A (Separate Vacation &amp; Sick Pools)</SelectItem>
                  <SelectItem value="model_b_combined">Model B (Combined Paid PTO Pool)</SelectItem>
                  <SelectItem value="model_c_unpaid">Model C (Unpaid / Pure Hourly B2B)</SelectItem>
                </SelectContent>
              </Select>
            </div>

            {timeOffModel === "model_a_separate" && (
              <div className="rounded-lg border bg-muted/20 p-3 space-y-3">
                <div className="grid grid-cols-3 gap-2.5">
                  <div className="space-y-1.5">
                    <Label className="text-[11px] text-muted-foreground">Paid Vacation Days</Label>
                    <Input
                      type="number"
                      value={paidVacationDays}
                      onChange={(e) => setPaidVacationDays(parseInt(e.target.value, 10) || 0)}
                      className="h-8 text-xs font-mono"
                    />
                  </div>
                  <div className="space-y-1.5">
                    <Label className="text-[11px] text-muted-foreground">Paid Sick Days</Label>
                    <Input
                      type="number"
                      value={paidSickDays}
                      onChange={(e) => setPaidSickDays(parseInt(e.target.value, 10) || 0)}
                      className="h-8 text-xs font-mono"
                    />
                  </div>
                  <div className="space-y-1.5">
                    <Label className="text-[11px] text-muted-foreground">Sick Pay %</Label>
                    <Input
                      type="number"
                      value={sickPayPct}
                      onChange={(e) => setSickPayPct(parseInt(e.target.value, 10) || 0)}
                      className="h-8 text-xs font-mono"
                    />
                  </div>
                </div>
              </div>
            )}

            {timeOffModel === "model_b_combined" && (
              <div className="rounded-lg border bg-muted/20 p-3 space-y-3">
                <div className="space-y-1.5">
                  <Label className="text-[11px] text-muted-foreground">Combined Annual Paid PTO Days</Label>
                  <Input
                    type="number"
                    value={combinedPtoDays}
                    onChange={(e) => setCombinedPtoDays(parseInt(e.target.value, 10) || 0)}
                    className="h-8 text-xs font-mono"
                  />
                </div>
                <div className="flex items-center justify-between border-t pt-2">
                  <div className="flex flex-col">
                    <span className="font-medium text-xs">Deduct State Holidays from Pool</span>
                    <span className="text-[10px] text-muted-foreground">
                      If true, 13 public holidays reduce the {combinedPtoDays}-day pool
                    </span>
                  </div>
                  <Switch checked={holidaysDeducted} onCheckedChange={setHolidaysDeducted} />
                </div>
              </div>
            )}

            {timeOffModel === "model_c_unpaid" && (
              <div className="rounded-lg border bg-muted/20 p-3 space-y-3">
                <div className="grid grid-cols-2 gap-2.5">
                  <div className="space-y-1.5">
                    <Label className="text-[11px] text-muted-foreground">Planned Vacation Days Off</Label>
                    <Input
                      type="number"
                      value={plannedVacationDays}
                      onChange={(e) => setPlannedVacationDays(parseInt(e.target.value, 10) || 0)}
                      className="h-8 text-xs font-mono"
                    />
                  </div>
                  <div className="space-y-1.5">
                    <Label className="text-[11px] text-muted-foreground">Estimated Unpaid Sick Days</Label>
                    <Input
                      type="number"
                      value={estimatedSickDays}
                      onChange={(e) => setEstimatedSickDays(parseInt(e.target.value, 10) || 0)}
                      className="h-8 text-xs font-mono"
                    />
                  </div>
                </div>
                <span className="text-[11px] text-muted-foreground block">
                  Total unpaid non-working days directly reduce annual billable hours (252 -{" "}
                  {plannedVacationDays + estimatedSickDays + 13} ={" "}
                  {252 - (plannedVacationDays + estimatedSickDays + 13)} days).
                </span>
              </div>
            )}
          </TabsContent>

          {/* TAB 3: Tax & ZUS */}
          <TabsContent value="tax" className="space-y-4 pt-3 text-xs">
            <div className="space-y-1.5">
              <Label className="text-xs font-medium">Tax &amp; Employment Regime</Label>
              <Select value={taxRegime} onValueChange={(v: TaxRegime) => setTaxRegime(v)}>
                <SelectTrigger className="h-8 text-xs">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="b2b_ryczalt">B2B Ryczałt (Lump Sum 12%/8.5%)</SelectItem>
                  <SelectItem value="b2b_liniowy">B2B Podatek Liniowy (19% + 4.9%)</SelectItem>
                  <SelectItem value="b2b_skala">B2B Skala Podatkowa (12%/32% + 9%)</SelectItem>
                  <SelectItem value="uop">Umowa o Pracę (UoP with AKUP/PPK)</SelectItem>
                  <SelectItem value="custom">Custom Percentage + Static Cost</SelectItem>
                </SelectContent>
              </Select>
            </div>

            {taxRegime === "b2b_ryczalt" && (
              <div className="rounded-lg border bg-muted/20 p-3 space-y-3">
                <div className="grid grid-cols-2 gap-3">
                  <div className="space-y-1.5">
                    <Label className="text-[11px] text-muted-foreground">Ryczałt Tax Rate %</Label>
                    <Select value={String(ryczaltRatePct)} onValueChange={(v) => setRyczaltRatePct(parseFloat(v))}>
                      <SelectTrigger className="h-8 text-xs font-mono">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="8.5">8.5% (Services / Low)</SelectItem>
                        <SelectItem value="12">12% (IT &amp; Programming Standard)</SelectItem>
                        <SelectItem value="15">15% (Management / Consulting)</SelectItem>
                        <SelectItem value="17">17% (Specialist / High)</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>

                  <div className="space-y-1.5">
                    <Label className="text-[11px] text-muted-foreground">ZUS Stage</Label>
                    <Select value={zusStage} onValueChange={(v: ZusStage) => setZusStage(v)}>
                      <SelectTrigger className="h-8 text-xs">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="ulga_na_start">Ulga na start (0 ZUS)</SelectItem>
                        <SelectItem value="preferencyjny">Preferencyjny ZUS (~400 PLN)</SelectItem>
                        <SelectItem value="duzy_zus">Duży ZUS (~1,600 PLN)</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-3">
                  <div className="space-y-1.5">
                    <Label className="text-[11px] text-muted-foreground">Monthly Accounting (PLN)</Label>
                    <Input
                      type="number"
                      value={accountingCostPln}
                      onChange={(e) => setAccountingCostPln(parseFloat(e.target.value) || 0)}
                      className="h-8 text-xs font-mono"
                    />
                  </div>

                  <div className="flex items-center justify-between border rounded-lg p-2">
                    <div className="flex flex-col">
                      <span className="font-medium text-[11px]">Voluntary Sickness</span>
                      <span className="text-[9px] text-muted-foreground">Chorobowe (2.45%)</span>
                    </div>
                    <Switch checked={voluntarySickness} onCheckedChange={setVoluntarySickness} />
                  </div>
                </div>

                {/* PFRON Rebate */}
                <div className="border-t pt-2 space-y-2">
                  <div className="flex items-center justify-between">
                    <div className="flex flex-col">
                      <span className="font-medium text-xs">PFRON ZUS Cashback Rebate</span>
                      <span className="text-[10px] text-muted-foreground">
                        Reimbursement of pension &amp; disability ZUS contributions
                      </span>
                    </div>
                    <Switch checked={pfronEnabled} onCheckedChange={setPfronEnabled} />
                  </div>

                  {pfronEnabled && (
                    <div className="flex items-center gap-3">
                      <Slider
                        value={[pfronPct]}
                        min={0}
                        max={100}
                        step={10}
                        onValueChange={(val) => setPfronPct(val[0] ?? 60)}
                        className="flex-1"
                      />
                      <span className="w-12 text-right font-mono font-medium">{pfronPct}%</span>
                    </div>
                  )}
                </div>
              </div>
            )}

            {taxRegime === "uop" && (
              <div className="rounded-lg border bg-muted/20 p-3 space-y-3">
                <div className="flex items-center justify-between">
                  <div className="flex flex-col">
                    <span className="font-medium text-xs">50% AKUP (Author's Copyright Deduction)</span>
                    <span className="text-[10px] text-muted-foreground">Capped at 120,000 PLN deduction per year</span>
                  </div>
                  <Switch checked={uopAkup} onCheckedChange={setUopAkup} />
                </div>

                {uopAkup && (
                  <div className="space-y-1.5 border-t pt-2">
                    <div className="flex justify-between text-[11px]">
                      <span className="text-muted-foreground">Creative Copyright Salary Share:</span>
                      <span className="font-mono font-medium">{uopCreativeWorkPct}%</span>
                    </div>
                    <Slider
                      value={[uopCreativeWorkPct]}
                      min={0}
                      max={100}
                      step={5}
                      onValueChange={(val) => setUopCreativeWorkPct(val[0] ?? 80)}
                    />
                  </div>
                )}

                <div className="grid grid-cols-2 gap-3 border-t pt-2">
                  <div className="space-y-1">
                    <Label className="text-[11px] text-muted-foreground">Employee PPK %</Label>
                    <Input
                      type="number"
                      step="0.5"
                      value={uopPpkEmployeePct}
                      onChange={(e) => setUopPpkEmployeePct(parseFloat(e.target.value) || 0)}
                      className="h-8 text-xs font-mono"
                    />
                  </div>

                  <div className="space-y-1">
                    <Label className="text-[11px] text-muted-foreground">Employer PPK %</Label>
                    <Input
                      type="number"
                      step="0.5"
                      value={uopPpkEmployerPct}
                      onChange={(e) => setUopPpkEmployerPct(parseFloat(e.target.value) || 0)}
                      className="h-8 text-xs font-mono"
                    />
                  </div>
                </div>

                <div className="flex items-center justify-between border-t pt-2">
                  <div className="flex flex-col">
                    <span className="font-medium text-xs">Statutory Disability Rights (UoP)</span>
                    <span className="text-[10px] text-muted-foreground">
                      35h/week (7h/day) norm + 10 extra paid vacation days
                    </span>
                  </div>
                  <Switch checked={uopDisability} onCheckedChange={setUopDisability} />
                </div>
              </div>
            )}
          </TabsContent>

          {/* TAB 4: Benefits & Perks */}
          <TabsContent value="benefits" className="space-y-4 pt-3 text-xs">
            {/* Benefits List */}
            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <span className="font-semibold text-foreground text-xs">Non-Cash Benefits &amp; Insurance</span>
                <Button variant="outline" size="sm" onClick={handleAddBenefit} className="h-7 gap-1 text-[11px]">
                  <Plus className="size-3" />
                  <span>Add Benefit</span>
                </Button>
              </div>

              {benefits.length === 0 ? (
                <div className="rounded-lg border border-dashed p-4 text-center text-muted-foreground text-xs">
                  No modular benefits attached. Click "Add Benefit" to model health, sports, or learning perks.
                </div>
              ) : (
                <div className="space-y-2">
                  {benefits.map((b) => (
                    <div key={b.id} className="rounded-lg border bg-card p-3 space-y-2 text-xs">
                      <div className="flex items-center justify-between">
                        <Input
                          value={b.name}
                          onChange={(e) => {
                            const updated = benefits.map((item) =>
                              item.id === b.id ? { ...item, name: e.target.value } : item,
                            );
                            setBenefits(updated);
                          }}
                          className="h-7 text-xs font-medium max-w-[240px]"
                        />
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => handleRemoveBenefit(b.id)}
                          className="h-7 w-7 p-0 text-muted-foreground hover:text-destructive"
                        >
                          <Trash2 className="size-3.5" />
                        </Button>
                      </div>

                      <div className="grid grid-cols-3 gap-2">
                        <div>
                          <Label className="text-[10px] text-muted-foreground">Nominal Value (PLN)</Label>
                          <Input
                            type="number"
                            value={b.nominalValuePln || ""}
                            onChange={(e) => {
                              const val = parseFloat(e.target.value) || 0;
                              setBenefits(
                                benefits.map((item) => (item.id === b.id ? { ...item, nominalValuePln: val } : item)),
                              );
                            }}
                            className="h-7 text-xs font-mono"
                          />
                        </div>

                        <div>
                          <Label className="text-[10px] text-emerald-600 dark:text-emerald-400 font-medium">
                            Layer 1 Budget Offset (PLN)
                          </Label>
                          <Input
                            type="number"
                            value={b.monthlyBudgetOffsetPln || ""}
                            onChange={(e) => {
                              const val = parseFloat(e.target.value) || 0;
                              setBenefits(
                                benefits.map((item) =>
                                  item.id === b.id ? { ...item, monthlyBudgetOffsetPln: val } : item,
                                ),
                              );
                            }}
                            className="h-7 text-xs font-mono"
                          />
                        </div>

                        <div>
                          <Label className="text-[10px] text-muted-foreground">Layer 2 Utility %</Label>
                          <Input
                            type="number"
                            value={b.subjectiveUtilityWeightPct ?? 0}
                            onChange={(e) => {
                              const val = parseInt(e.target.value, 10) || 0;
                              setBenefits(
                                benefits.map((item) =>
                                  item.id === b.id ? { ...item, subjectiveUtilityWeightPct: val } : item,
                                ),
                              );
                            }}
                            className="h-7 text-xs font-mono"
                          />
                        </div>
                      </div>

                      {b.category === "health" && (
                        <div className="grid grid-cols-2 gap-2 border-t pt-2">
                          <div className="space-y-1">
                            <Label className="text-[10px] text-muted-foreground">Coverage Tier</Label>
                            <Select
                              value={b.tier || "individual"}
                              onValueChange={(t: BenefitCoverageTier) => {
                                setBenefits(benefits.map((item) => (item.id === b.id ? { ...item, tier: t } : item)));
                              }}
                            >
                              <SelectTrigger className="h-7 text-xs">
                                <SelectValue />
                              </SelectTrigger>
                              <SelectContent>
                                <SelectItem value="individual">Individual Tier</SelectItem>
                                <SelectItem value="family">Family Tier</SelectItem>
                              </SelectContent>
                            </Select>
                          </div>

                          {b.tier === "individual" && (
                            <div className="space-y-1">
                              <Label className="text-[10px] text-amber-600 dark:text-amber-400">
                                Spouse Add-on Copay (PLN/mo)
                              </Label>
                              <Input
                                type="number"
                                value={b.spouseCopayMonthlyPln || ""}
                                onChange={(e) => {
                                  const val = parseFloat(e.target.value) || 0;
                                  setBenefits(
                                    benefits.map((item) =>
                                      item.id === b.id ? { ...item, spouseCopayMonthlyPln: val } : item,
                                    ),
                                  );
                                }}
                                className="h-7 text-xs font-mono"
                                placeholder="e.g. 220"
                              />
                            </div>
                          )}
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              )}
            </div>

            {/* Equity Grants */}
            <div className="space-y-2 border-t pt-3">
              <div className="flex items-center justify-between">
                <span className="font-semibold text-foreground text-xs">Equity Grants (RSU vs. ESOP)</span>
                <Button variant="outline" size="sm" onClick={handleAddEquity} className="h-7 gap-1 text-[11px]">
                  <Plus className="size-3" />
                  <span>Add Equity</span>
                </Button>
              </div>

              {equityGrants.map((eq) => (
                <div key={eq.id} className="rounded-lg border bg-card p-3 space-y-2 text-xs">
                  <div className="flex items-center justify-between">
                    <Select
                      value={eq.type}
                      onValueChange={(t: EquityType) => {
                        setEquityGrants(
                          equityGrants.map((item) =>
                            item.id === eq.id ? { ...item, type: t, isLiquid: t === "rsu" } : item,
                          ),
                        );
                      }}
                    >
                      <SelectTrigger className="h-7 text-xs max-w-[200px]">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="rsu">Public Liquid RSU</SelectItem>
                        <SelectItem value="esop">Illiquid Startup ESOP</SelectItem>
                      </SelectContent>
                    </Select>

                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => handleRemoveEquity(eq.id)}
                      className="h-7 w-7 p-0 text-muted-foreground hover:text-destructive"
                    >
                      <Trash2 className="size-3.5" />
                    </Button>
                  </div>

                  <div className="grid grid-cols-3 gap-2">
                    <div>
                      <Label className="text-[10px] text-muted-foreground">Grant Value</Label>
                      <Input
                        type="number"
                        value={eq.totalGrantValue || ""}
                        onChange={(e) => {
                          const val = parseFloat(e.target.value) || 0;
                          setEquityGrants(
                            equityGrants.map((item) => (item.id === eq.id ? { ...item, totalGrantValue: val } : item)),
                          );
                        }}
                        className="h-7 text-xs font-mono"
                      />
                    </div>

                    <div>
                      <Label className="text-[10px] text-muted-foreground">Currency</Label>
                      <Select
                        value={eq.currency}
                        onValueChange={(c: "USD" | "PLN" | "EUR") => {
                          setEquityGrants(
                            equityGrants.map((item) => (item.id === eq.id ? { ...item, currency: c } : item)),
                          );
                        }}
                      >
                        <SelectTrigger className="h-7 text-xs font-mono">
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="USD">USD</SelectItem>
                          <SelectItem value="PLN">PLN</SelectItem>
                          <SelectItem value="EUR">EUR</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>

                    <div>
                      <Label className="text-[10px] text-muted-foreground">Vesting Years</Label>
                      <Input
                        type="number"
                        value={eq.vestingYears || 4}
                        onChange={(e) => {
                          const val = parseInt(e.target.value, 10) || 4;
                          setEquityGrants(
                            equityGrants.map((item) => (item.id === eq.id ? { ...item, vestingYears: val } : item)),
                          );
                        }}
                        className="h-7 text-xs font-mono"
                      />
                    </div>
                  </div>
                </div>
              ))}
            </div>

            {/* Side-Gig Addon Slot */}
            <div className="rounded-lg border bg-muted/20 p-3 space-y-2">
              <div className="flex items-center justify-between">
                <div className="flex flex-col">
                  <span className="font-semibold text-xs">Fractional Side-Gig Slot</span>
                  <span className="text-[10px] text-muted-foreground">
                    Simulate adding consulting hours without duplicate ZUS Społeczny
                  </span>
                </div>
                <Switch checked={sideGigEnabled} onCheckedChange={setSideGigEnabled} />
              </div>

              {sideGigEnabled && (
                <div className="grid grid-cols-3 gap-2 border-t pt-2">
                  <div>
                    <Label className="text-[10px] text-muted-foreground">Hourly Rate</Label>
                    <Input
                      type="number"
                      value={sideGigAmount}
                      onChange={(e) => setSideGigAmount(parseFloat(e.target.value) || 0)}
                      className="h-7 text-xs font-mono"
                    />
                  </div>
                  <div>
                    <Label className="text-[10px] text-muted-foreground">Currency</Label>
                    <Select value={sideGigCurrency} onValueChange={setSideGigCurrency}>
                      <SelectTrigger className="h-7 text-xs font-mono">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="PLN">PLN</SelectItem>
                        <SelectItem value="USD">USD</SelectItem>
                        <SelectItem value="EUR">EUR</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                  <div>
                    <Label className="text-[10px] text-muted-foreground">Hours / Week</Label>
                    <Input
                      type="number"
                      value={sideGigHours}
                      onChange={(e) => setSideGigHours(parseInt(e.target.value, 10) || 0)}
                      className="h-7 text-xs font-mono"
                    />
                  </div>
                </div>
              )}
            </div>
          </TabsContent>
        </Tabs>

        <SheetFooter className="mt-6 border-t pt-3">
          <Button variant="outline" size="sm" onClick={() => onOpenChange(false)}>
            Cancel
          </Button>
          <Button size="sm" onClick={handleSave} className="gap-1.5">
            <Check className="size-3.5" />
            <span>Save Offer Revision</span>
          </Button>
        </SheetFooter>
      </SheetContent>
    </Sheet>
  );
}
