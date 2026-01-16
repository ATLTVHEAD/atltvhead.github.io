# Deployment Guide

## Quick Deploy to GitHub Pages

Since this is already a GitHub Pages repository (`atltvhead.github.io`), deployment is automatic!

### Current Status
✅ Repository is already configured for GitHub Pages
✅ Custom domain (atltvhead.xyz) is configured via CNAME
✅ All files are committed and pushed
✅ **GitHub Actions workflow configured** (`.github/workflows/deploy.yml`)

### Automatic Deployment
Every time you push to the main branch (or merge a PR), the GitHub Actions workflow automatically:
1. Checks out your code
2. Uploads the site as a Pages artifact
3. Deploys to GitHub Pages
4. Updates your site within 1-2 minutes

### How to Deploy Your Changes

```bash
# 1. Make your changes locally
# Edit files as needed

# 2. Commit changes
git add .
git commit -m "Your commit message"

# 3. Push to main branch
git push origin main

# 4. Wait 1-2 minutes
# Your site will be live at https://atltvhead.xyz
```

### Merge This PR

To deploy this portfolio structure:

1. **Review the PR** on GitHub
2. **Click "Merge Pull Request"**
3. **Confirm the merge**
4. **Wait 1-2 minutes**
5. **Visit https://atltvhead.xyz** to see your new portfolio!

## Custom Domain Setup (Already Done)

Your custom domain is already configured:
- ✅ CNAME file exists with `atltvhead.xyz`
- ✅ DNS should point to GitHub Pages
- ✅ HTTPS should be enabled

### DNS Records (Verify These)

Make sure your domain DNS has these records:

```
Type: A
Name: @
Value: 185.199.108.153

Type: A
Name: @
Value: 185.199.109.153

Type: A
Name: @
Value: 185.199.110.153

Type: A
Name: @
Value: 185.199.111.153

Type: CNAME
Name: www
Value: atltvhead.github.io
```

## Local Development Workflow

### 1. Clone Repository
```bash
git clone https://github.com/ATLTVHEAD/atltvhead.github.io.git
cd atltvhead.github.io
```

### 2. Start Local Server
```bash
# Python 3
python -m http.server 8000

# Or Python 2
python -m SimpleHTTPServer 8000

# Or Node.js
npx http-server -p 8000

# Or VS Code Live Server extension
```

### 3. Open in Browser
```
http://localhost:8000
```

### 4. Make Changes
- Edit HTML, CSS, or JavaScript files
- Refresh browser to see changes
- Test on different screen sizes

### 5. Commit and Push
```bash
git add .
git commit -m "Describe your changes"
git push origin main
```

## GitHub Pages Settings

To verify or modify settings:

1. Go to repository Settings
2. Click "Pages" in left sidebar
3. Verify:
   - Source: Deploy from a branch
   - Branch: main / root
   - Custom domain: atltvhead.xyz
   - Enforce HTTPS: ✅ Enabled

## Testing Before Deploy

### Test Locally
Always test locally before pushing:

```bash
# Start server
python -m http.server 8000

# Check in multiple browsers
- Chrome (desktop & mobile view)
- Firefox
- Safari (if on Mac)
- Edge

# Test all features
- Navigation works
- Smooth scrolling
- Mobile menu
- Form inputs
- Links work
- Console has no errors
```

### Test Responsive Design
```javascript
// In browser DevTools:
1. Open DevTools (F12)
2. Toggle device toolbar (Ctrl+Shift+M)
3. Test these sizes:
   - Mobile: 375px
   - Tablet: 768px
   - Desktop: 1920px
```

## Adding 3D Models

### Before Deployment
1. Add model files to `models/` directory
2. Update `js/modelLoader.js` to load them
3. Test locally that models load correctly
4. Optimize models for web (< 5MB)
5. Commit and push

### Example
```javascript
// In js/modelLoader.js
modelLoader.loadModel('models/robot.glb', 'robot', {
    position: { x: 0, y: 0, z: 0 },
    scale: 1
});
```

## Performance Optimization

