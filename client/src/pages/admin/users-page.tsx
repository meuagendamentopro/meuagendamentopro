import React, { useState } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { zodResolver } from "@hookform/resolvers/zod";
import { useForm } from "react-hook-form";
import { z } from "zod";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Form, FormControl, FormDescription, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import { Loader2, PlusCircle, MoreVertical, Edit, Trash2, Shield, ShieldOff, Calendar, Clock } from "lucide-react";
import { queryClient, apiRequest } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import { Badge } from "@/components/ui/badge";
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
import { format, addMonths, parseISO, isBefore } from "date-fns";
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
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";

// Definição do schema do formulário
const userFormSchema = z.object({
  name: z.string().min(3, "Nome deve ter pelo menos 3 caracteres"),
  username: z.string().min(3, "Nome de usuário deve ter pelo menos 3 caracteres"),
  email: z.string().email("Email inválido"),
  password: z.string().min(6, "Senha deve ter pelo menos 6 caracteres"),
  confirmPassword: z.string(),
  role: z.enum(["admin", "provider"]),
}).refine(data => data.password === data.confirmPassword, {
  message: "As senhas não coincidem",
  path: ["confirmPassword"],
});

type UserFormValues = z.infer<typeof userFormSchema>;

// Schema para gerenciar assinatura
const subscriptionFormSchema = z.object({
  method: z.enum(['extension', 'specific_date']).default('extension'),
  extensionMonths: z.coerce.number().min(1, "Mínimo de 1 mês").max(36, "Máximo de 36 meses").optional(),
  specificDate: z.string().optional(), // Data específica no formato yyyy-MM-dd
  neverExpires: z.boolean().optional(),
}).refine((data) => {
  // Se o método for extension, extensionMonths é obrigatório
  if (data.method === 'extension' && !data.neverExpires) {
    return !!data.extensionMonths;
  }
  // Se o método for specific_date, specificDate é obrigatório
  if (data.method === 'specific_date' && !data.neverExpires) {
    return !!data.specificDate;
  }
  return true;
}, {
  message: "Informe os meses de extensão ou uma data específica",
  path: ['extensionMonths'],
});

type SubscriptionFormValues = z.infer<typeof subscriptionFormSchema>;

interface User {
  id: number;
  name: string;
  username: string;
  email: string;
  role: string;
  isActive: boolean;
  createdAt: string;
  subscriptionExpiry: string | null;
  neverExpires: boolean;
}

