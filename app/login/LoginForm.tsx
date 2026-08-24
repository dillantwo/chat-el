"use client";

import { useState, useTransition } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import {
  BookOpen,
  Calculator,
  Check,
  Copy,
  Eye,
  EyeOff,
  FlaskConical,
  Globe,
  Landmark,
  Loader2,
  Lock,
  User as UserIcon,
} from "lucide-react";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { useAuth } from "@/components/AuthProvider";
import { basePath } from "@/lib/utils";

/**
 * Sized and worded for primary-school pupils, which changes the numbers rather
 * than the layout: every target here is at least 48px and the main ones are 56,
 * because young children's fine motor control lags well behind adults', and no
 * copy sits below 14px, because children need a larger default than the 12px an
 * adult audience tolerates. The visual style is the sticker-and-hard-shadow
 * language already used by the subject tiles on the home page, so the screen a
 * pupil lands on after logging in looks like the one they logged in from.
 *
 * Icons carry the same information as the labels throughout: children scan
 * rather than read, and the youngest barely read at all.
 */

/** The same five subjects, icons and accent colours as the tiles in app/page.tsx.
 *  Purely identity — no labels, no links — so the row stays a decoration a
 *  six-year-old recognises rather than another thing to parse. */
const subjectStickers = [
  { name: "數學科", icon: Calculator, color: "#146ef5", tilt: "-rotate-6" },
  { name: "中國語文科", icon: BookOpen, color: "#7a3dff", tilt: "rotate-3" },
  { name: "英國語文科", icon: Globe, color: "#00a81b", tilt: "-rotate-2" },
  { name: "科學科", icon: FlaskConical, color: "#ff6b00", tilt: "rotate-6" },
  { name: "人文科", icon: Landmark, color: "#ed52cb", tilt: "-rotate-3" },
];

/** Dotted practice-paper texture. Cheap in CSS, survives any viewport, and reads
 *  as a school exercise book instead of as decoration for its own sake. */
