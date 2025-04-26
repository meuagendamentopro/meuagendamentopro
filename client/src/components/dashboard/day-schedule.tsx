import React, { useEffect } from "react";
import { format, parseISO, isToday, addDays, isBefore } from "date-fns";
import { ptBR } from "date-fns/locale";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { 
  ChevronLeft, 
  ChevronRight, 
  Calendar as CalendarIcon,
  Edit,
  X,
  Filter,
  Clock,
  RefreshCw
} from "lucide-react";
import { Appointment, AppointmentStatus, Client, Service } from "@shared/schema";
import { cn, generateTimeSlots } from "@/lib/utils";
import { formatTime } from "@/lib/dates";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger } from "@/components/ui/alert-dialog";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { apiRequest } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import AddAppointmentForm from "./add-appointment-form";

interface TimeSlotProps {
  time: string;
  children?: React.ReactNode;
}

const TimeSlot: React.FC<TimeSlotProps> = ({ time, children }) => {
  return (
    <div className="flex group">
      <div className="flex-none w-20 text-right pr-4 text-sm text-gray-500 pt-1">
        {time}
      </div>
      <div className="flex-grow">
        {children}
      </div>
    </div>
  );
};

interface AppointmentItemProps {
  appointment: Appointment;
  client: { name: string; phone: string };
  service: { name: string; duration: number };
  onEdit: (id: number) => void;
  onCancel: (id: number) => void;
}

const AppointmentItem: React.FC<AppointmentItemProps> = ({ 
  appointment, 
  client, 
  service,
  onEdit,
  onCancel
}) => {
  // Garantir que estamos usando o horário de término armazenado
  const appointmentEndTime = appointment.endTime ? new Date(appointment.endTime) : 
    new Date(new Date(appointment.date).getTime() + service.duration * 60000);
  let statusColor = "bg-primary-50 border-primary-500";
  let statusHover = "group-hover:bg-primary-100";
  let textColor = "text-primary-800";
  let nameColor = "text-primary-600";

  if (appointment.status === AppointmentStatus.CONFIRMED) {
    statusColor = "bg-success-50 border-success-500";
    statusHover = "group-hover:bg-success-100";
    textColor = "text-gray-800";
    nameColor = "text-gray-600";
  } else if (appointment.status === AppointmentStatus.PENDING) {
    statusColor = "bg-warning-50 border-warning-500";
    statusHover = "group-hover:bg-warning-100";
    textColor = "text-gray-800";
    nameColor = "text-gray-600";
  } else if (appointment.status === AppointmentStatus.CANCELLED) {
    statusColor = "bg-gray-50 border-gray-300";
    statusHover = "group-hover:bg-gray-100";
    textColor = "text-gray-800";
    nameColor = "text-gray-600";
  }

  return (
    <div className={cn(
      "p-3 border-l-4 rounded-r-md transition",
      statusColor,
      statusHover
    )}>
      <div className="flex justify-between">
        <div>
          <p className={cn("font-medium", textColor)}>{service.name}</p>
          <p className={cn("text-sm", nameColor)}>
            {client.name} 
            <span className="text-xs ml-1 text-gray-500">
              ({formatTime(new Date(appointment.date))} - {formatTime(appointmentEndTime)})
            </span>
          </p>
        </div>
        <div className="flex space-x-2">
          <button 
            className="text-gray-400 hover:text-primary-600 transition"
            onClick={() => onEdit(appointment.id)}
          >
            <Edit className="h-4 w-4" />
          </button>
          <AlertDialog>
            <AlertDialogTrigger asChild>
              <button className="text-gray-400 hover:text-danger-500 transition">
                <X className="h-4 w-4" />
              </button>
            </AlertDialogTrigger>
            <AlertDialogContent>
              <AlertDialogHeader>
                <AlertDialogTitle>Cancelar agendamento</AlertDialogTitle>
                <AlertDialogDescription>
                  Tem certeza que deseja cancelar o agendamento de {client.name} para {service.name}?
                </AlertDialogDescription>
              </AlertDialogHeader>
              <AlertDialogFooter>
                <AlertDialogCancel>Não, manter</AlertDialogCancel>
                <AlertDialogAction 
                  className="bg-red-600 hover:bg-red-700"
                  onClick={() => onCancel(appointment.id)}
                >
                  Sim, cancelar
                </AlertDialogAction>
              </AlertDialogFooter>
            </AlertDialogContent>
          </AlertDialog>
        </div>
      </div>
    </div>
  );
};

