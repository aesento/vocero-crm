import { desc, eq, gt, sql } from "drizzle-orm";
import { z } from "zod";
import { getEnv } from "@/lib/env";
import { getDb, schema } from "@/lib/db";
import { scoped } from "@/lib/db/tenant";
import { newId } from "@/lib/db/ids";
import { checkRateLimit, clientIp } from "@/lib/rate-limit";
import { publish } from "@/server/events/bus";
import { getOrCreateContactByIdentity } from "@/server/inbox/identity";
import { getOrCreateConversation, serializeMessage } from "@/server/inbox/ingest";
import { onLeadActivity } from "@/server/inbox/lead-activity";
import { despacharAlCerebro } from "@/server/dispatch/encolar";
import { findWebchatByKey, identidadVisitante, origenPermitido } from "@/server/webchat/config";
import { channelDisabledResponse, isChannelEnabled } from "@/server/channels/enabled";

export const dynamic = "force-dynamic";

const bodySchema = z.object({
  visitorId: z.string().regex(/^[a-f0-9-]{32,36}$/i),
  text: z.string().trim().min(1).max(4000).optional(),
  clientMessageId: z.string().regex(/^[a-zA-Z0-9_-]{8,80}$/).optional(),
});

type Context = { params: Promise<{ widgetKey: string }> };
type PublicContextResult =
  | { ok: false; response: Response }
  | { ok: true; found: NonNullable<Awaited<ReturnType<typeof findWebchatByKey>>>; origin: string; headers: Headers };

async function readBodyLimited(req: Request, maxBytes: number): Promise<string | null> {
  if (!req.body) return "";
  const reader = req.body.getReader();
  const decoder = new TextDecoder();
  let bytes = 0;
  let body = "";
  while (true) {
    const { done, value } = await reader.read();
    if (done) break;
    bytes += value.byteLength;
    if (bytes > maxBytes) {
      await reader.cancel();
      return null;
    }
    body += decoder.decode(value, { stream: true });
  }
  return body + decoder.decode();
}

function identidad(widgetKey: string, visitorId: string): string {
  return identidadVisitante(widgetKey, visitorId, getEnv().BETTER_AUTH_SECRET);
}

async function publicContext(req: Request, { params }: Context): Promise<PublicContextResult> {
  if (!isChannelEnabled("webchat")) return { ok: false, response: channelDisabledResponse() };
  const { widgetKey } = await params;
  const found = await findWebchatByKey(widgetKey);
  if (!found) return { ok: false, response: Response.json({ error: "widget_not_found" }, { status: 404 }) };
  const origin = origenPermitido(found.config, req.headers.get("origin") ?? "");
  if (!origin) {
    return { ok: false, response: Response.json({ error: "origin_not_allowed" }, { status: 403 }) };
  }
  const headers = new Headers({
    "access-control-allow-origin": origin,
    "access-control-allow-methods": "GET, POST, OPTIONS",
    "access-control-allow-headers": "content-type",
    "access-control-max-age": "600",
    vary: "Origin",
  });
  const limited = checkRateLimit(`webchat:${found.organizationId}:${clientIp(req.headers)}`, { windowMs: 60_000, max: 240 });
  if (!limited.allowed) return { ok: false, response: Response.json({ error: "rate_limited" }, { status: 429, headers }) };
  return { ok: true, found, origin, headers };
}

export async function OPTIONS(req: Request, ctx: Context) {
  const result = await publicContext(req, ctx);
  if (!result.ok) return result.response;
  return new Response(null, { status: 204, headers: result.headers });
}

