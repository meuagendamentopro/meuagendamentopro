#!/usr/bin/env tsx
/**
 * Script para migrar o sistema de Replit para ambiente local
 * 
 * Este script:
 * 1. Verifica requisitos do sistema (Node.js, PostgreSQL)
 * 2. Configura variáveis de ambiente
 * 3. Migra o banco de dados (opcional)
 * 4. Atualiza configurações para ambiente local
 * 
 * Uso: npx tsx scripts/migrar-para-local.ts
 */

import { execSync } from 'child_process';
import fs from 'fs';
import path from 'path';
import readline from 'readline';
import { fileURLToPath } from 'url';
import chalk from 'chalk';

// Diretório atual
const __dirname = path.dirname(fileURLToPath(import.meta.url));
const rootDir = path.join(__dirname, '..');

// Interface para leitura de input
const rl = readline.createInterface({
  input: process.stdin,
  output: process.stdout
});

// Cores para console
const colors = {
  success: chalk.green,
  error: chalk.red,
  warning: chalk.yellow,
  info: chalk.blue,
  bold: chalk.bold,
};

// Função para perguntar ao usuário
const ask = (question: string): Promise<string> => {
  return new Promise((resolve) => {
    rl.question(question, (answer) => {
      resolve(answer);
    });
  });
};

// Função principal
async function main() {
  console.log(colors.bold('\n=== MIGRAÇÃO DE REPLIT PARA AMBIENTE LOCAL ===\n'));
  
  try {
    // 1. Verificar requisitos
    await checkRequirements();
    
    // 2. Configurar variáveis de ambiente
    await setupEnvironment();
    
    // 3. Perguntar sobre migração do banco de dados
    const shouldMigrateDb = (await ask('Deseja migrar o banco de dados? (s/N): ')).toLowerCase() === 's';
    
    if (shouldMigrateDb) {
      await migrateDatabase();
    } else {
      console.log(colors.info('Migração de banco de dados ignorada.'));
    }
    
    // 4. Atualizar configurações
    await updateConfigurations();
    
    console.log(colors.bold('\n=== MIGRAÇÃO CONCLUÍDA ===\n'));
    console.log(colors.success('O sistema foi migrado para ambiente local com sucesso.'));
    console.log('Para iniciar a aplicação, execute:');
    console.log(colors.bold('  npm run dev'));
    
  } catch (error: any) {
    console.error(colors.error('\nErro durante a migração:'), error.message);
    console.error(colors.warning('A migração foi interrompida devido a erros.'));
  } finally {
    rl.close();
  }
}

// 1. Verificar requisitos do sistema
async function checkRequirements() {
  console.log(colors.info('Verificando requisitos do sistema...'));
  
  // Verificar Node.js
  try {
    const nodeVersion = execSync('node --version').toString().trim();
    console.log(colors.success(`✓ Node.js instalado: ${nodeVersion}`));
    
    // Verificar se a versão do Node.js é compatível (>= 18)
    const versionMatch = nodeVersion.match(/v(\d+)\./);
    if (versionMatch && parseInt(versionMatch[1]) < 18) {
      console.log(colors.warning('⚠ Recomendamos Node.js versão 18 ou superior para melhor compatibilidade.'));
    }
  } catch (error) {
    throw new Error('Node.js não encontrado. Por favor, instale o Node.js para continuar.');
  }
  
  // Verificar npm
  try {
    const npmVersion = execSync('npm --version').toString().trim();
    console.log(colors.success(`✓ npm instalado: ${npmVersion}`));
  } catch (error) {
    throw new Error('npm não encontrado. Por favor, instale o npm para continuar.');
  }
  
  // Verificar PostgreSQL
  try {
    const pgVersion = await checkPostgresql();
    console.log(colors.success(`✓ PostgreSQL disponível: ${pgVersion}`));
  } catch (error: any) {
    console.log(colors.warning(`⚠ ${error.message}`));
    const shouldContinue = (await ask('Deseja continuar mesmo sem PostgreSQL? (s/N): ')).toLowerCase() === 's';
    
    if (!shouldContinue) {
      throw new Error('PostgreSQL é necessário para continuar.');
    }
  }
  
  // Verificar package.json
  const packageJsonPath = path.join(rootDir, 'package.json');
  if (!fs.existsSync(packageJsonPath)) {
    throw new Error('package.json não encontrado. Verifique se você está no diretório correto.');
  }
  console.log(colors.success('✓ package.json encontrado'));
  
  console.log(colors.success('✓ Todos os requisitos verificados\n'));
}

