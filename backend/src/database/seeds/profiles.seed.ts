import { DataSource } from 'typeorm';
import * as bcrypt from 'bcrypt';
import { User } from '../../modules/users/entities/user.entity';
import { SkillProfile } from '../../modules/profiles/entities/skill-profile.entity';
import { EmployeeSkill } from '../../modules/profiles/entities/employee-skill.entity';
import { Project } from '../../modules/profiles/entities/project.entity';
import { Certification } from '../../modules/profiles/entities/certification.entity';
import { Education } from '../../modules/profiles/entities/education.entity';
import {
  UserRole,
  ProfileStatus,
  ProficiencyLevel,
  SkillSource,
  SkillCategory,
} from '../../common/enums';

interface SeedEmployee {
  name: string;
  email: string;
  title: string;
  yearsTotal: number;
  summary: string;
  skills: Array<{
    name: string;
    category: SkillCategory;
    proficiency: ProficiencyLevel;
    yearsExp: number;
  }>;
  projects: Array<{
    name: string;
    description: string;
    impact: string;
    techStack: string[];
  }>;
  certifications: Array<{ name: string; issuer: string }>;
}

const EMPLOYEES: SeedEmployee[] = [
  {
    name: 'Sarah Chen',
    email: 'sarah.chen@skillshub.demo',
    title: 'Senior ML Engineer',
    yearsTotal: 6,
    summary:
      'ML engineer specialising in real-time inference systems and LLM fine-tuning. Proven track record delivering production ML at scale in fintech.',
    skills: [
      { name: 'Python',       category: SkillCategory.PROGRAMMING,  proficiency: ProficiencyLevel.EXPERT,        yearsExp: 6 },
      { name: 'PyTorch',      category: SkillCategory.DATA_SCIENCE,  proficiency: ProficiencyLevel.EXPERT,        yearsExp: 4 },
      { name: 'TensorFlow',   category: SkillCategory.DATA_SCIENCE,  proficiency: ProficiencyLevel.ADVANCED,      yearsExp: 3 },
      { name: 'AWS',          category: SkillCategory.CLOUD,          proficiency: ProficiencyLevel.ADVANCED,      yearsExp: 4 },
      { name: 'Kubernetes',   category: SkillCategory.DEVOPS,         proficiency: ProficiencyLevel.INTERMEDIATE,  yearsExp: 2 },
      { name: 'PostgreSQL',   category: SkillCategory.DATABASE,       proficiency: ProficiencyLevel.INTERMEDIATE,  yearsExp: 3 },
      { name: 'FastAPI',      category: SkillCategory.FRAMEWORK,      proficiency: ProficiencyLevel.ADVANCED,      yearsExp: 3 },
      { name: 'LLMs',         category: SkillCategory.DATA_SCIENCE,   proficiency: ProficiencyLevel.ADVANCED,      yearsExp: 2 },
    ],
    projects: [
      {
        name: 'Real-time Fraud Detection',
        description: 'Built ML pipeline processing 1M+ transactions/day using ensemble models.',
        impact: 'Reduced fraud losses by 34%, latency under 50ms P99.',
        techStack: ['Python', 'PyTorch', 'Kafka', 'Redis', 'AWS SageMaker'],
      },
      {
        name: 'LLM Fine-tuning Platform',
        description: 'Internal platform for fine-tuning domain-specific language models.',
        impact: 'Reduced model deployment time from 2 weeks to 2 days.',
        techStack: ['Python', 'PyTorch', 'Hugging Face', 'AWS', 'Kubernetes'],
      },
    ],
    certifications: [{ name: 'AWS Machine Learning Specialty', issuer: 'Amazon Web Services' }],
  },
  {
    name: 'Marcus Williams',
    email: 'marcus.williams@skillshub.demo',
    title: 'Senior Full Stack Engineer',
    yearsTotal: 5,
    summary:
      'Full-stack engineer with deep TypeScript expertise across React and Node.js. Led platform migrations and owns the developer experience across two product teams.',
    skills: [
      { name: 'TypeScript',   category: SkillCategory.PROGRAMMING,  proficiency: ProficiencyLevel.EXPERT,        yearsExp: 5 },
      { name: 'React',        category: SkillCategory.FRAMEWORK,     proficiency: ProficiencyLevel.EXPERT,        yearsExp: 5 },
      { name: 'Next.js',      category: SkillCategory.FRAMEWORK,     proficiency: ProficiencyLevel.ADVANCED,      yearsExp: 3 },
      { name: 'NestJS',       category: SkillCategory.FRAMEWORK,     proficiency: ProficiencyLevel.ADVANCED,      yearsExp: 3 },
      { name: 'PostgreSQL',   category: SkillCategory.DATABASE,       proficiency: ProficiencyLevel.ADVANCED,      yearsExp: 4 },
      { name: 'Redis',        category: SkillCategory.DATABASE,       proficiency: ProficiencyLevel.INTERMEDIATE,  yearsExp: 3 },
      { name: 'AWS',          category: SkillCategory.CLOUD,          proficiency: ProficiencyLevel.INTERMEDIATE,  yearsExp: 3 },
      { name: 'Docker',       category: SkillCategory.DEVOPS,         proficiency: ProficiencyLevel.ADVANCED,      yearsExp: 4 },
    ],
    projects: [
      {
        name: 'Monolith to Microservices Migration',
        description: 'Led architecture migration of 6-year-old monolith to 12 microservices.',
        impact: 'Cut deployment frequency from monthly to daily; 40% latency reduction.',
        techStack: ['TypeScript', 'NestJS', 'React', 'PostgreSQL', 'Docker', 'Kubernetes'],
      },
    ],
    certifications: [],
  },
  {
    name: 'Priya Sharma',
    email: 'priya.sharma@skillshub.demo',
    title: 'DevOps & Platform Engineer',
    yearsTotal: 7,
    summary:
      'Platform engineer with broad cloud-native expertise. Designed and operates Kubernetes infrastructure serving 50M daily requests across three regions.',
    skills: [
      { name: 'Kubernetes',   category: SkillCategory.DEVOPS,        proficiency: ProficiencyLevel.EXPERT,        yearsExp: 5 },
      { name: 'Terraform',    category: SkillCategory.DEVOPS,        proficiency: ProficiencyLevel.EXPERT,        yearsExp: 4 },
      { name: 'AWS',          category: SkillCategory.CLOUD,          proficiency: ProficiencyLevel.EXPERT,        yearsExp: 6 },
      { name: 'GCP',          category: SkillCategory.CLOUD,          proficiency: ProficiencyLevel.ADVANCED,      yearsExp: 3 },
      { name: 'Docker',       category: SkillCategory.DEVOPS,        proficiency: ProficiencyLevel.EXPERT,        yearsExp: 6 },
      { name: 'CI/CD',        category: SkillCategory.DEVOPS,        proficiency: ProficiencyLevel.EXPERT,        yearsExp: 5 },
      { name: 'Python',       category: SkillCategory.PROGRAMMING,   proficiency: ProficiencyLevel.INTERMEDIATE,  yearsExp: 4 },
      { name: 'Go',           category: SkillCategory.PROGRAMMING,   proficiency: ProficiencyLevel.ADVANCED,      yearsExp: 3 },
    ],
    projects: [
      {
        name: 'Multi-region Kubernetes Platform',
        description: 'Designed zero-downtime multi-region Kubernetes cluster with auto-failover.',
        impact: 'Achieved 99.99% uptime SLA, handling 50M daily requests.',
        techStack: ['Kubernetes', 'Terraform', 'AWS', 'Prometheus', 'ArgoCD'],
      },
    ],
    certifications: [
      { name: 'AWS Solutions Architect Professional', issuer: 'Amazon Web Services' },
      { name: 'Certified Kubernetes Administrator', issuer: 'CNCF' },
    ],
  },
  {
    name: 'James Okafor',
    email: 'james.okafor@skillshub.demo',
    title: 'Backend Engineer — Go & Distributed Systems',
    yearsTotal: 8,
    summary:
      'Distributed systems specialist with Go expertise. Designed event-driven payment infrastructure processing $2B+ annually.',
    skills: [
      { name: 'Go',           category: SkillCategory.PROGRAMMING,   proficiency: ProficiencyLevel.EXPERT,        yearsExp: 6 },
      { name: 'Java',         category: SkillCategory.PROGRAMMING,   proficiency: ProficiencyLevel.ADVANCED,      yearsExp: 5 },
      { name: 'PostgreSQL',   category: SkillCategory.DATABASE,       proficiency: ProficiencyLevel.EXPERT,        yearsExp: 6 },
      { name: 'Redis',        category: SkillCategory.DATABASE,       proficiency: ProficiencyLevel.EXPERT,        yearsExp: 5 },
      { name: 'Kubernetes',   category: SkillCategory.DEVOPS,        proficiency: ProficiencyLevel.ADVANCED,      yearsExp: 4 },
      { name: 'AWS',          category: SkillCategory.CLOUD,          proficiency: ProficiencyLevel.ADVANCED,      yearsExp: 5 },
      { name: 'Elasticsearch',category: SkillCategory.DATABASE,       proficiency: ProficiencyLevel.ADVANCED,      yearsExp: 4 },
    ],
    projects: [
      {
        name: 'Payment Processing Engine',
        description: 'Built event-driven payment orchestration system with exactly-once semantics.',
        impact: 'Processes $2B+ annually at 10,000 TPS with sub-100ms latency.',
        techStack: ['Go', 'PostgreSQL', 'Kafka', 'Redis', 'Kubernetes'],
      },
    ],
    certifications: [],
  },
  {
    name: 'Aisha Nguyen',
    email: 'aisha.nguyen@skillshub.demo',
    title: 'Data Engineer',
    yearsTotal: 4,
    summary:
      'Data engineer building scalable data pipelines and analytical infrastructure. Experienced with modern data stack (dbt, Airflow, Snowflake) and real-time streaming.',
    skills: [
      { name: 'Python',       category: SkillCategory.PROGRAMMING,   proficiency: ProficiencyLevel.ADVANCED,      yearsExp: 4 },
      { name: 'PostgreSQL',   category: SkillCategory.DATABASE,       proficiency: ProficiencyLevel.ADVANCED,      yearsExp: 3 },
      { name: 'Pandas',       category: SkillCategory.DATA_SCIENCE,   proficiency: ProficiencyLevel.EXPERT,        yearsExp: 4 },
      { name: 'AWS',          category: SkillCategory.CLOUD,          proficiency: ProficiencyLevel.INTERMEDIATE,  yearsExp: 3 },
      { name: 'Docker',       category: SkillCategory.DEVOPS,        proficiency: ProficiencyLevel.INTERMEDIATE,  yearsExp: 2 },
    ],
    projects: [
      {
        name: 'Real-time Analytics Pipeline',
        description: 'Built streaming ingestion pipeline from 15 data sources into centralised data warehouse.',
        impact: 'Reduced reporting lag from 24h to 2 minutes, enabling real-time business decisions.',
        techStack: ['Python', 'Apache Kafka', 'dbt', 'Snowflake', 'Airflow'],
      },
    ],
    certifications: [],
  },
  {
    name: 'Tom Eriksson',
    email: 'tom.eriksson@skillshub.demo',
    title: 'Mobile Engineer (iOS & React Native)',
    yearsTotal: 6,
    summary:
      'Mobile engineer with deep iOS expertise and cross-platform React Native experience. Built apps with 10M+ downloads.',
    skills: [
      { name: 'Kotlin',       category: SkillCategory.PROGRAMMING,   proficiency: ProficiencyLevel.ADVANCED,      yearsExp: 4 },
      { name: 'TypeScript',   category: SkillCategory.PROGRAMMING,   proficiency: ProficiencyLevel.ADVANCED,      yearsExp: 4 },
      { name: 'React',        category: SkillCategory.FRAMEWORK,     proficiency: ProficiencyLevel.ADVANCED,      yearsExp: 3 },
      { name: 'AWS',          category: SkillCategory.CLOUD,          proficiency: ProficiencyLevel.INTERMEDIATE,  yearsExp: 3 },
    ],
    projects: [
      {
        name: 'Consumer Banking App',
        description: 'Led mobile development for consumer banking app used by 2M customers.',
        impact: '4.8★ App Store rating, 10M+ downloads, sub-1s load times.',
        techStack: ['Swift', 'Kotlin', 'React Native', 'TypeScript'],
      },
    ],
    certifications: [],
  },
];

