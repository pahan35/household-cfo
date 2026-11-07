import "server-only";

import { DEFAULT_COMPARATOR_CONFIG } from "@/app/(main)/dashboard/family-budget/offer-comparator/_components/compensation-engine";
import type {
  ComparatorGlobalConfig,
  OfferRevision,
  OfferTrack,
  OfferTrackStatus,
  RatePeriod,
  SideGigAddon,
  TaxProfile,
  TaxProfileB2bLiniowy,
  TaxProfileB2bRyczalt,
  TaxProfileB2bSkala,
  TaxProfileUop,
  TimeOffModelASeparate,
  TimeOffModelBCombined,
  TimeOffModelCUnpaid,
  TimeOffPolicy,
  ZusStage,
} from "@/app/(main)/dashboard/family-budget/offer-comparator/_components/offer-types";

export type { ComparatorGlobalConfig, OfferRevision, OfferTrack };

export interface OfferTrackRow {
  id: string;
  company: string;
  role: string;
  status: string;
  sort_order: number;
  active_revision_id: string | null;
  notes: string | null;
  created_at: string;
  updated_at: string;
}

export interface OfferRevisionRow {
  id: string;
  track_id: string;
  revision_number: number;
  title: string;
  effective_date: string | null;

  rate_amount: number | string;
  rate_currency: string;
  rate_period: string;

  contract_type: string;
  b2b_tax_regime: string;
  ryczalt_tax_rate_pct: number | string;
  zus_stage: string;
  voluntary_sickness_insurance: boolean;
  pfron_has_certificate: boolean;
  pfron_rebate_pct: number | string;
  monthly_accounting_cost_pln: number | string;
  tax_profile_json?: unknown | null;

  time_off_model: string;
  paid_vacation_days: number | string;
  paid_sick_days: number | string;
  sick_pay_pct: number | string;
  paid_state_holidays: number | string;
  combined_pto_days: number | string;
  state_holidays_deducted_from_pool: boolean;
  pto_rate_markup_pct: number | string;
  time_off_json?: unknown | null;

  real_expected_weekly_hours: number | string;
  allows_side_gig: boolean;

  benefits_json: unknown;
  equity_grants_json: unknown;
  side_gigs_json: unknown;

  notes: string | null;
  created_at: string;
  updated_at: string;
}

export interface OfferComparatorAssumptionsRow {
  id: string;
  fx_pessimistic_buffer_pct: unknown;
  manual_fx_overrides: unknown;
  target_monthly_expense_pln: number | string;
  target_monthly_savings_pln: number | string;
  active_year_projection: number | string;
  default_working_days_per_year?: number | string;
  default_state_holidays_count?: number | string;
  working_hours_per_day?: number | string;
  annual_static_cost_growth_pct?: number | string;
  updated_at: string;
}

export interface OfferStore {
  listTracks(): Promise<OfferTrack[]>;
  getTrack(id: string): Promise<OfferTrack | null>;
  saveTrack(track: OfferTrack): Promise<OfferTrack>;
  deleteTrack(id: string): Promise<boolean>;

  listRevisions(trackId: string): Promise<OfferRevision[]>;
  saveRevision(revision: OfferRevision): Promise<OfferRevision>;
  deleteRevision(trackId: string, revisionId: string): Promise<boolean>;

  getGlobalConfig(): Promise<ComparatorGlobalConfig>;
  saveGlobalConfig(config: ComparatorGlobalConfig): Promise<ComparatorGlobalConfig>;

  loadAll(): Promise<{ tracks: OfferTrack[]; globalConfig: ComparatorGlobalConfig }>;
  saveAll(tracks: OfferTrack[], globalConfig: ComparatorGlobalConfig): Promise<void>;
}

function num(v: number | string | null | undefined, fallback: number): number {
  if (v === null || v === undefined) return fallback;
  const parsed = Number(v);
  return Number.isFinite(parsed) ? parsed : fallback;
}

