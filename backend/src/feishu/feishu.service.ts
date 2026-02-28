import { Injectable, Logger } from '@nestjs/common';
import * as fs from 'fs';
import * as path from 'path';
import * as os from 'os';

export interface FeishuLatestData {
  date: string;
  stocks_hk_us_cny: number;
  usd_savings: number;
  funds_cny: number;
  balance_cny: number;
  provident_fund_cny: number;
  debt_cny: number;
  token_usd: number;
  defi_usd: number;
  total_cny: number;
  error?: string;
}

export interface FeishuManualRecord {
  id: string;
  date: string;
  domestic_usd: number;
  funds_cny: number;
  balance_cny: number;
  provident_fund_cny: number;
  debt_cny: number;
  created_at: number;
  updated_at: number;
}

export interface FeishuManualRecordInput {
  date: string;
  domestic_usd?: number;
  funds_cny?: number;
  balance_cny?: number;
  provident_fund_cny?: number;
  debt_cny?: number;
}

@Injectable()
export class FeishuService {
  private readonly logger = new Logger(FeishuService.name);
  private readonly feishuCsvPaths = [
    path.join(process.cwd(), '..', 'data', 'feishu-asset-cleaned.csv'),
    path.join(process.cwd(), 'data', 'feishu-asset-cleaned.csv'),
    path.resolve(__dirname, '../../../data/feishu-asset-cleaned.csv'),
    path.join(os.homedir(), 'Documents', 'futu-history', 'feishu-asset-cleaned.csv'),
  ];

  private readonly manualDataPaths = [
    path.join(process.cwd(), '..', 'data', 'feishu-manual.json'),
    path.join(process.cwd(), 'data', 'feishu-manual.json'),
    path.resolve(__dirname, '../../../data/feishu-manual.json'),
  ];

  private readonly legacyManualDataPaths = [
    path.resolve(__dirname, '../../../../data/feishu-manual.json'),
  ];

  private readonly DEFAULT_DOMESTIC_USD = 12687;

  private cachedData: FeishuLatestData | null = null;
  private lastFetchTime = 0;
  private readonly CACHE_TTL = 5 * 60 * 1000;

  async getLatest(): Promise<FeishuLatestData> {
    if (this.cachedData && Date.now() - this.lastFetchTime < this.CACHE_TTL) {
      return this.cachedData;
    }

    try {
      const records = this.loadManualRecords();
      if (records.length > 0) {
        const latestRecord = [...records].sort((a, b) => this.dateSortValue(b.date) - this.dateSortValue(a.date))[0];
        const latestData = this.toLatestData(latestRecord);
        this.cachedData = latestData;
        this.lastFetchTime = Date.now();
        return latestData;
      }

      const csvData = this.readLatestFromCsv();
      if (csvData) {
        this.cachedData = csvData;
        this.lastFetchTime = Date.now();
        return csvData;
      }

      return this.getFallbackData();
    } catch (error) {
      this.logger.error(`Failed to read Feishu data: ${error.message}`);
      return this.cachedData || this.getFallbackData();
    }
  }

  async getRecords(): Promise<FeishuManualRecord[]> {
    const records = this.loadManualRecords();
    return records.sort((a, b) => this.dateSortValue(b.date) - this.dateSortValue(a.date));
  }

  async createRecord(input: FeishuManualRecordInput): Promise<FeishuManualRecord> {
    const records = this.loadManualRecords();
    const normalized = this.normalizeInput(input);

    const existingByDate = records.find((item) => item.date === normalized.date);
    if (existingByDate) {
      existingByDate.domestic_usd = normalized.domestic_usd;
      existingByDate.funds_cny = normalized.funds_cny;
      existingByDate.balance_cny = normalized.balance_cny;
      existingByDate.provident_fund_cny = normalized.provident_fund_cny;
      existingByDate.debt_cny = normalized.debt_cny;
      existingByDate.updated_at = Date.now();
      this.saveManualRecords(records);
      this.clearCache();
      return existingByDate;
    }

    const now = Date.now();
    const created: FeishuManualRecord = {
      id: `${now}-${Math.random().toString(36).slice(2, 8)}`,
      ...normalized,
      created_at: now,
      updated_at: now,
    };

    records.push(created);
    this.saveManualRecords(records);
    this.clearCache();
    return created;
  }

