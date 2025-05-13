/**
 * Script JavaScript para executar a migração do banco de dados
 * Este é um wrapper simples que executa o script TypeScript
 */

const { execSync } = require('child_process');
const path = require('path');

console.log('Iniciando migração para banco de dados local...');

try {
  execSync('npx tsx scripts/migrate-to-local-db.ts', { stdio: 'inherit' });
} catch (error) {
  console.error('Erro durante a migração:', error.message);
  process.exit(1);
}