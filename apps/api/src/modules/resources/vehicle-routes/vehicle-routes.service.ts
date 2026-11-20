import {
  BadRequestException,
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { In, IsNull, Not, Repository } from 'typeorm';
import { PaginatedResult } from '../../../common/dto/pagination-query.dto';
import { CrudService } from '../../../common/crud/crud.service';
import { newId } from '../../../common/utils/uuid';
import {
  VehicleRoutePriceTiers,
  VehicleRoutes,
  Vehicles,
} from '../../../entities/generated';
import { CreateVehicleRouteDto } from './dto/create-vehicle-route.dto';
import { UpdateVehicleRouteDto } from './dto/update-vehicle-route.dto';
import {
  CreateVehicleRoutePriceTierDto,
  UpdateVehicleRoutePriceTierDto,
  VehicleRoutePriceTierInputDto,
  VehicleRoutePriceTiersListQueryDto,
} from './dto/vehicle-route-price-tier.dto';
import { VehicleRoutesListQueryDto } from './dto/vehicle-routes-list-query.dto';

type VehicleRouteWithTiers = VehicleRoutes & {
  priceTiers?: VehicleRoutePriceTiers[];
};

function normalizeCity(value: string): string {
  return value.trim().replace(/\s+/g, ' ');
}

@Injectable()
export class VehicleRoutesService extends CrudService<VehicleRoutes> {
  constructor(
    @InjectRepository(VehicleRoutes)
    private readonly vehicleRoutesRepository: Repository<VehicleRoutes>,
    @InjectRepository(Vehicles)
    private readonly vehiclesRepository: Repository<Vehicles>,
    @InjectRepository(VehicleRoutePriceTiers)
    private readonly priceTiersRepository: Repository<VehicleRoutePriceTiers>,
  ) {
    super(vehicleRoutesRepository);
  }

  override async findAll(
    query: VehicleRoutesListQueryDto,
  ): Promise<PaginatedResult<VehicleRouteWithTiers>> {
    const page = query.page ?? 1;
    const limit = query.limit ?? 20;

    const qb = this.vehicleRoutesRepository
      .createQueryBuilder('route')
      .where('route.deletedAt IS NULL');

    if (query.vehicleId) {
      qb.andWhere('route.vehicleId = :vehicleId', { vehicleId: query.vehicleId });
    }
    if (query.departureCity?.trim()) {
      qb.andWhere('route.departureCity LIKE :departureCity', {
        departureCity: `%${normalizeCity(query.departureCity)}%`,
      });
    }
    if (query.arrivalCity?.trim()) {
      qb.andWhere('route.arrivalCity LIKE :arrivalCity', {
        arrivalCity: `%${normalizeCity(query.arrivalCity)}%`,
      });
    }

    const search = query.search?.trim();
    if (search) {
      qb.andWhere(
        '(route.departureCity LIKE :term OR route.arrivalCity LIKE :term)',
        { term: `%${search}%` },
      );
    }

    if (query.active !== undefined) {
      qb.andWhere('route.active = :active', {
        active: query.active ? 1 : 0,
      });
    }

    qb.orderBy('route.createdAt', 'DESC')
      .skip((page - 1) * limit)
      .take(limit);

    const [data, total] = await qb.getManyAndCount();
    const withTiers = query.includePriceTiers
      ? await this.attachPriceTiers(data)
      : data;

    return {
      data: withTiers,
      meta: {
        total,
        page,
        limit,
        totalPages: Math.ceil(total / limit) || 1,
      },
    };
  }

  async findOneWithTiers(id: string): Promise<VehicleRouteWithTiers> {
    const route = await this.findOne(id);
    if (route.deletedAt) {
      throw new NotFoundException(`Resource ${id} not found`);
    }
    const [withTiers] = await this.attachPriceTiers([route]);
    return withTiers;
  }

  async createRoute(dto: CreateVehicleRouteDto): Promise<VehicleRouteWithTiers> {
    await this.assertVehicleExists(dto.vehicleId);
    const departureCity = normalizeCity(dto.departureCity);
    const arrivalCity = normalizeCity(dto.arrivalCity);
    this.assertDistinctCities(departureCity, arrivalCity);
    await this.assertUniqueRoute(dto.vehicleId, departureCity, arrivalCity);

    const tiersInput =
      dto.priceTiers && dto.priceTiers.length > 0
        ? dto.priceTiers
        : [{ minPassengers: 1, maxPassengers: 1, priceCents: dto.priceCents }];
    this.assertValidTierBands(tiersInput);

    const route = await this.create({
      vehicleId: dto.vehicleId,
      departureCity,
      arrivalCity,
      priceCents: dto.priceCents,
      currency: dto.currency.toUpperCase(),
      active: dto.active === false ? 0 : 1,
    });

    await this.replacePriceTiers(route.id, tiersInput);
    return this.findOneWithTiers(route.id);
  }

  async updateRoute(
    id: string,
    dto: UpdateVehicleRouteDto,
  ): Promise<VehicleRouteWithTiers> {
    const existing = await this.findOne(id);
    if (existing.deletedAt) {
      throw new NotFoundException(`Resource ${id} not found`);
    }

    const departureCity =
      dto.departureCity !== undefined
        ? normalizeCity(dto.departureCity)
        : existing.departureCity;
    const arrivalCity =
      dto.arrivalCity !== undefined
        ? normalizeCity(dto.arrivalCity)
        : existing.arrivalCity;

    this.assertDistinctCities(departureCity, arrivalCity);
    await this.assertUniqueRoute(existing.vehicleId, departureCity, arrivalCity, id);

    if (dto.priceTiers !== undefined) {
      if (!dto.priceTiers.length) {
        throw new BadRequestException(
          'Au moins un palier tarifaire est requis.',
        );
      }
      this.assertValidTierBands(dto.priceTiers);
    }

    await this.update(id, {
      ...(dto.departureCity !== undefined ? { departureCity } : {}),
      ...(dto.arrivalCity !== undefined ? { arrivalCity } : {}),
      ...(dto.priceCents !== undefined ? { priceCents: dto.priceCents } : {}),
      ...(dto.currency !== undefined ? { currency: dto.currency.toUpperCase() } : {}),
      ...(dto.active !== undefined ? { active: dto.active ? 1 : 0 } : {}),
    });

    if (dto.priceTiers !== undefined) {
      await this.replacePriceTiers(id, dto.priceTiers);
    }

    return this.findOneWithTiers(id);
  }

  async listPriceTiers(
    query: VehicleRoutePriceTiersListQueryDto,
  ): Promise<PaginatedResult<VehicleRoutePriceTiers>> {
    const page = query.page ?? 1;
    const limit = query.limit ?? 50;

    const qb = this.priceTiersRepository
      .createQueryBuilder('tier')
      .where('tier.deletedAt IS NULL');

    if (query.routeId) {
      qb.andWhere('tier.routeId = :routeId', { routeId: query.routeId });
    }

    qb.orderBy('tier.minPassengers', 'ASC')
      .addOrderBy('tier.maxPassengers', 'ASC')
      .skip((page - 1) * limit)
      .take(limit);

    const [data, total] = await qb.getManyAndCount();
    return {
      data,
      meta: {
        total,
        page,
        limit,
        totalPages: Math.ceil(total / limit) || 1,
      },
    };
  }

  async createPriceTier(
    dto: CreateVehicleRoutePriceTierDto,
  ): Promise<VehicleRoutePriceTiers> {
    await this.assertRouteExists(dto.routeId);
    const input: VehicleRoutePriceTierInputDto = {
      minPassengers: dto.minPassengers,
      maxPassengers: dto.maxPassengers,
      priceCents: dto.priceCents,
    };
    const existing = await this.loadActiveTiers(dto.routeId);
    this.assertValidTierBands([...existing.map(toInput), input]);

    const entity = this.priceTiersRepository.create({
      id: newId(),
      routeId: dto.routeId,
      ...input,
    });
    return this.priceTiersRepository.save(entity);
  }

  async updatePriceTier(
    id: string,
    dto: UpdateVehicleRoutePriceTierDto,
  ): Promise<VehicleRoutePriceTiers> {
    const existing = await this.priceTiersRepository.findOne({
      where: { id, deletedAt: IsNull() },
    });
    if (!existing) {
      throw new NotFoundException(`Resource ${id} not found`);
    }

    const next: VehicleRoutePriceTierInputDto = {
      minPassengers: dto.minPassengers ?? existing.minPassengers,
      maxPassengers: dto.maxPassengers ?? existing.maxPassengers,
      priceCents: dto.priceCents ?? existing.priceCents,
    };

    const siblings = (await this.loadActiveTiers(existing.routeId)).filter(
      (tier) => tier.id !== id,
    );
    this.assertValidTierBands([...siblings.map(toInput), next]);

    existing.minPassengers = next.minPassengers;
    existing.maxPassengers = next.maxPassengers;
    existing.priceCents = next.priceCents;
    return this.priceTiersRepository.save(existing);
  }

  async removePriceTier(id: string): Promise<void> {
    const existing = await this.priceTiersRepository.findOne({
      where: { id, deletedAt: IsNull() },
    });
    if (!existing) {
      throw new NotFoundException(`Resource ${id} not found`);
    }
    const siblings = (await this.loadActiveTiers(existing.routeId)).filter(
      (tier) => tier.id !== id,
    );
    if (!siblings.length) {
      throw new BadRequestException(
        'Impossible de supprimer le dernier palier tarifaire.',
      );
    }
    await this.priceTiersRepository.softDelete(id);
  }

  async replacePriceTiersForRoute(
    routeId: string,
    tiers: VehicleRoutePriceTierInputDto[],
  ): Promise<VehicleRoutePriceTiers[]> {
    await this.assertRouteExists(routeId);
    this.assertValidTierBands(tiers);
    await this.replacePriceTiers(routeId, tiers);
    return this.loadActiveTiers(routeId);
  }

  private async replacePriceTiers(
    routeId: string,
    tiers: VehicleRoutePriceTierInputDto[],
  ): Promise<void> {
    const existing = await this.loadActiveTiers(routeId);
    if (existing.length) {
      await this.priceTiersRepository.softDelete(existing.map((tier) => tier.id));
    }
    const rows = tiers.map((tier) =>
      this.priceTiersRepository.create({
        id: newId(),
        routeId,
        minPassengers: tier.minPassengers,
        maxPassengers: tier.maxPassengers,
        priceCents: tier.priceCents,
      }),
    );
    await this.priceTiersRepository.save(rows);
  }

  private async attachPriceTiers(
    routes: VehicleRoutes[],
  ): Promise<VehicleRouteWithTiers[]> {
    if (!routes.length) {
      return [];
    }
    const routeIds = routes.map((route) => route.id);
    const tiers = await this.priceTiersRepository.find({
      where: { routeId: In(routeIds), deletedAt: IsNull() },
      order: { minPassengers: 'ASC', maxPassengers: 'ASC' },
    });
    const byRoute = new Map<string, VehicleRoutePriceTiers[]>();
    for (const tier of tiers) {
      const list = byRoute.get(tier.routeId) ?? [];
      list.push(tier);
      byRoute.set(tier.routeId, list);
    }
    return routes.map((route) => ({
      ...route,
      priceTiers: byRoute.get(route.id) ?? [],
    }));
  }

  private async loadActiveTiers(
    routeId: string,
  ): Promise<VehicleRoutePriceTiers[]> {
    return this.priceTiersRepository.find({
      where: { routeId, deletedAt: IsNull() },
      order: { minPassengers: 'ASC', maxPassengers: 'ASC' },
    });
  }

  private assertValidTierBands(tiers: VehicleRoutePriceTierInputDto[]): void {
    if (!tiers.length) {
      throw new BadRequestException('Au moins un palier tarifaire est requis.');
    }

    const normalized = tiers
      .map((tier) => ({
        minPassengers: tier.minPassengers,
        maxPassengers: tier.maxPassengers,
        priceCents: tier.priceCents,
      }))
      .sort((a, b) => a.minPassengers - b.minPassengers);

    for (const tier of normalized) {
      if (tier.minPassengers > tier.maxPassengers) {
        throw new BadRequestException(
          'Chaque palier doit avoir minPassengers ≤ maxPassengers.',
        );
      }
      if (tier.priceCents < 0) {
        throw new BadRequestException('Le prix d’un palier ne peut pas être négatif.');
      }
    }

    for (let i = 0; i < normalized.length; i += 1) {
      for (let j = i + 1; j < normalized.length; j += 1) {
        const a = normalized[i];
        const b = normalized[j];
        const overlaps =
          a.minPassengers <= b.maxPassengers && b.minPassengers <= a.maxPassengers;
        if (overlaps) {
          throw new BadRequestException(
            'Les paliers tarifaires ne doivent pas se chevaucher.',
          );
        }
      }
    }
  }

  private async assertVehicleExists(vehicleId: string): Promise<void> {
    const vehicle = await this.vehiclesRepository.findOne({
      where: { id: vehicleId, deletedAt: IsNull() },
    });
    if (!vehicle) {
      throw new NotFoundException('Véhicule introuvable.');
    }
  }

  private async assertRouteExists(routeId: string): Promise<void> {
    const route = await this.vehicleRoutesRepository.findOne({
      where: { id: routeId, deletedAt: IsNull() },
    });
    if (!route) {
      throw new NotFoundException('Tronçon introuvable.');
    }
  }

  private assertDistinctCities(departureCity: string, arrivalCity: string): void {
    if (!departureCity || !arrivalCity) {
      throw new BadRequestException('Départ et arrivée sont obligatoires.');
    }
    if (departureCity.toLowerCase() === arrivalCity.toLowerCase()) {
      throw new BadRequestException(
        'La ville de départ et d’arrivée doivent être distinctes.',
      );
    }
  }

  private async assertUniqueRoute(
    vehicleId: string,
    departureCity: string,
    arrivalCity: string,
    excludeId?: string,
  ): Promise<void> {
    const existing = await this.vehicleRoutesRepository.findOne({
      where: {
        vehicleId,
        departureCity,
        arrivalCity,
        deletedAt: IsNull(),
        ...(excludeId ? { id: Not(excludeId) } : {}),
      },
    });
    if (existing) {
      throw new ConflictException(
        'Un tronçon existe déjà pour ce véhicule et ce couple départ / arrivée.',
      );
    }
  }
}

function toInput(tier: VehicleRoutePriceTiers): VehicleRoutePriceTierInputDto {
  return {
    minPassengers: tier.minPassengers,
    maxPassengers: tier.maxPassengers,
    priceCents: tier.priceCents,
  };
}