export function revisionRowToDomain(row: OfferRevisionRow): OfferRevision {
  let taxProfile: TaxProfile;
  if (row.tax_profile_json && typeof row.tax_profile_json === "object") {
    taxProfile = row.tax_profile_json as TaxProfile;
  } else if (row.contract_type === "uop") {
    const uop: TaxProfileUop = {
      regime: "uop",
      hasAkup: false,
      creativeWorkPct: 0,
      ppkEmployeePct: 0.02,
      ppkEmployerPct: 0.015,
      jointTaxFiling: false,
      disabilityRights: {
        enabled: Boolean(row.pfron_has_certificate),
        statutoryHoursPerWeek: 35,
        extraVacationDays: 10,
      },
    };
    taxProfile = uop;
  } else if (row.b2b_tax_regime === "liniowy") {
    const liniowy: TaxProfileB2bLiniowy = {
      regime: "b2b_liniowy",
      pitRatePct: 19,
      healthRatePct: 4.9,
      monthlyDeductibleCostsPln: 0,
      monthlyAccountingCostPln: num(row.monthly_accounting_cost_pln, 300),
      zusStage: (row.zus_stage as ZusStage) || "duzy_zus",
      pfronRebate: {
        enabled: Boolean(row.pfron_has_certificate),
        type: "percentage",
        percentage: num(row.pfron_rebate_pct, 0),
        fixedAmountPln: 0,
      },
      voluntarySickness: Boolean(row.voluntary_sickness_insurance),
    };
    taxProfile = liniowy;
  } else if (row.b2b_tax_regime === "skala") {
    const skala: TaxProfileB2bSkala = {
      regime: "b2b_skala",
      monthlyDeductibleCostsPln: 0,
      monthlyAccountingCostPln: num(row.monthly_accounting_cost_pln, 300),
      zusStage: (row.zus_stage as ZusStage) || "duzy_zus",
      pfronRebate: {
        enabled: Boolean(row.pfron_has_certificate),
        type: "percentage",
        percentage: num(row.pfron_rebate_pct, 0),
        fixedAmountPln: 0,
      },
      voluntarySickness: Boolean(row.voluntary_sickness_insurance),
    };
    taxProfile = skala;
  } else {
    const ryczalt: TaxProfileB2bRyczalt = {
      regime: "b2b_ryczalt",
      ryczaltRatePct: num(row.ryczalt_tax_rate_pct, 12),
      zusStage: (row.zus_stage as ZusStage) || "duzy_zus",
      monthlyAccountingCostPln: num(row.monthly_accounting_cost_pln, 300),
      voluntarySickness: Boolean(row.voluntary_sickness_insurance),
      pfronRebate: {
        enabled: Boolean(row.pfron_has_certificate),
        type: "percentage",
        percentage: num(row.pfron_rebate_pct, 0),
        fixedAmountPln: 0,
      },
    };
    taxProfile = ryczalt;
  }

  let timeOff: TimeOffPolicy;
  if (row.time_off_json && typeof row.time_off_json === "object") {
    timeOff = row.time_off_json as TimeOffPolicy;
  } else if (row.time_off_model === "model_a_separate") {
    const a: TimeOffModelASeparate = {
      model: "model_a_separate",
      paidVacationDays: num(row.paid_vacation_days, 26),
      paidSickDays: num(row.paid_sick_days, 5),
      sickPayPct: num(row.sick_pay_pct, 80),
      paidStateHolidays: num(row.paid_state_holidays, 13),
    };
    timeOff = a;
  } else if (row.time_off_model === "model_c_unpaid") {
    const c: TimeOffModelCUnpaid = {
      model: "model_c_unpaid",
      plannedVacationDays: num(row.paid_vacation_days, 24),
      estimatedSickDays: num(row.paid_sick_days, 5),
      stateHolidaysTaken: num(row.paid_state_holidays, 13),
      ptoRateMarkupPct: num(row.pto_rate_markup_pct, 0),
    };
    timeOff = c;
  } else {
    const b: TimeOffModelBCombined = {
      model: "model_b_combined",
      combinedPtoDays: num(row.combined_pto_days, 26),
      stateHolidaysDeductedFromPool: Boolean(row.state_holidays_deducted_from_pool),
      paidStateHolidaysCount: num(row.paid_state_holidays, 13),
    };
    timeOff = b;
  }

  const benefits = Array.isArray(row.benefits_json) ? row.benefits_json : [];
  const equityGrants = Array.isArray(row.equity_grants_json) ? row.equity_grants_json : [];
  let sideGig: SideGigAddon | undefined;
  if (Array.isArray(row.side_gigs_json) && row.side_gigs_json.length > 0) {
    sideGig = row.side_gigs_json[0] as SideGigAddon;
  } else if (row.side_gigs_json && typeof row.side_gigs_json === "object" && !Array.isArray(row.side_gigs_json)) {
    sideGig = row.side_gigs_json as SideGigAddon;
  }

  return {
    id: row.id,
    trackId: row.track_id,
    title: row.title || "Offer Revision",
    effectiveDate: row.effective_date ?? "",
    rateSpec: {
      period: (row.rate_period as RatePeriod) || "monthly",
      amount: num(row.rate_amount, 0),
      currency: row.rate_currency || "PLN",
    },
    timeOff,
    taxProfile,
    benefits,
    equityGrants,
    sideGig,
    expectedWeeklyHours: num(row.real_expected_weekly_hours, 40),
    allowsSideGig: Boolean(row.allows_side_gig),
    notes: row.notes ?? undefined,
    createdAt: row.created_at || new Date().toISOString(),
    updatedAt: row.updated_at || new Date().toISOString(),
  };
}

