import React, { useEffect, useState } from "react";
import { Input } from "./input";
import { formatPhoneNumber } from "@/lib/utils";
import { CountrySelect } from "./country-select";

// Funções auxiliares para manipulação de números de telefone
function getDialCodeByCountry(countryCode: string): string {
  const country = countries.find(c => c.code === countryCode);
  return country ? country.dialCode : "+55"; // Retorna o código do Brasil como padrão
}

function getCountryByDialCode(dialCode: string): string {
  const country = countries.find(c => c.dialCode === dialCode);
  return country ? country.code : "BR"; // Retorna Brasil como padrão
}

function extractDialCode(phoneNumber: string): { dialCode: string, number: string } {
  // Remove caracteres não numéricos
  const cleaned = phoneNumber.replace(/\D/g, '');
  
  // Tenta identificar o código de discagem
  for (const country of countries) {
    const dialCode = country.dialCode.replace('+', '');
    if (cleaned.startsWith(dialCode)) {
      return {
        dialCode: country.dialCode,
        number: cleaned.substring(dialCode.length)
      };
    }
  }
  
  // Se não encontrar, assume que é um número brasileiro sem código internacional
  return {
    dialCode: "+55",
    number: cleaned
  };
}

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

interface PhoneInputProps extends Omit<React.InputHTMLAttributes<HTMLInputElement>, 'value' | 'onChange'> {
  value: string;
  onChange: (value: string) => void;
  onCountryChange?: (country: string) => void;
  defaultCountry?: string;
}

export const PhoneInput = React.forwardRef<
  HTMLInputElement,
  PhoneInputProps
>(({ 
  value, 
  onChange, 
  onCountryChange,
  defaultCountry = "BR",
  ...props 
}, ref) => {
  const [displayValue, setDisplayValue] = useState("");
  const [countryCode, setCountryCode] = useState(defaultCountry);
  const [fullNumber, setFullNumber] = useState("");
  
  // Inicialização - extrair código do país se o número já tiver um
  useEffect(() => {
    if (value && value.startsWith("+")) {
      const { dialCode, number } = extractDialCode(value);
      // Atualizar o país baseado no código de discagem
      const countryFromDialCode = getCountryByDialCode(dialCode);
      setCountryCode(countryFromDialCode);
      // Atualizar o número sem o código de discagem
      setFullNumber(number);
    } else {
      setFullNumber(value);
    }
  }, []);
  
  // Format value when it changes or on mount
  useEffect(() => {
    setDisplayValue(formatPhoneNumber(fullNumber || "", countryCode));
  }, [fullNumber, countryCode]);

  // Handle input changes
  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const input = e.target.value;
    const numericValue = input.replace(/\D/g, '');
    
    // Atualizar o número sem o código de discagem
    setFullNumber(numericValue);
    
    // Passar o valor completo (com código de discagem) para o componente pai
    const dialCode = getDialCodeByCountry(countryCode);
    onChange(`${dialCode}${numericValue}`);
  };
  
  // Handle country changes
  const handleCountryChange = (country: string) => {
    setCountryCode(country);
    
    // Notificar o componente pai sobre a mudança de país
    if (onCountryChange) {
      onCountryChange(country);
    }
    
    // Atualizar o valor completo com o novo código de discagem
    const dialCode = getDialCodeByCountry(country);
    onChange(`${dialCode}${fullNumber}`);
  };

  return (
    <div className="flex space-x-2">
      <CountrySelect 
        value={countryCode} 
        onChange={handleCountryChange} 
        defaultCountry={defaultCountry} 
      />
      <Input
        {...props}
        ref={ref}
        type="tel"
        value={displayValue}
        onChange={handleChange}
        placeholder={props.placeholder || "(xx) xxxxx-xxxx"}
        className="flex-1"
      />
    </div>
  );
});

PhoneInput.displayName = "PhoneInput";