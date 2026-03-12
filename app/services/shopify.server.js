/**
 * GraphQL query to fetch products with missing alt text
 */
export const GET_PRODUCTS_MISSING_ALT_TEXT = `#graphql
  query getProductsMissingAltText($first: Int!, $after: String) {
    products(first: $first, after: $after) {
      pageInfo {
        hasNextPage
        endCursor
      }
      edges {
        node {
          id
          title
          productType
          images(first: 10) {
            edges {
              node {
                id
                url
                altText
              }
            }
          }
        }
      }
    }
  }
`;

/**
 * GraphQL mutation to update image alt text
 */
export const UPDATE_PRODUCT_IMAGE_ALT_TEXT = `#graphql
  mutation updateProductImageAltText($productId: ID!, $images: [ImageInput!]!) {
    productUpdate(input: {
      id: $productId,
      images: $images
    }) {
      product {
        id
        images(first: 10) {
          edges {
            node {
              id
              altText
            }
          }
        }
      }
      userErrors {
        field
        message
      }
    }
  }
`;

/**
 * GraphQL query to get shop info
 */
export const GET_SHOP_INFO = `#graphql
  query getShopInfo {
    shop {
      name
      myshopifyDomain
      plan {
        displayName
      }
    }
    productsCount: products(first: 1) {
      pageInfo {
        hasNextPage
      }
    }
  }
`;

/**
 * Get total count of images missing alt text
 */
export async function getImagesMissingAltText(admin) {
  let allImages = [];
  let hasNextPage = true;
  let cursor = null;

  while (hasNextPage) {
    const response = await admin.graphql(GET_PRODUCTS_MISSING_ALT_TEXT, {
      variables: { first: 50, after: cursor },
    });

    const data = await response.json();
    const products = data.data.products;

    for (const { node: product } of products.edges) {
      for (const { node: image } of product.images.edges) {
        if (!image.altText || image.altText.trim() === "") {
          allImages.push({
            imageId: image.id,
            imageUrl: image.url,
            productId: product.id,
            productTitle: product.title,
            productType: product.productType,
            currentAltText: image.altText,
          });
        }
      }
    }

    hasNextPage = products.pageInfo.hasNextPage;
    cursor = products.pageInfo.endCursor;
  }

  return allImages;
}

/**
 * Update alt text for a single product image
 */
export async function updateImageAltText(admin, productId, imageId, altText) {
  // Extract numeric ID from GID
  const numericImageId = imageId.split("/").pop();

  const response = await admin.graphql(UPDATE_PRODUCT_IMAGE_ALT_TEXT, {
    variables: {
      productId,
      images: [{ id: imageId, altText }],
    },
  });

  const data = await response.json();

  if (data.data?.productUpdate?.userErrors?.length > 0) {
    throw new Error(data.data.productUpdate.userErrors[0].message);
  }

  return data.data?.productUpdate?.product;
}
