import { randomUUID } from 'node:crypto';
import {
  NodeApiError,
  NodeConnectionTypes,
  NodeOperationError,
  type IDataObject,
  type IExecuteFunctions,
  type IHttpRequestMethods,
  type INodeExecutionData,
  type INodeType,
  type INodeTypeDescription,
  type JsonObject,
} from 'n8n-workflow';
import {
  SEND_CHANNELS,
  SETUP_LINK_CHANNELS,
  apiBase,
  buildCreateContactBody,
  buildSendMessageBody,
  buildSetupLinkBody,
  type MessageKind,
} from '../../shared/heysteff';

const show = (resource: string, operation: string[]) => ({ show: { resource: [resource], operation } });

/**
 * Nodo de acción: manda mensajes por cualquier canal con el mismo
 * `POST /v1/messages`, marca como leído, crea y busca contactos, y crea
 * clientes y sus links de conexión.
 */
export class Heysteff implements INodeType {
  description: INodeTypeDescription = {
    displayName: 'heysteff',
    name: 'heysteff',
    icon: 'file:heysteff.svg',
    group: ['output'],
    version: 1,
    subtitle: '={{$parameter["operation"] + ": " + $parameter["resource"]}}',
    description: 'Send WhatsApp, Instagram, Messenger, SMS and email messages with one API',
    defaults: { name: 'heysteff' },
    inputs: [NodeConnectionTypes.Main],
    outputs: [NodeConnectionTypes.Main],
    usableAsTool: true,
    credentials: [{ name: 'heysteffApi', required: true }],
    properties: [
      {
        displayName: 'Resource',
        name: 'resource',
        type: 'options',
        noDataExpression: true,
        default: 'message',
        options: [
          { name: 'Message', value: 'message' },
          { name: 'Contact', value: 'contact' },
          { name: 'Customer', value: 'customer' },
        ],
      },
      {
        displayName: 'Operation',
        name: 'operation',
        type: 'options',
        noDataExpression: true,
        displayOptions: { show: { resource: ['message'] } },
        default: 'send',
        options: [
          { name: 'Send', value: 'send', action: 'Send a message', description: 'Send text, a template, a file or buttons on any channel' },
          { name: 'Mark as Read', value: 'markRead', action: 'Mark a message as read', description: 'Blue ticks on WhatsApp, "seen" on Instagram and Messenger' },
        ],
      },
      {
        displayName: 'Operation',
        name: 'operation',
        type: 'options',
        noDataExpression: true,
        displayOptions: { show: { resource: ['contact'] } },
        default: 'create',
        options: [
          { name: 'Create', value: 'create', action: 'Create a contact' },
          { name: 'Search', value: 'search', action: 'Search contacts', description: 'Search by name, phone or email' },
        ],
      },
      {
        displayName: 'Operation',
        name: 'operation',
        type: 'options',
        noDataExpression: true,
        displayOptions: { show: { resource: ['customer'] } },
        default: 'createSetupLink',
        options: [
          { name: 'Create', value: 'create', action: 'Create a customer', description: 'A customer of your SaaS who connects their own channels' },
          {
            name: 'Create Connection Link',
            value: 'createSetupLink',
            action: 'Create a connection link',
            description: 'A link where your customer connects WhatsApp, Instagram, Messenger or Gmail',
          },
        ],
      },

      // ── message:send ─────────────────────────────────────────────────────
      {
        displayName: 'Channel',
        name: 'channel',
        type: 'options',
        default: 'whatsapp_cloud',
        options: SEND_CHANNELS.map((c) => ({ name: c.name, value: c.value })),
        displayOptions: show('message', ['send']),
      },
      {
        displayName: 'To',
        name: 'to',
        type: 'string',
        required: true,
        default: '',
        placeholder: '+56912345678',
        description: 'Phone in E.164, email, or the channel user ID (external_user_id from the trigger)',
        displayOptions: show('message', ['send']),
      },
      {
        displayName: 'Message Type',
        name: 'kind',
        type: 'options',
        default: 'text',
        options: [
          { name: 'Text', value: 'text' },
          { name: 'Template (WhatsApp)', value: 'template' },
          { name: 'Media', value: 'media' },
          { name: 'Buttons', value: 'buttons' },
        ],
        displayOptions: show('message', ['send']),
      },
      {
        displayName: 'Text',
        name: 'text',
        type: 'string',
        typeOptions: { rows: 3 },
        default: '',
        description: 'Message text. With media it is the caption; with buttons, the text above them.',
        displayOptions: { show: { resource: ['message'], operation: ['send'], kind: ['text', 'media', 'buttons'] } },
      },
      {
        displayName: 'Template Name',
        name: 'templateName',
        type: 'string',
        default: '',
        displayOptions: { show: { resource: ['message'], operation: ['send'], kind: ['template'] } },
      },
      {
        displayName: 'Template Language',
        name: 'templateLanguage',
        type: 'string',
        default: 'es',
        displayOptions: { show: { resource: ['message'], operation: ['send'], kind: ['template'] } },
      },
      {
        displayName: 'Template Variables',
        name: 'templateParams',
        type: 'string',
        default: '',
        placeholder: 'Ana, 1001',
        description: 'Values for {{1}}, {{2}}… separated by commas',
        displayOptions: { show: { resource: ['message'], operation: ['send'], kind: ['template'] } },
      },
      {
        displayName: 'Media URL',
        name: 'mediaUrl',
        type: 'string',
        default: '',
        description: 'Public https URL (heysteff downloads it) or the URL returned by the media upload API',
        displayOptions: { show: { resource: ['message'], operation: ['send'], kind: ['media'] } },
      },
      {
        displayName: 'Media Type',
        name: 'mediaType',
        type: 'options',
        default: 'image',
        options: [
          { name: 'Image', value: 'image' },
          { name: 'Video', value: 'video' },
          { name: 'Audio', value: 'audio' },
          { name: 'File', value: 'file' },
        ],
        displayOptions: { show: { resource: ['message'], operation: ['send'], kind: ['media'] } },
      },
      {
        displayName: 'Buttons',
        name: 'buttons',
        type: 'string',
        typeOptions: { rows: 3 },
        default: '',
        placeholder: 'yes|Yes, confirm\nno|No',
        description: 'One button per line as id|title (up to 3). The id comes back in interactive_reply.id.',
        displayOptions: { show: { resource: ['message'], operation: ['send'], kind: ['buttons'] } },
      },
      {
        displayName: 'Options',
        name: 'sendOptions',
        type: 'collection',
        placeholder: 'Add Option',
        default: {},
        displayOptions: show('message', ['send']),
        options: [
          {
            displayName: 'Channel Connection ID',
            name: 'channelConnectionId',
            type: 'string',
            default: '',
            description: 'Number or account to send from, when the workspace has several of the same channel',
          },
          {
            displayName: 'Customer ID',
            name: 'customerId',
            type: 'string',
            default: '',
            description: 'Send through the channel one of your customers connected with a connection link',
          },
          { displayName: 'Filename', name: 'filename', type: 'string', default: '' },
          {
            displayName: 'Idempotency Key',
            name: 'idempotencyKey',
            type: 'string',
            default: '',
            description: 'Repeating a send with the same key never sends it twice. Default: a new key per item.',
          },
        ],
      },

      // ── message:markRead ─────────────────────────────────────────────────
      {
        displayName: 'Message ID',
        name: 'messageId',
        type: 'string',
        required: true,
        default: '',
        description: 'heysteff message ID (data.message_id in the trigger)',
        displayOptions: show('message', ['markRead']),
      },

      // ── contact ──────────────────────────────────────────────────────────
      {
        displayName: 'Fields',
        name: 'contactFields',
        type: 'collection',
        placeholder: 'Add Field',
        default: {},
        displayOptions: show('contact', ['create']),
        options: [
          { displayName: 'Name', name: 'name', type: 'string', default: '' },
          { displayName: 'Phone', name: 'phone', type: 'string', default: '', placeholder: '+56912345678' },
          { displayName: 'Phone Country', name: 'phoneCountry', type: 'string', default: '', placeholder: 'CL', description: 'ISO country code to read a national-format phone' },
          { displayName: 'Email', name: 'email', type: 'string', placeholder: 'name@email.com', default: '' },
          { displayName: 'Tags', name: 'tags', type: 'string', default: '', description: 'Comma-separated' },
        ],
      },
      {
        displayName: 'Query',
        name: 'query',
        type: 'string',
        default: '',
        description: 'Name, phone or email',
        displayOptions: show('contact', ['search']),
      },
      {
        displayName: 'Limit',
        name: 'limit',
        type: 'number',
        typeOptions: { minValue: 1, maxValue: 200 },
        default: 50,
        description: 'Max number of results to return',
        displayOptions: show('contact', ['search']),
      },

      // ── customer ─────────────────────────────────────────────────────────
      {
        displayName: 'External ID',
        name: 'externalId',
        type: 'string',
        required: true,
        default: '',
        description: 'Your ID for this customer (unique in the workspace)',
        displayOptions: show('customer', ['create']),
      },
      {
        displayName: 'Name',
        name: 'customerName',
        type: 'string',
        required: true,
        default: '',
        displayOptions: show('customer', ['create']),
      },
      {
        displayName: 'Customer ID',
        name: 'customerId',
        type: 'string',
        required: true,
        default: '',
        description: 'heysteff ID of the customer (from Create)',
        displayOptions: show('customer', ['createSetupLink']),
      },
      {
        displayName: 'Options',
        name: 'linkOptions',
        type: 'collection',
        placeholder: 'Add Option',
        default: {},
        displayOptions: show('customer', ['createSetupLink']),
        options: [
          {
            displayName: 'Allowed Channels',
            name: 'allowedChannels',
            type: 'multiOptions',
            default: [],
            options: SETUP_LINK_CHANNELS.map((c) => ({ name: SEND_CHANNELS.find((s) => s.value === c)?.name ?? c, value: c })),
            description: 'Empty: all four',
          },
          { displayName: 'Expires In (Hours)', name: 'expiresInHours', type: 'number', typeOptions: { minValue: 1, maxValue: 720 }, default: 168 },
          { displayName: 'Success Redirect URL', name: 'successRedirectUrl', type: 'string', default: '' },
          { displayName: 'Failure Redirect URL', name: 'failureRedirectUrl', type: 'string', default: '' },
          { displayName: 'Brand Name', name: 'brandName', type: 'string', default: '', description: 'Name your customer sees on the page' },
        ],
      },
    ],
  };

