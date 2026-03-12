import { login } from "../shopify.server";

export async function loader({ request }) {
  return login(request);
}
