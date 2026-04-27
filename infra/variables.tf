variable "subscription_id" {
  type = string
}

variable "shared_resource_group_name" {
  type    = string
  default = "sasquatch-shared-rg"
}

variable "swa_name" {
  type    = string
  default = "tvbf-frontend"
}

variable "swa_sku" {
  description = "Static Web Apps SKU. 'Free' is fine for invite-only beta; 'Standard' adds custom auth, snippets, etc."
  type        = string
  default     = "Free"
}

variable "swa_location" {
  description = "SWA is only offered in a handful of regions; pick the closest."
  type        = string
  default     = "centralus"
}

variable "common_tags" {
  type = map(string)
  default = {
    brand     = "neuroticsasquatch"
    app       = "tvbf"
    component = "frontend"
    managedBy = "opentofu"
    repo      = "tvbf-frontend"
  }
}