export function domainToRevisionRow(rev: OfferRevision, trackId: string, revisionNumber = 1): OfferRevisionRow {
  let contractType = "b2b";
  let b2bTaxRegime = "ryczalt";
  let ryczaltTaxRatePct = 12.0;
  let zusStage = "duzy_zus";
  let voluntarySickness = false;
  let pfronHasCert = false;
  let pfronRebatePct = 0;
  let accountingCostPln = 300.0;

  if (rev.taxProfile) {
    if (
      rev.taxProfile.regime === "b2b_ryczalt" ||
      rev.taxProfile.regime === "b2b_liniowy" ||
      rev.taxProfile.regime === "b2b_skala"
    ) {
      contractType = "b2b";
      b2bTaxRegime = rev.taxProfile.regime.replace("b2b_", "");
      zusStage = rev.taxProfile.zusStage;
      voluntarySickness = Boolean(rev.taxProfile.voluntarySickness);
      pfronHasCert = Boolean(rev.taxProfile.pfronRebate.enabled);
      pfronRebatePct = rev.taxProfile.pfronRebate.percentage;
      accountingCostPln = rev.taxProfile.monthlyAccountingCostPln;
      if (rev.taxProfile.regime === "b2b_ryczalt") {
        ryczaltTaxRatePct = rev.taxProfile.ryczaltRatePct;
      }
    } else if (rev.taxProfile.regime === "uop") {
      contractType = "uop";
      b2bTaxRegime = "uop";
      pfronHasCert = Boolean(rev.taxProfile.disabilityRights.enabled);
      voluntarySickness = true;
      accountingCostPln = 0;
    } else {
      contractType = rev.taxProfile.regime;
      b2bTaxRegime = rev.taxProfile.regime;
    }
  }

  let timeOffModel = "model_b_combined";
  let paidVacationDays = 26;
  let paidSickDays = 5;
  let sickPayPct = 80;
  let paidStateHolidays = 13;
  let combinedPtoDays = 26;
  let stateHolidaysDeducted = false;
  let ptoRateMarkupPct = 0;

  if (rev.timeOff) {
    timeOffModel = rev.timeOff.model;
    if (rev.timeOff.model === "model_a_separate") {
      paidVacationDays = rev.timeOff.paidVacationDays;
      paidSickDays = rev.timeOff.paidSickDays;
      sickPayPct = rev.timeOff.sickPayPct;
      paidStateHolidays = rev.timeOff.paidStateHolidays;
      combinedPtoDays = rev.timeOff.paidVacationDays;
    } else if (rev.timeOff.model === "model_b_combined") {
      combinedPtoDays = rev.timeOff.combinedPtoDays;
      paidVacationDays = rev.timeOff.combinedPtoDays;
      paidSickDays = 0;
      sickPayPct = 100;
      paidStateHolidays = rev.timeOff.paidStateHolidaysCount;
      stateHolidaysDeducted = Boolean(rev.timeOff.stateHolidaysDeductedFromPool);
    } else if (rev.timeOff.model === "model_c_unpaid") {
      paidVacationDays = rev.timeOff.plannedVacationDays;
      paidSickDays = rev.timeOff.estimatedSickDays;
      paidStateHolidays = rev.timeOff.stateHolidaysTaken;
      sickPayPct = 0;
      combinedPtoDays = 0;
      ptoRateMarkupPct = rev.timeOff.ptoRateMarkupPct ?? 0;
    }
  }

  return {
    id: rev.id,
    track_id: rev.trackId || trackId,
    revision_number: revisionNumber,
    title: rev.title || "Offer Revision",
    effective_date: rev.effectiveDate || null,

    rate_amount: rev.rateSpec.amount,
    rate_currency: rev.rateSpec.currency,
    rate_period: rev.rateSpec.period,

    contract_type: contractType,
    b2b_tax_regime: b2bTaxRegime,
    ryczalt_tax_rate_pct: ryczaltTaxRatePct,
    zus_stage: zusStage,
    voluntary_sickness_insurance: voluntarySickness,
    pfron_has_certificate: pfronHasCert,
    pfron_rebate_pct: pfronRebatePct,
    monthly_accounting_cost_pln: accountingCostPln,
    tax_profile_json: rev.taxProfile,

    time_off_model: timeOffModel,
    paid_vacation_days: paidVacationDays,
    paid_sick_days: paidSickDays,
    sick_pay_pct: sickPayPct,
    paid_state_holidays: paidStateHolidays,
    combined_pto_days: combinedPtoDays,
    state_holidays_deducted_from_pool: stateHolidaysDeducted,
    pto_rate_markup_pct: ptoRateMarkupPct,
    time_off_json: rev.timeOff,

    real_expected_weekly_hours: rev.expectedWeeklyHours,
    allows_side_gig: rev.allowsSideGig,

    benefits_json: rev.benefits,
    equity_grants_json: rev.equityGrants,
    side_gigs_json: rev.sideGig ? [rev.sideGig] : [],

    notes: rev.notes ?? null,
    created_at: rev.createdAt || new Date().toISOString(),
    updated_at: rev.updatedAt || new Date().toISOString(),
  };
}

