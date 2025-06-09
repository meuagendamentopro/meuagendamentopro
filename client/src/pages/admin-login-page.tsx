import { useState } from 'react';
import { useLocation } from 'wouter';
import { useAuth } from '@/hooks/use-auth';
import { useToast } from '@/hooks/use-toast';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from '@/components/ui/card';
import { useMaintenance } from '@/contexts/maintenance-context';

export default function AdminLoginPage() {
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const { loginMutation } = useAuth();
  const [, setLocation] = useLocation();
  const { toast } = useToast();
  const { disableMaintenance } = useMaintenance();

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsLoading(true);
    
    try {
      // Tenta fazer login
      const result = await loginMutation.mutateAsync({ username, password });
      
      // Verifica se o usuário é administrador
      if ((result as any).role !== 'admin') {
        throw new Error('Apenas administradores podem acessar durante a manutenção');
      }
      
      // Se chegou até aqui, é um admin válido
      // Desativa o modo de manutenção
      await disableMaintenance();
      
      // Redireciona para o painel de administração
      setLocation('/admin');
      
      toast({
        title: 'Modo de manutenção desativado',
        description: 'O sistema está disponível para todos os usuários.',
      });
    } catch (error) {
      console.error('Erro ao fazer login:', error);
      toast({
        title: 'Erro',
        description: error instanceof Error ? error.message : 'Falha ao fazer login',
        variant: 'destructive',
      });
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-gray-100 p-4">
      <Card className="w-full max-w-md">
        <CardHeader>
          <CardTitle>Acesso de Administrador</CardTitle>
          <CardDescription>
            O sistema está em manutenção. Faça login para desativar o modo de manutenção.
          </CardDescription>
        </CardHeader>
        <form onSubmit={handleSubmit}>
          <CardContent className="space-y-4">
            <div className="space-y-2">
              <label htmlFor="username" className="text-sm font-medium">
                Nome de usuário
              </label>
              <Input
                id="username"
                type="text"
                value={username}
                onChange={(e) => setUsername(e.target.value)}
                required
                placeholder="Digite seu nome de usuário"
              />
            </div>
            <div className="space-y-2">
              <label htmlFor="password" className="text-sm font-medium">
                Senha
              </label>
              <Input
                id="password"
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                required
                placeholder="Digite sua senha"
              />
            </div>
          </CardContent>
          <CardFooter className="flex justify-between">
            <Button
              type="button"
              variant="outline"
              onClick={() => window.location.href = '/'}
              disabled={isLoading}
            >
              Voltar
            </Button>
            <Button type="submit" disabled={isLoading}>
              {isLoading ? 'Entrando...' : 'Entrar'}
            </Button>
          </CardFooter>
        </form>
      </Card>
    </div>
  );
}
