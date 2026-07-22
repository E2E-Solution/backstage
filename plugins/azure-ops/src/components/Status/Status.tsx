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
  Progress,
  ResponseErrorPanel,
  Table,
  TableColumn,
  WarningPanel,
} from '@backstage/core-components';
import type {
  AzureIncident,
  AzureInventoryResource,
  AzureOperationalHealth,
} from '@internal/backstage-plugin-azure-ops-common';
import Button from '@material-ui/core/Button';
import FormControl from '@material-ui/core/FormControl';
import Grid from '@material-ui/core/Grid';
import InputLabel from '@material-ui/core/InputLabel';
import MenuItem from '@material-ui/core/MenuItem';
import Paper from '@material-ui/core/Paper';
import Select from '@material-ui/core/Select';
import TextField from '@material-ui/core/TextField';
import Typography from '@material-ui/core/Typography';
import { FormEvent, useState } from 'react';
import useAsync from 'react-use/esm/useAsync';
import type { AzureOpsApi, AzureResourceFilters } from '../../api';
import { useAzureOpsApi } from '../../hooks/useAzureOpsApi';
import { SourceFreshnessTable } from '../common/SourceFreshnessTable';

const columns: TableColumn<AzureInventoryResource>[] = [
  { title: 'Resource', field: 'name' },
  { title: 'Type', field: 'type' },
  { title: 'Subscription', field: 'subscriptionId' },
  { title: 'Resource group', field: 'resourceGroup', emptyValue: '—' },
  { title: 'Location', field: 'location', emptyValue: '—' },
  {
    title: 'Provisioning / power',
    render: resource =>
      [resource.provisioningState, resource.powerState]
        .filter(Boolean)
        .join(' / ') || '—',
  },
  { title: 'Health', field: 'health' },
  {
    title: 'Observed',
    render: resource => new Date(resource.observedAt).toLocaleString(),
  },
];

const incidentColumns: TableColumn<AzureIncident>[] = [
  { title: 'Status', field: 'status' },
  { title: 'Severity', field: 'severity' },
  { title: 'Alert rule', field: 'alertRule' },
  { title: 'Signal', field: 'signalType' },
  { title: 'Monitoring service', field: 'monitoringService' },
  {
    title: 'Affected resources',
    render: incident => (
      <ul style={{ margin: 0, paddingLeft: 16 }}>
        {incident.affectedResourceIds.map(resourceId => (
          <li key={resourceId}>{resourceId}</li>
        ))}
      </ul>
    ),
  },
  {
    title: 'Fired',
    render: incident => new Date(incident.firedAt).toLocaleString(),
  },
  {
    title: 'Resolved',
    render: incident =>
      incident.resolvedAt
        ? new Date(incident.resolvedAt).toLocaleString()
        : '—',
  },
  { title: 'Source', field: 'source' },
];

const initialFilters: AzureResourceFilters = { limit: 100 };

