import { useState, useEffect, useCallback } from "react";
import type {
  ReviewJobType,
  ReviewJobTypeVersion,
  KnowledgeFile,
} from "../types/job.types";
import {
  getJobTypes,
  getJobType,
  createJobType,
  updateJobType,
  deleteJobType,
  getJobTypeVersions,
  rollbackJobType,
} from "../api/jobApi";
import "../components/CreateJobModal.css";
import "./JobTypesPage.css";

interface Toast {
  id: number;
  message: string;
  type: "success" | "error" | "info";
}

type ViewMode = "list" | "detail" | "edit" | "create" | "versions";

export default function JobTypesPage() {
  const [jobTypes, setJobTypes] = useState<ReviewJobType[]>([]);
  const [loading, setLoading] = useState(false);
  const [toasts, setToasts] = useState<Toast[]>([]);
  const [viewMode, setViewMode] = useState<ViewMode>("list");
  const [selectedType, setSelectedType] = useState<ReviewJobType | null>(null);
  const [versions, setVersions] = useState<ReviewJobTypeVersion[]>([]);
  const [versionsLoading, setVersionsLoading] = useState(false);

  const showToast = useCallback(
    (message: string, type: Toast["type"] = "info") => {
      const id = Date.now();
      setToasts((prev) => [...prev, { id, message, type }]);
      setTimeout(
        () => setToasts((prev) => prev.filter((t) => t.id !== id)),
        4000,
      );
    },
    [],
  );

  const fetchJobTypes = useCallback(async () => {
    setLoading(true);
    try {
      const data = await getJobTypes();
      setJobTypes(data);
    } catch (err) {
      showToast((err as Error).message, "error");
    } finally {
      setLoading(false);
    }
  }, [showToast]);

  useEffect(() => {
    fetchJobTypes();
  }, [fetchJobTypes]);

  const handleViewDetail = async (id: string) => {
    try {
      const jt = await getJobType(id);
      setSelectedType(jt);
      setViewMode("detail");
    } catch (err) {
      showToast((err as Error).message, "error");
    }
  };

  const handleViewVersions = async (id: string) => {
    setVersionsLoading(true);
    try {
      const jt = await getJobType(id);
      setSelectedType(jt);
      const v = await getJobTypeVersions(id);
      setVersions(v);
      setViewMode("versions");
    } catch (err) {
      showToast((err as Error).message, "error");
    } finally {
      setVersionsLoading(false);
    }
  };

  const handleDelete = async (id: string) => {
    if (!confirm(`Delete job type "${id}"? This cannot be undone.`)) return;
    try {
      await deleteJobType(id);
      showToast("Job type deleted", "success");
      fetchJobTypes();
      if (selectedType?.id === id) {
        setViewMode("list");
        setSelectedType(null);
      }
    } catch (err) {
      showToast((err as Error).message, "error");
    }
  };

  const handleRollback = async (versionId: string) => {
    if (!selectedType) return;
    if (!confirm("Rollback to this version? A new version will be created."))
      return;
    try {
      const updated = await rollbackJobType(selectedType.id, versionId);
      setSelectedType(updated);
      showToast("Rolled back successfully", "success");
      const v = await getJobTypeVersions(selectedType.id);
      setVersions(v);
      fetchJobTypes();
    } catch (err) {
      showToast((err as Error).message, "error");
    }
  };

  return (
    <div className="jt-page">
      {viewMode === "list" && (
        <JobTypeList
          jobTypes={jobTypes}
          loading={loading}
          onRefresh={fetchJobTypes}
          onView={handleViewDetail}
          onVersions={handleViewVersions}
          onDelete={handleDelete}
          onCreate={() => setViewMode("create")}
        />
      )}

      {viewMode === "detail" && selectedType && (
        <JobTypeDetail
          jobType={selectedType}
          onBack={() => setViewMode("list")}
          onEdit={() => setViewMode("edit")}
          onVersions={() => handleViewVersions(selectedType.id)}
        />
      )}

      {viewMode === "edit" && selectedType && (
        <JobTypeForm
          existing={selectedType}
          onCancel={() => setViewMode("detail")}
          onSaved={(updated) => {
            setSelectedType(updated);
            setViewMode("detail");
            showToast("Job type updated", "success");
            fetchJobTypes();
          }}
          onError={(msg) => showToast(msg, "error")}
        />
      )}

      {viewMode === "create" && (
        <JobTypeForm
          onCancel={() => setViewMode("list")}
          onSaved={(created) => {
            setSelectedType(created);
            setViewMode("detail");
            showToast("Job type created", "success");
            fetchJobTypes();
          }}
          onError={(msg) => showToast(msg, "error")}
        />
      )}

      {viewMode === "versions" && selectedType && (
        <JobTypeVersions
          jobType={selectedType}
          versions={versions}
          loading={versionsLoading}
          onBack={() => setViewMode("detail")}
          onRollback={handleRollback}
        />
      )}

      <div className="toast-container">
        {toasts.map((t) => (
          <div key={t.id} className={`toast toast--${t.type}`}>
            {t.message}
          </div>
        ))}
      </div>
    </div>
  );
}

