# Plan — 067 Chat web para sitios

## Carril

Ciclo completo: cambia el modelo de datos (canal y configuración), añade rutas
públicas y amplía el contrato normalizado de despacho. La entrega es un canal
opcional que cumple las condiciones de `CHANNELS` y mantiene WhatsApp como canal
siempre disponible.

## Diseño

- Añadir `webchat` al catálogo y declarar capacidades con ventana ilimitada,
  texto plano, sin medios ni recibos de entrega.
- Guardar ajustes del widget por organización (clave pública, dominios, nombre,
  color, saludo) en `organization.metadata`, junto a la marca del negocio. La
  clave pública no es un secreto. Nunca
  entregar ajustes privados a rutas públicas.
- Resolver sesión de visitante a identidad estable `web:<HMAC>` y aprovechar
  contacto/conversación existentes. El identificador del navegador será
  aleatorio y no contendrá datos personales.
- Adaptar envío de mensajes para guardar respuestas humanas/IA y hacerlas
  visibles en el polling del widget, sin llamar a Meta.
- Añadir rutas públicas versionadas bajo `/api/webchat/[widgetKey]`; validar
  `Origin`, CORS, Zod, límite de tamaño, rate limit e idempotencia antes de
  escribir.
- El `script` público monta el widget en un Shadow DOM para aislar estilos; el
  widget usa las rutas públicas con CORS y guarda el UUID en el `localStorage`
  del sitio que lo incrusta.
- Incorporar configuración en Ajustes, distintivo de canal y etiqueta propia en
  la Bandeja. El resto de la operación usa inbox, lead, notas, handoff y eventos.

## Seguridad y aislamiento

- Resolver `widgetKey` dentro del servidor y derivar siempre `organizationId`
  desde esa fila; no aceptar `organizationId` desde el cliente.
- Confirmar el `Origin` en cada operación, incluida consulta de mensajes.
- Derivar con HMAC una identidad opaca por widget y UUID de visitante. El UUID
  no es un token de autorización; el `Origin` permitido sigue siendo obligatorio.
- Rate limit por clave/origen e identidad de sesión; limitar cuerpos a 16 KiB y
  texto a 4,000 caracteres.
- Consultas de dominio por organización mediante `scoped()` o la misma
  condición explícita en las operaciones transaccionales.

## Migración y contratos

- Actualizar tipos de canal de Drizzle para contacto, conversación y despacho;
  son columnas de texto sin enum SQL ni migración estructural.
- Ampliar evento de despacho y OpenAPI con `webchat`; agregar ruta pública
  separada, sin cambiar campos o códigos existentes de `/api/bot/*`.
- No se necesita migración estructural: los registros existentes conservan
  `whatsapp` y la configuración nueva vive en metadata ya existente.

## Verificación

- Pruebas unitarias para capacidades, validación exacta de origen e identidad;
  pruebas de ruta para CORS, validación de visitante, rate limit, bandera
  apagada y rechazo de cuerpos inválidos o demasiado grandes. El self-test con
  PostgreSQL valida idempotencia en la ruta de escritura.
- Ejecutar typecheck, lint, suite unitaria y build, probar el widget en un sitio
  externo local y comprobar el evento firmado con un consumidor simulado.

## Riesgos

- El widget guarda su identificador en el `localStorage` del sitio del cliente,
  sin cookies de terceros.
- El polling incrementa lecturas; debe usar intervalo corto solo cuando el
  widget está abierto y backoff al quedar inactivo.
- Cerebros existentes podrían validar una enumeración cerrada de canales. El
  contrato de Vocero lo amplía de forma aditiva; Nea conserva `webchat` en el
  parser y tolera nombres nuevos en el prompt. La prueba del runtime completo
  con proveedor LLM queda fuera del self-test local realizado.