interface EmptySlotProps {
  time: Date;
  onAddAppointment: (time: Date) => void;
}

const EmptySlot: React.FC<EmptySlotProps> = ({ time, onAddAppointment }) => {
  // Obter a data e hora atuais
  const now = new Date();
  
  // Verificar se o slot está no passado apenas se a data for hoje
  // Se for uma data futura, todos os slots são considerados válidos
  // Se for uma data passada, todos os slots são considerados inválidos
  
  const today = new Date();
  const isToday = 
    time.getDate() === today.getDate() &&
    time.getMonth() === today.getMonth() &&
    time.getFullYear() === today.getFullYear();
  
  // Apenas verifica se é passado quando estamos olhando para o dia atual
  const isPast = isToday && time.getTime() < now.getTime();
  
  console.log(`Verificando horário: ${time.toLocaleString()} - Hora atual: ${now.toLocaleString()} - É mesmo dia? ${isToday} - É passado? ${isPast}`);

  return (
    <div 
      className={cn(
        "p-3 bg-gray-50 border-l-4 border-gray-200 rounded-r-md group-hover:bg-gray-100 transition min-h-[60px] flex items-center justify-center",
        isPast && "opacity-50"
      )}
    >
      <button 
        className="text-gray-400 hover:text-primary-600 text-xs font-medium uppercase tracking-wider"
        onClick={() => onAddAppointment(time)}
        disabled={isPast}
      >
        <CalendarIcon className="h-4 w-4 mr-1 inline" /> Adicionar
      </button>
    </div>
  );
};

interface DayScheduleProps {
  providerId: number;
}

