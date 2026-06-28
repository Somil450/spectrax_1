import type { ReportData, ReportTemplate, TemplateType, ExportFormat } from "../types/report";
import { executiveTemplate } from "./reportTemplates/executiveTemplate";
import { technicalTemplate } from "./reportTemplates/technicalTemplate";
import { complianceTemplate } from "./reportTemplates/complianceTemplate";

const TEMPLATE_REGISTRY: Record<TemplateType, ReportTemplate> = {
  executive: executiveTemplate,
  technical: technicalTemplate,
  compliance: complianceTemplate,
};

const DEFAULT_DATA: ReportData = {
  session: {
    exerciseName: "Unknown Exercise",
    reps: 0,
    totalReps: 0,
    correctReps: 0,
    accuracy: 0,
    duration: 0,
    totalScore: 0,
    totalFrames: 0,
    mistakes: {},
    bestStreak: 0,
    calories: 0,
    gainedXp: 0,
    timestamp: Date.now(),
  },
};

function fillMissing(data: ReportData): ReportData {
  const session = { ...DEFAULT_DATA.session };
  if (data.session) {
    for (const [key, value] of Object.entries(data.session)) {
      if (value !== undefined && value !== null) {
        (session as any)[key] = value;
      }
    }
  }
  return { ...DEFAULT_DATA, ...data, session };
}

export class ReportEngine {
  listTemplates(): ReportTemplate[] {
    return Object.values(TEMPLATE_REGISTRY);
  }

  getTemplate(type: TemplateType): ReportTemplate {
    const template = TEMPLATE_REGISTRY[type];
    if (!template) {
      throw new Error(`Unknown template type: "${type}". Valid types: ${Object.keys(TEMPLATE_REGISTRY).join(", ")}`);
    }
    return template;
  }

  render(
    data: ReportData,
    templateType: TemplateType,
    format: ExportFormat = "html",
  ): string {
    const template = this.getTemplate(templateType);
    const safeData = fillMissing(data);

    if (!template.supportedFormats.includes(format)) {
      const supported = template.supportedFormats.join(", ");
      throw new Error(
        `Format "${format}" is not supported by template "${templateType}". Supported formats: ${supported}`,
      );
    }

    return template.render(safeData, format);
  }

  getPreview(
    data: ReportData,
    templateType: TemplateType,
  ): { html: string; wordCount: number; sections: string[] } {
    const rendered = this.render(data, templateType, "html");
    const sections = rendered.match(/<h[12][^>]*>.*?<\/h[12]>/g)?.map((h) => h.replace(/<[^>]+>/g, "")) ?? [];

    return {
      html: rendered,
      wordCount: rendered.replace(/<[^>]+>/g, "").split(/\s+/).filter(Boolean).length,
      sections,
    };
  }

  validate(templateType: TemplateType): { valid: boolean; supportedFormats: ExportFormat[]; errors: string[] } {
    try {
      const template = this.getTemplate(templateType);
      const errors: string[] = [];

      for (const format of template.supportedFormats) {
        try {
          const result = template.render(DEFAULT_DATA, format);
          if (!result || result.trim().length === 0) {
            errors.push(`Empty output for format "${format}"`);
          }
        } catch (e) {
          errors.push(`Render failed for format "${format}": ${e instanceof Error ? e.message : String(e)}`);
        }
      }

      return { valid: errors.length === 0, supportedFormats: template.supportedFormats, errors };
    } catch (e) {
      return {
        valid: false,
        supportedFormats: [],
        errors: [e instanceof Error ? e.message : String(e)],
      };
    }
  }
}

export const reportEngine = new ReportEngine();
