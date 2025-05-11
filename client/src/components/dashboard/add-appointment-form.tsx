import React, { useState, useEffect } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import * as z from "zod";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import { Calendar } from "@/components/ui/calendar";
import { CalendarIcon, Search } from "lucide-react";
import { cn, formatDuration, formatCurrency } from "@/lib/utils";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useToast } from "@/hooks/use-toast";
import { useQuery } from "@tanstack/react-query";
import { queryClient } from "@/lib/queryClient";
import { PhoneInput } from "@/components/ui/phone-input";
import { apiRequest } from "@/lib/queryClient";
import { Client, Service, AppointmentStatus } from "@shared/schema";
import { generateTimeSlots } from "@/lib/utils";
import { combineDateAndTime } from "@/lib/dates";

const formSchema = z.object({
  clientId: z.coerce.number().min(1, "Selecione um cliente"),
  serviceId: z.coerce.number().min(1, "Selecione um serviço"),
  date: z.date(),
  time: z.string().min(1, "Selecione um horário"),
  notes: z.string().optional(),
});

type FormValues = z.infer<typeof formSchema>;

interface AddAppointmentFormProps {
  providerId: number;
  initialDate?: Date;
  appointmentId?: number | null;
  initialClientId?: number;
  initialServiceId?: number;
  initialNotes?: string;
  onComplete?: () => void;
}

