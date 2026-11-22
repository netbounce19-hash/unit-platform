import { handleGateway } from "@/lib/audio/gateway/server";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 300;

export async function GET(request: Request, context: { params: Promise<{ sessionId: string }> }) {
  const { sessionId } = await context.params;
  return handleGateway(request, "stream", sessionId);
}

export async function HEAD(request: Request, context: { params: Promise<{ sessionId: string }> }) {
  const { sessionId } = await context.params;
  return handleGateway(request, "stream", sessionId);
}
