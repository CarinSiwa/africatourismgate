import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import {
  BookingItems,
  Destinations,
  Payments,
  RentalAgencies,
  VehicleAvailability,
  VehicleCategories,
  VehicleImages,
  VehicleRoutePriceTiers,
  VehicleRoutes,
  VehicleTrips,
  Vehicles,
} from '../../../entities/generated';
import { OrganizationSettingsModule } from '../../resources/organization-settings/organization-settings.module';
import { PublicVehicleTripsController } from './public-vehicle-trips.controller';
import { PublicVehicleTripsService } from './public-vehicle-trips.service';
import { PublicVehiclesController } from './public-vehicles.controller';
import { PublicVehiclesService } from './public-vehicles.service';

@Module({
  imports: [
    TypeOrmModule.forFeature([
      Vehicles,
      VehicleCategories,
      VehicleImages,
      VehicleRoutes,
      VehicleRoutePriceTiers,
      VehicleTrips,
      RentalAgencies,
      VehicleAvailability,
      Destinations,
      BookingItems,
      Payments,
    ]),
    OrganizationSettingsModule,
  ],
  controllers: [PublicVehiclesController, PublicVehicleTripsController],
  providers: [PublicVehiclesService, PublicVehicleTripsService],
  exports: [PublicVehiclesService, PublicVehicleTripsService],
})
export class PublicVehiclesModule {}
