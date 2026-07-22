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
  DatabaseService,
  isDatabaseConflictError,
  resolvePackagePath,
} from '@backstage/backend-plugin-api';
import { ConflictError, InputError, NotFoundError } from '@backstage/errors';
import {
  AzureApprovalRequest,
  AzureApprovalStatus,
  AzureExecutionRecord,
  AzureExecutionStatus,
  AzureIncident,
  AzureIncidentFilters,
  AzureOperationPlan,
  AzureOrchestratorEvent,
} from '@internal/backstage-plugin-azure-ops-common';
import { Knex } from 'knex';
import { createHash, randomUUID } from 'node:crypto';
import { calculatePlanHash } from './planning';

interface PlanRow {
  id: string;
  plan_json: string;
  plan_hash: string;
  requested_by: string;
  created_at: string | Date;
  expires_at: string | Date;
}

interface ApprovalRow {
  id: string;
  plan_id: string;
  status: AzureApprovalStatus;
  requested_at: string | Date;
  decided_at?: string | Date;
  decided_by?: string;
  decision_reason?: string;
}

interface ExecutionRow {
  id: string;
  approval_id: string;
  plan_hash: string;
  correlation_id: string;
  orchestration_id?: string;
  status: AzureExecutionRecord['status'];
  queued_at: string | Date;
  started_at?: string | Date | null;
  completed_at?: string | Date | null;
  message?: string;
}

interface AuditRow {
  sequence: number;
  id: string;
  event_type: string;
  actor: string;
  correlation_id: string;
  created_at: string | Date;
  payload_json: string;
}

interface IncidentRow {
  id: string;
  alert_rule: string;
  severity: AzureIncident['severity'];
  signal_type: string;
  monitoring_service: string;
  status: AzureIncident['status'];
  fired_at: string | Date;
  resolved_at: string | Date | null;
  affected_resource_ids_json: string;
  summary: string;
  source: AzureIncident['source'];
  last_updated: string | Date;
}

interface IncidentNotificationRow {
  id: string;
  incident_id: string;
  notification_type: 'fired' | 'resolved';
  event_key: string;
  payload_json: string;
  created_at: string | Date;
  delivery_started_at: string | Date | null;
  delivered_at: string | Date | null;
}

export interface AuditEvent {
  id: string;
  sequence: number;
  eventType: string;
  actor: string;
  correlationId: string;
  createdAt: string;
  payload: Record<string, unknown>;
}

export interface PendingIncidentNotification {
  id: string;
  type: 'fired' | 'resolved';
  incident: AzureIncident;
}

const incidentNotificationLeaseMs = 5 * 60_000;

function iso(value: string | Date | null | undefined): string | undefined {
  return value === null || value === undefined
    ? undefined
    : new Date(value).toISOString();
}

function approvalFromRows(
  approval: ApprovalRow,
  plan: AzureOperationPlan,
): AzureApprovalRequest {
  return {
    id: approval.id,
    plan,
    status: approval.status,
    requestedAt: iso(approval.requested_at)!,
    decidedAt: iso(approval.decided_at),
    decidedBy: approval.decided_by ?? undefined,
    decisionReason: approval.decision_reason ?? undefined,
  };
}

function executionFromRow(row: ExecutionRow): AzureExecutionRecord {
  return {
    id: row.id,
    approvalId: row.approval_id,
    planHash: row.plan_hash,
    correlationId: row.correlation_id,
    orchestrationId: row.orchestration_id ?? undefined,
    status: row.status,
    queuedAt: iso(row.queued_at)!,
    startedAt: iso(row.started_at),
    completedAt: iso(row.completed_at),
    message: row.message ?? undefined,
  };
}

function incidentFromRow(row: IncidentRow): AzureIncident {
  return {
    id: row.id,
    alertRule: row.alert_rule,
    severity: row.severity,
    signalType: row.signal_type,
    monitoringService: row.monitoring_service,
    status: row.status,
    firedAt: iso(row.fired_at)!,
    resolvedAt: iso(row.resolved_at),
    affectedResourceIds: JSON.parse(row.affected_resource_ids_json) as string[],
    summary: row.summary,
    source: row.source,
    lastUpdated: iso(row.last_updated)!,
  };
}

