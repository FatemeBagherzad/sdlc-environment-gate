# sdlc-environment-gate

A GitHub app that gates deployment environments on a change ticket. When a
workflow reaches an environment that has this app as a deployment protection
rule, GitHub holds the deployment and asks this app about it. The app finds the
change ticket number, reads that ticket in ServiceNow or Jira, and then lets the
deployment through, fails it, or keeps it waiting until the approved window
starts.

It does not approve anything itself. The approval is made by the people who
already make it, in ServiceNow or in Jira. This app only reads that decision and
holds the deployment to it.

There are three backends: `local`, `jira` and `servicenow`.

## Quick start

The fastest way to see it work: a public repository, the `local` backend and the
polling mode, so you need no public address for the app and no Jira or
ServiceNow account. About ten minutes.

**1. Make the GitHub app.** GitHub, **Settings** -> **Developer settings** ->
**GitHub Apps** -> **New GitHub App**. Any name will do. Under Webhook, untick
**Active**, the polling mode does not use it. Repository permissions:

| permission | level |
| --- | --- |
| Actions | Read-only |
| Contents | Read-only |
| Deployments | Read and write |
| Metadata | Read-only |
| Pull requests | Read and write |

Create it, write down the **App ID**, then **Generate a private key** and keep
the `.pem` file it downloads.

**2. Install it.** Same page, **Install App**, and pick one **public**
repository. Public matters here, a custom protection rule on a private
repository needs GitHub Enterprise.

**3. Turn it on for an environment.** In that repository, **Settings** ->
**Environments** -> **New environment**, call it `staging`, and under
**Deployment protection rules** tick your app.

**4. Give that repository a workflow.** Copy `examples/deployment-workflow.yml`
into its `.github/workflows/` and put `staging` as the environment.

**5. Run the gate on your machine.**

```bash
npm install
npm run build
```

Put this in a `.env` file next to the app:

```
GITHUB_APP_ID=123456
GITHUB_PRIVATE_KEY=<what "base64 -w0 your-key.pem" prints>
DISCOVERY_MODE=poll
GITHUB_ORG=<your github user name, or your organisation>
POLL_INTERVAL_SECONDS=15
BACKEND_MODE=local
LOCAL_TICKETS_PATH=./tickets
```

Then `npm start`. It prints `poller started` and asks GitHub every 15 seconds,
so nothing has to reach your machine.

**6. Write a ticket.**

```bash
echo "status: approved" > tickets/CHG0045123.txt
```

**7. Push something to that repository.**

```bash
git commit --allow-empty -m "CHG0045123 first try"
git push
```

The run stops at `staging` and continues within about 15 seconds. The deployment
and the pull request say which ticket was used and where it was read from.

**8. Now break it on purpose.**

```bash
git commit --allow-empty -m "deploy without a ticket"
git push
```

That one is rejected, and the run says no change ticket number was found. Put
`window_start` an hour from now into the ticket file and push again, and the run
will sit and wait instead, until the window opens.

The app writes one JSON line per decision with the whole reason in it, so the
terminal you started it in tells you what it did and why.

### When that works, point it at the real thing

Only the backend values change, nothing else. ServiceNow, on a free personal
developer instance:

```
BACKEND_MODE=servicenow
SERVICENOW_BASE_URL=https://dev12345.service-now.com
SERVICENOW_USERNAME=admin
SERVICENOW_PASSWORD=...
```

Jira, on a free cloud site:

```
BACKEND_MODE=jira
JIRA_BASE_URL=https://mysite.atlassian.net
JIRA_EMAIL=you@example.com
JIRA_API_TOKEN=...
JIRA_APPROVED_STATUSES=approved
```

The rest of this README is the detail behind those values.

## Where this sits in the change process

This app does not approve anything, and that is worth being clear about before
anybody installs it.

The approval is made where it is always made. Somebody raises a change in
ServiceNow, or a ticket in Jira, and whoever is allowed to approve it approves it
there, with a window. That record, who approved it and when, stays in that
system. This app reads it at the moment of the deployment and holds GitHub to it.

```
  ServiceNow / Jira             this app              GitHub
  the change, the         ->    reads it and    ->    holds the deployment,
  approval, the window          decides               then runs or fails it
```

Step by step:

1. Somebody raises the change in ServiceNow or Jira.
2. Whoever approves changes approves it there, with a start and an end.
3. A developer pushes, with the ticket number in the commit message or on the
   pull request.
