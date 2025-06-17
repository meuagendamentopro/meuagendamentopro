// Simular a função getNextDays do frontend
function getNextDays(days = 7) {
  const result = [];
  const today = new Date();
  
  for (let i = 0; i < days; i++) {
    const date = new Date(today);
    date.setDate(today.getDate() + i);
    date.setHours(0, 0, 0, 0);
    result.push(date);
  }
  
  return result;
}

function getDayName(date) {
  return date.toLocaleDateString('pt-BR', { weekday: 'short' });
}

console.log('=== TESTE DO CALENDÁRIO ===');
console.log('Hoje:', new Date().toLocaleDateString('pt-BR', {weekday: 'long', day: '2-digit', month: '2-digit', year: 'numeric'}));

const nextDays = getNextDays(14);

console.log('\nPróximos 14 dias gerados pelo calendário:');
nextDays.forEach((date, index) => {
  const dayName = getDayName(date);
  const dayNumber = date.getDate();
  const isToday = index === 0;
  
  console.log(`${index}: ${dayNumber}/${date.getMonth() + 1} - ${dayName} ${isToday ? '(Hoje)' : ''} - getDay: ${date.getDay()}`);
  
  // Destacar o dia 16
  if (dayNumber === 16) {
    console.log(`  *** DIA 16 ENCONTRADO: ${date.toLocaleDateString('pt-BR', {weekday: 'long'})} ***`);
  }
});

// Verificar especificamente o dia 16/06/2025
console.log('\n=== VERIFICAÇÃO ESPECÍFICA 16/06/2025 ===');
const date16 = new Date('2025-06-16');
console.log(`16/06/2025: ${date16.toLocaleDateString('pt-BR', {weekday: 'long'})} (getDay: ${date16.getDay()})`);

// Verificar se 16/06 está na lista de próximos dias
const found16 = nextDays.find(date => date.getDate() === 16 && date.getMonth() === 5); // Junho = mês 5
if (found16) {
  console.log(`16/06 encontrado na lista: ${found16.toLocaleDateString('pt-BR', {weekday: 'long'})}`);
} else {
  console.log('16/06 NÃO encontrado na lista de próximos dias');
} 