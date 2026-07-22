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
  await knex.schema.createTable('azure_ops_incidents', table => {
    table.text('id').primary();
    table.string('alert_rule', 512).notNullable();
    table.string('severity', 8).notNullable();
    table.string('signal_type', 128).notNullable();
    table.string('monitoring_service', 128).notNullable();
    table.string('status', 16).notNullable();
    table.timestamp('fired_at').notNullable();
    table.timestamp('resolved_at');
    table.text('affected_resource_ids_json').notNullable();
    table.text('summary').notNullable();
    table.string('source', 32).notNullable();
    table.timestamp('last_updated').notNullable();
  });
  await knex.schema.alterTable('azure_ops_incidents', table => {
    table.index(['status', 'severity', 'last_updated']);
  });
};

exports.down = async function down(knex) {
  await knex.schema.dropTable('azure_ops_incidents');
};