4. The workflow reaches the environment and GitHub holds the deployment.
5. This app finds the ticket number, reads the ticket, and answers GitHub:
   - approved and inside the window, the job runs
   - approved but too early, keep waiting and look again in a minute
   - not approved, refused, or the window is over, the job fails with the reason
6. The reason ends up on the deployment, on the pull request and in the logs.

Who owns what:

| | owns |
| --- | --- |
| ServiceNow or Jira | the change record, the approval, the window |
| this app | reading them, and answering the one deployment it was asked about |
| GitHub | holding the deployment, and running or failing the job |

What it never does:

- it never creates, approves, changes or closes a ticket, it only reads
- it never approves anything in GitHub except the one deployment that is waiting
- it never decides on its own, if the ticket says no then the deployment fails

Two things follow from that, and they are usually the reason for having it.

**Nobody gets an approval button inside GitHub.** There is no reviewer list to
keep up to date, and somebody with write access to the repository cannot wave
their own deployment through, because the decision is not in the repository.

**The evidence is already in the right place.** The approval sits in the change
record with the name of whoever gave it, and GitHub keeps the deployment and the
message saying which ticket it was and where it was read from. Nobody has to
build a report out of two systems afterwards.

That is also why this is a protection rule and not a required reviewer. A
required reviewer asks a person to click something at deploy time, which is a
second approval on top of the one that already exists. This one reads the
approval that already exists.

## Which plans this works with

**This app is written for the free plans of GitHub, Jira and ServiceNow, and it
only uses API that those plans give you.** Nothing in here needs a paid Jira, a
paid ServiceNow plugin or GitHub Enterprise. That is on purpose, so that one
person can run the whole thing end to end without paying for anything.

The other side of that is what it does not do. The app does **not** support the
enterprise features of any of the three, and there is no half way support for
them either. If you are on a paid plan and you want the change management of
Jira Service Management, a real approval record, an approval API, a scoped
ServiceNow API or a protection rule on a private repository, you have to add
that yourself. It is not in here and it is not planned.

| product | written for | what that means here |
| --- | --- | --- |
| GitHub | Free plan, **public** repository | A custom deployment protection rule from a GitHub app only works on a public repository on the Free plan. A private or internal repository needs GitHub Enterprise, which this app does not cover. Everything else, the Actions API and the protection rule API, is the same on every plan. |
| Jira | Jira Cloud Free, up to 10 users | The approval is the **workflow status** of the issue, and the window end is the **due date** or a date field you create yourself. Jira Service Management change management, with its planned start and planned end fields, moved to the Premium plan, so it is not used and not read. |
| ServiceNow | free Personal Developer Instance | Only the **table API** and the base `change_request` table, with the `approval`, `state`, `start_date` and `end_date` fields that every instance has. No plugins, no scripted REST API, no flow designer. |

Authentication is the plain kind everywhere, because that is what the free plans
hand out: a GitHub app private key, a Jira email plus API token, and a
ServiceNow user and password.

## How a deployment is judged

| what the app finds | what it does |
| --- | --- |
| no ticket number anywhere | **rejected** |
| a ticket number that the backend does not know | **rejected** |
| the ticket is rejected or cancelled | **rejected** |
| the approval window of the ticket has already ended | **rejected** |
| the ticket is not approved yet and the window is not over | **waits** and checks again |
| the ticket is approved but the window has not started yet | **waits** and checks again |
| the ticket is approved and now is inside the window | **approved** |
| it has been waiting longer than `MAX_WAIT_MINUTES` | **rejected** |
| the ticket is approved and has no window at all | **approved**, only the approval counts |

Every answer carries a message. The short version goes on the deployment in the
workflow UI, the full version, with the ticket state, the window, the current
time and where the ticket was read from, is written as a comment on the pull
request and is in the logs. Set `POST_PULL_REQUEST_COMMENT=false` to turn the
pull request comment off.

While a deployment waits, no decision is sent to GitHub. GitHub keeps the
deployment pending on its own and the app looks at the ticket again later, so the
deployment starts by itself once the window opens. Every time the reason changes
the app also puts a status report on the pending deployment, so the run shows why
it is waiting instead of showing nothing at all.

## Two ways to find the waiting deployments

`DISCOVERY_MODE` decides how the app learns that a deployment is waiting for it.

### `webhook` (the default)

GitHub sends the `deployment_protection_rule` event to `POST /webhook`. This is
the quickest way, the app answers in about a second, but **GitHub has to be able
to reach the app**.

### `poll`

The app asks GitHub instead, so **nothing has to reach the app** and it can run
in a network GitHub cannot see. No webhook URL and no `GITHUB_WEBHOOK_SECRET` are
needed. Every `POLL_INTERVAL_SECONDS` the app does this for the organisation in
`GITHUB_ORG`:

