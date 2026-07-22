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

import { mockCredentials, mockServices } from '@backstage/backend-test-utils';
import {
  AuthorizeResult,
  createPermission,
} from '@backstage/plugin-permission-common';
import type { PolicyQueryUser } from '@backstage/plugin-permission-node';
import { AzureOpsPermissionPolicy } from './policy';

const roleRefs = {
  reader: 'group:default/readers',
  operator: 'group:default/operators',
  approver: 'group:default/approvers',
  auditor: 'group:default/auditors',
};

const policy = AzureOpsPermissionPolicy.fromConfig(
  mockServices.rootConfig({
    data: {
      azureOps: {
        authorization: {
          readers: ['Group:Default/Readers'],
          operators: [roleRefs.operator],
          approvers: [roleRefs.approver],
          auditors: [roleRefs.auditor],
        },
      },
    },
  }),
);

function permission(name: string) {
  return createPermission({ name, attributes: {} });
}

function user(...ownershipEntityRefs: string[]): PolicyQueryUser {
  return {
    credentials: mockCredentials.user('user:default/test'),
    info: {
      userEntityRef: 'user:default/test',
      ownershipEntityRefs,
    },
  };
}

async function authorize(name: string, identity?: PolicyQueryUser) {
  return policy.handle({ permission: permission(name) }, identity);
}

describe('AzureOpsPermissionPolicy', () => {
  it.each([
    {
      role: 'reader',
      entityRef: 'GROUP:DEFAULT/READERS',
      allowed: ['azureOps.read'],
    },
    {
      role: 'operator',
      entityRef: roleRefs.operator,
      allowed: [
        'azureOps.read',
        'azureOps.propose',
        'azureOps.requestApproval',
        'azureOps.cancel',
        'azureOps.execute',
      ],
    },
    {
      role: 'approver',
      entityRef: roleRefs.approver,
      allowed: ['azureOps.read', 'azureOps.approve', 'azureOps.audit'],
    },
    {
      role: 'auditor',
      entityRef: roleRefs.auditor,
      allowed: ['azureOps.read', 'azureOps.audit'],
    },
  ])('enforces the $role role', async ({ entityRef, allowed }) => {
    const allPermissions = [
      'azureOps.read',
      'azureOps.propose',
      'azureOps.requestApproval',
      'azureOps.cancel',
      'azureOps.execute',
      'azureOps.approve',
      'azureOps.audit',
    ];

    for (const name of allPermissions) {
      await expect(authorize(name, user(entityRef))).resolves.toEqual({
        result: allowed.includes(name)
          ? AuthorizeResult.ALLOW
          : AuthorizeResult.DENY,
      });
    }
  });

  it('denies unknown Azure Ops permissions', async () => {
    await expect(
      authorize('azureOps.unregistered', user(roleRefs.operator)),
    ).resolves.toEqual({ result: AuthorizeResult.DENY });
  });

  it('denies Azure Ops permissions to anonymous and non-user identities', async () => {
    const serviceIdentity: PolicyQueryUser = {
      credentials: mockCredentials.service(),
      info: {
        userEntityRef: 'user:default/service',
        ownershipEntityRefs: [roleRefs.approver],
      },
    };

    await expect(authorize('azureOps.read')).resolves.toEqual({
      result: AuthorizeResult.DENY,
    });
    await expect(
      authorize('azureOps.approve', serviceIdentity),
    ).resolves.toEqual({ result: AuthorizeResult.DENY });
  });

  it('allows unrelated Backstage permissions', async () => {
    await expect(authorize('catalog.entity.read')).resolves.toEqual({
      result: AuthorizeResult.ALLOW,
    });
  });
});
