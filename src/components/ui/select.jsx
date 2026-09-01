// components/ui/select.jsx
import React from "react";
import * as SelectPrimitive from "@radix-ui/react-select";
import { ChevronDown, Check, ChevronUp, ChevronDown as ScrollDown } from "lucide-react";

const EMPTY_SENTINEL = "__EMPTY__";

/**
 * SelectInput: Reusable select component using Radix UI and Lucide icons
 *
 * Props:
 * - id: string
 * - name: string
 * - label: string
 * - options: string[] | {value: string, label: string}[]
 * - value: string
 * - onChange: (e: { target: { name: string; value: string } }) => void
 */
export default function SelectInput({
  id,
  name,
  options,
  value,
  onChange,
  required,
  placeholder: customPlaceholder,
  className,
  ...props
}) {
  // Normalize options to always handle [{value, label}] format
  // and map empty-string values to a sentinel so Radix UI doesn't crash
  const normalizedOptions = options.map(opt => {
    if (typeof opt === 'string') {
      return { value: opt || EMPTY_SENTINEL, label: opt };
    }
    return { value: opt.value || EMPTY_SENTINEL, label: opt.label };
  });

  // Handle value change without causing an infinite update loop
  const handleValueChange = (newValue) => {
    const actualValue = newValue === EMPTY_SENTINEL ? "" : newValue;
    if (name === "priority") {
      console.log('[SelectInput] handleValueChange name:', name, 'newValue:', newValue, 'actualValue:', actualValue, 'current value:', value);
    }
    if (actualValue !== value) {
      onChange({ target: { name, value: actualValue } });
    }
  };

  const valueForRadix = value === "" ? EMPTY_SENTINEL : value;

  return (
    <div className="space-y-2">
      <SelectPrimitive.Root
        value={valueForRadix}
        onValueChange={handleValueChange}
        required={required}
      >
        <SelectPrimitive.Trigger
          id={id}
          name={name}
          className={`flex h-9 w-full items-center justify-between whitespace-nowrap rounded-md border border-input bg-transparent px-3 py-2 text-sm shadow-sm transition-colors hover:border-foreground/30 placeholder:text-muted-foreground focus:outline-none focus:ring-1 focus:ring-ring disabled:cursor-not-allowed disabled:opacity-50 [&>span]:line-clamp-1 ${className || ''}`}
          {...props}
        >
          <SelectPrimitive.Value placeholder={customPlaceholder || (name ? `Select a ${name.toLowerCase()}` : 'Select an option')} />
          <SelectPrimitive.Icon asChild>
            <ChevronDown className="h-4 w-4 opacity-60 shrink-0" />
          </SelectPrimitive.Icon>
        </SelectPrimitive.Trigger>

        <SelectPrimitive.Portal>
          <SelectPrimitive.Content
            className="relative z-50 max-h-96 min-w-[8rem] overflow-hidden rounded-md border bg-popover text-popover-foreground shadow-md data-[state=open]:animate-in data-[state=closed]:animate-out data-[state=closed]:fade-out-0 data-[state=open]:fade-in-0 data-[state=closed]:zoom-out-95 data-[state=open]:zoom-in-95 data-[side=bottom]:slide-in-from-top-2 data-[side=top]:slide-in-from-bottom-2"
            position="popper"
            sideOffset={4}
          >
            <SelectPrimitive.ScrollUpButton className="flex h-6 items-center justify-center cursor-default">
              <ChevronUp className="h-4 w-4 text-muted-foreground" />
            </SelectPrimitive.ScrollUpButton>
            <SelectPrimitive.Viewport className="p-1">
              {normalizedOptions.map((opt) => (
                <SelectPrimitive.Item
                  key={opt.value}
                  value={opt.value}
                  className="relative flex w-full cursor-default select-none items-center rounded-sm py-1.5 pl-8 pr-2 text-sm outline-none focus:bg-accent focus:text-accent-foreground data-[disabled]:pointer-events-none data-[disabled]:opacity-50 transition-colors"
                >
                  <span className="absolute left-2 flex h-3.5 w-3.5 items-center justify-center">
                    <SelectPrimitive.ItemIndicator>
                      <Check className="h-4 w-4 text-primary" />
                    </SelectPrimitive.ItemIndicator>
                  </span>
                  <SelectPrimitive.ItemText>{opt.label}</SelectPrimitive.ItemText>
                </SelectPrimitive.Item>
              ))}
            </SelectPrimitive.Viewport>
            <SelectPrimitive.ScrollDownButton className="flex h-6 items-center justify-center cursor-default">
              <ChevronDown className="h-4 w-4 text-muted-foreground" />
            </SelectPrimitive.ScrollDownButton>
          </SelectPrimitive.Content>
        </SelectPrimitive.Portal>
      </SelectPrimitive.Root>
    </div>
  );
}

