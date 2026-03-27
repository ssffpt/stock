const API_BASE_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8000/api/v1';

interface ApiResponse<T> {
  code: number;
  data: T;
  message?: string;
}

// ============== 已清仓股票统计 ==============

interface ClearedPosition {
  stock_code: string;
  stock_name: string;
  cycle_index: number;
  open_date: string;
  close_date: string;
  hold_days: number;
  total_buy_amount: number;
  total_sell_amount: number;
  total_buy_qty: number;
  profit_loss: number;
  profit_rate: number;
  avg_buy_price: number;
  avg_sell_price?: number;
  record_ids?: string;
  notes?: string;
  cost_vs_open: number | null;
  cost_vs_close: number | null;
}

interface ClearedPositionRecord {
  id: number;
  trade_date: string;
  trade_time: string | null;
  trade_type: string;
  quantity: number;
  trade_price: number;
  deal_amount: number;
  occur_amount: number;
  fee: number | null;
  remark: string | null;
}

interface ClearedPositionDetail {
  summary: ClearedPosition;
  records: ClearedPositionRecord[];
}

interface ClearedPositionListResponse {
  total: number;
  page: number;
  page_size: number;
  list: ClearedPosition[];
}

interface ClearedPositionParams {
  page?: number;
  page_size?: number;
  stock_code?: string;
  profit_filter?: 'all' | 'profit' | 'loss';
  start_date?: string;
  end_date?: string;
  order_by?: 'close_date' | 'profit_loss' | 'profit_rate' | 'hold_days' | 'open_date';
  order_dir?: 'asc' | 'desc';
}

// ============== 原始交割单 ==============

interface OriginalDelivery {
  id: number;
  trade_date: string;
  trade_time: string | null;
  stock_code: string;
  stock_name: string;
  trade_type: string;
  quantity: number;
  trade_price: number;
  occur_amount: number;
  deal_amount: number;
  fee: number | null;
  remark: string | null;
  created_at: string;
}

interface OriginalDeliveryCreate {
  trade_date: string;
  trade_time?: string | null;
  stock_code: string;
  stock_name: string;
  trade_type: string;
  quantity: number;
  trade_price: number;
  occur_amount: number;
  deal_amount: number;
  fee?: number | null;
  remark?: string | null;
}

interface OriginalDeliveryListResponse {
  total: number;
  page: number;
  page_size: number;
  items: OriginalDelivery[];
}

interface OriginalDeliveryParams {
  page?: number;
  page_size?: number;
  stock_code?: string;
  stock_name?: string;
  trade_type?: '买入' | '卖出';
  trade_date_start?: string;
  trade_date_end?: string;
}

async function fetchApi<T>(url: string, options?: RequestInit): Promise<T> {
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), 30000);

  try {
    const response = await fetch(url, {
      ...options,
      headers: {
        'Content-Type': 'application/json',
        ...options?.headers,
      },
      credentials: 'include',
      signal: controller.signal,
    });

    clearTimeout(timeoutId);

    if (!response.ok) {
      let errorMessage = `API Error: ${response.status} ${response.statusText}`;
      try {
        const errorData = await response.json();
        if (errorData.message) {
          errorMessage += ` - ${errorData.message}`;
        }
      } catch {
        // Response body might be empty or not JSON
      }
      throw new Error(errorMessage);
    }

    return response.json();
  } catch (error) {
    clearTimeout(timeoutId);

    if (error instanceof Error) {
      if (error.name === 'AbortError') {
        throw new Error(`API 请求超时: ${url}`);
      }
      throw error;
    }

    // Check if it's a network error (Failed to fetch)
    throw new Error(`网络请求失败: ${url}`);
  }
}

// ============== 已清仓股票统计 API ==============

export async function getClearedPositions(
  params: ClearedPositionParams
): Promise<ApiResponse<ClearedPositionListResponse>> {
  const searchParams = new URLSearchParams();

  if (params.page) searchParams.set('page', params.page.toString());
  if (params.page_size) searchParams.set('page_size', params.page_size.toString());
  if (params.stock_code) searchParams.set('stock_code', params.stock_code);
  if (params.profit_filter && params.profit_filter !== 'all') {
    searchParams.set('profit_filter', params.profit_filter);
  }
  if (params.start_date) searchParams.set('start_date', params.start_date);
  if (params.end_date) searchParams.set('end_date', params.end_date);
  if (params.order_by && params.order_by !== 'close_date') {
    searchParams.set('order_by', params.order_by);
  }
  if (params.order_dir && params.order_dir !== 'desc') {
    searchParams.set('order_dir', params.order_dir);
  }

  const queryString = searchParams.toString();
  const url = `${API_BASE_URL}/cleared-positions${queryString ? `?${queryString}` : ''}`;

  return fetchApi<ApiResponse<ClearedPositionListResponse>>(url);
}

