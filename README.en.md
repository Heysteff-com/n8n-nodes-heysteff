# @heysteff/n8n-nodes-heysteff

[n8n](https://n8n.io) community nodes for [heysteff](https://developers.heysteff.com): receive and send messages with **the same node for WhatsApp (Cloud API and QR), Instagram, Messenger, SMS and email**. Only the `Channel` field changes.

[Español](./README.md) · [Docs](https://developers.heysteff.com/en/docs/integrations#n8n) · [npm](https://www.npmjs.com/package/@heysteff/n8n-nodes-heysteff) · [GitHub](https://github.com/heysteff-com/n8n-nodes-heysteff)

## Requirements

- An account at [developers.heysteff.com](https://developers.heysteff.com/console/register?lang=en) (Developer Free costs nothing).
- An API key created in [the console](https://developers.heysteff.com/console/) → API keys, with the scopes for the nodes you use:

  | Node | Scope |
  | --- | --- |
  | heysteff Trigger (creates and deletes its webhook) | `webhooks:write` |
  | Message → Send / Mark as Read | `messages:write` |
  | Contact → Search / Create | `contacts:read` / `contacts:write` |
  | Customer → Create / Create Connection Link | `customers:write` |

  The Trigger needs a production key (`sk_live_…`): test keys cannot create webhooks. An `sk_test_…` key works to try **Send** through the [sandbox](https://developers.heysteff.com/en/docs/sandbox).
- n8n (cloud or self-hosted) with community nodes enabled.

## Quickstart

1. Install the package. In n8n: **Settings → Community Nodes → Install** and type `@heysteff/n8n-nodes-heysteff`. On a self-hosted instance you can also run, in n8n's nodes folder (usually `~/.n8n/nodes`):

   ```bash
   npm install @heysteff/n8n-nodes-heysteff
   ```

2. Create the **heysteff API** credential and paste your API key in the `API Key` field (n8n stores it encrypted; do not put it in a node or an expression).

3. Try a send with an `sk_test_…` key: join the sandbox with your WhatsApp from the console (under Developers there is a `DEV-…` code), add a **heysteff** node → Message → Send with `Channel` = `whatsapp_cloud`, `To` = your phone in E.164 and a `Text`, and run it. The response includes `"sandbox": true`.

4. To receive messages, switch to an `sk_live_…` key, add **heysteff Trigger** with the `message:received` event and activate the workflow: it creates its webhook in heysteff and deletes it when deactivated.

5. Build the reply: Trigger (`message:received`) → IF → heysteff (Send) with `To` = `{{$json.data.external_user_id}}` and `Channel` = `{{$json.data.channel}}`. It goes out on the same channel the customer wrote on.

## Usage

### heysteff Trigger

- When the workflow is **activated** it creates its webhook in heysteff (`POST /v1/webhooks`) with the events you pick and stores the secret. When **deactivated** it deletes it.
- It verifies the `X-Heysteff-Signature` of every delivery: a bad signature gets 401 and does not run the workflow.
- Events: `message:received` (new message on any channel), `message.delivered`, `message.read`, `conversation:escalated`, `customer.channel_connected`, `payment.paid`, `order.delivered` and the rest of the catalog.
- **Skip Conversations Taken by a Person**: ignores messages from conversations someone on the team took (`bot_paused`), so you do not talk over them.

### heysteff (action)

| Resource | Operation |
| --- | --- |
| Message | **Send**: text, WhatsApp template, image/audio/video/file or up to 3 buttons, on any channel. With `Customer ID` it goes out on a channel one of your customers connected. Every send carries an idempotency key. |
| Message | **Mark as Read**: blue ticks on WhatsApp, "seen" on Instagram and Messenger. |
| Contact | **Create** and **Search** (by name, phone or email). |
| Customer | **Create** and **Create Connection Link**: the link where your customer connects their WhatsApp, Instagram, Messenger or Gmail. |

`Channel` values: `whatsapp_cloud`, `whatsapp_baileys`, `instagram`, `facebook` (Messenger), `sms` and `gmail`. Outside the 24-hour window, WhatsApp Cloud only accepts approved templates (`Message Type` = `Template (WhatsApp)`).

## Set it up with your AI

Copy this text and paste it into Claude Code, Cursor, Codex or ChatGPT:

```text
I want to automate WhatsApp, Instagram, Messenger, SMS and email messages in n8n with the
heysteff nodes (@heysteff/n8n-nodes-heysteff). The same node works for every channel.

Sources of truth (read them before proposing anything; they win over what you remember):
- https://developers.heysteff.com/AGENTS.md
- https://app.heysteff.com/api/v1/llms-full.txt
- https://developers.heysteff.com/en/docs/integrations#n8n
- The @heysteff/n8n-nodes-heysteff README on npm

Steps:
1. Tell me how to install the package in my n8n (Settings → Community Nodes → Install, name
   @heysteff/n8n-nodes-heysteff) or, if my n8n is self-hosted and you have access to the machine,
   install it with npm install @heysteff/n8n-nodes-heysteff in the nodes folder and restart n8n.
2. I paste the API key into the "heysteff API" credential in n8n. If an environment file is
   needed, use the line HEYSTEFF_API_KEY=<YOUR_API_KEY> and I will replace the value; first make
   sure the file is in .gitignore. Do not ask me for the key in the chat.
3. Build the workflow as importable JSON: heysteff Trigger with the message:received event and
   "Skip Conversations Taken by a Person" turned on → a node with the logic I ask for →
   heysteff (Message → Send) with To = {{$json.data.external_user_id}} and Channel = {{$json.data.channel}}.
4. Verify first with a manual workflow: heysteff (Message → Send) with an sk_test_ key,
   Channel = whatsapp_cloud and To = <PHONE_JOINED_TO_THE_SANDBOX>. Show me the values and wait
   for my confirmation before running it; the response must include "sandbox": true.

Safety rules:
- Never write the API key in the workflow JSON, in expressions, in tracked files, in commits,
  in logs or in this chat: it lives only in the n8n credential.
- Before activating a workflow that writes to real people, show me who it writes to, on which
  channel and with what text, and wait for my confirmation.
- Do not invent nodes, fields or events: if something is not in the sources of truth, ask me.
```

## Development

```bash
pnpm --filter @heysteff/n8n-nodes-heysteff build   # dist/ with the nodes and icons
```

Tests live in `packages/tests/src/n8n-nodes.test.ts` in the monorepo. The package has no dependencies of its own (an n8n requirement for verified nodes): the signature is verified with `node:crypto`.

## Links

- Docs: [Integrations](https://developers.heysteff.com/en/docs/integrations#n8n) · [Webhooks](https://developers.heysteff.com/en/docs/webhooks) · [Sandbox](https://developers.heysteff.com/en/docs/sandbox)
- npm: [@heysteff/n8n-nodes-heysteff](https://www.npmjs.com/package/@heysteff/n8n-nodes-heysteff)
- GitHub: [heysteff-com/n8n-nodes-heysteff](https://github.com/heysteff-com/n8n-nodes-heysteff)
- License: [MIT](./LICENSE)
