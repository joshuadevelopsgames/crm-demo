// Mock data for preview/testing
// This file provides sample data so you can preview the CRM without setting up base44

export const mockAccounts = [
  {
    id: '1',
    name: 'Acme Corporation',
    account_type: 'customer',
    status: 'active',
    revenue_segment: 'enterprise',
    annual_revenue: 500000,
    industry: 'Technology',
    organization_score: 85,
    last_interaction_date: '2025-01-10',
    renewal_date: '2025-12-31',
    assigned_to: 'sales@company.com',
    website: 'acme.com',
    phone: '555-0100'
  },
  {
    id: '2',
    name: 'Tech Startup Inc',
    account_type: 'prospect',
    status: 'negotiating',
    revenue_segment: 'startup',
    annual_revenue: 100000,
    industry: 'SaaS',
    organization_score: 72,
    last_interaction_date: '2025-01-05',
    assigned_to: 'sales@company.com'
  },
  {
    id: '3',
    name: 'Global Manufacturing Co',
    account_type: 'customer',
    status: 'at_risk',
    revenue_segment: 'mid_market',
    annual_revenue: 250000,
    industry: 'Manufacturing',
    organization_score: 45,
    last_interaction_date: '2024-11-15',
    renewal_date: '2025-03-15',
    assigned_to: 'sales@company.com'
  }
];

export const mockContacts = [
  {
    id: '1',
    account_id: '1',
    account_name: 'Acme Corporation',
    first_name: 'John',
    last_name: 'Doe',
    email: 'john.doe@acme.com',
    phone: '555-0100',
    title: 'CEO',
    role: 'decision_maker',
    linkedin_url: 'https://linkedin.com/in/johndoe',
    preferences: 'Prefers email communication'
  },
  {
    id: '2',
    account_id: '1',
    account_name: 'Acme Corporation',
    first_name: 'Jane',
    last_name: 'Smith',
    email: 'jane.smith@acme.com',
    phone: '555-0101',
    title: 'CFO',
    role: 'decision_maker'
  },
  {
    id: '3',
    account_id: '2',
    account_name: 'Tech Startup Inc',
    first_name: 'Mike',
    last_name: 'Johnson',
    email: 'mike@techstartup.com',
    title: 'Founder',
    role: 'decision_maker'
  }
];

export const mockTasks = [
  {
    id: '1',
    title: 'Follow up with Acme Corporation',
    description: 'Schedule quarterly review meeting',
    status: 'todo',
    priority: 'major',
    category: 'follow_up',
    assigned_to: 'sales@company.com',
    due_date: '2025-01-20',
    related_account_id: '1'
  },
  {
    id: '2',
    title: 'Prepare proposal for Tech Startup',
    status: 'in_progress',
    priority: 'critical',
    category: 'proposal',
    assigned_to: 'sales@company.com',
    due_date: '2025-01-15',
    related_account_id: '2'
  }
];

export const mockInteractions = [
  {
    id: '1',
    account_id: '1',
    contact_id: '1',
    type: 'email_sent',
    subject: 'Quarterly Review Meeting',
    content: 'Discussed Q1 performance and upcoming initiatives. Client expressed satisfaction.',
    interaction_date: '2025-01-10T10:00:00',
    direction: 'outbound',
    sentiment: 'positive',
    logged_by: 'sales@company.com',
    tags: ['meeting', 'positive_feedback']
  },
  {
    id: '2',
    account_id: '1',
    contact_id: '1',
    type: 'call',
    subject: 'Product demo call',
    content: 'Demonstrated new features. Client interested in upgrading.',
    interaction_date: '2025-01-05T14:00:00',
    direction: 'outbound',
    sentiment: 'positive',
    logged_by: 'sales@company.com',
    tags: ['demo', 'upsell_opportunity']
  }
];

