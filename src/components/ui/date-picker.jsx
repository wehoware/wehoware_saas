"use client";

import React, { useState } from "react";
import { DayPicker } from "react-day-picker";
import { CalendarIcon } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { cn } from "@/lib/utils";

import "react-day-picker/style.css";

// Format date using UTC to avoid timezone shifts
const formatUTCDate = (dateStr) => {
  if (!dateStr) return "";
  try {
    const date = new Date(dateStr + 'T00:00:00Z');
    if (Number.isNaN(date.getTime())) return "";
    const year = date.getUTCFullYear();
    const month = date.getUTCMonth() + 1;
    const day = date.getUTCDate();
    return `${month}/${day}/${year}`;
  } catch {
    return "";
  }
};

const DatePicker = ({
  value,
  onChange,
  placeholder = "Select a date",
  className,
  ...props
}) => {
  const [open, setOpen] = useState(false);

  // Convert string date to Date object for DayPicker (handle UTC properly)
  const selectedDate = value ? new Date(value + 'T00:00:00Z') : undefined;

  const handleSelect = (date) => {
    if (date) {
      // Format date as YYYY-MM-DD for form submission (use UTC to avoid timezone issues)
      const year = date.getUTCFullYear();
      const month = String(date.getUTCMonth() + 1).padStart(2, '0');
      const day = String(date.getUTCDate()).padStart(2, '0');
      const formattedDate = `${year}-${month}-${day}`;
      onChange({ target: { name: props.name, value: formattedDate } });
    } else {
      onChange({ target: { name: props.name, value: "" } });
    }
    setOpen(false);
  };

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button
          variant="outline"
          className={cn(
            "w-full justify-start text-left font-normal",
            !value && "text-muted-foreground",
            className
          )}
          {...props}
        >
          <CalendarIcon className="mr-2 h-4 w-4" />
          {value ? formatUTCDate(value) : placeholder}
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-auto p-0" align="start">
        <DayPicker
          mode="single"
          selected={selectedDate}
          onSelect={handleSelect}
          initialFocus
          className="rounded-md border"
        />
      </PopoverContent>
    </Popover>
  );
};

export default DatePicker;