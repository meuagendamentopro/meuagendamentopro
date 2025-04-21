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
import { formatDate } from "@/lib/dates";
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
  const clientFormRef = useRef<{ name: string; phone: string; notes: string }>({
    name: "",
    phone: "",
    notes: "",
  });
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [bookingComplete, setBookingComplete] = useState(false);

  // Fetch services
  const { data: services, isLoading: servicesLoading } = useQuery({
    queryKey: ["/api/providers", providerId, "services"],
    queryFn: async ({ queryKey }) => {
      const res = await fetch(`/api/providers/${providerId}/services`);
      if (!res.ok) throw new Error("Failed to fetch services");
      return res.json();
    },
  });

  // Check availability for a selected service and date
  const checkAvailability = async (serviceId: number, date: Date) => {
    try {
      // Find the service to get duration
      const service = services.find((s: Service) => s.id === serviceId);
      if (!service) return;

      // Generate all possible time slots
      const allTimeSlots = generateTimeSlots(8, 19, 30);
      const available: string[] = [];

      // Check each time slot for availability
      for (const time of allTimeSlots) {
        const [hours, minutes] = time.split(":").map(Number);
        const slotDate = new Date(date);
        slotDate.setHours(hours, minutes, 0, 0);

        // Skip past time slots for today
        const now = new Date();
        if (
          date.getDate() === now.getDate() &&
          date.getMonth() === now.getMonth() &&
          date.getFullYear() === now.getFullYear() &&
          slotDate < now
        ) {
          continue;
        }

        const res = await fetch(
          `/api/providers/${providerId}/availability?date=${slotDate.toISOString()}&serviceId=${serviceId}`
        );
        const data = await res.json();

        if (data.available) {
          available.push(time);
        }
      }

      setAvailableTimes(available);

      // If no time selected or selected time is not available, select the first available time
      if (available.length > 0 && (!selectedTime || !available.includes(selectedTime))) {
        setSelectedTime(available[0]);
      } else if (available.length === 0) {
        setSelectedTime("");
      }
    } catch (error) {
      console.error("Error checking availability:", error);
      toast({
        title: "Erro",
        description: "Não foi possível verificar horários disponíveis",
        variant: "destructive",
      });
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

  // Handle client form submission
  const handleClientForm = (values: { name: string; phone: string; notes: string }) => {
    clientFormRef.current = values;
    handleSubmitBooking();
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

    setIsSubmitting(true);

    try {
      const [hours, minutes] = selectedTime.split(":").map(Number);
      const appointmentDate = new Date(selectedDate);
      appointmentDate.setHours(hours, minutes, 0, 0);

      const bookingData = {
        name: clientFormRef.current.name,
        phone: clientFormRef.current.phone,
        notes: clientFormRef.current.notes,
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
                  <TimeSelector
                    availableTimes={availableTimes}
                    selectedTime={selectedTime}
                    onChange={handleSelectTime}
                  />
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
                onClick={() => handleClientForm(clientFormRef.current)}
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
