import 'server-only';
import { gatewayRuntime } from './runtime.mjs';
import { gateway } from './controller.mjs';
import { privacyHeaders } from './delivery.mjs';

export async function handleGateway(request: Request, operation: string, target?: string) {
  try {
    const runtime = gatewayRuntime();
    return await gateway(request, operation, target, runtime, event => console.log(JSON.stringify(event)));
  } catch {
    return Response.json({ error: 'UNAVAILABLE' }, { status: 503, headers: privacyHeaders });
  }
}