  async execute(this: IExecuteFunctions): Promise<INodeExecutionData[][]> {
    const items = this.getInputData();
    const out: INodeExecutionData[] = [];
    const base = apiBase((await this.getCredentials('heysteffApi'))['baseUrl']);

    const call = async (method: IHttpRequestMethods, path: string, body?: IDataObject, qs?: IDataObject, headers?: IDataObject) => {
      try {
        return (await this.helpers.httpRequestWithAuthentication.call(this, 'heysteffApi', {
          method,
          url: `${base}${path}`,
          json: true,
          ...(body ? { body } : {}),
          ...(qs ? { qs } : {}),
          ...(headers ? { headers } : {}),
        })) as IDataObject;
      } catch (err) {
        throw new NodeApiError(this.getNode(), err as JsonObject);
      }
    };

    for (let i = 0; i < items.length; i++) {
      try {
        const resource = this.getNodeParameter('resource', i) as string;
        const operation = this.getNodeParameter('operation', i) as string;
        let result: IDataObject;

        if (resource === 'message' && operation === 'send') {
          const opts = this.getNodeParameter('sendOptions', i, {}) as IDataObject;
          const kind = this.getNodeParameter('kind', i) as MessageKind;
          const param = (name: string) => this.getNodeParameter(name, i, '') as string;
          let body: Record<string, unknown>;
          try {
            body = buildSendMessageBody({
              channel: param('channel'),
              to: param('to'),
              kind,
              text: kind === 'template' ? undefined : param('text'),
              templateName: kind === 'template' ? param('templateName') : undefined,
              templateLanguage: kind === 'template' ? param('templateLanguage') : undefined,
              templateParams: kind === 'template' ? param('templateParams') : undefined,
              mediaUrl: kind === 'media' ? param('mediaUrl') : undefined,
              mediaType: kind === 'media' ? (param('mediaType') as 'image') : undefined,
              buttons: kind === 'buttons' ? param('buttons') : undefined,
              filename: (opts['filename'] as string) || undefined,
              customerId: (opts['customerId'] as string) || undefined,
              channelConnectionId: (opts['channelConnectionId'] as string) || undefined,
            });
          } catch (err) {
            throw new NodeOperationError(this.getNode(), (err as Error).message, { itemIndex: i });
          }
          const key = (opts['idempotencyKey'] as string) || randomUUID();
          result = await call('POST', '/v1/messages', body as IDataObject, undefined, { 'Idempotency-Key': key });
        } else if (resource === 'message' && operation === 'markRead') {
          const id = this.getNodeParameter('messageId', i) as string;
          result = await call('POST', `/v1/messages/${encodeURIComponent(id)}/read`);
        } else if (resource === 'contact' && operation === 'create') {
          const fields = this.getNodeParameter('contactFields', i, {}) as IDataObject;
          let body: Record<string, unknown>;
          try {
            body = buildCreateContactBody(fields as Parameters<typeof buildCreateContactBody>[0]);
          } catch (err) {
            throw new NodeOperationError(this.getNode(), (err as Error).message, { itemIndex: i });
          }
          result = await call('POST', '/v1/contacts', body as IDataObject);
        } else if (resource === 'contact' && operation === 'search') {
          const q = this.getNodeParameter('query', i, '') as string;
          const limit = this.getNodeParameter('limit', i, 50) as number;
          const page = await call('GET', '/v1/contacts', undefined, { ...(q ? { q } : {}), limit });
          for (const contact of (page['data'] as IDataObject[] | undefined) ?? []) out.push({ json: contact, pairedItem: { item: i } });
          continue;
        } else if (resource === 'customer' && operation === 'create') {
          result = await call('POST', '/v1/customers', {
            external_id: this.getNodeParameter('externalId', i) as string,
            name: this.getNodeParameter('customerName', i) as string,
          });
        } else if (resource === 'customer' && operation === 'createSetupLink') {
          const id = this.getNodeParameter('customerId', i) as string;
          const opts = this.getNodeParameter('linkOptions', i, {}) as IDataObject;
          result = await call('POST', `/v1/customers/${encodeURIComponent(id)}/setup-links`, buildSetupLinkBody(opts) as IDataObject);
        } else {
          throw new NodeOperationError(this.getNode(), `Unknown operation ${resource}:${operation}`, { itemIndex: i });
        }

        out.push({ json: (result['data'] as IDataObject | undefined) ?? result, pairedItem: { item: i } });
      } catch (err) {
        if (this.continueOnFail()) {
          out.push({ json: { error: (err as Error).message }, pairedItem: { item: i } });
          continue;
        }
        throw err;
      }
    }
    return [out];
  }
}
