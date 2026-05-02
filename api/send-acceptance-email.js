/**
 * Loyal Production — Acceptance email serverless function (Vercel).
 *
 * POST /api/send-acceptance-email
 *
 * Body (JSON):
 *   { booking_id: string, total_price?: number|null, note?: string|null }
 *
 * Headers:
 *   Authorization: Bearer <admin password>     (compared to env ADMIN_PASSWORD)
 *
 * Behavior:
 *   1. Validates auth.
 *   2. Re-fetches the booking from Supabase (using anon key, RLS is permissive).
 *      We never trust the caller for the email recipient or booking content —
 *      the booking_id is the only identifier we accept.
 *   3. Builds a brand-matched HTML email with downpayment instructions and
 *      sends it via Resend.
 *
 * Environment variables (set on Vercel):
 *   RESEND_API_KEY     — required
 *   ADMIN_PASSWORD     — required (must match the Bearer token)
 *   RESEND_FROM        — optional, defaults to "Loyal Production <onboarding@resend.dev>"
 *   SITE_URL           — optional, defaults to "https://loyal-production.vercel.app"
 *   SUPABASE_URL       — optional, defaults to the public project URL
 *   SUPABASE_ANON_KEY  — optional, defaults to the public anon key
 *   PAYMENT_GCASH      — optional, e.g. "0949-648-8368 — EARL SUMALBAG"
 *   PAYMENT_MAYA       — optional
 *   PAYMENT_BANK       — optional, e.g. "BPI 1234-5678-90 — Earl Sumalbag"
 *   REPLY_TO           — optional, customer replies go here (e.g. business inbox)
 */

import { Resend } from 'resend';

const SUPABASE_URL = process.env.SUPABASE_URL || 'https://wxiwknkeqgptjlhfcwnt.supabase.co';
const SUPABASE_ANON_KEY = process.env.SUPABASE_ANON_KEY || 'sb_publishable_-QVYmHFZsMHzS7RjAUh5Zg_xtPsHoZg';
const SITE_URL = process.env.SITE_URL || 'https://loyal-production.vercel.app';
const FROM = process.env.RESEND_FROM || 'Loyal Production <onboarding@resend.dev>';
const REPLY_TO = process.env.REPLY_TO || '';

const PAY_GCASH = process.env.PAYMENT_GCASH || '0949-648-8368 — EARL SUMALBAG';
const PAY_MAYA = process.env.PAYMENT_MAYA || '0949-648-8368 — EARL SUMALBAG';
const PAY_BANK = process.env.PAYMENT_BANK || '';

function escapeHtml(value) {
  if (value == null) return '';
  return String(value)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

function formatPHP(amount) {
  if (amount == null || Number.isNaN(Number(amount))) return '';
  return `₱${Number(amount).toLocaleString('en-PH', {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  })}`;
}

function formatLong(date) {
  if (!date) return '';
  if (/^\d{4}-\d{2}-\d{2}$/.test(date)) {
    return new Date(`${date}T12:00:00`).toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'long',
      day: 'numeric',
    });
  }
  return String(date);
}

async function fetchBooking(id) {
  const url = `${SUPABASE_URL}/rest/v1/bookings?id=eq.${encodeURIComponent(id)}&select=*&limit=1`;
  const res = await fetch(url, {
    headers: {
      apikey: SUPABASE_ANON_KEY,
      Authorization: `Bearer ${SUPABASE_ANON_KEY}`,
    },
  });
  if (!res.ok) {
    const text = await res.text().catch(() => '');
    throw new Error(`Supabase fetch failed (${res.status}): ${text}`);
  }
  const rows = await res.json();
  return Array.isArray(rows) ? rows[0] : null;
}

function eventLabel(b) {
  if (b.event_type === 'other' && b.other_event_type) return b.other_event_type;
  return b.event_type || 'Event';
}

