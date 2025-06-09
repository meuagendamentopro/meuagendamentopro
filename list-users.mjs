// Script para listar os usuários no banco de dados PostgreSQL
import pg from 'pg';
const { Pool } = pg;

async function listUsers() {
  try {
    console.log('Conectando ao PostgreSQL...');
    const pool = new Pool({
      connectionString: 'postgres://postgres:linday1818@localhost:5432/agendamento'
    });
    
    console.log('Listando usuários...');
    const result = await pool.query('SELECT id, username, email, role, is_active, is_email_verified FROM users');
    
    console.log('Usuários encontrados:', result.rows.length);
    console.log('Lista de usuários:');
    result.rows.forEach(user => {
      console.log(`ID: ${user.id}, Username: ${user.username}, Email: ${user.email}, Role: ${user.role}, Active: ${user.is_active}, Email Verified: ${user.is_email_verified}`);
    });
    
    await pool.end();
  } catch (error) {
    console.error('Erro ao listar usuários:', error);
  }
}

listUsers();