function JobTypeList({
  jobTypes,
  loading,
  onRefresh,
  onView,
  onVersions,
  onDelete,
  onCreate,
}: {
  jobTypes: ReviewJobType[];
  loading: boolean;
  onRefresh: () => void;
  onView: (id: string) => void;
  onVersions: (id: string) => void;
  onDelete: (id: string) => void;
  onCreate: () => void;
}) {
  return (
    <>
      <div className="jt-toolbar">
        <h2 className="jt-toolbar__title">Job Types</h2>
        <div className="jt-toolbar__actions">
          <button
            className="btn btn--secondary"
            onClick={onRefresh}
            disabled={loading}
          >
            Refresh
          </button>
          <button className="btn btn--primary" onClick={onCreate}>
            + Create Job Type
          </button>
        </div>
      </div>

      <div className="jt-grid">
        {loading && <div className="jt-empty">Loading…</div>}
        {!loading && jobTypes.length === 0 && (
          <div className="jt-empty">No job types found</div>
        )}
        {!loading &&
          jobTypes.map((jt) => (
            <div key={jt.id} className="jt-card">
              <div className="jt-card__header">
                <span className="jt-card__id">{jt.id}</span>
                <span className="jt-card__name">{jt.name}</span>
              </div>
              {jt.description && (
                <p className="jt-card__desc">{jt.description}</p>
              )}
              <div className="jt-card__footer">
                <span className="jt-card__date">
                  Updated {new Date(jt.updatedAt).toLocaleDateString()}
                </span>
                <div className="jt-card__actions">
                  <button
                    className="btn btn--secondary btn--sm"
                    onClick={() => onVersions(jt.id)}
                  >
                    Versions
                  </button>
                  <button
                    className="btn btn--secondary btn--sm"
                    onClick={() => onView(jt.id)}
                  >
                    View
                  </button>
                  <button
                    className="btn btn--danger btn--sm"
                    onClick={() => onDelete(jt.id)}
                  >
                    Delete
                  </button>
                </div>
              </div>
            </div>
          ))}
      </div>
    </>
  );
}

