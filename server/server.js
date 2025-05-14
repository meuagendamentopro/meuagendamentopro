// Servidor simplificado para o Railway
import express from 'express';
import path from 'path';
import { fileURLToPath } from 'url';
import fs from 'fs';

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

// Rota para a página inicial e todas as outras rotas do frontend
app.get('*', (req, res) => {
  res.sendFile(path.join(__dirname, '../dist/index.html'));
});

// Iniciar o servidor
app.listen(PORT, () => {
  console.log(`Servidor rodando na porta ${PORT}`);
  console.log(`Acesse: http://localhost:${PORT}`);
});
