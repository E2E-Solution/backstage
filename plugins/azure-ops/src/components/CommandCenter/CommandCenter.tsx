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
  InfoCard,
  Progress,
  ResponseErrorPanel,
  WarningPanel,
} from '@backstage/core-components';
import {
  AzureAnalysisResponse,
  AzureOperationPlan,
  AzureOperationTemplateId,
  parseAzureResourceId,
} from '@internal/backstage-plugin-azure-ops-common';
import Button from '@material-ui/core/Button';
import Dialog from '@material-ui/core/Dialog';
import DialogActions from '@material-ui/core/DialogActions';
import DialogContent from '@material-ui/core/DialogContent';
import DialogContentText from '@material-ui/core/DialogContentText';
import DialogTitle from '@material-ui/core/DialogTitle';
import FormControl from '@material-ui/core/FormControl';
import Grid from '@material-ui/core/Grid';
import InputLabel from '@material-ui/core/InputLabel';
import MenuItem from '@material-ui/core/MenuItem';
import Select from '@material-ui/core/Select';
import TextField from '@material-ui/core/TextField';
import Typography from '@material-ui/core/Typography';
import { FormEvent, useState } from 'react';
import useAsync from 'react-use/esm/useAsync';
import type { AzureOpsApi } from '../../api';
import { useAzureOpsApi } from '../../hooks/useAzureOpsApi';

export type ParametersParseResult =
  | { parameters: Record<string, unknown>; error?: never }
  | { parameters?: never; error: string };

export function parseOperationParameters(value: string): ParametersParseResult {
  try {
    const parsed: unknown = JSON.parse(value);
    if (
      typeof parsed !== 'object' ||
      parsed === null ||
      Array.isArray(parsed)
    ) {
      return { error: 'Parameters must be a JSON object.' };
    }
    return { parameters: parsed as Record<string, unknown> };
  } catch (error) {
    return {
      error: `Parameters are not valid JSON: ${
        error instanceof Error ? error.message : String(error)
      }`,
    };
  }
}

export function PlanDetails({ plan }: { plan: AzureOperationPlan }) {
  return (
    <InfoCard title="Deterministic operation plan">
      <Typography>
        <strong>Template:</strong> {plan.templateId} (version{' '}
        {plan.templateVersion})
      </Typography>
      <Typography>
        <strong>Resource:</strong> {plan.resourceId}
      </Typography>
      <Typography>
        <strong>Risk:</strong> {plan.risk}
      </Typography>
      <Typography>
        <strong>Parameters:</strong>{' '}
        <code>{JSON.stringify(plan.parameters)}</code>
      </Typography>
      <Typography component="h3" variant="subtitle1">
        Preconditions
      </Typography>
      <ol>
        {plan.preconditions.map(precondition => (
          <li key={precondition}>{precondition}</li>
        ))}
      </ol>
      <Typography component="h3" variant="subtitle1">
        Steps
      </Typography>
      <ol>
        {plan.steps.map(step => (
          <li key={step.sequence}>
            {step.description}: {step.action} on {step.resourceId}
            {step.expectedState
              ? `; expected state: ${step.expectedState}`
              : ''}
          </li>
        ))}
      </ol>
      <Typography>
        <strong>Rollback:</strong> {plan.rollback}
      </Typography>
      <Typography>
        <strong>Plan hash:</strong> <code>{plan.hash}</code>
      </Typography>
      <Typography>
        <strong>Expires:</strong> {new Date(plan.expiresAt).toLocaleString()}
      </Typography>
    </InfoCard>
  );
}

