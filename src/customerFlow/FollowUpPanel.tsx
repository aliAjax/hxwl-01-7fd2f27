import { useState, useMemo } from "react";
import { useCustomerFlow } from "./CustomerFlowContext";
import { useArchive } from "../archive/ArchiveContext";
import type { FollowUpRecord } from "../archive/archive.types";

type FollowUpPriority = "high" | "medium" | "low";
type FollowUpFilter = "all" | "today" | "week" | "overdue";

const priorityLabel: Record<FollowUpPriority, string> = {
  high: "高优先级",
  medium: "中优先级",
  low: "低优先级"
};
const filterOptions: { key: FollowUpFilter; label: string }[] = [
  { key: "all", label: "全部" },
  { key: "today", label: "今日到期" },
  { key: "week", label: "本周到期" },
  { key: "overdue", label: "已逾期" }
];

export function FollowUpPanel({ customerId }: { customerId: string | null }) {
  const { aggregate } = useCustomerFlow();
  const { createFollowUp, updateFollowUp } = useArchive();

  const [filter, setFilter] = useState<FollowUpFilter>("all");
  const [showNewForm, setShowNewForm] = useState(false);
  const [newFollowUp, setNewFollowUp] = useState({
    scheduledDate: new Date().toISOString().slice(0, 10),
    priority: "medium" as FollowUpPriority,
    purpose: ""
  });

  const followUps = aggregate?.followUps || [];

  const filteredFollowUps = useMemo(() => {
    const today = new Date().toISOString().slice(0, 10);
    const weekFromNow = new Date(Date.now() + 7 * 86400000).toISOString().slice(0, 10);

    return followUps
      .filter((fu) => {
        switch (filter) {
          case "today":
            return fu.scheduledDate === today;
          case "week":
            return fu.scheduledDate >= today && fu.scheduledDate <= weekFromNow;
          case "overdue":
            return fu.scheduledDate < today && fu.status !== "completed";
          default:
            return true;
        }
      })
      .sort((a, b) => a.scheduledDate.localeCompare(b.scheduledDate));
  }, [followUps, filter]);

  const handleCreate = async () => {
    if (!customerId || !newFollowUp.purpose.trim()) return;
    try {
      await createFollowUp({
        customerId,
        scheduledDate: newFollowUp.scheduledDate,
        priority: newFollowUp.priority,
        purpose: newFollowUp.purpose,
        status: "pending"
      });
      setShowNewForm(false);
      setNewFollowUp({
        scheduledDate: new Date().toISOString().slice(0, 10),
        priority: "medium",
        purpose: ""
      });
    } catch (e) {
      alert(`创建复诊记录失败: ${(e as Error).message}`);
    }
  };

  const handleMarkContacted = async (fu: FollowUpRecord) => {
    try {
      await updateFollowUp(
        {
          ...fu,
          status: "completed"
        } as FollowUpRecord,
        "标记已联系"
      );
    } catch (e) {
      alert(`更新失败: ${(e as Error).message}`);
    }
  };

  return (
    <div className="followup-panel">
      <div className="followup-panel-header">
        <div className="followup-filters">
          {filterOptions.map((opt) => (
            <button
              key={opt.key}
              className={`filter-chip ${filter === opt.key ? "filter-active" : ""}`}
              onClick={() => setFilter(opt.key)}
            >
              {opt.label}
            </button>
          ))}
        </div>
        <button className="primary-action" onClick={() => setShowNewForm(true)}>
          + 安排复诊
        </button>
      </div>

      {showNewForm && (
        <div className="followup-new-form">
          <div className="form-grid">
            <label>
              <span>复诊日期</span>
              <input
                type="date"
                value={newFollowUp.scheduledDate}
                onChange={(e) =>
                  setNewFollowUp((prev) => ({ ...prev, scheduledDate: e.target.value }))
                }
              />
            </label>
            <label>
              <span>优先级</span>
              <select
                value={newFollowUp.priority}
                onChange={(e) =>
                  setNewFollowUp((prev) => ({
                    ...prev,
                    priority: e.target.value as FollowUpPriority
                  }))
                }
              >
                <option value="high">高</option>
                <option value="medium">中</option>
                <option value="low">低</option>
              </select>
            </label>
            <label className="span-2">
              <span>复诊目的</span>
              <textarea
                rows={2}
                value={newFollowUp.purpose}
                onChange={(e) => setNewFollowUp((prev) => ({ ...prev, purpose: e.target.value }))}
                placeholder="如：首次佩戴后复查、调试增益、言语识别率复测等"
              />
            </label>
          </div>
          <div className="followup-form-actions">
            <button className="ghost-btn" onClick={() => setShowNewForm(false)}>
              取消
            </button>
            <button
              className="primary-action"
              onClick={handleCreate}
              disabled={!newFollowUp.purpose.trim()}
            >
              💾 保存
            </button>
          </div>
        </div>
      )}

      <div className="followup-list">
        {filteredFollowUps.length === 0 ? (
          <div className="followup-empty">
            <div className="empty-icon">✅</div>
            <h3>暂无复诊记录</h3>
            <p>点击「安排复诊」为该客户创建复诊计划</p>
          </div>
        ) : (
          filteredFollowUps.map((fu) => {
            const today = new Date().toISOString().slice(0, 10);
            const isOverdue = fu.scheduledDate < today && fu.status !== "completed";
            const isToday = fu.scheduledDate === today;
            return (
              <article
                key={fu.id}
                className={`followup-card ${isOverdue ? "followup-overdue" : ""} priority-${fu.priority}`}
              >
                <div className="followup-card-header">
                  <span
                    className={`followup-date-badge ${isOverdue ? "overdue" : isToday ? "today" : ""}`}
                  >
                    {isOverdue ? `逾期` : isToday ? "今日" : fu.scheduledDate}
                  </span>
                  <span className={`priority-tag priority-${fu.priority}`}>
                    {priorityLabel[fu.priority]}
                  </span>
                  <span className={`followup-status status-${fu.status}`}>
                    {fu.status === "pending"
                      ? "待联系"
                      : fu.status === "completed"
                        ? "已完成"
                        : fu.status}
                  </span>
                </div>
                <div className="followup-card-body">
                  {fu.purpose && <p>{fu.purpose}</p>}
                  {fu.remark && <p className="muted">{fu.remark}</p>}
                </div>
                {fu.status === "pending" && (
                  <div className="followup-card-actions">
                    <button className="primary-action" onClick={() => handleMarkContacted(fu)}>
                      ✅ 标记已联系
                    </button>
                  </div>
                )}
              </article>
            );
          })
        )}
      </div>
    </div>
  );
}