export function trackRowToDomain(row: OfferTrackRow, revisions: OfferRevision[]): OfferTrack {
  const sortedRevisions = [...revisions].sort(
    (a, b) => new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime(),
  );

  const activeRevisionId =
    row.active_revision_id && sortedRevisions.some((r) => r.id === row.active_revision_id)
      ? row.active_revision_id
      : sortedRevisions[sortedRevisions.length - 1]?.id || "";

  return {
    id: row.id,
    companyName: row.company,
    roleTitle: row.role,
    status: (row.status as OfferTrackStatus) || "negotiating",
    revisions: sortedRevisions,
    activeRevisionId,
    notes: row.notes ?? undefined,
    createdAt: row.created_at || new Date().toISOString(),
    updatedAt: row.updated_at || new Date().toISOString(),
  };
}

export function domainToTrackRow(track: OfferTrack, sortOrder = 0): OfferTrackRow {
  return {
    id: track.id,
    company: track.companyName,
    role: track.roleTitle,
    status: track.status,
    sort_order: sortOrder,
    active_revision_id: track.activeRevisionId || null,
    notes: track.notes ?? null,
    created_at: track.createdAt || new Date().toISOString(),
    updated_at: track.updatedAt || new Date().toISOString(),
  };
}

export function assumptionsRowToConfig(row?: OfferComparatorAssumptionsRow | null): ComparatorGlobalConfig {
  if (!row) {
    return { ...DEFAULT_COMPARATOR_CONFIG };
  }

  let fxBuffers: Record<string, number> = DEFAULT_COMPARATOR_CONFIG.fxPessimisticBufferPct;
  if (row.fx_pessimistic_buffer_pct && typeof row.fx_pessimistic_buffer_pct === "object") {
    fxBuffers = row.fx_pessimistic_buffer_pct as Record<string, number>;
  }

  let manualFx: Record<string, number> = DEFAULT_COMPARATOR_CONFIG.manualFxOverrides;
  if (row.manual_fx_overrides && typeof row.manual_fx_overrides === "object") {
    manualFx = row.manual_fx_overrides as Record<string, number>;
  }

  const proj = num(row.active_year_projection, DEFAULT_COMPARATOR_CONFIG.activeYearProjection);
  const activeYearProjection = (proj === 2 || proj === 3 ? proj : 1) as 1 | 2 | 3;

  return {
    defaultWorkingDaysPerYear: num(
      row.default_working_days_per_year,
      DEFAULT_COMPARATOR_CONFIG.defaultWorkingDaysPerYear,
    ),
    defaultStateHolidaysCount: num(
      row.default_state_holidays_count,
      DEFAULT_COMPARATOR_CONFIG.defaultStateHolidaysCount,
    ),
    workingHoursPerDay: num(row.working_hours_per_day, DEFAULT_COMPARATOR_CONFIG.workingHoursPerDay),
    annualStaticCostGrowthPct: num(
      row.annual_static_cost_growth_pct,
      DEFAULT_COMPARATOR_CONFIG.annualStaticCostGrowthPct,
    ),
    fxPessimisticBufferPct: fxBuffers,
    manualFxOverrides: manualFx,
    targetMonthlyExpensePln: num(row.target_monthly_expense_pln, DEFAULT_COMPARATOR_CONFIG.targetMonthlyExpensePln),
    targetMonthlySavingsPln: num(row.target_monthly_savings_pln, DEFAULT_COMPARATOR_CONFIG.targetMonthlySavingsPln),
    activeYearProjection,
  };
}

