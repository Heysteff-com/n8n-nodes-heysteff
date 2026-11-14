import type { IAuthenticateGeneric, ICredentialTestRequest, ICredentialType, INodeProperties } from 'n8n-workflow';

/** API key de heysteff (`sk_live_…` o `sk_test_…`), del panel en developers.heysteff.com/console. */
export class HeysteffApi implements ICredentialType {
  name = 'heysteffApi';

  displayName = 'heysteff API';

  documentationUrl = 'https://developers.heysteff.com/docs/integraciones';

  icon = 'file:heysteff.svg' as const;

  properties: INodeProperties[] = [
    {
      displayName: 'API Key',
      name: 'apiKey',
      type: 'string',
      typeOptions: { password: true },
      default: '',
      required: true,
      description: 'Live (sk_live_…) or test (sk_test_…) key. Webhooks need a live key.',
    },
    {
      displayName: 'Base URL',
      name: 'baseUrl',
      type: 'string',
      default: 'https://app.heysteff.com/api',
      description: 'Change it only to point to another heysteff environment',
    },
  ];

  authenticate: IAuthenticateGeneric = {
    type: 'generic',
    properties: {
      headers: {
        Authorization: '=Bearer {{$credentials.apiKey}}',
      },
    },
  };

  test: ICredentialTestRequest = {
    request: {
      baseURL: '={{$credentials.baseUrl}}',
      url: '/v1/conversations',
      qs: { limit: 1 },
    },
  };
}
