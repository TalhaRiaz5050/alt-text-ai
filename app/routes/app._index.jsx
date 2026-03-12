import { useLoaderData, useNavigate } from "@remix-run/react";
import {
  Page,
  Layout,
  Card,
  Text,
  Button,
  BlockStack,
  InlineStack,
  Badge,
  ProgressBar,
  Banner,
  Box,
  Icon,
  Divider,
} from "@shopify/polaris";
import { ImageIcon, StarFilledIcon, AlertCircleIcon } from "@shopify/polaris-icons";
import { authenticate } from "../shopify.server";
export const loader = async ({ request }) => {
  const { getShopUsage } = await import("../services/usage.server");
  const { db } = await import("../db.server");
  const { admin, session } = await authenticate.admin(request);
  const shop = session.shop;
  const usage = await getShopUsage(shop);
  const response = await admin.graphql(`
    query {
      products(first: 50) {
        edges {
          node {
            id
            title
            images(first: 10) {
              edges {
                node {
                  id
                  altText
                }
              }
            }
          }
        }
      }
    }
  `);
  const data = await response.json();
  let missingCount = 0;
  let totalImages = 0;
  for (const { node: product } of data.data.products.edges) {
    for (const { node: image } of product.images.edges) {
      totalImages++;
      if (!image.altText || image.altText.trim() === "") missingCount++;
    }
  }
  const recentLogs = await db.altTextLog.findMany({
    where: { shop },
    orderBy: { createdAt: "desc" },
    take: 5,
  });
  return {
    shop,
    usage,
    missingCount,
    totalImages,
    recentLogs,
    isPro: usage.plan === "pro",
  };
};

export const loader = async ({ request }) => {
  const { admin, session } = await authenticate.admin(request);
  const shop = session.shop;

  // Get usage stats
  const usage = await getShopUsage(shop);

  // Get count of images missing alt text (scan just first 50 for speed)
  const response = await admin.graphql(`
    query {
      products(first: 50) {
        edges {
          node {
            id
            title
            images(first: 10) {
              edges {
                node {
                  id
                  altText
                }
              }
            }
          }
        }
      }
    }
  `);
  const data = await response.json();

  let missingCount = 0;
  let totalImages = 0;
  for (const { node: product } of data.data.products.edges) {
    for (const { node: image } of product.images.edges) {
      totalImages++;
      if (!image.altText || image.altText.trim() === "") missingCount++;
    }
  }

  // Get recent alt text logs
  const recentLogs = await db.altTextLog.findMany({
    where: { shop },
    orderBy: { createdAt: "desc" },
    take: 5,
  });

  return {
    shop,
    usage,
    missingCount,
    totalImages,
    recentLogs,
    isPro: usage.plan === "pro",
  };
};

