import { useState, useEffect, useRef } from "react";
import { HearingRecord } from "./hearing.types";
import {
  createEmptyRecord,
  audiogramToHearingRecord,
  hearingRecordToAudiogram
} from "./hearing.utils";
import { SAMPLE_CASES, loadSampleCase } from "./sampleData";
import HearingForm from "./HearingForm";
import AudiogramChart from "./AudiogramChart";
import { useHearingDraft, DraftIndicator } from "../draft";
import { useArchive } from "../archive";
import type { AudiogramRecord, CustomerProfile } from "../archive/archive.types";

interface Props {
  customerId?: string | null;
  audiogramId?: string | null;
  onSaved?: (audiogram: AudiogramRecord) => void;
  onCancel?: () => void;
  showHeader?: boolean;
  showSamples?: boolean;
}

export default function HearingModule({
  customerId,
  audiogramId,
  onSaved,
  onCancel,
  showHeader = true,
  showSamples = true
}: Props) {
  const { createAudiogram, updateAudiogram, aggregate, selectedCustomerId } = useArchive();

  const effectiveCustomerId = customerId || selectedCustomerId;
  const customerProfile: CustomerProfile | null =
    aggregate?.profile || null;

  const draftKey = effectiveCustomerId
    ? `hearing_record_${effectiveCustomerId}`
    : "hearing_record";

  const effectiveCustomerIdRef = useRef(effectiveCustomerId);
  effectiveCustomerIdRef.current = effectiveCustomerId;

  const getInitialRecord = (): HearingRecord => {
    if (showSamples) {
      return loadSampleCase("high-frequency") || createEmptyRecord();
    }
    return createEmptyRecord();
  };

  const {
    record,
    status: draftStatus,
    lastSavedAt,
    isSupported,
    storageType,
    hasDraft,
    saveNow,
    updateRecord,
    clearDraft,
    loadDraft
  } = useHearingDraft<HearingRecord>({
    key: draftKey,
    initialRecord: getInitialRecord(),
    debounceMs: 800
  });

  const [activeSample, setActiveSample] = useState<string>(showSamples ? "high-frequency" : "");
  const [savingStatus, setSavingStatus] = useState<"idle" | "saving" | "saved" | "error">("idle");
  const [editingAudiogramId, setEditingAudiogramId] = useState<string | null>(null);

  useEffect(() => {
    if (effectiveCustomerId && audiogramId && aggregate) {
      const audiogram = aggregate.audiograms.find((a) => a.id === audiogramId);
      if (audiogram) {
        const converted = audiogramToHearingRecord(audiogram);
        updateRecord(converted);
        setEditingAudiogramId(audiogramId);
        setActiveSample("");
      }
    }
  }, [audiogramId, effectiveCustomerId, aggregate, updateRecord]);

  useEffect(() => {
    setEditingAudiogramId(null);
    setActiveSample("");
  }, [effectiveCustomerId]);

  const handleSample = (id: string) => {
    const data = loadSampleCase(id);
    if (data) {
      updateRecord(data);
      setActiveSample(id);
    }
  };

  const handleClear = async () => {
    await clearDraft(createEmptyRecord());
    setActiveSample("");
    setEditingAudiogramId(null);
  };

  const handleSaveToArchive = async () => {
    if (!effectiveCustomerId) {
      alert("请先在档案库中选择一个客户");
      return;
    }

    const expectedCustomerId = effectiveCustomerIdRef.current;
    if (!expectedCustomerId) {
      alert("客户上下文丢失，请重新选择客户");
      return;
    }

    setSavingStatus("saving");
    try {
      await saveNow();

      if (effectiveCustomerIdRef.current !== expectedCustomerId) {
        alert("检测到客户已切换，已取消保存。请确认客户后重试。");
        setSavingStatus("idle");
        return;
      }

      let savedAudiogram: AudiogramRecord;

      if (editingAudiogramId && aggregate) {
        const existing = aggregate.audiograms.find((a) => a.id === editingAudiogramId);
        if (existing && existing.customerId === expectedCustomerId) {
          const updated = hearingRecordToAudiogram(record, expectedCustomerId, existing);
          savedAudiogram = await updateAudiogram(updated, "更新听力记录");
        } else {
          const newAud = hearingRecordToAudiogram(record, expectedCustomerId);
          savedAudiogram = await createAudiogram(newAud);
        }
      } else {
        const newAud = hearingRecordToAudiogram(record, expectedCustomerId);
        savedAudiogram = await createAudiogram(newAud);
      }

      if (effectiveCustomerIdRef.current !== expectedCustomerId) {
        alert("保存成功但检测到客户已切换，请刷新页面查看当前客户数据。");
      } else {
        setSavingStatus("saved");
        setEditingAudiogramId(savedAudiogram.id);
        await clearDraft();
      }

      setTimeout(() => setSavingStatus("idle"), 2000);

      if (onSaved && effectiveCustomerIdRef.current === expectedCustomerId) {
        onSaved(savedAudiogram);
      }
    } catch (e) {
      setSavingStatus("error");
      alert(`保存失败: ${(e as Error).message}`);
    }
  };

  const hasAnyData = () => {
    const sides = ["left", "right"] as const;
    const conds = ["air", "bone"] as const;
    for (const side of sides) {
      for (const cond of conds) {
        if (record[side][cond].some((p) => p.value !== null)) {
          return true;
        }
      }
    }
    if (record.speechRecognitionScore) {
      if (record.speechRecognitionScore.left !== undefined) return true;
      if (record.speechRecognitionScore.right !== undefined) return true;
      if (record.speechRecognitionScore.binaural !== undefined) return true;
    }
    return false;
  };

  const canSave = effectiveCustomerId && hasAnyData();

  return (
    <section className="hearing-module panel">
      {showHeader && (
        <div className="section-heading">
          <div>
            <p>听力曲线工作台</p>
            <h2>听力图录入与预览</h2>
            {effectiveCustomerId && customerProfile && (
              <p className="customer-context">
                客户：<strong>{customerProfile.name}</strong>
                <span className="cust-no">({customerProfile.customerNo})</span>
                {editingAudiogramId ? (
                  <span className="edit-mode">· 编辑现有记录</span>
                ) : (
                  <span className="new-mode">· 新建记录</span>
                )}
              </p>
            )}
          </div>
          <div className="sample-picker">
            {showSamples && (
              <>
                <span className="sample-picker-label">示例数据</span>
                <div className="sample-chips">
                  {SAMPLE_CASES.map((c) => (
                    <button
                      key={c.id}
                      className={`sample-chip ${activeSample === c.id ? "sample-active" : ""}`}
                      onClick={() => handleSample(c.id)}
                      title={c.description}
                    >
                      {c.label}
                    </button>
                  ))}
                </div>
              </>
            )}
          </div>
        </div>
      )}

      {activeSample && showSamples && (
        <div className="sample-case-note">
          <strong>
            {SAMPLE_CASES.find((c) => c.id === activeSample)?.label}：
          </strong>
          {SAMPLE_CASES.find((c) => c.id === activeSample)?.description}
        </div>
      )}

      {effectiveCustomerId && !customerProfile && (
        <div className="customer-context-warning">
          ⚠️ 未找到客户信息，请确保已在档案库中选中客户
        </div>
      )}

      <div className="hearing-toolbar">
        <DraftIndicator
          status={draftStatus}
          lastSavedAt={lastSavedAt}
          isSupported={isSupported}
          storageType={storageType}
          hasDraft={hasDraft}
          onClear={handleClear}
          onSave={saveNow}
          className="hearing-draft-indicator"
        />
        <div className="hearing-save-actions">
          {onCancel && (
            <button className="ghost-btn" onClick={onCancel}>
              取消
            </button>
          )}
          <button
            className={`primary-action ${savingStatus === "saving" ? "saving" : ""}`}
            onClick={handleSaveToArchive}
            disabled={!canSave || savingStatus === "saving"}
          >
            {savingStatus === "saving"
              ? "保存中..."
              : savingStatus === "saved"
              ? "✓ 已保存"
              : editingAudiogramId
              ? "💾 更新到档案"
              : "💾 保存到档案"}
          </button>
        </div>
      </div>

      <div className="hearing-layout">
        <div className="hearing-form-col">
          <HearingForm
            record={record}
            onChange={updateRecord}
            onClear={handleClear}
            showMetaFields={!!effectiveCustomerId}
          />
        </div>
        <div className="hearing-chart-col">
          <div className="audiogram-panel">
            <div className="audiogram-panel-head">
              <h3>听力图预览 (Audiogram)</h3>
              <span className="audiogram-panel-sub">
                实时更新 · 横轴频率(对数) · 纵轴听阈(dB HL)
              </span>
            </div>
            <AudiogramChart record={record} width={760} />
          </div>
        </div>
      </div>
    </section>
  );
}
