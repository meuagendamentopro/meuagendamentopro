import { db } from '../server/db';
import { appointments } from '../shared/schema';
import { eq } from 'drizzle-orm';

async function testTimezoneHandling() {
  try {
    console.log('Teste de manipulação de fuso horário');
    console.log('===================================');
    
    // Simulando dados que seriam enviados pelo formulário de agendamento
    const bookingData = {
      name: 'Cliente Teste',
      phone: '(11) 99999-9999',
      serviceId: 1, // ID de um serviço existente
      providerId: 7, // ID do provedor (Mayara)
      date: '2025-04-26', // Data no formato ISO (YYYY-MM-DD)
      time: '19:00', // Horário que o cliente está selecionando (19h - noite)
      notes: 'Teste de fuso horário'
    };
    
    console.log(`Dados do agendamento:`);
    console.log(`Data selecionada: ${bookingData.date}`);
    console.log(`Horário selecionado: ${bookingData.time}`);
    
    // Simulando o processamento que acontece no servidor
    const [year, month, day] = bookingData.date.split('-').map(Number);
    const [hour, minute] = bookingData.time.split(':').map(Number);
    
    console.log(`\nComponentes da data:`);
    console.log(`Ano: ${year}, Mês: ${month}, Dia: ${day}`);
    console.log(`Hora: ${hour}, Minuto: ${minute}`);
    
    // Versão original (que causa o problema)
    const originalDate = new Date(Date.UTC(year, month - 1, day, hour, minute, 0));
    
    // Versão corrigida (com +3 horas)
    const correctedDate = new Date(Date.UTC(year, month - 1, day, hour + 3, minute, 0));
    
    console.log(`\nComparação de datas:`);
    console.log(`Método original (problema): ${originalDate.toISOString()}`);
    console.log(`Horário local original: ${originalDate.toLocaleTimeString('pt-BR')}`);
    console.log(`Método corrigido (+3h): ${correctedDate.toISOString()}`);
    console.log(`Horário local corrigido: ${correctedDate.toLocaleTimeString('pt-BR')}`);
    
    // Verificar como o banco de dados armazenaria
    console.log(`\nComo seria armazenado no banco de dados:`);
    console.log(`Original: ${originalDate.toISOString()}`);
    console.log(`Corrigido: ${correctedDate.toISOString()}`);
    
    // Verificar como seria exibido na interface do usuário
    console.log(`\nComo seria exibido na interface (Brasil, GMT-3):`);
    console.log(`Original: ${new Date(originalDate).toLocaleString('pt-BR', { timeZone: 'America/Sao_Paulo' })}`);
    console.log(`Corrigido: ${new Date(correctedDate).toLocaleString('pt-BR', { timeZone: 'America/Sao_Paulo' })}`);
    
    console.log('\nTeste concluído!');
  } catch (error) {
    console.error('Erro no teste:', error);
  } finally {
    // Não é necessário encerrar a conexão nesse caso
    // await db.end();
  }
}

testTimezoneHandling().catch(console.error);