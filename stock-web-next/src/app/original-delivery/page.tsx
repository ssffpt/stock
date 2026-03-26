"use client";

import { useState, useEffect, useCallback, useRef } from "react";
import * as XLSX from "xlsx";
import {
  getDeliveries,
  createDelivery,
  batchCreateDeliveries,
  OriginalDelivery,
  OriginalDeliveryParams,
  OriginalDeliveryCreate,
} from "@/lib/api";

export default function OriginalDeliveryPage() {
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

  const [deliveries, setDeliveries] = useState<OriginalDelivery[]>([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(20);
  const [loading, setLoading] = useState(false);
  const [stockCode, setStockCode] = useState("");
  const [stockName, setStockName] = useState("");
  const [dateRange, setDateRange] = useState<"this_month" | "three_months" | "custom">("this_month");
  const [tradeDateStart, setTradeDateStart] = useState(getMonthStart);
  const [tradeDateEnd, setTradeDateEnd] = useState(getToday);
  const [showAddModal, setShowAddModal] = useState(false);
  const [showImportModal, setShowImportModal] = useState(false);
  const [importFile, setImportFile] = useState<File | null>(null);
  const [importPreview, setImportPreview] = useState<OriginalDeliveryCreate[]>([]);
  const [importLoading, setImportLoading] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [formData, setFormData] = useState<OriginalDeliveryCreate>({
    trade_date: new Date().toISOString().split("T")[0],
    trade_time: null,
    stock_code: "",
    stock_name: "",
    trade_type: "买入",
    quantity: 0,
    trade_price: 0,
    occur_amount: 0,
    deal_amount: 0,
    fee: 0,
    remark: "",
  });

  const handleDateRangeChange = (range: "this_month" | "three_months" | "custom") => {
    setDateRange(range);
    if (range === "this_month") {
      setTradeDateStart(getMonthStart());
      setTradeDateEnd(getToday());
    } else if (range === "three_months") {
      setTradeDateStart(getThreeMonthsAgo());
      setTradeDateEnd(getToday());
    }
  };

  const fetchData = useCallback(async () => {
    setLoading(true);
    try {
      const params: OriginalDeliveryParams = {
        page,
        page_size: pageSize,
        stock_code: stockCode || undefined,
        stock_name: stockName || undefined,
        trade_date_start: tradeDateStart || undefined,
        trade_date_end: tradeDateEnd || undefined,
      };

      const response = await getDeliveries(params);
      if (response.code === 200) {
        setDeliveries(response.data.items);
        setTotal(response.data.total);
      }
    } catch (error) {
      console.error("获取数据失败:", error);
    } finally {
      setLoading(false);
    }
  }, [page, pageSize, stockCode, stockName, tradeDateStart, tradeDateEnd]);

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
    setStockName("");
    setDateRange("this_month");
    setTradeDateStart(getMonthStart());
    setTradeDateEnd(getToday());
    setPage(1);
  };

  const handleFormChange = (field: keyof OriginalDeliveryCreate, value: any) => {
    const newForm = { ...formData, [field]: value };

    // 自动计算成交金额和发生金额
    if (field === "quantity" || field === "trade_price") {
      const qty = field === "quantity" ? value : newForm.quantity;
      const price = field === "trade_price" ? value : newForm.trade_price;
      newForm.deal_amount = qty * price;
      if (newForm.trade_type === "买入") {
        newForm.occur_amount = -(qty * price + (newForm.fee || 0));
      } else if (newForm.trade_type === "卖出") {
        newForm.occur_amount = qty * price - (newForm.fee || 0);
      }
    }
    if (field === "trade_type") {
      const qty = newForm.quantity;
      const price = newForm.trade_price;
      newForm.deal_amount = qty * price;
      if (value === "买入") {
        newForm.occur_amount = -(qty * price + (newForm.fee || 0));
      } else if (value === "卖出") {
        newForm.occur_amount = qty * price - (newForm.fee || 0);
      }
    }
    if (field === "fee") {
      const qty = newForm.quantity;
      const price = newForm.trade_price;
      if (newForm.trade_type === "买入") {
        newForm.occur_amount = -(qty * price + (value || 0));
      } else if (newForm.trade_type === "卖出") {
        newForm.occur_amount = qty * price - (value || 0);
      }
    }

    setFormData(newForm);
  };

  const handleSubmit = async () => {
    try {
      const response = await createDelivery(formData);
      if (response.code === 200) {
        setShowAddModal(false);
        setFormData({
          trade_date: new Date().toISOString().split("T")[0],
          trade_time: null,
          stock_code: "",
          stock_name: "",
          trade_type: "买入",
          quantity: 0,
          trade_price: 0,
          occur_amount: 0,
          deal_amount: 0,
          fee: 0,
          remark: "",
        });
        fetchData();
      }
    } catch (error) {
      console.error("创建失败:", error);
    }
  };

  const parseExcelFile = (file: File): Promise<OriginalDeliveryCreate[]> => {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = (e) => {
        try {
          const data = e.target?.result;
          const workbook = XLSX.read(data, { type: "binary" });
          const sheetName = workbook.SheetNames[0];
          const worksheet = workbook.Sheets[sheetName];
          const jsonData = XLSX.utils.sheet_to_json(worksheet);

          const results: OriginalDeliveryCreate[] = jsonData.map((row: any) => ({
            trade_date: String(row["日期"] || row["成交日期"] || ""),
            trade_time: String(row["时间"] || row["成交时间"] || "").replace("'", "") || null,
            stock_code: String(row["股票代码"] || row["代码"] || ""),
            stock_name: String(row["股票名称"] || row["名称"] || ""),
            trade_type: String(row["买卖"] || row["交易类别"] || row["方向"] || "") as "买入" | "卖出",
            quantity: parseInt(String(row["成交数量"] || row["数量"] || row["股数"] || 0)) || 0,
            trade_price: parseFloat(String(row["价格"] || row["成交价格"] || 0)) || 0,
            occur_amount: parseFloat(String(row["发生金额"] || 0)) || 0,
            deal_amount: parseFloat(String(row["成交金额"] || 0)) || 0,
            fee: parseFloat(String(row["手续费"] || row["费用"] || 0)) || 0,
            remark: String(row["备注"] || row["注释"] || ""),
          })).filter(item => item.stock_code && item.trade_date);

          resolve(results);
        } catch (error) {
          reject(error);
        }
      };
      reader.onerror = () => reject(reader.error);
      reader.readAsBinaryString(file);
    });
  };

  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setImportFile(file);
    try {
      const data = await parseExcelFile(file);
      setImportPreview(data);
    } catch (error) {
      console.error("解析文件失败:", error);
      alert("解析文件失败，请检查文件格式");
    }
  };

  const handleImport = async () => {
    if (importPreview.length === 0) {
      alert("请先选择文件");
      return;
    }

    setImportLoading(true);
    try {
      const response = await batchCreateDeliveries(importPreview);
      if (response.code === 200) {
        setShowImportModal(false);
        setImportFile(null);
        setImportPreview([]);
        fetchData();
        alert(`成功导入 ${response.data.length} 条记录`);
      }
    } catch (error) {
      console.error("导入失败:", error);
      alert("导入失败");
    } finally {
      setImportLoading(false);
    }
  };

  const resetImportModal = () => {
    setShowImportModal(false);
    setImportFile(null);
    setImportPreview([]);
    if (fileInputRef.current) {
      fileInputRef.current.value = "";
    }
  };

  const formatNumber = (num: number | string | null, decimals: number = 2) => {
    if (num === null || num === undefined) return "-";
    const numericValue = typeof num === "string" ? parseFloat(num) : num;
    if (isNaN(numericValue)) return "-";
    return numericValue.toFixed(decimals);
  };

  return (
    <div className="p-6 max-w-7xl mx-auto">
      <div className="flex justify-between items-center mb-6">
        <div>
          <h1 className="text-2xl font-bold text-slate-800">原始交割单</h1>
          <p className="text-sm text-slate-500 mt-1">管理股票交易交割记录</p>
        </div>
        <div className="flex gap-2">
          <button
            onClick={() => setShowImportModal(true)}
            className="px-4 py-2 text-sm font-medium bg-emerald-600 text-white rounded-lg hover:bg-emerald-500 transition-colors"
          >
            批量导入
          </button>
          <button
            onClick={() => setShowAddModal(true)}
            className="px-4 py-2 text-sm font-medium bg-slate-800 text-white rounded-lg hover:bg-slate-700 transition-colors"
          >
            新增
          </button>
        </div>
      </div>

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
            <label className="block text-xs font-medium text-slate-500 mb-1.5">股票名称</label>
            <input
              type="text"
              value={stockName}
              onChange={(e) => setStockName(e.target.value)}
              placeholder="如: 贵州茅台"
              className="w-full px-3 py-2 text-sm border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-slate-400 focus:border-transparent transition-shadow"
            />
          </div>
          <div>
            <label className="block text-xs font-medium text-slate-500 mb-1.5">成交日期</label>
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
                <label className="block text-xs font-medium text-slate-500 mb-1.5">成交日期起</label>
                <input
                  type="date"
                  value={tradeDateStart}
                  onChange={(e) => {
                    setTradeDateStart(e.target.value);
                    setDateRange("custom");
                  }}
                  className="w-full px-3 py-2 text-sm border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-slate-400 focus:border-transparent transition-shadow"
                />
              </div>
              <div>
                <label className="block text-xs font-medium text-slate-500 mb-1.5">成交日期止</label>
                <input
                  type="date"
                  value={tradeDateEnd}
                  onChange={(e) => {
                    setTradeDateEnd(e.target.value);
                    setDateRange("custom");
                  }}
                  className="w-full px-3 py-2 text-sm border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-slate-400 focus:border-transparent transition-shadow"
                />
              </div>
            </>
          )}
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
                <th className="px-4 py-3 text-left text-xs font-semibold text-slate-600 tracking-wide">成交日期</th>
                <th className="px-4 py-3 text-left text-xs font-semibold text-slate-600 tracking-wide">成交时间</th>
                <th className="px-4 py-3 text-left text-xs font-semibold text-slate-600 tracking-wide">股票代码</th>
                <th className="px-4 py-3 text-left text-xs font-semibold text-slate-600 tracking-wide">股票名称</th>
                <th className="px-4 py-3 text-center text-xs font-semibold text-slate-600 tracking-wide">买卖</th>
                <th className="px-4 py-3 text-right text-xs font-semibold text-slate-600 tracking-wide">数量</th>
                <th className="px-4 py-3 text-right text-xs font-semibold text-slate-600 tracking-wide">价格</th>
                <th className="px-4 py-3 text-right text-xs font-semibold text-slate-600 tracking-wide">成交金额</th>
                <th className="px-4 py-3 text-right text-xs font-semibold text-slate-600 tracking-wide">手续费</th>
                <th className="px-4 py-3 text-left text-xs font-semibold text-slate-600 tracking-wide">备注</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {loading ? (
                <tr>
                  <td colSpan={10} className="px-4 py-12 text-center">
                    <div className="flex items-center justify-center gap-2 text-slate-400">
                      <div className="w-5 h-5 border-2 border-slate-300 border-t-slate-600 rounded-full animate-spin" />
                      加载中...
                    </div>
                  </td>
                </tr>
              ) : deliveries.length === 0 ? (
                <tr>
                  <td colSpan={10} className="px-4 py-12 text-center text-slate-400 text-sm">
                    暂无数据
                  </td>
                </tr>
              ) : (
                deliveries.map((delivery, index) => (
                  <tr key={delivery.id} className="hover:bg-slate-50 transition-colors">
                    <td className="px-4 py-3 text-sm font-medium text-slate-800">{delivery.trade_date}</td>
                    <td className="px-4 py-3 text-sm text-slate-500">{delivery.trade_time || "-"}</td>
                    <td className="px-4 py-3 text-sm text-slate-800">{delivery.stock_code}</td>
                    <td className="px-4 py-3 text-sm text-slate-800">{delivery.stock_name}</td>
                    <td className="px-4 py-3 text-center">
                      <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium ${delivery.trade_type === "买入" ? "bg-red-100 text-red-700" : "bg-blue-100 text-blue-700"}`}>
                        {delivery.trade_type}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-sm text-slate-600 text-right">{delivery.quantity}</td>
                    <td className="px-4 py-3 text-sm text-slate-600 text-right">{formatNumber(delivery.trade_price, 3)}</td>
                    <td className="px-4 py-3 text-sm text-slate-600 text-right">{formatNumber(delivery.deal_amount)}</td>
                    <td className="px-4 py-3 text-sm text-slate-500 text-right">{formatNumber(delivery.fee)}</td>
                    <td className="px-4 py-3 text-sm text-slate-500">{delivery.remark || "-"}</td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>

        {/* 分页 */}
        <div className="px-4 py-3 flex items-center justify-between border-t border-slate-200 bg-slate-50">
          <div className="flex items-center gap-4">
            <span className="text-sm text-slate-500">每页显示</span>
            <select
              value={pageSize}
              onChange={(e) => {
                setPageSize(Number(e.target.value));
                setPage(1);
              }}
              className="px-2 py-1.5 text-sm border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-slate-400 bg-white"
            >
              <option value={10}>10条</option>
              <option value={20}>20条</option>
              <option value={50}>50条</option>
              <option value={100}>100条</option>
            </select>
            <span className="text-sm text-slate-500">
              共 <span className="font-medium text-slate-700">{total}</span> 条记录，当前第 <span className="font-medium text-slate-700">{page}</span> / {totalPages} 页
            </span>
          </div>
          <div className="flex gap-2">
            <button
              onClick={() => setPage(1)}
              disabled={page <= 1}
              className="px-3 py-1.5 text-sm border border-slate-200 rounded-lg disabled:opacity-50 disabled:cursor-not-allowed hover:bg-white transition-colors"
            >
              首页
            </button>
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
            <button
              onClick={() => setPage(totalPages)}
              disabled={page >= totalPages}
              className="px-3 py-1.5 text-sm border border-slate-200 rounded-lg disabled:opacity-50 disabled:cursor-not-allowed hover:bg-white transition-colors"
            >
              末页
            </button>
          </div>
        </div>
      </div>

      {/* 新增弹窗 */}
      {showAddModal && (
        <div className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-lg overflow-hidden">
            <div className="px-6 py-5 border-b border-slate-200 flex items-center justify-between">
              <h2 className="text-lg font-semibold text-slate-800">新增交割记录</h2>
              <button onClick={() => setShowAddModal(false)} className="w-8 h-8 rounded-full bg-slate-100 hover:bg-slate-200 flex items-center justify-center text-slate-500 transition-colors">
                ✕
              </button>
            </div>
            <div className="p-6 max-h-[70vh] overflow-auto">
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-medium text-slate-500 mb-1.5">成交日期 *</label>
                  <input
                    type="date"
                    value={formData.trade_date}
                    onChange={(e) => handleFormChange("trade_date", e.target.value)}
                    className="w-full px-3 py-2 text-sm border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-slate-400 focus:border-transparent transition-shadow"
                  />
                </div>
                <div>
                  <label className="block text-xs font-medium text-slate-500 mb-1.5">成交时间</label>
                  <input
                    type="time"
                    value={formData.trade_time || ""}
                    onChange={(e) => handleFormChange("trade_time", e.target.value || null)}
                    className="w-full px-3 py-2 text-sm border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-slate-400 focus:border-transparent transition-shadow"
                  />
                </div>
                <div>
                  <label className="block text-xs font-medium text-slate-500 mb-1.5">股票代码 *</label>
                  <input
                    type="text"
                    value={formData.stock_code}
                    onChange={(e) => handleFormChange("stock_code", e.target.value)}
                    placeholder="如: 600519"
                    className="w-full px-3 py-2 text-sm border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-slate-400 focus:border-transparent transition-shadow"
                  />
                </div>
                <div>
                  <label className="block text-xs font-medium text-slate-500 mb-1.5">股票名称 *</label>
                  <input
                    type="text"
                    value={formData.stock_name}
                    onChange={(e) => handleFormChange("stock_name", e.target.value)}
                    placeholder="如: 贵州茅台"
                    className="w-full px-3 py-2 text-sm border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-slate-400 focus:border-transparent transition-shadow"
                  />
                </div>
                <div>
                  <label className="block text-xs font-medium text-slate-500 mb-1.5">交易类别 *</label>
                  <select
                    value={formData.trade_type}
                    onChange={(e) => handleFormChange("trade_type", e.target.value)}
                    className="w-full px-3 py-2 text-sm border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-slate-400 focus:border-transparent transition-shadow bg-white"
                  >
                    <option value="买入">买入</option>
                    <option value="卖出">卖出</option>
                  </select>
                </div>
                <div>
                  <label className="block text-xs font-medium text-slate-500 mb-1.5">数量 *</label>
                  <input
                    type="number"
                    value={formData.quantity}
                    onChange={(e) => handleFormChange("quantity", parseInt(e.target.value) || 0)}
                    className="w-full px-3 py-2 text-sm border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-slate-400 focus:border-transparent transition-shadow"
                  />
                </div>
                <div>
                  <label className="block text-xs font-medium text-slate-500 mb-1.5">成交价格 *</label>
                  <input
                    type="number"
                    step="0.001"
                    value={formData.trade_price}
                    onChange={(e) => handleFormChange("trade_price", parseFloat(e.target.value) || 0)}
                    className="w-full px-3 py-2 text-sm border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-slate-400 focus:border-transparent transition-shadow"
                  />
                </div>
                <div>
                  <label className="block text-xs font-medium text-slate-500 mb-1.5">手续费</label>
                  <input
                    type="number"
                    step="0.01"
                    value={formData.fee || 0}
                    onChange={(e) => handleFormChange("fee", parseFloat(e.target.value) || 0)}
                    className="w-full px-3 py-2 text-sm border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-slate-400 focus:border-transparent transition-shadow"
                  />
                </div>
                <div className="col-span-2">
                  <label className="block text-xs font-medium text-slate-500 mb-1.5">备注</label>
                  <input
                    type="text"
                    value={formData.remark || ""}
                    onChange={(e) => handleFormChange("remark", e.target.value)}
                    className="w-full px-3 py-2 text-sm border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-slate-400 focus:border-transparent transition-shadow"
                  />
                </div>
                <div className="col-span-2 bg-slate-50 p-4 rounded-xl">
                  <div className="text-sm text-slate-600 space-y-1">
                    <div className="flex justify-between">
                      <span>成交金额:</span>
                      <span className="font-semibold text-slate-800">{formatNumber(formData.deal_amount)}</span>
                    </div>
                    <div className="flex justify-between">
                      <span>发生金额:</span>
                      <span className={`font-semibold ${(formData.occur_amount || 0) >= 0 ? "text-red-500" : "text-emerald-500"}`}>
                        {(formData.occur_amount || 0) >= 0 ? "+" : ""}{formatNumber(formData.occur_amount)}
                      </span>
                    </div>
                  </div>
                </div>
              </div>
            </div>
            <div className="px-6 py-4 border-t border-slate-200 flex justify-end gap-2 bg-slate-50">
              <button
                onClick={() => setShowAddModal(false)}
                className="px-4 py-2 text-sm font-medium bg-white text-slate-600 rounded-lg hover:bg-slate-100 transition-colors border border-slate-200"
              >
                取消
              </button>
              <button
                onClick={handleSubmit}
                className="px-4 py-2 text-sm font-medium bg-slate-800 text-white rounded-lg hover:bg-slate-700 transition-colors"
              >
                提交
              </button>
            </div>
          </div>
        </div>
      )}

      {/* 批量导入弹窗 */}
      {showImportModal && (
        <div className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-2xl overflow-hidden">
            <div className="px-6 py-5 border-b border-slate-200 flex items-center justify-between">
              <h2 className="text-lg font-semibold text-slate-800">批量导入交割记录</h2>
              <button onClick={resetImportModal} className="w-8 h-8 rounded-full bg-slate-100 hover:bg-slate-200 flex items-center justify-center text-slate-500 transition-colors">
                ✕
              </button>
            </div>
            <div className="p-6">
              <div className="mb-4">
                <label className="block text-xs font-medium text-slate-500 mb-2">选择 Excel 文件</label>
                <input
                  ref={fileInputRef}
                  type="file"
                  accept=".xlsx,.xls"
                  onChange={handleFileChange}
                  className="w-full px-4 py-3 text-sm border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-slate-400 focus:border-transparent transition-shadow file:mr-4 file:py-1 file:px-3 file:rounded-lg file:border-0 file:text-sm file:font-medium file:bg-slate-100 file:text-slate-700 hover:file:bg-slate-200"
                />
              </div>
              <div className="bg-slate-50 rounded-xl p-4 mb-4">
                <p className="text-sm text-slate-600">
                  <span className="font-medium text-slate-700">导入说明：</span><br />
                  支持重复数据自动覆盖更新<br />
                  表头包含：日期、成交日期、时间、成交时间、股票代码、代码、股票名称、名称、买卖、交易类别、方向、成交数量、数量、股数、价格、成交价格、发生金额、成交金额、手续费、费用、备注、注释 等字段
                </p>
              </div>
              {importPreview.length > 0 && (
                <div className="mt-4">
                  <div className="text-sm font-medium text-slate-700 mb-2">
                    预览：共 {importPreview.length} 条记录
                  </div>
                  <div className="max-h-60 overflow-auto border border-slate-200 rounded-xl">
                    <table className="min-w-full text-xs">
                      <thead className="bg-slate-100 sticky top-0">
                        <tr>
                          <th className="px-3 py-2 text-left font-semibold text-slate-600">日期</th>
                          <th className="px-3 py-2 text-left font-semibold text-slate-600">股票代码</th>
                          <th className="px-3 py-2 text-left font-semibold text-slate-600">股票名称</th>
                          <th className="px-3 py-2 text-left font-semibold text-slate-600">买卖</th>
                          <th className="px-3 py-2 text-right font-semibold text-slate-600">数量</th>
                          <th className="px-3 py-2 text-right font-semibold text-slate-600">价格</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-slate-100">
                        {importPreview.slice(0, 10).map((item, index) => (
                          <tr key={index} className="hover:bg-slate-50">
                            <td className="px-3 py-2 text-slate-700">{item.trade_date}</td>
                            <td className="px-3 py-2 text-slate-700">{item.stock_code}</td>
                            <td className="px-3 py-2 text-slate-700">{item.stock_name}</td>
                            <td className="px-3 py-2">
                              <span className={`inline-flex px-2 py-0.5 rounded-full text-xs font-medium ${item.trade_type === "买入" ? "bg-red-100 text-red-700" : "bg-blue-100 text-blue-700"}`}>
                                {item.trade_type}
                              </span>
                            </td>
                            <td className="px-3 py-2 text-right text-slate-600">{item.quantity}</td>
                            <td className="px-3 py-2 text-right text-slate-600">{item.trade_price}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                    {importPreview.length > 10 && (
                      <div className="px-3 py-2 text-xs text-slate-500 text-center bg-slate-50">
                        ... 还有 {importPreview.length - 10} 条记录未显示
                      </div>
                    )}
                  </div>
                </div>
              )}
            </div>
            <div className="px-6 py-4 border-t border-slate-200 flex justify-end gap-2 bg-slate-50">
              <button
                onClick={resetImportModal}
                className="px-4 py-2 text-sm font-medium bg-white text-slate-600 rounded-lg hover:bg-slate-100 transition-colors border border-slate-200"
              >
                取消
              </button>
              <button
                onClick={handleImport}
                disabled={importPreview.length === 0 || importLoading}
                className="px-4 py-2 text-sm font-medium bg-emerald-600 text-white rounded-lg hover:bg-emerald-500 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
              >
                {importLoading ? (
                  <span className="flex items-center gap-2">
                    <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                    导入中...
                  </span>
                ) : `导入 ${importPreview.length} 条`}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