function incidentRow(incident: AzureIncident): IncidentRow {
  return {
    id: incident.id,
    alert_rule: incident.alertRule,
    severity: incident.severity,
    signal_type: incident.signalType,
    monitoring_service: incident.monitoringService,
    status: incident.status,
    fired_at: incident.firedAt,
    resolved_at: incident.resolvedAt ?? null,
    affected_resource_ids_json: JSON.stringify(incident.affectedResourceIds),
    summary: incident.summary,
    source: incident.source,
    last_updated: incident.lastUpdated,
  };
}

export class AzureOpsStore {
  static async create(options: {
    database: DatabaseService;
    now?: () => Date;
  }): Promise<AzureOpsStore> {
    const client = await options.database.getClient();
    if (!options.database.migrations?.skip) {
      await client.migrate.latest({
        directory: resolvePackagePath(
          '@internal/backstage-plugin-azure-ops-backend',
          'migrations',
        ),
      });
    }
    return new AzureOpsStore(client, options.now);
  }

  static forTest(db: Knex, now?: () => Date): AzureOpsStore {
    return new AzureOpsStore(db, now);
  }

  private constructor(private readonly db: Knex, now?: () => Date) {
    this.now = now ?? (() => new Date());
  }

  private readonly now: () => Date;

  async savePlan(
    plan: AzureOperationPlan,
    correlationId: string = randomUUID(),
  ): Promise<void> {
    if (calculatePlanHash(plan) !== plan.hash) {
      throw new InputError('Plan hash does not match its canonical payload');
    }
    await this.db.transaction(async tx => {
      await tx<PlanRow>('azure_ops_plans').insert({
        id: plan.id,
        plan_json: JSON.stringify(plan),
        plan_hash: plan.hash,
        requested_by: plan.requestedBy,
        created_at: plan.createdAt,
        expires_at: plan.expiresAt,
      });
      await this.appendAudit(tx, {
        eventType: 'plan.created',
        actor: plan.requestedBy,
        correlationId,
        payload: { planId: plan.id, planHash: plan.hash },
      });
    });
  }

  async getPlan(
    id: string,
    tx: Knex | Knex.Transaction = this.db,
    lock = false,
  ) {
    let query = tx<PlanRow>('azure_ops_plans').where({ id });
    if (lock) {
      query = query.forUpdate();
    }
    const row = await query.first();
    if (!row) {
      throw new NotFoundError(`Plan '${id}' was not found`);
    }
    return JSON.parse(row.plan_json) as AzureOperationPlan;
  }

  async createApproval(options: {
    planId: string;
    actor: string;
    correlationId?: string;
  }): Promise<AzureApprovalRequest> {
    return this.db.transaction(async tx => {
      const plan = await this.getPlan(options.planId, tx, true);
      if (Date.parse(plan.expiresAt) <= this.now().getTime()) {
        throw new ConflictError('The plan has expired');
      }
      const row: ApprovalRow = {
        id: randomUUID(),
        plan_id: plan.id,
        status: 'pending',
        requested_at: this.now(),
      };
      try {
        await tx<ApprovalRow>('azure_ops_approvals').insert(row);
      } catch (error) {
        if (isDatabaseConflictError(error)) {
          throw new ConflictError('The plan already has an approval');
        }
        throw error;
      }
      await this.appendAudit(tx, {
        eventType: 'approval.requested',
        actor: options.actor,
        correlationId: options.correlationId ?? randomUUID(),
        payload: { approvalId: row.id, planId: plan.id },
      });
      return approvalFromRows(row, plan);
    });
  }

  async listApprovals(): Promise<AzureApprovalRequest[]> {
    await this.expireApprovals();
    const rows = await this.db<ApprovalRow>('azure_ops_approvals')
      .orderBy('requested_at', 'desc')
      .limit(200);
    return Promise.all(
      rows.map(async approval =>
        approvalFromRows(approval, await this.getPlan(approval.plan_id)),
      ),
    );
  }

