import { Injectable, Logger } from '@nestjs/common';
import { ethers } from 'ethers';
import axios from 'axios';
import * as fs from 'fs';
import * as path from 'path';

export interface ChainAsset {
  chain: string;
  symbol: string;
  balance: number;
  value_usd: number;
  price: number;
  address?: string;
}

interface WalletConfig {
  name: string;
  address: string;
  chains: string[];
}

interface SecretsConfig {
  defi_wallets?: WalletConfig[];
}

interface ChainConfig {
  name: string;
  rpc: string;
  nativeSymbol: string;
  chainId: number;
}

interface TokenConfig {
  symbol: string;
  address: string;
  decimals: number;
}

@Injectable()
export class ChainService {
  private readonly logger = new Logger(ChainService.name);
  private secrets: SecretsConfig;
  private readonly providerCache: Record<string, ethers.JsonRpcProvider> = {};

  private readonly chains: Record<string, ChainConfig> = {
    eth: {
      name: 'Ethereum',
      rpc: 'https://eth.llamarpc.com',
      nativeSymbol: 'ETH',
      chainId: 1,
    },
    bsc: {
      name: 'BNB Chain',
      rpc: 'https://bsc-dataseed.binance.org',
      nativeSymbol: 'BNB',
      chainId: 56,
    },
    arbitrum: {
      name: 'Arbitrum',
      rpc: 'https://arb1.arbitrum.io/rpc',
      nativeSymbol: 'ETH',
      chainId: 42161,
    },
    optimism: {
      name: 'Optimism',
      rpc: 'https://mainnet.optimism.io',
      nativeSymbol: 'ETH',
      chainId: 10,
    },
    polygon: {
      name: 'Polygon',
      rpc: 'https://polygon-rpc.com',
      nativeSymbol: 'MATIC',
      chainId: 137,
    },
    base: {
      name: 'Base',
      rpc: 'https://mainnet.base.org',
      nativeSymbol: 'ETH',
      chainId: 8453,
    },
    hyperevm: {
      name: 'HyperEVM',
      rpc: 'https://hyperevm.hyperliquid.xyz',
      nativeSymbol: 'HYPE',
      chainId: 998,
    },
  };

  private readonly stableTokens: Record<string, TokenConfig[]> = {
    eth: [
      { symbol: 'USDT', address: '0xdAC17F958D2ee523a2206206994597C13D831ec7', decimals: 6 },
      { symbol: 'USDC', address: '0xA0b86991c6218b36c1d19D4a2e9Eb0cE3606eB48', decimals: 6 },
    ],
    bsc: [
      { symbol: 'USDT', address: '0x55d398326f99059fF775485246999027B3197955', decimals: 18 },
      { symbol: 'USDC', address: '0x8AC76a51cc950d9822D68b83fE1Ad97B32Cd580d', decimals: 18 },
    ],
    arbitrum: [
      { symbol: 'USDT', address: '0xFd086bC7CD5C481DCC9C85ebE478A1C0b69FCbb9', decimals: 6 },
      { symbol: 'USDC', address: '0xaf88d065e77c8cC2239327C5EDb3A432268e5831', decimals: 6 },
    ],
    optimism: [
      { symbol: 'USDT', address: '0x94b008aA00579c1307B0EF2c499a98a35965995B', decimals: 6 },
      { symbol: 'USDC', address: '0x0b2C639c53a9AD698533b4384aC260403554627b', decimals: 6 },
    ],
    polygon: [
      { symbol: 'USDT', address: '0xc2132D05D31c914a87C6611C10748AEb04B58e8F', decimals: 6 },
      { symbol: 'USDC', address: '0x3c499c542cEF5E3811e1192ce70d8cC03d5c3359', decimals: 6 },
    ],
    base: [
      { symbol: 'USDC', address: '0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913', decimals: 6 },
    ],
    hyperevm: [
      { symbol: 'USDC', address: '0x6d1e7cde53d3206678230c0204241331a6152fd3', decimals: 6 },
    ],
  };

  private readonly priceFallback: Record<string, number> = {
    ETH: 2800,
    BNB: 300,
    MATIC: 0.8,
    HYPE: 34,
  };

  private readonly priceCache: Record<string, { price: number; ts: number }> = {};
  private readonly PRICE_TTL = 5 * 60 * 1000;

  private readonly ERC20_ABI = [
    'function balanceOf(address owner) view returns (uint256)',
  ];

  constructor() {
    this.loadSecrets();
  }

  private getProvider(chainKey: string): ethers.JsonRpcProvider | null {
    const config = this.chains[chainKey];
    if (!config) {
      return null;
    }

    const cached = this.providerCache[chainKey];
    if (cached) {
      return cached;
    }

    const provider = new ethers.JsonRpcProvider(
      config.rpc,
      { name: chainKey, chainId: config.chainId },
      { staticNetwork: true },
    );

    this.providerCache[chainKey] = provider;
    return provider;
  }

