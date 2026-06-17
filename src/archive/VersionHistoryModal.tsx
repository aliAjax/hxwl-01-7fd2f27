import { useEffect, useState } from "react";
import { useArchive } from "./ArchiveContext";
import type { EntityType, VersionSnapshot } from "./archive.types";

interface Props {
  entityId: string;
  entityType: EntityType;
  onClose: () => void;
}

export default function VersionHistoryModal({ entityId, entityType, onClose }: Props) {
  const { versions, loadVersions, revertToVersion, customers } = useArchive();
  const [selectedVersion, setSelectedVersion] = useState<VersionSnapshot | null>(null);
  const [compareVersion, setCompareVersion] = useState<VersionSnapshot | null>(null);
  const [revertNote, setRevertNote] = useState("");
  const [reverting, setReverting] = useState(false);

  useEffect(() => {
    loadVersions(entityId);
  }, [entityId, loadVersions]);

  const entity = customers.find((c) => c.id === entityId);

  const fmt = (t: number) => {
    const d = new Date(t);
    return `${d.getFullYear()}/${(d.getMonth() + 1).toString().padStart(2, "0")}/${d
      .getDate()
      .toString()
      .padStart(2, "0")} ${d.getHours().toString().padStart(2, "0")}:${d
      .getMinutes()
      .toString()
      .padStart(2, "0")}`;
  };

  const doRevert = async () => {
    if (!selectedVersion) return;
    if (selectedVersion.isCurrent) {
      alert("当前就是最新版本，无需回滚");
      return;
    }
    if (!confirm(`确定回滚到 v${selectedVersion.version} 吗？将创建新版本作为回滚结果。`)) return;
    setReverting(true);
    try {
      await revertToVersion(
        entityType,
        entityId,
        selectedVersion.versionId,
        revertNote || `回滚到 v${selectedVersion.version} (${fmt(selectedVersion.editedAt)})`
      );
      alert("回滚成功，已生成新版本");
      onClose();
    } catch (e) {
      alert(`回滚失败: ${(e as Error).message}`);
    } finally {
      setReverting(false);
    }
  };

  const renderSnapshotFields = (snap: VersionSnapshot) => {
    const data = snap.data as Record<string, unknown>;
    const fieldsToShow: [string, string][] = [
      ["name", "姓名"],
      ["customerNo", "编号"],
      ["phone", "电话"],
      ["gender", "性别"],
      ["hearingLossType", "听损类型"],
      ["occupation", "职业"],
      ["email", "邮箱"],
      ["address", "地址"],
      ["remark", "备注"]
    ];
    return (
      <div className="snapshot-fields">
        {fieldsToShow.map(([k, label]) => {
          const v = data[k];
          if (v === undefined || v === null || v === "") return null;
          return (
            <div key={k} className="snap-field">
              <span className="snap-label">{label}</span>
              <span className="snap-value">{String(v)}</span>
            </div>
          );
        })}
        {data.tags && Array.isArray(data.tags) && data.tags.length > 0 && (
          <div className="snap-field">
            <span className="snap-label">标签</span>
            <span className="snap-value">{(data.tags as string[]).join(", ")}</span>
          </div>
        )}
      </div>
    );
  };

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal modal-large" onClick={(e) => e.stopPropagation()}>
        <div className="modal-head">
          <div>
            <h2>版本历史</h2>
            <p className="muted small">
              {entity ? `${entity.name} · ${entity.customerNo}` : entityId} · 共{" "}
              {versions.length} 个历史版本
            </p>
          </div>
          <button className="modal-close" onClick={onClose}>
            ×
          </button>
        </div>
        <div className="modal-body versions-body">
          <div className="versions-timeline">
            <div className="timeline-head">
              <h4>时间线</h4>
              <span className="muted small">点击版本查看详情</span>
            </div>
            {versions.length === 0 ? (
              <div className="empty-state inline">
                <div className="empty-icon">🕘</div>
                <p>暂无历史版本</p>
              </div>
            ) : (
              <ul className="timeline-list">
                {versions.map((v, i) => {
                  const active = selectedVersion?.versionId === v.versionId;
                  const compare = compareVersion?.versionId === v.versionId;
                  return (
                    <li
                      key={v.versionId}
                      className={`timeline-item ${active ? "active" : ""} ${compare ? "compare" : ""}`}
                      onClick={() => setSelectedVersion(v)}
                      onContextMenu={(e) => {
                        e.preventDefault();
                        setCompareVersion(v);
                      }}
                      title="左键查看，右键标记为对比版本"
                    >
                      <div className={`timeline-node ${v.isCurrent ? "current" : ""}`}>
                        {i === 0 ? "●" : "○"}
                      </div>
                      <div className="timeline-content">
                        <div className="timeline-title-row">
                          <strong>v{v.version}</strong>
                          {v.isCurrent && <span className="current-badge">当前</span>}
                          <span className="muted small">{v.editedBy}</span>
                        </div>
                        <div className="timeline-time">{fmt(v.editedAt)}</div>
                        {v.changeNote && <div className="timeline-note">📝 {v.changeNote}</div>}
                        {compare && <div className="compare-hint">对比模式</div>}
                      </div>
                    </li>
                  );
                })}
              </ul>
            )}
          </div>

          <div className="versions-detail">
            {!selectedVersion ? (
              <div className="empty-state inline">
                <div className="empty-icon large">👈</div>
                <p>请在左侧选择一个版本查看详情</p>
                <p className="muted small">提示：右键可标记对比版本</p>
              </div>
            ) : (
              <div className="version-detail-content">
                <div className="version-head">
                  <div>
                    <h3>
                      v{selectedVersion.version}
                      {selectedVersion.isCurrent && (
                        <span className="current-badge">当前版本</span>
                      )}
                    </h3>
                    <p className="muted">
                      {fmt(selectedVersion.editedAt)} · 编辑者 {selectedVersion.editedBy}
                    </p>
                    {selectedVersion.changeNote && (
                      <div className="detail-note-box">📝 {selectedVersion.changeNote}</div>
                    )}
                    {selectedVersion.parentVersionId && (
                      <div className="muted small">
                        父版本: {selectedVersion.parentVersionId.slice(0, 20)}...
                      </div>
                    )}
                  </div>
                </div>

                <div className="version-panels">
                  <div className="version-panel">
                    <h5>此版本数据</h5>
                    {renderSnapshotFields(selectedVersion)}
                  </div>
                  {compareVersion && compareVersion.versionId !== selectedVersion.versionId && (
                    <div className="version-panel">
                      <h5>
                        对比 v{compareVersion.version}
                        <button
                          className="ghost-btn tiny"
                          onClick={() => setCompareVersion(null)}
                        >
                          清除对比
                        </button>
                      </h5>
                      <VersionDiff
                        a={compareVersion.data as Record<string, unknown>}
                        b={selectedVersion.data as Record<string, unknown>}
                      />
                    </div>
                  )}
                </div>

                {!selectedVersion.isCurrent && (
                  <div className="revert-box">
                    <label>
                      <span>回滚说明（新版本备注）</span>
                      <input
                        value={revertNote}
                        onChange={(e) => setRevertNote(e.target.value)}
                        placeholder="例如：误操作回退到初始记录"
                      />
                    </label>
                    <button
                      className="primary-action danger-ghost"
                      disabled={reverting}
                      onClick={doRevert}
                    >
                      {reverting ? "回滚中..." : `↺ 回滚到此版本（生成 v${(entity?.version ?? 0) + 1}）`}
                    </button>
                  </div>
                )}
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

function VersionDiff({ a, b }: { a: Record<string, unknown>; b: Record<string, unknown> }) {
  const keys = new Set([
    "name",
    "customerNo",
    "phone",
    "gender",
    "hearingLossType",
    "occupation",
    "email",
    "address",
    "birthDate",
    "age",
    "medicalHistory",
    "earSurgeryHistory",
    "allergies",
    "remark"
  ]);
  const rows: { key: string; a: unknown; b: unknown; same: boolean }[] = [];
  keys.forEach((k) => {
    const av = JSON.stringify(a[k]);
    const bv = JSON.stringify(b[k]);
    rows.push({ key: k, a: a[k], b: b[k], same: av === bv });
  });
  const labelMap: Record<string, string> = {
    name: "姓名",
    customerNo: "编号",
    phone: "电话",
    gender: "性别",
    hearingLossType: "听损类型",
    occupation: "职业",
    email: "邮箱",
    address: "地址",
    birthDate: "出生日期",
    age: "年龄",
    medicalHistory: "既往病史",
    earSurgeryHistory: "耳部手术史",
    allergies: "过敏史",
    remark: "备注"
  };
  const changed = rows.filter((r) => !r.same);
  if (changed.length === 0) {
    return (
      <div className="empty-state inline">
        <p>✅ 对比字段均一致</p>
      </div>
    );
  }
  return (
    <table className="diff-table">
      <thead>
        <tr>
          <th>字段</th>
          <th>v{ (a as { version?: number }).version || "?" }</th>
          <th>v{ (b as { version?: number }).version || "?" }</th>
        </tr>
      </thead>
      <tbody>
        {changed.map((r) => (
          <tr key={r.key}>
            <td className="diff-field">{labelMap[r.key] || r.key}</td>
            <td className="diff-a">{formatVal(r.a)}</td>
            <td className="diff-b">{formatVal(r.b)}</td>
          </tr>
        ))}
      </tbody>
    </table>
  );
}

function formatVal(v: unknown): string {
  if (v === null || v === undefined || v === "") return "—";
  if (Array.isArray(v)) return v.length ? v.join(", ") : "—";
  if (typeof v === "boolean") return v ? "是" : "否";
  return String(v);
}
