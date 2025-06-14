import React from "react";
import * as Select from "@radix-ui/react-select";
import { ChevronDown, Check } from "lucide-react";

const EMPTY_VALUE_INTERNAL = "__EMPTY_VALUE_PLACEHOLDER__"; // Internal placeholder for empty string values

export default function FilterableSelectInput({
  id,
  name,
  options,
  value, // This can be an empty string for 'all' or 'none'
  onChange,
  required,
  placeholder: customPlaceholder,
  className,
  ...props
}) {
  // Normalize options: map empty string values to the internal placeholder
  const normalizedOptions = options.map(opt => {
    let currentOpt = typeof opt === 'string' ? { value: opt, label: opt } : opt;
    if (currentOpt.value === "") {
      return { ...currentOpt, value: EMPTY_VALUE_INTERNAL };
    }
    return currentOpt;
  });

  const handleValueChange = (newValueFromRadix) => {
    // If Radix gives back the internal placeholder, convert it back to an empty string for the parent
    const actualNewValue = newValueFromRadix === EMPTY_VALUE_INTERNAL ? "" : newValueFromRadix;
    if (actualNewValue !== value) {
      onChange({ target: { name, value: actualNewValue } });
    }
  };

  // Determine the value to pass to Select.Root: if parent's value is empty string, use internal placeholder
  const valueForRadix = value === "" ? EMPTY_VALUE_INTERNAL : value;

  return (
    <div className="space-y-2">
      <Select.Root
        value={valueForRadix}
        onValueChange={handleValueChange}
        required={required}
      >
        <Select.Trigger
          id={id}
          name={name}
          className={`inline-flex items-center justify-between w-full px-4 py-2 bg-white border border-gray-300 rounded-lg shadow-sm hover:border-gray-400 focus:outline-none focus:ring-2 focus:ring-blue-500 ${className || ''}`}
          {...props}
        >
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
                  key={opt.value} // This will now be EMPTY_VALUE_INTERNAL for the 'all' option
                  value={opt.value} // Radix Item value is never an empty string
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
