import { Switch, Route, Redirect, Router as WouterRouter } from "wouter";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { Toaster } from "@/components/ui/toaster";
import { TooltipProvider } from "@/components/ui/tooltip";
import { Layout } from "@/components/Layout";
import { AuthProvider, useAuth } from "@/lib/auth-context";
import { ProtectedRoute } from "@/components/ProtectedRoute";

import Login from "@/pages/Login";
import CriarConta from "@/pages/CriarConta";
import Dashboard from "@/pages/Dashboard";
import Vendas from "@/pages/Vendas";
import NovaVenda from "@/pages/NovaVenda";
import Estoque from "@/pages/Estoque";
import Produtos from "@/pages/Produtos";
import Categorias from "@/pages/Categorias";
import Relatorios from "@/pages/Relatorios";
import NotFound from "@/pages/not-found";

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      refetchOnWindowFocus: false,
      retry: 1,
    }
  }
});

function RoleHome() {
  const { role } = useAuth();
  return <Redirect to={role === "admin" ? "/admin" : "/vendedor"} />;
}

function AuthenticatedApp() {
  return (
    <ProtectedRoute>
      <Layout>
        <Switch>
          <Route path="/" component={RoleHome} />
          <Route path="/admin">
            {() => (
              <ProtectedRoute roles={["admin"]}>
                <Dashboard />
              </ProtectedRoute>
            )}
          </Route>
          <Route path="/vendedor">
            {() => (
              <ProtectedRoute roles={["vendedor"]}>
                <NovaVenda />
              </ProtectedRoute>
            )}
          </Route>
          <Route path="/vendas" component={Vendas} />
          <Route path="/vendas/nova">
            {() => (
              <ProtectedRoute roles={["vendedor"]}>
                <NovaVenda />
              </ProtectedRoute>
            )}
          </Route>
          <Route path="/estoque">
            {() => (
              <ProtectedRoute roles={["admin"]}>
                <Estoque />
              </ProtectedRoute>
            )}
          </Route>
          <Route path="/produtos">
            {() => (
              <ProtectedRoute roles={["admin"]}>
                <Produtos />
              </ProtectedRoute>
            )}
          </Route>
          <Route path="/categorias">
            {() => (
              <ProtectedRoute roles={["admin"]}>
                <Categorias />
              </ProtectedRoute>
            )}
          </Route>
          <Route path="/relatorios">
            {() => (
              <ProtectedRoute roles={["admin"]}>
                <Relatorios />
              </ProtectedRoute>
            )}
          </Route>
          <Route component={NotFound} />
        </Switch>
      </Layout>
    </ProtectedRoute>
  );
}

function Router() {
  return (
    <Switch>
      <Route path="/login" component={Login} />
      <Route path="/criar-conta" component={CriarConta} />
      <Route component={AuthenticatedApp} />
    </Switch>
  );
}

function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <TooltipProvider>
        <WouterRouter base={import.meta.env.BASE_URL.replace(/\/$/, "")}>
          <AuthProvider>
            <Router />
          </AuthProvider>
        </WouterRouter>
        <Toaster />
      </TooltipProvider>
    </QueryClientProvider>
  );
}

export default App;
