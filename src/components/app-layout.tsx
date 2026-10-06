import { NavLink, Outlet } from "react-router-dom";
import { Menu } from "lucide-react";

import {
  Authenticated,
  AuthLoading,
  Unauthenticated,
} from "@/components/providers/auth";
import { DeviceGuard } from "@/components/device-guard";
import Brand from "@/components/brand";
import SignInScreen from "@/components/signin-screen";
import { NAV_ITEMS } from "@/lib/nav";
import { cn } from "@/lib/utils";
import { Skeleton } from "@/components/ui/skeleton";
import { Button } from "@/components/ui/button";
import { SignInButton } from "@/components/ui/signin";
import { useAuth } from "@/hooks/use-auth";

import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetTrigger,
} from "@/components/ui/sheet";

function NavLinks({
  onNavigate,
}: {
  onNavigate?: () => void;
}) {
  const { user } = useAuth();

  const currentRole =
    user?.role?.trim().toLowerCase() ?? "";

  const isSuperAdmin =
    currentRole === "admin" ||
    user?.roleId === 1 ||
    user?.level === 100;

  const visibleItems = NAV_ITEMS.filter((item) => {
    if (!item.roles || item.roles.length === 0) {
      return true;
    }

    if (isSuperAdmin) {
      return true;
    }

    if (!currentRole) {
      return false;
    }

    return item.roles.some((itemRole) => {
      return (
        itemRole.trim().toLowerCase() === currentRole
      );
    });
  });

  const ungroupedItems = visibleItems.filter(
    (item) => !item.group,
  );

  const groupNames = [
    ...new Set(
      visibleItems
        .filter((item) => item.group)
        .map((item) => item.group as string),
    ),
  ];

  return (
    <nav className="flex flex-col gap-1">
      {ungroupedItems.map((item) => (
        <NavLink
          key={item.to}
          to={item.to}
          end={item.to === "/"}
          onClick={onNavigate}
          className={({ isActive }) =>
            cn(
              "flex cursor-pointer items-center gap-3 rounded-md px-3 py-2 text-sm transition-colors",
              isActive
                ? "bg-sidebar-accent font-medium text-sidebar-accent-foreground"
                : "text-sidebar-foreground/75 hover:bg-sidebar-accent/60 hover:text-sidebar-accent-foreground",
            )
          }
        >
          <item.icon className="size-4 shrink-0" />
          {item.label}
        </NavLink>
      ))}

      {groupNames.map((groupName) => {
        const groupItems = visibleItems.filter(
          (item) => item.group === groupName,
        );

        return (
          <div key={groupName}>
            <div className="mb-1 mt-3 px-3 text-[10px] font-semibold uppercase tracking-widest text-sidebar-foreground/40">
              {groupName}
            </div>

            {groupItems.map((item) => (
              <NavLink
                key={item.to}
                to={item.to}
                end={item.to === "/"}
                onClick={onNavigate}
                className={({ isActive }) =>
                  cn(
                    "flex cursor-pointer items-center gap-3 rounded-md px-3 py-2 text-sm transition-colors",
                    isActive
                      ? "bg-sidebar-accent font-medium text-sidebar-accent-foreground"
                      : "text-sidebar-foreground/75 hover:bg-sidebar-accent/60 hover:text-sidebar-accent-foreground",
                  )
                }
              >
                <item.icon className="size-4 shrink-0" />
                {item.label}
              </NavLink>
            ))}
          </div>
        );
      })}
    </nav>
  );
}

function SidebarUserName() {
  const { user } = useAuth();

  return (
    <div className="truncate text-sm font-medium leading-tight text-sidebar-foreground">
      {user?.name ?? user?.email ?? "Pengguna"}
    </div>
  );
}

function Shell() {
  return (
    <div className="flex min-h-screen bg-background">
      <aside className="sticky top-0 hidden h-screen w-64 shrink-0 flex-col border-r border-sidebar-border bg-sidebar p-4 md:flex">
        <Brand
          className="mb-6 text-sidebar-foreground"
          subtitleClassName="text-sidebar-foreground/60"
        />

        <div className="flex-1 overflow-y-auto">
          <NavLinks />
        </div>

        <div className="mt-4 border-t border-sidebar-border pt-3">
          <SidebarUserName />
        </div>
      </aside>

      <div className="flex min-w-0 flex-1 flex-col">
        <header className="sticky top-0 z-20 flex items-center justify-between gap-3 border-b bg-background/85 px-4 py-3 backdrop-blur">
          <div className="flex items-center gap-2">
            <Sheet>
              <SheetTrigger asChild>
                <Button
                  variant="ghost"
                  size="icon"
                  className="md:hidden"
                  aria-label="Buka menu"
                >
                  <Menu className="size-5" />
                </Button>
              </SheetTrigger>

              <SheetContent
                side="left"
                className="flex w-72 flex-col border-sidebar-border bg-sidebar p-4"
              >
                <SheetHeader className="p-0">
                  <SheetTitle className="sr-only">
                    Menu navigasi
                  </SheetTitle>
                </SheetHeader>

                <Brand
                  className="mb-4"
                  subtitleClassName="text-sidebar-foreground/60"
                />

                <div className="flex-1 overflow-y-auto">
                  <NavLinks />
                </div>

                <div className="mt-4 border-t border-sidebar-border pt-3">
                  <SidebarUserName />
                </div>
              </SheetContent>
            </Sheet>

            <div className="md:hidden">
              <Brand subtitleClassName="text-muted-foreground" />
            </div>
          </div>

          <div className="flex items-center">
            <SignInButton
              size="icon"
              variant="secondary"
              signOutText=""
              signInText=""
              className="md:hidden"
            />

            <SignInButton
              size="sm"
              variant="secondary"
              signOutText="Keluar"
              className="hidden bg-red-800 text-neutral-50 md:flex"
            />
          </div>
        </header>

        <main className="flex-1 p-4 md:p-6">
          <Outlet />
        </main>
      </div>
    </div>
  );
}

export default function AppLayout() {
  return (
    <>
      <AuthLoading>
        <div className="min-h-screen space-y-4 p-6">
          <Skeleton className="h-12 w-full" />
          <Skeleton className="h-64 w-full" />
        </div>
      </AuthLoading>

      <Unauthenticated>
        <SignInScreen />
      </Unauthenticated>

      <Authenticated>
        <DeviceGuard>
          <Shell />
        </DeviceGuard>
      </Authenticated>
    </>
  );
}