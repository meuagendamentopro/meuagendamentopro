import { useAuth } from "@/hooks/use-auth";
import { Loader2 } from "lucide-react";
import { Redirect, Route } from "wouter";
import { useToast } from "@/hooks/use-toast";
import { useEffect, useState } from "react";

// Rota protegida que verifica apenas autenticação
export function ProtectedRoute({
  path,
  element,
}: {
  path: string;
  element: React.ReactNode;
}) {
  const { user, isLoading } = useAuth();

  if (isLoading) {
    return (
      <Route path={path}>
        <div className="flex items-center justify-center min-h-screen">
          <Loader2 className="h-8 w-8 animate-spin text-primary" />
        </div>
      </Route>
    );
  }

  if (!user) {
    return (
      <Route path={path}>
        <Redirect to="/auth" />
      </Route>
    );
  }

  return <Route path={path}>{element}</Route>;
}

// Rota protegida que verifica se o usuário é administrador
export function AdminRoute({
  path,
  element,
}: {
  path: string;
  element: React.ReactNode;
}) {
  const { user, isLoading } = useAuth();
  const { toast } = useToast();
  const [accessChecked, setAccessChecked] = useState(false);

  useEffect(() => {
    if (user && !isLoading && !accessChecked) {
      setAccessChecked(true);
      
      if (user.role !== 'admin') {
        toast({
          title: "Acesso Negado",
          description: "Você não tem permissão para acessar esta página",
          variant: "destructive"
        });
      }
    }
  }, [user, isLoading, accessChecked, toast]);

  if (isLoading) {
    return (
      <Route path={path}>
        <div className="flex items-center justify-center min-h-screen">
          <Loader2 className="h-8 w-8 animate-spin text-primary" />
        </div>
      </Route>
    );
  }

  if (!user) {
    return (
      <Route path={path}>
        <Redirect to="/auth" />
      </Route>
    );
  }

  // Verificar se o usuário é admin
  if (user.role !== 'admin') {
    return (
      <Route path={path}>
        <Redirect to="/" />
      </Route>
    );
  }

  return <Route path={path}>{element}</Route>;
}