export async function getClearedPositionDetail(
  stockCode: string,
  openDate: string,
  closeDate: string
): Promise<ApiResponse<{ summary: ClearedPosition; records: ClearedPositionRecord[] }>> {
  const url = `${API_BASE_URL}/cleared-positions/detail?stock_code=${stockCode}&open_date=${openDate}&close_date=${closeDate}`;
  return fetchApi(url);
}

export async function updateClearedPositionNotes(
  stockCode: string,
  openDate: string,
  closeDate: string,
  notes: string | null
): Promise<{ success: boolean; message: string }> {
  const url = `${API_BASE_URL}/cleared-positions/notes`;
  return fetchApi(url, {
    method: 'POST',
    body: JSON.stringify({
      stock_code: stockCode,
      open_date: openDate,
      close_date: closeDate,
      notes: notes,
    }),
  });
}

// ============== 原始交割单 API ==============

export async function getDeliveries(
  params: OriginalDeliveryParams
): Promise<ApiResponse<OriginalDeliveryListResponse>> {
  const searchParams = new URLSearchParams();

  if (params.page) searchParams.set('page', params.page.toString());
  if (params.page_size) searchParams.set('page_size', params.page_size.toString());
  if (params.stock_code) searchParams.set('stock_code', params.stock_code);
  if (params.stock_name) searchParams.set('stock_name', params.stock_name);
  if (params.trade_type) searchParams.set('trade_type', params.trade_type);
  if (params.trade_date_start) searchParams.set('trade_date_start', params.trade_date_start);
  if (params.trade_date_end) searchParams.set('trade_date_end', params.trade_date_end);

  const queryString = searchParams.toString();
  const url = `${API_BASE_URL}/deliveries${queryString ? `?${queryString}` : ''}`;

  return fetchApi<ApiResponse<OriginalDeliveryListResponse>>(url);
}

export async function createDelivery(
  delivery: OriginalDeliveryCreate
): Promise<ApiResponse<OriginalDelivery>> {
  const url = `${API_BASE_URL}/deliveries`;
  return fetchApi<ApiResponse<OriginalDelivery>>(url, {
    method: 'POST',
    body: JSON.stringify(delivery),
  });
}

export async function batchCreateDeliveries(
  deliveries: OriginalDeliveryCreate[]
): Promise<ApiResponse<OriginalDelivery[]>> {
  const url = `${API_BASE_URL}/deliveries/batch`;
  return fetchApi<ApiResponse<OriginalDelivery[]>>(url, {
    method: 'POST',
    body: JSON.stringify({ items: deliveries }),
  });
}

export async function syncQuotes(force: boolean = false): Promise<ApiResponse<{ message: string; total_stocks: number; synced_count: number }>> {
  const url = `${API_BASE_URL}/quotes/sync${force ? '?force=true' : ''}`;
  return fetchApi(url, { method: 'POST' });
}

// ============== 清洗操作 API ==============

interface CleanResult {
  success: boolean;
  cleaned_count: number;
  message: string;
}

interface CleanStatus {
  last_clean_time: string;
  total_cycles: number;
  stocks: string[];
}

export async function cleanClearedPositions(params: {
  start_date?: string;
  end_date?: string;
  stock_codes?: string[];
}): Promise<CleanResult> {
  const url = `${API_BASE_URL}/cleared-positions/clean`;
  return fetchApi<CleanResult>(url, {
    method: "POST",
    body: JSON.stringify(params),
  });
}

export async function getClearedPositionStatus(): Promise<ApiResponse<CleanStatus>> {
  const url = `${API_BASE_URL}/cleared-positions/status`;
  return fetchApi<ApiResponse<CleanStatus>>(url);
}

export type {
  ClearedPosition,
  ClearedPositionRecord,
  ClearedPositionDetail,
  ClearedPositionListResponse,
  ClearedPositionParams,
  OriginalDelivery,
  OriginalDeliveryCreate,
  OriginalDeliveryListResponse,
  OriginalDeliveryParams,
  ApiResponse,
  CleanResult,
  CleanStatus,
};
