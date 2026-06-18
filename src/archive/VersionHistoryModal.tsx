import { useEffect, useState, useMemo } from "react";
import { useArchive } from "./ArchiveContext";
import type { EntityType, VersionSnapshot } from "./archive.types";
import {
  computeVersionDiff,
  formatDiffValue,
  groupByGroup,
  type DiffResult
} from "./versionDiff.utils";

interface Props {
  entityId: string;
  entityType: EntityType;
  onClose: () => void;
}

const ENTITY_TYPE_LABELS: Record<EntityType, string> = {
  customer: "客户档案",
  audiogram: "听力图",
  fitting: "验配记录",
  followup: "复诊记录",
  comparison: "对比记录"
};

export default function VersionHistoryModal({ entityId, entityType, onClose }: Props) {
  const { versions, loadVersions, revertToVersion, customers, aggregate } = useArchive();
  const [selectedVersion, setSelectedVersion] = useState<VersionSnapshot | null>(null);
  const [compareVersion, setCompareVersion] = useState<VersionSnapshot | null>(null);
  const [revertNote, setRevertNote] = useState("");
  const [reverting, setReverting] = useState(false);
  const [showRevertPreview, setShowRevertPreview] = useState(false);
  const [filterMode, setFilterMode] = useState<"all" | "changed">("changed");

  useEffect(() => {
    loadVersions(entityId);
  }, [entityId, loadVersions]);

  useEffect(() => {
    if (versions.length > 0 && !selectedVersion) {
      setSelectedVersion(versions[0]);
    }
  }, [versions, selectedVersion]);

  const currentVersion = useMemo(() => versions.find((v) => v.isCurrent), [versions]);

  const entityName = useMemo(() => {
    if (entityType === "customer") {
      const c = customers.find((c) => c.id === entityId);
      return c ? `${c.name} · ${c.customerNo}` : entityId;
    }
    if (aggregate) {
      return `${aggregate.profile.name} · ${ENTITY_TYPE_LABELS[entityType]}`;
    }
    return entityId;
  }, [entityType, entityId, customers, aggregate]);

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

  const diffResult: DiffResult | null = useMemo(() => {
    if (!selectedVersion || !compareVersion) return null;
    return computeVersionDiff(compareVersion.data, selectedVersion.data, entityType);
  }, [selectedVersion, compareVersion, entityType]);

  const revertPreviewDiff: DiffResult | null = useMemo(() => {
    if (!selectedVersion || !currentVersion || selectedVersion.isCurrent) return null;
    return computeVersionDiff(selectedVersion.data, currentVersion.data, entityType);
  }, [selectedVersion, currentVersion, entityType]);

  const doRevert = async () => {
    if (!selectedVersion) return;
    if (selectedVersion.isCurrent) {
      alert("当前就是最新版本，无需回滚");
      return;
    }
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
      setShowRevertPreview(false);
    }
  };

  const handleRevertClick = () => {
    if (selectedVersion?.isCurrent) {
      alert("当前就是最新版本，无需回滚");
      return;
    }
    setShowRevertPreview(true);
  };

  const renderSnapshotSummary = (snap: VersionSnapshot) => {
    const data = snap.data as unknown as Record<string, unknown>;
    const fieldsToShow: [string, string][] = [
      ["name", "姓名"],
      ["customerNo", "编号"],
      ["phone", "电话"],
      ["gender", "性别"],
      ["hearingLossType", "听损类型"],
      ["occupation", "职业"],
      ["fittingDate", "验配日期"],
      ["stage", "验配阶段"],
      ["testDate", "测试日期"],
      ["scheduledDate", "预约日期"],
      ["status", "状态"]
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
      </div>
    );
  };

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal modal-xlarge" onClick={(e) => e.stopPropagation()}>
        <div className="modal-head">
          <div>
            <h2>版本历史</h2>
            <p className="muted small">
              {entityName} · {ENTITY_TYPE_LABELS[entityType]} · 共{" "}
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
                  <div className="version-head-actions">
                    {compareVersion && compareVersion.versionId !== selectedVersion.versionId && (
                      <button
                        className="ghost-btn"
                        onClick={() => setCompareVersion(null)}
                      >
                        清除对比
                      </button>
                    )}
                  </div>
                </div>

                <div className="version-panels">
                  {compareVersion && compareVersion.versionId !== selectedVersion.versionId && diffResult ? (
                    <div className="version-panel version-panel-full">
                      <div className="diff-panel-head">
                        <h5>
                          版本对比
                          <span className="diff-versions">
                            v{compareVersion.version} → v{selectedVersion.version}
                          </span>
                        </h5>
                        <div className="diff-filter-tabs">
                          <button
                            className={`diff-tab ${filterMode === "all" ? "active" : ""}`}
                            onClick={() => setFilterMode("all")}
                          >
                            全部字段
                          </button>
                          <button
                            className={`diff-tab ${filterMode === "changed" ? "active" : ""}`}
                            onClick={() => setFilterMode("changed")}
                          >
                            仅显示变更 ({diffResult.addedCount + diffResult.removedCount + diffResult.modifiedCount}项)
                          </button>
                        </div>
                      </div>
                      <div className="diff-stats-bar">
                        <span className="diff-stat diff-added">
                          <span className="diff-stat-icon">+</span>
                          新增 {diffResult.addedCount}
                        </span>
                        <span className="diff-stat diff-removed">
                          <span className="diff-stat-icon">−</span>
                          删除 {diffResult.removedCount}
                        </span>
                        <span className="diff-stat diff-modified">
                          <span className="diff-stat-icon">~</span>
                          修改 {diffResult.modifiedCount}
                        </span>
                        <span className="diff-stat diff-unchanged">
                          未变 {diffResult.unchangedCount}
                        </span>
                      </div>
                      <VersionDiffTable
                        diffResult={diffResult}
                        filterMode={filterMode}
                        oldVersion={`v${compareVersion.version}`}
                        newVersion={`v${selectedVersion.version}`}
                      />
                    </div>
                  ) : (
                    <div className="version-panel">
                      <h5>此版本数据</h5>
                      {renderSnapshotSummary(selectedVersion)}
                    </div>
                  )}
                </div>

                {!selectedVersion.isCurrent && (
                  <div className="revert-box">
                    {!showRevertPreview ? (
                      <>
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
                          onClick={handleRevertClick}
                        >
                          {reverting ? "回滚中..." : `↺ 回滚到此版本（生成 v${currentVersion?.version ? currentVersion.version + 1 : "?"}）`}
                        </button>
                      </>
                    ) : (
                      <div className="revert-preview-box">
                        <div className="revert-preview-header">
                          <h5>⚠️ 回滚预览</h5>
                          <p className="muted small">
                            以下字段将被旧版本覆盖，请仔细确认
                          </p>
                        </div>
                        {revertPreviewDiff && (
                          <div className="revert-preview-content">
                            <div className="diff-stats-bar compact">
                              <span className="diff-stat diff-modified">
                                共 {revertPreviewDiff.addedCount + revertPreviewDiff.removedCount + revertPreviewDiff.modifiedCount} 个字段将被变更
                              </span>
                            </div>
                            <RevertPreviewTable diffResult={revertPreviewDiff} />
                          </div>
                        )}
                        <div className="revert-preview-actions">
                          <button
                            className="ghost-btn"
                            onClick={() => setShowRevertPreview(false)}
                          >
                            取消
                          </button>
                          <button
                            className="primary-action danger"
                            disabled={reverting}
                            onClick={doRevert}
                          >
                            {reverting ? "回滚中..." : "确认回滚"}
                          </button>
                        </div>
                      </div>
                    )}
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

function VersionDiffTable({
  diffResult,
  filterMode,
  oldVersion,
  newVersion
}: {
  diffResult: DiffResult;
  filterMode: "all" | "changed";
  oldVersion: string;
  newVersion: string;
}) {
  const filteredFields = filterMode === "changed"
    ? diffResult.fields.filter((f) => f.changeType !== "unchanged")
    : diffResult.fields;

  const filteredGroups = groupByGroup(filteredFields);
  const groupKeys = Object.keys(filteredGroups);

  if (filteredFields.length === 0) {
    return (
      <div className="empty-state inline">
        <p>✅ 所有字段均一致</p>
      </div>
    );
  }

  return (
    <div className="diff-table-container">
      {groupKeys.map((groupName) => (
        <div key={groupName} className="diff-group">
          <div className="diff-group-title">{groupName}</div>
          <table className="diff-table">
            <thead>
              <tr>
                <th className="diff-col-field">字段</th>
                <th className="diff-col-old">{oldVersion}（旧）</th>
                <th className="diff-col-new">{newVersion}（新）</th>
              </tr>
            </thead>
            <tbody>
              {filteredGroups[groupName].map((item) => (
                <tr
                  key={item.field}
                  className={`diff-row diff-${item.changeType}`}
                >
                  <td className="diff-field">
                    <span className={`diff-badge diff-badge-${item.changeType}`}>
                      {getChangeTypeLabel(item.changeType)}
                    </span>
                    {item.label}
                  </td>
                  <td className="diff-value diff-old">
                    {item.changeType === "added" ? (
                      <span className="diff-empty">—</span>
                    ) : (
                      <span className={item.changeType === "removed" || item.changeType === "modified" ? "diff-strike" : ""}>
                        {formatDiffValue(item.oldValue)}
                      </span>
                    )}
                  </td>
                  <td className="diff-value diff-new">
                    {item.changeType === "removed" ? (
                      <span className="diff-empty">—</span>
                    ) : (
                      <span className={item.changeType === "added" || item.changeType === "modified" ? "diff-highlight" : ""}>
                        {formatDiffValue(item.newValue)}
                      </span>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      ))}
    </div>
  );
}

function RevertPreviewTable({ diffResult }: { diffResult: DiffResult }) {
  const changedFields = diffResult.fields.filter((f) => f.changeType !== "unchanged");
  const groups = groupByGroup(changedFields);
  const groupKeys = Object.keys(groups);

  if (changedFields.length === 0) {
    return (
      <div className="empty-state inline small">
        <p>没有字段会被变更</p>
      </div>
    );
  }

  return (
    <div className="diff-table-container revert-preview-table">
      {groupKeys.map((groupName) => (
        <div key={groupName} className="diff-group">
          <div className="diff-group-title">{groupName}</div>
          <table className="diff-table">
            <thead>
              <tr>
                <th className="diff-col-field">字段</th>
                <th className="diff-col-old">当前值（将被覆盖）</th>
                <th className="diff-col-new">回滚后值</th>
              </tr>
            </thead>
            <tbody>
              {groups[groupName].map((item) => (
                <tr
                  key={item.field}
                  className={`diff-row diff-${item.changeType}`}
                >
                  <td className="diff-field">
                    <span className={`diff-badge diff-badge-${item.changeType}`}>
                      {getRevertChangeLabel(item.changeType)}
                    </span>
                    {item.label}
                  </td>
                  <td className="diff-value diff-old">
                    <span className="diff-warning">
                      {formatDiffValue(item.newValue)}
                    </span>
                  </td>
                  <td className="diff-value diff-new">
                    <span className="diff-highlight">
                      {formatDiffValue(item.oldValue)}
                    </span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      ))}
    </div>
  );
}

function getChangeTypeLabel(type: string): string {
  switch (type) {
    case "added": return "新增";
    case "removed": return "删除";
    case "modified": return "修改";
    default: return "未变";
  }
}

function getRevertChangeLabel(type: string): string {
  switch (type) {
    case "added": return "将被删除";
    case "removed": return "将恢复";
    case "modified": return "将变更";
    default: return "不变";
  }
}