export const mockScorecardTemplates = [
  {
    id: '1',
    name: 'ICP Weighted Scorecard',
    description: 'Ideal Customer Profile scoring based on weighted questions',
    is_active: true,
    pass_threshold: 70,
    total_possible_score: 100,
    questions: [
      {
        question_text: 'Client Operations Region',
        weight: 2,
        answer_type: 'scale_1_5',
        category: 'demographics',
        section: 'Corporate Demographic Information'
      },
      {
        question_text: 'Can someone introduce us?',
        weight: 1,
        answer_type: 'yes_no',
        category: 'demographics',
        section: 'Corporate Demographic Information'
      },
      {
        question_text: 'Has corporate events',
        weight: 1,
        answer_type: 'yes_no',
        category: 'demographics',
        section: 'Corporate Demographic Information'
      },
      {
        question_text: 'Inside our bubble?',
        weight: 1,
        answer_type: 'yes_no',
        category: 'demographics',
        section: 'Corporate Demographic Information'
      },
      {
        question_text: 'Located in Service Area (Calgary & Surrounding)',
        weight: 20,
        answer_type: 'yes_no',
        category: 'requirements',
        section: 'Non-Negotiables'
      },
      {
        question_text: 'Annual Budget (< $200K)',
        weight: 15,
        answer_type: 'yes_no',
        category: 'requirements',
        section: 'Non-Negotiables'
      },
      {
        question_text: 'Multiple Properties',
        weight: 3,
        answer_type: 'yes_no',
        category: 'requirements',
        section: 'Non-Negotiables'
      },
      {
        question_text: 'Sites between 2-24 acres',
        weight: 5,
        answer_type: 'yes_no',
        category: 'requirements',
        section: 'Non-Negotiables'
      },
      {
        question_text: 'Summer Maintenance',
        weight: 5,
        answer_type: 'yes_no',
        category: 'requirements',
        section: 'Non-Negotiables'
      },
      {
        question_text: 'Winter Maintenance',
        weight: 10,
        answer_type: 'yes_no',
        category: 'requirements',
        section: 'Non-Negotiables'
      },
      {
        question_text: 'Building quality',
        weight: 1,
        answer_type: 'scale_1_5',
        category: 'quality',
        section: 'Red Flags'
      },
      {
        question_text: 'Aesthetics',
        weight: 1,
        answer_type: 'scale_1_5',
        category: 'quality',
        section: 'Red Flags'
      }
    ]
  }
];

export const mockScorecardResponses = [
  {
    id: '1',
    account_id: '1',
    template_id: '1',
    template_name: 'ICP Weighted Scorecard',
    normalized_score: 85,
    total_score: 85,
    is_pass: true,
    scorecard_date: '2025-01-10',
    completed_date: '2025-01-10T15:00:00',
    completed_by: 'sales@company.com',
    section_scores: {
      'Corporate Demographic Information': 3,
      'Non-Negotiables': 58,
      'Red Flags': 24
    },
    responses: [
      { question_text: 'Client Operations Region', answer: 2, weight: 2, weighted_score: 4 },
      { question_text: 'Can someone introduce us?', answer: 0, weight: 1, weighted_score: 0 },
      // ... more responses
    ]
  }
];

export const mockSequences = [
  {
    id: '1',
    name: 'Prospect Outreach Sequence',
    description: 'Standard outreach for new prospects',
    account_type: 'prospect',
    is_active: true,
    steps: [
      {
        step_number: 1,
        days_after_previous: 0,
        action_type: 'email',
        template: 'Introduction email with value proposition'
      },
      {
        step_number: 2,
        days_after_previous: 3,
        action_type: 'linkedin',
        template: 'LinkedIn connection request with personalized message'
      },
      {
        step_number: 3,
        days_after_previous: 5,
        action_type: 'call',
        template: 'Follow-up call to discuss needs'
      }
    ]
  }
];

export const mockSequenceEnrollments = [
  {
    id: '1',
    account_id: '2',
    sequence_id: '1',
    status: 'active',
    current_step: 2,
    started_date: '2025-01-05',
    next_action_date: '2025-01-15',
    completed_steps: [
      { step_number: 1, completed_date: '2025-01-05', notes: 'Email sent' }
    ]
  }
];