1. `GET /app/installations` to find the installation of the organisation
2. `GET /installation/repositories` for the repositories that installation covers
3. `GET /repos/{owner}/{repo}/actions/runs?status=waiting` for each repository.
   `waiting` is the status GitHub gives a run that stopped in front of a
   deployment protection rule
4. `GET /repos/{owner}/{repo}/actions/runs/{run_id}/pending_deployments` to see
   which environments of that run are waiting
5. `POST /repos/{owner}/{repo}/actions/runs/{run_id}/deployment_protection_rule`
   to approve or reject

Step 5 is the same address the webhook hands over as `deployment_callback_url`,
so the app can build it from the run id and never needs the event.

What it costs is time and API calls. A deployment starts up to one interval later
than with the webhook, and the app makes one call per repository per round. With
many repositories either raise `POLL_INTERVAL_SECONDS` or put the repositories
that really use environments into `POLL_REPOSITORIES`.

`GITHUB_ORG` is compared against the account the app is installed on, and a
personal account name works there too, so you do not need an organisation just
to try the app out.

### `both`

The webhook answers immediately and the poller keeps running next to it. That
also picks up the deployments whose webhook delivery was lost while the app was
down, which the webhook alone never notices.

## Where the ticket number is looked for

In this order, the first match wins:

1. the commit message of the deployed commit
2. the title of the pull request
3. the description of the pull request
4. the comments on the pull request, oldest first
5. the branch or tag name

The format depends on the backend:

- `jira` looks for a Jira key, for example `OPS-4412`
- `servicenow` looks for a change number, for example `CHG0045123`
- `local` accepts both

A few words that look like a Jira key are ignored on purpose, `UTF-8`,
`SHA-256`, `ISO-8601` and a few more.

## The backends

### local

For trying the app out without a real Jira or ServiceNow. Every ticket is a text
file in one folder, named after the ticket:

```
tickets/CHG0045123.txt
tickets/OPS-1234.txt
```

A file looks like this:

```
status: approved
window_start: 2026-11-03T17:00:00Z
window_end: 2026-11-03T23:00:00Z
```

`status` can be anything, the word `approved` in it means approved and `denied`
or `rejected` means rejected. Anything else counts as not approved yet. Both
window lines are optional, without them only the approval is checked. A file
that contains nothing but the word `approved` also works, which is the quickest
way to see the app do something.

Set `BACKEND_MODE=local` and `LOCAL_TICKETS_PATH` to the folder.

### jira

The app reads one issue with `GET /rest/api/3/issue/{key}` and authenticates
with an email address and an API token.

**The approval is the workflow status of the issue.** There is no approval field
involved, so a status named `Approved` is what lets a deployment through. The
names are configuration because every project calls them something else.

**The window end is the due date of the issue by default.** A due date in Jira is
a day and not a time, so the app reads it as the end of that day. If you have a
date time field for the start or the end of the window, put its id in
`JIRA_WINDOW_START_FIELD` or `JIRA_WINDOW_END_FIELD` instead. An empty start
field means there is no start, so only the end counts.

```
BACKEND_MODE=jira
JIRA_BASE_URL=https://mycompany.atlassian.net
JIRA_EMAIL=me@mycompany.com
JIRA_API_TOKEN=...
JIRA_APPROVED_STATUSES=approved,ready for deployment
JIRA_REJECTED_STATUSES=rejected,cancelled
JIRA_WINDOW_START_FIELD=
JIRA_WINDOW_END_FIELD=duedate
```

To find the id of your own date field, open one issue with
`/rest/api/3/issue/OPS-1?expand=names` and look for the field name in there.

### servicenow

The app reads the change request from the table API,
`GET /api/now/table/change_request?sysparm_query=number=CHG0045123`, with
`sysparm_display_value=all` so the state comes back as text. A change is good to
go when its approval is `approved` and its state is one of
`SERVICENOW_APPROVED_STATES`. The window is `start_date` and `end_date`, which
ServiceNow sends in UTC without a timezone.

```
BACKEND_MODE=servicenow
SERVICENOW_BASE_URL=https://dev12345.service-now.com
SERVICENOW_USERNAME=admin
SERVICENOW_PASSWORD=...
SERVICENOW_APPROVED_STATES=scheduled,implement
SERVICENOW_REJECTED_STATES=canceled,cancelled,closed
```

Watch the spelling of the states. Some instances write `Canceled` with one `l`
and older ones with two, so both are in the default. Check the choice labels on
your own instance before you trust it. The user only needs read access to the
`change_request` table.

