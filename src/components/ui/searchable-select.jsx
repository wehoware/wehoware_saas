"use client";

import { useState } from "react";
import { Command } from "cmdk";
import { Check, ChevronsUpDown, Search } from "lucide-react";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { cn } from "@/lib/utils";

/**
 * SearchableSelect — styled combobox replacing native <select> so long
 * option lists stay searchable and the dropdown never uses the OS popup.
 *
 * <SearchableSelect
 *   options={[{ value, label }]}
 *   value={value}
 *   onChange={(v) => setValue(v)}
 *   placeholder="Select…"
 *   emptyText="No results found."
 *   clearable               // shows a "Clear selection" row when a value is set
 * />
 */
export default function SearchableSelect({
  options = [],
  value,
  onChange,
  placeholder = "Select…",
  searchPlaceholder = "Search…",
  emptyText = "No results found.",
  clearable = false,
  clearLabel = "Clear selection",
  disabled = false,
  className,
}) {
  const [open, setOpen] = useState(false);
  const selected = options.find((o) => o.value === value);

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <button
          type="button"
          disabled={disabled}
          className={cn(
            "flex h-10 w-full items-center justify-between rounded-md border border-input bg-background px-3 text-sm ring-offset-background transition-colors hover:border-muted-foreground/40 focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50",
            className
          )}
        >
          <span className={cn("truncate text-left", !selected && "text-muted-foreground")}>
            {selected?.label || placeholder}
          </span>
          <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 text-muted-foreground" />
        </button>
      </PopoverTrigger>
      <PopoverContent
        align="start"
        className="w-[var(--radix-popover-trigger-width)] p-0 overflow-hidden"
      >
        <Command>
          <div className="flex items-center border-b border-border/60 px-3">
            <Search className="mr-2 h-4 w-4 shrink-0 text-muted-foreground" />
            <Command.Input
              placeholder={searchPlaceholder}
              className="flex h-9 w-full bg-transparent text-sm outline-none placeholder:text-muted-foreground"
            />
          </div>
          <Command.List className="max-h-64 overflow-y-auto p-1">
            <Command.Empty className="py-6 text-center text-sm text-muted-foreground">
              {emptyText}
            </Command.Empty>
            {clearable && selected && (
              <Command.Item
                value="__clear__"
                onSelect={() => {
                  onChange("");
                  setOpen(false);
                }}
                className="flex cursor-pointer items-center rounded-sm px-2 py-2 text-sm text-muted-foreground outline-none data-[selected=true]:bg-accent data-[selected=true]:text-accent-foreground"
              >
                <span className="truncate">{clearLabel}</span>
              </Command.Item>
            )}
            {options.map((o) => (
              <Command.Item
                key={o.value}
                value={o.label}
                keywords={[String(o.value)]}
                onSelect={() => {
                  onChange(o.value);
                  setOpen(false);
                }}
                className="flex cursor-pointer items-center rounded-sm px-2 py-2 text-sm outline-none data-[selected=true]:bg-accent data-[selected=true]:text-accent-foreground"
              >
                <Check
                  className={cn(
                    "mr-2 h-4 w-4 shrink-0",
                    o.value === value ? "opacity-100" : "opacity-0"
                  )}
                />
                <span className="truncate">{o.label}</span>
              </Command.Item>
            ))}
          </Command.List>
        </Command>
      </PopoverContent>
    </Popover>
  );
}
