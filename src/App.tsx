import "./styles.css";
import { useState, useRef } from "react";
import HearingModule from "./hearing/HearingModule";
import ComparisonModule, { ComparisonModuleHandle } from "./comparison/ComparisonModule";
import QcModule from "./qc/QcModule";
import FittingSummary from "./summary/FittingSummary";
import { getComparisonByCustomerId } from "./comparison/comparison.sampleData";
import { getSummaryByCustomerId } from "./summary/summary.sampleData";
import type { FittingSummaryData } from "./summary/summary.types";
import { useDraft, DraftIndicator } from "./draft";
import { ArchiveProvider, ArchiveModule } from "./archive";

interface CustomerRecord {
  id: string;
  customerId: string;
  hearingLossType: string;
  fittingStage: string;
  hearingAidModel: string;
  gainAdjustment: string;
  userFeedback: string;
}

type FollowUpPriority = "high" | "medium" | "low";
type ContactStatus = "pending" | "contacted" | "unreachable";
type FollowUpFilter = "all" | "today" | "week" | "overdue";

interface FollowUpRecord {
  id: string;
  customerId: string;
  customerName: string;
  daysToNext: number;
  priority: FollowUpPriority;
  contactStatus: ContactStatus;
  lastFollowUpDate: string;
  nextFollowUpDate: string;
  hearingAidModel: string;
  notes: string;
}

const project = {
  "id": "hxwl-01",
  "port": 5101,
  "title": "听力验配记录",
  "subtitle": "门店听力师的验配档案与听力曲线工作台",
  "stack": "React + Vite + TypeScript + CSS",
  "theme": [
    "#155e75",
    "#22c55e",
    "#f97316"
  ],
  "domain": "听力验配",
  "users": [
    "听力师",
    "门店主管",
    "复诊助理"
  ],
  "metrics": [
    "左耳PTA",
    "右耳PTA",
    "言语识别率",
    "复诊天数"
  ],
  "filters": [
    "初配",
    "复调",
    "儿童",
    "老人"
  ],
  "fields": [
    "气导",
    "骨导",
    "言语识别率",
    "助听器型号",
    "增益调整",
    "用户反馈"
  ],
  "records": [
    {
      id: "rec-001",
      customerId: "Liu-024",
      hearingLossType: "双耳高频下降",
      fittingStage: "初配",
      hearingAidModel: "Phonak Audeo Paradise P90",
      gainAdjustment: "RIC机型，2kHz后增益提高4dB，高频压缩比调整为1.8:1",
      userFeedback: "佩戴一周后听人声更清晰，但在嘈杂环境下仍有些吃力，需要继续调试。"
    },
    {
      id: "rec-002",
      customerId: "Chen-118",
      hearingLossType: "单侧传导性损失",
      fittingStage: "复调",
      hearingAidModel: "Signia Pure Charge&Go 7X",
      gainAdjustment: "低频压缩略降5dB，反馈啸叫抑制阈值调高至65dB",
      userFeedback: "之前打电话有啸叫，现在已经完全消失，看电视也比以前清楚多了。"
    },
    {
      id: "rec-003",
      customerId: "Zhao-077",
      hearingLossType: "老人语频区下降",
      fittingStage: "复诊",
      hearingAidModel: "Oticon More 3 miniRITE R",
      gainAdjustment: "500Hz-2kHz区间整体增益+3dB，噪声管理程序强度提升一档",
      userFeedback: "和家人交流明显顺畅了，言语识别率从64%提升到76%，非常满意。"
    }
  ] as CustomerRecord[]
};

