#!/usr/bin/env tsx
/**
 * Script de Diagnóstico Completo do Sistema
 * 
 * Este script verifica todos os componentes do sistema (banco de dados, autenticação, WebSocket)
 * e gera um relatório detalhado sobre o que está funcionando e o que precisa ser corrigido
 * para que o sistema funcione localmente da mesma forma que funciona no Replit.
 * 
 * Uso: npx tsx scripts/diagnostico-sistema.ts [--fix] [--verbose]
 * Opções:
 *   --fix       Tenta corrigir problemas automaticamente quando possível
 *   --verbose   Exibe informações detalhadas sobre cada teste
 *   --help      Exibe ajuda
 * 
 * O script executará os seguintes testes:
 * 1. Conexão com banco de dados
 * 2. Estrutura do banco de dados (tabelas e colunas)
 * 3. Sistema de autenticação
 * 4. Configuração de WebSocket
 * 5. Variáveis de ambiente
 * 6. Integrações externas (Mercado Pago, etc.)
 * 7. Verificação de dependências
 */

import { db, pool, dbWithQueries, closeDb } from '../server/db';
import { comparePasswords, hashPassword } from '../server/auth';
import * as schema from '../shared/schema';
import { eq, and, sql, desc } from 'drizzle-orm';
import fs from 'fs';
import path from 'path';
import dotenv from 'dotenv';
import { WebSocket } from 'ws';
import http from 'http';
import { execSync } from 'child_process';
import readline from 'readline';
import chalk from 'chalk';

// Importar e carregar variáveis de ambiente
dotenv.config();

// Interface para representar resultados do teste
interface TestResult {
  name: string;
  category: string;
  passed: boolean;
  message: string;
  details?: any;
  fix?: () => Promise<void>;
}

// Argumentos da linha de comando
const args = process.argv.slice(2);
const shouldFix = args.includes('--fix');
const verbose = args.includes('--verbose');
const showHelp = args.includes('--help');

if (showHelp) {
  console.log(`
Script de Diagnóstico Completo do Sistema

Uso: npx tsx scripts/diagnostico-sistema.ts [--fix] [--verbose]

Opções:
  --fix       Tenta corrigir problemas automaticamente quando possível
  --verbose   Exibe informações detalhadas sobre cada teste
  --help      Exibe esta ajuda

Este script verifica todos os componentes do sistema e gera um relatório 
detalhado sobre o que está funcionando e o que precisa ser corrigido.
  `);
  process.exit(0);
}

// Configurações
const TEST_PORT = 5001; // Porta para teste de WebSocket
const TEST_TIMEOUT = 5000; // Timeout em ms para testes

// Array para armazenar resultados de testes
const testResults: TestResult[] = [];

// Cores para console
const colors = {
  passed: chalk.green,
  failed: chalk.red,
  warning: chalk.yellow,
  info: chalk.blue,
  bold: chalk.bold,
  underline: chalk.underline,
};

// Função principal
async function main() {
  console.log(colors.bold('\n=== DIAGNÓSTICO COMPLETO DO SISTEMA ===\n'));
  
  try {
    // 1. Testar conexão com o banco de dados
    await testDatabaseConnection();
    
    // 2. Testar estrutura do banco de dados
    await testDatabaseStructure();
    
    // 3. Testar sistema de autenticação
    await testAuthSystem();
    
    // 4. Testar configuração de WebSocket
    await testWebSocketConfig();
    
    // 5. Testar variáveis de ambiente
    await testEnvironmentVariables();
    
    // 6. Testar integrações externas
    await testExternalIntegrations();
    
    // 7. Testar dependências
    await testDependencies();
    
    // Mostrar relatório
    showReport();
    
    // Fechar conexão com o banco de dados
    await closeDb();
    
  } catch (error) {
    console.error(colors.failed('Erro fatal durante diagnóstico:'), error);
  }
}

