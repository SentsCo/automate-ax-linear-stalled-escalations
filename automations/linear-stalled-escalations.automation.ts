import { automation, defineAction, onSchedule, t } from "automate.ax"
import { getLinearApi } from "automate.ax/linear"
import { slack } from "automate.ax/slack"
import { z } from "zod"

const pageSchema = z.object({
  issues: z.object({
    nodes: z.array(
      z.object({
        identifier: z.string(),
        title: z.string(),
        url: z.url(),
        updatedAt: z.iso.datetime(),
        assignee: z.object({ name: z.string() }).nullable(),
        state: z.object({ type: z.string() }),
      }),
    ),
    pageInfo: z.object({
      hasNextPage: z.boolean(),
      endCursor: z.string().nullable(),
    }),
  }),
})

const findQuietEscalations = defineAction("Find quiet customer escalations")
  .account("linear", {
    connections: [
      { connectionMethodId: "oauth", requiredScope: "read" },
      { connectionMethodId: "api-key" },
    ],
  })
  .input(
    z.object({
      teamId: z.string(),
      labelId: z.string(),
      quietDays: z.number().int().positive(),
      asOf: z.iso.datetime(),
    }),
  )
  .output(z.object({ total: z.number(), lines: z.array(z.string()) }))
  .retry({ replaySafety: "safe" })
  .handler(async ({ account, input }) => {
    const cutoff = Date.parse(input.asOf) - input.quietDays * 86_400_000
    const api = getLinearApi(account.secret)
    let cursor: string | undefined
    let total = 0
    const lines: string[] = []

    do {
      const { issues } = await api.graphql(
        `query QuietEscalations($first: Int!, $after: String, $filter: IssueFilter) {
          issues(first: $first, after: $after, filter: $filter, orderBy: updatedAt) {
            nodes { identifier title url updatedAt assignee { name } state { type } }
            pageInfo { hasNextPage endCursor }
          }
        }`,
        {
          responseSchema: pageSchema,
          variables: {
            first: 50,
            ...(cursor && { after: cursor }),
            filter: {
              team: { id: { eq: input.teamId } },
              labels: { some: { id: { eq: input.labelId } } },
            },
          },
        },
      )
      for (const issue of issues.nodes) {
        if (
          issue.state.type === "completed" ||
          issue.state.type === "canceled" ||
          Date.parse(issue.updatedAt) > cutoff
        )
          continue
        total++
        if (lines.length < 30) {
          lines.push(
            `• ${issue.identifier} — ${issue.title} (${issue.assignee?.name ?? "unassigned"}): ${issue.url}`,
          )
        }
      }
      if (!issues.pageInfo.hasNextPage) break
      cursor = issues.pageInfo.endCursor ?? undefined
      if (!cursor)
        throw new Error("Linear returned another page without a cursor")
    } while (true)

    return { total, lines }
  })

export default automation(
  "Surface customer escalations that have gone quiet",
  {
    parameters: [
      { label: "Linear team ID", name: "linearTeamId", type: "text" },
      { label: "Escalation label ID", name: "escalationLabelId", type: "text" },
      { label: "Quiet days before alert", name: "quietDays", type: "text" },
      {
        label: "Slack escalation channel ID",
        name: "slackChannelId",
        type: "text",
      },
    ],
  },
  ({ parameters }) => {
    const quietDays = z.coerce
      .number()
      .int()
      .positive()
      .parse(parameters.quietDays)
    const tick = onSchedule({ schedule: "0 9 * * 1-5", timeZone: "UTC" })
    const stalled = findQuietEscalations({
      teamId: parameters.linearTeamId,
      labelId: parameters.escalationLabelId,
      quietDays,
      asOf: tick.scheduledAt.transform((date) => date.toISOString()),
    }).filter(({ total }) => total > 0)

    slack.sendMessage({
      conversation: parameters.slackChannelId,
      text: t`${stalled.total} customer escalations have had no Linear update for ${quietDays} days. Showing the first 30:\n${stalled.lines.transform((lines) => lines.join("\n"))}\nAsk the issue owner for a status and update the customer when you have one.`,
      unfurlLinks: false,
    })
  },
)
