"use client";

import { useEffect, useState } from "react";
import { Check, Copy, Globe, MessageCircle, Save } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";

type Config = { name: string; greeting: string; color: string; allowedOrigins: string[]; widgetKey: string };

export function WebchatClient() {
  const [config, setConfig] = useState<Config>({ name: "Atención", greeting: "¡Hola! ¿En qué podemos ayudarte?", color: "#0d5bff", allowedOrigins: ["https://tusitio.com"], widgetKey: "" });
  const [origins, setOrigins] = useState("https://tusitio.com");
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState("");
  const [copied, setCopied] = useState(false);
  const snippet = config.widgetKey && typeof window !== "undefined" ? `<script async src="${window.location.origin}/api/webchat/${config.widgetKey}/widget.js"></script>` : "";

  useEffect(() => {
    void fetch("/api/settings/webchat").then(async (r) => {
      if (!r.ok) throw new Error();
      const data = await r.json();
      if (data.config) {
        setConfig(data.config);
        setOrigins(data.config.allowedOrigins.join("\n"));
      }
    }).catch(() => setMessage("No se pudo cargar la configuración.")).finally(() => setLoading(false));
  }, []);

  async function save() {
    setSaving(true); setMessage("");
    const payload = { name: config.name, greeting: config.greeting, color: config.color, allowedOrigins: origins.split(/\s+/).filter(Boolean) };
    const response = await fetch("/api/settings/webchat", { method: "PUT", headers: { "content-type": "application/json" }, body: JSON.stringify(payload) }).catch(() => null);
    const data = await response?.json().catch(() => null);
    setSaving(false);
    if (!response?.ok) { setMessage(data?.error?.message ?? "No se pudo guardar. Revisa los dominios permitidos."); return; }
    setConfig(data.config); setOrigins(data.config.allowedOrigins.join("\n")); setMessage("Configuración guardada.");
  }

  async function copy() {
    try { await navigator.clipboard.writeText(snippet); setCopied(true); setTimeout(() => setCopied(false), 1600); }
    catch { setMessage("Selecciona y copia el fragmento manualmente."); }
  }

  if (loading) return <p className="text-sm text-muted-foreground">Cargando Chat web…</p>;
  return <div className="max-w-3xl space-y-6">
    <div className="flex items-start gap-3">
      <div className="rounded-xl bg-primary/10 p-3 text-primary"><MessageCircle className="h-5 w-5" /></div>
      <div><h1 className="text-lg font-bold">Chat web</h1><p className="mt-1 text-sm text-muted-foreground">Instala una burbuja de atención en tu sitio. Los mensajes aparecen junto a tus demás conversaciones.</p></div>
    </div>
    <section className="space-y-4 rounded-xl border bg-card p-5">
      <div className="space-y-2"><Label htmlFor="webchat-name">Nombre del chat</Label><Input id="webchat-name" value={config.name} maxLength={60} onChange={(e) => setConfig({ ...config, name: e.target.value })} /></div>
      <div className="space-y-2"><Label htmlFor="webchat-greeting">Saludo inicial</Label><Textarea id="webchat-greeting" value={config.greeting} maxLength={240} onChange={(e) => setConfig({ ...config, greeting: e.target.value })} /></div>
      <div className="space-y-2"><Label htmlFor="webchat-color">Color del botón</Label><div className="flex items-center gap-3"><Input id="webchat-color" type="color" value={config.color} className="h-10 w-16 p-1" onChange={(e) => setConfig({ ...config, color: e.target.value })} /><span className="text-sm text-muted-foreground">Se usa en la burbuja y el encabezado.</span></div></div>
      <div className="space-y-2"><Label htmlFor="webchat-origins">Dominios autorizados</Label><Textarea id="webchat-origins" value={origins} onChange={(e) => setOrigins(e.target.value)} rows={3} placeholder="https://mitienda.com" /><p className="flex items-center gap-1 text-xs text-muted-foreground"><Globe className="h-3.5 w-3.5" />Un origen HTTPS por línea, sin rutas. localhost se admite para desarrollo.</p></div>
      <div className="flex flex-wrap items-center gap-3"><Button disabled={saving} onClick={() => void save()}><Save className="mr-2 h-4 w-4" />{saving ? "Guardando…" : "Guardar configuración"}</Button>{message && <span role="status" className="text-sm text-muted-foreground">{message}</span>}</div>
    </section>
    {config.widgetKey && <section className="space-y-3 rounded-xl border bg-card p-5"><h2 className="font-semibold">Instalación</h2><p className="text-sm text-muted-foreground">Pega este fragmento antes de cerrar <code>&lt;/body&gt;</code> en tu sitio.</p><div className="flex gap-2"><Input readOnly value={snippet} className="font-mono text-xs" /><Button variant="outline" onClick={() => void copy()} aria-label="Copiar fragmento">{copied ? <Check className="h-4 w-4" /> : <Copy className="h-4 w-4" />}</Button></div><p className="text-xs text-muted-foreground">Solo funciona desde los dominios que autorizaste arriba. No incluye contraseñas ni tokens del CRM.</p></section>}
  </div>;
}