// 1. Testar conexão com o banco de dados
async function testDatabaseConnection() {
  console.log(colors.info('Testando conexão com o banco de dados...'));
  
  try {
    // Verificar se a variável de ambiente DATABASE_URL existe
    const dbUrlTest: TestResult = {
      name: 'Variável DATABASE_URL',
      category: 'Banco de Dados',
      passed: !!process.env.DATABASE_URL,
      message: process.env.DATABASE_URL 
        ? 'Variável DATABASE_URL encontrada' 
        : 'Variável DATABASE_URL não encontrada',
    };
    
    testResults.push(dbUrlTest);
    
    if (!dbUrlTest.passed) {
      throw new Error('Variável DATABASE_URL não encontrada. Testes de banco de dados abortados.');
    }
    
    // Executar uma consulta simples para testar a conexão
    const result = await db.execute(sql`SELECT 1 as test`);
    
    const connectionTest: TestResult = {
      name: 'Conexão com o banco de dados',
      category: 'Banco de Dados',
      passed: !!result,
      message: result ? 'Conexão bem-sucedida' : 'Falha na conexão',
      details: verbose ? { databaseUrl: maskDatabaseUrl(process.env.DATABASE_URL || '') } : undefined
    };
    
    testResults.push(connectionTest);
    
    // Verificar pool de conexões
    let poolStatus = false;
    
    try {
      const client = await pool.connect();
      poolStatus = true;
      client.release();
    } catch (error) {
      poolStatus = false;
    }
    
    const poolTest: TestResult = {
      name: 'Pool de conexões',
      category: 'Banco de Dados',
      passed: poolStatus,
      message: poolStatus ? 'Pool de conexões funcionando' : 'Falha no pool de conexões',
    };
    
    testResults.push(poolTest);
    
  } catch (error: any) {
    console.error('Erro durante teste de conexão:', error.message);
    
    testResults.push({
      name: 'Teste de conexão',
      category: 'Banco de Dados',
      passed: false,
      message: `Erro durante teste: ${error.message}`,
    });
  }
}

// 2. Testar estrutura do banco de dados
async function testDatabaseStructure() {
  console.log(colors.info('Verificando estrutura do banco de dados...'));
  
  try {
    // Verificar se as tabelas principais existem
    const tables = [
      'users', 'providers', 'clients', 'services', 
      'appointments', 'provider_clients', 'notifications',
      'time_exclusions', 'subscription_plans', 'subscription_transactions'
    ];
    
    for (const table of tables) {
      let tableExists = false;
      
      try {
        // Verificar se a tabela existe
        const result = await db.execute(sql`
          SELECT EXISTS (
            SELECT FROM information_schema.tables 
            WHERE table_name = ${table}
          ) as exists
        `);
        
        tableExists = result[0]?.exists === true;
      } catch (error) {
        tableExists = false;
      }
      
      testResults.push({
        name: `Tabela '${table}'`,
        category: 'Estrutura do Banco de Dados',
        passed: tableExists,
        message: tableExists ? `Tabela '${table}' existe` : `Tabela '${table}' não encontrada`,
        fix: !tableExists ? async () => {
          console.log(`Corrigindo: criando tabela ${table}...`);
          await runMigration();
        } : undefined
      });
    }
    
    // Verificar colunas críticas em tabelas específicas
    const criticalColumns = [
      { table: 'users', column: 'subscription_expiry' },
      { table: 'appointments', column: 'pix_qr_code' },
      { table: 'providers', column: 'booking_link' },
      { table: 'users', column: 'is_email_verified' },
      { table: 'users', column: 'never_expires' }
    ];
    
    for (const { table, column } of criticalColumns) {
      let columnExists = false;
      
      try {
        // Verificar se a coluna existe
        const result = await db.execute(sql`
          SELECT EXISTS (
            SELECT FROM information_schema.columns 
            WHERE table_name = ${table} AND column_name = ${column}
          ) as exists
        `);
        
        columnExists = result[0]?.exists === true;
      } catch (error) {
        columnExists = false;
      }
      
      testResults.push({
        name: `Coluna '${column}' em '${table}'`,
        category: 'Estrutura do Banco de Dados',
        passed: columnExists,
        message: columnExists 
          ? `Coluna '${column}' existe em '${table}'` 
          : `Coluna '${column}' não encontrada em '${table}'`,
        fix: !columnExists ? async () => {
          console.log(`Corrigindo: adicionando coluna ${column} à tabela ${table}...`);
          await runMigration();
        } : undefined
      });
    }
    
  } catch (error: any) {
    console.error('Erro durante teste de estrutura do banco de dados:', error.message);
    
    testResults.push({
      name: 'Teste de estrutura do banco',
      category: 'Estrutura do Banco de Dados',
      passed: false,
      message: `Erro durante teste: ${error.message}`,
    });
  }
}

