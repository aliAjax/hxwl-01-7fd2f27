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

      <CustomerDrawer
        record={selectedRecord}
        open={drawerOpen}
        onClose={handleCloseDrawer}
      />
    </main>
  );
}

export default App;
