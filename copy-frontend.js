// Script para copiar os arquivos do frontend para o diretório correto
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

console.log('Iniciando cópia dos arquivos do frontend...');

// Diretório de origem (cliente local)
const sourceDir = path.join(__dirname, 'client');

// Diretório de destino (dist)
const targetDir = path.join(__dirname, 'dist');

// Criar diretório de destino se não existir
if (!fs.existsSync(targetDir)) {
  console.log(`Criando diretório ${targetDir}...`);
  fs.mkdirSync(targetDir, { recursive: true });
}

// Função para copiar arquivos recursivamente
function copyDir(src, dest) {
  // Criar diretório de destino se não existir
  if (!fs.existsSync(dest)) {
    fs.mkdirSync(dest, { recursive: true });
  }

  // Ler conteúdo do diretório
  const entries = fs.readdirSync(src, { withFileTypes: true });

  for (const entry of entries) {
    const srcPath = path.join(src, entry.name);
    const destPath = path.join(dest, entry.name);

    if (entry.isDirectory()) {
      // Copiar subdiretório recursivamente
      copyDir(srcPath, destPath);
    } else {
      // Copiar arquivo
      fs.copyFileSync(srcPath, destPath);
      console.log(`Copiado: ${srcPath} -> ${destPath}`);
    }
  }
}

// Verificar se o diretório de origem existe
if (fs.existsSync(sourceDir)) {
  console.log(`Copiando arquivos de ${sourceDir} para ${targetDir}...`);
  try {
    copyDir(sourceDir, targetDir);
    console.log('Cópia concluída com sucesso!');
  } catch (error) {
    console.error('Erro ao copiar arquivos:', error);
  }
} else {
  console.error(`Diretório de origem ${sourceDir} não encontrado.`);
  
  // Criar um arquivo index.html básico no diretório de destino
  console.log('Criando arquivo index.html básico...');
  const htmlContent = `
<!DOCTYPE html>
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
    .btn { display: inline-block; background-color: #4a6cf7; color: white; padding: 10px 20px; border-radius: 4px; text-decoration: none; }
  </style>
</head>
<body>
  <div class="container">
    <h1>Sistema de Agendamento</h1>
    <div class="card">
      <h2>Bem-vindo ao Sistema de Agendamento</h2>
      <p>O servidor está funcionando corretamente.</p>
      <p>Status da API: <span id="apiStatus">Verificando...</span></p>
      <p><a href="/api/health" class="btn">Verificar API</a></p>
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
</html>
  `;
  
  fs.writeFileSync(path.join(targetDir, 'index.html'), htmlContent);
  console.log('Arquivo index.html básico criado com sucesso!');
}
