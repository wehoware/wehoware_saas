import React, { createContext, useContext, useState, useEffect, useRef } from "react";

const SelectContext = createContext({});

const Select = ({ children, value, onValueChange, defaultValue }) => {
  const [selectedValue, setSelectedValue] = useState(value || defaultValue || "");

  useEffect(() => {
    if (value !== undefined) {
      setSelectedValue(value);
    }
  }, [value]);

  const handleValueChange = (newValue) => {
    setSelectedValue(newValue);
    if (onValueChange) {
      onValueChange(newValue);
    }
  };

  return (
    <SelectContext.Provider value={{ value: selectedValue, onValueChange: handleValueChange }}>
      {children}
    </SelectContext.Provider>
  );
};

const SelectTrigger = React.forwardRef(({ className, children, ...props }, ref) => {
  const { value } = useContext(SelectContext);
  
  return (
    <button
      ref={ref}
      className={`flex h-10 w-full items-center justify-between rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50 ${className}`}
      {...props}
    >
      {children}
      <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="ml-2 h-4 w-4 opacity-50">
        <path d="m6 9 6 6 6-6"/>
      </svg>
    </button>
  );
});

SelectTrigger.displayName = "SelectTrigger";

const SelectContent = React.forwardRef(({ className, children, ...props }, ref) => {
  const [isOpen, setIsOpen] = useState(false);
  const contentRef = useRef(null);

  useEffect(() => {
    const handleClickOutside = (event) => {
      if (contentRef.current && !contentRef.current.contains(event.target)) {
        setIsOpen(false);
      }
    };

    if (isOpen) {
      document.addEventListener("mousedown", handleClickOutside);
    }

    return () => {
      document.removeEventListener("mousedown", handleClickOutside);
    };
  }, [isOpen]);

  useEffect(() => {
    const trigger = document.querySelector("[data-select-trigger='true']");
    if (trigger) {
      const handleTriggerClick = () => {
        setIsOpen(prev => !prev);
      };
      
      trigger.addEventListener("click", handleTriggerClick);
      return () => {
        trigger.removeEventListener("click", handleTriggerClick);
      };
    }
  }, []);

  if (!isOpen) return null;

  return (
    <div
      ref={contentRef}
      className={`relative z-50 min-w-[8rem] overflow-hidden rounded-md border bg-popover text-popover-foreground shadow-md animate-in fade-in-80 ${className}`}
      {...props}
    >
      <div className="w-full p-1">{children}</div>
    </div>
  );
});

SelectContent.displayName = "SelectContent";

const SelectItem = React.forwardRef(({ className, children, value, ...props }, ref) => {
  const { value: selectedValue, onValueChange } = useContext(SelectContext);
  const isSelected = selectedValue === value;

  return (
    <div
      ref={ref}
      className={`relative flex w-full cursor-default select-none items-center rounded-sm py-1.5 pl-8 pr-2 text-sm outline-none focus:bg-accent focus:text-accent-foreground data-[disabled]:pointer-events-none data-[disabled]:opacity-50 ${
        isSelected ? "bg-accent text-accent-foreground" : ""
      } ${className}`}
      onClick={() => onValueChange(value)}
      {...props}
    >
      <span className="absolute left-2 flex h-3.5 w-3.5 items-center justify-center">
        {isSelected && (
          <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="h-4 w-4">
            <path d="M20 6 9 17l-5-5"/>
          </svg>
        )}
      </span>
      <span className="text-sm">{children}</span>
    </div>
  );
});

SelectItem.displayName = "SelectItem";

const SelectValue = React.forwardRef(({ className, placeholder, ...props }, ref) => {
  const { value } = useContext(SelectContext);
  
  return (
    <span className={`block truncate ${value ? "" : "text-muted-foreground"} ${className}`} {...props}>
      {value || placeholder}
    </span>
  );
});

SelectValue.displayName = "SelectValue";

export { Select, SelectTrigger, SelectContent, SelectItem, SelectValue };
