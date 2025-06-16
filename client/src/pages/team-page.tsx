import { useState, useEffect } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Form, FormControl, FormDescription, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Switch } from "@/components/ui/switch";
import { Checkbox } from "@/components/ui/checkbox";
import { ScrollArea } from "@/components/ui/scroll-area";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { Plus, Edit, Trash2, Users, Clock, Settings, Calendar, RefreshCw } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { useAuth } from "@/hooks/use-auth";
import { apiRequest } from "@/lib/queryClient";
import type { Employee, InsertEmployee, Service } from "@shared/schema";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";
import PageHeader from "@/components/layout/page-header";

// Schema para validação do formulário de funcionários
const employeeFormSchema = z.object({
  name: z.string().min(2, "Nome deve ter pelo menos 2 caracteres"),
  specialty: z.string().min(2, "Especialidade é obrigatória"),
  lunchBreakStart: z.string()
    .optional()
    .or(z.literal(""))
    .refine((val) => {
      if (!val || val === "") return true;
      // Aceita formato HH:MM (24h) - valida se é um horário válido
      const timeRegex = /^([01]?[0-9]|2[0-3]):[0-5][0-9]$/;
      return timeRegex.test(val);
    }, "Formato deve ser HH:MM (24h) - ex: 13:00, 09:30"),
  lunchBreakEnd: z.string()
    .optional()
    .or(z.literal(""))
    .refine((val) => {
      if (!val || val === "") return true;
      // Aceita formato HH:MM (24h) - valida se é um horário válido
      const timeRegex = /^([01]?[0-9]|2[0-3]):[0-5][0-9]$/;
      return timeRegex.test(val);
    }, "Formato deve ser HH:MM (24h) - ex: 14:00, 18:30"),
  isActive: z.boolean().default(true),
}).refine((data) => {
  // Só validar se ambos os campos estiverem preenchidos
  if (!data.lunchBreakStart || !data.lunchBreakEnd || data.lunchBreakStart === "" || data.lunchBreakEnd === "") {
    return true; // Permite campos vazios
  }
  
  // Validar se o horário de fim do almoço é após o início
  const [startHour, startMinute] = data.lunchBreakStart.split(':').map(Number);
  const [endHour, endMinute] = data.lunchBreakEnd.split(':').map(Number);
  
  const startTime = startHour * 60 + startMinute;
  const endTime = endHour * 60 + endMinute;
  
  return endTime > startTime;
}, {
  message: "Horário de fim do almoço deve ser após o início",
  path: ["lunchBreakEnd"]
});

type EmployeeFormData = z.infer<typeof employeeFormSchema>;

