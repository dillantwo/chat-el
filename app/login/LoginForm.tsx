"use client";

import { useState, useTransition } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import {
  ArrowRight,
  BookText,
  Calculator,
  Check,
  Copy,
  FlaskConical,
  Languages,
  Loader2,
  ScrollText,
} from "lucide-react";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { useAuth } from "@/components/AuthProvider";
import { basePath } from "@/lib/utils";

const subjectHighlights = [
  {
    name: "數學科",
    description: "解題工具與即時回饋",
    icon: Calculator,
  },
  {
    name: "中國語文科",
    description: "閱讀理解與寫作引導",
    icon: BookText,
  },
  {
    name: "English Language",
    description: "Location and direction, Thank-you Letter, Reading Comprehension.",
    icon: Languages,
  },
  {
    name: "科學科",
    description: "電路、航天科技",
    icon: FlaskConical,
  },
  {
    name: "人文科",
    description: "水資源、抗日戰爭",
    icon: ScrollText,
  },
];

/**
 * Wording for the codes the EdConnect routes redirect back with. The codes
 * themselves are defined in lib/sso-redirect.ts; the callback deliberately sends
 * a code rather than a message so that nothing rendered here comes from the URL.
 */
const SSO_ERROR_MESSAGES: Record<string, string> = {
  sso_disabled: "EdCity 登入尚未啟用，請聯絡管理員。",
  sso_denied:
    "EdCity 拒絕了此次登入。常見原因是此應用尚未獲學校授權，請聯絡管理員。",
  sso_state: "登入連結已逾時或無效，請重新按 EdCity 登入。",
  sso_no_code: "EdCity 沒有回傳授權碼，請重新按 EdCity 登入。",
  sso_failed: "無法與 EdCity 完成驗證，請稍後再試。",
  sso_not_provisioned: "此 EdCity 帳戶尚未在本平台開通，請聯絡管理員。",
  sso_no_school: "此帳戶未綁定學校，請聯絡管理員。",
  sso_school_disabled: "所屬學校已停用，請聯絡管理員。",
};

/**
 * The identifier echoed back when no account matched.
 *
 * Worth the extra UI because an EdConnect account's identity is an opaque
 * profile_id that the student cannot look up anywhere — not in EdCity's own
 * interface, and not from us. Without showing it here, neither they nor the
 * administrator can say which account needs creating, and the only remaining
 * diagnostic is the server log.
 */
function ProfileIdHint({ value }: { value: string }) {
  const [copied, setCopied] = useState(false);

  async function copy() {
    try {
      await navigator.clipboard.writeText(value);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      // Clipboard access can be refused (insecure origin, permission). The
      // value is selectable text either way, so there is nothing to recover.
    }
  }

  return (
    <span className="mt-2 flex flex-wrap items-center gap-2">
      <span className="text-[#5a5a5a]">請提供此識別碼：</span>
      <code className="select-all rounded-[3px] bg-[#080808]/6 px-2 py-1 font-mono text-[13px] text-[#080808]">
        {value}
      </code>
      <button
        type="button"
        onClick={copy}
        aria-label="複製識別碼"
        className="inline-flex items-center gap-1 rounded-[3px] border border-[#d8d8d8] px-2 py-1 text-xs text-[#363636] transition-colors hover:bg-[#080808]/5 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#146ef5]"
      >
        {copied ? <Check className="size-3.5" /> : <Copy className="size-3.5" />}
        {copied ? "已複製" : "複製"}
      </button>
    </span>
  );
}

