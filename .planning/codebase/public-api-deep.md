# Postiz Public API — Deep Reference for External Server-Side Agent

> **Purpose:** Definitive map of what an external automation can do against a Postiz instance via HTTP. Source-quoted, line-cited. This document is load-bearing for the simplified architecture: external server runs the AI; Postiz becomes pure UI + posting bridge.
>
> **Version basis:** code at `/Users/lukas/Desktop/Coding/postiz-husatech/` as of 2026-04-30.

---

## 0. Surface area at a glance

There are **three relevant HTTP namespaces** in the backend:

| Prefix | Auth | Purpose | Module |
|---|---|---|---|
| `/public/v1/*` | `Authorization: <api_key>` or `Authorization: pos_<token>` | The "Public API" — the agent's primary surface | `apps/backend/src/public-api/public.api.module.ts` |
| `/public/*` (no `v1`) | **None** (unauthenticated) | A handful of public read/track endpoints | `apps/backend/src/api/routes/public.controller.ts` |
| `/api/*` (everything else, no prefix) | Cookie/header JWT (`auth`) | The internal UI API — full feature set | `apps/backend/src/api/api.module.ts` |

There is **no global path prefix**. Routes mount as written in `@Controller(...)`. See `apps/backend/src/main.ts:69-72` — no `setGlobalPrefix(...)` call.

The Swagger doc is at `/docs` (`libraries/helpers/src/swagger/load.swagger.ts:12`).

---

## 1. Authentication

### 1.1 Auth middleware for `/public/v1/*`

`apps/backend/src/services/auth/public.auth.middleware.ts:13-63`

```ts
async use(req: Request, res: Response, next: NextFunction) {
  const auth = (req.headers.authorization ||
    req.headers.Authorization) as string;
  if (!auth) {
    res.status(HttpStatus.UNAUTHORIZED).json({ msg: 'No API Key found' });
    return;
  }
  try {
    if (auth.startsWith('pos_')) {
      const authorization = await this._oauthService.getOrgByOAuthToken(auth);
      ...
      // @ts-ignore
      req.org = { ...org, users: [{ users: { role: 'SUPERADMIN' } }] };
    } else {
      const org = await this._organizationService.getOrgByApiKey(auth);
      ...
      req.org = { ...org, users: [{ users: { role: 'SUPERADMIN' } }] };
    }
  } ...
}
```

**Header name:** `Authorization`. **Value is the raw token, NOT `Bearer <token>`** — there is no `Bearer ` prefix logic. The middleware reads `req.headers.authorization` and dispatches by prefix:

- Starts with `pos_` → treated as OAuth access token → looked up via `OAuthService.getOrgByOAuthToken`
- Anything else → treated as raw API key → looked up via `OrganizationService.getOrgByApiKey`

**Both auth modes resolve to an Organization** and set `req.org`. The middleware injects a synthetic SUPERADMIN role (`req.org = { ...org, users: [{ users: { role: 'SUPERADMIN' } }] }`) so policy guards never block. This means **API key holders effectively act as org-level superadmins via the public API**, regardless of the underlying user's actual role.

A subscription check is enforced if `STRIPE_SECRET_KEY` is set: `if (!!process.env.STRIPE_SECRET_KEY && !org.subscription)` returns 401. In our self-hosted instance without Stripe, this is bypassed.

### 1.2 API key generation & storage

API key is a column on `Organization`:

`libraries/nestjs-libraries/src/database/prisma/schema.prisma:11-50` (Organization model with `apiKey String?` at line 15 and `@@index([apiKey])` at line 47).

Created by `OrganizationRepository.createOrgAndUser` and friends, e.g. `libraries/nestjs-libraries/src/database/prisma/organizations/organization.repository.ts:269`:

```ts
apiKey: AuthService.fixedEncryption(makeId(20)),
```

So the stored value is `fixedEncryption(makeId(20))` — a 20-char random ID run through symmetric `fixedEncryption`. The plaintext that the user actually sends in `Authorization` header **is the encrypted form already** (lookup is `findFirst({ where: { apiKey: api } })` at line 56-58 — direct comparison, no decryption on read).

**Lookup**: `libraries/nestjs-libraries/src/database/prisma/organizations/organization.repository.ts:55-70`:

```ts
getOrgByApiKey(api: string) {
  return this._organization.model.organization.findFirst({
    where: { apiKey: api },
    include: { subscription: { ... } },
  });
}
```

**Rotation:** `apps/backend/src/api/routes/users.controller.ts:161-165`:

```ts
@Post('/api-key/rotate')
@CheckPolicies([AuthorizationActions.Create, Sections.ADMIN])
async rotateApiKey(@GetOrgFromRequest() organization: Organization) {
  return this._orgService.updateApiKey(organization.id);
}
```

**Where the user sees it (UI):** `apps/backend/src/api/routes/users.controller.ts:92` — `GET /user/self` returns the field `publicApi` containing the raw apiKey, but only for SUPERADMIN/ADMIN of the org:

```ts
publicApi: organization?.users[0]?.role === 'SUPERADMIN' || organization?.users[0]?.role === 'ADMIN' ? organization?.apiKey : '',
```

**Scope:** **per-organization**, NOT per-user. There is exactly one apiKey per org, shared by all admins. Auto-created if missing on login (`apps/backend/src/services/auth/auth.middleware.ts:89-91`).

### 1.3 OAuth `pos_*` tokens

`libraries/nestjs-libraries/src/database/prisma/oauth/oauth.service.ts:103-155` — OAuth 2.0 authorization-code flow. Code 32 chars (10 min TTL), token format `pos_` + 40-char makeId, encrypted at rest:

```ts
const token = 'pos_' + makeId(40);
const encryptedToken = AuthService.fixedEncryption(token);
```

Returned envelope: `{ id: organizationId, cus: paymentId, access_token: token, token_type: 'bearer' }`.

**Scope:** like API keys, OAuth tokens map to `(organizationId, userId)` (see `OAuthAuthorization` model `libraries/nestjs-libraries/src/database/prisma/schema.prisma:865-887`), but middleware also injects synthetic SUPERADMIN role, so effectively also full org-level access.

**No scopes/permissions** are encoded in tokens. **No refresh** flow — token has no `expiresAt` column, only `revokedAt`. To revoke, UI calls `DELETE /user/approved-apps/:id` (`apps/backend/src/api/routes/approved-apps.controller.ts`). Once issued the token lives forever until the user revokes.

OAuth app registration endpoints (UI-only, JWT-auth required, NOT public):

| Endpoint | Purpose |
|---|---|
| `GET /user/oauth-app` | Get current org's app |
| `POST /user/oauth-app` | Create app (returns `clientId=pca_<32>`, `clientSecret=pcs_<48>`) |
| `PUT /user/oauth-app` | Update |
| `DELETE /user/oauth-app` | Soft-delete + revoke all tokens |
| `POST /user/oauth-app/rotate-secret` | Rotate secret |
| `GET /oauth/authorize?client_id=...` | Get app metadata for consent screen |
| `POST /oauth/authorize` (auth required) | User approves → returns `redirect` URL with `code` |
| `POST /oauth/token` | Exchange code for `pos_*` token (no auth) |

The `POST /oauth/token` body is validated by `TokenExchangeDto` and only `grant_type === 'authorization_code'` is supported (`apps/backend/src/api/routes/oauth.controller.ts:43-48`).

