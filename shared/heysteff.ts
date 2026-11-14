import { createHmac, timingSafeEqual } from 'node:crypto';

/**
 * Lógica de los nodos sin dependencias de n8n en tiempo de ejecución: armar
 * los cuerpos de la API y verificar la firma de un aviso. Los nodos de la
 * comunidad de n8n no deben traer dependencias propias, así que la firma se
 * verifica con `node:crypto` con el mismo algoritmo que `verifyWebhook` de
 * `@heysteff/sdk` (las pruebas comparan las dos).
 */

export const DEFAULT_BASE_URL = 'https://app.heysteff.com/api';
export const SIGNATURE_HEADER = 'x-heysteff-signature';
export const TIMESTAMP_HEADER = 'x-heysteff-timestamp';
export const DEFAULT_TOLERANCE_SECONDS = 300;

/** Canales por los que la API escribe. */
export const SEND_CHANNELS = [
  { name: 'WhatsApp (Cloud API)', value: 'whatsapp_cloud' },
  { name: 'WhatsApp (QR)', value: 'whatsapp_baileys' },
  { name: 'Instagram', value: 'instagram' },
  { name: 'Messenger', value: 'facebook' },
  { name: 'SMS', value: 'sms' },
  { name: 'Gmail', value: 'gmail' },
] as const;

/** Canales que un cliente conecta con un link de conexión. */
export const SETUP_LINK_CHANNELS = ['whatsapp_cloud', 'instagram', 'facebook', 'gmail'] as const;

/**
 * Eventos a los que se puede suscribir un webhook (`POST /v1/webhooks`). Es
 * `OUTBOUND_WEBHOOK_EVENT_TYPES` del servidor sin `message.received` ni
 * `message.sent`, que existen en el catálogo pero no se publican (los avisos
 * de mensajes son `message:received` y `message:sent`). Una prueba lo compara.
 */
export const WEBHOOK_EVENTS = [
  'message:received',
  'message:sent',
  'conversation:escalated',
  'conversation:closed',
  'contact:created',
  'message.delivered',
  'message.read',
  'message.failed',
  'conversation.escalated',
  'conversation.urgent',
  'conversation.closed',
  'contact.created',
  'channel.error',
  'channel.connected',
  'cart.abandoned',
  'cart.recovered',
  'purchase.completed',
  'campaign.completed',
  'campaign.failed',
  'contact_mission.updated',
  'contact_link.proposed',
  'flow.completed',
  'flow.declined',
  'charge.requested',
  'payment.link_created',
  'payment.link_viewed',
  'payment.paid',
  'payment.failed',
  'payment.expired',
  'payment.refunded',
  'payment.refund_failed',
  'sale.stage_changed',
  'conversion.attributed',
  'appointment.booked',
  'appointment.cancelled',
  'appointment.rescheduled',
  'appointment.reminder',
  'appointment.no_show',
  'appointment.completed',
  'facebook.lead_received',
  'instagram.mention_received',
  'order.fulfilled',
  'order.cancelled',
  'order.refunded',
  'order.confirmed',
  'order.out_for_delivery',
  'order.delivered',
  'order.preorder',
  'repurchase.due',
  'occasion.due',
  'occasion.question',
  'back_in_stock.restocked',
  'back_in_stock.demand',
  'agent.paused_unanswered',
  'agent.replied',
  'agent.handoff',
  'agent.failed',
  'booking.quoted',
  'booking.quote_needs_review',
  'booking.held',
  'booking.confirmed',
  'booking.cancelled',
  'booking.hold_expired',
  'booking.hold_needs_team',
  'booking.confirmation_not_sent',
  'lead.qualified',
  'lead.disqualified',
  'flow.abandoned',
  'flow.abandoned_problem',
  'contact_list.updated',
  'touchpoint.due',
  'touchpoint.sent',
  'touchpoint.skipped',
  'touchpoint.pending',
  'touchpoint.digest',
  'plan.usage_threshold',
  'reviews.overage_paused',
  'sms.notice',
  'product.question_received',
  'review.rescue_opened',
  'insights.alert',
  'insights.digest',
  'insights.pulse',
  'insight.detected',
  'shipment.in_transit',
  'shipment.out_for_delivery',
  'shipment.ready_for_pickup',
  'shipment.delivered',
  'shipment.delivery_issue',
  'customer.channel_connected',
  // Ciclo de vida (migración 342): solo webhooks.
  'conversation.created',
  'conversation.inactive',
  'conversation.ended',
  'conversation.assigned',
  'conversation.bot_toggled',
  'contact.updated',
  'contact.opted_out',
  'contact.opted_in',
  'channel.disconnected',
  'channel.reconnected',
  'channel.restricted',
  'webhook.paused',
] as const;

