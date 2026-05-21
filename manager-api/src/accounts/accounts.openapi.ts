import { applyDecorators } from '@nestjs/common';
import { ApiOkResponse, ApiOperation } from '@nestjs/swagger';

export const OpenApiListAccounts = () =>
  applyDecorators(
    ApiOperation({ summary: 'List all accounts (admin only)' }),
    ApiOkResponse({ description: 'Array of Account rows' }),
  );

export const OpenApiGetAccount = () =>
  applyDecorators(
    ApiOperation({ summary: 'Get one account by id' }),
    ApiOkResponse({ description: 'Account row' }),
  );

export const OpenApiCreateAccount = () =>
  applyDecorators(
    ApiOperation({
      summary: 'Create a new account',
      description: 'Creates a bare Account row used as FK target for domains/users/aliases.',
    }),
    ApiOkResponse({ description: 'Created Account row' }),
  );

export const OpenApiDeleteAccount = () =>
  applyDecorators(
    ApiOperation({ summary: 'Delete an account' }),
    ApiOkResponse({ description: '{ id, deleted: true }' }),
  );
