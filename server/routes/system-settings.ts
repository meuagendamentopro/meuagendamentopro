import express from "express";
import { db } from "../db";
import { systemSettings } from "../../shared/schema";
import { eq } from "drizzle-orm";
import multer from "multer";
import path from "path";
import fs from "fs";
import { v4 as uuidv4 } from "uuid";
import { fileURLToPath } from "url";
import { dirname } from "path";

// Middleware para verificar se o usuário está autenticado
const checkAuth = (req: any, res: any, next: any) => {
  if (req.isAuthenticated()) {
    return next();
  }
  return res.status(401).json({ error: 'Não autenticado' });
};

// Middleware para verificar se o usuário é administrador
const checkAdmin = (req: any, res: any, next: any) => {
  if (req.user && req.user.role === 'admin') {
    return next();
  }
  return res.status(403).json({ error: 'Acesso negado. Apenas administradores podem acessar este recurso.' });
};

// Obter o diretório atual (substitui __dirname que não está disponível em ESM)
const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

const router = express.Router();

// Configuração do multer para upload de arquivos
const storage = multer.diskStorage({
  destination: function (req, file, cb) {
    // Usar path.resolve para garantir um caminho absoluto correto
    const rootDir = path.resolve(__dirname, '../..');
    const uploadDir = path.join(rootDir, 'public', 'uploads', 'logos');
    
    console.log('Diretório de upload:', uploadDir);
    
    // Criar diretório se não existir
    if (!fs.existsSync(uploadDir)) {
      console.log('Criando diretório de upload...');
      fs.mkdirSync(uploadDir, { recursive: true });
    }
    
    cb(null, uploadDir);
  },
  filename: function (req, file, cb) {
    const uniqueFilename = `${uuidv4()}${path.extname(file.originalname)}`;
    cb(null, uniqueFilename);
  }
});

const upload = multer({
  storage: storage,
  limits: {
    fileSize: 5 * 1024 * 1024, // 5MB
  },
  fileFilter: function (req, file, cb) {
    const allowedTypes = [
      'image/jpeg',
      'image/png',
      'image/gif',
      'image/svg+xml',
      'image/webp'
    ];
    
    if (allowedTypes.includes(file.mimetype)) {
      cb(null, true);
    } else {
      cb(new Error('Formato de arquivo não suportado. Use JPEG, PNG, GIF, SVG ou WebP.'));
    }
  }
});

// Obter configurações do sistema
router.get('/', async (req, res) => {
  try {
    const settings = await db.select().from(systemSettings).limit(1);
    
    if (settings.length === 0) {
      // Criar configurações padrão se não existirem
      const defaultSettings = await db.insert(systemSettings).values({
        siteName: "Meu Agendamento PRO",
        logoUrl: null,
        faviconUrl: null,
        primaryColor: "#0891b2",
        trialPeriodDays: 3,
        createdAt: new Date(),
        updatedAt: new Date()
      }).returning();
      
      return res.json(defaultSettings[0]);
    }
    
    res.json(settings[0]);
  } catch (error) {
    console.error('Erro ao buscar configurações:', error);
    res.status(500).json({ error: 'Erro ao buscar configurações do sistema' });
  }
});

// Atualizar configurações do sistema (requer autenticação de administrador)
router.put('/', checkAuth, checkAdmin, async (req, res) => {
  try {
    const { siteName, logoUrl, faviconUrl, primaryColor, trialPeriodDays } = req.body;
    
    const settings = await db.select().from(systemSettings).limit(1);
    
    if (settings.length === 0) {
      // Criar configurações se não existirem
      const newSettings = await db.insert(systemSettings).values({
        siteName: siteName || "Meu Agendamento PRO",
        logoUrl: logoUrl || null,
        faviconUrl: faviconUrl || null,
        primaryColor: primaryColor || "#0891b2",
        trialPeriodDays: trialPeriodDays || 3,
        createdAt: new Date(),
        updatedAt: new Date()
      }).returning();
      
      return res.json(newSettings[0]);
    }
    
    // Atualizar configurações existentes
    const settingsId = settings[0].id;
    const updatedSettings = await db.update(systemSettings)
      .set({
        siteName: siteName !== undefined ? siteName : settings[0].siteName,
        logoUrl: logoUrl !== undefined ? logoUrl : settings[0].logoUrl,
        faviconUrl: faviconUrl !== undefined ? faviconUrl : settings[0].faviconUrl,
        primaryColor: primaryColor !== undefined ? primaryColor : settings[0].primaryColor,
        trialPeriodDays: trialPeriodDays !== undefined ? trialPeriodDays : settings[0].trialPeriodDays,
        updatedAt: new Date()
      })
      .where(eq(systemSettings.id, settingsId))
      .returning();
    
    res.json(updatedSettings[0]);
  } catch (error) {
    console.error('Erro ao atualizar configurações:', error);
    res.status(500).json({ error: 'Erro ao atualizar configurações do sistema' });
  }
});

