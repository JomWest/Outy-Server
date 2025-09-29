const { z } = require('zod');

// Definiciones basadas en el diagrama ER provisto
const users = z.object({
  email: z.string().email(),
  password_hash: z.string().min(10),
  role: z.string().min(2),
  phone_number: z.string().max(20).optional(),
  created_at: z.string().datetime().optional(),
});

const company_profiles = z.object({
  user_id: z.number().int(),
  company_name: z.string().min(1),
  description: z.string().optional(),
  industry: z.string().optional(),
  website_url: z.string().url().optional(),
  logo_url: z.string().url().optional(),
  address: z.string().optional(),
});

const skills = z.object({
  skill_name: z.string().min(1),
});

const job_categories = z.object({
  name: z.string().min(1),
});

const locations_nicaragua = z.object({
  department: z.string().min(1),
  municipality: z.string().min(1),
});

const jobs = z.object({
  company_id: z.number().int(),
  title: z.string().min(1),
  description: z.string().min(1),
  requirements: z.string().optional(),
  job_category_id: z.number().int(),
  location_id: z.number().int(),
  employment_type: z.string().min(1),
  salary_min: z.number().optional(),
  salary_max: z.number().optional(),
  salary_currency: z.string().optional(),
  status: z.string().optional(),
  expires_at: z.string().datetime().optional(),
  created_at: z.string().datetime().optional(),
});

const candidate_profiles = z.object({
  user_id: z.number().int(),
  full_name: z.string().min(1),
  professional_title: z.string().optional(),
  bio: z.string().optional(),
  profile_picture_url: z.string().url().optional(),
  resume_url: z.string().url().optional(),
});

const education = z.object({
  candidate_id: z.number().int(),
  institution_name: z.string().min(1),
  degree: z.string().min(1),
  field_of_study: z.string().optional(),
  start_date: z.string().datetime(),
  end_date: z.string().datetime().optional(),
});

const work_experience = z.object({
  candidate_id: z.number().int(),
  job_title: z.string().min(1),
  company_name: z.string().min(1),
  description: z.string().optional(),
  start_date: z.string().datetime(),
  end_date: z.string().datetime().optional(),
});

const candidate_skills = z.object({
  candidate_id: z.number().int(),
  skill_id: z.number().int(),
});

const job_applications = z.object({
  job_id: z.number().int(),
  candidate_id: z.number().int(),
  status: z.string().min(1),
  cover_letter: z.string().optional(),
  applied_at: z.string().datetime().optional(),
});

const conversations = z.object({
  job_application_id: z.number().int(),
  last_message_at: z.string().datetime().optional(),
  created_at: z.string().datetime().optional(),
});

const conversation_participants = z.object({
  user_id: z.number().int(),
  conversation_id: z.number().int(),
});

const messages = z.object({
  conversation_id: z.number().int(),
  sender_id: z.number().int(),
  message_text: z.string().min(1),
  created_at: z.string().datetime().optional(),
});

const reviews = z.object({
  job_application_id: z.number().int(),
  author_role: z.string().min(1),
  subject_role: z.string().min(1),
  rating: z.number().min(1).max(5),
  comment: z.string().optional(),
  created_at: z.string().datetime().optional(),
});

module.exports = {
  users,
  company_profiles,
  skills,
  job_categories,
  locations_nicaragua,
  jobs,
  candidate_profiles,
  education,
  work_experience,
  candidate_skills,
  job_applications,
  conversations,
  conversation_participants,
  messages,
  reviews,
};