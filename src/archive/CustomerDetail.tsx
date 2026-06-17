import { useState } from "react";
import { useArchive } from "./ArchiveContext";
import type {
  CustomerAggregate,
  FittingStage,
  AudiogramRecord,
  FittingRecord,
  FollowUpRecord,
  FollowUpPriority,
  FollowUpStatus,
  Frequency
} from "./archive.types";
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

type ModalState =
  | { type: "audiogram"; data: AudiogramRecord }
  | { type: "fitting"; data: FittingRecord }
  | { type: "followup"; data: FollowUpRecord }
  | null;

export default function CustomerDetail({
  aggregate,
  onEdit,
  onShowVersions,
  onShowConflict,
  onRefresh
}: Props) {
  const { profile, audiograms, fittings, followUps, versionCount } = aggregate;
  const {
    createAudiogram,
    updateAudiogram,
    deleteAudiogram,
    createFitting,
    updateFitting,
    deleteFitting,
    createFollowUp,
    updateFollowUp,
    deleteFollowUp,
    simulateConflict
  } = useArchive();
  const [tab, setTab] = useState<"overview" | "audiogram" | "fitting" | "followup">("overview");
  const [modal, setModal] = useState<ModalState>(null);
  const [changeNote, setChangeNote] = useState("");

  const hasConflict = profile.conflict?.hasConflict || profile.syncStatus === "conflict";

  const addAudiogram = () => {
    const a = createEmptyAudiogram(profile.id);
    setModal({ type: "audiogram", data: a });
    setChangeNote("新增听力记录");
  };

  const addFitting = () => {
    const f = createEmptyFitting(profile.id);
    setModal({ type: "fitting", data: f });
    setChangeNote("新增验配记录");
  };

  const addFollowUp = () => {
    const f = createEmptyFollowUp(profile.id);
    setModal({ type: "followup", data: f });
    setChangeNote("新增复诊记录");
  };

  const handleEditAudiogram = (a: AudiogramRecord) => {
    setModal({ type: "audiogram", data: JSON.parse(JSON.stringify(a)) });
    setChangeNote("");
  };

  const handleEditFitting = (f: FittingRecord) => {
    setModal({ type: "fitting", data: JSON.parse(JSON.stringify(f)) });
    setChangeNote("");
  };

  const handleEditFollowUp = (f: FollowUpRecord) => {
    setModal({ type: "followup", data: JSON.parse(JSON.stringify(f)) });
    setChangeNote("");
  };

  const handleDeleteAudiogram = async (id: string) => {
    if (!confirm("确定删除这条听力记录？此操作可通过版本历史恢复。")) return;
    await deleteAudiogram(id);
  };

  const handleDeleteFitting = async (id: string) => {
    if (!confirm("确定删除这条验配记录？此操作可通过版本历史恢复。")) return;
    await deleteFitting(id);
  };

  const handleDeleteFollowUp = async (id: string) => {
    if (!confirm("确定删除这条复诊记录？此操作可通过版本历史恢复。")) return;
    await deleteFollowUp(id);
  };

  const handleSaveAudiogram = async (a: AudiogramRecord, note: string) => {
    const isEdit = !!audiograms.find((x) => x.id === a.id);
    if (isEdit) {
      await updateAudiogram(a, note || undefined);
    } else {
      await createAudiogram(a);
    }
    setModal(null);
  };

  const handleSaveFitting = async (f: FittingRecord, note: string) => {
    const isEdit = !!fittings.find((x) => x.id === f.id);
    if (isEdit) {
      await updateFitting(f, note || undefined);
    } else {
      await createFitting(f);
    }
    setModal(null);
  };

  const handleSaveFollowUp = async (f: FollowUpRecord, note: string) => {
    const isEdit = !!followUps.find((x) => x.id === f.id);
    if (isEdit) {
      await updateFollowUp(f, note || undefined);
    } else {
      await createFollowUp(f);
    }
    setModal(null);
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
                        <div className="entity-actions" onClick={(e) => e.stopPropagation()}>
                          <button
                            className="row-btn"
                            title="编辑"
                            onClick={() => handleEditAudiogram(a)}
                          >
                            ✎
                          </button>
                          <button
                            className="row-btn danger"
                            title="删除"
                            onClick={() => handleDeleteAudiogram(a.id)}
                          >
                            🗑
                          </button>
                        </div>
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
                      <div className="entity-actions" onClick={(e) => e.stopPropagation()}>
                        <button
                          className="row-btn"
                          title="编辑"
                          onClick={() => handleEditFitting(f)}
                        >
                          ✎
                        </button>
                        <button
                          className="row-btn danger"
                          title="删除"
                          onClick={() => handleDeleteFitting(f.id)}
                        >
                          🗑
                        </button>
                      </div>
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
                        <div className="entity-actions" onClick={(e) => e.stopPropagation()}>
                          <button
                            className="row-btn"
                            title="编辑"
                            onClick={() => handleEditFollowUp(f)}
                          >
                            ✎
                          </button>
                          <button
                            className="row-btn danger"
                            title="删除"
                            onClick={() => handleDeleteFollowUp(f.id)}
                          >
                            🗑
                          </button>
                        </div>
                      </div>
                    </article>
                  );
                })}
              </div>
            )}
          </div>
        )}
      </div>

      {modal?.type === "audiogram" && (
        <AudiogramFormModal
          audiogram={modal.data}
          changeNote={changeNote}
          onChangeNote={setChangeNote}
          onClose={() => setModal(null)}
          onSave={handleSaveAudiogram}
        />
      )}
      {modal?.type === "fitting" && (
        <FittingFormModal
          fitting={modal.data}
          changeNote={changeNote}
          onChangeNote={setChangeNote}
          onClose={() => setModal(null)}
          onSave={handleSaveFitting}
        />
      )}
      {modal?.type === "followup" && (
        <FollowUpFormModal
          followup={modal.data}
          changeNote={changeNote}
          onChangeNote={setChangeNote}
          onClose={() => setModal(null)}
          onSave={handleSaveFollowUp}
        />
      )}
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