export async function GET(req: Request, ctx: Context) {
  const result = await publicContext(req, ctx);
  if (!result.ok) return result.response;
  const { found, headers } = result;
  const visitorId = new URL(req.url).searchParams.get("visitorId") ?? "";
  if (!/^[a-f0-9-]{32,36}$/i.test(visitorId)) {
    return Response.json({ error: "invalid_visitor" }, { status: 422, headers });
  }
  if (!checkRateLimit(`webchat-read:${found.organizationId}:${identidad(found.config.widgetKey, visitorId)}`, { windowMs: 60_000, max: 60 }).allowed) {
    return Response.json({ error: "rate_limited" }, { status: 429, headers });
  }
  const identity = identidad(found.config.widgetKey, visitorId);
  const db = getDb();
  const rows = await db
    .select({ conversation: schema.conversation })
    .from(schema.conversation)
    .innerJoin(schema.contact, eq(schema.conversation.contactId, schema.contact.id))
    .where(scoped(
      schema.conversation.organizationId,
      found.organizationId,
      eq(schema.conversation.channel, "webchat"),
      eq(schema.contact.organizationId, found.organizationId),
      eq(schema.contact.waIdentity, identity),
      eq(schema.conversation.isTest, false)
    ))
    .limit(1);
  const conversation = rows[0]?.conversation;
  if (!conversation) return Response.json({ messages: [] }, { headers });
  const messages = await db
    .select()
    .from(schema.message)
    .where(scoped(
      schema.message.organizationId,
      found.organizationId,
      eq(schema.message.conversationId, conversation.id),
      gt(schema.message.createdAt, new Date(Date.now() - 7 * 24 * 60 * 60 * 1000))
    ))
    .orderBy(desc(schema.message.createdAt))
    .limit(100);
  return Response.json({
    messages: messages.reverse().map((message) => ({ id: message.id, direction: message.direction, text: message.text, at: message.createdAt.toISOString() })),
  }, { headers });
}

export async function POST(req: Request, ctx: Context) {
  const result = await publicContext(req, ctx);
  if (!result.ok) return result.response;
  const { found, headers } = result;
  const rawBody = await readBodyLimited(req, 16_384);
  if (rawBody === null) return Response.json({ error: "body_too_large" }, { status: 413, headers });
  let raw: unknown;
  try { raw = JSON.parse(rawBody) as unknown; } catch { return Response.json({ error: "invalid_body" }, { status: 422, headers }); }
  const parsed = bodySchema.safeParse(raw);
  if (!parsed.success || !parsed.data.text || !parsed.data.clientMessageId) {
    return Response.json({ error: "invalid_body" }, { status: 422, headers });
  }
  const { visitorId, text, clientMessageId } = parsed.data;
  const limited = checkRateLimit(`webchat:${found.organizationId}:${identidad(found.config.widgetKey, visitorId)}`, { windowMs: 60_000, max: 12 });
  if (!limited.allowed) return Response.json({ error: "rate_limited" }, { status: 429, headers });

  const identity = identidad(found.config.widgetKey, visitorId);
  const now = new Date();
  const { contact } = await getOrCreateContactByIdentity(found.organizationId, {
    identity, channel: "webchat", phone: null, waUserId: null, profileName: "Visitante web",
  });
  const conversation = await getOrCreateConversation(found.organizationId, contact.id, { channel: "webchat" });
  const db = getDb();
  const [inserted] = await db.insert(schema.message).values({
    id: newId("message"),
    organizationId: found.organizationId,
    conversationId: conversation.id,
    waMessageId: `wc:${found.organizationId}:${identity.slice("web:".length)}:${clientMessageId}`,
    direction: "in",
    type: "text",
    text,
    status: "sent",
    origin: "operator",
    createdAt: now,
    waTimestamp: now,
  }).onConflictDoNothing({ target: schema.message.waMessageId }).returning();
  if (!inserted) return Response.json({ ok: true, duplicate: true }, { headers });

  await db.update(schema.conversation).set({
    lastInboundAt: now,
    lastMessageAt: now,
    unreadCount: sql`${schema.conversation.unreadCount} + 1`,
    updatedAt: now,
  }).where(scoped(
    schema.conversation.organizationId,
    found.organizationId,
    eq(schema.conversation.id, conversation.id)
  ));
  await onLeadActivity(found.organizationId, contact.id, now);
  publish(found.organizationId, {
    type: "message.new",
    data: { conversationId: conversation.id, message: serializeMessage(inserted, null) },
  });
  await despacharAlCerebro(conversation.id, found.organizationId, inserted.id);
  return Response.json({ ok: true, messageId: inserted.id }, { status: 201, headers });
}