export const mockSalesInsights = [
  {
    id: '1',
    account_id: '1',
    insight_type: 'opportunity',
    title: 'Expansion Opportunity',
    content: 'Client mentioned interest in expanding to 3 new locations. This could triple their contract value. Follow up in Q2.',
    tags: ['expansion', 'upsell_opportunity', 'high_value'],
    recorded_by: 'sales@company.com',
    recorded_date: '2025-01-10T10:00:00',
    related_interaction_id: '1'
  },
  {
    id: '2',
    account_id: '1',
    insight_type: 'pain_point',
    title: 'Current Vendor Issues',
    content: 'Client frustrated with current vendor\'s response times. Opportunity to highlight our 24/7 support.',
    tags: ['pain_point', 'competitive_advantage'],
    recorded_by: 'sales@company.com',
    recorded_date: '2025-01-05T14:00:00',
    related_interaction_id: '2'
  },
  {
    id: '3',
    account_id: '3',
    insight_type: 'risk',
    title: 'Budget Constraints',
    content: 'CFO mentioned budget cuts for next fiscal year. Account may be at risk. Need to demonstrate ROI.',
    tags: ['at_risk', 'budget', 'roi'],
    recorded_by: 'sales@company.com',
    recorded_date: '2024-12-15T09:00:00'
  }
];

export const mockResearchNotes = [
  {
    id: '1',
    account_id: '1',
    note_type: 'company_info',
    title: 'Recent Company Expansion',
    content: 'Acme Corporation announced opening 5 new locations in Q4 2024. Strong growth trajectory. Potential for multi-site contract.',
    source_url: 'https://acme.com/news/expansion',
    recorded_by: 'sales@company.com',
    recorded_date: '2025-01-08T11:00:00'
  },
  {
    id: '2',
    account_id: '1',
    note_type: 'key_person',
    title: 'New VP of Operations',
    content: 'John Smith promoted to VP of Operations in December. Previously Director. Key decision maker for facilities management.',
    source_url: 'https://linkedin.com/in/johnsmith',
    recorded_by: 'sales@company.com',
    recorded_date: '2025-01-09T10:00:00'
  },
  {
    id: '3',
    account_id: '2',
    note_type: 'market_research',
    title: 'Industry Trends',
    content: 'Tech startups in SaaS space are prioritizing cost efficiency. Our pricing model aligns well with their needs.',
    recorded_by: 'sales@company.com',
    recorded_date: '2025-01-06T15:00:00'
  }
];

