import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("@/server/channels/enabled", () => ({
  isChannelEnabled: vi.fn(() => true),
  channelDisabledResponse: () => new Response(null, { status: 404 }),
}));

vi.mock("@/server/webchat/config", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@/server/webchat/config")>();
  return { ...actual, findWebchatByKey: vi.fn() };
});

import { OPTIONS, POST } from "@/app/api/webchat/[widgetKey]/messages/route";
import { findWebchatByKey } from "@/server/webchat/config";
import { isChannelEnabled } from "@/server/channels/enabled";
import { resetRateLimit } from "@/lib/rate-limit";

const widgetKey = `wc_${"a".repeat(36)}`;
const widget = {
  organizationId: "org_webchat",
  config: {
    widgetKey,
    name: "Atención",
    greeting: "Hola",
    color: "#0d5bff",
    allowedOrigins: ["https://tienda.example"],
  },
};
const params = { params: Promise.resolve({ widgetKey }) };

function request(path: string, init: RequestInit = {}) {
  return new Request(`https://crm.example/api/webchat/${widgetKey}/messages${path}`, {
    ...init,
    headers: { Origin: "https://tienda.example", ...init.headers },
  });
}

describe("API pública de Chat web", () => {
  beforeEach(() => {
    resetRateLimit();
    vi.mocked(isChannelEnabled).mockReset().mockReturnValue(true);
    vi.mocked(findWebchatByKey).mockClear();
    vi.mocked(findWebchatByKey).mockResolvedValue(widget);
  });

  it("solo habilita CORS para el origen configurado", async () => {
    const allowed = await OPTIONS(request("", { method: "OPTIONS" }), params);
    expect(allowed.status).toBe(204);
    expect(allowed.headers.get("access-control-allow-origin")).toBe("https://tienda.example");

    const forbidden = await OPTIONS(request("", {
      method: "OPTIONS",
      headers: { Origin: "https://tienda.example.evil" },
    }), params);
    expect(forbidden.status).toBe(403);
  });

  it("devuelve 404 cuando webchat no está habilitado", async () => {
    vi.mocked(isChannelEnabled).mockReturnValue(false);
    const response = await OPTIONS(request("", { method: "OPTIONS" }), params);
    expect(response.status).toBe(404);
    expect(findWebchatByKey).not.toHaveBeenCalled();
    vi.mocked(isChannelEnabled).mockReturnValue(true);
  });

  it("limita las solicitudes públicas por IP", async () => {
    const headers = { Origin: "https://tienda.example", "x-forwarded-for": "203.0.113.9" };
    let response: Response | undefined;
    for (let i = 0; i < 241; i++) {
      response = await OPTIONS(request("", { method: "OPTIONS", headers }), params);
    }
    expect(response?.status).toBe(429);
    expect(await response?.json()).toMatchObject({ error: "rate_limited" });
  });

  it("no crea una conversación si el identificador de visitante no es válido", async () => {
    const response = await import("@/app/api/webchat/[widgetKey]/messages/route")
      .then(({ GET }) => GET(request("?visitorId=tel:+15551234"), params));
    expect(response.status).toBe(422);
    expect(await response.json()).toMatchObject({ error: "invalid_visitor" });
  });

  it("rechaza bodies malformados y grandes antes de persistirlos", async () => {
    const malformed = await POST(request("", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: "{",
    }), params);
    expect(malformed.status).toBe(422);

    const oversized = await POST(request("", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: "x".repeat(16_385),
    }), params);
    expect(oversized.status).toBe(413);
  });
});
