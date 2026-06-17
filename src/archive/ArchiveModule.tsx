import { useState, useMemo, useEffect, useCallback } from "react";
import { useArchive } from "./ArchiveContext";
import type { CustomerProfile, HearingLossType, Gender } from "./archive.types";
import { createEmptyCustomer } from "./archive.types";
import CustomerDetail from "./CustomerDetail";
import VersionHistoryModal from "./VersionHistoryModal";
import ConflictResolver from "./ConflictResolver";
import { useHearingDraft, DraftIndicator } from "../draft";
import {
  getFilterViews,
  saveFilterView,
  renameFilterView,
  deleteFilterView,
  type FilterView,
  type FilterState,
} from "./filterView.storage";

export default function ArchiveModule() {
  const {
    customers,
    stats,
    selectedCustomerId,
    aggregate,
    loading,
    createCustomer,
    updateCustomer,
    deleteCustomer,
    selectCustomer,
    simulateConflict,
    listCustomers,
    seedData,
    clearAll,
    refreshStats
  } = useArchive();

  const [formOpen, setFormOpen] = useState(false);
  const [editingCustomer, setEditingCustomer] = useState<CustomerProfile | null>(null);
  const [filter, setFilter] = useState<FilterState>({
    keyword: "",
    hearingLossType: "all",
    gender: "all",
    syncStatus: "all"
  });
  const [versionModalOpen, setVersionModalOpen] = useState(false);
  const [conflictModalOpen, setConflictModalOpen] = useState(false);
  const [changeNote, setChangeNote] = useState("");

  const [savedViews, setSavedViews] = useState<FilterView[]>([]);
  const [activeViewId, setActiveViewId] = useState<string | null>(null);
  const [savingViewName, setSavingViewName] = useState("");
  const [showSaveInput, setShowSaveInput] = useState(false);
  const [renamingViewId, setRenamingViewId] = useState<string | null>(null);
  const [renamingViewName, setRenamingViewName] = useState("");
  const [viewMenuOpenId, setViewMenuOpenId] = useState<string | null>(null);

  useEffect(() => {
    setSavedViews(getFilterViews());
  }, []);

  useEffect(() => {
    if (!viewMenuOpenId) return;
    const handleClick = () => setViewMenuOpenId(null);
    document.addEventListener("click", handleClick);
    return () => document.removeEventListener("click", handleClick);
  }, [viewMenuOpenId]);

  const refreshViews = useCallback(() => {
    setSavedViews(getFilterViews());
  }, []);

  const handleApplyView = useCallback((view: FilterView) => {
    setFilter(view.filter);
    setActiveViewId(view.id);
    setViewMenuOpenId(null);
  }, []);

  const handleClearView = useCallback(() => {
    setFilter({ keyword: "", hearingLossType: "all", gender: "all", syncStatus: "all" });
    setActiveViewId(null);
    setViewMenuOpenId(null);
  }, []);

  const handleSaveView = useCallback(() => {
    const name = savingViewName.trim();
    if (!name) return;
    const newView = saveFilterView(name, filter);
    setSavingViewName("");
    setShowSaveInput(false);
    refreshViews();
    setActiveViewId(newView.id);
  }, [savingViewName, filter, refreshViews]);

  const handleDeleteView = useCallback((id: string) => {
    deleteFilterView(id);
    if (activeViewId === id) {
      setActiveViewId(null);
      setFilter({ keyword: "", hearingLossType: "all", gender: "all", syncStatus: "all" });
    }
    setViewMenuOpenId(null);
    refreshViews();
  }, [activeViewId, refreshViews]);

  const handleStartRename = useCallback((view: FilterView) => {
    setRenamingViewId(view.id);
    setRenamingViewName(view.name);
    setViewMenuOpenId(null);
  }, []);

  const handleConfirmRename = useCallback(() => {
    if (!renamingViewId) return;
    const name = renamingViewName.trim();
    if (!name) return;
    renameFilterView(renamingViewId, name);
    setRenamingViewId(null);
    setRenamingViewName("");
    refreshViews();
  }, [renamingViewId, renamingViewName, refreshViews]);

  const filteredCustomers = useMemo(() => {
    return customers.filter((c) => {
      if (filter.keyword) {
        const kw = filter.keyword.toLowerCase();
        if (
          !c.name.toLowerCase().includes(kw) &&
          !c.customerNo.toLowerCase().includes(kw) &&
          !c.phone.includes(kw)
        ) {
          return false;
        }
      }
      if (filter.hearingLossType !== "all" && c.hearingLossType !== filter.hearingLossType) return false;
      if (filter.gender !== "all" && c.gender !== filter.gender) return false;
      if (filter.syncStatus !== "all" && c.syncStatus !== filter.syncStatus) return false;
      return true;
    });
  }, [customers, filter]);

  const handleNew = () => {
    setEditingCustomer(createEmptyCustomer());
    setFormOpen(true);
    setChangeNote("");
  };

  const handleEdit = (c: CustomerProfile) => {
    setEditingCustomer(JSON.parse(JSON.stringify(c)));
    setFormOpen(true);
    setChangeNote("");
  };

  const handleFormSubmitWithCustomer = async (finalCustomer: CustomerProfile, note: string) => {
    if (!finalCustomer.name.trim()) {
      alert("请输入客户姓名");
      return;
    }
    if (!finalCustomer.phone.trim()) {
      alert("请输入联系电话");
      return;
    }
    try {
      if (customers.find((c) => c.id === finalCustomer.id)) {
        await updateCustomer(finalCustomer, note || undefined);
      } else {
        const saved = await createCustomer(finalCustomer);
        await selectCustomer(saved.id);
      }
      setFormOpen(false);
      setEditingCustomer(null);
      setChangeNote("");
    } catch (e) {
      alert(`保存失败: ${(e as Error).message}`);
    }
  };

  const handleDelete = async (c: CustomerProfile) => {
    if (!confirm(`确定要删除客户 ${c.name} 的档案吗？此操作可通过版本历史恢复。`)) return;
    await deleteCustomer(c.id);
  };

  const syncStatusLabel: Record<string, { label: string; cls: string }> = {
    local: { label: "仅本地", cls: "ss-local" },
    synced: { label: "已同步", cls: "ss-synced" },
    conflict: { label: "冲突", cls: "ss-conflict" },
    pending: { label: "待同步", cls: "ss-pending" }
  };

  const priorityBadge = (c: CustomerProfile) => {
    const ss = syncStatusLabel[c.syncStatus] || syncStatusLabel.local;
    if (c.conflict?.hasConflict) {
      return <span className="sync-status ss-conflict">⚠ 冲突</span>;
    }
    return <span className={`sync-status ${ss.cls}`}>{ss.label}</span>;
  };

  const formatDate = (t: number) => {
    const d = new Date(t);
    return `${d.getMonth() + 1}/${d.getDate()} ${d.getHours().toString().padStart(2, "0")}:${d
      .getMinutes()
      .toString()
      .padStart(2, "0")}`;
  };

  return (
    <div className="archive-shell">
      <div className="archive-header">
        <div>
          <p className="eyebrow">本地档案库 · 离线优先</p>
          <h1>门店验配档案系统</h1>
          <p className="subtitle">
            数据保存在浏览器 IndexedDB，支持版本历史、草稿恢复与冲突检测。数据模型已按
            客户/听力曲线/验配/复诊 分表，后续可直接对接后端 API。
          </p>
        </div>
        <div className="archive-stats">
          <div className="stat-chip">
            <span>客户</span>
            <strong>{stats?.customers ?? 0}</strong>
          </div>
          <div className="stat-chip">
            <span>听力曲线</span>
            <strong>{stats?.audiograms ?? 0}</strong>
          </div>
          <div className="stat-chip">
            <span>验配记录</span>
            <strong>{stats?.fittings ?? 0}</strong>
          </div>
          <div className="stat-chip">
            <span>复诊</span>
            <strong>{stats?.followups ?? 0}</strong>
          </div>
          <div className="stat-chip">
            <span>版本数</span>
            <strong>{stats?.versions ?? 0}</strong>
          </div>
          <div className={`stat-chip ${(stats?.conflicts ?? 0) > 0 ? "stat-danger" : ""}`}>
            <span>冲突</span>
            <strong>{stats?.conflicts ?? 0}</strong>
          </div>
        </div>
      </div>

      <div className="archive-toolbar">
        <div className="toolbar-left">
          <input
            type="search"
            className="archive-search"
            placeholder="搜索客户姓名/编号/电话..."
            value={filter.keyword}
            onChange={(e) => { setFilter({ ...filter, keyword: e.target.value }); setActiveViewId(null); }}
          />
          <select
            value={filter.hearingLossType}
            onChange={(e) => { setFilter({ ...filter, hearingLossType: e.target.value }); setActiveViewId(null); }}
          >
            <option value="all">全部听损类型</option>
            <option value="感音神经性">感音神经性</option>
            <option value="传导性">传导性</option>
            <option value="混合性">混合性</option>
            <option value="中枢性">中枢性</option>
            <option value="未知">未知</option>
          </select>
          <select
            value={filter.gender}
            onChange={(e) => { setFilter({ ...filter, gender: e.target.value }); setActiveViewId(null); }}
          >
            <option value="all">全部性别</option>
            <option value="male">男</option>
            <option value="female">女</option>
            <option value="other">其他</option>
          </select>
          <select
            value={filter.syncStatus}
            onChange={(e) => { setFilter({ ...filter, syncStatus: e.target.value }); setActiveViewId(null); }}
          >
            <option value="all">全部同步状态</option>
            <option value="local">仅本地</option>
            <option value="synced">已同步</option>
            <option value="conflict">有冲突</option>
            <option value="pending">待同步</option>
          </select>
        </div>
        <div className="toolbar-right">
          <button className="ghost-btn" onClick={() => seedData().then(() => refreshStats())}>
            载入示例数据
          </button>
          <button
            className="ghost-btn danger"
            onClick={() => {
              if (confirm("确定清空全部本地档案数据吗？此操作不可恢复！")) clearAll();
            }}
          >
            清空本地
          </button>
          <button className="primary-action" onClick={handleNew}>
            + 新增客户档案
          </button>
        </div>
      </div>

      <div className="filter-view-bar">
        <div className="filter-view-left">
          <span className="filter-view-label">常用筛选</span>
          <button
            className={`filter-view-chip ${!activeViewId ? "fv-active" : ""}`}
            onClick={handleClearView}
          >
            全部
          </button>
          {savedViews.map((v) => (
            <div key={v.id} className="filter-view-chip-wrap">
              {renamingViewId === v.id ? (
                <div className="fv-rename-row">
                  <input
                    className="fv-rename-input"
                    value={renamingViewName}
                    onChange={(e) => setRenamingViewName(e.target.value)}
                    onKeyDown={(e) => {
                      if (e.key === "Enter") handleConfirmRename();
                      if (e.key === "Escape") setRenamingViewId(null);
                    }}
                    autoFocus
                  />
                  <button className="fv-rename-ok" onClick={handleConfirmRename}>✓</button>
                  <button className="fv-rename-cancel" onClick={() => setRenamingViewId(null)}>✕</button>
                </div>
              ) : (
                <>
                  <button
                    className={`filter-view-chip ${activeViewId === v.id ? "fv-active" : ""}`}
                    onClick={() => handleApplyView(v)}
                  >
                    {v.name}
                  </button>
                  <button
                    className="fv-menu-toggle"
                    onClick={(e) => {
                      e.stopPropagation();
                      setViewMenuOpenId(viewMenuOpenId === v.id ? null : v.id);
                    }}
                  >
                    ▾
                  </button>
                </>
              )}
              {viewMenuOpenId === v.id && renamingViewId !== v.id && (
                <div className="fv-menu">
                  <button
                    className="fv-menu-item"
                    onClick={() => handleStartRename(v)}
                  >
                    ✎ 重命名
                  </button>
                  <button
                    className="fv-menu-item fv-menu-danger"
                    onClick={() => handleDeleteView(v.id)}
                  >
                    🗑 删除视图
                  </button>
                </div>
              )}
            </div>
          ))}
        </div>
        <div className="filter-view-right">
          {showSaveInput ? (
            <div className="fv-save-row">
              <input
                className="fv-save-input"
                value={savingViewName}
                onChange={(e) => setSavingViewName(e.target.value)}
                placeholder="输入视图名称..."
                onKeyDown={(e) => {
                  if (e.key === "Enter") handleSaveView();
                  if (e.key === "Escape") { setShowSaveInput(false); setSavingViewName(""); }
                }}
                autoFocus
              />
              <button className="fv-save-ok" onClick={handleSaveView}>保存</button>
              <button
                className="fv-save-cancel"
                onClick={() => { setShowSaveInput(false); setSavingViewName(""); }}
              >
                取消
              </button>
            </div>
          ) : (
            <button
              className="ghost-btn"
              onClick={() => setShowSaveInput(true)}
            >
              💾 保存为视图
            </button>
          )}
        </div>
      </div>

      <div className="archive-body">
        <aside className="customer-list panel">
          <div className="panel-head">
            <h3>客户列表</h3>
            <span className="muted">{filteredCustomers.length} 条记录</span>
          </div>
          {loading === "loading" && customers.length === 0 ? (
            <div className="empty-state">加载中...</div>
          ) : filteredCustomers.length === 0 ? (
            <div className="empty-state">
              <div className="empty-icon">📂</div>
              <h4>暂无档案</h4>
              <p>点击右上角「新增客户档案」开始录入，或载入示例数据体验</p>
            </div>
          ) : (
            <div className="customer-scroll">
              {filteredCustomers.map((c) => {
                const active = c.id === selectedCustomerId;
                const hasConflict = c.conflict?.hasConflict || c.syncStatus === "conflict";
                return (
                  <article
                    key={c.id}
                    className={`customer-row ${active ? "active" : ""} ${hasConflict ? "has-conflict" : ""}`}
                    onClick={() => selectCustomer(c.id)}
                  >
                    <div className="cust-avatar" style={{ background: avatarColor(c.name) }}>
                      {c.name.slice(0, 1) || "?"}
                    </div>
                    <div className="cust-info">
                      <div className="cust-name-row">
                        <strong>{c.name || "(未命名)"}</strong>
                        <span className="cust-no">{c.customerNo}</span>
                      </div>
                      <div className="cust-sub">
                        {c.gender === "male" ? "♂" : c.gender === "female" ? "♀" : "⚧"}
                        {c.age ? ` ${c.age}岁` : ""} · {c.hearingLossType} · {c.phone}
                      </div>
                      <div className="cust-foot">
                        <span className="muted">v{c.version} · {formatDate(c.editedAt)}</span>
                        {priorityBadge(c)}
                      </div>
                    </div>
                    <div className="cust-actions" onClick={(e) => e.stopPropagation()}>
                      <button className="row-btn" title="编辑" onClick={() => handleEdit(c)}>
                        ✎
                      </button>
                      <button
                        className="row-btn"
                        title="模拟冲突"
                        onClick={() => simulateConflict(c.id)}
                      >
                        ⚡
                      </button>
                      <button className="row-btn danger" title="删除" onClick={() => handleDelete(c)}>
                        🗑
                      </button>
                    </div>
                  </article>
                );
              })}
            </div>
          )}
        </aside>

        <section className="customer-detail-wrap">
          {aggregate ? (
            <CustomerDetail
              aggregate={aggregate}
              onEdit={() => handleEdit(aggregate.profile)}
              onShowVersions={() => setVersionModalOpen(true)}
              onShowConflict={() => setConflictModalOpen(true)}
              onRefresh={() => listCustomers(filter)}
            />
          ) : (
            <div className="panel customer-empty">
              <div className="empty-icon large">👈</div>
              <h3>请选择一个客户查看详情</h3>
              <p className="muted">
                左侧列表展示客户档案，点击查看完整的 听力曲线、验配记录、复诊计划、版本历史
              </p>
              <div className="feature-cards">
                <div className="feature-card">
                  <div className="feature-ico">📋</div>
                  <h4>完整档案</h4>
                  <p>客户信息 / 病史 / 过敏史 / 标签</p>
                </div>
                <div className="feature-card">
                  <div className="feature-ico">📈</div>
                  <h4>听力曲线</h4>
                  <p>气导 / 骨导 / PTA / 言语识别率</p>
                </div>
                <div className="feature-card">
                  <div className="feature-ico">🔧</div>
                  <h4>验配记录</h4>
                  <p>助听器型号 / 增益调整 / 回访反馈</p>
                </div>
                <div className="feature-card">
                  <div className="feature-ico">⏰</div>
                  <h4>复诊管理</h4>
                  <p>优先级 / 联系状态 / 下次提醒</p>
                </div>
                <div className="feature-card">
                  <div className="feature-ico">🕘</div>
                  <h4>版本历史</h4>
                  <p>每次修改自动快照，支持回滚</p>
                </div>
                <div className="feature-card">
                  <div className="feature-ico">⚡</div>
                  <h4>冲突处理</h4>
                  <p>本地/远程版本差异可视化合并</p>
                </div>
              </div>
            </div>
          )}
        </section>
      </div>

      {formOpen && editingCustomer && (
        <CustomerFormModal
          initialCustomer={editingCustomer}
          isEdit={!!customers.find((c) => c.id === editingCustomer.id)}
          changeNote={changeNote}
          onChangeNote={setChangeNote}
          onClose={() => setFormOpen(false)}
          onSubmit={(finalCustomer, note) => {
            handleFormSubmitWithCustomer(finalCustomer, note);
          }}
        />
      )}

      {versionModalOpen && selectedCustomerId && (
        <VersionHistoryModal
          entityId={selectedCustomerId}
          entityType="customer"
          onClose={() => setVersionModalOpen(false)}
        />
      )}

      {conflictModalOpen && selectedCustomerId && (
        <ConflictResolver customerId={selectedCustomerId} onClose={() => setConflictModalOpen(false)} />
      )}
    </div>
  );
}

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

