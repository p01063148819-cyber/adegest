import { Link, useLocation } from "wouter";
import { Wine, LayoutDashboard, ShoppingCart, Package, Tags, Users, BarChart3, Menu } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Sheet, SheetContent, SheetTrigger, SheetTitle } from "@/components/ui/sheet";
import { useState } from "react";

const navigation = [
  { name: "Início", href: "/", icon: LayoutDashboard },
  { name: "Vendas", href: "/vendas", icon: ShoppingCart },
  { name: "Estoque", href: "/estoque", icon: Package },
  { name: "Produtos", href: "/produtos", icon: Wine },
  { name: "Categorias", href: "/categorias", icon: Tags },
  { name: "Fornecedores", href: "/fornecedores", icon: Users },
  { name: "Relatórios", href: "/relatorios", icon: BarChart3 },
];

export function Layout({ children }: { children: React.ReactNode }) {
  const [location] = useLocation();
  const [mobileOpen, setMobileOpen] = useState(false);

  const NavLinks = () => (
    <nav className="flex flex-col gap-1 w-full p-2">
      {navigation.map((item) => {
        const isActive = location === item.href || (location.startsWith(item.href) && item.href !== "/");
        const Icon = item.icon;
        
        return (
          <Link key={item.name} href={item.href} onClick={() => setMobileOpen(false)}>
            <div className={`flex items-center gap-3 px-3 py-2 rounded-md transition-colors cursor-pointer ${isActive ? 'bg-sidebar-primary text-sidebar-primary-foreground' : 'text-sidebar-foreground/70 hover:bg-sidebar-accent hover:text-sidebar-accent-foreground'}`}>
              <Icon className="w-5 h-5" />
              <span className="font-medium">{item.name}</span>
            </div>
          </Link>
        );
      })}
    </nav>
  );

  return (
    <div className="flex min-h-screen bg-background w-full">
      {/* Desktop Sidebar */}
      <div className="hidden md:flex flex-col w-64 bg-sidebar border-r border-sidebar-border h-screen sticky top-0">
        <div className="flex items-center gap-2 px-6 py-6 border-b border-sidebar-border">
          <div className="bg-primary/20 p-2 rounded-lg">
            <Wine className="w-6 h-6 text-primary" />
          </div>
          <span className="text-xl font-serif font-bold text-sidebar-foreground tracking-wide">AdeGest</span>
        </div>
        <div className="flex-1 overflow-y-auto py-4">
          <NavLinks />
        </div>
      </div>

      {/* Mobile Header & Sidebar */}
      <div className="md:hidden fixed top-0 left-0 right-0 h-16 bg-sidebar border-b border-sidebar-border flex items-center justify-between px-4 z-50">
        <div className="flex items-center gap-2">
          <Wine className="w-6 h-6 text-primary" />
          <span className="text-xl font-serif font-bold text-sidebar-foreground">AdeGest</span>
        </div>
        <Sheet open={mobileOpen} onOpenChange={setMobileOpen}>
          <SheetTrigger asChild>
            <Button variant="ghost" size="icon" className="text-sidebar-foreground hover:bg-sidebar-accent">
              <Menu className="w-6 h-6" />
            </Button>
          </SheetTrigger>
          <SheetContent side="left" className="w-64 p-0 bg-sidebar border-r-sidebar-border">
            <SheetTitle className="sr-only">Menu de Navegação</SheetTitle>
            <div className="flex items-center gap-2 px-6 py-6 border-b border-sidebar-border">
              <Wine className="w-6 h-6 text-primary" />
              <span className="text-xl font-serif font-bold text-sidebar-foreground">AdeGest</span>
            </div>
            <div className="py-4">
              <NavLinks />
            </div>
          </SheetContent>
        </Sheet>
      </div>

      {/* Main Content */}
      <div className="flex-1 flex flex-col min-h-screen w-full pt-16 md:pt-0">
        <main className="flex-1 p-6 md:p-8 max-w-7xl mx-auto w-full">
          {children}
        </main>
      </div>
    </div>
  );
}