# Postiz Workflow Engine + AI Integration Map

**Analysis Date:** 2026-04-30
**Repo:** `/Users/lukas/Desktop/Coding/postiz-husatech/`
**Focus:** Post lifecycle, approval workflow, comments, webhooks, AI/agent stack, image generation, MCP/OAuth, public API, Temporal scheduling, extension points.
**Goal:** Concrete plug-in points to bolt on a `draft → review → re-gen → approved → online` workflow with comment-triggered, brand-voice-aware AI re-generation.

Postiz is a **NestJS monorepo** (3 apps: `apps/backend`, `apps/orchestrator`, `apps/frontend`) backed by **Prisma/PostgreSQL** and **Temporal.io** for background work. AI lives in three places: a thin OpenAI service, a LangGraph "AgentGraph" content generator, and a Mastra-based MCP-exposed agent for the chat copilot.

---

## 1. Post Lifecycle State Machine

### 1.1 The `State` enum — only 4 states, no `REVIEW`/`APPROVED`

`libraries/nestjs-libraries/src/database/prisma/schema.prisma:901-906`
```prisma
enum State {
  QUEUE
  PUBLISHED
  ERROR
  DRAFT
}
```

`Post.state` is the column (line 395), default `QUEUE`, indexed (line 433):

`libraries/nestjs-libraries/src/database/prisma/schema.prisma:393-444`
```prisma
model Post {
  id                         String                    @id @default(cuid())
  state                      State                     @default(QUEUE)
  publishDate                DateTime
  organizationId             String
  integrationId              String
  content                    String
  ...
  approvedSubmitForOrder     APPROVED_SUBMIT_FOR_ORDER @default(NO)
  ...
  comments                   Comments[]
  errors                     Errors[]
  ...
  @@index([state])
  @@index([approvedSubmitForOrder])
}
```

There is also an unrelated `APPROVED_SUBMIT_FOR_ORDER` enum (line 935) used **only for the marketplace/agency feature** (`SocialMediaAgency`, `Orders`), not for editorial review:

`libraries/nestjs-libraries/src/database/prisma/schema.prisma:935-939`
```prisma
enum APPROVED_SUBMIT_FOR_ORDER {
  NO
  WAITING_CONFIRMATION
  YES
}
```

**Interpretation:** Postiz has NO native `review`, `approved`, `re-gen` state. The 2026 reviews calling out "lacks approval workflows" are **correct against the code**. Lukas needs to either:
- **Option A:** Extend the `State` enum (`schema.prisma:901`) with new values (`REVIEW`, `REGEN`, `APPROVED`) — requires migration + audit of every `state ===` comparison.
- **Option B:** Keep `State` and add a sibling enum `EditorialState` + new `editorialState` column on `Post`, plus a `Comments`-style `Reviews` table. Less invasive.

### 1.2 State transitions — single chokepoint

The only place state mutates is `PostsRepository.changeState`:

`libraries/nestjs-libraries/src/database/prisma/posts/posts.repository.ts:385-420`
```ts
async changeState(id: string, state: State, err?: any, body?: any) {
  const update = await this._post.model.post.update({
    where: { id },
    data: {
      state,
      ...(err ? { error: typeof err === 'string' ? err : JSON.stringify(err) } : {}),
    },
    include: {
      integration: { select: { providerIdentifier: true } },
    },
  });

  if (state === 'ERROR' && err && body) {
    try {
      await this._errors.model.errors.create({...});
    } catch (err) {}
  }
  return update;
}
```

Wrapper in service: `libraries/nestjs-libraries/src/database/prisma/posts/posts.service.ts:783-785`. **Hook here** to fire side-effects on any state change (e.g. webhook on REVIEW → REGEN).

### 1.3 The user-facing status switch — currently 2 values

`libraries/nestjs-libraries/src/dtos/posts/change.post.status.dto.ts:1-7`
```ts
import { IsIn } from 'class-validator';

export class ChangePostStatusDto {
  @IsIn(['draft', 'schedule'])
  status: 'draft' | 'schedule';
}
```

Mapped in `PostsService.changePostStatus`:

`libraries/nestjs-libraries/src/database/prisma/posts/posts.service.ts:787-810`
```ts
async changePostStatus(orgId: string, id: string, status: 'draft' | 'schedule') {
  const getPostById = await this._postRepository.getPostById(id, orgId);
  if (!getPostById) throw new BadRequestException('Post not found');

  const state: State = status === 'draft' ? 'DRAFT' : 'QUEUE';
  await this._postRepository.changeState(id, state);

  try {
    await this.startWorkflow(
      getPostById.integration.providerIdentifier.split('-')[0].toLowerCase(),
      getPostById.id, orgId, state,
    );
  } catch (err) {}
  return { id, state };
}
```

Exposed via:
- `apps/backend/src/public-api/routes/v1/public.integrations.controller.ts:388-396` — `PUT /public/v1/posts/:id/status` (Public API, API-key auth).
- No equivalent route in `apps/backend/src/api/routes/posts.controller.ts` — internal frontend uses `changeDate` + create/update for status changes.

**Plug-in point for Husatech workflow:** Replace the `IsIn(['draft', 'schedule'])` enum here with `['draft', 'review', 'regen', 'approved', 'schedule']` and have `changePostStatus` map to your new editorial state column.

---

## 2. Approval / Review Workflow — DOES NOT EXIST as code

Verification searches:

```bash
grep -rn "review\|reviewer\|revision\|REVIEW\|REVISION\|APPROVAL" \
  libraries/.../posts/posts.service.ts schema.prisma
# → 0 hits
```

The only `submit` route is `apps/backend/src/api/routes/third-party.controller.ts:63` which submits an article to a Hashnode/Dev.to-style external blog, **not** an internal review.

The only `approve` is `apps/backend/src/api/routes/oauth.controller.ts:64` (`approveOrDeny`) — that's OAuth client approval, unrelated.

The marketplace path uses `submit()` in `posts.repository.ts:623-643` with `WAITING_CONFIRMATION`:

