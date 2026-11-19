import { Injectable, Logger } from '@nestjs/common';
import { Cron, CronExpression } from '@nestjs/schedule';
import { PublicVehicleTripsService } from './public-vehicle-trips.service';

@Injectable()
export class VehicleTripPaymentCloseScheduler {
  private readonly logger = new Logger(VehicleTripPaymentCloseScheduler.name);

  constructor(private readonly tripsService: PublicVehicleTripsService) {}

  @Cron(CronExpression.EVERY_5_MINUTES)
  async closePastPaymentDeadlines(): Promise<void> {
    try {
      const result = await this.tripsService.closePastPaymentDeadlines();
      if (result.closedTrips > 0 || result.cancelledBookings > 0) {
        this.logger.log(
          `Vehicle trip payment close: ${result.closedTrips} trip(s), ${result.cancelledBookings} unpaid booking(s) cancelled`,
        );
      }
    } catch (err) {
      this.logger.error(
        `Vehicle trip payment close failed: ${
          err instanceof Error ? err.message : err
        }`,
      );
    }
  }
}
