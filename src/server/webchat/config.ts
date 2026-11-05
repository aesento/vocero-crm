import { createHmac, randomBytes } from "node:crypto";
import { eq } from "drizzle-orm";
import { z } from "zod";
import { getDb, schema } from "@/lib/db";

const key = "webchat";

export const webchatConfigSchema = z.object({
  name: z.string().trim().min(1).max(60),
  greeting: z.string().trim().min(1).max(240),
  color: z.string().regex(/^#[0-9a-fA-F]{6}$/),
  allowedOrigins: z.array(z.string().url().max(200)).min(1).max(20),
});

export type WebchatConfig = z.infer<typeof webchatConfigSchema> & {
  widgetKey: string;
};

/** Identidad opaca y estable del navegador, separada por widget. */
export function identidadVisitante(widgetKey: string, visitorId: string, secret: string): string {
  const digest = createHmac("sha256", secret)
    .update(`${widgetKey}:${visitorId}`)
    .digest("hex");
  return `web:${digest}`;
}

function parseMetadata(raw: string | null): Record<string, unknown> {
  if (!raw) return {};
  try {
    const parsed: unknown = JSON.parse(raw);
    return parsed && typeof parsed === "object" && !Array.isArray(parsed)
      ? (parsed as Record<string, unknown>)
      : {};
  } catch {
    return {};
  }
}

export function normalizarOrigen(value: string): string | null {
  try {
    const url = new URL(value);
    if (url.protocol !== "https:" && !(url.protocol === "http:" && url.hostname === "localhost")) return null;
    if (url.username || url.password || url.pathname !== "/" || url.search || url.hash) return null;
    return url.origin;
  } catch {
    return null;
  }
}

/** Devuelve el origen canónico solo cuando está en la lista explícita del negocio. */
export function origenPermitido(config: WebchatConfig, value: string): string | null {
  const origin = normalizarOrigen(value);
  return origin && config.allowedOrigins.includes(origin) ? origin : null;
}

export function leerWebchat(metadata: string | null): WebchatConfig | null {
  const raw = parseMetadata(metadata)[key];
  if (!raw || typeof raw !== "object") return null;
  const item = raw as Record<string, unknown>;
  const parsed = webchatConfigSchema.safeParse({
    name: item.name,
    greeting: item.greeting,
    color: item.color,
    allowedOrigins: item.allowedOrigins,
  });
  if (!parsed.success || typeof item.widgetKey !== "string" || !/^wc_[a-f0-9]{36}$/.test(item.widgetKey)) return null;
  return { ...parsed.data, widgetKey: item.widgetKey };
}

export async function getWebchatByOrganization(
  organizationId: string
): Promise<WebchatConfig | null> {
  const rows = await getDb()
    .select({ metadata: schema.organization.metadata })
    .from(schema.organization)
    .where(eq(schema.organization.id, organizationId))
    .limit(1);
  return leerWebchat(rows[0]?.metadata ?? null);
}

/** Clave pública opaca: identifica ajustes, no autoriza a leer conversaciones. */
export async function guardarWebchat(
  organizationId: string,
  input: z.infer<typeof webchatConfigSchema>
): Promise<WebchatConfig> {
  const db = getDb();
  const rows = await db
    .select({ metadata: schema.organization.metadata })
    .from(schema.organization)
    .where(eq(schema.organization.id, organizationId))
    .limit(1);
  if (!rows[0]) throw new Error("Organización no encontrada");
  const metadata = parseMetadata(rows[0].metadata);
  const previous = leerWebchat(rows[0].metadata);
  const config: WebchatConfig = {
    ...input,
    allowedOrigins: [...new Set(input.allowedOrigins.map((origin) => normalizarOrigen(origin)).filter((x): x is string => Boolean(x)))],
    widgetKey: previous?.widgetKey ?? `wc_${randomBytes(18).toString("hex")}`,
  };
  if (!config.allowedOrigins.length) throw new Error("Agrega al menos un dominio HTTPS válido");
  metadata[key] = config;
  await db
    .update(schema.organization)
    .set({ metadata: JSON.stringify(metadata) })
    .where(eq(schema.organization.id, organizationId));
  return config;
}

export async function findWebchatByKey(widgetKey: string) {
  // Vocero se despliega como una instancia por negocio. Aun así, nunca se usa
  // un organizationId del navegador: la organización sale de la clave guardada.
  const rows = await getDb()
    .select({ id: schema.organization.id, metadata: schema.organization.metadata })
    .from(schema.organization);
  for (const row of rows) {
    const config = leerWebchat(row.metadata);
    if (config?.widgetKey === widgetKey) return { organizationId: row.id, config };
  }
  return null;
}
