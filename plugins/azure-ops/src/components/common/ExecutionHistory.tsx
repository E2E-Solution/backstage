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

import { Table, TableColumn } from '@backstage/core-components';
import type { AzureExecutionRecord } from '@internal/backstage-plugin-azure-ops-common';

const columns: TableColumn<AzureExecutionRecord>[] = [
  { title: 'Execution', field: 'id' },
  { title: 'Approval', field: 'approvalId' },
  { title: 'Status', field: 'status' },
  {
    title: 'Plan hash',
    render: execution => execution.planHash.slice(0, 12),
  },
  {
    title: 'Queued',
    render: execution => new Date(execution.queuedAt).toLocaleString(),
  },
  {
    title: 'Completed',
    render: execution =>
      execution.completedAt
        ? new Date(execution.completedAt).toLocaleString()
        : '—',
  },
  { title: 'Message', field: 'message', emptyValue: '—' },
];

export function ExecutionHistory(props: {
  executions: AzureExecutionRecord[];
}) {
  return (
    <Table
      title="Execution history"
      columns={columns}
      data={props.executions}
      emptyContent="No executions have been recorded."
      options={{
        pageSize: 10,
        pageSizeOptions: [10, 20, 50],
        padding: 'dense',
      }}
    />
  );
}
