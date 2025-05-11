import { useState } from "react";
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { AlertCircle, CheckCircle, RefreshCw } from "lucide-react";
import { apiRequest } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";

interface VerificationPendingProps {
  email: string;
  onBack: () => void;
}

export function VerificationPending({ email, onBack }: VerificationPendingProps) {
  const [isResending, setIsResending] = useState(false);
  const { toast } = useToast();
  
  const handleResendVerification = async () => {
    if (!email) {
      toast({
        title: "Erro",
        description: "Email não disponível para reenvio",
        variant: "destructive"
      });
      return;
    }
    
    setIsResending(true);
    
    try {
      const response = await apiRequest("POST", "/api/resend-verification", { email });
      const data = await response.json();
      
      if (response.ok) {
        toast({
          title: "Sucesso",
          description: "Um novo email de verificação foi enviado. Verifique sua caixa de entrada.",
          variant: "success"
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
    } finally {
      setIsResending(false);
    }
  };
  
  return (
    <Card className="w-full">
      <CardHeader className="space-y-1">
        <CardTitle className="text-2xl font-bold text-center">Verificação Pendente</CardTitle>
        <CardDescription className="text-center">
          Seu email precisa ser verificado antes de continuar.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="bg-yellow-50 border border-yellow-200 rounded-md p-4 flex items-start">
          <AlertCircle className="h-5 w-5 text-yellow-600 mr-3 mt-0.5" />
          <div>
            <h3 className="font-medium text-yellow-800">Atenção</h3>
            <p className="text-yellow-700 text-sm mt-1">
              Foi enviado um email de verificação para <strong>{email}</strong>. 
              Por favor, verifique sua caixa de entrada e clique no link de confirmação para ativar sua conta.
            </p>
          </div>
        </div>
        
        <div className="bg-gray-50 border border-gray-200 rounded-md p-4">
          <h3 className="font-medium text-gray-800 flex items-center">
            <CheckCircle className="h-4 w-4 text-gray-600 mr-2" />
            Próximos passos:
          </h3>
          <ol className="list-decimal list-inside text-sm text-gray-700 mt-2 space-y-2 pl-6">
            <li>Verifique sua caixa de entrada de email</li>
            <li>Procure um email de "Meu Agendamento"</li>
            <li>Clique no link de confirmação no email</li>
            <li>Após a confirmação, você poderá fazer login normalmente</li>
          </ol>
        </div>
      </CardContent>
      <CardFooter className="flex flex-col space-y-3">
        <Button 
          onClick={handleResendVerification} 
          className="w-full" 
          disabled={isResending}
        >
          {isResending ? (
            <>
              <RefreshCw className="mr-2 h-4 w-4 animate-spin" />
              Reenviando...
            </>
          ) : (
            <>
              <RefreshCw className="mr-2 h-4 w-4" />
              Reenviar Email de Verificação
            </>
          )}
        </Button>
        <Button variant="outline" onClick={onBack} className="w-full">
          Voltar para Login
        </Button>
      </CardFooter>
    </Card>
  );
}