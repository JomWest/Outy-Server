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
  user_id: z.string().uuid(),
  full_name: z.string().min(1),
  professional_title: z.string().optional(),
  bio: z.string().optional(),
  profile_picture_url: z.string().url().optional(),
  resume_url: z.string().url().optional(),
  // NEW: Allow linking to locations table for residence department
  location_id: z.number().int().optional(),
  // Nuevos campos para almacenamiento de archivos como BLOB
  profile_picture_data: z.instanceof(Buffer).optional(),
  profile_picture_filename: z.string().optional(),
  profile_picture_content_type: z.string().optional(),
  resume_data: z.instanceof(Buffer).optional(),
  resume_filename: z.string().optional(),
  resume_content_type: z.string().optional(),
  // Campos de timestamp agregados
  created_at: z.string().datetime().optional(),
  updated_at: z.string().datetime().optional(),
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

// ========= ESQUEMAS PARA TRABAJADORES Y TRABAJOS EXPRÉS =========

const trade_categories = z.object({
  name: z.string().min(1).max(100),
  description: z.string().max(255).optional(),
  icon_name: z.string().max(50).optional(),
});

const worker_profiles = z.object({
  user_id: uuid(),
  full_name: z.string().min(1).max(150),
  trade_category_id: z.number().int(),
  specialty: z.string().min(1).max(150),
  years_experience: z.number().int().min(0).optional(),
  description: z.string().optional(),
  profile_picture_url: z.string().url().optional(),
  phone_number: z.string().min(1).max(20),
  whatsapp_number: z.string().max(20).optional(),
  location_id: z.number().int().optional(),
  address_details: z.string().max(255).optional(),
  available: z.boolean().optional(),
  hourly_rate_min: z.number().optional(),
  hourly_rate_max: z.number().optional(),
  daily_rate_min: z.number().optional(),
  daily_rate_max: z.number().optional(),
  currency: z.string().max(5).optional(),
  average_rating: z.number().min(0).max(5).optional(),
  total_reviews: z.number().int().min(0).optional(),
  verified: z.boolean().optional(),
  verification_date: z.string().datetime().optional(),
  created_at: z.string().datetime().optional(),
  updated_at: z.string().datetime().optional(),
});

const worker_services = z.object({
  trade_category_id: z.number().int(),
  service_name: z.string().min(1).max(150),
  description: z.string().max(255).optional(),
});

const worker_service_offerings = z.object({
  worker_id: uuid(),
  service_id: z.number().int(),
  price_min: z.number().optional(),
  price_max: z.number().optional(),
});

const express_jobs = z.object({
  client_id: uuid(),
  trade_category_id: z.number().int(),
  title: z.string().min(1).max(200),
  description: z.string().min(1),
  location_id: z.number().int().optional(),
  address_details: z.string().max(255).optional(),
  urgency: z.enum(['inmediato', 'hoy', 'esta_semana', 'flexible']).optional(),
  preferred_date: z.string().datetime().optional(),
  estimated_duration: z.string().max(50).optional(),
  budget_min: z.number().optional(),
  budget_max: z.number().optional(),
  currency: z.string().max(5).optional(),
  payment_method: z.string().max(50).optional(),
  status: z.enum(['abierto', 'en_proceso', 'completado', 'cancelado']).optional(),
  created_at: z.string().datetime().optional(),
  updated_at: z.string().datetime().optional(),
  expires_at: z.string().datetime().optional(),
});

const express_job_applications = z.object({
  express_job_id: uuid(),
  worker_id: uuid(),
  proposed_price: z.number(),
  estimated_time: z.string().max(100).optional(),
  message: z.string().optional(),
  status: z.enum(['enviada', 'vista', 'aceptada', 'rechazada', 'retirada']).optional(),
  applied_at: z.string().datetime().optional(),
  updated_at: z.string().datetime().optional(),
});

const worker_reviews = z.object({
  worker_id: uuid(),
  client_id: uuid(),
  express_job_id: uuid().optional(),
  overall_rating: z.number().int().min(1).max(5),
  quality_rating: z.number().int().min(1).max(5).optional(),
  punctuality_rating: z.number().int().min(1).max(5).optional(),
  communication_rating: z.number().int().min(1).max(5).optional(),
  comment: z.string().optional(),
  would_recommend: z.boolean().optional(),
  created_at: z.string().datetime().optional(),
});

const worker_portfolio = z.object({
  worker_id: uuid(),
  project_title: z.string().min(1).max(200),
  project_description: z.string().optional(),
  completion_date: isoDate().optional(),
  image_url: z.string().url().optional(),
  before_image_url: z.string().url().optional(),
  after_image_url: z.string().url().optional(),
  created_at: z.string().datetime().optional(),
  is_featured: z.boolean().optional(),
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
  // Nuevos esquemas para trabajadores y trabajos exprés
  trade_categories,
  worker_profiles,
  worker_services,
  worker_service_offerings,
  express_jobs,
  express_job_applications,
  worker_reviews,
  worker_portfolio,
};