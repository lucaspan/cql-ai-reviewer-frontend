import { useState } from "react";
import JobsPage from "./pages/JobsPage";
import JobTypesPage from "./pages/JobTypesPage";
import MetricsPage from "./pages/MetricsPage";
import ReportsPage from "./pages/ReportsPage";
import SettingsPage from "./pages/SettingsPage";
import "./App.css";

type Page = "jobs" | "job-types" | "metrics" | "reports" | "settings";

function App() {
  const [page, setPage] = useState<Page>("jobs");

  return (
    <div>
      {page === "jobs" && <JobsPage />}
      {page === "job-types" && (
        <div className="jobs-page">
          <header className="jobs-page__header">
            <span className="jobs-page__logo">⚡</span>
            <h1 className="jobs-page__title">JDev AI Reviewer</h1>
            <span className="jobs-page__subtitle">Job Types</span>
          </header>
          <div className="jobs-page__content">
            <JobTypesPage />
          </div>
        </div>
      )}
      {page === "metrics" && (
        <div className="jobs-page">
          <header className="jobs-page__header">
            <span className="jobs-page__logo">⚡</span>
            <h1 className="jobs-page__title">JDev AI Reviewer</h1>
            <span className="jobs-page__subtitle">Metrics</span>
          </header>
          <div className="jobs-page__content">
            <MetricsPage />
          </div>
        </div>
      )}
      {page === "reports" && (
        <div className="jobs-page">
          <header className="jobs-page__header">
            <span className="jobs-page__logo">⚡</span>
            <h1 className="jobs-page__title">JDev AI Reviewer</h1>
            <span className="jobs-page__subtitle">Reports</span>
          </header>
          <div className="jobs-page__content">
            <ReportsPage />
          </div>
        </div>
      )}
      {page === "settings" && (
        <div className="jobs-page">
          <header className="jobs-page__header">
            <span className="jobs-page__logo">⚡</span>
            <h1 className="jobs-page__title">JDev AI Reviewer</h1>
            <span className="jobs-page__subtitle">Settings</span>
          </header>
          <div className="jobs-page__content">
            <SettingsPage />
          </div>
        </div>
      )}

      <nav className="app-nav">
        <button
          className={`app-nav__btn ${page === "jobs" ? "app-nav__btn--active" : ""}`}
          onClick={() => setPage("jobs")}
        >
          Jobs
        </button>
        <button
          className={`app-nav__btn ${page === "job-types" ? "app-nav__btn--active" : ""}`}
          onClick={() => setPage("job-types")}
        >
          Job Types
        </button>
        <button
          className={`app-nav__btn ${page === "metrics" ? "app-nav__btn--active" : ""}`}
          onClick={() => setPage("metrics")}
        >
          Metrics
        </button>
        <button
          className={`app-nav__btn ${page === "reports" ? "app-nav__btn--active" : ""}`}
          onClick={() => setPage("reports")}
        >
          Reports
        </button>
        <button
          className={`app-nav__btn ${page === "settings" ? "app-nav__btn--active" : ""}`}
          onClick={() => setPage("settings")}
        >
          Settings
        </button>
      </nav>
    </div>
  );
}

export default App;