function buildEmail({ booking, totalPrice, note }) {
  const eventType = eventLabel(booking);
  const eventDate = formatLong(booking.event_date);
  const refId = String(booking.id || '').slice(0, 8).toUpperCase();
  const statusUrl = `${SITE_URL}/status?email=${encodeURIComponent(booking.email)}`;

  const total = totalPrice && !Number.isNaN(Number(totalPrice)) ? Number(totalPrice) : null;
  const downpayment = total != null ? total * 0.5 : null;

  const subject = `Booking Accepted — ${eventType} on ${eventDate} (Ref ${refId})`;

  const downpaymentLine = downpayment != null
    ? `<strong>${formatPHP(downpayment)}</strong> (50% of ${formatPHP(total)})`
    : '<strong>50% of the agreed total</strong>';

  const downpaymentText = downpayment != null
    ? `${formatPHP(downpayment)} (50% of ${formatPHP(total)})`
    : '50% of the agreed total';

  const noteHtml = note
    ? `<div style="background:#fff8e7;padding:14px 18px;border-left:4px solid #9c884d;border-radius:8px;margin:0 0 22px;color:#444;font-size:14px;line-height:1.5;"><strong style="color:#9c884d;">Note from Loyal Production:</strong><br>${escapeHtml(note).replace(/\n/g, '<br>')}</div>`
    : '';

  const paymentItems = [
    PAY_GCASH && `<li style="margin:6px 0;color:#333;"><strong>GCash:</strong> ${escapeHtml(PAY_GCASH)}</li>`,
    PAY_MAYA && `<li style="margin:6px 0;color:#333;"><strong>Maya:</strong> ${escapeHtml(PAY_MAYA)}</li>`,
    PAY_BANK && `<li style="margin:6px 0;color:#333;"><strong>Bank:</strong> ${escapeHtml(PAY_BANK)}</li>`,
  ].filter(Boolean).join('\n');

  const html = `<!DOCTYPE html>
<html><head><meta charset="utf-8"><title>${escapeHtml(subject)}</title></head>
<body style="margin:0;padding:0;background:#f5f3ee;font-family:Arial,Helvetica,sans-serif;color:#222;">
  <div style="max-width:620px;margin:0 auto;background:#ffffff;">
    <div style="background:#161616;padding:26px 32px;text-align:center;">
      <h1 style="margin:0;font-family:'Montserrat',Arial,sans-serif;font-size:22px;letter-spacing:2px;color:#9c884d;font-weight:700;">LOYAL PRODUCTION</h1>
      <p style="margin:6px 0 0;font-size:13px;color:#aaaaaa;">Photo &amp; Video — Cebu, Philippines</p>
    </div>

    <div style="padding:32px;">
      <h2 style="margin:0 0 8px;font-size:24px;color:#222;font-family:Arial,Helvetica,sans-serif;">Your booking is accepted 🎉</h2>
      <p style="margin:0 0 22px;color:#555;font-size:15px;line-height:1.55;">
        Hi ${escapeHtml(booking.name || 'there')}, salamat sa pag-book sa Loyal Production. Na-accept na namin ang request mo.
        Para ma-confirm at ma-set ang booking, kindly send the downpayment below.
      </p>

      <div style="background:#faf8f3;border-radius:12px;padding:18px 20px;margin-bottom:22px;border:1px solid #eee5cf;">
        <p style="margin:0 0 8px;font-size:11px;text-transform:uppercase;letter-spacing:1.5px;color:#9c884d;font-weight:700;">Booking Details</p>
        <table style="width:100%;border-collapse:collapse;font-size:14px;color:#333;">
          <tr><td style="padding:5px 0;color:#888;width:30%;">Reference</td><td style="padding:5px 0;font-family:monospace;">#${escapeHtml(refId)}</td></tr>
          <tr><td style="padding:5px 0;color:#888;">Event</td><td style="padding:5px 0;">${escapeHtml(eventType)}</td></tr>
          <tr><td style="padding:5px 0;color:#888;">Date</td><td style="padding:5px 0;">${escapeHtml(eventDate)}</td></tr>
          <tr><td style="padding:5px 0;color:#888;">Venue</td><td style="padding:5px 0;">${escapeHtml(booking.venue || '—')}</td></tr>
          <tr><td style="padding:5px 0;color:#888;">Service</td><td style="padding:5px 0;">${escapeHtml(booking.service_type || '—')}</td></tr>
        </table>
      </div>

      <div style="background:#fff8e7;border-radius:12px;padding:20px;margin-bottom:22px;border-left:4px solid #9c884d;">
        <p style="margin:0 0 8px;font-size:11px;text-transform:uppercase;letter-spacing:1.5px;color:#9c884d;font-weight:700;">Downpayment to Confirm</p>
        <p style="margin:0;font-size:17px;color:#222;line-height:1.45;">Please pay ${downpaymentLine} via any method below:</p>
        <ul style="margin:14px 0 0;padding-left:20px;font-size:14px;line-height:1.65;">
          ${paymentItems || '<li style="color:#666;">Payment details available on request.</li>'}
        </ul>
        <p style="margin:14px 0 0;font-size:13px;color:#555;line-height:1.5;">
          After paying, please send a screenshot of the receipt back to us (reply to this email or message us on Messenger/Instagram) along with reference <strong>#${escapeHtml(refId)}</strong>.
          Bookings without a received downpayment before the event date will be moved to declined.
        </p>
      </div>

      ${noteHtml}

      <p style="margin:0 0 18px;color:#444;font-size:14px;line-height:1.5;">
        You can track your booking status anytime here:<br>
        <a href="${escapeHtml(statusUrl)}" style="color:#9c884d;font-weight:600;text-decoration:none;">${escapeHtml(statusUrl)}</a>
      </p>

      <p style="margin:24px 0 0;color:#777;font-size:13px;line-height:1.5;">
        Salamat,<br>
        <strong style="color:#9c884d;">Loyal Production</strong>
      </p>
    </div>

    <div style="background:#f5f3ee;padding:14px 32px;text-align:center;font-size:12px;color:#999;line-height:1.5;">
      This email was sent because your booking <strong>#${escapeHtml(refId)}</strong> was accepted on the Loyal Production site.<br>
      If you didn't make this booking, please ignore this message or contact us directly.
    </div>
  </div>
</body></html>`;

  const paymentText = [
    PAY_GCASH && `GCash: ${PAY_GCASH}`,
    PAY_MAYA && `Maya: ${PAY_MAYA}`,
    PAY_BANK && `Bank: ${PAY_BANK}`,
  ].filter(Boolean).join('\n');

  const text = `Hi ${booking.name || 'there'},

Your Loyal Production booking has been accepted.

Reference: #${refId}
Event: ${eventType}
Date: ${eventDate}
Venue: ${booking.venue || '—'}
Service: ${booking.service_type || '—'}

To confirm and set the booking, please pay ${downpaymentText} via any of:
${paymentText}

After paying, send a screenshot of the receipt with reference #${refId}.
Bookings without payment received before the event date will be moved to declined.

${note ? `Note from Loyal Production:\n${note}\n\n` : ''}Track your booking: ${statusUrl}

Salamat,
Loyal Production`;

  return { subject, html, text };
}

