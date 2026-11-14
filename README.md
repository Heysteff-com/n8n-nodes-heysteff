# @heysteff/n8n-nodes-heysteff

Nodos de comunidad de [n8n](https://n8n.io) para [heysteff](https://developers.heysteff.com): recibe y manda mensajes de WhatsApp (Cloud API y QR), Instagram, Messenger, SMS y Gmail con una sola API.

[English](./README.en.md)

## Instalación

En n8n: **Settings → Community Nodes → Install** y escribe `@heysteff/n8n-nodes-heysteff`. En una instalación propia también: `npm install @heysteff/n8n-nodes-heysteff` en la carpeta de nodos de n8n.

## Credencial

**heysteff API**: tu API key (`sk_live_…` para webhooks; `sk_test_…` sirve para probar envíos en el sandbox). La creas en [developers.heysteff.com/console](https://developers.heysteff.com/console).

## heysteff Trigger

- Al **activar** el workflow crea su webhook en heysteff (`POST /v1/webhooks`) con los eventos que elijas y guarda el secreto. Al **desactivarlo** lo borra.
- Verifica la firma `X-Heysteff-Signature` de cada aviso: uno con firma mala recibe 401 y no corre el workflow.
- Eventos: `message:received` (mensaje nuevo en cualquier canal), `message.delivered`, `message.read`, `conversation:escalated`, `customer.channel_connected`, `payment.paid`, `order.delivered` y todos los demás del catálogo.
- **Skip Conversations Taken by a Person**: ignora los mensajes de conversaciones que tomó alguien del equipo (`bot_paused`), para no contestar encima.

## heysteff (acción)

| Recurso | Operación |
| --- | --- |
| Message | **Send**: texto, plantilla de WhatsApp, imagen/audio/video/archivo o hasta 3 botones, por cualquier canal. Con `Customer ID` sale por el canal que conectó uno de tus clientes. Cada envío lleva una clave de idempotencia. |
| Message | **Mark as Read**: tildes azules en WhatsApp, "visto" en Instagram y Messenger. |
| Contact | **Create** y **Search** (por nombre, teléfono o correo). |
| Customer | **Create** y **Create Connection Link**: el link donde tu cliente conecta su WhatsApp, Instagram, Messenger o Gmail. |

Ejemplo: Trigger (`message:received`) → IF → heysteff (Send) con `To` = `{{$json.data.external_user_id}}` y `Channel` = `{{$json.data.channel}}`.

## Desarrollo

```bash
pnpm --filter @heysteff/n8n-nodes-heysteff build   # dist/ con los nodos y los íconos
```

Las pruebas viven en `packages/tests/src/n8n-nodes.test.ts` del monorepo. El paquete no tiene dependencias propias (requisito de n8n para los nodos verificados): la firma se verifica con `node:crypto`.

## Licencia

MIT
