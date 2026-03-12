import { redirect } from "@remix-run/node";
import { authenticate } from "../../shopify.server";


export const loader = async ({ request }) => {
  import { upgradeShopToPro } from "../../services/usage.server";
  const { session } = await authenticate.admin(request);
  const url = new URL(request.url);
  const chargeId = url.searchParams.get("charge_id");

  if (chargeId) {
    await upgradeShopToPro(session.shop, chargeId);
  }

  return redirect("/app?upgraded=true");
};