### 1.4 Rate limiting (Throttler)

`apps/backend/src/app.module.ts:35-43`:

```ts
ThrottlerModule.forRoot({
  throttlers: [
    { ttl: 3600000,
      limit: process.env.API_LIMIT ? Number(process.env.API_LIMIT) : 30, },
  ],
  storage: new ThrottlerStorageRedisService(ioRedis),
}),
```

Default: **30 requests / hour** per tracker key. Override via env `API_LIMIT`.

**Throttle is gated to a single endpoint family**: `libraries/nestjs-libraries/src/throttler/throttler.provider.ts:7-17`:

```ts
public override async canActivate(context): Promise<boolean> {
  const { url, method } = context.switchToHttp().getRequest<Request>();
  if (method === 'POST' && url.includes('/public/v1/posts')) {
    return super.canActivate(context);
  }
  return true;
}
```

So **only `POST /public/v1/posts` is rate-limited**. Every other public-API endpoint (uploads, GETs, deletes, status changes) is NOT throttled by Postiz itself.

Tracker key: `req.org.id + '_' + (req.url.indexOf('/posts') > -1 ? 'posts' : 'other')` — bucket per org per URL family.

### 1.5 Per-call telemetry

Every `/public/v1/*` handler increments a Sentry counter via `Sentry.metrics.count('public_api-request', 1)`. The `POST /public/v1/posts` handler additionally calls `Sentry.metrics.count('post_created', 1)` (`libraries/nestjs-libraries/src/database/prisma/posts/posts.service.ts:769`).

---

## 2. Exhaustive endpoint catalog — `/public/v1/*`

Source: `apps/backend/src/public-api/routes/v1/public.integrations.controller.ts:64`:

```ts
@Controller('/public/v1')
export class PublicIntegrationsController {
```

Every handler below is in this single file. Line numbers are quoted.

### 2.1 Media

#### `POST /public/v1/upload` — multipart upload

`public.integrations.controller.ts:76-94`:

```ts
@Post('/upload')
@UseInterceptors(FileInterceptor('file'))
@UsePipes(new CustomFileValidationPipe())
async uploadSimple(
  @GetOrgFromRequest() org: Organization,
  @UploadedFile('file') file: Express.Multer.File
) {
  Sentry.metrics.count('public_api-request', 1);
  if (!file) {
    throw new HttpException({ msg: 'No file provided' }, 400);
  }
  const getFile = await this.storage.uploadFile(file);
  return this._mediaService.saveFile(
    org.id, getFile.originalname, getFile.path
  );
}
```

- **Body:** `multipart/form-data`, field name `file`.
- **Validation:** `CustomFileValidationPipe` (`libraries/nestjs-libraries/src/upload/custom.upload.validation.ts:9-67`). Allowed MIME (file-type-sniffed from buffer, NOT trusted from client header):
  - `image/jpeg`, `image/png`, `image/gif`, `image/webp`, `image/avif`, `image/bmp`, `image/tiff`
  - `video/mp4`
- **Size limits:** images **10 MB**, videos **1 GB** (`getMaxSize` lines 58-66).
- **Filename safety:** the original filename is sanitised: `safeBase = (originalname).replace(/\.[^./\\]*$/, '').replace(/[\\/]/g, '_').slice(0, 100) || 'upload'` then `${safeBase}.${detected.ext}` (lines 49-53).
- **Storage backend:** `UploadFactory.createStorage()` (`libraries/nestjs-libraries/src/upload/upload.factory.ts:5-25`) — switches on `STORAGE_PROVIDER` env: `local` → `LocalStorage(UPLOAD_DIRECTORY)` or `cloudflare` → R2-style.
- **Response:** `MediaService.saveFile` → `MediaRepository.saveFile` (`libraries/nestjs-libraries/src/database/prisma/media/media.repository.ts:9-30`) returns:

```ts
{ id, name, originalName, path, thumbnail, alt }
```

`id` is the **mediaId** that the agent later uses in post payloads.

#### `POST /public/v1/upload-from-url` — server-side fetch & store

`public.integrations.controller.ts:96-135`:

```ts
@Post('/upload-from-url')
async uploadsFromUrl(
  @GetOrgFromRequest() org: Organization,
  @Body() body: UploadDto
) {
  ...
  const response = await fetch(body.url, { dispatcher: ssrfSafeDispatcher });
  ...
  const buffer = Buffer.from(await response.arrayBuffer());
  const detected = await fromBuffer(buffer);
  if (!detected || !PUBLIC_API_ALLOWED_MIME.has(detected.mime)) {
    throw new HttpException({ msg: 'Unsupported file type.' }, 400);
  }
  ...
  return this._mediaService.saveFile(org.id, getFile.originalname, getFile.path);
}
```

- **Body:** `UploadDto` (`libraries/nestjs-libraries/src/dtos/media/upload.dto.ts:5-14`):

```ts
export class UploadDto {
  @IsString() @IsDefined()
  @Validate(ValidUrlExtension)
  @IsSafeWebhookUrl({ message: '...' })
  url: string;
}
```

- URL must be public HTTPS (SSRF-safe — `isSafePublicHttpsUrl`).
- Same MIME whitelist as `/upload`. Filename will be `upload.<ext>`.
- **Response:** same `Media` row shape as `/upload`.

#### `POST /public/v1/generate-video`

`public.integrations.controller.ts:298-305`:

```ts
@Post('/generate-video')
generateVideo(@GetOrgFromRequest() org: Organization, @Body() body: VideoDto) {
  return this._mediaService.generateVideo(org, body);
}
```

Body is `VideoDto` (videos lib). Consumes credits, requires `video.trial` for trial orgs (`MediaService.generateVideo` `libraries/nestjs-libraries/src/database/prisma/media/media.service.ts:84-123`). Result is a saved Media row.

#### `POST /public/v1/video/function`

`public.integrations.controller.ts:307-315`. Calls a per-video-template helper function — internal video pipeline RPC. Body: `VideoFunctionDto { identifier, functionName, params }`. **Not relevant for the agent.**

> **Missing:** there is **no `DELETE /public/v1/media/:id`**. Media deletion exists only at `DELETE /media/:id` (internal API) — see `apps/backend/src/api/routes/media.controller.ts:38-41`.

### 2.2 Integrations (channels)

#### `GET /public/v1/integrations` — list connected channels

`public.integrations.controller.ts:220-239`:

```ts
@Get('/integrations')
async listIntegration(@GetOrgFromRequest() org: Organization) {
  Sentry.metrics.count('public_api-request', 1);
  return (await this._integrationService.getIntegrationsList(org.id)).map(
    (org) => ({
      id: org.id,
      name: org.name,
      identifier: org.providerIdentifier,
      picture: org.picture,
      disabled: org.disabled,
      profile: org.profile,
      customer: org.customer
        ? { id: org.customer.id, name: org.customer.name }
        : undefined,
    })
  );
}
```

Underlying repo call (`libraries/nestjs-libraries/src/database/prisma/integrations/integration.repository.ts:486-496`):

```ts
getIntegrationsList(org: string) {
  return this._integration.model.integration.findMany({
    where: { organizationId: org, deletedAt: null },
    include: { customer: true },
  });
}
```

