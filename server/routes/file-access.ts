import express from 'express';
import path from 'path';
import fs from 'fs';
import { checkAuth } from '../middleware/auth';
import { fileURLToPath } from 'url';
import { dirname } from 'path';

// Obter o diretório atual (substitui __dirname que não está disponível em ESM)
const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

const router = express.Router();

// Rota para verificar se o arquivo existe
router.get('/check/:filename', checkAuth, (req, res) => {
  try {
    const filename = req.params.filename;
    const filePath = path.join(__dirname, '../../files', filename);
    
    if (fs.existsSync(filePath)) {
      return res.status(200).json({ exists: true, message: 'Arquivo encontrado' });
    } else {
      return res.status(404).json({ exists: false, message: 'Arquivo não encontrado' });
    }
  } catch (error) {
    console.error('Erro ao verificar arquivo:', error);
    return res.status(500).json({ error: 'Erro ao verificar arquivo' });
  }
});

// Rota para obter o conteúdo do arquivo XLSX como JSON
router.get('/data/:filename', checkAuth, (req, res) => {
  try {
    const filename = req.params.filename;
    const filePath = path.join(__dirname, '../../files', filename);
    
    if (!fs.existsSync(filePath)) {
      return res.status(404).json({ error: 'Arquivo não encontrado' });
    }
    
    // Enviar o arquivo para o cliente
    res.sendFile(filePath);
  } catch (error) {
    console.error('Erro ao acessar arquivo:', error);
    return res.status(500).json({ error: 'Erro ao acessar arquivo' });
  }
});

export default router;
