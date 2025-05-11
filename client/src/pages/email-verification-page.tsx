import { useState, useEffect } from "react";
import { useLocation } from "wouter";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Loader2, CheckCircle, AlertTriangle, RefreshCw } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { Link } from "wouter";
import { apiRequest } from "@/lib/queryClient";

export default function EmailVerificationPage() {
  const [location] = useLocation();
  // Extrair parâmetros da URL
  const params = new URLSearchParams(location.split('?')[1] || '');
  const email = params.get("email");
  // O token está na URL como /verify-email/:token, então precisamos extraí-lo do caminho
  const pathParts = location.split('/');
  const token = pathParts[pathParts.length - 1].split('?')[0];
  const { toast } = useToast();
  
  const [status, setStatus] = useState<"verifying" | "success" | "error">("verifying");
  const [errorMessage, setErrorMessage] = useState<string>("");
  
  useEffect(() => {
    if (!email || !token) {
      setStatus("error");
      setErrorMessage("Parâmetros inválidos. Certifique-se de clicar no link correto do email.");
      return;
    }
    
    const verifyEmail = async () => {
      try {
        // Enviar solicitação de verificação
        const response = await apiRequest("POST", "/api/verify-email", { email, token });
        const data = await response.json();
        
        if (response.ok) {
          setStatus("success");
        } else {
          setStatus("error");
          setErrorMessage(data.error || "Falha ao verificar email. Tente novamente.");
        }
      } catch (error) {
        setStatus("error");
        setErrorMessage("Erro ao conectar com o servidor. Tente novamente mais tarde.");
        console.error("Erro ao verificar email:", error);
      }
    };
    
    verifyEmail();
  }, [email, token, toast]);
  
  const handleResendVerification = async () => {
    if (!email) {
      toast({
        title: "Erro",
        description: "Email não disponível para reenvio",
        variant: "destructive"
      });
      return;
    }
    
    try {
      const response = await apiRequest("POST", "/api/resend-verification", { email });
      const data = await response.json();
      
      if (response.ok) {
        toast({
          title: "Sucesso",
          description: "Um novo email de verificação foi enviado. Verifique sua caixa de entrada.",
          variant: "default"
        });
      } else {
        toast({
          title: "Erro",
          description: data.error || "Falha ao reenviar email. Tente novamente.",
          variant: "destructive"
        });
      }
    } catch (error) {
      toast({
        title: "Erro",
        description: "Falha ao conectar com o servidor. Tente novamente mais tarde.",
        variant: "destructive"
      });
      console.error("Erro ao reenviar verificação:", error);
    }
  };
  
  return (
    <div className="min-h-screen flex items-center justify-center bg-background p-4">
      <Card className="w-full max-w-md shadow-lg">
        <CardHeader>
          <CardTitle className="text-2xl font-bold text-center">Verificação de Email</CardTitle>
          <CardDescription className="text-center">
            {status === "verifying" && "Verificando seu email..."}
            {status === "success" && "Seu email foi verificado com sucesso!"}
            {status === "error" && "Ocorreu um problema na verificação."}
          </CardDescription>
        </CardHeader>
        
        <CardContent>
          {status === "verifying" && (
            <div className="flex justify-center py-8">
              <Loader2 className="h-12 w-12 animate-spin text-primary" />
            </div>
          )}
          
          {status === "success" && (
            <Alert className="bg-green-50 border-green-200">
              <CheckCircle className="h-5 w-5 text-green-600" />
              <AlertTitle className="text-green-800">Verificação concluída!</AlertTitle>
              <AlertDescription className="text-green-700">
                Seu email foi verificado com sucesso. Agora você pode fazer login na sua conta.
              </AlertDescription>
            </Alert>
          )}
          
          {status === "error" && (
            <Alert className="bg-red-50 border-red-200">
              <AlertTriangle className="h-5 w-5 text-red-600" />
              <AlertTitle className="text-red-800">Falha na verificação</AlertTitle>
              <AlertDescription className="text-red-700">
                {errorMessage}
              </AlertDescription>
            </Alert>
          )}
        </CardContent>
        
        <CardFooter className="flex flex-col gap-4">
          {status === "success" && (
            <Button className="w-full" asChild>
              <Link href="/auth">Ir para Login</Link>
            </Button>
          )}
          
          {status === "error" && email && (
            <Button className="w-full" onClick={handleResendVerification}>
              <RefreshCw className="mr-2 h-4 w-4" />
              Reenviar Email de Verificação
            </Button>
          )}
          
          {status !== "verifying" && (
            <Button variant="outline" className="w-full" asChild>
              <Link href="/">Voltar para Página Inicial</Link>
            </Button>
          )}
        </CardFooter>
      </Card>
    </div>
  );
}