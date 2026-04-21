"use client";

import React, { useState } from "react";
import { DayPicker } from "react-day-picker";
import { format } from "date-fns";
import { CalendarIcon } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { cn } from "@/lib/utils";

import "react-day-picker/style.css";

const DatePicker = ({
  value,
  onChange,
  placeholder = "Select a date",
  className,
  ...props
}) => {
  const [open, setOpen] = useState(false);

  // Convert string date to Date object for DayPicker (handle UTC properly)
  const selectedDate = value ? new Date(value + 'T00:00:00') : undefined;

  const handleSelect = (date) => {
    if (date) {
      // Format date as YYYY-MM-DD for form submission (use UTC to avoid timezone issues)
      const formattedDate = format(date, "yyyy-MM-dd");
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
          {value ? format(new Date(value + 'T00:00:00'), "PPP") : placeholder}
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
