import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import {
  IsInt,
  IsOptional,
  IsString,
  IsUUID,
  Length,
  Max,
  MaxLength,
  Min,
} from 'class-validator';

export class CreateVehicleDto {
  @ApiProperty({ format: 'uuid' })
  @IsUUID('4')
  agencyId!: string;

  @ApiProperty({ format: 'uuid' })
  @IsUUID('4')
  categoryId!: string;

  @ApiPropertyOptional({ example: 'CD-1234-AB' })
  @IsOptional()
  @IsString()
  @MaxLength(32)
  licensePlate?: string;

  @ApiProperty({ example: 'USD', default: 'USD' })
  @IsString()
  @Length(3, 3)
  currency!: string;

  @ApiPropertyOptional({
    example: 4,
    default: 4,
    description: 'Max passengers / seats for shared trips on /cars',
  })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(50)
  maxPassengers?: number;
}