**Response shape per row:** `{ id, name, identifier, picture, disabled, profile, customer? }`.

- `id` is the integration ID — the value to pass as `posts[].integration.id` when creating posts.
- `identifier` is the provider key (e.g. `linkedin`, `linkedin-page`, `instagram`, `instagram-standalone`, `x`, `facebook`, `tiktok`, …) — see full list at `libraries/nestjs-libraries/src/dtos/posts/providers-settings/all.providers.settings.ts:67-101`.
- `disabled` — `true` if the channel is disabled (no posts will fire).
- `profile` — provider display profile (e.g. `@username`).
- The internal `Integration` model also has fields `internalId`, `type`, `tokenExpiration`, `refreshNeeded`, `additionalSettings` — **NOT exposed** on this endpoint. The agent cannot tell from this response whether a channel needs a token refresh; for that use the **internal** `GET /integrations/list` (returns `refreshNeeded`, `inBetweenSteps`, `time`, etc. — see §11).

The agent picks a specific account by storing `id` per provider. Multi-account selection (e.g. several LinkedIn pages) works because each `(provider, account)` pair becomes a separate row with a unique `id`.

#### `GET /public/v1/integration-settings/:id` — provider settings schema

`public.integrations.controller.ts:336-377`:

```ts
@Get('/integration-settings/:id')
async getIntegrationSettings(@GetOrgFromRequest() org, @Param('id') id) {
  ...
  const maxLength = integration.maxLength(verified);
  const schemas = !integration.dto ? false : getValidationSchemas()[integration.dto.name];
  const tools = this._integrationManager.getAllTools();
  const rules = this._integrationManager.getAllRulesDescription();
  return {
    output: {
      rules: rules[integration.identifier],
      maxLength,
      settings: !schemas ? 'No additional settings required' : schemas,
      tools: tools[integration.identifier],
    },
  };
}
```

Useful for an AI agent that wants to know per-platform constraints (max chars, required settings DTO shape, available "tools"/methods).

#### `GET /public/v1/social/:integration` — start OAuth-connect flow

`public.integrations.controller.ts:241-284`. Generates a provider OAuth URL the user must open in a browser, persists `state→orgId` mapping in Redis (`organization:${state}`, TTL 1h). Used to add a new channel from outside the UI. **Not directly useful** for posting since it requires a browser callback to complete.

#### `DELETE /public/v1/integrations/:id` — disconnect channel

`public.integrations.controller.ts:317-334`:

```ts
@Delete('/integrations/:id')
async deleteChannel(@GetOrgFromRequest() org, @Param('id') id) {
  const isTherePosts = await this._integrationService.getPostsForChannel(org.id, id);
  if (isTherePosts.length) {
    for (const post of isTherePosts) {
      this._postsService.deletePost(org.id, post.group).catch(() => {});
    }
  }
  return this._integrationService.deleteChannel(org.id, id);
}
```

**Side effect:** also soft-deletes every post (and its group) attached to the channel. Be careful.

#### `GET /public/v1/is-connected` — auth ping

`public.integrations.controller.ts:214-218`. Returns `{ connected: true }` if auth succeeded. Useful for liveness checks.

#### `POST /public/v1/integration-trigger/:id` — call a provider tool

`public.integrations.controller.ts:428-507`. Body `{ methodName: string; data: Record<string,string> }`. Looks up the integration's allowed tools and dispatches; auto-refreshes expired tokens once. Used for things like "fetch X user's communities", "list LinkedIn organizations", "list Reddit subreddits". Per-provider tool catalog: `IntegrationManager.getAllTools()`.

### 2.3 Posts — read

#### `GET /public/v1/posts?startDate=...&endDate=...&customer?=...` — list posts in date range

`public.integrations.controller.ts:146-157`:

```ts
@Get('/posts')
async getPosts(@GetOrgFromRequest() org, @Query() query: GetPostsDto) {
  Sentry.metrics.count('public_api-request', 1);
  const posts = await this._postsService.getPosts(org.id, query);
  return { posts /*, comments */ };
}
```

DTO (`libraries/nestjs-libraries/src/dtos/posts/get.posts.dto.ts:7-17`):

```ts
export class GetPostsDto {
  @IsDateString() startDate: string;
  @IsDateString() endDate:   string;
  @IsOptional() @IsString() customer: string;
}
```

Both `startDate` and `endDate` are **required**. ISO datetime strings (UTC). No pagination — returns full list in window.

Underlying query (`libraries/nestjs-libraries/src/database/prisma/posts/posts.repository.ts:123-213`) — selects only top-level posts (`parentPostId: null`), filters by `publishDate` window OR `intervalInDays != null` (recurring), excludes deleted integrations and posts. Returns shape:

```ts
{
  id, content, publishDate, releaseURL, releaseId, state,
  intervalInDays, group,
  tags: [{ tag: { ... } }],
  integration: { id, providerIdentifier, name, picture },
}
```

Recurring posts (with `intervalInDays`) are **expanded into virtual occurrences** in-process before returning (lines 192-212): each interval-strided date in the window becomes a synthetic row with the same id but a different `publishDate`, plus an extra field `actualDate` carrying the original.

`state` is one of `QUEUE | PUBLISHED | ERROR | DRAFT` (`libraries/nestjs-libraries/src/database/prisma/schema.prisma:901-906`).

> **Note:** there is NO `GET /public/v1/posts/list` (paginated) on the Public API. The `getPostsList` method exists internally (`apps/backend/src/api/routes/posts.controller.ts:132-138`) and supports `page` + `limit` + `customer` (`GetPostsListDto`).

#### `GET /public/v1/posts/:id/missing` — fetch "missing content" candidates

`public.integrations.controller.ts:379-386`. For posts marked `releaseId === 'missing'`, asks the provider what content could be back-filled (provider-specific, e.g. YouTube uploads needing metadata).

#### `GET /public/v1/find-slot/:id` — next free slot for an integration

`public.integrations.controller.ts:137-144`:

```ts
@Get('/find-slot/:id')
async findSlotIntegration(@GetOrgFromRequest() org, @Param('id') id?) {
  return { date: await this._postsService.findFreeDateTime(org.id, id) };
}
```

Returns the next ISO-formatted publish slot per the integration's configured posting times.

#### `GET /public/v1/notifications?page=N`

`public.integrations.controller.ts:286-296`. Paginated org notifications.

#### `GET /public/v1/analytics/:integration?date=...`

`public.integrations.controller.ts:408-416`. Channel-level analytics.

#### `GET /public/v1/analytics/post/:postId?date=...`

`public.integrations.controller.ts:418-426`. Per-post analytics (returns AnalyticsData[] or `{missing: true}`).

> **Missing on Public API:** there is **no `GET /public/v1/posts/:id`** (single-post detail with all integrations + media + comments). The internal API has `GET /posts/:id` (`apps/backend/src/api/routes/posts.controller.ts:165-168`) and `GET /posts/group/:group` (line 160-163), both returning the full thread + media. **Gap.**

### 2.4 Posts — write

#### `POST /public/v1/posts` — create / update / draft / now

`public.integrations.controller.ts:159-193`:

