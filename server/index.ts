import dotenv from 'dotenv';
// Carrega as variáveis de ambiente do arquivo .env
dotenv.config();

import express, { type Request, Response, NextFunction } from "express";
import { registerRoutes } from "./routes";
import { setupVite, serveStatic, log } from "./vite";
import { localConfig } from "./local-config";
import { pool } from "./db";
import path from "path";
import { fileURLToPath } from 'url';
import { dirname } from 'path';
import multer from 'multer';
import cors from 'cors';
import fs from 'fs';
import { promisify } from 'util';

// Configuração do multer para upload de arquivos
const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    const dir = 'updates';
    if (!fs.existsSync(dir)) {
      fs.mkdirSync(dir, { recursive: true });
    }
    cb(null, dir);
  },
  filename: (req, file, cb) => {
    cb(null, file.originalname);
  }
});

const upload = multer({ storage });
const writeFileAsync = promisify(fs.writeFile);
const unlinkAsync = promisify(fs.unlink);
const readdirAsync = promisify(fs.readdir);
const statAsync = promisify(fs.stat);
const readFileAsync = promisify(fs.readFile);

// Obter o diretório atual (substitui __dirname que não está disponível em ESM)
const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

const app = express();

// Configuração do CORS
app.use(cors({
  origin: '*', // Permite todas as origens - em produção, substitua pelos domínios permitidos
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization']
}));

app.use(express.json());
app.use(express.urlencoded({ extended: false }));

// Middleware para permitir requisições OPTIONS (pré-voo CORS)
app.options('*', cors());

// Configurar servidor para servir arquivos estáticos da pasta 'public' e 'updates'
app.use(express.static('public'));

// Rota para listar arquivos quando alguém acessa /updates/ diretamente
app.get('/updates', async (req: Request, res: Response) => {
  try {
    if (!fs.existsSync('updates')) {
      fs.mkdirSync('updates', { recursive: true });
    }
    
    const files = await readdirAsync('updates');
    const fileStats = await Promise.all(
      files.map(async (file) => {
        const stats = await statAsync(`updates/${file}`);
        return {
          name: file,
          size: stats.size,
          modified: stats.mtime.toISOString(),
          isDirectory: stats.isDirectory()
        };
      })
    );
    
    // Gera uma página HTML simples com a lista de arquivos
    const html = `
    <!DOCTYPE html>
    <html lang="pt-BR">
    <head>
      <meta charset="UTF-8">
      <meta name="viewport" content="width=device-width, initial-scale=1.0">
      <title>Arquivos Disponíveis - Meu Agendamento PRO</title>
      <style>
        body {
          font-family: Arial, sans-serif;
          margin: 0;
          padding: 20px;
          color: #333;
          max-width: 1000px;
          margin: 0 auto;
        }
        h1 {
          color: #2c3e50;
          border-bottom: 1px solid #eee;
          padding-bottom: 10px;
        }
        table {
          width: 100%;
          border-collapse: collapse;
          margin-top: 20px;
        }
        th, td {
          padding: 12px;
          text-align: left;
          border-bottom: 1px solid #ddd;
        }
        th {
          background-color: #f2f2f2;
          font-weight: bold;
        }
        tr:hover {
          background-color: #f5f5f5;
        }
        a {
          color: #3498db;
          text-decoration: none;
        }
        a:hover {
          text-decoration: underline;
        }
        .size {
          text-align: right;
        }
        .header {
          display: flex;
          justify-content: space-between;
          align-items: center;
        }
        .header h1 {
          margin: 0;
          border: none;
        }
      </style>
    </head>
    <body>
      <div class="header">
        <h1>Arquivos Disponíveis</h1>
        <div>Meu Agendamento PRO</div>
      </div>
      
      <table>
        <thead>
          <tr>
            <th>Nome</th>
            <th>Tamanho</th>
            <th>Última Modificação</th>
          </tr>
        </thead>
        <tbody>
          ${fileStats.map(file => `
            <tr>
              <td><a href="/updates/${file.name}">${file.name}</a></td>
              <td class="size">${formatFileSize(file.size)}</td>
              <td>${new Date(file.modified).toLocaleString('pt-BR')}</td>
            </tr>
          `).join('')}
        </tbody>
      </table>
    </body>
    </html>
    `;
    
    res.setHeader('Content-Type', 'text/html');
    res.send(html);
  } catch (error) {
    console.error('Erro ao listar arquivos:', error);
    res.status(500).send('Erro ao listar arquivos');
  }
});

