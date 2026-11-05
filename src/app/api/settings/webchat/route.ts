import { apiError, parseBody, withAuth } from "@/lib/api";
import { canConfigure } from "@/lib/auth/roles";
import { isChannelEnabled, channelDisabledResponse } from "@/server/channels/enabled";
import { getWebchatByOrganization, guardarWebchat, webchatConfigSchema } from "@/server/webchat/config";

export const dynamic = "force-dynamic";

export const GET = withAuth(async (session) => {
  if (!isChannelEnabled("webchat")) return channelDisabledResponse();
  const config = await getWebchatByOrganization(session.organizationId);
  return Response.json({ config });
});

export const PUT = withAuth(async (session, req: Request) => {
  if (!isChannelEnabled("webchat")) return channelDisabledResponse();
  if (!canConfigure(session.role)) return apiError(403, "forbidden", "Solo quien administra puede configurar el chat web");
  const body = await parseBody(req, webchatConfigSchema);
  if (!body.ok) return body.response;
  try {
    return Response.json({ config: await guardarWebchat(session.organizationId, body.data) });
  } catch (err) {
    return apiError(422, "invalid_config", err instanceof Error ? err.message : "Configuración inválida");
  }
});
