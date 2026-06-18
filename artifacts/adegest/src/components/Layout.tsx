import { Link, useLocation } from "wouter";
import { LayoutDashboard, ShoppingCart, Package, Tags, Users, BarChart3, Menu, Wine } from "lucide-react";
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

function SidebarLogo() {
  return (
    <div className="flex items-center gap-3 px-5 py-5 border-b border-sidebar-border">
      <img
        src="/logo-firma-forte.jpeg"
        alt="Firma Forte"
        className="w-11 h-11 rounded-full object-cover ring-2 ring-sidebar-primary/60 shrink-0"
      />
      <div className="flex flex-col leading-tight">
        <span className="text-base font-serif font-bold text-sidebar-primary tracking-wide">
          Firma Forte
        </span>
        <span className="text-[10px] text-sidebar-foreground/50 uppercase tracking-widest">
          Whiskeria e Tabacaria
        </span>
      </div>
    </div>
  );
}

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
            <div
              className={`flex items-center gap-3 px-3 py-2 rounded-md transition-colors cursor-pointer ${
                isActive
                  ? "bg-sidebar-primary text-sidebar-primary-foreground font-semibold"
                  : "text-sidebar-foreground/60 hover:bg-sidebar-accent hover:text-sidebar-accent-foreground"
              }`}
            >
              <Icon className="w-5 h-5 shrink-0" />
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
        <SidebarLogo />
        <div className="flex-1 overflow-y-auto py-4">
          <NavLinks />
        </div>
      </div>

      {/* Mobile Header & Sidebar */}
      <div className="md:hidden fixed top-0 left-0 right-0 h-16 bg-sidebar border-b border-sidebar-border flex items-center justify-between px-4 z-50">
        <div className="flex items-center gap-3">
          <img
            src="/logo-firma-forte.jpeg"
            alt="Firma Forte"
            className="w-8 h-8 rounded-full object-cover ring-1 ring-sidebar-primary/60"
          />
          <span className="text-base font-serif font-bold text-sidebar-primary tracking-wide">
            Firma Forte
          </span>
        </div>
        <Sheet open={mobileOpen} onOpenChange={setMobileOpen}>
          <SheetTrigger asChild>
            <Button variant="ghost" size="icon" className="text-sidebar-foreground hover:bg-sidebar-accent">
              <Menu className="w-6 h-6" />
            </Button>
          </SheetTrigger>
          <SheetContent side="left" className="w-64 p-0 bg-sidebar border-r-sidebar-border">
            <SheetTitle className="sr-only">Menu de Navegação</SheetTitle>
            <SidebarLogo />
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
