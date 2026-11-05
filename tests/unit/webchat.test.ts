import { describe, expect, it } from "vitest";
import { capabilitiesFor } from "@/server/channels/capabilities";
import { armarEvento } from "@/server/brains/contract";
import {
  identidadVisitante,
  leerWebchat,
  normalizarOrigen,
  origenPermitido,
  webchatConfigSchema,
} from "@/server/webchat/config";

describe("067 · Chat web", () => {
  it("normaliza un origen y solo acepta HTTPS o localhost HTTP", () => {
    expect(normalizarOrigen("https://tienda.example/"))
      .toBe("https://tienda.example");
    expect(normalizarOrigen("http://localhost:3000"))
      .toBe("http://localhost:3000");
    expect(normalizarOrigen("http://tienda.example")).toBeNull();
    expect(normalizarOrigen("https://tienda.example/ruta")).toBeNull();
    expect(normalizarOrigen("https://usuario:clave@tienda.example")).toBeNull();
    expect(normalizarOrigen("*")).toBeNull();
  });

  it("exige una lista concreta de orígenes y limita la marca del widget", () => {
    const valido = {
      name: "Atención",
      greeting: "¿Cómo te ayudamos?",
      color: "#0d5bff",
      allowedOrigins: ["https://tienda.example"],
    };
    expect(webchatConfigSchema.safeParse(valido).success).toBe(true);
    expect(webchatConfigSchema.safeParse({ ...valido, color: "red" }).success).toBe(false);
    expect(webchatConfigSchema.safeParse({ ...valido, allowedOrigins: [] }).success).toBe(false);
    expect(webchatConfigSchema.safeParse({ ...valido, name: "" }).success).toBe(false);
  });

  it("compara el origen exacto y no acepta rutas o dominios parecidos", () => {
    const config = {
      name: "Atención",
      greeting: "Hola",
      color: "#0d5bff",
      allowedOrigins: ["https://tienda.example"],
      widgetKey: `wc_${"a".repeat(36)}`,
    };
    expect(origenPermitido(config, "https://tienda.example/")).toBe("https://tienda.example");
    expect(origenPermitido(config, "https://tienda.example.evil")).toBeNull();
    expect(origenPermitido(config, "https://tienda.example/ruta")).toBeNull();
  });

  it("deriva una identidad estable y distinta por visitante y por widget", () => {
    const id = identidadVisitante("wc_widget1", "visitor-123", "secreto-de-prueba");
    expect(id).toMatch(/^web:[a-f0-9]{64}$/);
    expect(identidadVisitante("wc_widget1", "visitor-123", "secreto-de-prueba")).toBe(id);
    expect(identidadVisitante("wc_widget1", "visitor-456", "secreto-de-prueba")).not.toBe(id);
    expect(identidadVisitante("wc_widget2", "visitor-123", "secreto-de-prueba")).not.toBe(id);
    expect(id).not.toContain("visitor-123");
  });

  it("rechaza metadata mal formada y widget keys inválidas", () => {
    expect(leerWebchat("no json")).toBeNull();
    expect(leerWebchat(JSON.stringify({ webchat: { widgetKey: "wc_invalida" } }))).toBeNull();
    const config = {
      name: "Atención",
      greeting: "Hola",
      color: "#0d5bff",
      allowedOrigins: ["https://tienda.example"],
      widgetKey: `wc_${"a".repeat(36)}`,
    };
    expect(leerWebchat(JSON.stringify({ webchat: config }))).toEqual(config);
  });

  it("declara texto plano, sin ventana ni adjuntos", () => {
    const caps = capabilitiesFor("webchat");
    expect(caps.windowMs).toBeNull();
    expect(caps.textFormat).toBe("plain");
    expect(caps.maxTextChars).toBe(4000);
    expect(caps.outboundMedia).toBe(false);
  });

  it("expone webchat al cerebro en el contrato normalizado, sin vencimiento de ventana", () => {
    const now = new Date("2026-11-05T12:00:00Z");
    const event = armarEvento({
      dispatchId: "dsp_webchat",
      organization: { id: "org_webchat", slug: "tienda" },
      conversation: {
        id: "cv_webchat",
        channel: "webchat",
        aiEnabled: true,
        windowOpen: true,
        windowExpiresAt: null,
      },
      contact: { id: "ct_webchat", displayName: "Visitante web", identity: `web:${"b".repeat(64)}` },
      messages: [{
        id: "msg_webchat",
        createdAt: now,
        type: "text",
        text: "Hola",
        media: null,
      }],
      firstMessageAt: now,
      lastMessageAt: now,
    });
    expect(event.conversation).toMatchObject({ channel: "webchat", windowOpen: true, windowExpiresAt: null });
    expect(event.contact.identity).toMatch(/^web:[a-f0-9]{64}$/);
    expect(event.messages[0]?.text).toBe("Hola");
  });
});
