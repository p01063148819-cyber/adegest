import { Switch, Route, Router as WouterRouter } from "wouter";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { Toaster } from "@/components/ui/toaster";
import { TooltipProvider } from "@/components/ui/tooltip";
import { Layout } from "@/components/Layout";

import Dashboard from "@/pages/Dashboard";
import Vendas from "@/pages/Vendas";
import NovaVenda from "@/pages/NovaVenda";
import Estoque from "@/pages/Estoque";
import Produtos from "@/pages/Produtos";
import Categorias from "@/pages/Categorias";
import Fornecedores from "@/pages/Fornecedores";
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

function Router() {
  return (
    <Layout>
      <Switch>
        <Route path="/" component={Dashboard} />
        <Route path="/vendas" component={Vendas} />
        <Route path="/vendas/nova" component={NovaVenda} />
        <Route path="/estoque" component={Estoque} />
        <Route path="/produtos" component={Produtos} />
        <Route path="/categorias" component={Categorias} />
        <Route path="/fornecedores" component={Fornecedores} />
        <Route path="/relatorios" component={Relatorios} />
        <Route component={NotFound} />
      </Switch>
    </Layout>
  );
}

function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <TooltipProvider>
        <WouterRouter base={import.meta.env.BASE_URL.replace(/\/$/, "")}>
          <Router />
        </WouterRouter>
        <Toaster />
      </TooltipProvider>
    </QueryClientProvider>
  );
}

export default App;