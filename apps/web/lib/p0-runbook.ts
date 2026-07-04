export type P0RunbookStep = {
  step: string;
  owner: "Customer" | "Kitchen" | "FOH" | "Printer" | "Management";
  title: string;
  goal: string;
  proof: string;
  href:
    | "customer"
    | "/foh"
    | "/kitchen"
    | "/manage/print-jobs"
    | "/manage/p0-smoke";
};

export const p0RunbookSteps: P0RunbookStep[] = [
  {
    step: "01",
    owner: "Customer",
    title: "Scan QR, choose modifiers, and submit an order",
    goal: "Prove a table-scoped guest can browse, add available items, include notes, and send an order.",
    proof:
      "The order appears in customer status with open totals and tax lines.",
    href: "customer",
  },
  {
    step: "02",
    owner: "Kitchen",
    title: "Read the pending kitchen board",
    goal: "Prove KDS users can see station, quantity, table grouping, and waiting time without mutation controls.",
    proof:
      "The new item is visible on the kitchen board and has no action button.",
    href: "/kitchen",
  },
  {
    step: "03",
    owner: "FOH",
    title: "Handle service calls and confirm dishes",
    goal: "Prove FOH is the only live-order operator for service requests and dish handoff.",
    proof:
      "Pending requests clear and dishes move from pending to recently confirmed.",
    href: "/foh",
  },
  {
    step: "04",
    owner: "Printer",
    title: "Claim and print the kitchen ticket",
    goal: "Prove order submission created a durable print job for the printer service.",
    proof:
      "The ticket reaches printed status or failed status with attempts visible.",
    href: "/manage/print-jobs",
  },
  {
    step: "05",
    owner: "FOH",
    title: "Close the table, record payment, and test refund",
    goal: "Prove checkout blocks pending dishes and records local payment, tip, discount, and refund state.",
    proof:
      "The payment appears in recent FOH payments and open table total returns to zero.",
    href: "/foh",
  },
  {
    step: "06",
    owner: "Management",
    title: "Review readiness and configuration gaps",
    goal: "Prove managers can see whether menu, tables, staff, printer, payments, and settings are launch-ready.",
    proof: "Every P0 cockpit stage is Ready or has an obvious setup link.",
    href: "/manage/p0-smoke",
  },
];