export async function seedProfiles(dataSource: DataSource): Promise<void> {
  const userRepo    = dataSource.getRepository(User);
  const profileRepo = dataSource.getRepository(SkillProfile);
  const skillRepo   = dataSource.getRepository(EmployeeSkill);
  const projectRepo = dataSource.getRepository(Project);
  const certRepo    = dataSource.getRepository(Certification);

  // Create HR user
  const hrExists = await userRepo.findOneBy({ email: 'hr@skillshub.demo' });
  if (!hrExists) {
    await userRepo.save(
      userRepo.create({
        email: 'hr@skillshub.demo',
        passwordHash: await bcrypt.hash('demo1234', 10),
        name: 'Alex Jordan',
        role: UserRole.HR,
        isActive: true,
      }),
    );
    console.log('✓ Created HR user: hr@skillshub.demo / demo1234');
  }

  for (const emp of EMPLOYEES) {
    const exists = await userRepo.findOneBy({ email: emp.email });
    if (exists) continue;

    // User
    const user = await userRepo.save(
      userRepo.create({
        email: emp.email,
        passwordHash: await bcrypt.hash('demo1234', 10),
        name: emp.name,
        role: UserRole.EMPLOYEE,
        isActive: true,
      }),
    );

    // Profile (pre-approved for demo)
    const profile = await profileRepo.save(
      profileRepo.create({
        userId: user.id,
        status: ProfileStatus.APPROVED,
        title: emp.title,
        summary: emp.summary,
        yearsTotal: emp.yearsTotal,
        source: 'resume',
      }),
    );

    // Skills
    await skillRepo.save(
      emp.skills.map((s) =>
        skillRepo.create({
          profileId: profile.id,
          name: s.name,
          category: s.category,
          proficiency: s.proficiency,
          yearsExp: s.yearsExp,
          isInferred: false,
          source: SkillSource.RESUME,
        }),
      ),
    );

    // Projects
    for (const p of emp.projects) {
      const project = await projectRepo.save(
        projectRepo.create({
          profileId: profile.id,
          name: p.name,
          description: p.description,
          impact: p.impact,
        }),
      );
      // ProjectSkills saved via project entity cascade if needed
    }

    // Certifications
    if (emp.certifications.length > 0) {
      await certRepo.save(
        emp.certifications.map((c) =>
          certRepo.create({ profileId: profile.id, name: c.name, issuer: c.issuer }),
        ),
      );
    }

    console.log(`✓ Seeded employee: ${emp.name} (${emp.email})`);
  }
}
