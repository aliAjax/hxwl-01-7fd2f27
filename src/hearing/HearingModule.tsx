import { useState } from "react";
import { HearingRecord } from "./hearing.types";
import { createEmptyRecord } from "./hearing.utils";
import { SAMPLE_CASES, loadSampleCase } from "./sampleData";
import HearingForm from "./HearingForm";
import AudiogramChart from "./AudiogramChart";

export default function HearingModule() {
  const [record, setRecord] = useState<HearingRecord>(() =>
    loadSampleCase("high-frequency") || createEmptyRecord()
  );
  const [activeSample, setActiveSample] = useState<string>("high-frequency");

  const handleSample = (id: string) => {
    const data = loadSampleCase(id);
    if (data) {
      setRecord(data);
      setActiveSample(id);
    }
  };

  const handleClear = () => {
    setRecord(createEmptyRecord());
    setActiveSample("");
  };

  return (
    <section className="hearing-module panel">
      <div className="section-heading">
        <div>
          <p>听力曲线工作台</p>
          <h2>听力图录入与预览</h2>
        </div>
        <div className="sample-picker">
          <span className="sample-picker-label">示例数据</span>
          <div className="sample-chips">
            {SAMPLE_CASES.map(c => (
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
        </div>
      </div>

      {activeSample && (
        <div className="sample-case-note">
          <strong>
            {SAMPLE_CASES.find(c => c.id === activeSample)?.label}：
          </strong>
          {SAMPLE_CASES.find(c => c.id === activeSample)?.description}
        </div>
      )}

      <div className="hearing-layout">
        <div className="hearing-form-col">
          <HearingForm
            record={record}
            onChange={setRecord}
            onClear={handleClear}
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
