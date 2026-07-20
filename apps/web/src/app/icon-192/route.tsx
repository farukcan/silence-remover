import { brandIconResponse } from "@/lib/brandIcon";

export const runtime = "edge";

export function GET() {
  return brandIconResponse(192);
}