  async updateRecord(id: string, input: Partial<FeishuManualRecordInput>): Promise<FeishuManualRecord | null> {
    const records = this.loadManualRecords();
    const target = records.find((item) => item.id === id);
    if (!target) {
      return null;
    }

    if (input.date !== undefined) {
      const normalizedDate = this.normalizeDate(input.date);
      if (normalizedDate) {
        target.date = normalizedDate;
      }
    }

    if (input.domestic_usd !== undefined) {
      target.domestic_usd = this.toNumber(input.domestic_usd);
    }
    if (input.funds_cny !== undefined) {
      target.funds_cny = this.toNumber(input.funds_cny);
    }
    if (input.balance_cny !== undefined) {
      target.balance_cny = this.toNumber(input.balance_cny);
    }
    if (input.provident_fund_cny !== undefined) {
      target.provident_fund_cny = this.toNumber(input.provident_fund_cny);
    }
    if (input.debt_cny !== undefined) {
      target.debt_cny = this.toNumber(input.debt_cny);
    }

    target.updated_at = Date.now();
    this.saveManualRecords(records);
    this.clearCache();
    return target;
  }

  async deleteRecord(id: string): Promise<boolean> {
    const records = this.loadManualRecords();
    const next = records.filter((item) => item.id !== id);
    if (next.length === records.length) {
      return false;
    }

    this.saveManualRecords(next);
    this.clearCache();
    return true;
  }

  clearCache() {
    this.cachedData = null;
    this.lastFetchTime = 0;
  }

  private toLatestData(record: FeishuManualRecord): FeishuLatestData {
    return {
      date: record.date,
      stocks_hk_us_cny: 0,
      usd_savings: record.domestic_usd,
      funds_cny: record.funds_cny,
      balance_cny: record.balance_cny,
      provident_fund_cny: record.provident_fund_cny,
      debt_cny: record.debt_cny,
      token_usd: 0,
      defi_usd: 0,
      total_cny:
        record.funds_cny +
        record.balance_cny +
        record.provident_fund_cny +
        record.debt_cny,
    };
  }

  private getFallbackData(): FeishuLatestData {
    if (this.cachedData) {
      return this.cachedData;
    }

    return {
      error: 'Feishu data unavailable',
      date: '',
      stocks_hk_us_cny: 0,
      usd_savings: 0,
      funds_cny: 0,
      balance_cny: 0,
      provident_fund_cny: 0,
      debt_cny: 0,
      token_usd: 0,
      defi_usd: 0,
      total_cny: 0,
    };
  }

  private resolveManualPath() {
    const existing = this.manualDataPaths.find((candidate) => fs.existsSync(candidate));
    if (existing) {
      return existing;
    }

    for (const legacyPath of this.legacyManualDataPaths) {
      if (!fs.existsSync(legacyPath)) {
        continue;
      }

      const target = this.manualDataPaths[0];
      try {
        fs.mkdirSync(path.dirname(target), { recursive: true });
        fs.copyFileSync(legacyPath, target);
        this.logger.warn(`Migrated legacy manual Feishu data from ${legacyPath} to ${target}`);
        return target;
      } catch (error) {
        this.logger.warn(`Failed to migrate legacy manual Feishu data ${legacyPath}: ${error.message}`);
      }
    }

    const target = this.manualDataPaths[0];
    fs.mkdirSync(path.dirname(target), { recursive: true });
    return target;
  }

  private loadManualRecords(): FeishuManualRecord[] {
    const manualPath = this.resolveManualPath();

    if (fs.existsSync(manualPath)) {
      try {
        const raw = fs.readFileSync(manualPath, 'utf8').trim();
        if (!raw) {
          return [];
        }

        const parsed = JSON.parse(raw);
        const records = Array.isArray(parsed) ? parsed : Array.isArray(parsed?.records) ? parsed.records : [];

        return records
          .map((item: any) => this.normalizeRecord(item))
          .filter((item: FeishuManualRecord | null): item is FeishuManualRecord => Boolean(item));
      } catch (error) {
        this.logger.warn(`Failed to parse manual Feishu data ${manualPath}: ${error.message}`);
      }
    }

    const csvData = this.readLatestFromCsv();
    if (csvData) {
      const now = Date.now();
      const seedRecord: FeishuManualRecord = {
        id: `seed-${now}`,
        date: this.normalizeDate(csvData.date) || new Date(now).toISOString().slice(0, 10),
        domestic_usd: this.toNumber(csvData.usd_savings),
        funds_cny: this.toNumber(csvData.funds_cny),
        balance_cny: this.toNumber(csvData.balance_cny),
        provident_fund_cny: this.toNumber(csvData.provident_fund_cny),
        debt_cny: this.toNumber(csvData.debt_cny),
        created_at: now,
        updated_at: now,
      };
      this.saveManualRecords([seedRecord]);
      return [seedRecord];
    }

    return [];
  }

  private saveManualRecords(records: FeishuManualRecord[]) {
    const manualPath = this.resolveManualPath();
    fs.writeFileSync(manualPath, `${JSON.stringify(records, null, 2)}\n`, 'utf8');
  }