  async getApproval(
    id: string,
    tx: Knex | Knex.Transaction = this.db,
    lock = false,
  ): Promise<AzureApprovalRequest> {
    let query = tx<ApprovalRow>('azure_ops_approvals').where({ id });
    if (lock) {
      query = query.forUpdate();
    }
    const approval = await query.first();
    if (!approval) {
      throw new NotFoundError(`Approval '${id}' was not found`);
    }
    return approvalFromRows(approval, await this.getPlan(approval.plan_id, tx));
  }

  async decide(options: {
    id: string;
    actor: string;
    decision: 'approved' | 'rejected' | 'canceled';
    reason?: string;
    correlationId?: string;
  }): Promise<AzureApprovalRequest> {
    await this.expireApprovals();
    return this.db.transaction(async tx => {
      const approval = await this.getApproval(options.id, tx, true);
      if (approval.status === 'expired') {
        throw new ConflictError('The plan has expired');
      }
      if (
        options.decision === 'approved' &&
        approval.plan.requestedBy === options.actor
      ) {
        throw new InputError('A requester cannot approve their own plan');
      }
      const allowed =
        approval.status === 'pending' ||
        (approval.status === 'approved' && options.decision === 'canceled');
      if (!allowed) {
        throw new ConflictError(
          `Cannot transition approval from '${approval.status}' to '${options.decision}'`,
        );
      }
      if (options.decision === 'canceled') {
        const execution = await tx<ExecutionRow>('azure_ops_executions')
          .where({ approval_id: options.id })
          .forUpdate()
          .first();
        if (execution) {
          throw new ConflictError(
            'An approval cannot be canceled after execution has been created',
          );
        }
      }
      const decidedAt = this.now();
      const affected = await tx<ApprovalRow>('azure_ops_approvals')
        .where({ id: options.id, status: approval.status })
        .update({
          status: options.decision,
          decided_at: decidedAt,
          decided_by: options.actor,
          decision_reason: options.reason,
        });
      if (affected !== 1) {
        throw new ConflictError(
          `Approval '${options.id}' was changed by another request`,
        );
      }
      await this.appendAudit(tx, {
        eventType: `approval.${options.decision}`,
        actor: options.actor,
        correlationId: options.correlationId ?? randomUUID(),
        payload: { approvalId: options.id, reason: options.reason },
      });
      return {
        ...approval,
        status: options.decision,
        decidedAt: decidedAt.toISOString(),
        decidedBy: options.actor,
        decisionReason: options.reason,
      };
    });
  }

  async createExecution(options: {
    approvalId: string;
    actor: string;
    correlationId: string;
  }): Promise<AzureExecutionRecord> {
    await this.expireApprovals();
    return this.db.transaction(async tx => {
      const approval = await this.getApproval(options.approvalId, tx, true);
      if (approval.status !== 'approved') {
        throw new ConflictError('Only an approved plan can be executed');
      }
      if (Date.parse(approval.plan.expiresAt) <= this.now().getTime()) {
        throw new ConflictError('The approved plan has expired');
      }
      if (calculatePlanHash(approval.plan) !== approval.plan.hash) {
        throw new ConflictError('The stored plan hash no longer matches');
      }
      const record: AzureExecutionRecord = {
        id: randomUUID(),
        approvalId: options.approvalId,
        planHash: approval.plan.hash,
        correlationId: options.correlationId,
        status: 'dispatching',
        queuedAt: this.now().toISOString(),
      };
      try {
        await tx<ExecutionRow>('azure_ops_executions').insert({
          id: record.id,
          approval_id: record.approvalId,
          plan_hash: record.planHash,
          correlation_id: record.correlationId,
          status: record.status,
          queued_at: record.queuedAt,
        });
      } catch (error) {
        if (isDatabaseConflictError(error)) {
          throw new ConflictError('The approval already has an execution');
        }
        throw error;
      }
      await this.appendAudit(tx, {
        eventType: 'execution.dispatching',
        actor: options.actor,
        correlationId: options.correlationId,
        payload: {
          executionId: record.id,
          approvalId: record.approvalId,
          planHash: record.planHash,
        },
      });
      return record;
    });
  }

