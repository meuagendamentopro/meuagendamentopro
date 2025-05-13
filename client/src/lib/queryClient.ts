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
    console.log(`Iniciando requisição GET para ${url}`);
    
    try {
      const response = await apiRequest("GET", url);
      console.log(`Resposta recebida de ${url}:`, {
        status: response.status,
        ok: response.ok
      });

      if (response.status === 401 && options.on401 === "returnNull") {
        console.log(`Retornando null para ${url} devido ao status 401`);
        return null;
      }

      if (!response.ok) {
        const errorText = await response.text();
        console.error(`Erro na requisição para ${url}:`, {
          status: response.status,
          body: errorText
        });
        throw new Error(`Request to ${url} failed with status ${response.status}: ${errorText}`);
      }

      const data = await response.json();
      console.log(`Dados recebidos de ${url}:`, {
        dataPreview: typeof data === 'object' ? 'Objeto recebido' : data
      });
      return data;
    } catch (error) {
      console.error(`Exceção na requisição para ${url}:`, error);
      throw error;
    }
  };
};

export const apiRequest = async (
  method: string,
  url: string,
  data?: any
): Promise<Response> => {
  console.log(`Iniciando requisição ${method} para ${url}`, data ? { dataPreview: 'Dados presentes' } : {});
  
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
    const timeoutId = setTimeout(() => {
      console.warn(`Timeout de 15s atingido para ${method} ${url}`);
      controller.abort();
    }, 15000); // 15 segundos de timeout
    
    options.signal = controller.signal;
    
    console.log(`Executando fetch para ${method} ${url}...`);
    const startTime = Date.now();
    const response = await fetch(url, options);
    const duration = Date.now() - startTime;
    console.log(`Resposta recebida de ${method} ${url} em ${duration}ms:`, {
      status: response.status,
      ok: response.ok,
      statusText: response.statusText
    });
    
    clearTimeout(timeoutId);
    
    return response;
  } catch (error) {
    console.error(`Exceção na requisição ${method} ${url}:`, error);
    
    if (error instanceof DOMException && error.name === 'AbortError') {
      throw new Error(`Requisição para ${url} excedeu o tempo limite de 15 segundos`);
    }
    
    if (!navigator.onLine) {
      throw new Error('Sem conexão com a internet. Por favor, verifique sua conexão e tente novamente.');
    }
    
    throw error;
  }
};