export type HeaderBag = Record<string, string | string[] | undefined>;

export type SignatureCheck =
  | { ok: true; event: Record<string, unknown> }
  | { ok: false; reason: 'missing_header' | 'timestamp_out_of_range' | 'bad_signature' | 'invalid_json' };

function header(headers: HeaderBag, name: string): string | undefined {
  const key = Object.keys(headers).find((k) => k.toLowerCase() === name);
  const value = key ? headers[key] : undefined;
  return Array.isArray(value) ? value[0] : value;
}

/**
 * Verifica `X-Heysteff-Signature: v1=<hex>` = HMAC-SHA256 de
 * `${timestamp}.${cuerpo crudo}` con el secreto del webhook, y que
 * `X-Heysteff-Timestamp` no tenga más de `toleranceSeconds` de diferencia.
 */
export function verifySignature(args: {
  rawBody: string | Buffer;
  headers: HeaderBag;
  secret: string;
  toleranceSeconds?: number;
  now?: Date;
}): SignatureCheck {
  const signature = header(args.headers, SIGNATURE_HEADER);
  const timestamp = header(args.headers, TIMESTAMP_HEADER);
  if (!signature || !timestamp) return { ok: false, reason: 'missing_header' };
  const ts = Number(timestamp);
  const now = Math.floor((args.now ?? new Date()).getTime() / 1000);
  if (!Number.isFinite(ts) || Math.abs(now - ts) > (args.toleranceSeconds ?? DEFAULT_TOLERANCE_SECONDS)) {
    return { ok: false, reason: 'timestamp_out_of_range' };
  }
  const body = typeof args.rawBody === 'string' ? args.rawBody : args.rawBody.toString('utf8');
  const expected = Buffer.from(`v1=${createHmac('sha256', args.secret).update(`${timestamp}.${body}`).digest('hex')}`);
  const matches = signature
    .split(',')
    .map((s) => s.trim())
    .some((candidate) => {
      const got = Buffer.from(candidate);
      return got.length === expected.length && timingSafeEqual(got, expected);
    });
  if (!matches) return { ok: false, reason: 'bad_signature' };
  try {
    return { ok: true, event: JSON.parse(body) as Record<string, unknown> };
  } catch {
    return { ok: false, reason: 'invalid_json' };
  }
}

export type MessageKind = 'text' | 'template' | 'media' | 'buttons';

export interface SendMessageInput {
  channel: string;
  to?: string;
  customerId?: string;
  channelConnectionId?: string;
  kind: MessageKind;
  text?: string;
  templateName?: string;
  templateLanguage?: string;
  /** Valores de `{{1}}`, `{{2}}`… separados por coma o en una lista. */
  templateParams?: string | string[];
  mediaUrl?: string;
  mediaType?: 'image' | 'audio' | 'video' | 'file';
  filename?: string;
  /** `id|título` por línea, o una lista de objetos. */
  buttons?: string | { id: string; title: string }[];
}

/**
 * El cuerpo de `POST /v1/messages` para un mensaje del nodo. Lanza un Error
 * con el campo que falta (en inglés: es lo que muestra la interfaz de n8n).
 */