const followUpRecords: FollowUpRecord[] = [
  {
    id: "fu-001",
    customerId: "Liu-024",
    customerName: "刘先生",
    daysToNext: -5,
    priority: "high",
    contactStatus: "pending",
    lastFollowUpDate: "2026-05-20",
    nextFollowUpDate: "2026-06-12",
    hearingAidModel: "Phonak Audeo Paradise P90",
    notes: "初配后首次复诊，需确认佩戴适应情况"
  },
  {
    id: "fu-002",
    customerId: "Chen-118",
    customerName: "陈女士",
    daysToNext: -2,
    priority: "high",
    contactStatus: "unreachable",
    lastFollowUpDate: "2026-05-28",
    nextFollowUpDate: "2026-06-15",
    hearingAidModel: "Signia Pure Charge&Go 7X",
    notes: "反馈啸叫问题已解决，需确认近期使用情况"
  },
  {
    id: "fu-003",
    customerId: "Wang-056",
    customerName: "王阿姨",
    daysToNext: 0,
    priority: "high",
    contactStatus: "pending",
    lastFollowUpDate: "2026-05-17",
    nextFollowUpDate: "2026-06-17",
    hearingAidModel: "Oticon Ruby 2",
    notes: "月度常规复诊，需做言语识别率测试"
  },
  {
    id: "fu-004",
    customerId: "Zhang-091",
    customerName: "张大爷",
    daysToNext: 0,
    priority: "medium",
    contactStatus: "contacted",
    lastFollowUpDate: "2026-05-20",
    nextFollowUpDate: "2026-06-17",
    hearingAidModel: "Widex Moment 440",
    notes: "已电话确认今日下午到店"
  },
  {
    id: "fu-005",
    customerId: "Li-132",
    customerName: "李先生",
    daysToNext: 2,
    priority: "medium",
    contactStatus: "pending",
    lastFollowUpDate: "2026-06-01",
    nextFollowUpDate: "2026-06-19",
    hearingAidModel: "ReSound One 9",
    notes: "复调后两周复查"
  },
  {
    id: "fu-006",
    customerId: "Zhao-077",
    customerName: "赵奶奶",
    daysToNext: 4,
    priority: "medium",
    contactStatus: "pending",
    lastFollowUpDate: "2026-05-24",
    nextFollowUpDate: "2026-06-21",
    hearingAidModel: "Oticon More 3 miniRITE R",
    notes: "儿童患者需确认适应情况"
  },
  {
    id: "fu-007",
    customerId: "Sun-045",
    customerName: "孙先生",
    daysToNext: 5,
    priority: "low",
    contactStatus: "contacted",
    lastFollowUpDate: "2026-06-05",
    nextFollowUpDate: "2026-06-22",
    hearingAidModel: "Starkey Evolv AI 2400",
    notes: "已预约，患者表示目前使用良好"
  },
  {
    id: "fu-008",
    customerId: "Zhou-088",
    customerName: "周女士",
    daysToNext: 7,
    priority: "low",
    contactStatus: "pending",
    lastFollowUpDate: "2026-05-10",
    nextFollowUpDate: "2026-06-24",
    hearingAidModel: "Phonak Naida P90-UP",
    notes: "季度常规检查"
  },
  {
    id: "fu-009",
    customerId: "Wu-023",
    customerName: "吴先生",
    daysToNext: 15,
    priority: "low",
    contactStatus: "pending",
    lastFollowUpDate: "2026-06-02",
    nextFollowUpDate: "2026-07-02",
    hearingAidModel: "Signia Silk 7X",
    notes: "深耳道式机型适配检查"
  }
];

interface HearingAidModel {
  name: string;
  noteTemplate: string;
}

interface HearingAidType {
  code: string;
  name: string;
  description: string;
  scenarios: string[];
  models: HearingAidModel[];
  gainTemplate: string;
}

