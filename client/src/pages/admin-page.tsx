import React, { useState } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { zodResolver } from "@hookform/resolvers/zod";
import { useForm } from "react-hook-form";
import { z } from "zod";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import { Loader2, PlusCircle } from "lucide-react";
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

  return (
    <div className="container mx-auto px-4 py-8">
      <h1 className="text-3xl font-bold mb-8">Administração</h1>

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
                          <div className="flex justify-end gap-2">
                            <Button 
                              variant="outline" 
                              size="sm"
                              onClick={() => handleEditUser(user)}
                            >
                              <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="mr-1"><path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"></path><path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"></path></svg>
                              Editar
                            </Button>
                            <Button 
                              variant={user.isActive ? "destructive" : "outline"} 
                              size="sm"
                              onClick={() => handleToggleUserActive(user)}
                              disabled={user.id === 1} // Impedir bloqueio do admin principal
                            >
                              {user.isActive ? (
                                <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="mr-1"><circle cx="12" cy="12" r="10"></circle><path d="m4.9 4.9 14.2 14.2"></path></svg>
                              ) : (
                                <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="mr-1"><path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10"></path></svg>
                              )}
                              {user.isActive ? "Bloquear" : "Ativar"}
                            </Button>
                            <Button 
                              variant="destructive" 
                              size="sm"
                              onClick={() => handleDeleteUser(user.id)}
                              disabled={user.id === 1} // Impedir exclusão do admin principal
                            >
                              <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="mr-1"><polyline points="3 6 5 6 21 6"></polyline><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"></path><line x1="10" y1="11" x2="10" y2="17"></line><line x1="14" y1="11" x2="14" y2="17"></line></svg>
                              Excluir
                            </Button>
                          </div>
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
    </div>
  );
}