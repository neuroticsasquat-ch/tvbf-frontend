# tvbf-frontend/infra

OpenTofu config for the TV Binge Friend SPA. Owns:

- The Static Web App resource on Azure.

Custom domain `app.tvbingefriend.com` (and apex/www redirects) are managed
outside tofu for now — wire up the CNAME at the registrar once the SWA's
default hostname exists, then add the custom domain via the Azure portal or
`az staticwebapp hostname set`. Can be imported into tofu later if desired.

## Prereqs

- `sasquatch-infra/` is applied (we read the resource group from it).
- A GitHub repository exists for `tvbf-frontend` and you have an
  Azure Static Web Apps **deployment token** ready (created on first apply,
  copied into the GitHub repo secrets so the SWA Action can deploy from CI).

## Deployment is split

This config defines the SWA *resource*. Actual frontend builds + uploads happen
via the GitHub Action `Azure/static-web-apps-deploy@v1` in CI — that's the
official path and tofu doesn't need to know about deploys.

## Apply

```bash
tofu init
tofu plan -var-file=terraform.tfvars
tofu apply -var-file=terraform.tfvars
```

After first apply, copy the deployment token output into the
`AZURE_STATIC_WEB_APPS_API_TOKEN` GitHub Actions secret.