const hearingAidTypes: HearingAidType[] = [
  {
    code: "RIC",
    name: "受话器外置式",
    description: "受话器置于耳道内，机身小巧隐蔽，适合轻中度听损",
    scenarios: ["轻中度感音神经性听损", "高频下降型听损", "对美观有要求的患者"],
    models: [
      { name: "Phonak Audeo Paradise P90", noteTemplate: "RIC机型，高频通道增益可调范围大，建议2kHz后增益逐步提高，配合降噪程序使用" },
      { name: "Oticon More 3 miniRITE R", noteTemplate: "miniRITE受话器外置式，神经网络降噪，建议言语频段增益+3dB，噪声管理提升一档" },
      { name: "ReSound One 9", noteTemplate: "受话器外置式，双受话器可选，建议根据听损程度选择功率，低频保持自然" }
    ],
    gainTemplate: "RIC机型，建议高频增益根据听损曲线渐进调整，压缩比1.5:1~2.0:1"
  },
  {
    code: "BTE",
    name: "耳背式",
    description: "机身挂在耳后，功率大，适合重度及极重度听损",
    scenarios: ["重度/极重度感音神经性听损", "儿童患者", "手指灵活度较差的老年人"],
    models: [
      { name: "Phonak Naida P90-UP", noteTemplate: "大功率耳背式，适合重度听损，建议低频压缩比适当降低，高频增益最大化" },
      { name: "Starkey Evolv AI 2400", noteTemplate: "耳背式AI助听器，自动场景识别，建议启用反馈抑制和风噪管理" },
      { name: "Widex Moment 440", noteTemplate: "耳背式零延迟处理，建议言语增强程序开启，中频增益适当提高" }
    ],
    gainTemplate: "BTE大功率机型，建议整体增益根据听损程度设置，压缩比2.0:1~3.0:1，注意反馈抑制"
  },
  {
    code: "ITE",
    name: "耳内式",
    description: "定制外壳填充耳甲腔，适合轻中度听损，面板可放置程序按钮",
    scenarios: ["轻中度听损", "对手动操作有需求", "不希望可见耳挂"],
    models: [
      { name: "Signia Pure Charge&Go 7X", noteTemplate: "耳内式充电机型，建议低频压缩比1.5:1，反馈抑制阈值调高至65dB" },
      { name: "Phonak Virto Paradise P90", noteTemplate: "耳内式定制外壳，建议开启自动程序切换，高频通道增益微调+2dB" }
    ],
    gainTemplate: "ITE定制机型，建议根据耳道声学特性调整增益，注意堵耳效应管理"
  },
  {
    code: "ITC",
    name: "耳道式",
    description: "比ITE更小巧，置于耳道入口，兼顾隐蔽与操作空间",
    scenarios: ["轻度至中度听损", "对隐蔽性有要求但需手动控制", "耳道条件允许"],
    models: [
      { name: "Signia Styletto X", noteTemplate: "耳道式纤细设计，建议中频增益+2dB，开启方向性麦克风" },
      { name: "Oticon Ruby 2", noteTemplate: "耳道式经济型，建议基础增益按处方公式设定，噪声管理设为中等" }
    ],
    gainTemplate: "ITC耳道式，建议中高频增益为主，压缩比1.5:1~2.0:1，注意通风孔大小选择"
  },
  {
    code: "CIC",
    name: "深耳道式",
    description: "完全置于耳道内，几乎不可见，适合轻度至中度听损",
    scenarios: ["轻度至中度听损", "对隐蔽性要求极高", "耳道条件良好"],
    models: [
      { name: "Signia Silk 7X", noteTemplate: "深耳道式即插即用，建议高频增益渐进+3dB，反馈抑制灵敏度调高" },
      { name: "Phonak Virto Titanium", noteTemplate: "深耳道式钛合金外壳，建议开启自动降噪，低频适度衰减减少堵耳感" }
    ],
    gainTemplate: "CIC深耳道式，建议以中高频增益为主，堵耳效应需重点关注，通风孔选择很重要"
  }
];

const statusColors = ["status-ok", "status-watch", "status-danger"];

function MetricCard({ label, value, index }: { label: string; value: string; index: number }) {
  return (
    <article className="metric-card">
      <span>{label}</span>
      <strong>{value}</strong>
      <i className={statusColors[index % statusColors.length]} />
    </article>
  );
}

