import { useState, useCallback } from "react";
import { useLoaderData, useFetcher, useNavigate } from "@remix-run/react";
import {
  Page,
  Layout,
  Card,
  Text,
  Button,
  BlockStack,
  InlineStack,
  Badge,
  Thumbnail,
  Banner,
  SkeletonBodyText,
  Divider,
  Checkbox,
  EmptyState,
  Spinner,
  Toast,
  Frame,
  TextField,
} from "@shopify/polaris";
import { authenticate } from "../shopify.server";
import { getImagesMissingAltText } from "../services/shopify.server";
import { canProcessImages } from "../services/usage.server";
import { json } from "@remix-run/node";
import { generateBatchAltText } from "../services/claude.server";
import { updateImageAltText } from "../services/shopify.server";
import { incrementUsage, logAltText } from "../services/usage.server";

export const loader = async ({ request }) => {
  const { admin, session } = await authenticate.admin(request);
  const shop = session.shop;

  const missingImages = await getImagesMissingAltText(admin);
  const { allowed, remaining, usage } = await canProcessImages(shop, 1);

  return json({
    missingImages,
    remaining: usage.plan === "pro" ? 9999 : remaining,
    isPro: usage.plan === "pro",
    imagesUsed: usage.imagesUsed,
    imagesLimit: usage.imagesLimit,
  });
};

export const action = async ({ request }) => {
  const { admin, session } = await authenticate.admin(request);
  const shop = session.shop;

  const formData = await request.formData();
  const intent = formData.get("intent");

  if (intent === "generate") {
    const imagesJson = formData.get("images");
    const images = JSON.parse(imagesJson);

    // Check usage limits
    const { allowed, remaining, usage } = await canProcessImages(shop, images.length);
    if (!allowed && usage.plan !== "pro") {
      return json({
        error: `Free limit reached. Upgrade to Pro to process unlimited images.`,
        results: [],
      });
    }

    // Limit to remaining free quota
    const imagesToProcess = usage.plan === "pro" ? images : images.slice(0, remaining);

    // Generate alt text with Claude AI
    const results = await generateBatchAltText(imagesToProcess);

    return json({ results, error: null });
  }

  if (intent === "apply") {
    const resultsJson = formData.get("results");
    const results = JSON.parse(resultsJson);
    const applied = [];
    const errors = [];

    for (const result of results) {
      if (!result.selected || !result.altText) continue;
      try {
        await updateImageAltText(admin, result.productId, result.imageId, result.altText);
        await logAltText(shop, result.productId, result.imageId, result.imageUrl, result.altText);
        applied.push(result.imageId);
      } catch (error) {
        errors.push({ imageId: result.imageId, error: error.message });
      }
    }

    // Increment usage
    if (applied.length > 0) {
      await incrementUsage(shop, applied.length);
    }

    return json({ applied: applied.length, errors, success: true });
  }

  return json({ error: "Unknown intent" });
};

