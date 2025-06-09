// Lista de países com código, bandeira e código de discagem
export const countries = [
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
  { code: "PE", name: "Peru", flag: "🇵🇪", dialCode: "+51" },
  { code: "BO", name: "Bolívia", flag: "🇧🇴", dialCode: "+591" },
  { code: "VE", name: "Venezuela", flag: "🇻🇪", dialCode: "+58" },
  { code: "EC", name: "Equador", flag: "🇪🇨", dialCode: "+593" },
  { code: "CA", name: "Canadá", flag: "🇨🇦", dialCode: "+1" },
  { code: "FR", name: "França", flag: "🇫🇷", dialCode: "+33" },
  { code: "IT", name: "Itália", flag: "🇮🇹", dialCode: "+39" },
  { code: "DE", name: "Alemanha", flag: "🇩🇪", dialCode: "+49" },
  { code: "UK", name: "Reino Unido", flag: "🇬🇧", dialCode: "+44" },
  { code: "JP", name: "Japão", flag: "🇯🇵", dialCode: "+81" },
  { code: "CN", name: "China", flag: "🇨🇳", dialCode: "+86" },
  { code: "AU", name: "Austrália", flag: "🇦🇺", dialCode: "+61" },
  { code: "NZ", name: "Nova Zelândia", flag: "🇳🇿", dialCode: "+64" },
];

// Função para obter o código de discagem de um país pelo código do país
export function getDialCodeByCountry(countryCode: string): string {
  const country = countries.find(c => c.code === countryCode);
  return country ? country.dialCode : "+55"; // Retorna o código do Brasil como padrão
}

// Função para obter o país pelo código de discagem
export function getCountryByDialCode(dialCode: string): string {
  const country = countries.find(c => c.dialCode === dialCode);
  return country ? country.code : "BR"; // Retorna Brasil como padrão
}

// Função para obter o nome do país pelo código
export function getCountryNameByCode(countryCode: string): string {
  const country = countries.find(c => c.code === countryCode);
  return country ? country.name : "Brasil"; // Retorna Brasil como padrão
}

// Função para extrair o código de discagem de um número de telefone
export function extractDialCode(phoneNumber: string): { dialCode: string, number: string } {
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
