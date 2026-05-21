import { applyDecorators } from '@nestjs/common';
import { ApiOkResponse, ApiOperation, ApiQuery } from '@nestjs/swagger';

export const OpenApiListAliases = () =>
  applyDecorators(
    ApiOperation({ summary: 'List virtual aliases (paginated, optional search + domain filter)' }),
    ApiQuery({ name: 'page', required: false, type: Number }),
    ApiQuery({ name: 'limit', required: false, type: Number }),
    ApiQuery({ name: 'search', required: false, type: String }),
    ApiQuery({ name: 'domain', required: false, type: String }),
    ApiOkResponse({ description: 'Paginated VirtualAlias rows' }),
  );

export const OpenApiGetAlias = () =>
  applyDecorators(
    ApiOperation({ summary: 'Get one alias by id' }),
    ApiOkResponse({ description: 'VirtualAlias row' }),
  );

export const OpenApiCreateAlias = () =>
  applyDecorators(
    ApiOperation({ summary: 'Create a virtual alias (source -> destination)' }),
    ApiOkResponse({ description: 'Created VirtualAlias row' }),
  );

export const OpenApiUpdateAlias = () =>
  applyDecorators(
    ApiOperation({ summary: 'Update an alias' }),
    ApiOkResponse({ description: 'Updated VirtualAlias row' }),
  );

export const OpenApiDeleteAlias = () =>
  applyDecorators(
    ApiOperation({ summary: 'Delete an alias' }),
    ApiOkResponse({ description: '{ id, deleted: true }' }),
  );