  async markExecutionDispatched(
    id: string,
    orchestrationId: string,
  ): Promise<AzureExecutionRecord> {
    return this.db.transaction(async tx => {
      const execution = await tx<ExecutionRow>('azure_ops_executions')
        .where({ id })
        .forUpdate()
        .first();
      if (
        execution?.orchestration_id === orchestrationId &&
        execution.status !== 'dispatching'
      ) {
        return executionFromRow(execution);
      }
      if (!execution || execution.status !== 'dispatching') {
        throw new ConflictError(
          `Dispatching execution '${id}' was not found for acceptance update`,
        );
      }
      const startedAt = this.now();
      let affected: number;
      try {
        affected = await tx<ExecutionRow>('azure_ops_executions')
          .where({ id, status: 'dispatching' })
          .update({
            status: 'running',
            orchestration_id: orchestrationId,
            started_at: startedAt,
          });
      } catch (error) {
        if (isDatabaseConflictError(error)) {
          throw new ConflictError(
            `Orchestration '${orchestrationId}' is already assigned`,
          );
        }
        throw error;
      }
      if (affected !== 1) {
        throw new ConflictError(`Execution '${id}' changed during dispatch`);
      }
      await this.appendAudit(tx, {
        eventType: 'execution.running',
        actor: 'system:azure-ops',
        correlationId: execution.correlation_id,
        payload: { executionId: id, orchestrationId },
      });
      return executionFromRow({
        ...execution,
        status: 'running',
        orchestration_id: orchestrationId,
        started_at: startedAt,
      });
    });
  }

  async markExecutionDispatchFailed(
    id: string,
    message: string,
    ambiguous: boolean,
  ): Promise<AzureExecutionRecord> {
    return this.db.transaction(async tx => {
      const execution = await tx<ExecutionRow>('azure_ops_executions')
        .where({ id, status: 'dispatching' })
        .forUpdate()
        .first();
      if (!execution) {
        throw new ConflictError(
          `Dispatching execution '${id}' was not found for failure update`,
        );
      }
      const status: AzureExecutionStatus = ambiguous ? 'unknown' : 'failed';
      const completedAt = ambiguous ? undefined : this.now();
      const affected = await tx<ExecutionRow>('azure_ops_executions')
        .where({ id, status: 'dispatching' })
        .update({
          status,
          completed_at: completedAt ?? null,
          message,
        });
      if (affected !== 1) {
        throw new ConflictError(`Execution '${id}' changed during dispatch`);
      }
      await this.appendAudit(tx, {
        eventType: `execution.${status}`,
        actor: 'system:azure-ops',
        correlationId: execution.correlation_id,
        payload: { executionId: id, message },
      });
      return executionFromRow({
        ...execution,
        status,
        completed_at: completedAt,
        message,
      });
    });
  }

  async getExecution(
    id: string,
    tx: Knex | Knex.Transaction = this.db,
  ): Promise<AzureExecutionRecord> {
    const execution = await tx<ExecutionRow>('azure_ops_executions')
      .where({ id })
      .first();
    if (!execution) {
      throw new NotFoundError(`Execution '${id}' was not found`);
    }
    return executionFromRow(execution);
  }

