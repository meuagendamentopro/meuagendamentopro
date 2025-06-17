console.log('Verificando segundas-feiras em junho de 2025:');
for(let i=1; i<=30; i++) { 
  const date = new Date(`2025-06-${i.toString().padStart(2, '0')}`); 
  if (date.getDay() === 1) { // Segunda-feira
    console.log(`${i}/06/2025 é segunda-feira`); 
  }
} 