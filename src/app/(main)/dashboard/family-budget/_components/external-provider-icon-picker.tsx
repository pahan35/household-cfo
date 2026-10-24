"use client";

import { useMemo, useState } from "react";

import { cn } from "cn";
import { Check, ChevronDown, Search } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";

import {
  EXTERNAL_PROVIDER_ICON_GROUPS,
  EXTERNAL_PROVIDER_ICONS,
  ExternalProviderIcon,
  type ExternalProviderIconMeta,
  getExternalProviderIconMeta,
} from "./external-provider-icons";

export interface ExternalProviderIconPickerProps {
  value?: string;
  onChange?: (icon: string) => void;
  disabled?: boolean;
  className?: string;
  triggerAriaLabel?: string;
}

export function filterExternalProviderIcons(query: string, group = "all"): readonly ExternalProviderIconMeta[] {
  const q = query.trim().toLowerCase();
  return EXTERNAL_PROVIDER_ICONS.filter((item) => {
    if (group !== "all" && item.group !== group) {
      return false;
    }
    if (!q) return true;
    return (
      item.id.toLowerCase().includes(q) ||
      item.name.toLowerCase().includes(q) ||
      item.label.toLowerCase().includes(q) ||
      item.keywords.some((k) => k.toLowerCase().includes(q))
    );
  });
}

export function ExternalProviderIconPicker({
  value,
  onChange,
  disabled = false,
  className,
  triggerAriaLabel,
}: ExternalProviderIconPickerProps) {
  const [open, setOpen] = useState(false);
  const [search, setSearch] = useState("");
  const [activeGroup, setActiveGroup] = useState<string>("all");

  const selectedMeta = useMemo(() => getExternalProviderIconMeta(value), [value]);

  const filteredIcons = useMemo(() => filterExternalProviderIcons(search, activeGroup), [search, activeGroup]);

  function handleSelect(iconId: string) {
    onChange?.(iconId);
    setOpen(false);
  }

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button
          type="button"
          variant="outline"
          role="combobox"
          aria-expanded={open}
          aria-label={triggerAriaLabel ?? (selectedMeta ? `Selected icon: ${selectedMeta.label}` : "Select icon")}
          disabled={disabled}
          className={cn("flex h-8 items-center justify-between gap-2 px-2.5 text-xs font-normal", className)}
        >
          <div className="flex min-w-0 items-center gap-2">
            <div className="flex size-5 shrink-0 items-center justify-center rounded bg-muted/60 text-foreground">
              <ExternalProviderIcon icon={value} className="size-3.5" />
            </div>
            <span className="truncate">{selectedMeta?.label ?? "Select icon"}</span>
          </div>
          <ChevronDown className="size-3.5 shrink-0 opacity-50" />
        </Button>
      </PopoverTrigger>

      <PopoverContent align="start" className="w-80 p-2.5">
        <TooltipProvider delayDuration={200}>
          <div className="flex flex-col gap-2">
            {/* Search Input */}
            <div className="relative">
              <Search className="text-muted-foreground pointer-events-none absolute left-2 top-2 size-3.5" />
              <Input
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder="Search 80 icons (e.g. car, food, crypto)..."
                className="h-7 pl-7 pr-2 text-xs"
                autoFocus
              />
            </div>

            {/* Group Filter Tabs */}
            <div className="flex flex-wrap gap-1 border-b pb-2">
              <button
                type="button"
                onClick={() => setActiveGroup("all")}
                className={cn(
                  "rounded px-1.5 py-0.5 text-[10px] font-medium transition-colors",
                  activeGroup === "all"
                    ? "bg-primary text-primary-foreground"
                    : "bg-muted text-muted-foreground hover:bg-muted/80",
                )}
              >
                All
              </button>
              {EXTERNAL_PROVIDER_ICON_GROUPS.map((g) => (
                <button
                  key={g.id}
                  type="button"
                  onClick={() => setActiveGroup(g.id)}
                  className={cn(
                    "rounded px-1.5 py-0.5 text-[10px] font-medium transition-colors",
                    activeGroup === g.id
                      ? "bg-primary text-primary-foreground"
                      : "bg-muted text-muted-foreground hover:bg-muted/80",
                  )}
                >
                  {g.label}
                </button>
              ))}
            </div>

            {/* Icons Grid */}
            <div className="grid max-h-56 grid-cols-6 gap-1 overflow-y-auto p-0.5">
              {filteredIcons.map((item) => {
                const IconComponent = item.icon;
                const isSelected =
                  value?.trim().toLowerCase() === item.id.toLowerCase() ||
                  value?.trim().toLowerCase() === item.name.toLowerCase();

                return (
                  <Tooltip key={item.id}>
                    <TooltipTrigger asChild>
                      <button
                        type="button"
                        onClick={() => handleSelect(item.id)}
                        aria-label={item.label}
                        aria-pressed={isSelected}
                        className={cn(
                          "relative flex size-9 items-center justify-center rounded-md border transition-colors",
                          isSelected
                            ? "border-primary bg-primary/10 text-primary ring-1 ring-primary"
                            : "border-transparent bg-muted/40 text-muted-foreground hover:border-border hover:bg-muted hover:text-foreground",
                        )}
                      >
                        <IconComponent className="size-4" />
                        {isSelected && (
                          <span className="absolute -top-1 -right-1 flex size-3 items-center justify-center rounded-full bg-primary text-primary-foreground">
                            <Check className="size-2" />
                          </span>
                        )}
                      </button>
                    </TooltipTrigger>
                    <TooltipContent side="top" className="text-[10px]">
                      {item.label}
                    </TooltipContent>
                  </Tooltip>
                );
              })}
            </div>

            {filteredIcons.length === 0 && (
              <div className="py-6 text-center text-xs text-muted-foreground">No matching icons found</div>
            )}
          </div>
        </TooltipProvider>
      </PopoverContent>
    </Popover>
  );
}
