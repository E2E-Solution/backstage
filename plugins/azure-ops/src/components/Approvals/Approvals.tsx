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
} from '@backstage/core-components';
import type { AzureApprovalRequest } from '@internal/backstage-plugin-azure-ops-common';
import Button from '@material-ui/core/Button';
import Chip from '@material-ui/core/Chip';
import Dialog from '@material-ui/core/Dialog';
import DialogActions from '@material-ui/core/DialogActions';
import DialogContent from '@material-ui/core/DialogContent';
import DialogContentText from '@material-ui/core/DialogContentText';
import DialogTitle from '@material-ui/core/DialogTitle';
import Grid from '@material-ui/core/Grid';
import { useState } from 'react';
import useAsyncRetry from 'react-use/esm/useAsyncRetry';
import type { AzureOpsApi } from '../../api';
import { useAzureOpsApi } from '../../hooks/useAzureOpsApi';
import { ExecutionHistory } from '../common/ExecutionHistory';

type ApprovalAction = 'approve' | 'reject' | 'cancel' | 'execute';

function confirmationMessage(
  action: ApprovalAction,
  approval: AzureApprovalRequest,
): string {
  return `Confirm ${action} for ${approval.plan.templateId} on ${approval.plan.resourceId}. The plan risk is ${approval.plan.risk}.`;
}

export function Approvals(props: { api?: AzureOpsApi }) {
  const defaultApi = useAzureOpsApi();
  const api = props.api ?? defaultApi;
  const [actionError, setActionError] = useState<Error>();
  const [pendingAction, setPendingAction] = useState<string>();
  const [confirmation, setConfirmation] = useState<{
    approval: AzureApprovalRequest;
    action: ApprovalAction;
  }>();
  const result = useAsyncRetry(async () => {
    const [approvals, executions] = await Promise.all([
      api.getApprovals(),
      api.getExecutions(),
    ]);
    return { approvals, executions };
  }, [api]);

  const perform = async (
    approval: AzureApprovalRequest,
    action: ApprovalAction,
  ) => {
    setConfirmation(undefined);
    setActionError(undefined);
    setPendingAction(`${approval.id}:${action}`);
    try {
      if (action === 'execute') {
        await api.executeApproval(approval.id);
      } else {
        await api.decideApproval(approval.id, action);
      }
      result.retry();
    } catch (error) {
      setActionError(error instanceof Error ? error : new Error(String(error)));
    } finally {
      setPendingAction(undefined);
    }
  };

  const actions = (approval: AzureApprovalRequest) => {
    const pending = approval.status === 'pending';
    const approved = approval.status === 'approved';
    if (!pending && !approved) {
      return '—';
    }
    const button = (action: ApprovalAction, label: string) => (
      <Button
        key={action}
        size="small"
        color={
          action === 'reject' || action === 'cancel' ? 'secondary' : 'primary'
        }
        disabled={Boolean(pendingAction)}
        onClick={() => setConfirmation({ approval, action })}
        aria-label={`${label} ${approval.plan.templateId} for ${approval.plan.resourceId}`}
      >
        {pendingAction === `${approval.id}:${action}` ? 'Working…' : label}
      </Button>
    );
    return (
      <div>
        {pending && button('approve', 'Approve')}
        {pending && button('reject', 'Reject')}
        {button('cancel', 'Cancel')}
        {approved && button('execute', 'Execute')}
      </div>
    );
  };

  const columns: TableColumn<AzureApprovalRequest>[] = [
    { title: 'Template', render: approval => approval.plan.templateId },
    { title: 'Resource', render: approval => approval.plan.resourceId },
    {
      title: 'Risk',
      render: approval => (
        <Chip
          size="small"
          label={approval.plan.risk}
          color={
            approval.plan.risk === 'critical' || approval.plan.risk === 'high'
              ? 'secondary'
              : 'default'
          }
        />
      ),
    },
    { title: 'Requester', render: approval => approval.plan.requestedBy },
    { title: 'Status', field: 'status' },
    {
      title: 'Expires',
      render: approval => new Date(approval.plan.expiresAt).toLocaleString(),
    },
    {
      title: 'Plan hash',
      render: approval => approval.plan.hash.slice(0, 12),
    },
    { title: 'Actions', sorting: false, render: actions },
  ];

  if (result.loading) {
    return <Progress />;
  }
  if (result.error) {
    return <ResponseErrorPanel error={result.error} />;
  }

  return (
    <Grid container spacing={3}>
      {actionError && (
        <Grid item xs={12}>
          <ResponseErrorPanel error={actionError} />
        </Grid>
      )}
      <Grid item xs={12}>
        <Table
          title="Approval requests"
          columns={columns}
          data={result.value?.approvals ?? []}
          emptyContent="No approval requests have been submitted."
          options={{
            pageSize: 10,
            pageSizeOptions: [10, 20, 50],
            padding: 'dense',
          }}
        />
      </Grid>
      <Grid item xs={12}>
        <ExecutionHistory executions={result.value?.executions ?? []} />
      </Grid>
      <Dialog
        open={Boolean(confirmation)}
        onClose={() => setConfirmation(undefined)}
        aria-labelledby="approval-confirmation-title"
      >
        <DialogTitle id="approval-confirmation-title">
          Confirm approval action
        </DialogTitle>
        <DialogContent>
          <DialogContentText>
            {confirmation
              ? confirmationMessage(confirmation.action, confirmation.approval)
              : ''}
          </DialogContentText>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setConfirmation(undefined)}>Go back</Button>
          <Button
            color="primary"
            variant="contained"
            onClick={() =>
              confirmation &&
              perform(confirmation.approval, confirmation.action)
            }
          >
            Confirm {confirmation?.action}
          </Button>
        </DialogActions>
      </Dialog>
    </Grid>
  );
}
