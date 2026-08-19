import { useEffect, useState } from "react";
import {
  exchangeGithubCode,
  validateGithubToken,
  type GithubUser,
} from "../api/jobApi";
import "./GitHubLoginPage.css";

const CLIENT_ID = import.meta.env.VITE_GITHUB_CLIENT_ID as string | undefined;
const AUTHORIZE_URL = "https://github.com/login/oauth/authorize";
// Requested scopes for the OAuth App.
const SCOPE = "read:user user:email";
const STATE_KEY = "gh_oauth_state";
const CODE_KEY = "gh_oauth_code";
const TOKEN_KEY = "gh_oauth_token";
const USER_KEY = "gh_oauth_user";
// Must match the callback URL configured on the GitHub OAuth app exactly.
const CALLBACK_PATH = "/auth/callback";

function getRedirectUri(): string {
  return `${window.location.origin}${CALLBACK_PATH}`;
}

function randomState(): string {
  const bytes = new Uint8Array(16);
  crypto.getRandomValues(bytes);
  return Array.from(bytes, (b) => b.toString(16).padStart(2, "0")).join("");
}

export default function GitHubLoginPage() {
  const [code, setCode] = useState<string | null>(() =>
    sessionStorage.getItem(CODE_KEY),
  );
  const [token, setToken] = useState<string | null>(() =>
    sessionStorage.getItem(TOKEN_KEY),
  );
  const [user, setUser] = useState<GithubUser | null>(() => {
    const stored = sessionStorage.getItem(USER_KEY);
    return stored ? (JSON.parse(stored) as GithubUser) : null;
  });
  const [exchanging, setExchanging] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [stateOk, setStateOk] = useState<boolean | null>(null);

  // Exchange the authorization code for an access token via the backend,
  // then validate it to fetch the authenticated user and email.
  const exchange = async (authCode: string): Promise<void> => {
    setExchanging(true);
    setError(null);
    try {
      const result = await exchangeGithubCode({
        code: authCode,
        redirectUri: getRedirectUri(),
      });
      setToken(result.accessToken);
      sessionStorage.setItem(TOKEN_KEY, result.accessToken);

      const githubUser = await validateGithubToken({
        accessToken: result.accessToken,
      });
      setUser(githubUser);
      sessionStorage.setItem(USER_KEY, JSON.stringify(githubUser));
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setExchanging(false);
    }
  };

  // On return from GitHub the URL carries ?code=... (or ?error=...). Capture it.
  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const returnedCode = params.get("code");
    const returnedError = params.get("error");
    const returnedState = params.get("state");

    if (returnedError) {
      setError(params.get("error_description") || returnedError);
      return;
    }

    if (returnedCode) {
      const savedState = sessionStorage.getItem(STATE_KEY);
      setStateOk(savedState !== null && savedState === returnedState);
      setCode(returnedCode);
      sessionStorage.setItem(CODE_KEY, returnedCode);
      sessionStorage.removeItem(STATE_KEY);
      // Strip OAuth params and the callback path so a refresh doesn't reprocess them.
      window.history.replaceState({}, "", "/");
      void exchange(returnedCode);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const handleLogin = () => {
    if (!CLIENT_ID || CLIENT_ID === "your_client_id_here") {
      setError("VITE_GITHUB_CLIENT_ID is not set. Add it to your .env file.");
      return;
    }
    const state = randomState();
    sessionStorage.setItem(STATE_KEY, state);
    const url = new URL(AUTHORIZE_URL);
    url.searchParams.set("client_id", CLIENT_ID);
    url.searchParams.set("redirect_uri", getRedirectUri());
    url.searchParams.set("scope", SCOPE);
    url.searchParams.set("state", state);
    window.location.assign(url.toString());
  };

  const handleLogout = () => {
    sessionStorage.removeItem(CODE_KEY);
    sessionStorage.removeItem(STATE_KEY);
    sessionStorage.removeItem(TOKEN_KEY);
    sessionStorage.removeItem(USER_KEY);
    setCode(null);
    setToken(null);
    setUser(null);
    setStateOk(null);
    setError(null);
  };

  return (
    <div className="gh-login">
      <div className="gh-login__card">
        <h2 className="gh-login__title">GitHub Login Test</h2>
        <p className="gh-login__desc">
          Starts the GitHub OAuth authorization flow, then exchanges the
          returned authorization code for an access token via the backend (which
          holds the client secret).
        </p>

        <dl className="gh-login__meta">
          <dt>Client ID</dt>
          <dd>{CLIENT_ID || <em>not set</em>}</dd>
          <dt>Redirect URI</dt>
          <dd>{getRedirectUri()}</dd>
          <dt>Scope</dt>
          <dd>{SCOPE}</dd>
        </dl>

        <button className="gh-login__btn" onClick={handleLogin}>
          <svg
            width="18"
            height="18"
            viewBox="0 0 16 16"
            fill="currentColor"
            aria-hidden
          >
            <path d="M8 0C3.58 0 0 3.58 0 8c0 3.54 2.29 6.53 5.47 7.59.4.07.55-.17.55-.38 0-.19-.01-.82-.01-1.49-2.01.37-2.53-.49-2.69-.94-.09-.23-.48-.94-.82-1.13-.28-.15-.68-.52-.01-.53.63-.01 1.08.58 1.23.82.72 1.21 1.87.87 2.33.66.07-.52.28-.87.51-1.07-1.78-.2-3.64-.89-3.64-3.95 0-.87.31-1.59.82-2.15-.08-.2-.36-1.02.08-2.12 0 0 .67-.21 2.2.82.64-.18 1.32-.27 2-.27.68 0 1.36.09 2 .27 1.53-1.04 2.2-.82 2.2-.82.44 1.1.16 1.92.08 2.12.51.56.82 1.27.82 2.15 0 3.07-1.87 3.75-3.65 3.95.29.25.54.73.54 1.48 0 1.07-.01 1.93-.01 2.2 0 .21.15.46.55.38A8.01 8.01 0 0016 8c0-4.42-3.58-8-8-8z" />
          </svg>
          {code ? "Sign in again" : "Sign in with GitHub"}
        </button>

        {error && (
          <div className="gh-login__alert gh-login__alert--error">{error}</div>
        )}

        {code && (
          <div className="gh-login__result">
            <div className="gh-login__alert gh-login__alert--success">
              Login succeeded — authorization code received.
            </div>
            {stateOk === false && (
              <div className="gh-login__alert gh-login__alert--warn">
                Warning: OAuth state did not match (possible CSRF or stale
                session).
              </div>
            )}
            <label className="gh-login__label">Authorization code</label>
            <code className="gh-login__code">{code}</code>

            {exchanging && (
              <div className="gh-login__alert">
                Exchanging code for access token…
              </div>
            )}

            {token && (
              <>
                <label className="gh-login__label">Access token</label>
                <code className="gh-login__code">{token}</code>
              </>
            )}

            {user && (
              <div className="gh-login__user">
                {user.avatarUrl && (
                  <img
                    className="gh-login__avatar"
                    src={user.avatarUrl}
                    alt={`${user.login} avatar`}
                    width={48}
                    height={48}
                  />
                )}
                <div className="gh-login__user-info">
                  <span className="gh-login__user-name">
                    {user.name || user.login}
                  </span>
                  <span className="gh-login__user-login">@{user.login}</span>
                  <span className="gh-login__user-email">
                    {user.email || "(no public email)"}
                  </span>
                </div>
              </div>
            )}

            <button
              className="gh-login__btn gh-login__btn--logout"
              onClick={handleLogout}
            >
              Log out
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
