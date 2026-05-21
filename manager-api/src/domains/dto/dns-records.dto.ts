import { ApiProperty } from '@nestjs/swagger';
import { VirtualDomain } from '../../entities';

export class DnsRecordDto {
  @ApiProperty() type!: 'MX' | 'TXT' | 'CNAME' | 'A';
  @ApiProperty() name!: string;
  @ApiProperty() value!: string;
  @ApiProperty({ required: false }) priority?: number;
  @ApiProperty() description!: string;
}

export class DomainWithDnsDto {
  @ApiProperty() domain!: VirtualDomain;
  @ApiProperty({ type: [DnsRecordDto] }) dns!: DnsRecordDto[];
  @ApiProperty({ required: false }) dkim_selector?: string;
}
