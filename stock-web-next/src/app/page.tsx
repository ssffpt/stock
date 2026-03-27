"use client";

import { useState, useEffect, useCallback } from "react";
import {
  getClearedPositions,
  getClearedPositionDetail,
  updateClearedPositionNotes,
  ClearedPosition,
  ClearedPositionParams,
  ClearedPositionRecord,
} from "@/lib/api";
import CleanControl from "@/components/CleanControl";

export default function ClearedPositionsPage() {
  const getMonthStart = () => {
    const now = new Date();
    return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}-01`;
  };

  const getToday = () => new Date().toISOString().split("T")[0];

  const getThreeMonthsAgo = () => {
    const now = new Date();
    const threeMonthsAgo = new Date(now.getFullYear(), now.getMonth() - 3, now.getDate());
    return `${threeMonthsAgo.getFullYear()}-${String(threeMonthsAgo.getMonth() + 1).padStart(2, "0")}-${String(threeMonthsAgo.getDate()).padStart(2, "0")}`;
  };

  const [positions, setPositions] = useState<ClearedPosition[]>([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(20);
  const [loading, setLoading] = useState(false);
  const [stockCode, setStockCode] = useState("");
  const [profitFilter, setProfitFilter] = useState<"all" | "profit" | "loss">("all");
  const [dateRange, setDateRange] = useState<"this_month" | "three_months" | "custom">("this_month");
  const [startDate, setStartDate] = useState(getMonthStart);
  const [endDate, setEndDate] = useState(getToday);
  const [orderBy, setOrderBy] = useState<"close_date" | "profit_loss" | "profit_rate" | "hold_days" | "open_date">("close_date");
  const [orderDir, setOrderDir] = useState<"asc" | "desc">("desc");
  const [selectedPosition, setSelectedPosition] = useState<ClearedPosition | null>(null);
  const [detailRecords, setDetailRecords] = useState<ClearedPositionRecord[]>([]);
  const [showDetail, setShowDetail] = useState(false);
  const [detailLoading, setDetailLoading] = useState(false);
  const [detailTab, setDetailTab] = useState<"records" | "notes">("records");
  const [notes, setNotes] = useState("");
  const [notesSaving, setNotesSaving] = useState(false);

  const handleDateRangeChange = (range: "this_month" | "three_months" | "custom") => {
    setDateRange(range);
    if (range === "this_month") {
      setStartDate(getMonthStart());
      setEndDate(getToday());
    } else if (range === "three_months") {
      setStartDate(getThreeMonthsAgo());
      setEndDate(getToday());
    }
  };

  const fetchData = useCallback(async () => {
    setLoading(true);
    try {
      const params: ClearedPositionParams = {
        page,
        page_size: pageSize,
        stock_code: stockCode || undefined,
        profit_filter: profitFilter,
        start_date: startDate || undefined,
        end_date: endDate || undefined,
        order_by: orderBy,
        order_dir: orderDir,
      };

      const response = await getClearedPositions(params);
      if (response.code === 200) {
        setPositions(response.data.list);
        setTotal(response.data.total);
      }
    } catch (error) {
      console.error("获取数据失败:", error);
    } finally {
      setLoading(false);
    }
  }, [page, pageSize, stockCode, profitFilter, startDate, endDate, orderBy, orderDir]);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  const totalPages = Math.ceil(total / pageSize);

  const handleSearch = () => {
    setPage(1);
    fetchData();
  };

  const handleReset = () => {
    setStockCode("");
    setProfitFilter("all");
    setDateRange("this_month");
    setStartDate(getMonthStart());
    setEndDate(getToday());
    setOrderBy("close_date");
    setOrderDir("desc");
    setPage(1);
  };

  const handleCleanComplete = () => {
    fetchData();
  };

  const viewDetail = async (position: ClearedPosition) => {
    setSelectedPosition(position);
    setShowDetail(true);
    setDetailTab("records");
    setNotes(position.notes || "");
    setDetailLoading(true);
    try {
      const response = await getClearedPositionDetail(position.stock_code, position.open_date, position.close_date);
      if (response.code === 200) {
        setDetailRecords(response.data.records);
      }
    } catch (error) {
      console.error("获取明细失败:", error);
      setDetailRecords([]);
    } finally {
      setDetailLoading(false);
    }
  };

  const closeDetail = () => {
    setShowDetail(false);
    setSelectedPosition(null);
    setDetailRecords([]);
    setNotes("");
  };

  const handleSaveNotes = async () => {
    if (!selectedPosition) return;
    setNotesSaving(true);
    try {
      const response = await updateClearedPositionNotes(
        selectedPosition.stock_code,
        selectedPosition.open_date,
        selectedPosition.close_date,
        notes || null
      );
      if (response.success) {
        // Update local state
        setPositions(prev => prev.map(p =>
          p.stock_code === selectedPosition.stock_code &&
          p.open_date === selectedPosition.open_date &&
          p.close_date === selectedPosition.close_date
            ? { ...p, notes: notes || null }
            : p
        ));
      } else {
        alert(response.message || "保存失败");
      }
    } catch (error) {
      console.error("保存笔记失败:", error);
      alert("保存失败，请重试");
    } finally {
      setNotesSaving(false);
    }
  };

  const formatNumber = (num: number | string | null, decimals: number = 2) => {
    if (num === null) return "-";
    const numericValue = typeof num === "string" ? parseFloat(num) : num;
    if (isNaN(numericValue)) return "-";
    return numericValue.toFixed(decimals);
  };

  const formatPercent = (num: number | string | null) => {
    if (num === null) return "-";
    const numericValue = typeof num === "string" ? parseFloat(num) : num;
    if (isNaN(numericValue)) return "-";
    return `${numericValue.toFixed(2)}%`;
  };

  const handleSort = (field: "profit_loss" | "profit_rate") => {
    if (orderBy === field) {
      setOrderDir(orderDir === "asc" ? "desc" : "asc");
    } else {
      setOrderBy(field);
      setOrderDir("desc");
    }
    setPage(1);
  };

  const SortIcon = ({ field }: { field: "profit_loss" | "profit_rate" }) => {
    if (orderBy !== field) return <span className="ml-1 text-slate-400">↕</span>;
    return orderDir === "asc" ? <span className="ml-1 text-slate-800">↑</span> : <span className="ml-1 text-slate-800">↓</span>;
  };

  return (
    <div className="p-6 max-w-7xl mx-auto">
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-slate-800">已清仓股票统计</h1>
        <p className="text-sm text-slate-500 mt-1">查看股票持仓周期内的买卖明细及盈亏统计</p>
      </div>

      {/* 清洗控制 */}
      <CleanControl onCleanComplete={handleCleanComplete} />

      {/* 筛选条件 */}
      <div className="bg-white rounded-xl shadow-sm border border-slate-200 p-5 mb-6">
        <div className="grid grid-cols-1 md:grid-cols-3 lg:grid-cols-4 gap-4">
          <div>
            <label className="block text-xs font-medium text-slate-500 mb-1.5">股票代码</label>
            <input
              type="text"
              value={stockCode}
              onChange={(e) => setStockCode(e.target.value)}
              placeholder="如: 600519"
              className="w-full px-3 py-2 text-sm border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-slate-400 focus:border-transparent transition-shadow"
            />
          </div>
          <div>
            <label className="block text-xs font-medium text-slate-500 mb-1.5">盈亏筛选</label>
            <select
              value={profitFilter}
              onChange={(e) => setProfitFilter(e.target.value as "all" | "profit" | "loss")}
              className="w-full px-3 py-2 text-sm border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-slate-400 focus:border-transparent transition-shadow bg-white"
            >
              <option value="all">全部</option>
              <option value="profit">盈利</option>
              <option value="loss">亏损</option>
            </select>
          </div>
          <div>
            <label className="block text-xs font-medium text-slate-500 mb-1.5">建仓日期</label>
            <div className="flex gap-1.5">
              <button
                type="button"
                onClick={() => handleDateRangeChange("this_month")}
                className={`flex-1 px-3 py-2 text-xs font-medium rounded-lg transition-colors ${dateRange === "this_month" ? "bg-slate-800 text-white" : "bg-slate-100 text-slate-600 hover:bg-slate-200"}`}
              >
                本月
              </button>
              <button
                type="button"
                onClick={() => handleDateRangeChange("three_months")}
                className={`flex-1 px-3 py-2 text-xs font-medium rounded-lg transition-colors ${dateRange === "three_months" ? "bg-slate-800 text-white" : "bg-slate-100 text-slate-600 hover:bg-slate-200"}`}
              >
                近三月
              </button>
              <button
                type="button"
                onClick={() => handleDateRangeChange("custom")}
                className={`flex-1 px-3 py-2 text-xs font-medium rounded-lg transition-colors ${dateRange === "custom" ? "bg-slate-800 text-white" : "bg-slate-100 text-slate-600 hover:bg-slate-200"}`}
              >
                自定义
              </button>
            </div>
          </div>
          {dateRange === "custom" && (
            <>
              <div>
                <label className="block text-xs font-medium text-slate-500 mb-1.5">建仓日期起</label>
                <input
                  type="date"
                  value={startDate}
                  onChange={(e) => {
                    setStartDate(e.target.value);
                    setDateRange("custom");
                  }}
                  className="w-full px-3 py-2 text-sm border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-slate-400 focus:border-transparent transition-shadow"
                />
              </div>
              <div>
                <label className="block text-xs font-medium text-slate-500 mb-1.5">建仓日期止</label>
                <input
                  type="date"
                  value={endDate}
                  onChange={(e) => {
                    setEndDate(e.target.value);
                    setDateRange("custom");
                  }}
                  className="w-full px-3 py-2 text-sm border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-slate-400 focus:border-transparent transition-shadow"
                />
              </div>
            </>
          )}
          <div>
            <label className="block text-xs font-medium text-slate-500 mb-1.5">排序字段</label>
            <select
              value={orderBy}
              onChange={(e) => setOrderBy(e.target.value as typeof orderBy)}
              className="w-full px-3 py-2 text-sm border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-slate-400 focus:border-transparent transition-shadow bg-white"
            >
              <option value="close_date">清仓日期</option>
              <option value="profit_loss">盈亏金额</option>
              <option value="profit_rate">收益率</option>
              <option value="hold_days">持仓天数</option>
              <option value="open_date">建仓日期</option>
            </select>
          </div>
        </div>
        <div className="mt-4 flex gap-2">
          <button
            onClick={handleSearch}
            className="px-4 py-2 text-sm font-medium bg-slate-800 text-white rounded-lg hover:bg-slate-700 transition-colors"
          >
            查询
          </button>
          <button
            onClick={handleReset}
            className="px-4 py-2 text-sm font-medium bg-slate-100 text-slate-600 rounded-lg hover:bg-slate-200 transition-colors"
          >
            重置
          </button>
        </div>
      </div>

      {/* 数据表格 */}
      <div className="bg-white rounded-xl shadow-sm border border-slate-200 overflow-hidden">
        <div className="overflow-x-auto">
          <table className="min-w-full">
            <thead className="bg-slate-50 border-b border-slate-200">
              <tr>
                <th className="px-4 py-3 text-left text-xs font-semibold text-slate-600 tracking-wide">股票代码</th>
                <th className="px-4 py-3 text-left text-xs font-semibold text-slate-600 tracking-wide">股票名称</th>
                <th className="px-4 py-3 text-left text-xs font-semibold text-slate-600 tracking-wide">建仓日期</th>
                <th className="px-4 py-3 text-left text-xs font-semibold text-slate-600 tracking-wide">清仓日期</th>
                <th className="px-4 py-3 text-right text-xs font-semibold text-slate-600 tracking-wide">持仓天数</th>
                <th className="px-4 py-3 text-right text-xs font-semibold text-slate-600 tracking-wide">买入均价</th>
                <th className="px-4 py-3 text-right text-xs font-semibold text-slate-600 tracking-wide">买入金额</th>
                <th className="px-4 py-3 text-right text-xs font-semibold text-slate-600 tracking-wide">卖出金额</th>
                <th
                  className="px-4 py-3 text-right text-xs font-semibold text-slate-600 tracking-wide cursor-pointer hover:text-slate-900 select-none"
                  onClick={() => handleSort("profit_loss")}
                >
                  <span className="inline-flex items-center justify-end">
                    盈亏<SortIcon field="profit_loss" />
                  </span>
                </th>
                <th
                  className="px-4 py-3 text-right text-xs font-semibold text-slate-600 tracking-wide cursor-pointer hover:text-slate-900 select-none"
                  onClick={() => handleSort("profit_rate")}
                >
                  <span className="inline-flex items-center justify-end">
                    收益率<SortIcon field="profit_rate" />
                  </span>
                </th>
                <th className="px-4 py-3 text-center text-xs font-semibold text-slate-600 tracking-wide">操作</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {loading ? (
                <tr>
                  <td colSpan={11} className="px-4 py-12 text-center">
                    <div className="flex items-center justify-center gap-2 text-slate-400">
                      <div className="w-5 h-5 border-2 border-slate-300 border-t-slate-600 rounded-full animate-spin" />
                      加载中...
                    </div>
                  </td>
                </tr>
              ) : positions.length === 0 ? (
                <tr>
                  <td colSpan={11} className="px-4 py-12 text-center text-slate-400 text-sm">
                    暂无数据
                  </td>
                </tr>
              ) : (
                positions.map((position, index) => (
                  <tr key={`${position.stock_code}-${position.open_date}-${position.close_date}-${position.cycle_index}-${index}`} className="hover:bg-slate-50 transition-colors">
                    <td className="px-4 py-3 text-sm font-medium text-slate-800">{position.stock_code}</td>
                    <td className="px-4 py-3 text-sm font-medium text-slate-800">{position.stock_name}</td>
                    <td className="px-4 py-3 text-sm text-slate-500">{position.open_date}</td>
                    <td className="px-4 py-3 text-sm text-slate-500">{position.close_date}</td>
                    <td className="px-4 py-3 text-sm text-slate-600 text-right">{position.hold_days}</td>
                    <td className="px-4 py-3 text-sm text-slate-600 text-right">{formatNumber(position.avg_buy_price, 3)}</td>
                    <td className="px-4 py-3 text-sm text-slate-600 text-right">{formatNumber(position.total_buy_amount)}</td>
                    <td className="px-4 py-3 text-sm text-slate-600 text-right">{formatNumber(position.total_sell_amount)}</td>
                    <td className={`px-4 py-3 text-sm text-right font-semibold ${position.profit_loss >= 0 ? "text-red-500" : "text-emerald-500"}`}>
                      {position.profit_loss >= 0 ? "+" : ""}{formatNumber(position.profit_loss)}
                    </td>
                    <td className={`px-4 py-3 text-sm text-right font-semibold ${position.profit_rate >= 0 ? "text-red-500" : "text-emerald-500"}`}>
                      {position.profit_rate >= 0 ? "+" : ""}{formatPercent(position.profit_rate)}
                    </td>
                    <td className="px-4 py-3 text-sm text-center">
                      <button
                        onClick={() => viewDetail(position)}
                        className="px-3 py-1 text-xs font-medium text-slate-600 bg-slate-100 hover:bg-slate-200 rounded-md transition-colors"
                      >
                        查看明细
                      </button>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>

        {/* 分页 */}
        <div className="px-4 py-3 flex items-center justify-between border-t border-slate-200 bg-slate-50">
          <div className="text-sm text-slate-500">
            共 <span className="font-medium text-slate-700">{total}</span> 条记录，当前第 <span className="font-medium text-slate-700">{page}</span> / {totalPages} 页
          </div>
          <div className="flex gap-2">
            <button
              onClick={() => setPage((p) => Math.max(1, p - 1))}
              disabled={page <= 1}
              className="px-3 py-1.5 text-sm border border-slate-200 rounded-lg disabled:opacity-50 disabled:cursor-not-allowed hover:bg-white transition-colors"
            >
              上一页
            </button>
            <button
              onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
              disabled={page >= totalPages}
              className="px-3 py-1.5 text-sm border border-slate-200 rounded-lg disabled:opacity-50 disabled:cursor-not-allowed hover:bg-white transition-colors"
            >
              下一页
            </button>
          </div>
        </div>
      </div>

      {/* 明细弹窗 */}
      {showDetail && selectedPosition && (
        <div className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-5xl max-h-[85vh] overflow-hidden flex flex-col">
            {/* 头部 */}
            <div className="bg-gradient-to-r from-slate-800 to-slate-700 px-6 py-5 flex items-center justify-between">
              <div>
                <h2 className="text-xl font-semibold text-white">
                  {selectedPosition.stock_name}
                  <span className="ml-2 text-slate-300 text-base">({selectedPosition.stock_code})</span>
                </h2>
                <p className="text-slate-400 text-sm mt-1">
                  {selectedPosition.open_date} ~ {selectedPosition.close_date}
                </p>
              </div>
              <button
                onClick={closeDetail}
                className="w-8 h-8 rounded-full bg-white/10 hover:bg-white/20 flex items-center justify-center text-white transition-colors"
              >
                ✕
              </button>
            </div>

            {/* 统计卡片 */}
            <div className="px-6 py-5 bg-slate-50 border-b border-slate-200">
              <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                <div className="bg-white rounded-xl p-4 shadow-sm">
                  <div className="text-xs text-slate-500 mb-1">建仓日期</div>
                  <div className="text-base font-semibold text-slate-800">{selectedPosition.open_date}</div>
                </div>
                <div className="bg-white rounded-xl p-4 shadow-sm">
                  <div className="text-xs text-slate-500 mb-1">清仓日期</div>
                  <div className="text-base font-semibold text-slate-800">{selectedPosition.close_date}</div>
                </div>
                <div className="bg-white rounded-xl p-4 shadow-sm">
                  <div className="text-xs text-slate-500 mb-1">持仓天数</div>
                  <div className="text-base font-semibold text-slate-800">{selectedPosition.hold_days} 天</div>
                </div>
                <div className="bg-white rounded-xl p-4 shadow-sm">
                  <div className="text-xs text-slate-500 mb-1">盈亏金额</div>
                  <div className={`text-base font-bold ${selectedPosition.profit_loss >= 0 ? "text-red-500" : "text-emerald-500"}`}>
                    {selectedPosition.profit_loss >= 0 ? "+" : ""}{formatNumber(selectedPosition.profit_loss)}
                  </div>
                </div>
              </div>
              <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mt-4">
                <div className="bg-white rounded-xl p-4 shadow-sm">
                  <div className="text-xs text-slate-500 mb-1">买入金额</div>
                  <div className="text-base font-semibold text-slate-800">{formatNumber(selectedPosition.total_buy_amount)}</div>
                </div>
                <div className="bg-white rounded-xl p-4 shadow-sm">
                  <div className="text-xs text-slate-500 mb-1">卖出金额</div>
                  <div className="text-base font-semibold text-slate-800">{formatNumber(selectedPosition.total_sell_amount)}</div>
                </div>
                <div className="bg-white rounded-xl p-4 shadow-sm">
                  <div className="text-xs text-slate-500 mb-1">买入均价</div>
                  <div className="text-base font-semibold text-slate-800">{formatNumber(selectedPosition.avg_buy_price, 3)}</div>
                </div>
                <div className="bg-white rounded-xl p-4 shadow-sm">
                  <div className="text-xs text-slate-500 mb-1">收益率</div>
                  <div className={`text-base font-bold ${selectedPosition.profit_rate >= 0 ? "text-red-500" : "text-emerald-500"}`}>
                    {selectedPosition.profit_rate >= 0 ? "+" : ""}{formatPercent(selectedPosition.profit_rate)}
                  </div>
                </div>
              </div>
            </div>

            {/* 标签页切换 */}
            <div className="px-6 pt-4 border-b border-slate-200">
              <div className="flex gap-4">
                <button
                  onClick={() => setDetailTab("records")}
                  className={`pb-2 px-1 text-sm font-medium transition-colors border-b-2 ${
                    detailTab === "records"
                      ? "border-blue-600 text-blue-600"
                      : "border-transparent text-slate-500 hover:text-slate-700"
                  }`}
                >
                  交易明细
                </button>
                <button
                  onClick={() => setDetailTab("notes")}
                  className={`pb-2 px-1 text-sm font-medium transition-colors border-b-2 flex items-center gap-1 ${
                    detailTab === "notes"
                      ? "border-blue-600 text-blue-600"
                      : "border-transparent text-slate-500 hover:text-slate-700"
                  }`}
                >
                  笔记
                  {notes && <span className="w-2 h-2 bg-blue-500 rounded-full"></span>}
                </button>
              </div>
            </div>

            {/* 明细表格 / 笔记编辑 */}
            <div className="flex-1 overflow-auto p-6">
              {detailTab === "records" ? (
                <>
              <h3 className="text-sm font-medium text-slate-600 mb-3">交易明细</h3>
              <div className="border border-slate-200 rounded-xl overflow-hidden">
                <table className="min-w-full">
                  <thead className="bg-slate-100">
                    <tr>
                      <th className="px-4 py-3 text-left text-xs font-semibold text-slate-600">成交日期</th>
                      <th className="px-4 py-3 text-left text-xs font-semibold text-slate-600">时间</th>
                      <th className="px-4 py-3 text-center text-xs font-semibold text-slate-600">买卖</th>
                      <th className="px-4 py-3 text-right text-xs font-semibold text-slate-600">数量</th>
                      <th className="px-4 py-3 text-right text-xs font-semibold text-slate-600">价格</th>
                      <th className="px-4 py-3 text-right text-xs font-semibold text-slate-600">成交金额</th>
                      <th className="px-4 py-3 text-right text-xs font-semibold text-slate-600">发生金额</th>
                      <th className="px-4 py-3 text-right text-xs font-semibold text-slate-600">手续费</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {detailLoading ? (
                      <tr>
                        <td colSpan={8} className="px-4 py-12 text-center text-slate-400">
                          <div className="flex items-center justify-center gap-2">
                            <div className="w-5 h-5 border-2 border-slate-300 border-t-slate-600 rounded-full animate-spin" />
                            加载中...
                          </div>
                        </td>
                      </tr>
                    ) : detailRecords.length === 0 ? (
                      <tr>
                        <td colSpan={8} className="px-4 py-12 text-center text-slate-400">
                          暂无明细数据
                        </td>
                      </tr>
                    ) : (
                      detailRecords.map((record, index) => (
                        <tr key={index} className="hover:bg-slate-50 transition-colors">
                          <td className="px-4 py-3 text-sm text-slate-800 font-medium">{record.trade_date}</td>
                          <td className="px-4 py-3 text-sm text-slate-500">{record.trade_time || "-"}</td>
                          <td className="px-4 py-3 text-center">
                            <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium ${record.trade_type === "买入" ? "bg-emerald-100 text-emerald-700" : "bg-red-100 text-red-700"}`}>
                              {record.trade_type}
                            </span>
                          </td>
                          <td className="px-4 py-3 text-sm text-slate-600 text-right">{record.quantity}</td>
                          <td className="px-4 py-3 text-sm text-slate-600 text-right">{formatNumber(record.trade_price, 3)}</td>
                          <td className="px-4 py-3 text-sm text-slate-600 text-right">{formatNumber(record.deal_amount)}</td>
                          <td className={`px-4 py-3 text-sm text-right font-medium ${record.occur_amount >= 0 ? "text-red-500" : "text-emerald-500"}`}>
                            {record.occur_amount >= 0 ? "+" : ""}{formatNumber(record.occur_amount)}
                          </td>
                          <td className="px-4 py-3 text-sm text-slate-500 text-right">{formatNumber(record.fee)}</td>
                        </tr>
                      ))
                    )}
                  </tbody>
                </table>
              </div>
                </>
              ) : (
                /* 笔记编辑 */
                <div className="space-y-4">
                  <div className="flex items-center justify-between">
                    <h3 className="text-sm font-medium text-slate-600">交易笔记（Markdown格式）</h3>
                    <button
                      onClick={handleSaveNotes}
                      disabled={notesSaving}
                      className="px-3 py-1.5 text-xs font-medium bg-blue-600 text-white rounded-md hover:bg-blue-500 disabled:opacity-50 transition-colors flex items-center gap-1"
                    >
                      {notesSaving && (
                        <div className="w-3 h-3 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                      )}
                      保存笔记
                    </button>
                  </div>
                  <textarea
                    value={notes}
                    onChange={(e) => setNotes(e.target.value)}
                    placeholder="记录这笔交易的心路历程、复盘思考..."
                    className="w-full h-64 px-3 py-2 text-sm border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-400 focus:border-transparent resize-none font-mono"
                  />
                  <div className="text-xs text-slate-400">
                    支持 Markdown 格式，如：**加粗**、*斜体*、`代码`、- 列表等
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
