"use client";

import React, { useState, useMemo } from "react";
import { CalendarIcon, Clock, ChevronUp, ChevronDown } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Calendar } from "@/components/ui/calendar";
import { cn } from "@/lib/utils";

/**
 * DateTimePicker — calendar popover + styled time picker.
 *
 * @param {string} value - "YYYY-MM-DDTHH:MM" format (datetime-local)
 * @param {function} onChange - callback({ target: { value: "YYYY-MM-DDTHH:MM" } })
 * @param {Date} [min] - minimum selectable date
 * @param {string} [placeholder]
 * @param {string} [className]
 */
const DateTimePicker = ({
  value,
  onChange,
  min,
  placeholder = "Pick date & time",
  className,
  ...props
}) => {
  const [open, setOpen] = useState(false);

  const { datePart, timePart } = useMemo(() => {
    if (!value) return { datePart: "", timePart: "" };
    const [d, t] = value.split("T");
    return { datePart: d || "", timePart: t || "" };
  }, [value]);

  const selectedDate = datePart ? new Date(datePart + "T00:00:00") : undefined;
  const minDate = min ? new Date(min.toDateString()) : undefined;

  // Parse time into hours/minutes/period
  const { hours24, minutes, displayHour, displayMinute, period } = useMemo(() => {
    if (!timePart) return { hours24: 12, minutes: 0, displayHour: 12, displayMinute: "00", period: "PM" };
    const [h, m] = timePart.split(":").map(Number);
    const period = h >= 12 ? "PM" : "AM";
    const displayHour = h === 0 ? 12 : h > 12 ? h - 12 : h;
    return {
      hours24: h,
      minutes: m,
      displayHour,
      displayMinute: String(m).padStart(2, "0"),
      period,
    };
  }, [timePart]);

  const displayValue = useMemo(() => {
    if (!datePart) return "";
    const d = new Date(datePart + "T" + (timePart || "00:00"));
    if (Number.isNaN(d.getTime())) return "";
    return d.toLocaleDateString(undefined, {
      month: "short",
      day: "numeric",
      year: "numeric",
      hour: "numeric",
      minute: "2-digit",
    });
  }, [datePart, timePart]);

  function emitChange(newDate, newTime) {
    if (!newDate && !newTime) {
      onChange({ target: { value: "" } });
      return;
    }
    const d = newDate || datePart;
    const t = newTime || timePart || "12:00";
    if (d) onChange({ target: { value: `${d}T${t}` } });
  }

  function handleDateSelect(date) {
    if (!date) return;
    const y = date.getFullYear();
    const m = String(date.getMonth() + 1).padStart(2, "0");
    const d = String(date.getDate()).padStart(2, "0");
    const newDatePart = `${y}-${m}-${d}`;
    const newTime = timePart || (() => {
      const now = new Date();
      return `${String(now.getHours()).padStart(2, "0")}:00`;
    })();
    onChange({ target: { value: `${newDatePart}T${newTime}` } });
  }

  function handleTimeChange(newHour24, newMinute) {
    const h = String(newHour24).padStart(2, "0");
    const m = String(newMinute).padStart(2, "0");
    const newTime = `${h}:${m}`;
    if (!datePart) {
      const now = new Date();
      const y = now.getFullYear();
      const mo = String(now.getMonth() + 1).padStart(2, "0");
      const da = String(now.getDate()).padStart(2, "0");
      onChange({ target: { value: `${y}-${mo}-${da}T${newTime}` } });
    } else {
      onChange({ target: { value: `${datePart}T${newTime}` } });
    }
  }

  function incrementHour() {
    const newH = (hours24 + 1) % 24;
    handleTimeChange(newH, minutes);
  }
  function decrementHour() {
    const newH = (hours24 + 23) % 24;
    handleTimeChange(newH, minutes);
  }
  function incrementMinute() {
    const newM = (minutes + 15) % 60;
    handleTimeChange(hours24, newM);
  }
  function decrementMinute() {
    const newM = (minutes + 45) % 60;
    handleTimeChange(hours24, newM);
  }
  function togglePeriod() {
    const newH = period === "AM" ? hours24 + 12 : hours24 - 12;
    handleTimeChange(newH, minutes);
  }

  function handleClear() {
    onChange({ target: { value: "" } });
    setOpen(false);
  }

  return (
    <div className={cn("flex", className)}>
      <Popover open={open} onOpenChange={setOpen}>
        <PopoverTrigger asChild>
          <Button
            variant="outline"
            type="button"
            className={cn(
              "w-full justify-start text-left font-normal h-10",
              !datePart && "text-muted-foreground",
              className
            )}
          >
            <CalendarIcon className="mr-2 h-4 w-4 flex-shrink-0" />
            {displayValue || placeholder}
          </Button>
        </PopoverTrigger>
        <PopoverContent className="w-auto p-0 bg-white border shadow-lg rounded-lg overflow-hidden" align="start">
          {/* Calendar */}
          <Calendar
            mode="single"
            selected={selectedDate}
            onSelect={handleDateSelect}
            disabled={minDate ? { before: minDate } : undefined}
            initialFocus
          />

          {/* Styled Time Picker */}
          <div className="border-t bg-gray-50/50 px-4 py-3">
            <div className="flex items-center justify-between mb-2">
              <div className="flex items-center gap-1.5 text-xs font-medium text-gray-700">
                <Clock className="h-3.5 w-3.5" />
                Time
              </div>
              {datePart && (
                <span className="text-xs text-muted-foreground">
                  {formatDateShort(datePart)}
                </span>
              )}
            </div>

            <div className="flex items-center justify-center gap-2">
              {/* Hour */}
              <div className="flex flex-col items-center">
                <button
                  type="button"
                  onClick={incrementHour}
                  className="p-1 rounded hover:bg-gray-200 text-gray-600 transition-colors"
                >
                  <ChevronUp className="h-3.5 w-3.5" />
                </button>
                <div className="w-10 h-8 flex items-center justify-center bg-white border rounded text-sm font-semibold text-gray-900">
                  {String(displayHour).padStart(2, "0")}
                </div>
                <button
                  type="button"
                  onClick={decrementHour}
                  className="p-1 rounded hover:bg-gray-200 text-gray-600 transition-colors"
                >
                  <ChevronDown className="h-3.5 w-3.5" />
                </button>
              </div>

              {/* Colon separator */}
              <span className="text-lg font-bold text-gray-700 -mt-1">:</span>

              {/* Minute */}
              <div className="flex flex-col items-center">
                <button
                  type="button"
                  onClick={incrementMinute}
                  className="p-1 rounded hover:bg-gray-200 text-gray-600 transition-colors"
                >
                  <ChevronUp className="h-3.5 w-3.5" />
                </button>
                <div className="w-10 h-8 flex items-center justify-center bg-white border rounded text-sm font-semibold text-gray-900">
                  {displayMinute}
                </div>
                <button
                  type="button"
                  onClick={decrementMinute}
                  className="p-1 rounded hover:bg-gray-200 text-gray-600 transition-colors"
                >
                  <ChevronDown className="h-3.5 w-3.5" />
                </button>
              </div>

              {/* AM/PM toggle */}
              <button
                type="button"
                onClick={togglePeriod}
                className="ml-2 px-3 h-8 flex items-center justify-center bg-white border rounded text-sm font-semibold text-gray-900 hover:bg-gray-100 transition-colors"
              >
                {period}
              </button>
            </div>

            <p className="text-xs text-muted-foreground text-center mt-2">
              Minutes step: 15
            </p>
          </div>

          {/* Footer buttons */}
          <div className="flex items-center justify-between px-4 py-2.5 border-t bg-white">
            <Button
              type="button"
              size="sm"
              variant="ghost"
              onClick={handleClear}
              className="text-xs text-muted-foreground hover:text-destructive"
            >
              Clear
            </Button>
            <Button
              type="button"
              size="sm"
              onClick={() => setOpen(false)}
              className="text-xs"
            >
              Done
            </Button>
          </div>
        </PopoverContent>
      </Popover>
    </div>
  );
};

function formatDateShort(dateStr) {
  const d = new Date(dateStr + "T00:00:00");
  return d.toLocaleDateString(undefined, { month: "short", day: "numeric" });
}

export default DateTimePicker;
