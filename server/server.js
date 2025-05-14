// Servidor com suporte a banco de dados para o Railway
import express from 'express';
import path from 'path';
import { fileURLToPath } from 'url';
import { drizzle } from 'drizzle-orm/postgres-js';
import postgres from 'postgres';
import fs from 'fs';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();
const PORT = process.env.PORT || 3000;

// Middleware para processar JSON
app.use(express.json());

// Servir arquivos estáticos
app.use(express.static(path.join(__dirname, '../dist')));

// Configuração do banco de dados
let db = null;
let pgClient = null;

if (process.env.DATABASE_URL) {
  try {
    console.log('Conectando ao banco de dados...');
    pgClient = postgres(process.env.DATABASE_URL, { max: 10 });
    db = drizzle(pgClient);
    console.log('Conexão com o banco de dados estabelecida!');
  } catch (error) {
    console.error('Erro ao conectar ao banco de dados:', error);
  }
}

// Rota de health check
app.get('/api/health', (req, res) => {
  res.status(200).json({ 
    status: 'ok', 
    timestamp: new Date().toISOString(),
    database: db ? 'connected' : 'not connected',
    env: process.env.NODE_ENV,
    databaseUrl: process.env.DATABASE_URL ? 'configured' : 'not configured'
  });
});

// Rota para executar migrações
app.post('/api/admin/run-migrations', async (req, res) => {
  if (!db) {
    return res.status(500).json({ error: 'Banco de dados não configurado' });
  }
  
  try {
    console.log('Executando migrações...');
    
    // Verificar se o diretório shared existe
    if (fs.existsSync(path.join(__dirname, '../shared'))) {
      console.log('Diretório shared encontrado');
      
      // Importar o schema e executar migrações manualmente
      const { createTables } = await import('../shared/create-tables.js');
      if (createTables && typeof createTables === 'function') {
        await createTables(db);
        console.log('Migrações executadas com sucesso!');
        return res.status(200).json({ success: true, message: 'Migrações executadas com sucesso' });
      } else {
        return res.status(500).json({ error: 'Função createTables não encontrada' });
      }
    } else {
      return res.status(500).json({ error: 'Diretório shared não encontrado' });
    }
  } catch (error) {
    console.error('Erro ao executar migrações:', error);
    return res.status(500).json({ error: 'Erro ao executar migrações', details: error.message });
  }
});

// Rota para a página inicial
app.get('*', (req, res) => {
  res.sendFile(path.join(__dirname, '../dist/index.html'));
});

// Iniciar o servidor
app.listen(PORT, () => {
  console.log(`Servidor rodando na porta ${PORT}`);
  console.log(`Ambiente: ${process.env.NODE_ENV}`);
  console.log(`Diretório atual: ${__dirname}`);
  console.log(`Banco de dados: ${db ? 'conectado' : 'não conectado'}`);
  console.log(`DATABASE_URL configurado: ${process.env.DATABASE_URL ? 'sim' : 'não'}`);
});
