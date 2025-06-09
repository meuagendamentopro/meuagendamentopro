import { useEffect, useRef } from 'react';
import { useToast } from './use-toast';
import { useQueryClient } from '@tanstack/react-query';
import { useLocation } from 'wouter';

/**
 * Hook para verificar periodicamente se a sessão do usuário ainda é válida.
 * Se a sessão for invalidada (por exemplo, devido a login em outro dispositivo),
 * o usuário será deslogado automaticamente.
 * 
 * @param isLoggedIn Booleano que indica se o usuário está logado
 * @param checkIntervalMs Intervalo em milissegundos entre as verificações (padrão: 30 segundos)
 */
export function useSessionCheck(isLoggedIn: boolean, checkIntervalMs = 30000) {
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
        // Sessão inválida, deslogar o usuário
        console.log('Sessão inválida detectada, deslogando...');
        
        // Mostrar notificação ao usuário
        toast({
          title: 'Sessão encerrada',
          description: 'Sua sessão foi encerrada porque você fez login em outro dispositivo.',
          variant: 'destructive',
        });
        
        // Limpar dados do usuário
        queryClient.setQueryData(['/api/user'], null);
        
        // Parar a verificação periódica
        if (intervalRef.current) {
          clearInterval(intervalRef.current);
          intervalRef.current = null;
        }
        
        // Redirecionar para a página de login
        navigate('/auth');
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
}
