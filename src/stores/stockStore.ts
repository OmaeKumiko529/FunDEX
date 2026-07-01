import { defineStore } from 'pinia';
import { ref, computed } from 'vue';
import type { StockInfo, StockDaily, StockSnapshot } from '@/types/stock';

// 使用相对路径，由 Vite Dev Server 的 proxy 转发到后端
// 本机、WiFi ADB、虚拟机三种场景都可用，无需修改配置
const API_BASE = '/api';

/**
 * 股票数据 Pinia Store
 *
 * 管理股票基本信息、日K历史、实时快照。
 * 与 fundStore 并行，独立管理股票相关状态。
 */
export const useStockStore = defineStore('stock', () => {
  // ─── 状态 ───

  /** 股票基本信息列表 */
  const stocks = ref<StockInfo[]>([]);

  /** 股票日K数据缓存：{ [stock_code]: StockDaily[] } */
  const dailyHistory = ref<Record<string, StockDaily[]>>({});

  /** 实时快照数据 */
  const snapshots = ref<StockSnapshot[]>([]);

  /** 加载状态 */
  const loading = ref(false);

  /** 最近一次错误信息 */
  const error = ref<string | null>(null);

  /** 最近一次快照获取时间 */
  const lastSnapshotUpdate = ref<string | null>(null);

  // ─── 计算属性 ───

  /** 股票代码→名称的映射（便于快速查找） */
  const stockNameMap = computed(() => {
    const map: Record<string, string> = {};
    for (const s of stocks.value) {
      map[s.stock_code] = s.stock_name;
    }
    return map;
  });

  /** 活跃股票列表（is_active === 1） */
  const activeStocks = computed(() =>
    stocks.value.filter(s => s.is_active === 1)
  );

  /** 按行业分组 */
  const stocksByIndustry = computed(() => {
    const groups: Record<string, StockInfo[]> = {};
    for (const s of activeStocks.value) {
      const industry = s.industry || '其他';
      if (!groups[industry]) groups[industry] = [];
      groups[industry].push(s);
    }
    return groups;
  });

  // ─── 操作方法 ───

  /**
   * 获取所有已缓存股票列表
   */
  async function loadStocks(): Promise<void> {
    loading.value = true;
    error.value = null;
    try {
      const res = await fetch(`${API_BASE}/stock/list`);
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const json = await res.json();
      stocks.value = json.data as StockInfo[];
    } catch (e: unknown) {
      const msg = e instanceof Error ? e.message : '获取股票列表失败';
      error.value = msg;
      console.error('[stockStore] loadStocks error:', msg);
    } finally {
      loading.value = false;
    }
  }

  /**
   * 获取单只股票历史日K
   * @param code 股票代码
   * @param from 起始日期 YYYY-MM-DD（可选）
   * @param limit 限制条数（默认120）
   */
  async function loadHistory(code: string, from?: string, limit = 120): Promise<StockDaily[]> {
    error.value = null;
    try {
      let url = `${API_BASE}/stock/${code}/history?limit=${limit}`;
      if (from) url += `&from=${from}`;
      const res = await fetch(url);
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const json = await res.json();
      const data = json.data as StockDaily[];
      dailyHistory.value[code] = data;
      return data;
    } catch (e: unknown) {
      const msg = e instanceof Error ? e.message : '获取历史日K失败';
      error.value = msg;
      console.error(`[stockStore] loadHistory(${code}) error:`, msg);
      return [];
    }
  }

  /**
   * 获取实时行情快照
   * @param codes 股票代码数组（可选，不传则获取全部）
   */
  async function loadSnapshot(codes?: string[]): Promise<StockSnapshot[]> {
    error.value = null;
    try {
      let url = `${API_BASE}/stock/market/snapshot`;
      if (codes && codes.length > 0) {
        url += `?codes=${codes.join(',')}`;
      }
      const res = await fetch(url);
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const json = await res.json();
      const data = json.data as StockSnapshot[];
      snapshots.value = data;
      lastSnapshotUpdate.value = new Date().toISOString();
      return data;
    } catch (e: unknown) {
      const msg = e instanceof Error ? e.message : '获取快照失败';
      error.value = msg;
      console.error('[stockStore] loadSnapshot error:', msg);
      return [];
    }
  }

  /**
   * 触发 Python 数据采集（异步）
   * @param stockCode 可选，指定单个股票代码
   * @param snapshot 是否仅获取实时快照
   */
  async function fetchStockData(stockCode?: string, snapshot = false): Promise<boolean> {
    loading.value = true;
    error.value = null;
    try {
      let url = `${API_BASE}/stock-fetch`;
      if (snapshot) url += '?snapshot=true';
      const body: Record<string, string> = {};
      if (stockCode) body.stock_code = stockCode;

      const res = await fetch(url, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      return true;
    } catch (e: unknown) {
      const msg = e instanceof Error ? e.message : '数据采集请求失败';
      error.value = msg;
      console.error('[stockStore] fetchStockData error:', msg);
      return false;
    } finally {
      loading.value = false;
    }
  }

  /**
   * 重置状态
   */
  function reset(): void {
    stocks.value = [];
    dailyHistory.value = {};
    snapshots.value = [];
    loading.value = false;
    error.value = null;
    lastSnapshotUpdate.value = null;
  }

  return {
    // 状态
    stocks,
    dailyHistory,
    snapshots,
    loading,
    error,
    lastSnapshotUpdate,
    // 计算属性
    stockNameMap,
    activeStocks,
    stocksByIndustry,
    // 方法
    loadStocks,
    loadHistory,
    loadSnapshot,
    fetchStockData,
    reset,
  };
});