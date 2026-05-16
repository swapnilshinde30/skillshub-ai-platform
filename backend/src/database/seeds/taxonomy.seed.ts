import { DataSource } from 'typeorm';
import { SkillTaxonomy } from '../../modules/taxonomy/entities/skill-taxonomy.entity';
import { SkillCategory } from '../../common/enums';

export async function seedTaxonomy(dataSource: DataSource): Promise<void> {
  const repo = dataSource.getRepository(SkillTaxonomy);

  const skills: Partial<SkillTaxonomy>[] = [
    // Programming languages
    { name: 'Python',      normalizedName: 'python',      category: SkillCategory.PROGRAMMING, aliases: ['py'],              isVerified: true },
    { name: 'TypeScript',  normalizedName: 'typescript',  category: SkillCategory.PROGRAMMING, aliases: ['ts','TS'],         isVerified: true },
    { name: 'JavaScript',  normalizedName: 'javascript',  category: SkillCategory.PROGRAMMING, aliases: ['js','JS','ES6'],   isVerified: true },
    { name: 'Go',          normalizedName: 'go',          category: SkillCategory.PROGRAMMING, aliases: ['golang','Golang'], isVerified: true },
    { name: 'Java',        normalizedName: 'java',        category: SkillCategory.PROGRAMMING, aliases: [],                  isVerified: true },
    { name: 'Rust',        normalizedName: 'rust',        category: SkillCategory.PROGRAMMING, aliases: [],                  isVerified: true },
    { name: 'C++',         normalizedName: 'cpp',         category: SkillCategory.PROGRAMMING, aliases: ['c plus plus'],     isVerified: true },
    { name: 'Kotlin',      normalizedName: 'kotlin',      category: SkillCategory.PROGRAMMING, aliases: [],                  isVerified: true },

    // Frameworks
    { name: 'React',       normalizedName: 'react',       category: SkillCategory.FRAMEWORK, aliases: ['ReactJS','React.js'], isVerified: true },
    { name: 'Next.js',     normalizedName: 'nextjs',      category: SkillCategory.FRAMEWORK, aliases: ['NextJS'],             isVerified: true },
    { name: 'NestJS',      normalizedName: 'nestjs',      category: SkillCategory.FRAMEWORK, aliases: ['Nest'],               isVerified: true },
    { name: 'FastAPI',     normalizedName: 'fastapi',     category: SkillCategory.FRAMEWORK, aliases: [],                     isVerified: true },
    { name: 'Django',      normalizedName: 'django',      category: SkillCategory.FRAMEWORK, aliases: [],                     isVerified: true },
    { name: 'Spring Boot', normalizedName: 'spring-boot', category: SkillCategory.FRAMEWORK, aliases: ['Spring','SpringBoot'], isVerified: true },

    // Databases
    { name: 'PostgreSQL',  normalizedName: 'postgresql',  category: SkillCategory.DATABASE, aliases: ['postgres','Postgres','psql'], isVerified: true },
    { name: 'MySQL',       normalizedName: 'mysql',       category: SkillCategory.DATABASE, aliases: [],                              isVerified: true },
    { name: 'MongoDB',     normalizedName: 'mongodb',     category: SkillCategory.DATABASE, aliases: ['Mongo'],                       isVerified: true },
    { name: 'Redis',       normalizedName: 'redis',       category: SkillCategory.DATABASE, aliases: [],                              isVerified: true },
    { name: 'Elasticsearch', normalizedName: 'elasticsearch', category: SkillCategory.DATABASE, aliases: ['ES','elastic'], isVerified: true },

    // Cloud
    { name: 'AWS',         normalizedName: 'aws',         category: SkillCategory.CLOUD, aliases: ['Amazon Web Services'], isVerified: true },
    { name: 'GCP',         normalizedName: 'gcp',         category: SkillCategory.CLOUD, aliases: ['Google Cloud','Google Cloud Platform'], isVerified: true },
    { name: 'Azure',       normalizedName: 'azure',       category: SkillCategory.CLOUD, aliases: ['Microsoft Azure'],    isVerified: true },

    // DevOps
    { name: 'Docker',      normalizedName: 'docker',      category: SkillCategory.DEVOPS, aliases: [],                isVerified: true },
    { name: 'Kubernetes',  normalizedName: 'kubernetes',  category: SkillCategory.DEVOPS, aliases: ['k8s','K8s'],     isVerified: true },
    { name: 'Terraform',   normalizedName: 'terraform',   category: SkillCategory.DEVOPS, aliases: [],                isVerified: true },
    { name: 'CI/CD',       normalizedName: 'cicd',        category: SkillCategory.DEVOPS, aliases: ['CI/CD pipelines'], isVerified: true },

    // Data science / ML
    { name: 'PyTorch',     normalizedName: 'pytorch',     category: SkillCategory.DATA_SCIENCE, aliases: [],          isVerified: true },
    { name: 'TensorFlow',  normalizedName: 'tensorflow',  category: SkillCategory.DATA_SCIENCE, aliases: ['TF'],      isVerified: true },
    { name: 'scikit-learn',normalizedName: 'scikit-learn',category: SkillCategory.DATA_SCIENCE, aliases: ['sklearn'], isVerified: true },
    { name: 'Pandas',      normalizedName: 'pandas',      category: SkillCategory.DATA_SCIENCE, aliases: [],          isVerified: true },
    { name: 'LLMs',        normalizedName: 'llms',        category: SkillCategory.DATA_SCIENCE, aliases: ['Large Language Models','LLM'], isVerified: true },
  ];

  for (const skill of skills) {
    const exists = await repo.findOneBy({ normalizedName: skill.normalizedName });
    if (!exists) {
      await repo.save(repo.create(skill));
    }
  }

  console.log(`✓ Seeded ${skills.length} taxonomy entries`);
}
