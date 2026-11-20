import { ApiPropertyOptional } from '@nestjs/swagger';
import { Transform } from 'class-transformer';
import {
  IsBoolean,
  IsOptional,
  IsString,
  IsUUID,
  MaxLength,
} from 'class-validator';
import { PaginationQueryDto } from '../../../../common/dto/pagination-query.dto';

function parseBooleanQuery(value: unknown): boolean | undefined {
  if (value === true || value === 'true' || value === '1' || value === 1) {
    return true;
  }
  if (value === false || value === 'false' || value === '0' || value === 0) {
    return false;
  }
  return undefined;
}

export class VehicleRoutesListQueryDto extends PaginationQueryDto {
  @ApiPropertyOptional({ format: 'uuid' })
  @IsOptional()
  @IsUUID('4')
  vehicleId?: string;

  @ApiPropertyOptional({ example: 'Kinshasa' })
  @IsOptional()
  @IsString()
  @MaxLength(120)
  departureCity?: string;

  @ApiPropertyOptional({ example: 'Lubumbashi' })
  @IsOptional()
  @IsString()
  @MaxLength(120)
  arrivalCity?: string;

  @ApiPropertyOptional({ description: 'Search on departure / arrival city names' })
  @IsOptional()
  @IsString()
  @MaxLength(180)
  search?: string;

  @ApiPropertyOptional({
    description: 'Filter by public /cars catalogue visibility',
  })
  @IsOptional()
  @Transform(({ value }) => parseBooleanQuery(value))
  @IsBoolean()
  active?: boolean;

  @ApiPropertyOptional({
    description: 'When true, each route includes nested priceTiers',
  })
  @IsOptional()
  @Transform(({ value }) => parseBooleanQuery(value))
  @IsBoolean()
  includePriceTiers?: boolean;
}
