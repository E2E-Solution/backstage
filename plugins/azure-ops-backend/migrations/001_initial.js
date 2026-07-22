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
  await knex.schema.createTable('azure_ops_plans', table => {
    table.string('id').primary();
    table.text('plan_json').notNullable();
    table.string('plan_hash').notNullable();
    table.string('requested_by').notNullable();
    table.timestamp('created_at').notNullable();
    table.timestamp('expires_at').notNullable();
  });
  await knex.schema.createTable('azure_ops_approvals', table => {
    table.string('id').primary();
    table.string('plan_id').notNullable().references('azure_ops_plans.id');
    table.string('status').notNullable();
    table.timestamp('requested_at').notNullable();
    table.timestamp('decided_at');
    table.string('decided_by');
    table.text('decision_reason');
  });
  await knex.schema.createTable('azure_ops_executions', table => {
    table.string('id').primary();
    table
      .string('approval_id')
      .notNullable()
      .references('azure_ops_approvals.id');
    table.string('plan_hash').notNullable();
    table.string('correlation_id').notNullable().unique();
    table.string('status').notNullable();
    table.timestamp('queued_at').notNullable();
    table.timestamp('started_at');
    table.timestamp('completed_at');
    table.text('message');
  });
  await knex.schema.createTable('azure_ops_audit', table => {
    table.bigIncrements('sequence').primary();
    table.string('id').notNullable().unique();
    table.string('event_type').notNullable();
    table.string('actor').notNullable();
    table.string('correlation_id').notNullable();
    table.timestamp('created_at').notNullable();
    table.text('payload_json').notNullable();
  });
  await knex.schema.alterTable('azure_ops_audit', table => {
    table.index(['created_at']);
  });
};

exports.down = async function down(knex) {
  await knex.schema.dropTable('azure_ops_audit');
  await knex.schema.dropTable('azure_ops_executions');
  await knex.schema.dropTable('azure_ops_approvals');
  await knex.schema.dropTable('azure_ops_plans');
};