// Schema para edição de usuário (sem exigir senha)
const editUserFormSchema = z.object({
  name: z.string().min(3, "Nome deve ter pelo menos 3 caracteres"),
  username: z.string().min(3, "Nome de usuário deve ter pelo menos 3 caracteres"),
  email: z.string().email("Email inválido"),
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

export default function UsersPage() {
  const { toast } = useToast();
  const [isModalOpen, setIsModalOpen] = useState(false);
  
  // Estados para diálogos e ações
  const [isEditDialogOpen, setIsEditDialogOpen] = useState(false);
  const [isDeleteDialogOpen, setIsDeleteDialogOpen] = useState(false);
  const [isToggleActiveDialogOpen, setIsToggleActiveDialogOpen] = useState(false);
  const [isSubscriptionDialogOpen, setIsSubscriptionDialogOpen] = useState(false);
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

  // Formulário de assinatura
  const subscriptionForm = useForm<SubscriptionFormValues>({
    resolver: zodResolver(subscriptionFormSchema),
    defaultValues: {
      extensionMonths: 3,
      neverExpires: false,
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
      setIsModalOpen(false);
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
  
  // Mutação para gerenciar assinatura
  const manageSubscriptionMutation = useMutation({
    mutationFn: async (data: { userId: number, subscriptionData: SubscriptionFormValues }) => {
      const res = await apiRequest(
        "PATCH", 
        `/api/admin/users/${data.userId}/subscription`, 
        data.subscriptionData
      );
      if (!res.ok) {
        const errorData = await res.json();
        throw new Error(errorData.error || "Falha ao atualizar assinatura");
      }
      return res.json();
    },
    onSuccess: (data) => {
      toast({
        title: "Assinatura atualizada",
        description: data.message || "A assinatura do usuário foi atualizada com sucesso",
      });
      setIsSubscriptionDialogOpen(false);
      queryClient.invalidateQueries({ queryKey: ["/api/admin/users"] });
    },
    onError: (error: Error) => {
      toast({
        title: "Erro ao atualizar assinatura",
        description: error.message,
        variant: "destructive",
      });
    }
  });
  
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
        email: selectedUser.email || "",
        password: "",
        confirmPassword: "",
        role: selectedUser.role as "admin" | "provider",
      });
      
      // Configurar formulário de assinatura baseado no usuário selecionado
      subscriptionForm.reset({
        extensionMonths: 3,
        neverExpires: selectedUser.neverExpires,
      });
    }
  }, [selectedUser, editForm, subscriptionForm]);
  
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
    if (data.email) updateData.email = data.email;
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
  
  // Handler para gerenciar assinatura
  const handleManageSubscription = (user: User) => {
    setSelectedUser(user);
    setIsSubscriptionDialogOpen(true);
  };
  
  // Handler para submeter gerenciamento de assinatura
  const handleSubscriptionSubmit = (data: SubscriptionFormValues) => {
    if (!selectedUser) {
      toast({
        title: "Erro",
        description: "Nenhum usuário selecionado",
        variant: "destructive",
      });
      return;
    }
    
    console.log("Enviando dados de assinatura:", {
      userId: selectedUser.id,
      data: data
    });
    
    manageSubscriptionMutation.mutate({
      userId: selectedUser.id,
      subscriptionData: data
    });
  };
  
  // Função para verificar se a assinatura está expirada
  const isSubscriptionExpired = (user: User) => {
    if (user.neverExpires) return false;
    if (!user.subscriptionExpiry) return true;
    
    try {
      const expiryDate = parseISO(user.subscriptionExpiry);
      return isBefore(expiryDate, new Date());
    } catch (e) {
      return true;
    }
  };
  
  // Função para formatação de data de expiração
  const formatExpiryDate = (dateString: string | null) => {
    if (!dateString) return "Não definida";
    try {
      const date = parseISO(dateString);
      return format(date, "dd/MM/yyyy", { locale: ptBR });
    } catch (e) {
      return "Data inválida";
    }
  };

  // Navegar de volta para a página de administração
  const goBack = () => {
    window.location.href = "/admin";
  };

  return (
    <div className="container mx-auto px-4 py-8">
      <div className="flex items-center mb-8">
        <Button variant="outline" onClick={goBack} className="mr-4">
          Voltar
        </Button>
        <h1 className="text-3xl font-bold">Gerenciamento de Usuários</h1>
      </div>

      {/* Botão para adicionar novo usuário */}
      <div className="mb-8">
        <Button onClick={() => setIsModalOpen(true)}>
          <PlusCircle className="mr-2 h-4 w-4" />
          Novo Usuário
        </Button>
      </div>

      {/* Lista de usuários */}
      <Card>
        <CardHeader>
          <CardTitle>Usuários</CardTitle>
          <CardDescription>Gerenciamento de usuários e assinaturas do sistema</CardDescription>
        </CardHeader>
        <CardContent>
          {isLoadingUsers ? (
            <div className="flex justify-center p-8">
              <Loader2 className="h-8 w-8 animate-spin text-primary" />
            </div>
          ) : (
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Nome</TableHead>
                    <TableHead>Usuário</TableHead>
                    <TableHead>Email</TableHead>
                    <TableHead>Tipo</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead>Assinatura</TableHead>
                    <TableHead>Criado em</TableHead>
                    <TableHead className="text-right">Ações</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {users && users.length > 0 ? (
                    users.map((user) => (
                      <TableRow key={user.id}>
                        <TableCell className="font-medium">{user.name}</TableCell>
                        <TableCell>{user.username}</TableCell>
                        <TableCell>{user.email || "-"}</TableCell>
                        <TableCell>
                          <Badge variant={user.role === "admin" ? "secondary" : "default"}>
                            {user.role === "admin" ? "Admin" : "Provedor"}
                          </Badge>
                        </TableCell>
                        <TableCell>
                          <Badge variant={user.isActive ? "success" : "destructive"}>
                            {user.isActive ? "Ativo" : "Bloqueado"}
                          </Badge>
                        </TableCell>
                        <TableCell>
                          {user.neverExpires ? (
                            <Badge variant="secondary">Sem expiração</Badge>
                          ) : (
                            <Popover>
                              <PopoverTrigger asChild>
                                <Button 
                                  variant="ghost" 
                                  className={isSubscriptionExpired(user) ? "text-red-500" : ""}
                                >
                                  <Calendar className="h-4 w-4 mr-1" />
                                  {formatExpiryDate(user.subscriptionExpiry)}
                                </Button>
                              </PopoverTrigger>
                              <PopoverContent className="w-80">
                                <div className="space-y-2">
                                  <h4 className="font-medium">Detalhes da Assinatura</h4>
                                  <div className="text-sm">
                                    <p><strong>Usuário:</strong> {user.name}</p>
                                    <p><strong>Expira em:</strong> {formatExpiryDate(user.subscriptionExpiry)}</p>
                                    <p><strong>Status:</strong> {
                                      isSubscriptionExpired(user) 
                                        ? "Expirada" 
                                        : "Ativa"
                                    }</p>
                                  </div>
                                  <Button 
                                    className="w-full mt-2" 
                                    onClick={() => handleManageSubscription(user)}
                                  >
                                    Gerenciar Assinatura
                                  </Button>
                                </div>
                              </PopoverContent>
                            </Popover>
                          )}
                        </TableCell>
                        <TableCell>
                          {user.createdAt ? format(new Date(user.createdAt), "dd/MM/yyyy", { locale: ptBR }) : "-"}
                        </TableCell>
                        <TableCell className="text-right">
                          <DropdownMenu>
                            <DropdownMenuTrigger asChild>
                              <Button variant="ghost" className="h-8 w-8 p-0">
                                <span className="sr-only">Abrir menu</span>
                                <MoreVertical className="h-4 w-4" />
                              </Button>
                            </DropdownMenuTrigger>
                            <DropdownMenuContent align="end">
                              <DropdownMenuItem onClick={() => handleEditUser(user)}>
                                <Edit className="mr-2 h-4 w-4" />
                                Editar
                              </DropdownMenuItem>
                              <DropdownMenuItem onClick={() => handleManageSubscription(user)}>
                                <Clock className="mr-2 h-4 w-4" />
                                Gerenciar Assinatura
                              </DropdownMenuItem>
                              <DropdownMenuSeparator />
                              <DropdownMenuItem onClick={() => handleToggleUserActive(user)}>
                                {user.isActive ? (
                                  <>
                                    <ShieldOff className="mr-2 h-4 w-4" />
                                    Bloquear
                                  </>
                                ) : (
                                  <>
                                    <Shield className="mr-2 h-4 w-4" />
                                    Ativar
                                  </>
                                )}
                              </DropdownMenuItem>
                              <DropdownMenuSeparator />
                              <DropdownMenuItem 
                                className="text-red-600"
                                onClick={() => handleDeleteUser(user.id)}
                              >
                                <Trash2 className="mr-2 h-4 w-4" />
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
            </div>
          )}
        </CardContent>
      </Card>

      {/* Modal para criar usuário */}
      <Dialog open={isModalOpen} onOpenChange={setIsModalOpen}>
        <DialogContent className="sm:max-w-[500px]">
          <DialogHeader>
            <DialogTitle>Criar Novo Usuário</DialogTitle>
            <DialogDescription>
              Preencha os dados abaixo para criar um novo usuário.
            </DialogDescription>
          </DialogHeader>
          <Form {...form}>
            <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
              <div className="grid grid-cols-1 gap-4">
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
                        <Input placeholder="Nome de usuário para login" {...field} />
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
                        <Input type="email" placeholder="Email do usuário" {...field} />
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

              <DialogFooter>
                <Button
                  type="submit"
                  disabled={createUserMutation.isPending}
                >
                  {createUserMutation.isPending ? (
                    <>
                      <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                      Criando...
                    </>
                  ) : (
                    "Criar Usuário"
                  )}
                </Button>
              </DialogFooter>
            </form>
          </Form>
        </DialogContent>
      </Dialog>

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
                        <Input type="email" placeholder="Email do usuário" {...field} />
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
                  ) : null}
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
            <AlertDialogTitle>Excluir Usuário</AlertDialogTitle>
            <AlertDialogDescription>
              Esta ação não pode ser desfeita. Isso excluirá permanentemente o usuário e todos os dados associados.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction 
              onClick={() => userToDeleteId && deleteUserMutation.mutate(userToDeleteId)}
              className="bg-red-600 hover:bg-red-700"
            >
              {deleteUserMutation.isPending ? (
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
              ) : null}
              Excluir
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
      
      {/* Diálogo de gerenciamento de assinatura */}
      <Dialog open={isSubscriptionDialogOpen} onOpenChange={setIsSubscriptionDialogOpen}>
        <DialogContent className="sm:max-w-[500px]">
          <DialogHeader>
            <DialogTitle>Gerenciar Assinatura</DialogTitle>
            <DialogDescription>
              {selectedUser ? `Usuário: ${selectedUser.name}` : "Carregando..."}
            </DialogDescription>
          </DialogHeader>
          
          {selectedUser && (
            <div className="mb-4">
              <div className="grid grid-cols-2 gap-2 mb-2 text-sm">
                <div className="font-semibold">Status atual:</div>
                <div>
                  {selectedUser.neverExpires 
                    ? "Sem expiração" 
                    : (isSubscriptionExpired(selectedUser) 
                        ? "Expirada" 
                        : `Válida até ${formatExpiryDate(selectedUser.subscriptionExpiry)}`
                      )
                  }
                </div>
              </div>
            </div>
          )}
          
          <Form {...subscriptionForm}>
            <form onSubmit={subscriptionForm.handleSubmit(handleSubscriptionSubmit)} className="space-y-4">
              <div className="grid grid-cols-1 gap-4">
                <FormField
                  control={subscriptionForm.control}
                  name="neverExpires"
                  render={({ field }) => (
                    <FormItem className="flex flex-row items-center justify-between rounded-lg border p-4">
                      <div className="space-y-0.5">
                        <FormLabel className="text-base">Assinatura sem expiração</FormLabel>
                        <p className="text-sm text-muted-foreground">
                          Quando ativada, a assinatura nunca expira (apenas para administradores)
                        </p>
                      </div>
                      <FormControl>
                        <input
                          type="checkbox"
                          checked={field.value}
                          onChange={field.onChange}
                          className="accent-primary h-4 w-4"
                        />
                      </FormControl>
                    </FormItem>
                  )}
                />
                
                {!subscriptionForm.watch("neverExpires") && (
                  <FormField
                    control={subscriptionForm.control}
                    name="extensionMonths"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Estender assinatura por (meses)</FormLabel>
                        <FormControl>
                          <Input type="number" min={1} max={36} {...field} />
                        </FormControl>
                        <p className="text-sm text-muted-foreground">
                          A assinatura será estendida pelo número de meses especificado a partir de hoje 
                          ou da data de expiração atual, o que for maior.
                        </p>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                )}
              </div>

              <DialogFooter>
                <Button
                  type="submit"
                  disabled={manageSubscriptionMutation.isPending}
                >
                  {manageSubscriptionMutation.isPending ? (
                    <>
                      <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                      Atualizando...
                    </>
                  ) : (
                    "Atualizar Assinatura"
                  )}
                </Button>
              </DialogFooter>
            </form>
          </Form>
        </DialogContent>
      </Dialog>
    </div>
  );
}