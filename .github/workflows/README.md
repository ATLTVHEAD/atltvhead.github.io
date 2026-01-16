# GitHub Actions Workflows

## Deploy to GitHub Pages (`deploy.yml`)

This workflow automatically deploys the static site to GitHub Pages.

### Triggers

- **Automatic**: Runs on every push to the `main` branch
- **Manual**: Can be triggered from the Actions tab using "workflow_dispatch"

### What It Does

1. Checks out the repository code
2. Configures GitHub Pages settings
3. Uploads the entire repository as a Pages artifact
4. Deploys the artifact to GitHub Pages

### Permissions

The workflow requires:
- `contents: read` - to checkout the repository
- `pages: write` - to deploy to GitHub Pages
- `id-token: write` - for authentication

### Environment

Deploys to the `github-pages` environment, which is visible in the repository's Environments section.

### Viewing Deployments

1. Go to the **Actions** tab in GitHub
2. Click on the latest **Deploy to GitHub Pages** workflow run
3. View the deployment URL in the output
4. Check the **Environments** section to see deployment history

### Manual Deployment

To manually trigger a deployment:

1. Go to **Actions** tab
2. Select **Deploy to GitHub Pages** workflow
3. Click **Run workflow**
4. Choose the `main` branch
5. Click **Run workflow** button

### Notes

- Only one deployment can run at a time (concurrency control)
- The workflow uses the latest versions of GitHub's official Pages actions
- Deployment typically completes in 1-2 minutes
