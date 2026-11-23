# Bot protection

How a public form is protected from bots with Cloudflare Turnstile. A public form is an endpoint anyone can call without signing in that creates something: a contact form, a sign-up, a lead. Rate limits and the WAF already protect every endpoint; Turnstile adds a check that a person sent the form.

## 1. How it works

1. The front end renders the Turnstile widget. Most people see nothing or a checkbox, and the widget gives the page a token.
2. The front end sends the form with the token in the header `X-Turnstile-Token`.
3. The API's filter asks Cloudflare's siteverify whether the token is valid, before the handler runs. A token is valid once, for five minutes.

| The filter gets | It answers |
| --- | --- |
| No token | 400 *Bot check required* |
| A token Cloudflare refuses (expired, used, forged) | 403 *Bot check failed* |
| No secret key, or siteverify can't be reached | 503 *Bot check unavailable* |
| A valid token | The handler runs |

It **fails closed**: without a secret key, every request to a protected endpoint is refused, so a missing setting never lets a form through unchecked.

## 2. Protect an endpoint

```csharp
group.MapPost("/leads", CreateLead)
    .AllowAnonymous()
    .RequireTurnstile();
```

`RequireTurnstile()` is in `Trislab.Framework.Web.BotProtection`; it adds the filter and a marker (`TurnstileProtectedEndpointMetadata`) so a test can list the protected endpoints. The check works in both tenancy modes.

In the front end, with `@trislabcompany/framework-ui`:

```tsx
import { TURNSTILE_HEADER, Turnstile } from "@trislabcompany/framework-ui";

const [token, setToken] = useState<string | null>(null);

<Turnstile siteKey={config.PUBLIC_TURNSTILE_SITE_KEY} language={i18n.language} onToken={setToken}
  unavailableText={t("botCheck.unavailable")} />
<button disabled={!token} onClick={() => apiFetch("/api/v1/leads", { method: "POST", headers: { [TURNSTILE_HEADER]: token! }, body })}>
```

When the widget can't load (a blocked script, offline), the component shows `unavailableText` with `role="alert"`, so the form never fails silently.

## 3. Keys and settings

| Setting | Where | Value |
| --- | --- | --- |
| `TURNSTILE_SECRET_KEY` | `api`, the stamp secret `turnstile-secret-key` | The widget's secret; mapped onto `TurnstileOptions:SecretKey` |
| `PUBLIC_TURNSTILE_SITE_KEY` | the front end, `apps[].env` | The widget's site key, read from `/config.json` |

The platform creates one widget per environment of a product with `turnstile: true` in `catalog/products.yaml` (`tl-cloud-infrastructure`), for its hostnames, and delivers both keys.

**Locally and in tests** the keys are Cloudflare's test keys: `appsettings.Development.json` sets the secret that passes every token (`TurnstileOptions.TestSecretThatPasses`), and the front end uses `TURNSTILE_TEST_SITE_KEY`. A test that must see a refusal uses `TurnstileOptions.TestSecretThatFails`. Never add a switch that turns the check off.

`TurnstileOptions` also has `HeaderName` (default `X-Turnstile-Token`), `VerifyUrl` and `Timeout` (10 seconds).