// Mock Users
export const mockUsers = [
  {
    id: '1',
    email: 'alex.martinez@company.com',
    first_name: 'Alex',
    last_name: 'Martinez',
    role: 'sales_rep',
    department: 'Sales',
    phone: '555-1001',
    avatar_url: null,
    is_active: true,
    created_at: '2024-01-15T10:00:00'
  },
  {
    id: '2',
    email: 'sarah.chen@company.com',
    first_name: 'Sarah',
    last_name: 'Chen',
    role: 'sales_rep',
    department: 'Sales',
    phone: '555-1002',
    avatar_url: null,
    is_active: true,
    created_at: '2024-01-15T10:00:00'
  },
  {
    id: '3',
    email: 'michael.johnson@company.com',
    first_name: 'Michael',
    last_name: 'Johnson',
    role: 'sales_manager',
    department: 'Sales',
    phone: '555-1003',
    avatar_url: null,
    is_active: true,
    created_at: '2024-01-15T10:00:00'
  },
  {
    id: '4',
    email: 'emily.davis@company.com',
    first_name: 'Emily',
    last_name: 'Davis',
    role: 'sales_rep',
    department: 'Sales',
    phone: '555-1004',
    avatar_url: null,
    is_active: true,
    created_at: '2024-01-15T10:00:00'
  },
  {
    id: '5',
    email: 'david.wilson@company.com',
    first_name: 'David',
    last_name: 'Wilson',
    role: 'account_manager',
    department: 'Customer Success',
    phone: '555-1005',
    avatar_url: null,
    is_active: true,
    created_at: '2024-01-15T10:00:00'
  },
  {
    id: '6',
    email: 'jessica.brown@company.com',
    first_name: 'Jessica',
    last_name: 'Brown',
    role: 'sales_rep',
    department: 'Sales',
    phone: '555-1006',
    avatar_url: null,
    is_active: true,
    created_at: '2024-01-15T10:00:00'
  },
  {
    id: '7',
    email: 'james.taylor@company.com',
    first_name: 'James',
    last_name: 'Taylor',
    role: 'sales_rep',
    department: 'Sales',
    phone: '555-1007',
    avatar_url: null,
    is_active: true,
    created_at: '2024-01-15T10:00:00'
  },
  {
    id: '8',
    email: 'lisa.anderson@company.com',
    first_name: 'Lisa',
    last_name: 'Anderson',
    role: 'account_manager',
    department: 'Customer Success',
    phone: '555-1008',
    avatar_url: null,
    is_active: true,
    created_at: '2024-01-15T10:00:00'
  },
  {
    id: '9',
    email: 'robert.thomas@company.com',
    first_name: 'Robert',
    last_name: 'Thomas',
    role: 'sales_rep',
    department: 'Sales',
    phone: '555-1009',
    avatar_url: null,
    is_active: true,
    created_at: '2024-01-15T10:00:00'
  },
  {
    id: '10',
    email: 'amanda.jackson@company.com',
    first_name: 'Amanda',
    last_name: 'Jackson',
    role: 'sales_rep',
    department: 'Sales',
    phone: '555-1010',
    avatar_url: null,
    is_active: true,
    created_at: '2024-01-15T10:00:00'
  },
  {
    id: '11',
    email: 'chris.white@company.com',
    first_name: 'Chris',
    last_name: 'White',
    role: 'sales_rep',
    department: 'Sales',
    phone: '555-1011',
    avatar_url: null,
    is_active: true,
    created_at: '2024-01-15T10:00:00'
  },
  {
    id: '12',
    email: 'nicole.harris@company.com',
    first_name: 'Nicole',
    last_name: 'Harris',
    role: 'account_manager',
    department: 'Customer Success',
    phone: '555-1012',
    avatar_url: null,
    is_active: true,
    created_at: '2024-01-15T10:00:00'
  },
  {
    id: '13',
    email: 'ryan.martin@company.com',
    first_name: 'Ryan',
    last_name: 'Martin',
    role: 'sales_rep',
    department: 'Sales',
    phone: '555-1013',
    avatar_url: null,
    is_active: true,
    created_at: '2024-01-15T10:00:00'
  },
  {
    id: '14',
    email: 'michelle.thompson@company.com',
    first_name: 'Michelle',
    last_name: 'Thompson',
    role: 'sales_rep',
    department: 'Sales',
    phone: '555-1014',
    avatar_url: null,
    is_active: true,
    created_at: '2024-01-15T10:00:00'
  },
  {
    id: '15',
    email: 'kevin.garcia@company.com',
    first_name: 'Kevin',
    last_name: 'Garcia',
    role: 'sales_manager',
    department: 'Sales',
    phone: '555-1015',
    avatar_url: null,
    is_active: true,
    created_at: '2024-01-15T10:00:00'
  }
];

// Mock Notifications
export const mockNotifications = [
  {
    id: '1',
    user_id: '1',
    type: 'task_reminder',
    title: 'Task Due Today',
    message: 'Follow up with Acme Corporation is due today',
    related_task_id: '1',
    related_account_id: '1',
    is_read: false,
    created_at: '2025-01-20T08:00:00',
    scheduled_for: '2025-01-20T09:00:00'
  },
  {
    id: '2',
    user_id: '2',
    type: 'task_reminder',
    title: 'Task Due Tomorrow',
    message: 'Prepare proposal for Tech Startup is due tomorrow',
    related_task_id: '2',
    related_account_id: '2',
    is_read: false,
    created_at: '2025-01-19T08:00:00',
    scheduled_for: '2025-01-20T09:00:00'
  }
];