export function Status(props: { api?: AzureOpsApi }) {
  const defaultApi = useAzureOpsApi();
  const api = props.api ?? defaultApi;
  const [filters, setFilters] = useState(initialFilters);
  const [appliedFilters, setAppliedFilters] = useState(initialFilters);
  const result = useAsync(async () => {
    const [resources, summary, incidents] = await Promise.all([
      api.getResources(appliedFilters),
      api.getSummary(),
      api.getIncidents({ limit: 100 }),
    ]);
    return { resources, summary, incidents };
  }, [api, appliedFilters]);

  const submit = (event: FormEvent) => {
    event.preventDefault();
    setAppliedFilters({ ...filters });
  };

  return (
    <Grid container spacing={3}>
      <Grid item xs={12}>
        <Paper>
          <form onSubmit={submit} style={{ padding: 16 }}>
            <Grid container spacing={2} alignItems="flex-end">
              <Grid item xs={12} md={3}>
                <TextField
                  label="Subscription ID"
                  value={filters.subscription ?? ''}
                  onChange={event =>
                    setFilters(current => ({
                      ...current,
                      subscription: event.target.value || undefined,
                    }))
                  }
                  fullWidth
                />
              </Grid>
              <Grid item xs={12} md={3}>
                <TextField
                  label="Resource type"
                  value={filters.type ?? ''}
                  onChange={event =>
                    setFilters(current => ({
                      ...current,
                      type: event.target.value || undefined,
                    }))
                  }
                  fullWidth
                />
              </Grid>
              <Grid item xs={6} md={2}>
                <FormControl fullWidth>
                  <InputLabel id="health-filter-label">Health</InputLabel>
                  <Select
                    labelId="health-filter-label"
                    value={filters.health ?? ''}
                    onChange={event =>
                      setFilters(current => ({
                        ...current,
                        health:
                          (event.target.value as AzureOperationalHealth) ||
                          undefined,
                      }))
                    }
                  >
                    <MenuItem value="">All</MenuItem>
                    <MenuItem value="available">Available</MenuItem>
                    <MenuItem value="degraded">Degraded</MenuItem>
                    <MenuItem value="unavailable">Unavailable</MenuItem>
                    <MenuItem value="unknown">Unknown</MenuItem>
                  </Select>
                </FormControl>
              </Grid>
              <Grid item xs={6} md={2}>
                <FormControl fullWidth>
                  <InputLabel id="limit-filter-label">Limit</InputLabel>
                  <Select
                    labelId="limit-filter-label"
                    value={filters.limit}
                    onChange={event =>
                      setFilters(current => ({
                        ...current,
                        limit: Number(event.target.value),
                      }))
                    }
                  >
                    {[25, 100, 250, 500].map(limit => (
                      <MenuItem key={limit} value={limit}>
                        {limit}
                      </MenuItem>
                    ))}
                  </Select>
                </FormControl>
              </Grid>
              <Grid item xs={12} md={2}>
                <Button type="submit" variant="contained" color="primary">
                  Apply filters
                </Button>
              </Grid>
            </Grid>
          </form>
        </Paper>
      </Grid>
      {result.loading && (
        <Grid item xs={12}>
          <Progress />
        </Grid>
      )}
      {result.error && (
        <Grid item xs={12}>
          <ResponseErrorPanel error={result.error} />
        </Grid>
      )}
      {result.value && (
        <>
          <Grid item xs={12}>
            {result.value.incidents.length === 0 ? (
              <Paper style={{ padding: 16 }}>
                <Typography>
                  No Azure Monitor incidents have been received.
                </Typography>
              </Paper>
            ) : (
              <Table
                title={`Azure Monitor incidents (${result.value.incidents.length})`}
                columns={incidentColumns}
                data={result.value.incidents}
                options={{
                  pageSize: Math.min(result.value.incidents.length, 25),
                  pageSizeOptions: [10, 25, 50, 100],
                  padding: 'dense',
                }}
              />
            )}
          </Grid>
          {result.value.summary.sources.some(
            source => source.status !== 'fresh',
          ) && (
            <Grid item xs={12}>
              <WarningPanel title="Inventory freshness warning">
                One or more Azure sources are stale, partial, or unavailable.
                Inventory rows retain their observed timestamps.
              </WarningPanel>
            </Grid>
          )}
          <Grid item xs={12}>
            <SourceFreshnessTable
              title="Inventory source freshness"
              sources={result.value.summary.sources}
            />
          </Grid>
          <Grid item xs={12}>
            {result.value.resources.length === 0 ? (
              <Paper style={{ padding: 16 }}>
                <Typography>
                  No resources matched the selected filters. Review source
                  availability above before treating this as a healthy empty
                  result.
                </Typography>
              </Paper>
            ) : (
              <Table
                title={`Resource inventory (${result.value.resources.length})`}
                columns={columns}
                data={result.value.resources}
                options={{
                  pageSize: Math.min(appliedFilters.limit, 25),
                  pageSizeOptions: [10, 25, 50, 100],
                  padding: 'dense',
                }}
              />
            )}
          </Grid>
        </>
      )}
    </Grid>
  );
}
