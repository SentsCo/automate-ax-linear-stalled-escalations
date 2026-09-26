# Flag customer escalations that have gone quiet in Linear

See open Linear escalations with no recent update in a weekday Slack digest, so the team can check their status before the customer has to chase it.

Customer escalations often need engineering work and account communication at the same time. When an issue sits without an update, no one may realize the customer is waiting.

This example checks every page of issues in one Linear team with your escalation label. Open issues with no update for your chosen number of days appear in a weekday Slack digest with their assignees and links. The digest reports the full count and shows the first 30. The team decides whether to get a status or contact the customer.

## Set it up with a coding agent

Copy the setup prompt from [the article](https://automate.ax/articles/linear-stalled-escalations) into your coding agent. The agent creates the Automate.ax project, asks for your choices, guides account authorization, checks the automation, and deploys it. You do not need to clone this repository yourself when using the prompt.

You'll choose:

- A Linear team, the label reserved for customer escalations, and the number of quiet days that warrants attention.
- A Slack channel where the responsible team checks daily status.
- Account authorization for Linear and Slack. Slack requires a paid workspace for the current Automate.ax connection.

## Manual setup

If you prefer to set it up yourself:

```sh
git clone https://github.com/SentsCo/automate-ax-linear-stalled-escalations.git
cd automate-ax-linear-stalled-escalations
bun install
bunx automate.ax login
bunx automate.ax init
bun run typecheck
bunx automate.ax deploy
```

Connect the accounts requested by Automate.ax when you deploy. The platform stores credentials outside this repository. Set any project parameters requested by the automation, then review the read and write operations before turning it on.

## Check a run

Run against a test escalation last updated beyond the threshold and a newer one. Confirm only the quiet issue appears and the link opens correctly.

## Limits

- The Slack message shows the first 30 quiet issues and the full count. Use the matching Linear view to review the rest when the queue is larger.
- A Linear update does not necessarily mean the customer received an update. This is an internal prompt to check status, not proof of communication.

The workflow responds to [a real problem described by a SaaS team's quiet customer escalations](https://www.reddit.com/r/SaaS/comments/1qql6qb). The public report informed the example; it is not an endorsement of this implementation.
