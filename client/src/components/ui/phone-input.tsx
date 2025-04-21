import React, { useEffect, useState } from "react";
import { Input } from "./input";
import { formatPhoneNumber } from "@/lib/utils";

interface PhoneInputProps extends Omit<React.InputHTMLAttributes<HTMLInputElement>, 'value' | 'onChange'> {
  value: string;
  onChange: (value: string) => void;
}

export function PhoneInput({ value, onChange, ...props }: PhoneInputProps) {
  const [displayValue, setDisplayValue] = useState("");
  
  // Format initial value on mount
  useEffect(() => {
    setDisplayValue(formatPhoneNumber(value || ""));
  }, []);

  // Handle input changes
  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const input = e.target.value;
    // Set display value to formatted input
    setDisplayValue(formatPhoneNumber(input));
    // Pass raw numeric value to parent
    onChange(input.replace(/\D/g, ''));
  };

  return (
    <Input
      {...props}
      type="tel"
      value={displayValue}
      onChange={handleChange}
      placeholder={props.placeholder || "(xx) xxxxx-xxxx"}
    />
  );
}