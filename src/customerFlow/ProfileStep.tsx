import { useState } from "react";
import { useCustomerFlow } from "./CustomerFlowContext";
import { useArchive } from "../archive/ArchiveContext";
import type { CustomerAggregate, CustomerProfile } from "../archive/archive.types";

export function ProfileStep({
  profile,
  aggregate
}: {
  profile: CustomerProfile;
  aggregate: CustomerAggregate | null;
}) {
  const { refreshFlow } = useCustomerFlow();
  const { updateCustomer } = useArchive();
  const [editing, setEditing] = useState(false);
  const [editData, setEditData] = useState(profile);

  const handleSave = async () => {
    await updateCustomer(editData, "在流程中更新客户档案");
    setEditing(false);
    await refreshFlow();
  };

  const setField = <K extends keyof CustomerProfile>(key: K, value: CustomerProfile[K]) => {
    setEditData((prev) => ({ ...prev, [key]: value }));
  };

  const formatDate = (ts: number) => {
    const d = new Date(ts);
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
  };

  const audiograms = aggregate?.audiograms || [];
  const fittings = aggregate?.fittings || [];
  const followUps = aggregate?.followUps || [];
  const comparisons = aggregate?.comparisons || [];

  return (
    <div className="profile-step">
      {!editing ? (
        <div className="profile-display">
          <div className="profile-header-row">
            <div className="profile-avatar-lg" style={{ background: avatarColor(profile.name) }}>
              {profile.name.slice(0, 1) || "?"}
            </div>
            <div className="profile-identity">
              <h3>{profile.name}</h3>
              <span className="profile-no">{profile.customerNo}</span>
            </div>
            <button
              className="ghost-btn"
              onClick={() => {
                setEditData(profile);
                setEditing(true);
              }}
            >
              ✎ 编辑
            </button>
          </div>

          <div className="profile-info-grid">
            <div className="profile-info-item">
              <span className="profile-info-label">性别</span>
              <span className="profile-info-value">
                {profile.gender === "male" ? "男" : profile.gender === "female" ? "女" : "其他"}
              </span>
            </div>
            <div className="profile-info-item">
              <span className="profile-info-label">年龄</span>
              <span className="profile-info-value">{profile.age ? `${profile.age}岁` : "—"}</span>
            </div>
            <div className="profile-info-item">
              <span className="profile-info-label">电话</span>
              <span className="profile-info-value">{profile.phone}</span>
            </div>
            <div className="profile-info-item">
              <span className="profile-info-label">听损类型</span>
              <span className="profile-info-value">{profile.hearingLossType}</span>
            </div>
            {profile.occupation && (
              <div className="profile-info-item">
                <span className="profile-info-label">职业</span>
                <span className="profile-info-value">{profile.occupation}</span>
              </div>
            )}
            {(profile.tinnitus || profile.vertigo || profile.otorrhea) && (
              <div className="profile-info-item">
                <span className="profile-info-label">症状</span>
                <span className="profile-info-value">
                  {profile.tinnitus && "耳鸣 "}
                  {profile.vertigo && "眩晕 "}
                  {profile.otorrhea && "耳漏"}
                </span>
              </div>
            )}
          </div>

          {profile.medicalHistory && (
            <div className="profile-section">
              <h4>既往病史</h4>
              <p>{profile.medicalHistory}</p>
            </div>
          )}
          {profile.allergies && (
            <div className="profile-section">
              <h4>过敏史</h4>
              <p>{profile.allergies}</p>
            </div>
          )}
          {profile.remark && (
            <div className="profile-section">
              <h4>备注</h4>
              <p>{profile.remark}</p>
            </div>
          )}

          <div className="profile-data-summary">
            <h4>数据概览</h4>
            <div className="profile-data-grid">
              <div className="profile-data-chip">
                <span className="data-count">{audiograms.length}</span>
                <span className="data-label">听力曲线</span>
              </div>
              <div className="profile-data-chip">
                <span className="data-count">{fittings.length}</span>
                <span className="data-label">验配记录</span>
              </div>
              <div className="profile-data-chip">
                <span className="data-count">{followUps.length}</span>
                <span className="data-label">复诊记录</span>
              </div>
              <div className="profile-data-chip">
                <span className="data-count">{comparisons.length}</span>
                <span className="data-label">对比记录</span>
              </div>
            </div>
          </div>
        </div>
      ) : (
        <div className="profile-edit-form">
          <div className="form-grid">
            <label>
              <span>姓名 *</span>
              <input value={editData.name} onChange={(e) => setField("name", e.target.value)} />
            </label>
            <label>
              <span>性别</span>
              <select
                value={editData.gender}
                onChange={(e) => setField("gender", e.target.value as CustomerProfile["gender"])}
              >
                <option value="male">男</option>
                <option value="female">女</option>
                <option value="other">其他</option>
              </select>
            </label>
            <label>
              <span>年龄</span>
              <input
                type="number"
                value={editData.age ?? ""}
                onChange={(e) =>
                  setField(
                    "age",
                    e.target.value ? (Number(e.target.value) as CustomerProfile["age"]) : undefined
                  )
                }
              />
            </label>
            <label>
              <span>电话 *</span>
              <input value={editData.phone} onChange={(e) => setField("phone", e.target.value)} />
            </label>
            <label>
              <span>听损类型</span>
              <select
                value={editData.hearingLossType}
                onChange={(e) =>
                  setField("hearingLossType", e.target.value as CustomerProfile["hearingLossType"])
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
              <span>职业</span>
              <input
                value={editData.occupation || ""}
                onChange={(e) => setField("occupation", e.target.value)}
              />
            </label>
            <label className="span-2">
              <span>备注</span>
              <textarea
                rows={3}
                value={editData.remark || ""}
                onChange={(e) => setField("remark", e.target.value)}
              />
            </label>
          </div>
          <div className="profile-edit-actions">
            <button className="ghost-btn" onClick={() => setEditing(false)}>
              取消
            </button>
            <button className="primary-action" onClick={handleSave}>
              💾 保存
            </button>
          </div>
        </div>
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
