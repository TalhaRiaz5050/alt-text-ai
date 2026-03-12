import { db } from "../db.server";

const FREE_LIMIT = 25; // 25 images free per month

/**
 * Get or create shop usage record
 */
export async function getShopUsage(shop) {
  let usage = await db.shopUsage.findUnique({ where: { shop } });

  if (!usage) {
    usage = await db.shopUsage.create({
      data: {
        shop,
        plan: "free",
        imagesUsed: 0,
        imagesLimit: FREE_LIMIT,
      },
    });
  }

  return usage;
}

/**
 * Check if shop can process more images
 */
export async function canProcessImages(shop, count = 1) {
  const usage = await getShopUsage(shop);

  if (usage.plan === "pro") return { allowed: true, usage };

  const remaining = usage.imagesLimit - usage.imagesUsed;
  return {
    allowed: remaining >= count,
    remaining,
    usage,
  };
}

/**
 * Increment image usage count
 */
export async function incrementUsage(shop, count = 1) {
  return await db.shopUsage.update({
    where: { shop },
    data: { imagesUsed: { increment: count } },
  });
}

/**
 * Log generated alt text
 */
export async function logAltText(shop, productId, imageId, imageUrl, altText) {
  return await db.altTextLog.create({
    data: { shop, productId, imageId, imageUrl, altText },
  });
}

/**
 * Reset monthly usage (called by cron/webhook)
 */
export async function resetMonthlyUsage(shop) {
  return await db.shopUsage.update({
    where: { shop },
    data: { imagesUsed: 0 },
  });
}

/**
 * Upgrade shop to pro plan
 */
export async function upgradeShopToPro(shop, billingId) {
  return await db.shopUsage.update({
    where: { shop },
    data: {
      plan: "pro",
      imagesLimit: 999999,
      billingId,
    },
  });
}