  async applyOrchestratorEvent(options: {
    event: AzureOrchestratorEvent;
    actor: string;
  }): Promise<AzureExecutionRecord> {
    return this.db.transaction(async tx => {
      const execution = await tx<ExecutionRow>('azure_ops_executions')
        .where({ id: options.event.executionId })
        .forUpdate()
        .first();
      if (!execution) {
        throw new NotFoundError(
          `Execution '${options.event.executionId}' was not found`,
        );
      }
      if (execution.correlation_id !== options.event.correlationId) {
        throw new InputError(
          'Orchestrator event identifiers do not match the execution',
        );
      }
      if (
        execution.orchestration_id &&
        execution.orchestration_id !== options.event.orchestrationId
      ) {
        throw new InputError(
          'Orchestrator event identifiers do not match the execution',
        );
      }
      if (
        !execution.orchestration_id &&
        !['dispatching', 'unknown'].includes(execution.status)
      ) {
        throw new InputError(
          'The execution has no orchestration ID available for reconciliation',
        );
      }

      const terminal: AzureExecutionStatus[] = [
        'succeeded',
        'failed',
        'canceled',
      ];
      if (execution.status === options.event.status) {
        return executionFromRow(execution);
      }
      if (terminal.includes(execution.status)) {
        throw new ConflictError(
          `Terminal execution '${execution.id}' cannot transition from '${execution.status}'`,
        );
      }
      const allowed: Partial<
        Record<AzureExecutionStatus, AzureExecutionStatus[]>
      > = {
        dispatching: ['running', 'unknown', 'failed', 'canceled'],
        running: ['unknown', 'succeeded', 'failed', 'canceled'],
        unknown: ['running', 'succeeded', 'failed', 'canceled'],
      };
      if (!allowed[execution.status]?.includes(options.event.status)) {
        throw new ConflictError(
          `Cannot transition execution from '${execution.status}' to '${options.event.status}'`,
        );
      }

      const completedAt = terminal.includes(options.event.status)
        ? this.now()
        : undefined;
      const startedAt =
        execution.started_at ??
        (options.event.status === 'running' ? this.now() : undefined);
      let affected: number;
      try {
        affected = await tx<ExecutionRow>('azure_ops_executions')
          .where({ id: execution.id, status: execution.status })
          .update({
            status: options.event.status,
            ...(!execution.orchestration_id
              ? { orchestration_id: options.event.orchestrationId }
              : {}),
            ...(startedAt ? { started_at: startedAt } : {}),
            ...(completedAt ? { completed_at: completedAt } : {}),
            ...(options.event.message
              ? { message: options.event.message }
              : {}),
          });
      } catch (error) {
        if (isDatabaseConflictError(error)) {
          throw new ConflictError(
            `Orchestration '${options.event.orchestrationId}' is already assigned`,
          );
        }
        throw error;
      }
      if (affected !== 1) {
        throw new ConflictError(
          `Execution '${execution.id}' was changed by another event`,
        );
      }
      await this.appendAudit(tx, {
        eventType: `execution.${options.event.status}`,
        actor: options.actor,
        correlationId: execution.correlation_id,
        payload: {
          executionId: execution.id,
          orchestrationId: options.event.orchestrationId,
          message: options.event.message,
        },
      });
      return executionFromRow({
        ...execution,
        status: options.event.status,
        orchestration_id: options.event.orchestrationId,
        started_at: startedAt,
        completed_at: completedAt,
        message: options.event.message,
      });
    });
  }

  async listExecutions(): Promise<AzureExecutionRecord[]> {
    const rows = await this.db<ExecutionRow>('azure_ops_executions')
      .orderBy('queued_at', 'desc')
      .limit(200);
    return rows.map(executionFromRow);
  }