interface AudiogramFormModalProps {
  audiogram: AudiogramRecord;
  changeNote: string;
  onChangeNote: (v: string) => void;
  onClose: () => void;
  onSave: (a: AudiogramRecord, note: string) => void;
}

function AudiogramFormModal({
  audiogram,
  changeNote,
  onChangeNote,
  onClose,
  onSave
}: AudiogramFormModalProps) {
  const [form, setForm] = useState<AudiogramRecord>(audiogram);
  const isEdit = !!audiogram.createdAt && audiogram.version > 0;

  const setField = <K extends keyof AudiogramRecord>(key: K, value: AudiogramRecord[K]) => {
    setForm((prev) => ({ ...prev, [key]: value }));
  };

  const setThreshold = (
    side: "left" | "right",
    freq: Frequency,
    value: string
  ) => {
    const numVal = value === "" ? null : Number(value);
    setForm((prev) => {
      const ear = prev[side];
      const air = ear.air.map((p) =>
        p.frequency === freq ? { ...p, value: numVal } : p
      );
      return { ...prev, [side]: { ...ear, air } };
    });
  };

  const setSpeech = (side: "left" | "right" | "binaural", value: string) => {
    const numVal = value === "" ? undefined : Number(value);
    setForm((prev) => ({
      ...prev,
      speechRecognitionScore: { ...prev.speechRecognitionScore, [side]: numVal }
    }));
  };

  const handleSubmit = () => {
    if (!form.testDate) {
      alert("请选择测试日期");
      return;
    }
    onSave(form, changeNote);
  };

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal modal-wide" onClick={(e) => e.stopPropagation()}>
        <div className="modal-head">
          <h2>{isEdit ? "编辑听力记录" : "新增听力记录"}</h2>
          <button className="modal-close" onClick={onClose} aria-label="关闭">
            ×
          </button>
        </div>
        <div className="modal-body">
          <div className="form-grid">
            <label>
              <span>测试日期 *</span>
              <input
                type="date"
                value={form.testDate}
                onChange={(e) => setField("testDate", e.target.value)}
              />
            </label>
            <label>
              <span>测试者</span>
              <input
                value={form.tester || ""}
                onChange={(e) => setField("tester", e.target.value)}
                placeholder="如：李听力师"
              />
            </label>
            <label className="span-2">
              <span>测试环境</span>
              <input
                value={form.testEnvironment || ""}
                onChange={(e) => setField("testEnvironment", e.target.value)}
                placeholder="如：标准测听室 / 门店诊室"
              />
            </label>

            <div className="span-2 form-section-title">
              <h4>气导阈值 (dB HL)</h4>
            </div>

            <div className="span-2 threshold-section">
              <div className="threshold-label-row">
                <span className="threshold-side-label">左耳</span>
                {FREQUENCIES.map((f) => (
                  <div key={`lh-${f}`} className="threshold-header">
                    {f}Hz
                  </div>
                ))}
              </div>
              <div className="threshold-input-row">
                <span className="threshold-side-label"></span>
                {FREQUENCIES.map((f) => {
                  const p = form.left.air.find((x) => x.frequency === f);
                  return (
                    <input
                      key={`li-${f}`}
                      type="number"
                      min="-10"
                      max="120"
                      className="threshold-input"
                      placeholder="—"
                      value={p?.value ?? ""}
                      onChange={(e) => setThreshold("left", f, e.target.value)}
                    />
                  );
                })}
              </div>

              <div className="threshold-label-row">
                <span className="threshold-side-label">右耳</span>
                {FREQUENCIES.map((f) => (
                  <div key={`rh-${f}`} className="threshold-header">
                    {f}Hz
                  </div>
                ))}
              </div>
              <div className="threshold-input-row">
                <span className="threshold-side-label"></span>
                {FREQUENCIES.map((f) => {
                  const p = form.right.air.find((x) => x.frequency === f);
                  return (
                    <input
                      key={`ri-${f}`}
                      type="number"
                      min="-10"
                      max="120"
                      className="threshold-input"
                      placeholder="—"
                      value={p?.value ?? ""}
                      onChange={(e) => setThreshold("right", f, e.target.value)}
                    />
                  );
                })}
              </div>
            </div>

            <div className="span-2 form-section-title">
              <h4>言语识别率 (%)</h4>
            </div>
            <label>
              <span>左耳</span>
              <input
                type="number"
                min="0"
                max="100"
                value={form.speechRecognitionScore?.left ?? ""}
                onChange={(e) => setSpeech("left", e.target.value)}
                placeholder="0-100"
              />
            </label>
            <label>
              <span>右耳</span>
              <input
                type="number"
                min="0"
                max="100"
                value={form.speechRecognitionScore?.right ?? ""}
                onChange={(e) => setSpeech("right", e.target.value)}
                placeholder="0-100"
              />
            </label>
            <label className="span-2">
              <span>双耳</span>
              <input
                type="number"
                min="0"
                max="100"
                value={form.speechRecognitionScore?.binaural ?? ""}
                onChange={(e) => setSpeech("binaural", e.target.value)}
                placeholder="0-100"
              />
            </label>

            <label className="span-2">
              <span>备注</span>
              <textarea
                rows={3}
                value={form.remark || ""}
                onChange={(e) => setField("remark", e.target.value)}
                placeholder="测试中发现的特殊情况、患者主诉等"
              />
            </label>

            <label className="span-2">
              <span>修改说明（版本备注）</span>
              <input
                value={changeNote}
                onChange={(e) => onChangeNote(e.target.value)}
                placeholder="本次修改了什么，方便后续回溯..."
              />
            </label>
          </div>
        </div>
        <div className="modal-foot">
          <button className="ghost-btn" onClick={onClose}>
            取消
          </button>
          <button className="primary-action" onClick={handleSubmit}>
            💾 保存（自动生成版本快照）
          </button>
        </div>
      </div>
    </div>
  );
}

