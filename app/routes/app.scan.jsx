import { useState, useCallback } from "react";
import { useLoaderData, useFetcher, useNavigate } from "@remix-run/react";
import {
  Page, Layout, Card, Text, Button, BlockStack, InlineStack, Badge,
  Thumbnail, Banner, SkeletonBodyText, Divider, Checkbox, EmptyState,
  Spinner, Toast, Frame, TextField,
} from "@shopify/polaris";
import { authenticate } from "../shopify.server";
import { json } from "@remix-run/node";

export const loader = async ({ request }) => {
  const { getImagesMissingAltText } = await import("../services/shopify.server");
  const { canProcessImages } = await import("../services/usage.server");
  const { admin, session } = await authenticate.admin(request);
  const shop = session.shop;
  const missingImages = await getImagesMissingAltText(admin);
  const { remaining, usage } = await canProcessImages(shop, 1);
  return json({
    missingImages,
    remaining: usage.plan === "pro" ? 9999 : remaining,
    isPro: usage.plan === "pro",
    imagesUsed: usage.imagesUsed,
    imagesLimit: usage.imagesLimit,
  });
};

export const action = async ({ request }) => {
  const { generateBatchAltText } = await import("../services/claude.server");
  const { updateImageAltText } = await import("../services/shopify.server");
  const { incrementUsage, logAltText, canProcessImages } = await import("../services/usage.server");
  const { admin, session } = await authenticate.admin(request);
  const shop = session.shop;
  const formData = await request.formData();
  const intent = formData.get("intent");
  if (intent === "generate") {
    const images = JSON.parse(formData.get("images"));
    const { remaining, usage } = await canProcessImages(shop, images.length);
    if (usage.plan !== "pro" && usage.imagesUsed >= usage.imagesLimit) {
      return json({ error: "Free limit reached. Upgrade to Pro.", results: [] });
    }
    const imagesToProcess = usage.plan === "pro" ? images : images.slice(0, remaining);
    const results = await generateBatchAltText(imagesToProcess);
    return json({ results, error: null });
  }
  if (intent === "apply") {
    const results = JSON.parse(formData.get("results"));
    const applied = [];
    const errors = [];
    for (const result of results) {
      if (!result.selected || !result.altText) continue;
      try {
        await updateImageAltText(admin, result.productId, result.imageId, result.altText);
        await logAltText(shop, result.productId, result.imageId, result.imageUrl, result.altText);
        applied.push(result.imageId);
      } catch (err) {
        errors.push({ imageId: result.imageId, error: err.message });
      }
    }
    if (applied.length > 0) await incrementUsage(shop, applied.length);
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
  const [phase, setPhase] = useState("idle");
  const isGenerating = fetcher.state === "submitting" && phase === "generating";
  const isApplying = fetcher.state === "submitting" && phase === "applying";

  if (fetcher.data && phase === "generating" && fetcher.state === "idle") {
    if (fetcher.data.results?.length > 0) {
      setResults(fetcher.data.results);
      setSelectedIds(new Set(fetcher.data.results.filter(r => r.success).map(r => r.imageId)));
      setPhase("review");
    }
  }
  if (fetcher.data?.success && phase === "applying" && fetcher.state === "idle") {
    setToastMessage(`Applied alt text to ${fetcher.data.applied} images!`);
    setToastActive(true);
    setPhase("done");
  }

  const handleGenerate = useCallback(() => {
    const imagesToProcess = missingImages.slice(0, isPro ? missingImages.length : remaining);
    setPhase("generating");
    fetcher.submit({ intent: "generate", images: JSON.stringify(imagesToProcess) }, { method: "post" });
  }, [missingImages, remaining, isPro]);

  const handleApply = useCallback(() => {
    const selectedResults = results.filter(r => selectedIds.has(r.imageId)).map(r => ({ ...r, selected: true }));
    setPhase("applying");
    fetcher.submit({ intent: "apply", results: JSON.stringify(selectedResults) }, { method: "post" });
  }, [results, selectedIds]);

  const toggleSelect = (imageId) => {
    setSelectedIds(prev => {
      const next = new Set(prev);
      next.has(imageId) ? next.delete(imageId) : next.add(imageId);
      return next;
    });
  };

  const updateAltText = (imageId, newText) => {
    setResults(prev => prev.map(r => r.imageId === imageId ? { ...r, altText: newText } : r));
  };

  if (missingImages.length === 0) {
    return (
      <Page title="Scan Products">
        <EmptyState heading="All images have alt text!" action={{ content: "Go to Dashboard", onAction: () => navigate("/app") }} image="https://cdn.shopify.com/s/files/1/0262/4071/2726/files/emptystate-files.png">
          <p>Every product image has alt text. Great work!</p>
        </EmptyState>
      </Page>
    );
  }

  return (
    <Frame>
      <Page title="Scan & Fix Alt Text" subtitle={`${missingImages.length} images missing alt text`} backAction={{ content: "Dashboard", url: "/app" }}>
        <Layout>
          {fetcher.data?.error && <Layout.Section><Banner tone="critical" title="Error"><p>{fetcher.data.error}</p></Banner></Layout.Section>}
          {phase === "idle" && (
            <Layout.Section>
              <Card>
                <BlockStack gap="400">
                  <Text variant="headingMd">Ready to Generate Alt Text</Text>
                  <Divider />
                  <InlineStack gap="300">
                    <Badge tone="attention">{missingImages.length} images</Badge>
                    <Text variant="bodySm" tone="subdued">missing alt text</Text>
                  </InlineStack>
                  <InlineStack gap="300">
                    <Button variant="primary" size="large" onClick={handleGenerate} loading={isGenerating}>Generate AI Alt Text</Button>
                    {!isPro && <Button variant="plain" onClick={() => navigate("/app/pricing")}>Upgrade for unlimited</Button>}
                  </InlineStack>
                </BlockStack>
              </Card>
            </Layout.Section>
          )}
          {phase === "generating" && (
            <Layout.Section>
              <Card>
                <BlockStack gap="400" inlineAlign="center">
                  <Spinner size="large" />
                  <Text variant="headingMd" alignment="center">AI is generating alt text...</Text>
                  <SkeletonBodyText lines={3} />
                </BlockStack>
              </Card>
            </Layout.Section>
          )}
          {phase === "review" && results.length > 0 && (
            <>
              <Layout.Section>
                <Card>
                  <BlockStack gap="400">
                    <InlineStack align="space-between">
                      <Text variant="headingMd">Review Generated Alt Text</Text>
                      <Badge>{selectedIds.size} selected</Badge>
                    </InlineStack>
                    <InlineStack gap="300">
                      <Button variant="primary" size="large" onClick={handleApply} loading={isApplying} disabled={selectedIds.size === 0}>Apply {selectedIds.size} Alt Texts</Button>
                      <Button variant="plain" onClick={() => { setPhase("idle"); setResults([]); }}>Start Over</Button>
                    </InlineStack>
                  </BlockStack>
                </Card>
              </Layout.Section>
              {results.map((result) => (
                <Layout.Section key={result.imageId}>
                  <Card>
                    <InlineStack gap="400" wrap={false}>
                      <Checkbox checked={selectedIds.has(result.imageId)} onChange={() => toggleSelect(result.imageId)} disabled={!result.success} />
                      <Thumbnail source={result.imageUrl} alt="Product image" size="large" />
                      <BlockStack gap="200" inlineSize="100%">
                        <InlineStack align="space-between">
                          <Text variant="headingMd">{result.productTitle || "Product"}</Text>
                          <Badge tone={result.success ? "success" : "critical"}>{result.success ? "Generated" : "Failed"}</Badge>
                        </InlineStack>
                        {result.success ? (
                          <TextField label="Alt Text (editable)" value={result.altText} onChange={(val) => updateAltText(result.imageId, val)} multiline={2} maxLength={125} showCharacterCount />
                        ) : (
                          <Text variant="bodySm" tone="critical">Failed: {result.error}</Text>
                        )}
                      </BlockStack>
                    </InlineStack>
                  </Card>
                </Layout.Section>
              ))}
            </>
          )}
          {phase === "done" && (
            <Layout.Section>
              <Banner tone="success" title="Alt text applied!"><p>Your product images now have SEO-friendly alt text.</p></Banner>
              <br />
              <Button variant="primary" onClick={() => navigate("/app")}>Back to Dashboard</Button>
            </Layout.Section>
          )}
        </Layout>
        {toastActive && <Toast content={toastMessage} onDismiss={() => setToastActive(false)} />}
      </Page>
    </Frame>
  );
}