function JobTypeDetail({
  jobType,
  onBack,
  onEdit,
  onVersions,
}: {
  jobType: ReviewJobType;
  onBack: () => void;
  onEdit: () => void;
  onVersions: () => void;
}) {
  return (
    <>
      <div className="jt-toolbar">
        <div className="jt-toolbar__nav">
          <button className="btn btn--secondary btn--sm" onClick={onBack}>
            Back
          </button>
          <h2 className="jt-toolbar__title">
            {jobType.id} — {jobType.name}
          </h2>
        </div>
        <div className="jt-toolbar__actions">
          <button className="btn btn--secondary" onClick={onVersions}>
            Version History
          </button>
          <button className="btn btn--primary" onClick={onEdit}>
            Edit
          </button>
        </div>
      </div>

      <div className="jt-detail">
        {jobType.description && (
          <div className="jt-detail__section">
            <h3>Description</h3>
            <p>{jobType.description}</p>
          </div>
        )}

        <div className="jt-detail__section">
          <h3>System Prompt Template</h3>
          <pre className="jt-detail__code">{jobType.systemPromptTemplate}</pre>
        </div>

        <div className="jt-detail__section">
          <h3>Module Prompt Template</h3>
          <pre className="jt-detail__code">{jobType.modulePromptTemplate}</pre>
        </div>

        <div className="jt-detail__section">
          <h3>Summary Prompt</h3>
          <pre className="jt-detail__code">{jobType.summaryPrompt}</pre>
        </div>

        <div className="jt-detail__section">
          <h3>Diff User Prompt Template</h3>
          <pre className="jt-detail__code">
            {jobType.diffUserPromptTemplate}
          </pre>
        </div>

        {jobType.knowledgeFiles && jobType.knowledgeFiles.length > 0 && (
          <div className="jt-detail__section">
            <h3>Knowledge Files ({jobType.knowledgeFiles.length})</h3>
            {jobType.knowledgeFiles.map((kf, i) => (
              <div key={i} className="jt-detail__kf">
                <div className="jt-detail__kf-name">{kf.filename}</div>
                <pre className="jt-detail__code">{kf.content}</pre>
              </div>
            ))}
          </div>
        )}
      </div>
    </>
  );
}