`libraries/nestjs-libraries/src/database/prisma/posts/posts.repository.ts:623-643`
```ts
async submit(id: string, order: string, buyerOrganizationId: string) {
  return this._post.model.post.update({
    where: { id },
    data: {
      submittedForOrderId: order,
      approvedSubmitForOrder: 'WAITING_CONFIRMATION',
      submittedForOrganizationId: buyerOrganizationId,
    },
    select: {
      id: true, description: true,
      submittedForOrder: { select: { messageGroupId: true } },
    },
  });
}
```

This is buyer-seller marketplace plumbing in the `SocialMediaAgency`/`Orders` models, not an editorial flow. Reviewers are right.

**Conclusion:** Lukas must build the editorial workflow himself. The `Comments` model (section 3) is the only existing primitive that can carry review feedback.

---

## 3. Comments on Posts — Already Exists, Underused

### 3.1 Schema

`libraries/nestjs-libraries/src/database/prisma/schema.prisma:373-391`
```prisma
model Comments {
  id             String       @id @default(uuid())
  content        String
  organizationId String
  postId         String
  userId         String
  createdAt      DateTime     @default(now())
  updatedAt      DateTime     @updatedAt
  deletedAt      DateTime?
  organization   Organization @relation(fields: [organizationId], references: [id])
  post           Post         @relation(fields: [postId], references: [id])
  user           User         @relation(fields: [userId], references: [id])

  @@index([createdAt])
  @@index([postId])
}
```

### 3.2 Endpoints

Authenticated create — `apps/backend/src/api/routes/posts.controller.ts:71-79`
```ts
@Post('/:id/comments')
async createComment(
  @GetOrgFromRequest() org: Organization,
  @GetUserFromRequest() user: User,
  @Param('id') id: string,
  @Body() body: { comment: string },
) {
  return this._postsService.createComment(org.id, user.id, id, body.comment);
}
```

Public (no-auth) read — `apps/backend/src/api/routes/public.controller.ts:76-79`
```ts
@Get(`/posts/:id/comments`)
async getComments(@Param('id') postId: string) {
  return { comments: await this._postsService.getComments(postId) };
}
```

### 3.3 Service / repository

Service pass-through — `posts.service.ts:1003-1010`:
```ts
createComment(orgId: string, userId: string, postId: string, comment: string) {
  return this._postRepository.createComment(orgId, userId, postId, comment);
}
```

Repository — `posts.repository.ts:818-832`:
```ts
createComment(orgId: string, userId: string, postId: string, content: string) {
  return this._comments.model.comments.create({
    data: { organizationId: orgId, userId, postId, content },
  });
}
```

**Plug-in point for comment-triggered re-gen:** The `PostsService.createComment` method (line 1003) is the perfect hook. Add logic AFTER the repo write to:
1. Read post current `state`.
2. If state is `REVIEW` and comment came from a reviewer → flip state to `REGEN`.
3. Enqueue a Temporal workflow `regeneratePostWorkflow(postId, comment.id)` that:
   - Loads brand-voice MD files.
   - Calls `OpenaiService` (or new `BrandVoiceService`) with feedback + brand voice as system prompt.
   - Updates `Post.content` via `posts.repository`.
   - Flips state back to `REVIEW`.
   - Optionally fires a webhook (section 4).

---

## 4. Webhooks

### 4.1 Schema

`libraries/nestjs-libraries/src/database/prisma/schema.prisma:593-606`
```prisma
model Webhooks {
  id             String                 @id @default(uuid())
  name           String
  organizationId String
  url            String
  deletedAt      DateTime?
  createdAt      DateTime               @default(now())
  updatedAt      DateTime               @updatedAt
  integrations   IntegrationsWebhooks[]
  organization   Organization           @relation(fields: [organizationId], references: [id])
}
```

Junction table `IntegrationsWebhooks` (line 581) lets a webhook subscribe to specific integrations — but **NOT** to specific lifecycle events. There is no `event` column.

### 4.2 Settings UI / CRUD — fully implemented

`apps/backend/src/api/routes/webhooks.controller.ts:23-69`
```ts
@Controller('/webhooks')
export class WebhookController {
  constructor(private _webhooksService: WebhooksService) {}

  @Get('/')   getStatistics(@GetOrgFromRequest() org)
  @Post('/')  @CheckPolicies([..., Sections.WEBHOOKS])
              createAWebhook(@GetOrgFromRequest() org, @Body() body: WebhooksDto)
  @Put('/')   updateWebhook(@GetOrgFromRequest() org, @Body() body: UpdateDto)
  @Delete('/:id') deleteWebhook(@GetOrgFromRequest() org, @Param('id') id)
  @Post('/send') sendWebhook(@Body() body, @Query() query: OnlyURL)
}
```

DTO with SSRF guard — `libraries/nestjs-libraries/src/dtos/webhooks/webhooks.dto.ts:11-30`:
```ts
export class WebhooksDto {
  id: string;
  @IsString() @IsDefined() name: string;
  @IsString() @IsUrl() @IsDefined()
  @IsSafeWebhookUrl({ message: '...must be public HTTPS...' })
  url: string;
  @Type(() => WebhooksIntegrationDto) @IsDefined()
  integrations: WebhooksIntegrationDto[];
}
```

### 4.3 What actually fires — ONE event only: post-published

The single firing site is the Temporal post workflow:

`apps/orchestrator/src/workflows/post-workflows/post.workflow.v1.0.2.ts:31-45`
```ts
const {
  getPostsList, inAppNotification, changeState, updatePost,
  sendWebhooks, isCommentable,
} = proxyActivities<PostActivity>({...});
```

`apps/orchestrator/src/workflows/post-workflows/post.workflow.v1.0.2.ts:243-248`
```ts
// send webhooks for the post
await sendWebhooks(
  postsResults[0].postId,
  post.organizationId,
  post.integration.id,
);
```

The `sendWebhooks` activity body — `apps/orchestrator/src/activities/post.activity.ts:257-284`:
```ts
@ActivityMethod()
async sendWebhooks(postId: string, orgId: string, integrationId: string) {
  const webhooks = (await this._webhookService.getWebhooks(orgId)).filter((f) => {
    return (
      f.integrations.length === 0 ||
      f.integrations.some((i) => i.integration.id === integrationId)
    );
  });

  const post = await this._postService.getPostByForWebhookId(postId);
  return Promise.all(
    webhooks.map(async (webhook) => {
      try {
        await fetch(webhook.url, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(post),
        });
      } catch (e) { /**empty**/ }
    }),
  );
}
```