export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');
  if (req.method === 'OPTIONS') {
    res.status(204).end();
    return;
  }
  if (req.method !== 'POST') {
    res.status(405).json({ error: 'Method not allowed' });
    return;
  }

  // Auth: Authorization: Bearer <admin password>
  const authHeader = req.headers.authorization || '';
  const m = authHeader.match(/^Bearer\s+(.+)$/i);
  const provided = m ? m[1].trim() : '';
  const expected = process.env.ADMIN_PASSWORD || '';
  if (!expected) {
    console.error('[send-acceptance-email] ADMIN_PASSWORD not set on the server');
    res.status(500).json({ error: 'Email service not configured (admin auth).' });
    return;
  }
  if (!provided || provided !== expected) {
    res.status(401).json({ error: 'Unauthorized' });
    return;
  }

  const RESEND_API_KEY = process.env.RESEND_API_KEY;
  if (!RESEND_API_KEY) {
    console.error('[send-acceptance-email] RESEND_API_KEY not set');
    res.status(500).json({ error: 'Email service not configured.' });
    return;
  }

  try {
    const body = req.body && typeof req.body === 'object' && !Buffer.isBuffer(req.body)
      ? req.body
      : JSON.parse(req.body || '{}');

    const { booking_id, total_price, note } = body;
    if (!booking_id) {
      res.status(400).json({ error: 'booking_id is required' });
      return;
    }

    const booking = await fetchBooking(booking_id);
    if (!booking) {
      res.status(404).json({ error: 'Booking not found' });
      return;
    }
    if (!booking.email || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(booking.email)) {
      res.status(400).json({ error: 'Booking has no valid email address.' });
      return;
    }

    const { subject, html, text } = buildEmail({ booking, totalPrice: total_price, note });

    const resend = new Resend(RESEND_API_KEY);
    const emailPayload = {
      from: FROM,
      to: booking.email,
      subject,
      html,
      text,
    };
    if (REPLY_TO) emailPayload.replyTo = REPLY_TO;

    const result = await resend.emails.send(emailPayload);

    if (result.error) {
      console.error('[send-acceptance-email] Resend error:', result.error);
      res.status(502).json({
        error: 'Email send failed',
        details: result.error.message || String(result.error),
      });
      return;
    }

    res.status(200).json({
      ok: true,
      id: result.data && result.data.id,
      to: booking.email,
    });
  } catch (err) {
    console.error('[send-acceptance-email] Failed:', err);
    res.status(500).json({ error: err.message || 'Internal error' });
  }
}
