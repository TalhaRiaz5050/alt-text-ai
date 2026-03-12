import { useLoaderData } from "@remix-run/react";
import {
  Page,
  Layout,
  Card,
  Text,
  BlockStack,
  InlineStack,
  Badge,
  Thumbnail,
  Divider,
  EmptyState,
  Pagination,
} from "@shopify/polaris";
import { authenticate } from "../shopify.server";
import { db } from "../db.server";
import { json } from "@remix-run/node";

const PER_PAGE = 20;

export const loader = async ({ request }) => {
  const { session } = await authenticate.admin(request);
  const url = new URL(request.url);
  const page = parseInt(url.searchParams.get("page") || "1");

  const total = await db.altTextLog.count({ where: { shop: session.shop } });
  const logs = await db.altTextLog.findMany({
    where: { shop: session.shop },
    orderBy: { createdAt: "desc" },
    skip: (page - 1) * PER_PAGE,
    take: PER_PAGE,
  });

  return json({ logs, total, page, totalPages: Math.ceil(total / PER_PAGE) });
};

export default function HistoryPage() {
  const { logs, total, page, totalPages } = useLoaderData();

  if (logs.length === 0) {
    return (
      <Page title="History" backAction={{ content: "Dashboard", url: "/app" }}>
        <EmptyState
          heading="No alt text generated yet"
          action={{ content: "Scan Products", url: "/app/scan" }}
          image="https://cdn.shopify.com/s/files/1/0262/4071/2726/files/emptystate-files.png"
        >
          <p>Start by scanning your products to generate alt text.</p>
        </EmptyState>
      </Page>
    );
  }

  return (
    <Page
      title="Alt Text History"
      subtitle={`${total} images updated total`}
      backAction={{ content: "Dashboard", url: "/app" }}
    >
      <Layout>
        <Layout.Section>
          <Card>
            <BlockStack gap="400">
              <InlineStack align="space-between">
                <Text variant="headingMd">All Generated Alt Texts</Text>
                <Badge>{total} total</Badge>
              </InlineStack>
              <Divider />
              {logs.map((log) => (
                <BlockStack key={log.id} gap="300">
                  <InlineStack gap="400" wrap={false}>
                    <Thumbnail
                      source={log.imageUrl}
                      alt={log.altText}
                      size="medium"
                    />
                    <BlockStack gap="100" inlineSize="100%">
                      <InlineStack align="space-between">
                        <Text variant="bodySm" fontWeight="semibold">
                          {log.imageUrl.split("/").pop().split("?")[0].substring(0, 50)}
                        </Text>
                        <Text variant="bodySm" tone="subdued">
                          {new Date(log.createdAt).toLocaleDateString("en-US", {
                            year: "numeric", month: "short", day: "numeric"
                          })}
                        </Text>
                      </InlineStack>
                      <Text variant="bodySm" tone="subdued">
                        "{log.altText}"
                      </Text>
                      <Badge tone="success" size="small">Applied</Badge>
                    </BlockStack>
                  </InlineStack>
                  <Divider />
                </BlockStack>
              ))}

              {totalPages > 1 && (
                <InlineStack align="center">
                  <Pagination
                    hasPrevious={page > 1}
                    onPrevious={() => window.location.href = `/app/history?page=${page - 1}`}
                    hasNext={page < totalPages}
                    onNext={() => window.location.href = `/app/history?page=${page + 1}`}
                    label={`Page ${page} of ${totalPages}`}
                  />
                </InlineStack>
              )}
            </BlockStack>
          </Card>
        </Layout.Section>
      </Layout>
    </Page>
  );
}
