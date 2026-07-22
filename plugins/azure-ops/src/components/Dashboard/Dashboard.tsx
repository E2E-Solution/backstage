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
  WarningPanel,
} from '@backstage/core-components';
import type { AzureOpsSummary } from '@internal/backstage-plugin-azure-ops-common';
import Grid from '@material-ui/core/Grid';
import Paper from '@material-ui/core/Paper';
import Typography from '@material-ui/core/Typography';
import { makeStyles } from '@material-ui/core/styles';
import useAsync from 'react-use/esm/useAsync';
import type { AzureOpsApi } from '../../api';
import { useAzureOpsApi } from '../../hooks/useAzureOpsApi';
import { SourceFreshnessTable } from '../common/SourceFreshnessTable';

const useStyles = makeStyles(theme => ({
  root: {
    display: 'grid',
    gap: theme.spacing(3),
  },
  card: {
    height: '100%',
    padding: theme.spacing(2),
  },
  value: {
    fontSize: '2rem',
    fontWeight: 600,
  },
}));

function KpiCard(props: {
  title: string;
  value: string | number;
  detail: string;
}) {
  const classes = useStyles();
  return (
    <Paper className={classes.card}>
      <Typography variant="subtitle1">{props.title}</Typography>
      <Typography className={classes.value}>{props.value}</Typography>
      <Typography variant="body2">{props.detail}</Typography>
    </Paper>
  );
}

export function DashboardContent({ summary }: { summary: AzureOpsSummary }) {
  const classes = useStyles();
  const assessedPolicies =
    summary.policy.compliant + summary.policy.nonCompliant;
  const compliance =
    assessedPolicies === 0
      ? 'Unavailable'
      : `${Math.round((summary.policy.compliant / assessedPolicies) * 100)}%`;
  const unavailableSources = summary.sources.filter(
    source => source.status !== 'fresh',
  );

  return (
    <div className={classes.root}>
      <WarningPanel title="Safety boundary">
        All Azure writes require an explicit approval. This dashboard and the
        status inventory are read-only.
      </WarningPanel>
      {unavailableSources.length > 0 && (
        <WarningPanel title="Azure data is incomplete or unavailable">
          {unavailableSources
            .map(
              source => `${source.source}: ${source.message ?? source.status}`,
            )
            .join('; ')}
        </WarningPanel>
      )}
      <Grid container spacing={3}>
        <Grid item xs={12} sm={6} lg={3}>
          <KpiCard
            title="Resources"
            value={summary.resources.total}
            detail={`${summary.resources.available} available · ${summary.resources.degraded} degraded · ${summary.resources.unavailable} unavailable · ${summary.resources.unknown} unknown`}
          />
        </Grid>
        <Grid item xs={12} sm={6} lg={3}>
          <KpiCard
            title="Active alerts"
            value={summary.alerts.active}
            detail={`${summary.alerts.critical} critical`}
          />
        </Grid>
        <Grid item xs={12} sm={6} lg={3}>
          <KpiCard
            title="Policy compliance"
            value={compliance}
            detail={`${summary.policy.compliant} compliant · ${summary.policy.nonCompliant} non-compliant · ${summary.policy.unknown} unknown`}
          />
        </Grid>
        <Grid item xs={12} sm={6} lg={3}>
          <KpiCard
            title="Advisor recommendations"
            value={summary.advisor.total}
            detail={`${summary.advisor.highImpact} high impact`}
          />
        </Grid>
      </Grid>
      <Typography variant="body2">
        Summary generated {new Date(summary.generatedAt).toLocaleString()}.
      </Typography>
      <SourceFreshnessTable sources={summary.sources} />
    </div>
  );
}

export function Dashboard(props: { api?: AzureOpsApi }) {
  const defaultApi = useAzureOpsApi();
  const api = props.api ?? defaultApi;
  const result = useAsync(() => api.getSummary(), [api]);

  if (result.loading) {
    return <Progress />;
  }
  if (result.error) {
    return <ResponseErrorPanel error={result.error} />;
  }
  if (!result.value) {
    return null;
  }
  return <DashboardContent summary={result.value} />;
}
