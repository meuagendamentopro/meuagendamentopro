import React, { useEffect, useRef } from 'react';
import { useToast } from '@/hooks/use-toast';
import { useQueryClient } from '@tanstack/react-query';
import { useLocation } from 'wouter';

interface SessionCheckProviderProps {
  children: React.ReactNode;
  isLoggedIn: boolean;
  checkIntervalMs?: number;
}

/**
 * Componente que verifica periodicamente se a sessão do usuário ainda é válida.
 * Se a sessão for invalidada (por exemplo, devido a login em outro dispositivo),
 * o usuário será deslogado automaticamente.
 */
export function SessionCheckProvider({ 
  children, 
  isLoggedIn, 
  checkIntervalMs = 30000 
}: SessionCheckProviderProps) {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [, navigate] = useLocation();
  const intervalRef = useRef<NodeJS.Timeout | null>(null);

  // Função para verificar se a sessão ainda é válida
  const checkSessionValidity = async () => {
    if (!isLoggedIn) return;

    try {
      const response = await fetch('/api/session/check');
      
      if (response.status === 401) {
        // Sessão inválida, deslogar o usuário IMEDIATAMENTE
        console.log('Sessão inválida detectada, redirecionando IMEDIATAMENTE...');
        
        // Parar a verificação periódica imediatamente
        if (intervalRef.current) {
          clearInterval(intervalRef.current);
          intervalRef.current = null;
        }
        
        // Limpar dados do usuário imediatamente
        queryClient.setQueryData(['/api/user'], null);
        
        // Redirecionar PRIMEIRO (prioridade máxima)
        navigate('/auth');
        
        // Mostrar notificação após o redirecionamento
        toast({
          title: 'Sessão encerrada',
          description: 'Sua sessão foi encerrada.',
          variant: 'destructive',
          duration: 2000,
        });
      }
    } catch (error) {
      console.error('Erro ao verificar validade da sessão:', error);
    }
  };
  
  // Iniciar verificação periódica quando o usuário estiver logado
  useEffect(() => {
    // Limpar qualquer intervalo existente
    if (intervalRef.current) {
      clearInterval(intervalRef.current);
      intervalRef.current = null;
    }
    
    if (isLoggedIn) {
      // Verificar imediatamente ao carregar a página
      checkSessionValidity();
      
      // Configurar verificação periódica
      intervalRef.current = setInterval(checkSessionValidity, checkIntervalMs);
      
      // Limpar intervalo ao desmontar o componente
      return () => {
        if (intervalRef.current) {
          clearInterval(intervalRef.current);
          intervalRef.current = null;
        }
      };
    }
  }, [isLoggedIn, checkIntervalMs]);
  
  return <>{children}</>;
}
