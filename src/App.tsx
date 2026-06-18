import "./styles.css";
import { useState } from "react";
import { ArchiveProvider, ArchiveModule } from "./archive";
import { WorkflowProvider, WorkflowModule } from "./workflow";
import { CustomerFlowProvider, CustomerFlowView } from "./customerFlow";

type AppView = "workbench" | "archive" | "workflow";

function App() {
  const [activeView, setActiveView] = useState<AppView>("workbench");

  return (
    <WorkflowProvider>
      <ArchiveProvider>
        <CustomerFlowProvider>
          <main className="app-shell">
            <nav className="app-nav">
              <div className="app-nav-brand">
                <span className="brand-mark">🦻</span>
                <div>
                  <h1>听力验配记录</h1>
                  <p className="brand-sub">门店听力师的验配档案与听力曲线工作台</p>
                </div>
              </div>
              <div className="app-nav-tabs">
                <button
                  className={`nav-tab ${activeView === "workbench" ? "nav-tab-active" : ""}`}
                  onClick={() => setActiveView("workbench")}
                >
                  <span className="nav-tab-icon">🎯</span>
                  <span>客户流程</span>
                </button>
                <button
                  className={`nav-tab ${activeView === "archive" ? "nav-tab-active" : ""}`}
                  onClick={() => setActiveView("archive")}
                >
                  <span className="nav-tab-icon">📚</span>
                  <span>档案库</span>
                </button>
                <button
                  className={`nav-tab ${activeView === "workflow" ? "nav-tab-active" : ""}`}
                  onClick={() => setActiveView("workflow")}
                >
                  <span className="nav-tab-icon">🔄</span>
                  <span>工作流</span>
                </button>
              </div>
              <div className="app-nav-actions">
                <span className="nav-project-tag">hxwl-01</span>
              </div>
            </nav>

            {activeView === "workbench" ? (
              <CustomerFlowView />
            ) : activeView === "archive" ? (
              <ArchiveModule />
            ) : (
              <WorkflowModule />
            )}
          </main>
        </CustomerFlowProvider>
      </ArchiveProvider>
    </WorkflowProvider>
  );
}

export default App;
