import { brandIconResponse } from "@/lib/brandIcon";

export const runtime = "edge";
export const size = { width: 180, height: 180 };
export const contentType = "image/png";

/** iOS home-screen icon. */
export default function AppleIcon() {
  return brandIconResponse(180);
}
