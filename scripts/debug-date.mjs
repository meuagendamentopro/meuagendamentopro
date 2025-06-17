console.log('=== DEBUG DA DATA 16/06/2025 ===');

// Testar diferentes formas de criar a data
const date1 = new Date('2025-06-16');
const date2 = new Date('2025-06-16T00:00:00');
const date3 = new Date('2025-06-16T12:00:00');
const date4 = new Date(2025, 5, 16); // Mês é 0-indexado

console.log('Testando diferentes formas de criar a data:');
console.log(`new Date('2025-06-16'):`);
console.log(`  - getDay(): ${date1.getDay()}`);
console.log(`  - toString(): ${date1.toString()}`);
console.log(`  - toLocaleDateString(): ${date1.toLocaleDateString('pt-BR', {weekday: 'long'})}`);

console.log(`\nnew Date('2025-06-16T00:00:00'):`);
console.log(`  - getDay(): ${date2.getDay()}`);
console.log(`  - toString(): ${date2.toString()}`);
console.log(`  - toLocaleDateString(): ${date2.toLocaleDateString('pt-BR', {weekday: 'long'})}`);

console.log(`\nnew Date('2025-06-16T12:00:00'):`);
console.log(`  - getDay(): ${date3.getDay()}`);
console.log(`  - toString(): ${date3.toString()}`);
console.log(`  - toLocaleDateString(): ${date3.toLocaleDateString('pt-BR', {weekday: 'long'})}`);

console.log(`\nnew Date(2025, 5, 16):`);
console.log(`  - getDay(): ${date4.getDay()}`);
console.log(`  - toString(): ${date4.toString()}`);
console.log(`  - toLocaleDateString(): ${date4.toLocaleDateString('pt-BR', {weekday: 'long'})}`);

// Verificar o fuso horário
console.log(`\n=== INFORMAÇÕES DE FUSO HORÁRIO ===`);
console.log(`Timezone offset: ${date1.getTimezoneOffset()} minutos`);
console.log(`UTC: ${date1.toUTCString()}`);
console.log(`ISO: ${date1.toISOString()}`);

// Verificar calendário real para junho de 2025
console.log(`\n=== CALENDÁRIO JUNHO 2025 ===`);
for (let day = 14; day <= 18; day++) {
  const testDate = new Date(2025, 5, day); // Mês 5 = junho
  console.log(`${day}/06/2025: ${testDate.toLocaleDateString('pt-BR', {weekday: 'long'})} (getDay: ${testDate.getDay()})`);
} 