// 3. Testar sistema de autenticação
async function testAuthSystem() {
  console.log(colors.info('Testando sistema de autenticação...'));
  
  try {
    // Testar funções de hash e verificação de senha
    const testPassword = 'TestPassword123';
    let hashedPassword = '';
    
    try {
      hashedPassword = await hashPassword(testPassword);
      
      testResults.push({
        name: 'Função de hash de senha',
        category: 'Autenticação',
        passed: !!hashedPassword && hashedPassword.length > 20,
        message: 'Função de hash de senha está funcionando',
      });
      
      // Testar verificação de senha
      const passwordVerification = await comparePasswords(testPassword, hashedPassword);
      
      testResults.push({
        name: 'Verificação de senha',
        category: 'Autenticação',
        passed: passwordVerification,
        message: passwordVerification 
          ? 'Verificação de senha funcionando corretamente' 
          : 'Falha na verificação de senha',
      });
      
    } catch (error: any) {
      testResults.push({
        name: 'Sistema de hash de senha',
        category: 'Autenticação',
        passed: false,
        message: `Erro no sistema de hash: ${error.message}`,
      });
    }
    
    // Verificar se existem usuários no sistema
    let usersExist = false;
    let adminExists = false;
    
    try {
      const usersCount = await db.select({ count: sql<number>`count(*)` })
        .from(schema.users);
      
      usersExist = usersCount[0]?.count > 0;
      
      if (usersExist) {
        // Verificar se existe um usuário admin
        const adminCount = await db.select({ count: sql<number>`count(*)` })
          .from(schema.users)
          .where(eq(schema.users.role, 'admin'));
        
        adminExists = adminCount[0]?.count > 0;
      }
      
      testResults.push({
        name: 'Usuários no sistema',
        category: 'Autenticação',
        passed: usersExist,
        message: usersExist 
          ? `Existem usuários cadastrados no sistema` 
          : 'Não existem usuários cadastrados',
        fix: !usersExist ? async () => {
          console.log('Corrigindo: criando usuário admin padrão...');
          const hashedPassword = await hashPassword('password123');
          await db.insert(schema.users).values({
            name: 'Admin',
            username: 'admin',
            email: 'admin@example.com',
            password: hashedPassword,
            role: 'admin',
            neverExpires: true,
            isActive: true,
            isEmailVerified: true,
            createdAt: new Date(),
            updatedAt: new Date()
          });
          console.log('Usuário admin criado com sucesso. Credenciais: admin / password123');
        } : undefined
      });
      
      testResults.push({
        name: 'Usuário administrador',
        category: 'Autenticação',
        passed: adminExists,
        message: adminExists 
          ? 'Existe pelo menos um usuário administrador' 
          : 'Não existe usuário administrador',
        fix: !adminExists && usersExist ? async () => {
          console.log('Corrigindo: elevando um usuário para administrador...');
          const users = await db.select().from(schema.users).limit(1);
          if (users.length > 0) {
            await db.update(schema.users)
              .set({ role: 'admin', neverExpires: true })
              .where(eq(schema.users.id, users[0].id));
            console.log(`Usuário ${users[0].username} promovido a administrador`);
          }
        } : undefined
      });
      
    } catch (error: any) {
      testResults.push({
        name: 'Verificação de usuários',
        category: 'Autenticação',
        passed: false,
        message: `Erro ao verificar usuários: ${error.message}`,
      });
    }
    
  } catch (error: any) {
    console.error('Erro durante teste de autenticação:', error.message);
    
    testResults.push({
      name: 'Sistema de autenticação',
      category: 'Autenticação',
      passed: false,
      message: `Erro durante teste: ${error.message}`,
    });
  }
}

