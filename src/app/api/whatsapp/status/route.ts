import { NextResponse } from 'next/server';
import { getInstanceStatus, getQrCode, createInstance, setWebhook } from '@/lib/evolution-api';

export async function GET() {
  const apiUrl = process.env.NEXT_PUBLIC_EVOLUTION_API_URL;
  const apiKey = process.env.EVOLUTION_API_KEY;

  if (!apiUrl || !apiKey) {
    return NextResponse.json({
      connected: false,
      configured: false,
      message: 'Evolution API nao configurada. Adicione NEXT_PUBLIC_EVOLUTION_API_URL e EVOLUTION_API_KEY no .env.local',
    });
  }

  try {
    const status = await getInstanceStatus();

    return NextResponse.json({
      connected: status?.instance?.state === 'open',
      configured: true,
      state: status?.instance?.state || 'unknown',
      instance: status?.instance,
    });
  } catch (err) {
    const errorMsg = err instanceof Error ? err.message : 'Erro ao conectar com Evolution API';
    console.error('[WhatsApp GET] Status check failed:', errorMsg);
    return NextResponse.json(
      {
        connected: false,
        configured: true,
        message: errorMsg,
      },
      { status: 500 }
    );
  }
}

export async function POST() {
  try {
    // Try to create instance (ignore if already exists)
    try {
      await createInstance();
    } catch (err) {
      // Instance may already exist — that's fine
      console.log('[WhatsApp POST] Instance creation skipped:', err instanceof Error ? err.message : String(err));
    }

    // Set webhook
    const appUrl = process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3002';
    try {
      await setWebhook(`${appUrl}/api/webhook/evolution`);
    } catch (err) {
      // Webhook may already be set
      console.log('[WhatsApp POST] Webhook setup skipped:', err instanceof Error ? err.message : String(err));
    }

    // Get QR code via /instance/connect
    let qr;
    try {
      qr = await getQrCode();
    } catch (err) {
      console.error('[WhatsApp POST] QR code generation failed:', err instanceof Error ? err.message : String(err));
      throw err;
    }

    const response = {
      ok: true,
      qrcode: qr?.base64 || null,
      pairingCode: qr?.pairingCode || null,
      code: qr?.code || null,
    };

    console.log('[WhatsApp POST] QR code generated successfully');
    return NextResponse.json(response);
  } catch (err) {
    const errorMsg = err instanceof Error ? err.message : String(err);
    console.error('[WhatsApp POST] Error:', errorMsg, err);
    return NextResponse.json(
      {
        error: 'qr_failed',
        message: errorMsg,
        details: process.env.NODE_ENV === 'development' ? String(err) : undefined
      },
      { status: 500 }
    );
  }
}
