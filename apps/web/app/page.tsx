import Link from "next/link";

const entries = [
  {
    href: "/c?t=table-1-token",
    title: "Customer menu",
    body: "Open the table-scoped menu, add items, submit an order, and send service requests.",
  },
  {
    href: "/foh",
    title: "FOH workspace",
    body: "Operate live table orders, confirm dishes, handle requests, and close tables.",
  },
  {
    href: "/kitchen",
    title: "Kitchen display",
    body: "Read-only pending item board with quantity and waiting time.",
  },
  {
    href: "/manage",
    title: "Management",
    body: "Start menu, table, and QR configuration for the store.",
  },
];

export default function HomePage() {
  return (
    <main className="page">
      <section className="page-header">
        <h1>Operating loop first.</h1>
        <p>
          This clean rewrite starts with the smallest useful restaurant
          workflow: customer QR ordering, FOH live operations, kitchen read-only
          display, and basic management.
        </p>
      </section>

      <section className="grid two">
        {entries.map((entry) => (
          <Link key={entry.href} href={entry.href} className="card">
            <h2>{entry.title}</h2>
            <p>{entry.body}</p>
          </Link>
        ))}
      </section>
    </main>
  );
}
