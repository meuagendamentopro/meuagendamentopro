import React from "react";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "./select";

// Definir os países diretamente aqui para evitar problemas de importação
const countries = [
  { code: "BR", name: "Brasil", flag: "🇧🇷", dialCode: "+55" },
  { code: "US", name: "Estados Unidos", flag: "🇺🇸", dialCode: "+1" },
  { code: "PT", name: "Portugal", flag: "🇵🇹", dialCode: "+351" },
  { code: "ES", name: "Espanha", flag: "🇪🇸", dialCode: "+34" },
  { code: "AR", name: "Argentina", flag: "🇦🇷", dialCode: "+54" },
  { code: "CL", name: "Chile", flag: "🇨🇱", dialCode: "+56" },
  { code: "CO", name: "Colômbia", flag: "🇨🇴", dialCode: "+57" },
  { code: "MX", name: "México", flag: "🇲🇽", dialCode: "+52" },
  { code: "UY", name: "Uruguai", flag: "🇺🇾", dialCode: "+598" },
  { code: "PY", name: "Paraguai", flag: "🇵🇾", dialCode: "+595" },
];

interface CountrySelectProps {
  value: string;
  onChange: (value: string) => void;
  defaultCountry?: string;
}

export function CountrySelect({ value, onChange, defaultCountry = "BR" }: CountrySelectProps) {
  // Garantir que o valor inicial seja válido
  React.useEffect(() => {
    if (!value) {
      onChange(defaultCountry);
    }
  }, [value, onChange, defaultCountry]);

  // Encontrar o país atual
  const currentCountry = countries.find(c => c.code === value) || 
                        countries.find(c => c.code === defaultCountry) || 
                        countries[0];
  
  return (
    <Select value={value} onValueChange={onChange}>
      <SelectTrigger className="w-[70px]">
        {/* Mostrar apenas a sigla do país */}
        <div className="flex items-center justify-center w-full">
          <span>{currentCountry.code}</span>
        </div>
      </SelectTrigger>
      <SelectContent>
        {countries.map((country: { code: string; flag: string; name: string; dialCode: string }) => (
          <SelectItem key={country.code} value={country.code}>
            <div className="flex items-center">
              <span className="mr-2">{country.flag}</span>
              <span>{country.code}</span>
            </div>
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
  );
}
