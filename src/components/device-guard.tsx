import type { ReactNode } from "react";

export function DeviceGuard({
  children,
}: {
  children: ReactNode;
}) {
  return <>{children}</>;
}