import React, { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useToast } from "@/hooks/use-toast";
import PageHeader from "@/components/layout/page-header";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Switch } from "@/components/ui/switch";
import { Badge } from "@/components/ui/badge";
import { UsersIcon, Calendar, CheckCircle, XCircle, AlertCircle } from "lucide-react";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Calendar as CalendarComponent } from "@/components/ui/calendar";
import { cn } from "@/lib/utils";
import { apiRequest } from "@/lib/queryClient";
import { format, addMonths, addYears } from "date-fns";
import { pt } from "date-fns/locale";

// Componente para mostrar a data de expiração da assinatura
const SubscriptionStatus = ({ user }: { user: any }) => {
  if (user.role === 'admin' || user.neverExpires) {
    return (
      <Badge variant="outline" className="bg-green-50 text-green-700 border-green-200">
        <CheckCircle className="h-3 w-3 mr-1" />
        Sem expiração
      </Badge>
    );
  }

  if (!user.subscriptionExpiry) {
    return (
      <Badge variant="outline" className="bg-gray-50 text-gray-700 border-gray-200">
        Não definida
      </Badge>
    );
  }

  const expiryDate = new Date(user.subscriptionExpiry);
  const now = new Date();
  
  // Verificar se expirou
  if (expiryDate < now) {
    return (
      <Badge variant="outline" className="bg-red-50 text-red-700 border-red-200">
        <XCircle className="h-3 w-3 mr-1" />
        Expirada em {format(expiryDate, "dd/MM/yyyy")}
      </Badge>
    );
  }
  
  // Verificar se expira em até 7 dias
  const sevenDaysFromNow = new Date();
  sevenDaysFromNow.setDate(now.getDate() + 7);
  
  if (expiryDate <= sevenDaysFromNow) {
    return (
      <Badge variant="outline" className="bg-amber-50 text-amber-700 border-amber-200">
        <AlertCircle className="h-3 w-3 mr-1" />
        Expira em {format(expiryDate, "dd/MM/yyyy")}
      </Badge>
    );
  }
  
  // Assinatura ativa e não expira em breve
  return (
    <Badge variant="outline" className="bg-blue-50 text-blue-700 border-blue-200">
      <Calendar className="h-3 w-3 mr-1" />
      Até {format(expiryDate, "dd/MM/yyyy")}
    </Badge>
  );
};

