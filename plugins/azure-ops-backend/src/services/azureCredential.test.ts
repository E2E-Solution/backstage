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

import {
  ClientSecretCredential,
  DefaultAzureCredential,
  ManagedIdentityCredential,
} from '@azure/identity';
import { createAzureCredential } from './azureCredential';

const servicePrincipal = {
  tenantId: '11111111-1111-1111-1111-111111111111',
  clientId: '22222222-2222-2222-2222-222222222222',
  clientSecret: 'local-development-secret',
};

describe('createAzureCredential', () => {
  it('always uses managed identity in production', () => {
    expect(
      createAzureCredential({
        production: true,
        managedIdentityClientId: '33333333-3333-3333-3333-333333333333',
        servicePrincipal,
      }),
    ).toBeInstanceOf(ManagedIdentityCredential);
  });

  it('uses an explicit service principal outside production', () => {
    expect(
      createAzureCredential({
        production: false,
        servicePrincipal,
      }),
    ).toBeInstanceOf(ClientSecretCredential);
  });

  it('falls back to the default credential outside production', () => {
    expect(
      createAzureCredential({
        production: false,
      }),
    ).toBeInstanceOf(DefaultAzureCredential);
  });
});
