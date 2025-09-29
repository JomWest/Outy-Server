const { z } = require('zod');

// Helpers
const uuid = () => z.string().uuid();
const isoDate = () => z.string().regex(/^\d{4}-\d{2}-\d{2}$/); // YYYY-MM-DD

// Definiciones alineadas con el script SQL proporcionado
const users = z.object({
  email: z.string().email(),
  password_hash: z.string().min(10),
  role: z.enum(['candidato', 'empleador']),
  phone_number: z.string().max(20).optional(),
  created_at: z.string().datetime().optional(),
});

const company_profiles = z.object({
  user_id: uuid(),
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
  company_id: uuid(),
  title: z.string().min(1),
  description: z.string().min(1),
  requirements: z.string().optional(),
  job_category_id: z.number().int().optional(),
  location_id: z.number().int().optional(),
  employment_type: z.enum(['tiempo_completo', 'medio_tiempo', 'contrato', 'pasantia']).optional(),
  salary_min: z.number().optional(),
  salary_max: z.number().optional(),
  salary_currency: z.string().optional(),
  status: z.enum(['abierta', 'cerrada', 'pausada']).optional(),
  expires_at: z.string().datetime().optional(),
  created_at: z.string().datetime().optional(),
});

const candidate_profiles = z.object({
  user_id: uuid(),
  full_name: z.string().min(1),
  professional_title: z.string().optional(),
  bio: z.string().optional(),
  profile_picture_url: z.string().url().optional(),
  resume_url: z.string().url().optional(),
});

const education = z.object({
  candidate_id: uuid(),
  institution_name: z.string().min(1),
  degree: z.string().min(1),
  field_of_study: z.string().optional(),
  start_date: isoDate(),
  end_date: isoDate().optional(),
});

const work_experience = z.object({
  candidate_id: uuid(),
  job_title: z.string().min(1),
  company_name: z.string().min(1),
  description: z.string().optional(),
  start_date: isoDate(),
  end_date: isoDate().optional(),
});

const candidate_skills = z.object({
  candidate_id: uuid(),
  skill_id: z.number().int(),
});

const job_applications = z.object({
  job_id: uuid(),
  candidate_id: uuid(),
  status: z.enum(['enviada', 'vista', 'en_proceso', 'rechazada', 'aceptada']).optional(),
  cover_letter: z.string().optional(),
  applied_at: z.string().datetime().optional(),
});

const conversations = z.object({
  job_application_id: uuid().optional(),
  last_message_at: z.string().datetime().optional(),
  created_at: z.string().datetime().optional(),
});

const conversation_participants = z.object({
  user_id: uuid(),
  conversation_id: uuid(),
});

const messages = z.object({
  conversation_id: uuid(),
  sender_id: uuid(),
  message_text: z.string().min(1),
  created_at: z.string().datetime().optional(),
});

const reviews = z.object({
  job_application_id: uuid(),
  author_id: uuid(),
  author_role: z.enum(['candidato', 'empleador']),
  subject_id: uuid(),
  subject_role: z.enum(['candidato', 'empleador']),
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