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

import { z } from 'zod/v3';
import { azureOperationTemplateIds } from './constants';
import { parseAzureResourceId } from './resourceIds';

/** @public */
export const azureOperationTemplateIdSchema = z.enum(azureOperationTemplateIds);

/** @public */
export const azureOperationPlanRequestSchema = z.object({
  templateId: azureOperationTemplateIdSchema,
  resourceId: z.string().min(1),
  parameters: z.record(z.unknown()).default({}),
});

/** @public */
export const azureAgentRecommendationSchema = z
  .object({
    summary: z.string().min(1),
    hypotheses: z.array(
      z
        .object({
          text: z.string().min(1),
          confidence: z.number().min(0).max(1),
          evidenceIds: z.array(z.string().min(1)),
        })
        .strict(),
    ),
    suggestedTemplateIds: z.array(azureOperationTemplateIdSchema),
    warnings: z.array(z.string()),
  })
  .strict();

/** @public */
export const azureAnalysisRequestSchema = z
  .object({
    question: z.string().trim().min(1).max(2000),
    resourceIds: z
      .array(
        z.string().refine(value => {
          const parsed = parseAzureResourceId(value);
          return (
            parsed?.scopeType === 'resource' &&
            parsed.id === value &&
            value.length <= 2048
          );
        }, 'Resource IDs must be canonical Azure resource IDs'),
      )
      .min(1)
      .max(20),
  })
  .strict();

/** @public */
export const azureOpsCapabilitiesSchema = z
  .object({
    foundryConfigured: z.boolean(),
    orchestratorConfigured: z.boolean(),
    writesRequireApproval: z.literal(true),
  })
  .strict();

const correlationIdSchema = z
  .string()
  .trim()
  .regex(/^[a-zA-Z0-9._:-]{1,128}$/);

/** @public */
export const azureOrchestratorEventSchema = z
  .object({
    executionId: z.string().uuid(),
    orchestrationId: z.string().trim().min(1).max(256),
    correlationId: correlationIdSchema,
    status: z.enum(['running', 'unknown', 'succeeded', 'failed', 'canceled']),
    message: z.string().trim().min(1).max(2000).optional(),
  })
  .strict();

/** @public */
export type AzureOrchestratorEvent = z.infer<
  typeof azureOrchestratorEventSchema
>;

const boundedAlertString = z.string().trim().min(1).max(2048);
const azureMonitorTimestampSchema = z
  .string()
  .max(64)
  .datetime({ offset: true });
const azureMonitorCustomPropertiesSchema = z
  .record(z.string().max(2048))
  .superRefine((properties, context) => {
    const entries = Object.entries(properties);
    if (entries.length > 50) {
      context.addIssue({
        code: z.ZodIssueCode.too_big,
        type: 'array',
        maximum: 50,
        inclusive: true,
        message: 'Azure Monitor custom properties are limited to 50 entries',
      });
    }
    for (const [key] of entries) {
      if (key.length === 0 || key.length > 128) {
        context.addIssue({
          code: z.ZodIssueCode.custom,
          message:
            'Azure Monitor custom property names must be 1-128 characters',
        });
        break;
      }
    }
  });

/** @public */
export const azureIncidentSeveritySchema = z.enum([
  'Sev0',
  'Sev1',
  'Sev2',
  'Sev3',
  'Sev4',
]);

/** @public */
export const azureIncidentStatusSchema = z.enum(['active', 'resolved']);

/**
 * The bounded Azure Monitor common alert schema fields used by Azure Ops.
 *
 * `alertContext` is accepted for compatibility with Action Groups, but is
 * deliberately opaque and must not be persisted.
 *
 * @public
 */
export const azureMonitorCommonAlertSchema = z
  .object({
    schemaId: z.literal('azureMonitorCommonAlertSchema'),
    data: z
      .object({
        essentials: z
          .object({
            alertId: boundedAlertString,
            alertRule: z.string().trim().min(1).max(512),
            severity: azureIncidentSeveritySchema,
            signalType: z.string().trim().min(1).max(128),
            monitorCondition: z.enum(['Fired', 'Resolved']),
            monitoringService: z.string().trim().min(1).max(128),
            alertTargetIDs: z
              .array(z.string().trim().min(1).max(2048))
              .min(1)
              .max(50),
            configurationItems: z
              .array(z.string().trim().min(1).max(512))
              .max(50)
              .optional(),
            originAlertId: boundedAlertString.optional(),
            firedDateTime: azureMonitorTimestampSchema,
            resolvedDateTime: azureMonitorTimestampSchema.optional(),
            description: z.string().trim().max(4000).optional(),
            essentialsVersion: z.string().trim().min(1).max(32).optional(),
            alertContextVersion: z.string().trim().min(1).max(32).optional(),
            investigationLink: z.string().trim().min(1).max(2048).optional(),
          })
          .strict()
          .superRefine((essentials, context) => {
            if (
              essentials.monitorCondition === 'Resolved' &&
              !essentials.resolvedDateTime
            ) {
              context.addIssue({
                code: z.ZodIssueCode.custom,
                path: ['resolvedDateTime'],
                message: 'Resolved alerts require resolvedDateTime',
              });
            }
          }),
        alertContext: z.unknown().optional(),
        customProperties: azureMonitorCustomPropertiesSchema.optional(),
      })
      .strict(),
  })
  .strict();

/** @public */
export type AzureMonitorCommonAlert = z.infer<
  typeof azureMonitorCommonAlertSchema
>;
