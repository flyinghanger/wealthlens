import { Controller, Get } from '@nestjs/common';
import { RatesService } from './rates.service';

@Controller('api/rates')
export class RatesController {
  constructor(private readonly ratesService: RatesService) {}

  @Get()
  async getRates() {
    return this.ratesService.getRates();
  }
}
