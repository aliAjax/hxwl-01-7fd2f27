import { useEffect, useState } from "react";
import { useArchive } from "./ArchiveContext";
import type { ConflictDiff, CustomerProfile } from "./archive.types";

interface Props {
  customerId: string;
  onClose: () => void;
}

export default function ConflictResolver({ customerId, onClose }: Props) {
  const { aggregate, computeConflictDiff, resolveConflict, selectCustomer } = useArchive();
  const [diffs, setDiffs] = useState<ConflictDiff[]>([]);
  const [selections, setSelections] = useState<Record<string, "local" | "remote">>({});
  const [resolving, setResolving] = useState(false);
  const [resolutionStrategy, setResolutionStrategy] = useState<"local" | "remote" | "merge">(
    "merge"
  );

  useEffect(() => {
    computeConflictDiff(customerId).then(setDiffs);
  }, [customerId, computeConflictDiff]);

  const profile = aggregate?.profile || null;

  useEffect(() => {
    const init: Record<string, "local" | "remote"> = {};
    diffs.forEach((d) => {
      init[d.field] = "remote";
    });
    setSelections(init);
  }, [diffs]);

  const allLocal = () => {
    const s: Record<string, "local" | "remote"> = {};
    diffs.forEach((d) => (s[d.field] = "local"));
    setSelections(s);
  };
  const allRemote = () => {
    const s: Record<string, "local" | "remote"> = {};
    diffs.forEach((d) => (s[d.field] = "remote"));
    setSelections(s);
  };

  const doResolve = async () => {
    setResolving(true);
    try {
      if (resolutionStrategy === "merge" && profile) {
        const merged: CustomerProfile = JSON.parse(JSON.stringify(profile));
        diffs.forEach((d) => {
          const choice = selections[d.field] || "local";
          const val = choice === "local" ? d.localValue : d.remoteValue;
          applyNestedValue(merged as unknown as Record<string, unknown>, d.field, val);
        });
        await resolveConflict("customer", customerId, "merge", merged);
      } else {
        await resolveConflict("customer", customerId, resolutionStrategy);
      }
      await selectCustomer(customerId);
      alert("冲突已解决！");
      onClose();
    } catch (e) {
      alert(`解决失败: ${(e as Error).message}`);
    } finally {
      setResolving(false);
    }
  };

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal modal-large" onClick={(e) => e.stopPropagation()}>
        <div className="modal-head">
          <div>
            <h2>⚡ 编辑冲突处理</h2>
            <p className="muted small">
              {profile ? `${profile.name} · ${profile.customerNo}` : customerId} ·
              本地版本与远程版本存在 {diffs.length} 处差异
            </p>
          </div>
          <button className="modal-close" onClick={onClose}>
            ×
          </button>
        </div>

        <div className="modal-body">
          {profile && (
            <div className="conflict-summary">
              <div className="conflict-version-box local">
                <div className="cv-label">📱 本地版本</div>
                <div className="cv-version">v{profile.version}</div>
                <div className="cv-meta">
                  编辑者: {profile.editedBy}
                  <br />
                  时间: {fmt(profile.editedAt)}
                </div>
              </div>
              <div className="conflict-arrow">⚡ ⚡ ⚡</div>
              <div className="conflict-version-box remote">
                <div className="cv-label">☁ 远程版本</div>
                <div className="cv-version">
                  v{profile.version}
                  {profile.conflict?.remoteVersionId ? "-远程" : ""}
                </div>
                <div className="cv-meta">
                  编辑者: {profile.conflict?.remoteEditedBy || "未知用户"}
                  <br />
                  时间:{" "}
                  {profile.conflict?.remoteEditedAt ? fmt(profile.conflict.remoteEditedAt) : "未知"}
                </div>
              </div>
            </div>
          )}

          <div className="resolution-strategy">
            <h4>选择解决策略</h4>
            <div className="strategy-row">
              <button
                className={`strategy-card ${resolutionStrategy === "local" ? "selected" : ""}`}
                onClick={() => setResolutionStrategy("local")}
              >
                <div className="strategy-icon">📱</div>
                <strong>保留本地</strong>
                <span>忽略远程修改</span>
              </button>
              <button
                className={`strategy-card ${resolutionStrategy === "remote" ? "selected" : ""}`}
                onClick={() => setResolutionStrategy("remote")}
              >
                <div className="strategy-icon">☁</div>
                <strong>采用远程</strong>
                <span>覆盖本地内容</span>
              </button>
              <button
                className={`strategy-card primary ${resolutionStrategy === "merge" ? "selected" : ""}`}
                onClick={() => setResolutionStrategy("merge")}
              >
                <div className="strategy-icon">🔀</div>
                <strong>手动合并</strong>
                <span>字段级逐处选择</span>
              </button>
            </div>
          </div>

          {diffs.length > 0 ? (
            <div className="conflict-diff-section">
              <div className="diff-section-head">
                <h4>差异对比（共 {diffs.length} 处）</h4>
                {resolutionStrategy === "merge" && (
                  <div className="diff-shortcuts">
                    <button className="ghost-btn tiny" onClick={allLocal}>
                      全部本地
                    </button>
                    <button className="ghost-btn tiny" onClick={allRemote}>
                      全部远程
                    </button>
                  </div>
                )}
              </div>
              <div className="conflict-diff-list">
                {diffs.map((d, i) => {
                  const fieldLabel = prettyFieldName(d.field);
                  const choice = selections[d.field] || "local";
                  return (
                    <div
                      key={d.field}
                      className={`diff-row ${choice === "local" ? "pick-local" : "pick-remote"}`}
                    >
                      <div className="diff-row-head">
                        <span className="diff-index">#{i + 1}</span>
                        <span className="diff-field-name">{fieldLabel}</span>
                        {resolutionStrategy === "merge" && (
                          <div className="diff-chooser">
                            <button
                              className={`pick-btn ${choice === "local" ? "on" : ""}`}
                              onClick={() => setSelections({ ...selections, [d.field]: "local" })}
                            >
                              📱 保留本地
                            </button>
                            <button
                              className={`pick-btn ${choice === "remote" ? "on" : ""}`}
                              onClick={() => setSelections({ ...selections, [d.field]: "remote" })}
                            >
                              ☁ 采用远程
                            </button>
                          </div>
                        )}
                      </div>
                      <div className="diff-compare">
                        <div
                          className={`diff-col ${resolutionStrategy === "merge" && choice === "local" ? "picked" : resolutionStrategy === "local" ? "picked" : ""}`}
                        >
                          <div className="diff-col-label">本地</div>
                          <div className="diff-col-value">{formatVal(d.localValue)}</div>
                        </div>
                        <div className="diff-col-divider">↔</div>
                        <div
                          className={`diff-col ${resolutionStrategy === "merge" && choice === "remote" ? "picked" : resolutionStrategy === "remote" ? "picked" : ""}`}
                        >
                          <div className="diff-col-label remote-label">远程</div>
                          <div className="diff-col-value">{formatVal(d.remoteValue)}</div>
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          ) : (
            <div className="empty-state inline">
              <div className="empty-icon">✅</div>
              <p>暂无可检测到的差异。这可能是模拟冲突还未同步数据。</p>
              <p className="muted small">请确认已在客户列表点击 ⚡ 模拟冲突 按钮</p>
            </div>
          )}
        </div>

        <div className="modal-foot">
          <button className="ghost-btn" onClick={onClose}>
            暂不处理
          </button>
          <button className="primary-action" disabled={resolving} onClick={doResolve}>
            {resolving ? "处理中..." : "✓ 确认解决此冲突"}
          </button>
        </div>
      </div>
    </div>
  );
}

function fmt(t: number) {
  const d = new Date(t);
  return `${d.getFullYear()}/${(d.getMonth() + 1).toString().padStart(2, "0")}/${d
    .getDate()
    .toString()
    .padStart(2, "0")} ${d.getHours().toString().padStart(2, "0")}:${d
    .getMinutes()
    .toString()
    .padStart(2, "0")}`;
}

function formatVal(v: unknown): string {
  if (v === null || v === undefined || v === "") return "（空）";
  if (Array.isArray(v)) return v.length ? "[" + v.join(", ") + "]" : "（空数组）";
  if (typeof v === "boolean") return v ? "是" : "否";
  return String(v);
}

function prettyFieldName(path: string): string {
  const map: Record<string, string> = {
    name: "姓名",
    customerNo: "客户编号",
    phone: "电话",
    email: "邮箱",
    gender: "性别",
    age: "年龄",
    birthDate: "出生日期",
    occupation: "职业",
    address: "地址",
    hearingLossType: "听损类型",
    hearingLossOnsetDate: "发病日期",
    medicalHistory: "既往病史",
    earSurgeryHistory: "耳部手术史",
    allergies: "过敏史",
    remark: "备注",
    tinnitus: "耳鸣",
    vertigo: "眩晕",
    otorrhea: "耳漏",
    tags: "标签"
  };
  const parts = path.split(".");
  return parts.map((p) => map[p] || p).join(" → ");
}

function applyNestedValue(obj: Record<string, unknown>, path: string, value: unknown) {
  const keys = path.split(".");
  let cur: Record<string, unknown> = obj;
  for (let i = 0; i < keys.length - 1; i++) {
    const k = keys[i];
    if (!cur[k] || typeof cur[k] !== "object") {
      cur[k] = {};
    }
    cur = cur[k] as Record<string, unknown>;
  }
  cur[keys[keys.length - 1]] = value;
}