```ts
@Post('/posts')
@CheckPolicies([AuthorizationActions.Create, Sections.POSTS_PER_MONTH])
async createPost(@GetOrgFromRequest() org, @Body() rawBody: any) {
  const body = await this._postsService.mapTypeToPost(
    rawBody, org.id, rawBody.type === 'draft'
  );
  body.type = rawBody.type;

  if (
    process.env.RESTRICT_UPLOAD_DOMAINS &&
    body.posts.some((p) =>
      p.value.some((a) =>
        a.image.some(
          (i) => i.path.indexOf(process.env.RESTRICT_UPLOAD_DOMAINS) === -1
        )
      )
    )
  ) {
    throw new HttpException({ msg: `All media must be uploaded ...` }, 400);
  }

  console.log(JSON.stringify(body, null, 2));
  return this._postsService.createPost(org.id, body);
}
```

DTO is `CreatePostDto` (`libraries/nestjs-libraries/src/dtos/posts/create.post.dto.ts:93-125`):

```ts
export class CreatePostDto {
  @IsDefined() @IsIn(['draft', 'schedule', 'now', 'update'])
  type: 'draft' | 'schedule' | 'now' | 'update';

  @IsOptional() @IsString() order?: string;

  @IsDefined() @IsBoolean()  shortLink: boolean;

  @IsOptional() @IsNumber()  inter?: number;     // intervalInDays for recurring

  @IsDefined() @IsDateString() date: string;     // publishDate (ignored if type=now)

  @IsArray() @IsDefined() @ValidateNested({ each: true })
  tags: Tags[];                                  // [{ value, label }]

  @IsDefined() @Type(() => Post)
  @IsArray() @ValidateNested({ each: true }) @ArrayMinSize(1)
  posts: Post[];
}
```

Each `Post` (lines 52-81):

```ts
export class Post {
  type?: string;

  @IsDefined() @Type(() => Integration) @ValidateNested()
  integration: Integration;                       // { id }

  @IsDefined() @ArrayMinSize(1) @IsArray()
  @Type(() => PostContent) @ValidateNested({ each: true })
  value: PostContent[];

  @IsOptional() @IsString()
  group: string;                                  // optional: existing group id to replace

  @ValidateIf((o) => o.type !== 'draft')
  @ValidateNested()
  @Type(() => EmptySettings, {
    keepDiscriminatorProperty: true,
    discriminator: {
      property: '__type',
      subTypes: allProviders(EmptySettings),
    },
  })
  settings: AllProvidersSettings;
}
```

Each `PostContent` (lines 31-50):

```ts
export class PostContent {
  @IsDefined() @IsString()
  @Validate(ValidContent)
  @Transform(({ value }) => sanitizePostContent(value))
  content: string;

  @IsOptional() @IsString() id: string;     // existing post id (for update)
  @IsOptional() @IsNumber() delay: number;  // delay in MINUTES before this child posts after parent

  @IsArray() @Type(() => MediaDto) @ValidateNested({ each: true })
  image: MediaDto[];
}
```

`MediaDto` (`libraries/nestjs-libraries/src/dtos/media/media.dto.ts:4-22`):

```ts
export class MediaDto {
  @IsString() @IsDefined() id: string;
  @IsString() @IsDefined() @Validate(ValidUrlPath) @Validate(ValidUrlExtension) path: string;
  @ValidateIf((o) => o.alt) @IsString() alt?: string;
  @ValidateIf((o) => o.thumbnail) @IsUrl() thumbnail?: string;
}
```

**`type` semantics** (`libraries/nestjs-libraries/src/database/prisma/posts/posts.repository.ts:480-525`):

| `type` | DB `state` | Behaviour |
|---|---|---|
| `draft` | `DRAFT` | Saved but Temporal workflow NOT started. Validation skips `settings` schema (since `@ValidateIf((o) => o.type !== 'draft')`). |
| `schedule` | `QUEUE` | Saved with `publishDate=date`, Temporal workflow `postWorkflowV102` started. |
| `now` | `QUEUE` | Same as schedule but `date` is overridden to `dayjs().format('YYYY-MM-DDTHH:mm:00')` (line 750 in posts.service.ts). |
| `update` | unchanged | Upserts existing post by `value[].id` and existing `group` (does NOT change state). Workflow is NOT restarted (`if (body.type !== 'update')` line 760). |

> **Subtle bug/feature in the public-api wrapper** — `controller line 169`: `await this._postsService.mapTypeToPost(rawBody, org.id, rawBody.type === 'draft')`. The third arg, `replaceDraft`, when `true`, makes `mapTypeToPost` (`posts.service.ts:227-276`) force the type to `'schedule'` internally for validation. Then line 171 of the controller restores `body.type = rawBody.type`. Net effect: a `type=draft` request validates as if it were `schedule` (full settings DTO required) but is then SAVED with state DRAFT. **Practically: drafts created via Public-API REQUIRE a fully valid `settings` block, unlike drafts via the internal API.**

**Multi-platform in one call.** The `posts: Post[]` array is iterated in `PostsService.createPost` (`libraries/nestjs-libraries/src/database/prisma/posts/posts.service.ts:734-777`):

```ts
for (const post of body.posts) {
  ...
  const { posts } = await this._postRepository.createOrUpdatePost(
    body.type, orgId, ..., post, body.tags, body.inter
  );
  ...
  if (body.type !== 'update') {
    this.startWorkflow(
      post.settings.__type.split('-')[0].toLowerCase(),
      posts[0].id, orgId, posts[0].state
    ).catch((err) => {});
  }
  ...
  postList.push({ postId: posts[0].id, integration: post.integration.id });
}
return postList;
```

**One call schedules N integrations**, each with its own `value[]` (thread) and per-provider `settings`. Per-integration content overrides ARE supported because `Post.value[].content` is independent per integration. So for a "LinkedIn body different from X body" scenario, send two `Post` objects in the same call.

Response: `{ postId, integration }[]` — one entry per top-level post created.

**`group` field** (Post-level, `create.post.dto.ts:67-69`): if provided, `createOrUpdatePost` will soft-delete all existing posts in that group before creating new ones (`posts.repository.ts:592-618`) — i.e. "replace this group with these posts". Useful for re-publishing.

**`value[].id` field**: when set, used as the upsert key. So to UPDATE an existing post in place, send `type='update'` + `posts[].value[i].id = <existing id>`.

**Tags** (top-level): `tags: [{ value, label }]` where `label` matches a tag name on `Tags` model. Only tags that already exist (`findMany`) are connected; new tag names are ignored.

**`shortLink` (boolean, required)**: if true, runs `_shortLinkService.convertTextToShortLinks` on content before save (line 740 of posts.service.ts).

**`inter` (number)**: stored as `intervalInDays` on the post → makes it a recurring post.

**First-comment / "comment as different account" on LinkedIn**: NOT part of the create-post DTO. It's exposed as a "plug" — `linkedin-add-comment` (`libraries/nestjs-libraries/src/integrations/social/linkedin.provider.ts:704-740`) — configured per-integration via `Plugs` table. Triggered from settings, not from the create-post body. The agent cannot pass "first-comment text" inline.

**`RESTRICT_UPLOAD_DOMAINS` env**: if set, every image's `path` must contain that substring; otherwise the call is rejected (controller lines 174-189). Useful in production to force only Postiz-hosted media URLs.

#### `PUT /public/v1/posts/:id/status` — toggle DRAFT ↔ QUEUE

`public.integrations.controller.ts:388-396`:

