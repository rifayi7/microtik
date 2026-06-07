"use client";

import { Toaster } from "@/components/ui/sonner";
import { RouterProvider } from "@/contexts/router-context";

export function Providers({ children }: { children: React.ReactNode }) {
  return (
    <RouterProvider>
      {children}
      <Toaster richColors closeButton position="top-right" />
    </RouterProvider>
  );
}
