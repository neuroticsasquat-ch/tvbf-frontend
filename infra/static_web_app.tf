resource "azurerm_static_web_app" "tvbf_frontend" {
  name                = var.swa_name
  resource_group_name = data.azurerm_resource_group.shared.name
  location            = var.swa_location
  sku_tier            = var.swa_sku
  sku_size            = var.swa_sku

  tags = var.common_tags
}

# Custom domain (app.tvbingefriend.com) is managed outside of tofu for now —
# wire up the CNAME at the registrar after the SWA's default hostname is known
# (tofu output `swa_default_hostname`), then add the custom domain via the
# Azure portal or `az staticwebapp hostname set`. Easy to import into tofu
# later if/when you want it codified.
