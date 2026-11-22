import { handleGateway } from "@/lib/audio/gateway/server";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 30;

export async function POST(request: Request, context: { params: Promise<{ shareId: string }> }) {
  const { shareId } = await context.params;
  return handleGateway(request, "rotate", shareId);
}
