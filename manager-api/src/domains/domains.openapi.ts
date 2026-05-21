import { applyDecorators } from '@nestjs/common';
import { ApiOkResponse, ApiOperation } from '@nestjs/swagger';

export const OpenApiListDomains = () =>
  applyDecorators(
    ApiOperation({ summary: 'List virtual domains' }),
    ApiOkResponse({ description: 'Paginated VirtualDomain rows' }),
  );

export const OpenApiGetDomain = () =>
  applyDecorators(
    ApiOperation({ summary: 'Get one domain by id' }),
    ApiOkResponse({ description: 'VirtualDomain row' }),
  );

export const OpenApiGetDomainDns = () =>
  applyDecorators(
    ApiOperation({
      summary: 'Recommended DNS records for the domain',
      description: 'Returns MX, SPF, DKIM (TXT) and DMARC records ready to copy into the zone.',
    }),
    ApiOkResponse({ description: 'Array of { type, host, value, priority? }' }),
  );

export const OpenApiCreateDomain = () =>
  applyDecorators(
    ApiOperation({
      summary: 'Create a virtual domain',
      description: 'Inserts the row AND auto-generates the DKIM key (selector dkim_YYYY_MM).',
    }),
    ApiOkResponse({ description: 'Created VirtualDomain row + DNS records' }),
  );

export const OpenApiUpdateDomain = () =>
  applyDecorators(
    ApiOperation({ summary: 'Update a domain' }),
    ApiOkResponse({ description: 'Updated VirtualDomain row' }),
  );

export const OpenApiDeleteDomain = () =>
  applyDecorators(
    ApiOperation({ summary: 'Delete a domain (admin only)' }),
    ApiOkResponse({ description: '{ id, deleted: true }' }),
  );
