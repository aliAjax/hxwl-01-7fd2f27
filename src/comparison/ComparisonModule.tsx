import { useState, useEffect, useRef, forwardRef, useImperativeHandle, useCallback } from "react";
import { ComparisonData, FittingRecord, ComparisonStatus } from "./comparison.types";
import { generateComparisonResults, updateFittingRecord, statusLabelMap } from "./comparison.utils";
import { useArchive } from "../archive/ArchiveContext";
import { createEmptyComparison } from "../archive/archive.types";
import type { CustomerProfile } from "../archive/archive.types";

export interface ComparisonModuleHandle {
  scrollIntoView: () => void;
  triggerHighlight: () => void;
}

interface ComparisonModuleProps {
  customerId?: string;
  onBack?: () => void;
  autoHighlight?: boolean;
  showCustomerSelector?: boolean;
}

function StatusBadge({ status }: { status: ComparisonStatus }) {
  const label = statusLabelMap[status];
  return <span className={`cmp-status-badge cmp-status-${status}`}>{label}</span>;
}

function ComparisonCard({
  label,
  initialValue,
  followUpValue,
  status,
  changeValue
}: {
  label: string;
  initialValue: string;
  followUpValue: string;
  status: ComparisonStatus;
  changeValue?: string;
}) {
  return (
    <article className={`cmp-card cmp-card-${status}`}>
      <div className="cmp-card-head">
        <h4>{label}</h4>
        <StatusBadge status={status} />
      </div>
      <div className="cmp-card-body">
        <div className="cmp-card-col">
          <span className="cmp-card-label">初配</span>
          <p className="cmp-card-value">{initialValue}</p>
        </div>
        <div className="cmp-card-arrow">
          <span className="cmp-arrow-icon">→</span>
          {changeValue && (
            <span className={`cmp-change-text cmp-change-${status}`}>{changeValue}</span>
          )}
        </div>
        <div className="cmp-card-col">
          <span className="cmp-card-label">复调</span>
          <p className="cmp-card-value">{followUpValue}</p>
        </div>
      </div>
    </article>
  );
}

function FittingForm({
  title,
  subtitle,
  record,
  onChange,
  accent = "primary"
}: {
  title: string;
  subtitle: string;
  record: FittingRecord;
  onChange: (field: keyof FittingRecord, value: string | number | null) => void;
  accent?: "primary" | "accent";
}) {
  return (
    <div className={`fitting-form fitting-form-${accent}`}>
      <div className="fitting-form-head">
        <div>
          <h3>{title}</h3>
          <p className="fitting-form-sub">{subtitle}</p>
        </div>
        {record.fittingStage && <span className="fitting-stage-tag">{record.fittingStage}</span>}
      </div>

      <div className="fitting-form-body">
        <label className="fitting-field">
          <span className="fitting-field-label">言语识别率 (%)</span>
          <input
            type="number"
            min="0"
            max="100"
            placeholder="0 - 100"
            value={record.speechRecognitionRate ?? ""}
            onChange={(e) => {
              const val = e.target.value;
              onChange("speechRecognitionRate", val === "" ? null : Number(val));
            }}
          />
        </label>

        <label className="fitting-field">
          <span className="fitting-field-label">反馈啸叫情况</span>
          <textarea
            placeholder="描述啸叫发生的场景、频率、严重程度等"
            value={record.feedbackWhistle}
            onChange={(e) => onChange("feedbackWhistle", e.target.value)}
            rows={3}
          />
        </label>

        <label className="fitting-field">
          <span className="fitting-field-label">增益调整摘要</span>
          <textarea
            placeholder="简述增益调整的频段、幅度、压缩比变化等"
            value={record.gainAdjustment}
            onChange={(e) => onChange("gainAdjustment", e.target.value)}
            rows={4}
          />
        </label>

        {record.recordDate && (
          <div className="fitting-meta">
            <span className="fitting-meta-label">记录日期</span>
            <span className="fitting-meta-value">{record.recordDate}</span>
          </div>
        )}
      </div>
    </div>
  );
}

