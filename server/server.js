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

// Verificar se o diretório dist existe
console.log('Verificando diretório dist:');
try {
  if (fs.existsSync(path.join(__dirname, '../dist'))) {
    console.log('Diretório dist encontrado');
    console.log('Conteúdo do diretório dist:');
    const distFiles = fs.readdirSync(path.join(__dirname, '../dist'));
    console.log(distFiles);
  } else {
    console.error('Diretório dist não encontrado');
    // Criar diretório dist e um arquivo index.html básico se não existir
    fs.mkdirSync(path.join(__dirname, '../dist'), { recursive: true });
    fs.writeFileSync(
      path.join(__dirname, '../dist/index.html'),
      `<!DOCTYPE html>
      <html lang="pt-BR">
      <head>
        <meta charset="UTF-8">
        <meta name="viewport" content="width=device-width, initial-scale=1.0">
        <title>Sistema de Agendamento</title>
        <style>
          body { font-family: Arial, sans-serif; margin: 0; padding: 0; background-color: #f5f5f5; }
          .container { max-width: 800px; margin: 0 auto; padding: 20px; }
          h1 { color: #333; }
          .card { background-color: white; border-radius: 8px; padding: 20px; margin-bottom: 20px; box-shadow: 0 2px 4px rgba(0,0,0,0.1); }
        </style>
      </head>
      <body>
        <div class="container">
          <h1>Sistema de Agendamento</h1>
          <div class="card">
            <h2>Bem-vindo ao Sistema de Agendamento</h2>
            <p>O servidor está funcionando corretamente.</p>
            <p>Status da API: <span id="apiStatus">Verificando...</span></p>
          </div>
        </div>
        <script>
          // Verificar status da API
          fetch('/api/health')
            .then(response => response.json())
            .then(data => {
              document.getElementById('apiStatus').textContent = 'Conectado';
              document.getElementById('apiStatus').style.color = 'green';
            })
            .catch(error => {
              document.getElementById('apiStatus').textContent = 'Desconectado';
              document.getElementById('apiStatus').style.color = 'red';
            });
        </script>
      </body>
      </html>`
    );
    console.log('Arquivo index.html básico criado');
  }
} catch (error) {
  console.error('Erro ao verificar diretório dist:', error);
}

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

// Rota para executar migrações (aceita tanto GET quanto POST)
app.all('/api/admin/run-migrations', async (req, res) => {
  console.log('Rota de migrações acessada');
  
  // Verificar estrutura de diretórios
  console.log('Diretório atual:', __dirname);
  console.log('Diretório pai:', path.join(__dirname, '..'));
  console.log('Conteúdo do diretório pai:');
  try {
    const parentFiles = fs.readdirSync(path.join(__dirname, '..'));
    console.log(parentFiles);
  } catch (error) {
    console.error('Erro ao listar diretório pai:', error);
  }
  
  if (!db) {
    console.error('Banco de dados não configurado');
    return res.status(500).json({ error: 'Banco de dados não configurado' });
  }
  
  try {
    console.log('Executando migrações...');
    
    // Verificar se o diretório shared existe
    const sharedPath = path.join(__dirname, '../shared');
    if (fs.existsSync(sharedPath)) {
      console.log('Diretório shared encontrado:', sharedPath);
      console.log('Conteúdo do diretório shared:');
      try {
        const sharedFiles = fs.readdirSync(sharedPath);
        console.log(sharedFiles);
      } catch (error) {
        console.error('Erro ao listar diretório shared:', error);
      }
      
      // Importar o schema e executar migrações manualmente
      try {
        console.log('Tentando importar create-tables.js...');
        const createTablesModule = await import('../shared/create-tables.js');
        console.log('Módulo importado:', createTablesModule);
        
        if (createTablesModule.createTables && typeof createTablesModule.createTables === 'function') {
          console.log('Função createTables encontrada, executando...');
          await createTablesModule.createTables(db);
          console.log('Migrações executadas com sucesso!');
          return res.status(200).json({ success: true, message: 'Migrações executadas com sucesso' });
        } else {
          console.error('Função createTables não encontrada no módulo');
          return res.status(500).json({ error: 'Função createTables não encontrada' });
        }
      } catch (importError) {
        console.error('Erro ao importar módulo create-tables.js:', importError);
        return res.status(500).json({ error: 'Erro ao importar módulo create-tables.js', details: importError.message });
      }
    } else {
      console.error('Diretório shared não encontrado:', sharedPath);
      return res.status(500).json({ error: 'Diretório shared não encontrado', path: sharedPath });
    }
  } catch (error) {
    console.error('Erro ao executar migrações:', error);
    return res.status(500).json({ error: 'Erro ao executar migrações', details: error.message });
  }
});

// Rota para a página inicial e todas as outras rotas do frontend
app.get('*', (req, res) => {
  console.log('Rota acessada:', req.path);
  
  // Se for uma rota de API não encontrada
  if (req.path.startsWith('/api/') && req.path !== '/api/health' && req.path !== '/api/info') {
    console.log('Rota de API não encontrada:', req.path);
    return res.status(404).json({ error: 'API endpoint not found' });
  }
  
  // Para todas as outras rotas, servir o index.html ou uma página padrão
  try {
    const indexPath = path.join(__dirname, '../dist/index.html');
    if (fs.existsSync(indexPath)) {
      console.log('Servindo index.html');
      res.sendFile(indexPath);
    } else {
      console.log('Arquivo index.html não encontrado, servindo página padrão');
      res.status(200).send(`
        <html>
          <head>
            <title>Sistema de Agendamento</title>
            <style>
              body { font-family: Arial, sans-serif; margin: 40px; line-height: 1.6; }
              h1 { color: #333; }
            </style>
          </head>
          <body>
            <h1>Sistema de Agendamento</h1>
            <p>O servidor está funcionando corretamente.</p>
            <p><a href="/api/health">Verificar status da API</a></p>
          </body>
        </html>
      `);
    }
  } catch (error) {
    console.error('Erro ao servir página:', error);
    res.status(500).send('Erro interno do servidor');
  }
});

// Iniciar o servidor
app.listen(PORT, () => {
  console.log(`Servidor rodando na porta ${PORT}`);
  console.log(`Acesse: http://localhost:${PORT}`);
});
