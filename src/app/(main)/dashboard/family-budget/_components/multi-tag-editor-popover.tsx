"use client";

import { useCallback, useEffect, useMemo, useState } from "react";

import { cn } from "cn";
import { Check, Loader2, Plus, Tag, X } from "lucide-react";
import { toast } from "sonner";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";

import { updateTransactionTags } from "./external-provider-client";
import type { ExternalProviderTransaction } from "./external-provider-data";

/**
 * Normalizes a tag string by stripping leading `#`, trimming whitespace,
 * lowercasing, and prepending a single `#`.
 * Returns an empty string if the tag is empty.
 */
export function normalizeTag(tag: string): string {
  const trimmed = tag.trim();
  if (!trimmed) return "";
  const cleaned = trimmed.replace(/^#+/, "").toLowerCase();
  return cleaned ? `#${cleaned}` : "";
}

/**
 * Appends a normalized tag to the list of tags if not already present.
 */
export function addTagToList(currentTags: string[] | undefined | null, newTag: string): string[] {
  const list = currentTags ? [...currentTags] : [];
  const normalized = normalizeTag(newTag);
  if (!normalized) return list;

  const alreadyExists = list.some((t) => normalizeTag(t) === normalized);
  if (alreadyExists) return list;

  return [...list, normalized];
}

/**
 * Removes a tag from the list by matching normalized values.
 */
export function removeTagFromList(currentTags: string[] | undefined | null, tagToRemove: string): string[] {
  if (!currentTags || currentTags.length === 0) return [];
  const normalizedTarget = normalizeTag(tagToRemove);
  return currentTags.filter((t) => normalizeTag(t) !== normalizedTarget);
}

/**
 * Filters known tags against a search query, excluding tags already applied.
 */
export function filterKnownTags(
  knownTags: string[] | undefined,
  query: string,
  currentTags: string[] | undefined | null,
  limit = 8,
): string[] {
  if (!knownTags || knownTags.length === 0) return [];

  const currentNormalized = new Set((currentTags ?? []).map(normalizeTag));
  const queryClean = query.trim().replace(/^#+/, "").toLowerCase();

  const results: string[] = [];
  const seen = new Set<string>();

  for (const raw of knownTags) {
    const norm = normalizeTag(raw);
    if (!norm || currentNormalized.has(norm) || seen.has(norm)) continue;

    const normWithoutHash = norm.slice(1);
    if (!queryClean || normWithoutHash.includes(queryClean)) {
      results.push(norm);
      seen.add(norm);
      if (results.length >= limit) break;
    }
  }

  return results;
}

export interface MultiTagEditorPopoverProps {
  transaction: ExternalProviderTransaction;
  knownTags?: string[];
  onTagsChange?: (updatedTags: string[]) => void | Promise<void>;
  trigger?: React.ReactNode;
  children?: React.ReactNode;
  align?: "start" | "center" | "end";
  side?: "top" | "bottom" | "left" | "right";
  className?: string;
}

export function MultiTagEditorPopover({
  transaction,
  knownTags = [],
  onTagsChange,
  trigger,
  children,
  align = "start",
  side = "bottom",
  className,
}: MultiTagEditorPopoverProps) {
  const [open, setOpen] = useState(false);
  const [tags, setTags] = useState<string[]>(transaction.tags ?? []);
  const [inputValue, setInputValue] = useState("");
  const [isSaving, setIsSaving] = useState(false);

  useEffect(() => {
    setTags(transaction.tags ?? []);
  }, [transaction.tags]);

  const suggestions = useMemo(() => {
    return filterKnownTags(knownTags, inputValue, tags);
  }, [knownTags, inputValue, tags]);

  const handleAddTag = useCallback(
    async (rawTag: string) => {
      const normalized = normalizeTag(rawTag);
      if (!normalized) return;

      const nextTags = addTagToList(tags, normalized);
      if (nextTags.length === tags.length) {
        setInputValue("");
        return;
      }

      const prevTags = tags;
      setTags(nextTags);
      setInputValue("");
      setIsSaving(true);

      try {
        if (onTagsChange) {
          await onTagsChange(nextTags);
        } else {
          await updateTransactionTags(transaction, nextTags);
        }
        toast.success(`Tag ${normalized} added`);
      } catch (err) {
        setTags(prevTags);
        toast.error("Failed to add tag", {
          description: err instanceof Error ? err.message : String(err),
        });
      } finally {
        setIsSaving(false);
      }
    },
    [tags, onTagsChange, transaction],
  );

  const handleRemoveTag = useCallback(
    async (tagToRemove: string) => {
      const nextTags = removeTagFromList(tags, tagToRemove);
      const prevTags = tags;
      setTags(nextTags);
      setIsSaving(true);

      try {
        if (onTagsChange) {
          await onTagsChange(nextTags);
        } else {
          await updateTransactionTags(transaction, nextTags);
        }
        toast.success(`Tag ${normalizeTag(tagToRemove)} removed`);
      } catch (err) {
        setTags(prevTags);
        toast.error("Failed to remove tag", {
          description: err instanceof Error ? err.message : String(err),
        });
      } finally {
        setIsSaving(false);
      }
    },
    [tags, onTagsChange, transaction],
  );

  const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === "Enter" || e.key === ",") {
      e.preventDefault();
      if (inputValue.trim()) {
        void handleAddTag(inputValue);
      }
    }
  };

  const renderedTrigger = trigger ?? children ?? (
    <Button
      type="button"
      variant="ghost"
      size="xs"
      className={cn(
        "h-6 gap-1 px-1.5 font-normal text-[11px] text-muted-foreground hover:text-foreground",
        tags.length > 0 && "text-foreground",
        className,
      )}
    >
      <Tag className="size-3" />
      {tags.length > 0 ? (
        <span className="flex items-center gap-1">
          {tags.slice(0, 2).map((t) => (
            <span key={t} className="font-medium text-primary">
              {t}
            </span>
          ))}
          {tags.length > 2 && <span className="text-muted-foreground text-[10px]">+{tags.length - 2}</span>}
        </span>
      ) : (
        <span>+ Tag</span>
      )}
    </Button>
  );

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>{renderedTrigger}</PopoverTrigger>
      <PopoverContent align={align} side={side} className="w-80 p-3">
        <div className="space-y-3">
          <div className="flex items-center justify-between border-b pb-2">
            <div className="flex items-center gap-1.5 font-semibold text-xs">
              <Tag className="size-3.5 text-muted-foreground" />
              <span>Transaction Tags</span>
            </div>
            {isSaving && <Loader2 className="size-3.5 animate-spin text-muted-foreground" />}
          </div>

          {/* Current tags chip list */}
          <div className="space-y-1.5">
            <span className="font-medium text-[11px] text-muted-foreground">Current tags:</span>
            {tags.length === 0 ? (
              <p className="text-[11px] text-muted-foreground italic">No tags assigned yet</p>
            ) : (
              <div className="flex flex-wrap gap-1.5">
                {tags.map((tag) => (
                  <Badge
                    key={tag}
                    variant="secondary"
                    className="group inline-flex items-center gap-1 pr-1 font-normal text-[11px]"
                  >
                    <span>{tag}</span>
                    <button
                      type="button"
                      aria-label={`Remove tag ${tag}`}
                      disabled={isSaving}
                      onClick={(e) => {
                        e.stopPropagation();
                        void handleRemoveTag(tag);
                      }}
                      className="rounded-full p-0.5 text-muted-foreground opacity-70 transition-opacity hover:bg-muted hover:text-foreground hover:opacity-100 disabled:opacity-30"
                    >
                      <X className="size-3" />
                    </button>
                  </Badge>
                ))}
              </div>
            )}
          </div>

          {/* Add tag input */}
          <div className="space-y-1.5">
            <label htmlFor={`tag-input-${transaction.id}`} className="font-medium text-[11px] text-muted-foreground">
              Add tag:
            </label>
            <div className="flex gap-1.5">
              <Input
                id={`tag-input-${transaction.id}`}
                placeholder="e.g. #travel, #austria"
                value={inputValue}
                onChange={(e) => setInputValue(e.target.value)}
                onKeyDown={handleKeyDown}
                disabled={isSaving}
                className="h-7 text-xs"
              />
              <Button
                type="button"
                size="xs"
                disabled={!inputValue.trim() || isSaving}
                onClick={() => void handleAddTag(inputValue)}
                className="h-7 px-2 text-xs"
              >
                <Plus className="mr-1 size-3" />
                Add
              </Button>
            </div>
          </div>

          {/* Autocomplete / Suggested tags */}
          {suggestions.length > 0 && (
            <div className="space-y-1.5 pt-1">
              <span className="font-medium text-[10px] text-muted-foreground uppercase tracking-wider">
                {inputValue.trim() ? "Matching tags:" : "Suggested tags:"}
              </span>
              <div className="flex flex-wrap gap-1">
                {suggestions.map((suggestion) => (
                  <button
                    key={suggestion}
                    type="button"
                    disabled={isSaving}
                    onClick={() => void handleAddTag(suggestion)}
                    className="inline-flex items-center gap-1 rounded-md border border-dashed px-1.5 py-0.5 text-[11px] text-muted-foreground transition-colors hover:border-primary/50 hover:bg-primary/5 hover:text-primary disabled:opacity-50"
                  >
                    <Plus className="size-2.5" />
                    <span>{suggestion}</span>
                  </button>
                ))}
              </div>
            </div>
          )}
        </div>
      </PopoverContent>
    </Popover>
  );
}