  private normalizeRecord(input: any): FeishuManualRecord | null {
    const date = this.normalizeDate(input?.date);
    if (!date) {
      return null;
    }

    const now = Date.now();
    return {
      id: String(input?.id || `${now}-${Math.random().toString(36).slice(2, 8)}`),
      date,
      domestic_usd: this.toNumber(input?.domestic_usd ?? input?.usd_savings ?? this.DEFAULT_DOMESTIC_USD),
      funds_cny: this.toNumber(input?.funds_cny),
      balance_cny: this.toNumber(input?.balance_cny),
      provident_fund_cny: this.toNumber(input?.provident_fund_cny),
      debt_cny: this.toNumber(input?.debt_cny),
      created_at: Number(input?.created_at || now),
      updated_at: Number(input?.updated_at || now),
    };
  }

  private normalizeInput(input: FeishuManualRecordInput) {
    const normalizedDate = this.normalizeDate(input?.date);
    if (!normalizedDate) {
      throw new Error('date is required');
    }

    return {
      date: normalizedDate,
      domestic_usd: this.toNumber(input?.domestic_usd ?? this.DEFAULT_DOMESTIC_USD),
      funds_cny: this.toNumber(input?.funds_cny),
      balance_cny: this.toNumber(input?.balance_cny),
      provident_fund_cny: this.toNumber(input?.provident_fund_cny),
      debt_cny: this.toNumber(input?.debt_cny),
    };
  }

  private toNumber(value: unknown) {
    const num = Number(value ?? 0);
    return Number.isFinite(num) ? num : 0;
  }

  private normalizeDate(value: string | undefined | null) {
    if (!value) {
      return '';
    }
    return String(value).trim().replace(/\./g, '-').replace(/\//g, '-');
  }

  private dateSortValue(value: string) {
    const normalized = this.normalizeDate(value);
    const time = Date.parse(normalized);
    return Number.isFinite(time) ? time : 0;
  }

  private readLatestFromCsv(): FeishuLatestData | null {
    for (const csvPath of this.feishuCsvPaths) {
      if (!fs.existsSync(csvPath)) {
        continue;
      }

      try {
        const content = fs.readFileSync(csvPath, 'utf8');
        const lines = content.split(/\r?\n/).filter((line) => line.trim().length > 0);
        if (lines.length < 2) {
          continue;
        }

        const headers = this.splitCsvLine(lines[0]).map((h) => h.trim());
        const lastLine = lines[lines.length - 1];
        const values = this.splitCsvLine(lastLine).map((v) => v.trim());

        const normalize = (input: string) => input.toLowerCase().replace(/\s+/g, '');
        const headerIndex = new Map<string, number>();
        headers.forEach((header, idx) => {
          headerIndex.set(normalize(header), idx);
        });

        const getValue = (key: string) => {
          const idx = headerIndex.get(normalize(key));
          if (idx === undefined) {
            return '';
          }
          return values[idx] ?? '';
        };

        const parseNumber = (input: string) => {
          if (!input) return 0;
          const cleaned = String(input).replace(/,/g, '').trim();
          const num = Number(cleaned);
          return Number.isFinite(num) ? num : 0;
        };

        this.logger.log(`Feishu CSV loaded from ${csvPath}`);
        return {
          date: getValue('日期'),
          stocks_hk_us_cny: parseNumber(getValue('港美股')),
          usd_savings: parseNumber(getValue('美元')),
          funds_cny: parseNumber(getValue('基金')),
          balance_cny: parseNumber(getValue('余额')),
          provident_fund_cny: parseNumber(getValue('公积金账户')),
          debt_cny: parseNumber(getValue('外债')),
          token_usd: parseNumber(getValue('token')),
          defi_usd: parseNumber(getValue('defi usd')),
          total_cny: parseNumber(getValue('总计')),
        };
      } catch (error) {
        this.logger.warn(`Failed reading Feishu CSV at ${csvPath}: ${error.message}`);
      }
    }

    return null;
  }

  private splitCsvLine(line: string) {
    const values: string[] = [];
    let current = '';
    let inQuotes = false;

    for (let index = 0; index < line.length; index += 1) {
      const char = line[index];

      if (char === '"') {
        const nextChar = line[index + 1];
        if (inQuotes && nextChar === '"') {
          current += '"';
          index += 1;
        } else {
          inQuotes = !inQuotes;
        }
        continue;
      }

      if (char === ',' && !inQuotes) {
        values.push(current);
        current = '';
        continue;
      }

      current += char;
    }

    values.push(current);
    return values;
  }
}
