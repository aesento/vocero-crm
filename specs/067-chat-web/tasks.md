# Tareas — 067 Chat web para sitios

## 1. Contratos y datos

- [x] Añadir `webchat` al tipo, catálogo, capacidades y bandera `CHANNELS`.
- [x] Añadir configuración por organización en metadata; no requiere migración SQL.
- [x] Añadir configuración API autenticada y esquema Zod.
- [x] Publicar contrato de widget: inicialización, historial y envío idempotente.

## 2. Ingesta y salida

- [x] Implementar sesión y resolución segura de visitante a contacto/conversación.
- [x] Guardar entrantes de forma idempotente, actualizar unread/actividad/SSE y
  encolar despacho tras commit.
- [x] Implementar polling limitado del historial propio.
- [x] Adaptar salida humana y del cerebro para `webchat`, sin llamada a Meta.
- [x] Tratar fallos de despacho con la degradación común a bandeja humana.

## 3. Widget y operación

- [x] Crear script y experiencia de chat adaptable con estados de carga/error.
- [x] Agregar Ajustes → Chat web con dominios, marca y snippet.
- [x] Agregar distintivo y capacidades correctas en Bandeja.
- [x] Mantener todas las superficies y endpoints en 404 si la bandera está apagada.

## 4. Calidad

- [x] Pruebas unitarias de capacidades, configuración, origen e identidad;
  pruebas de ruta para CORS, identificador inválido y cuerpos malformados o
  demasiado grandes.
- [x] Pruebas de ruta para rate limit y bandera apagada; self-test con PostgreSQL
  confirmó 201 al primer envío, 200 duplicate al reintento y una sola fila.
- [x] Ampliar documentación de instalación y contratos.
- [x] Ejecutar typecheck, lint, suite unitaria y build.
- [x] Self-test del widget en navegador con servidor local: burbuja, saludo,
  envío, visibilidad en Bandeja y respuesta humana por polling.
- [x] Consumidor simulado validó la firma del despacho webchat y respondió por
  la API del cerebro; el parser de Nea real también conserva `webchat` y pasó
  su prueba de despacho. El runtime completo con LLM real no se ejecutó.
