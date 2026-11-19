import { ApiProperty, ApiPropertyOptional, PartialType } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import {
  ArrayMinSize,
  IsArray,
  IsInt,
  IsOptional,
  IsUUID,
  Min,
  ValidateNested,
} from 'class-validator';

export class VehicleRoutePriceTierInputDto {
  @ApiProperty({ example: 1, minimum: 1 })
  @Type(() => Number)
  @IsInt()
  @Min(1)
  minPassengers!: number;

  @ApiProperty({ example: 2, minimum: 1 })
  @Type(() => Number)
  @IsInt()
  @Min(1)
  maxPassengers!: number;

  @ApiProperty({ example: 5500, minimum: 0 })
  @Type(() => Number)
  @IsInt()
  @Min(0)
  priceCents!: number;
}

export class CreateVehicleRoutePriceTierDto extends VehicleRoutePriceTierInputDto {
  @ApiProperty({ format: 'uuid' })
  @IsUUID('4')
  routeId!: string;
}

export class UpdateVehicleRoutePriceTierDto extends PartialType(
  VehicleRoutePriceTierInputDto,
) {}

export class ReplaceVehicleRoutePriceTiersDto {
  @ApiProperty({ type: [VehicleRoutePriceTierInputDto] })
  @IsArray()
  @ArrayMinSize(1)
  @ValidateNested({ each: true })
  @Type(() => VehicleRoutePriceTierInputDto)
  priceTiers!: VehicleRoutePriceTierInputDto[];
}

export class VehicleRoutePriceTiersListQueryDto {
  @ApiPropertyOptional({ default: 1 })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  page?: number;

  @ApiPropertyOptional({ default: 50 })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  limit?: number;

  @ApiPropertyOptional({ format: 'uuid' })
  @IsOptional()
  @IsUUID('4')
  routeId?: string;
}