```ts
@Put('/posts/:id/status')
async changePostStatus(
  @GetOrgFromRequest() org, @Param('id') id, @Body() body: ChangePostStatusDto
) {
  return this._postsService.changePostStatus(org.id, id, body.status);
}
```

DTO (`libraries/nestjs-libraries/src/dtos/posts/change.post.status.dto.ts:3-6`):

```ts
export class ChangePostStatusDto {
  @IsIn(['draft', 'schedule']) status: 'draft' | 'schedule';
}
```

Service (`posts.service.ts:787-810`):

```ts
async changePostStatus(orgId, id, status: 'draft' | 'schedule') {
  const getPostById = await this._postRepository.getPostById(id, orgId);
  if (!getPostById) throw new BadRequestException('Post not found');
  const state: State = status === 'draft' ? 'DRAFT' : 'QUEUE';
  await this._postRepository.changeState(id, state);
  try {
    await this.startWorkflow(
      getPostById.integration.providerIdentifier.split('-')[0].toLowerCase(),
      getPostById.id, orgId, state
    );
  } catch (err) {}
  return { id, state };
}
```

**Only two transitions**: `draft → schedule` (queues the workflow) and `schedule → draft` (terminates running workflows in `startWorkflow` line 644-660). No way via API to manually mark `PUBLISHED` or `ERROR`.

#### `PUT /public/v1/posts/:id/release-id` — set release/missing-content id

`public.integrations.controller.ts:398-406`. Body `{ releaseId: string }`. Only updates if existing `releaseId === 'missing'` (`posts.repository.ts:372-383`). Used by the platform's missing-content recovery flow.

> **Missing transitions on Public API:**
> - **No update-body endpoint** in the explicit sense, BUT `POST /public/v1/posts` with `type='update'` and `posts[].value[i].id` is the de-facto update — see §2.4 above.
> - **No update-date-only endpoint** on Public API. Internal API has `PUT /posts/:id/date` (`apps/backend/src/api/routes/posts.controller.ts:213-221`). **Gap for Public API.**

#### `DELETE /public/v1/posts/:id` — delete by post id

`public.integrations.controller.ts:195-203`:

```ts
@Delete('/posts/:id')
async deletePost(@GetOrgFromRequest() org, @Param('id') id) {
  const getPostById = await this._postsService.getPost(org.id, id);
  return this._postsService.deletePost(org.id, getPostById.group);
}
```

Resolves the group then deletes the entire group (the single post + all child thread parts).

#### `DELETE /public/v1/posts/group/:group` — delete by group id

`public.integrations.controller.ts:205-212`. Same effect, when caller already has the `group` value.

Both delete actions are soft-deletes (`deletedAt`) and **terminate the corresponding running Temporal workflow** (`posts.service.ts:635-664`, query: `postId="${post.id}" AND ExecutionStatus="Running"`).

---

## 3. Posts lifecycle — answers to the brief

| Capability | Public API supports? | How |
|---|---|---|
| Create draft | YES | `POST /public/v1/posts` with `type:'draft'`. **Gotcha**: `settings` block STILL required despite `@ValidateIf((o) => o.type !== 'draft')` due to wrapper logic (§2.4). |
| Create scheduled | YES | `POST /public/v1/posts` with `type:'schedule'`, `date:'2026-04-30T15:00:00.000Z'`. |
| Post immediately | YES | `POST /public/v1/posts` with `type:'now'`. |
| Update existing post body | YES (via re-create) | `POST /public/v1/posts` with `type:'update'` and `posts[].value[i].id = <existing>`. State is NOT reset. |
| Update only the publish date | NO (Public API) | Use internal `PUT /posts/:id/date` body `{ date, action:'schedule'|'update' }`. |
| Toggle draft ↔ scheduled | YES | `PUT /public/v1/posts/:id/status` body `{status:'draft'|'schedule'}`. No other transitions. |
| Replace media on existing post | YES (via update) | `POST /public/v1/posts` `type:'update'` resends `value[].image[]`. Old media references replaced via `JSON.stringify(value.image)` in `posts.repository.ts:526`. |
| Delete media from a post | partial | Send `value[].image: []` in an update — the field is overwritten wholesale. |
| Delete post | YES | `DELETE /public/v1/posts/:id` or `DELETE /public/v1/posts/group/:group`. |
| Choose specific account | YES | `posts[].integration.id` from `GET /public/v1/integrations`. |
| Multi-platform single call | YES | Multiple `Post` objects in `posts[]`. |
| Per-platform body override | YES | Each `Post` has its own `value[].content`. |
| List posts in date range | YES | `GET /public/v1/posts?startDate&endDate`. |
| Single-post detail with media + comments | NO | Only via internal `GET /posts/:id` and `GET /public/posts/:id/comments` (no-auth). |
| Pagination over posts | NO | Internal `GET /posts/list?page&limit&customer` only. |

---

## 4. Comments

### 4.1 `GET /public/posts/:id/comments` — read comments (no auth)

`apps/backend/src/api/routes/public.controller.ts:76-79`:

```ts
@Get(`/posts/:id/comments`)
async getComments(@Param('id') postId: string) {
  return { comments: await this._postsService.getComments(postId) };
}
```

This is on the `/public` (non-versioned, **no auth**) controller. **Anyone with a postId** can read its comments — they are not gated by the org owner. Repo (`libraries/nestjs-libraries/src/database/prisma/posts/posts.repository.ts:764-773`):

```ts
async getComments(postId: string) {
  return this._comments.model.comments.findMany({
    where: { postId },
    orderBy: { createdAt: 'asc' },
  });
}
```

Returned shape (full `Comments` row): `{ id, content, organizationId, postId, userId, createdAt, updatedAt, deletedAt }` per the Comments schema (`schema.prisma:373-391`).

### 4.2 `POST /posts/:id/comments` — create comment (internal, JWT-only)

`apps/backend/src/api/routes/posts.controller.ts:71-79`:

```ts
@Post('/:id/comments')
async createComment(
  @GetOrgFromRequest() org, @GetUserFromRequest() user,
  @Param('id') id, @Body() body: { comment: string }
) {
  return this._postsService.createComment(org.id, user.id, id, body.comment);
}
```

This is mounted under `PostsController` (`@Controller('/posts')`), gated by `AuthMiddleware` → **requires a JWT cookie/header `auth`, not an API key**. The body is `{ comment: string }`.

Repo (`posts.repository.ts:818-832`):

```ts
createComment(orgId, userId, postId, content) {
  return this._comments.model.comments.create({
    data: { organizationId: orgId, userId, postId, content },
  });
}
```

Note `userId` is **required** (NOT NULL — see schema `Comments.userId String` line 378), and `postId` has a foreign-key relation. So a comment must be authored by an actual `User` row.

> **Gap for the agent: NO public-API endpoint to create comments.** The agent cannot write a comment via API key — it must either:
> 1. Use a JWT cookie obtained by user login, OR
> 2. Have a new public-API endpoint added (recommended — see §10).

---

## 5. Media upload — full picture