function JobTypeForm({
  existing,
  onCancel,
  onSaved,
  onError,
}: {
  existing?: ReviewJobType;
  onCancel: () => void;
  onSaved: (jt: ReviewJobType) => void;
  onError: (msg: string) => void;
}) {
  const [form, setForm] = useState({
    id: existing?.id ?? "",
    name: existing?.name ?? "",
    description: existing?.description ?? "",
    systemPromptTemplate: existing?.systemPromptTemplate ?? "",
    modulePromptTemplate: existing?.modulePromptTemplate ?? "",
    summaryPrompt: existing?.summaryPrompt ?? "",
    diffUserPromptTemplate: existing?.diffUserPromptTemplate ?? "",
  });
  const [knowledgeFiles, setKnowledgeFiles] = useState<KnowledgeFile[]>(
    existing?.knowledgeFiles ?? [],
  );
  const [submitting, setSubmitting] = useState(false);

  const addKnowledgeFile = () => {
    setKnowledgeFiles((prev) => [...prev, { filename: "", content: "" }]);
  };

  const updateKnowledgeFile = (
    index: number,
    field: keyof KnowledgeFile,
    value: string,
  ) => {
    setKnowledgeFiles((prev) =>
      prev.map((kf, i) => (i === index ? { ...kf, [field]: value } : kf)),
    );
  };

  const removeKnowledgeFile = (index: number) => {
    setKnowledgeFiles((prev) => prev.filter((_, i) => i !== index));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSubmitting(true);
    try {
      const validKf = knowledgeFiles.filter(
        (kf) => kf.filename && kf.content,
      );

      if (existing) {
        const result = await updateJobType(existing.id, {
          name: form.name,
          description: form.description || null,
          systemPromptTemplate: form.systemPromptTemplate,
          modulePromptTemplate: form.modulePromptTemplate,
          summaryPrompt: form.summaryPrompt,
          diffUserPromptTemplate: form.diffUserPromptTemplate,
          knowledgeFiles: validKf,
        });
        onSaved(result);
      } else {
        const result = await createJobType({
          id: form.id,
          name: form.name,
          description: form.description || null,
          systemPromptTemplate: form.systemPromptTemplate,
          modulePromptTemplate: form.modulePromptTemplate,
          summaryPrompt: form.summaryPrompt,
          diffUserPromptTemplate: form.diffUserPromptTemplate,
          knowledgeFiles: validKf,
        });
        onSaved(result);
      }
    } catch (err) {
      onError((err as Error).message);
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <>
      <div className="jt-toolbar">
        <div className="jt-toolbar__nav">
          <button className="btn btn--secondary btn--sm" onClick={onCancel}>
            Cancel
          </button>
          <h2 className="jt-toolbar__title">
            {existing ? `Edit: ${existing.id}` : "Create Job Type"}
          </h2>
        </div>
      </div>

      <form className="jt-form" onSubmit={handleSubmit}>
        <div className="jt-form__row">
          <div className="form-field">
            <label className="form-label">ID *</label>
            <input
              className="form-input"
              placeholder="e.g. SECURITY"
              value={form.id}
              onChange={(e) =>
                setForm((f) => ({ ...f, id: e.target.value.toUpperCase() }))
              }
              required
              disabled={!!existing}
            />
          </div>
          <div className="form-field">
            <label className="form-label">Name *</label>
            <input
              className="form-input"
              placeholder="e.g. Security Review"
              value={form.name}
              onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))}
              required
            />
          </div>
        </div>

        <div className="form-field">
          <label className="form-label">Description</label>
          <input
            className="form-input"
            placeholder="Brief description of this review type"
            value={form.description}
            onChange={(e) =>
              setForm((f) => ({ ...f, description: e.target.value }))
            }
          />
        </div>

        <div className="form-field">
          <label className="form-label">System Prompt Template *</label>
          <textarea
            className="form-input form-textarea jt-form__textarea"
            value={form.systemPromptTemplate}
            onChange={(e) =>
              setForm((f) => ({ ...f, systemPromptTemplate: e.target.value }))
            }
            required
            rows={8}
          />
        </div>

        <div className="form-field">
          <label className="form-label">Module Prompt Template *</label>
          <textarea
            className="form-input form-textarea jt-form__textarea"
            value={form.modulePromptTemplate}
            onChange={(e) =>
              setForm((f) => ({ ...f, modulePromptTemplate: e.target.value }))
            }
            required
            rows={6}
          />
        </div>

        <div className="form-field">
          <label className="form-label">Summary Prompt *</label>
          <textarea
            className="form-input form-textarea jt-form__textarea"
            value={form.summaryPrompt}
            onChange={(e) =>
              setForm((f) => ({ ...f, summaryPrompt: e.target.value }))
            }
            required
            rows={3}
          />
        </div>

        <div className="form-field">
          <label className="form-label">Diff User Prompt Template *</label>
          <textarea
            className="form-input form-textarea jt-form__textarea"
            value={form.diffUserPromptTemplate}
            onChange={(e) =>
              setForm((f) => ({
                ...f,
                diffUserPromptTemplate: e.target.value,
              }))
            }
            required
            rows={6}
          />
        </div>

        <div className="jt-form__section">
          <div className="jt-form__section-header">
            <label className="form-label">Knowledge Files</label>
            <button
              type="button"
              className="btn btn--secondary btn--sm"
              onClick={addKnowledgeFile}
            >
              + Add File
            </button>
          </div>

          {knowledgeFiles.map((kf, i) => (
            <div key={i} className="jt-form__kf">
              <div className="jt-form__kf-header">
                <input
                  className="form-input"
                  placeholder="filename.md"
                  value={kf.filename}
                  onChange={(e) =>
                    updateKnowledgeFile(i, "filename", e.target.value)
                  }
                />
                <button
                  type="button"
                  className="btn btn--danger btn--sm"
                  onClick={() => removeKnowledgeFile(i)}
                >
                  Remove
                </button>
              </div>
              <textarea
                className="form-input form-textarea jt-form__textarea"
                placeholder="File content..."
                value={kf.content}
                onChange={(e) =>
                  updateKnowledgeFile(i, "content", e.target.value)
                }
                rows={6}
              />
            </div>
          ))}
        </div>

        <div className="jt-form__footer">
          <button
            type="button"
            className="btn btn--secondary"
            onClick={onCancel}
          >
            Cancel
          </button>
          <button
            type="submit"
            className="btn btn--primary"
            disabled={submitting}
          >
            {submitting
              ? "Saving..."
              : existing
                ? "Update Job Type"
                : "Create Job Type"}
          </button>
        </div>
      </form>
    </>
  );
}

