import {
  forwardRef,
  useCallback,
  type ComponentProps,
  type MouseEvent,
} from "react";
import { type VariantProps } from "class-variance-authority";
import { Loader2, LogIn, LogOut } from "lucide-react";

import { useAuth } from "@/hooks/use-auth";
import { Button, buttonVariants } from "@/components/ui/button";

export interface SignInButtonProps
  extends Omit<ComponentProps<"button">, "onClick">,
    VariantProps<typeof buttonVariants> {
  onClick?: (event: MouseEvent<HTMLButtonElement>) => void;
  showIcon?: boolean;
  signInText?: string;
  signOutText?: string;
  loadingText?: string;
  asChild?: boolean;
}

export const SignInButton = forwardRef<
  HTMLButtonElement,
  SignInButtonProps
>(
  (
    {
      onClick,
      disabled,
      showIcon = true,
      signInText = "Sign In",
      signOutText = "Sign Out",
      loadingText,
      className,
      variant,
      size,
      asChild = false,
      ...props
    },
    ref,
  ) => {
    const {
      isAuthenticated,
      logout,
      isLoading,
    } = useAuth();

    const handleClick = useCallback(
      async (event: MouseEvent<HTMLButtonElement>) => {
        onClick?.(event);

        if (event.defaultPrevented) {
          return;
        }

        try {
          if (isAuthenticated) {
            await logout();
          } else {
            console.warn(
              "Gunakan LoginForm untuk masuk dengan email dan password.",
            );
          }
        } catch (error) {
          console.error("Authentication error:", error);
        }
      },
      [isAuthenticated, logout, onClick],
    );

    const isDisabled = disabled || isLoading;

    const buttonText = isLoading
      ? loadingText ??
        (isAuthenticated ? "Signing Out..." : "Signing In...")
      : isAuthenticated
        ? signOutText
        : signInText;

    const icon = isLoading ? (
      <Loader2 className="size-4 animate-spin" />
    ) : isAuthenticated ? (
      <LogOut className="size-4" />
    ) : (
      <LogIn className="size-4" />
    );

    return (
      <Button
        ref={ref}
        onClick={handleClick}
        disabled={isDisabled}
        variant={variant}
        size={size}
        className={className}
        asChild={asChild}
        aria-label={
          isAuthenticated
            ? "Sign out of your account"
            : "Sign in to your account"
        }
        {...props}
      >
        {showIcon && icon}
        {buttonText}
      </Button>
    );
  },
);

SignInButton.displayName = "SignInButton";