// Verificar PostgreSQL
async function checkPostgresql(): Promise<string> {
  return new Promise((resolve, reject) => {
    try {
      // Testar conexão com PostgreSQL
      const pgVersion = execSync('psql --version').toString().trim();
      resolve(pgVersion);
    } catch (error) {
      reject(new Error('PostgreSQL não encontrado ou não configurado corretamente'));
    }
  });
}

// 2. Configurar variáveis de ambiente
async function setupEnvironment() {
  console.log(colors.info('Configurando variáveis de ambiente...'));
  
  const envPath = path.join(rootDir, '.env');
  let envExists = fs.existsSync(envPath);
  
  if (envExists) {
    console.log(colors.success('✓ Arquivo .env encontrado'));
    const overwrite = (await ask('Deseja sobrescrever o arquivo .env existente? (s/N): ')).toLowerCase() === 's';
    
    if (!overwrite) {
      console.log(colors.info('Mantendo arquivo .env existente.'));
      return;
    }
  }
  
  console.log(colors.info('Criando novo arquivo .env...'));
  
  // Configurações do banco de dados
  const dbHost = await ask('Host do banco de dados PostgreSQL (default: localhost): ') || 'localhost';
  const dbPort = await ask('Porta do banco de dados PostgreSQL (default: 5432): ') || '5432';
  const dbUser = await ask('Usuário do banco de dados PostgreSQL (default: postgres): ') || 'postgres';
  const dbPassword = await ask('Senha do banco de dados PostgreSQL: ');
  const dbName = await ask('Nome do banco de dados PostgreSQL (default: agendadb): ') || 'agendadb';
  
  // Configurações do Mercado Pago (opcional)
  console.log(colors.info('\nConfigurações do Mercado Pago (opcional, pressione Enter para pular)'));
  const mpToken = await ask('Token de Acesso Mercado Pago (começa com APP_USR-): ');
  
  // Configurações do Gmail (opcional)
  console.log(colors.info('\nConfigurações do Gmail para envio de emails (opcional, pressione Enter para pular)'));
  const gmailUser = await ask('Email Gmail: ');
  const gmailPassword = await ask('Senha de App do Gmail: ');
  
  // Gerar conteúdo do arquivo .env
  let envContent = `# Configurações do Ambiente
NODE_ENV=development

# Configurações do Banco de Dados
DATABASE_URL=postgres://${dbUser}:${dbPassword}@${dbHost}:${dbPort}/${dbName}
PGHOST=${dbHost}
PGPORT=${dbPort}
PGUSER=${dbUser}
PGPASSWORD=${dbPassword}
PGDATABASE=${dbName}

# Configurações da Aplicação
PORT=5000
SESSION_SECRET=${generateRandomString(32)}
APP_URL=http://localhost:5000
`;

  // Adicionar configurações opcionais se fornecidas
  if (mpToken) {
    envContent += `\n# Configurações do Mercado Pago
MERCADOPAGO_ACCESS_TOKEN=${mpToken}
`;
  }
  
  if (gmailUser && gmailPassword) {
    envContent += `\n# Configurações do Gmail
GMAIL_USER=${gmailUser}
GMAIL_APP_PASSWORD=${gmailPassword}
`;
  }
  
  // Salvar arquivo .env
  fs.writeFileSync(envPath, envContent);
  console.log(colors.success('✓ Arquivo .env criado com sucesso\n'));
}

