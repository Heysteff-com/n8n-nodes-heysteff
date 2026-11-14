import {
  NodeConnectionTypes,
  type IDataObject,
  type IHookFunctions,
  type INodeType,
  type INodeTypeDescription,
  type IWebhookFunctions,
  type IWebhookResponseData,
} from 'n8n-workflow';
import { WEBHOOK_EVENTS, apiBase, verifySignature } from '../../shared/heysteff';

interface StaticData {
  webhookId?: string;
  webhookSecret?: string;
}

/**
 * Trigger: al activar el workflow crea su webhook en heysteff
 * (`POST /v1/webhooks`) con los eventos elegidos y guarda el secreto; al
 * desactivarlo lo borra. Cada aviso se verifica con la firma
 * `X-Heysteff-Signature` antes de entrar al workflow.
 */
export class HeysteffTrigger implements INodeType {
  description: INodeTypeDescription = {
    displayName: 'heysteff Trigger',
    name: 'heysteffTrigger',
    icon: 'file:heysteff.svg',
    group: ['trigger'],
    version: 1,
    subtitle: '={{$parameter["events"].join(", ")}}',
    description: 'Starts the workflow on heysteff events: messages from WhatsApp, Instagram, Messenger, SMS and email, and more',
    defaults: { name: 'heysteff Trigger' },
    inputs: [],
    outputs: [NodeConnectionTypes.Main],
    credentials: [{ name: 'heysteffApi', required: true }],
    webhooks: [{ name: 'default', httpMethod: 'POST', responseMode: 'onReceived', path: 'webhook' }],
    properties: [
      {
        displayName: 'Events',
        name: 'events',
        type: 'multiOptions',
        required: true,
        default: ['message:received'],
        options: WEBHOOK_EVENTS.map((e) => ({ name: e, value: e })),
        description: 'Events that start the workflow. message:received is a new message on any channel.',
      },
      {
        displayName: 'Skip Conversations Taken by a Person',
        name: 'skipBotPaused',
        type: 'boolean',
        default: false,
        description:
          'Whether to ignore messages from conversations a team member took over (bot_paused). Turn it on when the workflow replies automatically.',
      },
    ],
  };

  webhookMethods = {
    default: {
      async checkExists(this: IHookFunctions): Promise<boolean> {
        const data = this.getWorkflowStaticData('node') as StaticData;
        if (!data.webhookId || !data.webhookSecret) return false;
        const url = this.getNodeWebhookUrl('default');
        const base = apiBase((await this.getCredentials('heysteffApi'))['baseUrl']);
        const res = (await this.helpers.httpRequestWithAuthentication.call(this, 'heysteffApi', {
          method: 'GET',
          url: `${base}/v1/webhooks`,
          json: true,
        })) as { data?: { id: string; url: string }[] };
        const found = res.data?.some((w) => w.id === data.webhookId && w.url === url) ?? false;
        if (!found) {
          delete data.webhookId;
          delete data.webhookSecret;
        }
        return found;
      },

      async create(this: IHookFunctions): Promise<boolean> {
        const url = this.getNodeWebhookUrl('default');
        const events = this.getNodeParameter('events', []) as string[];
        const base = apiBase((await this.getCredentials('heysteffApi'))['baseUrl']);
        const res = (await this.helpers.httpRequestWithAuthentication.call(this, 'heysteffApi', {
          method: 'POST',
          url: `${base}/v1/webhooks`,
          body: { url, events },
          json: true,
        })) as { data?: { id?: string; secret?: string } };
        if (!res.data?.id || !res.data.secret) return false;
        const data = this.getWorkflowStaticData('node') as StaticData;
        data.webhookId = res.data.id;
        data.webhookSecret = res.data.secret;
        return true;
      },

      async delete(this: IHookFunctions): Promise<boolean> {
        const data = this.getWorkflowStaticData('node') as StaticData;
        if (!data.webhookId) return true;
        const base = apiBase((await this.getCredentials('heysteffApi'))['baseUrl']);
        try {
          await this.helpers.httpRequestWithAuthentication.call(this, 'heysteffApi', {
            method: 'DELETE',
            url: `${base}/v1/webhooks/${encodeURIComponent(data.webhookId)}`,
            json: true,
          });
        } catch (err) {
          // Ya no existía (lo borraron desde el panel): igual se olvida.
          const status = (err as { httpCode?: string; statusCode?: number }).statusCode ?? Number((err as { httpCode?: string }).httpCode);
          if (status !== 404) return false;
        }
        delete data.webhookId;
        delete data.webhookSecret;
        return true;
      },
    },
  };

  async webhook(this: IWebhookFunctions): Promise<IWebhookResponseData> {
    const data = this.getWorkflowStaticData('node') as StaticData;
    const req = this.getRequestObject() as unknown as { rawBody?: Buffer; body?: unknown };
    const res = this.getResponseObject();
    const raw = req.rawBody ?? Buffer.from(JSON.stringify(req.body ?? {}));
    const check = data.webhookSecret
      ? verifySignature({ rawBody: raw, headers: this.getHeaderData() as Record<string, string | string[] | undefined>, secret: data.webhookSecret })
      : ({ ok: false, reason: 'bad_signature' } as const);
    if (!check.ok) {
      res.status(401).json({ error: { code: check.reason, message: 'Invalid heysteff signature' } });
      return { noWebhookResponse: true };
    }

    const event = check.event;
    const payload = (event['data'] ?? {}) as IDataObject;
    if (this.getNodeParameter('skipBotPaused', false) === true && payload['bot_paused'] === true) {
      return {};
    }
    return { workflowData: [this.helpers.returnJsonArray([event as IDataObject])] };
  }
}
