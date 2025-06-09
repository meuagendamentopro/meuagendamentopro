import React, { useState } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { zodResolver } from "@hookform/resolvers/zod";
import { useForm } from "react-hook-form";
import { z } from "zod";
import { Textarea } from "@/components/ui/textarea";
import { Checkbox } from "@/components/ui/checkbox";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { apiRequest, queryClient } from "@/lib/queryClient";
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
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
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
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage, FormDescription } from "@/components/ui/form";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";

export default function DatabaseAdminPage() {
  const { toast } = useToast();
  const [activeTab, setActiveTab] = useState("users");

  return (
    <div className="container mx-auto py-8">
      <h1 className="text-3xl font-bold mb-6">Administração do Banco de Dados</h1>
      
      <Tabs defaultValue="users" onValueChange={setActiveTab}>
        <TabsList className="grid grid-cols-7 mb-4">
          <TabsTrigger value="users">Usuários</TabsTrigger>
          <TabsTrigger value="providers">Prestadores</TabsTrigger>
          <TabsTrigger value="clients">Clientes</TabsTrigger>
          <TabsTrigger value="services">Serviços</TabsTrigger>
          <TabsTrigger value="appointments">Agendamentos</TabsTrigger>
          <TabsTrigger value="subscriptions">Assinaturas</TabsTrigger>
          <TabsTrigger value="notifications">Notificações</TabsTrigger>
        </TabsList>
        
        <TabsContent value="users">
          <UsersTable />
        </TabsContent>
        
        <TabsContent value="providers">
          <ProvidersTable />
        </TabsContent>
        
        <TabsContent value="clients">
          <ClientsTable />
        </TabsContent>
        
        <TabsContent value="services">
          <ServicesTable />
        </TabsContent>
        
        <TabsContent value="appointments">
          <AppointmentsTable />
        </TabsContent>
        
        <TabsContent value="subscriptions" className="p-4">
          <div className="flex flex-col gap-4">
            <h2 className="text-2xl font-bold">Assinaturas</h2>
            <Tabs defaultValue="plans">
              <TabsList>
                <TabsTrigger value="plans">Planos</TabsTrigger>
                <TabsTrigger value="transactions">Transações</TabsTrigger>
              </TabsList>
              <TabsContent value="plans" className="py-4">
                <SubscriptionPlansTable />
              </TabsContent>
              <TabsContent value="transactions" className="py-4">
                <SubscriptionTransactionsTable />
              </TabsContent>
            </Tabs>
          </div>
        </TabsContent>
        
        <TabsContent value="notifications">
          <NotificationsTable />
        </TabsContent>
      </Tabs>
    </div>
  );
}

// Placeholder para os componentes de tabela
function UsersTable() {
  const { toast } = useToast();
  const [isAddDialogOpen, setIsAddDialogOpen] = useState(false);
  const [isEditDialogOpen, setIsEditDialogOpen] = useState(false);
  const [isDeleteDialogOpen, setIsDeleteDialogOpen] = useState(false);
  const [selectedUser, setSelectedUser] = useState<any>(null);

  // Consulta para buscar usuários
  const { data: users, isLoading, refetch } = useQuery<any[]>({
    queryKey: ["/api/admin/database/users"],
    queryFn: async () => {
      const res = await apiRequest("GET", "/api/admin/database/users");
      if (!res.ok) {
        throw new Error("Falha ao carregar usuários");
      }
      return res.json();
    },
  });

  // Função para adicionar usuário
  const addUser = async (userData: any) => {
    try {
      const res = await apiRequest("POST", "/api/admin/database/users", userData);
      if (!res.ok) {
        const errorData = await res.json();
        throw new Error(errorData.error || "Falha ao adicionar usuário");
      }
      toast({
        title: "Usuário adicionado",
        description: "O usuário foi adicionado com sucesso",
      });
      refetch();
      setIsAddDialogOpen(false);
    } catch (error: any) {
      toast({
        title: "Erro ao adicionar usuário",
        description: error.message,
        variant: "destructive",
      });
    }
  };

  // Função para editar usuário
  const editUser = async (userData: any) => {
    try {
      const res = await apiRequest("PUT", `/api/admin/database/users/${selectedUser.id}`, userData);
      if (!res.ok) {
        const errorData = await res.json();
        throw new Error(errorData.error || "Falha ao editar usuário");
      }
      toast({
        title: "Usuário atualizado",
        description: "O usuário foi atualizado com sucesso",
      });
      refetch();
      setIsEditDialogOpen(false);
    } catch (error: any) {
      toast({
        title: "Erro ao editar usuário",
        description: error.message,
        variant: "destructive",
      });
    }
  };

  // Função para excluir usuário
  const deleteUser = async () => {
    try {
      const res = await apiRequest("DELETE", `/api/admin/database/users/${selectedUser.id}`);
      if (!res.ok) {
        const errorData = await res.json();
        throw new Error(errorData.error || "Falha ao excluir usuário");
      }
      toast({
        title: "Usuário excluído",
        description: "O usuário foi excluído com sucesso",
      });
      refetch();
      setIsDeleteDialogOpen(false);
    } catch (error: any) {
      toast({
        title: "Erro ao excluir usuário",
        description: error.message,
        variant: "destructive",
      });
    }
  };

  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between">
        <CardTitle>Usuários</CardTitle>
        <Button onClick={() => setIsAddDialogOpen(true)}>Adicionar Usuário</Button>
      </CardHeader>
      <CardContent>
        {isLoading ? (
          <div className="flex justify-center p-4">Carregando...</div>
        ) : (
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>ID</TableHead>
                <TableHead>Nome</TableHead>
                <TableHead>Username</TableHead>
                <TableHead>Email</TableHead>
                <TableHead>Função</TableHead>
                <TableHead>Ativo</TableHead>
                <TableHead>Criado em</TableHead>
                <TableHead>Ações</TableHead>
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
                    <TableCell>{user.role}</TableCell>
                    <TableCell>{user.isActive ? "Sim" : "Não"}</TableCell>
                    <TableCell>{new Date(user.createdAt).toLocaleDateString()}</TableCell>
                    <TableCell>
                      <div className="flex space-x-2">
                        <Button 
                          variant="outline" 
                          size="sm"
                          onClick={() => {
                            setSelectedUser(user);
                            setIsEditDialogOpen(true);
                          }}
                        >
                          Editar
                        </Button>
                        <Button 
                          variant="destructive" 
                          size="sm"
                          onClick={() => {
                            setSelectedUser(user);
                            setIsDeleteDialogOpen(true);
                          }}
                        >
                          Excluir
                        </Button>
                      </div>
                    </TableCell>
                  </TableRow>
                ))
              ) : (
                <TableRow>
                  <TableCell colSpan={8} className="text-center">Nenhum usuário encontrado</TableCell>
                </TableRow>
              )}
            </TableBody>
          </Table>
        )}

        {/* Diálogo para adicionar usuário */}
        <Dialog open={isAddDialogOpen} onOpenChange={setIsAddDialogOpen}>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Adicionar Usuário</DialogTitle>
              <DialogDescription>
                Preencha os dados para adicionar um novo usuário.
              </DialogDescription>
            </DialogHeader>
            <UserForm onSubmit={addUser} onCancel={() => setIsAddDialogOpen(false)} />
          </DialogContent>
        </Dialog>

        {/* Diálogo para editar usuário */}
        <Dialog open={isEditDialogOpen} onOpenChange={setIsEditDialogOpen}>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Editar Usuário</DialogTitle>
              <DialogDescription>
                Edite os dados do usuário.
              </DialogDescription>
            </DialogHeader>
            <UserForm 
              initialData={selectedUser} 
              onSubmit={editUser} 
              onCancel={() => setIsEditDialogOpen(false)} 
              isEditing 
            />
          </DialogContent>
        </Dialog>

        {/* Diálogo para confirmar exclusão */}
        <AlertDialog open={isDeleteDialogOpen} onOpenChange={setIsDeleteDialogOpen}>
          <AlertDialogContent>
            <AlertDialogHeader>
              <AlertDialogTitle>Confirmar exclusão</AlertDialogTitle>
              <AlertDialogDescription>
                Tem certeza que deseja excluir o usuário {selectedUser?.name}? Esta ação não pode ser desfeita.
              </AlertDialogDescription>
            </AlertDialogHeader>
            <AlertDialogFooter>
              <AlertDialogCancel>Cancelar</AlertDialogCancel>
              <AlertDialogAction onClick={deleteUser}>Excluir</AlertDialogAction>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>
      </CardContent>
    </Card>
  );
}

// Componente de formulário para usuários
interface UserFormProps {
  initialData?: any;
  onSubmit: (data: any) => void;
  onCancel: () => void;
  isEditing?: boolean;
}