### Before Deploying
- ✅ Minify CSS (optional)
- ✅ Compress images
- ✅ Optimize 3D models
- ✅ Test loading speed
- ✅ Check mobile performance

### Tools
```bash
# Lighthouse audit
# In Chrome DevTools > Lighthouse tab
# Run audit for Performance, Accessibility, SEO

# Check file sizes
du -sh models/*
du -sh styles/*
du -sh js/*
```

## Automated Deployment with GitHub Actions

This repository includes a GitHub Actions workflow (`.github/workflows/deploy.yml`) that automatically deploys the site to GitHub Pages.

### How It Works

The workflow:
1. **Triggers automatically** when you push to the `main` branch
2. **Can be triggered manually** from the Actions tab in GitHub
3. **Checks out the code** from the repository
4. **Uploads the entire site** as a GitHub Pages artifact
5. **Deploys to GitHub Pages** with proper permissions

### Workflow Configuration

```yaml
# .github/workflows/deploy.yml
name: Deploy to GitHub Pages

on:
  push:
    branches:
      - main
  workflow_dispatch:  # Allows manual triggering

permissions:
  contents: read
  pages: write
  id-token: write
```

### Viewing Deployment Status

1. Go to the **Actions** tab in your GitHub repository
2. Click on the latest workflow run
3. View the deployment URL in the workflow output
4. Check for any errors in the workflow logs

### Manual Deployment

To manually trigger a deployment:
1. Go to **Actions** tab in GitHub
2. Click on **Deploy to GitHub Pages** workflow
3. Click **Run workflow** button
4. Select the `main` branch
5. Click **Run workflow**

## Troubleshooting Deployment

### Site Not Updating?
1. Check GitHub Actions tab for build status
2. Hard refresh browser (Ctrl+F5)
3. Clear browser cache
4. Wait 5 minutes and try again
5. Check GitHub Pages settings

### 404 Error?
1. Verify files are in root directory
2. Check file names are correct
3. Ensure index.html exists
4. Check GitHub Pages settings

### Custom Domain Not Working?
1. Verify DNS records
2. Check CNAME file
3. Wait for DNS propagation (up to 24h)
4. Re-save custom domain in settings
5. Enable HTTPS after domain works

### Changes Not Showing?
1. Hard refresh: Ctrl+F5 (Windows) or Cmd+Shift+R (Mac)
2. Open in incognito mode
3. Clear browser cache
4. Wait 2-3 minutes for deployment
5. Check commit was pushed to main branch

## Monitoring

### Check Site Status
- Visit: https://atltvhead.xyz
- Check browser console for errors (F12)
- Test all links and features
- Verify mobile responsiveness

### Analytics (Optional)
Add Google Analytics:
```html
<!-- In index.html, before </head> -->
<script async src="https://www.googletagmanager.com/gtag/js?id=GA_MEASUREMENT_ID"></script>
<script>
  window.dataLayer = window.dataLayer || [];
  function gtag(){dataLayer.push(arguments);}
  gtag('js', new Date());
  gtag('config', 'GA_MEASUREMENT_ID');
</script>
```

## Security

### HTTPS
- ✅ Always use HTTPS
- ✅ Enabled in GitHub Pages settings
- ✅ Redirects HTTP to HTTPS automatically

### Content Security Policy (Optional)
Add to `index.html`:
```html
<meta http-equiv="Content-Security-Policy" content="default-src 'self' https://cdnjs.cloudflare.com https://cdn.jsdelivr.net;">
```

## Next Steps After Deployment

1. ✅ Merge this PR to deploy
2. ✅ Visit https://atltvhead.xyz
3. ✅ Test all features
4. ⬜ Customize content
5. ⬜ Add 3D models
6. ⬜ Update colors/branding
7. ⬜ Share your portfolio!

## Support

If you encounter issues:
1. Check browser console for errors
2. Review GitHub Pages documentation
3. Check this repository's Issues
4. Search Stack Overflow
5. Ask in GitHub Discussions

---

**Ready to deploy?** Merge this PR and your portfolio will be live! 🚀
