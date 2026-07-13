import { useState, type FormEvent } from "react";
import { useLocation, Redirect, Link } from "wouter";
import { useQueryClient } from "@tanstack/react-query";
import { useLogin, getGetSessionQueryKey, type Role } from "@workspace/api-client-react";
import { useToast } from "@/hooks/use-toast";
import { useAuth } from "@/lib/auth-context";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from "@/components/ui/card";

function normalizeRole(value: string): Role | null {
  const normalized = value.trim().toLowerCase();
  return normalized === "admin" || normalized === "vendedor" ? (normalized as Role) : null;
}

export default function Login() {
  const [, setLocation] = useLocation();
  const queryClient = useQueryClient();
  const { toast } = useToast();
  const { role: sessionRole, isLoading: sessionLoading } = useAuth();

  const [usuario, setUsuario] = useState("");
  const [senha, setSenha] = useState("");

  const login = useLogin();

  function handleLogin(e: FormEvent) {
    e.preventDefault();

    const role = normalizeRole(usuario);
    if (!role) {
      toast({ title: "Usuário inválido", description: 'Digite "admin" ou "vendedor".', variant: "destructive" });
      return;
    }

    login.mutate(
      { data: { role, senha } },
      {
        onSuccess: (session) => {
          queryClient.setQueryData(getGetSessionQueryKey(), session);
          setLocation(session.role === "admin" ? "/admin" : "/vendedor");
        },
        onError: () => {
          toast({ title: "Usuário ou senha inválidos.", variant: "destructive" });
        },
      },
    );
  }

  if (!sessionLoading && sessionRole) {
    return <Redirect to={sessionRole === "admin" ? "/admin" : "/vendedor"} />;
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
            <CardTitle className="text-2xl font-bold tracking-tight text-foreground">FirmaForte</CardTitle>
            <CardDescription className="text-sm text-muted-foreground">Entre com seu usuário</CardDescription>
          </CardHeader>
          <CardContent className="px-8 pb-8 pt-4">
            <form onSubmit={handleLogin} className="flex flex-col gap-5">
              <div className="flex flex-col gap-2">
                <Label htmlFor="usuario">Usuário</Label>
                <Input
                  id="usuario"
                  autoFocus
                  placeholder="admin ou vendedor"
                  value={usuario}
                  onChange={(e) => setUsuario(e.target.value)}
                />
              </div>
              <div className="flex flex-col gap-2">
                <Label htmlFor="senha">Senha</Label>
                <Input id="senha" type="password" value={senha} onChange={(e) => setSenha(e.target.value)} />
              </div>
              <Button type="submit" disabled={login.isPending}>
                Entrar
              </Button>
              <Link href="/criar-conta" className="text-center text-sm text-muted-foreground hover:text-foreground">
                Criar conta
              </Link>
            </form>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