// 4. Testar configuração de WebSocket
async function testWebSocketConfig() {
  console.log(colors.info('Testando configuração de WebSocket...'));
  
  let server: http.Server | null = null;
  
  try {
    // Verificar porta WebSocket
    const isPortAvailable = await checkPortAvailable(TEST_PORT);
    
    testResults.push({
      name: 'Porta WebSocket disponível',
      category: 'WebSocket',
      passed: isPortAvailable,
      message: isPortAvailable 
        ? `Porta ${TEST_PORT} está disponível para WebSocket` 
        : `Porta ${TEST_PORT} não está disponível`,
    });
    
    if (!isPortAvailable) {
      throw new Error('Porta para teste WebSocket não está disponível');
    }
    
    // Criar um servidor WebSocket temporário para teste
    server = http.createServer();
    const wss = new WebSocket.Server({ server, path: '/ws' });
    
    let wsServerRunning = false;
    let testSuccessful = false;
    let connectionSuccessful = false;
    
    // Iniciar o servidor
    await new Promise<void>((resolve) => {
      try {
        server!.listen(TEST_PORT, () => {
          wsServerRunning = true;
          resolve();
        });
      } catch (e) {
        resolve();
      }
    });
    
    testResults.push({
      name: 'Inicialização do servidor WebSocket',
      category: 'WebSocket',
      passed: wsServerRunning,
      message: wsServerRunning 
        ? 'Servidor WebSocket inicializado com sucesso' 
        : 'Falha ao inicializar servidor WebSocket',
    });
    
    if (!wsServerRunning) {
      throw new Error('Não foi possível inicializar o servidor WebSocket');
    }
    
    // Configurar evento de conexão
    wss.on('connection', (ws) => {
      connectionSuccessful = true;
      ws.on('message', (message) => {
        if (message.toString() === 'test') {
          ws.send('success');
        }
      });
    });
    
    // Testar conexão
    const wsClient = new WebSocket(`ws://localhost:${TEST_PORT}/ws`);
    
    await new Promise<void>((resolve) => {
      // Timeout para falha
      const timeout = setTimeout(() => {
        resolve();
      }, TEST_TIMEOUT);
      
      wsClient.on('open', () => {
        wsClient.send('test');
      });
      
      wsClient.on('message', (data) => {
        if (data.toString() === 'success') {
          testSuccessful = true;
          clearTimeout(timeout);
          wsClient.close();
          resolve();
        }
      });
      
      wsClient.on('error', () => {
        clearTimeout(timeout);
        resolve();
      });
    });
    
    testResults.push({
      name: 'Conexão WebSocket',
      category: 'WebSocket',
      passed: connectionSuccessful,
      message: connectionSuccessful 
        ? 'Cliente conectou ao servidor WebSocket com sucesso' 
        : 'Falha na conexão WebSocket',
    });
    
    testResults.push({
      name: 'Comunicação WebSocket',
      category: 'WebSocket',
      passed: testSuccessful,
      message: testSuccessful 
        ? 'Comunicação WebSocket funcionando corretamente' 
        : 'Falha na comunicação WebSocket',
    });
    
    // Verificar configuração do WebSocket no código
    const serverPath = path.join(process.cwd(), 'server', 'routes.ts');
    const clientPath = path.join(process.cwd(), 'client', 'src', 'hooks', 'use-websocket.tsx');
    
    let serverWSConfigOK = false;
    let clientWSConfigOK = false;
    
    if (fs.existsSync(serverPath)) {
      const serverCode = fs.readFileSync(serverPath, 'utf8');
      serverWSConfigOK = serverCode.includes('WebSocketServer') && 
                          serverCode.includes('server: httpServer') &&
                          serverCode.includes("path: '/ws'");
    }
    
    if (fs.existsSync(clientPath)) {
      const clientCode = fs.readFileSync(clientPath, 'utf8');
      clientWSConfigOK = clientCode.includes('new WebSocket') && 
                         clientCode.includes('const protocol = window.location.protocol') &&
                         clientCode.includes('/ws');
    }
    
    testResults.push({
      name: 'Configuração WebSocket no servidor',
      category: 'WebSocket',
      passed: serverWSConfigOK,
      message: serverWSConfigOK 
        ? 'Configuração WebSocket no servidor está correta' 
        : 'Configuração WebSocket no servidor precisa ser verificada',
    });
    
    testResults.push({
      name: 'Configuração WebSocket no cliente',
      category: 'WebSocket',
      passed: clientWSConfigOK,
      message: clientWSConfigOK 
        ? 'Configuração WebSocket no cliente está correta' 
        : 'Configuração WebSocket no cliente precisa ser verificada',
    });
    
  } catch (error: any) {
    console.error('Erro durante teste de WebSocket:', error.message);
    
    testResults.push({
      name: 'Teste WebSocket',
      category: 'WebSocket',
      passed: false,
      message: `Erro durante teste: ${error.message}`,
    });
  } finally {
    // Fechar o servidor se estiver aberto
    if (server) {
      server.close();
    }
  }
}

