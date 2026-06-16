import {
  FREQUENCIES,
  HearingRecord,
  Frequency,
  EarSide,
  ConductionType
} from "./hearing.types";
import {
  computePTA,
  classifySeverity,
  findAnomalies,
  updateThreshold
} from "./hearing.utils";

interface Props {
  record: HearingRecord;
  onChange: (next: HearingRecord) => void;
  onClear: () => void;
}

const SIDE_LABEL: Record<EarSide, string> = { left: "左耳", right: "右耳" };
const COND_LABEL: Record<ConductionType, string> = { air: "气导 AC", bone: "骨导 BC" };
const COND_UNIT: Record<ConductionType, string> = { air: "○×", bone: "[]" };
const SIDE_COLOR: Record<EarSide, string> = { left: "#2563eb", right: "#dc2626" };

export default function HearingForm({ record, onChange, onClear }: Props) {
  const anomalies = findAnomalies(record);
  const ptaLeft = computePTA(record.left);
  const ptaRight = computePTA(record.right);

  const handleInput = (
    side: EarSide,
    cond: ConductionType,
    freq: Frequency,
    val: string
  ) => {
    const raw = val.trim() === "" ? null : val;
    onChange(updateThreshold(record, side, cond, freq, raw));
  };

  return (
    <div className="hearing-form">
      <div className="hearing-form-header">
        <div>
          <h3 className="hearing-form-title">听力阈值录入</h3>
          <p className="hearing-form-sub">250Hz ~ 8000Hz · 单位：dB HL</p>
        </div>
        <div className="hearing-actions">
          <button className="btn btn-ghost" onClick={onClear}>
            清空数据
          </button>
        </div>
      </div>

      <div className="hearing-pta-bar">
        <div className="pta-item" style={{ borderColor: SIDE_COLOR.left }}>
          <span className="pta-label">左耳 PTA (500/1k/2k)</span>
          <strong className="pta-value" style={{ color: SIDE_COLOR.left }}>
            {ptaLeft === null ? "--" : `${ptaLeft} dB`}
          </strong>
          <span className="pta-severity">{classifySeverity(ptaLeft)}</span>
        </div>
        <div className="pta-item" style={{ borderColor: SIDE_COLOR.right }}>
          <span className="pta-label">右耳 PTA (500/1k/2k)</span>
          <strong className="pta-value" style={{ color: SIDE_COLOR.right }}>
            {ptaRight === null ? "--" : `${ptaRight} dB`}
          </strong>
          <span className="pta-severity">{classifySeverity(ptaRight)}</span>
        </div>
      </div>

      {anomalies.length > 0 && (
        <div className="hearing-warnings">
          <div className="hearing-warnings-title">⚠️ 数据校验提示</div>
          <ul>
            {anomalies.map((m, i) => (
              <li key={i}>{m}</li>
            ))}
          </ul>
        </div>
      )}

      <div className="ear-grid">
        {(["left", "right"] as EarSide[]).map(side => (
          <div key={side} className={`ear-card ear-${side}`}>
            <div className="ear-card-title">
              <span className="ear-dot" style={{ background: SIDE_COLOR[side] }} />
              {SIDE_LABEL[side]}
            </div>
            {(["air", "bone"] as ConductionType[]).map(cond => (
              <div key={cond} className="cond-block">
                <div className="cond-header">
                  <span className="cond-name">
                    <b style={{ color: SIDE_COLOR[side] }}>{COND_UNIT[cond]}</b>
                    &nbsp;{COND_LABEL[cond]}
                  </span>
                </div>
                <div className="freq-row">
                  {FREQUENCIES.map(freq => {
                    const pt = record[side][cond].find(p => p.frequency === freq)!;
                    return (
                      <label
                        key={freq}
                        className={`freq-cell ${!pt.valid ? "freq-invalid" : ""} ${
                          pt.value === null ? "freq-empty" : ""
                        }`}
                      >
                        <span className="freq-label">{freqLabel(freq)}</span>
                        <input
                          type="text"
                          inputMode="numeric"
                          placeholder="--"
                          value={pt.value === null ? "" : String(pt.value)}
                          onChange={e => handleInput(side, cond, freq, e.target.value)}
                        />
                        {pt.warning && (
                          <span className="freq-warn" title={pt.warning}>
                            ⚠
                          </span>
                        )}
                      </label>
                    );
                  })}
                </div>
              </div>
            ))}
          </div>
        ))}
      </div>

      <div className="hearing-legend">
        <div className="legend-item">
          <span className="legend-sym legend-left-air">×</span>
          左耳气导
        </div>
        <div className="legend-item">
          <span className="legend-sym legend-right-air">○</span>
          右耳气导
        </div>
        <div className="legend-item">
          <span className="legend-sym legend-left-bone">[</span>
          左耳骨导
        </div>
        <div className="legend-item">
          <span className="legend-sym legend-right-bone">]</span>
          右耳骨导
        </div>
        <div className="legend-item legend-gray">
          ┈ 虚线 = 有缺失频点
        </div>
      </div>
    </div>
  );
}

function freqLabel(f: Frequency): string {
  if (f >= 1000) return `${f / 1000}k`;
  return String(f);
}
