import { Body, Controller, Delete, Get, Param, Post, Put } from '@nestjs/common';
import { FeishuService } from './feishu.service';
import type { FeishuManualRecordInput } from './feishu.service';

@Controller('api/feishu')
export class FeishuController {
  constructor(private readonly feishuService: FeishuService) {}

  @Get('latest')
  async getLatest() {
    return this.feishuService.getLatest();
  }

  @Get('records')
  async getRecords() {
    return this.feishuService.getRecords();
  }

  @Post('records')
  async createRecord(@Body() payload: FeishuManualRecordInput) {
    return this.feishuService.createRecord(payload);
  }

  @Put('records/:id')
  async updateRecord(
    @Param('id') id: string,
    @Body() payload: Partial<FeishuManualRecordInput>,
  ) {
    const updated = await this.feishuService.updateRecord(id, payload);
    if (!updated) {
      return { error: 'Record not found' };
    }
    return updated;
  }

  @Delete('records/:id')
  async deleteRecord(@Param('id') id: string) {
    const success = await this.feishuService.deleteRecord(id);
    return { success };
  }
}