interface FittingFormModalProps {
  fitting: FittingRecord;
  changeNote: string;
  onChangeNote: (v: string) => void;
  onClose: () => void;
  onSave: (f: FittingRecord, note: string) => void;
}

function FittingFormModal({
  fitting,
  changeNote,
  onChangeNote,
  onClose,
  onSave
}: FittingFormModalProps) {
  const [form, setForm] = useState<FittingRecord>(fitting);
  const isEdit = !!fitting.createdAt && fitting.version > 0;

  const setField = <K extends keyof FittingRecord>(key: K, value: FittingRecord[K]) => {
    setForm((prev) => ({ ...prev, [key]: value }));
  };

  const setHearingAid = (
    side: "left" | "right",
    field: "brand" | "model" | "type" | "serialNo",
    value: string
  ) => {
    setForm((prev) => {
      const existing = prev.hearingAid[side] || {};
      return {
        ...prev,
        hearingAid: {
          ...prev.hearingAid,
          [side]: value ? { ...existing, [field]: value } : undefined
        }
      };
    });
  };

  const setGain = (
    side: "left" | "right" | "binaural",
    value: string
  ) => {
    setForm((prev) => ({
      ...prev,
      gainAdjustment: { ...prev.gainAdjustment, [side]: value || undefined }
    }));
  };

  const handleSubmit = () => {
    if (!form.fittingDate) {
      alert("请选择验配日期");
      return;
    }
    onSave(form, changeNote);
  };

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal modal-wide" onClick={(e) => e.stopPropagation()}>
        <div className="modal-head">
          <h2>{isEdit ? "编辑验配记录" : "新增验配记录"}</h2>
          <button className="modal-close" onClick={onClose} aria-label="关闭">
            ×
          </button>
        </div>
        <div className="modal-body">
          <div className="form-grid">
            <label>
              <span>验配日期 *</span>
              <input
                type="date"
                value={form.fittingDate}
                onChange={(e) => setField("fittingDate", e.target.value)}
              />
            </label>
            <label>
              <span>验配师</span>
              <input
                value={form.fitter || ""}
                onChange={(e) => setField("fitter", e.target.value)}
              />
            </label>
            <label>
              <span>验配阶段</span>
              <select
                value={form.stage}
                onChange={(e) =>
                  setField("stage", e.target.value as FittingStage)
                }
              >
                <option value="初配">初配</option>
                <option value="复调">复调</option>
                <option value="复诊">复诊</option>
                <option value="随访">随访</option>
              </select>
            </label>
            <label>
              <span>下次复诊日期</span>
              <input
                type="date"
                value={form.nextFollowUpDate || ""}
                onChange={(e) => setField("nextFollowUpDate", e.target.value)}
              />
            </label>

            <div className="span-2 form-section-title">
              <h4>助听器选配</h4>
            </div>

            <div className="ha-form-section">
              <h5>左耳</h5>
              <div className="ha-form-grid">
                <label>
                  <span>品牌</span>
                  <input
                    value={form.hearingAid.left?.brand || ""}
                    onChange={(e) => setHearingAid("left", "brand", e.target.value)}
                    placeholder="如：峰力 / 奥迪康"
                  />
                </label>
                <label>
                  <span>型号 *</span>
                  <input
                    value={form.hearingAid.left?.model || ""}
                    onChange={(e) => setHearingAid("left", "model", e.target.value)}
                    placeholder="如：Audeo Paradise P90"
                  />
                </label>
                <label>
                  <span>类型</span>
                  <input
                    value={form.hearingAid.left?.type || ""}
                    onChange={(e) => setHearingAid("left", "type", e.target.value)}
                    placeholder="如：RIC / BTE"
                  />
                </label>
                <label>
                  <span>序列号</span>
                  <input
                    value={form.hearingAid.left?.serialNo || ""}
                    onChange={(e) => setHearingAid("left", "serialNo", e.target.value)}
                  />
                </label>
              </div>
            </div>

            <div className="ha-form-section">
              <h5>右耳</h5>
              <div className="ha-form-grid">
                <label>
                  <span>品牌</span>
                  <input
                    value={form.hearingAid.right?.brand || ""}
                    onChange={(e) => setHearingAid("right", "brand", e.target.value)}
                    placeholder="如：峰力 / 奥迪康"
                  />
                </label>
                <label>
                  <span>型号 *</span>
                  <input
                    value={form.hearingAid.right?.model || ""}
                    onChange={(e) => setHearingAid("right", "model", e.target.value)}
                    placeholder="如：Audeo Paradise P90"
                  />
                </label>
                <label>
                  <span>类型</span>
                  <input
                    value={form.hearingAid.right?.type || ""}
                    onChange={(e) => setHearingAid("right", "type", e.target.value)}
                    placeholder="如：RIC / BTE"
                  />
                </label>
                <label>
                  <span>序列号</span>
                  <input
                    value={form.hearingAid.right?.serialNo || ""}
                    onChange={(e) => setHearingAid("right", "serialNo", e.target.value)}
                  />
                </label>
              </div>
            </div>

            <div className="span-2 form-section-title">
              <h4>调试参数</h4>
            </div>

            <label>
              <span>左耳增益</span>
              <textarea
                rows={2}
                value={form.gainAdjustment?.left || ""}
                onChange={(e) => setGain("left", e.target.value)}
                placeholder="左耳各频段增益调整"
              />
            </label>
            <label>
              <span>右耳增益</span>
              <textarea
                rows={2}
                value={form.gainAdjustment?.right || ""}
                onChange={(e) => setGain("right", e.target.value)}
                placeholder="右耳各频段增益调整"
              />
            </label>
            <label className="span-2">
              <span>双耳整体 / 额外说明</span>
              <textarea
                rows={2}
                value={form.gainAdjustment?.binaural || ""}
                onChange={(e) => setGain("binaural", e.target.value)}
                placeholder="整体增益策略、压缩比调整等"
              />
            </label>

            <label className="span-2">
              <span>程序设置</span>
              <textarea
                rows={2}
                value={form.programSettings || ""}
                onChange={(e) => setField("programSettings", e.target.value)}
                placeholder="安静/噪声/音乐等程序设置"
              />
            </label>
            <label className="span-2">
              <span>噪声管理</span>
              <textarea
                rows={2}
                value={form.noiseManagement || ""}
                onChange={(e) => setField("noiseManagement", e.target.value)}
                placeholder="风噪、环境噪声、方向性麦克风等"
              />
            </label>
            <label className="span-2">
              <span>反馈抑制</span>
              <textarea
                rows={2}
                value={form.feedbackSuppression || ""}
                onChange={(e) => setField("feedbackSuppression", e.target.value)}
                placeholder="反馈抑制阈值、防啸叫设置等"
              />
            </label>

            <label className="span-2">
              <span>用户反馈</span>
              <textarea
                rows={3}
                value={form.userFeedback || ""}
                onChange={(e) => setField("userFeedback", e.target.value)}
                placeholder="佩戴体验、音质评价、存在问题等"
              />
            </label>

            <label className="span-2">
              <span>备注</span>
              <textarea
                rows={2}
                value={form.remark || ""}
                onChange={(e) => setField("remark", e.target.value)}
              />
            </label>

            <label className="span-2">
              <span>修改说明（版本备注）</span>
              <input
                value={changeNote}
                onChange={(e) => onChangeNote(e.target.value)}
                placeholder="本次修改了什么，方便后续回溯..."
              />
            </label>
          </div>
        </div>
        <div className="modal-foot">
          <button className="ghost-btn" onClick={onClose}>
            取消
          </button>
          <button className="primary-action" onClick={handleSubmit}>
            💾 保存（自动生成版本快照）
          </button>
        </div>
      </div>
    </div>
  );
}

