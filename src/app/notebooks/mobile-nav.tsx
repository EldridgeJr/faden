"use client";

import { Menu } from "lucide-react";
import type { ReactNode } from "react";
import { Button } from "@/components/ui/button";
import { Sheet, SheetContent, SheetTitle, SheetTrigger } from "@/components/ui/sheet";

// On small screens the sidebar is hidden. This button opens the same
// sidebar as a drawer from the left. The content comes from the server
// (children), only the open/close logic runs in the browser.
export function MobileNav({ children }: { children: ReactNode }) {
  return (
    <Sheet>
      <SheetTrigger asChild>
        <Button variant="outline" size="icon" aria-label="Menü öffnen">
          <Menu aria-hidden />
        </Button>
      </SheetTrigger>
      <SheetContent side="left" className="w-80 p-5">
        <SheetTitle className="sr-only">Menü</SheetTitle>
        {children}
      </SheetContent>
    </Sheet>
  );
}
