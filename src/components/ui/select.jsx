// components/ui/select.jsx
import React from "react";
import * as SelectPrimitive from "@radix-ui/react-select";
import { ChevronDown, Check } from "lucide-react";

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
          className={`inline-flex items-center justify-between w-full px-4 py-2 bg-white border border-gray-300 rounded-lg shadow-sm hover:border-gray-400 focus:outline-none focus:ring-2 focus:ring-blue-500 ${className || ''}`}
          {...props}
        >
          {/* Use custom placeholder if provided, otherwise generate one if name exists, else use a generic default */}
          <SelectPrimitive.Value placeholder={customPlaceholder || (name ? `Select a ${name.toLowerCase()}` : 'Select an option')} />
          <SelectPrimitive.Icon>
            <ChevronDown className="text-gray-500" size={20} />
          </SelectPrimitive.Icon>
        </SelectPrimitive.Trigger>

        <SelectPrimitive.Portal>
          <SelectPrimitive.Content className="bg-white rounded-lg shadow-lg mt-1 overflow-hidden z-50">
            <SelectPrimitive.ScrollUpButton className="flex items-center justify-center h-6 cursor-default">
              ↑
            </SelectPrimitive.ScrollUpButton>
            <SelectPrimitive.Viewport>
              {normalizedOptions.map((opt) => (
                <SelectPrimitive.Item
                  key={opt.value}
                  value={opt.value}
                  className="px-4 py-2 flex items-center justify-between cursor-pointer hover:bg-gray-100"
                >
                  <SelectPrimitive.ItemText>{opt.label}</SelectPrimitive.ItemText>
                  <SelectPrimitive.ItemIndicator>
                    <Check className="text-blue-500" size={16} />
                  </SelectPrimitive.ItemIndicator>
                </SelectPrimitive.Item>
              ))}
            </SelectPrimitive.Viewport>
            <SelectPrimitive.ScrollDownButton className="flex items-center justify-center h-6 cursor-default">
              ↓
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
    className={`inline-flex items-center justify-between w-full px-4 py-2 bg-white border border-gray-300 rounded-lg shadow-sm hover:border-gray-400 focus:outline-none focus:ring-2 focus:ring-blue-500 ${className || ''}`}
    {...props}
  >
    {children}
    <SelectPrimitive.Icon asChild>
      <ChevronDown className="text-gray-500" size={20} />
    </SelectPrimitive.Icon>
  </SelectPrimitive.Trigger>
));
SelectTrigger.displayName = SelectPrimitive.Trigger.displayName;

const SelectContent = React.forwardRef(({ className, children, ...props }, ref) => (
  <SelectPrimitive.Portal>
    <SelectPrimitive.Content
      ref={ref}
      className={`bg-white rounded-lg shadow-lg mt-1 overflow-hidden z-50 ${className || ''}`}
      {...props}
    >
      <SelectPrimitive.ScrollUpButton className="flex items-center justify-center h-6 cursor-default">
        ↑
      </SelectPrimitive.ScrollUpButton>
      <SelectPrimitive.Viewport>
        {children}
      </SelectPrimitive.Viewport>
      <SelectPrimitive.ScrollDownButton className="flex items-center justify-center h-6 cursor-default">
        ↓
      </SelectPrimitive.ScrollDownButton>
    </SelectPrimitive.Content>
  </SelectPrimitive.Portal>
));
SelectContent.displayName = SelectPrimitive.Content.displayName;

const SelectItem = React.forwardRef(({ className, children, ...props }, ref) => (
  <SelectPrimitive.Item
    ref={ref}
    className={`px-4 py-2 flex items-center justify-between cursor-pointer hover:bg-gray-100 ${className || ''}`}
    {...props}
  >
    <SelectPrimitive.ItemText>{children}</SelectPrimitive.ItemText>
    <SelectPrimitive.ItemIndicator>
      <Check className="text-blue-500" size={16} />
    </SelectPrimitive.ItemIndicator>
  </SelectPrimitive.Item>
));
SelectItem.displayName = SelectPrimitive.Item.displayName;

export { Select, SelectContent, SelectItem, SelectTrigger, SelectValue };