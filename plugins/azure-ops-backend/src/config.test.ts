/*
 * Copyright 2026 The Backstage Authors
 *
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 *     http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 */

import { mockServices } from '@backstage/backend-test-utils';
import { readAzureOpsConfig } from './config';

describe('readAzureOpsConfig', () => {
  it('accepts and normalizes a complete local service principal', () => {
    expect(
      readAzureOpsConfig(
        mockServices.rootConfig({
          data: {
            azureOps: {
              servicePrincipal: {
                tenantId: ' 11111111-1111-1111-1111-111111111111 ',
                clientId: ' 22222222-2222-2222-2222-222222222222 ',
                clientSecret: ' local-development-secret ',
              },
            },
          },
        }),
      ).servicePrincipal,
    ).toEqual({
      tenantId: '11111111-1111-1111-1111-111111111111',
      clientId: '22222222-2222-2222-2222-222222222222',
      clientSecret: 'local-development-secret',
    });
  });

  it('rejects partial, empty, and invalid local service principals safely', () => {
    const readServicePrincipal = (
      servicePrincipal: Partial<
        Record<'tenantId' | 'clientId' | 'clientSecret', string>
      >,
    ) =>
      readAzureOpsConfig(
        mockServices.rootConfig({
          data: { azureOps: { servicePrincipal } },
        }),
      );

    for (const servicePrincipal of [
      { tenantId: '11111111-1111-1111-1111-111111111111' },
      { clientId: '22222222-2222-2222-2222-222222222222' },
      { clientSecret: 'secret-that-must-not-appear' },
      {
        tenantId: '11111111-1111-1111-1111-111111111111',
        clientId: '22222222-2222-2222-2222-222222222222',
      },
    ]) {
      expect(() => readServicePrincipal(servicePrincipal)).toThrow(
        /must define tenantId, clientId, and clientSecret together/,
      );
    }
    expect(() =>
      readServicePrincipal({
        tenantId: ' ',
        clientId: '22222222-2222-2222-2222-222222222222',
        clientSecret: 'secret-that-must-not-appear',
      }),
    ).toThrow(/must all be nonempty/);
    expect(() =>
      readServicePrincipal({
        tenantId: 'not-a-uuid',
        clientId: '22222222-2222-2222-2222-222222222222',
        clientSecret: 'secret-that-must-not-appear',
      }),
    ).toThrow(/tenantId must be a valid UUID/);
    expect(() =>
      readServicePrincipal({
        tenantId: '11111111-1111-1111-1111-111111111111',
        clientId: 'not-a-uuid',
        clientSecret: 'secret-that-must-not-appear',
      }),
    ).toThrow(/clientId must be a valid UUID/);

    const errorMessages = [
      {
        tenantId: ' ',
        clientId: '22222222-2222-2222-2222-222222222222',
        clientSecret: 'secret-that-must-not-appear',
      },
      {
        tenantId: 'not-a-uuid',
        clientId: '22222222-2222-2222-2222-222222222222',
        clientSecret: 'secret-that-must-not-appear',
      },
    ].map(servicePrincipal => {
      try {
        readServicePrincipal(servicePrincipal);
        return '';
      } catch (error) {
        return String(error);
      }
    });
    expect(errorMessages.join('\n')).not.toContain(
      'secret-that-must-not-appear',
    );
  });

  it('accepts a complete Foundry project configuration', () => {
    expect(
      readAzureOpsConfig(
        mockServices.rootConfig({
          data: {
            azureOps: {
              foundry: {
                projectEndpoint:
                  'https://ops.services.ai.azure.com/api/projects/operations',
                promptAgentName: 'azure-ops-analysis',
                managedIdentityClientId: '11111111-1111-1111-1111-111111111111',
              },
            },
          },
        }),
      ).foundry,
    ).toEqual({
      projectEndpoint:
        'https://ops.services.ai.azure.com/api/projects/operations',
      promptAgentName: 'azure-ops-analysis',
      managedIdentityClientId: '11111111-1111-1111-1111-111111111111',
    });
  });

  it('rejects partial and malformed Foundry configuration', () => {
    expect(() =>
      readAzureOpsConfig(
        mockServices.rootConfig({
          data: {
            azureOps: {
              foundry: {
                projectEndpoint:
                  'https://ops.services.ai.azure.com/api/projects/operations',
              },
            },
          },
        }),
      ),
    ).toThrow(/must be configured together/);
    expect(() =>
      readAzureOpsConfig(
        mockServices.rootConfig({
          data: {
            azureOps: {
              foundry: {
                projectEndpoint: 'http://example.com/project',
                promptAgentName: 'azure-ops-analysis',
              },
            },
          },
        }),
      ),
    ).toThrow(/must match https/);
  });

  it('requires a valid authenticated HTTPS orchestrator configuration', () => {
    const root = (orchestrator: Record<string, string | string[]>) =>
      mockServices.rootConfig({
        data: { azureOps: { orchestrator } },
      });
    expect(
      readAzureOpsConfig(
        root({
          endpoint: 'https://orchestrator.example.com/api/dispatch',
          audience: 'api://azure-ops-orchestrator',
          managedIdentityClientId: '11111111-1111-1111-1111-111111111111',
          callbackAllowedSubjects: ['external:azure-ops-orchestrator'],
        }),
      ),
    ).toMatchObject({
      orchestratorEndpoint: 'https://orchestrator.example.com/api/dispatch',
      orchestratorAudience: 'api://azure-ops-orchestrator',
      orchestratorManagedIdentityClientId:
        '11111111-1111-1111-1111-111111111111',
      orchestratorCallbackAllowedSubjects: ['external:azure-ops-orchestrator'],
    });
    expect(() =>
      readAzureOpsConfig(
        root({ endpoint: 'https://orchestrator.example.com/dispatch' }),
      ),
    ).toThrow(/must be configured together/);
    expect(() =>
      readAzureOpsConfig(
        root({
          endpoint: 'http://orchestrator.example.com/dispatch',
          audience: 'api://azure-ops-orchestrator',
          callbackAllowedSubjects: ['external:azure-ops-orchestrator'],
        }),
      ),
    ).toThrow(/valid HTTPS URL/);
    expect(() =>
      readAzureOpsConfig(
        root({
          endpoint: 'https://orchestrator.example.com/dispatch',
          audience: 'api://azure-ops-orchestrator/.default',
          callbackAllowedSubjects: ['external:azure-ops-orchestrator'],
        }),
      ),
    ).toThrow(/audience/);
  });

  it('rejects enabled configuration without an allowlist', () => {
    expect(() =>
      readAzureOpsConfig(
        mockServices.rootConfig({
          data: { azureOps: { enabled: true, subscriptions: [] } },
        }),
      ),
    ).toThrow(/subscriptions is empty/);
  });

  it('normalizes bounded endpoint-specific service subject allowlists', () => {
    expect(
      readAzureOpsConfig(
        mockServices.rootConfig({
          data: {
            azureOps: {
              ingress: {
                azureMonitor: {
                  allowedSubjects: [' external:azure-monitor-ingress '],
                },
              },
            },
          },
        }),
      ).azureMonitorAllowedSubjects,
    ).toEqual(['external:azure-monitor-ingress']);
    expect(
      readAzureOpsConfig(mockServices.rootConfig({ data: {} })),
    ).toMatchObject({
      azureMonitorAllowedSubjects: [],
      orchestratorCallbackAllowedSubjects: [],
    });
    expect(() =>
      readAzureOpsConfig(
        mockServices.rootConfig({
          data: {
            azureOps: {
              ingress: { azureMonitor: { allowedSubjects: [] } },
            },
          },
        }),
      ),
    ).toThrow(/between 1 and 50/);
    expect(() =>
      readAzureOpsConfig(
        mockServices.rootConfig({
          data: {
            azureOps: {
              orchestrator: {
                endpoint: 'https://orchestrator.example.com/dispatch',
                audience: 'api://azure-ops-orchestrator',
              },
            },
          },
        }),
      ),
    ).toThrow(/callbackAllowedSubjects must be configured/);
  });
});
