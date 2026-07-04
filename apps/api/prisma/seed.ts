import { hashPassword } from "../src/auth.js";
import { prisma } from "../src/db.js";

const store = {
  id: "store_demo",
  name: "Demo Noodle House",
  currency: "USD",
  locale: "en-US",
  timezone: "America/New_York",
  address: "100 Main Street, New York, NY",
  phone: "(555) 010-2000",
  taxLabel: "Sales tax",
  taxRateBps: 887,
  serviceChargeLabel: "Service charge",
  serviceChargeRateBps: 0,
  receiptFooter: "Thank you for dining with us.",
};

const tables = Array.from({ length: 8 }, (_, index) => {
  const number = String(index + 1);
  return {
    id: `table_${number}`,
    number,
    name: index < 2 ? `Window ${number}` : null,
    qrToken: `table-${number}-token`,
  };
});

const categories = [
  { id: "cat_noodles", name: "Noodles", sortOrder: 1 },
  { id: "cat_sides", name: "Sides", sortOrder: 2 },
  { id: "cat_drinks", name: "Drinks", sortOrder: 3 },
];

const menuItems = [
  {
    id: "item_beef_noodle",
    categoryId: "cat_noodles",
    name: "Beef Noodle Soup",
    description: "Slow-braised beef, wheat noodles, greens",
    priceCents: 1599,
    stockQuantity: 20,
    lowStockThreshold: 5,
    sortOrder: 1,
  },
  {
    id: "item_dan_dan",
    categoryId: "cat_noodles",
    name: "Dan Dan Noodles",
    description: "Sesame chili sauce, minced pork, scallion",
    priceCents: 1399,
    stockQuantity: 15,
    lowStockThreshold: 5,
    sortOrder: 2,
  },
  {
    id: "item_cucumber",
    categoryId: "cat_sides",
    name: "Garlic Cucumber",
    description: "Crisp cucumber, black vinegar, chili oil",
    priceCents: 699,
    stockQuantity: 30,
    lowStockThreshold: 8,
    sortOrder: 1,
  },
  {
    id: "item_dumplings",
    categoryId: "cat_sides",
    name: "Pork Dumplings",
    description: "Six pieces with house dipping sauce",
    priceCents: 899,
    stockQuantity: 12,
    lowStockThreshold: 4,
    sortOrder: 2,
  },
  {
    id: "item_tea",
    categoryId: "cat_drinks",
    name: "Jasmine Tea",
    description: "Hot or iced",
    priceCents: 299,
    stockQuantity: null,
    lowStockThreshold: 0,
    sortOrder: 1,
  },
];

const users = [
  { email: "dev@local", name: "Developer", role: "DEV" as const },
  { email: "admin@local", name: "Store Admin", role: "ADMIN" as const },
  { email: "foh@local", name: "FOH", role: "FOH" as const },
  { email: "kitchen@local", name: "Kitchen", role: "KITCHEN" as const },
  { email: "printer@local", name: "Printer", role: "PRINTER" as const },
];

async function main() {
  await prisma.store.upsert({
    where: { id: store.id },
    update: store,
    create: store,
  });

  for (const table of tables) {
    await prisma.diningTable.upsert({
      where: { qrToken: table.qrToken },
      update: {
        storeId: store.id,
        number: table.number,
        name: table.name,
        isActive: true,
      },
      create: {
        ...table,
        storeId: store.id,
      },
    });
  }

  for (const category of categories) {
    await prisma.menuCategory.upsert({
      where: { id: category.id },
      update: {
        storeId: store.id,
        name: category.name,
        sortOrder: category.sortOrder,
      },
      create: {
        ...category,
        storeId: store.id,
      },
    });
  }

  for (const item of menuItems) {
    await prisma.menuItem.upsert({
      where: { id: item.id },
      update: {
        storeId: store.id,
        categoryId: item.categoryId,
        name: item.name,
        description: item.description,
        priceCents: item.priceCents,
        stockQuantity: item.stockQuantity,
        lowStockThreshold: item.lowStockThreshold,
        sortOrder: item.sortOrder,
        isAvailable: true,
      },
      create: {
        ...item,
        storeId: store.id,
        isAvailable: true,
      },
    });
  }

  const passwordHash = await hashPassword("devpass");
  for (const user of users) {
    await prisma.user.upsert({
      where: { email: user.email },
      update: {
        storeId: store.id,
        name: user.name,
        role: user.role,
        isActive: true,
      },
      create: {
        ...user,
        storeId: store.id,
        passwordHash,
      },
    });
  }
}

main()
  .finally(async () => {
    await prisma.$disconnect();
  })
  .catch((error) => {
    console.error(error);
    process.exitCode = 1;
  });
