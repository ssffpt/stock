"use client";

import { useState, useEffect, useCallback } from "react";
import {
  cleanClearedPositions,
  getClearedPositionStatus,
} from "@/lib/api";

interface CleanControlProps {
  onCleanComplete?: () => void;
}

interface CleanStatus {
  last_clean_time: string;
  total_cycles: number;
  stocks: string[];
}

export default function CleanControl({ onCleanComplete }: CleanControlProps) {
  const getToday = () => new Date().toISOString().split("T")[0];
  const getMonthStart = () => {
    const now = new Date();
    return new Date(now.getFullYear(), now.getMonth(), 1).toISOString().split("T")[0];
  };

  const [startDate, setStartDate] = useState<string>(getMonthStart);
  const [endDate, setEndDate] = useState<string>(getToday);
  const [stockCodes, setStockCodes] = useState<string>("");
  const [cleaning, setCleaning] = useState(false);
  const [status, setStatus] = useState<CleanStatus | null>(null);
  const [statusLoading, setStatusLoading] = useState(true);
  const [cleanResult, setCleanResult] = useState<{
    success: boolean;
    cleaned_count: number;
    message: string;
  } | null>(null);

  const fetchStatus = useCallback(async () => {
    setStatusLoading(true);
    try {
      const response = await getClearedPositionStatus();
      if (response.code === 200) {
        setStatus(response.data);
      }
    } catch (error) {
      console.error("获取清洗状态失败:", error);
    } finally {
      setStatusLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchStatus();
  }, [fetchStatus]);

  const handleClean = async () => {
    setCleaning(true);
    setCleanResult(null);
    try {
      const codes = stockCodes
        .split(",")
        .map((c) => c.trim())
        .filter((c) => c.length > 0);

      const response = await cleanClearedPositions({
        start_date: startDate || undefined,
        end_date: endDate || undefined,
        stock_codes: codes.length > 0 ? codes : undefined,
      });

      setCleanResult(response);

      if (response.success) {
        fetchStatus();
        onCleanComplete?.();
      }
    } catch (error) {
      console.error("清洗失败:", error);
      setCleanResult({
        success: false,
        cleaned_count: 0,
        message: "清洗操作失败，请重试",
      });
    } finally {
      setCleaning(false);
    }
  };

  const formatDateTime = (dateStr: string) => {
    if (!dateStr) return "-";
    try {
      const date = new Date(dateStr);
      return date.toLocaleString("zh-CN", {
        year: "numeric",
        month: "2-digit",
        day: "2-digit",
        hour: "2-digit",
        minute: "2-digit",
        second: "2-digit",
      });
    } catch {
      return dateStr;
    }
  };

  return (
    <div className="bg-white rounded-xl shadow-sm border border-slate-200 p-5 mb-6">
      <div className="flex flex-col lg:flex-row lg:items-end gap-4">
        {/* 时间范围 */}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 flex-1">
          <div>
            <label className="block text-xs font-medium text-slate-500 mb-1.5">
              开始日期
            </label>
            <input
              type="date"
              value={startDate}
              onChange={(e) => setStartDate(e.target.value)}
              className="w-full px-3 py-2 text-sm border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-400 focus:border-transparent transition-shadow"
            />
          </div>
          <div>
            <label className="block text-xs font-medium text-slate-500 mb-1.5">
              结束日期
            </label>
            <input
              type="date"
              value={endDate}
              onChange={(e) => setEndDate(e.target.value)}
              className="w-full px-3 py-2 text-sm border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-400 focus:border-transparent transition-shadow"
            />
          </div>
        </div>

        {/* 股票代码 */}
        <div className="flex-1">
          <label className="block text-xs font-medium text-slate-500 mb-1.5">
            股票代码（可选，多个用逗号分隔）
          </label>
          <input
            type="text"
            value={stockCodes}
            onChange={(e) => setStockCodes(e.target.value)}
            placeholder="如: 600519, 000858"
            className="w-full px-3 py-2 text-sm border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-400 focus:border-transparent transition-shadow"
          />
        </div>

        {/* 执行清洗按钮 */}
        <div className="flex-shrink-0">
          <button
            onClick={handleClean}
            disabled={cleaning}
            className="w-full lg:w-auto px-6 py-2 text-sm font-medium bg-blue-600 text-white rounded-lg hover:bg-blue-500 disabled:opacity-50 disabled:cursor-not-allowed transition-colors flex items-center justify-center gap-2"
          >
            {cleaning ? (
              <>
                <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                清洗中...
              </>
            ) : (
              "执行清洗"
            )}
          </button>
        </div>
      </div>

      {/* 清洗结果提示 */}
      {cleanResult && (
        <div
          className={`mt-4 p-3 rounded-lg text-sm ${
            cleanResult.success
              ? "bg-emerald-50 text-emerald-700 border border-emerald-200"
              : "bg-red-50 text-red-700 border border-red-200"
          }`}
        >
          <div className="font-medium">
            {cleanResult.success ? "清洗成功" : "清洗失败"}
          </div>
          <div className="text-xs mt-1 opacity-80">
            {cleanResult.message}
            {cleanResult.cleaned_count > 0 && `（共处理 ${cleanResult.cleaned_count} 条记录）`}
          </div>
        </div>
      )}

      {/* 清洗状态 */}
      <div className="mt-4 pt-4 border-t border-slate-100">
        <h4 className="text-xs font-medium text-slate-500 mb-3">缓存状态</h4>
        {statusLoading ? (
          <div className="flex items-center gap-2 text-slate-400 text-sm">
            <div className="w-4 h-4 border-2 border-slate-300 border-t-slate-500 rounded-full animate-spin" />
            加载中...
          </div>
        ) : status ? (
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            <div className="bg-slate-50 rounded-lg p-3">
              <div className="text-xs text-slate-500">最后清洗时间</div>
              <div className="text-sm font-medium text-slate-700 mt-1">
                {formatDateTime(status.last_clean_time)}
              </div>
            </div>
            <div className="bg-slate-50 rounded-lg p-3">
              <div className="text-xs text-slate-500">缓存周期数量</div>
              <div className="text-sm font-medium text-slate-700 mt-1">
                {status.total_cycles}
              </div>
            </div>
            <div className="bg-slate-50 rounded-lg p-3">
              <div className="text-xs text-slate-500">已缓存股票</div>
              <div className="text-sm font-medium text-slate-700 mt-1">
                {status.stocks.length} 只
              </div>
            </div>
          </div>
        ) : (
          <div className="text-sm text-slate-400">暂无状态信息</div>
        )}
      </div>
    </div>
  );
}