  async upsertIncident(options: {
    incident: AzureIncident;
    actor: string;
    correlationId: string;
  }): Promise<{
    incident: AzureIncident;
    change: 'created' | 'updated' | 'replay';
  }> {
    return this.db.transaction(async tx => {
      const previousRow = await tx<IncidentRow>('azure_ops_incidents')
        .where({ id: options.incident.id })
        .forUpdate()
        .first();
      const previous = previousRow ? incidentFromRow(previousRow) : undefined;
      const isReplay =
        previous !== undefined &&
        (JSON.stringify(previous) === JSON.stringify(options.incident) ||
          Date.parse(options.incident.lastUpdated) <
            Date.parse(previous.lastUpdated));
      let change: 'created' | 'updated' | 'replay' = 'created';
      if (previous) {
        change = isReplay ? 'replay' : 'updated';
      }

      if (change === 'created') {
        await tx<IncidentRow>('azure_ops_incidents').insert(
          incidentRow(options.incident),
        );
      } else if (change === 'updated') {
        await tx<IncidentRow>('azure_ops_incidents')
          .where({ id: options.incident.id })
          .update(incidentRow(options.incident));
      }

      const storedIncident =
        change === 'replay' && previous ? previous : options.incident;
      let notification: 'fired' | 'resolved' | undefined;
      if (
        change !== 'replay' &&
        storedIncident.status === 'active' &&
        previous?.status !== 'active'
      ) {
        notification = 'fired';
      } else if (
        change !== 'replay' &&
        storedIncident.status === 'resolved' &&
        previous?.status !== 'resolved'
      ) {
        notification = 'resolved';
      }
      if (notification) {
        await tx<IncidentNotificationRow>(
          'azure_ops_incident_notification_outbox',
        ).insert({
          id: randomUUID(),
          incident_id: storedIncident.id,
          notification_type: notification,
          event_key: createHash('sha256')
            .update(
              `${storedIncident.id}\n${notification}\n${storedIncident.lastUpdated}`,
            )
            .digest('hex'),
          payload_json: JSON.stringify(storedIncident),
          created_at: this.now(),
          delivery_started_at: null,
          delivered_at: null,
        });
      }
      await this.appendAudit(tx, {
        eventType: `incident.${change}`,
        actor: options.actor,
        correlationId: options.correlationId,
        payload: {
          incidentId: storedIncident.id,
          status: storedIncident.status,
          severity: storedIncident.severity,
          source: storedIncident.source,
          resourceCount: storedIncident.affectedResourceIds.length,
        },
      });
      return {
        incident: storedIncident,
        change,
      };
    });
  }

  async claimPendingIncidentNotifications(options: {
    incidentId?: string;
    limit: number;
  }): Promise<PendingIncidentNotification[]> {
    const leaseStartedAt = this.now();
    const leaseExpiredAt = new Date(
      leaseStartedAt.getTime() - incidentNotificationLeaseMs,
    );
    return this.db.transaction(async tx => {
      let query = tx<IncidentNotificationRow>(
        'azure_ops_incident_notification_outbox',
      )
        .whereNull('delivered_at')
        .andWhere(builder =>
          builder
            .whereNull('delivery_started_at')
            .orWhere('delivery_started_at', '<=', leaseExpiredAt),
        );
      if (options.incidentId) {
        query = query.where({ incident_id: options.incidentId });
      }
      const availableRows = await query
        .forUpdate()
        .orderBy('created_at', 'asc')
        .limit(options.limit);
      const claimed: PendingIncidentNotification[] = [];
      for (const item of availableRows) {
        const affected = await tx<IncidentNotificationRow>(
          'azure_ops_incident_notification_outbox',
        )
          .where({ id: item.id })
          .whereNull('delivered_at')
          .andWhere(builder =>
            builder
              .whereNull('delivery_started_at')
              .orWhere('delivery_started_at', '<=', leaseExpiredAt),
          )
          .update({ delivery_started_at: leaseStartedAt });
        if (affected === 1) {
          claimed.push({
            id: item.id,
            type: item.notification_type,
            incident: JSON.parse(item.payload_json) as AzureIncident,
          });
        }
      }
      return claimed;
    });
  }

  async hasPendingIncidentNotifications(incidentId: string): Promise<boolean> {
    const row = await this.db<IncidentNotificationRow>(
      'azure_ops_incident_notification_outbox',
    )
      .where({ incident_id: incidentId })
      .whereNull('delivered_at')
      .first('id');
    return Boolean(row);
  }

