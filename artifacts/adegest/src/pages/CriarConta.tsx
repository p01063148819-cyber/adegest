import { useState, type FormEvent } from "react";
import { useLocation, Link } from "wouter";
import { useRegister, type Role } from "@workspace/api-client-react";
import { useToast } from "@/hooks/use-toast";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from "@/components/ui/card";

export default function CriarConta() {
  const [, setLocation] = useLocation();
  const { toast } = useToast();

  const [role, setRole] = useState<Role>("vendedor");
  const [senha, setSenha] = useState("");
  const [confirmarSenha, setConfirmarSenha] = useState("");

  const register = useRegister();

  function handleSubmit(e: FormEvent) {
    e.preventDefault();

    if (senha.length < 6) {
      toast({ title: "Senha muito curta", description: "Use pelo menos 6 caracteres.", variant: "destructive" });
      return;
    }
    if (senha !== confirmarSenha) {
      toast({ title: "As senhas não coincidem.", variant: "destructive" });
      return;
    }

    register.mutate(
      { data: { role, senha } },
      {
        onSuccess: () => {
          toast({ title: "Conta criada com sucesso.", description: "Faça login para continuar." });
          setLocation("/login");
        },
        onError: (err: unknown) => {
          const status = err && typeof err === "object" && "status" in err ? (err as { status: number }).status : null;
          if (status === 409) {
            toast({
              title: "Esse usuário já existe.",
              description: "Faça login ou contate o administrador.",
              variant: "destructive",
            });
            return;
          }
          toast({ title: "Não foi possível criar a conta.", variant: "destructive" });
        },
      },
    );
  }

  return (
    <div className="dark min-h-screen w-full flex items-center justify-center bg-background px-4 py-12">
      <div className="relative w-full max-w-sm">
        <div
          className="pointer-events-none absolute -inset-8 rounded-full opacity-40 blur-3xl"
          style={{ background: "radial-gradient(closest-side, hsl(var(--primary) / 0.25), transparent)" }}
        />
        <Card
          className="relative w-full rounded-2xl border-primary/20 shadow-[0_0_50px_-15px_hsl(var(--primary)/0.35)]"
        >
          <CardHeader className="items-center text-center gap-3 pt-10 pb-2">
            <img
              src="/logo-firma-forte.jpeg"
              alt="FirmaForte"
              className="w-20 h-20 rounded-full object-cover ring-2 ring-primary/60"
            />
            <CardTitle className="text-2xl font-bold tracking-tight text-foreground">Criar conta</CardTitle>
            <CardDescription className="text-sm text-muted-foreground">Defina a senha do usuário</CardDescription>
          </CardHeader>
          <CardContent className="px-8 pb-8 pt-4">
            <form onSubmit={handleSubmit} className="flex flex-col gap-5">
              <div className="flex flex-col gap-2">
                <Label>Usuário</Label>
                <RadioGroup value={role} onValueChange={(v) => setRole(v as Role)} className="flex gap-6">
                  <div className="flex items-center gap-2">
                    <RadioGroupItem value="admin" id="role-admin" />
                    <Label htmlFor="role-admin" className="font-normal">Admin</Label>
                  </div>
                  <div className="flex items-center gap-2">
                    <RadioGroupItem value="vendedor" id="role-vendedor" />
                    <Label htmlFor="role-vendedor" className="font-normal">Vendedor</Label>
                  </div>
                </RadioGroup>
              </div>
              <div className="flex flex-col gap-2">
                <Label htmlFor="senha">Senha</Label>
                <Input id="senha" type="password" value={senha} onChange={(e) => setSenha(e.target.value)} />
              </div>
              <div className="flex flex-col gap-2">
                <Label htmlFor="confirmarSenha">Confirmar senha</Label>
                <Input
                  id="confirmarSenha"
                  type="password"
                  value={confirmarSenha}
                  onChange={(e) => setConfirmarSenha(e.target.value)}
                />
              </div>
              <Button type="submit" disabled={register.isPending}>
                Criar conta
              </Button>
              <Link href="/login" className="text-center text-sm text-muted-foreground hover:text-foreground">
                Voltar para o login
              </Link>
            </form>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
