import pg from 'pg';

const { Client } = pg;

const client = new Client({
  host: 'localhost',
  port: 5432,
  database: 'agendamento',
  user: 'postgres',
  password: 'linday1818'
});

async function checkAppointment() {
  try {
    await client.connect();
    
    const result = await client.query(`
      SELECT 
        a.id, 
        a.service_id, 
        s.name as service_name,
        s.id as service_id_check
      FROM appointments a 
      JOIN services s ON a.service_id = s.id 
      WHERE a.id = 112
    `);
    
    console.log('Dados do agendamento 112:');
    console.log(result.rows[0]);
    
  } catch (error) {
    console.error('Erro:', error);
  } finally {
    await client.end();
  }
}

checkAppointment(); 