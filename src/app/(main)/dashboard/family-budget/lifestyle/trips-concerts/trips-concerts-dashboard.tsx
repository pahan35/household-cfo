"use client";

import { useMemo, useState } from "react";

import { format } from "date-fns";
import {
  Calendar,
  Check,
  ChevronDown,
  ChevronUp,
  Link as LinkIcon,
  Music,
  Palmtree,
  Plane,
  Sparkles,
  Ticket,
} from "lucide-react";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";

import { formatMoney } from "../../_components/external-provider-data";
import {
  type ConcertEvent,
  detectConcertEvents,
  detectTravelEpisodes,
  getTransactionDate,
  type TravelEpisode,
  type UntaggedCandidateTransaction,
} from "../../_components/lifestyle-transforms";
import { SectionShell } from "../../_components/section-shell";
import { useLifestyleData } from "../use-lifestyle-data";

export function TripsConcertsDashboard() {
  const { categoryMap, currencies, transactions, defaultCurrency, updateTxTags } = useLifestyleData();

  // Selected candidates for linking: Map of episodeId -> Set of txId
  const [selectedCandidates, setSelectedCandidates] = useState<Record<string, string[]>>({});
  const [isLinking, setIsLinking] = useState<string | null>(null);

  // Expanded episodes
  const [expandedEpisodeId, setExpandedEpisodeId] = useState<string | null>(null);

  // Concert view mode: direct vs allocated overhead
  const [concertViewMode, setConcertViewMode] = useState<Record<string, "direct" | "overhead">>({});

  // Detect travel episodes
  const episodes = useMemo(() => {
    return detectTravelEpisodes({
      transactions,
      categories: categoryMap,
      currencies,
      defaultCurrency,
    });
  }, [transactions, categoryMap, currencies, defaultCurrency]);

  // Detect concert events
  const concerts = useMemo(() => {
    return detectConcertEvents({
      transactions,
      episodes,
      currencies,
      defaultCurrency,
    });
  }, [transactions, episodes, currencies, defaultCurrency]);

  // KPI Summary
  const kpis = useMemo(() => {
    const totalTravelCost = episodes.reduce((acc, ep) => acc + ep.totalCost, 0);
    const totalConcertDirect = concerts.reduce((acc, c) => acc + c.directCost, 0);
    const totalUntaggedCandidates = episodes.reduce((acc, ep) => acc + ep.untaggedCandidates.length, 0);

    return {
      totalTravelCost,
      episodesCount: episodes.length,
      totalConcertDirect,
      concertsCount: concerts.length,
      totalUntaggedCandidates,
    };
  }, [episodes, concerts]);

  const toggleCandidateSelection = (episodeId: string, txId: string) => {
    setSelectedCandidates((prev) => {
      const current = prev[episodeId] ?? [];
      const updated = current.includes(txId) ? current.filter((id) => id !== txId) : [...current, txId];
      return { ...prev, [episodeId]: updated };
    });
  };

  const handleLinkCandidates = async (episode: TravelEpisode) => {
    const candidateIds = selectedCandidates[episode.id] ?? [];
    if (candidateIds.length === 0) return;

    setIsLinking(episode.id);
    try {
      const candidatesToLink = episode.untaggedCandidates.filter((c) => candidateIds.includes(c.transaction.id));

      for (const candidate of candidatesToLink) {
        const tx = candidate.transaction;
        const existingTags = Array.isArray(tx.tags) ? tx.tags.filter((t): t is string => typeof t === "string") : [];
        const newTags = Array.from(new Set([...existingTags, episode.destinationTag]));
        await updateTxTags(tx, newTags);
      }

      // Clear selection for this episode
      setSelectedCandidates((prev) => ({ ...prev, [episode.id]: [] }));
    } finally {
      setIsLinking(null);
    }
  };

  return (
    <div className="flex flex-col gap-6">
      {/* 1. KPI Summary Strip */}
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        <div className="rounded-lg border bg-card p-3 shadow-xs">
          <div className="flex items-center gap-1.5 text-muted-foreground text-xs">
            <Plane className="size-3.5 text-sky-500" />
            <span>Total Travel TCO</span>
          </div>
          <div className="mt-1 font-bold font-mono text-lg text-foreground">
            {formatMoney(kpis.totalTravelCost, defaultCurrency)}
          </div>
          <span className="text-[10px] text-muted-foreground">{kpis.episodesCount} trip episodes detected</span>
        </div>

        <div className="rounded-lg border bg-card p-3 shadow-xs">
          <div className="flex items-center gap-1.5 text-muted-foreground text-xs">
            <Palmtree className="size-3.5 text-emerald-500" />
            <span>Travel Episodes</span>
          </div>
          <div className="mt-1 font-bold font-mono text-lg text-foreground">{kpis.episodesCount}</div>
          <span className="text-[10px] text-muted-foreground">Bookends &amp; &gt;60d clusters</span>
        </div>

        <div className="rounded-lg border bg-card p-3 shadow-xs">
          <div className="flex items-center gap-1.5 text-muted-foreground text-xs">
            <Music className="size-3.5 text-purple-500" />
            <span>Concert Direct Cost</span>
          </div>
          <div className="mt-1 font-bold font-mono text-lg text-foreground">
            {formatMoney(kpis.totalConcertDirect, defaultCurrency)}
          </div>
          <span className="text-[10px] text-muted-foreground">{kpis.concertsCount} concert events</span>
        </div>

        <div className="rounded-lg border bg-card p-3 shadow-xs">
          <div className="flex items-center gap-1.5 text-muted-foreground text-xs">
            <Sparkles className="size-3.5 text-amber-500" />
            <span>Untagged Candidates</span>
          </div>
          <div className="mt-1 font-bold font-mono text-lg text-amber-600 dark:text-amber-400">
            {kpis.totalUntaggedCandidates}
          </div>
          <span className="text-[10px] text-muted-foreground">Inside trip date windows</span>
        </div>
      </div>

      {/* 2. Travel Episodes Section */}
      <SectionShell
        title="Detected Travel Episodes"
        description="Trip clusters bounded by #travel/#end-travel or >60-day gap splitting, with pre-trip booking lookback"
      >
        <div className="flex flex-col gap-4">
          {episodes.length === 0 ? (
            <div className="rounded-lg border p-8 text-center text-muted-foreground text-xs">
              No travel episodes detected yet. Tag trip transactions with #travel, #end-travel, or your destination tags
              (e.g. #austria, #malediwy).
            </div>
          ) : (
            episodes.map((episode) => {
              const isExpanded = expandedEpisodeId === episode.id;
              const episodeSelected = selectedCandidates[episode.id] ?? [];

              return (
                <div
                  key={episode.id}
                  className="flex flex-col rounded-lg border bg-card transition-shadow hover:shadow-xs"
                >
                  {/* Episode Card Header */}
                  <div className="flex flex-col justify-between gap-3 p-4 sm:flex-row sm:items-center">
                    <div className="flex items-start gap-3">
                      <div className="flex size-9 shrink-0 items-center justify-center rounded-lg bg-sky-500/10 text-sky-600 dark:text-sky-400">
                        <Plane className="size-4" />
                      </div>
                      <div className="flex flex-col">
                        <div className="flex flex-wrap items-center gap-2">
                          <span className="font-semibold text-foreground text-sm">{episode.name}</span>
                          <Badge variant="secondary" className="px-1.5 py-0 text-[10px]">
                            #{episode.destinationTag}
                          </Badge>
                          {episode.untaggedCandidates.length > 0 && (
                            <Badge className="bg-amber-500/10 text-[10px] text-amber-700 dark:text-amber-300">
                              {episode.untaggedCandidates.length} untagged to review
                            </Badge>
                          )}
                        </div>
                        <div className="mt-0.5 flex items-center gap-2 text-muted-foreground text-xs">
                          <Calendar className="size-3" />
                          <span>
                            {episode.startDate} → {episode.endDate}
                          </span>
                          <span>•</span>
                          <span>{episode.transactionCount} confirmed transactions</span>
                        </div>
                      </div>
                    </div>

                    <div className="flex items-center gap-4">
                      {/* Cost breakdown */}
                      <div className="grid grid-cols-3 gap-3 text-right">
                        <div>
                          <span className="block text-[10px] text-muted-foreground">Pre-booking</span>
                          <span className="font-semibold font-mono text-xs text-foreground">
                            {formatMoney(episode.preBookingTotal, defaultCurrency)}
                          </span>
                        </div>
                        <div>
                          <span className="block text-[10px] text-muted-foreground">On-site</span>
                          <span className="font-semibold font-mono text-xs text-foreground">
                            {formatMoney(episode.onSiteTotal, defaultCurrency)}
                          </span>
                        </div>
                        <div>
                          <span className="block text-[10px] text-muted-foreground">Total TCO</span>
                          <span className="font-bold font-mono text-foreground text-sm">
                            {formatMoney(episode.totalCost, defaultCurrency)}
                          </span>
                        </div>
                      </div>

                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => setExpandedEpisodeId(isExpanded ? null : episode.id)}
                        className="size-8 p-0"
                      >
                        {isExpanded ? <ChevronUp className="size-4" /> : <ChevronDown className="size-4" />}
                      </Button>
                    </div>
                  </div>

                  {/* Expanded Details: Pre-booking, On-site, and Untagged Window Review Checklist */}
                  {isExpanded && (
                    <div className="flex flex-col gap-4 border-t bg-muted/20 p-4 text-xs">
                      {/* Untagged In-Window Review Checklist */}
                      {episode.untaggedCandidates.length > 0 && (
                        <div className="flex flex-col gap-2.5 rounded-lg border border-amber-500/30 bg-amber-500/5 p-3">
                          <div className="flex items-center justify-between">
                            <div className="flex items-center gap-1.5 font-medium text-amber-800 text-xs dark:text-amber-300">
                              <Sparkles className="size-3.5 text-amber-500" />
                              <span>
                                Untagged Transactions in Trip Window ({episode.startDate} → {episode.endDate})
                              </span>
                            </div>
                            <Button
                              size="sm"
                              variant="default"
                              onClick={() => void handleLinkCandidates(episode)}
                              disabled={episodeSelected.length === 0 || isLinking === episode.id}
                              className="h-7 gap-1.5 text-xs"
                            >
                              <LinkIcon className="size-3" />
                              <span>
                                {isLinking === episode.id
                                  ? "Linking..."
                                  : `Link Selected (${episodeSelected.length}) to #${episode.destinationTag}`}
                              </span>
                            </Button>
                          </div>

                          <div className="flex flex-col divide-y divide-amber-500/20 rounded border border-amber-500/20 bg-background/80">
                            {episode.untaggedCandidates.map((candidate) => {
                              const tx = candidate.transaction;
                              const isChecked = episodeSelected.includes(tx.id);
                              const txDate = format(getTransactionDate(tx), "yyyy-MM-dd");

                              return (
                                <div key={tx.id} className="flex items-center justify-between p-2 text-xs">
                                  <div className="flex items-center gap-2.5">
                                    <Checkbox
                                      checked={isChecked}
                                      onCheckedChange={() => toggleCandidateSelection(episode.id, tx.id)}
                                    />
                                    <div className="flex flex-col">
                                      <div className="flex items-center gap-1.5 font-medium text-foreground">
                                        <span>{tx.destinationName ?? "Expense"}</span>
                                        {tx.comment && (
                                          <span className="text-muted-foreground font-normal">({tx.comment})</span>
                                        )}
                                      </div>
                                      <span className="text-[10px] text-muted-foreground">
                                        {txDate} • {candidate.reason}
                                      </span>
                                    </div>
                                  </div>

                                  <div className="flex items-center gap-2 font-mono">
                                    <span className="font-semibold text-foreground">
                                      {formatMoney(candidate.convertedAmount, defaultCurrency)}
                                    </span>
                                    <Badge variant="outline" className="text-[10px]">
                                      {candidate.confidenceScore}% match
                                    </Badge>
                                  </div>
                                </div>
                              );
                            })}
                          </div>
                        </div>
                      )}

                      {/* Confirmed Transactions Summary */}
                      <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
                        {/* Pre-booking items */}
                        <div className="flex flex-col gap-2 rounded-lg border bg-background p-3">
                          <span className="font-semibold text-muted-foreground text-xs">
                            Pre-trip Bookings ({episode.preBookingTransactions.length})
                          </span>
                          {episode.preBookingTransactions.length === 0 ? (
                            <span className="text-muted-foreground">No pre-bookings tagged for this episode</span>
                          ) : (
                            <div className="flex max-h-48 flex-col divide-y overflow-y-auto">
                              {episode.preBookingTransactions.map((tx) => (
                                <div key={tx.id} className="flex justify-between py-1.5">
                                  <div className="flex flex-col truncate pr-2">
                                    <span className="truncate font-medium text-foreground">
                                      {tx.destinationName ?? "Booking"}
                                    </span>
                                    <span className="text-[10px] text-muted-foreground">
                                      {format(getTransactionDate(tx), "yyyy-MM-dd")}
                                      {tx.comment && ` • ${tx.comment}`}
                                    </span>
                                  </div>
                                  <span className="font-semibold font-mono text-foreground">
                                    {formatMoney(Number(tx.destinationAmount) || 0, defaultCurrency)}
                                  </span>
                                </div>
                              ))}
                            </div>
                          )}
                        </div>

                        {/* On-site items */}
                        <div className="flex flex-col gap-2 rounded-lg border bg-background p-3">
                          <span className="font-semibold text-muted-foreground text-xs">
                            On-site Spend ({episode.onSiteTransactions.length})
                          </span>
                          {episode.onSiteTransactions.length === 0 ? (
                            <span className="text-muted-foreground">No on-site transactions</span>
                          ) : (
                            <div className="flex max-h-48 flex-col divide-y overflow-y-auto">
                              {episode.onSiteTransactions.map((tx) => (
                                <div key={tx.id} className="flex justify-between py-1.5">
                                  <div className="flex flex-col truncate pr-2">
                                    <span className="truncate font-medium text-foreground">
                                      {tx.destinationName ?? "Expense"}
                                    </span>
                                    <span className="text-[10px] text-muted-foreground">
                                      {format(getTransactionDate(tx), "yyyy-MM-dd")}
                                      {tx.comment && ` • ${tx.comment}`}
                                    </span>
                                  </div>
                                  <span className="font-semibold font-mono text-foreground">
                                    {formatMoney(Number(tx.destinationAmount) || 0, defaultCurrency)}
                                  </span>
                                </div>
                              ))}
                            </div>
                          )}
                        </div>
                      </div>
                    </div>
                  )}
                </div>
              );
            })
          )}
        </div>
      </SectionShell>

      {/* 3. Concert Events Section */}
      <SectionShell
        title="Concert Events &amp; Overlap Costing"
        description="Ticket clustering, local vs. trip classification, and Direct vs. Allocated Trip Overhead views"
      >
        <div className="grid grid-cols-1 gap-4 md:grid-cols-2 lg:grid-cols-3">
          {concerts.length === 0 ? (
            <div className="col-span-full rounded-lg border p-8 text-center text-muted-foreground text-xs">
              No concert transactions found. Tag concert tickets and expenses with #concert and an artist tag (e.g.
              #coldplay, #taylorswift).
            </div>
          ) : (
            concerts.map((concert) => {
              const viewMode = concertViewMode[concert.id] ?? "direct";
              const isOverhead = viewMode === "overhead";

              return (
                <div key={concert.id} className="flex flex-col justify-between rounded-lg border bg-card p-4 shadow-xs">
                  <div>
                    {/* Concert Header */}
                    <div className="flex items-start justify-between gap-2">
                      <div className="flex items-center gap-2">
                        <div className="flex size-8 items-center justify-center rounded-lg bg-purple-500/10 text-purple-600 dark:text-purple-400">
                          <Ticket className="size-4" />
                        </div>
                        <div>
                          <span className="font-semibold text-foreground text-sm">{concert.displayName}</span>
                          <span className="block text-[11px] text-muted-foreground">{concert.concertDate}</span>
                        </div>
                      </div>

                      {/* Type Badge */}
                      {concert.type === "concert-in-travel" ? (
                        <Badge className="bg-sky-500/10 text-[10px] text-sky-700 dark:text-sky-300">Inside Trip</Badge>
                      ) : concert.type === "trip" ? (
                        <Badge className="bg-amber-500/10 text-[10px] text-amber-700 dark:text-amber-300">
                          Concert Trip
                        </Badge>
                      ) : (
                        <Badge variant="outline" className="text-[10px]">
                          Local Event
                        </Badge>
                      )}
                    </div>

                    {/* Cost Metrics */}
                    <div className="mt-4 flex flex-col gap-2 rounded-lg border bg-muted/30 p-2.5">
                      <div className="flex justify-between text-xs">
                        <span className="text-muted-foreground">Tickets ({concert.ticketCount}):</span>
                        <span className="font-semibold font-mono text-foreground">
                          {formatMoney(concert.ticketTotal, defaultCurrency)}
                        </span>
                      </div>
                      {concert.onSiteTotal > 0 && (
                        <div className="flex justify-between text-xs">
                          <span className="text-muted-foreground">Concert Day Spend:</span>
                          <span className="font-semibold font-mono text-foreground">
                            {formatMoney(concert.onSiteTotal, defaultCurrency)}
                          </span>
                        </div>
                      )}
                      {concert.allocatedTripOverhead > 0 && isOverhead && (
                        <div className="flex justify-between text-xs text-sky-600 dark:text-sky-400">
                          <span>Allocated Trip Overhead:</span>
                          <span className="font-semibold font-mono">
                            +{formatMoney(concert.allocatedTripOverhead, defaultCurrency)}
                          </span>
                        </div>
                      )}

                      <div className="mt-1 flex items-baseline justify-between border-t pt-1.5">
                        <span className="font-medium text-foreground text-xs">
                          {isOverhead ? "Total TCO (w/ Overhead):" : "Direct Concert Cost:"}
                        </span>
                        <span className="font-bold font-mono text-foreground text-base">
                          {formatMoney(
                            isOverhead ? concert.totalCostWithOverhead : concert.directCost,
                            defaultCurrency,
                          )}
                        </span>
                      </div>
                    </div>
                  </div>

                  {/* Direct vs Overhead Toggle */}
                  {concert.allocatedTripOverhead > 0 && (
                    <div className="mt-3 flex items-center justify-between border-t pt-2">
                      <span className="text-[10px] text-muted-foreground">Trip Overhead View:</span>
                      <div className="inline-flex rounded-md border bg-muted/60 p-0.5 text-[10px] font-medium">
                        <button
                          type="button"
                          onClick={() => setConcertViewMode((prev) => ({ ...prev, [concert.id]: "direct" }))}
                          className={`rounded px-1.5 py-0.5 transition-colors ${
                            !isOverhead ? "bg-background text-foreground shadow-xs" : "text-muted-foreground"
                          }`}
                        >
                          Direct Only
                        </button>
                        <button
                          type="button"
                          onClick={() => setConcertViewMode((prev) => ({ ...prev, [concert.id]: "overhead" }))}
                          className={`rounded px-1.5 py-0.5 transition-colors ${
                            isOverhead ? "bg-background text-foreground shadow-xs" : "text-muted-foreground"
                          }`}
                        >
                          With Overhead
                        </button>
                      </div>
                    </div>
                  )}
                </div>
              );
            })
          )}
        </div>
      </SectionShell>
    </div>
  );
}
