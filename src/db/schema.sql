-- ====================================================
-- Merged Wehoware Multi-Tenant Database Schema (wehoware_ Tables)
-- ====================================================

-- Enable UUID extension
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- 1. Create new role enum for user profiles
CREATE TYPE user_role_type AS ENUM ('client', 'employee', 'admin');

-- ====================================================
-- 2. Clients Table (Tenant Information)
-- ====================================================
CREATE TABLE IF NOT EXISTS wehoware_clients (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  company_name TEXT NOT NULL,
  contact_person TEXT,
  contact_number TEXT,
  email TEXT,
  address TEXT,
  website TEXT,
  industry TEXT,
  domain TEXT,
  active BOOLEAN DEFAULT TRUE,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- ====================================================
-- 3. Profiles Table (User Data with Role & Client Association)
-- ====================================================
CREATE TABLE IF NOT EXISTS wehoware_profiles (
  id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  first_name TEXT,
  last_name TEXT,
  avatar_url TEXT,
  role user_role_type DEFAULT 'client',
  client_id UUID REFERENCES wehoware_clients(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Indexes for profiles table
CREATE INDEX IF NOT EXISTS idx_profiles_role ON wehoware_profiles(role);
CREATE INDEX IF NOT EXISTS idx_profiles_client_id ON wehoware_profiles(client_id);

-- ====================================================
-- 4. Blog Categories
-- ====================================================
CREATE TABLE IF NOT EXISTS wehoware_blog_categories (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  client_id UUID NOT NULL REFERENCES wehoware_clients(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  slug TEXT NOT NULL UNIQUE,
  description TEXT,
  seo_description TEXT,
  icon_url TEXT,
  display_order INTEGER DEFAULT 0,
  active BOOLEAN DEFAULT TRUE,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  created_by UUID REFERENCES auth.users(id),
  updated_by UUID REFERENCES auth.users(id)
);

-- ====================================================
-- 5. Blogs Table
-- ====================================================
CREATE TABLE IF NOT EXISTS wehoware_blogs (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  client_id UUID NOT NULL REFERENCES wehoware_clients(id) ON DELETE CASCADE,
  title TEXT NOT NULL,
  slug TEXT NOT NULL UNIQUE,
  excerpt TEXT,
  content TEXT,
  thumbnail TEXT,
  status TEXT DEFAULT 'Draft' CHECK (status IN ('Draft', 'Published', 'Archived')),
  category_id UUID REFERENCES wehoware_blog_categories(id),
  author_id UUID REFERENCES auth.users(id),
  featured BOOLEAN DEFAULT FALSE,
  read_time INTEGER,
  views INTEGER DEFAULT 0,
  likes INTEGER DEFAULT 0,
  tags JSONB DEFAULT '[]'::jsonb,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  published_at TIMESTAMPTZ,
  created_by UUID REFERENCES auth.users(id),
  updated_by UUID REFERENCES auth.users(id),
  meta_title TEXT,
  meta_description TEXT,
  meta_keywords TEXT
);

-- Indexes for blogs
CREATE INDEX IF NOT EXISTS wehoware_blogs_category_id_idx ON wehoware_blogs(category_id);
CREATE INDEX IF NOT EXISTS wehoware_blogs_status_idx ON wehoware_blogs(status);
CREATE INDEX IF NOT EXISTS wehoware_blogs_created_at_idx ON wehoware_blogs(created_at);

-- ====================================================
-- 6. Service Categories
-- ====================================================
CREATE TABLE IF NOT EXISTS wehoware_service_categories (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  client_id UUID NOT NULL REFERENCES wehoware_clients(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  slug TEXT NOT NULL UNIQUE,
  description TEXT,
  icon_url TEXT,
  active BOOLEAN DEFAULT TRUE,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  created_by UUID REFERENCES auth.users(id),
  updated_by UUID REFERENCES auth.users(id)
);

-- ====================================================
-- 7. Services Table
-- ====================================================
CREATE TABLE IF NOT EXISTS wehoware_services (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  client_id UUID NOT NULL REFERENCES wehoware_clients(id) ON DELETE CASCADE,
  title TEXT NOT NULL,
  slug TEXT NOT NULL UNIQUE,
  description TEXT,
  content TEXT,
  thumbnail TEXT,
  active BOOLEAN DEFAULT TRUE,
  category_id UUID REFERENCES wehoware_service_categories(id),
  fee DECIMAL(10, 2),
  fee_currency TEXT DEFAULT 'USD',
  service_code TEXT,
  featured BOOLEAN DEFAULT FALSE,
  rating DECIMAL(3,2) DEFAULT 0,
  reviews_count INTEGER DEFAULT 0,
  tags JSONB DEFAULT '[]'::jsonb,
  duration INTEGER,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  created_by UUID REFERENCES auth.users(id),
  updated_by UUID REFERENCES auth.users(id),
  meta_title TEXT,
  meta_description TEXT,
  meta_keywords TEXT
);

-- Indexes for services
CREATE INDEX IF NOT EXISTS wehoware_services_category_id_idx ON wehoware_services(category_id);
CREATE INDEX IF NOT EXISTS wehoware_services_active_idx ON wehoware_services(active);

-- ====================================================
-- 8. Inquiries Table
-- ====================================================
CREATE TABLE IF NOT EXISTS wehoware_inquiries (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  client_id UUID NOT NULL REFERENCES wehoware_clients(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  email TEXT NOT NULL,
  phone TEXT,
  subject TEXT NOT NULL,
  message TEXT NOT NULL,
  service_id UUID REFERENCES wehoware_services(id),
  status TEXT DEFAULT 'New' CHECK (status IN ('New', 'In Progress', 'Resolved')),
  ip_address TEXT,
  user_agent TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  updated_by UUID REFERENCES auth.users(id)
);

-- Indexes for inquiries
CREATE INDEX IF NOT EXISTS wehoware_inquiries_status_idx ON wehoware_inquiries(status);
CREATE INDEX IF NOT EXISTS wehoware_inquiries_created_at_idx ON wehoware_inquiries(created_at);

-- ====================================================
-- 9. Static Pages
-- ====================================================
CREATE TABLE IF NOT EXISTS wehoware_static_pages (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  client_id UUID NOT NULL REFERENCES wehoware_clients(id) ON DELETE CASCADE,
  page_slug TEXT NOT NULL,
  title TEXT,
  content TEXT,
  template_name TEXT,
  layout JSONB,
  meta_title TEXT,
  meta_description TEXT,
  meta_keywords TEXT,
  open_graph_title TEXT,
  open_graph_description TEXT,
  open_graph_image TEXT,
  is_active BOOLEAN DEFAULT TRUE,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- ====================================================
-- 10. Settings Table
-- ====================================================
CREATE TABLE IF NOT EXISTS wehoware_settings (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  client_id UUID NOT NULL REFERENCES wehoware_clients(id) ON DELETE CASCADE,
  setting_key TEXT NOT NULL,
  setting_value TEXT,
  setting_group TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- ====================================================
-- 11. Notification Preferences
-- ====================================================
CREATE TABLE IF NOT EXISTS wehoware_notification_preferences (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  client_id UUID NOT NULL REFERENCES wehoware_clients(id) ON DELETE CASCADE,
  preference_key TEXT NOT NULL,
  description TEXT,
  enabled BOOLEAN DEFAULT TRUE,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- ====================================================
-- 12. Form Templates (Custom Forms Builder)
-- ====================================================
CREATE TABLE IF NOT EXISTS wehoware_form_templates (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  client_id UUID NOT NULL REFERENCES wehoware_clients(id) ON DELETE CASCADE,
  title TEXT NOT NULL,
  description TEXT,
  status TEXT DEFAULT 'Draft' CHECK (status IN ('Draft', 'Published', 'Archived')),
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  created_by UUID REFERENCES auth.users(id),
  updated_by UUID REFERENCES auth.users(id),
  success_message TEXT DEFAULT 'Thank you for your submission!',
  redirect_url TEXT,
  notification_emails JSONB DEFAULT '[]'::jsonb
);

-- ====================================================
-- 13. Form Fields
-- ====================================================
CREATE TABLE IF NOT EXISTS wehoware_form_fields (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  client_id UUID NOT NULL REFERENCES wehoware_clients(id) ON DELETE CASCADE,
  form_template_id UUID NOT NULL REFERENCES wehoware_form_templates(id) ON DELETE CASCADE,
  field_type TEXT NOT NULL CHECK (field_type IN ('text', 'textarea', 'email', 'phone', 'number', 'date', 'time', 'checkbox', 'radio', 'select', 'file', 'hidden')),
  label TEXT NOT NULL,
  placeholder TEXT,
  help_text TEXT,
  required BOOLEAN DEFAULT FALSE,
  field_order INTEGER NOT NULL,
  default_value TEXT,
  options JSONB DEFAULT '[]'::jsonb,
  validation_rules JSONB DEFAULT '{}'::jsonb,
  css_class TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- ====================================================
-- 14. Form Submissions
-- ====================================================
CREATE TABLE IF NOT EXISTS wehoware_form_submissions (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  client_id UUID NOT NULL REFERENCES wehoware_clients(id) ON DELETE CASCADE,
  form_template_id UUID NOT NULL REFERENCES wehoware_form_templates(id) ON DELETE CASCADE,
  submission_data JSONB NOT NULL,
  submitted_at TIMESTAMPTZ DEFAULT NOW(),
  ip_address TEXT,
  user_agent TEXT,
  status TEXT DEFAULT 'New' CHECK (status IN ('New', 'Viewed', 'Contacted', 'Converted', 'Archived')),
  notes TEXT,
  tags JSONB DEFAULT '[]'::jsonb,
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  updated_by UUID REFERENCES auth.users(id)
);

-- ====================================================
-- 15. Integration Providers
-- ====================================================
CREATE TABLE IF NOT EXISTS wehoware_integration_providers (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  name TEXT NOT NULL,
  category TEXT NOT NULL,
  description TEXT,
  logo_url TEXT,
  documentation_url TEXT,
  active BOOLEAN DEFAULT TRUE,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- ====================================================
-- 16. Integrations (Client Integration Connections)
-- ====================================================
CREATE TABLE IF NOT EXISTS wehoware_integrations (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  client_id UUID NOT NULL REFERENCES wehoware_clients(id) ON DELETE CASCADE,
  provider_id UUID NOT NULL REFERENCES wehoware_integration_providers(id),
  name TEXT NOT NULL,
  api_key TEXT,
  api_secret TEXT,
  access_token TEXT,
  refresh_token TEXT,
  token_expires_at TIMESTAMPTZ,
  config JSONB DEFAULT '{}'::jsonb,
  status TEXT DEFAULT 'Active' CHECK (status IN ('Active', 'Paused', 'Error')),
  last_sync_at TIMESTAMPTZ,
  sync_frequency TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  created_by UUID REFERENCES auth.users(id),
  updated_by UUID REFERENCES auth.users(id)
);

-- ====================================================
-- 17. Integration Webhooks
-- ====================================================
CREATE TABLE IF NOT EXISTS wehoware_integration_webhooks (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  client_id UUID NOT NULL REFERENCES wehoware_clients(id) ON DELETE CASCADE,
  integration_id UUID NOT NULL REFERENCES wehoware_integrations(id) ON DELETE CASCADE,
  event_type TEXT NOT NULL,
  webhook_url TEXT NOT NULL,
  active BOOLEAN DEFAULT TRUE,
  secret_key TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- ====================================================
-- 18. Integration Logs
-- ====================================================
CREATE TABLE IF NOT EXISTS wehoware_integration_logs (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  client_id UUID NOT NULL REFERENCES wehoware_clients(id) ON DELETE CASCADE,
  integration_id UUID NOT NULL REFERENCES wehoware_integrations(id) ON DELETE CASCADE,
  operation TEXT NOT NULL,
  status TEXT NOT NULL CHECK (status IN ('Success', 'Failed', 'Partial')),
  details JSONB,
  start_time TIMESTAMPTZ DEFAULT NOW(),
  end_time TIMESTAMPTZ,
  records_processed INTEGER,
  error_message TEXT
);

-- ====================================================
-- 19. Report Templates (White-Label Client Reports)
-- ====================================================
CREATE TABLE IF NOT EXISTS wehoware_report_templates (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  client_id UUID NOT NULL REFERENCES wehoware_clients(id) ON DELETE CASCADE,
  title TEXT NOT NULL,
  description TEXT,
  report_type TEXT NOT NULL,
  layout JSONB,
  components JSONB,
  is_system_template BOOLEAN DEFAULT FALSE,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  created_by UUID REFERENCES auth.users(id),
  updated_by UUID REFERENCES auth.users(id)
);

-- ====================================================
-- 20. Reports (Generated Client Reports)
-- ====================================================
CREATE TABLE IF NOT EXISTS wehoware_reports (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  client_id UUID NOT NULL REFERENCES wehoware_clients(id) ON DELETE CASCADE,
  template_id UUID NOT NULL REFERENCES wehoware_report_templates(id),
  title TEXT NOT NULL,
  description TEXT,
  report_data JSONB,
  date_range_start DATE,
  date_range_end DATE,
  status TEXT DEFAULT 'Draft' CHECK (status IN ('Draft', 'Published', 'Archived')),
  is_scheduled BOOLEAN DEFAULT FALSE,
  schedule_frequency TEXT,
  last_generated_at TIMESTAMPTZ,
  next_generation_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  created_by UUID REFERENCES auth.users(id),
  updated_by UUID REFERENCES auth.users(id)
);

-- ====================================================
-- 21. Report Shares
-- ====================================================
CREATE TABLE IF NOT EXISTS wehoware_report_shares (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  client_id UUID NOT NULL REFERENCES wehoware_clients(id) ON DELETE CASCADE,
  report_id UUID NOT NULL REFERENCES wehoware_reports(id) ON DELETE CASCADE,
  access_token TEXT NOT NULL,
  recipient_email TEXT,
  recipient_name TEXT,
  message TEXT,
  expires_at TIMESTAMPTZ,
  last_accessed_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  created_by UUID REFERENCES auth.users(id)
);

-- ====================================================
-- 22. User-Client Association (for employees managing multiple clients)
-- ====================================================
CREATE TABLE IF NOT EXISTS wehoware_user_clients (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  client_id UUID NOT NULL REFERENCES wehoware_clients(id) ON DELETE CASCADE,
  is_primary BOOLEAN DEFAULT FALSE,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(user_id, client_id)
);
CREATE INDEX IF NOT EXISTS idx_user_clients_user_id ON wehoware_user_clients(user_id);
CREATE INDEX IF NOT EXISTS idx_user_clients_client_id ON wehoware_user_clients(client_id);

-- ====================================================
-- 23. Client Switch History (Audit Table)
-- ====================================================
CREATE TABLE IF NOT EXISTS wehoware_client_switch_history (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  client_id UUID NOT NULL REFERENCES wehoware_clients(id) ON DELETE CASCADE,
  switched_at TIMESTAMPTZ DEFAULT NOW(),
  ip_address TEXT,
  user_agent TEXT
);
CREATE INDEX IF NOT EXISTS idx_client_switch_history_user_id ON wehoware_client_switch_history(user_id);
CREATE INDEX IF NOT EXISTS idx_client_switch_history_client_id ON wehoware_client_switch_history(client_id);

-- ====================================================
-- 24. Enable Row Level Security on all wehoware_ tables
-- ====================================================
ALTER TABLE wehoware_clients DISABLE ROW LEVEL SECURITY;
ALTER TABLE wehoware_profiles DISABLE ROW LEVEL SECURITY;
ALTER TABLE wehoware_blog_categories DISABLE ROW LEVEL SECURITY;
ALTER TABLE wehoware_blogs DISABLE ROW LEVEL SECURITY;
ALTER TABLE wehoware_service_categories DISABLE ROW LEVEL SECURITY;
ALTER TABLE wehoware_services DISABLE ROW LEVEL SECURITY;
ALTER TABLE wehoware_inquiries DISABLE ROW LEVEL SECURITY;
ALTER TABLE wehoware_static_pages DISABLE ROW LEVEL SECURITY;
ALTER TABLE wehoware_settings DISABLE ROW LEVEL SECURITY;
ALTER TABLE wehoware_notification_preferences DISABLE ROW LEVEL SECURITY;
ALTER TABLE wehoware_form_templates DISABLE ROW LEVEL SECURITY;
ALTER TABLE wehoware_form_fields DISABLE ROW LEVEL SECURITY;
ALTER TABLE wehoware_form_submissions DISABLE ROW LEVEL SECURITY;
ALTER TABLE wehoware_integration_providers DISABLE ROW LEVEL SECURITY;
ALTER TABLE wehoware_integrations DISABLE ROW LEVEL SECURITY;
ALTER TABLE wehoware_integration_webhooks DISABLE ROW LEVEL SECURITY;
ALTER TABLE wehoware_integration_logs DISABLE ROW LEVEL SECURITY;
ALTER TABLE wehoware_report_templates DISABLE ROW LEVEL SECURITY;
ALTER TABLE wehoware_reports DISABLE ROW LEVEL SECURITY;
ALTER TABLE wehoware_report_shares DISABLE ROW LEVEL SECURITY;
ALTER TABLE wehoware_user_clients DISABLE ROW LEVEL SECURITY;
ALTER TABLE wehoware_client_switch_history DISABLE ROW LEVEL SECURITY;
