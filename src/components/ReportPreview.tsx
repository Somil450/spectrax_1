import React, { useState, useMemo } from "react";
import type { ReportData, TemplateType, ExportFormat } from "../types/report";
import { reportEngine } from "../services/reportEngine";

interface ReportPreviewProps {
  data: ReportData;
  onClose?: () => void;
}

export function ReportPreview({ data, onClose }: ReportPreviewProps) {
  const [templateType, setTemplateType] = useState<TemplateType>("executive");
  const [exportFormat, setExportFormat] = useState<ExportFormat>("html");
  const [copied, setCopied] = useState(false);

  const templates = useMemo(() => reportEngine.listTemplates(), []);

  const preview = useMemo(() => {
    try {
      return reportEngine.getPreview(data, templateType);
    } catch {
      return { html: "<p>Error generating preview.</p>", wordCount: 0, sections: [] };
    }
  }, [data, templateType]);

  const rendered = useMemo(() => {
    try {
      return reportEngine.render(data, templateType, exportFormat);
    } catch {
      return "Error rendering report.";
    }
  }, [data, templateType, exportFormat]);

  const handleCopy = async () => {
    try {
      await navigator.clipboard.writeText(rendered);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      // Clipboard not available
    }
  };

  const handleDownload = () => {
    const ext = exportFormat === "markdown" ? "md" : exportFormat;
    const blob = new Blob([rendered], {
      type: exportFormat === "html" ? "text/html" : exportFormat === "json" ? "application/json" : "text/markdown",
    });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.download = `workout-report-${templateType}.${ext}`;
    link.href = url;
    link.click();
    URL.revokeObjectURL(url);
  };

  const currentTemplate = templates.find((t) => t.type === templateType);
  const supportedFormats = currentTemplate?.supportedFormats ?? ["html"];

  return (
    <div style={{
      position: "fixed", inset: 0, zIndex: 9999,
      background: "rgba(0,0,0,0.6)", display: "flex",
      alignItems: "center", justifyContent: "center",
      padding: "1rem",
    }}>
      <div style={{
        background: "#fff", borderRadius: "0.75rem",
        maxWidth: "900px", width: "100%", maxHeight: "90vh",
        display: "flex", flexDirection: "column",
        boxShadow: "0 20px 60px rgba(0,0,0,0.3)",
        color: "#1a1a2e",
      }}>
        <div style={{
          display: "flex", alignItems: "center", justifyContent: "space-between",
          padding: "1rem 1.25rem", borderBottom: "1px solid #e2e8f0",
        }}>
          <h2 style={{ margin: 0, fontSize: "1.1rem", fontWeight: 600 }}>Report Preview</h2>
          {onClose && (
            <button onClick={onClose} style={{
              background: "none", border: "none", fontSize: "1.25rem",
              cursor: "pointer", padding: "0.25rem", color: "#64748b",
            }} aria-label="Close">&times;</button>
          )}
        </div>

        <div style={{
          display: "flex", gap: "0.75rem", padding: "0.75rem 1.25rem",
          borderBottom: "1px solid #e2e8f0", background: "#f8fafc",
          flexWrap: "wrap",
        }}>
          {templates.map((t) => (
            <button
              key={t.type}
              onClick={() => { setTemplateType(t.type); setExportFormat(t.supportedFormats[0] ?? "html"); }}
              style={{
                padding: "0.4rem 0.9rem", borderRadius: "0.375rem",
                border: templateType === t.type ? "2px solid #3b82f6" : "1px solid #d1d5db",
                background: templateType === t.type ? "#eff6ff" : "#fff",
                cursor: "pointer", fontWeight: templateType === t.type ? 600 : 400,
                fontSize: "0.85rem", color: "#1e293b",
              }}
            >{t.label}</button>
          ))}
          <span style={{ flex: 1 }} />
          {supportedFormats.map((f) => (
            <button
              key={f}
              onClick={() => setExportFormat(f)}
              style={{
                padding: "0.4rem 0.7rem", borderRadius: "0.25rem",
                border: exportFormat === f ? "2px solid #8b5cf6" : "1px solid #d1d5db",
                background: exportFormat === f ? "#f5f3ff" : "#fff",
                cursor: "pointer", fontWeight: exportFormat === f ? 600 : 400,
                fontSize: "0.8rem", textTransform: "uppercase", color: "#1e293b",
              }}
            >{f}</button>
          ))}
        </div>

        <div style={{
          flex: 1, overflow: "auto", padding: "1rem 1.25rem",
          background: "#f1f5f9",
        }}>
          {exportFormat === "html" ? (
            <div style={{ background: "#fff", borderRadius: "0.5rem", padding: "1rem" }}>
              <div dangerouslySetInnerHTML={{ __html: preview.html }} />
            </div>
          ) : (
            <pre style={{
              background: "#1e293b", color: "#e2e8f0",
              padding: "1rem", borderRadius: "0.5rem",
              overflow: "auto", fontSize: "0.8rem",
              whiteSpace: "pre-wrap", wordBreak: "break-all",
              margin: 0,
            }}>{rendered}</pre>
          )}
        </div>

        <div style={{
          display: "flex", alignItems: "center", justifyContent: "space-between",
          padding: "0.75rem 1.25rem", borderTop: "1px solid #e2e8f0",
          fontSize: "0.8rem", color: "#64748b",
        }}>
          <span>{preview.sections.length} sections &middot; ~{preview.wordCount} words</span>
          <div style={{ display: "flex", gap: "0.5rem" }}>
            <button onClick={handleCopy} style={{
              padding: "0.35rem 0.75rem", borderRadius: "0.375rem",
              border: "1px solid #d1d5db", background: copied ? "#dcfce7" : "#fff",
              cursor: "pointer", fontSize: "0.8rem", color: "#1e293b",
            }}>{copied ? "Copied!" : "Copy"}</button>
            <button onClick={handleDownload} style={{
              padding: "0.35rem 0.75rem", borderRadius: "0.375rem",
              border: "none", background: "#3b82f6", color: "#fff",
              cursor: "pointer", fontSize: "0.8rem", fontWeight: 600,
            }}>Download</button>
          </div>
        </div>
      </div>
    </div>
  );
}