interface FollowUpFormModalProps {
  followup: FollowUpRecord;
  changeNote: string;
  onChangeNote: (v: string) => void;
  onClose: () => void;
  onSave: (f: FollowUpRecord, note: string) => void;
}

function FollowUpFormModal({
  followup,
  changeNote,
  onChangeNote,
  onClose,
  onSave
}: FollowUpFormModalProps) {
  const [form, setForm] = useState<FollowUpRecord>(followup);
  const isEdit = !!followup.createdAt && followup.version > 0;

  const setField = <K extends keyof FollowUpRecord>(key: K, value: FollowUpRecord[K]) => {
    setForm((prev) => ({ ...prev, [key]: value }));
  };

  const handleSubmit = () => {
    if (!form.scheduledDate) {
      alert("请选择计划日期");
      return;
    }
    onSave(form, changeNote);
  };

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal modal-wide" onClick={(e) => e.stopPropagation()}>
        <div className="modal-head">
          <h2>{isEdit ? "编辑复诊计划" : "新增复诊计划"}</h2>
          <button className="modal-close" onClick={onClose} aria-label="关闭">
            ×
          </button>
        </div>
        <div className="modal-body">
          <div className="form-grid">
            <label>
              <span>计划日期 *</span>
              <input
                type="date"
                value={form.scheduledDate}
                onChange={(e) => setField("scheduledDate", e.target.value)}
              />
            </label>
            <label>
              <span>实际日期</span>
              <input
                type="date"
                value={form.actualDate || ""}
                onChange={(e) => setField("actualDate", e.target.value)}
              />
            </label>
            <label>
              <span>优先级</span>
              <select
                value={form.priority}
                onChange={(e) =>
                  setField("priority", e.target.value as FollowUpPriority)
                }
              >
                <option value="high">高</option>
                <option value="medium">中</option>
                <option value="low">低</option>
              </select>
            </label>
            <label>
              <span>状态</span>
              <select
                value={form.status}
                onChange={(e) =>
                  setField("status", e.target.value as FollowUpStatus)
                }
              >
                <option value="pending">待联系</option>
                <option value="contacted">已联系</option>
                <option value="unreachable">无法联系</option>
                <option value="completed">已完成</option>
              </select>
            </label>

            <label className="span-2">
              <span>复诊目的</span>
              <input
                value={form.purpose || ""}
                onChange={(e) => setField("purpose", e.target.value)}
                placeholder="如：初配后首次适应复查、言语识别率测试、增益微调"
              />
            </label>

            <label>
              <span>联系方式</span>
              <input
                value={form.contactMethod || ""}
                onChange={(e) => setField("contactMethod", e.target.value)}
                placeholder="如：电话 / 微信 / 到店"
              />
            </label>
            <label>
              <span>执行人</span>
              <input
                value={form.operator || ""}
                onChange={(e) => setField("operator", e.target.value)}
              />
            </label>

            <label className="span-2">
              <span>联系结果</span>
              <textarea
                rows={2}
                value={form.result || ""}
                onChange={(e) => setField("result", e.target.value)}
                placeholder="患者反馈、是否预约到店等"
              />
            </label>

            <label className="span-2">
              <span>采取措施</span>
              <textarea
                rows={2}
                value={form.actionsTaken || ""}
                onChange={(e) => setField("actionsTaken", e.target.value)}
                placeholder="本次联系后采取的处理措施"
              />
            </label>

            <label className="span-2">
              <span>下次计划日期</span>
              <input
                type="date"
                value={form.nextScheduledDate || ""}
                onChange={(e) => setField("nextScheduledDate", e.target.value)}
              />
            </label>

            <label className="span-2">
              <span>备注</span>
              <textarea
                rows={2}
                value={form.remark || ""}
                onChange={(e) => setField("remark", e.target.value)}
              />
            </label>

            <label className="span-2">
              <span>修改说明（版本备注）</span>
              <input
                value={changeNote}
                onChange={(e) => onChangeNote(e.target.value)}
                placeholder="本次修改了什么，方便后续回溯..."
              />
            </label>
          </div>
        </div>
        <div className="modal-foot">
          <button className="ghost-btn" onClick={onClose}>
            取消
          </button>
          <button className="primary-action" onClick={handleSubmit}>
            💾 保存（自动生成版本快照）
          </button>
        </div>
      </div>
    </div>
  );
}
