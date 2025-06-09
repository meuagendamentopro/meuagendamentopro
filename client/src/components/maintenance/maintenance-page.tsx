import { Button } from "@/components/ui/button";
import { AlertCircle, Clock, Home, RefreshCw } from "lucide-react";
import { useLocation } from "wouter";
import { useEffect, useState } from "react";
import { useMaintenance } from "@/contexts/maintenance-context";
import { format, parseISO } from "date-fns";
import { ptBR } from "date-fns/locale";
import { useQuery } from "@tanstack/react-query";
import { Skeleton } from "@/components/ui/skeleton";
import { useAuth } from "@/hooks/use-auth";

export function MaintenancePage() {
  const [, setLocation] = useLocation();
  const [timeElapsed, setTimeElapsed] = useState(0);
  const [lastUpdate, setLastUpdate] = useState(new Date());
  const { 
    isMaintenance, 
    message, 
    estimatedReturn, 
    isLoading: isMaintenanceLoading,
    error,
    refetch: refetchMaintenanceStatus 
  } = useMaintenance();
  const { user } = useAuth();
  const [isChecking, setIsChecking] = useState(false);
  
  // Redireciona para a página de autenticação se não estiver em manutenção
  useEffect(() => {
    if (!isMaintenanceLoading && !isMaintenance) {
      // Se não estiver em manutenção, redireciona para a página de autenticação
      // ou para a página inicial, dependendo se o usuário está autenticado
      if (user) {
        setLocation('/dashboard');
      } else {
        setLocation('/auth');
      }
    }
  }, [isMaintenance, isMaintenanceLoading, user, setLocation]);
  
  // Se ainda estiver carregando, mostra um loader
  if (isMaintenanceLoading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="animate-spin rounded-full h-12 w-12 border-t-2 border-b-2 border-primary"></div>
      </div>
    );
  }
  
  // Busca as configurações do sistema para obter o logo
  const { data: systemSettings, isLoading: isLoadingSettings } = useQuery({
    queryKey: ['systemSettings'],
    queryFn: async () => {
      const response = await fetch('/api/system-settings');
      if (!response.ok) throw new Error('Erro ao carregar configurações do sistema');
      return response.json();
    },
    staleTime: 5 * 60 * 1000, // 5 minutos
    enabled: isMaintenance // Só faz a requisição se estiver em manutenção
  });

  // Inicia o contador de tempo decorrido
  useEffect(() => {
    const timer = setInterval(() => {
      setTimeElapsed(prev => prev + 1);
    }, 60000); // Atualiza a cada minuto

    return () => clearInterval(timer);
  }, []);

  const formatTimeElapsed = (minutes: number) => {
    if (minutes < 60) {
      return `${minutes} minuto${minutes !== 1 ? 's' : ''}`;
    }
    const hours = Math.floor(minutes / 60);
    const remainingMinutes = minutes % 60;
    return `${hours}h${remainingMinutes > 0 ? ` e ${remainingMinutes} minuto${remainingMinutes !== 1 ? 's' : ''}` : ''}`;
  };

  const handleRetry = async () => {
    try {
      setIsChecking(true);
      const { data } = await refetchMaintenanceStatus();
      
      if (!data?.maintenance) {
        // Se a manutenção terminou, recarrega a página
        window.location.reload();
      } else {
        // Atualiza a hora da última verificação
        setLastUpdate(new Date());
        throw new Error('A manutenção ainda está em andamento');
      }
    } catch (error) {
      console.error('Erro ao verificar status de manutenção:', error);
      // Mesmo em caso de erro, atualiza a hora da última verificação
      setLastUpdate(new Date());
    } finally {
      setIsChecking(false);
    }
  };

  const handleGoHome = () => {
    window.location.href = '/';
  };

  return (
    <div className="flex min-h-screen flex-col items-center justify-center bg-gradient-to-b from-amber-50 to-white px-4 py-12 sm:px-6 lg:px-8">
      <div className="w-full max-w-2xl space-y-6 rounded-2xl bg-white p-8 shadow-xl">
        <div className="text-center">
          {isLoadingSettings ? (
            <Skeleton className="mx-auto h-20 w-48 rounded-md" />
          ) : systemSettings?.logoUrl ? (
            <div className="flex justify-center mb-4">
              <img 
                src={`${systemSettings.logoUrl}?t=${Date.now()}`} 
                alt="Logo Meu Agendamento PRO" 
                className="h-16 object-contain"
                onError={(e) => {
                  console.error('Erro ao carregar o logo:', systemSettings.logoUrl);
                  const target = e.target as HTMLImageElement;
                  target.style.display = 'none';
                }}
              />
            </div>
          ) : (
            <div className="mx-auto flex h-20 w-20 items-center justify-center rounded-full bg-amber-100 shadow-inner">
              <AlertCircle className="h-12 w-12 text-amber-600" />
            </div>
          )}
          <h1 className="mt-6 text-3xl font-bold tracking-tight text-gray-900 sm:text-4xl">
            Estamos em Manutenção
          </h1>
          <p className="mt-3 text-lg text-gray-600">
            Melhorias estão sendo realizadas para oferecer uma experiência ainda melhor!
          </p>
        </div>

        <div className="space-y-6">
          {/* Status da Manutenção */}
          <div className="rounded-xl border border-amber-200 bg-amber-50 p-6">
            <div className="flex items-start">
              <div className="flex-shrink-0 pt-0.5">
                <Clock className="h-6 w-6 text-amber-600" />
              </div>
              <div className="ml-4">
                <h3 className="text-lg font-medium text-amber-900">Status da Manutenção</h3>
                <div className="mt-2 space-y-3 text-amber-800">
                  <div className="flex items-center">
                    <div className="h-2 w-2 rounded-full bg-amber-500 mr-2"></div>
                    <span>Manutenção em andamento</span>
                  </div>
                  <div className="text-sm">
                    <p className="font-medium">Tempo decorrido:</p>
                    <p>{formatTimeElapsed(timeElapsed)}</p>
                  </div>
                  {estimatedReturn && (
                    <div className="text-sm">
                      <p className="font-medium">Previsão de retorno:</p>
                      <p>{format(parseISO(estimatedReturn), "dd 'de' MMMM 'às' HH:mm", { locale: ptBR })}</p>
                    </div>
                  )}
                </div>
              </div>
            </div>
          </div>

          {/* Informações Adicionais */}
          <div className="rounded-xl border border-blue-200 bg-blue-50 p-6">
            <div className="flex items-start">
              <div className="flex-shrink-0 pt-0.5">
                <AlertCircle className="h-6 w-6 text-blue-600" />
              </div>
              <div className="ml-4">
                <h3 className="text-lg font-medium text-blue-900">O que está acontecendo?</h3>
                <div className="mt-2 space-y-2 text-blue-800">
                  <p>{message || 'Nossa equipe está realizando atualizações importantes no sistema para melhorar o desempenho e a segurança da plataforma.'}</p>
                  <p>Durante este período, algumas funcionalidades podem estar temporariamente indisponíveis.</p>
                  <p className="mt-2 text-blue-700 font-medium">Agradecemos sua compreensão e paciência.</p>
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* Ações */}
        <div className="mt-8 space-y-4">
          <Button
            onClick={handleRetry}
            disabled={isChecking || isMaintenanceLoading}
            className="w-full"
          >
            {isChecking || isMaintenanceLoading ? (
              <>
                <RefreshCw className="mr-2 h-4 w-4 animate-spin" />
                Verificando...
              </>
            ) : (
              'Tentar novamente'
            )}
          </Button>
          
          <div className="relative my-4">
            <div className="absolute inset-0 flex items-center">
              <div className="w-full border-t border-gray-300"></div>
            </div>
            <div className="relative flex justify-center text-sm">
              <span className="bg-white px-2 text-gray-500">Acesso administrativo</span>
            </div>
          </div>
          
          <Button 
            variant="outline" 
            onClick={() => setLocation('/admin-login')}
            className="w-full bg-blue-50 hover:bg-blue-100 text-blue-700"
          >
            <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="mr-2">
              <path d="M19 21v-2a4 4 0 0 0-4-4H9a4 4 0 0 0-4 4v2"></path>
              <circle cx="12" cy="7" r="4"></circle>
            </svg>
            Acesso de Administrador
          </Button>
          
          <Button 
            variant="outline" 
            onClick={handleGoHome}
            className="w-full mt-2"
          >
            <Home className="mr-2 h-4 w-4" />
            Voltar para a página inicial
          </Button>
          
          <p className="mt-4 text-center text-sm text-gray-500">
            Última verificação: {lastUpdate.toLocaleTimeString('pt-BR')}
          </p>
        </div>

        {/* Rodapé */}
        <div className="mt-8 border-t border-gray-200 pt-6">
          <div className="text-center text-sm text-gray-500">
            <p>Precisa de ajuda? Entre em contato com nosso suporte:</p>
            <p className="mt-1 font-medium">suporte@meuagendamentopro.com.br</p>
            <p className="mt-4">© {new Date().getFullYear()} Meu Agendamento PRO. Todos os direitos reservados.</p>
          </div>
        </div>
      </div>
    </div>
  );
}
