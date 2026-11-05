# 067 — Chat web para sitios

## Estado

Implementación y self-test local completados: el widget se ejercitó desde un
navegador en otro origen local, el mensaje llegó a la Bandeja, la respuesta
humana volvió al widget, el reintento idempotente no duplicó filas y un
consumidor simulado recibió el despacho firmado `channel=webchat` y respondió
por `/api/bot/messages`. Typecheck, lint, suite unitaria y build están en verde.
También se inspeccionó y ejecutó el parser de despacho de
[`kevinrivm/nea-agent`](https://github.com/kevinrivm/nea-agent): conserva
`conversation.channel=webchat`, y su prompt acepta canales no enumerados. La
prueba de despacho de Nea pasó. No se ejecutó el runtime completo de Nea con un
proveedor LLM real. Se agrega como canal opcional detrás de
`CHANNELS=...,webchat`; WhatsApp permanece disponible y sin cambios.

## Problema

Los negocios necesitan atender desde su propio sitio web con el mismo equipo,
pipeline y cerebro que ya usan en Vocero. Hoy el CRM solo puede recibir mensajes
por proveedores de mensajería y no ofrece un chat que el visitante pueda abrir
en una página web.

## Comportamiento observable

- Quien administra puede activar Chat web si el despliegue tiene `webchat` en
  `CHANNELS`, definir los dominios permitidos y copiar un fragmento de inserción.
- El visitante abre una burbuja de chat adaptable a móvil/escritorio, inicia un
  hilo sin crear una cuenta y puede mandar y leer mensajes de texto.
- La sesión del visitante queda asociada a un contacto y conversación del
  canal `webchat`. El hilo aparece en la Bandeja con distintivo propio y usa las
  acciones habituales de asignación manual, notas, pipeline y pausa de IA.
- Si el agente conectado está encendido, el CRM despacha el entrante al cerebro
  existente. Sus respuestas se muestran al visitante al consultar el hilo.
- Los mensajes se guardan antes de despachar. Repetir una solicitud con la
  misma clave idempotente no duplica mensajes ni efectos.
- Las rutas públicas solo aceptan una clave de widget válida y un origen
  permitido, limitan el tamaño del texto y aplican rate limit. No revelan datos
  de organización, configuración privada ni información de otros visitantes.
- Con la bandera apagada, la configuración, rutas y canal no están disponibles
  y las rutas devuelven 404.

## Criterios de aceptación

1. Con `CHANNELS=whatsapp,webchat`, el panel permite configurar el nombre,
   color, saludo y lista de dominios, y muestra el snippet de instalación.
2. Al insertar el snippet en un dominio permitido, el visitante puede iniciar
   una conversación y recibir respuestas sin login ni integración de WhatsApp.
3. Un mensaje entrante se ve en la Bandeja como `Chat web`, se publica por SSE,
   se registra como actividad del lead y solo se despacha después de guardarse.
4. Un saliente humano o del cerebro llega al widget y queda en el hilo; el
   visitante solo puede leer y escribir su propia conversación.
5. Un origen no autorizado, clave inválida, cuerpo demasiado grande o exceso de
   solicitudes se rechaza sin persistir mensajes.
6. Reintentar un envío con su `clientMessageId` conserva un único mensaje.
7. El canal no recibe ventanas de servicio: el equipo puede contestar aunque el
   visitante haya cerrado y reabierto la página.
8. `CHANNELS` sin `webchat` no expone ajustes, widget API ni bandeja del canal.

## Decisiones

- El canal se llama `webchat` en datos y `Chat web` en la interfaz.
- El visitante se identifica mediante token aleatorio de sesión de larga vida,
  guardado en el navegador; no se presupone teléfono ni correo. Su identidad se
  deriva de forma no reversible con HMAC usando el secreto de aplicación.
- MVP solo texto y polling corto del hilo. Adjuntos, identificación del
  visitante, varios widgets por organización y personalización avanzada quedan
  fuera de esta entrega.
- La configuración es por organización y el origen debe coincidir exactamente
  con una entrada permitida. No se permite `*`.
- No se reemplaza WhatsApp ni se migra a un SaaS centralizado. El servidor,
  historial y credenciales siguen bajo control de la instancia self-hosted.

## Fuera de alcance

- Reemplazar WhatsApp como canal obligatorio o retirar sus contratos.
- Constructor visual, campañas, analítica de visitantes o seguimiento entre
  sitios.
- Envío de imágenes/archivos, presencia en vivo, web push y multidioma.
- Cuentas de visitante, transcripción para el cerebro fuera del contrato de
  despacho, o exponer claves/tokens de operador al widget.
