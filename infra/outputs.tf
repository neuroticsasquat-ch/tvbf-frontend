output "swa_name" {
  value = azurerm_static_web_app.tvbf_frontend.name
}

output "swa_default_hostname" {
  value       = azurerm_static_web_app.tvbf_frontend.default_host_name
  description = "Point the CNAME for app.tvbingefriend.com at this hostname before applying the custom domain resource."
}

output "swa_deployment_token" {
  description = "Copy into the GitHub Actions secret AZURE_STATIC_WEB_APPS_API_TOKEN. Sensitive."
  value       = azurerm_static_web_app.tvbf_frontend.api_key
  sensitive   = true
}

