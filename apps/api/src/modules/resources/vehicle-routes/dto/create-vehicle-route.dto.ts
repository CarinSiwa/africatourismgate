import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import {
  IsArray,
  IsBoolean,
  IsInt,
  IsOptional,
  IsString,
  IsUUID,
  Length,
  MaxLength,
  Min,
  ValidateNested,
} from 'class-validator';
import { VehicleRoutePriceTierInputDto } from './vehicle-route-price-tier.dto';

export class CreateVehicleRouteDto {
  @ApiProperty({ format: 'uuid' })
  @IsUUID('4')
  vehicleId!: string;

  @ApiProperty({ example: 'Kinshasa' })
  @IsString()
  @MaxLength(120)
  departureCity!: string;

  @ApiProperty({ example: 'Lubumbashi' })
  @IsString()
  @MaxLength(120)
  arrivalCity!: string;

  @ApiProperty({
    example: 5500,
    description: 'Legacy / package fallback price (often the 1-person tier).',
  })
  @Type(() => Number)
  @IsInt()
  @Min(0)
  priceCents!: number;

  @ApiProperty({ example: 'USD', default: 'USD' })
  @IsString()
  @Length(3, 3)
  currency!: string;

  @ApiPropertyOptional({
    default: true,
    description:
      'Visible on the public /cars catalogue. Inactive routes remain usable in packages.',
  })
  @IsOptional()
  @IsBoolean()
  active?: boolean;

  @ApiPropertyOptional({
    type: [VehicleRoutePriceTierInputDto],
    description:
      'Shared-trip price bands. When omitted on create, a 1–1 tier is seeded from priceCents.',
  })
  @IsOptional()
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => VehicleRoutePriceTierInputDto)
  priceTiers?: VehicleRoutePriceTierInputDto[];
}
