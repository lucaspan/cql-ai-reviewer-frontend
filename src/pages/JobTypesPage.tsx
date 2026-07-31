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
  getCommitReviewJobTypes,
  updateCommitReviewJobType,
  getCommitReviewJobTypeVersions,
} from "../api/jobApi";
import "../components/CreateJobModal.css";
import "./JobTypesPage.css";

interface Toast {
  id: number;
  message: string;
  type: "success" | "error" | "info";
}

type ViewMode = "list" | "detail" | "edit" | "create" | "versions";

/**
 * Build a shareable Markdown document for a job type. Intentionally omits the
 * module prompt template — this is meant for sharing the review's intent
 * (system prompt, summary prompt, diff user prompt, knowledge files) with
 * other people, not the internal per-module plumbing.
 */
function buildJobTypeMarkdown(jobType: ReviewJobType): string {
  const parts: string[] = [];

  parts.push(`# ${jobType.name} (\`${jobType.id}\`)`);

  if (jobType.description) {
    parts.push(jobType.description);
  }

  if (jobType.systemPromptTemplate) {
    parts.push(`## System Prompt\n\n${jobType.systemPromptTemplate}`);
  }

  if (jobType.summaryPrompt) {
    parts.push(`## Summary Prompt\n\n${jobType.summaryPrompt}`);
  }

  if (jobType.diffUserPromptTemplate) {
    parts.push(`## Diff User Prompt\n\n${jobType.diffUserPromptTemplate}`);
  }

  if (jobType.knowledgeFiles && jobType.knowledgeFiles.length > 0) {
    const kfSections = jobType.knowledgeFiles
      .map((kf) => `### \`${kf.filename}\`\n\n${kf.content}`)
      .join("\n\n");
    parts.push(`## Knowledge Files\n\n${kfSections}`);
  }

  return parts.join("\n\n");
}

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
          showToast={showToast}
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

      {viewMode === "list" && (
        <CommitReviewJobTypes showToast={showToast} />
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
  showToast,
}: {
  jobType: ReviewJobType;
  onBack: () => void;
  onEdit: () => void;
  onVersions: () => void;
  showToast: (message: string, type?: Toast["type"]) => void;
}) {
  const handleCopy = async () => {
    try {
      await navigator.clipboard.writeText(buildJobTypeMarkdown(jobType));
      showToast("Copied Markdown to clipboard", "success");
    } catch {
      showToast("Failed to copy to clipboard", "error");
    }
  };

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
          <button className="btn btn--secondary" onClick={handleCopy}>
            Copy as MD
          </button>
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


function CommitReviewJobTypes({ showToast }: { showToast: (msg: string, type: "success" | "error" | "info") => void }) {
  const [types, setTypes] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editForm, setEditForm] = useState<{ systemPromptTemplate: string; knowledgeFiles: string }>({ systemPromptTemplate: "", knowledgeFiles: "" });
  const [saving, setSaving] = useState(false);
  const [viewingId, setViewingId] = useState<string | null>(null);
  const [versionsId, setVersionsId] = useState<string | null>(null);
  const [versions, setVersions] = useState<any[]>([]);
  const [versionsLoading, setVersionsLoading] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const data = await getCommitReviewJobTypes();
      setTypes(data);
    } catch {
      // silent
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { load(); }, [load]);

  const handleEdit = (t: any) => {
    setEditingId(t.id);
    setViewingId(null);
    setEditForm({
      systemPromptTemplate: t.systemPromptTemplate ?? "",
      knowledgeFiles: JSON.stringify(t.knowledgeFiles ?? [], null, 2)
    });
  };

  const handleSave = async () => {
    if (!editingId) return;
    setSaving(true);
    try {
      let knowledgeFiles;
      try { knowledgeFiles = JSON.parse(editForm.knowledgeFiles); } catch { showToast("Invalid JSON in knowledge files", "error"); setSaving(false); return; }
      await updateCommitReviewJobType(editingId, {
        systemPromptTemplate: editForm.systemPromptTemplate,
        knowledgeFiles
      });
      showToast("Commit review job type updated", "success");
      setEditingId(null);
      load();
    } catch (err) {
      showToast((err as Error).message, "error");
    } finally {
      setSaving(false);
    }
  };

  const handleViewVersions = async (typeId: string) => {
    setVersionsId(typeId);
    setVersionsLoading(true);
    try {
      const data = await getCommitReviewJobTypeVersions(typeId);
      setVersions(data);
    } catch {
      setVersions([]);
    } finally {
      setVersionsLoading(false);
    }
  };

  const viewingType = viewingId ? types.find((t) => t.id === viewingId) : null;
  const editingType = editingId ? types.find((t) => t.id === editingId) : null;

  // Versions view
  if (versionsId) {
    const vType = types.find((t) => t.id === versionsId);
    return (
      <CommitReviewVersionsView
        typeName={vType?.name ?? versionsId}
        typeId={versionsId}
        versions={versions}
        loading={versionsLoading}
        onBack={() => setVersionsId(null)}
      />
    );
  }

  // Detail view
  if (viewingType && !editingId) {
    return (
      <>
        <div className="jt-toolbar">
          <div className="jt-toolbar__nav">
            <button className="btn btn--secondary btn--sm" onClick={() => setViewingId(null)}>Back</button>
            <h2 className="jt-toolbar__title">{viewingType.id} — {viewingType.name}</h2>
          </div>
          <div className="jt-toolbar__actions">
            <button className="btn btn--secondary" onClick={() => handleViewVersions(viewingType.id)}>Version History</button>
            <button className="btn btn--primary" onClick={() => handleEdit(viewingType)}>Edit</button>
          </div>
        </div>
        <div className="jt-detail">
          {viewingType.description && (
            <div className="jt-detail__section">
              <h3>Description</h3>
              <p>{viewingType.description}</p>
            </div>
          )}
          <div className="jt-detail__section">
            <h3>System Prompt Template</h3>
            <pre className="jt-detail__code">{viewingType.systemPromptTemplate}</pre>
          </div>
          {(viewingType.knowledgeFiles ?? []).length > 0 && (
            <div className="jt-detail__section">
              <h3>Knowledge Files ({viewingType.knowledgeFiles.length})</h3>
              {viewingType.knowledgeFiles.map((kf: any, i: number) => (
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

  // Edit view
  if (editingType) {
    return (
      <>
        <div className="jt-toolbar">
          <div className="jt-toolbar__nav">
            <button className="btn btn--secondary btn--sm" onClick={() => setEditingId(null)}>Cancel</button>
            <h2 className="jt-toolbar__title">Edit: {editingType.id}</h2>
          </div>
          <div className="jt-toolbar__actions">
            <button className="btn btn--primary" onClick={handleSave} disabled={saving}>
              {saving ? "Saving..." : "Save"}
            </button>
          </div>
        </div>
        <div className="jt-form">
          <div className="form-field">
            <label className="form-label">System Prompt Template *</label>
            <textarea
              className="form-input form-textarea jt-form__textarea"
              value={editForm.systemPromptTemplate}
              onChange={(e) => setEditForm((f) => ({ ...f, systemPromptTemplate: e.target.value }))}
              rows={20}
            />
          </div>
          <div className="form-field">
            <label className="form-label">Knowledge Files (JSON)</label>
            <textarea
              className="form-input form-textarea jt-form__textarea"
              value={editForm.knowledgeFiles}
              onChange={(e) => setEditForm((f) => ({ ...f, knowledgeFiles: e.target.value }))}
              rows={12}
            />
          </div>
        </div>
      </>
    );
  }

  // List view
  return (
    <>
      <div className="jt-toolbar">
        <h2 className="jt-toolbar__title">Commit Review Job Types</h2>
        <div className="jt-toolbar__actions">
          <button className="btn btn--secondary" onClick={load} disabled={loading}>Refresh</button>
        </div>
      </div>

      <div className="jt-grid">
        {loading && <div className="jt-empty">Loading…</div>}
        {!loading && types.length === 0 && (
          <div className="jt-empty">No commit review job types found. Run seeds to create defaults.</div>
        )}
        {!loading && types.map((t) => (
          <div key={t.id} className="jt-card">
            <div className="jt-card__header">
              <span className="jt-card__id">{t.id}</span>
              <span className="jt-card__name">{t.name}</span>
            </div>
            {t.description && <p className="jt-card__desc">{t.description}</p>}
            <div className="jt-card__footer">
              <span className="jt-card__date">
                Updated {new Date(t.updatedAt).toLocaleDateString()}
              </span>
              <div className="jt-card__actions">
                <button className="btn btn--secondary btn--sm" onClick={() => handleViewVersions(t.id)}>Versions</button>
                <button className="btn btn--secondary btn--sm" onClick={() => setViewingId(t.id)}>View</button>
                <button className="btn btn--primary btn--sm" onClick={() => handleEdit(t)}>Edit</button>
              </div>
            </div>
          </div>
        ))}
      </div>
    </>
  );
}

function CommitReviewVersionsView({
  typeName,
  typeId,
  versions,
  loading,
  onBack,
}: {
  typeName: string;
  typeId: string;
  versions: any[];
  loading: boolean;
  onBack: () => void;
}) {
  const [expandedId, setExpandedId] = useState<string | null>(null);

  return (
    <>
      <div className="jt-toolbar">
        <div className="jt-toolbar__nav">
          <button className="btn btn--secondary btn--sm" onClick={onBack}>
            Back
          </button>
          <h2 className="jt-toolbar__title">Versions — {typeName}</h2>
        </div>
      </div>

      <div className="jt-versions">
        {loading && <div className="jt-empty">Loading versions…</div>}
        {!loading && versions.length === 0 && (
          <div className="jt-empty">No versions recorded yet</div>
        )}
        {!loading &&
          versions.map((v, i) => (
            <div key={v.id} className="jt-version-card">
              <div
                className="jt-version-card__header"
                onClick={() => setExpandedId(expandedId === v.id ? null : v.id)}
              >
                <div className="jt-version-card__info">
                  <span className="jt-version-card__number">v{v.version}</span>
                  <span className="jt-version-card__name">{v.name}</span>
                  {i === 0 && (
                    <span className="jt-version-card__current">CURRENT</span>
                  )}
                </div>
                <div className="jt-version-card__meta">
                  <span className="jt-version-card__date">
                    {new Date(v.createdAt).toLocaleString()}
                  </span>
                </div>
              </div>
              {expandedId === v.id && (
                <div className="jt-version-card__body">
                  {v.description && <p>{v.description}</p>}
                  <div className="jt-detail__section">
                    <h4>System Prompt</h4>
                    <pre className="jt-detail__code">{v.systemPromptTemplate}</pre>
                  </div>
                  {v.knowledgeFiles && v.knowledgeFiles.length > 0 && (
                    <div className="jt-detail__section">
                      <h4>Knowledge Files ({v.knowledgeFiles.length})</h4>
                      {v.knowledgeFiles.map((kf: any, ki: number) => (
                        <div key={ki} className="jt-detail__kf">
                          <div className="jt-detail__kf-name">{kf.filename}</div>
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