const DaySchedule: React.FC<DayScheduleProps> = ({ providerId }) => {
  const [selectedDate, setSelectedDate] = React.useState<Date>(new Date());
  const [addAppointmentTime, setAddAppointmentTime] = React.useState<Date | null>(null);
  const [editAppointmentId, setEditAppointmentId] = React.useState<number | null>(null);
  const [filterStartHour, setFilterStartHour] = React.useState<number>(0);
  const [filterEndHour, setFilterEndHour] = React.useState<number>(24);
  const [showFilterOptions, setShowFilterOptions] = React.useState<boolean>(false);
  const [isRefreshing, setIsRefreshing] = React.useState<boolean>(false);
  const queryClient = useQueryClient();
  const { toast } = useToast();
  
  // Buscar as configurações do profissional (utilizando a rota protegida)
  const { data: provider } = useQuery({
    queryKey: ['/api/my-provider'],
    queryFn: async () => {
      const res = await fetch(`/api/my-provider`);
      if (!res.ok) throw new Error('Failed to fetch provider');
      return res.json();
    }
  });

  const { data: appointments, isLoading: appointmentsLoading, refetch: refetchAppointments } = 
    useQuery<Appointment[]>({
      queryKey: ['/api/my-appointments', selectedDate.toISOString().split('T')[0]],
      queryFn: async () => {
        // Usando yyyy-mm-dd sem o T para evitar problemas de fuso horário
        const localDate = `${selectedDate.getFullYear()}-${String(selectedDate.getMonth() + 1).padStart(2, '0')}-${String(selectedDate.getDate()).padStart(2, '0')}`;
        const res = await fetch(`/api/my-appointments?date=${localDate}`);
        if (!res.ok) throw new Error('Failed to fetch appointments');
        return res.json();
      }
    });
    
  // Atualiza dados quando uma mensagem de WebSocket sobre novos agendamentos é recebida
  useEffect(() => {
    // Define a função de callback do WebSocket
    function handleWebSocketMessage(event: MessageEvent) {
      try {
        const data = JSON.parse(event.data);
        if (data.type === 'appointment_created' || data.type === 'appointment_updated') {
          // Invalidar o cache e forçar um refetch
          queryClient.invalidateQueries({ queryKey: ['/api/my-appointments'] });
          refetchAppointments();
        }
      } catch (error) {
        console.error('Erro ao processar mensagem do WebSocket:', error);
      }
    }
    
    // Adiciona o event listener na janela global
    window.addEventListener('message', (event) => {
      // Verifica se a mensagem é do WebSocket
      if (event.data && typeof event.data === 'string' && event.data.startsWith('{')) {
        try {
          const data = JSON.parse(event.data);
          if (data.type === 'websocket-message') {
            handleWebSocketMessage(data.event);
          }
        } catch (e) {
          // Ignora erros de parse JSON
        }
      }
    });
    
    // Define o objeto window.__WEBSOCKET_HANDLERS se não existir
    if (!window.__WEBSOCKET_HANDLERS) {
      window.__WEBSOCKET_HANDLERS = {};
    }
    
    // Registra um handler específico para o componente
    window.__WEBSOCKET_HANDLERS.daySchedule = handleWebSocketMessage;
    
    return () => {
      // Limpa o handler ao desmontar o componente
      if (window.__WEBSOCKET_HANDLERS) {
        delete window.__WEBSOCKET_HANDLERS.daySchedule;
      }
    };
  }, [queryClient, refetchAppointments, selectedDate]);

  const { data: services, isLoading: servicesLoading } = useQuery({
    queryKey: ['/api/my-services'],
    queryFn: async () => {
      const res = await fetch(`/api/my-services`);
      if (!res.ok) throw new Error('Failed to fetch services');
      return res.json();
    }
  });

  const { data: clients, isLoading: clientsLoading } = useQuery({
    queryKey: ['/api/clients'],
    queryFn: async ({ queryKey }) => {
      const res = await fetch('/api/clients');
      if (!res.ok) throw new Error('Failed to fetch clients');
      return res.json();
    }
  });

  const handlePreviousDay = () => {
    setSelectedDate(prev => addDays(prev, -1));
  };

  const handleNextDay = () => {
    setSelectedDate(prev => addDays(prev, 1));
  };

  const handleTodayClick = () => {
    setSelectedDate(new Date());
  };

  const handleAddAppointment = (time: Date) => {
    setAddAppointmentTime(time);
  };

  const handleEditAppointment = (id: number) => {
    setEditAppointmentId(id);
  };

  const handleCancelAppointment = async (id: number) => {
    try {
      // Usando a rota protegida para atualizar o status do agendamento
      await apiRequest('PATCH', `/api/appointments/${id}/status`, { 
        status: AppointmentStatus.CANCELLED 
      });
      refetchAppointments();
    } catch (error) {
      console.error('Failed to cancel appointment:', error);
    }
  };

  const handleCloseDialog = () => {
    setAddAppointmentTime(null);
    setEditAppointmentId(null);
    refetchAppointments();
  };

  // Create time slots based on filter settings
  const timeSlots = React.useMemo(() => {
    // Gerar slots com base nos filtros definidos pelo usuário
    return generateTimeSlots(filterStartHour, filterEndHour, 30);
  }, [filterStartHour, filterEndHour]);

  const isLoading = appointmentsLoading || servicesLoading || clientsLoading;
  
  // Find appointment for a specific time
  const findAppointmentForTime = (timeString: string) => {
    if (!appointments) return null;
    
    // Split the time string to get hours and minutes
    const [hours, minutes] = timeString.split(':').map(Number);
    
    // Abordagem simplificada: verificar cada agendamento para este horário
    const currentTime = new Date(selectedDate);
    currentTime.setHours(hours, minutes, 0, 0);
    
    // Encontrar todos os agendamentos que ocorrem neste horário
    // Um agendamento ocorre no horário se:
    // 1. O horário de início do agendamento é exatamente este horário, OU
    // 2. O horário está entre o início e o fim do agendamento
    
    const result = appointments.find(apt => {
      const startTime = new Date(apt.date);
      const endTime = apt.endTime ? new Date(apt.endTime) : 
        new Date(startTime.getTime() + 30*60000); // Fallback de 30 minutos se não tiver endTime
      
      // Verificar se o horário atual é o início do agendamento
      if (startTime.getHours() === hours && startTime.getMinutes() === minutes) {
        return true;
      }
      
      // Verificar se o horário atual está dentro do intervalo do agendamento (exceto o exato final)
      if (currentTime >= startTime && currentTime < endTime) {
        return true;
      }
      
      return false;
    });
    
    // Log para debug
    if (result) {
      const aptDate = new Date(result.date);
      // Buscar a duração do serviço através da função getServiceDuration
      const service = services?.find(s => s.id === result.serviceId);
      const serviceDuration = service ? service.duration : 30;
      
      const endTime = result.endTime ? new Date(result.endTime) : 
        new Date(aptDate.getTime() + serviceDuration * 60000);
      
      console.log(`✓ Agendamento encontrado para ${timeString}:`, {
        id: result.id,
        inicio: aptDate.toLocaleTimeString(),
        fim: endTime.toLocaleTimeString(),
        data: aptDate.toLocaleDateString()
      });
    }
    
    return result;
  };

  // Get client and service for an appointment
  const getAppointmentDetails = (appointmentId: number) => {
    if (!clients || !services) return { client: null, service: null };
    
    const appointment = appointments?.find(a => a.id === appointmentId);
    if (!appointment) return { client: null, service: null };
    
    const client = clients.find((c: Client) => c.id === appointment.clientId);
    const service = services.find((s: Service) => s.id === appointment.serviceId);
    
    return { client, service };
  };

  const editAppointment = appointments?.find(a => a.id === editAppointmentId);
  const { client: editClient, service: editService } = editAppointmentId 
    ? getAppointmentDetails(editAppointmentId)
    : { client: null, service: null };

  return (
    <>
      <Card>
        <CardHeader className="px-6 pb-4 pt-6 flex flex-row items-center justify-between">
          <div>
            <CardTitle className="text-lg">Agendamentos do dia</CardTitle>
            <p className="mt-1 text-sm text-gray-500">
              {format(selectedDate, "EEEE, d 'de' MMMM 'de' yyyy", { locale: ptBR })}
            </p>
          </div>
          <div className="flex items-center gap-2">
            <Popover>
              <PopoverTrigger asChild>
                <Button variant="outline" size="sm">
                  <Filter className="h-4 w-4 mr-1" /> Filtrar Horários
                </Button>
              </PopoverTrigger>
              <PopoverContent className="w-80">
                <div className="space-y-4">
                  <h4 className="font-medium">Filtrar horários</h4>
                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <p className="text-sm mb-2 text-gray-500">Hora inicial</p>
                      <Select 
                        value={filterStartHour.toString()} 
                        onValueChange={(value) => setFilterStartHour(parseInt(value))}
                      >
                        <SelectTrigger>
                          <SelectValue placeholder="Hora inicial" />
                        </SelectTrigger>
                        <SelectContent>
                          {Array.from({ length: 24 }, (_, i) => (
                            <SelectItem key={i} value={i.toString()}>
                              {i.toString().padStart(2, '0')}:00
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>
                    <div>
                      <p className="text-sm mb-2 text-gray-500">Hora final</p>
                      <Select 
                        value={filterEndHour.toString()} 
                        onValueChange={(value) => setFilterEndHour(parseInt(value))}
                      >
                        <SelectTrigger>
                          <SelectValue placeholder="Hora final" />
                        </SelectTrigger>
                        <SelectContent>
                          {Array.from({ length: 25 }, (_, i) => (
                            <SelectItem key={i} value={i.toString()}>
                              {i === 24 ? "24:00" : `${i.toString().padStart(2, '0')}:00`}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>
                  </div>
                  <div className="flex justify-between">
                    <Button 
                      variant="outline" 
                      size="sm"
                      onClick={() => {
                        setFilterStartHour(0);
                        setFilterEndHour(24);
                      }}
                    >
                      Mostrar todos
                    </Button>
                    <Button 
                      variant="outline" 
                      size="sm"
                      onClick={() => {
                        if (provider) {
                          setFilterStartHour(provider.workingHoursStart || 8);
                          setFilterEndHour(provider.workingHoursEnd || 18);
                        } else {
                          setFilterStartHour(8);
                          setFilterEndHour(18);
                        }
                      }}
                    >
                      Meus horários
                    </Button>
                  </div>
                </div>
              </PopoverContent>
            </Popover>

            <div className="inline-flex shadow-sm rounded-md">
              <Button
                variant="outline"
                size="sm"
                className="rounded-r-none"
                onClick={handlePreviousDay}
              >
                <ChevronLeft className="h-4 w-4 mr-1" /> Anterior
              </Button>
              <Button
                variant="outline"
                size="sm"
                className="rounded-none border-l-0 border-r-0"
                onClick={handleTodayClick}
              >
                Hoje
              </Button>
              <Button
                variant="outline"
                size="sm"
                className="rounded-l-none"
                onClick={handleNextDay}
              >
                Próximo <ChevronRight className="h-4 w-4 ml-1" />
              </Button>
            </div>
          </div>
        </CardHeader>
        <CardContent>
          {isLoading ? (
            <div className="animate-pulse space-y-4">
              {[...Array(6)].map((_, index) => (
                <div key={index} className="flex">
                  <div className="flex-none w-20 text-right pr-4 h-6 bg-gray-200 rounded"></div>
                  <div className="flex-grow h-16 bg-gray-200 rounded"></div>
                </div>
              ))}
            </div>
          ) : (
            <div className="grid grid-cols-1 gap-4">
              {timeSlots.map(time => {
                const appointment = findAppointmentForTime(time);
                
                // Calculate time as Date object for empty slots
                const [hours, minutes] = time.split(':').map(Number);
                
                // Criar um objeto de data para representar o horário do slot
                // Usando a data local (hoje) ao invés de UTC para evitar problemas com fuso horário
                const slotTime = new Date();
                slotTime.setFullYear(selectedDate.getFullYear());
                slotTime.setMonth(selectedDate.getMonth());
                slotTime.setDate(selectedDate.getDate());
                slotTime.setHours(hours);
                slotTime.setMinutes(minutes);
                slotTime.setSeconds(0);
                
                console.log(`Criando slot de tempo: ${time} => ${slotTime.toLocaleString()}`);
                
                
                if (appointment) {
                  const { client, service } = getAppointmentDetails(appointment.id);
                  if (!client || !service) return null;
                  
                  return (
                    <TimeSlot key={time} time={time}>
                      <AppointmentItem 
                        appointment={appointment}
                        client={client}
                        service={service}
                        onEdit={handleEditAppointment}
                        onCancel={handleCancelAppointment}
                      />
                    </TimeSlot>
                  );
                }
                
                return (
                  <TimeSlot key={time} time={time}>
                    <EmptySlot 
                      time={slotTime}
                      onAddAppointment={handleAddAppointment}
                    />
                  </TimeSlot>
                );
              })}
            </div>
          )}
        </CardContent>
      </Card>

      {/* Add Appointment Dialog */}
      <Dialog open={addAppointmentTime !== null} onOpenChange={() => setAddAppointmentTime(null)}>
        <DialogContent className="sm:max-w-[500px]">
          <DialogHeader>
            <DialogTitle>Adicionar Agendamento</DialogTitle>
            <DialogDescription>
              {addAppointmentTime && (
                <>
                  Data: {format(addAppointmentTime, "dd/MM/yyyy")} às {format(addAppointmentTime, "HH:mm")}
                </>
              )}
            </DialogDescription>
          </DialogHeader>
          {addAppointmentTime && (
            <AddAppointmentForm 
              providerId={providerId}
              initialDate={addAppointmentTime}
              onComplete={handleCloseDialog}
            />
          )}
        </DialogContent>
      </Dialog>

      {/* Edit Appointment Dialog */}
      <Dialog open={editAppointmentId !== null} onOpenChange={() => setEditAppointmentId(null)}>
        <DialogContent className="sm:max-w-[500px]">
          <DialogHeader>
            <DialogTitle>Editar Agendamento</DialogTitle>
            <DialogDescription>
              {editAppointment && editClient && editService && (
                <>
                  {editClient.name} - {editService.name} - {formatTime(new Date(editAppointment.date))}
                </>
              )}
            </DialogDescription>
          </DialogHeader>
          {editAppointment && (
            <AddAppointmentForm 
              providerId={providerId}
              initialDate={new Date(editAppointment.date)}
              appointmentId={editAppointmentId}
              initialClientId={editAppointment.clientId}
              initialServiceId={editAppointment.serviceId}
              initialNotes={editAppointment.notes || ""}
              onComplete={handleCloseDialog}
            />
          )}
        </DialogContent>
      </Dialog>
    </>
  );
};

export default DaySchedule;