**Verdict on issue #1191:** Confirmed. Webhooks fire **only** on successful publish. There is no event for `state changed`, `comment added`, `error`, `draft created`, etc. The infrastructure (URL storage, SSRF-safe sender, integration filter) exists; **only the trigger sites are missing**.

**Plug-in points to add new webhook events:**
1. Augment `Webhooks` model with an `events: String[]` column (or JSON `subscribedEvents`).
2. Replace the activity body's filter to also check the event type.
3. Call `sendWebhooks(postId, orgId, integrationId, eventType)` from:
   - `posts.repository.ts:385` (`changeState`) → `post.state.changed`
   - `posts.repository.ts:824` (`createComment`) → `post.comment.created`
   - `posts.service.ts:734` (`createPost`) → `post.created`
   - Your new re-gen workflow → `post.regenerated`

---

## 5. AI / LLM Stack

Postiz has **three independent AI subsystems**, all OpenAI-only:

### 5.1 OpenaiService — direct API calls

`libraries/nestjs-libraries/src/openai/openai.service.ts:7-9`
```ts
const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY || 'sk-proj-',
});
```

Models hardcoded everywhere as **`gpt-4.1`** for text and **`dall-e-3`** for images (lines 26, 38, 59, 93, 109, 147, 167, 200, 237). No Anthropic/Gemini.

Methods:
- `generateImage(prompt, isUrl, isVertical)` — line 21
- `generatePromptForPicture(prompt)` — line 34, has hardcoded system prompt: `"You are an assistant that take a description and style and generate a prompt..."`
- `generateVoiceFromText(prompt)` — line 55
- `generatePosts(content)` — line 76, hardcoded "Generate a Twitter post from the content without emojis..."
- `extractWebsiteText(content)` — line 134
- `separatePosts(content, len)` — line 155 (thread splitting with shrink loop)
- `generateSlidesFromText(text)` — line 229

`libraries/nestjs-libraries/src/openai/openai.service.ts:76-110` (representative system prompt)
```ts
async generatePosts(content: string) {
  const posts = (await Promise.all([
    openai.chat.completions.create({
      messages: [
        { role: 'assistant',
          content: 'Generate a Twitter post from the content without emojis in the following JSON format: { "post": string } put it in an array with one element' },
        { role: 'user', content: content! },
      ],
      n: 5, temperature: 1, model: 'gpt-4.1',
    }),
    openai.chat.completions.create({
      messages: [
        { role: 'assistant',
          content: 'Generate a thread for social media in the following JSON format: Array<{ "post": string }> without emojis' },
        { role: 'user', content: content! },
      ],
      n: 5, temperature: 1, model: 'gpt-4.1',
    }),
  ])).flatMap((p) => p.choices);
  ...
}
```

**Brand-voice plug-in target:** Every method has an inline string system prompt. To inject Husatech brand voice you have two clean options:
- **Wrap with a `BrandVoicePromptService`** that prepends MD content from `~/company/brand/*` to every system message.
- **Subclass `OpenaiService`** as `BrandAwareOpenaiService` and rebind in `database.module.ts:80` (the only module that registers it).

### 5.2 AgentGraphService — LangGraph multi-step generator

`libraries/nestjs-libraries/src/agent/agent.graph.service.ts:1-33`
```ts
import { ChatOpenAI, DallEAPIWrapper } from '@langchain/openai';
import { TavilySearch } from '@langchain/tavily';
...
const tools = !process.env.TAVILY_API_KEY ? [] : [new TavilySearch({ maxResults: 3 })];
const toolNode = new ToolNode(tools);

const model = new ChatOpenAI({
  apiKey: process.env.OPENAI_API_KEY || 'sk-proj-',
  model: 'gpt-4.1', temperature: 0.7,
});

const dalle = new DallEAPIWrapper({
  apiKey: process.env.OPENAI_API_KEY || 'sk-proj-',
  model: 'dall-e-3',
});
```

The graph has a fixed shape — `agent.graph.service.ts:373-403`:
```ts
start(orgId: string, body: GeneratorDto) {
  const state = AgentGraphService.state();
  const workflow = state
    .addNode('agent', this.startCall.bind(this))
    .addNode('research', toolNode)
    .addNode('save-research', this.saveResearch.bind(this))
    .addNode('find-category', this.findCategories.bind(this))
    .addNode('find-topic', this.findTopic.bind(this))
    .addNode('find-popular-posts', this.findPopularPosts.bind(this))
    .addNode('generate-hook', this.generateHook.bind(this))
    .addNode('generate-content', this.generateContent.bind(this))
    .addNode('generate-content-fix', this.fixArray.bind(this))
    .addNode('generate-picture', this.generatePictures.bind(this))
    .addNode('upload-pictures', this.uploadPictures.bind(this))
    .addNode('post-time', this.postDateTime.bind(this))
    .addEdge(START, 'agent')
    .addEdge('agent', 'research')
    .addEdge('research', 'save-research')
    .addEdge('save-research', 'find-category')
    .addEdge('find-category', 'find-topic')
    .addEdge('find-topic', 'find-popular-posts')
    .addEdge('find-popular-posts', 'generate-hook')
    .addEdge('generate-hook', 'generate-content')
    .addEdge('generate-content', 'generate-content-fix')
    .addConditionalEdges('generate-content-fix', this.isGeneratePicture.bind(this))
    .addEdge('generate-picture', 'upload-pictures')
    .addEdge('upload-pictures', 'post-time')
    .addEdge('post-time', END);

  const app = workflow.compile();
  return app.streamEvents({...}, { streamMode: 'values', version: 'v2' });
}
```

Used by `apps/backend/src/api/routes/posts.controller.ts:190-203` — `POST /posts/generator` (NDJSON streaming response).

Inline system prompts (lines 215-241, 259-292) — same brand-voice override target as 5.1.