// 5. Testar variáveis de ambiente
async function testEnvironmentVariables() {
  console.log(colors.info('Verificando variáveis de ambiente...'));
  
  // Lista de variáveis obrigatórias
  const requiredVars = [
    'DATABASE_URL',
    'SESSION_SECRET',
    'NODE_ENV'
  ];
  
  // Lista de variáveis opcionais
  const optionalVars = [
    'MERCADOPAGO_ACCESS_TOKEN',
    'GMAIL_USER',
    'GMAIL_APP_PASSWORD'
  ];
  
  // Verificar se o arquivo .env existe
  const envFileExists = fs.existsSync(path.join(process.cwd(), '.env'));
  
  testResults.push({
    name: 'Arquivo .env',
    category: 'Variáveis de Ambiente',
    passed: envFileExists,
    message: envFileExists ? 'Arquivo .env encontrado' : 'Arquivo .env não encontrado',
    fix: !envFileExists ? async () => {
      console.log('Corrigindo: criando arquivo .env básico...');
      const envSample = `
DATABASE_URL=postgres://postgres:postgres@localhost:5432/agendadb
SESSION_SECRET=development-session-secret
NODE_ENV=development
      `.trim();
      
      fs.writeFileSync(path.join(process.cwd(), '.env'), envSample);
      console.log('Arquivo .env básico criado. Por favor, atualize-o com suas configurações específicas.');
    } : undefined
  });
  
  // Verificar variáveis obrigatórias
  for (const varName of requiredVars) {
    const exists = process.env[varName] !== undefined;
    
    testResults.push({
      name: `Variável ${varName}`,
      category: 'Variáveis de Ambiente',
      passed: exists,
      message: exists 
        ? `Variável ${varName} definida` 
        : `Variável ${varName} não definida`,
    });
  }
  
  // Verificar variáveis opcionais
  for (const varName of optionalVars) {
    const exists = process.env[varName] !== undefined;
    
    testResults.push({
      name: `Variável ${varName} (opcional)`,
      category: 'Variáveis de Ambiente',
      passed: true, // Não falha o teste, apenas informa
      message: exists 
        ? `Variável opcional ${varName} definida` 
        : `Variável opcional ${varName} não definida`,
    });
  }
  
  // Verificar se NODE_ENV está definido corretamente para o ambiente
  const nodeEnv = process.env.NODE_ENV || '';
  const isValidEnv = ['development', 'production', 'test'].includes(nodeEnv);
  
  testResults.push({
    name: 'Configuração de NODE_ENV',
    category: 'Variáveis de Ambiente',
    passed: isValidEnv,
    message: isValidEnv 
      ? `NODE_ENV está definido como '${nodeEnv}'` 
      : `NODE_ENV '${nodeEnv}' não é um valor válido`,
  });
}

// 6. Testar integrações externas
async function testExternalIntegrations() {
  console.log(colors.info('Verificando integrações externas...'));
  
  // Testar integração com Mercado Pago
  const hasMercadoPagoToken = !!process.env.MERCADOPAGO_ACCESS_TOKEN;
  const isValidToken = hasMercadoPagoToken && 
                       process.env.MERCADOPAGO_ACCESS_TOKEN!.startsWith('APP_USR-');
  
  testResults.push({
    name: 'Token Mercado Pago',
    category: 'Integrações Externas',
    passed: isValidToken, // Não falha o teste, apenas informa
    message: hasMercadoPagoToken 
      ? (isValidToken 
          ? 'Token Mercado Pago parece válido' 
          : 'Token Mercado Pago presente, mas pode não ser válido (deve começar com APP_USR-)')
      : 'Token Mercado Pago não configurado',
  });
  
  // Testar integração com Gmail (para envio de emails)
  const hasGmailCredentials = !!process.env.GMAIL_USER && !!process.env.GMAIL_APP_PASSWORD;
  
  testResults.push({
    name: 'Credenciais Gmail',
    category: 'Integrações Externas',
    passed: hasGmailCredentials, // Não falha o teste, apenas informa
    message: hasGmailCredentials 
      ? 'Credenciais Gmail configuradas' 
      : 'Credenciais Gmail não configuradas',
  });
  
  // Verificar configuração de URLs no código para ambiente local vs. Replit
  const urlConfigured = await checkUrlConfiguration();
  
  testResults.push({
    name: 'Configuração de URLs',
    category: 'Integrações Externas',
    passed: urlConfigured.passed,
    message: urlConfigured.message,
    details: urlConfigured.details,
    fix: !urlConfigured.passed ? async () => {
      console.log('Corrigindo configurações de URL...');
      await fixUrlConfiguration();
    } : undefined
  });
}

