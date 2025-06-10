import { createContext, ReactNode, useContext, useState, useEffect } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { apiRequest } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";

interface ImpersonationUser {
  id: number;
  name: string;
  username: string;
  role: string;
}

interface ImpersonationStatus {
  isImpersonating: boolean;
  impersonatedUser?: ImpersonationUser | null;
  originalAdmin?: ImpersonationUser | null;
}

type ImpersonationContextType = {
  impersonationStatus: ImpersonationStatus | null;
  isLoading: boolean;
  startImpersonation: (userId: number) => Promise<void>;
  stopImpersonation: () => Promise<void>;
  refetchStatus: () => void;
};

export const ImpersonationContext = createContext<ImpersonationContextType | null>(null);

export function ImpersonationProvider({ children }: { children: ReactNode }) {
  const { toast } = useToast();
  const queryClient = useQueryClient();

  // Query para verificar status de simulação
  const { 
    data: impersonationStatus, 
    isLoading, 
    refetch: refetchStatus 
  } = useQuery<ImpersonationStatus>({
    queryKey: ["/api/admin/impersonation-status"],
    queryFn: async () => {
      const res = await apiRequest("GET", "/api/admin/impersonation-status");
      if (!res.ok) {
        if (res.status === 401 || res.status === 403) {
          // Usuário não autenticado ou não é admin, retornar status padrão
          return { isImpersonating: false };
        }
        throw new Error("Erro ao verificar status de simulação");
      }
      return res.json();
    },
    refetchInterval: 5000, // Verificar a cada 5 segundos
    retry: false
  });

  // Mutation para iniciar simulação
  const startImpersonationMutation = useMutation({
    mutationFn: async (userId: number) => {
      const res = await apiRequest("POST", `/api/admin/impersonate/${userId}`);
      if (!res.ok) {
        // Verificar se a resposta é HTML (erro 404/500)
        const contentType = res.headers.get("content-type");
        if (contentType && contentType.includes("text/html")) {
          const htmlText = await res.text();
          console.error("Resposta HTML recebida:", htmlText);
          throw new Error(`Erro do servidor (${res.status}): Rota não encontrada ou erro interno`);
        }
        
        const errorData = await res.json();
        throw new Error(errorData.error || "Erro ao iniciar simulação");
      }
      return res.json();
    },
    onSuccess: (data) => {
      toast({
        title: "Simulação iniciada",
        description: data.message,
        variant: "default",
      });
      
      // Invalidar queries para atualizar dados
      queryClient.invalidateQueries({ queryKey: ["/api/user"] });
      queryClient.invalidateQueries({ queryKey: ["/api/admin/impersonation-status"] });
      
      // Recarregar a página para aplicar mudanças
      window.location.reload();
    },
    onError: (error: Error) => {
      toast({
        title: "Erro ao iniciar simulação",
        description: error.message,
        variant: "destructive",
      });
    },
  });

  // Mutation para parar simulação
  const stopImpersonationMutation = useMutation({
    mutationFn: async () => {
      const res = await apiRequest("POST", "/api/admin/stop-impersonation");
      if (!res.ok) {
        const errorData = await res.json();
        throw new Error(errorData.error || "Erro ao parar simulação");
      }
      return res.json();
    },
    onSuccess: (data) => {
      toast({
        title: "Simulação encerrada",
        description: data.message,
        variant: "default",
      });
      
      // Invalidar queries para atualizar dados
      queryClient.invalidateQueries({ queryKey: ["/api/user"] });
      queryClient.invalidateQueries({ queryKey: ["/api/admin/impersonation-status"] });
      
      // Recarregar a página para aplicar mudanças
      window.location.reload();
    },
    onError: (error: Error) => {
      toast({
        title: "Erro ao encerrar simulação",
        description: error.message,
        variant: "destructive",
      });
    },
  });

  const startImpersonation = async (userId: number) => {
    await startImpersonationMutation.mutateAsync(userId);
  };

  const stopImpersonation = async () => {
    await stopImpersonationMutation.mutateAsync();
  };

  return (
    <ImpersonationContext.Provider
      value={{
        impersonationStatus: impersonationStatus || { isImpersonating: false },
        isLoading,
        startImpersonation,
        stopImpersonation,
        refetchStatus,
      }}
    >
      {children}
    </ImpersonationContext.Provider>
  );
}

export function useImpersonation() {
  const context = useContext(ImpersonationContext);
  if (!context) {
    throw new Error("useImpersonation deve ser usado dentro de ImpersonationProvider");
  }
  return context;
} 