  async markIncidentNotificationDelivered(options: {
    id: string;
    actor: string;
    correlationId: string;
  }): Promise<void> {
    await this.db.transaction(async tx => {
      const affected = await tx<IncidentNotificationRow>(
        'azure_ops_incident_notification_outbox',
      )
        .where({ id: options.id })
        .whereNull('delivered_at')
        .update({ delivered_at: this.now() });
      if (affected === 0) {
        const existing = await tx<IncidentNotificationRow>(
          'azure_ops_incident_notification_outbox',
        )
          .where({ id: options.id })
          .first();
        if (existing?.delivered_at) {
          return;
        }

        throw new NotFoundError(
          `Incident notification '${options.id}' was not found`,
        );
      }
      const notification = await tx<IncidentNotificationRow>(
        'azure_ops_incident_notification_outbox',
      )
        .where({ id: options.id })
        .first();
      await this.appendAudit(tx, {
        eventType: 'incident.notification-delivered',
        actor: options.actor,
        correlationId: options.correlationId,
        payload: {
          incidentId: notification?.incident_id,
          notificationType: notification?.notification_type,
        },
      });
    });
  }

  async releaseIncidentNotification(id: string): Promise<void> {
    await this.db<IncidentNotificationRow>(
      'azure_ops_incident_notification_outbox',
    )
      .where({ id })
      .whereNull('delivered_at')
      .update({ delivery_started_at: null });
  }

  async listIncidents(filters: AzureIncidentFilters): Promise<AzureIncident[]> {
    let query = this.db<IncidentRow>('azure_ops_incidents');
    if (filters.status) {
      query = query.where({ status: filters.status });
    }
    if (filters.severity) {
      query = query.where({ severity: filters.severity });
    }
    const rows = await query
      .orderBy('last_updated', 'desc')
      .limit(filters.limit);
    return rows.map(incidentFromRow);
  }

  async listAudit(): Promise<AuditEvent[]> {
    const rows = await this.db<AuditRow>('azure_ops_audit')
      .orderBy('sequence', 'desc')
      .limit(500);
    return rows.map(item => ({
      id: item.id,
      sequence: Number(item.sequence),
      eventType: item.event_type,
      actor: item.actor,
      correlationId: item.correlation_id,
      createdAt: iso(item.created_at)!,
      payload: JSON.parse(item.payload_json) as Record<string, unknown>,
    }));
  }

  async recordAnalysisEvent(options: {
    phase: 'requested' | 'completed' | 'failed';
    actor: string;
    correlationId: string;
    payload: Record<string, unknown>;
  }): Promise<void> {
    await this.appendAudit(this.db, {
      eventType: `analysis.${options.phase}`,
      actor: options.actor,
      correlationId: options.correlationId,
      payload: options.payload,
    });
  }

  private async expireApprovals(): Promise<void> {
    await this.db.transaction(async tx => {
      const now = this.now();
      const rows = await tx('azure_ops_approvals')
        .join<PlanRow>(
          'azure_ops_plans',
          'azure_ops_approvals.plan_id',
          'azure_ops_plans.id',
        )
        .whereIn('azure_ops_approvals.status', ['pending', 'approved'])
        .select(
          'azure_ops_approvals.id',
          'azure_ops_approvals.plan_id',
          'azure_ops_plans.expires_at',
        )
        .limit(500);
      for (const item of rows.filter(
        candidate => Date.parse(String(candidate.expires_at)) <= now.getTime(),
      )) {
        const affected = await tx<ApprovalRow>('azure_ops_approvals')
          .where({ id: item.id })
          .whereIn('status', ['pending', 'approved'])
          .update({ status: 'expired', decided_at: now });
        if (affected !== 1) {
          continue;
        }
        await this.appendAudit(tx, {
          eventType: 'approval.expired',
          actor: 'system:azure-ops',
          correlationId: randomUUID(),
          payload: { approvalId: item.id, planId: item.plan_id },
        });
      }
    });
  }

  private async appendAudit(
    tx: Knex | Knex.Transaction,
    event: {
      eventType: string;
      actor: string;
      correlationId: string;
      payload: Record<string, unknown>;
    },
  ): Promise<void> {
    await tx<AuditRow>('azure_ops_audit').insert({
      id: randomUUID(),
      event_type: event.eventType,
      actor: event.actor,
      correlation_id: event.correlationId,
      created_at: this.now(),
      payload_json: JSON.stringify(event.payload),
    });
  }
}