// 7. Testar dependências
async function testDependencies() {
  console.log(colors.info('Verificando dependências...'));
  
  // Verificar se o package.json existe
  const packageJsonPath = path.join(process.cwd(), 'package.json');
  const hasPackageJson = fs.existsSync(packageJsonPath);
  
  testResults.push({
    name: 'package.json',
    category: 'Dependências',
    passed: hasPackageJson,
    message: hasPackageJson ? 'package.json encontrado' : 'package.json não encontrado',
  });
  
  if (!hasPackageJson) {
    return;
  }
  
  // Carregar package.json
  const packageJson = JSON.parse(fs.readFileSync(packageJsonPath, 'utf8'));
  
  // Verificar dependências críticas
  const criticalDeps = [
    '@neondatabase/serverless',
    'drizzle-orm',
    'bcrypt',
    'express',
    'express-session',
    'ws',
    'react',
    'vite'
  ];
  
  const allDeps = {
    ...(packageJson.dependencies || {}),
    ...(packageJson.devDependencies || {})
  };
  
  for (const dep of criticalDeps) {
    const hasDep = !!allDeps[dep];
    
    testResults.push({
      name: `Dependência ${dep}`,
      category: 'Dependências',
      passed: hasDep,
      message: hasDep 
        ? `Dependência ${dep} instalada` 
        : `Dependência ${dep} não encontrada`,
      fix: !hasDep ? async () => {
        console.log(`Corrigindo: instalando dependência ${dep}...`);
        try {
          execSync(`npm install ${dep}`, { stdio: 'inherit' });
          console.log(`Dependência ${dep} instalada com sucesso`);
        } catch (error) {
          console.error(`Erro ao instalar ${dep}`);
        }
      } : undefined
    });
  }
  
  // Verificar scripts necessários
  const criticalScripts = ['dev', 'build'];
  
  for (const script of criticalScripts) {
    const hasScript = !!packageJson.scripts && !!packageJson.scripts[script];
    
    testResults.push({
      name: `Script ${script}`,
      category: 'Dependências',
      passed: hasScript,
      message: hasScript 
        ? `Script ${script} configurado` 
        : `Script ${script} não configurado`,
    });
  }
  
  // Verificar node_modules
  const hasNodeModules = fs.existsSync(path.join(process.cwd(), 'node_modules'));
  
  testResults.push({
    name: 'node_modules',
    category: 'Dependências',
    passed: hasNodeModules,
    message: hasNodeModules 
      ? 'Diretório node_modules encontrado' 
      : 'Diretório node_modules não encontrado',
    fix: !hasNodeModules ? async () => {
      console.log('Corrigindo: instalando dependências...');
      try {
        execSync('npm install', { stdio: 'inherit' });
        console.log('Dependências instaladas com sucesso');
      } catch (error) {
        console.error('Erro ao instalar dependências');
      }
    } : undefined
  });
}

// Função para mascarar a URL do banco de dados para segurança
function maskDatabaseUrl(url: string): string {
  try {
    const dbUrl = new URL(url);
    
    // Mascarar senha se presente
    if (dbUrl.password) {
      dbUrl.password = '****';
    }
    
    return dbUrl.toString();
  } catch (error) {
    return 'URL inválida';
  }
}

// Função para verificar se uma porta está disponível
async function checkPortAvailable(port: number): Promise<boolean> {
  return new Promise((resolve) => {
    const server = http.createServer();
    
    server.once('error', () => {
      resolve(false);
    });
    
    server.once('listening', () => {
      server.close(() => {
        resolve(true);
      });
    });
    
    server.listen(port);
  });
}

// Função para executar a migração do banco de dados
async function runMigration(): Promise<void> {
  try {
    console.log('Executando migração do banco de dados...');
    
    const migrationScript = path.join(process.cwd(), 'scripts', 'db-push.ts');
    
    if (fs.existsSync(migrationScript)) {
      execSync(`npx tsx ${migrationScript}`, { stdio: 'inherit' });
      console.log('Migração concluída com sucesso');
    } else {
      console.error('Script de migração não encontrado');
    }
  } catch (error: any) {
    console.error('Erro ao executar migração:', error.message);
  }
}

