import { QueryClient } from "@tanstack/react-query";

type FetcherOptions = {
  on401?: "returnNull" | "throw" | "fetchAgain";
  jwt?: string;
};

export const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: 1000 * 30, // 30 seconds
      retry: false,
      refetchOnWindowFocus: false,
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

  return fetch(url, options);
};