function RecommendationDetails({
  analysis,
}: {
  analysis: AzureAnalysisResponse;
}) {
  const evidenceById = new Map(
    analysis.evidence.items.map(item => [item.id, item]),
  );
  return (
    <InfoCard title="Foundry recommendation">
      <Typography>
        <strong>Summary:</strong> {analysis.recommendation.summary}
      </Typography>
      <Typography component="h3" variant="subtitle1">
        Hypotheses
      </Typography>
      <ul>
        {analysis.recommendation.hypotheses.map((hypothesis, index) => (
          <li key={`${hypothesis.text}-${index}`}>
            {hypothesis.text} ({Math.round(hypothesis.confidence * 100)}%
            confidence)
            <ul>
              {hypothesis.evidenceIds.map(id => (
                <li key={id}>
                  <strong>{id}</strong>: {evidenceById.get(id)?.title}
                </li>
              ))}
            </ul>
          </li>
        ))}
      </ul>
      <Typography>
        <strong>Suggested allowlisted templates:</strong>{' '}
        {analysis.recommendation.suggestedTemplateIds.join(', ') || 'None'}
      </Typography>
      <Typography component="h3" variant="subtitle1">
        Warnings
      </Typography>
      <ul>
        {analysis.recommendation.warnings.map(warning => (
          <li key={warning}>{warning}</li>
        ))}
      </ul>
      <Typography component="h3" variant="subtitle1">
        Evidence
      </Typography>
      <ul>
        {analysis.evidence.items.map(item => (
          <li key={item.id}>
            <strong>{item.id}</strong> · {item.title} · observed{' '}
            {new Date(item.observedAt).toLocaleString()}
            <br />
            {item.summary}
          </li>
        ))}
      </ul>
      <Typography variant="caption">
        Correlation ID: {analysis.correlationId}
      </Typography>
    </InfoCard>
  );
}