const AddAppointmentForm: React.FC<AddAppointmentFormProps> = ({
  providerId,
  initialDate,
  appointmentId = null,
  initialClientId,
  initialServiceId,
  initialNotes = "",
  onComplete,
}) => {
  const { toast } = useToast();
  const [newClientName, setNewClientName] = useState("");
  const [newClientPhone, setNewClientPhone] = useState("");
  const [showNewClientForm, setShowNewClientForm] = useState(false);
  const [searchTerm, setSearchTerm] = useState("");

  // Get services for this provider (usando a rota protegida)
  const { data: services, isLoading: servicesLoading } = useQuery({
    queryKey: ['/api/my-services'],
    queryFn: async () => {
      const res = await fetch('/api/my-services');
      if (!res.ok) throw new Error('Failed to fetch services');
      return res.json();
    }
  });

  // Get all clients
  const { data: clients, isLoading: clientsLoading } = useQuery({
    queryKey: ['/api/clients'],
    queryFn: async ({ queryKey }) => {
      const res = await fetch('/api/clients');
      if (!res.ok) throw new Error('Failed to fetch clients');
      return res.json();
    }
  });

  // Initialize form with default values
  const form = useForm<FormValues>({
    resolver: zodResolver(formSchema),
    defaultValues: {
      clientId: initialClientId || 0,
      serviceId: initialServiceId || 0,
      date: initialDate || new Date(),
      time: initialDate ? format(initialDate, "HH:mm") : "",
      notes: initialNotes || "",
    },
  });

  // Update form values when initial values change
  useEffect(() => {
    if (initialDate) {
      form.setValue("date", initialDate);
      form.setValue("time", format(initialDate, "HH:mm"));
    }
    if (initialClientId) {
      form.setValue("clientId", initialClientId);
    }
    if (initialServiceId) {
      form.setValue("serviceId", initialServiceId);
    }
    if (initialNotes) {
      form.setValue("notes", initialNotes);
    }
  }, [initialDate, initialClientId, initialServiceId, initialNotes, form]);

  // Filter clients based on search term
  const filteredClients = clients?.filter((client: any) => {
    if (!searchTerm) return true;
    return (
      client.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
      client.phone.includes(searchTerm)
    );
  });

  const handleCreateClient = async () => {
    if (!newClientName || !newClientPhone) {
      toast({
        title: "Erro",
        description: "Nome e telefone são obrigatórios",
        variant: "destructive",
      });
      return;
    }

    try {
      const response = await apiRequest("POST", "/api/clients", {
        name: newClientName,
        phone: newClientPhone,
        email: "",
        notes: "",
      });

      const newClient = await response.json();

      // Update the clients list
      queryClient.invalidateQueries({ queryKey: ['/api/clients'] });

      // Set the form value
      form.setValue("clientId", newClient.id);

      // Reset the form
      setNewClientName("");
      setNewClientPhone("");
      setShowNewClientForm(false);

      toast({
        title: "Cliente criado",
        description: "Cliente criado com sucesso",
      });
    } catch (error) {
      toast({
        title: "Erro",
        description: "Falha ao criar cliente",
        variant: "destructive",
      });
    }
  };

  const onSubmit = async (data: FormValues) => {
    try {
      // Combine date and time to create appointment date
      const appointmentDate = combineDateAndTime(data.date, data.time);
      
      // Get service to calculate end time
      const service = services?.find((s: any) => s.id === data.serviceId);
      if (!service) {
        toast({
          title: "Erro",
          description: "Serviço não encontrado",
          variant: "destructive",
        });
        return;
      }
      
      // Calculate end time
      const endTime = new Date(appointmentDate.getTime() + service.duration * 60000);
      
      // Check availability first usando a nova API protegida
      const myProvider = provider || await (await fetch('/api/my-provider')).json();
      
      const availabilityCheck = await fetch(
        `/api/providers/${myProvider.id}/availability?date=${appointmentDate.toISOString()}&serviceId=${data.serviceId}&bySystemUser=true`
      );
      
      const { available } = await availabilityCheck.json();
      
      // If editing, we need to bypass availability check for the same appointment
      if (!available && !appointmentId) {
        toast({
          title: "Horário indisponível",
          description: "Este horário já está ocupado. Por favor, escolha outro.",
          variant: "destructive",
        });
        return;
      }
      
      if (appointmentId) {
        // Update appointment logic
        await apiRequest("PATCH", `/api/appointments/${appointmentId}/status`, {
          status: AppointmentStatus.CONFIRMED,
        });
        
        toast({
          title: "Agendamento atualizado",
          description: "Agendamento atualizado com sucesso",
        });
      } else {
        // Create appointment usando o ID do provider obtido da rota protegida
        const response = await apiRequest("POST", "/api/appointments", {
          providerId: myProvider.id, // Usar o ID do provider atual
          clientId: data.clientId,
          serviceId: data.serviceId,
          date: appointmentDate, // Enviando o objeto Date diretamente
          endTime: endTime, // Enviando o objeto Date diretamente
          status: AppointmentStatus.CONFIRMED,
          notes: data.notes || "",
        });
        
        toast({
          title: "Agendamento criado",
          description: "Agendamento criado com sucesso",
        });
      }
      
      // Clear form
      form.reset();
      
      // Invalidate queries to refresh data usando as rotas protegidas
      queryClient.invalidateQueries({ queryKey: ['/api/my-appointments'] });
      
      // Call the onComplete callback
      if (onComplete) {
        onComplete();
      }
    } catch (error) {
      console.error(error);
      toast({
        title: "Erro",
        description: "Falha ao criar agendamento",
        variant: "destructive",
      });
    }
  };

  // Buscar configurações do provedor (usando rota protegida)
  const { data: provider } = useQuery({
    queryKey: ["/api/my-provider"],
    queryFn: async () => {
      const res = await fetch(`/api/my-provider`);
      if (!res.ok) throw new Error("Failed to fetch provider");
      return res.json();
    },
  });

  // Mostrar todos os horários (00h às 23h) para o profissional gerenciar sua agenda
  // Sem restrição de horário de trabalho na tela do profissional
  const timeSlots = generateTimeSlots(0, 24, 30);

  return (
    <Form {...form}>
      <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4 max-h-[60vh] md:max-h-[70vh] overflow-y-auto pr-1">
        {/* Client Selection */}
        <div>
          <div className="mb-2 flex items-center justify-between">
            <FormLabel>Cliente</FormLabel>
            <Button
              type="button"
              variant="ghost"
              size="sm"
              onClick={() => setShowNewClientForm(!showNewClientForm)}
            >
              {showNewClientForm ? "Cancelar" : "Novo Cliente"}
            </Button>
          </div>

          {showNewClientForm ? (
            <div className="space-y-3">
              <Input
                placeholder="Nome do cliente"
                value={newClientName}
                onChange={(e) => setNewClientName(e.target.value)}
              />
              <PhoneInput
                placeholder="(xx) xxxxx-xxxx"
                value={newClientPhone}
                onChange={setNewClientPhone}
              />
              <Button
                type="button"
                variant="outline"
                className="w-full"
                onClick={handleCreateClient}
              >
                Salvar Cliente
              </Button>
            </div>
          ) : (
            <>
              <div className="relative mb-2">
                <Input
                  placeholder="Pesquisar cliente..."
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  className="pl-9"
                />
                <Search className="absolute left-3 top-3 h-4 w-4 text-gray-400" />
              </div>

              <FormField
                control={form.control}
                name="clientId"
                render={({ field }) => (
                  <FormItem>
                    <Select
                      onValueChange={field.onChange}
                      defaultValue={field.value.toString()}
                      value={field.value.toString()}
                    >
                      <FormControl>
                        <SelectTrigger>
                          <SelectValue placeholder="Selecione um cliente" />
                        </SelectTrigger>
                      </FormControl>
                      <SelectContent className="max-h-60">
                        {clientsLoading ? (
                          <SelectItem value="loading" disabled>
                            Carregando...
                          </SelectItem>
                        ) : (
                          <>
                            <SelectItem value="0" disabled>
                              Selecione um cliente
                            </SelectItem>
                            {filteredClients?.map((client: any) => (
                              <SelectItem key={client.id} value={client.id.toString()}>
                                {client.name} - {client.phone}
                              </SelectItem>
                            ))}
                          </>
                        )}
                      </SelectContent>
                    </Select>
                    <FormMessage />
                  </FormItem>
                )}
              />
            </>
          )}
        </div>

        {/* Service Selection */}
        <FormField
          control={form.control}
          name="serviceId"
          render={({ field }) => (
            <FormItem>
              <FormLabel>Serviço</FormLabel>
              <Select
                onValueChange={field.onChange}
                defaultValue={field.value.toString()}
                value={field.value.toString()}
              >
                <FormControl>
                  <SelectTrigger>
                    <SelectValue placeholder="Selecione um serviço" />
                  </SelectTrigger>
                </FormControl>
                <SelectContent>
                  {servicesLoading ? (
                    <SelectItem value="loading" disabled>
                      Carregando...
                    </SelectItem>
                  ) : (
                    <>
                      <SelectItem value="0" disabled>
                        Selecione um serviço
                      </SelectItem>
                      {services?.map((service: Service) => (
                        <SelectItem key={service.id} value={service.id.toString()}>
                          {service.name} - {formatDuration(service.duration)} - {formatCurrency(service.price)}
                        </SelectItem>
                      ))}
                    </>
                  )}
                </SelectContent>
              </Select>
              <FormMessage />
            </FormItem>
          )}
        />

        {/* Date and Time Selection */}
        <div className="grid grid-cols-2 gap-4">
          <FormField
            control={form.control}
            name="date"
            render={({ field }) => (
              <FormItem className="flex flex-col">
                <FormLabel>Data</FormLabel>
                <Popover>
                  <PopoverTrigger asChild>
                    <FormControl>
                      <Button
                        variant={"outline"}
                        className={cn(
                          "pl-3 text-left font-normal",
                          !field.value && "text-muted-foreground"
                        )}
                      >
                        {field.value ? (
                          format(field.value, "dd/MM/yyyy", { locale: ptBR })
                        ) : (
                          <span>Escolha uma data</span>
                        )}
                        <CalendarIcon className="ml-auto h-4 w-4 opacity-50" />
                      </Button>
                    </FormControl>
                  </PopoverTrigger>
                  <PopoverContent className="w-auto p-0" align="start">
                    <Calendar
                      mode="single"
                      selected={field.value}
                      onSelect={field.onChange}
                      disabled={(date) => date < new Date()}
                      initialFocus
                    />
                  </PopoverContent>
                </Popover>
                <FormMessage />
              </FormItem>
            )}
          />

          <FormField
            control={form.control}
            name="time"
            render={({ field }) => (
              <FormItem>
                <FormLabel>Horário</FormLabel>
                <Select onValueChange={field.onChange} defaultValue={field.value}>
                  <FormControl>
                    <SelectTrigger>
                      <SelectValue placeholder="Escolha um horário" />
                    </SelectTrigger>
                  </FormControl>
                  <SelectContent>
                    {timeSlots.map((time) => (
                      <SelectItem key={time} value={time}>
                        {time}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                <FormMessage />
              </FormItem>
            )}
          />
        </div>

        {/* Notes */}
        <FormField
          control={form.control}
          name="notes"
          render={({ field }) => (
            <FormItem>
              <FormLabel>Observações</FormLabel>
              <FormControl>
                <Textarea
                  placeholder="Informações adicionais sobre o agendamento"
                  {...field}
                  className="resize-none"
                />
              </FormControl>
              <FormMessage />
            </FormItem>
          )}
        />

        <Button type="submit" className="w-full">
          {appointmentId ? "Atualizar Agendamento" : "Criar Agendamento"}
        </Button>
      </form>
    </Form>
  );
};

export default AddAppointmentForm;
