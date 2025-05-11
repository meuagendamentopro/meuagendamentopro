import { useState, useEffect } from "react";
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { AlertCircle, CheckCircle, RefreshCw, KeyRound } from "lucide-react";
import { apiRequest } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useLocation } from "wouter";

interface VerificationPendingProps {
  email: string;
  onBack: () => void;
}

export function VerificationPending({ email, onBack }: VerificationPendingProps) {
  const [isResending, setIsResending] = useState(false);
  const [verificationCode, setVerificationCode] = useState('');
  const [isVerifying, setIsVerifying] = useState(false);
  const [resendDisabled, setResendDisabled] = useState(false);
  const [countdown, setCountdown] = useState(0);
  const { toast } = useToast();
  const [, navigate] = useLocation();
  
  useEffect(() => {
    let timer: number | undefined;
    if (countdown > 0) {
      timer = window.setTimeout(() => {
        setCountdown(countdown - 1);
      }, 1000);
    } else if (countdown === 0 && resendDisabled) {
      setResendDisabled(false);
    }
    
    return () => {
      if (timer) clearTimeout(timer);
    };
  }, [countdown, resendDisabled]);
  
  const startResendCooldown = () => {
    // 60 segundos de timeout
    setResendDisabled(true);
    setCountdown(60);
  };
  
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
          description: "Um novo código de verificação foi enviado para seu email.",
          variant: "default"
        });
        startResendCooldown();
      } else {
        toast({
          title: "Erro",
          description: data.error || "Falha ao reenviar código. Tente novamente.",
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
  
  const handleVerifyCode = async () => {
    if (!verificationCode || verificationCode.length < 6) {
      toast({
        title: "Código inválido",
        description: "Por favor, digite o código completo enviado por email.",
        variant: "destructive"
      });
      return;
    }
    
    setIsVerifying(true);
    
    try {
      const response = await apiRequest("POST", "/api/verify-code", { 
        email, 
        code: verificationCode 
      });
      
      const data = await response.json();
      
      if (response.ok) {
        toast({
          title: "Verificação concluída",
          description: "Sua conta foi verificada com sucesso!",
          variant: "default"
        });
        setTimeout(() => navigate("/auth"), 1500);
      } else {
        toast({
          title: "Verificação falhou",
          description: data.error || "Código inválido ou expirado. Tente novamente.",
          variant: "destructive"
        });
      }
    } catch (error) {
      toast({
        title: "Erro",
        description: "Falha ao conectar com o servidor. Tente novamente mais tarde.",
        variant: "destructive"
      });
      console.error("Erro ao verificar código:", error);
    } finally {
      setIsVerifying(false);
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
              Foi enviado um código de verificação para <strong>{email}</strong>. 
              Por favor, verifique sua caixa de entrada e digite o código abaixo para ativar sua conta.
            </p>
          </div>
        </div>
        
        <div className="space-y-2">
          <Label htmlFor="verification-code">Código de verificação</Label>
          <div className="flex gap-2">
            <Input
              id="verification-code"
              type="text"
              placeholder="Digite o código de 6 dígitos"
              value={verificationCode}
              onChange={(e) => setVerificationCode(e.target.value.replace(/[^0-9]/g, '').substring(0, 6))}
              maxLength={6}
              className="flex-1"
            />
            <Button 
              onClick={handleVerifyCode} 
              disabled={isVerifying || verificationCode.length < 6}
            >
              {isVerifying ? "Verificando..." : "Verificar"}
            </Button>
          </div>
          <p className="text-sm text-muted-foreground">
            O código de verificação expira em 20 minutos.
          </p>
        </div>
        
        <div className="bg-gray-50 border border-gray-200 rounded-md p-4">
          <h3 className="font-medium text-gray-800 flex items-center">
            <CheckCircle className="h-4 w-4 text-gray-600 mr-2" />
            Próximos passos:
          </h3>
          <ol className="list-decimal list-inside text-sm text-gray-700 mt-2 space-y-2 pl-6">
            <li>Verifique sua caixa de entrada de email</li>
            <li>Procure um email de "Meu Agendamento"</li>
            <li>Digite o código de 6 dígitos recebido</li>
            <li>Após a verificação, você poderá fazer login normalmente</li>
          </ol>
        </div>
      </CardContent>
      <CardFooter className="flex flex-col space-y-3">
        <Button 
          onClick={handleResendVerification} 
          className="w-full" 
          disabled={isResending || resendDisabled}
          variant={resendDisabled ? "outline" : "default"}
        >
          {isResending ? (
            <>
              <RefreshCw className="mr-2 h-4 w-4 animate-spin" />
              Reenviando...
            </>
          ) : resendDisabled ? (
            <>
              <KeyRound className="mr-2 h-4 w-4" />
              Aguarde {countdown}s para reenviar
            </>
          ) : (
            <>
              <RefreshCw className="mr-2 h-4 w-4" />
              Reenviar Código de Verificação
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