function CustomerDrawer({
  record,
  open,
  onClose
}: {
  record: CustomerRecord | null;
  open: boolean;
  onClose: () => void;
}) {
  return (
    <>
      <div
        className={`drawer-overlay ${open ? "drawer-overlay-visible" : ""}`}
        onClick={onClose}
      />
      <aside className={`drawer ${open ? "drawer-open" : ""}`}>
        <div className="drawer-header">
          <div>
            <p className="eyebrow">客户档案</p>
            <h2>{record ? record.customerId : "暂无记录"}</h2>
          </div>
          <button className="drawer-close" onClick={onClose} aria-label="关闭抽屉">
            ×
          </button>
        </div>

        {record ? (
          <div className="drawer-content">
            <div className="drawer-section">
              <h3>基本信息</h3>
              <div className="info-row">
                <span className="info-label">客户编号</span>
                <span className="info-value">{record.customerId}</span>
              </div>
              <div className="info-row">
                <span className="info-label">听损类型</span>
                <span className="info-value">{record.hearingLossType}</span>
              </div>
              <div className="info-row">
                <span className="info-label">验配阶段</span>
                <span className="info-tag">{record.fittingStage}</span>
              </div>
            </div>

            <div className="drawer-section">
              <h3>助听器信息</h3>
              <div className="info-row">
                <span className="info-label">助听器型号</span>
                <span className="info-value strong">{record.hearingAidModel}</span>
              </div>
            </div>

            <div className="drawer-section">
              <h3>增益调整</h3>
              <p className="block-text">{record.gainAdjustment}</p>
            </div>

            <div className="drawer-section">
              <h3>用户反馈</h3>
              <p className="block-text feedback">{record.userFeedback}</p>
            </div>
          </div>
        ) : (
          <div className="drawer-empty">
            <div className="empty-icon">📋</div>
            <h3>暂无选中记录</h3>
            <p>请从左侧近期记录列表中选择一条记录查看详情</p>
          </div>
        )}
      </aside>
    </>
  );
}

const priorityLabel: Record<FollowUpPriority, string> = {
  high: "高优先级",
  medium: "中优先级",
  low: "低优先级"
};

const contactStatusLabel: Record<ContactStatus, string> = {
  pending: "待联系",
  contacted: "已联系",
  unreachable: "无法联系"
};

const filterOptions: { key: FollowUpFilter; label: string }[] = [
  { key: "all", label: "全部" },
  { key: "today", label: "今日到期" },
  { key: "week", label: "本周到期" },
  { key: "overdue", label: "已逾期" }
];

function getDaysText(days: number): string {
  if (days < 0) return `逾期 ${Math.abs(days)} 天`;
  if (days === 0) return "今日到期";
  return `${days} 天后`;
}

function filterFollowUps(records: FollowUpRecord[], filter: FollowUpFilter): FollowUpRecord[] {
  switch (filter) {
    case "today":
      return records.filter(r => r.daysToNext === 0);
    case "week":
      return records.filter(r => r.daysToNext > 0 && r.daysToNext <= 7);
    case "overdue":
      return records.filter(r => r.daysToNext < 0);
    default:
      return records;
  }
}

