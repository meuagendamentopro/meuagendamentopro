import { createContext, ReactNode, useContext } from "react";
import {
  useQuery,
  useMutation,
  UseMutationResult,
} from "@tanstack/react-query";
import { queryClient, getQueryFn, apiRequest } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";

interface User {
  id: number;
  name: string;
  username: string;
  email: string;
  role: string;
  avatarUrl: string | null;
  isActive: boolean;
  subscriptionExpiry?: string | null;
  neverExpires?: boolean;
  createdAt: string;
  updatedAt: string;
}

type AuthContextType = {
  user: User | null;
  isLoading: boolean;
  error: Error | null;
  loginMutation: UseMutationResult<User, Error, LoginData>;
  logoutMutation: UseMutationResult<void, Error, void>;
  registerMutation: UseMutationResult<User, Error, RegisterData>;
};

type LoginData = {
  username: string;
  password: string;
};

type RegisterData = {
  name: string;
  username: string;
  email: string;
  password: string;
  role?: string;
};

export const AuthContext = createContext<AuthContextType | null>(null);

export function AuthProvider({ children }: { children: ReactNode }) {
  const { toast } = useToast();
  
  const {
    data: user,
    error,
    isLoading,
  } = useQuery({
    queryKey: ["/api/user"],
    queryFn: async () => {
      try {
        const response = await fetch("/api/user");
        if (response.status === 401) return null;
        if (!response.ok) throw new Error("Erro ao buscar usuário");
        return await response.json() as User;
      } catch (error) {
        throw error;
      }
    },
  });

  const loginMutation = useMutation({
    mutationFn: async (credentials: LoginData) => {
      const res = await apiRequest("POST", "/api/login", credentials);
      if (!res.ok) {
        const errorData = await res.json();
        throw new Error(errorData.error || "Falha no login");
      }
      return await res.json();
    },
    onSuccess: (user: User) => {
      queryClient.setQueryData(["/api/user"], user);
      toast({
        title: "Login bem-sucedido",
        description: `Bem-vindo(a), ${user.name}!`,
      });
    },
    onError: (error: Error) => {
      toast({
        title: "Falha no login",
        description: error.message,
        variant: "destructive",
      });
    },
  });

  const registerMutation = useMutation({
    mutationFn: async (userData: RegisterData) => {
      const res = await apiRequest("POST", "/api/register", userData);
      if (!res.ok) {
        const errorData = await res.json();
        throw new Error(errorData.error || "Falha no registro");
      }
      return await res.json();
    },
    onSuccess: async (user: User) => {
      queryClient.setQueryData(["/api/user"], user);

      // Verificar se existe um perfil de prestador para este usuário
      try {
        const providerRes = await fetch("/api/my-provider");
        if (providerRes.status === 404) {
          // Não tem provider, vamos criar um
          console.log("Criando perfil de prestador para novo usuário");
          const createProviderRes = await apiRequest("POST", "/api/providers", {
            name: user.name,
            email: user.email,
            phone: "",
            workingHoursStart: 8,  // Horário padrão de início
            workingHoursEnd: 18,   // Horário padrão de término
            bookingLink: user.username.toLowerCase().replace(/[^a-z0-9]/g, "-")
          });
          
          if (createProviderRes.ok) {
            console.log("Perfil de prestador criado com sucesso");
          } else {
            console.error("Erro ao criar perfil de prestador:", await createProviderRes.text());
          }
        } else {
          console.log("Usuário já possui perfil de prestador");
        }
      } catch (error) {
        console.error("Erro ao verificar/criar perfil de prestador:", error);
        // Não interrompe o fluxo se falhar
      }

      toast({
        title: "Registro bem-sucedido",
        description: `Bem-vindo(a), ${user.name}!`,
      });
    },
    onError: (error: Error) => {
      toast({
        title: "Falha no registro",
        description: error.message,
        variant: "destructive",
      });
    },
  });

  const logoutMutation = useMutation({
    mutationFn: async () => {
      const res = await apiRequest("POST", "/api/logout");
      if (!res.ok) {
        const errorData = await res.json();
        throw new Error(errorData.error || "Falha ao sair");
      }
    },
    onSuccess: () => {
      queryClient.setQueryData(["/api/user"], null);
      toast({
        title: "Logout bem-sucedido",
        description: "Você saiu da sua conta.",
      });
      // Redireciona para a página de login após logout
      window.location.href = "/auth";
    },
    onError: (error: Error) => {
      toast({
        title: "Falha ao sair",
        description: error.message,
        variant: "destructive",
      });
    },
  });

  return (
    <AuthContext.Provider
      value={{
        user: user || null,
        isLoading,
        error,
        loginMutation,
        logoutMutation,
        registerMutation,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error("useAuth deve ser usado dentro de um AuthProvider");
  }
  return context;
}