`libraries/nestjs-libraries/src/agent/agent.graph.service.ts:215-241` (hook prompt)
```ts
const { hook: outputHook } = await ChatPromptTemplate.fromTemplate(`
    You are an assistant that gets content for a social media post, and generate only the hook.
    The hook is the 1-2 sentences of the post that will be used to grab the attention of the reader.
    You will be provided existing hooks you should use as inspiration.
    - Avoid weird hook that starts with "Discover the secret...", "The best...", "The most...", "The top..."
    - Make sure it sounds ${state.tone}
    - Use ${state.tone === 'personal' ? '1st' : '3rd'} person mode
    - Make sure it's engaging
    - Don't be cringy
    - Use simple english
    - Make sure you add "\n" between the lines
    - Don't take the hook from "request of the user"
    ...
`)
```

There is also a public, API-key-gated entry point at `apps/backend/src/api/routes/public.controller.ts:44-54`:
```ts
@Post('/agent')
async createAgent(@Body() body: { text: string; apiKey: string }) {
  if (!body.apiKey || !process.env.AGENT_API_KEY || body.apiKey !== process.env.AGENT_API_KEY) return;
  return this._agentGraphInsertService.newPost(body.text);
}
```

Module wiring: `libraries/nestjs-libraries/src/agent/agent.module.ts:7`
```ts
providers: [AgentGraphService, AgentGraphInsertService],
```

### 5.3 Mastra agent — chat copilot exposed via MCP

`libraries/nestjs-libraries/src/chat/mastra.service.ts:1-26`
```ts
@Injectable()
export class MastraService {
  static mastra: Mastra;
  constructor(private _loadToolsService: LoadToolsService) {}
  async mastra() {
    MastraService.mastra =
      MastraService.mastra ||
      new Mastra({
        storage: pStore,
        agents: { postiz: await this._loadToolsService.agent() },
        logger: new ConsoleLogger({ level: 'info' }),
      });
    return MastraService.mastra;
  }
}
```

The agent definition with the **system instructions template** — `libraries/nestjs-libraries/src/chat/load.tools.service.ts:43-102`:
```ts
async agent() {
  const tools = await this.loadTools();
  return new Agent({
    id: 'postiz',
    name: 'postiz',
    description: 'Agent that helps manage and schedule social media posts for users',
    instructions: ({ requestContext }) => {
      const ui: string = requestContext.get('ui' as never);
      return `
      Global information:
        - Date (UTC): ${dayjs().format('YYYY-MM-DD HH:mm:ss')}

      You are an agent that helps manage and schedule social media posts for users, you can:
        - Schedule posts into the future, or now, adding texts, images and videos
        - Generate pictures for posts
        - Generate videos for posts
        - Generate text for posts
        - Show global analytics about socials
        - List integrations (channels)
      ...
`;
    },
    model: openai('gpt-5.2'),
    tools,
    memory: new Memory({ storage: pStore, options: { generateTitle: true, workingMemory: { enabled: true, schema: AgentState }}}),
  });
}
```

**This is the cleanest brand-voice plug-in point** — `instructions` is a function that gets `requestContext`. Append `cat ~/company/brand/*.md` content here and every chat message + every MCP tool call respects the brand voice.

Tool list — `libraries/nestjs-libraries/src/chat/tools/tool.list.ts:10-19`:
```ts
export const toolList = [
  IntegrationListTool,
  IntegrationValidationTool,
  IntegrationTriggerTool,
  IntegrationSchedulePostTool,
  GenerateVideoOptionsTool,
  VideoFunctionTool,
  GenerateVideoTool,
  GenerateImageTool,
];
```

Adding a new tool = drop a class implementing `AgentToolInterface` (see `IntegrationSchedulePostTool` at `libraries/nestjs-libraries/src/chat/tools/integration.schedule.post.ts:23-30`) and append it to `toolList`. Lukas can add a `BrandRegenerateTool`.

---

## 6. Image Generation

Three providers wired:

### 6.1 OpenAI DALL-E (default)

- Direct API: `libraries/nestjs-libraries/src/openai/openai.service.ts:21-32` — `dall-e-3`, returns URL or base64.
- LangChain wrapper: `libraries/nestjs-libraries/src/agent/agent.graph.service.ts:30-33` — used in the LangGraph generator.
- LangChain wrapper #2: `libraries/nestjs-libraries/src/database/prisma/autopost/autopost.service.ts:44` (`autopost.activity`).

### 6.2 Fal.ai (used for slide videos only)

`libraries/nestjs-libraries/src/openai/fal.service.ts:1-41`
```ts
@Injectable()
export class FalService {
  async generateImageFromText(model: string, text: string, isVertical = false): Promise<string> {
    const { images, video, ...all } = await (
      await limit(() =>
        fetch(`https://fal.run/fal-ai/${model}`, {
          method: 'POST',
          headers: {
            Authorization: `Key ${process.env.FAL_KEY}`,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            prompt: text, aspect_ratio: isVertical ? '9:16' : '16:9',
            resolution: '720p', num_images: 1,
            output_format: 'jpeg', expand_prompt: true,
          }),
        })
      )
    ).json();
    if (video) return video.url;
    return images[0].url as string;
  }
}
```

Only consumed by `libraries/nestjs-libraries/src/videos/images-slides/images.slides.ts:84` (slide-to-video pipeline).

### 6.3 Veo 3 (Google video)

Module: `libraries/nestjs-libraries/src/videos/veo3/` (separate video provider).

### 6.4 How images attach to posts

`MediaService.generateImage` is the single entry — `libraries/nestjs-libraries/src/database/prisma/media/media.service.ts:35-53`:
```ts
async generateImage(prompt: string, org: Organization, generatePromptFirst?: boolean) {
  const generating = await this._subscriptionService.useCredit(
    org, 'ai_images',
    async () => {
      if (generatePromptFirst) {
        prompt = await this._openAi.generatePromptForPicture(prompt);
      }
      return this._openAi.generateImage(prompt, !!generatePromptFirst);
    },
  );
  return generating;
}
```

Used by:
- `libraries/nestjs-libraries/src/chat/tools/generate.image.tool.ts:42` (Mastra tool).
- `apps/backend/src/api/routes/media.controller.ts` (frontend calls it).

Image then saved as `Media` row, attached to `Post.image` (string URL on the Post, see schema line 408) or in the per-platform `value[].image[]` JSON.

**Brand-image plug-in:** Override `OpenaiService.generatePromptForPicture` (line 34) to inject brand visual style guide.

---

## 7. Postiz-Agent CLI / OAuth Device Flow

There is **NO device flow**. Postiz uses standard **OAuth 2.0 authorization code with PKCE** (S256), exposed via the MCP layer. The "agent CLI" is the existing MCP servers (Claude Code, Cursor, Codex, etc.) connecting via OAuth or Bearer API key.

### 7.1 OAuth 2.0 endpoints

`apps/backend/src/api/routes/oauth.controller.ts:18-55`
```ts
@ApiTags('OAuth')
@Controller('/oauth')
export class OAuthController {
  constructor(private _oauthService: OAuthService) {}

