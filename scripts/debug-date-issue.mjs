// Script para debugar o problema de interpretação de datas

console.log('=== DEBUG DE DATAS ===');

// Teste com diferentes formas de criar a data
const dateString = '2025-06-16';
const dateISO = '2025-06-16T10:00:00.000Z';

console.log('\n1. Testando new Date(string):');
const date1 = new Date(dateString);
console.log(`new Date('${dateString}'):`);
console.log(`  - toString(): ${date1.toString()}`);
console.log(`  - toISOString(): ${date1.toISOString()}`);
console.log(`  - getDay(): ${date1.getDay()} (0=domingo, 1=segunda, ...)`);
console.log(`  - toLocaleDateString(): ${date1.toLocaleDateString()}`);

console.log('\n2. Testando new Date(ISO string):');
const date2 = new Date(dateISO);
console.log(`new Date('${dateISO}'):`);
console.log(`  - toString(): ${date2.toString()}`);
console.log(`  - toISOString(): ${date2.toISOString()}`);
console.log(`  - getDay(): ${date2.getDay()} (0=domingo, 1=segunda, ...)`);
console.log(`  - toLocaleDateString(): ${date2.toLocaleDateString()}`);

console.log('\n3. Testando construção manual:');
const date3 = new Date(2025, 5, 16, 10, 0, 0); // Mês é 0-indexado
console.log(`new Date(2025, 5, 16, 10, 0, 0):`);
console.log(`  - toString(): ${date3.toString()}`);
console.log(`  - toISOString(): ${date3.toISOString()}`);
console.log(`  - getDay(): ${date3.getDay()} (0=domingo, 1=segunda, ...)`);
console.log(`  - toLocaleDateString(): ${date3.toLocaleDateString()}`);

console.log('\n4. Verificando o que realmente é 16/06/2025:');
// Vamos verificar manualmente que dia da semana é 16/06/2025
const realDate = new Date(2025, 5, 16); // Junho é mês 5 (0-indexado)
console.log(`16/06/2025 é realmente: ${realDate.toLocaleDateString('pt-BR', { weekday: 'long' })}`);
console.log(`getDay() correto: ${realDate.getDay()}`);

console.log('\n5. Comparando com hoje:');
const today = new Date();
console.log(`Hoje (${today.toLocaleDateString()}): ${today.toLocaleDateString('pt-BR', { weekday: 'long' })} (getDay: ${today.getDay()})`);

console.log('\n6. Testando o problema específico:');
console.log('Quando o endpoint recebe "2025-06-16T10:00:00.000Z":');
const problematicDate = new Date('2025-06-16T10:00:00.000Z');
const weekday = problematicDate.getDay() === 0 ? 7 : problematicDate.getDay();
console.log(`  - Data criada: ${problematicDate.toString()}`);
console.log(`  - getDay(): ${problematicDate.getDay()}`);
console.log(`  - weekday calculado: ${weekday}`);
console.log(`  - Dia da semana local: ${problematicDate.toLocaleDateString('pt-BR', { weekday: 'long' })}`);

console.log('\n=== FIM DEBUG ==='); 