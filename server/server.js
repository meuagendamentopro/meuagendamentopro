// Servidor com suporte a banco de dados para o Railway
import express from 'express';
import path from 'path';
import { fileURLToPath } from 'url';
import fs from 'fs';

// Importações para o banco de dados
import postgres from 'postgres';
import { drizzle } from 'drizzle-orm/postgres-js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();
const PORT = process.env.PORT || 3000;

// Middleware para processar JSON
app.use(express.json());

// Servir arquivos estáticos
app.use(express.static(path.join(__dirname, '../dist')));

// Informações sobre o ambiente
console.log('Variáveis de ambiente:');
console.log(`NODE_ENV: ${process.env.NODE_ENV}`);
console.log(`PORT: ${PORT}`);
console.log(`DATABASE_URL configurado: ${process.env.DATABASE_URL ? 'sim' : 'não'}`);
console.log(`Diretório atual: ${__dirname}`);

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

// Verificar conteúdo do diretório
try {
  console.log('Conteúdo do diretório:');
  const files = fs.readdirSync(path.join(__dirname, '..'));
  console.log(files);
} catch (error) {
  console.error('Erro ao listar diretório:', error);
}

// Rota de health check
app.get('/api/health', (req, res) => {
  res.status(200).json({ 
    status: 'ok', 
    timestamp: new Date().toISOString(),
    env: process.env.NODE_ENV,
    database: db ? 'connected' : 'not connected',
    databaseUrl: process.env.DATABASE_URL ? 'configured' : 'not configured'
  });
});

// Rota para a API
app.get('/api/info', (req, res) => {
  res.status(200).json({
    name: 'AgendaPro',
    version: '1.0.0',
    environment: process.env.NODE_ENV,
    serverTime: new Date().toISOString()
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

// Rota para a página inicial e todas as outras rotas do frontend
app.get('*', (req, res) => {
  res.sendFile(path.join(__dirname, '../dist/index.html'));
});

// Iniciar o servidor
app.listen(PORT, () => {
  console.log(`Servidor rodando na porta ${PORT}`);
  console.log(`Acesse: http://localhost:${PORT}`);
});