## Configuration

| variable | default | what it is |
| --- | --- | --- |
| `PORT` | `3000` | port the app listens on |
| `LOG_LEVEL` | `info` | `debug`, `info`, `warn` or `error` |
| `BACKEND_MODE` | `local` | `local`, `jira` or `servicenow` |
| `DISCOVERY_MODE` | `webhook` | `webhook`, `poll` or `both` |
| `WORKER_COUNT` | `0` | number of worker processes, `0` means one per CPU up to four |
| `STATE_DIR` | `./state` | folder for the deployments that are waiting |
| `RECHECK_INTERVAL_SECONDS` | `60` | how often a waiting deployment is looked at again |
| `MAX_WAIT_MINUTES` | `720` | after this the app stops waiting and rejects |
| `POST_PULL_REQUEST_COMMENT` | `true` | write the long message on the pull request |
| `GITHUB_API_URL` | `https://api.github.com` | change it for GitHub Enterprise Server |
| `GITHUB_APP_ID` | - | app id from the GitHub app page |
| `GITHUB_PRIVATE_KEY` | - | the private key, PEM or base64 of the PEM |
| `GITHUB_WEBHOOK_SECRET` | - | the webhook secret, not needed in `poll` mode |
| `GITHUB_ORG` | - | the organisation to poll, needed for `poll` and `both` |
| `POLL_INTERVAL_SECONDS` | `60` | how often GitHub is asked for waiting runs |
| `POLL_REPOSITORIES` | - | only look at these repositories, empty means all of them |
| `LOCAL_TICKETS_PATH` | `./tickets` | folder with the ticket files, `local` mode only |
| `JIRA_BASE_URL` | - | for example `https://mycompany.atlassian.net` |
| `JIRA_EMAIL` | - | user the API token belongs to |
| `JIRA_API_TOKEN` | - | API token |
| `JIRA_APPROVED_STATUSES` | `approved` | comma separated status names |
| `JIRA_REJECTED_STATUSES` | `rejected,cancelled` | comma separated status names |
| `JIRA_WINDOW_START_FIELD` | - | date field with the window start, empty means none |
| `JIRA_WINDOW_END_FIELD` | `duedate` | field with the window end |
| `SERVICENOW_BASE_URL` | - | for example `https://dev12345.service-now.com` |
| `SERVICENOW_USERNAME` | - | user for the table API |
| `SERVICENOW_PASSWORD` | - | password for that user |
| `SERVICENOW_APPROVED_STATES` | `scheduled,implement` | states a deployment may run in |
| `SERVICENOW_REJECTED_STATES` | `canceled,cancelled,closed` | states that reject right away |

`GITHUB_PRIVATE_KEY` takes the PEM file as it is, or base64 of it. A PEM with
real newlines in it is hard to pass through an env file or a Helm value, so
base64 is usually easier:

```bash
base64 -w0 my-github-app.private-key.pem
```

Copy `.env.example` to `.env` for local runs, the app reads it on start.

## Setting up the GitHub app

1. GitHub, **Settings** -> **Developer settings** -> **GitHub Apps** -> **New GitHub App**.
2. **Webhook URL** is `https://<your host>/webhook`. Set a **Webhook secret** and
   keep it, it goes into `GITHUB_WEBHOOK_SECRET`. In `poll` mode GitHub never
   calls the app, so leave the webhook URL empty and untick **Active**.
3. Repository permissions:
   - **Actions**: Read-only (list the waiting runs and their pending deployments)
   - **Contents**: Read-only (read the commit message)
   - **Deployments**: Read and write (send the decision)
   - **Metadata**: Read-only
   - **Pull requests**: Read and write (only needed for the comment)
4. Under **Subscribe to events** tick **Deployment protection rule**. Not needed
   in `poll` mode either.
5. Create the app, then **Generate a private key** and keep the PEM file.
6. Note the **App ID** from the same page, that is `GITHUB_APP_ID`.
7. **Install App** and give it the repositories that should use it. For `poll`
   mode the account it is installed on has to be the one in `GITHUB_ORG`, and the
   app only ever sees the repositories the installation was given.

Then turn it on for the environment, per repository:

**Settings** -> **Environments** -> pick the environment ->
**Deployment protection rules** -> enable the app in the list.

From then on every job that uses that environment waits for this app:

```yaml
jobs:
  deploy:
    runs-on: ubuntu-latest
    environment: production
    steps:
      - run: ./deploy.sh
```

## Running it

From source:

```bash
npm install
npm run build
npm start
```

