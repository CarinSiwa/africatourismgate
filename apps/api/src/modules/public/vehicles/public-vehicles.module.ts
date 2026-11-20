import { Module, forwardRef } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import {
  BookingItems,
  Bookings,
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
import { BookingsModule } from '../../resources/bookings/bookings.module';
import { OrganizationSettingsModule } from '../../resources/organization-settings/organization-settings.module';
import { PublicVehicleTripsController } from './public-vehicle-trips.controller';
import { PublicVehicleTripsService } from './public-vehicle-trips.service';
import { PublicVehiclesController } from './public-vehicles.controller';
import { PublicVehiclesService } from './public-vehicles.service';
import { VehicleTripPaymentCloseScheduler } from './vehicle-trip-payment-close.scheduler';

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
      Bookings,
      Payments,
    ]),
    OrganizationSettingsModule,
    forwardRef(() => BookingsModule),
  ],
  controllers: [PublicVehiclesController, PublicVehicleTripsController],
  providers: [
    PublicVehiclesService,
    PublicVehicleTripsService,
    VehicleTripPaymentCloseScheduler,
  ],
  exports: [PublicVehiclesService, PublicVehicleTripsService],
})
export class PublicVehiclesModule {}