// Função auxiliar para formatar o tamanho do arquivo
function formatFileSize(bytes: number): string {
  if (bytes === 0) return '0 Bytes';
  const k = 1024;
  const sizes = ['Bytes', 'KB', 'MB', 'GB', 'TB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
}

// Configurar servidor para servir arquivos estáticos da pasta 'updates' para rotas específicas
app.use('/updates', express.static('updates', { 
  setHeaders: (res) => {
    res.header('Access-Control-Allow-Origin', '*');
    res.header('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE');
    res.header('Access-Control-Allow-Headers', 'Content-Type, Authorization');
  }
}));
console.log('Servidor configurado para servir arquivos estáticos das pastas public e updates');

// Rota para listar arquivos na pasta updates
app.get('/api/updates', async (req: Request, res: Response) => {
  try {
    const files = await readdirAsync('updates');
    const fileStats = await Promise.all(
      files.map(async (file) => {
        const stats = await statAsync(`updates/${file}`);
        return {
          name: file,
          size: stats.size,
          modified: stats.mtime,
          isDirectory: stats.isDirectory()
        };
      })
    );
    res.json(fileStats);
  } catch (error) {
    console.error('Erro ao listar arquivos:', error);
    res.status(500).json({ error: 'Erro ao listar arquivos' });
  }
});

// Rota para acessar o conteúdo de um arquivo JSON diretamente
app.get('/api/updates/:filename', async (req: Request, res: Response) => {
  try {
    const { filename } = req.params;
    
    if (!filename.endsWith('.json')) {
      return res.status(400).json({ error: 'Apenas arquivos JSON podem ser acessados por esta rota' });
    }
    
    const filePath = path.join('updates', filename);
    
    if (!fs.existsSync(filePath)) {
      return res.status(404).json({ error: 'Arquivo não encontrado' });
    }
    
    const fileContent = await readFileAsync(filePath, 'utf8');
    const jsonContent = JSON.parse(fileContent);
    
    res.json(jsonContent);
  } catch (error) {
    console.error('Erro ao ler arquivo:', error);
    res.status(500).json({ error: 'Erro ao ler arquivo' });
  }
});

// Rota para upload de arquivos
app.post('/api/updates/upload', upload.single('file'), (req: Request, res: Response) => {
  if (!req.file) {
    return res.status(400).json({ error: 'Nenhum arquivo enviado' });
  }
  res.json({ 
    message: 'Arquivo enviado com sucesso', 
    file: req.file.filename,
    path: `/updates/${req.file.filename}`
  });
});

// Rota para atualizar o conteúdo de um arquivo JSON
app.put('/api/updates/:filename', async (req: Request, res: Response) => {
  try {
    const { filename } = req.params;
    const { content } = req.body;
    
    if (!filename.endsWith('.json')) {
      return res.status(400).json({ error: 'Apenas arquivos JSON podem ser atualizados por esta rota' });
    }
    
    if (!content) {
      return res.status(400).json({ error: 'O campo "content" é obrigatório' });
    }
    
    const filePath = path.join('updates', filename);
    
    // Garante que o diretório existe
    if (!fs.existsSync('updates')) {
      fs.mkdirSync('updates', { recursive: true });
    }
    
    // Escreve o conteúdo formatado no arquivo
    await writeFileAsync(filePath, JSON.stringify(content, null, 2));
    
    res.json({ 
      message: 'Arquivo atualizado com sucesso',
      file: filename,
      path: `/updates/${filename}`
    });
  } catch (error) {
    console.error('Erro ao atualizar arquivo:', error);
    res.status(500).json({ error: 'Erro ao atualizar arquivo' });
  }
});

// Rota para deletar um arquivo
app.delete('/api/updates/:filename', async (req: Request, res: Response) => {
  try {
    const { filename } = req.params;
    const filePath = path.join('updates', filename);
    
    if (!fs.existsSync(filePath)) {
      return res.status(404).json({ error: 'Arquivo não encontrado' });
    }
    
    await unlinkAsync(filePath);
    res.json({ message: 'Arquivo excluído com sucesso' });
  } catch (error) {
    console.error('Erro ao excluir arquivo:', error);
    res.status(500).json({ error: 'Erro ao excluir arquivo' });
  }
});

// Rota para baixar um arquivo específico
app.get('/api/updates/download/:filename', async (req: Request, res: Response) => {
  try {
    const { filename } = req.params;
    const filePath = path.join('updates', filename);
    
    if (!fs.existsSync(filePath)) {
      return res.status(404).json({ error: 'Arquivo não encontrado' });
    }
    
    res.download(filePath, filename);
  } catch (error) {
    console.error('Erro ao baixar arquivo:', error);
    res.status(500).json({ error: 'Erro ao baixar arquivo' });
  }
});

// Rota de health check simples (fallback)
app.get('/health', (req, res) => {
  res.status(200).json({ status: 'OK', timestamp: new Date().toISOString() });
});

// Rota de health check para Railway
app.get('/api/health', async (req, res) => {
  try {
    // Testar conexão com banco de dados
    const dbTest = await pool.query('SELECT 1 as test');
    
    res.status(200).json({ 
      status: 'OK', 
      timestamp: new Date().toISOString(),
      environment: process.env.NODE_ENV || 'development',
      database: 'connected',
      uptime: process.uptime()
    });
  } catch (error) {
    console.error('Health check failed:', error);
    res.status(503).json({ 
      status: 'ERROR', 
      timestamp: new Date().toISOString(),
      error: 'Database connection failed'
    });
  }
});

// Rota específica para servir o arquivo Excel
app.get('/api/dados/dados.xlsx', (req, res) => {
  console.log('Requisição para o arquivo Excel recebida');
  res.sendFile(path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../files/dados.xlsx'));
});

// Rota alternativa para o arquivo Excel
app.get('/dados.xlsx', (req, res) => {
  console.log('Requisição alternativa para o arquivo Excel recebida');
  res.sendFile(path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../files/dados.xlsx'));
});

app.use((req, res, next) => {
  const start = Date.now();
  const path = req.path;
  let capturedJsonResponse: Record<string, any> | undefined = undefined;

  const originalResJson = res.json;
  res.json = function (bodyJson, ...args) {
    capturedJsonResponse = bodyJson;
    return originalResJson.apply(res, [bodyJson, ...args]);
  };

  res.on("finish", () => {
    const duration = Date.now() - start;
    if (path.startsWith("/api")) {
      let logLine = `${req.method} ${path} ${res.statusCode} in ${duration}ms`;
      if (capturedJsonResponse) {
        logLine += ` :: ${JSON.stringify(capturedJsonResponse)}`;
      }

      if (logLine.length > 80) {
        logLine = logLine.slice(0, 79) + "…";
      }

      log(logLine);
    }
  });

  next();
});

(async () => {
  try {
    // Log para fins de depuração, mostra o ambiente
    console.log('=== INICIANDO SERVIDOR ===');
    console.log(`Ambiente: ${process.env.NODE_ENV}`);
    console.log(`DATABASE_URL disponível: ${!!process.env.DATABASE_URL}`);
    console.log(`Porta configurada: ${process.env.PORT || 3003}`);
    console.log(`Host configurado: ${process.env.NODE_ENV === 'production' ? '0.0.0.0' : 'localhost'}`);
    
    // Debug das variáveis de ambiente críticas
    console.log('Variáveis críticas:');
    console.log(`- NODE_ENV: ${process.env.NODE_ENV}`);
    console.log(`- PORT: ${process.env.PORT}`);
    console.log(`- DATABASE_URL: ${process.env.DATABASE_URL ? 'DEFINIDA' : 'NÃO DEFINIDA'}`);
    console.log(`- SESSION_SECRET: ${process.env.SESSION_SECRET ? 'DEFINIDA' : 'NÃO DEFINIDA'}`);
    
    // Diagnóstico da conexão com o banco de dados
    try {
      console.log('Testando conexão com o banco de dados...');
      const result = await pool.query('SELECT 1 as test');
      console.log('Conexão com o banco de dados bem-sucedida:', result.rows);
      
      // Verificar se as tabelas existem
      console.log('Verificando tabelas no banco de dados...');
      const tables = await pool.query(
        "SELECT table_name FROM information_schema.tables WHERE table_schema = 'public'"
      );
      console.log('Tabelas encontradas:', tables.rows.map((row: any) => row.table_name));
    } catch (dbError) {
      console.error('ERRO DE CONEXÃO COM O BANCO DE DADOS:', dbError);
    }
    
    // Registra as rotas da API
    const server = await registerRoutes(app);

    // Middleware de tratamento de erros
    app.use((err: any, _req: Request, res: Response, _next: NextFunction) => {
      const status = err.status || err.statusCode || 500;
      const message = err.message || "Internal Server Error";
      console.error("Erro na aplicação:", err);
      res.status(status).json({ message });
    });

    // Rota especial para redirecionamento da verificação direta para API
    app.get('/verify-email-direct/:token', (req, res) => {
      const token = req.params.token;
      const email = req.query.email as string;
      console.log(`Redirecionando verificação de email para API: ${req.url}`);
      res.redirect(`/api/verify-email-direct/${token}?email=${encodeURIComponent(email)}`);
    });

    // Configuração do frontend
    if (app.get("env") === "development") {
      console.log("Configurando ambiente de desenvolvimento (Vite)");
      await setupVite(app, server);
    } else {
      console.log("Configurando ambiente de produção (arquivos estáticos)");
      serveStatic(app);
    }
    
    // Rota específica para verificação de email
    app.get('/verify-email/:token', (req, res) => {
      console.log(`Interceptando rota de verificação de email: ${req.url}`);
      // Sempre envia o index.html para permitir que o React Router processe a rota
      if (app.get("env") === "development") {
        res.redirect('/');
      } else {
        res.sendFile('index.html', { root: './dist/client' });
      }
    });

    // Rota de fallback para capturar todos os caminhos não tratados
    app.get('*', (req, res) => {
      if (app.get("env") === "development") {
        // No desenvolvimento, deixa o Vite lidar com isso
        res.status(404).send('Página não encontrada');
      } else {
        // Em produção, serve o index.html para suportar client-side routing
        res.sendFile('index.html', { root: './dist/client' });
      }
    });

    // Use a porta do ambiente, configuração local ou 3003 como fallback
    const port = process.env.PORT ? parseInt(process.env.PORT) : (localConfig.server.port || 3003);
    const host = process.env.NODE_ENV === 'production' ? '0.0.0.0' : 'localhost';
    server.listen({
      port,
      host,
      // reusePort: true, // Esta opção não é suportada no Windows
    }, () => {
      log(`Servidor rodando na porta ${port} em modo ${app.get("env")} (host: ${host})`);
    });
  } catch (error) {
    console.error("=== ERRO FATAL DURANTE A INICIALIZAÇÃO ===");
    console.error("Erro:", error);
    console.error("Stack trace:", error instanceof Error ? error.stack : 'N/A');
    console.error("Ambiente:", process.env.NODE_ENV);
    console.error("DATABASE_URL definida:", !!process.env.DATABASE_URL);
    
    // Aguarda um pouco antes de sair para garantir que os logs sejam enviados
    setTimeout(() => {
      process.exit(1);
    }, 1000);
  }
})();
