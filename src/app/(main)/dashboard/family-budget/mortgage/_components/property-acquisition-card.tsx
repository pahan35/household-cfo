"use client";

import { Building2, Calculator, Car, Home, ShieldCheck, Wrench } from "lucide-react";

import { formatMoney } from "@/app/(main)/dashboard/family-budget/_components/external-provider-data";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Slider } from "@/components/ui/slider";
import { Switch } from "@/components/ui/switch";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";

import type { PropertyAcquisitionConfig, PropertyAcquisitionSummary } from "./mortgage-types";

interface PropertyAcquisitionCardProps {
  config: PropertyAcquisitionConfig;
  summary: PropertyAcquisitionSummary;
  onChange: (updated: PropertyAcquisitionConfig) => void;
}

export function PropertyAcquisitionCard({ config, summary, onChange }: PropertyAcquisitionCardProps) {
  const update = (patch: Partial<PropertyAcquisitionConfig>) => {
    onChange({ ...config, ...patch });
  };

  return (
    <Card className="border-border/60 shadow-xs">
      <CardHeader className="pb-4">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <div className="flex items-center gap-2">
            <Building2 className="text-primary size-5" />
            <CardTitle className="text-base font-semibold">Primary Market Acquisition & Upfront Costs</CardTitle>
          </div>
          <div className="flex items-center gap-2">
            <Badge
              variant="outline"
              className="border-emerald-500/40 bg-emerald-500/10 text-xs font-medium text-emerald-600 dark:text-emerald-400"
            >
              <ShieldCheck className="mr-1 size-3.5" /> 0% PCC (Rynek Pierwotny)
            </Badge>
            <Badge variant="secondary" className="text-xs font-normal">
              Property Total: <strong>{formatMoney(summary.propertyTotalPln, "PLN")}</strong>
            </Badge>
          </div>
        </div>
        <CardDescription className="text-xs">
          Configure primary-market apartment pricing, appurtenances (parking/storage), statutory closing fees, and
          turnkey finishing budget.
        </CardDescription>
      </CardHeader>

      <CardContent className="space-y-5">
        {/* Apartment Pricing Mode */}
        <div className="border-border/50 bg-muted/20 space-y-3 rounded-lg border p-3">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <Label className="text-foreground text-xs font-medium">Apartment Base Price</Label>
            <Tabs
              value={config.pricingMode}
              onValueChange={(val) => update({ pricingMode: val as PropertyAcquisitionConfig["pricingMode"] })}
            >
              <TabsList className="h-7 text-xs">
                <TabsTrigger value="area_and_price_per_sqm" className="px-2.5 text-xs">
                  Area & PLN/m²
                </TabsTrigger>
                <TabsTrigger value="total_price" className="px-2.5 text-xs">
                  Lump Sum
                </TabsTrigger>
              </TabsList>
            </Tabs>
          </div>

          {config.pricingMode === "area_and_price_per_sqm" ? (
            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
              <div className="space-y-1">
                <Label htmlFor="areaSqm" className="text-muted-foreground text-xs">
                  Area (m²)
                </Label>
                <Input
                  id="areaSqm"
                  type="number"
                  min="15"
                  max="300"
                  step="0.5"
                  value={config.areaSqm || ""}
                  onChange={(e) => update({ areaSqm: Number(e.target.value) || 0 })}
                  className="h-8 text-sm"
                />
              </div>
              <div className="space-y-1">
                <Label htmlFor="pricePerSqm" className="text-muted-foreground text-xs">
                  Price per m² (PLN)
                </Label>
                <Input
                  id="pricePerSqm"
                  type="number"
                  min="5000"
                  max="50000"
                  step="500"
                  value={config.pricePerSqmPln || ""}
                  onChange={(e) => update({ pricePerSqmPln: Number(e.target.value) || 0 })}
                  className="h-8 text-sm"
                />
              </div>
            </div>
          ) : (
            <div className="space-y-1">
              <Label htmlFor="customTotalPrice" className="text-muted-foreground text-xs">
                Apartment Total Price (PLN)
              </Label>
              <Input
                id="customTotalPrice"
                type="number"
                min="100000"
                max="10000000"
                step="10000"
                value={config.customTotalPricePln || ""}
                onChange={(e) => update({ customTotalPricePln: Number(e.target.value) || 0 })}
                className="h-8 text-sm"
              />
            </div>
          )}

          <div className="text-muted-foreground border-border/40 flex items-center justify-between border-t pt-1 text-xs">
            <span>Apartment Cost:</span>
            <span className="text-foreground font-semibold">{formatMoney(summary.apartmentPricePln, "PLN")}</span>
          </div>
        </div>

        {/* Appurtenances (Parking & Storage) */}
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
          {/* Parking */}
          <div className="border-border/50 bg-muted/10 space-y-2 rounded-lg border p-3">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-1.5">
                <Car className="text-muted-foreground size-4" />
                <Label htmlFor="includeParking" className="text-xs font-medium">
                  Garage / Parking Space
                </Label>
              </div>
              <Switch
                id="includeParking"
                checked={config.includeParking}
                onCheckedChange={(checked) => update({ includeParking: checked })}
              />
            </div>
            {config.includeParking && (
              <div className="space-y-1 pt-1">
                <Label htmlFor="parkingPrice" className="text-muted-foreground text-[11px]">
                  Parking Price (PLN)
                </Label>
                <Input
                  id="parkingPrice"
                  type="number"
                  step="5000"
                  value={config.parkingPricePln || ""}
                  onChange={(e) => update({ parkingPricePln: Number(e.target.value) || 0 })}
                  className="h-8 text-sm"
                />
              </div>
            )}
          </div>

          {/* Storage */}
          <div className="border-border/50 bg-muted/10 space-y-2 rounded-lg border p-3">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-1.5">
                <Home className="text-muted-foreground size-4" />
                <Label htmlFor="includeStorage" className="text-xs font-medium">
                  Storage Unit (Komórka)
                </Label>
              </div>
              <Switch
                id="includeStorage"
                checked={config.includeStorage}
                onCheckedChange={(checked) => update({ includeStorage: checked })}
              />
            </div>
            {config.includeStorage && (
              <div className="space-y-1 pt-1">
                <Label htmlFor="storagePrice" className="text-muted-foreground text-[11px]">
                  Storage Price (PLN)
                </Label>
                <Input
                  id="storagePrice"
                  type="number"
                  step="2500"
                  value={config.storagePricePln || ""}
                  onChange={(e) => update({ storagePricePln: Number(e.target.value) || 0 })}
                  className="h-8 text-sm"
                />
              </div>
            )}
          </div>
        </div>

        {/* Renovation / Finishing Budget */}
        <div className="border-border/50 bg-muted/10 space-y-3 rounded-lg border p-3">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <div className="flex items-center gap-1.5">
              <Wrench className="text-muted-foreground size-4" />
              <Label className="text-xs font-medium">Turnkey Renovation & Finishing Budget</Label>
            </div>
            <div className="flex items-center gap-2">
              <Label htmlFor="renovationFunding" className="text-muted-foreground text-xs">
                Financing Mode:
              </Label>
              <Tabs
                value={config.renovationFundingMode}
                onValueChange={(val) =>
                  update({ renovationFundingMode: val as PropertyAcquisitionConfig["renovationFundingMode"] })
                }
              >
                <TabsList className="h-7 text-xs">
                  <TabsTrigger value="cash" className="px-2.5 text-xs">
                    Cash-Funded
                  </TabsTrigger>
                  <TabsTrigger value="mortgage" className="px-2.5 text-xs">
                    Mortgage-Bundled
                  </TabsTrigger>
                </TabsList>
              </Tabs>
            </div>
          </div>

          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
            <div className="space-y-1">
              <Label htmlFor="renovationBudget" className="text-muted-foreground text-xs">
                Base Budget (PLN)
              </Label>
              <Input
                id="renovationBudget"
                type="number"
                step="10000"
                value={config.renovationBudgetPln || ""}
                onChange={(e) => update({ renovationBudgetPln: Number(e.target.value) || 0 })}
                className="h-8 text-sm"
              />
            </div>
            <div className="space-y-1">
              <div className="text-muted-foreground flex justify-between text-xs">
                <Label htmlFor="contingency" className="text-xs">
                  Cost Overrun Buffer
                </Label>
                <span>
                  +{config.renovationContingencyPct}% ({formatMoney(summary.renovationContingencyPln, "PLN")})
                </span>
              </div>
              <div className="pt-2">
                <Slider
                  id="contingency"
                  min={0}
                  max={25}
                  step={5}
                  value={[config.renovationContingencyPct]}
                  onValueChange={([val]) => update({ renovationContingencyPct: val })}
                />
              </div>
            </div>
          </div>

          <div className="text-muted-foreground border-border/40 flex items-center justify-between border-t pt-1 text-xs">
            <span>
              Total Renovation (
              {config.renovationFundingMode === "mortgage" ? "bundled into mortgage" : "cash at handover"}):
            </span>
            <span className="text-foreground font-semibold">{formatMoney(summary.renovationTotalPln, "PLN")}</span>
          </div>
        </div>

        {/* Closing Fees & Statutory Costs Breakdown */}
        <div className="border-border/50 bg-muted/20 space-y-2.5 rounded-lg border p-3 text-xs">
          <div className="flex items-center justify-between font-medium">
            <span className="text-foreground flex items-center gap-1.5">
              <Calculator className="text-muted-foreground size-4" /> Closing & Statutory Fees
            </span>
            <span className="text-foreground font-semibold">{formatMoney(summary.totalClosingFeesPln, "PLN")}</span>
          </div>

          <div className="text-muted-foreground grid grid-cols-1 gap-2 pt-1 sm:grid-cols-3">
            <div className="border-border/40 flex justify-between border-b pb-1 sm:border-b-0 sm:pb-0">
              <span>0% PCC Tax (Dev.):</span>
              <span className="font-medium text-emerald-600 dark:text-emerald-400">0 PLN</span>
            </div>
            <div className="border-border/40 flex justify-between border-b pb-1 sm:border-b-0 sm:pb-0">
              <span>Notary (50% Buyer Share):</span>
              <span className="text-foreground font-medium">
                {formatMoney(summary.notaryFees.buyerSharePln, "PLN")}
              </span>
            </div>
            <div className="flex justify-between">
              <span>Court (KW + PCC-3) & Bank:</span>
              <span className="text-foreground font-medium">
                {formatMoney(summary.courtFees.totalCourtFeesPln + summary.bankFeesPln, "PLN")}
              </span>
            </div>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
