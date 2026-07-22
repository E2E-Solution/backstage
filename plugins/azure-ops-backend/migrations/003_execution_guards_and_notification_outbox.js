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

exports.up = async function up(knex) {
  await knex('azure_ops_executions').where({ status: 'queued' }).update({
    status: 'unknown',
    message: 'Legacy queued dispatch requires reconciliation',
  });
  await knex.schema.alterTable('azure_ops_approvals', table => {
    table.unique(['plan_id'], {
      indexName: 'azure_ops_approvals_plan_id_unique',
    });
  });
  await knex.schema.alterTable('azure_ops_executions', table => {
    table.string('orchestration_id', 256);
    table.unique(['approval_id'], {
      indexName: 'azure_ops_executions_approval_id_unique',
    });
    table.unique(['orchestration_id'], {
      indexName: 'azure_ops_executions_orchestration_id_unique',
    });
  });
  await knex.schema.createTable(
    'azure_ops_incident_notification_outbox',
    table => {
      table.string('id').primary();
      table
        .text('incident_id')
        .notNullable()
        .references('azure_ops_incidents.id');
      table.string('notification_type', 16).notNullable();
      table.string('event_key', 64).notNullable().unique();
      table.text('payload_json').notNullable();
      table.timestamp('created_at').notNullable();
      table.timestamp('delivery_started_at');
      table.timestamp('delivered_at');
      table.index(['delivered_at']);
    },
  );
};

exports.down = async function down(knex) {
  await knex.schema.dropTable('azure_ops_incident_notification_outbox');
  await knex.schema.alterTable('azure_ops_executions', table => {
    table.dropUnique(
      ['orchestration_id'],
      'azure_ops_executions_orchestration_id_unique',
    );
    table.dropUnique(
      ['approval_id'],
      'azure_ops_executions_approval_id_unique',
    );
    table.dropColumn('orchestration_id');
  });
  await knex.schema.alterTable('azure_ops_approvals', table => {
    table.dropUnique(['plan_id'], 'azure_ops_approvals_plan_id_unique');
  });
};
