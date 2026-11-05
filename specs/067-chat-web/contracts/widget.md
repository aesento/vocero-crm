# Contrato público del widget Chat web

El widget solo existe cuando `webchat` está en `CHANNELS`. La clave pública
identifica la configuración de una organización; no da acceso a la API interna
ni a las conversaciones de otros visitantes. Todas las rutas comprueban que el
header `Origin` coincida exactamente con un origen permitido en Ajustes.

## Instalar

```html
<script async src="https://crm.ejemplo/api/webchat/wc_CLAVE/widget.js"></script>
```

## `GET /api/webchat/{widgetKey}/messages?visitorId=…`

Devuelve hasta los últimos 100 mensajes del visitante (retención visible de
siete días), ordenados del más antiguo al más nuevo:

```json
{
  "messages": [
    { "id": "msg_…", "direction": "in", "text": "Hola", "at": "2026-11-05T12:00:00.000Z" }
  ]
}
```

Si todavía no hay conversación, devuelve `{"messages":[]}`.

## `POST /api/webchat/{widgetKey}/messages`

`Content-Type: application/json`; el identificador de visitante es UUID
aleatorio guardado en el `localStorage` del sitio que incrusta el widget.

```json
{
  "visitorId": "uuid",
  "clientMessageId": "uuid",
  "text": "¿Cuál es el horario?"
}
```

Éxito nuevo: `201 {"ok":true,"messageId":"msg_…"}`. Reintento idempotente:
`200 {"ok":true,"duplicate":true}`. Códigos de error: 403 `origin_not_allowed`,
404 `widget_not_found`, 413 `body_too_large`, 422 `invalid_body` o 429
`rate_limited`. Texto de hasta 4.000 caracteres; cuerpo de hasta 16 KiB. Los
mensajes solo son texto. El API no acepta ni devuelve `organizationId`.

## Frecuencia

El widget consulta cada 2,5 segundos mientras está abierto. Límite por IP:
240 solicitudes por minuto; cada visitante puede consultar 60 veces y enviar
12 mensajes por minuto.