export default function Dashboard() {
  const { usage, missingCount, totalImages, recentLogs, isPro } = useLoaderData();
  const navigate = useNavigate();

  const usagePercent = isPro
    ? 100
    : Math.min((usage.imagesUsed / usage.imagesLimit) * 100, 100);

  const remaining = isPro ? "Unlimited" : usage.imagesLimit - usage.imagesUsed;

  return (
    <Page
      title="AI Alt Text Generator"
      subtitle="Automatically generate SEO-friendly alt text for your product images"
      primaryAction={
        missingCount > 0
          ? {
              content: `Fix ${missingCount} Images Now`,
              onAction: () => navigate("/app/scan"),
              icon: ImageIcon,
            }
          : undefined
      }
    >
      <Layout>
        {/* Alert if images missing */}
        {missingCount > 0 && (
          <Layout.Section>
            <Banner
              title={`${missingCount} product images are missing alt text`}
              tone="warning"
              action={{ content: "Scan & Fix Now", onAction: () => navigate("/app/scan") }}
            >
              <p>
                Missing alt text hurts your SEO rankings and accessibility score.
                Our AI will generate perfect alt text in seconds.
              </p>
            </Banner>
          </Layout.Section>
        )}

        {missingCount === 0 && totalImages > 0 && (
          <Layout.Section>
            <Banner title="All images have alt text!" tone="success">
              <p>Great work! All {totalImages} product images have alt text.</p>
            </Banner>
          </Layout.Section>
        )}

        {/* Stats Row */}
        <Layout.Section>
          <InlineStack gap="400" wrap={false}>
            {/* Missing Images */}
            <Card>
              <BlockStack gap="200">
                <Text variant="headingMd" as="h3" tone="subdued">Missing Alt Text</Text>
                <Text variant="heading2xl" as="p" tone={missingCount > 0 ? "caution" : "success"}>
                  {missingCount}
                </Text>
                <Text variant="bodySm" tone="subdued">out of {totalImages} images</Text>
              </BlockStack>
            </Card>

            {/* Fixed This Month */}
            <Card>
              <BlockStack gap="200">
                <Text variant="headingMd" as="h3" tone="subdued">Fixed This Month</Text>
                <Text variant="heading2xl" as="p" tone="success">
                  {usage.imagesUsed}
                </Text>
                <Text variant="bodySm" tone="subdued">images updated</Text>
              </BlockStack>
            </Card>

            {/* Plan */}
            <Card>
              <BlockStack gap="200">
                <Text variant="headingMd" as="h3" tone="subdued">Your Plan</Text>
                <InlineStack gap="200" align="center">
                  <Text variant="heading2xl" as="p">
                    {isPro ? "Pro" : "Free"}
                  </Text>
                  <Badge tone={isPro ? "success" : "info"}>
                    {isPro ? "Active" : "25 images/mo"}
                  </Badge>
                </InlineStack>
                {!isPro && (
                  <Button
                    variant="plain"
                    onClick={() => navigate("/app/pricing")}
                  >
                    Upgrade to Pro →
                  </Button>
                )}
              </BlockStack>
            </Card>
          </InlineStack>
        </Layout.Section>

        {/* Usage Bar */}
        {!isPro && (
          <Layout.Section>
            <Card>
              <BlockStack gap="300">
                <InlineStack align="space-between">
                  <Text variant="headingMd">Monthly Usage</Text>
                  <Text variant="bodySm" tone="subdued">
                    {usage.imagesUsed} / {usage.imagesLimit} free images used
                  </Text>
                </InlineStack>
                <ProgressBar progress={usagePercent} tone={usagePercent > 80 ? "critical" : "primary"} />
                {usagePercent >= 100 && (
                  <Banner tone="critical" title="Free limit reached">
                    <p>
                      Upgrade to Pro for unlimited alt text generation at just $2.99/month.
                    </p>
                  </Banner>
                )}
                {usagePercent > 80 && usagePercent < 100 && (
                  <Text variant="bodySm" tone="caution">
                    ⚠️ Only {remaining} images remaining this month.{" "}
                    <Button variant="plain" onClick={() => navigate("/app/pricing")}>
                      Upgrade to Pro
                    </Button>
                  </Text>
                )}
              </BlockStack>
            </Card>
          </Layout.Section>
        )}

        {/* Quick Actions */}
        <Layout.Section>
          <Card>
            <BlockStack gap="400">
              <Text variant="headingMd">Quick Actions</Text>
              <Divider />
              <InlineStack gap="300">
                <Button
                  variant="primary"
                  size="large"
                  onClick={() => navigate("/app/scan")}
                  icon={ImageIcon}
                >
                  Scan All Products
                </Button>
                <Button
                  variant="secondary"
                  size="large"
                  onClick={() => navigate("/app/history")}
                >
                  View History
                </Button>
                {!isPro && (
                  <Button
                    variant="secondary"
                    size="large"
                    tone="success"
                    onClick={() => navigate("/app/pricing")}
                    icon={StarFilledIcon}
                  >
                    Upgrade to Pro — $2.99/mo
                  </Button>
                )}
              </InlineStack>
            </BlockStack>
          </Card>
        </Layout.Section>

        {/* Recent Activity */}
        {recentLogs.length > 0 && (
          <Layout.Section>
            <Card>
              <BlockStack gap="300">
                <Text variant="headingMd">Recent Alt Text Generated</Text>
                <Divider />
                {recentLogs.map((log) => (
                  <BlockStack key={log.id} gap="100">
                    <InlineStack align="space-between">
                      <Text variant="bodySm" fontWeight="semibold">
                        {log.imageUrl.split("/").pop().split("?")[0].substring(0, 40)}...
                      </Text>
                      <Text variant="bodySm" tone="subdued">
                        {new Date(log.createdAt).toLocaleDateString()}
                      </Text>
                    </InlineStack>
                    <Text variant="bodySm" tone="subdued">"{log.altText}"</Text>
                    <Divider />
                  </BlockStack>
                ))}
              </BlockStack>
            </Card>
          </Layout.Section>
        )}

        {/* How it works */}
        <Layout.Section>
          <Card>
            <BlockStack gap="400">
              <Text variant="headingMd">How It Works</Text>
              <Divider />
              <InlineStack gap="600" wrap={false}>
                <BlockStack gap="200" inlineSize="33%">
                  <Text variant="headingLg">1. 🔍 Scan</Text>
                  <Text variant="bodySm" tone="subdued">
                    We scan all your product images and find ones missing alt text
                  </Text>
                </BlockStack>
                <BlockStack gap="200" inlineSize="33%">
                  <Text variant="headingLg">2. 🤖 AI Generate</Text>
                  <Text variant="bodySm" tone="subdued">
                    Claude AI analyses each image and writes SEO-optimised alt text
                  </Text>
                </BlockStack>
                <BlockStack gap="200" inlineSize="33%">
                  <Text variant="headingLg">3. ✅ Apply</Text>
                  <Text variant="bodySm" tone="subdued">
                    Review and apply with one click — or auto-apply all at once
                  </Text>
                </BlockStack>
              </InlineStack>
            </BlockStack>
          </Card>
        </Layout.Section>
      </Layout>
    </Page>
  );
}