In development, `npm run dev` runs it straight from the TypeScript. `npm test`
runs the unit tests.

With Docker:

```bash
docker build -t sdlc-environment-gate:dev .
docker run --rm -p 3000:3000 --env-file .env -v "$PWD/tickets:/app/tickets" sdlc-environment-gate:dev
```

With Docker Compose, which mounts `tickets/` and `state/` from the repository:

```bash
docker compose up --build
```

## Tests and CI

`npm test` runs the unit tests. There are three workflows in
`.github/workflows`, all of them run on a push to `main` and on every pull
request:

- `test.yml` builds the app and runs the unit tests
- `helm.yml` lints the chart and renders it with the defaults, with the poll
  mode and with the ingress on
- `docker.yml` builds the image

The chart has a test of its own. After it is installed, this starts a small pod
that calls `/health` in the cluster:

```bash
helm test approval
```

## Example workflow

`examples/deployment-workflow.yml` is a workflow for the repository you want to
protect, not for this one. Copy it into `.github/workflows/` over there, put the
change ticket number in the commit message, and the job will wait for this app
before its first step runs.

## Deploying with Helm

The chart is in `helm/sdlc-environment-gate`.

```bash
helm install approval ./helm/sdlc-environment-gate -f my-values.yaml
```

`values-example.yaml` next to the chart shows what a real values file looks
like, and every value in `values.yaml` has a line above it saying what it does.
There are no naming helper templates, every object is called `fullname` from the
values.

All secrets go into the chart as base64, because they end up in the `data` part
of a Kubernetes secret:

```bash
echo -n "123456" | base64 -w0             # githubAppId
base64 -w0 my-app.private-key.pem         # githubPrivateKey
echo -n "the-webhook-secret" | base64 -w0 # githubWebhookSecret
```

Do not commit a values file with the secrets filled in. Pass them with `--set`
or keep the file out of the repository.

The values that hold a comma separated list, like `poll.repositories` or
`jira.approvedStatuses`, need `--set-string` and an escaped comma, otherwise helm
reads the comma as the end of the value:

```bash
helm install approval ./helm/sdlc-environment-gate --set-string poll.repositories="web\,api"
```

In a values file they are plain strings and need none of that, which is easier.

Turn the ingress on with `ingress.enabled=true` and set `ingress.host`, or leave
it off and put your own ingress in front of the service. In `poll` mode you need
no ingress at all.

`persistence.enabled` is on by default and gives the pod a small volume for the
waiting deployments. With an empty dir instead, a pod restart loses the
deployments that were waiting and they stay pending in GitHub until somebody
cancels them.

## Getting the free accounts

You can get all three for nothing, as one person. The values that go into the
configuration are in the quick start and in the backends section above, this is
only about getting the accounts into a usable state.

**ServiceNow.** Sign up at the ServiceNow developer site and ask for a Personal
Developer Instance. You get a whole instance with an admin user, the table API
turned on and `change_request` already there, which is everything this app
touches. The instance is taken back if you do not log into it for a while, so log
in every week or so and export anything you want to keep. Open a change request,
set its state and its approval, and check the choice labels on your own instance
before you trust `SERVICENOW_APPROVED_STATES`, the state names are not the same
on every version.

**Jira.** Make a free Jira Cloud site and an API token under your Atlassian
account. In a project, rename or add a workflow status called `Approved`, and use
the due date of the issue as the end of the window. You do not need any custom
field for that. If you want a real start and end time, make two date time custom
fields and put their ids in `JIRA_WINDOW_START_FIELD` and
`JIRA_WINDOW_END_FIELD`.

**GitHub.** Use a **public** repository, that is the part that matters on the
Free plan. With `DISCOVERY_MODE=poll` you need no public address and no tunnel
for the app itself, your laptop is enough.

## How it runs

The app starts a few worker processes that share the port. One deployment that
is slow, that gets an error from Jira, or that crashes its worker, does not stop
the other ones. Every deployment is handled on its own with its own error
handling, and if a worker does die the primary process starts a new one.

A deployment that has to wait is written as a file under `STATE_DIR`. A worker
takes a file by moving it to another folder, which is the lock, so two workers
never work on the same deployment. When a worker dies the files it was holding
are moved back and another worker picks them up.

In the `poll` and `both` modes only the primary process polls GitHub. It serves
no HTTP traffic and there is only one of it, so two workers can never approve the
same deployment. The file under `STATE_DIR` is still used there, to remember when
a deployment was first seen, which is what `MAX_WAIT_MINUTES` counts from, and to
avoid writing the same comment again on every round.
