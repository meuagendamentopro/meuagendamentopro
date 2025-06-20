import React, { useEffect, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import BookingForm from "@/components/booking/booking-form";
import { Calendar } from "lucide-react";
import { useLocation } from "wouter";

// Interface para o provider incluindo o avatarUrl e configurações PIX
interface Provider {
  id: number;
  name: string;
  email: string;
  phone: string;
  specialties: string;
  workingHoursStart: number;
  workingHoursEnd: number;
  bookingLink?: string;
  avatarUrl?: string | null;
  createdAt?: string;
  updatedAt?: string;
  // Campos de configuração PIX
  pixEnabled?: boolean;
  pixRequirePayment?: boolean;
  pixPaymentPercentage?: number;
  // Informações do usuário
  userId?: number;
  user?: {
    accountType?: string;
  };
}

const BookingPage: React.FC = () => {
  const [providerId, setProviderId] = useState<number | null>(null);
  const [providerLink, setProviderLink] = useState<string | null>(null);
  const [location] = useLocation();
  
  // Extract provider identifier from URL path or query parameters
  useEffect(() => {
    // Verificar primeiro se é uma URL de formato /booking/{link}
    const pathMatch = location.match(/\/booking\/([^\/]+)/);
    
    if (pathMatch && pathMatch[1]) {
      setProviderLink(pathMatch[1]);
    } else {
      // Se não for formato path, verificar query params para compatibilidade
      const params = new URLSearchParams(window.location.search);
      const providerParam = params.get('provider');
      
      if (providerParam) {
        const id = parseInt(providerParam);
        if (!isNaN(id)) {
          setProviderId(id);
        } else {
          // Se não for um número, pode ser um link
          setProviderLink(providerParam);
        }
      }
    }
  }, [location]);
  
  // Fetch provider details
  const { data: provider, isLoading, error } = useQuery({
    queryKey: ['/api/providers/booking', providerLink || providerId],
    queryFn: async ({ queryKey }) => {
      console.log(`Buscando provider com: link=${providerLink}, id=${providerId}`);
      
      // Se temos um link de provider
      if (providerLink) {
        try {
          const res = await fetch(`/api/providers/booking/${providerLink}`);
          if (!res.ok) {
            console.error(`Erro ao buscar provider, status: ${res.status}`);
            throw new Error('Failed to fetch provider');
          }
          return res.json();
        } catch (error) {
          console.error('Erro ao buscar provider por link:', error);
          throw error;
        }
      }
      
      // Se temos um ID de provider (compatibilidade)
      if (providerId) {
        try {
          const res = await fetch(`/api/providers/${providerId}`);
          if (!res.ok) {
            console.error(`Erro ao buscar provider por ID, status: ${res.status}`);
            throw new Error('Failed to fetch provider by ID');
          }
          return res.json();
        } catch (error) {
          console.error('Erro ao buscar provider por ID:', error);
          throw error;
        }
      }
      
      return null;
    },
    enabled: !!(providerLink || providerId),
    retry: 1,
  });

  // Verificar se é conta empresa (tem funcionários)
  const { data: employees } = useQuery({
    queryKey: [`/api/providers/${provider?.id}/employees`],
    queryFn: async () => {
      if (!provider?.id) return [];
      const res = await fetch(`/api/providers/${provider.id}/employees`);
      if (!res.ok) return [];
      return res.json();
    },
    enabled: !!provider?.id,
  });

  const isCompanyAccount = employees && employees.length > 0;

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
          {provider && provider.avatarUrl && (
            <div className="flex flex-col items-center justify-center mb-4">
              <div className="w-24 h-24 rounded-full overflow-hidden border-4 border-primary-100 mb-3">
                <img 
                  src={provider.avatarUrl}
                  alt={`Foto de ${provider.name}`}
                  className="w-full h-full object-cover"
                />
              </div>
            </div>
          )}
          <h1 className="text-3xl font-bold text-gray-900">
            {provider ? `Agendamento com ${provider.name}` : 'Agendamento Online'}
          </h1>
          <p className="mt-2 text-gray-600">
            Escolha o serviço, data e horário para seu agendamento
          </p>
          
          {/* Botão para consultar agendamento - apenas para contas empresa */}
          {isCompanyAccount && (
            <div className="mt-6">
              <button
                onClick={() => window.location.href = `/appointment-lookup?providerId=${provider?.id}`}
                className="inline-flex items-center px-4 py-2 border border-gray-300 rounded-md shadow-sm text-sm font-medium text-gray-700 bg-white hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-primary-500"
              >
                <Calendar className="h-4 w-4 mr-2" />
                Consultar Agendamento
              </button>
            </div>
          )}
        </div>

        {provider ? (
          <BookingForm providerId={provider.id} />
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
        <p>© 2023 Meu Agendamento PRO - Sistema de Agendamento Online</p>
      </footer>
    </div>
  );
};

export default BookingPage;
