import { useState } from "react";
import { useArchive } from "./ArchiveContext";
import type { CustomerAggregate, FittingStage } from "./archive.types";
import {
  createEmptyAudiogram,
  createEmptyFitting,
  createEmptyFollowUp,
  calcPta,
  FREQUENCIES
} from "./archive.types";

interface Props {
  aggregate: CustomerAggregate;
  onEdit: () => void;
  onShowVersions: () => void;
  onShowConflict: () => void;
  onRefresh: () => void;
}

export default function CustomerDetail({
  aggregate,
  onEdit,
  onShowVersions,
  onShowConflict,
  onRefresh
}: Props) {
  const { profile, audiograms, fittings, followUps, versionCount } = aggregate;
  const { createAudiogram, createFitting, createFollowUp, simulateConflict } = useArchive();
  const [tab, setTab] = useState<"overview" | "audiogram" | "fitting" | "followup">("overview");

  const hasConflict = profile.conflict?.hasConflict || profile.syncStatus === "conflict";

  const addAudiogram = async () => {
    const a = createEmptyAudiogram(profile.id);
    await createAudiogram(a);
  };

  const addFitting = async () => {
    const f = createEmptyFitting(profile.id);
    await createFitting(f);
  };

  const addFollowUp = async () => {
    const f = createEmptyFollowUp(profile.id);
    await createFollowUp(f);
  };

  const fmt = (t: number) => {
    const d = new Date(t);
    return `${d.getFullYear()}-${(d.getMonth() + 1).toString().padStart(2, "0")}-${d
      .getDate()
      .toString()
      .padStart(2, "0")} ${d.getHours().toString().padStart(2, "0")}:${d
      .getMinutes()
      .toString()
      .padStart(2, "0")}`;
  };

  const stageColor: Record<FittingStage, string> = {
    初配: "stage-new",
    复调: "stage-retune",
    复诊: "stage-review",
    随访: "stage-follow"
  };

  return (
    <div className="customer-detail panel">
      <div className="detail-head">
        <div className="detail-head-left">
          <div
            className="cust-avatar large"
            style={{
              background:
                profile.gender === "female"
                  ? "#be123c"
                  : profile.gender === "male"
                  ? "#155e75"
                  : "#7c3aed"
            }}
          >
            {profile.name.slice(0, 1) || "?"}
          </div>
          <div>
            <div className="detail-name-row">
              <h2>{profile.name}</h2>
              <span className="cust-no big">{profile.customerNo}</span>
              {hasConflict && (
                <button className="conflict-btn" onClick={onShowConflict}>
                  ⚠ 存在编辑冲突 · 点击处理
                </button>
              )}
            </div>
            <div className="detail-sub">
              <span>
                {profile.gender === "male" ? "男" : profile.gender === "female" ? "女" : "其他"}
              </span>
              {profile.age ? <span>· {profile.age}岁</span> : null}
              {profile.birthDate ? <span>· 生于 {profile.birthDate}</span> : null}
              <span>· {profile.phone}</span>
              {profile.email ? <span>· {profile.email}</span> : null}
            </div>
            <div className="detail-meta">
              <span className="meta-pill">{profile.hearingLossType}</span>
              {profile.tags?.map((t) => (
                <span key={t} className="meta-pill muted">
                  #{t}
                </span>
              ))}
              <span className="meta-pill version">v{profile.version}</span>
              <span className="meta-pill">编辑 {fmt(profile.editedAt)}</span>
              <span className="meta-pill">历史 {versionCount} 个版本</span>
            </div>
          </div>
        </div>
        <div className="detail-head-right">
          <button className="ghost-btn" onClick={onShowVersions}>
            🕘 版本历史
          </button>
          <button className="ghost-btn" onClick={() => simulateConflict(profile.id)}>
            ⚡ 模拟冲突
          </button>
          <button className="primary-action" onClick={onEdit}>
            ✎ 编辑档案
          </button>
        </div>
      </div>

      <div className="tabs">
        {(["overview", "audiogram", "fitting", "followup"] as const).map((k) => {
          const countMap: Record<string, number> = {
            overview: 1,
            audiogram: audiograms.length,
            fitting: fittings.length,
            followup: followUps.length
          };
          const labelMap: Record<string, string> = {
            overview: "📋 总览",
            audiogram: `📈 听力曲线 (${countMap.audiogram})`,
            fitting: `🔧 验配记录 (${countMap.fitting})`,
            followup: `⏰ 复诊提醒 (${countMap.followup})`
          };
          return (
            <button key={k} className={`tab ${tab === k ? "tab-active" : ""}`} onClick={() => setTab(k)}>
              {labelMap[k]}
            </button>
          );
        })}
      </div>

      <div className="tab-body">
        {tab === "overview" && (
          <div className="overview-grid">
            <section className="info-card">
              <h4>基本信息</h4>
              <div className="info-list">
                <InfoRow label="职业" value={profile.occupation} />
                <InfoRow label="地址" value={profile.address} />
                <InfoRow label="发病日期" value={profile.hearingLossOnsetDate} />
                <InfoRow label="创建时间" value={fmt(profile.createdAt)} />
              </div>
            </section>

            <section className="info-card">
              <h4>健康情况</h4>
              <div className="info-list">
                <InfoRow label="既往病史" value={profile.medicalHistory} />
                <InfoRow label="耳部手术史" value={profile.earSurgeryHistory} />
                <InfoRow label="过敏史" value={profile.allergies} />
                <div className="checks-row">
                  <Check ok={profile.tinnitus} label="耳鸣" />
                  <Check ok={profile.vertigo} label="眩晕" />
                  <Check ok={profile.otorrhea} label="耳漏" />
                </div>
              </div>
            </section>

            <section className="info-card wide">
              <h4>最近的听力</h4>
              {audiograms.length === 0 ? (
                <EmptyHint text="暂无听力曲线" action="切换到听力曲线标签添加" />
              ) : (
                <div className="mini-audiogram">
                  {audiograms.slice(0, 3).map((a) => {
                    const lp = calcPta(a.left.air);
                    const rp = calcPta(a.right.air);
                    return (
                      <article key={a.id} className="mini-aud-row">
                        <div>
                          <strong>{a.testDate}</strong>
                          <span className="muted">{a.tester || "未指定测试者"}</span>
                        </div>
                        <div className="pta-group">
                          <PtaBadge side="左耳" value={lp} />
                          <PtaBadge side="右耳" value={rp} />
                        </div>
                      </article>
                    );
                  })}
                </div>
              )}
            </section>

            <section className="info-card wide">
              <h4>最近的验配</h4>
              {fittings.length === 0 ? (
                <EmptyHint text="暂无验配记录" action="切换到验配记录标签添加" />
              ) : (
                <div className="mini-fitting">
                  {fittings.slice(0, 3).map((f) => (
                    <article key={f.id} className="mini-fit-row">
                      <div>
                        <div className={`stage-pill ${stageColor[f.stage]}`}>{f.stage}</div>
                        <strong>{f.fittingDate}</strong>
                        {f.fitter && <span className="muted"> · {f.fitter}</span>}
                      </div>
                      <div className="ha-row">
                        {f.hearingAid.left?.model && (
                          <span className="ha-tag">左耳: {f.hearingAid.left.model}</span>
                        )}
                        {f.hearingAid.right?.model && (
                          <span className="ha-tag">右耳: {f.hearingAid.right.model}</span>
                        )}
                      </div>
                      {f.userFeedback && <p className="muted small">{f.userFeedback}</p>}
                    </article>
                  ))}
                </div>
              )}
            </section>

            <section className="info-card wide">
              <h4>备注</h4>
              {profile.remark ? (
                <p className="remark-text">{profile.remark}</p>
              ) : (
                <span className="muted">暂无备注</span>
              )}
            </section>
          </div>
        )}

        {tab === "audiogram" && (
          <div className="tab-section">
            <div className="tab-section-head">
              <h3>听力曲线记录</h3>
              <button className="primary-action" onClick={addAudiogram}>
                + 新增听力记录
              </button>
            </div>
            {audiograms.length === 0 ? (
              <EmptyHint text="暂无听力曲线" action="点击右上角按钮新增第一条" />
            ) : (
              <div className="entity-list">
                {audiograms.map((a) => {
                  const lp = calcPta(a.left.air);
                  const rp = calcPta(a.right.air);
                  return (
                    <article key={a.id} className="entity-card">
                      <div className="entity-head">
                        <strong>{a.testDate}</strong>
                        <span className="meta-pill muted">v{a.version}</span>
                      </div>
                      <div className="entity-sub">
                        测试者: {a.tester || "未指定"} · 环境: {a.testEnvironment || "未指定"}
                      </div>
                      <div className="pta-row">
                        <PtaBadge side="左耳 PTA" value={lp} />
                        <PtaBadge side="右耳 PTA" value={rp} />
                        {a.speechRecognitionScore?.binaural !== undefined && (
                          <span className="pta-tag">
                            言语识别率 {a.speechRecognitionScore.binaural}%
                          </span>
                        )}
                      </div>
                      <FrequencyGrid left={a.left.air} right={a.right.air} />
                      {a.remark && <p className="muted small">📝 {a.remark}</p>}
                      <div className="entity-foot">
                        <span className="muted">{fmt(a.editedAt)} 由 {a.editedBy}</span>
                      </div>
                    </article>
                  );
                })}
              </div>
            )}
          </div>
        )}

        {tab === "fitting" && (
          <div className="tab-section">
            <div className="tab-section-head">
              <h3>验配记录</h3>
              <button className="primary-action" onClick={addFitting}>
                + 新增验配记录
              </button>
            </div>
            {fittings.length === 0 ? (
              <EmptyHint text="暂无验配记录" action="点击右上角按钮新增" />
            ) : (
              <div className="entity-list">
                {fittings.map((f) => (
                  <article key={f.id} className="entity-card">
                    <div className="entity-head">
                      <div>
                        <div className={`stage-pill ${stageColor[f.stage]}`}>{f.stage}</div>
                        <strong>{f.fittingDate}</strong>
                        {f.fitter && <span className="muted"> · 验配师 {f.fitter}</span>}
                      </div>
                      <span className="meta-pill muted">v{f.version}</span>
                    </div>
                    <div className="ha-big-row">
                      {f.hearingAid.left ? (
                        <div className="ha-side">
                          <div className="ha-side-label">左耳</div>
                          <div className="ha-side-model">{f.hearingAid.left.model}</div>
                          {f.hearingAid.left.type && (
                            <div className="muted small">{f.hearingAid.left.type}</div>
                          )}
                          {f.hearingAid.left.serialNo && (
                            <div className="muted small">SN: {f.hearingAid.left.serialNo}</div>
                          )}
                        </div>
                      ) : null}
                      {f.hearingAid.right ? (
                        <div className="ha-side">
                          <div className="ha-side-label">右耳</div>
                          <div className="ha-side-model">{f.hearingAid.right.model}</div>
                          {f.hearingAid.right.type && (
                            <div className="muted small">{f.hearingAid.right.type}</div>
                          )}
                          {f.hearingAid.right.serialNo && (
                            <div className="muted small">SN: {f.hearingAid.right.serialNo}</div>
                          )}
                        </div>
                      ) : null}
                      {!f.hearingAid.left && !f.hearingAid.right && (
                        <span className="muted">未填写助听器型号</span>
                      )}
                    </div>
                    {f.gainAdjustment?.binaural && (
                      <Row label="增益调整" value={f.gainAdjustment.binaural} />
                    )}
                    {f.programSettings && <Row label="程序设置" value={f.programSettings} />}
                    {f.noiseManagement && <Row label="噪声管理" value={f.noiseManagement} />}
                    {f.feedbackSuppression && <Row label="反馈抑制" value={f.feedbackSuppression} />}
                    {f.userFeedback && (
                      <div className="feedback-box">💬 {f.userFeedback}</div>
                    )}
                    {f.nextFollowUpDate && (
                      <div className="followup-hint">📅 下次复诊: {f.nextFollowUpDate}</div>
                    )}
                    {f.remark && <p className="muted small">📝 {f.remark}</p>}
                    <div className="entity-foot">
                      <span className="muted">{fmt(f.editedAt)} 由 {f.editedBy}</span>
                    </div>
                  </article>
                ))}
              </div>
            )}
          </div>
        )}

        {tab === "followup" && (
          <div className="tab-section">
            <div className="tab-section-head">
              <h3>复诊与随访</h3>
              <button className="primary-action" onClick={addFollowUp}>
                + 新增复诊计划
              </button>
            </div>
            {followUps.length === 0 ? (
              <EmptyHint text="暂无复诊计划" action="点击右上角按钮新增" />
            ) : (
              <div className="entity-list">
                {followUps.map((f) => {
                  const today = new Date().toISOString().slice(0, 10);
                  const overdue = f.status !== "completed" && f.scheduledDate < today;
                  const todayDue = f.status !== "completed" && f.scheduledDate === today;
                  return (
                    <article
                      key={f.id}
                      className={`entity-card ${overdue ? "overdue" : todayDue ? "today" : ""}`}
                    >
                      <div className="entity-head">
                        <div>
                          <span
                            className={`fu-priority fu-${f.priority}`}
                          >
                            {f.priority === "high" ? "高" : f.priority === "medium" ? "中" : "低"}优先级
                          </span>
                          <strong>{f.scheduledDate}</strong>
                          {overdue && <span className="fu-overdue">已逾期</span>}
                          {todayDue && <span className="fu-today">今日</span>}
                          {f.actualDate && f.status === "completed" && (
                            <span className="muted">
                              {" "}· 实际 {f.actualDate}
                            </span>
                          )}
                        </div>
                        <span className={`fu-status fu-${f.status}`}>
                          {f.status === "pending"
                            ? "待联系"
                            : f.status === "contacted"
                            ? "已联系"
                            : f.status === "unreachable"
                            ? "无法联系"
                            : "已完成"}
                        </span>
                      </div>
                      {f.purpose && <Row label="目的" value={f.purpose} />}
                      {f.contactMethod && <Row label="联系方式" value={f.contactMethod} />}
                      {f.result && <Row label="结果" value={f.result} />}
                      {f.actionsTaken && <Row label="采取措施" value={f.actionsTaken} />}
                      {f.operator && <Row label="执行人" value={f.operator} />}
                      {f.nextScheduledDate && (
                        <div className="followup-hint">📅 下次计划: {f.nextScheduledDate}</div>
                      )}
                      {f.remark && <p className="muted small">📝 {f.remark}</p>}
                      <div className="entity-foot">
                        <span className="muted">
                          v{f.version} · {fmt(f.editedAt)}
                        </span>
                      </div>
                    </article>
                  );
                })}
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}

function InfoRow({ label, value }: { label: string; value?: string }) {
  return (
    <div className="info-row">
      <span className="info-label">{label}</span>
      <span className="info-value">{value || "—"}</span>
    </div>
  );
}

function Row({ label, value }: { label: string; value: string }) {
  return (
    <div className="kv-row">
      <strong>{label}: </strong>
      <span>{value}</span>
    </div>
  );
}

function Check({ ok, label }: { ok: boolean; label: string }) {
  return <span className={`check-pill ${ok ? "ok" : "no"}`}>{ok ? "✓" : "✗"} {label}</span>;
}

function PtaBadge({ side, value }: { side: string; value: number }) {
  let cls = "pta-normal";
  if (value >= 91) cls = "pta-profound";
  else if (value >= 71) cls = "pta-severe";
  else if (value >= 56) cls = "pta-moderate";
  else if (value >= 41) cls = "pta-mild";
  else if (value >= 26) cls = "pta-slight";
  return (
    <span className={`pta-badge ${cls}`}>
      {side}: <strong>{value}</strong> dB
    </span>
  );
}

function FrequencyGrid({
  left,
  right
}: {
  left: { frequency: number; value: number | null }[];
  right: { frequency: number; value: number | null }[];
}) {
  return (
    <div className="freq-grid">
      <div className="freq-label">左耳</div>
      {FREQUENCIES.map((f) => {
        const p = left.find((x) => x.frequency === f);
        return (
          <div key={`L${f}`} className="freq-cell">
            <div className="freq-hz">{f}Hz</div>
            <div className="freq-val">{p?.value ?? "—"}</div>
          </div>
        );
      })}
      <div className="freq-label">右耳</div>
      {FREQUENCIES.map((f) => {
        const p = right.find((x) => x.frequency === f);
        return (
          <div key={`R${f}`} className="freq-cell">
            <div className="freq-hz">{f}Hz</div>
            <div className="freq-val">{p?.value ?? "—"}</div>
          </div>
        );
      })}
    </div>
  );
}

function EmptyHint({ text, action }: { text: string; action?: string }) {
  return (
    <div className="empty-state inline">
      <div className="empty-icon">📭</div>
      <h4>{text}</h4>
      {action && <p className="muted">{action}</p>}
    </div>
  );
}
