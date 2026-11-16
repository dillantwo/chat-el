import { defineCopy } from "./config";

/** Strings shared by many screens. Page-specific copy stays in the page's own file. */
export const COMMON_COPY = defineCopy({
  "zh-Hant": {
    back: "返回",
    logout: "登出",
    announcements: "公告",
    loading: "載入中…",
    roles: { admin: "管理員", teacher: "教師", student: "學生" } as Record<string, string>,
    user: "用戶",
    languageSwitch: "切換語言",
    subjects: {
      math: "數學科",
      chinese: "中國語文科",
      english: "英國語文科",
      science: "科學科",
      humanities: "人文科",
    } as Record<string, string>,
  },
  en: {
    back: "Back",
    logout: "Log out",
    announcements: "Announcements",
    loading: "Loading…",
    roles: { admin: "Admin", teacher: "Teacher", student: "Student" },
    user: "User",
    languageSwitch: "Change language",
    subjects: {
      math: "Mathematics",
      chinese: "Chinese Language",
      english: "English Language",
      science: "Science",
      humanities: "Humanities",
    },
  },
});