  private async getPriceUsd(symbol: string): Promise<number> {
    const now = Date.now();
    const cached = this.priceCache[symbol];
    if (cached && now - cached.ts < this.PRICE_TTL) {
      return cached.price;
    }

    const ids: Record<string, string> = {
      ETH: 'ethereum',
      BNB: 'binancecoin',
      MATIC: 'matic-network',
      HYPE: 'hyperliquid',
    };

    const id = ids[symbol];
    if (id) {
      try {
        const resp = await axios.get(
          `https://api.coingecko.com/api/v3/simple/price?ids=${id}&vs_currencies=usd`,
          { timeout: 5000 },
        );
        const price = Number(resp.data?.[id]?.usd);
        if (price > 0) {
          this.priceCache[symbol] = { price, ts: now };
          return price;
        }
      } catch (error) {
        this.logger.warn(`Price fetch failed for ${symbol}: ${error.message}`);
      }
    }

    const fallback = this.priceFallback[symbol] || 0;
    this.priceCache[symbol] = { price: fallback, ts: now };
    return fallback;
  }

  private loadSecrets() {
    try {
      const candidates = [
        path.resolve(__dirname, '../../../config/secrets.json'),
        path.join(process.cwd(), '..', 'config', 'secrets.json'),
        path.join(process.cwd(), 'config', 'secrets.json'),
      ];

      const configPath = candidates.find((candidate) => fs.existsSync(candidate));
      if (configPath) {
        this.secrets = JSON.parse(fs.readFileSync(configPath, 'utf8'));
        this.logger.log(`Secrets loaded successfully from ${configPath}`);
      } else {
        this.logger.warn('secrets.json not found, using empty config');
        this.secrets = {};
      }
    } catch (error) {
      this.logger.error('Failed to load secrets:', error);
      this.secrets = {};
    }
  }

  async getChainBalance(chainKey: string, address: string): Promise<ChainAsset | null> {
    const config = this.chains[chainKey];
    if (!config) {
      this.logger.warn(`Unknown chain: ${chainKey}`);
      return null;
    }

    try {
      const provider = this.getProvider(chainKey);
      if (!provider) {
        return null;
      }
      const balanceWei = await provider.getBalance(address);
      const balance = parseFloat(ethers.formatEther(balanceWei));

      if (balance < 0.0001) {
        return null;
      }

      const price = await this.getPriceUsd(config.nativeSymbol);
      const value_usd = balance * price;

      this.logger.log(`${config.name}: ${balance.toFixed(4)} ${config.nativeSymbol} ($${value_usd.toFixed(2)})`);

      return {
        chain: config.name,
        symbol: config.nativeSymbol,
        balance,
        price,
        value_usd,
        address,
      };
    } catch (error) {
      this.logger.error(`Failed to fetch balance for ${config.name}:`, error.message);
      return null;
    }
  }

  private async getTokenBalances(chainKey: string, address: string): Promise<ChainAsset[]> {
    const config = this.chains[chainKey];
    const tokens = this.stableTokens[chainKey] || [];
    if (!config || tokens.length === 0) {
      return [];
    }

    const provider = this.getProvider(chainKey);
    if (!provider) {
      return [];
    }
    const assets: ChainAsset[] = [];

    for (const token of tokens) {
      try {
        const contract = new ethers.Contract(token.address, this.ERC20_ABI, provider);
        const balanceRaw = await contract.balanceOf(address);
        const balance = parseFloat(ethers.formatUnits(balanceRaw, token.decimals));
        if (balance <= 0) {
          continue;
        }
        const valueUsd = balance;
        if (valueUsd < 1) {
          continue;
        }
        assets.push({
          chain: config.name,
          symbol: token.symbol,
          balance,
          price: 1,
          value_usd: valueUsd,
          address,
        });
      } catch (error) {
        this.logger.warn(`Failed token balance ${token.symbol} on ${config.name}: ${error.message}`);
      }
    }

    return assets;
  }

  async getAllChainBalances(): Promise<ChainAsset[]> {
    if (!this.secrets.defi_wallets || this.secrets.defi_wallets.length === 0) {
      this.logger.warn('No DeFi wallets configured');
      return [];
    }

    const assets: ChainAsset[] = [];

    for (const wallet of this.secrets.defi_wallets) {
      this.logger.log(`Scanning wallet: ${wallet.name} (${wallet.address})`);

      const balancePromises = wallet.chains.map((chain) =>
        this.getChainBalance(chain, wallet.address)
      );

      const balances = await Promise.all(balancePromises);

      for (const balance of balances) {
        if (balance) {
          assets.push(balance);
        }
      }

      for (const chain of wallet.chains) {
        const tokenAssets = await this.getTokenBalances(chain, wallet.address);
        if (tokenAssets.length > 0) {
          assets.push(...tokenAssets);
        }
      }
    }

    const totalValue = assets.reduce((sum, a) => sum + a.value_usd, 0);
    this.logger.log(`Total chain assets: ${assets.length}, Total value: $${totalValue.toFixed(2)}`);

    return assets;
  }

  async getChainAssets(chainKey: string): Promise<ChainAsset[]> {
    if (!this.secrets.defi_wallets || this.secrets.defi_wallets.length === 0) {
      return [];
    }

    const assets: ChainAsset[] = [];

    for (const wallet of this.secrets.defi_wallets) {
      if (wallet.chains.includes(chainKey)) {
        const balance = await this.getChainBalance(chainKey, wallet.address);
        if (balance) {
          assets.push(balance);
        }
        const tokenAssets = await this.getTokenBalances(chainKey, wallet.address);
        if (tokenAssets.length > 0) {
          assets.push(...tokenAssets);
        }
      }
    }

    return assets;
  }
}
