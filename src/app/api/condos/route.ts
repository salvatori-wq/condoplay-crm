import { NextRequest, NextResponse } from 'next/server';
import { supabaseServer } from '@/lib/supabase-server';
import { DEFAULT_TENANT_ID } from '@/lib/env';

// GET — list all condos
export async function GET() {
  const { data, error } = await supabaseServer
    .from('condos')
    .select('*')
    .order('name');
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json(data);
}

// POST — create a new condo
export async function POST(req: NextRequest) {
  const body = await req.json();
  const { name, units, monthly_plan, status, address } = body;

  if (!name) {
    return NextResponse.json({ error: 'name is required' }, { status: 400 });
  }

  const { data, error } = await supabaseServer
    .from('condos')
    .insert({
      tenant_id: DEFAULT_TENANT_ID,
      name,
      units: units ?? null,
      monthly_plan: monthly_plan ?? 0,
      status: status ?? 'implantacao',
      address: address ?? null,
    })
    .select()
    .single();

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json(data, { status: 201 });
}

// PUT — update a condo by id
export async function PUT(req: NextRequest) {
  const body = await req.json();
  const { id, ...fields } = body;

  if (!id) {
    return NextResponse.json({ error: 'id is required' }, { status: 400 });
  }

  // Only allow safe fields
  const allowed: Record<string, unknown> = {};
  for (const key of ['name', 'units', 'monthly_plan', 'status', 'address'] as const) {
    if (key in fields) allowed[key] = fields[key];
  }

  const { data, error } = await supabaseServer
    .from('condos')
    .update(allowed)
    .eq('id', id)
    .select()
    .single();

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json(data);
}

// DELETE — delete a condo by id
export async function DELETE(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  const id = searchParams.get('id');

  if (!id) {
    return NextResponse.json({ error: 'id query param is required' }, { status: 400 });
  }

  const { error } = await supabaseServer
    .from('condos')
    .delete()
    .eq('id', id);

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ ok: true });
}