export function CommandCenter(props: { api?: AzureOpsApi }) {
  const defaultApi = useAzureOpsApi();
  const api = props.api ?? defaultApi;
  const templates = useAsync(() => api.getOperationTemplates(), [api]);
  const capabilities = useAsync(() => api.getCapabilities(), [api]);
  const [templateId, setTemplateId] = useState<AzureOperationTemplateId | ''>(
    '',
  );
  const [resourceId, setResourceId] = useState('');
  const [parametersText, setParametersText] = useState('{}');
  const [validationError, setValidationError] = useState<string>();
  const [requestError, setRequestError] = useState<Error>();
  const [plan, setPlan] = useState<AzureOperationPlan>();
  const [working, setWorking] = useState(false);
  const [approvalRequested, setApprovalRequested] = useState(false);
  const [approvalConfirmationOpen, setApprovalConfirmationOpen] =
    useState(false);
  const [analysisQuestion, setAnalysisQuestion] = useState('');
  const [analysisResourceIds, setAnalysisResourceIds] = useState('');
  const [analysisValidationError, setAnalysisValidationError] =
    useState<string>();
  const [analysisError, setAnalysisError] = useState<Error>();
  const [analysis, setAnalysis] = useState<AzureAnalysisResponse>();
  const [analysisWorking, setAnalysisWorking] = useState(false);

  const createPlan = async (event: FormEvent) => {
    event.preventDefault();
    setPlan(undefined);
    setValidationError(undefined);
    setRequestError(undefined);
    setApprovalRequested(false);
    setApprovalConfirmationOpen(false);
    const resource = parseAzureResourceId(resourceId);
    if (!resource || resource.scopeType !== 'resource') {
      setValidationError('Enter a valid Azure resource ID.');
      return;
    }
    const parsed = parseOperationParameters(parametersText);
    if ('error' in parsed) {
      setValidationError(parsed.error);
      return;
    }
    if (!templateId) {
      setValidationError('Select an allowlisted operation template.');
      return;
    }
    setWorking(true);
    try {
      setPlan(
        await api.createPlan({
          templateId,
          resourceId,
          parameters: parsed.parameters,
        }),
      );
    } catch (error) {
      setPlan(undefined);
      setRequestError(
        error instanceof Error ? error : new Error(String(error)),
      );
    } finally {
      setWorking(false);
    }
  };

  const requestApproval = async () => {
    if (!plan) {
      return;
    }
    setApprovalConfirmationOpen(false);
    setWorking(true);
    setRequestError(undefined);
    try {
      await api.requestApproval(plan.id);
      setApprovalRequested(true);
    } catch (error) {
      setRequestError(
        error instanceof Error ? error : new Error(String(error)),
      );
    } finally {
      setWorking(false);
    }
  };

  const analyze = async (event: FormEvent) => {
    event.preventDefault();
    setAnalysisValidationError(undefined);
    setAnalysisError(undefined);
    const question = analysisQuestion.trim();
    if (!question || question.length > 2000) {
      setAnalysisValidationError(
        'Enter an analysis question between 1 and 2000 characters.',
      );
      return;
    }
    const values = analysisResourceIds
      .split(/\r?\n/)
      .map(value => value.trim())
      .filter(Boolean);
    if (values.length < 1 || values.length > 20) {
      setAnalysisValidationError('Enter between 1 and 20 resource IDs.');
      return;
    }
    const parsed = values.map(value => parseAzureResourceId(value));
    if (parsed.some(value => value?.scopeType !== 'resource')) {
      setAnalysisValidationError(
        'Every analysis resource ID must identify an Azure resource.',
      );
      return;
    }
    const resourceIds = parsed.map(value => value!.id);
    setAnalysisWorking(true);
    try {
      setAnalysis(await api.analyze({ question, resourceIds }));
    } catch (error) {
      setAnalysis(undefined);
      setAnalysisError(
        error instanceof Error ? error : new Error(String(error)),
      );
    } finally {
      setAnalysisWorking(false);
    }
  };

  if (templates.loading || capabilities.loading) {
    return <Progress />;
  }
  if (templates.error || capabilities.error) {
    return (
      <ResponseErrorPanel error={(templates.error ?? capabilities.error)!} />
    );
  }

  return (
    <Grid container spacing={3}>
      <Grid item xs={12}>
        <WarningPanel title="Plan before approval">
          This form only creates an immutable, deterministic plan. Requesting
          approval and executing the approved plan are separate governed
          actions.
        </WarningPanel>
      </Grid>
      <Grid item xs={12}>
        <InfoCard title="Microsoft Foundry analysis">
          {capabilities.value?.foundryConfigured ? (
            <form onSubmit={analyze}>
              <Grid container spacing={2}>
                <Grid item xs={12}>
                  <Typography>
                    Foundry is configured for read-only analysis. A
                    recommendation cannot create, approve, or execute a plan.
                  </Typography>
                </Grid>
                <Grid item xs={12}>
                  <TextField
                    label="Analysis question"
                    inputProps={{
                      'aria-label': 'Analysis question',
                      maxLength: 2000,
                    }}
                    value={analysisQuestion}
                    onChange={event => setAnalysisQuestion(event.target.value)}
                    required
                    fullWidth
                    multiline
                    minRows={3}
                    variant="outlined"
                  />
                </Grid>
                <Grid item xs={12}>
                  <TextField
                    label="Analysis resource IDs"
                    inputProps={{ 'aria-label': 'Analysis resource IDs' }}
                    value={analysisResourceIds}
                    onChange={event =>
                      setAnalysisResourceIds(event.target.value)
                    }
                    required
                    fullWidth
                    multiline
                    minRows={3}
                    variant="outlined"
                    helperText="Enter 1–20 complete Azure resource IDs, one per line."
                  />
                </Grid>
                {analysisValidationError && (
                  <Grid item xs={12}>
                    <Typography color="error" role="alert">
                      {analysisValidationError}
                    </Typography>
                  </Grid>
                )}
                <Grid item xs={12}>
                  <Button
                    type="submit"
                    variant="contained"
                    color="primary"
                    disabled={analysisWorking}
                  >
                    {analysisWorking ? 'Analyzing…' : 'Analyze with Foundry'}
                  </Button>
                </Grid>
              </Grid>
            </form>
          ) : (
            <WarningPanel title="Foundry analysis is not configured">
              Configure both the Microsoft Foundry project endpoint and prompt
              agent name to enable this gated capability. No recommendation is
              generated.
            </WarningPanel>
          )}
        </InfoCard>
      </Grid>
      {analysisError && (
        <Grid item xs={12}>
          <ResponseErrorPanel error={analysisError} />
        </Grid>
      )}
      {analysis && (
        <Grid item xs={12}>
          <RecommendationDetails analysis={analysis} />
        </Grid>
      )}
      <Grid item xs={12}>
        <InfoCard title="Create operation plan">
          <form onSubmit={createPlan}>
            <Grid container spacing={2}>
              <Grid item xs={12}>
                <FormControl fullWidth>
                  <InputLabel id="operation-template-label">
                    Operation template
                  </InputLabel>
                  <Select
                    labelId="operation-template-label"
                    value={templateId}
                    onChange={event =>
                      setTemplateId(
                        event.target.value as AzureOperationTemplateId,
                      )
                    }
                  >
                    {(templates.value ?? []).map(template => (
                      <MenuItem key={template.id} value={template.id}>
                        {template.title} · {template.risk} risk ·{' '}
                        {template.resourceTypes.join(', ')}
                      </MenuItem>
                    ))}
                  </Select>
                </FormControl>
              </Grid>
              <Grid item xs={12}>
                <TextField
                  label="Azure resource ID"
                  inputProps={{ 'aria-label': 'Azure resource ID' }}
                  value={resourceId}
                  onChange={event => setResourceId(event.target.value)}
                  required
                  fullWidth
                  helperText="Use the complete /subscriptions/... resource ID."
                />
              </Grid>
              <Grid item xs={12}>
                <TextField
                  label="Parameters JSON"
                  inputProps={{ 'aria-label': 'Parameters JSON' }}
                  value={parametersText}
                  onChange={event => setParametersText(event.target.value)}
                  required
                  fullWidth
                  multiline
                  minRows={5}
                  variant="outlined"
                />
              </Grid>
              {validationError && (
                <Grid item xs={12}>
                  <Typography color="error" role="alert">
                    {validationError}
                  </Typography>
                </Grid>
              )}
              <Grid item xs={12}>
                <Button
                  type="submit"
                  variant="contained"
                  color="primary"
                  disabled={working || (templates.value ?? []).length === 0}
                >
                  {working ? 'Creating…' : 'Create plan'}
                </Button>
              </Grid>
            </Grid>
          </form>
        </InfoCard>
      </Grid>
      {requestError && (
        <Grid item xs={12}>
          <ResponseErrorPanel error={requestError} />
        </Grid>
      )}
      {plan && (
        <>
          <Grid item xs={12}>
            <PlanDetails plan={plan} />
          </Grid>
          <Grid item xs={12}>
            <Button
              variant="contained"
              color="primary"
              disabled={working || approvalRequested}
              onClick={() => setApprovalConfirmationOpen(true)}
            >
              {approvalRequested ? 'Approval requested' : 'Request approval'}
            </Button>
          </Grid>
        </>
      )}
      <Dialog
        open={approvalConfirmationOpen}
        onClose={() => setApprovalConfirmationOpen(false)}
        aria-labelledby="request-approval-confirmation-title"
      >
        <DialogTitle id="request-approval-confirmation-title">
          Confirm approval request
        </DialogTitle>
        <DialogContent>
          <DialogContentText>
            Request approval for {plan?.templateId} on {plan?.resourceId}? This
            is a {plan?.risk}-risk plan. No Azure write occurs until a separate
            approval and execution.
          </DialogContentText>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setApprovalConfirmationOpen(false)}>
            Go back
          </Button>
          <Button color="primary" variant="contained" onClick={requestApproval}>
            Confirm request
          </Button>
        </DialogActions>
      </Dialog>
    </Grid>
  );
}
