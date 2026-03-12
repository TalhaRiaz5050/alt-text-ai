import Anthropic from "@anthropic-ai/sdk";

const client = new Anthropic({
  apiKey: process.env.ANTHROPIC_API_KEY,
});

/**
 * Generate SEO-friendly alt text for a product image using Claude AI
 * @param {string} imageUrl - URL of the product image
 * @param {string} productTitle - Title of the product
 * @param {string} productType - Type/category of the product
 * @returns {Promise<string>} - Generated alt text
 */
export async function generateAltText(imageUrl, productTitle, productType = "") {
  try {
    const response = await client.messages.create({
      model: "claude-sonnet-4-20250514",
      max_tokens: 200,
      messages: [
        {
          role: "user",
          content: [
            {
              type: "image",
              source: {
                type: "url",
                url: imageUrl,
              },
            },
            {
              type: "text",
              text: `You are an ecommerce SEO expert. Generate a concise, descriptive alt text for this product image.

Product name: ${productTitle}
Product type: ${productType || "general product"}

Rules:
- Maximum 125 characters
- Be specific and descriptive about what you see
- Include the product name naturally
- Focus on visual details (color, material, style, use)
- Do NOT start with "image of" or "photo of"
- Make it useful for visually impaired users AND search engines
- Output ONLY the alt text, nothing else

Alt text:`,
            },
          ],
        },
      ],
    });

    const altText = response.content[0].text.trim();
    // Ensure it's within 125 chars
    return altText.length > 125 ? altText.substring(0, 122) + "..." : altText;
  } catch (error) {
    console.error("Error generating alt text:", error);
    throw new Error("Failed to generate alt text: " + error.message);
  }
}

/**
 * Generate alt text for multiple images in batch
 * @param {Array} images - Array of {imageUrl, productTitle, productType, imageId, productId}
 * @returns {Promise<Array>} - Array of {imageId, productId, altText, error}
 */
export async function generateBatchAltText(images) {
  const results = [];

  for (const image of images) {
    try {
      const altText = await generateAltText(
        image.imageUrl,
        image.productTitle,
        image.productType
      );
      results.push({
        imageId: image.imageId,
        productId: image.productId,
        imageUrl: image.imageUrl,
        altText,
        success: true,
      });
      // Small delay to avoid rate limits
      await new Promise((r) => setTimeout(r, 200));
    } catch (error) {
      results.push({
        imageId: image.imageId,
        productId: image.productId,
        imageUrl: image.imageUrl,
        altText: null,
        success: false,
        error: error.message,
      });
    }
  }

  return results;
}