  @Get('/authorize')
  async authorize(@Query() query: AuthorizeOAuthQueryDto) {
    const app = await this._oauthService.validateAuthorizationRequest(query.client_id);
    return {
      app: { name: app.name, description: app.description, picture: app.picture,
             clientId: app.clientId, redirectUrl: app.redirectUrl },
      state: query.state,
    };
  }

  @Post('/token')
  async token(@Body() body: TokenExchangeDto) {
    if (body.grant_type !== 'authorization_code') {
      throw new HttpException({ error: 'unsupported_grant_type' }, HttpStatus.BAD_REQUEST);
    }
    return this._oauthService.exchangeCodeForToken(body.code, body.client_id, body.client_secret);
  }
}
```

Authorization code creation — `oauth.controller.ts:60-95`:
```ts
@Controller('/oauth')
export class OAuthAuthorizedController {
  @Post('/authorize')
  async approveOrDeny(@Body() body: ApproveOAuthDto, @GetUserFromRequest() user, @GetOrgFromRequest() org) {
    const app = await this._oauthService.validateAuthorizationRequest(body.client_id);
    if (body.action === 'deny') { ... }
    const code = await this._oauthService.createAuthorizationCode(app.id, user.id, org.id);
    const redirectUrl = new URL(app.redirectUrl);
    redirectUrl.searchParams.set('code', code);
    if (body.state) redirectUrl.searchParams.set('state', body.state);
    return { redirect: redirectUrl.toString() };
  }
}
```

App registration UI/CRUD — `apps/backend/src/api/routes/oauth-app.controller.ts:14-54`:
```ts
@Controller('/user/oauth-app')
export class OAuthAppController {
  @Get('/')   getApp(@GetOrgFromRequest() org)
  @Post('/')  createApp(@GetOrgFromRequest() org, @Body() body: CreateOAuthAppDto)
  @Put('/')   updateApp(@GetOrgFromRequest() org, @Body() body: UpdateOAuthAppDto)
  @Delete('/') deleteApp(@GetOrgFromRequest() org)
  @Post('/rotate-secret') rotateSecret(@GetOrgFromRequest() org)
}
```

Approved apps list (per user) — `apps/backend/src/api/routes/approved-apps.controller.ts:9-24`.

Tokens prefixed with `pos_`, schema models `OAuthApp` (line 843) and `OAuthAuthorization` (line 865).

### 7.2 MCP server registration (the actual "agent" surface)

`libraries/nestjs-libraries/src/chat/start.mcp.ts:21-46`
```ts
export const startMcp = async (app: INestApplication) => {
  const mastraService = app.get(MastraService, { strict: false });
  const organizationService = app.get(OrganizationService, { strict: false });
  const oauthService = app.get(OAuthService, { strict: false });

  const resolveAuth = async (token: string) => {
    if (token.startsWith('pos_')) {
      const authorization = await oauthService.getOrgByOAuthToken(token);
      if (!authorization) return null;
      return authorization.organization;
    }
    return organizationService.getOrgByApiKey(token);
  };

  const mastra = await mastraService.mastra();
  const agent = mastra.getAgent('postiz');
  const tools = await agent.listTools();
  const serverConfig = { name: 'Postiz MCP', version: '1.0.0', tools, agents: { postiz: agent } };
  const server = new MCPServer(serverConfig);
  ...
};
```

Three transport surfaces are mounted — `start.mcp.ts:97-266`:
- `/mcp-oauth` — OAuth 2.0 token validation (`Bearer pos_...`)
- `/mcp` — Bearer-header auth (API key OR OAuth token)
- `/mcp/:id` — API key as URL path segment (legacy)
- `/sse/:id`, `/message/:id` — Legacy SSE transport

OAuth metadata endpoints — `start.mcp.ts:75-95`:
```ts
app.use('/.well-known/oauth-authorization-server', async (req, res) => {
  ...
  res.json({
    issuer: process.env.NEXT_PUBLIC_BACKEND_URL,
    authorization_endpoint: `${process.env.FRONTEND_URL}/oauth/authorize`,
    token_endpoint: `.../oauth/token`,
    response_types_supported: ['code'],
    grant_types_supported: ['authorization_code'],
    code_challenge_methods_supported: ['S256'],
    scopes_supported: ['mcp:read', 'mcp:write'],
  });
});
```

### 7.3 The frontend client config helper

`apps/frontend/src/components/public-api/public.component.tsx:30-160` builds the per-MCP-client config string for Claude Code, Cursor, VS Code, Codex, Gemini CLI, Warp, etc. — both API-key and OAuth flavors.

`apps/frontend/src/components/public-api/public.component.tsx:42-46`
```ts
case 'Claude Code':
  return {
    config: `claude mcp add postiz --transport http "${urlWithKey}"`,
    hint: 'Run this command in your terminal.',
  };