// Atualização parcial das configurações do sistema (PATCH)
router.patch('/', checkAuth, checkAdmin, async (req, res) => {
  try {
    console.log('Recebido PATCH para configurações do sistema:', req.body);
    const updateData = {...req.body};
    
    // Validar o período de teste se for fornecido
    if (updateData.trialPeriodDays !== undefined) {
      const trialDays = Number(updateData.trialPeriodDays);
      console.log('Validando período de teste:', trialDays);
      
      if (isNaN(trialDays)) {
        console.error('Período de teste inválido: não é um número');
        return res.status(400).json({ 
          error: 'Período de teste inválido. Deve ser um número.'
        });
      }
      
      if (trialDays < 1 || trialDays > 90) {
        console.error(`Período de teste inválido: ${trialDays} está fora do intervalo permitido (1-90)`);
        return res.status(400).json({ 
          error: 'Período de teste inválido. Deve ser um número entre 1 e 90 dias.'
        });
      }
      
      updateData.trialPeriodDays = trialDays;
      console.log('Período de teste validado:', trialDays);
    }
    
    const settings = await db.select().from(systemSettings).limit(1);
    console.log('Configurações atuais:', settings.length ? settings[0] : 'nenhuma');
    
    if (settings.length === 0) {
      // Criar configurações padrão se não existirem
      console.log('Criando configurações padrão com os dados fornecidos');
      const defaultValues = {
        siteName: "Meu Agendamento PRO",
        logoUrl: null,
        faviconUrl: null,
        primaryColor: "#0891b2",
        trialPeriodDays: 3,
        ...updateData,
        createdAt: new Date(),
        updatedAt: new Date()
      };
      
      try {
        const newSettings = await db.insert(systemSettings).values(defaultValues).returning();
        console.log('Novas configurações criadas:', newSettings[0]);
        return res.json(newSettings[0]);
      } catch (insertError) {
        console.error('Erro ao criar configurações:', insertError);
        return res.status(500).json({ error: 'Erro ao criar configurações do sistema' });
      }
    }
    
    // Atualizar apenas os campos fornecidos
    const settingsId = settings[0].id;
    console.log(`Atualizando configurações ID ${settingsId} com:`, updateData);
    
    try {
      const updatedSettings = await db.update(systemSettings)
        .set({
          ...updateData,
          updatedAt: new Date()
        })
        .where(eq(systemSettings.id, settingsId))
        .returning();
      
      console.log('Configurações atualizadas:', updatedSettings[0]);
      return res.json(updatedSettings[0]);
    } catch (updateError) {
      console.error('Erro ao atualizar configurações:', updateError);
      return res.status(500).json({ error: 'Erro ao atualizar configurações do sistema' });
    }
  } catch (error) {
    console.error('Erro ao atualizar configurações:', error);
    res.status(500).json({ error: 'Erro ao atualizar configurações do sistema' });
  }
});

// Upload de logo (requer autenticação de administrador)
router.post('/upload-logo', checkAuth, checkAdmin, upload.single('logo'), async (req, res) => {
  try {
    if (!req.file) {
      return res.status(400).json({ error: 'Nenhum arquivo enviado' });
    }
    
    // Caminho relativo para o arquivo
    const relativePath = `/uploads/logos/${req.file.filename}`;
    console.log('URL do logo salva no banco:', relativePath);
    
    // Atualizar URL do logo nas configurações
    const settings = await db.select().from(systemSettings).limit(1);
    
    if (settings.length === 0) {
      // Criar configurações se não existirem
      await db.insert(systemSettings).values({
        siteName: "Meu Agendamento PRO",
        logoUrl: relativePath,
        faviconUrl: null,
        primaryColor: "#0891b2",
        createdAt: new Date(),
        updatedAt: new Date()
      });
    } else {
      // Atualizar configurações existentes
      const settingsId = settings[0].id;
      
      // Se já existia um logo, excluir o arquivo antigo
      if (settings[0].logoUrl) {
        const oldLogoPath = path.join(__dirname, "../..", "public", settings[0].logoUrl);
        if (fs.existsSync(oldLogoPath)) {
          fs.unlinkSync(oldLogoPath);
        }
      }
      
      await db.update(systemSettings)
        .set({
          logoUrl: relativePath,
          updatedAt: new Date()
        })
        .where(eq(systemSettings.id, settingsId));
    }
    
    res.json({ 
      success: true, 
      logoUrl: relativePath 
    });
  } catch (error) {
    console.error('Erro ao fazer upload do logo:', error);
    res.status(500).json({ error: 'Erro ao fazer upload do logo' });
  }
});

export default router;
