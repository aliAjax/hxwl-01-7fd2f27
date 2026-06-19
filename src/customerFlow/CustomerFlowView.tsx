import { useState, useMemo } from "react";
import { useCustomerFlow, FLOW_STEPS, FlowStep } from "./CustomerFlowContext";
import { useArchive } from "../archive/ArchiveContext";
import { useWorkflow } from "../workflow/WorkflowContext";
import type { CustomerProfile } from "../archive/archive.types";
import HearingModule from "../hearing/HearingModule";
import ComparisonModule from "../comparison/ComparisonModule";
import QcModule from "../qc/QcModule";
import FittingSummary from "../summary/FittingSummary";
import SummaryConfigModal from "../summary/SummaryConfigModal";
import { DEFAULT_SUMMARY_CONFIG } from "../summary/summary.types";
import type { SummaryPreviewConfig } from "../summary/summary.types";
import { DraftIndicator, useDraft } from "../draft";
import { WorkbenchRoleChips } from "./WorkbenchRoleChips";
import { FollowUpPanel } from "./FollowUpPanel";
import { ProfileStep } from "./ProfileStep";
import { FittingStep } from "./FittingStep";

function avatarColor(name: string): string {
  const palette = [
    "#155e75",
    "#0369a1",
    "#7c3aed",
    "#be123c",
    "#c2410c",
    "#166534",
    "#3730a3",
    "#9a3412"
  ];
  let h = 0;
  for (let i = 0; i < name.length; i++) h = (h * 31 + name.charCodeAt(i)) >>> 0;
  return palette[h % palette.length];
}

function FlowStepBar() {
  const { activeStep, setActiveStep, getStepStatus, aggregate } = useCustomerFlow();

  return (
    <div className="flow-step-bar">
      {FLOW_STEPS.map((step, idx) => {
        const status = aggregate
          ? getStepStatus(step.key)
          : step.key === activeStep
            ? "current"
            : "unavailable";
        return (
          <div key={step.key} className="flow-step-item-wrap">
            {idx > 0 && (
              <div
                className={`flow-step-connector ${status === "completed" ? "connector-done" : ""}`}
              />
            )}
            <button
              className={`flow-step-item step-${status}`}
              onClick={() => {
                if (status !== "unavailable") setActiveStep(step.key);
              }}
              disabled={status === "unavailable"}
              title={step.label}
            >
              <span className="flow-step-icon">{step.icon}</span>
              <span className="flow-step-label">{step.label}</span>
              {status === "completed" && <span className="flow-step-check">✓</span>}
            </button>
          </div>
        );
      })}
    </div>
  );
}

function CustomerList() {
  const { customers } = useArchive();
  const { activeCustomerId, setActiveCustomerId } = useCustomerFlow();
  const [search, setSearch] = useState("");

  const filtered = useMemo(() => {
    if (!search) return customers;
    const kw = search.toLowerCase();
    return customers.filter(
      (c) =>
        c.name.toLowerCase().includes(kw) ||
        c.customerNo.toLowerCase().includes(kw) ||
        c.phone.includes(kw)
    );
  }, [customers, search]);

  return (
    <aside className="flow-customer-list panel">
      <div className="flow-customer-list-header">
        <h3>客户档案</h3>
        <span className="muted">{customers.length} 条</span>
      </div>
      <input
        type="search"
        className="flow-customer-search"
        placeholder="搜索姓名/编号/电话..."
        value={search}
        onChange={(e) => setSearch(e.target.value)}
      />
      <div className="flow-customer-scroll">
        {filtered.length === 0 ? (
          <div className="flow-customer-empty">
            <div className="empty-icon">📂</div>
            <p>暂无客户档案</p>
            <p className="muted">请在档案库中新增客户</p>
          </div>
        ) : (
          filtered.map((c) => {
            const active = c.id === activeCustomerId;
            return (
              <article
                key={c.id}
                className={`flow-customer-row ${active ? "flow-customer-active" : ""}`}
                onClick={() => setActiveCustomerId(c.id)}
              >
                <div className="flow-customer-avatar" style={{ background: avatarColor(c.name) }}>
                  {c.name.slice(0, 1) || "?"}
                </div>
                <div className="flow-customer-info">
                  <div className="flow-customer-name-row">
                    <strong>{c.name || "(未命名)"}</strong>
                    <span className="flow-customer-no">{c.customerNo}</span>
                  </div>
                  <div className="flow-customer-sub">
                    {c.hearingLossType} · {c.phone}
                  </div>
                </div>
              </article>
            );
          })
        )}
      </div>
    </aside>
  );
}

