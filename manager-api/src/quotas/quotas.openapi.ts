import { applyDecorators } from '@nestjs/common';
import { ApiOkResponse, ApiOperation, ApiQuery } from '@nestjs/swagger';

export const OpenApiListDomainQuotas = () =>
  applyDecorators(
    ApiOperation({ summary: 'Aggregate quota usage per domain' }),
    ApiOkResponse({ description: 'Array of VirtualQuotaDomain rows' }),
  );

export const OpenApiGetDomainQuota = () =>
  applyDecorators(
    ApiOperation({ summary: 'Quota usage for one domain' }),
    ApiOkResponse({ description: 'VirtualQuotaDomain row' }),
  );

export const OpenApiListUserQuotas = () =>
  applyDecorators(
    ApiOperation({ summary: 'Per-user quota usage (optional domain filter)' }),
    ApiQuery({ name: 'domain', required: false, type: String }),
    ApiOkResponse({ description: 'Array of VirtualQuotaUser rows' }),
  );

export const OpenApiGetUserQuota = () =>
  applyDecorators(
    ApiOperation({ summary: 'Quota usage for one user mailbox' }),
    ApiOkResponse({ description: 'VirtualQuotaUser row' }),
  );
