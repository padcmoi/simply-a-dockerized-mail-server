import { applyDecorators } from '@nestjs/common';
import { ApiOkResponse, ApiOperation } from '@nestjs/swagger';

export const OpenApiListUsers = () =>
  applyDecorators(
    ApiOperation({ summary: 'List virtual users (paginated, optional search + domain filter)' }),
    ApiOkResponse({ description: 'Paginated VirtualUser rows' }),
  );

export const OpenApiGetUser = () =>
  applyDecorators(
    ApiOperation({ summary: 'Get one user by id' }),
    ApiOkResponse({ description: 'VirtualUser row' }),
  );

export const OpenApiCreateUser = () =>
  applyDecorators(
    ApiOperation({
      summary: 'Create a virtual mailbox',
      description: 'Hashes the password with SHA512-CRYPT (Dovecot scheme) before storing.',
    }),
    ApiOkResponse({ description: 'Created VirtualUser row' }),
  );

export const OpenApiUpdateUser = () =>
  applyDecorators(
    ApiOperation({ summary: 'Update a user (quota, maildir, etc.)' }),
    ApiOkResponse({ description: 'Updated VirtualUser row' }),
  );

export const OpenApiChangeUserPassword = () =>
  applyDecorators(
    ApiOperation({ summary: "Rotate the user's mailbox password" }),
    ApiOkResponse({ description: '{ id, passwordChanged: true }' }),
  );

export const OpenApiDeleteUser = () =>
  applyDecorators(
    ApiOperation({ summary: 'Delete a user mailbox (admin only)' }),
    ApiOkResponse({ description: '{ id, deleted: true }' }),
  );