function FollowUpReminder() {
  const [activeFilter, setActiveFilter] = useState<FollowUpFilter>("all");

  const filtered = filterFollowUps(followUpRecords, activeFilter);
  const sorted = [...filtered].sort((a, b) => a.daysToNext - b.daysToNext);

  const counts = {
    all: followUpRecords.length,
    today: followUpRecords.filter(r => r.daysToNext === 0).length,
    week: followUpRecords.filter(r => r.daysToNext > 0 && r.daysToNext <= 7).length,
    overdue: followUpRecords.filter(r => r.daysToNext < 0).length
  };

  return (
    <section className="followup panel">
      <div className="section-heading">
        <div>
          <p>复诊助理工作台</p>
          <h2>复诊提醒</h2>
        </div>
        <button className="primary-action">批量联系</button>
      </div>

      <div className="followup-filters">
        {filterOptions.map(opt => (
          <button
            key={opt.key}
            className={`filter-chip ${activeFilter === opt.key ? "filter-active" : ""}`}
            onClick={() => setActiveFilter(opt.key)}
          >
            {opt.label}
            <span className="filter-count">{counts[opt.key]}</span>
          </button>
        ))}
      </div>

      <div className="followup-list">
        {sorted.length === 0 ? (
          <div className="followup-empty">
            <div className="empty-icon">✅</div>
            <h3>暂无{filterOptions.find(f => f.key === activeFilter)?.label}的复诊记录</h3>
          </div>
        ) : (
          sorted.map(record => {
            const isOverdue = record.daysToNext < 0;
            return (
              <article
                key={record.id}
                className={`followup-card ${isOverdue ? "followup-overdue" : ""} priority-${record.priority}`}
              >
                <div className="followup-days">
                  <span className={`days-badge ${isOverdue ? "days-overdue" : record.daysToNext === 0 ? "days-today" : ""}`}>
                    {getDaysText(record.daysToNext)}
                  </span>
                  <span className="followup-date">下次复诊：{record.nextFollowUpDate}</span>
                </div>

                <div className="followup-main">
                  <div className="followup-header">
                    <h3>{record.customerName}</h3>
                    <span className="customer-id">{record.customerId}</span>
                  </div>
                  <p className="followup-model">{record.hearingAidModel}</p>
                  <p className="followup-notes">{record.notes}</p>
                </div>

                <div className="followup-tags">
                  <span className={`priority-tag priority-${record.priority}`}>
                    {priorityLabel[record.priority]}
                  </span>
                  <span className={`status-tag status-${record.contactStatus}`}>
                    {contactStatusLabel[record.contactStatus]}
                  </span>
                </div>

                <div className="followup-actions">
                  <button className="followup-btn">拨打电话</button>
                  <button className="followup-btn secondary">发送短信</button>
                </div>
              </article>
            );
          })
        )}
      </div>
    </section>
  );
}

function HearingAidSelector({
  onSelectModel
}: {
  onSelectModel: (model: HearingAidModel, type: HearingAidType) => void;
}) {
  const [activeType, setActiveType] = useState<HearingAidType | null>(null);
  const [selectedModel, setSelectedModel] = useState<string | null>(null);

  const handleTypeClick = (type: HearingAidType) => {
    setActiveType(prev => (prev?.code === type.code ? null : type));
    setSelectedModel(null);
  };

  const handleModelClick = (model: HearingAidModel, type: HearingAidType) => {
    setSelectedModel(model.name);
    onSelectModel(model, type);
  };

  return (
    <div className="ha-selector">
      <div className="ha-selector-heading">
        <h3>助听器型号选择器</h3>
        <span className="ha-selector-hint">选择机型后自动填入表单</span>
      </div>

      <div className="ha-type-chips">
        {hearingAidTypes.map(type => (
          <button
            key={type.code}
            className={`ha-type-chip ${activeType?.code === type.code ? "ha-type-active" : ""}`}
            onClick={() => handleTypeClick(type)}
          >
            <strong>{type.code}</strong>
            <span>{type.name}</span>
          </button>
        ))}
      </div>

      {activeType && (
        <div className="ha-detail">
          <div className="ha-detail-header">
            <div className="ha-detail-info">
              <h4>{activeType.code} · {activeType.name}</h4>
              <p>{activeType.description}</p>
            </div>
            <div className="ha-scenarios">
              <span className="ha-scenarios-label">适配场景</span>
              <div className="ha-scenarios-tags">
                {activeType.scenarios.map(s => (
                  <span key={s} className="ha-scenario-tag">{s}</span>
                ))}
              </div>
            </div>
          </div>

          <div className="ha-models">
            <span className="ha-models-label">推荐型号</span>
            <div className="ha-model-list">
              {activeType.models.map(model => (
                <button
                  key={model.name}
                  className={`ha-model-card ${selectedModel === model.name ? "ha-model-selected" : ""}`}
                  onClick={() => handleModelClick(model, activeType)}
                >
                  <div className="ha-model-name">{model.name}</div>
                  <div className="ha-model-template">{model.noteTemplate}</div>
                </button>
              ))}
            </div>
          </div>

          <div className="ha-gain-preview">
            <span className="ha-gain-label">增益调整模板</span>
            <p className="ha-gain-text">{activeType.gainTemplate}</p>
          </div>
        </div>
      )}
    </div>
  );
}