const DOTTED_PAPER: React.CSSProperties = {
  backgroundImage: "radial-gradient(rgba(8,8,8,0.11) 1.5px, transparent 1.5px)",
  backgroundSize: "22px 22px",
};

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
      <span>EdCity 帳戶：</span>
      <code className="select-all rounded-[6px] bg-white px-2 py-1 font-mono text-[14px] text-[#080808]">
        {value}
      </code>
      <button
        type="button"
        onClick={copy}
        aria-label="複製號碼"
        className="inline-flex h-9 items-center gap-1 rounded-[8px] border-2 border-[#080808]/15 bg-white px-3 text-sm font-medium text-[#363636] transition-colors hover:bg-[#f3f3f3] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#146ef5]"
      >
        {copied ? <Check className="size-4" /> : <Copy className="size-4" />}
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
  const [showPassword, setShowPassword] = useState(false);
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

  // Failures where the answer is "not this EdCity account". Retrying with the
  // same one cannot succeed, and EdConnect is an SSO — with its session still
  // live, authorize signs the same person straight back in without prompting, so
  // the button would appear to do nothing and land on this error again. `renew`
  // makes the start route end the EdConnect session first.
  //
  // The transient codes (sso_state, sso_no_code, sso_failed) are deliberately
  // absent: there the account is fine and the flow broke, so plain retry is the
  // right move and logging the user out of every other EdCity service is not.
  const needsRenew =
    ssoErrorCode !== null &&
    ["sso_not_provisioned", "sso_no_school", "sso_school_disabled", "sso_denied"].includes(
      ssoErrorCode
    );

  // A top-level navigation, not a fetch: the browser has to be handed to
  // EdConnect and brought back, and an XHR would follow the redirect internally
  // and land EdConnect's login page HTML in a JSON parser.
  const ssoHref =
    `${basePath}/api/auth/sso/edconnect/start?from=${encodeURIComponent(from)}` +
    (needsRenew ? "&renew=1" : "");

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

  // 56px tall with a 2px border: a comfortable tap target for a child, and the
  // border stays visible enough to show where the box is without a filled
  // background. Text is 17px so a pupil can proof-read what they typed.
  const fieldClass =
    "h-14 rounded-[10px] border-2 border-[#080808]/18 bg-white pl-12 text-[17px] text-[#080808] transition-colors focus-visible:border-[#146ef5] focus-visible:ring-[3px] focus-visible:ring-[#146ef5]/20 aria-invalid:border-[#d81f2e] aria-invalid:ring-[3px] aria-invalid:ring-[#d81f2e]/15";

  return (
    // The scroll container: app/layout.tsx puts `overflow-hidden` on <body>, so a
    // page that wants to scroll on a short viewport has to own the scrolling.
    <div className="h-full overflow-y-auto bg-[#fdf6e9] text-[#080808]">
      <div aria-hidden className="pointer-events-none fixed inset-0" style={DOTTED_PAPER} />

      <div className="relative flex min-h-full items-center justify-center px-4 py-8 sm:px-6 sm:py-12">
        {/* Hard offset shadow rather than a soft blur: it is the same treatment
            as the subject tiles on the home page, and it makes the card read as
            a solid object a child can aim at. */}
        <div className="w-full max-w-[460px] rounded-[16px] border-2 border-[#080808] bg-white p-6 shadow-[8px_8px_0px_#080808] sm:p-8">
          {/* The logo file is 559x304 with a solid white background, so it needs
              no clipping on this white card, and even at 56px it is still being
              downscaled from its native height — no softening. Intrinsic width
              and height are declared so the card does not jump while it loads. */}
          <div className="flex items-center gap-3">
            <img
              src={logoSrc}
              alt=""
              width={559}
              height={304}
              className="h-12 w-auto object-contain sm:h-14"
            />
            {/* Reads as the product's name, so it is set near-black and bold
                rather than as grey supporting text. It stays well under the 30px
                歡迎回來 heading, so the order of importance is unchanged. */}
            <p className="text-[17px] font-bold leading-[1.3] tracking-[-0.01em] text-[#080808] sm:text-[18px]">
              AI for Subject Learning
            </p>
          </div>

          {/* Tilted so the row looks placed by hand rather than laid out on a
              grid. Decorative, hence aria-hidden with the names as titles only
              for anyone hovering. */}
          <ul aria-hidden className="mt-6 flex items-center gap-2.5">
            {subjectStickers.map(({ name, icon: Icon, color, tilt }) => (
              <li key={name}>
                <span
                  title={name}
                  className={`flex size-11 items-center justify-center rounded-[10px] border-2 border-[#080808] text-white shadow-[3px_3px_0px_#080808] ${tilt}`}
                  style={{ backgroundColor: color }}
                >
                  <Icon className="size-5" strokeWidth={2.5} />
                </span>
              </li>
            ))}
          </ul>

          <h1 className="mt-6 text-[30px] leading-[1.15] font-bold tracking-[-0.01em] sm:text-[34px]">
            歡迎回來！
          </h1>
          <p className="mt-2 text-[16px] leading-7 text-[#4d4d4d]">
            輸入用戶名和密碼，就可以開始學習！！！
          </p>

          {loggedOut && (
            <p
              role="status"
              className="mt-6 rounded-[10px] border-2 border-[#146ef5]/35 bg-[#eff5ff] px-4 py-3 text-[15px] leading-6 text-[#0b4fbd]"
            >
              你已經登出了，下次再見！
            </p>
          )}

          {ssoErrorMessage && (
            <div
              role="alert"
              className="mt-6 rounded-[10px] border-2 border-[#d81f2e]/35 bg-[#fdf0f1] px-4 py-3 text-[15px] leading-6 text-[#a8121f]"
            >
              {ssoErrorMessage}
              {unprovisionedRef && <ProfileIdHint value={unprovisionedRef} />}
            </div>
          )}

          {/* EdCity first, because for a school that has SSO switched on it is
              the method most pupils will use, and the one that asks them to
              remember nothing. The password form stays fully visible below
              rather than behind a "more options" step. */}
          {ssoEnabled && (
            <section
              aria-labelledby="sso-heading"
              className="mt-6 rounded-[12px] bg-[#eef4ff] p-4"
            >
              <h2 id="sso-heading" className="text-[16px] font-semibold text-[#080808]">
                {needsRenew
                  ? "想用另一個 EdCity 帳戶？"
                  : "eLAFP計劃請用EdCity賬戶登入"}
              </h2>
              {/* When the last attempt failed on identity, the button no longer
                  does what the child just saw it do: it leaves EdCity first and
                  asks for the account again. Saying so avoids the reading that
                  the button is broken — which is exactly how it looks when
                  EdConnect's session makes the round trip invisible. */}
              <p className="mt-1 text-[15px] leading-6 text-[#4d4d4d]">
                {needsRenew
                  ? "按一下下面的按鈕，會先離開 EdCity，然後請你重新輸入 EdCity 帳戶。"
                  : "按一下下面的按鈕就可以進入。"}
              </p>

              {/* The supplied EdConnect artwork is already a finished button:
                  it carries its own border, its own grey fill and transparent
                  rounded corners. It is used at full width and unaltered — the
                  bordered box that used to wrap it drew a second edge around the
                  first and squeezed the image to 40px tall. At the card's width
                  the same asset is roughly 84px tall, which is a far easier
                  target for a child than the old 56px row.

                  The tinted panel does the grouping the border was failing at,
                  and has no stroke of its own so nothing competes with the
                  button's edge. */}
              <a
                href={ssoHref}
                className="mt-3 block rounded-[10px] transition-transform hover:-translate-y-[1px] active:translate-y-[1px] focus-visible:outline-3 focus-visible:outline-offset-3 focus-visible:outline-[#146ef5]"
              >
                <img
                  src={`${basePath}/edcity/EdConnect%20Login%20Button_Chi.png`}
                  alt="使用 EdCity 帳戶登入"
                  width={351}
                  height={74}
                  className="h-auto w-full"
                />
              </a>
            </section>
          )}

          {ssoEnabled && (
            <div className="mt-6 flex items-center gap-3">
              <span className="h-0.5 flex-1 rounded bg-[#ececec]" />
              <span className="text-[14px] font-medium text-[#5a5a5a]">
                或者用用戶名和密碼
              </span>
              <span className="h-0.5 flex-1 rounded bg-[#ececec]" />
            </div>
          )}

          <form onSubmit={handleSubmit} className="mt-6 space-y-5">
            <div className="space-y-2">
              <label
                htmlFor="username"
                className="block text-[16px] font-semibold text-[#080808]"
              >
                用戶名
              </label>
              <div className="relative">
                {/* The icon repeats what the label says, for pupils who scan the
                    shapes instead of reading the two fields. */}
                <span
                  aria-hidden
                  className="pointer-events-none absolute inset-y-0 left-0 flex w-12 items-center justify-center text-[#767676]"
                >
                  <UserIcon className="size-5" strokeWidth={2.25} />
                </span>
                <Input
                  id="username"
                  name="username"
                  type="text"
                  autoComplete="username"
                  required
                  aria-invalid={error ? true : undefined}
                  aria-describedby={error ? "login-error" : undefined}
                  className={fieldClass}
                />
              </div>
            </div>

            <div className="space-y-2">
              <label
                htmlFor="password"
                className="block text-[16px] font-semibold text-[#080808]"
              >
                密碼
              </label>
              <div className="relative">
                <span
                  aria-hidden
                  className="pointer-events-none absolute inset-y-0 left-0 flex w-12 items-center justify-center text-[#767676]"
                >
                  <Lock className="size-5" strokeWidth={2.25} />
                </span>
                <Input
                  id="password"
                  name="password"
                  type={showPassword ? "text" : "password"}
                  autoComplete="current-password"
                  required
                  aria-invalid={error ? true : undefined}
                  aria-describedby={error ? "login-error" : undefined}
                  className={`${fieldClass} pr-14`}
                />
                {/* Mistyped passwords are the main reason a child cannot get in,
                    so the reveal is a full 56x56 target rather than a small icon,
                    and stays a real button so it works from the keyboard. */}
                <button
                  type="button"
                  onClick={() => setShowPassword((v) => !v)}
                  aria-label={showPassword ? "隱藏密碼" : "顯示密碼"}
                  className="absolute inset-y-0 right-0 flex w-14 items-center justify-center rounded-r-[8px] text-[#5a5a5a] transition-colors hover:text-[#080808] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#146ef5]"
                >
                  {showPassword ? (
                    <EyeOff className="size-5" strokeWidth={2.25} />
                  ) : (
                    <Eye className="size-5" strokeWidth={2.25} />
                  )}
                </button>
              </div>
            </div>

            {/* Tied to both fields by id so a screen reader reads the reason with
                the input. The second line is the part that matters for a child:
                children are poor at interpreting an error on their own, so the
                message says what to do next, not just what went wrong. */}
            {error && (
              <div
                id="login-error"
                role="alert"
                className="rounded-[10px] border-2 border-[#d81f2e]/35 bg-[#fdf0f1] px-4 py-3 text-[15px] leading-6 text-[#a8121f]"
              >
                <p className="font-semibold">{error}</p>
                <p className="mt-1 text-[#8a3038]">
                  慢慢再試一次，可以按右邊的眼睛圖示看看密碼有沒有打錯。
                </p>
              </div>
            )}

            {/* The shadow shrinks as the button is pressed, so a tap looks like
                it pushed something down. Children judge fast and want to see
                that their action registered. */}
            <Button
              type="submit"
              size="lg"
              disabled={isPending}
              className="h-14 w-full rounded-[10px] border-2 border-[#080808] bg-[#146ef5] text-[18px] font-bold text-white shadow-[4px_4px_0px_#080808] transition-all hover:bg-[#0b57ce] active:translate-x-[2px] active:translate-y-[2px] active:shadow-[2px_2px_0px_#080808] disabled:opacity-70 focus-visible:ring-[3px] focus-visible:ring-[#146ef5]/35"
            >
              {isPending ? (
                <>
                  <Loader2 size={20} className="animate-spin" />
                  登入中…
                </>
              ) : (
                "登入"
              )}
            </Button>
          </form>
        </div>
      </div>
    </div>
  );
}
