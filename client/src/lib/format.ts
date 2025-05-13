/**
 * Formata um número de telefone brasileiro para o formato (XX) XXXXX-XXXX
 * @param phone Número de telefone (pode conter ou não formatação)
 * @returns Número formatado ou o valor original caso não seja um telefone válido
 */
export function formatPhoneNumber(phone: string): string {
  if (!phone) return '';
  
  // Remove todos os caracteres não numéricos
  const digits = phone.replace(/\D/g, '');
  
  // Verifica se parece um número de telefone brasileiro (com ou sem DDD)
  if (digits.length < 8 || digits.length > 13) {
    return phone; // Retorna o original se não parecer um telefone válido
  }
  
  // Verifica se tem código do país (55)
  if (digits.startsWith('55') && digits.length >= 10) {
    // Formato com código do país: +55 (XX) XXXXX-XXXX
    if (digits.length === 12 || digits.length === 13) {
      // Com 9 dígito
      const ddd = digits.substring(2, 4);
      const firstPart = digits.substring(4, 9);
      const secondPart = digits.substring(9);
      return `+55 (${ddd}) ${firstPart}-${secondPart}`;
    } else {
      // Sem 9 dígito
      const ddd = digits.substring(2, 4);
      const firstPart = digits.substring(4, 8);
      const secondPart = digits.substring(8);
      return `+55 (${ddd}) ${firstPart}-${secondPart}`;
    }
  }
  
  // Formato sem código do país
  if (digits.length === 10 || digits.length === 11) {
    // Com DDD
    const ddd = digits.substring(0, 2);
    
    if (digits.length === 11) {
      // Com 9 dígito
      const firstPart = digits.substring(2, 7);
      const secondPart = digits.substring(7);
      return `(${ddd}) ${firstPart}-${secondPart}`;
    } else {
      // Sem 9 dígito
      const firstPart = digits.substring(2, 6);
      const secondPart = digits.substring(6);
      return `(${ddd}) ${firstPart}-${secondPart}`;
    }
  } else if (digits.length === 8 || digits.length === 9) {
    // Sem DDD
    if (digits.length === 9) {
      // Com 9 dígito
      const firstPart = digits.substring(0, 5);
      const secondPart = digits.substring(5);
      return `${firstPart}-${secondPart}`;
    } else {
      // Sem 9 dígito
      const firstPart = digits.substring(0, 4);
      const secondPart = digits.substring(4);
      return `${firstPart}-${secondPart}`;
    }
  }
  
  // Fallback para qualquer outro formato
  return phone;
}