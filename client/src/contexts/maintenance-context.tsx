import React, { createContext, useContext, useState, ReactNode, useCallback } from 'react';
import { useQuery, useMutation, useQueryClient, UseQueryResult } from '@tanstack/react-query';

type MaintenanceStatus = {
  maintenance: boolean;
  message?: string;
  estimatedReturn?: string | null;
};

type MaintenanceContextType = {
  isMaintenance: boolean;
  message?: string;
  estimatedReturn?: string | null;
  enableMaintenance: (message?: string, estimatedReturn?: string) => Promise<void>;
  disableMaintenance: () => Promise<void>;
  isLoading: boolean;
  error: Error | null;
  refetch: () => Promise<{ data?: MaintenanceStatus }>;
};

const MaintenanceContext = createContext<MaintenanceContextType | undefined>(undefined);

export function MaintenanceProvider({ children }: { children: ReactNode }) {
  const queryClient = useQueryClient();
  const [error, setError] = useState<Error | null>(null);

  // Busca o status de manutenção do servidor
  const { 
    data: maintenanceStatus, 
    isLoading, 
    refetch: refetchStatus 
  }: UseQueryResult<MaintenanceStatus, Error> = useQuery<MaintenanceStatus>({
    queryKey: ['maintenanceStatus'],
    queryFn: async () => {
      try {
        const response = await fetch('/api/maintenance/status');
        if (!response.ok) throw new Error('Erro ao verificar status de manutenção');
        return await response.json();
      } catch (err) {
        console.error('Erro ao verificar manutenção:', err);
        setError(err as Error);
        return { maintenance: false };
      }
    },
    refetchInterval: 30000, // Atualiza a cada 30 segundos
    refetchOnWindowFocus: true,
  });

  const isMaintenance = maintenanceStatus?.maintenance || false;

  // Mutação para ativar manutenção
  const enableMaintenanceMutation = useMutation<MaintenanceStatus, Error, { message?: string; estimatedReturn?: string }>({
    mutationFn: async ({ message, estimatedReturn }) => {
      const response = await fetch('/api/maintenance/status', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          isMaintenance: true,
          message,
          estimatedReturn,
        }),
        credentials: 'include',
      });
      
      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.message || 'Falha ao ativar modo de manutenção');
      }
      
      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['maintenanceStatus'] });
    },
    onError: (err: Error) => {
      console.error('Erro ao ativar manutenção:', err);
      setError(err);
    },
  });

  // Mutação para desativar manutenção
  const disableMaintenanceMutation = useMutation<MaintenanceStatus, Error>({
    mutationFn: async () => {
      const response = await fetch('/api/maintenance/status', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ isMaintenance: false }),
        credentials: 'include',
      });
      
      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.message || 'Falha ao desativar modo de manutenção');
      }
      
      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['maintenanceStatus'] });
    },
    onError: (err: Error) => {
      console.error('Erro ao desativar manutenção:', err);
      setError(err);
    },
  });

  const enableMaintenance = useCallback(async (message?: string, estimatedReturn?: string) => {
    await enableMaintenanceMutation.mutateAsync({ message, estimatedReturn });
  }, [enableMaintenanceMutation]);

  const disableMaintenance = useCallback(async () => {
    await disableMaintenanceMutation.mutateAsync();
  }, [disableMaintenanceMutation]);

  const refetch = useCallback(async () => {
    const result = await refetchStatus();
    return { data: result.data };
  }, [refetchStatus]);

  const contextValue: MaintenanceContextType = {
    isMaintenance,
    message: maintenanceStatus?.message,
    estimatedReturn: maintenanceStatus?.estimatedReturn,
    enableMaintenance,
    disableMaintenance,
    isLoading: isLoading || enableMaintenanceMutation.isPending || disableMaintenanceMutation.isPending,
    error,
    refetch,
  };

  return (
    <MaintenanceContext.Provider value={contextValue}>
      {children}
    </MaintenanceContext.Provider>
  );
}

export function useMaintenance(): MaintenanceContextType {
  const context = useContext(MaintenanceContext);
  if (context === undefined) {
    throw new Error('useMaintenance must be used within a MaintenanceProvider');
  }
  return context;
}
