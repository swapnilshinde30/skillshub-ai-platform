export enum UserRole {
  EMPLOYEE = 'employee',
  HR = 'hr',
}

export enum ProfileStatus {
  DRAFT = 'draft',
  PENDING = 'pending',
  APPROVED = 'approved',
  REJECTED = 'rejected',
}

export enum ProficiencyLevel {
  BEGINNER = 'beginner',
  INTERMEDIATE = 'intermediate',
  ADVANCED = 'advanced',
  EXPERT = 'expert',
}

export enum SkillSource {
  RESUME = 'resume',
  LINKEDIN = 'linkedin',
  MANUAL = 'manual',
  INFERRED = 'inferred',
}

export enum InferenceConfidence {
  HIGH = 'high',
  MEDIUM = 'medium',
  LOW = 'low',
}

export enum SearchRecommendation {
  STRONG_MATCH = 'strong_match',
  GOOD_MATCH = 'good_match',
  PARTIAL_MATCH = 'partial_match',
  POOR_MATCH = 'poor_match',
}

export enum UploadStatus {
  PENDING = 'pending',
  PROCESSING = 'processing',
  COMPLETED = 'completed',
  FAILED = 'failed',
}

export enum TeamStatus {
  DRAFT = 'draft',
  IN_PROGRESS = 'in_progress',
  COMPLETED = 'completed',
}

export enum SkillCategory {
  PROGRAMMING = 'programming',
  FRAMEWORK = 'framework',
  DATABASE = 'database',
  CLOUD = 'cloud',
  DEVOPS = 'devops',
  DATA_SCIENCE = 'data_science',
  MOBILE = 'mobile',
  SECURITY = 'security',
  MANAGEMENT = 'management',
  SOFT_SKILL = 'soft_skill',
  OTHER = 'other',
}
