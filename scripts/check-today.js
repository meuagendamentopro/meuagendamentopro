console.log('Verificando o dia de hoje (13/06/2025):');
const hoje = new Date('2025-06-13');
console.log('Dia da semana (getDay):', hoje.getDay());
console.log('Nome do dia:', hoje.toLocaleDateString('pt-BR', {weekday: 'long'}));

console.log('\nVerificando os próximos dias:');
for(let i = 13; i <= 20; i++) {
  const date = new Date(`2025-06-${i}`);
  console.log(`${i}/06/2025 é ${date.toLocaleDateString('pt-BR', {weekday: 'long'})} (getDay: ${date.getDay()})`);
} 