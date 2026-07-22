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

import { createPermission } from '@backstage/plugin-permission-common';

/** @public */
export const azureOpsReadPermission = createPermission({
  name: 'azureOps.read',
  attributes: { action: 'read' },
});

/** @public */
export const azureOpsProposePermission = createPermission({
  name: 'azureOps.propose',
  attributes: { action: 'create' },
});

/** @public */
export const azureOpsRequestApprovalPermission = createPermission({
  name: 'azureOps.requestApproval',
  attributes: { action: 'create' },
});

/** @public */
export const azureOpsApprovePermission = createPermission({
  name: 'azureOps.approve',
  attributes: { action: 'update' },
});

/** @public */
export const azureOpsCancelPermission = createPermission({
  name: 'azureOps.cancel',
  attributes: { action: 'update' },
});

/** @public */
export const azureOpsExecutePermission = createPermission({
  name: 'azureOps.execute',
  attributes: { action: 'create' },
});

/** @public */
export const azureOpsAuditPermission = createPermission({
  name: 'azureOps.audit',
  attributes: { action: 'read' },
});

/** @public */
export const azureOpsPermissions = [
  azureOpsReadPermission,
  azureOpsProposePermission,
  azureOpsRequestApprovalPermission,
  azureOpsApprovePermission,
  azureOpsCancelPermission,
  azureOpsExecutePermission,
  azureOpsAuditPermission,
];
