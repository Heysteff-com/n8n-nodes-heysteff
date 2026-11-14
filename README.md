# @heysteff/n8n-nodes-heysteff

Nodos de comunidad de [n8n](https://n8n.io) para [heysteff](https://developers.heysteff.com): recibe y manda mensajes con **el mismo nodo para WhatsApp (Cloud API y QR), Instagram, Messenger, SMS y correo**. Solo cambia el campo `Channel`.

[English](./README.en.md) · [Documentación](https://developers.heysteff.com/docs/integraciones#n8n) · [npm](https://www.npmjs.com/package/@heysteff/n8n-nodes-heysteff) · [GitHub](https://github.com/heysteff-com/n8n-nodes-heysteff)

## Requisitos

- Una cuenta en [developers.heysteff.com](https://developers.heysteff.com/console/register) (el plan Developer Free es gratis).
- Una API key creada en [la consola](https://developers.heysteff.com/console/) → API keys, con los scopes de los nodos que uses:

  | Nodo | Scope |
  | --- | --- |
  | heysteff Trigger (crea y borra su webhook) | `webhooks:write` |
  | Message → Send / Mark as Read | `messages:write` |
  | Contact → Search / Create | `contacts:read` / `contacts:write` |
  | Customer → Create / Create Connection Link | `customers:write` |

  El Trigger necesita una key de producción (`sk_live_…`): las de prueba no crean webhooks. Una key `sk_test_…` sirve para probar **Send** por el [sandbox](https://developers.heysteff.com/docs/sandbox).
- n8n (en la nube o propio) con los nodos de comunidad habilitados.

## Inicio rápido

1. Instala el paquete. En n8n: **Settings → Community Nodes → Install** y escribe `@heysteff/n8n-nodes-heysteff`. En una instalación propia también puedes correr, en la carpeta de nodos de n8n (por lo general `~/.n8n/nodes`):

   ```bash
   npm install @heysteff/n8n-nodes-heysteff
   ```

2. Crea la credencial **heysteff API** y pega tu API key en el campo `API Key` (n8n la guarda cifrada; no la pongas en un nodo ni en una expresión).

3. Prueba un envío con una key `sk_test_…`: une tu WhatsApp al sandbox desde la consola (en Developers aparece un código `DEV-…`), agrega un nodo **heysteff** → Message → Send con `Channel` = `whatsapp_cloud`, `To` = tu teléfono en E.164 y un `Text`, y ejecútalo. La respuesta trae `"sandbox": true`.

4. Para recibir mensajes, cambia a una key `sk_live_…`, agrega **heysteff Trigger** con el evento `message:received` y activa el workflow: crea su webhook en heysteff y lo borra al desactivarlo.

5. Arma la respuesta: Trigger (`message:received`) → IF → heysteff (Send) con `To` = `{{$json.data.external_user_id}}` y `Channel` = `{{$json.data.channel}}`. Sale por el mismo canal por el que escribió el cliente.

## Uso

### heysteff Trigger

- Al **activar** el workflow crea su webhook en heysteff (`POST /v1/webhooks`) con los eventos que elijas y guarda el secreto. Al **desactivarlo** lo borra.
- Verifica la firma `X-Heysteff-Signature` de cada aviso: uno con firma mala recibe 401 y no corre el workflow.
- Eventos: `message:received` (mensaje nuevo en cualquier canal), `message.delivered`, `message.read`, `conversation:escalated`, `customer.channel_connected`, `payment.paid`, `order.delivered` y todos los demás del catálogo.
- **Skip Conversations Taken by a Person**: ignora los mensajes de conversaciones que tomó alguien del equipo (`bot_paused`), para no contestar encima.

### heysteff (acción)

| Recurso | Operación |
| --- | --- |
| Message | **Send**: texto, plantilla de WhatsApp, imagen/audio/video/archivo o hasta 3 botones, por cualquier canal. Con `Customer ID` sale por el canal que conectó uno de tus clientes. Cada envío lleva una clave de idempotencia. |
| Message | **Mark as Read**: tildes azules en WhatsApp, "visto" en Instagram y Messenger. |
| Contact | **Create** y **Search** (por nombre, teléfono o correo). |
| Customer | **Create** y **Create Connection Link**: el link donde tu cliente conecta su WhatsApp, Instagram, Messenger o Gmail. |

Canales del campo `Channel`: `whatsapp_cloud`, `whatsapp_baileys`, `instagram`, `facebook` (Messenger), `sms` y `gmail`. Fuera de la ventana de 24 h, WhatsApp Cloud solo acepta plantillas aprobadas (`Message Type` = `Template (WhatsApp)`).

## Configúralo con tu IA

Copia este texto y pégalo en Claude Code, Cursor, Codex o ChatGPT:

```text
Quiero automatizar mensajes de WhatsApp, Instagram, Messenger, SMS y correo en n8n con los
nodos de heysteff (@heysteff/n8n-nodes-heysteff). El mismo nodo sirve para todos los canales.

Fuentes de verdad (léelas antes de proponer nada; ganan sobre lo que recuerdes):
- https://developers.heysteff.com/AGENTS.md
- https://app.heysteff.com/api/v1/llms-full.txt
- https://developers.heysteff.com/docs/integraciones#n8n
- El README de @heysteff/n8n-nodes-heysteff en npm

Pasos:
1. Dime cómo instalar el paquete en mi n8n (Settings → Community Nodes → Install, nombre
   @heysteff/n8n-nodes-heysteff) o, si mi n8n es propio y tienes acceso a la máquina, instálalo
   con npm install @heysteff/n8n-nodes-heysteff en la carpeta de nodos y reinicia n8n.
2. La API key la pego yo en la credencial "heysteff API" de n8n. Si hace falta un archivo de
   entorno, usa la línea HEYSTEFF_API_KEY=<TU_API_KEY> y yo reemplazo el valor; confirma antes
   que el archivo esté en .gitignore. No me pidas la key en el chat.
3. Arma el workflow como JSON importable: heysteff Trigger con el evento message:received y la
   opción "Skip Conversations Taken by a Person" activada → un nodo con la lógica que te pida →
   heysteff (Message → Send) con To = {{$json.data.external_user_id}} y Channel = {{$json.data.channel}}.
4. Verifica primero con un workflow manual: heysteff (Message → Send) con una key sk_test_,
   Channel = whatsapp_cloud y To = <TELEFONO_UNIDO_AL_SANDBOX>. Muéstrame los valores y espera
   mi confirmación antes de ejecutarlo; la respuesta debe traer "sandbox": true.

Reglas de seguridad:
- Nunca escribas la API key en el JSON del workflow, en expresiones, en archivos versionados,
  en commits, en logs ni en este chat: vive solo en la credencial de n8n.
- Antes de activar un workflow que le escribe a personas reales, muéstrame a quién, por qué
  canal y qué texto manda, y espera mi confirmación.
- No inventes nodos, campos ni eventos: si algo no está en las fuentes de verdad, pregúntame.
```

## Desarrollo

```bash
pnpm --filter @heysteff/n8n-nodes-heysteff build   # dist/ con los nodos y los íconos
```

Las pruebas viven en `packages/tests/src/n8n-nodes.test.ts` del monorepo. El paquete no tiene dependencias propias (requisito de n8n para los nodos verificados): la firma se verifica con `node:crypto`.

## Enlaces

- Documentación: [Integraciones](https://developers.heysteff.com/docs/integraciones#n8n) · [Webhooks](https://developers.heysteff.com/docs/webhooks) · [Sandbox](https://developers.heysteff.com/docs/sandbox)
- npm: [@heysteff/n8n-nodes-heysteff](https://www.npmjs.com/package/@heysteff/n8n-nodes-heysteff)
- GitHub: [heysteff-com/n8n-nodes-heysteff](https://github.com/heysteff-com/n8n-nodes-heysteff)
- Licencia: [MIT](./LICENSE)
