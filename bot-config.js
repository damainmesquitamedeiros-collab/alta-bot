export const botConfigGroups = [
  {
    id: 'general',
    label: 'Geral e aparência',
    fields: [
      { key: 'panelTitlePrefix', label: 'Identidade nos painéis', type: 'text', defaultValue: 'ALTA BOT', maxLength: 32 },
      { key: 'accentColor', label: 'Cor principal em HEX', type: 'color', defaultValue: '#E50914' },
      { key: 'footerText', label: 'Texto de rodapé dos painéis', type: 'text', defaultValue: 'ALTA BOT', maxLength: 100 },
      { key: 'commandCooldownSeconds', label: 'Intervalo entre comandos (seg)', type: 'number', defaultValue: 0, min: 0, max: 3600 },
      { key: 'serverAdminAccess', label: 'Admins do servidor podem usar o bot? sim/não', type: 'boolean', defaultValue: true },
    ],
  },
  {
    id: 'antispam',
    label: 'Anti-spam',
    fields: [
      { key: 'antiSpamEnabled', label: 'Ativar anti-spam? sim/não', type: 'boolean', defaultValue: true },
      { key: 'antiSpamMessageCount', label: 'Mensagens para detectar (2-10)', type: 'number', defaultValue: 3, min: 2, max: 10 },
      { key: 'antiSpamWindowSeconds', label: 'Janela de detecção em segundos', type: 'number', defaultValue: 5, min: 1, max: 60 },
      { key: 'antiSpamRepeatWindowMinutes', label: 'Janela para reincidência (min)', type: 'number', defaultValue: 10, min: 1, max: 1440 },
      { key: 'antiSpamWarning', label: 'Mensagem do primeiro aviso', type: 'text', defaultValue: 'detectei spam. Uma nova ocorrência pode resultar em expulsão.', maxLength: 220 },
    ],
  },
  {
    id: 'antispam-alerts',
    label: 'Anti-spam • avisos',
    fields: [
      { key: 'antiSpamMentionUser', label: 'Mencionar no aviso de spam? sim/não', type: 'boolean', defaultValue: true },
    ],
  },
  {
    id: 'antiraid',
    label: 'Anti-raid',
    fields: [
      { key: 'antiRaidEnabled', label: 'Ativar anti-raid? sim/não', type: 'boolean', defaultValue: true },
      { key: 'antiRaidAllowGuildOwner', label: 'Permitir bots adicionados pelo dono? sim/não', type: 'boolean', defaultValue: true },
      { key: 'antiRaidKickUnauthorized', label: 'Expulsar bots não autorizados? sim/não', type: 'boolean', defaultValue: true },
      { key: 'antiRaidRemoveInviterRoles', label: 'Remover cargos de quem adicionou? sim/não', type: 'boolean', defaultValue: true },
      { key: 'antiRaidChannelName', label: 'Nome do canal de registro', type: 'text', defaultValue: 'anti-raid', maxLength: 100 },
    ],
  },
  {
    id: 'antiraid-logs',
    label: 'Anti-raid • registro',
    fields: [
      { key: 'antiRaidLogEnabled', label: 'Registrar eventos anti-raid? sim/não', type: 'boolean', defaultValue: true },
    ],
  },
  {
    id: 'tickets',
    label: 'Tickets',
    fields: [
      { key: 'ticketsEnabled', label: 'Ativar sistema de tickets? sim/não', type: 'boolean', defaultValue: true },
      { key: 'ticketPanelChannel', label: 'Canal do painel de tickets', type: 'text', defaultValue: '—͟͞͞🎟️┊ticket', maxLength: 100 },
      { key: 'ticketTranscriptChannel', label: 'Canal dos transcripts', type: 'text', defaultValue: 'logs-ticket', maxLength: 100 },
      { key: 'ticketRankingChannel', label: 'Canal do ranking', type: 'text', defaultValue: 'ranking', maxLength: 100 },
    ],
  },
  {
    id: 'tickets-limits',
    label: 'Tickets • limites',
    fields: [
      { key: 'ticketMaxOpenPerUser', label: 'Máximo de tickets abertos por pessoa', type: 'number', defaultValue: 1, min: 1, max: 5 },
    ],
  },
  {
    id: 'tellonym',
    label: 'Tellonym',
    fields: [
      { key: 'tellonymEnabled', label: 'Ativar Tellonym? sim/não', type: 'boolean', defaultValue: true },
      { key: 'tellonymPanelChannel', label: 'Canal do painel Tellonym', type: 'text', defaultValue: '—͟͞͞📩┊enviar・tellonym', maxLength: 100 },
      { key: 'tellonymReceiveChannel', label: 'Canal de recebimento', type: 'text', defaultValue: '—͟͞͞📨┊tellonym', maxLength: 100 },
      { key: 'tellonymCooldownSeconds', label: 'Intervalo para enviar (seg)', type: 'number', defaultValue: 30, min: 0, max: 3600 },
      { key: 'tellonymMaxMessageLength', label: 'Tamanho máximo da mensagem', type: 'number', defaultValue: 1500, min: 50, max: 4000 },
    ],
  },
  {
    id: 'tellonym-modes',
    label: 'Tellonym • modos',
    fields: [
      { key: 'tellonymAllowAnonymousMode', label: 'Permitir modo anônimo? sim/não', type: 'boolean', defaultValue: true },
      { key: 'tellonymAllowPublicMode', label: 'Permitir modo público? sim/não', type: 'boolean', defaultValue: true },
    ],
  },
  {
    id: 'instagram',
    label: 'Instagram',
    fields: [
      { key: 'instagramEnabled', label: 'Ativar Instagram? sim/não', type: 'boolean', defaultValue: true },
      { key: 'instagramChannel', label: 'Canal do Instagram', type: 'text', defaultValue: '—͟͞͞📱┊instagram', maxLength: 100 },
      { key: 'instagramMaxPhotos', label: 'Máximo de fotos por post (1-10)', type: 'number', defaultValue: 4, min: 1, max: 10 },
      { key: 'instagramMaxImageMegabytes', label: 'Limite por foto em MiB', type: 'number', defaultValue: 8, min: 1, max: 24 },
      { key: 'instagramDeleteOriginal', label: 'Apagar foto original após postar? sim/não', type: 'boolean', defaultValue: true },
    ],
  },
  {
    id: 'instagram-media',
    label: 'Instagram • mídia',
    fields: [
      { key: 'instagramAllowGif', label: 'Aceitar imagens GIF? sim/não', type: 'boolean', defaultValue: true },
      { key: 'instagramCaptionMaxLength', label: 'Tamanho máximo da legenda', type: 'number', defaultValue: 1800, min: 0, max: 1800 },
      { key: 'instagramMaxPostMegabytes', label: 'Limite total por publicação em MiB', type: 'number', defaultValue: 16, min: 1, max: 24 },
    ],
  },
  {
    id: 'staff-applications',
    label: 'Candidaturas de Staff',
    fields: [
      { key: 'staffApplicationsEnabled', label: 'Ativar painel de candidaturas? sim/não', type: 'boolean', defaultValue: true },
    ],
  },
  {
    id: 'moderation',
    label: 'Moderação',
    fields: [
      { key: 'moderationAuditEnabled', label: 'Registrar ações de moderação? sim/não', type: 'boolean', defaultValue: true },
      { key: 'moderationLogChannel', label: 'Canal de logs de moderação', type: 'text', defaultValue: '', maxLength: 100 },
      { key: 'moderationBanEnabled', label: 'Ativar comando /ban? sim/não', type: 'boolean', defaultValue: true },
      { key: 'moderationKickEnabled', label: 'Ativar comando /kick? sim/não', type: 'boolean', defaultValue: true },
      { key: 'moderationTimeoutEnabled', label: 'Ativar comandos de timeout? sim/não', type: 'boolean', defaultValue: true },
    ],
  },
  {
    id: 'limits',
    label: 'Limites e proteção',
    fields: [
      { key: 'dmCooldownSeconds', label: 'Intervalo entre DMs (seg)', type: 'number', defaultValue: 60, min: 0, max: 3600 },
      { key: 'stickerCooldownSeconds', label: 'Intervalo entre figurinhas (seg)', type: 'number', defaultValue: 60, min: 0, max: 3600 },
      { key: 'exportCooldownSeconds', label: 'Intervalo de exportação (seg)', type: 'number', defaultValue: 60, min: 0, max: 3600 },
      { key: 'exportMaxTotalMegabytes', label: 'Limite total de exportação MiB', type: 'number', defaultValue: 6, min: 1, max: 24 },
      { key: 'exportMaxFileMegabytes', label: 'Limite por asset exportado MiB', type: 'number', defaultValue: 2, min: 1, max: 25 },
    ],
  },
];