function UserForm({ initialData, onSubmit, onCancel, isEditing = false }: UserFormProps) {
  // Schema para validação do formulário
  const userSchema = z.object({
    name: z.string().min(3, "Nome deve ter pelo menos 3 caracteres"),
    username: z.string().min(3, "Nome de usuário deve ter pelo menos 3 caracteres"),
    email: z.string().email("Email inválido"),
    password: isEditing 
      ? z.string().min(6, "Senha deve ter pelo menos 6 caracteres").optional().or(z.literal(""))
      : z.string().min(6, "Senha deve ter pelo menos 6 caracteres"),
    role: z.enum(["admin", "provider"]),
    isActive: z.boolean().default(true),
  });

  // Configuração do formulário
  const form = useForm({
    resolver: zodResolver(userSchema),
    defaultValues: {
      name: initialData?.name || "",
      username: initialData?.username || "",
      email: initialData?.email || "",
      password: "",
      role: initialData?.role || "provider",
      isActive: initialData?.isActive !== undefined ? initialData.isActive : true,
    },
  });

  // Handler para submit do formulário
  const handleSubmit = (data: any) => {
    // Se estiver editando e a senha estiver vazia, remova-a dos dados
    if (isEditing && !data.password) {
      const { password, ...restData } = data;
      onSubmit(restData);
    } else {
      onSubmit(data);
    }
  };

  return (
    <Form {...form}>
      <form onSubmit={form.handleSubmit(handleSubmit)} className="space-y-4">
        <FormField
          control={form.control}
          name="name"
          render={({ field }) => (
            <FormItem>
              <FormLabel>Nome</FormLabel>
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
              <FormLabel>Nome de usuário</FormLabel>
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
                <Input type="email" placeholder="Email" {...field} />
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
              <FormLabel>{isEditing ? "Nova senha (deixe em branco para manter)" : "Senha"}</FormLabel>
              <FormControl>
                <Input type="password" placeholder="Senha" {...field} />
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
              <FormLabel>Função</FormLabel>
              <Select 
                onValueChange={field.onChange} 
                defaultValue={field.value}
              >
                <FormControl>
                  <SelectTrigger>
                    <SelectValue placeholder="Selecione uma função" />
                  </SelectTrigger>
                </FormControl>
                <SelectContent>
                  <SelectItem value="admin">Administrador</SelectItem>
                  <SelectItem value="provider">Prestador</SelectItem>
                </SelectContent>
              </Select>
              <FormMessage />
            </FormItem>
          )}
        />
        
        <FormField
          control={form.control}
          name="isActive"
          render={({ field }) => (
            <FormItem className="flex flex-row items-start space-x-3 space-y-0 rounded-md border p-4">
              <FormControl>
                <input
                  type="checkbox"
                  checked={field.value}
                  onChange={field.onChange}
                  className="h-4 w-4 rounded border-gray-300 text-primary focus:ring-primary"
                />
              </FormControl>
              <div className="space-y-1 leading-none">
                <FormLabel>Ativo</FormLabel>
              </div>
            </FormItem>
          )}
        />
        
        <DialogFooter>
          <Button type="button" variant="outline" onClick={onCancel}>Cancelar</Button>
          <Button type="submit">{isEditing ? "Salvar alterações" : "Adicionar"}</Button>
        </DialogFooter>
      </form>
    </Form>
  );
}

// Componente de formulário para prestadores
interface ProviderFormProps {
  initialData?: any;
  users: any[];
  onSubmit: (data: any) => void;
  onCancel: () => void;
  isEditing?: boolean;
}