// 3. Migrar banco de dados
async function migrateDatabase() {
  console.log(colors.info('Configurando banco de dados...'));
  
  // Verificar se o script de migração existe
  const migrationScriptPath = path.join(rootDir, 'scripts', 'migrate-to-local-db.ts');
  const setupScriptPath = path.join(rootDir, 'scripts', 'setup-db.ts');
  
  if (fs.existsSync(migrationScriptPath)) {
    console.log(colors.info('Executando script de migração do banco de dados...'));
    
    try {
      execSync(`npx tsx ${migrationScriptPath}`, { stdio: 'inherit' });
      console.log(colors.success('✓ Banco de dados migrado com sucesso\n'));
    } catch (error) {
      console.error(colors.error('Erro durante a migração do banco de dados.'));
      
      // Tentar criar as tabelas sem migrar dados
      console.log(colors.info('Tentando criar estrutura do banco de dados sem migrar dados...'));
      
      if (fs.existsSync(setupScriptPath)) {
        try {
          execSync(`npx tsx ${setupScriptPath}`, { stdio: 'inherit' });
          console.log(colors.success('✓ Estrutura do banco de dados criada com sucesso\n'));
        } catch (setupError) {
          throw new Error('Não foi possível criar a estrutura do banco de dados.');
        }
      } else {
        throw new Error('Script de configuração do banco de dados não encontrado.');
      }
    }
  } else if (fs.existsSync(setupScriptPath)) {
    console.log(colors.info('Script de migração não encontrado. Criando estrutura do banco de dados...'));
    
    try {
      execSync(`npx tsx ${setupScriptPath}`, { stdio: 'inherit' });
      console.log(colors.success('✓ Estrutura do banco de dados criada com sucesso\n'));
    } catch (error) {
      throw new Error('Não foi possível criar a estrutura do banco de dados.');
    }
  } else {
    throw new Error('Scripts de migração e configuração do banco de dados não encontrados.');
  }
}

// 4. Atualizar configurações
async function updateConfigurations() {
  console.log(colors.info('Atualizando configurações para ambiente local...'));
  
  // Arquivos a atualizar
  const filesToUpdate = [
    {
      path: path.join(rootDir, 'server', 'routes.ts'),
      patterns: [
        {
          find: /['"]https?:\/\/[\w.-]*\.replit\.app[\/\w.-]*['"]/g,
          replace: 'process.env.APP_URL || "http://localhost:5000"'
        }
      ]
    },
    {
      path: path.join(rootDir, 'client', 'src', 'hooks', 'use-websocket.tsx'),
      patterns: [
        {
          find: /const wsUrl = [`'"]wss:\/\/[\w.-]*\.replit\.app\/ws[`'"]/g,
          replace: 'const protocol = window.location.protocol === "https:" ? "wss:" : "ws:";\n  const wsUrl = `${protocol}//${window.location.host}/ws`'
        }
      ]
    },
    {
      path: path.join(rootDir, 'server', 'index.ts'),
      patterns: [
        {
          find: /const PORT = \d+;/g,
          replace: 'const PORT = process.env.PORT ? parseInt(process.env.PORT) : 5000;'
        }
      ]
    }
  ];
  
  for (const file of filesToUpdate) {
    if (fs.existsSync(file.path)) {
      let content = fs.readFileSync(file.path, 'utf8');
      let modified = false;
      
      for (const pattern of file.patterns) {
        const newContent = content.replace(pattern.find, pattern.replace);
        if (newContent !== content) {
          content = newContent;
          modified = true;
        }
      }
      
      if (modified) {
        fs.writeFileSync(file.path, content);
        console.log(colors.success(`✓ Atualizado: ${path.relative(rootDir, file.path)}`));
      }
    }
  }
  
  // Instalar dependências
  console.log(colors.info('\nInstalando dependências...'));
  
  try {
    execSync('npm install', { stdio: 'inherit', cwd: rootDir });
    console.log(colors.success('✓ Dependências instaladas com sucesso\n'));
  } catch (error) {
    console.error(colors.error('Erro ao instalar dependências.'));
    console.log(colors.warning('Você pode precisar instalar as dependências manualmente com npm install.'));
  }
}

// Função auxiliar para gerar string aleatória
function generateRandomString(length: number): string {
  const characters = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789';
  let result = '';
  
  for (let i = 0; i < length; i++) {
    result += characters.charAt(Math.floor(Math.random() * characters.length));
  }
  
  return result;
}

// Iniciar execução
main().catch(error => {
  console.error(colors.error('Erro fatal durante a migração:'), error);
  process.exit(1);
});