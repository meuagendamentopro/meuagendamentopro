import { Router, Request, Response } from 'express';

interface MaintenanceStatus {
  isMaintenance: boolean;
  message: string;
  estimatedReturn: string | null;
}

// Estado global de manutenção (em produção, use um banco de dados)
let maintenanceStatus: MaintenanceStatus = {
  isMaintenance: false,
  message: 'Sistema em manutenção',
  estimatedReturn: null
};

const router = Router();

// Rota para obter o status de manutenção
router.get('/status', (req: Request, res: Response) => {
  res.json({
    maintenance: maintenanceStatus.isMaintenance,
    message: maintenanceStatus.message,
    estimatedReturn: maintenanceStatus.estimatedReturn
  });
});

// Rota para atualizar o status de manutenção (protegida por autenticação)
router.post('/status', (req: Request, res: Response) => {
  // Verifica se o usuário é admin
  if (!req.user || (req.user as any).role !== 'admin') {
    return res.status(403).json({ error: 'Acesso negado' });
  }

  const { isMaintenance, message, estimatedReturn } = req.body as {
    isMaintenance: boolean;
    message?: string;
    estimatedReturn?: string;
  };
  
  maintenanceStatus = {
    isMaintenance: Boolean(isMaintenance),
    message: message || 'Sistema em manutenção',
    estimatedReturn: estimatedReturn || null
  };

  res.json({
    success: true,
    maintenance: maintenanceStatus.isMaintenance,
    message: 'Status de manutenção atualizado com sucesso'
  });
});

export default router;
