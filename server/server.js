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
app.use(express.urlencoded({ extended: true }));

// Configurar CORS para permitir requisições do frontend
app.use((req, res, next) => {
  res.header('Access-Control-Allow-Origin', '*');
  res.header('Access-Control-Allow-Headers', 'Origin, X-Requested-With, Content-Type, Accept, Authorization');
  res.header('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE, OPTIONS');
  
  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }
  
  next();
});

// Definir caminhos para os diretórios de arquivos estáticos
const distPath = path.join(__dirname, '../dist');
const assetsPath = path.join(distPath, 'assets');
const srcPath = path.join(__dirname, '../src');
const publicPath = path.join(__dirname, '../public');

// Verificar se o diretório dist existe (onde o Vite coloca os arquivos construídos)
if (!fs.existsSync(distPath)) {
  console.log('AVISO: Diretório dist não encontrado. Tentando criar...');
  fs.mkdirSync(distPath, { recursive: true });
  console.log('Diretório dist criado');
}

console.log('Configurando rotas para arquivos estáticos...');

// Verificar e exibir o conteúdo do diretório dist para debug
try {
  console.log('Conteúdo do diretório dist:');
  const distFiles = fs.readdirSync(distPath);
  console.log(distFiles);
  
  if (fs.existsSync(assetsPath)) {
    console.log('Conteúdo do diretório assets:');
    const assetsFiles = fs.readdirSync(assetsPath);
    console.log(assetsFiles);
  }
} catch (error) {
  console.error('Erro ao listar diretório dist:', error);
}

// Servir arquivos estáticos em ordem de prioridade

// 1. Primeiro servir do diretório dist (onde o Vite coloca os arquivos construídos)
console.log('Servindo arquivos estáticos do diretório dist');
app.use(express.static(distPath));

// 2. Se dist não existir ou não tiver os arquivos necessários, servir do diretório public
if (fs.existsSync(publicPath)) {
  console.log('Servindo arquivos estáticos do diretório public');
  app.use(express.static(publicPath));
}

// 3. Por último, tentar servir do diretório src (para desenvolvimento)
if (fs.existsSync(srcPath)) {
  console.log('Servindo arquivos estáticos do diretório src');
  app.use(express.static(srcPath));
}

