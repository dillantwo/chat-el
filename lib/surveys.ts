// Client-safe survey-template shapes and helpers. Do NOT import models here —
// that would pull mongoose into client bundles. The types below are structural
// copies of models/SurveyTemplate.ts; keep them in sync.

export const SURVEY_PHASES = ["pre", "post"] as const;
export type SurveyPhase = (typeof SURVEY_PHASES)[number];

export const PHASE_LABELS: Record<SurveyPhase, string> = { pre: "前測", post: "後測" };
export const DEFAULT_SLOT_TITLES: Record<SurveyPhase, string> = {
  pre: "前測問卷",
  post: "後測問卷",
};

/** What a document written before 類別 existed becomes when read. */
export const LEGACY_GROUP_NAME = "前測-後測";

export const MAX_GROUP_NAME_LENGTH = 60;
export const MAX_TITLE_LENGTH = 80;
export const MAX_DESCRIPTION_LENGTH = 500;
/** Caps high enough for any real course, low enough to keep one document small. */
export const MAX_GROUPS = 30;
export const MAX_SURVEYS_PER_GROUP = 20;

/** One questionnaire, as it crosses the wire. */
export interface SurveyItemDTO {
  phase: SurveyPhase;
  title: string;
  url: string;
  description: string;
  embed: boolean;
}

/**
 * One 類別 with its questionnaires, in the order students see them. A 類別 may
 * hold several 前測 and several 後測, or only one of either.
 */
export interface SurveyGroupDTO {
  name: string;
  surveys: SurveyItemDTO[];
}

/** Structural view of a stored template — no mongoose types, on purpose. */
interface StoredSlot {
  title?: string;
  url?: string;
  description?: string;
  embed?: boolean;
}

interface StoredGroup {
  name?: string;
  surveys?: (StoredSlot & { phase?: string })[] | null;
  /** @deprecated The pre/post pair a 類別 held before `surveys`. */
  pre?: StoredSlot | null;
  /** @deprecated See `pre`. */
  post?: StoredSlot | null;
}

interface StoredTemplate {
  groups?: StoredGroup[] | null;
  /** @deprecated The pair a template held before 類別 existed. */
  pre?: StoredSlot | null;
  /** @deprecated See `pre`. */
  post?: StoredSlot | null;
}

/** A questionnaire with no url is how "not set up" was stored; drop it. */
function toItem(slot: StoredSlot | null | undefined, phase: SurveyPhase): SurveyItemDTO | null {
  if (!slot?.url) return null;
  return {
    phase,
    title: slot.title || DEFAULT_SLOT_TITLES[phase],
    url: slot.url,
    description: slot.description ?? "",
    embed: slot.embed !== false,
  };
}

/** The questionnaires of one 類別, with the pre-`surveys` pair folded in. */
function groupSurveys(group: StoredGroup): SurveyItemDTO[] {
  if (group.surveys && group.surveys.length > 0) {
    return group.surveys
      .map((s) => toItem(s, s.phase === "post" ? "post" : "pre"))
      .filter((s): s is SurveyItemDTO => s !== null);
  }

  // 前測 first, which is the order the two fields were shown in.
  return SURVEY_PHASES.map((phase) => toItem(group[phase], phase)).filter(
    (s): s is SurveyItemDTO => s !== null,
  );
}

/**
 * The 類別 of a template, with documents that predate 類別 — and 類別 that predate
 * multiple questionnaires — folded into the current shape, so nothing configured
 * before an upgrade disappears.
 *
 * The legacy fields are only consulted when the newer one is empty, and a save
 * rewrites the whole list, so an admin who deletes a questionnaire does not get it
 * back from an older field.
 */
export function templateGroups(doc: StoredTemplate | null | undefined): SurveyGroupDTO[] {
  if (!doc) return [];

  if (doc.groups && doc.groups.length > 0) {
    return doc.groups.map((g) => ({ name: g.name ?? "", surveys: groupSurveys(g) }));
  }

  const surveys = SURVEY_PHASES.map((phase) => toItem(doc[phase], phase)).filter(
    (s): s is SurveyItemDTO => s !== null,
  );
  if (surveys.length === 0) return [];
  return [{ name: LEGACY_GROUP_NAME, surveys }];
}

/** A 類別 with nothing in it is a placeholder, not something to show a student. */
export function groupHasSurvey(group: SurveyGroupDTO): boolean {
  return group.surveys.length > 0;
}

/** How many questionnaires a template actually hands out, for the 範本 picker. */
export function countSurveys(groups: SurveyGroupDTO[]): number {
  return groups.reduce((n, g) => n + g.surveys.length, 0);
}
