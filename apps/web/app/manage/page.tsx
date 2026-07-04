"use client";

import Link from "next/link";
import {
  AuthGate,
  StaffSessionBar,
  useRequireRole,
} from "../../lib/auth-client";

const links = [
  {
    href: "/manage/settings",
    title: "Store settings",
    body: "Currency, receipt identity, tax, and service charge.",
  },
  {
    href: "/manage/menu",
    title: "Menu",
    body: "Categories, items, prices, and availability.",
  },
  {
    href: "/manage/tables",
    title: "Tables and QR",
    body: "Table tokens and customer preview links.",
  },
  {
    href: "/manage/staff",
    title: "Staff",
    body: "Accounts, roles, access, and password resets.",
  },
  {
    href: "/manage/print-jobs",
    title: "Print jobs",
    body: "Kitchen tickets, failures, and reprints.",
  },
  {
    href: "/manage/analytics",
    title: "Analytics",
    body: "Revenue, payments, orders, and top items.",
  },
];

export default function ManagePage() {
  const auth = useRequireRole(["DEV", "ADMIN"]);

  return (
    <AuthGate state={auth}>
      <main className="page">
        <StaffSessionBar user={auth.user} />
        <section className="page-header">
          <h1>Management</h1>
          <p>Start with the configuration needed for the P0 operating loop.</p>
        </section>
        <section className="grid two">
          {links.map((link) => (
            <Link href={link.href} className="card" key={link.href}>
              <h2>{link.title}</h2>
              <p>{link.body}</p>
            </Link>
          ))}
        </section>
      </main>
    </AuthGate>
  );
}
