# Gridiron Elite Recruiting — Database Schema

## Core Tables

### profiles (extends Supabase auth.users)
| Column | Type | Notes |
|--------|------|-------|
| id | uuid (PK) | References auth.users.id |
| role | enum | 'athlete', 'admin' |
| first_name | text | |
| last_name | text | |
| email | text | |
| phone | text | |
| grad_year | int | Class of 20XX |
| high_school | text | |
| city | text | |
| state | text | |
| position | text | e.g. WR/DB |
| height | text | |
| weight | int | |
| gpa | decimal | |
| hudl_url | text | Film link |
| twitter_handle | text | |
| profile_image_url | text | |
| created_at | timestamptz | |
| updated_at | timestamptz | |

### programs
| Column | Type | Notes |
|--------|------|-------|
| id | uuid (PK) | |
| school_name | text | e.g. "Iowa Hawkeyes" |
| division | enum | 'FBS', 'FCS', 'DII', 'DIII', 'JUCO', 'NAIA' |
| conference | text | e.g. "Big Ten" |
| state | text | |
| city | text | |
| website | text | |
| logo_url | text | |
| created_at | timestamptz | |
| updated_at | timestamptz | |

### coaches
| Column | Type | Notes |
|--------|------|-------|
| id | uuid (PK) | |
| program_id | uuid (FK) | → programs.id |
| first_name | text | |
| last_name | text | |
| title | text | e.g. "Head Coach", "Recruiting Coordinator" |
| email | text | |
| phone | text | |
| twitter_handle | text | |
| twitter_dm_open | boolean | Is DM open? |
| created_at | timestamptz | |
| updated_at | timestamptz | |

### pipeline_stages (reference table)
| Column | Type | Notes |
|--------|------|-------|
| id | uuid (PK) | |
| name | text | Stage name |
| display_order | int | Left-to-right order |
| description | text | |

**Default stages:**
1. Initial Contact
2. Evaluation
3. Interest
4. Campus Visit
5. Offer
6. Decision/Commit

### pipeline_entries (per-athlete, per-program tracking)
| Column | Type | Notes |
|--------|------|-------|
| id | uuid (PK) | |
| athlete_id | uuid (FK) | → profiles.id |
| program_id | uuid (FK) | → programs.id |
| stage_id | uuid (FK) | → pipeline_stages.id |
| primary_coach_id | uuid (FK) | → coaches.id (main contact) |
| status | enum | 'active', 'dead', 'committed' |
| notes | text | |
| created_at | timestamptz | |
| updated_at | timestamptz | |

**Unique constraint:** (athlete_id, program_id) — one entry per program per athlete

### interactions (activity log per pipeline entry)
| Column | Type | Notes |
|--------|------|-------|
| id | uuid (PK) | |
| pipeline_entry_id | uuid (FK) | → pipeline_entries.id |
| athlete_id | uuid (FK) | → profiles.id |
| coach_id | uuid (FK) | → coaches.id (nullable) |
| type | enum | 'email_sent', 'email_received', 'dm_sent', 'dm_received', 'call', 'visit', 'film_sent', 'questionnaire', 'camp_invite', 'offer', 'other' |
| direction | enum | 'inbound', 'outbound' |
| subject | text | |
| body | text | |
| occurred_at | timestamptz | When it happened |
| created_at | timestamptz | |

### action_items (what needs to happen next)
| Column | Type | Notes |
|--------|------|-------|
| id | uuid (PK) | |
| athlete_id | uuid (FK) | → profiles.id |
| pipeline_entry_id | uuid (FK) | → pipeline_entries.id |
| title | text | e.g. "Follow up with Coach Ferentz" |
| description | text | |
| due_date | date | |
| priority | enum | 'low', 'medium', 'high', 'urgent' |
| status | enum | 'pending', 'completed', 'dismissed' |
| auto_generated | boolean | System-created vs manual |
| created_at | timestamptz | |
| completed_at | timestamptz | |

### email_templates
| Column | Type | Notes |
|--------|------|-------|
| id | uuid (PK) | |
| name | text | e.g. "Initial Introduction" |
| stage_id | uuid (FK) | → pipeline_stages.id (which stage this is for) |
| subject | text | Template with {{variables}} |
| body | text | Template with {{variables}} |
| created_by | uuid (FK) | → profiles.id (admin or athlete) |
| is_system | boolean | System default vs user-created |
| created_at | timestamptz | |
| updated_at | timestamptz | |

### email_sends (tracking sent emails)
| Column | Type | Notes |
|--------|------|-------|
| id | uuid (PK) | |
| athlete_id | uuid (FK) | → profiles.id |
| template_id | uuid (FK) | → email_templates.id (nullable) |
| coach_id | uuid (FK) | → coaches.id |
| to_email | text | |
| subject | text | Rendered subject |
| body | text | Rendered body |
| status | enum | 'queued', 'sent', 'delivered', 'opened', 'bounced', 'failed' |
| sent_at | timestamptz | |
| opened_at | timestamptz | |
| created_at | timestamptz | |

## Row-Level Security (RLS)

Every athlete-owned table uses RLS so athletes only see their own data:
- `profiles` — users see only their own row (admins see all)
- `pipeline_entries` — filtered by athlete_id
- `interactions` — filtered by athlete_id
- `action_items` — filtered by athlete_id
- `email_sends` — filtered by athlete_id
- `programs` and `coaches` — read access for all authenticated users
- Admin role bypasses athlete filters (sees everything)

## Template Variables (for emails)

Available merge fields:
- `{{athlete_first_name}}`, `{{athlete_last_name}}`
- `{{coach_first_name}}`, `{{coach_last_name}}`, `{{coach_title}}`
- `{{school_name}}`, `{{position}}`, `{{grad_year}}`
- `{{hudl_url}}`, `{{gpa}}`, `{{height}}`, `{{weight}}`