const UsersPage: React.FC = () => {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [showSubscriptionDialog, setShowSubscriptionDialog] = useState(false);
  const [selectedUser, setSelectedUser] = useState<any>(null);
  const [subscriptionType, setSubscriptionType] = useState<'date' | 'never'>('date');
  const [expiryDate, setExpiryDate] = useState<Date | undefined>(undefined);
  const [isCalendarOpen, setIsCalendarOpen] = useState(false);

  // Buscar todos os usuários
  const { data: users, isLoading } = useQuery({
    queryKey: ['/api/admin/users'],
    queryFn: async () => {
      const res = await fetch('/api/admin/users');
      if (!res.ok) throw new Error('Falha ao buscar usuários');
      return res.json();
    }
  });

  // Mutação para ativar/desativar usuário
  const toggleActiveMutation = useMutation({
    mutationFn: async ({ id, active }: { id: number, active: boolean }) => {
      const res = await apiRequest('PATCH', `/api/admin/users/${id}/toggle-active`, { active });
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/admin/users'] });
      toast({
        title: "Status atualizado",
        description: "O status do usuário foi atualizado com sucesso.",
      });
    },
    onError: (error: any) => {
      toast({
        title: "Erro",
        description: error.message || "Ocorreu um erro ao atualizar o status do usuário.",
        variant: "destructive",
      });
    }
  });

  // Mutação para atualizar assinatura
  const updateSubscriptionMutation = useMutation({
    mutationFn: async ({ id, data }: { id: number, data: any }) => {
      const res = await apiRequest('PATCH', `/api/admin/users/${id}/subscription`, data);
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/admin/users'] });
      setShowSubscriptionDialog(false);
      toast({
        title: "Assinatura atualizada",
        description: "A assinatura do usuário foi atualizada com sucesso.",
      });
    },
    onError: (error: any) => {
      toast({
        title: "Erro",
        description: error.message || "Ocorreu um erro ao atualizar a assinatura.",
        variant: "destructive",
      });
    }
  });

  const handleToggleActive = (user: any) => {
    toggleActiveMutation.mutate({ 
      id: user.id, 
      active: !user.isActive 
    });
  };

  const openSubscriptionDialog = (user: any) => {
    setSelectedUser(user);
    
    // Definir os valores iniciais
    if (user.neverExpires) {
      setSubscriptionType('never');
      setExpiryDate(undefined);
    } else {
      setSubscriptionType('date');
      setExpiryDate(user.subscriptionExpiry ? new Date(user.subscriptionExpiry) : new Date());
    }
    
    setShowSubscriptionDialog(true);
  };

  const handleSubscriptionUpdate = () => {
    if (!selectedUser) return;
    
    const data = subscriptionType === 'never'
      ? { neverExpires: true, subscriptionExpiry: null }
      : { neverExpires: false, subscriptionExpiry: expiryDate };
    
    updateSubscriptionMutation.mutate({
      id: selectedUser.id,
      data
    });
  };

  const extendSubscription = (months: number) => {
    if (!expiryDate) {
      const now = new Date();
      setExpiryDate(addMonths(now, months));
    } else {
      setExpiryDate(addMonths(expiryDate, months));
    }
  };

  return (
    <div className="container mx-auto py-6 space-y-6">
      <PageHeader 
        title="Administração de Usuários" 
        description="Gerencie usuários do sistema e suas assinaturas"
        icon={<UsersIcon className="h-6 w-6" />}
      />
      
      <Card>
        <CardHeader>
          <CardTitle>Usuários</CardTitle>
          <CardDescription>
            Lista de todos os usuários cadastrados no sistema. Gerencie status e assinaturas.
          </CardDescription>
        </CardHeader>
        <CardContent>
          {isLoading ? (
            <div className="text-center py-4">Carregando...</div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Nome</TableHead>
                  <TableHead>Usuário</TableHead>
                  <TableHead>Email</TableHead>
                  <TableHead>Função</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead>Assinatura</TableHead>
                  <TableHead>Ações</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {users && users.map((user: any) => (
                  <TableRow key={user.id} className={!user.isActive ? "opacity-60" : ""}>
                    <TableCell className="font-medium">{user.name}</TableCell>
                    <TableCell>{user.username}</TableCell>
                    <TableCell>{user.email}</TableCell>
                    <TableCell>
                      <Badge variant={user.role === 'admin' ? "default" : "secondary"}>
                        {user.role === 'admin' ? 'Administrador' : 'Provedor'}
                      </Badge>
                    </TableCell>
                    <TableCell>
                      <Badge variant={user.isActive ? "success" : "destructive"}>
                        {user.isActive ? 'Ativo' : 'Bloqueado'}
                      </Badge>
                    </TableCell>
                    <TableCell>
                      <SubscriptionStatus user={user} />
                    </TableCell>
                    <TableCell>
                      <div className="flex space-x-2">
                        <Button 
                          variant="outline" 
                          size="sm"
                          onClick={() => handleToggleActive(user)}
                          disabled={user.id === 1 || toggleActiveMutation.isPending}
                        >
                          {user.isActive ? 'Bloquear' : 'Ativar'}
                        </Button>
                        <Button 
                          variant="outline" 
                          size="sm"
                          onClick={() => openSubscriptionDialog(user)}
                          disabled={updateSubscriptionMutation.isPending}
                        >
                          Assinatura
                        </Button>
                      </div>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>

      {/* Dialog para gerenciar assinatura */}
      <Dialog open={showSubscriptionDialog} onOpenChange={setShowSubscriptionDialog}>
        <DialogContent className="sm:max-w-[425px]">
          <DialogHeader>
            <DialogTitle>Gerenciar Assinatura</DialogTitle>
            <DialogDescription>
              {selectedUser && `Atualize a assinatura de ${selectedUser.name}`}
            </DialogDescription>
          </DialogHeader>
          
          <div className="grid gap-4 py-4">
            <div className="flex items-center space-x-2">
              <Switch
                id="subscription-type"
                checked={subscriptionType === 'never'}
                onCheckedChange={(checked) => setSubscriptionType(checked ? 'never' : 'date')}
              />
              <Label htmlFor="subscription-type">Assinatura sem expiração</Label>
            </div>
            
            {subscriptionType === 'date' && (
              <>
                <div className="grid gap-2">
                  <Label htmlFor="expiry-date">Data de expiração</Label>
                  <div className="flex">
                    <Popover open={isCalendarOpen} onOpenChange={setIsCalendarOpen}>
                      <PopoverTrigger asChild>
                        <Button
                          variant="outline"
                          className={cn(
                            "w-full justify-start text-left font-normal",
                            !expiryDate && "text-muted-foreground"
                          )}
                        >
                          <Calendar className="mr-2 h-4 w-4" />
                          {expiryDate ? format(expiryDate, "PPP", { locale: pt }) : "Selecione uma data"}
                        </Button>
                      </PopoverTrigger>
                      <PopoverContent className="w-auto p-0">
                        <CalendarComponent
                          mode="single"
                          selected={expiryDate}
                          onSelect={(date) => {
                            setExpiryDate(date);
                            setIsCalendarOpen(false);
                          }}
                          initialFocus
                        />
                      </PopoverContent>
                    </Popover>
                  </div>
                </div>
                
                <div className="grid grid-cols-3 gap-2">
                  <Button 
                    variant="outline" 
                    size="sm"
                    onClick={() => extendSubscription(1)}
                  >
                    +1 Mês
                  </Button>
                  <Button 
                    variant="outline" 
                    size="sm"
                    onClick={() => extendSubscription(3)}
                  >
                    +3 Meses
                  </Button>
                  <Button 
                    variant="outline" 
                    size="sm"
                    onClick={() => extendSubscription(12)}
                  >
                    +1 Ano
                  </Button>
                </div>
              </>
            )}
          </div>
          
          <DialogFooter>
            <Button 
              variant="outline" 
              onClick={() => setShowSubscriptionDialog(false)}
            >
              Cancelar
            </Button>
            <Button 
              onClick={handleSubscriptionUpdate}
              disabled={updateSubscriptionMutation.isPending}
            >
              {updateSubscriptionMutation.isPending ? "Salvando..." : "Salvar"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default UsersPage;