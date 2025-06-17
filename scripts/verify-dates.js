console.log('=== VERIFICAÇÃO CORRETA DAS DATAS ===');

const hoje = new Date('2025-06-13');
console.log('Hoje (13/06/2025):', hoje.toLocaleDateString('pt-BR', {weekday: 'long'}), '(getDay:', hoje.getDay() + ')');

const domingo = new Date('2025-06-15');
console.log('15/06/2025:', domingo.toLocaleDateString('pt-BR', {weekday: 'long'}), '(getDay:', domingo.getDay() + ')');

const segunda = new Date('2025-06-16');
console.log('16/06/2025:', segunda.toLocaleDateString('pt-BR', {weekday: 'long'}), '(getDay:', segunda.getDay() + ')');

console.log('\n=== PRÓXIMOS DIAS ===');
for(let i = 13; i <= 20; i++) {
  const date = new Date(`2025-06-${i}`);
  console.log(`${i}/06/2025 é ${date.toLocaleDateString('pt-BR', {weekday: 'long'})} (getDay: ${date.getDay()})`);
} 