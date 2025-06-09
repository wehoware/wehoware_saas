// components/ui/select.jsx
import React from "react";
import * as Select from "@radix-ui/react-select";
import { ChevronDown, Check } from "lucide-react";

/**
 * SelectInput: Reusable select component using Radix UI and Lucide icons
 *
 * Props:
 * - id: string
 * - name: string
 * - label: string
 * - options: string[]
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
  const normalizedOptions = options.map(opt => {
    if (typeof opt === 'string') {
      return { value: opt, label: opt };
    }
    return opt;
  });

  // Handle value change without causing an infinite update loop
  const handleValueChange = (newValue) => {
    if (newValue !== value) {
      onChange({ target: { name, value: newValue } });
    }
  };
  
  return (
    <div className="space-y-2">
      <Select.Root
        value={value}
        onValueChange={handleValueChange}
        required={required}
      >
        <Select.Trigger
          id={id}
          name={name}
          className={`inline-flex items-center justify-between w-full px-4 py-2 bg-white border border-gray-300 rounded-lg shadow-sm hover:border-gray-400 focus:outline-none focus:ring-2 focus:ring-blue-500 ${className || ''}`}
          {...props}
        >
          {/* Use custom placeholder if provided, otherwise generate one if name exists, else use a generic default */}
          <Select.Value placeholder={customPlaceholder || (name ? `Select a ${name.toLowerCase()}` : 'Select an option')} />
          <Select.Icon>
            <ChevronDown className="text-gray-500" size={20} />
          </Select.Icon>
        </Select.Trigger>

        <Select.Portal>
          <Select.Content className="bg-white rounded-lg shadow-lg mt-1 overflow-hidden z-50">
            <Select.ScrollUpButton className="flex items-center justify-center h-6 cursor-default">
              ↑
            </Select.ScrollUpButton>
            <Select.Viewport>
              {normalizedOptions.map((opt) => (
                <Select.Item
                  key={opt.value}
                  value={opt.value}
                  className="px-4 py-2 flex items-center justify-between cursor-pointer hover:bg-gray-100"
                >
                  <Select.ItemText>{opt.label}</Select.ItemText>
                  <Select.ItemIndicator>
                    <Check className="text-blue-500" size={16} />
                  </Select.ItemIndicator>
                </Select.Item>
              ))}
            </Select.Viewport>
            <Select.ScrollDownButton className="flex items-center justify-center h-6 cursor-default">
              ↓
            </Select.ScrollDownButton>
          </Select.Content>
        </Select.Portal>
      </Select.Root>
    </div>
  );
}
