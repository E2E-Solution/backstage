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

import { parseEntityRef, stringifyEntityRef } from '@backstage/catalog-model';
import type { Config } from '@backstage/config';
import type { BackstageUserPrincipal } from '@backstage/backend-plugin-api';
import {
  AuthorizeResult,
  type PolicyDecision,
} from '@backstage/plugin-permission-common';
import {
  type PermissionPolicy,
  type PolicyQuery,
  type PolicyQueryUser,
} from '@backstage/plugin-permission-node';

type AzureOpsRoles = {
  readers: ReadonlySet<string>;
  operators: ReadonlySet<string>;
  approvers: ReadonlySet<string>;
  auditors: ReadonlySet<string>;
};

const operatorPermissions = new Set([
  'azureOps.propose',
  'azureOps.requestApproval',
  'azureOps.cancel',
  'azureOps.execute',
]);

function normalizeEntityRef(ref: string): string {
  return stringifyEntityRef(parseEntityRef(ref));
}

function readRole(config: Config, role: string): ReadonlySet<string> {
  return new Set(
    (config.getOptionalStringArray(`azureOps.authorization.${role}`) ?? []).map(
      normalizeEntityRef,
    ),
  );
}

function decision(result: AuthorizeResult.ALLOW | AuthorizeResult.DENY) {
  return { result };
}

function isUserPrincipal(
  principal: unknown,
): principal is BackstageUserPrincipal {
  return (
    typeof principal === 'object' &&
    principal !== null &&
    'type' in principal &&
    principal.type === 'user'
  );
}

export class AzureOpsPermissionPolicy implements PermissionPolicy {
  static fromConfig(config: Config): AzureOpsPermissionPolicy {
    return new AzureOpsPermissionPolicy({
      readers: readRole(config, 'readers'),
      operators: readRole(config, 'operators'),
      approvers: readRole(config, 'approvers'),
      auditors: readRole(config, 'auditors'),
    });
  }

  private constructor(private readonly roles: AzureOpsRoles) {}

  async handle(
    request: PolicyQuery,
    user?: PolicyQueryUser,
  ): Promise<PolicyDecision> {
    const permissionName = request.permission.name;
    if (!permissionName.startsWith('azureOps.')) {
      return decision(AuthorizeResult.ALLOW);
    }

    if (!user || !isUserPrincipal(user.credentials.principal)) {
      return decision(AuthorizeResult.DENY);
    }

    const ownershipEntityRefs = new Set(
      user.info.ownershipEntityRefs.map(ref => ref.toLocaleLowerCase('en-US')),
    );
    const hasRole = (role: ReadonlySet<string>) => {
      for (const ref of role) {
        if (ownershipEntityRefs.has(ref)) {
          return true;
        }
      }
      return false;
    };

    if (permissionName === 'azureOps.read') {
      return decision(
        hasRole(this.roles.readers) ||
          hasRole(this.roles.operators) ||
          hasRole(this.roles.approvers) ||
          hasRole(this.roles.auditors)
          ? AuthorizeResult.ALLOW
          : AuthorizeResult.DENY,
      );
    }

    if (operatorPermissions.has(permissionName)) {
      return decision(
        hasRole(this.roles.operators)
          ? AuthorizeResult.ALLOW
          : AuthorizeResult.DENY,
      );
    }

    if (permissionName === 'azureOps.approve') {
      return decision(
        hasRole(this.roles.approvers)
          ? AuthorizeResult.ALLOW
          : AuthorizeResult.DENY,
      );
    }

    if (permissionName === 'azureOps.audit') {
      return decision(
        hasRole(this.roles.auditors) || hasRole(this.roles.approvers)
          ? AuthorizeResult.ALLOW
          : AuthorizeResult.DENY,
      );
    }

    return decision(AuthorizeResult.DENY);
  }
}