export function LoginForm({ ssoEnabled }: { ssoEnabled: boolean }) {
  const router = useRouter();
  const searchParams = useSearchParams();
  const { refreshUser } = useAuth();
  const [error, setError] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();
  const logoSrc = `${basePath}/logo.png`.replace(/\/+/g, "/");

  const from = searchParams.get("from") ?? "/";

  // Notices carried in the URL by the SSO round trip. Held in state so
  // submitting the password form clears them rather than leaving a stale
  // EdCity error above a fresh attempt.
  const [ssoErrorCode, setSsoErrorCode] = useState<string | null>(
    searchParams.get("error")
  );
  const [loggedOut, setLoggedOut] = useState(searchParams.get("loggedOut") === "1");
  const ssoErrorMessage = ssoErrorCode
    ? SSO_ERROR_MESSAGES[ssoErrorCode] ?? "EdCity 登入失敗，請重試或聯絡管理員。"
    : null;
  const unprovisionedRef =
    ssoErrorCode === "sso_not_provisioned" ? searchParams.get("ref") : null;

  // A top-level navigation, not a fetch: the browser has to be handed to
  // EdConnect and brought back, and an XHR would follow the redirect internally
  // and land EdConnect's login page HTML in a JSON parser.
  const ssoHref = `${basePath}/api/auth/sso/edconnect/start?from=${encodeURIComponent(from)}`;

  async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setError(null);
    setSsoErrorCode(null);
    setLoggedOut(false);

    const formData = new FormData(e.currentTarget);
    const username = formData.get("username") as string;
    const password = formData.get("password") as string;

    startTransition(async () => {
      try {
        const res = await fetch(`${basePath}/api/auth/login`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ username, password }),
        });

        if (!res.ok) {
          const data = await res.json();
          setError(data.error ?? "登錄失敗，請重試");
          return;
        }

        await refreshUser();
        router.push(from);
        router.refresh();
      } catch {
        setError("網絡錯誤，請重試");
      }
    });
  }

  return (
    <div className="relative min-h-screen overflow-x-hidden overflow-y-auto bg-white text-[#080808]">
      <div className="absolute inset-0 bg-[radial-gradient(circle_at_top_left,_rgba(20,110,245,0.1),_transparent_30%),radial-gradient(circle_at_85%_15%,_rgba(237,82,203,0.14),_transparent_24%),linear-gradient(180deg,_#ffffff_0%,_#f7f8fb_100%)]" />
      <div className="absolute left-0 top-0 h-40 w-40 -translate-x-1/3 -translate-y-1/4 rounded-full bg-[#146ef5]/10 blur-3xl" />
      <div className="absolute bottom-0 right-0 h-52 w-52 translate-x-1/4 translate-y-1/4 rounded-full bg-[#7a3dff]/10 blur-3xl" />

      <div className="relative mx-auto flex min-h-screen w-full max-w-7xl flex-col items-stretch px-4 py-6 sm:px-6 sm:py-10 xl:items-center xl:px-8">
        <div className="grid w-full overflow-hidden rounded-[8px] border border-[#d8d8d8] bg-white shadow-[0px_84px_24px_rgba(0,0,0,0),0px_54px_22px_rgba(0,0,0,0.01),0px_30px_18px_rgba(0,0,0,0.04),0px_13px_13px_rgba(0,0,0,0.08),0px_3px_7px_rgba(0,0,0,0.09)] xl:grid-cols-[1.15fr_0.85fr]">
          <section className="relative order-1 flex flex-col border-b border-[#d8d8d8] bg-[linear-gradient(135deg,_#ffffff_0%,_#f5f8ff_55%,_#ffffff_100%)] px-5 py-6 sm:px-8 sm:py-10 xl:border-b-0 xl:min-h-[720px] xl:border-r xl:px-12 xl:py-12">
            <div className="flex items-center gap-4">
              <div className="inline-flex items-center gap-2 sm:gap-3">
                <img
                  src={logoSrc}
                  alt="AI Learning Platform logo"
                  className="h-9 w-auto object-contain sm:h-11"
                />
                <p className="text-sm font-semibold tracking-[-0.02em] text-[#080808] sm:text-lg">
                  AI and Coding for Subject Learning
                </p>
              </div>
            </div>

            <div className="flex flex-1 flex-col justify-center xl:mt-16">
              <div className="max-w-xl">
                <h1 className="mt-6 text-[32px] leading-[1.02] font-semibold tracking-[-0.04em] text-[#080808] sm:mt-8 sm:text-[44px] sm:leading-[0.98] sm:tracking-[-0.05em] md:text-[56px] xl:mt-0 xl:text-[72px]">
                  進入你的 AI 學習平台
                </h1>
                <p className="mt-3 hidden max-w-lg text-sm leading-6 text-[#4d4d4d] sm:text-base sm:leading-7 md:text-lg xl:mt-5 xl:block">
                  從課堂內容、互動練習到 AI 工具建議，使用AI 工具提升學習效果。
                </p>
              </div>

              <div className="mt-6 hidden gap-3 sm:mt-10 sm:grid-cols-2 xl:grid">
                {subjectHighlights.map((subject) => {
                  const Icon = subject.icon;

                  return (
                    <div
                      key={subject.name}
                      className="rounded-[8px] border border-[#d8d8d8] bg-white/80 p-4 shadow-[0px_18px_40px_rgba(20,110,245,0.08)] backdrop-blur-sm transition duration-200 hover:-translate-y-1 hover:border-[#b9cdfa]"
                    >
                      <div className="flex items-start gap-3">
                        <div className="flex size-11 shrink-0 items-center justify-center rounded-[6px] bg-[#146ef5]/10 text-[#146ef5]">
                          <Icon className="size-5" />
                        </div>
                        <div>
                          <p className="text-base font-semibold text-[#080808]">
                            {subject.name}
                          </p>
                          <p className="mt-1 text-sm leading-6 text-[#5a5a5a]">
                            {subject.description}
                          </p>
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          </section>

          <section className="order-2 flex items-center bg-white px-5 py-6 sm:px-8 sm:py-10 xl:px-10">
            <div className="mx-auto w-full max-w-md">
              <div className="rounded-[8px] border border-[#d8d8d8] bg-white p-5 shadow-[0px_84px_24px_rgba(0,0,0,0),0px_54px_22px_rgba(0,0,0,0.01),0px_30px_18px_rgba(0,0,0,0.04),0px_13px_13px_rgba(0,0,0,0.08),0px_3px_7px_rgba(0,0,0,0.09)] sm:p-8">
                <div className="space-y-2 sm:space-y-3">
                  <p className="text-[12px] font-semibold uppercase tracking-[1.5px] text-[#146ef5]">
                    Member login
                  </p>
                  <h2 className="text-[26px] leading-[1.04] font-semibold tracking-[-0.04em] text-[#080808] sm:text-[32px]">
                    登錄並繼續使用
                  </h2>
                  <p className="text-sm leading-6 text-[#5a5a5a]">
                    請輸入帳戶資料以進入你的個人化學習空間。
                  </p>
                </div>

                {loggedOut && (
                  <p
                    role="status"
                    className="mt-5 rounded-[4px] border border-[#146ef5]/20 bg-[#146ef5]/6 px-4 py-3 text-sm text-[#0055d4]"
                  >
                    已登出，感謝使用。
                  </p>
                )}

                {ssoErrorMessage && (
                  <div
                    role="alert"
                    className="mt-5 rounded-[4px] border border-[#ee1d36]/20 bg-[#ee1d36]/7 px-4 py-3 text-sm text-[#ee1d36]"
                  >
                    {ssoErrorMessage}
                    {unprovisionedRef && <ProfileIdHint value={unprovisionedRef} />}
                  </div>
                )}

                <form onSubmit={handleSubmit} className="mt-6 space-y-4 sm:mt-8 sm:space-y-5">
                  <div className="space-y-2.5">
                    <label
                      htmlFor="username"
                      className="block text-[12px] font-semibold uppercase tracking-[1.2px] text-[#363636]"
                    >
                      用戶名
                    </label>
                    <Input
                      id="username"
                      name="username"
                      type="text"
                      autoComplete="username"
                      required
                      placeholder="輸入用戶名"
                      className="h-12 rounded-[4px] border-[#d8d8d8] bg-white px-4 text-[16px] text-[#080808] placeholder:text-[#ababab] focus-visible:border-[#146ef5] focus-visible:ring-[3px] focus-visible:ring-[#146ef5]/15"
                    />
                  </div>

                  <div className="space-y-2.5">
                    <label
                      htmlFor="password"
                      className="block text-[12px] font-semibold uppercase tracking-[1.2px] text-[#363636]"
                    >
                      密碼
                    </label>
                    <Input
                      id="password"
                      name="password"
                      type="password"
                      autoComplete="current-password"
                      required
                      placeholder="輸入密碼"
                      className="h-12 rounded-[4px] border-[#d8d8d8] bg-white px-4 text-[16px] text-[#080808] placeholder:text-[#ababab] focus-visible:border-[#146ef5] focus-visible:ring-[3px] focus-visible:ring-[#146ef5]/15"
                    />
                  </div>

                  {error && (
                    <p className="rounded-[4px] border border-[#ee1d36]/20 bg-[#ee1d36]/7 px-4 py-3 text-sm text-[#ee1d36]">
                      {error}
                    </p>
                  )}

                  <Button
                    type="submit"
                    size="lg"
                    disabled={isPending}
                    className="group h-12 w-full rounded-[4px] bg-[#146ef5] px-4 text-base font-medium text-white transition duration-200 hover:translate-x-[6px] hover:bg-[#0055d4] focus-visible:border-[#146ef5] focus-visible:ring-[3px] focus-visible:ring-[#146ef5]/20"
                  >
                    {isPending ? (
                      <>
                        <Loader2 size={16} className="animate-spin" />
                        登錄中…
                      </>
                    ) : (
                      <>
                        進入平台
                        <ArrowRight className="size-4 transition-transform duration-200 group-hover:translate-x-1" />
                      </>
                    )}
                  </Button>
                </form>

                {ssoEnabled && (
                  <div className="mt-6 sm:mt-7">
                    <div className="flex items-center gap-3">
                      <span className="h-px flex-1 bg-[#d8d8d8]" />
                      <span className="text-[12px] font-medium uppercase tracking-[1.2px] text-[#ababab]">
                        或
                      </span>
                      <span className="h-px flex-1 bg-[#d8d8d8]" />
                    </div>

                    <a
                      href={ssoHref}
                      className="mt-5 flex w-full items-center justify-center rounded-[4px] border border-[#d8d8d8] bg-white p-2 transition duration-200 hover:border-[#b9cdfa] hover:shadow-[0px_10px_24px_rgba(20,110,245,0.12)] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#146ef5]"
                    >
                      <img
                        src={`${basePath}/edcity/EdConnect%20Login%20Button_Chi.png`}
                        alt="使用 EdCity 帳戶登入"
                        className="h-11 w-auto max-w-full object-contain"
                      />
                    </a>

                    <p className="mt-3 text-xs leading-5 text-[#5a5a5a]">
                      學校帳戶請使用 EdCity 登入，無需在此輸入用戶名和密碼。
                    </p>
                  </div>
                )}
              </div>
            </div>
          </section>
        </div>
      </div>
    </div>
  );
}
