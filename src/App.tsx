import { useState } from "react";
import JobsPage from "./pages/JobsPage";
import JobTypesPage from "./pages/JobTypesPage";
import MetricsPage from "./pages/MetricsPage";
import ReportsPage from "./pages/ReportsPage";
import RepoConfigPage from "./pages/RepoConfigPage";
import ProjectsPage from "./pages/ProjectsPage";
import SettingsPage from "./pages/SettingsPage";
import "./App.css";

type Page =
  | "jobs"
  | "job-types"
  | "metrics"
  | "reports"
  | "repo-config"
  | "projects"
  | "settings";

// Nav is grouped into two tiers: WORK (daily, output-producing) and CONFIGURE
// (occasional setup).
const NAV_GROUPS: { label: string; items: { id: Page; label: string }[] }[] = [
  {
    label: "Work",
    items: [
      { id: "jobs", label: "Jobs" },
      { id: "projects", label: "Threat Modeling" },
      { id: "reports", label: "Reports" },
      { id: "metrics", label: "Metrics" },
    ],
  },
  {
    label: "Configure",
    items: [
      { id: "repo-config", label: "Repositories" },
      { id: "job-types", label: "Job Types" },
      { id: "settings", label: "Settings" },
    ],
  },
];

const PAGE_SUBTITLE: Record<Page, string> = {
  jobs: "Job Manager",
  projects: "Threat Modeling",
  reports: "Reports",
  metrics: "Metrics",
  "repo-config": "Repositories",
  "job-types": "Job Types",
  settings: "Settings",
};

function PageShell({ subtitle, children }: { subtitle: string; children: React.ReactNode }) {
  return (
    <div className="jobs-page">
      <header className="jobs-page__header">
        <h1 className="jobs-page__title">CQL AI Reviewer</h1>
        <span className="jobs-page__subtitle">{subtitle}</span>
      </header>
      <div className="jobs-page__content">{children}</div>
    </div>
  );
}

function App() {
  const [page, setPage] = useState<Page>("jobs");
  // Sidebar starts open on desktop widths, closed on narrow screens.
  const [navOpen, setNavOpen] = useState<boolean>(() =>
    typeof window !== "undefined" ? window.innerWidth >= 1024 : true,
  );

  const select = (id: Page) => {
    setPage(id);
    // Auto-close after a selection on narrow screens (overlay drawer).
    if (typeof window !== "undefined" && window.innerWidth < 1024) {
      setNavOpen(false);
    }
  };

  const renderPage = () => {
    switch (page) {
      case "jobs":
        return <JobsPage />;
      case "job-types":
        return <PageShell subtitle={PAGE_SUBTITLE["job-types"]}><JobTypesPage /></PageShell>;
      case "metrics":
        return <PageShell subtitle={PAGE_SUBTITLE.metrics}><MetricsPage /></PageShell>;
      case "reports":
        return <PageShell subtitle={PAGE_SUBTITLE.reports}><ReportsPage /></PageShell>;
      case "repo-config":
        return <PageShell subtitle={PAGE_SUBTITLE["repo-config"]}><RepoConfigPage /></PageShell>;
      case "projects":
        return <PageShell subtitle={PAGE_SUBTITLE.projects}><ProjectsPage /></PageShell>;
      case "settings":
        return <PageShell subtitle={PAGE_SUBTITLE.settings}><SettingsPage /></PageShell>;
    }
  };

  return (
    <div className={`app-shell ${navOpen ? "app-shell--nav-open" : ""}`}>
      {/* Floating button to OPEN the sidebar — only shown while closed. */}
      {!navOpen && (
        <button
          className="app-navtoggle"
          onClick={() => setNavOpen(true)}
          aria-label="Open navigation"
          aria-expanded={false}
          aria-controls="app-sidebar"
        >
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none" aria-hidden>
            <path
              d="M4 7h16M4 12h16M4 17h16"
              stroke="currentColor"
              strokeWidth="2"
              strokeLinecap="round"
            />
          </svg>
        </button>
      )}

      <aside
        id="app-sidebar"
        className={`app-sidebar ${navOpen ? "app-sidebar--open" : ""}`}
        aria-label="Primary navigation"
        aria-hidden={!navOpen}
      >
        <div className="app-sidebar__brand">
          <span className="app-sidebar__brand-name">CQL AI Reviewer</span>
          {/* Close (✕) lives inside the sidebar header — never overlaps the open button. */}
          <button
            className="app-sidebar__close"
            onClick={() => setNavOpen(false)}
            aria-label="Close navigation"
          >
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" aria-hidden>
              <path
                d="M6 6l12 12M18 6L6 18"
                stroke="currentColor"
                strokeWidth="2"
                strokeLinecap="round"
              />
            </svg>
          </button>
        </div>
        <nav className="app-sidebar__nav">
          {NAV_GROUPS.map((group) => (
            <div key={group.label} className="app-sidebar__group">
              <span className="app-sidebar__group-label">{group.label}</span>
              {group.items.map((item) => (
                <button
                  key={item.id}
                  className={`app-sidebar__item ${page === item.id ? "app-sidebar__item--active" : ""}`}
                  onClick={() => select(item.id)}
                  aria-current={page === item.id ? "page" : undefined}
                >
                  {item.label}
                </button>
              ))}
            </div>
          ))}
        </nav>
      </aside>

      {/* Scrim closes the drawer when it overlays content on narrow screens. */}
      {navOpen && (
        <div className="app-scrim" onClick={() => setNavOpen(false)} aria-hidden />
      )}

      <main className="app-main">{renderPage()}</main>
    </div>
  );
}

export default App;