export function configToAssumptionsRow(config: ComparatorGlobalConfig, id = "default"): OfferComparatorAssumptionsRow {
  return {
    id,
    fx_pessimistic_buffer_pct: config.fxPessimisticBufferPct,
    manual_fx_overrides: config.manualFxOverrides,
    target_monthly_expense_pln: config.targetMonthlyExpensePln,
    target_monthly_savings_pln: config.targetMonthlySavingsPln,
    active_year_projection: config.activeYearProjection,
    default_working_days_per_year: config.defaultWorkingDaysPerYear,
    default_state_holidays_count: config.defaultStateHolidaysCount,
    working_hours_per_day: config.workingHoursPerDay,
    annual_static_cost_growth_pct: config.annualStaticCostGrowthPct,
    updated_at: new Date().toISOString(),
  };
}

export class InMemoryOfferStore implements OfferStore {
  private tracks = new Map<string, OfferTrack>();
  private globalConfig: ComparatorGlobalConfig = { ...DEFAULT_COMPARATOR_CONFIG };

  constructor(initialTracks?: OfferTrack[], initialConfig?: ComparatorGlobalConfig) {
    if (initialTracks) {
      for (const t of initialTracks) {
        this.tracks.set(t.id, structuredClone(t));
      }
    }
    if (initialConfig) {
      this.globalConfig = structuredClone(initialConfig);
    }
  }

  async listTracks(): Promise<OfferTrack[]> {
    return Array.from(this.tracks.values()).map((t) => structuredClone(t));
  }

  async getTrack(id: string): Promise<OfferTrack | null> {
    const t = this.tracks.get(id);
    return t ? structuredClone(t) : null;
  }

  async saveTrack(track: OfferTrack): Promise<OfferTrack> {
    const copy = structuredClone(track);
    copy.updatedAt = new Date().toISOString();
    this.tracks.set(copy.id, copy);
    return structuredClone(copy);
  }

  async deleteTrack(id: string): Promise<boolean> {
    return this.tracks.delete(id);
  }

  async listRevisions(trackId: string): Promise<OfferRevision[]> {
    const track = this.tracks.get(trackId);
    if (!track) return [];
    return structuredClone(track.revisions);
  }

  async saveRevision(revision: OfferRevision): Promise<OfferRevision> {
    const track = this.tracks.get(revision.trackId);
    if (!track) {
      throw new Error(`Track not found: ${revision.trackId}`);
    }

    const copy = structuredClone(revision);
    copy.updatedAt = new Date().toISOString();
    const idx = track.revisions.findIndex((r) => r.id === copy.id);
    if (idx >= 0) {
      track.revisions[idx] = copy;
    } else {
      track.revisions.push(copy);
    }
    track.updatedAt = new Date().toISOString();
    return structuredClone(copy);
  }

  async deleteRevision(trackId: string, revisionId: string): Promise<boolean> {
    const track = this.tracks.get(trackId);
    if (!track) return false;
    const initialLen = track.revisions.length;
    track.revisions = track.revisions.filter((r) => r.id !== revisionId);
    if (track.activeRevisionId === revisionId && track.revisions.length > 0) {
      track.activeRevisionId = track.revisions[track.revisions.length - 1].id;
    }
    track.updatedAt = new Date().toISOString();
    return track.revisions.length < initialLen;
  }

  async getGlobalConfig(): Promise<ComparatorGlobalConfig> {
    return structuredClone(this.globalConfig);
  }

  async saveGlobalConfig(config: ComparatorGlobalConfig): Promise<ComparatorGlobalConfig> {
    this.globalConfig = structuredClone(config);
    return structuredClone(this.globalConfig);
  }