const ComparisonModule = forwardRef<ComparisonModuleHandle, ComparisonModuleProps>(
  function ComparisonModule(
    { customerId, onBack, autoHighlight = false, showCustomerSelector = true },
    ref
  ) {
    const moduleRef = useRef<HTMLElement>(null);
    const { customers, createComparison, updateComparison, getLatestComparison } = useArchive();

    const [activeCustomerId, setActiveCustomerId] = useState<string>(customerId || "");
    const [comparisonData, setComparisonData] = useState<ComparisonData | null>(null);
    const [isHighlighted, setIsHighlighted] = useState(false);
    const [isSaving, setIsSaving] = useState(false);
    const [saveSuccess, setSaveSuccess] = useState(false);
    const [isLoading, setIsLoading] = useState(false);

    useImperativeHandle(ref, () => ({
      scrollIntoView: () => {
        moduleRef.current?.scrollIntoView({ behavior: "smooth", block: "start" });
      },
      triggerHighlight: () => {
        setIsHighlighted(true);
        setTimeout(() => setIsHighlighted(false), 2400);
      }
    }));

    const loadComparison = useCallback(
      async (cid: string) => {
        if (!cid) {
          setComparisonData(null);
          return;
        }
        setIsLoading(true);
        try {
          const existing = await getLatestComparison(cid);
          if (existing) {
            setComparisonData(existing);
          } else {
            const customer = customers.find((c) => c.id === cid);
            const empty = createEmptyComparison(cid);
            if (customer) {
              empty.customerName = customer.name;
              empty.hearingLossType = customer.hearingLossType;
            }
            setComparisonData(empty);
          }
        } catch (e) {
          console.error("加载对比数据失败:", e);
        } finally {
          setIsLoading(false);
        }
      },
      [getLatestComparison, customers]
    );

    useEffect(() => {
      if (customerId) {
        setActiveCustomerId(customerId);
        loadComparison(customerId);
      }
    }, [customerId, loadComparison]);

    useEffect(() => {
      if (autoHighlight && customerId) {
        setIsHighlighted(true);
        const timer = setTimeout(() => setIsHighlighted(false), 2400);
        return () => clearTimeout(timer);
      }
    }, [autoHighlight, customerId]);

    const activeCustomer = customers.find((c) => c.id === activeCustomerId);

    const results = comparisonData ? generateComparisonResults(comparisonData) : [];

    const handleCustomerChange = async (cid: string) => {
      setActiveCustomerId(cid);
      setSaveSuccess(false);
      await loadComparison(cid);
    };

    const handleInitialChange = (field: keyof FittingRecord, value: string | number | null) => {
      if (!comparisonData) return;
      setComparisonData((prev) =>
        prev ? updateFittingRecord(prev, "initial", field, value) : null
      );
      setSaveSuccess(false);
    };

    const handleFollowUpChange = (field: keyof FittingRecord, value: string | number | null) => {
      if (!comparisonData) return;
      setComparisonData((prev) =>
        prev ? updateFittingRecord(prev, "followUp", field, value) : null
      );
      setSaveSuccess(false);
    };

    const handleSave = async () => {
      if (!comparisonData || !activeCustomerId) return;

      setIsSaving(true);
      try {
        const hasId = !!comparisonData.id;
        let saved: ComparisonData;

        if (hasId) {
          saved = await updateComparison(comparisonData, "更新对比记录");
        } else {
          saved = await createComparison(comparisonData);
        }

        setComparisonData(saved);
        setSaveSuccess(true);
        setTimeout(() => setSaveSuccess(false), 2000);
      } catch (e) {
        console.error("保存对比数据失败:", e);
        alert("保存失败，请重试");
      } finally {
        setIsSaving(false);
      }
    };

    const hasAnyData =
      comparisonData &&
      (comparisonData.initial.speechRecognitionRate !== null ||
        comparisonData.initial.feedbackWhistle ||
        comparisonData.initial.gainAdjustment ||
        comparisonData.followUp.speechRecognitionRate !== null ||
        comparisonData.followUp.feedbackWhistle ||
        comparisonData.followUp.gainAdjustment);

    const improvedCount = results.filter((r) => r.status === "improved").length;
    const stableCount = results.filter((r) => r.status === "stable").length;
    const worsenedCount = results.filter((r) => r.status === "worsened").length;

    const displayCustomerName = comparisonData?.customerName || activeCustomer?.name || "";
    const displayHearingLossType =
      comparisonData?.hearingLossType || activeCustomer?.hearingLossType || "";

    return (
      <section
        ref={moduleRef as React.RefObject<HTMLElement>}
        className={`comparison-module panel ${isHighlighted ? "cmp-highlight" : ""}`}
      >
        <div className="section-heading">
          <div>
            <p>验配效果评估</p>
            <h2>验配前后对比</h2>
          </div>
          <div className="cmp-header-actions">
            {comparisonData && (
              <button
                className={`btn btn-primary ${isSaving ? "btn-loading" : ""} ${saveSuccess ? "btn-success" : ""}`}
                onClick={handleSave}
                disabled={isSaving}
              >
                {isSaving ? "保存中..." : saveSuccess ? "✓ 已保存" : "💾 保存对比"}
              </button>
            )}
            {onBack && (
              <button className="btn btn-ghost" onClick={onBack}>
                ← 返回记录
              </button>
            )}
          </div>
        </div>

        {showCustomerSelector && customers.length > 0 && (
          <div className="cmp-customer-selector">
            <span className="cmp-selector-label">选择客户</span>
            <div className="cmp-customer-chips">
              {customers.map((c: CustomerProfile) => (
                <button
                  key={c.id}
                  className={`cmp-customer-chip ${activeCustomerId === c.id ? "cmp-customer-active" : ""}`}
                  onClick={() => handleCustomerChange(c.id)}
                >
                  <span className="cmp-customer-name">{c.name || c.customerNo}</span>
                  <span className="cmp-customer-id">{c.customerNo}</span>
                </button>
              ))}
            </div>
          </div>
        )}

        {isLoading && (
          <div className="cmp-empty">
            <div className="empty-icon">⏳</div>
            <h3>加载中...</h3>
            <p>正在加载客户对比数据</p>
          </div>
        )}

        {!isLoading && !comparisonData && (
          <div className="cmp-empty">
            <div className="empty-icon">👆</div>
            <h3>请选择客户</h3>
            <p>选择一个客户后开始录入验配对比数据</p>
          </div>
        )}

        {!isLoading && comparisonData && (
          <>
            {(displayCustomerName || displayHearingLossType) && (
              <div className="cmp-customer-info">
                {displayCustomerName && (
                  <div className="cmp-info-item">
                    <span className="cmp-info-label">客户</span>
                    <span className="cmp-info-value">{displayCustomerName}</span>
                  </div>
                )}
                {displayHearingLossType && (
                  <div className="cmp-info-item">
                    <span className="cmp-info-label">听损类型</span>
                    <span className="cmp-info-value">{displayHearingLossType || "—"}</span>
                  </div>
                )}
                {comparisonData.hearingAidModel && (
                  <div className="cmp-info-item">
                    <span className="cmp-info-label">助听器</span>
                    <span className="cmp-info-value">{comparisonData.hearingAidModel || "—"}</span>
                  </div>
                )}
              </div>
            )}

            <div className="cmp-summary-bar">
              <div className="cmp-summary-item cmp-summary-improved">
                <span className="cmp-summary-count">{improvedCount}</span>
                <span className="cmp-summary-label">项改善</span>
              </div>
              <div className="cmp-summary-item cmp-summary-stable">
                <span className="cmp-summary-count">{stableCount}</span>
                <span className="cmp-summary-label">项持平</span>
              </div>
              <div className="cmp-summary-item cmp-summary-worsened">
                <span className="cmp-summary-count">{worsenedCount}</span>
                <span className="cmp-summary-label">项变差</span>
              </div>
            </div>

            <div className="cmp-results-grid">
              {results.map((result) => (
                <ComparisonCard
                  key={result.label}
                  label={result.label}
                  initialValue={result.initialValue}
                  followUpValue={result.followUpValue}
                  status={result.status}
                  changeValue={result.changeValue}
                />
              ))}
            </div>

            <div className="cmp-form-section">
              <h3 className="cmp-form-title">数据录入</h3>
              <div className="cmp-form-grid">
                <FittingForm
                  title="初配记录"
                  subtitle="首次验配时的基准数据"
                  record={comparisonData.initial}
                  onChange={handleInitialChange}
                  accent="primary"
                />
                <FittingForm
                  title="复调记录"
                  subtitle="复诊调试后的最新数据"
                  record={comparisonData.followUp}
                  onChange={handleFollowUpChange}
                  accent="accent"
                />
              </div>
            </div>

            {!hasAnyData && (
              <div className="cmp-empty">
                <div className="empty-icon">📊</div>
                <h3>暂无对比数据</h3>
                <p>请在下方录入初配和复调数据，系统将自动生成对比结果</p>
              </div>
            )}
          </>
        )}
      </section>
    );
  }
);

export default ComparisonModule;
