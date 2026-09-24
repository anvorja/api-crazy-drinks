import { Mailer } from '../../../shared/application/ports.js';
import { AccountNotifier } from '../../application/ports/account-notifier.port.js';

const escapeHtml = (value: string) =>
  value.replace(/[<>&"']/g, (c) => `&#${c.charCodeAt(0)};`);

const layout = (title: string, body: string) => `<!doctype html>
<html lang="es"><body style="margin:0;background:#1b1036;font-family:Arial,sans-serif;color:#fff">
<div style="max-width:520px;margin:0 auto;padding:32px 24px">
<p style="color:#ffb86b;letter-spacing:3px;font-size:13px;margin:0 0 16px">API DRINKS</p>
<h1 style="font-size:22px;margin:0 0 16px">${title}</h1>
${body}
<p style="color:#ffffff99;font-size:12px;margin-top:32px">Si no fuiste tú, ignora este correo.</p>
</div></body></html>`;

/** The account emails, in Spanish. `resetUrl` is the frontend page that finishes the reset. */
export class EmailAccountNotifier implements AccountNotifier {
  constructor(
    private readonly mailer: Mailer,
    private readonly resetUrl: string,
  ) {}

  async passwordResetRequested(
    to: { email: string; name: string },
    token: string,
    expiresInMinutes: number,
  ): Promise<void> {
    const link = `${this.resetUrl}?token=${encodeURIComponent(token)}`;
    await this.mailer.send({
      to: to.email,
      subject: 'Restablece tu contraseña',
      text: `Hola ${to.name}:\n\nPara elegir una contraseña nueva abre este enlace (vence en ${expiresInMinutes} minutos y sirve una sola vez):\n${link}\n\nSi no lo pediste, ignora este correo: tu contraseña no cambia.`,
      html: layout(
        'Restablece tu contraseña',
        `<p>Hola ${escapeHtml(to.name)}:</p>
<p>Para elegir una contraseña nueva usa este botón. Vence en ${expiresInMinutes} minutos y sirve una sola vez.</p>
<p><a href="${escapeHtml(link)}" style="display:inline-block;background:#ff7a59;color:#fff;padding:12px 20px;border-radius:8px;text-decoration:none">Elegir contraseña nueva</a></p>
<p style="color:#ffffffaa;font-size:13px">Si no lo pediste, ignora este correo: tu contraseña no cambia.</p>`,
      ),
    });
  }

  async passwordChanged(to: { email: string; name: string }): Promise<void> {
    await this.mailer.send({
      to: to.email,
      subject: 'Tu contraseña cambió',
      text: `Hola ${to.name}:\n\nLa contraseña de tu cuenta acaba de cambiar y cerramos todas tus sesiones. Si no fuiste tú, restablécela de inmediato.`,
      html: layout(
        'Tu contraseña cambió',
        `<p>Hola ${escapeHtml(to.name)}:</p><p>La contraseña de tu cuenta acaba de cambiar y cerramos todas tus sesiones. Si no fuiste tú, restablécela de inmediato.</p>`,
      ),
    });
  }
}
