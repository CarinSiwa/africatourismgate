import { ApiProperty } from '@nestjs/swagger';

/** Active catalogue tronçon endpoint pair for public search forms. */
export class VehicleRouteOptionDto {
  @ApiProperty({ example: 'Kinshasa' })
  departureCity!: string;

  @ApiProperty({ example: 'Lubumbashi' })
  arrivalCity!: string;
}