// Verificar se existe um arquivo index.html no diretório dist
const indexPath = path.join(distPath, 'index.html');
if (!fs.existsSync(indexPath)) {
  console.log('Criando arquivo index.html no diretório dist');
  fs.writeFileSync(
    indexPath,
    `<!DOCTYPE html>
<html lang="pt-BR">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>API do Sistema de Agendamento</title>
  <style>
    body { font-family: Arial, sans-serif; margin: 40px; line-height: 1.6; }
    h1 { color: #4a6cf7; }
    .card { background-color: white; border-radius: 8px; padding: 20px; margin: 20px 0; box-shadow: 0 4px 10px rgba(0,0,0,0.1); }
    .status { padding: 15px; border-radius: 5px; margin: 20px 0; font-weight: 500; }
    .online { background-color: #e6f7e6; color: #2e7d32; }
    .offline { background-color: #ffebee; color: #c62828; }
    a { color: #4a6cf7; text-decoration: none; }
    a:hover { text-decoration: underline; }
  </style>
</head>
<body>
  <h1>API do Sistema de Agendamento</h1>
  <div class="card">
    <h2>Status do Sistema</h2>
    <div id="api-status" class="status">Verificando status da API...</div>
    <p>Endpoints disponíveis:</p>
    <ul>
      <li><a href="/api/health">/api/health</a> - Verificar status da API</li>
      <li><a href="/api/info">/api/info</a> - Informações sobre a versão</li>
    </ul>
  </div>
  <script>
    // Verificar status da API
    fetch('/api/health')
      .then(response => response.json())
      .then(data => {
        const apiStatus = document.getElementById('api-status');
        apiStatus.textContent = 'API Online - Banco de dados conectado';
        apiStatus.classList.add('online');
        console.log('Detalhes da API:', data);
      })
      .catch(error => {
        const apiStatus = document.getElementById('api-status');
        apiStatus.textContent = 'API Offline - Verifique os logs';
        apiStatus.classList.add('offline');
        console.error('Erro ao conectar com a API:', error);
      });
  </script>
</body>
</html>`
  );
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

// Rota para servir o frontend
app.get('*', (req, res) => {
  try {
    // Verificar se a requisição é para a API
    if (req.path.startsWith('/api')) {
      return res.status(404).json({ error: 'API endpoint not found' });
    }

    console.log('Recebida requisição para:', req.path);
    
    // Verificar o arquivo index.html gerado pelo Vite
    const indexPath = path.join(__dirname, '../dist/index.html');
    
    if (fs.existsSync(indexPath)) {
      console.log('Arquivo index.html encontrado em:', indexPath);
      return res.sendFile(indexPath);
    }
    
    // Se não existir, verificar no diretório public
    const publicIndexPath = path.join(__dirname, '../public/index.html');
    if (fs.existsSync(publicIndexPath)) {
      console.log('Arquivo index.html encontrado em:', publicIndexPath);
      return res.sendFile(publicIndexPath);
    }
    
    // Se nenhum arquivo index.html for encontrado, criar um HTML básico
    console.log('Nenhum arquivo index.html encontrado, enviando HTML básico');
    return res.send(`
      <!DOCTYPE html>
      <html lang="pt-BR">
      <head>
        <meta charset="UTF-8">
        <meta name="viewport" content="width=device-width, initial-scale=1.0">
        <title>Sistema de Agendamento</title>
        <style>
          body { font-family: Arial, sans-serif; margin: 40px; line-height: 1.6; }
          h1 { color: #4a6cf7; }
          .card { background-color: white; border-radius: 8px; padding: 20px; margin: 20px 0; box-shadow: 0 4px 10px rgba(0,0,0,0.1); }
          a { color: #4a6cf7; text-decoration: none; }
          a:hover { text-decoration: underline; }
        </style>
      </head>
      <body>
        <h1>Sistema de Agendamento</h1>
        <div class="card">
          <h2>API Funcionando</h2>
          <p>A API está funcionando corretamente. Acesse <a href="/api/health">/api/health</a> para verificar o status.</p>
          <p>O frontend não foi encontrado. Verifique o build.</p>
        </div>
      </body>
      </html>
    `);
  } catch (error) {
    console.error('Erro ao servir página:', error);
    res.status(500).send('Erro interno do servidor');
  }
});

// Função para listar o conteúdo de um diretório recursivamente
function listarDiretorioRecursivo(diretorio, nivel = 0) {
  try {
    if (!fs.existsSync(diretorio)) {
      console.log(`${' '.repeat(nivel * 2)}[Diretório não existe: ${diretorio}]`);
      return;
    }

    const arquivos = fs.readdirSync(diretorio);
    arquivos.forEach(arquivo => {
      const caminhoCompleto = path.join(diretorio, arquivo);
      const stats = fs.statSync(caminhoCompleto);
      if (stats.isDirectory()) {
        console.log(`${' '.repeat(nivel * 2)}[Dir] ${arquivo}`);
        // Limitar a recursão para evitar loops infinitos
        if (nivel < 3) {
          listarDiretorioRecursivo(caminhoCompleto, nivel + 1);
        }
      } else {
        console.log(`${' '.repeat(nivel * 2)}[Arquivo] ${arquivo} (${stats.size} bytes)`);
      }
    });
  } catch (error) {
    console.error(`Erro ao listar diretório ${diretorio}:`, error);
  }
}

// Iniciar o servidor
app.listen(PORT, () => {
  console.log(`Servidor rodando na porta ${PORT}`);
  console.log(`Acesse: http://localhost:${PORT}`);
  
  // Listar conteúdo dos diretórios importantes
  console.log('\nConteúdo do diretório atual:');
  listarDiretorioRecursivo(path.join(__dirname, '..'));
  
  console.log('\nConteúdo do diretório dist:');
  listarDiretorioRecursivo(distPath);
  
  console.log('\nConteúdo do diretório dist/public (se existir):');
  listarDiretorioRecursivo(publicPath);
});
