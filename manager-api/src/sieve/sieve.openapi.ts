import { applyDecorators } from '@nestjs/common';
import { ApiOkResponse, ApiOperation } from '@nestjs/swagger';

export const OpenApiListSieve = () =>
  applyDecorators(
    ApiOperation({ summary: 'List sieve reject-sender rules' }),
    ApiOkResponse({ description: 'Array of SieveRejectSender rows' }),
  );

export const OpenApiCreateSieve = () =>
  applyDecorators(
    ApiOperation({ summary: 'Add a reject-sender rule' }),
    ApiOkResponse({ description: 'Created SieveRejectSender row' }),
  );

export const OpenApiToggleSieve = () =>
  applyDecorators(
    ApiOperation({ summary: 'Enable or disable a rule (enabled = 0 / 1)' }),
    ApiOkResponse({ description: 'Updated SieveRejectSender row' }),
  );

export const OpenApiDeleteSieve = () =>
  applyDecorators(
    ApiOperation({ summary: 'Delete a rule' }),
    ApiOkResponse({ description: '{ id, deleted: true }' }),
  );
