import type { ReactNode } from "react";

import { AuthProvider } from "./auth";
import { QueryClientProvider } from "./query-client";
import { ThemeProvider } from "./theme";
import { Toaster } from "../ui/sonner";
import { TooltipProvider } from "../ui/tooltip";

export function DefaultProviders({
  children,
}: {
  children: ReactNode;
}) {
  return (
    <AuthProvider>
      <QueryClientProvider>
        <TooltipProvider>
          <ThemeProvider>
            {children}
            <Toaster />
          </ThemeProvider>
        </TooltipProvider>
      </QueryClientProvider>
    </AuthProvider>
  );
}