type AppView = "workbench" | "archive";

function App() {
  const [activeView, setActiveView] = useState<AppView>("workbench");
  const [selectedRecord, setSelectedRecord] = useState<CustomerRecord | null>(null);
  const [drawerOpen, setDrawerOpen] = useState(false);
  const [comparisonCustomerId, setComparisonCustomerId] = useState<string | null>(null);
  const [summaryData, setSummaryData] = useState<FittingSummaryData | null>(null);
  const [summaryOpen, setSummaryOpen] = useState(false);

  const initialFormValues = Object.fromEntries(
    project.fields.map((f: string) => [f, ""])
  );

  const {
    data: formValues,
    status: draftStatus,
    lastSavedAt,
    isSupported,
    storageType,
    hasDraft,
    saveNow,
    updateData,
    clearDraft
  } = useDraft<Record<string, string>>({
    key: "form_values",
    initialData: initialFormValues,
    debounceMs: 800
  });

  const comparisonRef = useRef<ComparisonModuleHandle>(null);
  const recordsRef = useRef<HTMLElement>(null);

  const values = project.metrics.map((metric: string, index: number) => {
    const base = [84, 12, 31, 7][index % 4];
    return String(base + index * 3);
  });

  const handleRecordClick = (record: CustomerRecord) => {
    setSelectedRecord(record);
    setDrawerOpen(true);
  };

  const handleCloseDrawer = () => {
    setDrawerOpen(false);
  };

  const handleModelSelect = (model: HearingAidModel, type: HearingAidType) => {
    updateData(prev => ({
      ...prev,
      "助听器型号": model.name,
      "增益调整": type.gainTemplate,
      "用户反馈": model.noteTemplate
    }));
  };

  const handleFieldChange = (field: string, value: string) => {
    updateData(prev => ({ ...prev, [field]: value }));
  };

  const handleCompareClick = (customerId: string, e: React.MouseEvent) => {
    e.stopPropagation();
    setComparisonCustomerId(customerId);
    setTimeout(() => {
      comparisonRef.current?.scrollIntoView();
      comparisonRef.current?.triggerHighlight();
    }, 50);
  };

  const handleBackFromComparison = () => {
    setComparisonCustomerId(null);
    setTimeout(() => {
      recordsRef.current?.scrollIntoView({ behavior: "smooth", block: "start" });
    }, 50);
  };

  const handleExportSummary = (customerId: string) => {
    const summary = getSummaryByCustomerId(customerId);
    if (summary) {
      setSummaryData(summary);
      setSummaryOpen(true);
    }
  };

  const handleCloseSummary = () => {
    setSummaryOpen(false);
  };

  const handleExportAllSummary = () => {
    const firstRecord = project.records[0];
    if (firstRecord) {
      handleExportSummary(firstRecord.customerId);
    }
  };

  const workbenchContent = (
    <>
      <section className="hero">
        <div>
          <p className="eyebrow">{project.id} · port {project.port}</p>
          <h1>{project.title}</h1>
          <p className="subtitle">{project.subtitle}</p>
        </div>
        <div className="stack-card">
          <span>技术栈</span>
          <strong>{project.stack}</strong>
        </div>
      </section>

      <section className="metrics-grid">
        {project.metrics.map((metric: string, index: number) => (
          <MetricCard key={metric} label={metric} value={values[index]} index={index} />
        ))}
      </section>

      <section className="workspace">
        <aside className="panel narrow">
          <h2>角色</h2>
          <div className="chips">
            {project.users.map((user: string) => (
              <span key={user}>{user}</span>
            ))}
          </div>
          <h2>筛选</h2>
          <div className="chips muted">
            {project.filters.map((filter: string) => (
              <button key={filter}>{filter}</button>
            ))}
          </div>
        </aside>

        <section className="panel">
          <div className="section-heading">
            <div>
              <p>{project.domain}</p>
              <h2>记录字段</h2>
            </div>
            <button className="primary-action">新增记录</button>
          </div>
          <DraftIndicator
            status={draftStatus}
            lastSavedAt={lastSavedAt}
            isSupported={isSupported}
            storageType={storageType}
            hasDraft={hasDraft}
            onClear={clearDraft}
            onSave={saveNow}
            className="form-draft-indicator"
          />
          <HearingAidSelector onSelectModel={handleModelSelect} />
          <div className="field-grid">
            {project.fields.map((field: string) => (
              <label key={field}>
                <span>{field}</span>
                <input
                  placeholder={"填写" + field}
                  value={formValues[field] || ""}
                  onChange={e => handleFieldChange(field, e.target.value)}
                />
              </label>
            ))}
          </div>
        </section>
      </section>

      <HearingModule />

      <ComparisonModule
        ref={comparisonRef}
        customerId={comparisonCustomerId || undefined}
        onBack={comparisonCustomerId ? handleBackFromComparison : undefined}
      />

      <section ref={recordsRef as React.RefObject<HTMLElement>} className="records panel">
        <div className="section-heading">
          <div>
            <p>示例数据</p>
            <h2>近期记录</h2>
          </div>
          <button className="primary-action" onClick={handleExportAllSummary}>导出摘要</button>
        </div>
        <div className="record-list">
          {project.records.map((record: CustomerRecord, index: number) => {
            const hasComparison = !!getComparisonByCustomerId(record.customerId);
            const hasSummary = !!getSummaryByCustomerId(record.customerId);
            const isActive = comparisonCustomerId === record.customerId;
            return (
              <article
                key={record.id}
                className={`record-card ${isActive ? "record-card-active" : ""}`}
                onClick={() => handleRecordClick(record)}
              >
                <div className="record-index">{String(index + 1).padStart(2, "0")}</div>
                <div>
                  <h3>{record.customerId}</h3>
                  <p>{record.hearingLossType} · {record.fittingStage} · {record.hearingAidModel}</p>
                </div>
                {(hasComparison || hasSummary) && (
                  <div className="record-card-actions">
                    {hasComparison && (
                      <button
                        className="record-card-action-btn"
                        onClick={(e) => handleCompareClick(record.customerId, e)}
                      >
                        验配对比
                      </button>
                    )}
                    {hasSummary && (
                      <button
                        className="record-card-action-btn record-card-btn-summary"
                        onClick={(e) => {
                          e.stopPropagation();
                          handleExportSummary(record.customerId);
                        }}
                      >
                        导出摘要
                      </button>
                    )}
                  </div>
                )}
                <div className="record-arrow">→</div>
              </article>
            );
          })}
        </div>
      </section>

      <QcModule />

      <FollowUpReminder />

      <CustomerDrawer
        record={selectedRecord}
        open={drawerOpen}
        onClose={handleCloseDrawer}
      />

      <FittingSummary
        data={summaryData}
        open={summaryOpen}
        onClose={handleCloseSummary}
      />
    </>
  );

  return (
    <ArchiveProvider>
      <main className="app-shell">
        <nav className="app-nav">
          <div className="app-nav-brand">
            <span className="brand-mark">🦻</span>
            <div>
              <h1>{project.title}</h1>
              <p className="brand-sub">{project.subtitle}</p>
            </div>
          </div>
          <div className="app-nav-tabs">
            <button
              className={`nav-tab ${activeView === "workbench" ? "nav-tab-active" : ""}`}
              onClick={() => setActiveView("workbench")}
            >
              <span className="nav-tab-icon">🎯</span>
              <span>验配工作台</span>
            </button>
            <button
              className={`nav-tab ${activeView === "archive" ? "nav-tab-active" : ""}`}
              onClick={() => setActiveView("archive")}
            >
              <span className="nav-tab-icon">📚</span>
              <span>档案库</span>
            </button>
          </div>
          <div className="app-nav-actions">
            <span className="nav-project-tag">{project.id}</span>
          </div>
        </nav>

        {activeView === "workbench" ? workbenchContent : <ArchiveModule />}
      </main>
    </ArchiveProvider>
  );
}

export default App;