```

**Plug-in point for postiz-agent CLI:** A custom CLI authenticates via the existing flow:
1. Register an OAuthApp via `POST /user/oauth-app`.
2. Open browser to `${FRONTEND_URL}/oauth/authorize?client_id=...&state=...&code_challenge=...&code_challenge_method=S256`.
3. Exchange code at `POST /oauth/token`.
4. Use returned `pos_*` token as `Authorization: Bearer` for MCP `/mcp` endpoint.

No new backend code needed for a CLI client.

---

## 8. Public API Endpoints (apps/backend/src/public-api/routes/v1)

Single controller, all routes under `/public/v1/*`, all auth via API-key header (the `@GetOrgFromRequest()` decorator resolves `Organization` from the API key).

`apps/backend/src/public-api/routes/v1/public.integrations.controller.ts:62-74`
```ts
@ApiTags('Public API')
@Controller('/public/v1')
export class PublicIntegrationsController {
  private storage = UploadFactory.createStorage();
  constructor(
    private _integrationService: IntegrationService,
    private _postsService: PostsService,
    private _mediaService: MediaService,
    private _notificationService: NotificationService,
    private _integrationManager: IntegrationManager,
    private _refreshIntegrationService: RefreshIntegrationService,
  ) {}
```

Full route list (all `/public/v1` prefix):

| Method | Path | DTO | Service |
|---|---|---|---|
| POST | `/upload` | `multer file` | `MediaService.saveFile` |
| POST | `/upload-from-url` | `UploadDto` | `MediaService.saveFile` |
| GET | `/find-slot/:id` | – | `PostsService.findFreeDateTime` |
| GET | `/posts` | `GetPostsDto` | `PostsService.getPosts` |
| POST | `/posts` | raw body → `CreatePostDto` | `PostsService.createPost` (line 159) |
| DELETE | `/posts/:id` | – | `PostsService.deletePost` |
| DELETE | `/posts/group/:group` | – | `PostsService.deletePost` |
| GET | `/is-connected` | – | `{ connected: true }` |
| GET | `/integrations` | – | `IntegrationService.getIntegrationsList` |
| GET | `/social/:integration` | `?refresh=` | `integrationProvider.generateAuthUrl` |
| GET | `/notifications` | `GetNotificationsDto` | `NotificationService.getNotificationsPaginated` |
| POST | `/generate-video` | `VideoDto` | `MediaService.generateVideo` |
| POST | `/video/function` | `VideoFunctionDto` | `MediaService.videoFunction` |
| DELETE | `/integrations/:id` | – | `IntegrationService.deleteChannel` |
| GET | `/integration-settings/:id` | – | returns rules+schemas+tools |
| GET | `/posts/:id/missing` | – | `PostsService.getMissingContent` |
| **PUT** | **`/posts/:id/status`** | **`ChangePostStatusDto`** | **`PostsService.changePostStatus`** ← **draft↔schedule toggle** |
| PUT | `/posts/:id/release-id` | `{ releaseId }` | `PostsService.updateReleaseId` |
| GET | `/analytics/:integration` | `?date=` | `IntegrationService.checkAnalytics` |
| GET | `/analytics/post/:postId` | `?date=` | `PostsService.checkPostAnalytics` |
| POST | `/integration-trigger/:id` | `{ methodName, data }` | platform-specific `@PostiTool` method (line 428) |

Notable ones for Lukas's workflow:

`apps/backend/src/public-api/routes/v1/public.integrations.controller.ts:159-193` (createPost — supports `type: 'draft'`):
```ts
@Post('/posts')
@CheckPolicies([AuthorizationActions.Create, Sections.POSTS_PER_MONTH])
async createPost(@GetOrgFromRequest() org, @Body() rawBody: any) {
  Sentry.metrics.count('public_api-request', 1);
  const body = await this._postsService.mapTypeToPost(rawBody, org.id, rawBody.type === 'draft');
  body.type = rawBody.type;
  if (process.env.RESTRICT_UPLOAD_DOMAINS && ...) {
    throw new HttpException({...}, 400);
  }
  return this._postsService.createPost(org.id, body);
}
```

`apps/backend/src/public-api/routes/v1/public.integrations.controller.ts:388-396` (status toggle):
```ts
@Put('/posts/:id/status')
async changePostStatus(@GetOrgFromRequest() org, @Param('id') id, @Body() body: ChangePostStatusDto) {
  Sentry.metrics.count('public_api-request', 1);
  return this._postsService.changePostStatus(org.id, id, body.status);
}
```

`apps/backend/src/public-api/routes/v1/public.integrations.controller.ts:428-507` (the `integration-trigger` endpoint — calls per-platform tools decorated with `@PostiTool`, used by AI agents):
```ts
@Post('/integration-trigger/:id')
async triggerIntegrationTool(
  @GetOrgFromRequest() org, @Param('id') id,
  @Body() body: { methodName: string; data: Record<string, string> },
) {
  ...
  const tools = this._integrationManager.getAllTools();
  if (!tools[integrationProvider.identifier]?.some((p) => p.methodName === body.methodName) ||
      !integrationProvider[body.methodName]) {
    throw new HttpException({ msg: 'Tool not found' }, 404);
  }
  while (true) {
    try {
      const result = await integrationProvider[body.methodName](
        getIntegration.token, body.data || {},
        getIntegration.internalId, getIntegration,
      );
      return { output: result };
    } catch (err) {
      if (err instanceof RefreshToken) { ... continue; }
      throw new HttpException({ msg: 'Unexpected error' }, 500);
    }
  }
}
```

There is **NO** `POST /public/v1/posts/:id/comments`, **NO** `POST /public/v1/posts/:id/regenerate`, **NO** `GET /public/v1/posts/:id` single-post fetch. Lukas's workflow needs these added.

---

## 9. Scheduling: Temporal Workflows (no Bull, no cron)

### 9.1 Architecture

- `apps/orchestrator` is a separate NestJS app whose only purpose is to run Temporal workflows + activities. It exposes only `/health`. See `apps/orchestrator/src/main.ts:13-22`.
- All scheduled work goes through Temporal (`@temporalio/client`, `@temporalio/workflow`, `nestjs-temporal-core`).
- Module wiring: `apps/orchestrator/src/app.module.ts:10-25`:
  ```ts
  const activities = [PostActivity, AutopostService, EmailActivity, IntegrationsActivity];
  @Module({
    imports: [DatabaseModule, getTemporalModule(true, require.resolve('./workflows'), activities)],
    controllers: [HealthController],
    providers: [...activities],
    ...
  })
  ```

### 9.2 Workflows registered

`apps/orchestrator/src/workflows/index.ts:1-9`
```ts
export * from './post-workflows/post.workflow.v1.0.1';
export * from './post-workflows/post.workflow.v1.0.2';
export * from './autopost.workflow';
export * from './digest.email.workflow';
export * from './missing.post.workflow';
export * from './send.email.workflow';
export * from './refresh.token.workflow';
export * from './streak.workflow';
```

### 9.3 Post publish workflow — `postWorkflowV102`

Started from `PostsService.startWorkflow` — `libraries/nestjs-libraries/src/database/prisma/posts/posts.service.ts:706-731`:
```ts
await this._temporalService.client.getRawClient()
  ?.workflow.start('postWorkflowV102', {
    workflowId: `post_${postId}`,
    taskQueue: 'main',
    workflowIdConflictPolicy: 'TERMINATE_EXISTING',
    args: [{ taskQueue, postId, organizationId: orgId }],
    typedSearchAttributes: new TypedSearchAttributes([
      { key: postIdSearchParam, value: postId },
      { key: organizationId, value: orgId },
    ]),
  });
```

Workflow — `apps/orchestrator/src/workflows/post-workflows/post.workflow.v1.0.2.ts:51-96`:
```ts
export async function postWorkflowV102({ taskQueue, postId, organizationId, postNow = false }) {
  const { postSocial, postComment, getIntegrationById, refreshTokenWithCause,
          internalPlugs, globalPlugs, processInternalPlug, processPlug } = proxyTaskQueue(taskQueue);
  let poked = false;
  setHandler(poke, () => { poked = true; });

  const startTime = new Date();
  const postsListBefore = await getPostsList(organizationId, postId);
  const [post] = postsListBefore;

  if (!post || (!postNow && post.state !== 'QUEUE')) return;

  if (!postNow) {
    await sleep(
      dayjs(post.publishDate).isBefore(dayjs())
        ? 0
        : dayjs(post.publishDate).diff(dayjs(), 'millisecond'),
    );
  }
  ...
}
```

Note line 85: workflow exits immediately if `state !== 'QUEUE'`. **Adding a new state requires adding it to this guard** OR keeping `QUEUE` as the publish-trigger state and using a separate column for editorial state.

### 9.4 Recurring "scan for missed posts" — Temporal infinite-sleep pattern

Postiz does not use Temporal Schedules; it uses an infinite-loop workflow:

`libraries/nestjs-libraries/src/temporal/infinite.workflow.register.ts:8-19`
```ts
async onModuleInit(): Promise<void> {
  if (!!process.env.RUN_CRON) {
    try {
      await this._temporalService.client?.getRawClient()
        ?.workflow?.start('missingPostWorkflow', {
          workflowId: 'missing-post-workflow',
          taskQueue: 'main',
        });
    } catch (err) {}
  }
}
```

`apps/orchestrator/src/workflows/missing.post.workflow.ts:13-19`
```ts
export async function missingPostWorkflow() {
  await searchForMissingThreeHoursPosts();
  while (true) {
    await sleep('1 hour');
    await searchForMissingThreeHoursPosts();
  }
}
```

Same pattern for `autoPostWorkflow` (1-hour loop):

`apps/orchestrator/src/workflows/autopost.workflow.ts:14-30`
```ts
export async function autoPostWorkflow({ id, immediately }: { id: string; immediately: boolean }) {
  while (true) {
    try { if (immediately) await autoPost(id); } catch (err) {}
    immediately = true;
    await sleep(3600000);
  }
}
```

**No cron, no Bull queue.** Redis is used (`ioRedis` in `libraries/nestjs-libraries/src/redis/redis.service.ts`) only for session-scoped state (OAuth code verifiers, integration auth state) — not for queueing.

### 9.5 Search attributes

`libraries/nestjs-libraries/src/temporal/temporal.register.ts:21` — registers `organizationId` and `postId` as Temporal custom search attributes so workflows can be queried/cancelled by post.

**Plug-in for re-gen workflow:** Add a new file `apps/orchestrator/src/workflows/regenerate.post.workflow.ts`, export it from `index.ts`, and create the matching activity. Trigger from `createComment` service hook.

---

## 10. Customization / Extension Points

### 10.1 Social provider plugins

`libraries/nestjs-libraries/src/integrations/integration.manager.ts:40-75`
```ts
export const socialIntegrationList: Array<SocialAbstract & SocialProvider> = [
  new XProvider(),
  new LinkedinProvider(),
  new LinkedinPageProvider(),
  ...
  new MeweProvider(),
];
```

To add a custom channel: implement `SocialAbstract & SocialProvider`, push into this array. No DI needed.

### 10.2 Tool decorators (per-provider methods callable from AI / public API)

`libraries/nestjs-libraries/src/integrations/tool.decorator.ts` defines `@PostiTool` (also `@Plug`, `@InternalPlug`). The IntegrationManager harvests them via `Reflect.getMetadata`:

`libraries/nestjs-libraries/src/integrations/integration.manager.ts:94-114`
```ts
getAllTools(): { [key: string]: { description: string; dataSchema: any; methodName: string; }[] } {
  return socialIntegrationList.reduce((all, current) => ({
    ...all,
    [current.identifier]:
      Reflect.getMetadata('custom:tool', current.constructor.prototype) || [],
  }), {});
}

getAllRulesDescription(): { [key: string]: string } {
  return socialIntegrationList.reduce((all, current) => ({
    ...all,
    [current.identifier]:
      Reflect.getMetadata('custom:rules:description', current.constructor) || '',
  }), {});
}
```

Decorate any method on a provider with `@PostiTool({ description, dataSchema })` and it becomes callable via `POST /public/v1/integration-trigger/:id` (line 428) AND visible to the Mastra agent.

### 10.3 Rules description (per-platform AI guardrails)

`@RulesDescription('You must follow LinkedIn's algorithm policies...')` decorator on a provider class — collected by `getAllRulesDescription()` (line 116). This is **the per-platform brand-voice slot** if Lukas wants per-channel guardrails. The Mastra agent reads this in `getValidationSchemas` and `getAllRulesDescription` calls (see `apps/backend/src/public-api/routes/v1/public.integrations.controller.ts:336-377`).

### 10.4 MCP/Mastra tools

`libraries/nestjs-libraries/src/chat/tools/tool.list.ts:10-19` — append a class implementing `AgentToolInterface`. Reference example: `libraries/nestjs-libraries/src/chat/tools/integration.schedule.post.ts`.

### 10.5 Agent system prompt

`libraries/nestjs-libraries/src/chat/load.tools.service.ts:49-87` — single `instructions` template, gets `requestContext`. Inject `await fs.readFile('~/company/brand/voice.md')` here.

### 10.6 LangGraph generator nodes

`libraries/nestjs-libraries/src/agent/agent.graph.service.ts:373-403` — workflow assembly is in one `start()` method. Insert a new node `inject-brand-voice` between `find-popular-posts` and `generate-hook`.

### 10.7 Plug system (post-publish actions)

`Plugs` model (`schema.prisma:547`) and `IntegrationsWebhooks` (line 581) are the canonical post-publish action plumbing. The `@Plug` decorator + `@InternalPlug` are the registration mechanism (used for "repost when post hits 100 likes" etc., see `internalPlugs`/`globalPlugs` calls in `post.workflow.v1.0.2.ts:251-269`).

### 10.8 Third-party AI integrations

`apps/backend/src/api/routes/third-party.controller.ts` + `ThirdPartyManager` — for blog-publish targets (Hashnode, Dev.to). Not directly relevant but follows the same pattern Lukas could use for a custom "BrandVoice" third party.

### 10.9 No formal plugin system

There is no runtime plugin loader. Extensions = forking + adding files to `socialIntegrationList`, `toolList`, or new modules.

---

## 11. Brand-Voice Plug-in Strategy (Concrete Recipe)

Given the map above, the cleanest minimal-invasive integration:

1. **New service** `libraries/nestjs-libraries/src/openai/brand.voice.service.ts`:
   - Reads `~/company/brand/*.md` and `~/content/calendar/content-strategy.md` at startup, watches for changes.
   - Exposes `getSystemPrompt(channel?: string): string` returning the concatenated brand voice.

2. **Wrap `OpenaiService`** by changing every system message in `libraries/nestjs-libraries/src/openai/openai.service.ts` (lines 41, 62, 82, 99, 138, 170, 203, 232, 240, 263) to `${brandVoice.getSystemPrompt(channel)}\n\n${existing}`.

3. **Inject brand voice into Mastra agent** at `libraries/nestjs-libraries/src/chat/load.tools.service.ts:49`:
   ```ts
   instructions: ({ requestContext }) => {
     const ui = requestContext.get('ui' as never);
     const brand = brandVoiceService.getSystemPrompt();
     return `${brand}\n\n[Channel rules]...`;
   },
   ```

4. **Inject brand voice into LangGraph** at `libraries/nestjs-libraries/src/agent/agent.graph.service.ts:215, 259` (hook + content prompts).

5. **Add editorial state column** — Prisma migration adding `Post.editorialState` enum `EditorialState { DRAFT REVIEW REGEN APPROVED }` (don't touch the publish-state `State` enum).

6. **Add comment-triggered re-gen** in `libraries/nestjs-libraries/src/database/prisma/posts/posts.service.ts:1003`:
   ```ts
   async createComment(orgId, userId, postId, comment) {
     const result = await this._postRepository.createComment(orgId, userId, postId, comment);
     const post = await this._postRepository.getPostById(postId, orgId);
     if (post.editorialState === 'REVIEW') {
       await this._postRepository.setEditorialState(postId, 'REGEN');
       await this._temporalService.client.getRawClient()
         ?.workflow.start('regeneratePostWorkflow', {
           workflowId: `regen_${postId}_${result.id}`,
           taskQueue: 'main',
           args: [{ postId, orgId, commentId: result.id }],
         });
     }
     return result;
   }
   ```

7. **New workflow** `apps/orchestrator/src/workflows/regenerate.post.workflow.ts` with one activity: read post + comments, call `OpenaiService.generatePosts` (now brand-voice-aware), update `Post.content`, set `editorialState = REVIEW`, fire webhook.

8. **New webhook events** — extend `Webhooks` schema with `events: String[]`, fire from `changeState` and `createComment`.

9. **Public API additions**:
   - `POST /public/v1/posts/:id/comments` — for postiz-agent CLI to file feedback.
   - `PUT /public/v1/posts/:id/editorial-state` — for postiz-agent CLI to flip review/approved.
   - `POST /public/v1/posts/:id/regenerate` — explicit re-gen trigger.

---

## 12. Quick Reference: Files Lukas Will Touch

| Area | File | Line(s) | Why |
|---|---|---|---|
| Schema | `libraries/nestjs-libraries/src/database/prisma/schema.prisma` | 393, 593, 901 | Add `editorialState`, `Webhooks.events`, possibly extend `State` |
| State change hook | `libraries/nestjs-libraries/src/database/prisma/posts/posts.repository.ts` | 385 | Fire webhook on every state change |
| Comment hook | `libraries/nestjs-libraries/src/database/prisma/posts/posts.service.ts` | 1003 | Trigger re-gen workflow |
| Status DTO | `libraries/nestjs-libraries/src/dtos/posts/change.post.status.dto.ts` | 4 | Expand allowed statuses |
| Public API | `apps/backend/src/public-api/routes/v1/public.integrations.controller.ts` | 388 | Add endpoints for editorial flow |
| Webhook trigger | `apps/orchestrator/src/activities/post.activity.ts` | 257 | Event-typed webhook dispatch |
| OpenAI prompts | `libraries/nestjs-libraries/src/openai/openai.service.ts` | 41, 62, 82, 99, 138, 170, 203, 232 | Inject brand voice |
| Mastra prompt | `libraries/nestjs-libraries/src/chat/load.tools.service.ts` | 49 | Inject brand voice in chat agent |
| LangGraph prompts | `libraries/nestjs-libraries/src/agent/agent.graph.service.ts` | 215, 259 | Inject brand voice in generator |
| Image prompt | `libraries/nestjs-libraries/src/openai/openai.service.ts` | 41 | Brand visual style |
| New workflow | `apps/orchestrator/src/workflows/regenerate.post.workflow.ts` | NEW | Re-gen orchestration |
| Workflow registry | `apps/orchestrator/src/workflows/index.ts` | 1 | Export new workflow |
| New tool | `libraries/nestjs-libraries/src/chat/tools/regenerate.tool.ts` | NEW | Expose re-gen via MCP |
| Tool list | `libraries/nestjs-libraries/src/chat/tools/tool.list.ts` | 10 | Register new tool |
| Brand voice loader | `libraries/nestjs-libraries/src/openai/brand.voice.service.ts` | NEW | MD file reader |

---

*Map written: 2026-04-30 — workflow + AI integration only. Stack, structure, conventions, integrations are NOT covered here.*