function ProviderForm({ initialData, users, onSubmit, onCancel, isEditing = false }: ProviderFormProps) {
  // Esquema de validação para o formulário
  const formSchema = z.object({
    userId: z.number({
      required_error: "Usuário é obrigatório",
    }),
    name: z.string().min(1, "Nome é obrigatório"),
    email: z.string().email("Email inválido"),
    phone: z.string().optional(),
    bookingLink: z.string().optional(),
    workingHoursStart: z.number().min(0).max(23).default(8),
    workingHoursEnd: z.number().min(0).max(23).default(18),
  });

  // Tipo inferido do esquema
  type FormValues = z.infer<typeof formSchema>;

  // Valores padrão para o formulário
  const defaultValues: Partial<FormValues> = {
    userId: initialData?.userId || undefined,
    name: initialData?.name || "",
    email: initialData?.email || "",
    phone: initialData?.phone || "",
    bookingLink: initialData?.bookingLink || "",
    workingHoursStart: initialData?.workingHoursStart || 8,
    workingHoursEnd: initialData?.workingHoursEnd || 18,
  };

  // Configuração do formulário
  const form = useForm<FormValues>({
    resolver: zodResolver(formSchema),
    defaultValues,
  });

  // Função de envio do formulário
  const handleSubmit = (data: FormValues) => {
    onSubmit(data);
  };

  return (
    <Form {...form}>
      <form onSubmit={form.handleSubmit(handleSubmit)} className="space-y-4">
        <FormField
          control={form.control}
          name="userId"
          render={({ field }) => (
            <FormItem>
              <FormLabel>Usuário</FormLabel>
              <Select
                disabled={isEditing}
                value={field.value?.toString()}
                onValueChange={(value) => field.onChange(parseInt(value))}
              >
                <SelectTrigger>
                  <SelectValue placeholder="Selecione um usuário" />
                </SelectTrigger>
                <SelectContent>
                  {users.map((user) => (
                    <SelectItem key={user.id} value={user.id.toString()}>
                      {user.name} ({user.username})
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <FormMessage />
            </FormItem>
          )}
        />

        <FormField
          control={form.control}
          name="name"
          render={({ field }) => (
            <FormItem>
              <FormLabel>Nome</FormLabel>
              <FormControl>
                <Input placeholder="Nome do prestador" {...field} />
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
                <Input placeholder="Email do prestador" {...field} />
              </FormControl>
              <FormMessage />
            </FormItem>
          )}
        />

        <FormField
          control={form.control}
          name="phone"
          render={({ field }) => (
            <FormItem>
              <FormLabel>Telefone</FormLabel>
              <FormControl>
                <Input placeholder="Telefone do prestador" {...field} />
              </FormControl>
              <FormMessage />
            </FormItem>
          )}
        />

        <FormField
          control={form.control}
          name="bookingLink"
          render={({ field }) => (
            <FormItem>
              <FormLabel>Link de Agendamento</FormLabel>
              <FormControl>
                <Input placeholder="Link de agendamento" {...field} />
              </FormControl>
              <FormMessage />
            </FormItem>
          )}
        />

        <div className="grid grid-cols-2 gap-4">
          <FormField
            control={form.control}
            name="workingHoursStart"
            render={({ field }) => (
              <FormItem>
                <FormLabel>Horário de Início</FormLabel>
                <Select
                  value={field.value?.toString()}
                  onValueChange={(value) => field.onChange(parseInt(value))}
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Hora de início" />
                  </SelectTrigger>
                  <SelectContent>
                    {Array.from({ length: 24 }, (_, i) => (
                      <SelectItem key={i} value={i.toString()}>
                        {i}:00
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                <FormMessage />
              </FormItem>
            )}
          />

          <FormField
            control={form.control}
            name="workingHoursEnd"
            render={({ field }) => (
              <FormItem>
                <FormLabel>Horário de Término</FormLabel>
                <Select
                  value={field.value?.toString()}
                  onValueChange={(value) => field.onChange(parseInt(value))}
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Hora de término" />
                  </SelectTrigger>
                  <SelectContent>
                    {Array.from({ length: 24 }, (_, i) => (
                      <SelectItem key={i} value={i.toString()}>
                        {i}:00
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                <FormMessage />
              </FormItem>
            )}
          />
        </div>

        <DialogFooter>
          <Button type="button" variant="outline" onClick={onCancel}>
            Cancelar
          </Button>
          <Button type="submit">{isEditing ? "Salvar alterações" : "Adicionar"}</Button>
        </DialogFooter>
      </form>
    </Form>
  );
}

function ProvidersTable() {
  const { toast } = useToast();
  const [isAddDialogOpen, setIsAddDialogOpen] = useState(false);
  const [isEditDialogOpen, setIsEditDialogOpen] = useState(false);
  const [isDeleteDialogOpen, setIsDeleteDialogOpen] = useState(false);
  const [selectedProvider, setSelectedProvider] = useState<any>(null);

  // Consulta para buscar prestadores
  const { data: providers, isLoading, refetch } = useQuery<any[]>({
    queryKey: ["/api/admin/database/providers"],
    queryFn: async () => {
      const res = await apiRequest("GET", "/api/admin/database/providers");
      if (!res.ok) {
        throw new Error("Falha ao carregar prestadores");
      }
      return res.json();
    },
  });

  // Consulta para buscar usuários (para associar ao prestador)
  const { data: users } = useQuery<any[]>({
    queryKey: ["/api/admin/database/users"],
    queryFn: async () => {
      const res = await apiRequest("GET", "/api/admin/database/users");
      if (!res.ok) {
        throw new Error("Falha ao carregar usuários");
      }
      return res.json();
    },
  });

  // Função para adicionar prestador
  const addProvider = async (providerData: any) => {
    try {
      const res = await apiRequest("POST", "/api/admin/database/providers", providerData);
      if (!res.ok) {
        const errorData = await res.json();
        throw new Error(errorData.error || "Falha ao adicionar prestador");
      }
      toast({
        title: "Prestador adicionado",
        description: "O prestador foi adicionado com sucesso",
      });
      refetch();
      setIsAddDialogOpen(false);
    } catch (error: any) {
      toast({
        title: "Erro ao adicionar prestador",
        description: error.message,
        variant: "destructive",
      });
    }
  };

  // Função para editar prestador
  const editProvider = async (providerData: any) => {
    try {
      const res = await apiRequest("PUT", `/api/admin/database/providers/${selectedProvider.id}`, providerData);
      if (!res.ok) {
        const errorData = await res.json();
        throw new Error(errorData.error || "Falha ao editar prestador");
      }
      toast({
        title: "Prestador atualizado",
        description: "O prestador foi atualizado com sucesso",
      });
      refetch();
      setIsEditDialogOpen(false);
    } catch (error: any) {
      toast({
        title: "Erro ao atualizar prestador",
        description: error.message,
        variant: "destructive",
      });
    }
  };

  // Função para excluir prestador
  const deleteProvider = async () => {
    try {
      const res = await apiRequest("DELETE", `/api/admin/database/providers/${selectedProvider.id}`);
      if (!res.ok) {
        const errorData = await res.json();
        throw new Error(errorData.error || "Falha ao excluir prestador");
      }
      toast({
        title: "Prestador excluído",
        description: "O prestador foi excluído com sucesso",
      });
      refetch();
      setIsDeleteDialogOpen(false);
    } catch (error: any) {
      toast({
        title: "Erro ao excluir prestador",
        description: error.message,
        variant: "destructive",
      });
    }
  };

  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between">
        <CardTitle>Prestadores</CardTitle>
        <Button onClick={() => setIsAddDialogOpen(true)}>Adicionar Prestador</Button>
      </CardHeader>
      <CardContent>
        {isLoading ? (
          <div className="text-center py-4">Carregando...</div>
        ) : !providers || providers.length === 0 ? (
          <div className="text-center py-4">Nenhum prestador encontrado</div>
        ) : (
          <div className="overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>ID</TableHead>
                  <TableHead>Nome</TableHead>
                  <TableHead>Email</TableHead>
                  <TableHead>Telefone</TableHead>
                  <TableHead>Link de Agendamento</TableHead>
                  <TableHead>Horário de Trabalho</TableHead>
                  <TableHead>Ações</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {providers.map((provider) => (
                  <TableRow key={provider.id}>
                    <TableCell>{provider.id}</TableCell>
                    <TableCell>{provider.name}</TableCell>
                    <TableCell>{provider.email}</TableCell>
                    <TableCell>{provider.phone || "-"}</TableCell>
                    <TableCell>{provider.bookingLink || "-"}</TableCell>
                    <TableCell>{`${provider.workingHoursStart}h - ${provider.workingHoursEnd}h`}</TableCell>
                    <TableCell>
                      <div className="flex space-x-2">
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => {
                            setSelectedProvider(provider);
                            setIsEditDialogOpen(true);
                          }}
                        >
                          Editar
                        </Button>
                        <Button
                          variant="destructive"
                          size="sm"
                          onClick={() => {
                            setSelectedProvider(provider);
                            setIsDeleteDialogOpen(true);
                          }}
                        >
                          Excluir
                        </Button>
                      </div>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        )}
      </CardContent>

      {/* Diálogo para adicionar prestador */}
      <Dialog open={isAddDialogOpen} onOpenChange={setIsAddDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Adicionar Prestador</DialogTitle>
          </DialogHeader>
          <ProviderForm
            users={users || []}
            onSubmit={addProvider}
            onCancel={() => setIsAddDialogOpen(false)}
          />
        </DialogContent>
      </Dialog>

      {/* Diálogo para editar prestador */}
      <Dialog open={isEditDialogOpen} onOpenChange={setIsEditDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Editar Prestador</DialogTitle>
          </DialogHeader>
          <ProviderForm
            initialData={selectedProvider}
            users={users || []}
            onSubmit={editProvider}
            onCancel={() => setIsEditDialogOpen(false)}
            isEditing
          />
        </DialogContent>
      </Dialog>

      {/* Diálogo para confirmar exclusão */}
      <AlertDialog open={isDeleteDialogOpen} onOpenChange={setIsDeleteDialogOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Confirmar exclusão</AlertDialogTitle>
            <AlertDialogDescription>
              Tem certeza que deseja excluir o prestador {selectedProvider?.name}? Esta ação não pode ser desfeita.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction onClick={deleteProvider}>Excluir</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </Card>
  );
}

// Componente de formulário para clientes
interface ClientFormProps {
  initialData?: any;
  onSubmit: (data: any) => void;
  onCancel: () => void;
  isEditing?: boolean;
}

function ClientForm({ initialData, onSubmit, onCancel, isEditing = false }: ClientFormProps) {
  // Esquema de validação para o formulário
  const formSchema = z.object({
    name: z.string().min(1, "Nome é obrigatório"),
    phone: z.string().min(1, "Telefone é obrigatório"),
    email: z.string().email("Email inválido").optional().nullable(),
    notes: z.string().optional().nullable(),
    active: z.boolean().default(true),
    isBlocked: z.boolean().default(false),
  });

  // Tipo inferido do esquema
  type FormValues = z.infer<typeof formSchema>;

  // Valores padrão para o formulário
  const defaultValues: Partial<FormValues> = {
    name: initialData?.name || "",
    phone: initialData?.phone || "",
    email: initialData?.email || "",
    notes: initialData?.notes || "",
    active: initialData?.active !== undefined ? initialData.active : true,
    isBlocked: initialData?.isBlocked !== undefined ? initialData.isBlocked : false,
  };

  // Configuração do formulário
  const form = useForm<FormValues>({
    resolver: zodResolver(formSchema),
    defaultValues,
  });

  // Função de envio do formulário
  const handleSubmit = (data: FormValues) => {
    onSubmit(data);
  };

  return (
    <Form {...form}>
      <form onSubmit={form.handleSubmit(handleSubmit)} className="space-y-4">
        <FormField
          control={form.control}
          name="name"
          render={({ field }) => (
            <FormItem>
              <FormLabel>Nome</FormLabel>
              <FormControl>
                <Input placeholder="Nome do cliente" {...field} />
              </FormControl>
              <FormMessage />
            </FormItem>
          )}
        />

        <FormField
          control={form.control}
          name="phone"
          render={({ field }) => (
            <FormItem>
              <FormLabel>Telefone</FormLabel>
              <FormControl>
                <Input placeholder="Telefone do cliente" {...field} />
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
                <Input placeholder="Email do cliente" {...field} value={field.value || ""} />
              </FormControl>
              <FormMessage />
            </FormItem>
          )}
        />

        <FormField
          control={form.control}
          name="notes"
          render={({ field }) => (
            <FormItem>
              <FormLabel>Observações</FormLabel>
              <FormControl>
                <Textarea placeholder="Observações sobre o cliente" {...field} value={field.value || ""} />
              </FormControl>
              <FormMessage />
            </FormItem>
          )}
        />

        <div className="grid grid-cols-2 gap-4">
          <FormField
            control={form.control}
            name="active"
            render={({ field }) => (
              <FormItem className="flex flex-row items-start space-x-3 space-y-0">
                <FormControl>
                  <Checkbox
                    checked={field.value}
                    onCheckedChange={field.onChange}
                  />
                </FormControl>
                <div className="space-y-1 leading-none">
                  <FormLabel>Ativo</FormLabel>
                  <FormDescription>
                    Cliente está ativo no sistema
                  </FormDescription>
                </div>
              </FormItem>
            )}
          />

          <FormField
            control={form.control}
            name="isBlocked"
            render={({ field }) => (
              <FormItem className="flex flex-row items-start space-x-3 space-y-0">
                <FormControl>
                  <Checkbox
                    checked={field.value}
                    onCheckedChange={field.onChange}
                  />
                </FormControl>
                <div className="space-y-1 leading-none">
                  <FormLabel>Bloqueado</FormLabel>
                  <FormDescription>
                    Bloquear agendamentos deste cliente
                  </FormDescription>
                </div>
              </FormItem>
            )}
          />
        </div>

        <DialogFooter>
          <Button type="button" variant="outline" onClick={onCancel}>
            Cancelar
          </Button>
          <Button type="submit">{isEditing ? "Salvar alterações" : "Adicionar"}</Button>
        </DialogFooter>
      </form>
    </Form>
  );
}

function ClientsTable() {
  const { toast } = useToast();
  const [isAddDialogOpen, setIsAddDialogOpen] = useState(false);
  const [isEditDialogOpen, setIsEditDialogOpen] = useState(false);
  const [isDeleteDialogOpen, setIsDeleteDialogOpen] = useState(false);
  const [selectedClient, setSelectedClient] = useState<any>(null);

  // Consulta para buscar clientes
  const { data: clients, isLoading, refetch } = useQuery<any[]>({
    queryKey: ["/api/admin/database/clients"],
    queryFn: async () => {
      const res = await apiRequest("GET", "/api/admin/database/clients");
      if (!res.ok) {
        throw new Error("Falha ao carregar clientes");
      }
      return res.json();
    },
  });

  // Função para adicionar cliente
  const addClient = async (clientData: any) => {
    try {
      const res = await apiRequest("POST", "/api/admin/database/clients", clientData);
      if (!res.ok) {
        const errorData = await res.json();
        throw new Error(errorData.error || "Falha ao adicionar cliente");
      }
      toast({
        title: "Cliente adicionado",
        description: "O cliente foi adicionado com sucesso",
      });
      refetch();
      setIsAddDialogOpen(false);
    } catch (error: any) {
      toast({
        title: "Erro ao adicionar cliente",
        description: error.message,
        variant: "destructive",
      });
    }
  };

  // Função para editar cliente
  const editClient = async (clientData: any) => {
    try {
      const res = await apiRequest("PUT", `/api/admin/database/clients/${selectedClient.id}`, clientData);
      if (!res.ok) {
        const errorData = await res.json();
        throw new Error(errorData.error || "Falha ao editar cliente");
      }
      toast({
        title: "Cliente atualizado",
        description: "O cliente foi atualizado com sucesso",
      });
      refetch();
      setIsEditDialogOpen(false);
    } catch (error: any) {
      toast({
        title: "Erro ao atualizar cliente",
        description: error.message,
        variant: "destructive",
      });
    }
  };

  // Função para excluir cliente
  const deleteClient = async () => {
    try {
      const res = await apiRequest("DELETE", `/api/admin/database/clients/${selectedClient.id}`);
      if (!res.ok) {
        const errorData = await res.json();
        throw new Error(errorData.error || "Falha ao excluir cliente");
      }
      toast({
        title: "Cliente excluído",
        description: "O cliente foi excluído com sucesso",
      });
      refetch();
      setIsDeleteDialogOpen(false);
    } catch (error: any) {
      toast({
        title: "Erro ao excluir cliente",
        description: error.message,
        variant: "destructive",
      });
    }
  };

  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between">
        <CardTitle>Clientes</CardTitle>
        <Button onClick={() => setIsAddDialogOpen(true)}>Adicionar Cliente</Button>
      </CardHeader>
      <CardContent>
        {isLoading ? (
          <div className="text-center py-4">Carregando...</div>
        ) : !clients || clients.length === 0 ? (
          <div className="text-center py-4">Nenhum cliente encontrado</div>
        ) : (
          <div className="overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>ID</TableHead>
                  <TableHead>Nome</TableHead>
                  <TableHead>Telefone</TableHead>
                  <TableHead>Email</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead>Ações</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {clients.map((client) => (
                  <TableRow key={client.id}>
                    <TableCell>{client.id}</TableCell>
                    <TableCell>{client.name}</TableCell>
                    <TableCell>{client.phone}</TableCell>
                    <TableCell>{client.email || "-"}</TableCell>
                    <TableCell>
                      <div className="flex items-center space-x-2">
                        {client.active ? (
                          <Badge variant="outline" className="bg-green-50 text-green-700 border-green-200">
                            Ativo
                          </Badge>
                        ) : (
                          <Badge variant="outline" className="bg-gray-50 text-gray-700 border-gray-200">
                            Inativo
                          </Badge>
                        )}
                        {client.isBlocked && (
                          <Badge variant="outline" className="bg-red-50 text-red-700 border-red-200">
                            Bloqueado
                          </Badge>
                        )}
                      </div>
                    </TableCell>
                    <TableCell>
                      <div className="flex space-x-2">
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => {
                            setSelectedClient(client);
                            setIsEditDialogOpen(true);
                          }}
                        >
                          Editar
                        </Button>
                        <Button
                          variant="destructive"
                          size="sm"
                          onClick={() => {
                            setSelectedClient(client);
                            setIsDeleteDialogOpen(true);
                          }}
                        >
                          Excluir
                        </Button>
                      </div>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        )}
      </CardContent>

      {/* Diálogo para adicionar cliente */}
      <Dialog open={isAddDialogOpen} onOpenChange={setIsAddDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Adicionar Cliente</DialogTitle>
          </DialogHeader>
          <ClientForm
            onSubmit={addClient}
            onCancel={() => setIsAddDialogOpen(false)}
          />
        </DialogContent>
      </Dialog>

      {/* Diálogo para editar cliente */}
      <Dialog open={isEditDialogOpen} onOpenChange={setIsEditDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Editar Cliente</DialogTitle>
          </DialogHeader>
          <ClientForm
            initialData={selectedClient}
            onSubmit={editClient}
            onCancel={() => setIsEditDialogOpen(false)}
            isEditing
          />
        </DialogContent>
      </Dialog>

      {/* Diálogo para confirmar exclusão */}
      <AlertDialog open={isDeleteDialogOpen} onOpenChange={setIsDeleteDialogOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Confirmar exclusão</AlertDialogTitle>
            <AlertDialogDescription>
              Tem certeza que deseja excluir o cliente {selectedClient?.name}? Esta ação não pode ser desfeita.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction onClick={deleteClient}>Excluir</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </Card>
  );
}

// Componente de formulário para serviços
interface ServiceFormProps {
  initialData?: any;
  providers: any[];
  onSubmit: (data: any) => void;
  onCancel: () => void;
  isEditing?: boolean;
}

function ServiceForm({ initialData, providers, onSubmit, onCancel, isEditing = false }: ServiceFormProps) {
  // Esquema de validação para o formulário
  const formSchema = z.object({
    providerId: z.number({
      required_error: "Prestador é obrigatório",
    }),
    name: z.string().min(1, "Nome é obrigatório"),
    description: z.string().optional().nullable(),
    duration: z.number().min(1, "Duração é obrigatória"),
    price: z.number().min(0, "Preço não pode ser negativo"),
    active: z.boolean().default(true),
  });

  // Tipo inferido do esquema
  type FormValues = z.infer<typeof formSchema>;

  // Valores padrão para o formulário
  const defaultValues: Partial<FormValues> = {
    providerId: initialData?.providerId || undefined,
    name: initialData?.name || "",
    description: initialData?.description || "",
    duration: initialData?.duration || 60,
    price: initialData?.price || 0,
    active: initialData?.active !== undefined ? initialData.active : true,
  };

  // Configuração do formulário
  const form = useForm<FormValues>({
    resolver: zodResolver(formSchema),
    defaultValues,
  });

  // Função de envio do formulário
  const handleSubmit = (data: FormValues) => {
    onSubmit(data);
  };

  return (
    <Form {...form}>
      <form onSubmit={form.handleSubmit(handleSubmit)} className="space-y-4">
        <FormField
          control={form.control}
          name="providerId"
          render={({ field }) => (
            <FormItem>
              <FormLabel>Prestador</FormLabel>
              <Select
                disabled={isEditing}
                value={field.value?.toString()}
                onValueChange={(value) => field.onChange(parseInt(value))}
              >
                <SelectTrigger>
                  <SelectValue placeholder="Selecione um prestador" />
                </SelectTrigger>
                <SelectContent>
                  {providers.map((provider) => (
                    <SelectItem key={provider.id} value={provider.id.toString()}>
                      {provider.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <FormMessage />
            </FormItem>
          )}
        />

        <FormField
          control={form.control}
          name="name"
          render={({ field }) => (
            <FormItem>
              <FormLabel>Nome</FormLabel>
              <FormControl>
                <Input placeholder="Nome do serviço" {...field} />
              </FormControl>
              <FormMessage />
            </FormItem>
          )}
        />

        <FormField
          control={form.control}
          name="description"
          render={({ field }) => (
            <FormItem>
              <FormLabel>Descrição</FormLabel>
              <FormControl>
                <Textarea 
                  placeholder="Descrição do serviço" 
                  {...field} 
                  value={field.value || ""} 
                />
              </FormControl>
              <FormMessage />
            </FormItem>
          )}
        />

        <div className="grid grid-cols-2 gap-4">
          <FormField
            control={form.control}
            name="duration"
            render={({ field }) => (
              <FormItem>
                <FormLabel>Duração (minutos)</FormLabel>
                <FormControl>
                  <Input 
                    type="number" 
                    placeholder="Duração em minutos" 
                    {...field} 
                    onChange={(e) => field.onChange(parseInt(e.target.value) || 0)}
                  />
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />

          <FormField
            control={form.control}
            name="price"
            render={({ field }) => (
              <FormItem>
                <FormLabel>Preço (centavos)</FormLabel>
                <FormControl>
                  <Input 
                    type="number" 
                    placeholder="Preço em centavos" 
                    {...field} 
                    onChange={(e) => field.onChange(parseInt(e.target.value) || 0)}
                  />
                </FormControl>
                <FormDescription>
                  Valor em centavos. Ex: 10000 = R$ 100,00
                </FormDescription>
                <FormMessage />
              </FormItem>
            )}
          />
        </div>

        <FormField
          control={form.control}
          name="active"
          render={({ field }) => (
            <FormItem className="flex flex-row items-start space-x-3 space-y-0">
              <FormControl>
                <Checkbox
                  checked={field.value}
                  onCheckedChange={field.onChange}
                />
              </FormControl>
              <div className="space-y-1 leading-none">
                <FormLabel>Ativo</FormLabel>
                <FormDescription>
                  Serviço está disponível para agendamento
                </FormDescription>
              </div>
            </FormItem>
          )}
        />

        <DialogFooter>
          <Button type="button" variant="outline" onClick={onCancel}>
            Cancelar
          </Button>
          <Button type="submit">{isEditing ? "Salvar alterações" : "Adicionar"}</Button>
        </DialogFooter>
      </form>
    </Form>
  );
}

function ServicesTable() {
  const { toast } = useToast();
  const [isAddDialogOpen, setIsAddDialogOpen] = useState(false);
  const [isEditDialogOpen, setIsEditDialogOpen] = useState(false);
  const [isDeleteDialogOpen, setIsDeleteDialogOpen] = useState(false);
  const [selectedService, setSelectedService] = useState<any>(null);

  // Consulta para buscar serviços
  const { data: services, isLoading, refetch } = useQuery<any[]>({
    queryKey: ["/api/admin/database/services"],
    queryFn: async () => {
      const res = await apiRequest("GET", "/api/admin/database/services");
      if (!res.ok) {
        throw new Error("Falha ao carregar serviços");
      }
      return res.json();
    },
  });

  // Consulta para buscar prestadores (para associar ao serviço)
  const { data: providers } = useQuery<any[]>({
    queryKey: ["/api/admin/database/providers"],
    queryFn: async () => {
      const res = await apiRequest("GET", "/api/admin/database/providers");
      if (!res.ok) {
        throw new Error("Falha ao carregar prestadores");
      }
      return res.json();
    },
  });

  // Função para formatar preço em reais
  const formatPrice = (priceInCents: number) => {
    return new Intl.NumberFormat('pt-BR', {
      style: 'currency',
      currency: 'BRL'
    }).format(priceInCents / 100);
  };

  // Função para formatar duração
  const formatDuration = (minutes: number) => {
    if (minutes < 60) {
      return `${minutes} min`;
    }
    const hours = Math.floor(minutes / 60);
    const remainingMinutes = minutes % 60;
    if (remainingMinutes === 0) {
      return `${hours}h`;
    }
    return `${hours}h ${remainingMinutes}min`;
  };

  // Função para adicionar serviço
  const addService = async (serviceData: any) => {
    try {
      const res = await apiRequest("POST", "/api/admin/database/services", serviceData);
      if (!res.ok) {
        const errorData = await res.json();
        throw new Error(errorData.error || "Falha ao adicionar serviço");
      }
      toast({
        title: "Serviço adicionado",
        description: "O serviço foi adicionado com sucesso",
      });
      refetch();
      setIsAddDialogOpen(false);
    } catch (error: any) {
      toast({
        title: "Erro ao adicionar serviço",
        description: error.message,
        variant: "destructive",
      });
    }
  };

  // Função para editar serviço
  const editService = async (serviceData: any) => {
    try {
      const res = await apiRequest("PUT", `/api/admin/database/services/${selectedService.id}`, serviceData);
      if (!res.ok) {
        const errorData = await res.json();
        throw new Error(errorData.error || "Falha ao editar serviço");
      }
      toast({
        title: "Serviço atualizado",
        description: "O serviço foi atualizado com sucesso",
      });
      refetch();
      setIsEditDialogOpen(false);
    } catch (error: any) {
      toast({
        title: "Erro ao atualizar serviço",
        description: error.message,
        variant: "destructive",
      });
    }
  };

  // Função para excluir serviço
  const deleteService = async () => {
    try {
      const res = await apiRequest("DELETE", `/api/admin/database/services/${selectedService.id}`);
      if (!res.ok) {
        const errorData = await res.json();
        throw new Error(errorData.error || "Falha ao excluir serviço");
      }
      toast({
        title: "Serviço excluído",
        description: "O serviço foi excluído com sucesso",
      });
      refetch();
      setIsDeleteDialogOpen(false);
    } catch (error: any) {
      toast({
        title: "Erro ao excluir serviço",
        description: error.message,
        variant: "destructive",
      });
    }
  };

  // Função para encontrar o nome do prestador pelo ID
  const getProviderName = (providerId: number) => {
    if (!providers) return "";
    const provider = providers.find(p => p.id === providerId);
    return provider ? provider.name : "Desconhecido";
  };

  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between">
        <CardTitle>Serviços</CardTitle>
        <Button onClick={() => setIsAddDialogOpen(true)}>Adicionar Serviço</Button>
      </CardHeader>
      <CardContent>
        {isLoading ? (
          <div className="text-center py-4">Carregando...</div>
        ) : !services || services.length === 0 ? (
          <div className="text-center py-4">Nenhum serviço encontrado</div>
        ) : (
          <div className="overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>ID</TableHead>
                  <TableHead>Prestador</TableHead>
                  <TableHead>Nome</TableHead>
                  <TableHead>Duração</TableHead>
                  <TableHead>Preço</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead>Ações</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {services.map((service) => (
                  <TableRow key={service.id}>
                    <TableCell>{service.id}</TableCell>
                    <TableCell>{getProviderName(service.providerId)}</TableCell>
                    <TableCell>
                      <div>
                        <div>{service.name}</div>
                        {service.description && (
                          <div className="text-sm text-gray-500">{service.description}</div>
                        )}
                      </div>
                    </TableCell>
                    <TableCell>{formatDuration(service.duration)}</TableCell>
                    <TableCell>{formatPrice(service.price)}</TableCell>
                    <TableCell>
                      {service.active ? (
                        <Badge variant="outline" className="bg-green-50 text-green-700 border-green-200">
                          Ativo
                        </Badge>
                      ) : (
                        <Badge variant="outline" className="bg-gray-50 text-gray-700 border-gray-200">
                          Inativo
                        </Badge>
                      )}
                    </TableCell>
                    <TableCell>
                      <div className="flex space-x-2">
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => {
                            setSelectedService(service);
                            setIsEditDialogOpen(true);
                          }}
                        >
                          Editar
                        </Button>
                        <Button
                          variant="destructive"
                          size="sm"
                          onClick={() => {
                            setSelectedService(service);
                            setIsDeleteDialogOpen(true);
                          }}
                        >
                          Excluir
                        </Button>
                      </div>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        )}
      </CardContent>

      {/* Diálogo para adicionar serviço */}
      <Dialog open={isAddDialogOpen} onOpenChange={setIsAddDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Adicionar Serviço</DialogTitle>
          </DialogHeader>
          <ServiceForm
            providers={providers || []}
            onSubmit={addService}
            onCancel={() => setIsAddDialogOpen(false)}
          />
        </DialogContent>
      </Dialog>

      {/* Diálogo para editar serviço */}
      <Dialog open={isEditDialogOpen} onOpenChange={setIsEditDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Editar Serviço</DialogTitle>
          </DialogHeader>
          <ServiceForm
            initialData={selectedService}
            providers={providers || []}
            onSubmit={editService}
            onCancel={() => setIsEditDialogOpen(false)}
            isEditing
          />
        </DialogContent>
      </Dialog>

      {/* Diálogo para confirmar exclusão */}
      <AlertDialog open={isDeleteDialogOpen} onOpenChange={setIsDeleteDialogOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Confirmar exclusão</AlertDialogTitle>
            <AlertDialogDescription>
              Tem certeza que deseja excluir o serviço {selectedService?.name}? Esta ação não pode ser desfeita.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction onClick={deleteService}>Excluir</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </Card>
  );
}

// Componente de formulário para agendamentos
interface AppointmentFormProps {
  initialData?: any;
  providers: any[];
  clients: any[];
  services: any[];
  onSubmit: (data: any) => void;
  onCancel: () => void;
  isEditing?: boolean;
}

function AppointmentForm({ initialData, providers, clients, services, onSubmit, onCancel, isEditing = false }: AppointmentFormProps) {
  // Esquema de validação para o formulário
  const formSchema = z.object({
    providerId: z.number({
      required_error: "Prestador é obrigatório",
    }),
    clientId: z.number({
      required_error: "Cliente é obrigatório",
    }),
    serviceId: z.number().nullable().optional(),
    date: z.date({
      required_error: "Data é obrigatória",
    }),
    endTime: z.date({
      required_error: "Horário de término é obrigatório",
    }),
    status: z.string().default("pending"),
    notes: z.string().nullable().optional(),
    requiresPayment: z.boolean().default(false),
    paymentStatus: z.string().default("not_required"),
    paymentAmount: z.number().nullable().optional(),
    cancellationReason: z.string().nullable().optional(),
  });

  // Tipo inferido do esquema
  type FormValues = z.infer<typeof formSchema>;

  // Valores padrão para o formulário
  const defaultValues: Partial<FormValues> = {
    providerId: initialData?.providerId || undefined,
    clientId: initialData?.clientId || undefined,
    serviceId: initialData?.serviceId || null,
    date: initialData?.date ? new Date(initialData.date) : new Date(),
    endTime: initialData?.endTime ? new Date(initialData.endTime) : new Date(),
    status: initialData?.status || "pending",
    notes: initialData?.notes || "",
    requiresPayment: initialData?.requiresPayment !== undefined ? initialData.requiresPayment : false,
    paymentStatus: initialData?.paymentStatus || "not_required",
    paymentAmount: initialData?.paymentAmount || null,
    cancellationReason: initialData?.cancellationReason || "",
  };

  // Configuração do formulário
  const form = useForm<FormValues>({
    resolver: zodResolver(formSchema),
    defaultValues,
  });

  // Opções para status do agendamento
  const statusOptions = [
    { value: "pending", label: "Pendente" },
    { value: "confirmed", label: "Confirmado" },
    { value: "cancelled", label: "Cancelado" },
    { value: "completed", label: "Concluído" },
  ];

  // Opções para status de pagamento
  const paymentStatusOptions = [
    { value: "not_required", label: "Não Requerido" },
    { value: "pending", label: "Pendente" },
    { value: "confirmed", label: "Confirmado" },
    { value: "failed", label: "Falhou" },
    { value: "refunded", label: "Reembolsado" },
  ];

  // Função de envio do formulário
  const handleSubmit = (data: FormValues) => {
    onSubmit(data);
  };

  return (
    <Form {...form}>
      <form onSubmit={form.handleSubmit(handleSubmit)} className="space-y-4">
        <div className="grid grid-cols-2 gap-4">
          <FormField
            control={form.control}
            name="providerId"
            render={({ field }) => (
              <FormItem>
                <FormLabel>Prestador</FormLabel>
                <Select
                  disabled={isEditing}
                  value={field.value?.toString()}
                  onValueChange={(value) => field.onChange(parseInt(value))}
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Selecione um prestador" />
                  </SelectTrigger>
                  <SelectContent>
                    {providers.map((provider) => (
                      <SelectItem key={provider.id} value={provider.id.toString()}>
                        {provider.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                <FormMessage />
              </FormItem>
            )}
          />

          <FormField
            control={form.control}
            name="clientId"
            render={({ field }) => (
              <FormItem>
                <FormLabel>Cliente</FormLabel>
                <Select
                  disabled={isEditing}
                  value={field.value?.toString()}
                  onValueChange={(value) => field.onChange(parseInt(value))}
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Selecione um cliente" />
                  </SelectTrigger>
                  <SelectContent>
                    {clients.map((client) => (
                      <SelectItem key={client.id} value={client.id.toString()}>
                        {client.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                <FormMessage />
              </FormItem>
            )}
          />
        </div>

        <FormField
          control={form.control}
          name="serviceId"
          render={({ field }) => (
            <FormItem>
              <FormLabel>Serviço (opcional)</FormLabel>
              <Select
                value={field.value?.toString() || ""}
                onValueChange={(value) => field.onChange(value ? parseInt(value) : null)}
              >
                <SelectTrigger>
                  <SelectValue placeholder="Selecione um serviço (opcional)" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="">Nenhum</SelectItem>
                  {services.map((service) => (
                    <SelectItem key={service.id} value={service.id.toString()}>
                      {service.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <FormMessage />
            </FormItem>
          )}
        />

        <div className="grid grid-cols-2 gap-4">
          <FormField
            control={form.control}
            name="date"
            render={({ field }) => (
              <FormItem className="flex flex-col">
                <FormLabel>Data</FormLabel>
                <Input
                  type="date"
                  value={field.value ? new Date(field.value).toISOString().split('T')[0] : ''}
                  onChange={(e) => {
                    const date = new Date(e.target.value);
                    field.onChange(date);
                  }}
                />
                <FormMessage />
              </FormItem>
            )}
          />

          <FormField
            control={form.control}
            name="endTime"
            render={({ field }) => (
              <FormItem className="flex flex-col">
                <FormLabel>Horário de Término</FormLabel>
                <Input
                  type="time"
                  value={field.value ? new Date(field.value).toTimeString().slice(0, 5) : ''}
                  onChange={(e) => {
                    const [hours, minutes] = e.target.value.split(':').map(Number);
                    const date = new Date(form.getValues('date'));
                    date.setHours(hours, minutes);
                    field.onChange(date);
                  }}
                />
                <FormMessage />
              </FormItem>
            )}
          />
        </div>

        <FormField
          control={form.control}
          name="status"
          render={({ field }) => (
            <FormItem>
              <FormLabel>Status</FormLabel>
              <Select
                value={field.value}
                onValueChange={field.onChange}
              >
                <SelectTrigger>
                  <SelectValue placeholder="Selecione o status" />
                </SelectTrigger>
                <SelectContent>
                  {statusOptions.map((option) => (
                    <SelectItem key={option.value} value={option.value}>
                      {option.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <FormMessage />
            </FormItem>
          )}
        />

        {form.watch('status') === 'cancelled' && (
          <FormField
            control={form.control}
            name="cancellationReason"
            render={({ field }) => (
              <FormItem>
                <FormLabel>Motivo do Cancelamento</FormLabel>
                <FormControl>
                  <Textarea 
                    placeholder="Motivo do cancelamento" 
                    {...field} 
                    value={field.value || ""} 
                  />
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />
        )}

        <FormField
          control={form.control}
          name="notes"
          render={({ field }) => (
            <FormItem>
              <FormLabel>Observações</FormLabel>
              <FormControl>
                <Textarea 
                  placeholder="Observações sobre o agendamento" 
                  {...field} 
                  value={field.value || ""} 
                />
              </FormControl>
              <FormMessage />
            </FormItem>
          )}
        />

        <FormField
          control={form.control}
          name="requiresPayment"
          render={({ field }) => (
            <FormItem className="flex flex-row items-start space-x-3 space-y-0">
              <FormControl>
                <Checkbox
                  checked={field.value}
                  onCheckedChange={field.onChange}
                />
              </FormControl>
              <div className="space-y-1 leading-none">
                <FormLabel>Requer Pagamento</FormLabel>
                <FormDescription>
                  Marque se este agendamento requer pagamento antecipado
                </FormDescription>
              </div>
            </FormItem>
          )}
        />

        {form.watch('requiresPayment') && (
          <div className="grid grid-cols-2 gap-4">
            <FormField
              control={form.control}
              name="paymentStatus"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Status do Pagamento</FormLabel>
                  <Select
                    value={field.value}
                    onValueChange={field.onChange}
                  >
                    <SelectTrigger>
                      <SelectValue placeholder="Selecione o status" />
                    </SelectTrigger>
                    <SelectContent>
                      {paymentStatusOptions.map((option) => (
                        <SelectItem key={option.value} value={option.value}>
                          {option.label}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  <FormMessage />
                </FormItem>
              )}
            />

            <FormField
              control={form.control}
              name="paymentAmount"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Valor do Pagamento (centavos)</FormLabel>
                  <FormControl>
                    <Input 
                      type="number" 
                      placeholder="Valor em centavos" 
                      {...field} 
                      value={field.value || ""}
                      onChange={(e) => field.onChange(e.target.value ? parseInt(e.target.value) : null)}
                    />
                  </FormControl>
                  <FormDescription>
                    Valor em centavos. Ex: 10000 = R$ 100,00
                  </FormDescription>
                  <FormMessage />
                </FormItem>
              )}
            />
          </div>
        )}

        <DialogFooter>
          <Button type="button" variant="outline" onClick={onCancel}>
            Cancelar
          </Button>
          <Button type="submit">{isEditing ? "Salvar alterações" : "Adicionar"}</Button>
        </DialogFooter>
      </form>
    </Form>
  );
}

function AppointmentsTable() {
  const { toast } = useToast();
  const [isAddDialogOpen, setIsAddDialogOpen] = useState(false);
  const [isEditDialogOpen, setIsEditDialogOpen] = useState(false);
  const [isDeleteDialogOpen, setIsDeleteDialogOpen] = useState(false);
  const [selectedAppointment, setSelectedAppointment] = useState<any>(null);

  // Consulta para buscar agendamentos
  const { data: appointments, isLoading, refetch } = useQuery<any[]>({
    queryKey: ["/api/admin/database/appointments"],
    queryFn: async () => {
      const res = await apiRequest("GET", "/api/admin/database/appointments");
      if (!res.ok) {
        throw new Error("Falha ao carregar agendamentos");
      }
      return res.json();
    },
  });

  // Consulta para buscar prestadores
  const { data: providers } = useQuery<any[]>({
    queryKey: ["/api/admin/database/providers"],
    queryFn: async () => {
      const res = await apiRequest("GET", "/api/admin/database/providers");
      if (!res.ok) {
        throw new Error("Falha ao carregar prestadores");
      }
      return res.json();
    },
  });

  // Consulta para buscar clientes
  const { data: clients } = useQuery<any[]>({
    queryKey: ["/api/admin/database/clients"],
    queryFn: async () => {
      const res = await apiRequest("GET", "/api/admin/database/clients");
      if (!res.ok) {
        throw new Error("Falha ao carregar clientes");
      }
      return res.json();
    },
  });

  // Consulta para buscar serviços
  const { data: services } = useQuery<any[]>({
    queryKey: ["/api/admin/database/services"],
    queryFn: async () => {
      const res = await apiRequest("GET", "/api/admin/database/services");
      if (!res.ok) {
        throw new Error("Falha ao carregar serviços");
      }
      return res.json();
    },
  });

  // Função para formatar data
  const formatDate = (dateString: string) => {
    const date = new Date(dateString);
    return date.toLocaleDateString('pt-BR');
  };

  // Função para formatar hora
  const formatTime = (dateString: string) => {
    const date = new Date(dateString);
    return date.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' });
  };

  // Função para formatar preço em reais
  const formatPrice = (priceInCents: number) => {
    if (!priceInCents) return "-";
    return new Intl.NumberFormat('pt-BR', {
      style: 'currency',
      currency: 'BRL'
    }).format(priceInCents / 100);
  };

  // Função para encontrar o nome do prestador pelo ID
  const getProviderName = (providerId: number) => {
    if (!providers) return "";
    const provider = providers.find(p => p.id === providerId);
    return provider ? provider.name : "Desconhecido";
  };

  // Função para encontrar o nome do cliente pelo ID
  const getClientName = (clientId: number) => {
    if (!clients) return "";
    const client = clients.find(c => c.id === clientId);
    return client ? client.name : "Desconhecido";
  };

  // Função para encontrar o nome do serviço pelo ID
  const getServiceName = (serviceId: number) => {
    if (!serviceId || !services) return "Não especificado";
    const service = services.find(s => s.id === serviceId);
    return service ? service.name : "Desconhecido";
  };

  // Função para traduzir o status do agendamento
  const getStatusLabel = (status: string) => {
    const statusMap: Record<string, { label: string, className: string }> = {
      pending: { label: "Pendente", className: "bg-yellow-50 text-yellow-700 border-yellow-200" },
      confirmed: { label: "Confirmado", className: "bg-green-50 text-green-700 border-green-200" },
      cancelled: { label: "Cancelado", className: "bg-red-50 text-red-700 border-red-200" },
      completed: { label: "Concluído", className: "bg-blue-50 text-blue-700 border-blue-200" },
    };
    return statusMap[status] || { label: status, className: "bg-gray-50 text-gray-700 border-gray-200" };
  };

  // Função para traduzir o status do pagamento
  const getPaymentStatusLabel = (status: string) => {
    const statusMap: Record<string, { label: string, className: string }> = {
      not_required: { label: "Não Requerido", className: "bg-gray-50 text-gray-700 border-gray-200" },
      pending: { label: "Pendente", className: "bg-yellow-50 text-yellow-700 border-yellow-200" },
      confirmed: { label: "Confirmado", className: "bg-green-50 text-green-700 border-green-200" },
      failed: { label: "Falhou", className: "bg-red-50 text-red-700 border-red-200" },
      refunded: { label: "Reembolsado", className: "bg-purple-50 text-purple-700 border-purple-200" },
    };
    return statusMap[status] || { label: status, className: "bg-gray-50 text-gray-700 border-gray-200" };
  };

  // Função para adicionar agendamento
  const addAppointment = async (appointmentData: any) => {
    try {
      const res = await apiRequest("POST", "/api/admin/database/appointments", appointmentData);
      if (!res.ok) {
        const errorData = await res.json();
        throw new Error(errorData.error || "Falha ao adicionar agendamento");
      }
      toast({
        title: "Agendamento adicionado",
        description: "O agendamento foi adicionado com sucesso",
      });
      refetch();
      setIsAddDialogOpen(false);
    } catch (error: any) {
      toast({
        title: "Erro ao adicionar agendamento",
        description: error.message,
        variant: "destructive",
      });
    }
  };

  // Função para editar agendamento
  const editAppointment = async (appointmentData: any) => {
    try {
      const res = await apiRequest("PUT", `/api/admin/database/appointments/${selectedAppointment.id}`, appointmentData);
      if (!res.ok) {
        const errorData = await res.json();
        throw new Error(errorData.error || "Falha ao editar agendamento");
      }
      toast({
        title: "Agendamento atualizado",
        description: "O agendamento foi atualizado com sucesso",
      });
      refetch();
      setIsEditDialogOpen(false);
    } catch (error: any) {
      toast({
        title: "Erro ao atualizar agendamento",
        description: error.message,
        variant: "destructive",
      });
    }
  };

  // Função para excluir agendamento
  const deleteAppointment = async () => {
    try {
      const res = await apiRequest("DELETE", `/api/admin/database/appointments/${selectedAppointment.id}`);
      if (!res.ok) {
        const errorData = await res.json();
        throw new Error(errorData.error || "Falha ao excluir agendamento");
      }
      toast({
        title: "Agendamento excluído",
        description: "O agendamento foi excluído com sucesso",
      });
      refetch();
      setIsDeleteDialogOpen(false);
    } catch (error: any) {
      toast({
        title: "Erro ao excluir agendamento",
        description: error.message,
        variant: "destructive",
      });
    }
  };

  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between">
        <CardTitle>Agendamentos</CardTitle>
        <Button onClick={() => setIsAddDialogOpen(true)}>Adicionar Agendamento</Button>
      </CardHeader>
      <CardContent>
        {isLoading ? (
          <div className="text-center py-4">Carregando...</div>
        ) : !appointments || appointments.length === 0 ? (
          <div className="text-center py-4">Nenhum agendamento encontrado</div>
        ) : (
          <div className="overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>ID</TableHead>
                  <TableHead>Data</TableHead>
                  <TableHead>Horário</TableHead>
                  <TableHead>Prestador</TableHead>
                  <TableHead>Cliente</TableHead>
                  <TableHead>Serviço</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead>Pagamento</TableHead>
                  <TableHead>Ações</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {appointments.map((appointment) => (
                  <TableRow key={appointment.id}>
                    <TableCell>{appointment.id}</TableCell>
                    <TableCell>{formatDate(appointment.date)}</TableCell>
                    <TableCell>{formatTime(appointment.endTime)}</TableCell>
                    <TableCell>{getProviderName(appointment.providerId)}</TableCell>
                    <TableCell>{getClientName(appointment.clientId)}</TableCell>
                    <TableCell>{getServiceName(appointment.serviceId)}</TableCell>
                    <TableCell>
                      <Badge 
                        variant="outline" 
                        className={getStatusLabel(appointment.status).className}
                      >
                        {getStatusLabel(appointment.status).label}
                      </Badge>
                      {appointment.status === 'cancelled' && appointment.cancellationReason && (
                        <div className="text-xs text-gray-500 mt-1">
                          Motivo: {appointment.cancellationReason}
                        </div>
                      )}
                    </TableCell>
                    <TableCell>
                      {appointment.requiresPayment ? (
                        <div>
                          <Badge 
                            variant="outline" 
                            className={getPaymentStatusLabel(appointment.paymentStatus).className}
                          >
                            {getPaymentStatusLabel(appointment.paymentStatus).label}
                          </Badge>
                          {appointment.paymentAmount > 0 && (
                            <div className="text-xs text-gray-500 mt-1">
                              {formatPrice(appointment.paymentAmount)}
                            </div>
                          )}
                        </div>
                      ) : (
                        <span className="text-gray-500 text-sm">Não requerido</span>
                      )}
                    </TableCell>
                    <TableCell>
                      <div className="flex space-x-2">
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => {
                            setSelectedAppointment(appointment);
                            setIsEditDialogOpen(true);
                          }}
                        >
                          Editar
                        </Button>
                        <Button
                          variant="destructive"
                          size="sm"
                          onClick={() => {
                            setSelectedAppointment(appointment);
                            setIsDeleteDialogOpen(true);
                          }}
                        >
                          Excluir
                        </Button>
                      </div>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        )}
      </CardContent>

      {/* Diálogo para adicionar agendamento */}
      <Dialog open={isAddDialogOpen} onOpenChange={setIsAddDialogOpen}>
        <DialogContent className="max-w-3xl">
          <DialogHeader>
            <DialogTitle>Adicionar Agendamento</DialogTitle>
          </DialogHeader>
          <AppointmentForm
            providers={providers || []}
            clients={clients || []}
            services={services || []}
            onSubmit={addAppointment}
            onCancel={() => setIsAddDialogOpen(false)}
          />
        </DialogContent>
      </Dialog>

      {/* Diálogo para editar agendamento */}
      <Dialog open={isEditDialogOpen} onOpenChange={setIsEditDialogOpen}>
        <DialogContent className="max-w-3xl">
          <DialogHeader>
            <DialogTitle>Editar Agendamento</DialogTitle>
          </DialogHeader>
          <AppointmentForm
            initialData={selectedAppointment}
            providers={providers || []}
            clients={clients || []}
            services={services || []}
            onSubmit={editAppointment}
            onCancel={() => setIsEditDialogOpen(false)}
            isEditing
          />
        </DialogContent>
      </Dialog>

      {/* Diálogo para confirmar exclusão */}
      <AlertDialog open={isDeleteDialogOpen} onOpenChange={setIsDeleteDialogOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Confirmar exclusão</AlertDialogTitle>
            <AlertDialogDescription>
              Tem certeza que deseja excluir este agendamento? Esta ação não pode ser desfeita.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction onClick={deleteAppointment}>Excluir</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </Card>
  );
}

// Componente para gerenciar planos de assinatura
function SubscriptionPlansTable() {
  const { toast } = useToast();
  const [isAddDialogOpen, setIsAddDialogOpen] = useState(false);
  const [isEditDialogOpen, setIsEditDialogOpen] = useState(false);
  const [selectedPlan, setSelectedPlan] = useState<any>(null);
  
  // Consulta para buscar todos os planos
  const { data: plans, isLoading, error, refetch } = useQuery({
    queryKey: ['subscription-plans'],
    queryFn: async () => {
      const response = await fetch('/api/admin/database/subscription-plans');
      if (!response.ok) {
        throw new Error('Erro ao buscar planos de assinatura');
      }
      return response.json();
    },
  });
  
  // Mutation para adicionar um plano
  const addPlanMutation = useMutation({
    mutationFn: async (newPlan: any) => {
      const response = await fetch('/api/admin/database/subscription-plans', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(newPlan),
      });
      
      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.error || 'Erro ao adicionar plano');
      }
      
      return response.json();
    },
    onSuccess: () => {
      toast({
        title: "Sucesso",
        description: "Plano adicionado com sucesso!",
        variant: "default",
      });
      setIsAddDialogOpen(false);
      refetch();
    },
    onError: (error: any) => {
      toast({
        title: "Erro",
        description: `Erro: ${error.message}`,
        variant: "destructive",
      });
    },
  });
  
  // Mutation para atualizar um plano
  const updatePlanMutation = useMutation({
    mutationFn: async (updatedPlan: any) => {
      const response = await fetch(`/api/admin/database/subscription-plans/${updatedPlan.id}`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(updatedPlan),
      });
      
      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.error || 'Erro ao atualizar plano');
      }
      
      return response.json();
    },
    onSuccess: () => {
      toast({
        title: "Sucesso",
        description: "Plano atualizado com sucesso!",
        variant: "default",
      });
      setIsEditDialogOpen(false);
      refetch();
    },
    onError: (error: any) => {
      toast({
        title: "Erro",
        description: `Erro: ${error.message}`,
        variant: "destructive",
      });
    },
  });
  
  // Mutation para excluir um plano
  const deletePlanMutation = useMutation({
    mutationFn: async (planId: number) => {
      const response = await fetch(`/api/admin/database/subscription-plans/${planId}`, {
        method: 'DELETE',
      });
      
      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.error || 'Erro ao excluir plano');
      }
      
      return response.json();
    },
    onSuccess: () => {
      toast({
        title: "Sucesso",
        description: "Plano excluído com sucesso!",
        variant: "default",
      });
      refetch();
    },
    onError: (error: any) => {
      toast({
        title: "Erro",
        description: `Erro: ${error.message}`,
        variant: "destructive",
      });
    },
  });
  
  // Função para formatar preço
  const formatPrice = (price: number) => {
    return new Intl.NumberFormat('pt-BR', {
      style: 'currency',
      currency: 'BRL',
    }).format(price / 100);
  };
  
  // Função para lidar com adição de plano
  const handleAddPlan = (data: any) => {
    addPlanMutation.mutate({
      name: data.name,
      description: data.description,
      price: parseInt(data.price) * 100, // Converter para centavos
      durationMonths: parseInt(data.durationMonths),
      accountType: data.accountType || 'individual',
      isActive: data.isActive === 'true',
    });
  };
  
  // Função para lidar com edição de plano
  const handleEditPlan = (data: any) => {
    updatePlanMutation.mutate({
      id: selectedPlan.id,
      name: data.name,
      description: data.description,
      price: parseInt(data.price) * 100, // Converter para centavos
      durationMonths: parseInt(data.durationMonths),
      accountType: data.accountType || 'individual',
      isActive: data.isActive === 'true',
    });
  };
  
  // Função para lidar com exclusão de plano
  const handleDeletePlan = (planId: number) => {
    if (confirm('Tem certeza que deseja excluir este plano?')) {
      deletePlanMutation.mutate(planId);
    }
  };
  
  if (isLoading) {
    return <div>Carregando planos de assinatura...</div>;
  }
  
  if (error) {
    return <div>Erro ao carregar planos: {(error as Error).message}</div>;
  }
  
  // Formulário para adicionar plano
  const addPlanForm = (
    <div className="grid gap-4 py-4">
      <div className="grid grid-cols-4 items-center gap-4">
        <Label htmlFor="name" className="text-right">Nome</Label>
        <Input id="name" name="name" className="col-span-3" required />
      </div>
      
      <div className="grid grid-cols-4 items-center gap-4">
        <Label htmlFor="description" className="text-right">Descrição</Label>
        <Textarea id="description" name="description" className="col-span-3" />
      </div>
      
      <div className="grid grid-cols-4 items-center gap-4">
        <Label htmlFor="price" className="text-right">Preço (R$)</Label>
        <Input id="price" name="price" type="number" className="col-span-3" required />
      </div>
      
      <div className="grid grid-cols-4 items-center gap-4">
        <Label htmlFor="durationMonths" className="text-right">Duração (meses)</Label>
        <Input id="durationMonths" name="durationMonths" type="number" className="col-span-3" required />
      </div>
      
      <div className="grid grid-cols-4 items-center gap-4">
        <Label htmlFor="accountType" className="text-right">Tipo de Conta</Label>
        <div className="col-span-3">
          <Select name="accountType" defaultValue="individual">
            <SelectTrigger>
              <SelectValue placeholder="Selecione o tipo de conta" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="individual">Individual</SelectItem>
              <SelectItem value="company">Empresa</SelectItem>
            </SelectContent>
          </Select>
        </div>
      </div>
      
      <div className="grid grid-cols-4 items-center gap-4">
        <Label htmlFor="isActive" className="text-right">Status</Label>
        <div className="col-span-3">
          <Select name="isActive" defaultValue="true">
            <SelectTrigger>
              <SelectValue placeholder="Selecione o status" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="true">Ativo</SelectItem>
              <SelectItem value="false">Inativo</SelectItem>
            </SelectContent>
          </Select>
        </div>
      </div>
    </div>
  );
  
  // Formulário para editar plano
  const editPlanForm = selectedPlan && (
    <div className="grid gap-4 py-4">
      <div className="grid grid-cols-4 items-center gap-4">
        <Label htmlFor="name" className="text-right">Nome</Label>
        <Input id="name" name="name" defaultValue={selectedPlan.name} className="col-span-3" required />
      </div>
      
      <div className="grid grid-cols-4 items-center gap-4">
        <Label htmlFor="description" className="text-right">Descrição</Label>
        <Textarea id="description" name="description" defaultValue={selectedPlan.description || ''} className="col-span-3" />
      </div>
      
      <div className="grid grid-cols-4 items-center gap-4">
        <Label htmlFor="price" className="text-right">Preço (R$)</Label>
        <Input id="price" name="price" type="number" defaultValue={(selectedPlan.price / 100).toString()} className="col-span-3" required />
      </div>
      
      <div className="grid grid-cols-4 items-center gap-4">
        <Label htmlFor="durationMonths" className="text-right">Duração (meses)</Label>
        <Input id="durationMonths" name="durationMonths" type="number" defaultValue={selectedPlan.durationMonths.toString()} className="col-span-3" required />
      </div>
      
      <div className="grid grid-cols-4 items-center gap-4">
        <Label htmlFor="accountType" className="text-right">Tipo de Conta</Label>
        <div className="col-span-3">
          <Select name="accountType" defaultValue={selectedPlan.accountType || 'individual'}>
            <SelectTrigger>
              <SelectValue placeholder="Selecione o tipo de conta" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="individual">Individual</SelectItem>
              <SelectItem value="company">Empresa</SelectItem>
            </SelectContent>
          </Select>
        </div>
      </div>
      
      <div className="grid grid-cols-4 items-center gap-4">
        <Label htmlFor="isActive" className="text-right">Status</Label>
        <div className="col-span-3">
          <Select name="isActive" defaultValue={selectedPlan.isActive.toString()}>
            <SelectTrigger>
              <SelectValue placeholder="Selecione o status" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="true">Ativo</SelectItem>
              <SelectItem value="false">Inativo</SelectItem>
            </SelectContent>
          </Select>
        </div>
      </div>
    </div>
  );
  
  return (
    <div className="flex flex-col gap-4">
      <div className="flex justify-between items-center">
        <h3 className="text-xl font-semibold">Planos de Assinatura</h3>
        <Button onClick={() => setIsAddDialogOpen(true)}>Adicionar Plano</Button>
      </div>
      
      <div className="rounded-md border">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>ID</TableHead>
              <TableHead>Nome</TableHead>
              <TableHead>Descrição</TableHead>
              <TableHead>Preço</TableHead>
              <TableHead>Duração (meses)</TableHead>
              <TableHead>Tipo de Conta</TableHead>
              <TableHead>Status</TableHead>
              <TableHead>Ações</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {plans && plans.length > 0 ? (
              plans.map((plan: any) => (
                <TableRow key={plan.id}>
                  <TableCell>{plan.id}</TableCell>
                  <TableCell>{plan.name}</TableCell>
                  <TableCell>{plan.description || '-'}</TableCell>
                  <TableCell>{formatPrice(plan.price)}</TableCell>
                  <TableCell>{plan.durationMonths}</TableCell>
                  <TableCell>
                    <Badge variant={plan.accountType === 'company' ? "default" : "secondary"}>
                      {plan.accountType === 'company' ? 'Empresa' : 'Individual'}
                    </Badge>
                  </TableCell>
                  <TableCell>
                    <Badge variant={plan.isActive ? "success" : "destructive"}>
                      {plan.isActive ? 'Ativo' : 'Inativo'}
                    </Badge>
                  </TableCell>
                  <TableCell>
                    <div className="flex gap-2">
                      <Button 
                        variant="outline" 
                        size="sm"
                        onClick={() => {
                          setSelectedPlan(plan);
                          setIsEditDialogOpen(true);
                        }}
                      >
                        Editar
                      </Button>
                      <Button 
                        variant="destructive" 
                        size="sm"
                        onClick={() => handleDeletePlan(plan.id)}
                      >
                        Excluir
                      </Button>
                    </div>
                  </TableCell>
                </TableRow>
              ))
            ) : (
              <TableRow>
                <TableCell colSpan={8} className="text-center">Nenhum plano encontrado</TableCell>
              </TableRow>
            )}
          </TableBody>
        </Table>
      </div>
      
      {/* Dialog para adicionar plano */}
      <Dialog open={isAddDialogOpen} onOpenChange={setIsAddDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Adicionar Plano de Assinatura</DialogTitle>
            <DialogDescription>
              Preencha os dados para adicionar um novo plano de assinatura.
            </DialogDescription>
          </DialogHeader>
          
          <form onSubmit={(e) => {
            e.preventDefault();
            const formData = new FormData(e.currentTarget);
            handleAddPlan(Object.fromEntries(formData));
          }}>
            {addPlanForm}
            
            <DialogFooter>
              <Button type="button" variant="outline" onClick={() => setIsAddDialogOpen(false)}>Cancelar</Button>
              <Button type="submit" disabled={addPlanMutation.isPending}>Salvar</Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
      
      {/* Dialog para editar plano */}
      <Dialog open={isEditDialogOpen} onOpenChange={setIsEditDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Editar Plano de Assinatura</DialogTitle>
            <DialogDescription>
              Atualize os dados do plano de assinatura.
            </DialogDescription>
          </DialogHeader>
          
          <form onSubmit={(e) => {
            e.preventDefault();
            const formData = new FormData(e.currentTarget);
            handleEditPlan(Object.fromEntries(formData));
          }}>
            {editPlanForm}
            
            <DialogFooter>
              <Button type="button" variant="outline" onClick={() => setIsEditDialogOpen(false)}>Cancelar</Button>
              <Button type="submit" disabled={updatePlanMutation.isPending}>Salvar</Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  );
}

// Componente para gerenciar transações de assinatura
function SubscriptionTransactionsTable() {
  const { toast } = useToast();
  
  // Consulta para buscar todas as transações
  const { data: transactions, isLoading, error, refetch } = useQuery({
    queryKey: ['subscription-transactions'],
    queryFn: async () => {
      const response = await fetch('/api/admin/database/subscription-transactions');
      if (!response.ok) {
        throw new Error('Erro ao buscar transações de assinatura');
      }
      return response.json();
    },
  });
  
  // Consulta para buscar usuários (para exibir nomes)
  const { data: users } = useQuery({
    queryKey: ['users'],
    queryFn: async () => {
      const response = await fetch('/api/admin/database/users');
      if (!response.ok) {
        throw new Error('Erro ao buscar usuários');
      }
      return response.json();
    },
  });
  
  // Consulta para buscar planos (para exibir nomes)
  const { data: plans } = useQuery({
    queryKey: ['subscription-plans'],
    queryFn: async () => {
      const response = await fetch('/api/admin/database/subscription-plans');
      if (!response.ok) {
        throw new Error('Erro ao buscar planos');
      }
      return response.json();
    },
  });
  
  // Mutation para atualizar status de transação
  const updateTransactionMutation = useMutation({
    mutationFn: async ({ id, status }: { id: number, status: string }) => {
      const response = await fetch(`/api/admin/database/subscription-transactions/${id}`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ status }),
      });
      
      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.error || 'Erro ao atualizar transação');
      }
      
      return response.json();
    },
    onSuccess: () => {
      toast({
        title: "Sucesso",
        description: "Status da transação atualizado com sucesso!",
        variant: "default",
      });
      refetch();
    },
    onError: (error: any) => {
      toast({
        title: "Erro",
        description: `Erro: ${error.message}`,
        variant: "destructive",
      });
    },
  });
  
  // Função para formatar preço
  const formatPrice = (price: number) => {
    return new Intl.NumberFormat('pt-BR', {
      style: 'currency',
      currency: 'BRL',
    }).format(price / 100);
  };
  
  // Função para formatar data
  const formatDate = (dateString: string) => {
    if (!dateString) return '-';
    const date = new Date(dateString);
    return new Intl.DateTimeFormat('pt-BR', {
      day: '2-digit',
      month: '2-digit',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    }).format(date);
  };
  
  // Função para obter nome do usuário
  const getUserName = (userId: number) => {
    if (!users) return `Usuário #${userId}`;
    const user = users.find((u: any) => u.id === userId);
    return user ? user.name : `Usuário #${userId}`;
  };
  
  // Função para obter nome do plano
  const getPlanName = (planId: number) => {
    if (!plans) return `Plano #${planId}`;
    const plan = plans.find((p: any) => p.id === planId);
    return plan ? plan.name : `Plano #${planId}`;
  };
  
  // Função para lidar com atualização de status
  const handleUpdateStatus = (id: number, newStatus: string) => {
    if (confirm(`Tem certeza que deseja alterar o status para ${newStatus}?`)) {
      updateTransactionMutation.mutate({ id, status: newStatus });
    }
  };
  
  // Função para renderizar o status com cores
  const renderStatus = (status: string) => {
    const statusMap: Record<string, { label: string, variant: "default" | "destructive" | "success" | "outline" | "secondary" | null | undefined }> = {
      pending: { label: 'Pendente', variant: 'secondary' },
      completed: { label: 'Completo', variant: 'success' },
      failed: { label: 'Falhou', variant: 'destructive' },
      cancelled: { label: 'Cancelado', variant: 'outline' },
    };
    
    const statusInfo = statusMap[status] || { label: status, variant: 'default' };
    
    return (
      <Badge variant={statusInfo.variant}>
        {statusInfo.label}
      </Badge>
    );
  };
  
  if (isLoading) {
    return <div>Carregando transações...</div>;
  }
  
  if (error) {
    return <div>Erro ao carregar transações: {(error as Error).message}</div>;
  }
  
  return (
    <div className="flex flex-col gap-4">
      <div className="flex justify-between items-center">
        <h3 className="text-xl font-semibold">Transações de Assinatura</h3>
      </div>
      
      <div className="rounded-md border">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>ID</TableHead>
              <TableHead>Usuário</TableHead>
              <TableHead>Plano</TableHead>
              <TableHead>Valor</TableHead>
              <TableHead>Status</TableHead>
              <TableHead>Método</TableHead>
              <TableHead>Data Criação</TableHead>
              <TableHead>Data Pagamento</TableHead>
              <TableHead>Ações</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {transactions && transactions.length > 0 ? (
              transactions.map((transaction: any) => (
                <TableRow key={transaction.id}>
                  <TableCell>{transaction.id}</TableCell>
                  <TableCell>{getUserName(transaction.userId)}</TableCell>
                  <TableCell>{getPlanName(transaction.planId)}</TableCell>
                  <TableCell>{formatPrice(transaction.amount)}</TableCell>
                  <TableCell>{renderStatus(transaction.status)}</TableCell>
                  <TableCell>{transaction.paymentMethod}</TableCell>
                  <TableCell>{formatDate(transaction.createdAt)}</TableCell>
                  <TableCell>{formatDate(transaction.paidAt)}</TableCell>
                  <TableCell>
                    <div className="flex gap-2">
                      <Button 
                        variant="outline" 
                        size="sm"
                        onClick={() => handleUpdateStatus(transaction.id, 'completed')}
                        disabled={transaction.status === 'completed'}
                      >
                        Confirmar
                      </Button>
                      <Button 
                        variant="destructive" 
                        size="sm"
                        onClick={() => handleUpdateStatus(transaction.id, 'cancelled')}
                        disabled={transaction.status === 'cancelled'}
                      >
                        Cancelar
                      </Button>
                    </div>
                  </TableCell>
                </TableRow>
              ))
            ) : (
              <TableRow>
                <TableCell colSpan={9} className="text-center">Nenhuma transação encontrada</TableCell>
              </TableRow>
            )}
          </TableBody>
        </Table>
      </div>
    </div>
  );
}

function NotificationsTable() {
  return <div>Tabela de Notificações - A ser implementada</div>;
}
