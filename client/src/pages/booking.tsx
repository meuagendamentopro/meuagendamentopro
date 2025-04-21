import React, { useEffect, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import BookingForm from "@/components/booking/booking-form";
import { Calendar } from "lucide-react";

const BookingPage: React.FC = () => {
  const [providerId, setProviderId] = useState<number | null>(null);
  
  // Extract providerId from URL query parameters
  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const providerParam = params.get('provider');
    
    if (providerParam) {
      const id = parseInt(providerParam);
      if (!isNaN(id)) {
        setProviderId(id);
      }
    } else {
      // Default to first provider if none specified
      setProviderId(1);
    }
  }, []);
  
  // Fetch provider details
  const { data: provider, isLoading } = useQuery({
    queryKey: ['/api/providers', providerId],
    queryFn: async ({ queryKey }) => {
      if (!providerId) return null;
      const res = await fetch(`/api/providers/${providerId}`);
      if (!res.ok) throw new Error('Failed to fetch provider');
      return res.json();
    },
    enabled: !!providerId,
  });

  if (isLoading) {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center p-4">
        <div className="animate-spin mb-4">
          <Calendar className="h-8 w-8 text-primary-500" />
        </div>
        <p className="text-gray-500">Carregando...</p>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50 pt-8 pb-12">
      <div className="max-w-3xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="text-center mb-8">
          <h1 className="text-3xl font-bold text-gray-900">
            {provider ? `Agendamento com ${provider.name}` : 'Agendamento Online'}
          </h1>
          <p className="mt-2 text-gray-600">
            Escolha o serviço, data e horário para seu agendamento
          </p>
        </div>

        {providerId ? (
          <BookingForm providerId={providerId} />
        ) : (
          <div className="text-center p-8 bg-white rounded-lg shadow">
            <Calendar className="mx-auto h-12 w-12 text-gray-400 mb-4" />
            <h3 className="text-lg font-medium text-gray-900 mb-1">
              Nenhum profissional selecionado
            </h3>
            <p className="text-gray-500">
              Por favor, use um link de agendamento válido
            </p>
          </div>
        )}
      </div>

      <footer className="mt-16 text-center text-sm text-gray-500">
        <p>© 2023 AgendaPro - Sistema de Agendamento Online</p>
      </footer>
    </div>
  );
};

export default BookingPage;
