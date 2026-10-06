import type { ReactNode } from "react";
import { useAuth } from "@/hooks/use-auth";

type AuthProps = {
  children: ReactNode;
};

export function Authenticated({ children }: AuthProps) {
  const { isAuthenticated, isLoading } = useAuth();

  if (isLoading || !isAuthenticated) {
    return null;
  }

  return <>{children}</>;
}

export function Unauthenticated({ children }: AuthProps) {
  const { isAuthenticated, isLoading } = useAuth();

  if (isLoading || isAuthenticated) {
    return null;
  }

  return <>{children}</>;
}

export function AuthLoading({ children }: AuthProps) {
  const { isLoading } = useAuth();

  if (!isLoading) {
    return null;
  }

  return <>{children}</>;
}

export function AuthProvider({
  children,
}: {
  children: ReactNode;
}) {
  return <>{children}</>;
}