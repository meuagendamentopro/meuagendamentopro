import { Client } from 'pg';

const client = new Client({
  host: 'localhost',
  port: 5432,
  database: 'agendamento',
  user: 'postgres',
  password: 'linday1818'
});

async function checkProvider() {
  try {
    await client.connect();
    console.log('Conectado ao banco de dados');
    
    // Verificar dados do provider 14
    const providerResult = await client.query('SELECT id, name, working_days, working_hours_start, working_hours_end FROM providers WHERE id = 14');
    console.log('Dados do provider 14:');
    console.log(JSON.stringify(providerResult.rows[0], null, 2));
    
    // Verificar que dia da semana é 16/06/2025
    const date = new Date('2025-06-16');
    const dayOfWeek = date.getDay(); // 0 = domingo, 1 = segunda, etc.
    const weekday = dayOfWeek === 0 ? 7 : dayOfWeek; // Converter domingo (0) para 7
    
    console.log(`\n16/06/2025:`);
    console.log(`- getDay(): ${dayOfWeek}`);
    console.log(`- weekday convertido: ${weekday}`);
    console.log(`- Nome do dia: ${date.toLocaleDateString('pt-BR', {weekday: 'long'})}`);
    
    // Verificar se o dia está nos dias de trabalho
    const provider = providerResult.rows[0];
    if (provider.working_days) {
      const workingDays = provider.working_days.split(',').map(d => parseInt(d.trim()));
      console.log(`\nDias de trabalho configurados: ${workingDays.join(', ')}`);
      console.log(`Dia 16/06 (${weekday}) está incluído? ${workingDays.includes(weekday)}`);
    } else {
      console.log('\nNenhum dia de trabalho configurado');
    }
    
  } catch (error) {
    console.error('Erro:', error);
  } finally {
    await client.end();
  }
}

checkProvider(); 