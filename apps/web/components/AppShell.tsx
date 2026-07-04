"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import type { ReactNode } from "react";

export function AppShell({ children }: { children: ReactNode }) {
  const pathname = usePathname();
  const isCustomerRoute = pathname === "/c";

  return (
    <div className={isCustomerRoute ? "shell customer-shell" : "shell"}>
      <header className="topbar">
        <div className="topbar-inner">
          {isCustomerRoute ? (
            <div className="brand" aria-label="Dine-in ordering">
              <strong>Dine-in ordering</strong>
              <span>Scan, order, call staff</span>
            </div>
          ) : (
            <Link className="brand" href="/">
              <strong>QR Ordering 2</strong>
              <span>Customer, FOH, kitchen, manage</span>
            </Link>
          )}
          {!isCustomerRoute ? (
            <nav className="nav" aria-label="Primary navigation">
              <Link href="/c?t=table-1-token">Customer</Link>
              <Link href="/foh">FOH</Link>
              <Link href="/kitchen">Kitchen</Link>
              <Link href="/manage">Manage</Link>
              <Link href="/login">Login</Link>
            </nav>
          ) : null}
        </div>
      </header>
      {children}
    </div>
  );
}
