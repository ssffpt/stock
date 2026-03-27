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

  const [showModal, setShowModal] = useState(false);
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
        setShowModal(false);
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
      });
    } catch {
      return dateStr;
    }
  };

  return (
    <>
      {/* 小按钮 + 状态显示 */}
      <div className="flex items-center gap-4 mb-4">
        <button
          onClick={() => setShowModal(true)}
          className="px-3 py-1.5 text-xs font-medium bg-blue-600 text-white rounded-md hover:bg-blue-500 transition-colors"
        >
          清洗数据
        </button>

        <div className="flex items-center gap-4 text-xs text-slate-500">
          {statusLoading ? (
            <span className="text-slate-400">加载中...</span>
          ) : status ? (
            <>
              <span>最后清洗: {formatDateTime(status.last_clean_time)}</span>
              <span>|</span>
              <span>{status.total_cycles} 个周期</span>
              <span>|</span>
              <span>{status.stocks.length} 只股票</span>
            </>
          ) : (
            <span>暂无缓存</span>
          )}
        </div>
      </div>

      {/* 清洗结果提示 */}
      {cleanResult && (
        <div
          className={`mb-4 p-3 rounded-lg text-sm ${
            cleanResult.success
              ? "bg-emerald-50 text-emerald-700 border border-emerald-200"
              : "bg-red-50 text-red-700 border border-red-200"
          }`}
        >
          {cleanResult.message}
          {cleanResult.cleaned_count > 0 && `（共处理 ${cleanResult.cleaned_count} 条记录）`}
        </div>
      )}

      {/* 弹窗 */}
      {showModal && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
          <div className="bg-white rounded-xl shadow-xl w-full max-w-md mx-4">
            <div className="flex items-center justify-between p-4 border-b border-slate-200">
              <h3 className="text-lg font-medium text-slate-900">清洗数据</h3>
              <button
                onClick={() => setShowModal(false)}
                className="p-1 text-slate-400 hover:text-slate-600 rounded-md hover:bg-slate-100"
              >
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>

            <div className="p-4 space-y-4">
              <p className="text-sm text-slate-600">
                选择时间范围，只保存时间范围。留空则清洗所有数据。
              </p>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-medium text-slate-500 mb-1.5">
                    开始日期
                  </label>
                  <input
                    type="date"
                    value={startDate}
                    onChange={(e) => setStartDate(e.target.value)}
                    className="w-full px-3 py-2 text-sm border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-400"
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
                    className="w-full px-3 py-2 text-sm border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-400"
                  />
                </div>
              </div>

              <div>
                <label className="block text-xs font-medium text-slate-500 mb-1.5">
                  股票代码（可选）
                </label>
                <input
                  type="text"
                  value={stockCodes}
                  onChange={(e) => setStockCodes(e.target.value)}
                  placeholder="多个用逗号分隔，如: 600519, 000858"
                  className="w-full px-3 py-2 text-sm border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-400"
                />
              </div>
            </div>

            <div className="flex justify-end gap-3 p-4 border-t border-slate-200">
              <button
                onClick={() => setShowModal(false)}
                className="px-4 py-2 text-sm font-medium text-slate-700 bg-slate-100 rounded-lg hover:bg-slate-200 transition-colors"
              >
                取消
              </button>
              <button
                onClick={handleClean}
                disabled={cleaning}
                className="px-4 py-2 text-sm font-medium bg-blue-600 text-white rounded-lg hover:bg-blue-500 disabled:opacity-50 transition-colors flex items-center gap-2"
              >
                {cleaning && (
                  <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                )}
                {cleaning ? "清洗中..." : "开始清洗"}
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
