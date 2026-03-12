import { useLoaderData, useFetcher } from "@remix-run/react";
import {
  Page,
  Layout,
  Card,
  Text,
  Button,
  BlockStack,
  InlineStack,
  Badge,
  List,
  Divider,
  Banner,
} from "@shopify/polaris";
import { authenticate } from "../shopify.server";
import { getShopUsage } from "../services/usage.server";
import { json, redirect } from "@remix-run/node";
import { upgradeShopToPro } from "../services/usage.server";

const PLAN_PRICE = 2.99;

export const loader = async ({ request }) => {
  const { session } = await authenticate.admin(request);
  const usage = await getShopUsage(session.shop);
  return json({ usage, isPro: usage.plan === "pro" });
};

export const action = async ({ request }) => {
  const { admin, session } = await authenticate.admin(request);
  const shop = session.shop;

  // Create Shopify recurring billing charge
  const response = await admin.graphql(`
    mutation appSubscriptionCreate($name: String!, $returnUrl: URL!, $lineItems: [AppSubscriptionLineItemInput!]!) {
      appSubscriptionCreate(name: $name, returnUrl: $returnUrl, lineItems: $lineItems, test: ${process.env.NODE_ENV !== "production"}) {
        userErrors { field message }
        confirmationUrl
        appSubscription { id }
      }
    }
  `, {
    variables: {
      name: "AI Alt Text Pro",
      returnUrl: `${process.env.SHOPIFY_APP_URL}/app/billing/confirm`,
      lineItems: [{
        plan: {
          appRecurringPricingDetails: {
            price: { amount: PLAN_PRICE, currencyCode: "USD" },
            interval: "EVERY_30_DAYS",
          },
        },
      }],
    },
  });

  const data = await response.json();
  const { confirmationUrl, userErrors } = data.data.appSubscriptionCreate;

  if (userErrors?.length > 0) {
    return json({ error: userErrors[0].message });
  }

  // Redirect to Shopify billing confirmation
  return redirect(confirmationUrl);
};

export default function PricingPage() {
  const { usage, isPro } = useLoaderData();
  const fetcher = useFetcher();

  return (
    <Page
      title="Pricing"
      subtitle="Simple, affordable pricing"
      backAction={{ content: "Dashboard", url: "/app" }}
    >
      <Layout>
        {isPro && (
          <Layout.Section>
            <Banner tone="success" title="You're on the Pro plan!">
              <p>You have unlimited alt text generation. Enjoy!</p>
            </Banner>
          </Layout.Section>
        )}

        <Layout.Section>
          <InlineStack gap="500" align="center" wrap={false}>

            {/* Free Plan */}
            <Card>
              <BlockStack gap="400">
                <BlockStack gap="100">
                  <Text variant="headingXl" as="h2">Free</Text>
                  <Text variant="heading2xl" as="p">$0</Text>
                  <Text variant="bodySm" tone="subdued">forever</Text>
                </BlockStack>
                <Divider />
                <List>
                  <List.Item>25 images per month</List.Item>
                  <List.Item>AI-powered alt text generation</List.Item>
                  <List.Item>Review before applying</List.Item>
                  <List.Item>SEO-optimised output</List.Item>
                  <List.Item>Email support</List.Item>
                </List>
                <Button
                  disabled
                  variant="secondary"
                  fullWidth
                >
                  {isPro ? "Previous plan" : "Current plan"}
                </Button>
              </BlockStack>
            </Card>

            {/* Pro Plan */}
            <Card background="bg-surface-active">
              <BlockStack gap="400">
                <BlockStack gap="100">
                  <InlineStack gap="200" align="center">
                    <Text variant="headingXl" as="h2">Pro</Text>
                    <Badge tone="success">Most Popular</Badge>
                  </InlineStack>
                  <InlineStack gap="100" blockAlign="end">
                    <Text variant="heading2xl" as="p">$2.99</Text>
                    <Text variant="bodySm" tone="subdued">/month</Text>
                  </InlineStack>
                  <Text variant="bodySm" tone="subdued">billed monthly, cancel anytime</Text>
                </BlockStack>
                <Divider />
                <List>
                  <List.Item>✅ Unlimited images</List.Item>
                  <List.Item>✅ AI-powered alt text generation</List.Item>
                  <List.Item>✅ Review before applying</List.Item>
                  <List.Item>✅ SEO-optimised output</List.Item>
                  <List.Item>✅ Bulk apply all at once</List.Item>
                  <List.Item>✅ Auto-apply new products</List.Item>
                  <List.Item>✅ Priority support</List.Item>
                  <List.Item>✅ Full history log</List.Item>
                </List>
                {!isPro ? (
                  <fetcher.Form method="post">
                    <Button
                      variant="primary"
                      size="large"
                      fullWidth
                      submit
                      loading={fetcher.state === "submitting"}
                    >
                      Upgrade to Pro — $2.99/mo
                    </Button>
                  </fetcher.Form>
                ) : (
                  <Button variant="primary" disabled fullWidth>
                    ✅ Current Plan
                  </Button>
                )}
              </BlockStack>
            </Card>

          </InlineStack>
        </Layout.Section>

        {/* FAQ */}
        <Layout.Section>
          <Card>
            <BlockStack gap="400">
              <Text variant="headingMd">Frequently Asked Questions</Text>
              <Divider />
              <BlockStack gap="300">
                <BlockStack gap="100">
                  <Text fontWeight="semibold">Why does alt text matter for SEO?</Text>
                  <Text variant="bodySm" tone="subdued">
                    Google can't "see" images — it reads alt text to understand what's in them.
                    Better alt text = better image search rankings = more free traffic.
                  </Text>
                </BlockStack>
                <Divider />
                <BlockStack gap="100">
                  <Text fontWeight="semibold">Is the AI really that good?</Text>
                  <Text variant="bodySm" tone="subdued">
                    We use Claude AI (by Anthropic) — one of the most advanced AI models available.
                    It actually looks at your product images and writes accurate, specific descriptions.
                  </Text>
                </BlockStack>
                <Divider />
                <BlockStack gap="100">
                  <Text fontWeight="semibold">Can I edit the alt text before applying?</Text>
                  <Text variant="bodySm" tone="subdued">
                    Yes — you always see a review screen before anything is saved to your store.
                    You can edit any generated text directly.
                  </Text>
                </BlockStack>
                <Divider />
                <BlockStack gap="100">
                  <Text fontWeight="semibold">Can I cancel anytime?</Text>
                  <Text variant="bodySm" tone="subdued">
                    Yes, cancel anytime from your Shopify admin. No contracts, no hidden fees.
                  </Text>
                </BlockStack>
              </BlockStack>
            </BlockStack>
          </Card>
        </Layout.Section>
      </Layout>
    </Page>
  );
}
