"use client";

import { Moon, Sun } from "lucide-react";
import { useEffect, useState } from "react";
import { SidebarMenuButton } from "@/components/ui/sidebar";

export function ThemeToggle() {
  const [dark, setDark] = useState(false);

  useEffect(() => {
    const stored = localStorage.getItem("theme");
    const prefersDark = window.matchMedia("(prefers-color-scheme: dark)").matches;
    const isDark = stored === "dark" || (!stored && prefersDark);
    setDark(isDark);
    document.documentElement.classList.toggle("dark", isDark);
  }, []);

  const toggle = () => {
    const next = !dark;
    setDark(next);
    document.documentElement.classList.toggle("dark", next);
    localStorage.setItem("theme", next ? "dark" : "light");
  };

  return (
    <SidebarMenuButton onClick={toggle} tooltip={dark ? "Light mode" : "Dark mode"}>
      {dark ? <Sun /> : <Moon />}
      <span>{dark ? "Light mode" : "Dark mode"}</span>
    </SidebarMenuButton>
  );
}
