import Link from 'next/link';

export default function Home() {
  return (
    <div className="flex min-h-screen flex-col items-center justify-center bg-gray-950">
      <div className="text-center">
        <h1 className="text-5xl font-bold bg-gradient-to-r from-blue-400 to-emerald-400 bg-clip-text text-transparent">
          Wealth Dashboard
        </h1>
        <p className="mt-4 text-gray-400">
          现代化财富管理仪表盘
        </p>
        <div className="mt-8">
          <Link
            href="/dashboard"
            className="inline-block rounded-lg bg-blue-600 px-6 py-3 font-semibold text-white transition hover:bg-blue-700"
          >
            进入 Dashboard →
          </Link>
        </div>
        <div className="mt-12 grid gap-4 text-left text-sm text-gray-500 max-w-md">
          <div className="flex items-start gap-2">
            <span className="text-blue-400">✓</span>
            <span>实时股票持仓数据</span>
          </div>
          <div className="flex items-start gap-2">
            <span className="text-emerald-400">✓</span>
            <span>加密货币资产聚合</span>
          </div>
          <div className="flex items-start gap-2">
            <span className="text-purple-400">✓</span>
            <span>链上资产追踪</span>
          </div>
        </div>
      </div>
    </div>
  );
}