// Função para verificar a configuração de URLs
async function checkUrlConfiguration(): Promise<{ passed: boolean; message: string; details?: any }> {
  try {
    // Vamos procurar por URLs hardcoded nos arquivos
    const clientDir = path.join(process.cwd(), 'client', 'src');
    const serverDir = path.join(process.cwd(), 'server');
    
    // URLs do Replit que precisamos verificar
    const replitDomains = ['replit.app', 'repl.co'];
    let foundReplitUrls: Array<{file: string, url: string}> = [];
    
    // Arquivos a verificar
    const filesToCheck = [
      path.join(serverDir, 'routes.ts'),
      path.join(clientDir, 'lib', 'queryClient.ts'),
      path.join(clientDir, 'hooks', 'use-websocket.tsx'),
    ];
    
    for (const filePath of filesToCheck) {
      if (fs.existsSync(filePath)) {
        const content = fs.readFileSync(filePath, 'utf8');
        
        // Procurar por URLs do Replit
        for (const domain of replitDomains) {
          const regex = new RegExp(`['"](https?:\\/\\/[\\w.-]*\\.${domain}[\\/\\w.-]*)['"](\\s|,|\\))`, 'g');
          let match;
          
          while ((match = regex.exec(content)) !== null) {
            foundReplitUrls.push({
              file: path.relative(process.cwd(), filePath),
              url: match[1] as string
            });
          }
        }
      }
    }
    
    if (foundReplitUrls.length > 0) {
      return {
        passed: false,
        message: `Encontradas ${foundReplitUrls.length} URLs do Replit hardcoded no código`,
        details: foundReplitUrls
      };
    }
    
    return {
      passed: true,
      message: 'Não foram encontradas URLs do Replit hardcoded no código'
    };
  } catch (error: any) {
    return {
      passed: false,
      message: `Erro ao verificar configuração de URLs: ${error.message}`
    };
  }
}