const Select = SelectPrimitive.Root;
const SelectValue = SelectPrimitive.Value;

const SelectTrigger = React.forwardRef(({ className, children, ...props }, ref) => (
  <SelectPrimitive.Trigger
    ref={ref}
    className={`flex h-9 w-full items-center justify-between whitespace-nowrap rounded-md border border-input bg-transparent px-3 py-2 text-sm shadow-sm transition-colors hover:border-foreground/30 placeholder:text-muted-foreground focus:outline-none focus:ring-1 focus:ring-ring disabled:cursor-not-allowed disabled:opacity-50 [&>span]:line-clamp-1 ${className || ''}`}
    {...props}
  >
    {children}
    <SelectPrimitive.Icon asChild>
      <ChevronDown className="h-4 w-4 opacity-60 shrink-0" />
    </SelectPrimitive.Icon>
  </SelectPrimitive.Trigger>
));
SelectTrigger.displayName = SelectPrimitive.Trigger.displayName;

const SelectContent = React.forwardRef(({ className, children, ...props }, ref) => (
  <SelectPrimitive.Portal>
    <SelectPrimitive.Content
      ref={ref}
      className={`relative z-50 max-h-96 min-w-[8rem] overflow-hidden rounded-md border bg-popover text-popover-foreground shadow-md data-[state=open]:animate-in data-[state=closed]:animate-out data-[state=closed]:fade-out-0 data-[state=open]:fade-in-0 data-[state=closed]:zoom-out-95 data-[state=open]:zoom-in-95 data-[side=bottom]:slide-in-from-top-2 data-[side=top]:slide-in-from-bottom-2 ${className || ''}`}
      position="popper"
      sideOffset={4}
      {...props}
    >
      <SelectPrimitive.ScrollUpButton className="flex h-6 items-center justify-center cursor-default">
        <ChevronUp className="h-4 w-4 text-muted-foreground" />
      </SelectPrimitive.ScrollUpButton>
      <SelectPrimitive.Viewport className="p-1">
        {children}
      </SelectPrimitive.Viewport>
      <SelectPrimitive.ScrollDownButton className="flex h-6 items-center justify-center cursor-default">
        <ChevronDown className="h-4 w-4 text-muted-foreground" />
      </SelectPrimitive.ScrollDownButton>
    </SelectPrimitive.Content>
  </SelectPrimitive.Portal>
));
SelectContent.displayName = SelectPrimitive.Content.displayName;

const SelectItem = React.forwardRef(({ className, children, ...props }, ref) => (
  <SelectPrimitive.Item
    ref={ref}
    className={`relative flex w-full cursor-default select-none items-center rounded-sm py-1.5 pl-8 pr-2 text-sm outline-none focus:bg-accent focus:text-accent-foreground data-[disabled]:pointer-events-none data-[disabled]:opacity-50 transition-colors ${className || ''}`}
    {...props}
  >
    <span className="absolute left-2 flex h-3.5 w-3.5 items-center justify-center">
      <SelectPrimitive.ItemIndicator>
        <Check className="h-4 w-4 text-primary" />
      </SelectPrimitive.ItemIndicator>
    </span>
    <SelectPrimitive.ItemText>{children}</SelectPrimitive.ItemText>
  </SelectPrimitive.Item>
));
SelectItem.displayName = SelectPrimitive.Item.displayName;

export { Select, SelectContent, SelectItem, SelectTrigger, SelectValue };