function ActiveStepPanel() {
  const {
    activeStep,
    activeCustomerProfile,
    aggregate,
    activeLatestWorkflowRecord,
    summaryData,
    generateSummaryFromFlow,
    goToNextStep,
    goToPrevStep
  } = useCustomerFlow();

  const [summaryOpen, setSummaryOpen] = useState(false);
  const [summaryConfigOpen, setSummaryConfigOpen] = useState(false);
  const [summaryConfig, setSummaryConfig] = useState<SummaryPreviewConfig>(DEFAULT_SUMMARY_CONFIG);

  const customerId = activeCustomerProfile?.id || null;

  const handleGenerateSummary = async () => {
    const data = await generateSummaryFromFlow();
    if (data) {
      setSummaryOpen(true);
    }
  };

  const handleConfirmSummaryConfig = async (config: SummaryPreviewConfig) => {
    setSummaryConfig(config);
    setSummaryConfigOpen(false);
    const data = await generateSummaryFromFlow();
    if (data) {
      setSummaryOpen(true);
    }
  };

  if (!activeCustomerProfile) {
    return (
      <div className="flow-empty-state">
        <div className="flow-empty-icon">👈</div>
        <h3>请选择客户开始流程</h3>
        <p>从左侧客户列表选择一位客户，所有模块将围绕该客户上下文工作</p>
        <div className="flow-feature-grid">
          {FLOW_STEPS.map((step) => (
            <div key={step.key} className="flow-feature-card">
              <div className="flow-feature-icon">{step.icon}</div>
              <span>{step.label}</span>
            </div>
          ))}
        </div>
      </div>
    );
  }

  const renderStepContent = () => {
    switch (activeStep) {
      case "profile":
        return <ProfileStep profile={activeCustomerProfile} aggregate={aggregate} />;

      case "hearing":
        return (
          <HearingModule
            customerId={customerId}
            showHeader={true}
            showSamples={true}
            onSaved={() => goToNextStep()}
          />
        );

      case "fitting":
        return <FittingStep customerId={customerId} profile={activeCustomerProfile} />;

      case "review":
        return (
          <div className="flow-review-step">
            <div className="flow-review-header">
              <h3>质控审核 - 当前客户</h3>
              <p className="muted">
                {activeCustomerProfile?.name} ({activeCustomerProfile?.customerNo})
              </p>
            </div>
            <QcModule
              customerId={customerId || undefined}
              customerNo={activeCustomerProfile?.customerNo}
            />
          </div>
        );

      case "comparison":
        return (
          <div className="flow-comparison-step">
            <div className="flow-comparison-header">
              <h3>验配对比 - 当前客户</h3>
              <p className="muted">
                {activeCustomerProfile?.name} ({activeCustomerProfile?.customerNo})
              </p>
            </div>
            <ComparisonModule
              customerId={customerId || undefined}
              showCustomerSelector={false}
              autoHighlight={true}
            />
          </div>
        );

      case "followup":
        return (
          <div className="flow-followup-step">
            <div className="flow-followup-header">
              <h3>安排复诊 - 当前客户</h3>
              <p className="muted">
                {activeCustomerProfile?.name} ({activeCustomerProfile?.customerNo})
              </p>
            </div>
            <FollowUpPanel customerId={customerId} />
          </div>
        );

      case "summary":
        return (
          <div className="flow-summary-step">
            <div className="flow-summary-actions">
              <button className="primary-action" onClick={handleGenerateSummary}>
                🖨️ 生成摘要报告
              </button>
              <button className="ghost-btn" onClick={() => setSummaryConfigOpen(true)}>
                ⚙️ 配置摘要内容
              </button>
            </div>
            {summaryData && (
              <FittingSummary
                data={summaryData}
                open={summaryOpen}
                onClose={() => setSummaryOpen(false)}
                config={summaryConfig}
                onOpenConfig={() => {
                  setSummaryOpen(false);
                  setSummaryConfigOpen(true);
                }}
              />
            )}
            <SummaryConfigModal
              open={summaryConfigOpen}
              initialConfig={summaryConfig}
              onClose={() => setSummaryConfigOpen(false)}
              onConfirm={handleConfirmSummaryConfig}
            />
          </div>
        );

      default:
        return <ProfileStep profile={activeCustomerProfile} aggregate={aggregate} />;
    }
  };

  return (
    <div className="flow-step-content">
      <div className="flow-step-header">
        <button className="ghost-btn" onClick={goToPrevStep} disabled={activeStep === "profile"}>
          ← 上一步
        </button>
        <div className="flow-step-title">
          <span className="flow-step-eyebrow">
            {activeCustomerProfile.name} ({activeCustomerProfile.customerNo})
          </span>
          <h2>{FLOW_STEPS.find((s) => s.key === activeStep)?.label}</h2>
        </div>
        <button
          className="primary-action"
          onClick={goToNextStep}
          disabled={activeStep === "summary"}
        >
          下一步 →
        </button>
      </div>
      {renderStepContent()}
    </div>
  );
}

export default function CustomerFlowView() {
  return (
    <div className="customer-flow-shell">
      <CustomerList />
      <div className="flow-main">
        <FlowStepBar />
        <ActiveStepPanel />
      </div>
    </div>
  );
}