// Componente para mostrar os serviços de um funcionário
// Componente para exibir agenda resumida do funcionário
function EmployeeScheduleDialog({ 
  employee, 
  open, 
  onOpenChange 
}: { 
  employee: Employee | null; 
  open: boolean; 
  onOpenChange: (open: boolean) => void; 
}) {
  // Buscar agendamentos do funcionário nos últimos 30 dias
  const { data: appointments = [], isLoading } = useQuery({
    queryKey: ['/api/employees', employee?.id, 'appointments'],
    queryFn: async () => {
      if (!employee) return [];
      const thirtyDaysAgo = new Date();
      thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);
      
      const response = await fetch(`/api/employees/${employee.id}/appointments?since=${thirtyDaysAgo.toISOString()}`);
      if (!response.ok) throw new Error('Erro ao buscar agendamentos');
      return response.json();
    },
    enabled: !!employee && open,
  });

  if (!employee) return null;

  // Calcular estatísticas
  const totalAppointments = appointments.length;
  const completedAppointments = appointments.filter((apt: any) => apt.status === 'completed').length;
  const uniqueClients = new Set(appointments.map((apt: any) => apt.clientId)).size;
  // Incluir agendamentos confirmados e concluídos no cálculo da receita
  const totalRevenue = appointments
    .filter((apt: any) => apt.status === 'completed' || apt.status === 'confirmed')
    .reduce((sum: number, apt: any) => sum + ((apt.service?.price || 0) / 100), 0);

  // Agrupar agendamentos por dia
  const appointmentsByDate = appointments.reduce((acc: any, apt: any) => {
    // Usar a data do campo 'date' e garantir que seja interpretada corretamente
    const appointmentDate = new Date(apt.date);
    
    // Usar componentes de data locais para evitar problemas de fuso horário
    const year = appointmentDate.getFullYear();
    const month = String(appointmentDate.getMonth() + 1).padStart(2, '0');
    const day = String(appointmentDate.getDate()).padStart(2, '0');
    const dateKey = `${year}-${month}-${day}`;
    
    if (!acc[dateKey]) acc[dateKey] = [];
    acc[dateKey].push(apt);
    return acc;
  }, {});

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-4xl max-h-[80vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Calendar className="h-5 w-5" />
            Agenda de {employee.name}
          </DialogTitle>
          <DialogDescription>
            Resumo dos últimos 30 dias de atividades
          </DialogDescription>
        </DialogHeader>

        {isLoading ? (
          <div className="flex items-center justify-center py-8">
            <div className="animate-spin w-8 h-8 border-4 border-primary border-t-transparent rounded-full" />
          </div>
        ) : (
          <div className="space-y-6">
            {/* Estatísticas gerais */}
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
              <Card>
                <CardContent className="p-4 text-center">
                  <div className="text-2xl font-bold text-primary">{totalAppointments}</div>
                  <div className="text-sm text-muted-foreground">Total de Agendamentos</div>
                </CardContent>
              </Card>
              <Card>
                <CardContent className="p-4 text-center">
                  <div className="text-2xl font-bold text-green-600">{completedAppointments}</div>
                  <div className="text-sm text-muted-foreground">Concluídos</div>
                </CardContent>
              </Card>
              <Card>
                <CardContent className="p-4 text-center">
                  <div className="text-2xl font-bold text-blue-600">{uniqueClients}</div>
                  <div className="text-sm text-muted-foreground">Clientes Únicos</div>
                </CardContent>
              </Card>
              <Card>
                <CardContent className="p-4 text-center">
                  <div className="text-2xl font-bold text-emerald-600">
                    R$ {totalRevenue.toFixed(2)}
                  </div>
                  <div className="text-sm text-muted-foreground">Receita</div>
                </CardContent>
              </Card>
            </div>

            {/* Lista de agendamentos por data */}
            <div>
              <h3 className="text-lg font-semibold mb-4">Agendamentos Recentes</h3>
              {Object.keys(appointmentsByDate).length === 0 ? (
                <p className="text-muted-foreground text-center py-8">
                  Nenhum agendamento encontrado nos últimos 30 dias
                </p>
              ) : (
                <ScrollArea className="h-96">
                  <div className="space-y-4">
                    {Object.entries(appointmentsByDate)
                      .sort(([a], [b]) => new Date(b).getTime() - new Date(a).getTime())
                      .map(([date, dayAppointments]: [string, any]) => (
                        <Card key={date}>
                          <CardHeader className="pb-3">
                            <CardTitle className="text-base">
                              {format(new Date(date + 'T12:00:00'), "EEEE, dd 'de' MMMM", { locale: ptBR })}
                            </CardTitle>
                          </CardHeader>
                          <CardContent>
                            <div className="space-y-2">
                              {dayAppointments.map((appointment: any) => (
                                <div 
                                  key={appointment.id}
                                  className="flex items-center justify-between p-3 bg-muted rounded-lg"
                                >
                                  <div>
                                    <div className="font-medium">{appointment.client?.name}</div>
                                    <div className="text-sm text-muted-foreground">
                                      {appointment.service?.name} - {(() => {
                                        // Compensar fuso horário para exibição correta
                                        const appointmentDate = new Date(appointment.date);
                                        const adjustedDate = new Date(appointmentDate.getTime() + (3 * 60 * 60 * 1000));
                                        return format(adjustedDate, 'HH:mm');
                                      })()}
                                    </div>
                                  </div>
                                  <div className="text-right">
                                    <div className="font-medium">
                                      R$ {appointment.service?.price ? (appointment.service.price / 100).toFixed(2) : '0.00'}
                                    </div>
                                    <div className={`text-xs px-2 py-1 rounded-full ${
                                      appointment.status === 'completed' 
                                        ? 'bg-green-100 text-green-800' 
                                        : appointment.status === 'cancelled'
                                        ? 'bg-red-100 text-red-800'
                                        : 'bg-yellow-100 text-yellow-800'
                                    }`}>
                                      {appointment.status === 'completed' ? 'Concluído' :
                                       appointment.status === 'cancelled' ? 'Cancelado' : 'Agendado'}
                                    </div>
                                  </div>
                                </div>
                              ))}
                            </div>
                          </CardContent>
                        </Card>
                      ))}
                  </div>
                </ScrollArea>
              )}
            </div>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}

function EmployeeServices({ employeeId }: { employeeId: number }) {
  const { data: employeeServices = [] } = useQuery<Service[]>({
    queryKey: ["/api/employees", employeeId, "services"],
    queryFn: async () => {
      const response = await apiRequest("GET", `/api/employees/${employeeId}/services`);
      return response.json();
    }
  });

  if (employeeServices.length === 0) {
    return (
      <div className="text-xs text-muted-foreground mb-3">
        Nenhum serviço associado
      </div>
    );
  }

  return (
    <div className="mb-3">
      <div className="text-xs font-medium text-muted-foreground mb-1">
        Serviços:
      </div>
      <div className="flex flex-wrap gap-1">
        {employeeServices.map((service) => (
          <Badge key={service.id} variant="secondary" className="text-xs">
            {service.name}
          </Badge>
        ))}
      </div>
    </div>
  );
}

export default function TeamPage() {
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [editingEmployee, setEditingEmployee] = useState<Employee | null>(null);
  const [servicesDialogOpen, setServicesDialogOpen] = useState(false);
  const [scheduleDialogOpen, setScheduleDialogOpen] = useState(false);
  const [selectedEmployee, setSelectedEmployee] = useState<Employee | null>(null);
  const [selectedServiceIds, setSelectedServiceIds] = useState<number[]>([]);
  const [showInactive, setShowInactive] = useState(false);
  const { toast } = useToast();
  const { user } = useAuth();
  const queryClient = useQueryClient();

  // Verificar se o usuário tem conta do tipo empresa
  if (user && user.accountType !== 'company') {
    return (
      <div className="container mx-auto py-8">
        <Card>
          <CardContent className="pt-6">
            <div className="text-center">
              <Users className="mx-auto h-12 w-12 text-gray-400 mb-4" />
              <h3 className="text-lg font-medium text-gray-900 mb-2">
                Acesso Restrito
              </h3>
              <p className="text-gray-500 mb-4">
                Esta funcionalidade está disponível apenas para contas do tipo empresa.
              </p>
              <p className="text-sm text-gray-400">
                Altere o tipo da sua conta nas configurações para acessar o gerenciamento de equipe.
              </p>
            </div>
          </CardContent>
        </Card>
      </div>
    );
  }

  // Buscar funcionários (ativos ou inativos baseado no estado)
  const { data: employees = [], isLoading, error } = useQuery<Employee[]>({
    queryKey: ["/api/employees", showInactive ? "all" : "active"],
    queryFn: async () => {
      const params = showInactive ? "" : "?active=true";
      const response = await apiRequest("GET", `/api/employees${params}`);
      return response.json();
    }
  });

  // Buscar serviços disponíveis do provider
  const { data: services = [] } = useQuery<Service[]>({
    queryKey: ["/api/my-services"],
    queryFn: async () => {
      const response = await apiRequest("GET", "/api/my-services");
      return response.json();
    }
  });

  // Buscar serviços do funcionário selecionado
  const { data: employeeServices = [], refetch: refetchEmployeeServices } = useQuery<Service[]>({
    queryKey: ["/api/employees", selectedEmployee?.id, "services"],
    queryFn: async () => {
      if (!selectedEmployee?.id) return [];
      const response = await apiRequest("GET", `/api/employees/${selectedEmployee.id}/services`);
      return response.json();
    },
    enabled: !!selectedEmployee?.id
  });

  // Formulário
  const form = useForm<EmployeeFormData>({
    resolver: zodResolver(employeeFormSchema),
    defaultValues: {
      name: "",
      specialty: "",
      lunchBreakStart: "12:00",
      lunchBreakEnd: "13:00",
      isActive: true,
    }
  });

  // Mutation para criar funcionário
  const createEmployeeMutation = useMutation({
    mutationFn: async (data: EmployeeFormData) => {
      const response = await apiRequest("POST", "/api/employees", data);
      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/employees"] });
      toast({
        title: "Funcionário adicionado",
        description: "O funcionário foi adicionado com sucesso à sua equipe.",
      });
      setIsDialogOpen(false);
      form.reset();
    },
    onError: (error: any) => {
      toast({
        title: "Erro ao adicionar funcionário",
        description: error.message || "Ocorreu um erro ao adicionar o funcionário.",
        variant: "destructive",
      });
    }
  });

  // Mutation para atualizar funcionário
  const updateEmployeeMutation = useMutation({
    mutationFn: async ({ id, data }: { id: number; data: EmployeeFormData }) => {
      const response = await apiRequest("PATCH", `/api/employees/${id}`, data);
      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/employees"] });
      toast({
        title: "Funcionário atualizado",
        description: "Os dados do funcionário foram atualizados com sucesso.",
      });
      setIsDialogOpen(false);
      setEditingEmployee(null);
      form.reset();
    },
    onError: (error: any) => {
      toast({
        title: "Erro ao atualizar funcionário",
        description: error.message || "Ocorreu um erro ao atualizar o funcionário.",
        variant: "destructive",
      });
    }
  });

  // Mutation para excluir/desativar funcionário
  const deleteEmployeeMutation = useMutation({
    mutationFn: async (id: number) => {
      const response = await apiRequest("DELETE", `/api/employees/${id}`);
      return response.json();
    },
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ["/api/employees"] });
      const message = data.action === "deleted" 
        ? "Funcionário excluído permanentemente" 
        : "Funcionário desativado devido a agendamentos existentes";
      toast({
        title: data.action === "deleted" ? "Funcionário excluído" : "Funcionário desativado",
        description: message,
      });
    },
    onError: (error: any) => {
      toast({
        title: "Erro ao remover funcionário",
        description: error.message || "Ocorreu um erro ao remover o funcionário.",
        variant: "destructive",
      });
    }
  });

  // Mutation para reativar funcionário
  const reactivateEmployeeMutation = useMutation({
    mutationFn: async (id: number) => {
      const response = await apiRequest("PATCH", `/api/employees/${id}/reactivate`);
      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/employees"] });
      toast({
        title: "Funcionário reativado",
        description: "O funcionário foi reativado com sucesso.",
      });
    },
    onError: (error: any) => {
      toast({
        title: "Erro ao reativar funcionário",
        description: error.message || "Ocorreu um erro ao reativar o funcionário.",
        variant: "destructive",
      });
    }
  });

  // Mutation para atualizar serviços do funcionário
  const updateEmployeeServicesMutation = useMutation({
    mutationFn: async ({ employeeId, serviceIds }: { employeeId: number; serviceIds: number[] }) => {
      const response = await apiRequest("POST", `/api/employees/${employeeId}/services`, { serviceIds });
      return response.json();
    },
    onSuccess: () => {
      refetchEmployeeServices();
      toast({
        title: "Serviços atualizados",
        description: "Os serviços do funcionário foram atualizados com sucesso.",
      });
      setServicesDialogOpen(false);
    },
    onError: (error: any) => {
      toast({
        title: "Erro ao atualizar serviços",
        description: error.message || "Ocorreu um erro ao atualizar os serviços.",
        variant: "destructive",
      });
    }
  });

  const handleSubmit = (data: EmployeeFormData) => {
    if (editingEmployee) {
      updateEmployeeMutation.mutate({ id: editingEmployee.id, data });
    } else {
      createEmployeeMutation.mutate(data);
    }
  };

  const handleEdit = (employee: Employee) => {
    setEditingEmployee(employee);
    form.reset({
      name: employee.name,
      specialty: employee.specialty,
      lunchBreakStart: employee.lunchBreakStart || "",
      lunchBreakEnd: employee.lunchBreakEnd || "",
      isActive: employee.isActive,
    });
    setIsDialogOpen(true);
  };

  // Função para calcular automaticamente o fim do almoço (+1 hora)
  const handleLunchStartChange = (value: string) => {
    if (value && value.match(/^\d{2}:\d{2}$/)) {
      const [hour, minute] = value.split(':').map(Number);
      let endHour = hour + 1;
      
      // Garantir que não passe de 23:59
      if (endHour > 23) {
        endHour = 23;
      }
      
      const endTime = `${endHour.toString().padStart(2, '0')}:${minute.toString().padStart(2, '0')}`;
      form.setValue('lunchBreakEnd', endTime);
    }
  };

  const handleDelete = (employee: Employee) => {
    if (confirm(`Tem certeza que deseja remover ${employee.name} da equipe?`)) {
      deleteEmployeeMutation.mutate(employee.id);
    }
  };

  const handleManageServices = (employee: Employee) => {
    setSelectedEmployee(employee);
    setServicesDialogOpen(true);
    // Reset selected services - will be populated by the query
    setSelectedServiceIds([]);
  };

  const handleViewSchedule = (employee: Employee) => {
    setSelectedEmployee(employee);
    setScheduleDialogOpen(true);
  };

  // Effect to update selected service IDs when employee services are loaded
  useEffect(() => {
    if (selectedEmployee && employeeServices.length >= 0) {
      const serviceIds = employeeServices.map(service => service.id);
      setSelectedServiceIds(serviceIds);
    }
  }, [employeeServices, selectedEmployee?.id]);

  const handleServiceToggle = (serviceId: number, checked: boolean) => {
    if (checked) {
      setSelectedServiceIds(prev => [...prev, serviceId]);
    } else {
      setSelectedServiceIds(prev => prev.filter(id => id !== serviceId));
    }
  };

  const handleSaveServices = () => {
    if (selectedEmployee) {
      updateEmployeeServicesMutation.mutate({
        employeeId: selectedEmployee.id,
        serviceIds: selectedServiceIds
      });
    }
  };

  const openAddDialog = () => {
    setEditingEmployee(null);
    form.reset({
      name: "",
      specialty: "",
      lunchBreakStart: "",
      lunchBreakEnd: "",
      isActive: true,
    });
    setIsDialogOpen(true);
  };

  if (error) {
    return (
      <div className="container mx-auto py-8">
        <Card>
          <CardContent className="pt-6">
            <p className="text-center text-muted-foreground">
              Erro ao carregar a equipe. Verifique se você tem uma conta do tipo empresa.
            </p>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <PageHeader 
        title="Gerenciar Equipe" 
        description="Gerencie os funcionários da sua empresa"
      >
        <div className="flex flex-col gap-2 sm:flex-row sm:gap-2">
          <Button
            variant="outline"
            onClick={() => setShowInactive(!showInactive)}
            className="w-full sm:w-auto"
          >
            {showInactive ? "Ver Ativos" : "Ver Inativos"}
          </Button>

          <Button onClick={openAddDialog} className="w-full sm:w-auto">
            <Plus className="mr-2 h-4 w-4" />
            Adicionar Funcionário
          </Button>
        </div>
      </PageHeader>

      <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
        <DialogTrigger asChild>
          <div style={{ display: 'none' }} />
        </DialogTrigger>
        <DialogContent className="max-w-md max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>
              {editingEmployee ? "Editar Funcionário" : "Adicionar Funcionário"}
            </DialogTitle>
            <DialogDescription>
              {editingEmployee 
                ? "Atualize as informações do funcionário" 
                : "Adicione um novo funcionário à sua equipe"}
            </DialogDescription>
          </DialogHeader>

          <Form {...form}>
            <form onSubmit={form.handleSubmit(handleSubmit)} className="space-y-4">
              <FormField
                control={form.control}
                name="name"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Nome Completo</FormLabel>
                    <FormControl>
                      <Input placeholder="Digite o nome do funcionário" {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <FormField
                control={form.control}
                name="specialty"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Especialidade</FormLabel>
                    <FormControl>
                      <Input placeholder="Ex: Corte, Coloração, Manicure..." {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <FormField
                  control={form.control}
                  name="lunchBreakStart"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Início do Almoço (24h)</FormLabel>
                      <FormControl>
                        <Input 
                          type="time" 
                          placeholder="13:00"
                          {...field} 
                          onChange={(e) => {
                            field.onChange(e);
                            handleLunchStartChange(e.target.value);
                          }}
                        />
                      </FormControl>
                      <FormDescription className="text-xs">
                        Formato 24h - ex: 13:00 para 1:00 PM
                      </FormDescription>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                <FormField
                  control={form.control}
                  name="lunchBreakEnd"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Fim do Almoço (24h)</FormLabel>
                      <FormControl>
                        <Input 
                          type="time" 
                          placeholder="14:00"
                          {...field} 
                        />
                      </FormControl>
                      <FormDescription className="text-xs">
                        Formato 24h - ex: 14:00 para 2:00 PM
                      </FormDescription>
                      <FormMessage />
                    </FormItem>
                  )}
                />
              </div>

              <FormField
                control={form.control}
                name="isActive"
                render={({ field }) => (
                  <FormItem className="flex flex-row items-center justify-between rounded-lg border p-4">
                    <div className="space-y-0.5">
                      <FormLabel className="text-base">Funcionário Ativo</FormLabel>
                      <FormDescription>
                        Desmarque para desabilitar o funcionário sem perder o histórico
                      </FormDescription>
                    </div>
                    <FormControl>
                      <Switch
                        checked={field.value}
                        onCheckedChange={field.onChange}
                      />
                    </FormControl>
                  </FormItem>
                )}
              />

              <div className="flex flex-col sm:flex-row gap-2 pt-4">
                <Button 
                  type="submit" 
                  disabled={createEmployeeMutation.isPending || updateEmployeeMutation.isPending}
                  className="flex-1"
                >
                  {editingEmployee ? "Atualizar" : "Adicionar"}
                </Button>
                <Button 
                  type="button" 
                  variant="outline" 
                  onClick={() => {
                    setIsDialogOpen(false);
                    setEditingEmployee(null);
                    form.reset();
                  }}
                  className="flex-1"
                >
                  Cancelar
                </Button>
              </div>
            </form>
          </Form>
        </DialogContent>
      </Dialog>

      {isLoading ? (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {[...Array(3)].map((_, i) => (
            <Card key={i} className="animate-pulse">
              <CardHeader className="pb-3">
                <div className="h-4 bg-gray-200 rounded w-3/4"></div>
                <div className="h-3 bg-gray-200 rounded w-1/2"></div>
              </CardHeader>
              <CardContent className="pt-0">
                <div className="h-3 bg-gray-200 rounded w-full mb-2"></div>
                <div className="h-3 bg-gray-200 rounded w-2/3"></div>
              </CardContent>
            </Card>
          ))}
        </div>
      ) : employees.length === 0 ? (
        <Card>
          <CardContent className="pt-6">
            <div className="text-center">
              <Users className="mx-auto h-12 w-12 text-gray-400 mb-4" />
              <h3 className="text-lg font-medium text-gray-900 mb-2">
                Nenhum funcionário cadastrado
              </h3>
              <p className="text-gray-500 mb-4">
                Comece adicionando funcionários à sua equipe
              </p>
              <Button onClick={openAddDialog}>
                <Plus className="mr-2 h-4 w-4" />
                Adicionar Primeiro Funcionário
              </Button>
            </div>
          </CardContent>
        </Card>
      ) : (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {employees.map((employee) => (
            <Card key={employee.id}>
              <CardHeader className="pb-3">
                <div className="flex items-start justify-between gap-2">
                  <div className="min-w-0 flex-1">
                    <CardTitle className="text-lg truncate">{employee.name}</CardTitle>
                    <CardDescription className="truncate">{employee.specialty}</CardDescription>
                  </div>
                  <Badge variant={employee.isActive ? "default" : "secondary"} className="shrink-0">
                    {employee.isActive ? "Ativo" : "Inativo"}
                  </Badge>
                </div>
              </CardHeader>
              <CardContent className="pt-0">
                <div className="flex items-center gap-2 text-sm text-muted-foreground mb-3">
                  <Clock className="h-4 w-4 shrink-0" />
                  <span className="truncate">
                    Almoço: {employee.lunchBreakStart} - {employee.lunchBreakEnd}
                  </span>
                </div>

                <EmployeeServices employeeId={employee.id} />
                
                <div className="flex gap-2 flex-wrap">
                  <Button 
                    variant="outline" 
                    size="sm"
                    onClick={() => handleViewSchedule(employee)}
                  >
                    <Calendar className="mr-1 h-3 w-3" />
                    Agenda
                  </Button>
                  <Button 
                    variant="outline" 
                    size="sm"
                    onClick={() => handleManageServices(employee)}
                  >
                    <Settings className="mr-1 h-3 w-3" />
                    Serviços
                  </Button>
                  <Button 
                    variant="outline" 
                    size="sm"
                    onClick={() => handleEdit(employee)}
                  >
                    <Edit className="mr-1 h-3 w-3" />
                    Editar
                  </Button>
                  {!employee.isActive ? (
                    <Button 
                      variant="outline" 
                      size="sm"
                      onClick={() => reactivateEmployeeMutation.mutate(employee.id)}
                      disabled={reactivateEmployeeMutation.isPending}
                    >
                      <RefreshCw className="mr-1 h-3 w-3" />
                      Reativar
                    </Button>
                  ) : (
                    <Button 
                      variant="outline" 
                      size="sm"
                      onClick={() => handleDelete(employee)}
                      disabled={deleteEmployeeMutation.isPending}
                    >
                      <Trash2 className="mr-1 h-3 w-3" />
                      Remover
                    </Button>
                  )}
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      {/* Diálogo para gerenciar serviços do funcionário */}
      <Dialog open={servicesDialogOpen} onOpenChange={setServicesDialogOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>
              Gerenciar Serviços - {selectedEmployee?.name}
            </DialogTitle>
            <DialogDescription>
              Selecione os serviços que este funcionário pode realizar.
            </DialogDescription>
          </DialogHeader>

          <ScrollArea className="max-h-80">
            <div className="space-y-3">
              {services.length === 0 ? (
                <p className="text-sm text-muted-foreground text-center py-4">
                  Nenhum serviço cadastrado. Cadastre serviços primeiro na página de Serviços.
                </p>
              ) : (
                services.map((service) => (
                  <div key={service.id} className="flex items-center space-x-2">
                    <Checkbox
                      id={`service-${service.id}`}
                      checked={selectedServiceIds.includes(service.id)}
                      onCheckedChange={(checked) => 
                        handleServiceToggle(service.id, checked as boolean)
                      }
                    />
                    <label
                      htmlFor={`service-${service.id}`}
                      className="text-sm font-medium leading-none peer-disabled:cursor-not-allowed peer-disabled:opacity-70 flex-1 cursor-pointer"
                    >
                      <div>
                        <div className="font-medium">{service.name}</div>
                        <div className="text-xs text-muted-foreground">
                          {service.duration}min - R$ {(service.price / 100).toFixed(2)}
                        </div>
                      </div>
                    </label>
                  </div>
                ))
              )}
            </div>
          </ScrollArea>

          <div className="flex gap-2 pt-4">
            <Button 
              onClick={handleSaveServices}
              disabled={updateEmployeeServicesMutation.isPending || services.length === 0}
              className="flex-1"
            >
              Salvar Serviços
            </Button>
            <Button 
              variant="outline" 
              onClick={() => setServicesDialogOpen(false)}
              className="flex-1"
            >
              Cancelar
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      {/* Diálogo de agenda resumida do funcionário */}
      <EmployeeScheduleDialog 
        employee={selectedEmployee}
        open={scheduleDialogOpen}
        onOpenChange={setScheduleDialogOpen}
      />
    </div>
  );
}