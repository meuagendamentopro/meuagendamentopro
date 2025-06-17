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
import { Loader2, PlusCircle, MoreVertical, Edit, Trash2, Shield, ShieldOff, Power, AlertTriangle, CheckCircle, UserCheck } from "lucide-react";
import { useImpersonation } from "@/hooks/use-impersonation";
import { queryClient, apiRequest } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import { useMaintenance } from "@/contexts/maintenance-context";
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
import SystemSettings from "@/components/admin/system-settings";
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
  email: z.string().email("Email inválido").optional(),
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
  email: string;
  role: string;
  isActive: boolean;
  createdAt: string;
}

// Schema para edição de usuário (sem exigir senha)
const editUserFormSchema = z.object({
  name: z.string().min(3, "Nome deve ter pelo menos 3 caracteres"),
  username: z.string().min(3, "Nome de usuário deve ter pelo menos 3 caracteres"),
  email: z.string().email("Email inválido").optional(),
  password: z.string().optional(),
  confirmPassword: z.string().optional(),
  role: z.enum(["admin", "provider"]),
}).refine(data => {
  // Se uma senha foi fornecida, confirmar que ambas coincidem
  if (data.password && data.password.trim() !== "") {
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
  const maintenance = useMaintenance();
  const { startImpersonation } = useImpersonation();
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
      email: "",
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
      email: "",
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
        email: selectedUser.email,
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
    
    if (data.name && data.name.trim() !== "") updateData.name = data.name;
    if (data.username && data.username.trim() !== "") updateData.username = data.username;
    if (data.email && data.email.trim() !== "") updateData.email = data.email;
    if (data.role) updateData.role = data.role;
    
    // Incluir senha apenas se fornecida e não estiver vazia
    if (data.password && data.password.trim() !== "") {
      updateData.password = data.password;
    }
    
    console.log('Dados sendo enviados para atualização:', updateData);
    
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

  // Estados para gerenciamento de planos
  const [planToEdit, setPlanToEdit] = useState<SubscriptionPlan | null>(null);
  const [isEditPlanDialogOpen, setIsEditPlanDialogOpen] = useState(false);
  const [isNewPlanDialogOpen, setIsNewPlanDialogOpen] = useState(false);
  const [isEditFullPlanDialogOpen, setIsEditFullPlanDialogOpen] = useState(false);
  const [isDeletePlanDialogOpen, setIsDeletePlanDialogOpen] = useState(false);
  const [newPrice, setNewPrice] = useState<string>("");
  
  // Estado para novo plano
  const [newPlan, setNewPlan] = useState({
    name: "",
    description: "",
    durationMonths: "1",
    price: "",
    accountType: "individual",
    isActive: true
  });
  
  // Estado para edição completa de plano
  const [editedPlan, setEditedPlan] = useState({
    id: 0,
    name: "",
    description: "",
    durationMonths: "",
    price: "",
    accountType: "individual",
    isActive: true
  });

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

  // Mutação para criar novo plano
  const createPlanMutation = useMutation({
    mutationFn: async (data: typeof newPlan) => {
      // Converter preço para centavos
      const priceInCents = Math.round(parseFloat(data.price) * 100);
      
      const res = await apiRequest("POST", "/api/admin/subscription/plans", {
        ...data,
        price: priceInCents,
        durationMonths: parseInt(data.durationMonths)
      });
      
      if (!res.ok) {
        const errorData = await res.json();
        throw new Error(errorData.error || "Falha ao criar plano");
      }
      return res.json();
    },
    onSuccess: () => {
      toast({
        title: "Plano criado",
        description: "O plano de assinatura foi criado com sucesso",
      });
      setIsNewPlanDialogOpen(false);
      setNewPlan({
        name: "",
        description: "",
        durationMonths: "1",
        price: "",
        accountType: "individual",
        isActive: true
      });
      queryClient.invalidateQueries({ queryKey: ["/api/admin/subscription/plans"] });
    },
    onError: (error: Error) => {
      toast({
        title: "Erro ao criar plano",
        description: error.message,
        variant: "destructive",
      });
    }
  });

  // Mutação para atualizar plano completo
  const updateFullPlanMutation = useMutation({
    mutationFn: async (data: typeof editedPlan) => {
      // Converter preço para centavos
      const priceInCents = Math.round(parseFloat(data.price) * 100);
      
      const res = await apiRequest("PUT", `/api/admin/subscription/plans/${data.id}`, {
        name: data.name,
        description: data.description,
        durationMonths: parseInt(data.durationMonths),
        price: priceInCents,
        isActive: data.isActive
      });
      
      if (!res.ok) {
        const errorData = await res.json();
        throw new Error(errorData.error || "Falha ao atualizar plano");
      }
      return res.json();
    },
    onSuccess: () => {
      toast({
        title: "Plano atualizado",
        description: "O plano de assinatura foi atualizado com sucesso",
      });
      setIsEditFullPlanDialogOpen(false);
      setPlanToEdit(null);
      queryClient.invalidateQueries({ queryKey: ["/api/admin/subscription/plans"] });
    },
    onError: (error: Error) => {
      toast({
        title: "Erro ao atualizar plano",
        description: error.message,
        variant: "destructive",
      });
    }
  });

  // Mutação para excluir plano
  const deletePlanMutation = useMutation({
    mutationFn: async (id: number) => {
      const res = await apiRequest("DELETE", `/api/admin/subscription/plans/${id}`);
      if (!res.ok) {
        const errorData = await res.json();
        throw new Error(errorData.error || "Falha ao excluir plano");
      }
      return res.json();
    },
    onSuccess: () => {
      toast({
        title: "Plano excluído",
        description: "O plano de assinatura foi excluído com sucesso",
      });
      setIsDeletePlanDialogOpen(false);
      setPlanToEdit(null);
      queryClient.invalidateQueries({ queryKey: ["/api/admin/subscription/plans"] });
    },
    onError: (error: Error) => {
      toast({
        title: "Erro ao excluir plano",
        description: error.message,
        variant: "destructive",
      });
    }
  });

  // Mutação para alternar status ativo/inativo do plano
  const togglePlanActiveMutation = useMutation({
    mutationFn: async (id: number) => {
      const res = await apiRequest("PATCH", `/api/admin/subscription/plans/${id}/toggle-active`);
      if (!res.ok) {
        const errorData = await res.json();
        throw new Error(errorData.error || "Falha ao alternar status do plano");
      }
      return res.json();
    },
    onSuccess: (data) => {
      const status = data.isActive ? "ativado" : "desativado";
      toast({
        title: `Plano ${status}`,
        description: `O plano foi ${status} com sucesso`,
      });
      queryClient.invalidateQueries({ queryKey: ["/api/admin/subscription/plans"] });
    },
    onError: (error: Error) => {
      toast({
        title: "Erro ao alternar status do plano",
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
    accountType: string;
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
  
  // Handler para abrir diálogo de criação de novo plano
  const handleOpenNewPlanDialog = () => {
    setNewPlan({
      name: "",
      description: "",
      durationMonths: "1",
      price: "",
      accountType: "individual",
      isActive: true
    });
    setIsNewPlanDialogOpen(true);
  };
  
  // Handler para criar novo plano
  const handleCreatePlan = () => {
    // Validar dados
    if (!newPlan.name) {
      toast({
        title: "Nome obrigatório",
        description: "Por favor, informe o nome do plano",
        variant: "destructive",
      });
      return;
    }
    
    if (!newPlan.durationMonths) {
      toast({
        title: "Duração obrigatória",
        description: "Por favor, informe a duração do plano em meses",
        variant: "destructive",
      });
      return;
    }
    
    const price = parseFloat(newPlan.price);
    if (isNaN(price) || price <= 0) {
      toast({
        title: "Preço inválido",
        description: "Por favor, informe um valor válido maior que zero",
        variant: "destructive",
      });
      return;
    }
    
    createPlanMutation.mutate(newPlan);
  };
  
  // Handler para abrir diálogo de edição completa do plano
  const handleEditFullPlan = (plan: SubscriptionPlan) => {
    setEditedPlan({
      id: plan.id,
      name: plan.name,
      description: plan.description || "",
      durationMonths: plan.durationMonths.toString(),
      price: (plan.price / 100).toString(),
      accountType: plan.accountType || "individual",
      isActive: plan.isActive
    });
    setIsEditFullPlanDialogOpen(true);
  };
  
  // Handler para salvar plano editado
  const handleSaveEditedPlan = () => {
    // Validar dados
    if (!editedPlan.name) {
      toast({
        title: "Nome obrigatório",
        description: "Por favor, informe o nome do plano",
        variant: "destructive",
      });
      return;
    }
    
    if (!editedPlan.durationMonths) {
      toast({
        title: "Duração obrigatória",
        description: "Por favor, informe a duração do plano em meses",
        variant: "destructive",
      });
      return;
    }
    
    const price = parseFloat(editedPlan.price);
    if (isNaN(price) || price <= 0) {
      toast({
        title: "Preço inválido",
        description: "Por favor, informe um valor válido maior que zero",
        variant: "destructive",
      });
      return;
    }
    
    updateFullPlanMutation.mutate(editedPlan);
  };
  
  // Handler para abrir diálogo de exclusão
  const handleDeletePlanDialog = (plan: SubscriptionPlan) => {
    setPlanToEdit(plan);
    setIsDeletePlanDialogOpen(true);
  };
  
  // Handler para confirmar exclusão
  const handleConfirmDeletePlan = () => {
    if (!planToEdit) return;
    deletePlanMutation.mutate(planToEdit.id);
  };
  
  // Handler para alternar status ativo/inativo
  const handleTogglePlanActive = (plan: SubscriptionPlan) => {
    const action = plan.isActive ? "desativar" : "ativar";
    if (window.confirm(`Deseja ${action} o plano ${plan.name}?`)) {
      togglePlanActiveMutation.mutate(plan.id);
    }
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
              Visualize, adicione, edite e remova dados do banco de dados. Gerencie todas as tabelas do sistema.
            </p>
            <div className="flex flex-col space-y-2">
              <Button 
                variant="outline" 
                className="text-primary border-primary"
                onClick={() => window.location.href = "/admin/database"}
              >
                Gerenciar Banco de Dados
              </Button>
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
            </div>
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
                  name="email"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Email</FormLabel>
                      <FormControl>
                        <Input type="email" placeholder="email@exemplo.com" {...field} />
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
        {/* Configurações do Sistema */}
        <SystemSettings />
        
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
                    name="email"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Email</FormLabel>
                        <FormControl>
                          <Input type="email" placeholder="email@exemplo.com" {...field} />
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
                    <TableHead>Email</TableHead>
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
                        <TableCell>{user.email}</TableCell>
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
                                onClick={() => startImpersonation(user.id)}
                                disabled={user.id === 1} // Impedir simulação do admin principal
                                className="text-blue-600"
                              >
                                <UserCheck className="h-4 w-4 mr-2" />
                                Simular usuário
                              </DropdownMenuItem>
                              
                              <DropdownMenuSeparator />
                              
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
                      <TableCell colSpan={8} className="text-center py-4">
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
        <DialogContent className="sm:max-w-[700px]">
          <DialogHeader>
            <DialogTitle>Gerenciar Planos de Assinatura</DialogTitle>
            <DialogDescription>
              Visualize e edite os planos de assinatura disponíveis no sistema.
            </DialogDescription>
          </DialogHeader>
          <div className="py-4">
            <div className="flex justify-end mb-4">
              <Button 
                onClick={handleOpenNewPlanDialog}
                className="flex items-center"
              >
                <PlusCircle className="h-4 w-4 mr-2" />
                Novo Plano
              </Button>
            </div>
            
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
                        <DropdownMenu>
                          <DropdownMenuTrigger asChild>
                            <Button variant="ghost" size="sm">
                              <MoreVertical className="h-4 w-4" />
                            </Button>
                          </DropdownMenuTrigger>
                          <DropdownMenuContent align="end">
                            <DropdownMenuItem onClick={() => handleEditPlanPrice(plan)}>
                              <Edit className="h-4 w-4 mr-2" />
                              Editar Preço
                            </DropdownMenuItem>
                            
                            <DropdownMenuItem onClick={() => handleEditFullPlan(plan)}>
                              <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="mr-2"><path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"></path><path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"></path></svg>
                              Editar Plano
                            </DropdownMenuItem>
                            
                            <DropdownMenuItem onClick={() => handleTogglePlanActive(plan)}>
                              {plan.isActive ? (
                                <>
                                  <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="mr-2"><path d="M18.36 6.64A9 9 0 0 1 20.77 15"></path><path d="M6.16 6.16a9 9 0 1 0 12.68 12.68"></path><path d="M12 2v4"></path><path d="M2 12h4"></path><path d="M12 18v4"></path><path d="M18 12h4"></path></svg>
                                  Desativar
                                </>
                              ) : (
                                <>
                                  <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="mr-2"><path d="M18.36 6.64a9 9 0 1 1-12.73 0"></path><line x1="12" y1="2" x2="12" y2="12"></line></svg>
                                  Ativar
                                </>
                              )}
                            </DropdownMenuItem>
                            
                            <DropdownMenuSeparator />
                            
                            <DropdownMenuItem 
                              onClick={() => handleDeletePlanDialog(plan)}
                              className="text-red-600"
                            >
                              <Trash2 className="h-4 w-4 mr-2" />
                              Excluir
                            </DropdownMenuItem>
                          </DropdownMenuContent>
                        </DropdownMenu>
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
      
      {/* Diálogo para criar novo plano */}
      <Dialog open={isNewPlanDialogOpen} onOpenChange={setIsNewPlanDialogOpen}>
        <DialogContent className="sm:max-w-[500px]">
          <DialogHeader>
            <DialogTitle>Criar Novo Plano</DialogTitle>
            <DialogDescription>
              Adicione um novo plano de assinatura ao sistema.
            </DialogDescription>
          </DialogHeader>
          <div className="py-4 space-y-4">
            <div className="space-y-2">
              <Label htmlFor="name">Nome do Plano</Label>
              <Input
                id="name"
                placeholder="Ex: Mensal, Trimestral, Anual"
                value={newPlan.name}
                onChange={(e) => setNewPlan({...newPlan, name: e.target.value})}
              />
            </div>
            
            <div className="space-y-2">
              <Label htmlFor="description">Descrição (opcional)</Label>
              <Input
                id="description"
                placeholder="Descrição do plano"
                value={newPlan.description}
                onChange={(e) => setNewPlan({...newPlan, description: e.target.value})}
              />
            </div>
            
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="durationMonths">Duração (meses)</Label>
                <Input
                  id="durationMonths"
                  type="number"
                  min="1"
                  placeholder="Ex: 1, 3, 12"
                  value={newPlan.durationMonths}
                  onChange={(e) => setNewPlan({...newPlan, durationMonths: e.target.value})}
                />
              </div>
              
              <div className="space-y-2">
                <Label htmlFor="price">Preço (R$)</Label>
                <div className="relative">
                  <span className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-500">R$</span>
                  <Input
                    id="price"
                    type="number"
                    step="0.01"
                    min="0"
                    placeholder="0.00"
                    className="pl-9"
                    value={newPlan.price}
                    onChange={(e) => setNewPlan({...newPlan, price: e.target.value})}
                  />
                </div>
              </div>
            </div>
            
            <div className="space-y-2">
              <Label htmlFor="accountType">Tipo de Conta</Label>
              <select
                id="accountType"
                value={newPlan.accountType}
                onChange={(e) => setNewPlan({...newPlan, accountType: e.target.value})}
                className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-primary focus:border-transparent"
              >
                <option value="individual">Individual</option>
                <option value="company">Empresa</option>
              </select>
            </div>
            
            <div className="flex items-center space-x-2">
              <input
                type="checkbox"
                id="isActive"
                checked={newPlan.isActive}
                onChange={(e) => setNewPlan({...newPlan, isActive: e.target.checked})}
                className="h-4 w-4 rounded border-gray-300 text-primary focus:ring-primary"
              />
              <Label htmlFor="isActive" className="text-sm font-normal">Plano ativo para compra</Label>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setIsNewPlanDialogOpen(false)}>
              Cancelar
            </Button>
            <Button 
              type="submit" 
              onClick={handleCreatePlan}
              disabled={createPlanMutation.isPending}
            >
              {createPlanMutation.isPending ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  Criando...
                </>
              ) : "Criar Plano"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
      
      {/* Diálogo para edição completa do plano */}
      <Dialog open={isEditFullPlanDialogOpen} onOpenChange={setIsEditFullPlanDialogOpen}>
        <DialogContent className="sm:max-w-[500px]">
          <DialogHeader>
            <DialogTitle>Editar Plano</DialogTitle>
            <DialogDescription>
              Atualize as informações do plano de assinatura.
            </DialogDescription>
          </DialogHeader>
          <div className="py-4 space-y-4">
            <div className="space-y-2">
              <Label htmlFor="edit-name">Nome do Plano</Label>
              <Input
                id="edit-name"
                placeholder="Ex: Mensal, Trimestral, Anual"
                value={editedPlan.name}
                onChange={(e) => setEditedPlan({...editedPlan, name: e.target.value})}
              />
            </div>
            
            <div className="space-y-2">
              <Label htmlFor="edit-description">Descrição (opcional)</Label>
              <Input
                id="edit-description"
                placeholder="Descrição do plano"
                value={editedPlan.description}
                onChange={(e) => setEditedPlan({...editedPlan, description: e.target.value})}
              />
            </div>
            
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="edit-durationMonths">Duração (meses)</Label>
                <Input
                  id="edit-durationMonths"
                  type="number"
                  min="1"
                  placeholder="Ex: 1, 3, 12"
                  value={editedPlan.durationMonths}
                  onChange={(e) => setEditedPlan({...editedPlan, durationMonths: e.target.value})}
                />
              </div>
              
              <div className="space-y-2">
                <Label htmlFor="edit-price">Preço (R$)</Label>
                <div className="relative">
                  <span className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-500">R$</span>
                  <Input
                    id="edit-price"
                    type="number"
                    step="0.01"
                    min="0"
                    placeholder="0.00"
                    className="pl-9"
                    value={editedPlan.price}
                    onChange={(e) => setEditedPlan({...editedPlan, price: e.target.value})}
                  />
                </div>
              </div>
            </div>
            
            <div className="space-y-2">
              <Label htmlFor="edit-accountType">Tipo de Conta</Label>
              <select
                id="edit-accountType"
                value={editedPlan.accountType}
                onChange={(e) => setEditedPlan({...editedPlan, accountType: e.target.value})}
                className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-primary focus:border-transparent"
              >
                <option value="individual">Individual</option>
                <option value="company">Empresa</option>
              </select>
            </div>
            
            <div className="flex items-center space-x-2">
              <input
                type="checkbox"
                id="edit-isActive"
                checked={editedPlan.isActive}
                onChange={(e) => setEditedPlan({...editedPlan, isActive: e.target.checked})}
                className="h-4 w-4 rounded border-gray-300 text-primary focus:ring-primary"
              />
              <Label htmlFor="edit-isActive" className="text-sm font-normal">Plano ativo para compra</Label>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setIsEditFullPlanDialogOpen(false)}>
              Cancelar
            </Button>
            <Button 
              type="submit" 
              onClick={handleSaveEditedPlan}
              disabled={updateFullPlanMutation.isPending}
            >
              {updateFullPlanMutation.isPending ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  Salvando...
                </>
              ) : "Salvar Alterações"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
      
      {/* Diálogo de confirmação de exclusão */}
      <AlertDialog open={isDeletePlanDialogOpen} onOpenChange={setIsDeletePlanDialogOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Excluir Plano</AlertDialogTitle>
            <AlertDialogDescription>
              Tem certeza que deseja excluir o plano "{planToEdit?.name}"? Esta ação não pode ser desfeita.
              <br /><br />
              <strong>Nota:</strong> Planos que possuem transações associadas não podem ser excluídos.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction
              onClick={handleConfirmDeletePlan}
              className="bg-red-600 hover:bg-red-700"
              disabled={deletePlanMutation.isPending}
            >
              {deletePlanMutation.isPending ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  Excluindo...
                </>
              ) : "Excluir"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}