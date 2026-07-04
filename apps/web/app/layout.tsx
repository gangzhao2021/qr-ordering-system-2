import type { Metadata } from "next";
import Link from "next/link";
import "./globals.css";

export const metadata: Metadata = {
  title: "QR Ordering System 2",
  description: "Clean rewrite of a dine-in QR ordering system",
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en">
      <body>
        <div className="shell">
          <header className="topbar">
            <div className="topbar-inner">
              <Link className="brand" href="/">
                <strong>QR Ordering 2</strong>
                <span>Customer, FOH, kitchen, manage</span>
              </Link>
              <nav className="nav" aria-label="Primary navigation">
                <Link href="/c?t=table-1-token">Customer</Link>
                <Link href="/foh">FOH</Link>
                <Link href="/kitchen">Kitchen</Link>
                <Link href="/manage">Manage</Link>
                <Link href="/login">Login</Link>
              </nav>
            </div>
          </header>
          {children}
        </div>
      </body>
    </html>
  );
}