| Concern | Detail | Source |
|---|---|---|
| Endpoint | `POST /public/v1/upload` | controller line 76 |
| Encoding | `multipart/form-data`, single field `file` | `FileInterceptor('file')` |
| Validation | `CustomFileValidationPipe` (mime sniffed from buffer, not header) | `custom.upload.validation.ts:9-67` |
| Allowed images | jpeg, png, gif, webp, avif, bmp, tiff | line 9-17 |
| Allowed video | mp4 ONLY | line 17 |
| Max image size | 10 MB | line 60 |
| Max video size | 1 GB | line 62 |
| URL upload | `POST /public/v1/upload-from-url` body `{ url }` | controller line 96 |
| URL must be | public HTTPS, SSRF-safe | `IsSafeWebhookUrl` |
| Storage backend | local FS or Cloudflare R2 (env `STORAGE_PROVIDER`) | `upload.factory.ts` |
| Returns | `{ id, name, originalName, path, thumbnail, alt }` | `media.repository.ts:21-28` |
| Use mediaId | `posts[].value[i].image: [{ id, path, alt?, thumbnail? }]` in create-post | `media.dto.ts:4-22` |
| Aspect-ratio handling | NONE on backend (Postiz doesn't reshape images server-side) | — |
| PNG → JPEG conversion | Optional, only when `getPost(...convertToJPEG=true)` is called from internal `getPost` flow; **NOT triggered on upload nor on Public-API `getPosts`** | `posts.service.ts:324-421` |
| Media information (alt/thumbnail) | Only via internal `POST /media/information` | `media.controller.ts:122-128` |
| Delete media | Only via internal `DELETE /media/:id` | `media.controller.ts:38-41` |
| List media | Only via internal `GET /media?page&search` | `media.controller.ts:181-188` |

> **Gap for the agent on Public API:**
> - Cannot delete a media row (`DELETE /public/v1/media/:id` does not exist).
> - Cannot set alt text / thumbnail metadata (`POST /public/v1/media/information` does not exist).
> - Cannot list media library.
> Workaround: the agent uploads fresh media every time, never reuses existing. To replace media on a post, just send new `image: [...]` in `type='update'`.

**Video upload is supported** via Public API for mp4 only, up to 1 GB. AI-generated video via `POST /public/v1/generate-video` (consumes credits, returns Media row).

---

## 6. Multi-platform & per-platform overrides

Already covered in §2.4 — confirmed via `posts.service.ts:734-777`. ONE `POST /public/v1/posts` call, multiple `Post` objects, each with:
- `integration.id` — which channel
- `value: [{ content, image, delay }]` — thread of N posts (delay in **minutes**, see workflow `post.workflow.v1.0.2.ts:151-152`: `await sleep(60000 * Math.max(0, Number(postsList[i].delay ?? 0)))`)
- `settings.__type` + provider-specific fields

`tags`, `date`, `inter` (recurring), `shortLink` are top-level and apply to ALL `Post` entries in the call.

---

## 7. AI triggering via API

There is a built-in agent system but **all of it requires JWT auth (internal API)**:

| Endpoint | Where | What |
|---|---|---|
| `POST /posts/generator` | `posts.controller.ts:190-203` | Streaming JSON, runs `AgentGraphService.start(orgId, body)` — full multi-step content generation pipeline. Uses GPT-4o (`agent.graph.insert.service.ts:11-15`). |
| `POST /posts/generator/draft` | `posts.controller.ts:181-188` | Generates a week's worth of randomized drafts across all integrations. |
| `POST /posts/separate-posts` | `posts.controller.ts:223-229` | Splits long content into a thread, body `{ content, len }`. Calls `OpenaiService.separatePosts`. |
| `POST /media/generate-image` | `media.controller.ts:52-69` | DALL·E (or configured) image gen, returns `data:image/png;base64,...`. Consumes credits. |
| `POST /media/generate-image-with-prompt` | `media.controller.ts:71-85` | Same + auto-generate prompt first. |
| `POST /public/v1/generate-video` | controller line 298 | This IS on Public API. Body `VideoDto`. |
| `POST /public/agent` | `public.controller.ts:44-54` | Categorize + topic + hook a post for the popular-posts library. **Requires `AGENT_API_KEY` env match in body, NOT the org API key.** Internal-only signal channel. |

> **Conclusion for §8 of the brief:** there is **no Public API endpoint to trigger Postiz' content-AI from an external server**. The agent cannot ask Postiz to write content for it — only to publish content the agent has already written. This matches the simplified architecture exactly.

---

## 8. Webhooks — what events fire, and how to subscribe

### 8.1 Subscribe (CRUD) — internal API ONLY

`apps/backend/src/api/routes/webhooks.controller.ts`:

```
GET    /webhooks               — list                        line 26-29
POST   /webhooks               — create (CheckPolicies WEBHOOKS) line 31-38
PUT    /webhooks               — update                      line 40-46
DELETE /webhooks/:id           — soft-delete                 line 48-54
POST   /webhooks/send          — manual fire (any URL)        line 56-69
```

These are all under `WebhookController`, mounted in `authenticatedController` (`api.module.ts:58`). **Auth: JWT cookie `auth`, NOT API key.** **Not exposed on Public API.**

DTO (`libraries/nestjs-libraries/src/dtos/webhooks/webhooks.dto.ts:11-30`):

```ts
export class WebhooksDto {
  id: string;
  @IsString() @IsDefined() name: string;
  @IsString() @IsUrl() @IsDefined() @IsSafeWebhookUrl({ message: '...' }) url: string;
  @Type(() => WebhooksIntegrationDto) @IsDefined() integrations: WebhooksIntegrationDto[];
}
```

Each `WebhooksIntegrationDto` is `{ id: string }` — the integration filter. If `integrations` is empty, the webhook fires for every integration; otherwise only for posts whose integration matches one of the IDs.

Schema:

- `Webhooks { id, name, organizationId, url, deletedAt, ... }` — `schema.prisma:593-606`
- `IntegrationsWebhooks` join table — `schema.prisma:581-591`

Per-tier webhook quota in pricing matrix (`libraries/nestjs-libraries/src/database/prisma/subscriptions/pricing.ts:55-109`): FREE=0, STANDARD=2, PRO=10, TEAM=30, ULTIMATE=10000.

### 8.2 Fire — when & with what payload

There is **only ONE webhook event type** (despite the name: there's no eventTypes column). It fires after a successful post publish, in the orchestrator's main post workflow.

`apps/orchestrator/src/workflows/post-workflows/post.workflow.v1.0.2.ts:243-248`:

```ts
// send webhooks for the post
await sendWebhooks(
  postsResults[0].postId,
  post.organizationId,
  post.integration.id
);
```

(Also in v1.0.1 of the workflow for backward compat, `post.workflow.v1.0.1.ts:240-245`.)

Activity (`apps/orchestrator/src/activities/post.activity.ts:258-284`):

```ts
@ActivityMethod()
async sendWebhooks(postId: string, orgId: string, integrationId: string) {
  const webhooks = (await this._webhookService.getWebhooks(orgId)).filter(
    (f) => f.integrations.length === 0
        || f.integrations.some((i) => i.integration.id === integrationId)
  );
  const post = await this._postService.getPostByForWebhookId(postId);
  return Promise.all(webhooks.map(async (webhook) => {
    try {
      await fetch(webhook.url, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(post),
      });
    } catch (e) { /**empty**/ }
  }));
}
```

**Payload shape** = output of `getPostByForWebhookId` (`posts.repository.ts:834-858`):

```ts
findMany({
  where: { id: postId, deletedAt: null, parentPostId: null },
  select: {
    id, content, publishDate, releaseURL, state,
    integration: { select: { id, name, providerIdentifier, picture, type } },
  },
});
```

So the webhook receives an **array** like:

```json
[
  {
    "id": "ckxyz...",
    "content": "...",
    "publishDate": "2026-04-30T14:00:00.000Z",
    "releaseURL": "https://www.linkedin.com/feed/update/...",
    "state": "PUBLISHED",
    "integration": {
      "id": "...", "name": "Husatech",
      "providerIdentifier": "linkedin-page",
      "picture": "...", "type": "social"
    }
  }
]
```

**No signature header. No retry. No event-name field. No error events.** Failures (state ERROR) do NOT fire webhooks (the call sits inside the success path of the workflow).

> **Gap:** the agent cannot subscribe to `post.error`, `post.deleted`, `comment.created`, etc. Only successful publishes — and only AFTER the workflow completes.
>
> **Gap:** the agent cannot register webhooks via API key (Public API has no webhook endpoints). The agent must either ask a UI admin to create one, or POST to internal `/webhooks` with a JWT cookie.

---

## 9. Auxiliary endpoints worth knowing

| Method | Path | Purpose | Auth |
|---|---|---|---|
| GET  | `/public/posts/:id` | Read post + thread + integration metadata (no auth) | none |
| GET  | `/public/posts/:id/comments` | Read comments (no auth) | none |
| POST | `/public/t` | Tracking pixel | none |
| GET  | `/public/stream?url=...` | SSRF-safe video proxy (mp4 only) | none |

`/public/posts/:id` returns minus the `childrenPost` field but includes a flattened integration object with `id, name, picture, providerIdentifier, profile`. Source `apps/backend/src/api/routes/public.controller.ts:56-74`.

---

## 10. Gap List — capabilities the agent needs that Public API lacks

For each gap I show: severity, current workaround, and proposed fix (option A: use internal `/api/*` with cookie/JWT; option B: add a Public-API endpoint).

### 10.1 Read single post detail

- **Need:** `GET /public/v1/posts/:id` returning post body, thread (childrenPost recursively), all media (resolved), integration, settings, tags, comments.
- **Severity:** HIGH (agent always needs to fetch a post by id).
- **Workaround A (internal):** `GET /posts/:id` (`posts.controller.ts:165-168`) returns `getPost(orgId, id)` which already does exactly this (`posts.service.ts:511-531`).
- **Workaround B (public, no auth):** `GET /public/posts/:id` returns posts recursively but NO comments and NO settings (just integration metadata).
- **Recommended fix:** add `@Get('/posts/:id')` to `PublicIntegrationsController` calling `_postsService.getPost(org.id, id)`. Trivial — 5 lines. Also expose comments inline.

### 10.2 List posts paginated

- **Need:** `GET /public/v1/posts/list?page&limit&customer` for incremental sync.
- **Severity:** MEDIUM (date-range works, but unbounded).
- **Workaround A (internal):** `GET /posts/list` returns `{ posts, total, page, limit, hasMore }` (`posts.controller.ts:132-138`, `posts.repository.ts:215-288`).
- **Recommended fix:** add `@Get('/posts/list')` mirroring the internal handler.

### 10.3 Update only the date of an existing post

- **Need:** `PUT /public/v1/posts/:id/date` body `{ date, action:'schedule'|'update' }`.
- **Severity:** MEDIUM (currently: send full `type='update'` create-post body).
- **Workaround A (internal):** `PUT /posts/:id/date` (`posts.controller.ts:213-221`).
- **Recommended fix:** add the same handler to `PublicIntegrationsController`.

### 10.4 Create a comment via API key

- **Need:** `POST /public/v1/posts/:id/comments` body `{ comment }`.
- **Severity:** HIGH (Lukas wants comments as the AI-feedback channel).
- **Blocker:** `Comments.userId` is required (FK to User). The Public-API middleware doesn't set `req.user`, only `req.org`. So a new endpoint needs to either:
  - synthesize a "system" user per org, OR
  - allow `userId` to be nullable, OR
  - accept a userId in the body (acceptable when API key holders are SUPERADMIN).
- **Recommended fix:** add `POST /public/v1/posts/:id/comments` body `{ comment, userId? }`. If userId omitted, fall back to org's first SUPERADMIN.

### 10.5 Delete or rename media

- **Need:** `DELETE /public/v1/media/:id`, `POST /public/v1/media/information`.
- **Severity:** LOW (workaround = re-upload).
- **Workaround A (internal):** `DELETE /media/:id`, `POST /media/information`.

### 10.6 List media library

- **Need:** `GET /public/v1/media?page&search`.
- **Severity:** LOW.

### 10.7 Subscribe to webhooks

- **Need:** `POST /public/v1/webhooks` (and full CRUD).
- **Severity:** HIGH if the agent wants event-driven flow. Currently agent must poll.
- **Workaround A (internal):** `POST /webhooks` with cookie auth.
- **Recommended fix:** add the four endpoints to a `PublicWebhooksController`.

### 10.8 Webhook event diversity

- **Need:** events for `post.error`, `post.deleted`, `post.scheduled`, `comment.created`.
- **Severity:** MEDIUM.
- **Currently:** only `post.successful-publish` (sort of — there's no event-name field at all).
- **Fix:** orchestrator activity changes + webhook payload schema with `event` field.

### 10.9 Manual state transitions beyond DRAFT/QUEUE

- **Need:** ability to mark a post as `ERROR` or back-to `QUEUE` from `ERROR`.
- **Severity:** LOW.
- **Currently:** only `draft ↔ schedule`.

### 10.10 Trigger external regeneration

- **Statement:** as per Lukas, "trigger re-generation" is NOT a Postiz concept. The agent does its own regen and pushes a new body via `POST /public/v1/posts` `type='update'`. **Verified:** there is no AI-regen endpoint on Public API. Internal `POST /posts/generator` does exist but is not what we want here.

### 10.11 Read which channels need reauth

- **Need:** is this LinkedIn token expired?
- **Workaround A (internal):** `GET /integrations/list` returns `refreshNeeded`, `inBetweenSteps`, `disabled`. Public-API `GET /integrations` returns only `disabled`.
- **Fix:** widen Public-API integration list response to include `refreshNeeded`, `inBetweenSteps`.

---

## 11. Internal API surface (`/api/*`) — agent cheat sheet if Public-API gaps bite

Internal API requires a JWT cookie/header `auth`. To use it, the agent must perform a real user login and capture the cookie (no service-account pattern exists — see below). Only relevant endpoints listed:

### Posts (`apps/backend/src/api/routes/posts.controller.ts`)

| Method | Path | Notes |
|---|---|---|
| GET   | `/posts/` | list with `GetPostsDto` (date range), minified |
| GET   | `/posts/list` | paginated list |
| GET   | `/posts/find-slot` | next free slot org-wide |
| GET   | `/posts/find-slot/:id` | next free slot for integration |
| GET   | `/posts/old?date=...` | published posts before date |
| GET   | `/posts/:id` | full detail (line 165) |
| GET   | `/posts/group/:group` | full detail by group (line 160) |
| GET   | `/posts/:id/missing` | missing-content recovery |
| GET   | `/posts/:id/statistics` | shortlink click stats |
| POST  | `/posts/` | create (same DTO as Public) |
| POST  | `/posts/:id/comments` | create comment (line 71) |
| POST  | `/posts/should-shortlink` | AI shortlink decision |
| POST  | `/posts/separate-posts` | AI thread split |
| POST  | `/posts/generator` | streaming AI content gen |
| POST  | `/posts/generator/draft` | bulk weekly drafts |
| PUT   | `/posts/:id/release-id` | set releaseId |
| PUT   | `/posts/:id/date` | change date only |
| DELETE | `/posts/:group` | delete by group |
| GET/POST/PUT/DELETE | `/posts/tags` + `/posts/tags/:id` | tag CRUD |

### Media (`apps/backend/src/api/routes/media.controller.ts`)

| Method | Path | Notes |
|---|---|---|
| GET    | `/media/` | list with paging + search |
| POST   | `/media/upload-server` | multipart upload |
| POST   | `/media/upload-simple` | multipart, optional `preventSave=true` |
| POST   | `/media/save-media` | register a Cloudflare-uploaded file |
| POST   | `/media/information` | set alt/thumbnail |
| POST   | `/media/generate-image` | AI image |
| POST   | `/media/generate-video` | AI video |
| POST   | `/media/:endpoint` | R2 multipart helper |
| DELETE | `/media/:id` | soft-delete |

### Webhooks (`apps/backend/src/api/routes/webhooks.controller.ts`)

`GET POST PUT /webhooks` and `DELETE /webhooks/:id` — see §8.1.

### Service-account / impersonation patterns

There is **no first-class service-account pattern**. The closest things:
- `req.cookies.impersonate` — only works if user is SUPERADMIN globally (`auth.middleware.ts:51`). Not a multi-tenant pattern.
- `OAuth2 pos_*` tokens — closest to a machine token; obtained by full OAuth dance. Ties to a user + org.
- The org API key — already in use for Public API.

> **Recommended approach for the agent**: stick to the org API key on Public API for all operations the API supports. For gaps (single-post detail, paginated list, date-only update, write-comment), **prefer adding the missing handler to `PublicIntegrationsController`** (≈5 lines each) over making the agent juggle JWT auth. The synthetic-SUPERADMIN injection in `public.auth.middleware.ts:39,57` already grants the necessary policy bypass.

---

## 12. Minimal agent recipes (verified against source)

```http
# 1. Auth
GET  /public/v1/is-connected
Authorization: <orgApiKey>

# 2. Discover channels
GET  /public/v1/integrations
Authorization: <orgApiKey>

# 3. Upload an image
POST /public/v1/upload
Authorization: <orgApiKey>
Content-Type: multipart/form-data
file=@hero.jpg
# → { id: "<mediaId>", path: "...", name: "hero.jpg", ... }

# 4. Schedule a post (LinkedIn page + X, different content)
POST /public/v1/posts
Authorization: <orgApiKey>
Content-Type: application/json
{
  "type": "schedule",
  "shortLink": false,
  "date": "2026-05-02T09:00:00.000Z",
  "tags": [],
  "posts": [
    {
      "integration": { "id": "<linkedinPageIntegrationId>" },
      "value": [{
        "content": "Long-form LinkedIn body...",
        "image": [{ "id": "<mediaId>", "path": "<mediaPath>" }]
      }],
      "settings": { "__type": "linkedin-page", "post_as_images_carousel": false }
    },
    {
      "integration": { "id": "<xIntegrationId>" },
      "value": [{
        "content": "Punchy 280-char X version...",
        "image": []
      }],
      "settings": { "__type": "x", "who_can_reply_post": "everyone" }
    }
  ]
}
# → [{ postId, integration }, { postId, integration }]

# 5. Update body of an existing scheduled post
POST /public/v1/posts
Authorization: <orgApiKey>
Content-Type: application/json
{
  "type": "update",
  "shortLink": false,
  "date": "2026-05-02T09:00:00.000Z",
  "tags": [],
  "posts": [{
    "integration": { "id": "<linkedinPageIntegrationId>" },
    "group": "<existingGroupId>",        # optional but recommended
    "value": [{
      "id": "<existingPostId>",
      "content": "Revised body...",
      "image": [{ "id": "<newMediaId>", "path": "<newMediaPath>" }]
    }],
    "settings": { "__type": "linkedin-page", "post_as_images_carousel": false }
  }]
}

# 6. Toggle to draft
PUT /public/v1/posts/<postId>/status
Authorization: <orgApiKey>
{ "status": "draft" }

# 7. Find next free slot
GET /public/v1/find-slot/<integrationId>

# 8. List posts in a window
GET /public/v1/posts?startDate=2026-04-30T00:00:00.000Z&endDate=2026-05-31T23:59:59.999Z

# 9. Read post comments (no auth required)
GET /public/posts/<postId>/comments

# 10. Delete a post (and its thread + workflow)
DELETE /public/v1/posts/<postId>
```

---

## 13. Summary table — the agent's effective surface

| Need | Public API endpoint | Status |
|---|---|---|
| Auth | `Authorization: <key>` header | ✅ |
| List channels | `GET /public/v1/integrations` | ✅ (limited fields) |
| Upload media | `POST /public/v1/upload` | ✅ images+mp4 |
| Upload media from URL | `POST /public/v1/upload-from-url` | ✅ |
| Create draft | `POST /public/v1/posts type:draft` | ✅ (settings still required, see §2.4) |
| Create scheduled | `POST /public/v1/posts type:schedule` | ✅ |
| Post now | `POST /public/v1/posts type:now` | ✅ |
| Update body/media of existing post | `POST /public/v1/posts type:update` | ✅ |
| Update only date | — | ❌ → internal `PUT /posts/:id/date` or new endpoint |
| Toggle draft↔schedule | `PUT /public/v1/posts/:id/status` | ✅ |
| Delete post | `DELETE /public/v1/posts/:id` | ✅ |
| List posts in range | `GET /public/v1/posts?startDate&endDate` | ✅ |
| Single post detail | — | ❌ → use `/public/posts/:id` (no auth, partial) or internal |
| Read comments | `GET /public/posts/:id/comments` | ✅ (no auth!) |
| Write comment | — | ❌ → internal `POST /posts/:id/comments` (JWT) |
| Subscribe webhook | — | ❌ → internal `POST /webhooks` (JWT) |
| Webhook events | only post.successful-publish | ⚠️ limited |
| AI generation | — | ❌ (Lukas: not needed; agent does AI externally) |
| Analytics | `GET /public/v1/analytics(/post)?` | ✅ |
| Rate limit | 30/h on `POST /public/v1/posts` only | ⚠️ tune via `API_LIMIT` |

**Bottom line for the simplified architecture:**
- The Public API covers ~80% of what an external scheduler-agent needs for posting.
- The biggest gaps are **single-post-detail read**, **write-comment**, and **webhook subscribe** — each is a 5-30 line addition to `PublicIntegrationsController`.
- The agent never needs Postiz' AI; the AI lives on Lukas' external server.
- Until those gaps are filled, the agent can fall back to the internal `/api/*` namespace via JWT login (cookie `auth`), but that's brittle (login flow, cookie expiry).

---

*Mapped from source on 2026-04-30 against `/Users/lukas/Desktop/Coding/postiz-husatech/`.*
