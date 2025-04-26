import React, { useState, useRef } from "react";
import { useQuery } from "@tanstack/react-query";
import { useToast } from "@/hooks/use-toast";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Calendar, Check } from "lucide-react";
import ServiceSelector from "./service-selector";
import DateSelector from "./date-selector";
import TimeSelector from "./time-selector";
import ClientForm from "./client-form";
import { formatDate, combineDateAndTime } from "@/lib/dates";
import { generateTimeSlots } from "@/lib/utils";
import { Service } from "@shared/schema";
import { apiRequest } from "@/lib/queryClient";

interface BookingFormProps {
  providerId: number;
}

const BookingForm: React.FC<BookingFormProps> = ({ providerId }) => {
  const { toast } = useToast();
  const [step, setStep] = useState(1);
  const [selectedService, setSelectedService] = useState<number | null>(null);
  const [selectedDate, setSelectedDate] = useState<Date>(new Date());
  const [selectedTime, setSelectedTime] = useState<string>("");
  const [availableTimes, setAvailableTimes] = useState<string[]>([]);
  const [loadingTimes, setLoadingTimes] = useState<boolean>(false);
  const clientFormRef = useRef<{ name: string; phone: string; notes: string }>({
    name: "",
    phone: "",
    notes: "",
  });
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [bookingComplete, setBookingComplete] = useState(false);
  
  // Garante que clientFormRef.current nunca é undefined
  if (!clientFormRef.current) {
    clientFormRef.current = { name: "", phone: "", notes: "" };
  }

  // Fetch services
  const { data: services, isLoading: servicesLoading } = useQuery({
    queryKey: ["/api/providers", providerId, "services"],
    queryFn: async ({ queryKey }) => {
      const res = await fetch(`/api/providers/${providerId}/services`);
      if (!res.ok) throw new Error("Failed to fetch services");
      return res.json();
    },
  });
  
  // Fetch provider details including working hours
  const { data: provider } = useQuery({
    queryKey: ["/api/providers", providerId],
    queryFn: async ({ queryKey }) => {
      const res = await fetch(`/api/providers/${providerId}`);
      if (!res.ok) throw new Error("Failed to fetch provider details");
      return res.json();
    },
  });

  // Check availability for a selected service and date
  const checkAvailability = async (serviceId: number, date: Date) => {
    try {
      // Limpar os horários disponíveis e ativar indicador de carregamento
      setAvailableTimes([]);
      setLoadingTimes(true);
      
      // Find the service to get duration
      const service = services.find((s: Service) => s.id === serviceId);
      if (!service) {
        setLoadingTimes(false);
        return;
      }

      // Buscar os dados atualizados do provider para garantir que temos as configurações mais recentes
      const providerResponse = await fetch(`/api/providers/${providerId}`);
      const latestProvider = await providerResponse.json();
      
      // Exibir os dados completos do profissional para verificação de campos
      console.log("Provider completo:", JSON.stringify(latestProvider, null, 2));
      
      // PROBLEMA IDENTIFICADO: Usando valores fixos! Vamos corrigir
      // Horários padrão apenas se não estiverem configurados
      let workingHoursStart = 8; // Valor padrão 8h
      let workingHoursEnd = 18;  // Valor padrão 18h
      
      // Verificar se a resposta tem os campos esperados com os valores corretos
      if (latestProvider && typeof latestProvider.workingHoursStart === 'number') {
        workingHoursStart = latestProvider.workingHoursStart;
        console.log(`✓ Usando workingHoursStart do provider: ${workingHoursStart}`);
      } else {
        console.warn(`⚠️ Horário de início não encontrado no provider, usando padrão: ${workingHoursStart}`);
      }
      
      if (latestProvider && typeof latestProvider.workingHoursEnd === 'number') {
        workingHoursEnd = latestProvider.workingHoursEnd;
        console.log(`✓ Usando workingHoursEnd do provider: ${workingHoursEnd}`);
      } else {
        console.warn(`⚠️ Horário de término não encontrado no provider, usando padrão: ${workingHoursEnd}`);
      }
          
      console.log(`Gerando horários entre ${workingHoursStart}h e ${workingHoursEnd}h para provider ${providerId}`);
      
      // Gerar todos os slots de horário com base nas configurações do provider
      const allTimeSlots = generateTimeSlots(workingHoursStart, workingHoursEnd, 30);
      console.log("Slots gerados:", allTimeSlots);
      
      const available: string[] = [];

      // Verificar disponibilidade de cada slot de horário
      for (const time of allTimeSlots) {
        const [hours, minutes] = time.split(":").map(Number);
        
        // Criar a data completa combinando a data selecionada com o horário do slot
        // Obs: Não precisamos ajustar o fuso horário aqui, o backend já lida com isso
        const slotDate = new Date(
          date.getFullYear(),
          date.getMonth(),
          date.getDate(),
          hours,
          minutes,
          0
        );
        
        // Pular horários que já passaram no dia atual
        const now = new Date();
        if (
          date.getDate() === now.getDate() &&
          date.getMonth() === now.getMonth() &&
          date.getFullYear() === now.getFullYear() &&
          slotDate < now
        ) {
          console.log(`Pulando horário passado: ${time}`);
          continue;
        }

        // Verificar disponibilidade no backend
        const res = await fetch(
          `/api/providers/${providerId}/availability?date=${slotDate.toISOString()}&serviceId=${serviceId}`
        );
        const data = await res.json();

        if (data.available) {
          available.push(time);
        }
      }

      console.log("Horários disponíveis:", available);
      setAvailableTimes(available);

      // Se não houver horário selecionado ou o horário selecionado não estiver disponível, 
      // selecionar o primeiro horário disponível
      if (available.length > 0 && (!selectedTime || !available.includes(selectedTime))) {
        setSelectedTime(available[0]);
      } else if (available.length === 0) {
        setSelectedTime("");
      }
      
      // Desativar indicador de carregamento após concluir a busca
      setLoadingTimes(false);
    } catch (error) {
      console.error("Error checking availability:", error);
      toast({
        title: "Erro",
        description: "Não foi possível verificar horários disponíveis",
        variant: "destructive",
      });
      // Garantir que o indicador de carregamento seja desativado mesmo em caso de erro
      setLoadingTimes(false);
    }
  };

  // Handle service selection
  const handleSelectService = (serviceId: number) => {
    setSelectedService(serviceId);
    checkAvailability(serviceId, selectedDate);
  };

  // Handle date selection
  const handleSelectDate = (date: Date) => {
    setSelectedDate(date);
    if (selectedService) {
      checkAvailability(selectedService, date);
    }
  };

  // Handle time selection
  const handleSelectTime = (time: string) => {
    setSelectedTime(time);
  };

  // Handle client form submission - apenas armazena os valores, sem submeter
  const handleClientForm = (values: { name: string; phone: string; notes: string }) => {
    console.log("Recebendo valores do formulário do cliente:", values);
    
    // Armazena os valores recebidos na referência e garante que não sejam undefined
    clientFormRef.current = {
      name: values.name ? values.name.trim() : "",
      phone: values.phone || "",
      notes: values.notes || ""
    };
    
    // Debug - verificar se os valores estão sendo armazenados
    console.log("Valores armazenados:", clientFormRef.current);
  };

  // Navigate to next step
  const handleNextStep = () => {
    if (step === 1 && !selectedService) {
      toast({
        title: "Selecione um serviço",
        description: "Por favor, selecione um serviço para continuar",
        variant: "destructive",
      });
      return;
    }

    if (step === 2 && !selectedTime) {
      toast({
        title: "Selecione um horário",
        description: "Por favor, selecione um horário disponível para continuar",
        variant: "destructive",
      });
      return;
    }

    setStep(step + 1);
  };

  // Go back to previous step
  const handlePrevStep = () => {
    setStep(step - 1);
  };

  // Submit booking
  const handleSubmitBooking = async () => {
    if (!selectedService || !selectedTime) return;
    
    // Verificar se os dados do cliente estão preenchidos
    if (!clientFormRef.current.name || clientFormRef.current.name.trim().length < 3) {
      toast({
        title: "Nome inválido",
        description: "O nome deve ter pelo menos 3 caracteres.",
        variant: "destructive",
      });
      return;
    }
    
    if (!clientFormRef.current.phone || clientFormRef.current.phone.replace(/\D/g, '').length < 10) {
      toast({
        title: "Telefone inválido",
        description: "O telefone deve ter pelo menos 10 dígitos (incluindo DDD).",
        variant: "destructive",
      });
      return;
    }

    setIsSubmitting(true);

    try {
      // Usar a função combineDateAndTime que já tem o ajuste de fuso horário
      const appointmentDate = combineDateAndTime(selectedDate, selectedTime);

      // Dados do agendamento com nome e telefone validados
      const bookingData = {
        name: clientFormRef.current.name.trim(),
        phone: clientFormRef.current.phone,
        notes: clientFormRef.current.notes || "",
        serviceId: selectedService,
        date: appointmentDate.toISOString().split("T")[0],
        time: selectedTime,
      };

      const response = await apiRequest("POST", "/api/booking", bookingData);
      const result = await response.json();

      if (result.success) {
        setBookingComplete(true);
        toast({
          title: "Agendamento confirmado!",
          description: result.message,
        });
      }
    } catch (error) {
      console.error("Booking error:", error);
      toast({
        title: "Erro no agendamento",
        description: "Não foi possível realizar o agendamento. Por favor, tente novamente.",
        variant: "destructive",
      });
    } finally {
      setIsSubmitting(false);
    }
  };

  // Get selected service details
  const getSelectedServiceDetails = () => {
    if (!selectedService || !services) return null;
    return services.find((s: Service) => s.id === selectedService);
  };

  const selectedServiceDetails = getSelectedServiceDetails();

  // Render success view
  if (bookingComplete) {
    return (
      <Card className="w-full max-w-md mx-auto">
        <CardContent className="pt-6 flex flex-col items-center text-center">
          <div className="w-12 h-12 bg-primary-100 rounded-full flex items-center justify-center mb-4">
            <Check className="h-6 w-6 text-primary-600" />
          </div>
          <h2 className="text-xl font-semibold mb-2">Agendamento confirmado!</h2>
          <p className="text-gray-600 mb-4">
            Seu agendamento foi confirmado com sucesso. Você receberá uma mensagem de confirmação
            via WhatsApp em breve.
          </p>
          {selectedServiceDetails && (
            <div className="bg-gray-50 p-4 rounded-lg w-full mb-4">
              <p className="font-medium">{selectedServiceDetails.name}</p>
              <p className="text-gray-600">
                {formatDate(selectedDate)} às {selectedTime}
              </p>
            </div>
          )}
          <Button className="w-full" onClick={() => window.location.reload()}>
            Fazer novo agendamento
          </Button>
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="w-full max-w-md mx-auto">
      {/* Progress steps */}
      <div className="flex mb-6">
        <div className="flex-1">
          <div
            className={`h-2 ${
              step >= 1 ? "bg-primary-500" : "bg-gray-200"
            } rounded-l-full transition-colors`}
          ></div>
          <span className="block text-xs mt-1 text-center">Serviço</span>
        </div>
        <div className="flex-1">
          <div
            className={`h-2 ${
              step >= 2 ? "bg-primary-500" : "bg-gray-200"
            } transition-colors`}
          ></div>
          <span className="block text-xs mt-1 text-center">Data e hora</span>
        </div>
        <div className="flex-1">
          <div
            className={`h-2 ${
              step >= 3 ? "bg-primary-500" : "bg-gray-200"
            } rounded-r-full transition-colors`}
          ></div>
          <span className="block text-xs mt-1 text-center">Seus dados</span>
        </div>
      </div>

      <Card>
        <CardContent className="pt-6">
          {/* Step 1: Select Service */}
          {step === 1 && (
            <div className="space-y-4">
              <div className="mb-4">
                <h2 className="text-lg font-medium text-gray-900">Escolha o serviço</h2>
                <p className="text-sm text-gray-500">
                  Selecione o serviço que deseja agendar
                </p>
              </div>
              <ServiceSelector
                services={services || []}
                selectedServiceId={selectedService}
                onSelect={handleSelectService}
                isLoading={servicesLoading}
              />
            </div>
          )}

          {/* Step 2: Select Date and Time */}
          {step === 2 && (
            <div className="space-y-6">
              <div className="mb-4">
                <h2 className="text-lg font-medium text-gray-900">Escolha data e horário</h2>
                <p className="text-sm text-gray-500">
                  Selecione quando deseja agendar seu serviço
                </p>
              </div>

              <div className="space-y-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">Data</label>
                  <DateSelector
                    selectedDate={selectedDate}
                    onChange={handleSelectDate}
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">Horário</label>
                  {loadingTimes ? (
                    <div className="flex justify-center items-center py-8 border border-dashed rounded-lg bg-gray-50">
                      <div className="flex flex-col items-center">
                        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary-500 mb-2"></div>
                        <p className="text-sm text-gray-500">Carregando horários disponíveis...</p>
                      </div>
                    </div>
                  ) : (
                    <TimeSelector
                      availableTimes={availableTimes}
                      selectedTime={selectedTime}
                      onChange={handleSelectTime}
                    />
                  )}
                </div>
              </div>
            </div>
          )}

          {/* Step 3: Client Information */}
          {step === 3 && (
            <div className="space-y-4">
              <div className="mb-4">
                <h2 className="text-lg font-medium text-gray-900">Suas informações</h2>
                <p className="text-sm text-gray-500">
                  Preencha seus dados para confirmar o agendamento
                </p>
              </div>

              {selectedServiceDetails && (
                <div className="bg-gray-50 p-3 rounded-lg mb-4">
                  <div className="flex items-center mb-2">
                    <Calendar className="h-4 w-4 text-primary-500 mr-2" />
                    <span className="text-sm font-medium">Detalhes do agendamento</span>
                  </div>
                  <p className="text-sm text-gray-700">
                    <span className="font-medium">{selectedServiceDetails.name}</span>
                  </p>
                  <p className="text-sm text-gray-600">
                    {formatDate(selectedDate)} às {selectedTime}
                  </p>
                </div>
              )}

              <ClientForm onSubmitValues={handleClientForm} />
            </div>
          )}

          {/* Navigation buttons */}
          <div className="mt-6 flex justify-between">
            {step > 1 ? (
              <Button variant="outline" onClick={handlePrevStep} disabled={isSubmitting}>
                Voltar
              </Button>
            ) : (
              <div></div> // Empty div to maintain flex spacing
            )}

            {step < 3 ? (
              <Button onClick={handleNextStep}>
                Próximo
              </Button>
            ) : (
              <Button 
                onClick={() => handleSubmitBooking()}
                disabled={isSubmitting}
              >
                {isSubmitting ? "Agendando..." : "Confirmar agendamento"}
              </Button>
            )}
          </div>
        </CardContent>
      </Card>
    </div>
  );
};

export default BookingForm;
