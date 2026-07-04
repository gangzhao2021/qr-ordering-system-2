import { hashPassword } from "../src/auth.js";
import { prisma } from "../src/db.js";

const store = {
  id: "store_demo",
  name: "Demo Noodle House",
  market: "CANADA",
  region: "ON",
  currency: "CAD",
  locale: "en-CA",
  timezone: "America/Toronto",
  defaultLanguage: "en",
  supportedLanguages: ["en", "fr-CA", "zh-CN"],
  address: "100 Queen Street West, Toronto, ON",
  phone: "+1 416-010-2000",
  taxNumber: "GST/HST 123456789RT0001",
  taxMode: "CANADA",
  priceIncludesTax: false,
  taxRules: [{ id: "hst", label: "HST", rateBps: 1300, appliesTo: "ALL" }],
  taxLabel: "HST",
  taxRateBps: 1300,
  serviceChargeLabel: "Service charge",
  serviceChargeRateBps: 0,
  enabledPaymentMethods: [
    "CASH",
    "CARD",
    "INTERAC",
    "STRIPE",
    "WECHAT_PAY",
    "ALIPAY",
    "UNIONPAY",
    "OTHER",
  ],
  invoiceInstructions:
    "Ask FOH for a printed receipt. Chinese fapiao details can be recorded in the note field.",
  tipEnabled: true,
  receiptFooter: "Thank you / Merci / 谢谢光临",
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
    nameLocalized: {
      "fr-CA": "Soupe de nouilles au boeuf",
      "zh-CN": "红烧牛肉面",
    },
    description: "Slow-braised beef, wheat noodles, greens",
    descriptionLocalized: {
      "fr-CA": "Boeuf braise, nouilles de ble, legumes verts",
      "zh-CN": "慢炖牛肉、手工面、青菜",
    },
    imageUrl:
      "https://images.unsplash.com/photo-1569718212165-3a8278d5f624?auto=format&fit=crop&w=640&q=80",
    allergens: ["Wheat", "Soy"],
    spiceLevel: 1,
    taxCategory: "PREPARED_FOOD",
    kitchenStation: "HOT",
    modifierGroups: [
      {
        id: "size",
        name: "Size",
        nameLocalized: { "fr-CA": "Format", "zh-CN": "份量" },
        required: true,
        minSelect: 1,
        maxSelect: 1,
        options: [
          {
            id: "regular",
            name: "Regular",
            priceDeltaCents: 0,
            isDefault: true,
          },
          { id: "large", name: "Large", priceDeltaCents: 300 },
        ],
      },
      {
        id: "spice",
        name: "Spice",
        nameLocalized: { "fr-CA": "Piquant", "zh-CN": "辣度" },
        required: false,
        minSelect: 0,
        maxSelect: 1,
        options: [
          { id: "mild", name: "Mild", priceDeltaCents: 0, isDefault: true },
          { id: "hot", name: "Hot", priceDeltaCents: 0 },
        ],
      },
    ],
    priceCents: 1599,
    stockQuantity: 20,
    lowStockThreshold: 5,
    sortOrder: 1,
  },
  {
    id: "item_dan_dan",
    categoryId: "cat_noodles",
    name: "Dan Dan Noodles",
    nameLocalized: {
      "fr-CA": "Nouilles dan dan",
      "zh-CN": "担担面",
    },
    description: "Sesame chili sauce, minced pork, scallion",
    descriptionLocalized: {
      "fr-CA": "Sauce sesame et piment, porc hache, echalote",
      "zh-CN": "芝麻辣酱、肉臊、葱花",
    },
    imageUrl:
      "https://images.unsplash.com/photo-1552611052-33e04de081de?auto=format&fit=crop&w=640&q=80",
    allergens: ["Wheat", "Peanut", "Sesame", "Soy"],
    spiceLevel: 3,
    taxCategory: "PREPARED_FOOD",
    kitchenStation: "HOT",
    modifierGroups: [
      {
        id: "spice",
        name: "Spice",
        nameLocalized: { "fr-CA": "Piquant", "zh-CN": "辣度" },
        required: true,
        minSelect: 1,
        maxSelect: 1,
        options: [
          { id: "medium", name: "Medium", priceDeltaCents: 0, isDefault: true },
          { id: "extra", name: "Extra spicy", priceDeltaCents: 0 },
        ],
      },
    ],
    priceCents: 1399,
    stockQuantity: 15,
    lowStockThreshold: 5,
    sortOrder: 2,
  },
  {
    id: "item_cucumber",
    categoryId: "cat_sides",
    name: "Garlic Cucumber",
    nameLocalized: {
      "fr-CA": "Concombre a l'ail",
      "zh-CN": "蒜拍黄瓜",
    },
    description: "Crisp cucumber, black vinegar, chili oil",
    descriptionLocalized: {
      "fr-CA": "Concombre croquant, vinaigre noir, huile pimentee",
      "zh-CN": "爽脆黄瓜、黑醋、辣椒油",
    },
    imageUrl:
      "https://images.unsplash.com/photo-1512621776951-a57141f2eefd?auto=format&fit=crop&w=640&q=80",
    allergens: ["Soy"],
    spiceLevel: 1,
    taxCategory: "PREPARED_FOOD",
    kitchenStation: "COLD",
    modifierGroups: [],
    priceCents: 699,
    stockQuantity: 30,
    lowStockThreshold: 8,
    sortOrder: 1,
  },
  {
    id: "item_dumplings",
    categoryId: "cat_sides",
    name: "Pork Dumplings",
    nameLocalized: {
      "fr-CA": "Raviolis au porc",
      "zh-CN": "猪肉水饺",
    },
    description: "Six pieces with house dipping sauce",
    descriptionLocalized: {
      "fr-CA": "Six morceaux avec sauce maison",
      "zh-CN": "六只，配自制蘸料",
    },
    imageUrl:
      "https://images.unsplash.com/photo-1496116218417-1a781b1c416c?auto=format&fit=crop&w=640&q=80",
    allergens: ["Wheat", "Soy", "Sesame"],
    spiceLevel: 0,
    taxCategory: "PREPARED_FOOD",
    kitchenStation: "HOT",
    modifierGroups: [
      {
        id: "sauce",
        name: "Sauce",
        nameLocalized: { "fr-CA": "Sauce", "zh-CN": "蘸料" },
        required: false,
        minSelect: 0,
        maxSelect: 2,
        options: [
          { id: "vinegar", name: "Black vinegar", priceDeltaCents: 0 },
          { id: "chili", name: "Chili oil", priceDeltaCents: 0 },
          { id: "garlic", name: "Garlic soy", priceDeltaCents: 0 },
        ],
      },
    ],
    priceCents: 899,
    stockQuantity: 12,
    lowStockThreshold: 4,
    sortOrder: 2,
  },
  {
    id: "item_tea",
    categoryId: "cat_drinks",
    name: "Jasmine Tea",
    nameLocalized: {
      "fr-CA": "The au jasmin",
      "zh-CN": "茉莉花茶",
    },
    description: "Hot or iced",
    descriptionLocalized: {
      "fr-CA": "Chaud ou glace",
      "zh-CN": "热饮或冰饮",
    },
    imageUrl:
      "https://images.unsplash.com/photo-1544787219-7f47ccb76574?auto=format&fit=crop&w=640&q=80",
    allergens: [],
    spiceLevel: 0,
    taxCategory: "BEVERAGE",
    kitchenStation: "BAR",
    modifierGroups: [
      {
        id: "temperature",
        name: "Temperature",
        nameLocalized: { "fr-CA": "Temperature", "zh-CN": "温度" },
        required: true,
        minSelect: 1,
        maxSelect: 1,
        options: [
          { id: "hot", name: "Hot", priceDeltaCents: 0, isDefault: true },
          { id: "iced", name: "Iced", priceDeltaCents: 50 },
        ],
      },
    ],
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

const suppliers = [
  {
    id: "supplier_local_produce",
    name: "Local Produce Co.",
    contactName: "Maya Chen",
    phone: "+1 416-010-3100",
    email: "orders@example-produce.local",
    notes: "Cucumbers, greens, scallions. Tuesday and Friday delivery.",
  },
  {
    id: "supplier_noodle_shop",
    name: "Golden Wheat Noodles",
    contactName: "Li Wei",
    phone: "+1 647-010-4200",
    email: "sales@example-noodles.local",
    notes: "Fresh wheat noodles and dumpling wrappers.",
  },
];

const members = [
  {
    id: "member_amy",
    name: "Amy Zhang",
    phone: "+1 416-555-0101",
    email: "amy@example.local",
    points: 120,
  },
];

const coupons = [
  {
    id: "coupon_lunch10",
    code: "LUNCH10",
    discountType: "PERCENT",
    discountValue: 10,
    isActive: true,
  },
  {
    id: "coupon_tea2",
    code: "TEA2",
    discountType: "AMOUNT",
    discountValue: 200,
    isActive: true,
  },
];

const kdsDevices = [
  {
    id: "kds_hot_line",
    name: "Hot line tablet",
    station: "HOT",
    token: "kds-hot-demo-token",
    isActive: true,
  },
  {
    id: "kds_bar",
    name: "Bar tablet",
    station: "BAR",
    token: "kds-bar-demo-token",
    isActive: true,
  },
];

const inventoryAdjustments = [
  {
    id: "adjustment_opening_beef",
    menuItemId: "item_beef_noodle",
    quantityDelta: 20,
    reason: "Opening stock",
    note: "Initial demo count",
  },
  {
    id: "adjustment_opening_dumplings",
    menuItemId: "item_dumplings",
    quantityDelta: 12,
    reason: "Opening stock",
    note: "Initial demo count",
  },
];

const auditLogs = [
  {
    id: "audit_seed_settings",
    actorEmail: "dev@local",
    action: "SEED_DEMO_STORE",
    entityType: "Store",
    entityId: store.id,
    metadata: { market: store.market, region: store.region },
  },
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
        nameLocalized: item.nameLocalized,
        description: item.description,
        descriptionLocalized: item.descriptionLocalized,
        imageUrl: item.imageUrl,
        allergens: item.allergens,
        spiceLevel: item.spiceLevel,
        taxCategory: item.taxCategory,
        kitchenStation: item.kitchenStation,
        modifierGroups: item.modifierGroups,
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

  for (const supplier of suppliers) {
    await prisma.supplier.upsert({
      where: {
        storeId_name: {
          storeId: store.id,
          name: supplier.name,
        },
      },
      update: {
        contactName: supplier.contactName,
        phone: supplier.phone,
        email: supplier.email,
        notes: supplier.notes,
        isActive: true,
      },
      create: {
        ...supplier,
        storeId: store.id,
        isActive: true,
      },
    });
  }

  for (const member of members) {
    await prisma.member.upsert({
      where: {
        storeId_phone: {
          storeId: store.id,
          phone: member.phone,
        },
      },
      update: {
        name: member.name,
        email: member.email,
        points: member.points,
      },
      create: {
        ...member,
        storeId: store.id,
      },
    });
  }

  for (const coupon of coupons) {
    await prisma.coupon.upsert({
      where: {
        storeId_code: {
          storeId: store.id,
          code: coupon.code,
        },
      },
      update: {
        discountType: coupon.discountType,
        discountValue: coupon.discountValue,
        isActive: coupon.isActive,
      },
      create: {
        ...coupon,
        storeId: store.id,
      },
    });
  }

  for (const device of kdsDevices) {
    await prisma.kdsDevice.upsert({
      where: { token: device.token },
      update: {
        storeId: store.id,
        name: device.name,
        station: device.station,
        isActive: device.isActive,
      },
      create: {
        ...device,
        storeId: store.id,
      },
    });
  }

  for (const adjustment of inventoryAdjustments) {
    await prisma.inventoryAdjustment.upsert({
      where: { id: adjustment.id },
      update: {
        quantityDelta: adjustment.quantityDelta,
        reason: adjustment.reason,
        note: adjustment.note,
      },
      create: {
        ...adjustment,
        storeId: store.id,
      },
    });
  }

  for (const log of auditLogs) {
    await prisma.auditLog.upsert({
      where: { id: log.id },
      update: {
        actorEmail: log.actorEmail,
        action: log.action,
        entityType: log.entityType,
        entityId: log.entityId,
        metadata: log.metadata,
      },
      create: {
        ...log,
        storeId: store.id,
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