export default function ScanPage() {
  const { missingImages, remaining, isPro } = useLoaderData();
  const fetcher = useFetcher();
  const navigate = useNavigate();

  const [results, setResults] = useState([]);
  const [selectedIds, setSelectedIds] = useState(new Set());
  const [toastActive, setToastActive] = useState(false);
  const [toastMessage, setToastMessage] = useState("");
  const [phase, setPhase] = useState("idle"); // idle | generating | review | done

  const isGenerating = fetcher.state === "submitting" && phase === "generating";
  const isApplying = fetcher.state === "submitting" && phase === "applying";

  // Handle fetcher results
  if (fetcher.data && phase === "generating" && fetcher.state === "idle") {
    if (fetcher.data.results?.length > 0) {
      setResults(fetcher.data.results);
      setSelectedIds(new Set(fetcher.data.results.filter(r => r.success).map(r => r.imageId)));
      setPhase("review");
    }
  }

  if (fetcher.data?.success && phase === "applying" && fetcher.state === "idle") {
    setToastMessage(`✅ Applied alt text to ${fetcher.data.applied} images!`);
    setToastActive(true);
    setPhase("done");
  }

  const handleGenerate = useCallback(() => {
    const imagesToProcess = missingImages.slice(0, isPro ? missingImages.length : remaining);
    setPhase("generating");
    fetcher.submit(
      { intent: "generate", images: JSON.stringify(imagesToProcess) },
      { method: "post" }
    );
  }, [missingImages, remaining, isPro]);

  const handleApply = useCallback(() => {
    const selectedResults = results
      .filter(r => selectedIds.has(r.imageId))
      .map(r => ({ ...r, selected: true }));

    setPhase("applying");
    fetcher.submit(
      { intent: "apply", results: JSON.stringify(selectedResults) },
      { method: "post" }
    );
  }, [results, selectedIds]);

  const toggleSelect = (imageId) => {
    setSelectedIds(prev => {
      const next = new Set(prev);
      if (next.has(imageId)) next.delete(imageId);
      else next.add(imageId);
      return next;
    });
  };

  const updateAltText = (imageId, newText) => {
    setResults(prev =>
      prev.map(r => r.imageId === imageId ? { ...r, altText: newText } : r)
    );
  };

  if (missingImages.length === 0) {
    return (
      <Page title="Scan Products">
        <EmptyState
          heading="All images have alt text! 🎉"
          action={{ content: "Go to Dashboard", onAction: () => navigate("/app") }}
          image="https://cdn.shopify.com/s/files/1/0262/4071/2726/files/emptystate-files.png"
        >
          <p>Every product image in your store has alt text. Great work!</p>
        </EmptyState>
      </Page>
    );
  }

  return (
    <Frame>
      <Page
        title="Scan & Fix Alt Text"
        subtitle={`${missingImages.length} images missing alt text`}
        backAction={{ content: "Dashboard", url: "/app" }}
      >
        <Layout>
          {/* Error */}
          {fetcher.data?.error && (
            <Layout.Section>
              <Banner tone="critical" title="Error">
                <p>{fetcher.data.error}</p>
              </Banner>
            </Layout.Section>
          )}

          {/* Step 1: Ready to scan */}
          {phase === "idle" && (
            <Layout.Section>
              <Card>
                <BlockStack gap="400">
                  <Text variant="headingMd">Ready to Generate Alt Text</Text>
                  <Divider />
                  <BlockStack gap="200">
                    <InlineStack gap="300">
                      <Badge tone="attention">{missingImages.length} images</Badge>
                      <Text variant="bodySm" tone="subdued">missing alt text found</Text>
                    </InlineStack>
                    {!isPro && (
                      <Text variant="bodySm" tone="subdued">
                        Free plan: Will process up to {Math.min(remaining, missingImages.length)} images
                        ({remaining} remaining this month)
                      </Text>
                    )}
                  </BlockStack>
                  <InlineStack gap="300">
                    <Button
                      variant="primary"
                      size="large"
                      onClick={handleGenerate}
                      loading={isGenerating}
                    >
                      🤖 Generate AI Alt Text
                    </Button>
                    {!isPro && (
                      <Button variant="plain" onClick={() => navigate("/app/pricing")}>
                        Upgrade for unlimited →
                      </Button>
                    )}
                  </InlineStack>
                </BlockStack>
              </Card>
            </Layout.Section>
          )}

          {/* Step 2: Generating */}
          {phase === "generating" && (
            <Layout.Section>
              <Card>
                <BlockStack gap="400" inlineAlign="center">
                  <Spinner size="large" />
                  <Text variant="headingMd" alignment="center">
                    AI is generating alt text...
                  </Text>
                  <Text variant="bodySm" tone="subdued" alignment="center">
                    Claude AI is analysing each image. This may take a minute.
                  </Text>
                  <SkeletonBodyText lines={3} />
                </BlockStack>
              </Card>
            </Layout.Section>
          )}

          {/* Step 3: Review results */}
          {phase === "review" && results.length > 0 && (
            <>
              <Layout.Section>
                <Card>
                  <BlockStack gap="400">
                    <InlineStack align="space-between">
                      <Text variant="headingMd">Review Generated Alt Text</Text>
                      <InlineStack gap="200">
                        <Badge tone="success">{results.filter(r => r.success).length} generated</Badge>
                        <Badge>{selectedIds.size} selected</Badge>
                      </InlineStack>
                    </InlineStack>
                    <Text variant="bodySm" tone="subdued">
                      Review and edit the generated alt text below, then click Apply to save to your store.
                    </Text>
                    <InlineStack gap="300">
                      <Button
                        variant="primary"
                        size="large"
                        onClick={handleApply}
                        loading={isApplying}
                        disabled={selectedIds.size === 0}
                      >
                        ✅ Apply {selectedIds.size} Alt Texts to Store
                      </Button>
                      <Button variant="plain" onClick={() => { setPhase("idle"); setResults([]); }}>
                        Start Over
                      </Button>
                    </InlineStack>
                  </BlockStack>
                </Card>
              </Layout.Section>

              {results.map((result) => (
                <Layout.Section key={result.imageId}>
                  <Card>
                    <InlineStack gap="400" wrap={false}>
                      <Checkbox
                        checked={selectedIds.has(result.imageId)}
                        onChange={() => toggleSelect(result.imageId)}
                        disabled={!result.success}
                      />
                      <Thumbnail
                        source={result.imageUrl}
                        alt="Product image"
                        size="large"
                      />
                      <BlockStack gap="200" inlineSize="100%">
                        <InlineStack align="space-between">
                          <Text variant="headingMd">{result.productTitle || "Product"}</Text>
                          <Badge tone={result.success ? "success" : "critical"}>
                            {result.success ? "✓ Generated" : "Failed"}
                          </Badge>
                        </InlineStack>
                        {result.success ? (
                          <TextField
                            label="Alt Text (editable)"
                            value={result.altText}
                            onChange={(val) => updateAltText(result.imageId, val)}
                            multiline={2}
                            maxLength={125}
                            showCharacterCount
                            helpText="Max 125 characters — optimised for SEO and accessibility"
                          />
                        ) : (
                          <Text variant="bodySm" tone="critical">
                            Failed to generate: {result.error}
                          </Text>
                        )}
                      </BlockStack>
                    </InlineStack>
                  </Card>
                </Layout.Section>
              ))}

              <Layout.Section>
                <Button
                  variant="primary"
                  size="large"
                  onClick={handleApply}
                  loading={isApplying}
                  disabled={selectedIds.size === 0}
                  fullWidth
                >
                  ✅ Apply {selectedIds.size} Selected Alt Texts to Store
                </Button>
              </Layout.Section>
            </>
          )}

          {/* Step 4: Done */}
          {phase === "done" && (
            <Layout.Section>
              <Banner tone="success" title="Alt text applied successfully!">
                <p>
                  Your product images now have SEO-friendly alt text.
                  This will help improve your search rankings and accessibility.
                </p>
              </Banner>
              <br />
              <Button variant="primary" onClick={() => navigate("/app")}>
                Back to Dashboard
              </Button>
            </Layout.Section>
          )}
        </Layout>

        {toastActive && (
          <Toast content={toastMessage} onDismiss={() => setToastActive(false)} />
        )}
      </Page>
    </Frame>
  );
}
