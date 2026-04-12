// ═══ APOLLO.IO CLIENT — Prospeccao de Sindicos ═══

const APOLLO_API_KEY = process.env.APOLLO_API_KEY || '';
const BASE_URL = 'https://api.apollo.io/v1';

interface ApolloPersonResult {
  id: string;
  name: string;
  first_name: string;
  last_name: string;
  title: string;
  organization_name: string;
  phone_numbers?: Array<{ sanitized_number: string; type: string }>;
  email: string;
  linkedin_url: string;
  city: string;
  state: string;
  country: string;
}

export interface ProspectedLead {
  name: string;
  role: string;
  phone: string | null;
  email: string | null;
  company: string;
  linkedin: string | null;
  city: string;
  state: string;
  source: string;
  metadata: Record<string, unknown>;
}

// ═══ SEARCH FOR SYNDICS / CONDO MANAGERS ═══

export async function searchSyndics(options?: {
  locations?: string[];
  page?: number;
  perPage?: number;
}): Promise<ProspectedLead[]> {
  if (!APOLLO_API_KEY) {
    throw new Error('APOLLO_API_KEY not configured');
  }

  const locations = options?.locations || ['Brazil'];
  const perPage = options?.perPage || 10;
  const page = options?.page || 1;

  // Search for syndics, property managers, condo administrators
  const titles = [
    'sindico',
    'sindica',
    'administrador de condominio',
    'gestor condominial',
    'property manager',
    'administradora de condominios',
    'gerente de condominio',
  ];

  const res = await fetch(`${BASE_URL}/mixed_people/search`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'X-Api-Key': APOLLO_API_KEY,
    },
    body: JSON.stringify({
      page,
      per_page: perPage,
      person_titles: titles,
      person_locations: locations,
      // Prioritize people with phone numbers
      contact_email_status: ['verified', 'guessed'],
    }),
  });

  if (!res.ok) {
    const errText = await res.text();
    throw new Error(`Apollo API error ${res.status}: ${errText}`);
  }

  const data = await res.json();
  const people: ApolloPersonResult[] = data.people || [];

  return people.map(person => ({
    name: person.name || `${person.first_name} ${person.last_name}`,
    role: person.title || 'Sindico',
    phone: person.phone_numbers?.[0]?.sanitized_number || null,
    email: person.email || null,
    company: person.organization_name || '',
    linkedin: person.linkedin_url || null,
    city: person.city || '',
    state: person.state || '',
    source: 'apollo',
    metadata: {
      apollo_id: person.id,
      full_title: person.title,
      organization: person.organization_name,
      search_date: new Date().toISOString(),
    },
  }));
}

// ═══ ENRICH CONTACT (get phone if missing) ═══

export async function enrichContact(email: string): Promise<Partial<ProspectedLead> | null> {
  if (!APOLLO_API_KEY) return null;

  const res = await fetch(`${BASE_URL}/people/match`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'X-Api-Key': APOLLO_API_KEY,
    },
    body: JSON.stringify({ email }),
  });

  if (!res.ok) return null;

  const data = await res.json();
  const person = data.person;
  if (!person) return null;

  return {
    name: person.name,
    phone: person.phone_numbers?.[0]?.sanitized_number || null,
    email: person.email,
    linkedin: person.linkedin_url,
    company: person.organization_name,
  };
}
