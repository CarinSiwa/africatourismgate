import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  Patch,
  Post,
  Put,
  Query,
} from '@nestjs/common';
import { ApiOperation, ApiTags } from '@nestjs/swagger';
import { CreateVehicleRouteDto } from './dto/create-vehicle-route.dto';
import { UpdateVehicleRouteDto } from './dto/update-vehicle-route.dto';
import {
  CreateVehicleRoutePriceTierDto,
  ReplaceVehicleRoutePriceTiersDto,
  UpdateVehicleRoutePriceTierDto,
  VehicleRoutePriceTiersListQueryDto,
} from './dto/vehicle-route-price-tier.dto';
import { VehicleRoutesListQueryDto } from './dto/vehicle-routes-list-query.dto';
import { VehicleRoutesService } from './vehicle-routes.service';

@ApiTags('vehicle-routes')
@Controller('vehicle-routes')
export class VehicleRoutesController {
  constructor(private readonly service: VehicleRoutesService) {}

  @Get()
  @ApiOperation({ summary: 'List vehicle routes (tronçons)' })
  findAll(@Query() query: VehicleRoutesListQueryDto) {
    return this.service.findAll(query);
  }

  // Static "price-tiers" paths before ":id" to avoid param capture.
  @Get('price-tiers')
  @ApiOperation({ summary: 'List vehicle route price tiers' })
  listPriceTiers(@Query() query: VehicleRoutePriceTiersListQueryDto) {
    return this.service.listPriceTiers(query);
  }

  @Post('price-tiers')
  @ApiOperation({ summary: 'Create a price tier for a route' })
  createPriceTier(@Body() dto: CreateVehicleRoutePriceTierDto) {
    return this.service.createPriceTier(dto);
  }

  @Patch('price-tiers/:tierId')
  @ApiOperation({ summary: 'Update a price tier' })
  updatePriceTier(
    @Param('tierId') tierId: string,
    @Body() dto: UpdateVehicleRoutePriceTierDto,
  ) {
    return this.service.updatePriceTier(tierId, dto);
  }

  @Delete('price-tiers/:tierId')
  @ApiOperation({ summary: 'Soft-delete a price tier' })
  removePriceTier(@Param('tierId') tierId: string) {
    return this.service.removePriceTier(tierId);
  }

  @Get(':id/price-tiers')
  @ApiOperation({ summary: 'List price tiers for a route' })
  listPriceTiersForRoute(
    @Param('id') id: string,
    @Query() query: VehicleRoutePriceTiersListQueryDto,
  ) {
    return this.service.listPriceTiers({ ...query, routeId: id });
  }

  @Put(':id/price-tiers')
  @ApiOperation({ summary: 'Replace all price tiers for a route' })
  replacePriceTiers(
    @Param('id') id: string,
    @Body() dto: ReplaceVehicleRoutePriceTiersDto,
  ) {
    return this.service.replacePriceTiersForRoute(id, dto.priceTiers);
  }

  @Get(':id')
  @ApiOperation({ summary: 'Get vehicle route by id (includes price tiers)' })
  findOne(@Param('id') id: string) {
    return this.service.findOneWithTiers(id);
  }

  @Post()
  @ApiOperation({ summary: 'Create vehicle route (tronçon)' })
  create(@Body() dto: CreateVehicleRouteDto) {
    return this.service.createRoute(dto);
  }

  @Patch(':id')
  @ApiOperation({ summary: 'Update vehicle route' })
  update(@Param('id') id: string, @Body() dto: UpdateVehicleRouteDto) {
    return this.service.updateRoute(id, dto);
  }

  @Delete(':id')
  @ApiOperation({ summary: 'Soft-delete vehicle route' })
  remove(@Param('id') id: string) {
    return this.service.remove(id);
  }
}