interface CustomerFormModalProps {
  initialCustomer: CustomerProfile;
  isEdit: boolean;
  changeNote: string;
  onChangeNote: (v: string) => void;
  onClose: () => void;
  onSubmit: (customer: CustomerProfile, note: string) => void;
}

function CustomerFormModal({
  initialCustomer,
  isEdit,
  changeNote,
  onChangeNote,
  onClose,
  onSubmit
}: CustomerFormModalProps) {
  const draftKey = `customer_form_${initialCustomer.id}`;

  const {
    record: editingCustomer,
    status: draftStatus,
    lastSavedAt,
    isSupported,
    storageType,
    hasDraft,
    saveNow,
    updateRecord,
    clearDraft
  } = useHearingDraft<CustomerProfile>({
    key: draftKey,
    initialRecord: initialCustomer,
    debounceMs: 800
  });

  const handleClose = () => {
    onClose();
  };

  const handleCancel = async () => {
    if (hasDraft) {
      const choice = confirm(
        "检测到未保存的草稿。\n\n点击「确定」：保留草稿，下次打开可恢复\n点击「取消」：清除草稿并关闭"
      );
      if (!choice) {
        await clearDraft();
      }
    }
    handleClose();
  };

  const handleSubmit = async () => {
    await onSubmit(editingCustomer, changeNote);
    await clearDraft();
  };

  const setField = <K extends keyof CustomerProfile>(key: K, value: CustomerProfile[K]) => {
    updateRecord((prev) => ({ ...prev, [key]: value }));
  };

  return (
    <div className="modal-overlay" onClick={handleCancel}>
      <div className="modal modal-wide" onClick={(e) => e.stopPropagation()}>
        <div className="modal-head">
          <div>
            <h2>{isEdit ? "编辑客户档案" : "新增客户档案"}</h2>
            {hasDraft && (
              <p className="modal-sub">
                💡 检测到上次未保存的草稿，已自动恢复。最后保存时间：
                {lastSavedAt ? new Date(lastSavedAt).toLocaleString("zh-CN") : "刚刚"}
              </p>
            )}
          </div>
          <button className="modal-close" onClick={handleCancel} aria-label="关闭">
            ×
          </button>
        </div>
        <div className="modal-body">
          <DraftIndicator
            status={draftStatus}
            lastSavedAt={lastSavedAt}
            isSupported={isSupported}
            storageType={storageType}
            hasDraft={hasDraft}
            onClear={() => clearDraft(initialCustomer)}
            onSave={saveNow}
            className="form-draft-indicator"
          />
          <div className="form-grid">
            <label>
              <span>客户编号 *</span>
              <input
                value={editingCustomer.customerNo}
                onChange={(e) => setField("customerNo", e.target.value)}
              />
            </label>
            <label>
              <span>姓名 *</span>
              <input
                value={editingCustomer.name}
                onChange={(e) => setField("name", e.target.value)}
                placeholder="请输入姓名"
              />
            </label>
            <label>
              <span>性别</span>
              <select
                value={editingCustomer.gender}
                onChange={(e) => setField("gender", e.target.value as Gender)}
              >
                <option value="male">男</option>
                <option value="female">女</option>
                <option value="other">其他</option>
              </select>
            </label>
            <label>
              <span>出生日期</span>
              <input
                type="date"
                value={editingCustomer.birthDate || ""}
                onChange={(e) => setField("birthDate", e.target.value)}
              />
            </label>
            <label>
              <span>年龄</span>
              <input
                type="number"
                value={editingCustomer.age ?? ""}
                onChange={(e) =>
                  setField(
                    "age",
                    e.target.value ? (Number(e.target.value) as CustomerProfile["age"]) : undefined
                  )
                }
              />
            </label>
            <label>
              <span>联系电话 *</span>
              <input
                value={editingCustomer.phone}
                onChange={(e) => setField("phone", e.target.value)}
                placeholder="手机号"
              />
            </label>
            <label>
              <span>邮箱</span>
              <input
                value={editingCustomer.email || ""}
                onChange={(e) => setField("email", e.target.value)}
              />
            </label>
            <label>
              <span>职业</span>
              <input
                value={editingCustomer.occupation || ""}
                onChange={(e) => setField("occupation", e.target.value)}
              />
            </label>
            <label className="span-2">
              <span>地址</span>
              <input
                value={editingCustomer.address || ""}
                onChange={(e) => setField("address", e.target.value)}
              />
            </label>
            <label>
              <span>听损类型</span>
              <select
                value={editingCustomer.hearingLossType}
                onChange={(e) =>
                  setField("hearingLossType", e.target.value as HearingLossType)
                }
              >
                <option value="未知">未知</option>
                <option value="感音神经性">感音神经性</option>
                <option value="传导性">传导性</option>
                <option value="混合性">混合性</option>
                <option value="中枢性">中枢性</option>
              </select>
            </label>
            <label>
              <span>发病日期</span>
              <input
                type="date"
                value={editingCustomer.hearingLossOnsetDate || ""}
                onChange={(e) => setField("hearingLossOnsetDate", e.target.value)}
              />
            </label>
            <label className="span-2">
              <span>既往病史</span>
              <textarea
                rows={2}
                value={editingCustomer.medicalHistory || ""}
                onChange={(e) => setField("medicalHistory", e.target.value)}
              />
            </label>
            <label className="span-2">
              <span>耳部手术史</span>
              <textarea
                rows={2}
                value={editingCustomer.earSurgeryHistory || ""}
                onChange={(e) => setField("earSurgeryHistory", e.target.value)}
              />
            </label>
            <label className="span-2">
              <span>过敏史</span>
              <input
                value={editingCustomer.allergies || ""}
                onChange={(e) => setField("allergies", e.target.value)}
              />
            </label>
            <div className="span-2 check-row">
              <label className="check-item">
                <input
                  type="checkbox"
                  checked={editingCustomer.tinnitus}
                  onChange={(e) => setField("tinnitus", e.target.checked)}
                />
                <span>耳鸣</span>
              </label>
              <label className="check-item">
                <input
                  type="checkbox"
                  checked={editingCustomer.vertigo}
                  onChange={(e) => setField("vertigo", e.target.checked)}
                />
                <span>眩晕</span>
              </label>
              <label className="check-item">
                <input
                  type="checkbox"
                  checked={editingCustomer.otorrhea}
                  onChange={(e) => setField("otorrhea", e.target.checked)}
                />
                <span>耳漏</span>
              </label>
            </div>
            <label className="span-2">
              <span>标签（逗号分隔）</span>
              <input
                value={(editingCustomer.tags || []).join(", ")}
                onChange={(e) =>
                  setField(
                    "tags",
                    e.target.value
                      .split(",")
                      .map((s) => s.trim())
                      .filter(Boolean)
                  )
                }
                placeholder="如：高频下降, 老人, 儿童"
              />
            </label>
            <label className="span-2">
              <span>备注</span>
              <textarea
                rows={3}
                value={editingCustomer.remark || ""}
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
          <button className="ghost-btn" onClick={handleCancel}>
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
