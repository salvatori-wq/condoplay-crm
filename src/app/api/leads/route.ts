import { NextRequest } from 'next/server';
import { supabaseServer } from '@/lib/supabase-server';
import { DEFAULT_TENANT_ID } from '@/lib/env';
import type { LeadStatus } from '@/types/database';

// ═══ GET /api/leads — Fetch leads with optional filters ═══
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = request.nextUrl;
    const status = searchParams.get('status') as LeadStatus | null;
    const search = searchParams.get('search');

    let query = supabaseServer
      .from('leads')
      .select('*')
      .order('created_at', { ascending: false });

    if (status) {
      query = query.eq('status', status);
    }

    if (search) {
      // Search across name, phone, email, and metadata (condoName stored there)
      query = query.or(
        `name.ilike.%${search}%,phone.ilike.%${search}%,email.ilike.%${search}%`
      );
    }

    const { data, error } = await query;

    if (error) {
      return Response.json({ error: error.message }, { status: 500 });
    }

    return Response.json(data);
  } catch (err) {
    return Response.json(
      { error: err instanceof Error ? err.message : 'Internal server error' },
      { status: 500 }
    );
  }
}

// ═══ POST /api/leads — Create a new lead ═══
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { name, phone, condoName, units, city, source, email, role } = body;

    if (!name) {
      return Response.json({ error: 'Nome e obrigatorio' }, { status: 400 });
    }

    const metadata: Record<string, unknown> = {};
    if (condoName) metadata.condoName = condoName;
    if (units) metadata.units = Number(units);
    if (city) metadata.city = city;

    const { data, error } = await supabaseServer
      .from('leads')
      .insert({
        tenant_id: DEFAULT_TENANT_ID,
        name,
        phone: phone || null,
        email: email || null,
        role: role || null,
        source: source || null,
        source_cost: 0,
        status: 'prospectado' as LeadStatus,
        qualified: false,
        notes: null,
        metadata,
      })
      .select()
      .single();

    if (error) {
      return Response.json({ error: error.message }, { status: 500 });
    }

    return Response.json(data, { status: 201 });
  } catch (err) {
    return Response.json(
      { error: err instanceof Error ? err.message : 'Internal server error' },
      { status: 500 }
    );
  }
}

// ═══ PUT /api/leads — Update a lead ═══
export async function PUT(request: NextRequest) {
  try {
    const body = await request.json();
    const { id, ...updates } = body;

    if (!id) {
      return Response.json({ error: 'ID e obrigatorio' }, { status: 400 });
    }

    // Build the update object with only allowed fields
    const allowed: Record<string, unknown> = {};
    if (updates.name !== undefined) allowed.name = updates.name;
    if (updates.phone !== undefined) allowed.phone = updates.phone;
    if (updates.email !== undefined) allowed.email = updates.email;
    if (updates.role !== undefined) allowed.role = updates.role;
    if (updates.status !== undefined) allowed.status = updates.status;
    if (updates.notes !== undefined) allowed.notes = updates.notes;
    if (updates.qualified !== undefined) allowed.qualified = updates.qualified;
    if (updates.metadata !== undefined) allowed.metadata = updates.metadata;
    if (updates.source !== undefined) allowed.source = updates.source;

    if (Object.keys(allowed).length === 0) {
      return Response.json({ error: 'Nenhum campo para atualizar' }, { status: 400 });
    }

    const { data, error } = await supabaseServer
      .from('leads')
      .update(allowed)
      .eq('id', id)
      .select()
      .single();

    if (error) {
      return Response.json({ error: error.message }, { status: 500 });
    }

    return Response.json(data);
  } catch (err) {
    return Response.json(
      { error: err instanceof Error ? err.message : 'Internal server error' },
      { status: 500 }
    );
  }
}

// ═══ DELETE /api/leads — Delete a lead by ID ═══
export async function DELETE(request: NextRequest) {
  try {
    const { searchParams } = request.nextUrl;
    const id = searchParams.get('id');

    if (!id) {
      return Response.json({ error: 'ID e obrigatorio' }, { status: 400 });
    }

    const { error } = await supabaseServer
      .from('leads')
      .delete()
      .eq('id', id);

    if (error) {
      return Response.json({ error: error.message }, { status: 500 });
    }

    return Response.json({ success: true });
  } catch (err) {
    return Response.json(
      { error: err instanceof Error ? err.message : 'Internal server error' },
      { status: 500 }
    );
  }
}
