# @heysteff/n8n-nodes-heysteff

[n8n](https://n8n.io) community nodes for [heysteff](https://developers.heysteff.com): receive and send WhatsApp (Cloud API and QR), Instagram, Messenger, SMS and Gmail messages with one API.

[Español](./README.md)

## Install

In n8n: **Settings → Community Nodes → Install** and enter `@heysteff/n8n-nodes-heysteff`. Self-hosted: `npm install @heysteff/n8n-nodes-heysteff` in your n8n nodes folder.

## Credential

**heysteff API**: your API key (`sk_live_…` for webhooks; `sk_test_…` works for sandbox sends). Create it at [developers.heysteff.com/console](https://developers.heysteff.com/console).

## heysteff Trigger

- When the workflow is **activated** it creates its webhook in heysteff (`POST /v1/webhooks`) with the events you pick and stores the secret. When **deactivated** it deletes it.
- Every delivery's `X-Heysteff-Signature` is verified: a bad signature gets 401 and the workflow does not run.
- Events: `message:received` (new message on any channel), `message.delivered`, `message.read`, `conversation:escalated`, `customer.channel_connected`, `payment.paid`, `order.delivered` and the rest of the catalog.
- **Skip Conversations Taken by a Person**: ignore messages from conversations a team member took over (`bot_paused`).

## heysteff (action)

| Resource | Operation |
| --- | --- |
| Message | **Send**: text, WhatsApp template, image/audio/video/file or up to 3 buttons, on any channel. With `Customer ID` it goes out through a channel one of your customers connected. Each send carries an idempotency key. |
| Message | **Mark as Read**: blue ticks on WhatsApp, "seen" on Instagram and Messenger. |
| Contact | **Create** and **Search** (name, phone or email). |
| Customer | **Create** and **Create Connection Link**: the link where your customer connects their WhatsApp, Instagram, Messenger or Gmail. |

Example: Trigger (`message:received`) → IF → heysteff (Send) with `To` = `{{$json.data.external_user_id}}` and `Channel` = `{{$json.data.channel}}`.

## Development

```bash
pnpm --filter @heysteff/n8n-nodes-heysteff build   # dist/ with nodes and icons
```

Tests live in the monorepo at `packages/tests/src/n8n-nodes.test.ts`. The package has no runtime dependencies (an n8n requirement for verified nodes): signatures are checked with `node:crypto`.

## License

MIT
