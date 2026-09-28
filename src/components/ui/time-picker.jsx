"use client";

import React, { useMemo, useState } from "react";
import * as SelectPrimitive from "@radix-ui/react-select";
import { Clock, ChevronDown, ChevronUp } from "lucide-react";
import { cn } from "@/lib/utils";

const HOURS_12 = Array.from({ length: 12 }, (_, i) => i + 1); // 1..12
const MINUTES = Array.from({ length: 60 }, (_, i) => i); // 0..59
const CLEAR = "__clear__";

function parse(value) {
  const m = /^(\d{1,2}):(\d{2})$/.exec(value || "");
  if (!m) return { hour12: "", minute: "", period: "" };
  const h = Number(m[1]);
  if (h > 23) return { hour12: "", minute: "", period: "" };
  return {
    hour12: String(h % 12 === 0 ? 12 : h % 12),
    minute: m[2],
    period: h >= 12 ? "PM" : "AM",
  };
}

/**
 * Compact Radix select used inside the time input shell — renders a fully
 * styled dropdown menu (no OS-native <select> popup).
 */
function MiniSelect({ value, placeholder, options, onChange, disabled, ariaLabel }) {
  return (
    <SelectPrimitive.Root
      value={value}
      onValueChange={onChange}
      disabled={disabled}
    >
      <SelectPrimitive.Trigger
        aria-label={ariaLabel}
        className={cn(
          "flex h-8 items-center gap-0.5 rounded-md px-1.5 text-sm font-medium",
          "hover:bg-muted/70 focus:outline-none transition-colors",
          "data-[placeholder]:text-muted-foreground",
          "disabled:pointer-events-none disabled:opacity-40"
        )}
      >
        <SelectPrimitive.Value placeholder={placeholder} />
        <SelectPrimitive.Icon>
          <ChevronDown className="h-3 w-3 text-muted-foreground" />
        </SelectPrimitive.Icon>
      </SelectPrimitive.Trigger>
      <SelectPrimitive.Portal>
        <SelectPrimitive.Content
          position="popper"
          sideOffset={4}
          className={cn(
            "z-50 max-h-64 overflow-hidden rounded-md border bg-popover text-popover-foreground shadow-md",
            "data-[state=open]:animate-in data-[state=closed]:animate-out",
            "data-[state=closed]:fade-out-0 data-[state=open]:fade-in-0",
            "data-[state=closed]:zoom-out-95 data-[state=open]:zoom-in-95",
            "data-[side=bottom]:slide-in-from-top-2 data-[side=top]:slide-in-from-bottom-2"
          )}
        >
          <SelectPrimitive.ScrollUpButton className="flex h-6 cursor-default items-center justify-center bg-popover">
            <ChevronUp className="h-3.5 w-3.5 text-muted-foreground" />
          </SelectPrimitive.ScrollUpButton>
          <SelectPrimitive.Viewport className="p-1">
            {options.map((opt) => (
              <SelectPrimitive.Item
                key={opt.value}
                value={opt.value}
                className={cn(
                  "relative flex cursor-pointer select-none items-center justify-center rounded-sm px-2 py-1.5 text-sm outline-none",
                  "data-[highlighted]:bg-accent data-[highlighted]:text-accent-foreground",
                  "data-[state=checked]:bg-primary/10 data-[state=checked]:font-semibold data-[state=checked]:text-primary"
                )}
              >
                <SelectPrimitive.ItemText>{opt.label}</SelectPrimitive.ItemText>
              </SelectPrimitive.Item>
            ))}
          </SelectPrimitive.Viewport>
          <SelectPrimitive.ScrollDownButton className="flex h-6 cursor-default items-center justify-center bg-popover">
            <ChevronDown className="h-3.5 w-3.5 text-muted-foreground" />
          </SelectPrimitive.ScrollDownButton>
        </SelectPrimitive.Content>
      </SelectPrimitive.Portal>
    </SelectPrimitive.Root>
  );
}

/**
 * TimePicker — locale-independent 12-hour time input.
 * Native <input type="time"> hides AM/PM on 24h locales and lets users
 * accidentally enter 05:00 when they mean 5 PM; this always renders
 * explicit hour / minute / AM-PM controls inside one input shell.
 *
 * @param {string} value - "HH:MM" (24h) or ""
 * @param {function} onChange - callback({ target: { value: "HH:MM" } })
 */
const TimePicker = ({ value, onChange, className, id }) => {
  const parsed = useMemo(() => parse(value), [value]);
  const { hour12, minute } = parsed;
  // AM/PM the user picked before choosing an hour — kept so the toggle
  // feels stateful even while value is still empty.
  const [pendingPeriod, setPendingPeriod] = useState("AM");
  const period = parsed.period || pendingPeriod;

  function emit(h12, min, per) {
    if (!h12) {
      onChange({ target: { value: "" } });
      return;
    }
    const p = per || "AM";
    const m = min === "" ? "00" : min;
    let h24 = Number(h12) % 12;
    if (p === "PM") h24 += 12;
    onChange({ target: { value: `${String(h24).padStart(2, "0")}:${m}` } });
  }

  function togglePeriod(next) {
    setPendingPeriod(next);
    if (hour12) emit(hour12, minute, next);
  }

  const hourOptions = [
    { value: CLEAR, label: "--" },
    ...HOURS_12.map((h) => ({ value: String(h), label: String(h).padStart(2, "0") })),
  ];
  const minuteOptions = MINUTES.map((m) => ({
    value: String(m).padStart(2, "0"),
    label: String(m).padStart(2, "0"),
  }));

  return (
    <div
      id={id}
      className={cn(
        "flex h-10 items-center gap-1.5 rounded-md border border-input bg-background px-2.5",
        "transition-colors focus-within:ring-2 focus-within:ring-ring focus-within:ring-offset-2 ring-offset-background",
        className
      )}
    >
      <Clock className="h-3.5 w-3.5 shrink-0 text-muted-foreground" />
      <MiniSelect
        ariaLabel="Hour"
        placeholder="HH"
        options={hourOptions}
        value={hour12}
        onChange={(v) => emit(v === CLEAR ? "" : v, minute, period)}
      />
      <span className="font-semibold text-muted-foreground">:</span>
      <MiniSelect
        ariaLabel="Minute"
        placeholder="MM"
        options={minuteOptions}
        value={minute}
        disabled={!hour12}
        onChange={(v) => emit(hour12, v, period)}
      />

      <div className="flex items-center rounded-md bg-muted p-0.5">
        {["AM", "PM"].map((p) => (
          <button
            key={p}
            type="button"
            aria-pressed={period === p}
            onClick={() => togglePeriod(p)}
            className={cn(
              "h-6 rounded px-2 text-[11px] font-semibold transition-all",
              period === p
                ? "bg-background text-foreground shadow-sm"
                : "text-muted-foreground hover:text-foreground"
            )}
          >
            {p}
          </button>
        ))}
      </div>
    </div>
  );
};

export default TimePicker;
