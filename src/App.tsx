import "./styles.css";
import { useState } from "react";

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

function App() {
  const [selectedRecord, setSelectedRecord] = useState<CustomerRecord | null>(null);
  const [drawerOpen, setDrawerOpen] = useState(false);

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

  return (
    <main className="app-shell">
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
          <div className="field-grid">
            {project.fields.map((field: string) => (
              <label key={field}>
                <span>{field}</span>
                <input placeholder={"填写" + field} />
              </label>
            ))}
          </div>
        </section>
      </section>

      <section className="records panel">
        <div className="section-heading">
          <div>
            <p>示例数据</p>
            <h2>近期记录</h2>
          </div>
          <button>导出摘要</button>
        </div>
        <div className="record-list">
          {project.records.map((record: CustomerRecord, index: number) => (
            <article
              key={record.id}
              className="record-card"
              onClick={() => handleRecordClick(record)}
            >
              <div className="record-index">{String(index + 1).padStart(2, "0")}</div>
              <div>
                <h3>{record.customerId}</h3>
                <p>{record.hearingLossType} · {record.fittingStage} · {record.hearingAidModel}</p>
              </div>
              <div className="record-arrow">→</div>
            </article>
          ))}
        </div>
      </section>

      <FollowUpReminder />

      <CustomerDrawer
        record={selectedRecord}
        open={drawerOpen}
        onClose={handleCloseDrawer}
      />
    </main>
  );
}

export default App;
