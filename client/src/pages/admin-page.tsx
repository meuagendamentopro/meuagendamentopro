import React, { useState } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { zodResolver } from "@hookform/resolvers/zod";
import { useForm } from "react-hook-form";
import { z } from "zod";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import { Loader2, PlusCircle, MoreVertical, Edit, Trash2, Shield, ShieldOff } from "lucide-react";
import { queryClient, apiRequest } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";
import { 
  Dialog, 
  DialogContent, 
  DialogHeader, 
  DialogTitle, 
  DialogDescription,
  DialogFooter,
} from "@/components/ui/dialog";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";

// Definição do schema do formulário
const userFormSchema = z.object({
  name: z.string().min(3, "Nome deve ter pelo menos 3 caracteres"),
  username: z.string().min(3, "Nome de usuário deve ter pelo menos 3 caracteres"),
  password: z.string().min(6, "Senha deve ter pelo menos 6 caracteres"),
  confirmPassword: z.string(),
  role: z.enum(["admin", "provider"]),
}).refine(data => data.password === data.confirmPassword, {
  message: "As senhas não coincidem",
  path: ["confirmPassword"],
});

type UserFormValues = z.infer<typeof userFormSchema>;

interface User {
  id: number;
  name: string;
  username: string;
  role: string;
  isActive: boolean;
  createdAt: string;
}

// Schema para edição de usuário (sem exigir senha)
const editUserFormSchema = z.object({
  name: z.string().min(3, "Nome deve ter pelo menos 3 caracteres"),
  username: z.string().min(3, "Nome de usuário deve ter pelo menos 3 caracteres"),
  password: z.string().optional(),
  confirmPassword: z.string().optional(),
  role: z.enum(["admin", "provider"]),
}).refine(data => {
  // Se uma senha foi fornecida, confirmar que ambas coincidem
  if (data.password) {
    return data.password === data.confirmPassword;
  }
  return true;
}, {
  message: "As senhas não coincidem",
  path: ["confirmPassword"],
});

type EditUserFormValues = z.infer<typeof editUserFormSchema>;