export function buildSendMessageBody(input: SendMessageInput): Record<string, unknown> {
  const body: Record<string, unknown> = { channel: input.channel };
  if (input.to) body['to'] = input.to;
  if (input.customerId) body['customer_id'] = input.customerId;
  if (input.channelConnectionId) body['channel_connection_id'] = input.channelConnectionId;
  if (!input.to) throw new Error('Missing the recipient (To).');

  switch (input.kind) {
    case 'text':
      if (!input.text?.trim()) throw new Error('Missing the message text.');
      body['content'] = input.text;
      break;
    case 'template': {
      if (!input.templateName || !input.templateLanguage) throw new Error('Missing the template name and language.');
      const params = splitList(input.templateParams);
      body['content_type'] = 'template';
      body['template'] = {
        name: input.templateName,
        language: input.templateLanguage,
        ...(params.length ? { body_params: params } : {}),
      };
      break;
    }
    case 'media':
      if (!input.mediaUrl) throw new Error('Missing the file URL.');
      body['content_type'] = input.mediaType ?? 'image';
      body['media'] = { url: input.mediaUrl, ...(input.filename ? { filename: input.filename } : {}) };
      if (input.text?.trim()) body['content'] = input.text;
      break;
    case 'buttons': {
      const buttons = parseButtons(input.buttons);
      if (!input.text?.trim()) throw new Error('Missing the text shown with the buttons.');
      if (buttons.length === 0 || buttons.length > 3) throw new Error('Use 1 to 3 buttons (one id|title per line).');
      body['content_type'] = 'interactive';
      body['content'] = input.text;
      body['interactive'] = { type: 'buttons', body: input.text, buttons };
      break;
    }
  }
  return body;
}

export function splitList(value: string | string[] | undefined): string[] {
  if (Array.isArray(value)) return value.map(String).filter((v) => v !== '');
  if (!value) return [];
  return value.split(',').map((v) => v.trim()).filter(Boolean);
}

export function parseButtons(value: SendMessageInput['buttons']): { id: string; title: string }[] {
  if (Array.isArray(value)) return value.filter((b) => b.id && b.title);
  if (!value) return [];
  return value
    .split('\n')
    .map((line) => line.trim())
    .filter(Boolean)
    .map((line) => {
      const idx = line.indexOf('|');
      return idx > 0 ? { id: line.slice(0, idx).trim(), title: line.slice(idx + 1).trim() } : { id: line, title: line };
    });
}

export interface CreateContactInput {
  name?: string;
  phone?: string;
  phoneCountry?: string;
  email?: string;
  tags?: string | string[];
}

export function buildCreateContactBody(input: CreateContactInput): Record<string, unknown> {
  const body: Record<string, unknown> = {};
  if (input.name) body['name'] = input.name;
  if (input.phone) body['phone'] = input.phone;
  if (input.phoneCountry) body['phone_country'] = input.phoneCountry.toUpperCase();
  if (input.email) body['email'] = input.email;
  const tags = splitList(input.tags);
  if (tags.length) body['tags'] = tags;
  if (!body['name'] && !body['phone'] && !body['email']) throw new Error('A contact needs a name, phone or email.');
  return body;
}

export interface SetupLinkInput {
  allowedChannels?: string[];
  expiresInHours?: number;
  successRedirectUrl?: string;
  failureRedirectUrl?: string;
  brandName?: string;
}

export function buildSetupLinkBody(input: SetupLinkInput): Record<string, unknown> {
  const body: Record<string, unknown> = {};
  if (input.allowedChannels?.length) body['allowed_channels'] = input.allowedChannels;
  if (input.expiresInHours) body['expires_in_hours'] = input.expiresInHours;
  if (input.successRedirectUrl) body['success_redirect_url'] = input.successRedirectUrl;
  if (input.failureRedirectUrl) body['failure_redirect_url'] = input.failureRedirectUrl;
  if (input.brandName) body['brand_name'] = input.brandName;
  return body;
}

/** URL de la API sin la barra final. */
export function apiBase(baseUrl: unknown): string {
  return (typeof baseUrl === 'string' && baseUrl ? baseUrl : DEFAULT_BASE_URL).replace(/\/+$/, '');
}