// Função para corrigir configuração de URLs
async function fixUrlConfiguration(): Promise<void> {
  try {
    // Listar os arquivos a corrigir
    const clientDir = path.join(process.cwd(), 'client', 'src');
    const serverDir = path.join(process.cwd(), 'server');
    
    const filesToFix = [
      {
        path: path.join(serverDir, 'routes.ts'),
        find: /['"]https?:\/\/[\w.-]*\.replit\.app[\/\w.-]*['"]/g,
        replace: match => {
          // Substituir URLs hardcoded por referências a variáveis de ambiente
          return 'process.env.APP_URL || "http://localhost:5000"';
        }
      },
      {
        path: path.join(clientDir, 'hooks', 'use-websocket.tsx'),
        find: /const wsUrl = [`'"]wss:\/\/[\w.-]*\.replit\.app\/ws[`'"]/g,
        replace: match => {
          // Substituir por código que determina a URL dinamicamente
          return 'const protocol = window.location.protocol === "https:" ? "wss:" : "ws:";\n' +
                 '  const wsUrl = `${protocol}//${window.location.host}/ws`';
        }
      }
    ];
    
    for (const file of filesToFix) {
      if (fs.existsSync(file.path)) {
        let content = fs.readFileSync(file.path, 'utf8');
        const updated = content.replace(file.find, file.replace as any);
        
        if (content !== updated) {
          fs.writeFileSync(file.path, updated);
          console.log(`Atualizado: ${path.relative(process.cwd(), file.path)}`);
        }
      }
    }
    
    // Verificar se .env possui APP_URL
    const envPath = path.join(process.cwd(), '.env');
    if (fs.existsSync(envPath)) {
      let envContent = fs.readFileSync(envPath, 'utf8');
      
      if (!envContent.includes('APP_URL=')) {
        envContent += '\n# URL da aplicação (usado para gerar URLs absolutas)\n';
        envContent += 'APP_URL=http://localhost:5000\n';
        
        fs.writeFileSync(envPath, envContent);
        console.log('Adicionada APP_URL ao arquivo .env');
      }
    }
    
  } catch (error: any) {
    console.error('Erro ao corrigir configurações de URLs:', error.message);
  }
}

// Função para mostrar o relatório
function showReport() {
  // Agrupar por categoria
  const categorized = testResults.reduce((acc, result) => {
    if (!acc[result.category]) {
      acc[result.category] = [];
    }
    acc[result.category].push(result);
    return acc;
  }, {} as Record<string, TestResult[]>);
  
  console.log('\n' + colors.bold(colors.underline('RELATÓRIO DE DIAGNÓSTICO')));
  
  // Estatísticas gerais
  const totalTests = testResults.length;
  const passedTests = testResults.filter(t => t.passed).length;
  const failedTests = totalTests - passedTests;
  const passRate = Math.round((passedTests / totalTests) * 100);
  
  console.log('\n' + colors.bold('Resumo:'));
  console.log(`Total de testes: ${totalTests}`);
  console.log(`Testes passados: ${colors.passed(passedTests)}`);
  console.log(`Testes falhos: ${failedTests > 0 ? colors.failed(failedTests) : failedTests}`);
  console.log(`Taxa de sucesso: ${passRate}%`);
  
  // Mostrar resultados por categoria
  for (const [category, results] of Object.entries(categorized)) {
    console.log('\n' + colors.bold(colors.underline(category)));
    
    const passedInCategory = results.filter(r => r.passed).length;
    const totalInCategory = results.length;
    
    console.log(`${passedInCategory}/${totalInCategory} testes passados\n`);
    
    for (const result of results) {
      const status = result.passed 
        ? colors.passed('✓ PASSOU') 
        : colors.failed('✗ FALHOU');
      
      console.log(`${status} - ${result.name}: ${result.message}`);
      
      if (verbose && result.details) {
        console.log('  Detalhes:', result.details);
      }
    }
  }
  
  // Mostrar ações de correção disponíveis
  const fixableTests = testResults.filter(t => !t.passed && t.fix);
  
  if (fixableTests.length > 0 && !shouldFix) {
    console.log('\n' + colors.bold(colors.warning('Ações de correção disponíveis:')));
    console.log('Os seguintes problemas podem ser corrigidos automaticamente:');
    
    for (const test of fixableTests) {
      console.log(colors.warning(`- ${test.name}: ${test.message}`));
    }
    
    console.log('\nExecute o script com a opção --fix para corrigir estes problemas.');
  }
  
  // Aplicar correções se necessário
  if (shouldFix && fixableTests.length > 0) {
    console.log('\n' + colors.bold('Aplicando correções automáticas...'));
    
    applyFixes(fixableTests);
  }
  
  // Mostrar recomendações gerais
  if (failedTests > 0) {
    console.log('\n' + colors.bold(colors.warning('Recomendações:')));
    
    // Agrupar recomendações por categoria
    let recommendations: Record<string, string[]> = {};
    
    for (const result of testResults.filter(t => !t.passed)) {
      if (!recommendations[result.category]) {
        recommendations[result.category] = [];
      }
      
      if (result.fix) {
        recommendations[result.category].push(
          `Corrigir problema: ${result.name} - ${result.message} (pode ser corrigido automaticamente com --fix)`
        );
      } else {
        recommendations[result.category].push(
          `Verificar: ${result.name} - ${result.message}`
        );
      }
    }
    
    for (const [category, recs] of Object.entries(recommendations)) {
      console.log(colors.bold(`\n${category}:`));
      for (const rec of recs) {
        console.log(`- ${rec}`);
      }
    }
  }
  
  console.log('\n' + colors.bold(colors.info('Diagnóstico concluído.')));
}

// Função para aplicar correções
async function applyFixes(fixableTests: TestResult[]) {
  const rl = readline.createInterface({
    input: process.stdin,
    output: process.stdout
  });
  
  for (const test of fixableTests) {
    const answer = await new Promise<string>(resolve => {
      rl.question(
        colors.warning(`Corrigir "${test.name}" (${test.message})? [S/n]: `), 
        resolve
      );
    });
    
    if (answer.toLowerCase() !== 'n') {
      try {
        await test.fix!();
        console.log(colors.passed('✓ Correção aplicada com sucesso'));
      } catch (error: any) {
        console.error(colors.failed(`✗ Erro ao aplicar correção: ${error.message}`));
      }
    }
  }
  
  rl.close();
  
  console.log(colors.info('\nCorreções concluídas. Recomendamos executar o diagnóstico novamente.'));
}

// Iniciar execução
main().catch(error => {
  console.error('Erro fatal durante a execução do diagnóstico:', error);
  process.exit(1);
});