function JobTypeVersions({
  jobType,
  versions,
  loading,
  onBack,
  onRollback,
}: {
  jobType: ReviewJobType;
  versions: ReviewJobTypeVersion[];
  loading: boolean;
  onBack: () => void;
  onRollback: (versionId: string) => void;
}) {
  const [expandedId, setExpandedId] = useState<string | null>(null);

  return (
    <>
      <div className="jt-toolbar">
        <div className="jt-toolbar__nav">
          <button className="btn btn--secondary btn--sm" onClick={onBack}>
            Back
          </button>
          <h2 className="jt-toolbar__title">
            Versions — {jobType.id}
          </h2>
        </div>
      </div>

      <div className="jt-versions">
        {loading && <div className="jt-empty">Loading versions…</div>}
        {!loading && versions.length === 0 && (
          <div className="jt-empty">No versions found</div>
        )}
        {!loading &&
          versions.map((v, i) => (
            <div key={v.id} className="jt-version-card">
              <div
                className="jt-version-card__header"
                onClick={() =>
                  setExpandedId(expandedId === v.id ? null : v.id)
                }
              >
                <div className="jt-version-card__info">
                  <span className="jt-version-card__number">
                    v{v.version}
                  </span>
                  <span className="jt-version-card__name">{v.name}</span>
                  {i === 0 && (
                    <span className="jt-version-card__current">CURRENT</span>
                  )}
                </div>
                <div className="jt-version-card__meta">
                  <span className="jt-version-card__date">
                    {new Date(v.createdAt).toLocaleString()}
                  </span>
                  {i !== 0 && (
                    <button
                      className="btn btn--warning btn--sm"
                      onClick={(e) => {
                        e.stopPropagation();
                        onRollback(v.id);
                      }}
                    >
                      Rollback
                    </button>
                  )}
                </div>
              </div>
              {expandedId === v.id && (
                <div className="jt-version-card__body">
                  {v.description && <p>{v.description}</p>}
                  <div className="jt-detail__section">
                    <h4>System Prompt</h4>
                    <pre className="jt-detail__code">
                      {v.systemPromptTemplate}
                    </pre>
                  </div>
                  <div className="jt-detail__section">
                    <h4>Module Prompt</h4>
                    <pre className="jt-detail__code">
                      {v.modulePromptTemplate}
                    </pre>
                  </div>
                  <div className="jt-detail__section">
                    <h4>Summary Prompt</h4>
                    <pre className="jt-detail__code">{v.summaryPrompt}</pre>
                  </div>
                  <div className="jt-detail__section">
                    <h4>Diff User Prompt</h4>
                    <pre className="jt-detail__code">
                      {v.diffUserPromptTemplate}
                    </pre>
                  </div>
                  {v.knowledgeFiles && v.knowledgeFiles.length > 0 && (
                    <div className="jt-detail__section">
                      <h4>Knowledge Files ({v.knowledgeFiles.length})</h4>
                      {v.knowledgeFiles.map((kf, ki) => (
                        <div key={ki} className="jt-detail__kf">
                          <div className="jt-detail__kf-name">
                            {kf.filename}
                          </div>
                          <pre className="jt-detail__code">{kf.content}</pre>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              )}
            </div>
          ))}
      </div>
    </>
  );
}
