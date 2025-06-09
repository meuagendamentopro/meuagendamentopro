import { Router } from 'express';
import path from 'path';
import fs from 'fs';
import { fileURLToPath } from 'url';
import { dirname } from 'path';

// Obter o diretório atual (substitui __dirname que não está disponível em ESM)
const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

const router = Router();

// Rota para servir o arquivo Excel
router.get('/dados.xlsx', (req, res) => {
  console.log('Requisição para o arquivo Excel recebida');
  
  // Caminho para o arquivo Excel
  const excelFilePath = path.resolve(__dirname, '../../files/dados.xlsx');
  
  // Verificar se o arquivo existe
  if (fs.existsSync(excelFilePath)) {
    console.log(`Arquivo Excel encontrado: ${excelFilePath}`);
    
    // Definir cabeçalhos para download
    res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
    res.setHeader('Content-Disposition', 'attachment; filename=dados.xlsx');
    
    // Enviar o arquivo
    res.sendFile(excelFilePath);
  } else {
    console.error(`Arquivo Excel não encontrado: ${excelFilePath}`);
    res.status(404).json({ error: 'Arquivo não encontrado' });
  }
});

// Rota alternativa para servir o arquivo Excel (para compatibilidade)
router.get('/dados/dados.xlsx', (req, res) => {
  console.log('Requisição alternativa para o arquivo Excel recebida');
  
  // Redirecionar para a rota principal
  res.redirect('/api/dados.xlsx');
});

export default router;