  async loadAll(): Promise<{ tracks: OfferTrack[]; globalConfig: ComparatorGlobalConfig }> {
    return {
      tracks: await this.listTracks(),
      globalConfig: await this.getGlobalConfig(),
    };
  }

  async saveAll(tracks: OfferTrack[], globalConfig: ComparatorGlobalConfig): Promise<void> {
    this.tracks.clear();
    for (const t of tracks) {
      this.tracks.set(t.id, structuredClone(t));
    }
    this.globalConfig = structuredClone(globalConfig);
  }
}

export class SupabaseRestOfferStore implements OfferStore {
  private url: string;
  private key: string;

  constructor(supabaseUrl: string, serviceRoleKey: string) {
    this.url = supabaseUrl.replace(/\/+$/, "");
    this.key = serviceRoleKey;
  }

  private async request<T>(path: string, options?: RequestInit): Promise<T> {
    const res = await fetch(`${this.url}/rest/v1${path}`, {
      ...options,
      headers: {
        apikey: this.key,
        ...(!this.key.startsWith("sb_") ? { Authorization: `Bearer ${this.key}` } : {}),
        "Content-Type": "application/json",
        ...options?.headers,
      },
    });

    if (!res.ok) {
      const text = await res.text().catch(() => "");
      throw new Error(`Supabase REST error (${res.status} ${res.statusText}): ${text}`);
    }

    if (res.status === 204) {
      return null as T;
    }
    return (await res.json()) as T;
  }

  async listTracks(): Promise<OfferTrack[]> {
    const [trackRows, revisionRows] = await Promise.all([
      this.request<OfferTrackRow[]>("/offer_tracks?select=*&order=sort_order.asc,created_at.asc"),
      this.request<OfferRevisionRow[]>("/offer_revisions?select=*&order=revision_number.asc,created_at.asc"),
    ]);

    if (!trackRows || !Array.isArray(trackRows)) return [];

    const revsByTrack = new Map<string, OfferRevision[]>();
    if (Array.isArray(revisionRows)) {
      for (const revRow of revisionRows) {
        const rev = revisionRowToDomain(revRow);
        const list = revsByTrack.get(rev.trackId) ?? [];
        list.push(rev);
        revsByTrack.set(rev.trackId, list);
      }
    }

    return trackRows.map((tr) => trackRowToDomain(tr, revsByTrack.get(tr.id) ?? []));
  }

  async getTrack(id: string): Promise<OfferTrack | null> {
    const [trackRows, revisionRows] = await Promise.all([
      this.request<OfferTrackRow[]>(`/offer_tracks?id=eq.${encodeURIComponent(id)}&select=*`),
      this.request<OfferRevisionRow[]>(
        `/offer_revisions?track_id=eq.${encodeURIComponent(id)}&select=*&order=revision_number.asc,created_at.asc`,
      ),
    ]);

    const trackRow = trackRows?.[0];
    if (!trackRow) return null;

    const revisions = (revisionRows || []).map(revisionRowToDomain);
    return trackRowToDomain(trackRow, revisions);
  }

  async saveTrack(track: OfferTrack): Promise<OfferTrack> {
    const trackRow = domainToTrackRow(track);

    // Upsert track row
    await this.request("/offer_tracks", {
      method: "POST",
      headers: {
        Prefer: "resolution=merge-duplicates,return=representation",
      },
      body: JSON.stringify([trackRow]),
    });

    // Delete existing revisions for this track and re-insert
    await this.request(`/offer_revisions?track_id=eq.${encodeURIComponent(track.id)}`, {
      method: "DELETE",
    });

    if (track.revisions.length > 0) {
      const revisionRows = track.revisions.map((rev, idx) => domainToRevisionRow(rev, track.id, idx + 1));
      await this.request("/offer_revisions", {
        method: "POST",
        headers: {
          Prefer: "return=representation",
        },
        body: JSON.stringify(revisionRows),
      });
    }

    return (await this.getTrack(track.id)) ?? track;
  }

  async deleteTrack(id: string): Promise<boolean> {
    await this.request(`/offer_tracks?id=eq.${encodeURIComponent(id)}`, {
      method: "DELETE",
    });
    return true;
  }

