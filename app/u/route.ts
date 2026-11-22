import { handleGateway } from "@/lib/audio/gateway/server";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 30;

export async function GET(request: Request) {
  return handleGateway(request, "landing");
}