export const botConfigFields = botConfigGroups.flatMap((group) => group.fields);

export const botConfigDefaults = Object.fromEntries(
  botConfigFields.map(({ key, defaultValue }) => [key, defaultValue]),
);

export function parseBotConfigValue(field, rawValue) {
  const value = rawValue.trim();
  if (field.type === 'boolean') {
    if (/^(sim|s|true|1|ativado|on)$/i.test(value)) return true;
    if (/^(não|nao|n|false|0|desativado|off)$/i.test(value)) return false;
    throw new Error(`Use sim ou não para “${field.label}”.`);
  }
  if (field.type === 'number') {
    if (!/^\d+$/.test(value)) throw new Error(`Informe um número inteiro para “${field.label}”.`);
    const number = Number(value);
    if (number < field.min || number > field.max) {
      throw new Error(`“${field.label}” precisa ficar entre ${field.min} e ${field.max}.`);
    }
    return number;
  }
  if (field.type === 'color') {
    if (!/^#?[0-9a-f]{6}$/i.test(value)) throw new Error('Informe a cor principal no formato HEX, por exemplo #E50914.');
    return `#${value.replace(/^#/, '').toUpperCase()}`;
  }
  if (value.length > field.maxLength) {
    throw new Error(`“${field.label}” aceita no máximo ${field.maxLength} caracteres.`);
  }
  return value;
}
