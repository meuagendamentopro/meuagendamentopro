import { QueryClient } from "@tanstack/react-query";

type FetcherOptions = {
  on401?: "returnNull" | "throw" | "fetchAgain";
  jwt?: string;
};

// Configuração otimizada para melhor desempenho e estabilidade
export const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: 1000 * 60, // 1 minuto
      retry: 2, // Tentar até 2 vezes
      retryDelay: (attemptIndex) => Math.min(1000 * 2 ** attemptIndex, 10000),
      refetchOnWindowFocus: true,
      refetchOnMount: true,
      refetchOnReconnect: true,
    },
    mutations: {
      retry: 2,
      retryDelay: 1000,
    },
  },
});

export const getQueryFn = (options: FetcherOptions = {}) => {
  return async ({ queryKey }: { queryKey: string[] }) => {
    const [url] = queryKey;
    const response = await apiRequest("GET", url);

    if (response.status === 401 && options.on401 === "returnNull") {
      return null;
    }

    if (!response.ok) {
      throw new Error(`Request failed with status ${response.status}`);
    }

    return response.json();
  };
};

export const apiRequest = async (
  method: string,
  url: string,
  data?: any
): Promise<Response> => {
  const options: RequestInit = {
    method,
    headers: {
      "Content-Type": "application/json",
    },
    credentials: "include", // Necessário para enviar cookies de sessão
  };

  if (data) {
    options.body = JSON.stringify(data);
  }

  try {
    // Adiciona um timeout para evitar requisições que ficam travadas indefinidamente
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 15000); // 15 segundos de timeout
    
    options.signal = controller.signal;
    
    const response = await fetch(url, options);
    clearTimeout(timeoutId);
    
    return response;
  } catch (error) {
    if (error instanceof DOMException && error.name === 'AbortError') {
      throw new Error(`Requisição para ${url} excedeu o tempo limite`);
    }
    
    // Adicionar informação extra ao erro para ajudar no diagnóstico
    console.error(`Erro na requisição ${method} ${url}:`, error);
    
    if (!navigator.onLine) {
      throw new Error('Sem conexão com a internet. Por favor, verifique sua conexão e tente novamente.');
    }
    
    throw error;
  }
};