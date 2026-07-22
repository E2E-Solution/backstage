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
  StatusError,
  StatusOK,
  StatusWarning,
  Table,
  TableColumn,
} from '@backstage/core-components';
import type { AzureSourceFreshness } from '@internal/backstage-plugin-azure-ops-common';
import Typography from '@material-ui/core/Typography';

function SourceStatus({ source }: { source: AzureSourceFreshness }) {
  if (source.status === 'fresh') {
    return (
      <Typography component="span">
        <StatusOK /> Fresh
      </Typography>
    );
  }
  if (source.status === 'unavailable') {
    return (
      <Typography component="span">
        <StatusError /> Unavailable
      </Typography>
    );
  }
  return (
    <Typography component="span">
      <StatusWarning /> {source.status === 'stale' ? 'Stale' : 'Partial'}
    </Typography>
  );
}

const columns: TableColumn<AzureSourceFreshness>[] = [
  { title: 'Source', field: 'source' },
  {
    title: 'Status',
    render: source => <SourceStatus source={source} />,
  },
  {
    title: 'Observed',
    render: source => new Date(source.observedAt).toLocaleString(),
  },
  { title: 'Details', field: 'message', emptyValue: '—' },
];

export function SourceFreshnessTable(props: {
  sources: AzureSourceFreshness[];
  title?: string;
}) {
  return (
    <Table
      title={props.title ?? 'Source freshness'}
      columns={columns}
      data={props.sources}
      options={{ paging: false, search: false, padding: 'dense' }}
    />
  );
}
