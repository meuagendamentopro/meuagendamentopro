import React, { useState, useEffect } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { useToast } from "@/hooks/use-toast";
import { formatDate, formatTime } from "@/lib/dates";
import { apiRequest } from "@/lib/queryClient";
import { Appointment, Employee, AppointmentStatus } from "@shared/schema";
import { useAuth } from "@/hooks/use-auth";

interface RescheduleAppointmentFormProps {
  appointment: Appointment;
  onComplete: () => void;
  onCancel: () => void;
}

const RescheduleAppointmentForm: React.FC<RescheduleAppointmentFormProps> = ({
  appointment,
  onComplete,
  onCancel,
}) => {
  const { user } = useAuth();
  const isCompanyAccount = user?.accountType === "company";
  
  console.log('🏗️ Inicializando RescheduleAppointmentForm com:', {
    appointmentId: appointment.id,
    appointmentDate: appointment.date,
    employeeId: appointment.employeeId,
    isCompanyAccount,
    userAccountType: user?.accountType
  });

  const [selectedEmployeeId, setSelectedEmployeeId] = useState<string>(
    appointment.employeeId?.toString() || ""
  );
  const [selectedDate, setSelectedDate] = useState<string>(
    new Date(appointment.date).toISOString().split('T')[0]
  );
  const [selectedTime, setSelectedTime] = useState<string>(
    formatTime(new Date(appointment.date))
  );

  console.log('📋 Valores iniciais:', {
    selectedEmployeeId: appointment.employeeId?.toString() || "",
    selectedDate: new Date(appointment.date).toISOString().split('T')[0],
    selectedTime: formatTime(new Date(appointment.date)),
    isCompanyAccount
  });
  
  const [availableTimes, setAvailableTimes] = useState<string[]>([]);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [lunchTimeNotification, setLunchTimeNotification] = useState<string>("");
  const [occupiedTimes, setOccupiedTimes] = useState<string[]>([]);
  const { toast } = useToast();
  const queryClient = useQueryClient();

  // Função para limpar cache e resetar estado quando o modal for fechado
  const handleCancel = () => {
    console.log('🧹 Limpando cache e resetando estado...');
    
    // Limpar queries relacionadas aos agendamentos existentes
    queryClient.removeQueries({ 
      queryKey: ["/api/my-appointments"], 
      exact: false 
    });
    
    // Resetar estados locais
    setOccupiedTimes([]);
    setAvailableTimes([]);
    setLunchTimeNotification("");
    
    // Chamar função de cancelamento original
    onCancel();
  };

  // Buscar funcionários (apenas para contas empresa)
  const { data: employees } = useQuery({
    queryKey: ["/api/employees"],
    queryFn: async () => {
      const res = await fetch("/api/employees");
      if (!res.ok) throw new Error("Failed to fetch employees");
      return res.json();
    },
    enabled: isCompanyAccount, // Só busca funcionários para contas empresa
  });

  // Buscar dados do provider (para contas individuais)
  const { data: provider } = useQuery({
    queryKey: ["/api/my-provider"],
    queryFn: async () => {
      const res = await fetch("/api/my-provider");
      if (!res.ok) throw new Error("Failed to fetch provider data");
      return res.json();
    },
    enabled: !isCompanyAccount, // Só busca provider para contas individuais
  });

  // Para contas individuais, usar o provider como "funcionário"
  useEffect(() => {
    if (!isCompanyAccount && provider && !selectedEmployeeId) {
      // Para contas individuais, usar o ID do provider como employeeId
      setSelectedEmployeeId(provider.id.toString());
      console.log('🔄 Conta individual: definindo provider como funcionário:', provider.id);
    }
  }, [isCompanyAccount, provider, selectedEmployeeId]);

  // Buscar cliente
  const { data: client } = useQuery({
    queryKey: ["/api/clients", appointment.clientId],
    queryFn: async () => {
      const res = await fetch(`/api/clients/${appointment.clientId}`);
      if (!res.ok) throw new Error("Failed to fetch client");
      return res.json();
    },
  });

  // Buscar serviço
  const { data: service } = useQuery({
    queryKey: ["/api/services", appointment.serviceId],
    queryFn: async () => {
      const res = await fetch(`/api/my-services`);
      if (!res.ok) throw new Error("Failed to fetch services");
      const services = await res.json();
      return services.find((s: any) => s.id === appointment.serviceId);
    },
  });

  // Buscar agendamentos existentes para a data e funcionário selecionados
  const { data: existingAppointments } = useQuery({
    queryKey: ["/api/my-appointments", selectedDate, selectedEmployeeId, appointment.id],
    queryFn: async () => {
      if (!selectedDate || !selectedEmployeeId) return [];
      
      const res = await fetch(`/api/my-appointments?date=${selectedDate}`);
      if (!res.ok) throw new Error("Failed to fetch appointments");
      const appointments = await res.json();
      
      // Para contas individuais, filtrar todos os agendamentos da data
      // Para contas empresa, filtrar apenas agendamentos do funcionário selecionado
      return appointments.filter((apt: any) => {
        const isNotCancelled = apt.status !== AppointmentStatus.CANCELLED;
        const isNotCurrentAppointment = apt.id !== appointment.id;
        
        if (!isCompanyAccount) {
          // Para contas individuais, considerar todos os agendamentos não cancelados
          return isNotCancelled && isNotCurrentAppointment;
        } else {
          // Para contas empresa, filtrar por funcionário
          return apt.employeeId?.toString() === selectedEmployeeId && 
                 isNotCancelled && 
                 isNotCurrentAppointment;
        }
      });
    },
    enabled: !!(selectedDate && selectedEmployeeId),
  });

  // Atualizar horários ocupados quando agendamentos existentes mudarem
  useEffect(() => {
    if (existingAppointments) {
      const occupied = existingAppointments.map((apt: any) => {
        // Usar a data do agendamento diretamente
        const startTime = new Date(apt.date);
        
        return `${startTime.getUTCHours().toString().padStart(2, '0')}:${startTime.getUTCMinutes().toString().padStart(2, '0')}`;
      });
      
      console.log('🕐 Horários ocupados calculados:', {
        agendamentos: existingAppointments.map((apt: any) => {
          const startTime = new Date(apt.date);
          
          return {
            id: apt.id,
            dataOriginal: apt.date,
            horarioCalculado: `${startTime.getUTCHours().toString().padStart(2, '0')}:${startTime.getUTCMinutes().toString().padStart(2, '0')}`
          };
        }),
        horariosOcupados: occupied
      });
      
      setOccupiedTimes(occupied);
    } else {
      setOccupiedTimes([]);
    }
  }, [existingAppointments]);

  // Limpar cache quando funcionário ou data mudarem
  useEffect(() => {
    console.log('🔄 Funcionário ou data mudaram, limpando cache...');
    queryClient.removeQueries({ 
      queryKey: ["/api/my-appointments"], 
      exact: false 
    });
  }, [selectedEmployeeId, selectedDate, queryClient]);

  // Gerar datas disponíveis (próximos 30 dias)
  const generateAvailableDates = () => {
    const dates = [];
    const today = new Date();
    
    for (let i = 0; i < 30; i++) {
      const date = new Date(today);
      date.setDate(today.getDate() + i);
      dates.push({
        value: date.toISOString().split('T')[0],
        label: formatDate(date)
      });
    }
    
    return dates;
  };

  const availableDates = generateAvailableDates();

  // Buscar horários disponíveis quando data ou funcionário mudarem
  useEffect(() => {
    if (selectedDate && selectedEmployeeId && service) {
      fetchAvailableTimes();
    }
  }, [selectedDate, selectedEmployeeId, service]);

  // Verificar se o horário selecionado é horário de almoço
  useEffect(() => {
    if (selectedTime && selectedEmployeeId) {
      if (isCompanyAccount && employees) {
        checkLunchTime();
      } else if (!isCompanyAccount && provider) {
        checkLunchTimeForProvider();
      }
    }
  }, [selectedTime, selectedEmployeeId, employees, provider, isCompanyAccount]);

  const fetchAvailableTimes = async () => {
    if (!selectedDate || !selectedEmployeeId || !service) return;

    try {
      // Gerar horários de 00h às 23h30 de 30 em 30 minutos
      const times = [];
      for (let hour = 0; hour < 24; hour++) {
        for (let minute = 0; minute < 60; minute += 30) {
          const timeString = `${hour.toString().padStart(2, '0')}:${minute.toString().padStart(2, '0')}`;
          times.push(timeString);
        }
      }
      
      setAvailableTimes(times);
    } catch (error) {
      console.error('Error fetching available times:', error);
      toast({
        title: "Erro",
        description: "Não foi possível carregar os horários disponíveis",
        variant: "destructive",
      });
    }
  };

  const checkLunchTime = () => {
    if (!selectedTime || !selectedEmployeeId || !employees) {
      setLunchTimeNotification("");
      return;
    }

    const selectedEmployee = employees.find((emp: Employee) => emp.id.toString() === selectedEmployeeId);
    
    if (!selectedEmployee || !selectedEmployee.lunchBreakStart || !selectedEmployee.lunchBreakEnd) {
      setLunchTimeNotification("");
      return;
    }

    // Converter horários para minutos para comparação
    const [timeHour, timeMinute] = selectedTime.split(':').map(Number);
    const timeInMinutes = timeHour * 60 + timeMinute;

    const [lunchStartHour, lunchStartMinute] = selectedEmployee.lunchBreakStart.split(':').map(Number);
    const [lunchEndHour, lunchEndMinute] = selectedEmployee.lunchBreakEnd.split(':').map(Number);
    
    const lunchStartInMinutes = lunchStartHour * 60 + lunchStartMinute;
    const lunchEndInMinutes = lunchEndHour * 60 + lunchEndMinute;

    // Verificar se o horário está dentro do intervalo de almoço
    if (timeInMinutes >= lunchStartInMinutes && timeInMinutes < lunchEndInMinutes) {
      setLunchTimeNotification(`⚠️ Este horário está no intervalo de almoço do funcionário (${selectedEmployee.lunchBreakStart} - ${selectedEmployee.lunchBreakEnd}). O agendamento ainda pode ser feito, mas verifique a disponibilidade.`);
    } else {
      setLunchTimeNotification("");
    }
  };

  const checkLunchTimeForProvider = () => {
    if (!selectedTime || !provider) {
      setLunchTimeNotification("");
      return;
    }

    // Para contas individuais, verificar se o provider tem horário de almoço definido
    if (!provider.lunchBreakStart || !provider.lunchBreakEnd) {
      setLunchTimeNotification("");
      return;
    }

    // Converter horários para minutos para comparação
    const [timeHour, timeMinute] = selectedTime.split(':').map(Number);
    const timeInMinutes = timeHour * 60 + timeMinute;

    const [lunchStartHour, lunchStartMinute] = provider.lunchBreakStart.split(':').map(Number);
    const [lunchEndHour, lunchEndMinute] = provider.lunchBreakEnd.split(':').map(Number);
    
    const lunchStartInMinutes = lunchStartHour * 60 + lunchStartMinute;
    const lunchEndInMinutes = lunchEndHour * 60 + lunchEndMinute;

    // Verificar se o horário está dentro do intervalo de almoço
    if (timeInMinutes >= lunchStartInMinutes && timeInMinutes < lunchEndInMinutes) {
      setLunchTimeNotification(`⚠️ Este horário está no seu intervalo de almoço (${provider.lunchBreakStart} - ${provider.lunchBreakEnd}). O agendamento ainda pode ser feito, mas verifique a disponibilidade.`);
    } else {
      setLunchTimeNotification("");
    }
  };

  const handleSubmit = async () => {
    console.log('🔍 Verificando campos:', {
      selectedDate,
      selectedTime,
      selectedEmployeeId,
      isTimeValid: selectedTime !== "no-times-available",
      isTimeOccupied: occupiedTimes.includes(selectedTime),
      isCompanyAccount
    });

    // Validação adaptada ao tipo de conta
    if (!selectedDate || !selectedTime || selectedTime === "no-times-available") {
      console.log('❌ Validação falhou - campos obrigatórios ausentes');
      toast({
        title: "Campos obrigatórios",
        description: "Por favor, selecione a data e horário",
        variant: "destructive",
      });
      return;
    }

    // Para contas empresa, validar se funcionário foi selecionado
    if (isCompanyAccount && !selectedEmployeeId) {
      console.log('❌ Validação falhou - funcionário não selecionado para conta empresa');
      toast({
        title: "Funcionário obrigatório",
        description: "Por favor, selecione um funcionário",
        variant: "destructive",
      });
      return;
    }

    // Verificar se o horário selecionado está ocupado
    if (occupiedTimes.includes(selectedTime)) {
      console.log('❌ Validação falhou - horário ocupado');
      toast({
        title: "Horário ocupado",
        description: "O horário selecionado já está ocupado. Por favor, escolha outro horário.",
        variant: "destructive",
      });
      return;
    }

    setIsSubmitting(true);

    try {
      console.log('🔄 Iniciando reagendamento:', {
        appointmentId: appointment.id,
        selectedDate,
        selectedTime,
        selectedEmployeeId,
        originalDate: appointment.date
      });

      // Criar nova data/hora em UTC para manter o horário exato
      const [year, month, day] = selectedDate.split('-').map(Number);
      const [hours, minutes] = selectedTime.split(':').map(Number);
      
      // Criar data em UTC para evitar conversão automática de timezone
      const newDateTime = new Date(Date.UTC(year, month - 1, day, hours, minutes, 0));
      console.log('📅 Nova data/hora criada (UTC):', newDateTime.toISOString());
      console.log('📅 Horário selecionado:', `${selectedDate} ${selectedTime}`);
      
      // Preparar dados para atualização
      const updateData: any = {
        date: newDateTime.toISOString(),
      };

      // Para contas empresa, incluir employeeId
      // Para contas individuais, o employeeId pode ser null ou o ID do provider
      if (isCompanyAccount) {
        updateData.employeeId = parseInt(selectedEmployeeId);
      } else {
        // Para contas individuais, usar null ou o ID do provider se disponível
        updateData.employeeId = provider ? provider.id : null;
      }

      // Se o agendamento estiver cancelado, mudar status para confirmado
      if (appointment.status === AppointmentStatus.CANCELLED) {
        updateData.status = AppointmentStatus.CONFIRMED;
        console.log('🔄 Agendamento cancelado sendo reagendado - mudando status para confirmado');
      }

      // Atualizar o agendamento
      const response = await apiRequest("PUT", `/api/appointments/${appointment.id}`, updateData);

      console.log('✅ Resposta da API:', response);

      // Invalidar todas as queries relacionadas a agendamentos
      await queryClient.invalidateQueries({ 
        queryKey: ["/api/my-appointments"], 
        exact: false 
      });
      
      // Invalidar também queries específicas que podem estar em cache
      await queryClient.invalidateQueries({ 
        queryKey: ["/api/appointments"], 
        exact: false 
      });

      console.log('🔄 Cache invalidado com sucesso');

      toast({
        title: "Sucesso",
        description: "Agendamento reagendado com sucesso!",
      });

      onComplete();
    } catch (error) {
      console.error('❌ Erro no reagendamento:', error);
      toast({
        title: "Erro",
        description: "Não foi possível reagendar o agendamento",
        variant: "destructive",
      });
    } finally {
      setIsSubmitting(false);
    }
  };

  // Verificar se o horário selecionado está ocupado
  const isSelectedTimeOccupied = !!(selectedTime && occupiedTimes.includes(selectedTime));

  const currentDateTime = new Date(appointment.date);
  const currentEmployee = isCompanyAccount 
    ? employees?.find((emp: Employee) => emp.id === appointment.employeeId)
    : null;

  return (
    <div className="space-y-4">
      {/* Nome do cliente (não editável) */}
      <div>
        <Label className="text-sm font-medium">Cliente</Label>
        <div className="mt-1 p-2 bg-gray-50 rounded-md text-sm">
          {client?.name || "Carregando..."}
        </div>
      </div>

      {/* Horário atual */}
      <div>
        <Label className="text-sm font-medium">Horário atual</Label>
        <div className="mt-1 p-2 bg-gray-50 rounded-md text-sm">
          {formatDate(currentDateTime)} às {formatTime(currentDateTime)}
          {isCompanyAccount && currentEmployee && (
            <span className="ml-2 text-gray-600">
              - {currentEmployee.name}
            </span>
          )}
          {!isCompanyAccount && (
            <span className="ml-2 text-gray-600">
              - Você
            </span>
          )}
        </div>
      </div>

      {/* Seleção de funcionário (apenas para contas empresa) */}
      {isCompanyAccount && (
        <div>
          <Label htmlFor="employee" className="text-sm font-medium">
            Funcionário *
          </Label>
          <Select value={selectedEmployeeId} onValueChange={setSelectedEmployeeId}>
            <SelectTrigger className="mt-1">
              <SelectValue placeholder="Selecione um funcionário" />
            </SelectTrigger>
            <SelectContent>
              {employees?.map((employee: Employee) => (
                <SelectItem key={employee.id} value={employee.id.toString()}>
                  {employee.name} - {employee.specialty}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      )}

      {/* Seleção de data */}
      <div>
        <Label htmlFor="date" className="text-sm font-medium">
          Nova data *
        </Label>
        <Select value={selectedDate} onValueChange={setSelectedDate}>
          <SelectTrigger className="mt-1">
            <SelectValue placeholder="Selecione uma data" />
          </SelectTrigger>
          <SelectContent>
            {availableDates.map((date) => (
              <SelectItem key={date.value} value={date.value}>
                {date.label}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      {/* Seleção de horário */}
      <div>
        <Label htmlFor="time" className="text-sm font-medium">
          Novo horário *
        </Label>
        
        {/* Legenda de cores */}
        {selectedDate && (isCompanyAccount ? selectedEmployeeId : true) && (
          <div className="mt-1 mb-2 p-2 bg-gray-50 border border-gray-200 rounded-md text-xs">
            <div className="flex flex-wrap gap-3">
              <div className="flex items-center">
                <div className="w-3 h-3 bg-red-100 border border-red-300 rounded mr-1"></div>
                <span className="text-gray-600">🚫 Ocupado</span>
              </div>
              <div className="flex items-center">
                <div className="w-3 h-3 bg-yellow-100 border border-yellow-300 rounded mr-1"></div>
                <span className="text-gray-600">🍽️ Horário de almoço</span>
              </div>
              <div className="flex items-center">
                <div className="w-3 h-3 bg-white border border-gray-300 rounded mr-1"></div>
                <span className="text-gray-600">✅ Disponível</span>
              </div>
            </div>
          </div>
        )}
        
        <Select 
          value={selectedTime} 
          onValueChange={setSelectedTime}
          disabled={!selectedDate || (isCompanyAccount && !selectedEmployeeId)}
        >
          <SelectTrigger className="mt-1">
            <SelectValue placeholder="Selecione um horário" />
          </SelectTrigger>
          <SelectContent>
            {availableTimes.length > 0 ? (
              availableTimes.map((time) => {
                // Verificar se este horário está ocupado
                const isOccupied = occupiedTimes.includes(time);
                
                // Verificar se este horário está no intervalo de almoço
                const isLunchTime = (() => {
                  if (isCompanyAccount) {
                    // Lógica para contas empresa
                    if (!selectedEmployeeId || !employees) return false;
                    
                    const selectedEmployee = employees.find((emp: Employee) => emp.id.toString() === selectedEmployeeId);
                    if (!selectedEmployee || !selectedEmployee.lunchBreakStart || !selectedEmployee.lunchBreakEnd) {
                      return false;
                    }

                    // Converter horários para minutos para comparação
                    const [timeHour, timeMinute] = time.split(':').map(Number);
                    const timeInMinutes = timeHour * 60 + timeMinute;

                    const [lunchStartHour, lunchStartMinute] = selectedEmployee.lunchBreakStart.split(':').map(Number);
                    const [lunchEndHour, lunchEndMinute] = selectedEmployee.lunchBreakEnd.split(':').map(Number);
                    
                    const lunchStartInMinutes = lunchStartHour * 60 + lunchStartMinute;
                    const lunchEndInMinutes = lunchEndHour * 60 + lunchEndMinute;

                    // Verificar se o horário está dentro do intervalo de almoço
                    return timeInMinutes >= lunchStartInMinutes && timeInMinutes < lunchEndInMinutes;
                  } else {
                    // Lógica para contas individuais
                    if (!provider || !provider.lunchBreakStart || !provider.lunchBreakEnd) {
                      return false;
                    }

                    // Converter horários para minutos para comparação
                    const [timeHour, timeMinute] = time.split(':').map(Number);
                    const timeInMinutes = timeHour * 60 + timeMinute;

                    const [lunchStartHour, lunchStartMinute] = provider.lunchBreakStart.split(':').map(Number);
                    const [lunchEndHour, lunchEndMinute] = provider.lunchBreakEnd.split(':').map(Number);
                    
                    const lunchStartInMinutes = lunchStartHour * 60 + lunchStartMinute;
                    const lunchEndInMinutes = lunchEndHour * 60 + lunchEndMinute;

                    // Verificar se o horário está dentro do intervalo de almoço
                    return timeInMinutes >= lunchStartInMinutes && timeInMinutes < lunchEndInMinutes;
                  }
                })();

                // Determinar a classe CSS baseada no status do horário
                let itemClassName = "";
                if (isOccupied) {
                  itemClassName = "bg-red-100 text-red-800 hover:bg-red-200";
                } else if (isLunchTime) {
                  itemClassName = "bg-yellow-100 text-yellow-800 hover:bg-yellow-200";
                }

                return (
                  <SelectItem 
                    key={time} 
                    value={time}
                    className={itemClassName}
                    disabled={isOccupied}
                  >
                    <div className="flex items-center justify-between w-full">
                      <span>{time}</span>
                      <div className="flex items-center space-x-1">
                        {isOccupied && (
                          <span className="ml-2 text-xs bg-red-200 text-red-800 px-1 rounded">
                            🚫 Ocupado
                          </span>
                        )}
                        {isLunchTime && !isOccupied && (
                          <span className="ml-2 text-xs bg-yellow-200 text-yellow-800 px-1 rounded">
                            🍽️ Almoço
                          </span>
                        )}
                      </div>
                    </div>
                  </SelectItem>
                );
              })
            ) : (
              <SelectItem value="no-times-available" disabled>
                {selectedDate && (isCompanyAccount ? selectedEmployeeId : true)
                  ? "Nenhum horário disponível" 
                  : isCompanyAccount 
                    ? "Selecione data e funcionário primeiro"
                    : "Selecione uma data primeiro"
                }
              </SelectItem>
            )}
          </SelectContent>
        </Select>
        
        {/* Notificação de horário de almoço */}
        {lunchTimeNotification && (
          <div className="mt-2 p-2 bg-yellow-50 border border-yellow-200 rounded-md text-sm text-yellow-800">
            {lunchTimeNotification}
          </div>
        )}

        {/* Aviso quando horário ocupado está selecionado */}
        {isSelectedTimeOccupied && (
          <div className="mt-2 p-2 bg-red-50 border border-red-200 rounded-md text-sm text-red-800">
            ⚠️ O horário selecionado está ocupado. Por favor, escolha outro horário para continuar.
          </div>
        )}
      </div>

      {/* Botões */}
      <div className="flex justify-end space-x-2 pt-4">
        <Button variant="outline" onClick={handleCancel} disabled={isSubmitting}>
          Cancelar
        </Button>
        <Button 
          onClick={() => {
            console.log('🔘 Botão de reagendamento clicado');
            handleSubmit();
          }} 
          disabled={isSubmitting || isSelectedTimeOccupied}
        >
          {isSubmitting ? "Reagendando..." : "Confirmar reagendamento"}
        </Button>
      </div>
    </div>
  );
};

export default RescheduleAppointmentForm; 