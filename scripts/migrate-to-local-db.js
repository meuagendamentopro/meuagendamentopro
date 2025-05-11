/**
 * Script JavaScript para executar a migração do banco de dados
 * Este é um wrapper simples que executa o script TypeScript
 */

const { execSync } = require('child_process');
const path = require('path');

try {
  console.log('Iniciando migração para banco de dados local...');
  
  // Verificar se tsx está instalado
  try {
    execSync('npx tsx --version', { stdio: 'ignore' });
  } catch (err) {
    console.log('Instalando tsx (executor de TypeScript)...');
    execSync('npm install -g tsx', { stdio: 'inherit' });
  }
  
  // Executar o script TypeScript
  console.log('Executando script de migração...');
  execSync('npx tsx scripts/migrate-to-local-db.ts', { stdio: 'inherit' });
  
  console.log('Migração concluída!');
} catch (error) {
  console.error('Erro durante migração:', error.message);
  process.exit(1);
}