export default function AdminPage() {
  const { toast } = useToast();
  const [isModalOpen, setIsModalOpen] = useState(false);
  
  // Estados para diálogos e ações
  const [isEditDialogOpen, setIsEditDialogOpen] = useState(false);
  const [isDeleteDialogOpen, setIsDeleteDialogOpen] = useState(false);
  const [isToggleActiveDialogOpen, setIsToggleActiveDialogOpen] = useState(false);
  const [selectedUser, setSelectedUser] = useState<User | null>(null);
  const [userToDeleteId, setUserToDeleteId] = useState<number | null>(null);

  // Consulta para buscar usuários
  const { data: users, isLoading: isLoadingUsers } = useQuery<User[]>({
    queryKey: ["/api/admin/users"],
    queryFn: async () => {
      const res = await apiRequest("GET", "/api/admin/users");
      if (!res.ok) {
        throw new Error("Falha ao carregar usuários");
      }
      return res.json();
    },
  });
  
  // Mutação para limpar o banco de dados
  const clearDatabaseMutation = useMutation({
    mutationFn: async () => {
      const res = await apiRequest("POST", "/api/admin/clear-database");
      if (!res.ok) {
        const errorData = await res.json();
        throw new Error(errorData.error || "Falha ao limpar banco de dados");
      }
      return res.json();
    },
    onSuccess: (data) => {
      toast({
        title: "Banco de dados limpo",
        description: data.message || "Dados limpos com sucesso.",
        variant: "default",
      });
      
      // Invalidar todas as consultas para atualizar os dados na UI
      queryClient.invalidateQueries();
    },
    onError: (error: Error) => {
      toast({
        title: "Erro ao limpar banco de dados",
        description: error.message,
        variant: "destructive",
      });
    },
  });
  
  // Função para confirmar e executar a limpeza do banco de dados
  const handleClearDatabase = () => {
    // Confirmar a ação com o usuário
    if (window.confirm(
      "ATENÇÃO: Esta ação irá remover todos os agendamentos, serviços e clientes do sistema. " +
      "Esta ação não pode ser desfeita. " +
      "Deseja realmente continuar?"
    )) {
      clearDatabaseMutation.mutate();
    }
  };

  // Formulário
  const form = useForm<UserFormValues>({
    resolver: zodResolver(userFormSchema),
    defaultValues: {
      name: "",
      username: "",
      password: "",
      confirmPassword: "",
      role: "provider",
    },
  });

  // Mutação para criar usuário
  const createUserMutation = useMutation({
    mutationFn: async (data: Omit<UserFormValues, "confirmPassword">) => {
      const res = await apiRequest("POST", "/api/admin/users", data);
      if (!res.ok) {
        const errorData = await res.json();
        throw new Error(errorData.error || "Falha ao criar usuário");
      }
      return res.json();
    },
    onSuccess: () => {
      toast({
        title: "Usuário criado",
        description: "O usuário foi criado com sucesso",
      });
      form.reset();
      queryClient.invalidateQueries({ queryKey: ["/api/admin/users"] });
    },
    onError: (error: Error) => {
      toast({
        title: "Erro ao criar usuário",
        description: error.message,
        variant: "destructive",
      });
    },
  });

  // Handler para submit do formulário
  const onSubmit = (data: UserFormValues) => {
    // Remove o campo confirmPassword antes de enviar
    const { confirmPassword, ...userData } = data;
    createUserMutation.mutate(userData);
  };
  
  // Formulário de edição
  const editForm = useForm<EditUserFormValues>({
    resolver: zodResolver(editUserFormSchema),
    defaultValues: {
      name: "",
      username: "",
      password: "",
      confirmPassword: "",
      role: "provider",
    },
  });
  
  // Atualiza os valores do formulário quando um usuário é selecionado para edição
  React.useEffect(() => {
    if (selectedUser) {
      editForm.reset({
        name: selectedUser.name,
        username: selectedUser.username,
        password: "",
        confirmPassword: "",
        role: selectedUser.role as "admin" | "provider",
      });
    }
  }, [selectedUser, editForm]);
  
  // Mutação para atualizar usuário
  const updateUserMutation = useMutation({
    mutationFn: async (data: { id: number, userData: Partial<EditUserFormValues> }) => {
      const res = await apiRequest("PUT", `/api/admin/users/${data.id}`, data.userData);
      if (!res.ok) {
        const errorData = await res.json();
        throw new Error(errorData.error || "Falha ao atualizar usuário");
      }
      return res.json();
    },
    onSuccess: () => {
      toast({
        title: "Usuário atualizado",
        description: "O usuário foi atualizado com sucesso",
      });
      setIsEditDialogOpen(false);
      setSelectedUser(null);
      queryClient.invalidateQueries({ queryKey: ["/api/admin/users"] });
    },
    onError: (error: Error) => {
      toast({
        title: "Erro ao atualizar usuário",
        description: error.message,
        variant: "destructive",
      });
    }
  });
  
  // Mutação para excluir usuário
  const deleteUserMutation = useMutation({
    mutationFn: async (id: number) => {
      const res = await apiRequest("DELETE", `/api/admin/users/${id}`);
      if (!res.ok) {
        const errorData = await res.json();
        throw new Error(errorData.error || "Falha ao excluir usuário");
      }
      return res.json();
    },
    onSuccess: () => {
      toast({
        title: "Usuário excluído",
        description: "O usuário foi removido com sucesso",
      });
      setIsDeleteDialogOpen(false);
      setUserToDeleteId(null);
      queryClient.invalidateQueries({ queryKey: ["/api/admin/users"] });
    },
    onError: (error: Error) => {
      toast({
        title: "Erro ao excluir usuário",
        description: error.message,
        variant: "destructive",
      });
    }
  });
  
  // Handler para abrir o diálogo de edição
  const handleEditUser = (user: User) => {
    setSelectedUser(user);
    setIsEditDialogOpen(true);
  };
  
  // Handler para abrir o diálogo de confirmação de exclusão
  const handleDeleteUser = (id: number) => {
    setUserToDeleteId(id);
    setIsDeleteDialogOpen(true);
  };
  
  // Handler para confirmar a edição do usuário
  const handleEditSubmit = (data: EditUserFormValues) => {
    if (!selectedUser) return;
    
    // Remover campos vazios ou nulos
    const updateData: Partial<EditUserFormValues> = {};
    
    if (data.name) updateData.name = data.name;
    if (data.username) updateData.username = data.username;
    if (data.role) updateData.role = data.role;
    
    // Incluir senha apenas se fornecida
    if (data.password && data.password.trim() !== "") {
      const { confirmPassword, ...dataWithPassword } = data;
      Object.assign(updateData, { password: data.password });
    }
    
    updateUserMutation.mutate({ 
      id: selectedUser.id, 
      userData: updateData 
    });
  };
  
  // Mutação para alternar status ativo/inativo do usuário
  const toggleUserActiveMutation = useMutation({
    mutationFn: async (data: { id: number; active: boolean }) => {
      const res = await apiRequest("PATCH", `/api/admin/users/${data.id}/toggle-active`, { active: data.active });
      if (!res.ok) {
        const errorData = await res.json();
        throw new Error(errorData.error || "Falha ao alterar status do usuário");
      }
      return res.json();
    },
    onSuccess: (data) => {
      const action = data.user.isActive ? "ativado" : "bloqueado";
      toast({
        title: `Usuário ${action}`,
        description: `O usuário foi ${action} com sucesso`,
      });
      queryClient.invalidateQueries({ queryKey: ["/api/admin/users"] });
    },
    onError: (error: Error) => {
      toast({
        title: "Erro ao alterar status do usuário",
        description: error.message,
        variant: "destructive",
      });
    }
  });
  
  // Handler para alternar status ativo/inativo do usuário
  const handleToggleUserActive = (user: User) => {
    // Mostrar uma confirmação dependendo da ação (bloquear ou ativar)
    const action = user.isActive ? "bloquear" : "ativar";
    const message = user.isActive 
      ? `Este usuário perderá acesso ao sistema. Deseja continuar?`
      : `Deseja reativar o acesso deste usuário?`;
    
    if (window.confirm(`Você está prestes a ${action} o usuário ${user.name}. ${message}`)) {
      toggleUserActiveMutation.mutate({
        id: user.id,
        active: !user.isActive
      });
    }
  };

  // Consulta para buscar planos de assinatura
  const { data: subscriptionPlans, isLoading: isLoadingPlans } = useQuery({
    queryKey: ["/api/admin/subscription/plans"],
    queryFn: async () => {
      const res = await apiRequest("GET", "/api/admin/subscription/plans");
      if (!res.ok) {
        throw new Error("Falha ao carregar planos de assinatura");
      }
      return res.json();
    },
  });

  // Estado para o plano em edição
  const [planToEdit, setPlanToEdit] = useState<SubscriptionPlan | null>(null);
  const [isEditPlanDialogOpen, setIsEditPlanDialogOpen] = useState(false);
  const [newPrice, setNewPrice] = useState<string>("");

  // Mutação para atualizar o preço do plano
  const updatePlanPriceMutation = useMutation({
    mutationFn: async (data: {id: number, price: number}) => {
      const res = await apiRequest("PATCH", `/api/admin/subscription/plans/${data.id}`, { price: data.price });
      if (!res.ok) {
        const errorData = await res.json();
        throw new Error(errorData.error || "Falha ao atualizar preço do plano");
      }
      return res.json();
    },
    onSuccess: () => {
      toast({
        title: "Preço atualizado",
        description: "O preço do plano foi atualizado com sucesso",
      });
      setIsEditPlanDialogOpen(false);
      setPlanToEdit(null);
      queryClient.invalidateQueries({ queryKey: ["/api/admin/subscription/plans"] });
    },
    onError: (error: Error) => {
      toast({
        title: "Erro ao atualizar preço",
        description: error.message,
        variant: "destructive",
      });
    }
  });

  // Função para formatar preço em reais (R$)
  const formatCurrency = (valueInCents: number) => {
    return new Intl.NumberFormat('pt-BR', {
      style: 'currency',
      currency: 'BRL',
    }).format(valueInCents / 100);
  };

  // Definir interface para o plano
  interface SubscriptionPlan {
    id: number;
    name: string;
    description: string | null;
    durationMonths: number;
    price: number;
    isActive: boolean;
    createdAt: string;
    updatedAt: string;
  }

  // Handler para abrir diálogo de edição de preço
  const handleEditPlanPrice = (plan: SubscriptionPlan) => {
    setPlanToEdit(plan);
    setNewPrice((plan.price / 100).toString());
    setIsEditPlanDialogOpen(true);
  };

  // Handler para salvar preço atualizado
  const handleSavePlanPrice = () => {
    if (!planToEdit) return;

    // Converter para número e depois para centavos
    const priceAsNumber = parseFloat(newPrice);
    if (isNaN(priceAsNumber)) {
      toast({
        title: "Preço inválido",
        description: "Por favor, informe um valor válido",
        variant: "destructive",
      });
      return;
    }
    
    // Converter para centavos
    const priceInCents = Math.round(priceAsNumber * 100);
    
    updatePlanPriceMutation.mutate({
      id: planToEdit.id,
      price: priceInCents
    });
  };

  return (
    <div className="container mx-auto px-4 py-8">
      <h1 className="text-3xl font-bold mb-8">Administração</h1>
      
      <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3 mb-8">
        <Card className="hover:shadow-lg transition-shadow duration-300">
          <CardHeader>
            <CardTitle>Usuários</CardTitle>
            <CardDescription>Gerenciar usuários e assinaturas</CardDescription>
          </CardHeader>
          <CardContent>
            <p className="text-sm text-gray-500 mb-4">
              Crie, edite e gerencie usuários do sistema. Controle permissões e assinaturas.
            </p>
            <Button variant="outline" onClick={() => window.location.href = "/admin/users"}>
              Gerenciar Usuários
            </Button>
          </CardContent>
        </Card>
        
        <Card className="hover:shadow-lg transition-shadow duration-300">
          <CardHeader>
            <CardTitle>Planos de Assinatura</CardTitle>
            <CardDescription>Configurar planos disponíveis</CardDescription>
          </CardHeader>
          <CardContent>
            <p className="text-sm text-gray-500 mb-4">
              Gerencie os preços e configurações dos planos de assinatura oferecidos.
            </p>
            <Button variant="outline" className="text-primary border-primary" onClick={() => setIsModalOpen(true)}>
              Gerenciar Planos
            </Button>
          </CardContent>
        </Card>
        
        <Card className="hover:shadow-lg transition-shadow duration-300">
          <CardHeader>
            <CardTitle>Banco de Dados</CardTitle>
            <CardDescription>Manutenção do banco de dados</CardDescription>
          </CardHeader>
          <CardContent>
            <p className="text-sm text-gray-500 mb-4">
              Limpar dados do banco de dados. Utilize com cuidado, essa ação não pode ser desfeita.
            </p>
            <Button 
              variant="outline" 
              className="text-amber-600 border-amber-600 hover:bg-amber-50"
              onClick={handleClearDatabase}
              disabled={clearDatabaseMutation.isPending}
            >
              {clearDatabaseMutation.isPending ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  Processando...
                </>
              ) : (
                "Limpar Banco de Dados"
              )}
            </Button>
          </CardContent>
        </Card>
      </div>

      {/* Diálogo de edição */}
      <Dialog open={isEditDialogOpen} onOpenChange={setIsEditDialogOpen}>
        <DialogContent className="sm:max-w-[500px]">
          <DialogHeader>
            <DialogTitle>Editar Usuário</DialogTitle>
            <DialogDescription>
              Atualize as informações do usuário. Deixe a senha em branco para manter a mesma.
            </DialogDescription>
          </DialogHeader>
          <Form {...editForm}>
            <form onSubmit={editForm.handleSubmit(handleEditSubmit)} className="space-y-4">
              <div className="grid grid-cols-1 gap-4">
                <FormField
                  control={editForm.control}
                  name="name"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Nome Completo</FormLabel>
                      <FormControl>
                        <Input placeholder="Nome completo" {...field} />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                <FormField
                  control={editForm.control}
                  name="username"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Nome de Usuário</FormLabel>
                      <FormControl>
                        <Input placeholder="Nome de usuário" {...field} />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                <FormField
                  control={editForm.control}
                  name="password"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Nova Senha (opcional)</FormLabel>
                      <FormControl>
                        <Input type="password" placeholder="Deixe em branco para manter a mesma senha" {...field} />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                <FormField
                  control={editForm.control}
                  name="confirmPassword"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Confirmar Nova Senha</FormLabel>
                      <FormControl>
                        <Input
                          type="password"
                          placeholder="Confirme a nova senha"
                          {...field}
                        />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                <FormField
                  control={editForm.control}
                  name="role"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Tipo de Usuário</FormLabel>
                      <Select 
                        onValueChange={field.onChange} 
                        defaultValue={field.value}
                      >
                        <FormControl>
                          <SelectTrigger>
                            <SelectValue placeholder="Selecione o tipo de usuário" />
                          </SelectTrigger>
                        </FormControl>
                        <SelectContent>
                          <SelectItem value="admin">Administrador</SelectItem>
                          <SelectItem value="provider">Provedor de Serviço</SelectItem>
                        </SelectContent>
                      </Select>
                      <FormMessage />
                    </FormItem>
                  )}
                />
              </div>

              <DialogFooter>
                <Button
                  type="submit"
                  disabled={updateUserMutation.isPending}
                >
                  {updateUserMutation.isPending ? (
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  ) : (
                    <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="mr-1"><path d="M19 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11l5 5v11a2 2 0 0 1-2 2z"></path><polyline points="17 21 17 13 7 13 7 21"></polyline><polyline points="7 3 7 8 15 8"></polyline></svg>
                  )}
                  Salvar Alterações
                </Button>
              </DialogFooter>
            </form>
          </Form>
        </DialogContent>
      </Dialog>

      {/* Diálogo de confirmação de exclusão */}
      <AlertDialog open={isDeleteDialogOpen} onOpenChange={setIsDeleteDialogOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Você tem certeza?</AlertDialogTitle>
            <AlertDialogDescription>
              Esta ação não pode ser desfeita. Isso excluirá permanentemente o usuário
              e removerá seus dados do sistema.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction
              onClick={() => userToDeleteId && deleteUserMutation.mutate(userToDeleteId)}
              className="bg-red-600 hover:bg-red-700"
              disabled={deleteUserMutation.isPending}
            >
              {deleteUserMutation.isPending ? (
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
              ) : "Excluir"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
      
      <div className="grid grid-cols-1 gap-6">
        {/* Card de Limpeza do Banco de Dados */}
        <Card className="bg-red-50 border-red-200">
          <CardHeader>
            <CardTitle className="flex items-center text-red-700">
              <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="mr-2"><path d="M3 6h18"></path><path d="M19 6v14c0 1-1 2-2 2H7c-1 0-2-1-2-2V6"></path><path d="M8 6V4c0-1 1-2 2-2h4c1 0 2 1 2 2v2"></path><line x1="10" y1="11" x2="10" y2="17"></line><line x1="14" y1="11" x2="14" y2="17"></line></svg>
              Limpar Banco de Dados
            </CardTitle>
            <CardDescription className="text-red-700">
              Esta ação irá remover todos os serviços, clientes e agendamentos do sistema. Apenas os usuários e provedores serão mantidos.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <Button 
              variant="destructive" 
              onClick={handleClearDatabase}
              disabled={clearDatabaseMutation.isPending}
              className="w-full"
            >
              {clearDatabaseMutation.isPending ? (
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
              ) : (
                <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="mr-2"><path d="M3 6h18"></path><path d="M19 6v14c0 1-1 2-2 2H7c-1 0-2-1-2-2V6"></path><path d="M8 6V4c0-1 1-2 2-2h4c1 0 2 1 2 2v2"></path><line x1="10" y1="11" x2="10" y2="17"></line><line x1="14" y1="11" x2="14" y2="17"></line></svg>
              )}
              Limpar Banco de Dados
            </Button>
          </CardContent>
        </Card>
        
        {/* Formulário de Criação de Usuário */}
        <Card>
          <CardHeader>
            <CardTitle>Novo Usuário</CardTitle>
            <CardDescription>
              Crie um novo usuário para acessar o sistema
            </CardDescription>
          </CardHeader>
          <CardContent>
            <Form {...form}>
              <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <FormField
                    control={form.control}
                    name="name"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Nome Completo</FormLabel>
                        <FormControl>
                          <Input placeholder="Nome completo" {...field} />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />

                  <FormField
                    control={form.control}
                    name="username"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Nome de Usuário</FormLabel>
                        <FormControl>
                          <Input placeholder="Nome de usuário" {...field} />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />

                  <FormField
                    control={form.control}
                    name="password"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Senha</FormLabel>
                        <FormControl>
                          <Input type="password" placeholder="Senha" {...field} />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />

                  <FormField
                    control={form.control}
                    name="confirmPassword"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Confirmar Senha</FormLabel>
                        <FormControl>
                          <Input
                            type="password"
                            placeholder="Confirme a senha"
                            {...field}
                          />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />

                  <FormField
                    control={form.control}
                    name="role"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Tipo de Usuário</FormLabel>
                        <Select 
                          onValueChange={field.onChange} 
                          defaultValue={field.value}
                        >
                          <FormControl>
                            <SelectTrigger>
                              <SelectValue placeholder="Selecione o tipo de usuário" />
                            </SelectTrigger>
                          </FormControl>
                          <SelectContent>
                            <SelectItem value="admin">Administrador</SelectItem>
                            <SelectItem value="provider">Provedor de Serviço</SelectItem>
                          </SelectContent>
                        </Select>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                </div>

                <Button
                  type="submit"
                  className="mt-4"
                  disabled={createUserMutation.isPending}
                >
                  {createUserMutation.isPending ? (
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  ) : (
                    <PlusCircle className="mr-2 h-4 w-4" />
                  )}
                  Criar Usuário
                </Button>
              </form>
            </Form>
          </CardContent>
        </Card>

        {/* Lista de Usuários */}
        <Card>
          <CardHeader>
            <CardTitle>Usuários do Sistema</CardTitle>
            <CardDescription>
              Lista de todos os usuários cadastrados
            </CardDescription>
          </CardHeader>
          <CardContent>
            {isLoadingUsers ? (
              <div className="flex justify-center my-8">
                <Loader2 className="h-8 w-8 animate-spin text-primary" />
              </div>
            ) : (
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>ID</TableHead>
                    <TableHead>Nome</TableHead>
                    <TableHead>Usuário</TableHead>
                    <TableHead>Tipo</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead>Data de Cadastro</TableHead>
                    <TableHead className="text-right">Ações</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {users && users.length > 0 ? (
                    users.map((user) => (
                      <TableRow key={user.id}>
                        <TableCell>{user.id}</TableCell>
                        <TableCell>{user.name}</TableCell>
                        <TableCell>{user.username}</TableCell>
                        <TableCell>
                          {user.role === "admin" ? "Administrador" : "Provedor de Serviço"}
                        </TableCell>
                        <TableCell>
                          <span className={`px-2 py-1 text-xs font-medium rounded-full ${
                            user.isActive 
                            ? "bg-green-100 text-green-800" 
                            : "bg-red-100 text-red-800"
                          }`}>
                            {user.isActive ? "Ativo" : "Bloqueado"}
                          </span>
                        </TableCell>
                        <TableCell>
                          {format(new Date(user.createdAt), "dd/MM/yyyy HH:mm", { locale: ptBR })}
                        </TableCell>
                        <TableCell className="text-right">
                          <DropdownMenu>
                            <DropdownMenuTrigger asChild>
                              <Button variant="ghost" size="sm">
                                <MoreVertical className="h-4 w-4" />
                              </Button>
                            </DropdownMenuTrigger>
                            <DropdownMenuContent align="end">
                              <DropdownMenuItem onClick={() => handleEditUser(user)}>
                                <Edit className="h-4 w-4 mr-2" />
                                Editar
                              </DropdownMenuItem>
                              
                              <DropdownMenuItem 
                                onClick={() => handleToggleUserActive(user)}
                                disabled={user.id === 1} // Impedir bloqueio do admin principal
                              >
                                {user.isActive ? (
                                  <>
                                    <ShieldOff className="h-4 w-4 mr-2" />
                                    Bloquear usuário
                                  </>
                                ) : (
                                  <>
                                    <Shield className="h-4 w-4 mr-2" />
                                    Ativar usuário
                                  </>
                                )}
                              </DropdownMenuItem>
                              
                              <DropdownMenuSeparator />
                              
                              <DropdownMenuItem 
                                onClick={() => handleDeleteUser(user.id)}
                                disabled={user.id === 1} // Impedir exclusão do admin principal
                                className="text-red-600"
                              >
                                <Trash2 className="h-4 w-4 mr-2" />
                                Excluir
                              </DropdownMenuItem>
                            </DropdownMenuContent>
                          </DropdownMenu>
                        </TableCell>
                      </TableRow>
                    ))
                  ) : (
                    <TableRow>
                      <TableCell colSpan={7} className="text-center py-4">
                        Nenhum usuário encontrado
                      </TableCell>
                    </TableRow>
                  )}
                </TableBody>
              </Table>
            )}
          </CardContent>
        </Card>
      </div>

      {/* Modal para gerenciar planos de assinatura */}
      <Dialog open={isModalOpen} onOpenChange={setIsModalOpen}>
        <DialogContent className="sm:max-w-[600px]">
          <DialogHeader>
            <DialogTitle>Gerenciar Planos de Assinatura</DialogTitle>
            <DialogDescription>
              Visualize e edite os planos de assinatura disponíveis no sistema.
            </DialogDescription>
          </DialogHeader>
          <div className="py-4">
            {isLoadingPlans ? (
              <div className="flex justify-center items-center py-8">
                <Loader2 className="h-8 w-8 animate-spin text-primary" />
              </div>
            ) : subscriptionPlans && subscriptionPlans.length > 0 ? (
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Nome</TableHead>
                    <TableHead>Duração</TableHead>
                    <TableHead>Preço</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead className="text-right">Ações</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {subscriptionPlans.map((plan: SubscriptionPlan) => (
                    <TableRow key={plan.id}>
                      <TableCell className="font-medium">{plan.name}</TableCell>
                      <TableCell>{plan.durationMonths} {plan.durationMonths === 1 ? 'mês' : 'meses'}</TableCell>
                      <TableCell>{formatCurrency(plan.price)}</TableCell>
                      <TableCell>
                        {plan.isActive ? (
                          <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-green-100 text-green-800">
                            Ativo
                          </span>
                        ) : (
                          <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-gray-100 text-gray-800">
                            Inativo
                          </span>
                        )}
                      </TableCell>
                      <TableCell className="text-right">
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => handleEditPlanPrice(plan)}
                          className="h-8 px-2 text-primary hover:text-primary"
                        >
                          <Edit className="h-4 w-4 mr-1" />
                          Editar Preço
                        </Button>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            ) : (
              <div className="text-center py-4 text-muted-foreground">
                Nenhum plano de assinatura encontrado.
              </div>
            )}
          </div>
        </DialogContent>
      </Dialog>

      {/* Diálogo para edição de preço do plano */}
      <Dialog open={isEditPlanDialogOpen} onOpenChange={setIsEditPlanDialogOpen}>
        <DialogContent className="sm:max-w-[400px]">
          <DialogHeader>
            <DialogTitle>Editar Preço do Plano</DialogTitle>
            <DialogDescription>
              Atualize o preço do plano de assinatura selecionado.
            </DialogDescription>
          </DialogHeader>
          <div className="py-4">
            {planToEdit && (
              <div className="space-y-4">
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <p className="text-sm font-medium mb-1">Nome do Plano</p>
                    <p className="text-sm">{subscriptionPlans?.find((p: SubscriptionPlan) => p.id === planToEdit.id)?.name}</p>
                  </div>
                  <div>
                    <p className="text-sm font-medium mb-1">Duração</p>
                    <p className="text-sm">
                      {subscriptionPlans?.find((p: SubscriptionPlan) => p.id === planToEdit.id)?.durationMonths} 
                      {subscriptionPlans?.find((p: SubscriptionPlan) => p.id === planToEdit.id)?.durationMonths === 1 ? ' mês' : ' meses'}
                    </p>
                  </div>
                </div>

                <div>
                  <Label htmlFor="price">Preço atual</Label>
                  <p className="text-lg font-bold text-primary">{formatCurrency(planToEdit.price)}</p>
                </div>

                <div className="space-y-2">
                  <Label htmlFor="newPrice">Novo preço</Label>
                  <div className="relative">
                    <span className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-500">R$</span>
                    <Input
                      id="newPrice"
                      type="number"
                      step="0.01"
                      min="0"
                      placeholder="0.00"
                      value={newPrice}
                      onChange={(e) => setNewPrice(e.target.value)}
                      className="pl-9"
                    />
                  </div>
                  <p className="text-xs text-muted-foreground">
                    Digite o valor em reais (ex: 49.90)
                  </p>
                </div>
              </div>
            )}
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setIsEditPlanDialogOpen(false)}>
              Cancelar
            </Button>
            <Button 
              type="submit" 
              onClick={handleSavePlanPrice}
              disabled={updatePlanPriceMutation.isPending}
            >
              {updatePlanPriceMutation.isPending ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  Salvando...
                </>
              ) : "Salvar Preço"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}