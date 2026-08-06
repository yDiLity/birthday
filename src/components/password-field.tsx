"use client";

import { useState } from "react";
import { Check } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

const REQUIREMENTS = [
  { label: "Минимум 8 символов", test: (value: string) => value.length >= 8 },
  {
    label: "Заглавная буква (A–Z)",
    test: (value: string) => /[A-Z]/.test(value),
  },
  {
    label: "Строчная буква (a–z)",
    test: (value: string) => /[a-z]/.test(value),
  },
  { label: "Цифра (0–9)", test: (value: string) => /[0-9]/.test(value) },
];

interface PasswordFieldProps {
  id: string;
  name: string;
  label: string;
  placeholder?: string;
  autoComplete?: string;
  required?: boolean;
  className?: string;
  labelClassName?: string;
}

export function PasswordField({
  id,
  name,
  label,
  placeholder,
  autoComplete = "new-password",
  required,
  className,
  labelClassName = "block text-sm",
}: PasswordFieldProps) {
  const [value, setValue] = useState("");

  return (
    <div className="space-y-2">
      <Label htmlFor={id} className={labelClassName}>
        {label}
      </Label>
      <Input
        id={id}
        type="password"
        name={name}
        placeholder={placeholder}
        autoComplete={autoComplete}
        required={required}
        minLength={8}
        value={value}
        onChange={(e) => setValue(e.target.value)}
        className={className}
      />
      <ul className="space-y-1 text-sm">
        {REQUIREMENTS.map(({ label: requirementLabel, test }) => {
          const met = test(value);
          return (
            <li
              key={requirementLabel}
              className="flex items-center gap-2"
            >
              <Check
                size={16}
                className={met ? "text-green-500" : "text-gray-400"}
              />
              <span
                className={
                  met ? "text-green-600" : "text-muted-foreground"
                }
              >
                {requirementLabel}
              </span>
            </li>
          );
        })}
      </ul>
    </div>
  );
}
