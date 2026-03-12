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
import { json, redirect } from "@remix-run/node";
import { authenticate } from "../shopify.server";

const PLAN_PRICE = 2.99;

export const loader = async ({ request }) => {
  const { getShopUsage } = await import("../services/usage.server");
  const { session } = await authenticate.admin(request);
  const usage = await getShopUsage(session.shop);
  return json({ usage, isPro: usage.plan === "pro" });
};

export const action = async ({ request }) => {
  const { upgradeShopToPro } = await import("../services/usage.server");
  const { admin, session } = await authenticate.admin(request);
  const shop = session.shop;
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
  return redirect(confirmationUrl);
};
