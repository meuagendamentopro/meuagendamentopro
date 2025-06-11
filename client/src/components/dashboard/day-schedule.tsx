import React, { useEffect, useState } from "react";
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
  RefreshCw,
  FileText
} from "lucide-react";
import ClinicalNotesModal from "../appointments/clinical-notes-modal";
import { Calendar } from "@/components/ui/calendar";
import { Appointment, AppointmentStatus, Client, Service } from "@shared/schema";
import { cn, generateTimeSlots } from "@/lib/utils";
import { formatTime } from "@/lib/dates";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger } from "@/components/ui/alert-dialog";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { apiRequest } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import { useAuth } from "@/hooks/use-auth";
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
  employee?: { name: string };
  onEdit: (id: number) => void;
  onCancel: (id: number) => void;
  onAddNote: (appointment: Appointment, client: { name: string; phone: string; id: number }) => void;
}

const AppointmentItem: React.FC<AppointmentItemProps> = ({ 
  appointment, 
  client, 
  service,
  employee,
  onEdit,
  onCancel,
  onAddNote
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
            {employee && (
              <span className="text-xs ml-2 px-2 py-1 bg-blue-100 text-blue-800 rounded">
                {employee.name}
              </span>
            )}
          </p>
          <p className="text-xs text-gray-500">
            {`${new Date(appointment.date).getUTCHours().toString().padStart(2, '0')}:${new Date(appointment.date).getUTCMinutes().toString().padStart(2, '0')}`} - {`${appointmentEndTime.getUTCHours().toString().padStart(2, '0')}:${appointmentEndTime.getUTCMinutes().toString().padStart(2, '0')}`}
          </p>
        </div>
        <div className="flex space-x-2">
          <TooltipProvider>
            <Tooltip>
              <TooltipTrigger asChild>
                <button 
                  className="text-gray-400 hover:text-emerald-600 transition"
                  onClick={() => onAddNote(appointment, client as any)}
                >
                  <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="h-4 w-4">
                    <path d="M4 19.5v-15A2.5 2.5 0 0 1 6.5 2H20v20H6.5a2.5 2.5 0 0 1 0-5H20"></path>
                    <path d="M8 7h6"></path>
                    <path d="M8 11h8"></path>
                    <path d="M8 15h6"></path>
                  </svg>
                </button>
              </TooltipTrigger>
              <TooltipContent>
                <p>Anotar</p>
              </TooltipContent>
            </Tooltip>
          </TooltipProvider>
          
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
  isOccupiedBySelectedEmployee?: boolean;
}

const EmptySlot: React.FC<EmptySlotProps> = ({ time, onAddAppointment, isOccupiedBySelectedEmployee }) => {
  // Remover validação de horário passado para permitir agendamentos retroativos
  // Profissionais podem precisar agendar consultas que já aconteceram para fins de registro
  
  return (
    <div 
      className={cn(
        "p-3 border-l-4 rounded-r-md group-hover:bg-gray-100 transition min-h-[60px] flex items-center justify-center",
        isOccupiedBySelectedEmployee 
          ? "bg-blue-50 border-blue-300 text-blue-600" 
          : "bg-gray-50 border-gray-200"
      )}
    >
      {isOccupiedBySelectedEmployee ? (
        <div className="text-xs font-medium uppercase tracking-wider text-center">
          <Clock className="h-4 w-4 mx-auto mb-1" />
          Ocupado
        </div>
      ) : (
      <button 
        className="text-gray-400 hover:text-primary-600 text-xs font-medium uppercase tracking-wider"
        onClick={() => onAddAppointment(time)}
      >
        <CalendarIcon className="h-4 w-4 mr-1 inline" /> Adicionar
      </button>
      )}
    </div>
  );
};

interface DayScheduleProps {
  providerId?: number; // Opcional, pois a API já filtra por usuário autenticado
}

const DaySchedule: React.FC<DayScheduleProps> = ({ providerId }) => {
  const [selectedDate, setSelectedDate] = React.useState<Date>(new Date());
  const [calendarOpen, setCalendarOpen] = React.useState<boolean>(false);
  const [addAppointmentTime, setAddAppointmentTime] = React.useState<Date | null>(null);
  const [editAppointmentId, setEditAppointmentId] = React.useState<number | null>(null);
  const [filterStartHour, setFilterStartHour] = React.useState<number>(0);
  const [filterEndHour, setFilterEndHour] = React.useState<number>(24);
  const [showFilterOptions, setShowFilterOptions] = React.useState<boolean>(false);
  const [isRefreshing, setIsRefreshing] = React.useState<boolean>(false);
  const [selectedEmployeeFilter, setSelectedEmployeeFilter] = React.useState<string>("all");
  
  // Estados para o modal de anotações clínicas
  const [isNotesModalOpen, setIsNotesModalOpen] = useState(false);
  const [selectedAppointment, setSelectedAppointment] = useState<Appointment | null>(null);
  const [selectedClient, setSelectedClient] = useState<any>(null);
  
  const queryClient = useQueryClient();
  const { toast } = useToast();
  const { user } = useAuth();
  
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
        // Adicionar timestamp para evitar cache do navegador
        const url = `/api/my-appointments?date=${localDate}&_t=${Date.now()}`;
        
        console.log(`🔍 Buscando agendamentos para: ${localDate} (selectedDate: ${selectedDate.toDateString()})`, {
          selectedDate: selectedDate,
          localDate: localDate,
          url: url
        });
        
        const res = await fetch(url);
        if (!res.ok) throw new Error('Failed to fetch appointments');
        const data = await res.json();
        
        console.log(`📥 Agendamentos recebidos da API (${data.length} total):`, data);
        
        // Log detalhado de cada agendamento
        data.forEach((apt: any, index: number) => {
          const startTime = new Date(apt.date);
          const timeString = `${startTime.getUTCHours().toString().padStart(2, '0')}:${startTime.getUTCMinutes().toString().padStart(2, '0')}`;
          
          // Log especial para agendamentos noturnos (21h ou mais)
          if (startTime.getUTCHours() >= 21) {
            console.log(`🌙 AGENDAMENTO NOTURNO ENCONTRADO: ${timeString} - ${apt.clientName} - Status: ${apt.status}`, {
              id: apt.id,
              originalDate: apt.date,
              parsedDate: startTime.toLocaleString(),
              timeString: timeString,
              status: apt.status,
              clientName: apt.clientName,
              hora: startTime.getUTCHours(),
              minuto: startTime.getUTCMinutes()
            });
          }
          
          console.log(`📋 Agendamento ${index + 1}: ${timeString} - ${apt.clientName} - Status: ${apt.status}`, {
            originalDate: apt.date,
            parsedDate: startTime,
            timeString: timeString,
            status: apt.status,
            clientName: apt.clientName
          });
        });
        
        return data;
      },
      // Forçar revalidação mais frequente
      staleTime: 5000, // 5 segundos
      refetchInterval: 10000 // Refetch a cada 10 segundos
    });
    
  // Buscar agendamentos do usuário atual para o mês selecionado
  const { data: monthAppointments } = useQuery({
    queryKey: ['/api/my-appointments/month', selectedDate.getFullYear(), selectedDate.getMonth()],
    queryFn: async () => {
      const year = selectedDate.getFullYear();
      const month = selectedDate.getMonth() + 1; // JavaScript meses são 0-indexed
      
      // Usar a rota /api/my-appointments que já filtra por usuário autenticado
      // Isso garante que apenas os agendamentos do usuário atual sejam retornados
      const res = await fetch(`/api/my-appointments?year=${year}&month=${month}`);
      if (!res.ok) throw new Error('Failed to fetch monthly appointments');
      return res.json();
    },
    staleTime: 5 * 60 * 1000 // 5 minutos
  });
  
  // Extrair dias únicos com agendamentos do usuário atual (excluindo cancelados)
  const daysWithAppointments = React.useMemo(() => {
    const days = new Set<string>();
    
    // Processar apenas os agendamentos do usuário atual que NÃO estão cancelados
    if (monthAppointments && Array.isArray(monthAppointments)) {
      monthAppointments.forEach((appointment: any) => {
        // Verificar se o agendamento NÃO está cancelado
        if (appointment.status !== AppointmentStatus.CANCELLED) {
          // Usar a data do agendamento diretamente
          const date = new Date(appointment.date);
          
          const dateStr = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`;
          days.add(dateStr);
        }
      });
    }
    
    // Converter o Set para Array
    const result = Array.from(days);
    
    // Log para debug
    console.log('Dias com agendamentos ativos do usuário atual:', result);
    
    return result;
  }, [monthAppointments]);
    
  // Atualiza dados quando uma mensagem de WebSocket sobre novos agendamentos é recebida
  useEffect(() => {
    // Define a função de callback do WebSocket
    function handleWebSocketMessage(event: MessageEvent) {
      try {
        const data = JSON.parse(event.data);
        if (data.type === 'appointment_created' || data.type === 'appointment_updated' || 
            data.type === 'appointment-status-updated' || data.type === 'appointment-deleted') {
          
          console.log('📡 WebSocket: Atualizando agendamentos devido a:', data.type);
          
          // Invalidar TODAS as queries de agendamentos (não apenas específicas)
          queryClient.invalidateQueries({ 
            queryKey: ['/api/my-appointments'],
            exact: false 
          });
          
          // Forçar refetch imediato dos agendamentos do dia atual
          refetchAppointments();
          
          // Invalidar queries do mês para atualizar marcações do calendário
          queryClient.invalidateQueries({ 
            queryKey: ['/api/my-appointments/month'],
            exact: false
          });
          
          // Refetch das queries do mês
          queryClient.refetchQueries({ 
            queryKey: ['/api/my-appointments/month'],
            exact: false
          });
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

  // Listener adicional para eventos customizados do WebSocket
  useEffect(() => {
    const handleScheduleUpdate = (event: CustomEvent) => {
      console.log('📅 DaySchedule: Atualização de agenda detectada via evento customizado', event.detail);
      // Refetch imediato dos agendamentos
      refetchAppointments();
    };

    const handleAppointmentCreated = (event: CustomEvent) => {
      console.log('📅 DaySchedule: Novo agendamento detectado via evento customizado', event.detail);
      // Refetch imediato dos agendamentos
      refetchAppointments();
    };

    // Registrar listeners
    window.addEventListener('schedule-update', handleScheduleUpdate as EventListener);
    window.addEventListener('appointment-created', handleAppointmentCreated as EventListener);

    // Cleanup
    return () => {
      window.removeEventListener('schedule-update', handleScheduleUpdate as EventListener);
      window.removeEventListener('appointment-created', handleAppointmentCreated as EventListener);
    };
  }, [refetchAppointments]);

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

  const { data: employees, isLoading: employeesLoading } = useQuery({
    queryKey: ['/api/employees'],
    queryFn: async () => {
      const res = await fetch('/api/employees');
      if (!res.ok) throw new Error('Failed to fetch employees');
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
    
    // Invalidar e refazer todas as queries relacionadas a agendamentos
    queryClient.invalidateQueries({ 
      queryKey: ['/api/my-appointments'],
      exact: false 
    });
    
    // Forçar refetch imediato dos agendamentos do dia
    refetchAppointments();
    
    // Invalidar queries do mês para atualizar marcações do calendário
    queryClient.invalidateQueries({ 
      queryKey: ['/api/my-appointments/month'],
      exact: false
    });
  };

  // Create time slots based on filter settings + existing appointments
  const timeSlots = React.useMemo(() => {
    // Gerar slots com base nos filtros definidos pelo usuário
    const baseSlots = generateTimeSlots(filterStartHour, filterEndHour, 30);
    
    // Se não há agendamentos, retornar apenas os slots base
    if (!appointments || appointments.length === 0) {
      console.log(`⚠️ Nenhum agendamento encontrado para ${selectedDate.toDateString()}`);
      return baseSlots;
    }
    
    console.log(`📊 Total de agendamentos carregados para ${selectedDate.toDateString()}: ${appointments.length}`, appointments);
    
    // Encontrar horários de agendamentos que estão fora do range de filtro
    const appointmentTimes = new Set<string>();
    appointments.forEach(apt => {
      // Incluir apenas agendamentos NÃO cancelados na grid
      if (apt.status !== AppointmentStatus.CANCELLED) {
        // Usar a data do agendamento diretamente
        const startTime = new Date(apt.date);
        
        const timeString = `${startTime.getUTCHours().toString().padStart(2, '0')}:${startTime.getUTCMinutes().toString().padStart(2, '0')}`;
        appointmentTimes.add(timeString);
        
        // Log detalhado para debug
        console.log(`📅 Agendamento ATIVO encontrado: ${timeString} (${startTime.toLocaleString()}) - Status: ${apt.status}`, {
          originalDate: apt.date,
          parsedDate: startTime,
          timeString: timeString,
          isToday: startTime.toDateString() === selectedDate.toDateString(),
          status: apt.status
        });
      } else {
        // Log para agendamentos cancelados (não incluídos na grid)
        const startTime = new Date(apt.date);
        
        const timeString = `${startTime.getUTCHours().toString().padStart(2, '0')}:${startTime.getUTCMinutes().toString().padStart(2, '0')}`;
        console.log(`❌ Agendamento CANCELADO ignorado: ${timeString} (${startTime.toLocaleString()}) - Status: ${apt.status}`);
      }
    });
    
    // Combinar slots base com horários de agendamentos
    const allSlots = new Set([...baseSlots, ...Array.from(appointmentTimes)]);
    
    // Converter para array e ordenar
    const sortedSlots = Array.from(allSlots).sort((a, b) => {
      const [aHour, aMin] = a.split(':').map(Number);
      const [bHour, bMin] = b.split(':').map(Number);
      return (aHour * 60 + aMin) - (bHour * 60 + bMin);
    });
    
    const extraAppointments = appointmentTimes.size - baseSlots.filter(slot => appointmentTimes.has(slot)).length;
    
    if (extraAppointments > 0) {
      console.log(`⚠️ ${extraAppointments} agendamento(s) fora do filtro de horário foram incluídos automaticamente`);
    }
    
    console.log(`📅 Slots base (${filterStartHour}h-${filterEndHour}h):`, baseSlots);
    console.log(`📅 Horários de agendamentos:`, Array.from(appointmentTimes));
    console.log(`📅 Slots finais:`, sortedSlots);
    console.log(`📅 Resumo: ${sortedSlots.length} slots (base: ${baseSlots.length}, agendamentos extras: ${appointmentTimes.size})`);
    
    return sortedSlots;
  }, [filterStartHour, filterEndHour, appointments]);

  const isLoading = appointmentsLoading || servicesLoading || clientsLoading || employeesLoading;
  
  // Verificar se há agendamentos fora do filtro atual
  const appointmentsOutsideFilter = React.useMemo(() => {
    if (!appointments) return 0;
    
    return appointments.filter(apt => {
      if (apt.status === AppointmentStatus.CANCELLED) return false;
      
      const startTime = new Date(apt.date);
      const hour = startTime.getUTCHours();
      
      return hour < filterStartHour || hour >= filterEndHour;
    }).length;
  }, [appointments, filterStartHour, filterEndHour]);
  
  // Find appointments for a specific time (can return multiple for company accounts)
  const findAppointmentsForTime = (timeString: string) => {
    if (!appointments) return [];
    
    // Split the time string to get hours and minutes
    const [hours, minutes] = timeString.split(':').map(Number);
    
    // Abordagem simplificada: verificar cada agendamento para este horário
    const currentTime = new Date(selectedDate);
    currentTime.setHours(hours, minutes, 0, 0);
    
    // Encontrar todos os agendamentos que ocorrem neste horário
    // Um agendamento ocorre no horário se:
    // 1. O horário de início do agendamento é exatamente este horário, OU
    // 2. O horário está entre o início e o fim do agendamento
    // E o agendamento não está cancelado
    
    let results = appointments.filter(apt => {
      // Ignorar agendamentos cancelados
      if (apt.status === AppointmentStatus.CANCELLED) {
        return false;
      }
      // Usar a data do agendamento diretamente
      const startTime = new Date(apt.date);
      
      // Calcular o horário de término
      const endTime = apt.endTime ? new Date(apt.endTime) : 
        new Date(startTime.getTime() + 30*60000); // Fallback de 30 minutos se não tiver endTime
      
      // Verificar se o horário atual está dentro do período do agendamento
      const currentHour = currentTime.getHours();
      const currentMinute = currentTime.getMinutes();
      const currentTotalMinutes = currentHour * 60 + currentMinute;
      
      const startTotalMinutes = startTime.getUTCHours() * 60 + startTime.getUTCMinutes();
      const endTotalMinutes = endTime.getUTCHours() * 60 + endTime.getUTCMinutes();
      
      return currentTotalMinutes >= startTotalMinutes && currentTotalMinutes < endTotalMinutes;
    });
    
    // Filtrar por funcionário se um funcionário específico estiver selecionado
    if (selectedEmployeeFilter !== "all") {
      if (selectedEmployeeFilter === "unassigned") {
        results = results.filter(apt => !apt.employeeId);
      } else {
        results = results.filter(apt => apt.employeeId?.toString() === selectedEmployeeFilter);
      }
    }
    
    return results;
  };

  // Função para verificar se um horário está ocupado pelo funcionário selecionado
  const isTimeOccupiedBySelectedEmployee = (timeString: string) => {
    if (!appointments || selectedEmployeeFilter === "all") return false;
    
    const [hours, minutes] = timeString.split(':').map(Number);
    const currentTime = new Date(selectedDate);
    currentTime.setHours(hours, minutes, 0, 0);
    
    return appointments.some(apt => {
      // Ignorar agendamentos cancelados
      if (apt.status === AppointmentStatus.CANCELLED) {
        return false;
      }
      
      // Verificar se é do funcionário selecionado
      const matchesEmployee = selectedEmployeeFilter === "unassigned" 
        ? !apt.employeeId 
        : apt.employeeId?.toString() === selectedEmployeeFilter;
      
      if (!matchesEmployee) return false;
      
      // Verificar se o horário coincide
      const startTime = new Date(apt.date);
      
      const endTime = apt.endTime ? new Date(apt.endTime) : 
        new Date(startTime.getTime() + 30*60000);
      
      const currentTotalMinutes = hours * 60 + minutes;
      const startTotalMinutes = startTime.getUTCHours() * 60 + startTime.getUTCMinutes();
      const endTotalMinutes = endTime.getUTCHours() * 60 + endTime.getUTCMinutes();
      
      return currentTotalMinutes >= startTotalMinutes && currentTotalMinutes < endTotalMinutes;
    });
  };

  // Get client, service and employee for an appointment
  const getAppointmentDetails = (appointmentId: number) => {
    if (!clients || !services) return { client: null, service: null, employee: null };
    
    const appointment = appointments?.find(a => a.id === appointmentId);
    if (!appointment) return { client: null, service: null, employee: null };
    
    const client = clients.find((c: Client) => c.id === appointment.clientId);
    const service = services.find((s: Service) => s.id === appointment.serviceId);
    const employee = appointment.employeeId && employees ? 
      employees.find((e: any) => e.id === appointment.employeeId) : null;
    
    return { client, service, employee };
  };

  const editAppointment = appointments?.find(a => a.id === editAppointmentId);
  const { client: editClient, service: editService } = editAppointmentId 
    ? getAppointmentDetails(editAppointmentId)
    : { client: null, service: null };

  return (
    <>
      <Card>
        <CardHeader className="px-6 pb-2 pt-6">
          <div className="mb-2">
            <CardTitle className="text-lg">Agendamentos do dia</CardTitle>
            <p className="mt-1 text-sm text-gray-500">
              {format(selectedDate, "EEEE, d 'de' MMMM 'de' yyyy", { locale: ptBR })}
            </p>
            {appointmentsOutsideFilter > 0 && (
              <div className="mt-2 p-2 bg-amber-50 border border-amber-200 rounded-md">
                <p className="text-xs text-amber-700">
                  ⚠️ {appointmentsOutsideFilter} agendamento(s) fora do filtro de horário estão sendo exibidos automaticamente
            </p>
              </div>
            )}
            {selectedEmployeeFilter !== "all" && user?.accountType === "company" && (
              <div className="mt-2 p-2 bg-blue-50 border border-blue-200 rounded-md">
                <p className="text-xs text-blue-700">
                  👤 Exibindo apenas agendamentos de: {selectedEmployeeFilter === "unassigned" 
                    ? "Sem funcionário atribuído" 
                    : employees?.find((emp: any) => emp.id.toString() === selectedEmployeeFilter)?.name || "Funcionário"
                  }
                </p>
              </div>
            )}
          </div>
          <div className="flex flex-wrap items-center gap-2 mt-3">
            <Popover>
              <PopoverTrigger asChild>
                <Button variant="outline" size="sm" className="flex-shrink-0">
                  <Filter className="h-4 w-4 mr-1" /> Filtrar
                </Button>
              </PopoverTrigger>
              <PopoverContent className="w-80">
                <div className="space-y-4">
                  <h4 className="font-medium">Filtrar horários</h4>
                  
                  {/* Filtro de funcionário - apenas para contas empresa */}
                  {user?.accountType === "company" && (
                    <div>
                      <p className="text-sm mb-2 text-gray-500">Funcionário</p>
                      <Select 
                        value={selectedEmployeeFilter} 
                        onValueChange={setSelectedEmployeeFilter}
                      >
                        <SelectTrigger>
                          <SelectValue placeholder="Selecionar funcionário" />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="all">Todos os funcionários</SelectItem>
                          <SelectItem value="unassigned">Sem funcionário</SelectItem>
                          {employees?.map((employee: any) => (
                            <SelectItem key={employee.id} value={employee.id.toString()}>
                              {employee.name}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>
                  )}
                  
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
                        setSelectedEmployeeFilter("all");
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
            
            {/* Datepicker */}
            <Popover open={calendarOpen} onOpenChange={setCalendarOpen}>
              <TooltipProvider>
                <Tooltip>
                  <TooltipTrigger asChild>
                    <PopoverTrigger asChild>
                      <Button variant="outline" size="sm" className="ml-2 w-[140px] justify-start">
                        <CalendarIcon className="h-4 w-4 mr-2" />
                        <span>{format(selectedDate, "dd/MM/yyyy")}</span>
                      </Button>
                    </PopoverTrigger>
                  </TooltipTrigger>
                  <TooltipContent>
                    <p>Selecionar data específica</p>
                  </TooltipContent>
                </Tooltip>
              </TooltipProvider>
              <PopoverContent className="w-auto p-0" align="end">
                <style>
                  {`
                  /* Estilo para dias com agendamentos */
                  .appointment-day {
                    position: relative;
                    font-weight: bold;
                    color: #3b82f6 !important;
                  }
                  
                  .appointment-day::after {
                    content: '';
                    position: absolute;
                    bottom: 2px;
                    left: 50%;
                    transform: translateX(-50%);
                    width: 6px;
                    height: 6px;
                    border-radius: 50%;
                    background-color: #3b82f6;
                  }
                  `}
                </style>
                <Calendar
                  mode="single"
                  selected={selectedDate}
                  onSelect={(date) => {
                    if (date) {
                      setSelectedDate(date);
                      // Fechar o popover após a seleção
                      setCalendarOpen(false);
                    }
                  }}
                  modifiers={{
                    appointment: daysWithAppointments.map(dateStr => {
                      const [year, month, day] = dateStr.split('-').map(Number);
                      // Criar a data corretamente (mês é 0-indexed em JavaScript)
                      return new Date(year, month - 1, day);
                    })
                  }}
                  modifiersClassNames={{
                    appointment: 'appointment-day'
                  }}
                  initialFocus
                  locale={ptBR}
                  className="p-0"
                />
              </PopoverContent>
            </Popover>
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
                const appointments = findAppointmentsForTime(time);
                
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
                
                
                const handleCancelAppointment = async (appointmentId: number) => {
                  try {
                    const response = await fetch(`/api/appointments/${appointmentId}/cancel`, {
                      method: 'PUT',
                      headers: {
                        'Content-Type': 'application/json'
                      },
                      body: JSON.stringify({
                        cancellationReason: 'Cancelado pelo provedor'
                      })
                    });

                    if (!response.ok) {
                      throw new Error('Falha ao cancelar agendamento');
                    }

                    // Atualizar os dados
                    refetchAppointments();
                    
                    toast({
                      title: "Agendamento cancelado",
                      description: "O agendamento foi cancelado com sucesso."
                    });
                  } catch (error) {
                    console.error('Erro ao cancelar agendamento:', error);
                    toast({
                      title: "Erro",
                      description: "Ocorreu um erro ao cancelar o agendamento.",
                      variant: "destructive"
                    });
                  }
                };
                
                // Função para abrir o modal de anotações clínicas
                const handleAddNote = (appointment: Appointment, client: any) => {
                  setSelectedAppointment(appointment);
                  setSelectedClient(client);
                  setIsNotesModalOpen(true);
                };

                if (appointments.length > 0) {
                  return (
                    <TimeSlot key={time} time={time}>
                      <div className="space-y-2">
                        {appointments.map((appointment, index) => {
                          const { client, service, employee } = getAppointmentDetails(appointment.id);
                          if (!client || !service) return null;
                          
                          return (
                            <AppointmentItem 
                              key={`${appointment.id}-${index}`}
                              appointment={appointment}
                              client={client}
                              service={service}
                              employee={employee}
                              onEdit={handleEditAppointment}
                              onCancel={handleCancelAppointment}
                              onAddNote={handleAddNote}
                            />
                          );
                        })}
                        
                        {/* Para contas empresa, sempre mostrar botão de adicionar */}
                        {user?.accountType === "company" && (
                          <div className="mt-2 pt-2 border-t border-gray-200">
                            <button 
                              className="w-full text-xs text-blue-600 hover:text-blue-800 font-medium py-1 px-2 rounded border border-blue-200 hover:border-blue-300 bg-blue-50 hover:bg-blue-100 transition-colors"
                              onClick={() => handleAddAppointment(slotTime)}
                            >
                              <CalendarIcon className="h-3 w-3 mr-1 inline" /> 
                              Adicionar outro cliente
                            </button>
                          </div>
                        )}
                      </div>
                    </TimeSlot>
                  );
                }
                
                return (
                  <TimeSlot key={time} time={time}>
                    <EmptySlot 
                      time={slotTime}
                      onAddAppointment={handleAddAppointment}
                      isOccupiedBySelectedEmployee={isTimeOccupiedBySelectedEmployee(time)}
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
        <DialogContent className="w-full max-w-[95vw] sm:max-w-[500px]">
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
          {addAppointmentTime && providerId && (
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
        <DialogContent className="w-full max-w-[95vw] sm:max-w-[500px]">
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
          {editAppointment && providerId && (
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

      {/* Modal de Anotações Clínicas */}
      {isNotesModalOpen && selectedAppointment && selectedClient && providerId && (
        <ClinicalNotesModal
          isOpen={isNotesModalOpen}
          onClose={() => setIsNotesModalOpen(false)}
          appointment={selectedAppointment}
          client={selectedClient}
          providerId={providerId}
          onSuccess={() => {
            setIsNotesModalOpen(false);
            toast({
              title: "Anotação clínica salva",
              description: "A anotação clínica foi salva com sucesso."
            });
          }}
        />
      )}
    </>
  );
};

export default DaySchedule;