  async listRevisions(trackId: string): Promise<OfferRevision[]> {
    const rows = await this.request<OfferRevisionRow[]>(
      `/offer_revisions?track_id=eq.${encodeURIComponent(trackId)}&select=*&order=revision_number.asc,created_at.asc`,
    );
    if (!rows || !Array.isArray(rows)) return [];
    return rows.map(revisionRowToDomain);
  }

  async saveRevision(revision: OfferRevision): Promise<OfferRevision> {
    const row = domainToRevisionRow(revision, revision.trackId);

    const rows = await this.request<OfferRevisionRow[]>("/offer_revisions", {
      method: "POST",
      headers: {
        Prefer: "resolution=merge-duplicates,return=representation",
      },
      body: JSON.stringify([row]),
    });

    const saved = rows?.[0];
    return saved ? revisionRowToDomain(saved) : revision;
  }

  async deleteRevision(trackId: string, revisionId: string): Promise<boolean> {
    await this.request(
      `/offer_revisions?track_id=eq.${encodeURIComponent(trackId)}&id=eq.${encodeURIComponent(revisionId)}`,
      { method: "DELETE" },
    );
    return true;
  }

  async getGlobalConfig(): Promise<ComparatorGlobalConfig> {
    const rows = await this.request<OfferComparatorAssumptionsRow[]>(
      "/offer_comparator_assumptions?id=eq.default&select=*",
    );
    return assumptionsRowToConfig(rows?.[0]);
  }

  async saveGlobalConfig(config: ComparatorGlobalConfig): Promise<ComparatorGlobalConfig> {
    const row = configToAssumptionsRow(config, "default");
    const rows = await this.request<OfferComparatorAssumptionsRow[]>("/offer_comparator_assumptions", {
      method: "POST",
      headers: {
        Prefer: "resolution=merge-duplicates,return=representation",
      },
      body: JSON.stringify([row]),
    });
    return assumptionsRowToConfig(rows?.[0]);
  }

  async loadAll(): Promise<{ tracks: OfferTrack[]; globalConfig: ComparatorGlobalConfig }> {
    const [tracks, globalConfig] = await Promise.all([this.listTracks(), this.getGlobalConfig()]);
    return { tracks, globalConfig };
  }

  async saveAll(tracks: OfferTrack[], globalConfig: ComparatorGlobalConfig): Promise<void> {
    // 1. Save global config
    await this.saveGlobalConfig(globalConfig);

    // 2. Fetch existing tracks to handle deletions
    const existing = await this.request<OfferTrackRow[]>("/offer_tracks?select=id");
    const existingIds = new Set((existing || []).map((t) => t.id));
    const newIds = new Set(tracks.map((t) => t.id));

    // Delete tracks that no longer exist
    for (const oldId of existingIds) {
      if (!newIds.has(oldId)) {
        await this.deleteTrack(oldId);
      }
    }

    // 3. Upsert tracks & revisions
    for (let i = 0; i < tracks.length; i++) {
      const track = tracks[i];
      const trackRow = domainToTrackRow(track, i);
      await this.request("/offer_tracks", {
        method: "POST",
        headers: {
          Prefer: "resolution=merge-duplicates",
        },
        body: JSON.stringify([trackRow]),
      });

      // Clear existing revisions for this track and re-insert
      await this.request(`/offer_revisions?track_id=eq.${encodeURIComponent(track.id)}`, {
        method: "DELETE",
      });

      if (track.revisions.length > 0) {
        const revRows = track.revisions.map((rev, revIdx) => domainToRevisionRow(rev, track.id, revIdx + 1));
        await this.request("/offer_revisions", {
          method: "POST",
          headers: {
            Prefer: "return=representation",
          },
          body: JSON.stringify(revRows),
        });
      }
    }
  }
}

let activeOfferStore: OfferStore | null = null;

export function getOfferStore(): OfferStore {
  if (activeOfferStore) {
    return activeOfferStore;
  }

  const supabaseUrl = process.env.SUPABASE_URL;
  const serviceRoleKey = process.env.SUPABASE_SECRET_KEY ?? process.env.SUPABASE_SERVICE_ROLE_KEY;

  if (supabaseUrl && serviceRoleKey) {
    activeOfferStore = new SupabaseRestOfferStore(supabaseUrl, serviceRoleKey);
  } else {
    activeOfferStore = new InMemoryOfferStore();
  }

  return activeOfferStore;
}

export function setTestOfferStore(store: OfferStore | null): void {
  activeOfferStore = store;
}
