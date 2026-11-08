import 'dotenv/config';
import archiver from 'archiver';
import {
  ActionRowBuilder,
  AuditLogEvent,
  ButtonBuilder,
  ButtonStyle,
  ChannelType,
  Client,
  EmbedBuilder,
  GatewayIntentBits,
  MessageFlags,
  ModalBuilder,
  parseEmoji,
  PermissionFlagsBits,
  RoleSelectMenuBuilder,
  StickerFormatType,
  StringSelectMenuBuilder,
  StringSelectMenuOptionBuilder,
  TextInputBuilder,
  TextInputStyle,
  UserSelectMenuBuilder,
} from 'discord.js';
import { entersState, joinVoiceChannel, VoiceConnectionStatus } from '@discordjs/voice';
import { botConfigDefaults, botConfigGroups, botConfigFields, parseBotConfigValue } from './bot-config.js';
import { createWriteStream } from 'node:fs';
import { mkdtemp, rm } from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import {
  addInstagramComment,
  addTellonymComment,
  claimStaffApplication,
  completeStaffApplication,
  deletePendingStaffApplication,
  deleteInstagramPost,
  getAuthorizedUserIds,
  getBotConfig,
  getInstagramComments,
  getInstagramPost,
  getLogChannelId,
  getStaffApplication,
  grantUser,
  getPendingStaffApplications,
  getServerStatusState,
  getStaffFeedbackRequest,
  getStaffFeedbackSummary,
  getTellonymComments,
  getTellonymPost,
  recordHandledTicket,
  recordStaffFeedback,
  recordStaffFeedbackRequest,
  recordInstagramPost,
  recordStaffApplication,
  recordTellonymPost,
  releaseStaffApplication,
  revokeUser,
  setLogChannelId,
  setBotConfig,
  setServerStatusState,
  incrementServerVisit,
  toggleInstagramLike,
  toggleTellonymLike,
} from './storage.js';

const token = process.env.DISCORD_TOKEN;
const ownerId = process.env.OWNER_DISCORD_ID;
const ownerDisplayName = 'mnrdnx7_';
const projectDirectory = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const ticketPanelImagePath = path.join(projectDirectory, 'assets', 'ticket-panel.png');
if (!token) throw new Error('Configure DISCORD_TOKEN no arquivo .env.');
if (!ownerId || !/^\d{17,20}$/.test(ownerId)) {
  throw new Error('Configure OWNER_DISCORD_ID com o ID numérico do dono no arquivo .env.');
}

const client = new Client({
  intents: [
    GatewayIntentBits.Guilds,
    GatewayIntentBits.GuildMembers,
    GatewayIntentBits.GuildMessages,
    GatewayIntentBits.MessageContent,
    GatewayIntentBits.GuildPresences,
    GatewayIntentBits.GuildVoiceStates,
  ],
});
const permanentVoiceGuildId = '1466842333243904032';
const permanentVoiceChannelId = '1568834974998732851';
const serverStatusGuildId = '1466842333243904032';
const serverStatusChannelId = '1568836774891884694';
const serverEntryChannelId = '1565356093570551870';
const serverExitChannelId = '1565356103708180480';
const serverStatusStaffRoleId = '1565366774004715580';
const serverStatusGifPath = path.resolve(process.cwd(), 'assets', 'server-status.gif');
let permanentVoiceConnection;
let permanentVoiceReconnectTimer;
let serverStatusInitialized = false;
let serverStatusPendingEntries = 0;
let serverStatusPendingExits = 0;
let serverStatusRefreshTimer;
let serverStatusRefreshInFlight;
let serverStatusPresenceAvailable = false;
let serverStatusBotOnline = false;
let serverStatusLastPresenceFetchAt = 0;
const dmCooldowns = new Map();
const exportCooldowns = new Map();
const stickerCopyCooldowns = new Map();
const tellonymCooldowns = new Map();
const commandCooldowns = new Map();
const spamRecords = new Map();
const ticketAssignmentLocks = new Set();
const staffFeedbackSubmissionLocks = new Set();
const rankManagementLocks = new Set();
const boosterAnnouncementLocks = new Set();
const spamRepeatWindow = 24 * 60 * 60_000;
const maxSourceBytes = 6 * 1024 * 1024;
const maxAssetBytes = 2 * 1024 * 1024;
const maxStickerUploadBytes = 512 * 1024;
const ticketOpenButtonPrefix = 'alta-ticket:open';
const ticketCategoryMenuId = 'alta-ticket:category';
const ticketCloseButtonId = 'alta-ticket:close';
const ticketCloseConfirmButtonId = 'alta-ticket:close-confirm';
const ticketCloseCancelButtonId = 'alta-ticket:close-cancel';
const tellonymPrefix = 'alta-tellonym';
const botConfigPrefix = 'alta-config';
const instagramPrefix = 'alta-instagram';
const staffApplicationPrefix = 'alta-staff';
const staffFeedbackPrefix = 'alta-feedback';
const rankManagementPrefix = 'alta-rank';
const staffPanelChannelSlug = 'fazer-formulário';
const staffSubmissionsChannelSlug = 'formulários';
const staffApprovedChannelSlug = 'aprovados-staff';
const staffFeedbackChannelSlug = 'avaliar-staff';
const approvedStaffRoleName = '» 「Aprovados Staff」';
const staffApplicationQuestions = [
  { key: 'roblox', prompt: 'Nick do Roblox' },
  { key: 'age', prompt: 'Sua idade' },
  { key: 'availability', prompt: 'Dias e horários disponíveis' },
  { key: 'experience', prompt: 'Experiência como staff e registro de provas' },
  { key: 'motivation', prompt: 'Por que deseja fazer parte da equipe?' },
  { key: 'conflict', prompt: 'Como resolveria um conflito na equipe?' },
  { key: 'ruleViolation', prompt: 'O que faria ao ver alguém quebrando regras?' },
  { key: 'scenario', prompt: 'Como agiria numa denúncia sem provas?' },
  { key: 'weeklyHours', prompt: 'Quantas horas por semana pode dedicar?' },
  { key: 'commitment', prompt: 'Como manteria respeito e imparcialidade?' },
];
const instagramProcessing = new Set();
const ticketPanelDefaultText = [
  '## ✦ CENTRAL DE ATENDIMENTO',
  'Precisa de ajuda? Escolha uma opção no menu abaixo e nossa equipe vai cuidar do seu caso com atenção e privacidade.',
  '',
  '╭・**PARCERIA**  — propostas e oportunidades para crescer junto.',
  '├・**DENÚNCIA**  — relate uma situação com clareza e, se possível, envie provas.',
  '╰・**DÚVIDA**  — tire dúvidas e receba orientação da equipe.',
  '',
  '### COMO FUNCIONA',
  '`01`　Selecione o assunto no menu.',
  '`02`　Um canal privado será criado só para você e a equipe.',
  '`03`　Explique o caso e aguarde o atendimento.',
  '',
  '> Para agilizar, envie todas as informações relevantes em uma única conversa e evite abrir tickets duplicados.',
].join('\n');
const ticketEmojiAliases = {
  emoji_100: '🎟️',
  ticket: '🎫',
  red_circle: '🔴',
  triangular_flag_on_post: '🚩',
  crossed_swords: '⚔️',
  crown: '👑',
  moneybag: '💰',
  flag_black: '🏴',
  warning: '⚠️',
};

function safeText(text, maxLength = 400) {
  return text.replace(/@/g, '@\u200b').slice(0, maxLength);
}

function configColor(config) {
  return Number.parseInt(config.accentColor.slice(1), 16);
}

function configFooter(config, suffix = '') {
  return [config.footerText, suffix].filter(Boolean).join(' • ').slice(0, 2048);
}

async function findTextChannelByName(guild, channelName) {
  const channels = await guild.channels.fetch();
  return channels.find((channel) => (
    channel?.type === ChannelType.GuildText && channel.name === channelName
  )) ?? null;
}

async function findStaffChannelBySlug(guild, slug) {
  const channels = await guild.channels.fetch();
  return channels.find((channel) => (
    channel?.type === ChannelType.GuildText && channel.name.endsWith(`┊${slug}`)
  )) ?? null;
}

async function renderTicketPanelEmojis(guild, text) {
  if (!/:[a-zA-Z0-9_]{2,32}:/.test(text)) return text;
  const serverEmojis = await guild.emojis.fetch();
  return text.replace(/:([a-zA-Z0-9_]{2,32}):/g, (shortcode, name) => {
    const emoji = serverEmojis.find((candidate) => candidate.name === name);
    if (emoji) return `<${emoji.animated ? 'a' : ''}:${emoji.name}:${emoji.id}>`;
    return ticketEmojiAliases[name] ?? shortcode;
  });
}

async function findBotAdder(member) {
  let lastError;
  for (let attempt = 0; attempt < 3; attempt += 1) {
    try {
      const auditLogs = await member.guild.fetchAuditLogs({
        type: AuditLogEvent.BotAdd,
        limit: 10,
      });
      const entry = auditLogs.entries.find((candidate) => (
        candidate.target?.id === member.id
        && Date.now() - candidate.createdTimestamp <= 30_000
      ));
      if (entry) return entry.executor;
    } catch (error) {
      lastError = error;
    }

    if (attempt < 2) await new Promise((resolve) => setTimeout(resolve, 250));
  }
  if (lastError) throw lastError;
  return null;
}

async function handleBotJoin(member) {
  if (!member.user.bot) return;

  const config = await getBotConfig(member.guild.id);
  if (!config.antiRaidEnabled) return;
  const reason = 'Anti-raid do ALTA BOT: bot adicionado sem autorização.';
  let adder;
  try {
    adder = await findBotAdder(member);
  } catch (error) {
    console.error(`Não foi possível verificar quem adicionou o bot ${member.user.tag}:`, error);
  }

  if (config.antiRaidAllowGuildOwner && adder?.id === member.guild.ownerId) return;

  if (config.antiRaidKickUnauthorized) {
    try {
      await member.kick(reason);
      console.log(`Bot ${member.user.tag} expulso do servidor ${member.guild.name}; responsável: ${adder?.tag ?? 'desconhecido'}.`);
    } catch (error) {
      console.error(`Não foi possível expulsar o bot ${member.user.tag} do servidor ${member.guild.name}:`, error);
    }
  }

  if (!adder || !config.antiRaidRemoveInviterRoles) {
    if (!adder) console.error(`Não foi possível identificar quem adicionou ${member.user.tag}; cargos não foram alterados.`);
    await logAntiRaidEvent(member, adder, config);
    return;
  }
  if (adder.id === member.guild.ownerId) {
    await logAntiRaidEvent(member, adder, config);
    return;
  }

  try {
    const inviter = await member.guild.members.fetch(adder.id);
    const botMember = await member.guild.members.fetchMe();
    const removableRoleIds = inviter.roles.cache
      .filter((role) => role.id !== member.guild.id
        && !role.managed
        && botMember.roles.highest.comparePositionTo(role) > 0)
      .map((role) => role.id);
    if (removableRoleIds.length === 0) {
      console.warn(`Nenhum cargo removível encontrado para ${inviter.user.tag} no servidor ${member.guild.name}.`);
    } else {
      await inviter.roles.remove(removableRoleIds, reason);
      console.log(`Removidos ${removableRoleIds.length} cargo(s) de ${inviter.user.tag} no servidor ${member.guild.name}.`);
    }
  } catch (error) {
    if (error.code === 10007) {
      console.warn(`Quem adicionou ${member.user.tag} já não está no servidor; não há cargos para remover.`);
    } else {
      console.error(`Não foi possível remover cargos de ${adder.tag} no servidor ${member.guild.name}:`, error);
    }
  }
  await logAntiRaidEvent(member, adder, config);
}

async function handleBoosterAdded(oldMember, newMember) {
  if (oldMember.premiumSince || !newMember.premiumSince) return;

  const lockKey = `${newMember.guild.id}:${newMember.id}`;
  if (boosterAnnouncementLocks.has(lockKey)) return;
  boosterAnnouncementLocks.add(lockKey);
  try {
    const channel = await findStaffChannelBySlug(newMember.guild, 'boosters');
    if (!channel) {
      console.warn(`Não encontrei um canal terminado em ┊boosters no servidor ${newMember.guild.name}.`);
      return;
    }

    const botMember = await newMember.guild.members.fetchMe();
    const requiredPermissions = [
      PermissionFlagsBits.ViewChannel,
      PermissionFlagsBits.SendMessages,
      PermissionFlagsBits.EmbedLinks,
    ];
    if (!channel.permissionsFor(botMember)?.has(requiredPermissions)) {
      console.error(`Sem permissões de Ver canal, Enviar mensagens e Incorporar links no canal de boosts ${channel.name} (${channel.id}).`);
      return;
    }

    const now = new Date();
    const timestamp = new Intl.DateTimeFormat('pt-BR', {
      timeZone: 'America/Sao_Paulo',
      dateStyle: '2-digit',
      timeStyle: 'short',
    }).format(now);
    const premiumTier = Number(newMember.guild.premiumTier);
    const boostCount = newMember.guild.premiumSubscriptionCount;
    const tierLabel = Number.isInteger(premiumTier) && premiumTier >= 0
      ? `Nível ${premiumTier}`
      : 'Nível indisponível';
    const embed = new EmbedBuilder()
      .setColor(0x5865F2)
      .setAuthor({
        name: newMember.guild.name,
        ...(newMember.guild.iconURL() ? { iconURL: newMember.guild.iconURL() } : {}),
      })
      .setTitle('💎 OBRIGADO PELO BOOST!')
      .setDescription([
        'acabou de impulsionar o servidor!',
        '💙 Seu apoio ajuda muito a nossa comunidade.',
      ].join('\n'))
      .addFields(
        { name: '💎 Booster', value: `<@${newMember.id}>`, inline: true },
        { name: '🚀 Total de boosts', value: Number.isInteger(boostCount) ? `${boostCount} boosts` : 'Indisponível', inline: true },
        { name: '✨ Nível do servidor', value: tierLabel, inline: true },
      )
      .setThumbnail(newMember.displayAvatarURL())
      .setFooter({ text: `ID: ${newMember.id} • ${timestamp}` })
      .setTimestamp(newMember.premiumSince);

    await channel.send({
      content: `<@${newMember.id}>`,
      embeds: [embed],
      allowedMentions: { users: [newMember.id] },
    });
  } finally {
    boosterAnnouncementLocks.delete(lockKey);
  }
}

async function logAntiRaidEvent(member, adder, config) {
  if (!config.antiRaidLogEnabled) return;
  const channel = await findTextChannelByName(member.guild, config.antiRaidChannelName);
  if (!channel) return;
  await channel.send({
    content: `Anti-raid: o bot **${safeText(member.user.tag, 100)}** entrou no servidor. Responsável: ${adder ? `<@${adder.id}>` : 'não identificado'}.`,
    allowedMentions: { users: adder ? [adder.id] : [] },
  }).catch((error) => {
    console.error(`Não foi possível registrar o evento anti-raid em #${channel.name}:`, error);
  });
}

async function handleSpamMessage(message) {
  if (!message.guild || !message.author || message.author.bot || message.webhookId) return;

  const config = await getBotConfig(message.guild.id);
  if (!config.antiSpamEnabled) return;
  const now = Date.now();
  const messageWindow = config.antiSpamWindowSeconds * 1000;
  const repeatWindow = config.antiSpamRepeatWindowMinutes * 60_000;
  const key = `${message.guild.id}:${message.author.id}`;
  const record = spamRecords.get(key) ?? {
    messageTimestamps: [],
    firstWarningAt: 0,
    lastActivityAt: now,
  };
  record.lastActivityAt = now;

  record.messageTimestamps = record.messageTimestamps.filter((timestamp) => now - timestamp <= messageWindow);
  record.messageTimestamps.push(now);
  if (record.messageTimestamps.length < config.antiSpamMessageCount) {
    spamRecords.set(key, record);
    return;
  }
  record.messageTimestamps = [];
  const isRepeat = record.firstWarningAt > 0 && now - record.firstWarningAt <= repeatWindow;
  if (!isRepeat) {
    record.firstWarningAt = now;
    spamRecords.set(key, record);
    const authorLabel = config.antiSpamMentionUser
      ? `<@${message.author.id}>`
      : safeText(message.member?.displayName ?? message.author.username, 100);
    await message.channel.send({
      content: `${authorLabel} Aviso 1/2: ${safeText(config.antiSpamWarning, 220)} Uma nova ocorrência nos próximos ${config.antiSpamRepeatWindowMinutes} minuto(s) resultará em expulsão.`,
      allowedMentions: { users: config.antiSpamMentionUser ? [message.author.id] : [] },
    });
    return;
  }

  spamRecords.delete(key);
  const member = await message.guild.members.fetch(message.author.id);
  const authorLabel = config.antiSpamMentionUser
    ? `<@${member.id}>`
    : safeText(member.displayName, 100);
  if (member.id === message.guild.ownerId) {
    await message.channel.send({
      content: `${authorLabel} Segundo aviso de spam: não posso expulsar o dono do servidor.`,
      allowedMentions: { users: config.antiSpamMentionUser ? [member.id] : [] },
    });
    return;
  }

  try {
    await member.kick(`Anti-spam: reincidência dentro de ${config.antiSpamRepeatWindowMinutes} minuto(s).`);
    await message.channel.send({
      content: `${authorLabel} Segundo aviso: você foi expulso por repetir o spam.`,
      allowedMentions: { users: config.antiSpamMentionUser ? [member.id] : [] },
    });
  } catch (error) {
    console.error(`Não foi possível expulsar ${member.user.tag} por spam no servidor ${message.guild.name}:`, error);
    await message.channel.send({
      content: `${authorLabel} Segundo aviso de spam: não consegui expulsar você. Verifique as permissões e a hierarquia de cargos do bot.`,
      allowedMentions: { users: config.antiSpamMentionUser ? [member.id] : [] },
    });
  }
}

setInterval(() => {
  const now = Date.now();
  for (const [key, record] of spamRecords) {
    if (now - record.lastActivityAt > spamRepeatWindow) spamRecords.delete(key);
  }
}, 60_000).unref();

async function replyPrivate(interaction, content) {
  if (interaction.deferred || interaction.replied) {
    return interaction.editReply({ content, allowedMentions: { parse: [] } });
  }
  return interaction.reply({ content, flags: MessageFlags.Ephemeral, allowedMentions: { parse: [] } });
}

async function deferPrivateReply(interaction) {
  if (interaction.deferred || interaction.replied) return;
  await interaction.deferReply({ flags: MessageFlags.Ephemeral });
}

async function requireOwner(interaction) {
  if (interaction.user.id === ownerId) return true;
  await replyPrivate(interaction, `Somente o dono do bot (${ownerDisplayName}) pode usar este comando.`);
  return false;
}

async function requireBotAdmin(interaction) {
  const config = interaction.guildId ? await getBotConfig(interaction.guildId) : botConfigDefaults;
  if (interaction.user.id === ownerId
      || (config.serverAdminAccess && interaction.memberPermissions?.has(PermissionFlagsBits.Administrator))
      || (await getAuthorizedUserIds()).includes(interaction.user.id)) return true;
  await replyPrivate(interaction, config.serverAdminAccess
    ? 'Você precisa ser o dono do bot, ter Administrador no servidor ou estar autorizado pelo dono.'
    : 'Você precisa ser o dono do bot ou estar autorizado pelo dono.');
  return false;
}

async function requireGuild(interaction) {
  if (interaction.inGuild() && interaction.guild) return true;
  await replyPrivate(interaction, 'Este comando só pode ser usado dentro de um servidor.');
  return false;
}

async function requireGuildPermission(interaction, permission, label) {
  if (interaction.user.id === ownerId || interaction.memberPermissions?.has(permission)) return true;
  await replyPrivate(interaction, `Você precisa da permissão “${label}” neste servidor.`);
  return false;
}

function displayBotConfigValue(value) {
  if (typeof value === 'boolean') return value ? 'sim' : 'não';
  if (value === '') return '(vazio)';
  return String(value);
}

const botConfigGroupPresentation = {
  general: { emoji: '🎨', description: 'Identidade visual, permissões e intervalos' },
  antispam: { emoji: '🛡️', description: 'Detecção, limites e ações contra spam' },
  'antispam-alerts': { emoji: '🔔', description: 'Menções e avisos enviados no chat' },
  antiraid: { emoji: '🚨', description: 'Proteção contra bots não autorizados' },
  'antiraid-logs': { emoji: '📜', description: 'Registro de eventos de segurança' },
  tickets: { emoji: '🎟️', description: 'Canais, transcripts e ranking de tickets' },
  'tickets-limits': { emoji: '📏', description: 'Quantidade de tickets por usuário' },
  tellonym: { emoji: '💌', description: 'Painel, recebimento e limites de mensagens' },
  'tellonym-modes': { emoji: '🕶️', description: 'Modos anônimo e público' },
  instagram: { emoji: '📸', description: 'Canal, fotos e comportamento das publicações' },
  'instagram-media': { emoji: '🖼️', description: 'GIFs, legendas e tamanho das publicações' },
  'staff-applications': { emoji: '👥', description: 'Candidaturas para a equipe' },
  moderation: { emoji: '⚖️', description: 'Comandos e registros de moderação' },
  limits: { emoji: '⚡', description: 'Intervalos e limites de proteção' },
};

function configStatusLabel(enabled) {
  return enabled ? '🟢 Ativado' : '⚫ Desativado';
}

async function showBotConfigPanel(interaction) {
  if (!(await requireGuild(interaction))) return;
  if (!(await requireOwner(interaction))) {
    return;
  }
  const config = await getBotConfig(interaction.guildId);
  const categories = botConfigGroups.map((group) => {
    const presentation = botConfigGroupPresentation[group.id];
    return `${presentation.emoji} **${group.label}** · ${group.fields.length} opção(ões)`;
  });
  const embed = new EmbedBuilder()
    .setColor(0xE50914)
    .setAuthor({
      name: 'CENTRAL DE CONTROLE • ALTA BOT',
      iconURL: client.user.displayAvatarURL(),
    })
    .setTitle(`⚙️ Painel de configurações`)
    .setDescription([
      `Gerencie os módulos de **${safeText(interaction.guild.name, 180)}** em um só lugar.`,
      '',
      `**${botConfigFields.length} opções**  ·  **${botConfigGroups.length} categorias**`,
      'Escolha uma categoria no menu para abrir seus ajustes.',
    ].join('\n'))
    .addFields(
      {
        name: '🛡️ Segurança',
        value: [
          `Anti-spam　${configStatusLabel(config.antiSpamEnabled)}`,
          `Anti-raid　${configStatusLabel(config.antiRaidEnabled)}`,
          `Moderação　${configStatusLabel(config.moderationAuditEnabled)}`,
        ].join('\n'),
        inline: true,
      },
      {
        name: '🎟️ Comunidade',
        value: [
          `Tickets　${configStatusLabel(config.ticketsEnabled)}`,
          `Tellonym　${configStatusLabel(config.tellonymEnabled)}`,
          `Instagram　${configStatusLabel(config.instagramEnabled)}`,
        ].join('\n'),
        inline: true,
      },
      {
        name: '👥 Equipe',
        value: `Candidaturas　${configStatusLabel(config.staffApplicationsEnabled)}`,
        inline: true,
      },
      {
        name: '📚 Categorias disponíveis',
        value: categories.join('\n'),
        inline: false,
      },
    )
    .setThumbnail(client.user.displayAvatarURL())
    .setFooter({
      text: `${config.panelTitlePrefix}  •  Em branco mantém o valor atual  •  “padrão” restaura`,
    })
    .setTimestamp();
  const menu = new StringSelectMenuBuilder()
    .setCustomId(`${botConfigPrefix}:category`)
    .setPlaceholder('⚙️  Escolha uma categoria para configurar')
    .setMinValues(1)
    .setMaxValues(1)
    .addOptions(botConfigGroups.map((group) => {
      const presentation = botConfigGroupPresentation[group.id];
      return new StringSelectMenuOptionBuilder()
        .setLabel(group.label)
        .setValue(group.id)
        .setDescription(presentation.description)
        .setEmoji(presentation.emoji);
    }));
  const response = {
    embeds: [embed],
    components: [new ActionRowBuilder().addComponents(menu)],
    allowedMentions: { parse: [] },
  };
  if (interaction.deferred || interaction.replied) {
    await interaction.editReply(response);
  } else {
    await interaction.reply({ ...response, flags: MessageFlags.Ephemeral });
  }
}

async function showBotConfigModal(interaction, selectedGroupId = interaction.values[0]) {
  if (!interaction.inGuild() || !interaction.guild || interaction.user.id !== ownerId) {
    await replyPrivate(interaction, 'Somente o dono configurado do ALTA BOT pode usar o painel de configuração.');
    return;
  }
  const group = botConfigGroups.find((candidate) => candidate.id === selectedGroupId);
  if (!group) {
    await interaction.reply({ content: 'Essa categoria de configuração não existe.', flags: MessageFlags.Ephemeral });
    return;
  }
  const modal = new ModalBuilder()
    .setCustomId(`${botConfigPrefix}:save:${group.id}`)
    .setTitle(group.label.slice(0, 45))
    .addComponents(group.fields.map((field) => {
      return new ActionRowBuilder().addComponents(
        new TextInputBuilder()
          .setCustomId(field.key)
          .setLabel(field.label.slice(0, 45))
          .setPlaceholder('Digite o novo valor; vazio mantém o atual')
          .setStyle(TextInputStyle.Short)
          .setMaxLength(field.maxLength ?? 10)
          .setRequired(false),
      );
    }));
  await interaction.showModal(modal);
}

async function saveBotConfigModal(interaction) {
  if (!interaction.inGuild() || !interaction.guild || interaction.user.id !== ownerId) {
    await replyPrivate(interaction, 'Somente o dono configurado do ALTA BOT pode salvar configurações.');
    return;
  }
  const [, action, groupId] = interaction.customId.split(':');
  const group = botConfigGroups.find((candidate) => candidate.id === groupId);
  if (action !== 'save' || !group) {
    await replyPrivate(interaction, 'Este formulário de configuração não é válido.');
    return;
  }

  const updates = {};
  try {
    for (const field of group.fields) {
      const input = interaction.fields.getTextInputValue(field.key).trim();
      if (!input) continue;
      updates[field.key] = /^padrão$/i.test(input)
        ? botConfigDefaults[field.key]
        : parseBotConfigValue(field, input);
    }
  } catch (error) {
    await replyPrivate(interaction, error.message);
    return;
  }

  if (Object.keys(updates).length === 0) {
    await replyPrivate(interaction, 'Nenhuma alteração feita; deixe um campo vazio para manter o valor atual.');
    return;
  }
  await deferPrivateReply(interaction);
  await setBotConfig(interaction.guildId, updates);
  let panelUpdateWarning = '';
  if (Object.hasOwn(updates, 'staffApplicationsEnabled')) {
    try {
      const count = await updateStaffPanelAvailability(interaction.guild, updates.staffApplicationsEnabled);
      if (count === 0) panelUpdateWarning = '\nA opção foi salva, mas ainda não existe painel publicado para atualizar.';
    } catch (error) {
      console.error(`Não foi possível atualizar o painel de candidaturas no servidor ${interaction.guildId}:`, error);
      panelUpdateWarning = '\nA opção foi salva, mas não consegui atualizar a mensagem do painel; confira as permissões do bot no canal.';
    }
  }
  const changedLabels = group.fields
    .filter((field) => Object.hasOwn(updates, field.key))
    .map((field) => `• **${field.label}**: ${displayBotConfigValue(updates[field.key])}`)
    .join('\n');
  await replyPrivate(interaction, `Configurações salvas em **${group.label}**:\n${changedLabels}${panelUpdateWarning}`);
}

async function getTargetMember(interaction, user) {
  const target = await interaction.guild.members.fetch(user.id).catch(() => null);
  if (!target) {
    await replyPrivate(interaction, 'O usuário precisa ser membro deste servidor.');
    return null;
  }

  const botMember = await interaction.guild.members.fetchMe();
  if (target.id === interaction.guild.ownerId
      || target.roles.highest.comparePositionTo(botMember.roles.highest) >= 0) {
    await replyPrivate(interaction, 'Não é possível moderar o dono do servidor nem alguém com cargo igual ou acima do bot.');
    return null;
  }

  const actor = await interaction.guild.members.fetch(interaction.user.id).catch(() => null);
  if (!actor) {
    await replyPrivate(interaction, 'Não foi possível confirmar sua participação no servidor.');
    return null;
  }
  if (interaction.user.id !== ownerId
      && actor.id !== interaction.guild.ownerId
      && !interaction.memberPermissions?.has(PermissionFlagsBits.Administrator)
      && actor.roles.highest.comparePositionTo(target.roles.highest) <= 0) {
    await replyPrivate(interaction, 'Seu cargo precisa estar acima do membro que será moderado.');
    return null;
  }
  return target;
}

async function writeAudit(interaction, title, details) {
  const config = await getBotConfig(interaction.guildId);
  if (!config.moderationAuditEnabled) return null;
  const configuredChannel = config.moderationLogChannel
    ? await findTextChannelByName(interaction.guild, config.moderationLogChannel)
    : null;
  if (config.moderationLogChannel && !configuredChannel) {
    return `Não encontrei o canal de auditoria configurado **${config.moderationLogChannel}**.`;
  }
  const channelId = configuredChannel?.id ?? await getLogChannelId(interaction.guildId);
  if (!channelId) return 'Nenhum canal de auditoria foi configurado; use /set-log ou defina um canal na configuração do bot.';

  const channel = await interaction.guild.channels.fetch(channelId);
  const botMember = await interaction.guild.members.fetchMe();
  if (!channel?.isTextBased() || !channel.permissionsFor(botMember)?.has(PermissionFlagsBits.SendMessages)) {
    return 'O canal de auditoria está indisponível ou o bot não pode escrever nele.';
  }

  const embed = new EmbedBuilder()
    .setColor(configColor(config))
    .setTitle(safeText(title, 200))
    .setDescription(safeText(details, 3500))
    .addFields(
      { name: 'Responsável', value: `${interaction.user.tag} (${interaction.user.id})`, inline: true },
      { name: 'Servidor', value: safeText(interaction.guild.name, 200), inline: true },
    )
    .setFooter({ text: configFooter(config) })
    .setTimestamp();
  await channel.send({ embeds: [embed], allowedMentions: { parse: [] } });
  return null;
}

async function replyWithAudit(interaction, successMessage, title, details) {
  let auditWarning = '';
  try {
    const result = await writeAudit(interaction, title, details);
    if (result) auditWarning = `\nAviso: ${result}`;
  } catch (error) {
    console.error('Auditoria de moderação falhou:', error);
    auditWarning = '\nAviso: ação concluída, mas o registro de auditoria falhou.';
  }
  await replyPrivate(interaction, successMessage + auditWarning);
}

function assetName(value) {
  const cleaned = value.normalize('NFKD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-zA-Z0-9_-]+/g, '_')
    .replace(/^_+|_+$/g, '')
    .slice(0, 60);
  return cleaned || 'asset';
}

function stickerExtension(sticker) {
  switch (sticker.format) {
    case StickerFormatType.APNG: return 'png';
    case StickerFormatType.Lottie: return 'json';
    case StickerFormatType.GIF: return 'gif';
    default: return 'png';
  }
}

function stickerExtensionFromUrl(value) {
  const parsed = new URL(value);
  const extension = path.extname(parsed.pathname).toLowerCase();
  if (!['.png', '.apng', '.gif', '.json'].includes(extension)) {
    throw new Error('A URL precisa apontar diretamente para um arquivo PNG, APNG, GIF ou JSON de figurinha.');
  }
  return extension.slice(1);
}

async function fetchDiscordAsset(url, filename, maxBytes = maxAssetBytes) {
  const parsed = new URL(url);
  if (parsed.protocol !== 'https:' || !['cdn.discordapp.com', 'media.discordapp.net'].includes(parsed.hostname)) {
    throw new Error(`URL de asset não permitida: ${parsed.hostname}`);
  }

  const response = await fetch(parsed, {
    redirect: 'manual',
    signal: AbortSignal.timeout(15_000),
  });
  if (response.status >= 300 && response.status < 400) {
    throw new Error(`CDN redirecionou a URL do asset: ${filename}.`);
  }
  const finalUrl = new URL(response.url);
  if (finalUrl.protocol !== 'https:' || !['cdn.discordapp.com', 'media.discordapp.net'].includes(finalUrl.hostname)) {
    throw new Error(`Redirecionamento para domínio não permitido: ${finalUrl.hostname}`);
  }
  if (!response.ok) throw new Error(`CDN retornou HTTP ${response.status} para ${filename}.`);
  const declaredLength = Number(response.headers.get('content-length') ?? 0);
  if (declaredLength > maxBytes) throw new Error(`Asset excede o limite permitido por arquivo: ${filename}.`);

  const reader = response.body?.getReader();
  if (!reader) throw new Error(`Resposta sem conteúdo para ${filename}.`);
  const chunks = [];
  let size = 0;
  try {
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      size += value.byteLength;
      if (size > maxBytes) {
        await reader.cancel();
        throw new Error(`Asset excede o limite permitido por arquivo: ${filename}.`);
      }
      chunks.push(Buffer.from(value));
    }
  } finally {
    reader.releaseLock();
  }
  return Buffer.concat(chunks, size);
}

async function createGuildAssetsZip(guild, limits = {
  maxFileBytes: maxAssetBytes,
  maxTotalBytes: maxSourceBytes,
}) {
  const directory = await mkdtemp(path.join(os.tmpdir(), 'siria-te-ama-'));
  const zipPath = path.join(directory, `${assetName(guild.name)}-${guild.id}.zip`);
  try {
    const emojis = await guild.emojis.fetch();
    const stickers = await guild.stickers.fetch();
    const archive = archiver('zip', { zlib: { level: 6 } });
    const output = createWriteStream(zipPath);
    const archiveDone = new Promise((resolve, reject) => {
      output.once('close', resolve);
      output.once('error', reject);
      archive.once('error', reject);
    });
    archive.pipe(output);

    const manifest = [];
    const skipped = [];
    let sourceBytes = 0;
    const assets = [
      ...emojis.map((emoji) => ({
        kind: 'emoji',
        id: emoji.id,
        name: emoji.name ?? `emoji_${emoji.id}`,
        url: emoji.imageURL({ extension: emoji.animated ? 'gif' : 'png', size: 1024 }),
        extension: emoji.animated ? 'gif' : 'png',
      })),
      ...stickers.map((sticker) => ({
        kind: 'sticker',
        id: sticker.id,
        name: sticker.name,
        url: sticker.url,
        extension: stickerExtension(sticker),
      })),
    ];

    for (const asset of assets) {
      const file = `${asset.kind}s/${assetName(asset.name)}-${asset.id}.${asset.extension}`;
      try {
        const buffer = await fetchDiscordAsset(asset.url, file, limits.maxFileBytes);
        if (sourceBytes + buffer.length > limits.maxTotalBytes) {
          skipped.push({ file, reason: `limite total de ${Math.floor(limits.maxTotalBytes / (1024 * 1024))} MiB atingido` });
          continue;
        }
        sourceBytes += buffer.length;
        archive.append(buffer, { name: file });
        manifest.push({ kind: asset.kind, id: asset.id, name: asset.name, file });
      } catch (error) {
        skipped.push({ file, reason: error.message });
        console.warn(`Asset ignorado (${file}): ${error.message}`);
      }
    }

    archive.append(`${JSON.stringify({ guild: guild.name, guildId: guild.id, included: manifest, skipped }, null, 2)}\n`, {
      name: 'manifest.json',
    });
    await archive.finalize();
    await archiveDone;
    return { directory, path: zipPath, included: manifest.length, skipped: skipped.length };
  } catch (error) {
    await rm(directory, { recursive: true, force: true });
    throw error;
  }
}

async function handleModeration(interaction, command) {
  const neededPermission = command === 'ban' ? PermissionFlagsBits.BanMembers
    : command === 'kick' ? PermissionFlagsBits.KickMembers
      : PermissionFlagsBits.ModerateMembers;
  const permissionName = command === 'ban' ? 'Ban Members'
    : command === 'kick' ? 'Kick Members' : 'Moderate Members';
  const config = await getBotConfig(interaction.guildId);
  const commandEnabled = command === 'ban' ? config.moderationBanEnabled
    : command === 'kick' ? config.moderationKickEnabled
      : config.moderationTimeoutEnabled;
  if (!commandEnabled) {
    await replyPrivate(interaction, `O comando /${command} está desativado nas configurações deste servidor.`);
    return;
  }
  if (!(await requireGuildPermission(interaction, neededPermission, permissionName))) return;

  await deferPrivateReply(interaction);
  const user = interaction.options.getUser('usuario', true);
  const target = await getTargetMember(interaction, user);
  if (!target) return;

  const reason = safeText(interaction.options.getString('motivo', true));
  if (command === 'ban') {
    await target.ban({ reason });
    await replyWithAudit(interaction, `Membro banido: ${user.tag}.`, 'Banimento', `Usuário: ${user.tag} (${user.id})\nMotivo: ${reason}`);
  } else if (command === 'kick') {
    await target.kick(reason);
    await replyWithAudit(interaction, `Membro expulso: ${user.tag}.`, 'Expulsão', `Usuário: ${user.tag} (${user.id})\nMotivo: ${reason}`);
  } else if (command === 'timeout') {
    const minutes = interaction.options.getInteger('minutos', true);
    await target.timeout(minutes * 60_000, reason);
    await replyWithAudit(interaction, `Timeout de ${minutes} minuto(s) aplicado a ${user.tag}.`, 'Timeout aplicado', `Usuário: ${user.tag} (${user.id})\nDuração: ${minutes} minuto(s)\nMotivo: ${reason}`);
  } else {
    await target.timeout(null, reason);
    await replyWithAudit(interaction, `Timeout removido de ${user.tag}.`, 'Timeout removido', `Usuário: ${user.tag} (${user.id})\nMotivo: ${reason}`);
  }
}

function ticketSlug(value) {
  return value.normalize('NFKD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9-]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 40) || 'membro';
}

async function handleTicketPanelCommand(interaction) {
  if (!(await requireGuildPermission(interaction, PermissionFlagsBits.ManageGuild, 'Manage Server'))) return;
  const config = await getBotConfig(interaction.guildId);
  if (!config.ticketsEnabled) {
    await replyPrivate(interaction, 'O sistema de tickets está desativado nas configurações deste servidor.');
    return;
  }
  await deferPrivateReply(interaction);

  const guild = interaction.guild;
  const channels = await guild.channels.fetch();
  const panelChannel = channels.find((channel) => (
    channel?.type === ChannelType.GuildText && channel.name === config.ticketPanelChannel
  ));
  if (!panelChannel) {
    await replyPrivate(interaction, `Não encontrei o canal de texto **${config.ticketPanelChannel}** neste servidor. Confira se o nome está exatamente igual.`);
    return;
  }

  const botMember = await guild.members.fetchMe();
  const requiredPermissions = [
    PermissionFlagsBits.ViewChannel,
    PermissionFlagsBits.ReadMessageHistory,
    PermissionFlagsBits.SendMessages,
    PermissionFlagsBits.EmbedLinks,
  ];
  if (!panelChannel.permissionsFor(botMember)?.has(requiredPermissions)) {
    await replyPrivate(interaction, `Preciso de Ver canal, Ler histórico, Enviar mensagens e Incorporar links em <#${panelChannel.id}>.`);
    return;
  }

  const title = interaction.options.getString('titulo')?.trim() || ':alta_tmp_2season_1: SUPORTE';
  const description = safeText(
    interaction.options.getString('texto')?.trim()
      || ticketPanelDefaultText,
    4000,
  );
  const supportRole = interaction.options.getRole('suporte');
  if (supportRole && supportRole.guild.id !== guild.id) {
    await replyPrivate(interaction, 'O cargo de suporte precisa pertencer a este servidor.');
    return;
  }

  const categoryOptions = [
    { key: 'parceria', option: 'categoria-parceria', emojiOption: 'emoji-parceria', label: 'PARCERIA', emoji: '🤝', description: 'Propostas e assuntos de parceria.' },
    { key: 'denuncia', option: 'categoria-denuncia', emojiOption: 'emoji-denuncia', label: 'DENÚNCIA', emoji: '🚨', description: 'Denúncias e relatos para a equipe.' },
    { key: 'duvida', option: 'categoria-duvida', emojiOption: 'emoji-duvida', label: 'DÚVIDA', emoji: '❓', description: 'Dúvidas e pedidos de ajuda.' },
  ];
  const selectedCategories = Object.fromEntries(categoryOptions.map(({ key, option }) => [
    key,
    interaction.options.getChannel(option),
  ]));

  const panelDescription = await renderTicketPanelEmojis(guild, supportRole
    ? `${description}\n\nA equipe <@&${supportRole.id}> poderá atender você.`
    : description);
  const embed = new EmbedBuilder()
    .setColor(configColor(config))
    .setTitle(await renderTicketPanelEmojis(guild, safeText(title, 200)))
    .setDescription(panelDescription)
    .setImage('attachment://ticket-panel.png');
  const panelMessages = await panelChannel.messages.fetch({ limit: 100 });
  const existingPanel = panelMessages.find((message) => (
    message.author.id === client.user.id
    && message.components.some((row) => row.components.some((component) => (
      component.customId?.startsWith(`${ticketOpenButtonPrefix}:`)
      || component.customId?.startsWith(`${ticketCategoryMenuId}:`)
    )))
  ));

  const previousCategories = new Map();
  const previousMenu = existingPanel?.components
    .flatMap((row) => row.components)
    .find((component) => component.customId?.startsWith(`${ticketCategoryMenuId}:`));
  for (const option of previousMenu?.options ?? []) {
    const [categoryId, categoryKey] = option.value.split(':');
    if (categoryId && categoryKey) previousCategories.set(categoryKey, categoryId);
  }

  const categories = {};
  for (const { key } of categoryOptions) {
    const category = selectedCategories[key];
    const categoryId = category?.id ?? previousCategories.get(key);
    const resolvedCategory = category
      ?? (categoryId ? channels.get(categoryId) : null);
    if (!resolvedCategory || resolvedCategory.type !== ChannelType.GuildCategory
        || resolvedCategory.guildId !== guild.id) {
      await replyPrivate(interaction, `Selecione uma categoria do servidor para **${key.toUpperCase()}**. As três categorias são necessárias para publicar o painel.`);
      return;
    }
    categories[key] = resolvedCategory;
  }
  if (new Set(Object.values(categories).map((category) => category.id)).size !== categoryOptions.length) {
    await replyPrivate(interaction, 'Escolha uma categoria diferente para parceria, denúncia e dúvida.');
    return;
  }

  const emojis = {};
  for (const option of categoryOptions) {
    const emojiInput = interaction.options.getString(option.emojiOption)?.trim();
    if (!emojiInput) {
      emojis[option.key] = option.emoji;
      continue;
    }
    const parsedEmoji = parseEmoji(emojiInput);
    if (!parsedEmoji) {
      await replyPrivate(interaction, `Emoji inválido para **${option.label}**. Use um emoji Unicode ou um emoji deste servidor.`);
      return;
    }
    if (parsedEmoji.id) {
      const serverEmojis = await guild.emojis.fetch();
      const serverEmoji = serverEmojis.get(parsedEmoji.id);
      if (!serverEmoji || serverEmoji.name !== parsedEmoji.name) {
        await replyPrivate(interaction, `O emoji de **${option.label}** precisa pertencer a este servidor.`);
        return;
      }
    }
    emojis[option.key] = parsedEmoji;
  }

  const menu = new StringSelectMenuBuilder()
    .setCustomId(`${ticketCategoryMenuId}:${supportRole?.id ?? 'none'}`)
    .setPlaceholder('Escolha o tipo de atendimento')
    .setMinValues(1)
    .setMaxValues(1)
    .addOptions(categoryOptions.map(({ key, label, emoji, description: optionDescription }) => (
      new StringSelectMenuOptionBuilder()
        .setLabel(label)
        .setValue(`${categories[key].id}:${key}`)
        .setDescription(optionDescription)
        .setEmoji(emojis[key])
    )));
  const components = [new ActionRowBuilder().addComponents(menu)];
  const payload = {
    embeds: [embed],
    components,
    files: [{ attachment: ticketPanelImagePath, name: 'ticket-panel.png' }],
    allowedMentions: { parse: [] },
  };

  if (existingPanel) {
    await existingPanel.edit(payload);
    await replyPrivate(interaction, `Painel atualizado em <#${panelChannel.id}> com opções de parceria, denúncia e dúvida.`);
    return;
  }

  await panelChannel.send(payload);
  await replyPrivate(interaction, `Painel publicado em <#${panelChannel.id}> com opções de parceria, denúncia e dúvida.`);
}

function rankActionLabel(action) {
  return action === 'promotion' ? 'Upamento' : 'Rebaixamento';
}

function rankActionLogChannel(action) {
  return action === 'promotion' ? 'upamentos' : 'rebaixamentos';
}

function rankPanelEmbed(guild) {
  return new EmbedBuilder()
    .setColor(0xE50914)
    .setAuthor({
      name: 'ALTA BOT  /  CENTRAL DE GESTÃO',
      iconURL: client.user.displayAvatarURL(),
    })
    .setTitle('GESTÃO DE CARGOS')
    .setDescription([
      `## ⬆️  UPAMENTO   •   ⬇️  REBAIXAMENTO`,
      `Gerencie os cargos da equipe de **${safeText(guild.name, 150)}** com um fluxo simples, privado e auditável.`,
      '',
      'Escolha uma ação para começar. Você poderá revisar todos os dados antes de confirmar.',
    ].join('\n'))
    .addFields(
      {
        name: '┏  ⬆️  UPAMENTO',
        value: [
          'Promova um membro para um novo cargo.',
          '',
          '`01`　Selecione a pessoa',
          '`02`　Escolha o novo cargo',
          '`03`　Remova o cargo anterior, se desejar',
        ].join('\n'),
        inline: true,
      },
      {
        name: '┏  ⬇️  REBAIXAMENTO',
        value: [
          'Ajuste os cargos de um membro da equipe.',
          '',
          '`01`　Selecione a pessoa',
          '`02`　Selecione o cargo atual para remover',
          '`03`　Escolha um cargo inferior para adicionar',
        ].join('\n'),
        inline: true,
      },
      {
        name: '┏  🔐  SEGURANÇA & REGISTRO',
        value: [
          '• Acesso restrito a quem tem **Gerenciar cargos**.',
          '• A hierarquia do membro, do operador e do bot é validada.',
          '• A ação só é aplicada depois da confirmação.',
          '• Cada alteração gera um registro no canal correspondente.',
        ].join('\n'),
        inline: false,
      },
    )
    .setThumbnail(guild.iconURL({ size: 256 }) ?? client.user.displayAvatarURL())
    .setFooter({ text: 'ALTA BOT  •  OPERAÇÃO SEGURA  •  AUDITORIA AUTOMÁTICA' })
    .setTimestamp();
}

function rankPanelButtons() {
  return new ActionRowBuilder().addComponents(
    new ButtonBuilder()
      .setCustomId(`${rankManagementPrefix}:begin:promotion`)
      .setLabel('Novo upamento')
      .setEmoji('⬆️')
      .setStyle(ButtonStyle.Danger),
    new ButtonBuilder()
      .setCustomId(`${rankManagementPrefix}:begin:demotion`)
      .setLabel('Novo rebaixamento')
      .setEmoji('⬇️')
      .setStyle(ButtonStyle.Danger),
  );
}

async function handleRankPanelCommand(interaction) {
  if (!(await requireGuild(interaction))) return;
  if (!(await requireGuildPermission(interaction, PermissionFlagsBits.ManageGuild, 'Manage Server'))) return;
  await interaction.editReply({
    content: 'Painel privado de gestão de cargos. Só você consegue ver esta mensagem.',
    embeds: [rankPanelEmbed(interaction.guild)],
    components: [rankPanelButtons()],
    allowedMentions: { parse: [] },
  });
}

async function requireRankManager(interaction) {
  if (!interaction.inGuild() || !interaction.guild) {
    await replyPrivate(interaction, 'A gestão de cargos só pode ser usada dentro do servidor.');
    return null;
  }
  const member = await interaction.guild.members.fetch(interaction.user.id);
  if (!member.permissions.has(PermissionFlagsBits.ManageRoles)) {
    await replyPrivate(interaction, 'Você precisa da permissão **Gerenciar cargos** para usar este painel.');
    return null;
  }
  return member;
}

function rankUserSelect(action) {
  return new ActionRowBuilder().addComponents(
    new UserSelectMenuBuilder()
      .setCustomId(`${rankManagementPrefix}:member:${action}`)
      .setPlaceholder('Selecione o membro da equipe')
      .setMinValues(1)
      .setMaxValues(1),
  );
}

function rankStepEmbed(step, title, description) {
  return new EmbedBuilder()
    .setColor(0xE50914)
    .setAuthor({ name: 'ALTA BOT  /  CENTRAL DE GESTÃO' })
    .setTitle(`${step}  •  ${title}`)
    .setDescription(description)
    .setFooter({ text: 'PROCESSO PRIVADO  •  REVISE ANTES DE CONFIRMAR' });
}

function rankRoleSelect(action, targetId) {
  return new ActionRowBuilder().addComponents(
    new RoleSelectMenuBuilder()
      .setCustomId(`${rankManagementPrefix}:add:${action}:${targetId}`)
      .setPlaceholder('Selecione o cargo que será adicionado')
      .setMinValues(1)
      .setMaxValues(1),
  );
}

function rankDemotionCurrentRoleSelect(targetId) {
  return new ActionRowBuilder().addComponents(
    new RoleSelectMenuBuilder()
      .setCustomId(`${rankManagementPrefix}:demotion-remove:${targetId}`)
      .setPlaceholder('Selecione o cargo atual que será removido')
      .setMinValues(1)
      .setMaxValues(1),
  );
}

function rankDemotionDestinationRoleSelect(targetId, removeRoleId) {
  return new ActionRowBuilder().addComponents(
    new RoleSelectMenuBuilder()
      .setCustomId(`${rankManagementPrefix}:demotion-add:${targetId}:${removeRoleId}`)
      .setPlaceholder('Selecione um cargo inferior para adicionar')
      .setMinValues(1)
      .setMaxValues(1),
  );
}

function rankRemovalComponents(action, targetId, addRoleId) {
  return [
    new ActionRowBuilder().addComponents(
      new RoleSelectMenuBuilder()
        .setCustomId(`${rankManagementPrefix}:remove:${action}:${targetId}:${addRoleId}`)
        .setPlaceholder('Selecione o cargo atual para remover')
        .setMinValues(1)
        .setMaxValues(1),
    ),
    new ActionRowBuilder().addComponents(
      new ButtonBuilder()
        .setCustomId(`${rankManagementPrefix}:skip-remove:${action}:${targetId}:${addRoleId}`)
        .setLabel('Continuar sem remover cargo')
        .setStyle(ButtonStyle.Secondary),
    ),
  ];
}

function rankConfirmationComponents(action, targetId, addRoleId, removeRoleId) {
  return new ActionRowBuilder().addComponents(
    new ButtonBuilder()
      .setCustomId(`${rankManagementPrefix}:confirm:${action}:${targetId}:${addRoleId}:${removeRoleId ?? 'none'}`)
      .setLabel(`Confirmar ${rankActionLabel(action).toLowerCase()}`)
      .setStyle(ButtonStyle.Danger),
    new ButtonBuilder()
      .setCustomId(`${rankManagementPrefix}:cancel`)
      .setLabel('Cancelar')
      .setStyle(ButtonStyle.Secondary),
  );
}

async function showRankConfirmation(interaction, action, targetId, addRoleId, removeRoleId = null) {
  const [member, addRole, removeRole] = await Promise.all([
    interaction.guild.members.fetch(targetId),
    interaction.guild.roles.fetch(addRoleId),
    removeRoleId ? interaction.guild.roles.fetch(removeRoleId) : Promise.resolve(null),
  ]);
  if (!addRole || (removeRoleId && !removeRole)) {
    await replyPrivate(interaction, 'Um dos cargos selecionados não existe mais. Inicie novamente.');
    return;
  }
  const embed = new EmbedBuilder()
    .setColor(0xE50914)
    .setAuthor({ name: 'ALTA BOT  /  REVISÃO DA OPERAÇÃO' })
    .setTitle(`CONFIRMAR ${rankActionLabel(action).toUpperCase()}`)
    .setDescription([
      `👤 **Membro**\n<@${member.id}>`,
      '',
      action === 'demotion'
        ? `⬇️ **Cargo atual a remover**\n${removeRole ? `<@&${removeRole.id}>` : 'Não selecionado'}` +
          `\n\n⬆️ **Cargo inferior a adicionar**\n<@&${addRole.id}>`
        : `⬆️ **Cargo a adicionar**\n<@&${addRole.id}>` +
          `\n\n⬇️ **Cargo a remover**\n${removeRole ? `<@&${removeRole.id}>` : 'Nenhum cargo será removido'}`,
      '',
      'Confira os cargos. A operação só será concluída depois de confirmar abaixo.',
    ].join('\n'))
    .setFooter({ text: 'PRÉVIA PRIVADA  •  A HIERARQUIA SERÁ VALIDADA NOVAMENTE' });
  await interaction.editReply({
    content: '',
    embeds: [embed],
    components: [rankConfirmationComponents(action, targetId, addRoleId, removeRoleId)],
    allowedMentions: { parse: [] },
  });
}

async function handleRankButton(interaction) {
  const [, action, operation] = interaction.customId.split(':');
  if (action === 'cancel') {
    await interaction.update({ content: 'Operação cancelada. Nenhum cargo foi alterado.', embeds: [], components: [] });
    return;
  }
  if (action === 'begin' && !['promotion', 'demotion'].includes(operation)) {
    await replyPrivate(interaction, 'Esta ação de gestão não é válida.');
    return;
  }
  if (action === 'begin') {
    await interaction.deferReply({ flags: MessageFlags.Ephemeral });
    if (!(await requireRankManager(interaction))) return;
    const operationTitle = operation === 'promotion' ? 'UPAMENTO' : 'REBAIXAMENTO';
    await interaction.editReply({
      content: '',
      embeds: [rankStepEmbed(
        'ETAPA 01',
        `SELECIONE O MEMBRO  /  ${operationTitle}`,
        'Escolha a pessoa que receberá a alteração. Na próxima etapa, você selecionará o cargo.',
      )],
      components: [rankUserSelect(operation)],
      allowedMentions: { parse: [] },
    });
    return;
  }

  const [, step, rankAction, targetId, addRoleId, removeRoleId] = interaction.customId.split(':');
  if (step === 'skip-remove'
      && ['promotion', 'demotion'].includes(rankAction)
      && /^\d{17,20}$/.test(targetId ?? '')
      && /^\d{17,20}$/.test(addRoleId ?? '')) {
    await interaction.deferUpdate();
    if (!(await requireRankManager(interaction))) return;
    await showRankConfirmation(interaction, rankAction, targetId, addRoleId);
    return;
  }
  if (step === 'confirm') {
    await handleRankConfirmation(interaction);
    return;
  }
  await replyPrivate(interaction, 'Esta etapa da gestão de cargos não é válida.');
}

async function handleRankMemberSelect(interaction) {
  const [, step, action] = interaction.customId.split(':');
  await interaction.deferUpdate();
  if (step !== 'member' || !['promotion', 'demotion'].includes(action)) {
    await replyPrivate(interaction, 'Esta seleção de membro não é válida.');
    return;
  }
  if (!(await requireRankManager(interaction))) return;
  const targetId = interaction.values[0];
  if (!/^\d{17,20}$/.test(targetId ?? '')) {
    await replyPrivate(interaction, 'O membro selecionado não é válido.');
    return;
  }
  const member = await interaction.guild.members.fetch(targetId);
  if (action === 'demotion') {
    await interaction.editReply({
      content: '',
      embeds: [rankStepEmbed(
        'ETAPA 02',
        'SELECIONE O CARGO ATUAL',
        `Membro: <@${member.id}>\n\nEscolha o cargo que será removido antes de selecionar o cargo inferior.`,
      )],
      components: [rankDemotionCurrentRoleSelect(member.id)],
      allowedMentions: { parse: [] },
    });
    return;
  }
  await interaction.editReply({
    content: '',
    embeds: [rankStepEmbed(
      'ETAPA 02',
      'ESCOLHA O NOVO CARGO',
      `Membro selecionado: <@${member.id}>\n\nAgora escolha o cargo que será adicionado.`,
    )],
    components: [rankRoleSelect(action, member.id)],
    allowedMentions: { parse: [] },
  });
}

async function handleRankRoleSelect(interaction) {
  const parts = interaction.customId.split(':');
  const [, step, action, targetId, addRoleId] = parts;
  await interaction.deferUpdate();
  if (!(await requireRankManager(interaction))) return;
  if (step === 'demotion-remove' && /^\d{17,20}$/.test(action ?? '')) {
    const targetMember = await interaction.guild.members.fetch(action);
    const removeRoleId = interaction.values[0];
    if (!/^\d{17,20}$/.test(removeRoleId ?? '')) {
      await replyPrivate(interaction, 'O cargo atual selecionado não é válido.');
      return;
    }
    if (!targetMember.roles.cache.has(removeRoleId)) {
      await interaction.editReply({
        content: '',
        embeds: [rankStepEmbed(
          'ETAPA 02',
          'CARGO NÃO ENCONTRADO NO MEMBRO',
          `O membro <@${targetMember.id}> não possui esse cargo. Selecione um dos cargos atuais do membro.`,
        )],
        components: [rankDemotionCurrentRoleSelect(targetMember.id)],
        allowedMentions: { parse: [] },
      });
      return;
    }
    await interaction.editReply({
      content: '',
      embeds: [rankStepEmbed(
        'ETAPA 03',
        'ESCOLHA O CARGO INFERIOR',
        `Membro: <@${targetMember.id}>\nCargo atual a remover: <@&${removeRoleId}>\n\nAgora selecione o cargo inferior que será adicionado.`,
      )],
      components: [rankDemotionDestinationRoleSelect(targetMember.id, removeRoleId)],
      allowedMentions: { parse: [] },
    });
    return;
  }
  if (step === 'demotion-add'
      && /^\d{17,20}$/.test(action ?? '')
      && /^\d{17,20}$/.test(targetId ?? '')) {
    const actualTargetId = action;
    const actualRemoveRoleId = targetId;
    const addRoleId = interaction.values[0];
    if (!/^\d{17,20}$/.test(actualRemoveRoleId ?? '')
        || !/^\d{17,20}$/.test(addRoleId ?? '')) {
      await replyPrivate(interaction, 'Os cargos selecionados para o rebaixamento não são válidos.');
      return;
    }
    const [targetMember, currentRole, lowerRole] = await Promise.all([
      interaction.guild.members.fetch(actualTargetId),
      interaction.guild.roles.fetch(actualRemoveRoleId),
      interaction.guild.roles.fetch(addRoleId),
    ]);
    if (!currentRole || !lowerRole) {
      await replyPrivate(interaction, 'Um dos cargos selecionados não existe mais. Inicie novamente.');
      return;
    }
    if (!targetMember.roles.cache.has(currentRole.id)) {
      await replyPrivate(interaction, 'O membro não possui mais o cargo selecionado para remover. Inicie novamente.');
      return;
    }
    if (lowerRole.id === currentRole.id || lowerRole.comparePositionTo(currentRole) >= 0) {
      await interaction.editReply({
        content: '',
        embeds: [rankStepEmbed(
          'ETAPA 03',
          'ESCOLHA UM CARGO INFERIOR',
          `O cargo selecionado precisa estar abaixo de <@&${currentRole.id}> na hierarquia. Escolha outro cargo.`,
        )],
        components: [rankDemotionDestinationRoleSelect(actualTargetId, currentRole.id)],
        allowedMentions: { parse: [] },
      });
      return;
    }
    await showRankConfirmation(interaction, 'demotion', actualTargetId, lowerRole.id, currentRole.id);
    return;
  }
  if (step === 'add'
      && ['promotion', 'demotion'].includes(action)
      && /^\d{17,20}$/.test(targetId ?? '')) {
    if (action !== 'promotion') {
      await replyPrivate(interaction, 'No rebaixamento, selecione primeiro o cargo atual que será removido.');
      return;
    }
    const selectedRoleId = interaction.values[0];
    if (!/^\d{17,20}$/.test(selectedRoleId ?? '')) {
      await replyPrivate(interaction, 'O cargo selecionado não é válido.');
      return;
    }
    await interaction.editReply({
      content: '',
      embeds: [rankStepEmbed(
        'ETAPA 03',
        'ESCOLHA O CARGO ATUAL',
        `Membro: <@${targetId}>\nNovo cargo: <@&${selectedRoleId}>\n\nEscolha o cargo atual que deseja remover ou avance sem remover nenhum.`,
      )],
      components: rankRemovalComponents(action, targetId, selectedRoleId),
      allowedMentions: { parse: [] },
    });
    return;
  }
  if (step === 'remove'
      && ['promotion', 'demotion'].includes(action)
      && /^\d{17,20}$/.test(targetId ?? '')
      && /^\d{17,20}$/.test(addRoleId ?? '')) {
    const removeRoleId = interaction.values[0];
    if (!/^\d{17,20}$/.test(removeRoleId ?? '')) {
      await replyPrivate(interaction, 'O cargo selecionado para remoção não é válido.');
      return;
    }
    if (removeRoleId === addRoleId) {
      await replyPrivate(interaction, 'Escolha cargos diferentes para adicionar e remover.');
      return;
    }
    await showRankConfirmation(interaction, action, targetId, addRoleId, removeRoleId);
    return;
  }
  await replyPrivate(interaction, 'Esta seleção de cargo não é válida.');
}

async function handleRankConfirmation(interaction) {
  const [, step, action, targetId, addRoleId, removeRoleIdValue] = interaction.customId.split(':');
  if (step !== 'confirm'
      || !['promotion', 'demotion'].includes(action)
      || !/^\d{17,20}$/.test(targetId ?? '')
      || !/^\d{17,20}$/.test(addRoleId ?? '')
      || (removeRoleIdValue !== 'none' && !/^\d{17,20}$/.test(removeRoleIdValue ?? ''))) {
    await replyPrivate(interaction, 'Esta confirmação de cargo não é válida.');
    return;
  }
  const removeRoleId = removeRoleIdValue === 'none' ? null : removeRoleIdValue;
  await interaction.deferUpdate();
  if (rankManagementLocks.has(targetId)) {
    await interaction.editReply({ content: 'Já existe uma alteração de cargo em andamento para este membro.', embeds: [], components: [] });
    return;
  }
  rankManagementLocks.add(targetId);
  let rolesUpdated = false;
  try {
    const actor = await requireRankManager(interaction);
    if (!actor) return;
    const guild = interaction.guild;
    const [target, addRole, removeRole, botMember] = await Promise.all([
      guild.members.fetch(targetId),
      guild.roles.fetch(addRoleId),
      removeRoleId ? guild.roles.fetch(removeRoleId) : Promise.resolve(null),
      guild.members.fetchMe(),
    ]);
    if (!addRole || (removeRoleId && !removeRole)) {
      throw new Error('Um dos cargos selecionados não existe mais.');
    }
    if (action === 'demotion' && removeRole && addRole.comparePositionTo(removeRole) >= 0) {
      throw new Error('No rebaixamento, o cargo adicionado precisa estar abaixo do cargo removido.');
    }
    if (target.id === guild.ownerId || target.id === client.user.id || target.id === actor.id) {
      throw new Error('Não é permitido aplicar esta alteração ao dono, ao bot ou a você mesmo.');
    }
    if (!botMember.permissions.has(PermissionFlagsBits.ManageRoles)) {
      throw new Error('O bot precisa da permissão Gerenciar cargos.');
    }
    if (actor.id !== guild.ownerId && target.roles.highest.comparePositionTo(actor.roles.highest) >= 0) {
      throw new Error('A hierarquia do Discord impede que você altere os cargos deste membro.');
    }
    for (const role of [addRole, removeRole].filter(Boolean)) {
      if (role.id === guild.id || role.managed) {
        throw new Error(`O cargo ${safeText(role.name, 80)} é gerenciado pelo Discord e não pode ser alterado.`);
      }
      if (actor.id !== guild.ownerId && actor.roles.highest.comparePositionTo(role) <= 0) {
        throw new Error(`O cargo ${safeText(role.name, 80)} está acima ou no mesmo nível do seu cargo mais alto.`);
      }
      if (botMember.roles.highest.comparePositionTo(role) <= 0) {
        throw new Error(`O cargo ${safeText(role.name, 80)} está acima ou no mesmo nível do cargo mais alto do bot.`);
      }
    }
    if (target.roles.cache.has(addRole.id)) {
      throw new Error('Este membro já possui o cargo selecionado para adicionar.');
    }
    if (removeRole && !target.roles.cache.has(removeRole.id)) {
      throw new Error('Este membro não possui o cargo selecionado para remover.');
    }

    const logChannel = await findStaffChannelBySlug(guild, rankActionLogChannel(action));
    if (!logChannel) {
      throw new Error(`Não encontrei o canal terminado em ┊${rankActionLogChannel(action)}.`);
    }
    const logPermissions = [
      PermissionFlagsBits.ViewChannel,
      PermissionFlagsBits.SendMessages,
      PermissionFlagsBits.EmbedLinks,
    ];
    if (!logChannel.permissionsFor(botMember)?.has(logPermissions)) {
      throw new Error(`O bot precisa de Ver canal, Enviar mensagens e Incorporar links em #${logChannel.name}.`);
    }

    const reason = `${rankActionLabel(action)} por ${interaction.user.tag} (${interaction.user.id}).`;
    await target.roles.add(addRole, reason);
    rolesUpdated = true;
    if (removeRole) {
      try {
        await target.roles.remove(removeRole, reason);
      } catch (error) {
        try {
          await target.roles.remove(addRole, `Reversão após falha ao remover ${removeRole.name}.`);
          rolesUpdated = false;
        } catch (rollbackError) {
          console.error(`Falha ao reverter o cargo ${addRole.id} de ${target.id} após erro ao remover ${removeRole.id}:`, rollbackError);
          throw new Error(`Não consegui remover o cargo antigo nem reverter o novo. Confira os cargos de <@${target.id}> manualmente. Erro: ${error.message}`);
        }
        throw new Error(`Não foi possível remover o cargo antigo; o cargo novo foi revertido. ${error.message}`);
      }
    }

    const embed = new EmbedBuilder()
      .setColor(0xE50914)
      .setAuthor({ name: 'ALTA BOT  /  GESTÃO DA EQUIPE' })
      .setTitle(action === 'promotion' ? '⬆️ UPAMENTO REGISTRADO' : '⬇️ REBAIXAMENTO REGISTRADO')
      .setDescription([
        `👤 **Membro**\n<@${target.id}>`,
        '',
        `⬆️ **Cargo adicionado**\n<@&${addRole.id}>`,
        '',
        `⬇️ **Cargo removido**\n${removeRole ? `<@&${removeRole.id}>` : 'Nenhum'}`,
        '',
        `🛡️ **Responsável**\n<@${actor.id}>`,
      ].join('\n'))
      .setFooter({ text: `${safeText(guild.name, 150)}  •  REGISTRO OFICIAL` })
      .setTimestamp();
    try {
      await logChannel.send({ embeds: [embed], allowedMentions: { parse: [] } });
    } catch (error) {
      console.error(`Os cargos foram alterados, mas o registro falhou em #${logChannel.name}:`, error);
      await interaction.editReply({
        content: `Os cargos foram alterados, mas não consegui publicar o registro em <#${logChannel.id}>. Avise a administração para conferir o canal.`,
        embeds: [],
        components: [],
      });
      return;
    }
    await interaction.editReply({
      content: `✅ ${rankActionLabel(action)} aplicado a <@${target.id}> e registrado em <#${logChannel.id}>.`,
      embeds: [],
      components: [],
      allowedMentions: { parse: [] },
    });
  } catch (error) {
    if (rolesUpdated) {
      console.error(`A alteração de cargos de ${targetId} foi aplicada, mas não concluída integralmente:`, error);
      await interaction.editReply({
        content: `Os cargos foram alterados, mas ocorreu um erro ao concluir o registro: ${safeText(error.message, 300)}`,
        embeds: [],
        components: [],
      });
      return;
    }
    await interaction.editReply({
      content: `Não foi possível aplicar a alteração: ${safeText(error.message, 350)}`,
      embeds: [],
      components: [],
      allowedMentions: { parse: [] },
    });
  } finally {
    rankManagementLocks.delete(targetId);
  }
}

async function createTicket(interaction, { supportRoleId, categoryId = null, ticketType = 'atendimento' }) {
  if (!interaction.inGuild() || !interaction.guild) {
    await interaction.reply({ content: 'Tickets só podem ser abertos dentro de um servidor.', flags: MessageFlags.Ephemeral });
    return;
  }
  const guild = interaction.guild;
  const config = await getBotConfig(guild.id);
  if (!config.ticketsEnabled) {
    await replyPrivate(interaction, 'O sistema de tickets está desativado neste servidor.');
    return;
  }
  const category = categoryId ? await guild.channels.fetch(categoryId) : null;
  if (categoryId && (!category || category.type !== ChannelType.GuildCategory
      || category.guildId !== guild.id)) {
    await replyPrivate(interaction, 'A categoria deste tipo de ticket não existe mais. Avise a equipe para atualizar o painel.');
    return;
  }

  const guildChannels = await guild.channels.fetch();
  const existingTickets = guildChannels.filter((channel) => (
    channel.type === ChannelType.GuildText
    && channel.topic?.startsWith(`ALTA_TICKET:OPEN:${interaction.user.id}:`)
  ));
  if (existingTickets.size >= config.ticketMaxOpenPerUser) {
    const ticketMentions = [...existingTickets.values()].slice(0, 5).map((channel) => `<#${channel.id}>`).join(', ');
    await replyPrivate(interaction, `Você já atingiu o limite de ${config.ticketMaxOpenPerUser} ticket(s) aberto(s): ${ticketMentions}.`);
    return;
  }

  const botMember = await guild.members.fetchMe();
  if (!botMember.permissions.has(PermissionFlagsBits.ManageChannels)) {
    await replyPrivate(interaction, 'Não consigo criar o canal privado. O bot precisa da permissão Gerenciar canais.');
    return;
  }

  const validSupportRoleId = supportRoleId !== 'none' && guild.roles.cache.has(supportRoleId)
    ? supportRoleId
    : null;
  const permissionOverwrites = [
    { id: guild.id, deny: [PermissionFlagsBits.ViewChannel] },
    {
      id: interaction.user.id,
      allow: [
        PermissionFlagsBits.ViewChannel,
        PermissionFlagsBits.SendMessages,
        PermissionFlagsBits.ReadMessageHistory,
        PermissionFlagsBits.AttachFiles,
        PermissionFlagsBits.EmbedLinks,
      ],
    },
    {
      id: botMember.id,
      allow: [
        PermissionFlagsBits.ViewChannel,
        PermissionFlagsBits.SendMessages,
        PermissionFlagsBits.ReadMessageHistory,
        PermissionFlagsBits.ManageChannels,
      ],
    },
  ];
  if (validSupportRoleId) {
    permissionOverwrites.push({
      id: validSupportRoleId,
      allow: [
        PermissionFlagsBits.ViewChannel,
        PermissionFlagsBits.SendMessages,
        PermissionFlagsBits.ReadMessageHistory,
      ],
    });
  }

  const topic = `ALTA_TICKET:OPEN:${interaction.user.id}:${validSupportRoleId ?? 'none'}:${ticketType}:${category?.id ?? 'none'}:none`;
  const channel = await guild.channels.create({
    name: `ticket-${ticketSlug(ticketType)}-${ticketSlug(interaction.user.username)}`,
    type: ChannelType.GuildText,
    parent: category?.id,
    topic,
    permissionOverwrites,
    reason: `Ticket de ${ticketType} aberto por ${interaction.user.tag} (${interaction.user.id})`,
  });
  const ticketEmbed = new EmbedBuilder()
    .setColor(configColor(config))
    .setTitle(`🎟️ Ticket de ${ticketType}`)
    .setDescription('Conte os detalhes do que você precisa. Esta conversa é privada e visível somente para você e a equipe de suporte.\n\nA primeira pessoa da equipe com acesso ao canal que enviar uma mensagem assumirá o atendimento. Só ela poderá fechá-lo.')
    .setFooter({ text: configFooter(config, 'Atendimento privado') })
    .setTimestamp();
  const closeButton = new ButtonBuilder()
    .setCustomId(ticketCloseButtonId)
    .setLabel('Fechar ticket')
    .setEmoji('🔒')
    .setStyle(ButtonStyle.Danger);
  try {
    await channel.send({
      content: `<@${interaction.user.id}>`,
      embeds: [ticketEmbed],
      components: [new ActionRowBuilder().addComponents(closeButton)],
      allowedMentions: { users: [interaction.user.id] },
    });
  } catch (error) {
    await channel.delete('Não foi possível enviar a mensagem inicial do ticket.');
    throw error;
  }

  await replyPrivate(interaction, `Seu ticket privado de **${ticketType.toUpperCase()}** foi criado em <#${channel.id}>.`);
}

function parseOpenTicketTopic(topic) {
  const match = topic?.match(/^ALTA_TICKET:OPEN:(\d{17,20}):(\d{17,20}|none)(?::([a-z]+):(\d{17,20}|none)(?::(\d{17,20}|none))?)?$/);
  if (!match) return null;
  const [, requesterId, supportRoleId, ticketType = 'atendimento', categoryId = 'none', assigneeId = 'none'] = match;
  return { requesterId, supportRoleId, ticketType, categoryId, assigneeId };
}

async function handleTicketAssumeMessage(message) {
  if (!message.guild || message.author.bot || !message.content.trim()
      || message.channel.type !== ChannelType.GuildText) return;
  const config = await getBotConfig(message.guild.id);
  if (!config.ticketsEnabled) return;
  const ticket = parseOpenTicketTopic(message.channel.topic);
  if (!ticket || ticket.requesterId === message.author.id) return;

  const actor = await message.guild.members.fetch(message.author.id);
  const canAssume = message.channel.permissionsFor(actor)?.has(PermissionFlagsBits.ViewChannel);
  if (!canAssume) return;

  if (ticket.assigneeId !== 'none' || ticketAssignmentLocks.has(message.channel.id)) return;
  ticketAssignmentLocks.add(message.channel.id);
  try {
    const currentTicket = parseOpenTicketTopic(message.channel.topic);
    if (!currentTicket) return;
    if (currentTicket.assigneeId !== 'none') return;

    await message.channel.setTopic(
      `ALTA_TICKET:OPEN:${currentTicket.requesterId}:${currentTicket.supportRoleId}:${currentTicket.ticketType}:${currentTicket.categoryId}:${message.author.id}`,
      `Ticket assumido por ${message.author.tag} (${message.author.id}).`,
    );
    await message.channel.send({
      embeds: [
        new EmbedBuilder()
          .setColor(configColor(config))
          .setTitle('✅ Atendimento assumido')
          .setDescription(`Assumido por <@${message.author.id}>. Somente essa pessoa poderá fechar o ticket.`)
          .setFooter({ text: configFooter(config) })
          .setTimestamp(),
      ],
      allowedMentions: { users: [message.author.id] },
    });
  } finally {
    ticketAssignmentLocks.delete(message.channel.id);
  }
}

async function createTicketTranscript(channel) {
  const messages = [];
  let before;
  while (true) {
    const batch = await channel.messages.fetch({ limit: 100, ...(before ? { before } : {}) });
    if (batch.size === 0) break;
    messages.push(...batch.values());
    before = batch.last().id;
    if (batch.size < 100) break;
  }
  messages.reverse();

  const lines = [
    `Transcript do ticket #${channel.name}`,
    `Canal ID: ${channel.id}`,
    `Servidor: ${channel.guild.name} (${channel.guild.id})`,
    `Mensagens: ${messages.length}`,
    '',
  ];
  for (const message of messages) {
    const content = message.content || (message.embeds.length ? '[embed]' : '[sem texto]');
    lines.push(`[${message.createdAt.toISOString()}] ${message.author.tag} (${message.author.id})`);
    lines.push(content);
    for (const attachment of message.attachments.values()) {
      lines.push(`[Anexo: ${attachment.name ?? 'arquivo'}] ${attachment.url}`);
    }
    for (const embed of message.embeds) {
      if (embed.author?.name) lines.push(`[Embed - autor] ${embed.author.name}`);
      if (embed.title) lines.push(`[Embed - título] ${embed.title}`);
      if (embed.description) lines.push(`[Embed - descrição] ${embed.description}`);
      for (const field of embed.fields) lines.push(`[Embed - ${field.name}] ${field.value}`);
      if (embed.footer?.text) lines.push(`[Embed - rodapé] ${embed.footer.text}`);
      if (embed.url) lines.push(`[Link do embed] ${embed.url}`);
    }
    lines.push('');
  }
  return { buffer: Buffer.from(`${lines.join('\n')}\n`, 'utf8'), messageCount: messages.length };
}

async function updateGlobalTicketRankings(topHandlers) {
  const rankings = topHandlers.length
    ? topHandlers.map((handler, index) => {
      const position = index + 1;
      const marker = position === 1 ? '🥇' : position === 2 ? '🥈' : position === 3 ? '🥉' : `**${position}º**`;
      return `${marker} <@${handler.userId}> — **${handler.tickets}** ticket(s)`;
    }).join('\n')
    : 'Nenhum ticket fechado contabilizado ainda.';

  for (const guild of client.guilds.cache.values()) {
    try {
      const config = await getBotConfig(guild.id);
      if (!config.ticketsEnabled) continue;
      const embed = new EmbedBuilder()
        .setColor(configColor(config))
        .setTitle('🏆 Ranking global de atendimentos')
        .setDescription(rankings)
        .setFooter({ text: configFooter(config, 'Top 6 • Atualizado a cada ticket fechado') })
        .setTimestamp();
      let rankingChannel = await findTextChannelByName(guild, config.ticketRankingChannel);
      if (!rankingChannel) {
        rankingChannel = await guild.channels.create({
          name: config.ticketRankingChannel,
          type: ChannelType.GuildText,
          topic: 'Ranking global dos atendimentos de tickets da ALTA BOT.',
          reason: `Canal do ranking global de atendimentos de tickets (${config.ticketRankingChannel}).`,
        });
      }

      const botMember = await guild.members.fetchMe();
      if (!rankingChannel.permissionsFor(botMember)?.has([
        PermissionFlagsBits.ViewChannel,
        PermissionFlagsBits.SendMessages,
        PermissionFlagsBits.EmbedLinks,
        PermissionFlagsBits.ReadMessageHistory,
      ])) {
        throw new Error(`Sem permissões para atualizar #${config.ticketRankingChannel} no servidor ${guild.name}.`);
      }

      const recentMessages = await rankingChannel.messages.fetch({ limit: 50 });
      const existingRanking = recentMessages.find((message) => (
        message.author.id === client.user.id
        && message.embeds.some((messageEmbed) => messageEmbed.footer?.text?.includes('Top 6 • Atualizado a cada ticket fechado'))
      ));
      if (existingRanking) await existingRanking.edit({ embeds: [embed], allowedMentions: { parse: [] } });
      else await rankingChannel.send({ embeds: [embed], allowedMentions: { parse: [] } });
    } catch (error) {
      console.error(`Não foi possível atualizar o ranking global no servidor ${guild.name}:`, error);
    }
  }
}

function staffFeedbackRatingButtons(ticketId) {
  const ratings = [1, 2, 3, 4, 5];
  return new ActionRowBuilder().addComponents(ratings.map((rating) => (
    new ButtonBuilder()
      .setCustomId(`${staffFeedbackPrefix}:rate:${ticketId}:${rating}`)
      .setLabel(`${rating}`)
      .setEmoji('⭐')
      .setStyle(rating === 5 ? ButtonStyle.Success : ButtonStyle.Secondary)
  )));
}

function staffFeedbackPanelEmbed(guild) {
  return new EmbedBuilder()
    .setColor(0xE50914)
    .setAuthor({ name: 'ALTA BOT • SISTEMA DE FEEDBACK' })
    .setTitle('⭐ Avaliação da Staff')
    .setDescription([
      'As avaliações ajudam a equipe a oferecer um atendimento cada vez melhor.',
      '',
      '**Como avaliar**',
      'Quando seu ticket for fechado, você receberá uma mensagem privada com opções de 1 a 5 estrelas e um campo para comentário.',
      '',
      '**O que será publicado aqui**',
      'A nota, o atendente avaliado, seu comentário e as estatísticas atualizadas de atendimentos e avaliações.',
    ].join('\n'))
    .setFooter({ text: `Avaliações reais de tickets • ${safeText(guild.name, 150)}` });
}

async function ensureStaffFeedbackPanel(guild) {
  const channel = await findStaffChannelBySlug(guild, staffFeedbackChannelSlug);
  if (!channel) return;
  const botMember = await guild.members.fetchMe();
  const requiredPermissions = [
    PermissionFlagsBits.ViewChannel,
    PermissionFlagsBits.ReadMessageHistory,
    PermissionFlagsBits.SendMessages,
    PermissionFlagsBits.EmbedLinks,
  ];
  if (!channel.permissionsFor(botMember)?.has(requiredPermissions)) {
    throw new Error(`O bot precisa de Ver canal, Ler histórico, Enviar mensagens e Incorporar links em #${channel.name}.`);
  }
  const recentMessages = await channel.messages.fetch({ limit: 100 });
  const existingPanel = recentMessages.find((message) => (
    message.author.id === client.user.id
    && message.embeds.some((embed) => embed.author?.name === 'ALTA BOT • SISTEMA DE FEEDBACK')
  ));
  const payload = {
    embeds: [staffFeedbackPanelEmbed(guild)],
    allowedMentions: { parse: [] },
  };
  if (existingPanel) await existingPanel.edit(payload);
  else await channel.send(payload);
}

async function handleStaffFeedbackRating(interaction) {
  const [, action, ticketId, ratingText] = interaction.customId.split(':');
  const rating = Number(ratingText);
  if (action !== 'rate'
      || !/^\d{17,20}$/.test(ticketId ?? '')
      || !Number.isInteger(rating)
      || rating < 1
      || rating > 5) {
    await replyPrivate(interaction, 'Este botão de avaliação não é válido.');
    return;
  }
  const ticket = await getStaffFeedbackRequest(ticketId);
  if (!ticket || ticket.requesterId !== interaction.user.id) {
    await replyPrivate(interaction, 'Esta avaliação não pertence a você ou não está mais disponível.');
    return;
  }
  if (ticket.review) {
    await replyPrivate(interaction, 'Este atendimento já foi avaliado. Obrigado!');
    return;
  }
  const modal = new ModalBuilder()
    .setCustomId(`${staffFeedbackPrefix}:submit:${ticketId}:${rating}`)
    .setTitle(`Avaliar atendimento • ${rating}/5`);
  const comment = new TextInputBuilder()
    .setCustomId('comment')
    .setLabel('Comentário (opcional)')
    .setStyle(TextInputStyle.Paragraph)
    .setRequired(false)
    .setMaxLength(500)
    .setPlaceholder('Conte como foi sua experiência com o atendimento.');
  modal.addComponents(new ActionRowBuilder().addComponents(comment));
  await interaction.showModal(modal);
}

function staffFeedbackEmbed(ticket, rating, comment, reviewer, summary) {
  const ratingLabels = {
    1: 'Muito ruim',
    2: 'Ruim',
    3: 'Regular',
    4: 'Muito bom',
    5: 'Excelente',
  };
  const reviewedAt = Math.floor(Date.now() / 1000);
  const average = summary.reviews
    ? ((summary.average * summary.reviews + rating) / (summary.reviews + 1)).toFixed(1)
    : rating.toFixed(1);
  const description = [
    `⭐️`.repeat(rating) + ` **${rating}/5 Estrelas • ${ratingLabels[rating]}**`,
    '',
    `👤 **Staff Avaliado**\n<@${ticket.staffId}>`,
    '',
    `👤 **Avaliado Por**\n<@${reviewer.id}> • <t:${reviewedAt}:R>`,
    '',
    `🖊️ **Comentário do Usuário**\n${comment ? safeText(comment, 500) : 'Sem comentário.'}`,
    '',
    `📋 **Informações**\n**Ticket:** ${safeText(ticket.ticketName, 100)}\n**Servidor:** ${safeText(ticket.serverName, 100)}`,
    '',
    `⭐ **Estatísticas**\n**Tickets:** ${summary.tickets}\n**Avaliações:** ${summary.reviews + 1}\n**Média:** ${average}/5.0`,
  ].join('\n');
  const timestamp = new Intl.DateTimeFormat('pt-BR', {
    timeZone: 'America/Sao_Paulo',
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
    hourCycle: 'h23',
  }).format(new Date());
  return new EmbedBuilder()
    .setColor(0xE50914)
    .setDescription(description)
    .setFooter({ text: `${safeText(ticket.serverName, 140)} • Sistema de Feedback • ${timestamp}` });
}

async function handleStaffFeedbackSubmission(interaction) {
  const [, action, ticketId, ratingText] = interaction.customId.split(':');
  const rating = Number(ratingText);
  if (action !== 'submit'
      || !/^\d{17,20}$/.test(ticketId ?? '')
      || !Number.isInteger(rating)
      || rating < 1
      || rating > 5) {
    await replyPrivate(interaction, 'Este formulário de avaliação não é válido.');
    return;
  }
  await deferPrivateReply(interaction);
  const ticket = await getStaffFeedbackRequest(ticketId);
  if (!ticket || ticket.requesterId !== interaction.user.id) {
    await replyPrivate(interaction, 'Esta avaliação não pertence a você ou não está mais disponível.');
    return;
  }
  if (ticket.review) {
    await replyPrivate(interaction, 'Este atendimento já foi avaliado. Obrigado!');
    return;
  }
  if (staffFeedbackSubmissionLocks.has(ticketId)) {
    await replyPrivate(interaction, 'Sua avaliação já está sendo enviada. Aguarde um instante.');
    return;
  }

  staffFeedbackSubmissionLocks.add(ticketId);
  try {
    const guild = await client.guilds.fetch(ticket.guildId);
    const channel = await findStaffChannelBySlug(guild, staffFeedbackChannelSlug);
    if (!channel) {
      throw new Error(`Não encontrei o canal terminado em ┊${staffFeedbackChannelSlug} no servidor ${guild.name}.`);
    }
    const botMember = await guild.members.fetchMe();
    const requiredPermissions = [
      PermissionFlagsBits.ViewChannel,
      PermissionFlagsBits.SendMessages,
      PermissionFlagsBits.EmbedLinks,
    ];
    if (!channel.permissionsFor(botMember)?.has(requiredPermissions)) {
      throw new Error(`O bot precisa de Ver canal, Enviar mensagens e Incorporar links em #${channel.name}.`);
    }
    const comment = safeText(interaction.fields.getTextInputValue('comment').trim(), 500);
    const summary = await getStaffFeedbackSummary(ticket.staffId);
    const message = await channel.send({
      embeds: [staffFeedbackEmbed(ticket, rating, comment, interaction.user, summary)],
      allowedMentions: { parse: [] },
    });
    const saved = await recordStaffFeedback(ticketId, {
      reviewerId: interaction.user.id,
      rating,
      comment,
      messageId: message.id,
    });
    if (!saved) {
      await message.delete('Avaliação duplicada; apenas uma avaliação é permitida por ticket.');
      await replyPrivate(interaction, 'Este atendimento já foi avaliado. Obrigado!');
      return;
    }
    await replyPrivate(interaction, `Obrigado! Sua avaliação de ${rating}/5 foi publicada em <#${channel.id}>.`);
  } finally {
    staffFeedbackSubmissionLocks.delete(ticketId);
  }
}

async function finishTicketClose(interaction, channel) {
  const config = await getBotConfig(interaction.guildId);
  if (!config.ticketsEnabled) throw new Error('O sistema de tickets está desativado neste servidor.');
  const transcriptChannel = await findTextChannelByName(interaction.guild, config.ticketTranscriptChannel);
  if (!transcriptChannel) {
    throw new Error(`Não encontrei o canal #${config.ticketTranscriptChannel}; o ticket continua aberto para não perder o transcript.`);
  }

  const botMember = await interaction.guild.members.fetchMe();
  const requiredPermissions = [
    PermissionFlagsBits.ViewChannel,
    PermissionFlagsBits.SendMessages,
    PermissionFlagsBits.AttachFiles,
    PermissionFlagsBits.EmbedLinks,
  ];
  if (!transcriptChannel.permissionsFor(botMember)?.has(requiredPermissions)) {
    throw new Error(`O bot precisa de Ver canal, Enviar mensagens, Anexar arquivos e Incorporar links em #${config.ticketTranscriptChannel}; o ticket continua aberto.`);
  }

  const { buffer: transcript, messageCount } = await createTicketTranscript(channel);
  const ticket = parseOpenTicketTopic(channel.topic);
  if (!ticket) throw new Error('Os dados do ticket não são mais válidos; o canal não foi excluído.');
  const embed = new EmbedBuilder()
    .setColor(configColor(config))
    .setTitle('🔒 Ticket fechado')
    .setDescription([
      `**Fechado por:** <@${interaction.user.id}>`,
      `**Canal:** #${safeText(channel.name, 90)} (\`${channel.id}\`)`,
      `**Ticket aberto por:** <@${ticket.requesterId}>`,
      `**Mensagens no transcript:** ${messageCount}`,
    ].join('\n'))
    .setFooter({ text: configFooter(config) })
    .setTimestamp();
  await transcriptChannel.send({
    content: `Transcript do ticket fechado por <@${interaction.user.id}>.`,
    embeds: [embed],
    files: [{
      attachment: transcript,
      name: `transcript-${ticketSlug(channel.name)}.txt`,
    }],
    allowedMentions: { users: [interaction.user.id] },
  });
  const handlerId = ticket.assigneeId !== 'none'
    ? ticket.assigneeId
    : interaction.user.id === ticket.requesterId
      ? null
      : interaction.user.id;
  let feedbackRequestRecorded = false;
  if (handlerId) {
    const topHandlers = await recordHandledTicket(handlerId, channel.id);
    await updateGlobalTicketRankings(topHandlers);
    if (handlerId !== ticket.requesterId) {
      await recordStaffFeedbackRequest({
        ticketId: channel.id,
        guildId: interaction.guildId,
        requesterId: ticket.requesterId,
        staffId: handlerId,
        ticketName: channel.name,
        ticketType: ticket.ticketType,
        serverName: interaction.guild.name,
      });
      feedbackRequestRecorded = true;
    }
  }
  let requesterTranscriptSent = false;
  try {
    const requester = await client.users.fetch(ticket.requesterId);
    await requester.send({
      content: `Seu ticket **#${safeText(channel.name, 90)}** foi fechado. O transcript completo está anexado.${feedbackRequestRecorded
        ? '\n\nComo foi seu atendimento? Escolha uma nota de 1 a 5 estrelas para avaliar a equipe.'
        : ''}`,
      files: [{
        attachment: transcript,
        name: `transcript-${ticketSlug(channel.name)}.txt`,
      }],
      ...(feedbackRequestRecorded ? { components: [staffFeedbackRatingButtons(channel.id)] } : {}),
      allowedMentions: { parse: [] },
    });
    requesterTranscriptSent = true;
  } catch (error) {
    console.error(`Não foi possível enviar o transcript do ticket ${channel.id} por DM para ${ticket.requesterId}:`, error);
  }
  await channel.delete(`Ticket fechado por ${interaction.user.tag} (${interaction.user.id}); transcript enviado para #${config.ticketTranscriptChannel}.`);
  return {
    rankingUpdated: Boolean(handlerId),
    requesterTranscriptSent,
    feedbackRequestRecorded,
  };
}

async function handleTicketCloseConfirmation(interaction) {
  if (!interaction.inGuild() || !interaction.guild || !interaction.channel) {
    await interaction.reply({ content: 'A confirmação só pode ser usada no servidor.', flags: MessageFlags.Ephemeral });
    return;
  }
  await interaction.deferUpdate();
  const channel = await interaction.guild.channels.fetch(interaction.channelId);
  const ticket = parseOpenTicketTopic(channel?.topic);
  if (!channel || channel.type !== ChannelType.GuildText || !ticket) {
    await interaction.editReply({ content: 'Este ticket não está mais aberto.', components: [] });
    return;
  }
  const config = await getBotConfig(interaction.guildId);
  if (!config.ticketsEnabled) {
    await interaction.editReply({ content: 'O sistema de tickets está desativado neste servidor.', components: [] });
    return;
  }
  if (ticket.assigneeId === 'none' || ticket.assigneeId !== interaction.user.id) {
    await interaction.editReply({
      content: ticket.assigneeId === 'none'
        ? 'Uma pessoa da equipe precisa enviar uma mensagem no ticket para assumi-lo antes do fechamento.'
        : 'Somente a pessoa que assumiu este ticket pode fechá-lo.',
      components: [],
    });
    return;
  }

  let closeResult;
  try {
    closeResult = await finishTicketClose(interaction, channel);
  } catch (error) {
    console.error(`Não foi possível registrar ou excluir o ticket ${channel.id}:`, error);
    await interaction.editReply({
      content: `Não consegui concluir o fechamento. Confira se o transcript chegou a #${config.ticketTranscriptChannel} e se o canal ainda está ativo. ${safeText(error.message, 300)}`,
      components: [],
    });
    return;
  }
  await interaction.editReply({
    content: `Transcript enviado para #${config.ticketTranscriptChannel}${closeResult.requesterTranscriptSent
      ? ` e por DM para quem abriu o ticket${closeResult.feedbackRequestRecorded ? ', com o pedido de avaliação' : ''}`
      : ', mas não foi possível enviar a DM para quem abriu o ticket (o transcript está no canal de logs)'}${closeResult.rankingUpdated
      ? `; ranking atualizado em #${config.ticketRankingChannel}`
      : ''}. Ticket excluído.`,
    components: [],
  });
}

function tellonymPanelButtons(channelId) {
  return new ActionRowBuilder().addComponents(
    new ButtonBuilder()
      .setCustomId(`${tellonymPrefix}:send:${channelId}`)
      .setLabel('Enviar Tellonym')
      .setEmoji('💌')
      .setStyle(ButtonStyle.Success),
  );
}

function tellonymModeButtons(channelId, config) {
  return new ActionRowBuilder().addComponents(
    new ButtonBuilder()
      .setCustomId(`${tellonymPrefix}:mode:anonymous:${channelId}`)
      .setLabel('Enviar em modo anônimo')
      .setStyle(ButtonStyle.Secondary)
      .setDisabled(!config.tellonymAllowAnonymousMode),
    new ButtonBuilder()
      .setCustomId(`${tellonymPrefix}:mode:public:${channelId}`)
      .setLabel('Enviar com meu nome')
      .setStyle(ButtonStyle.Secondary)
      .setDisabled(!config.tellonymAllowPublicMode),
  );
}

function tellonymPostButtons(messageId, likes = 0, disabled = false) {
  return new ActionRowBuilder().addComponents(
    new ButtonBuilder()
      .setCustomId(`${tellonymPrefix}:like:${messageId}`)
      .setLabel(`❤️ ${likes}`)
      .setStyle(ButtonStyle.Secondary)
      .setDisabled(disabled),
    new ButtonBuilder()
      .setCustomId(`${tellonymPrefix}:comment:${messageId}`)
      .setLabel('Comentar')
      .setEmoji('💬')
      .setStyle(ButtonStyle.Secondary)
      .setDisabled(disabled),
    new ButtonBuilder()
      .setCustomId(`${tellonymPrefix}:view:${messageId}`)
      .setLabel('Ver comentários')
      .setEmoji('👀')
      .setStyle(ButtonStyle.Secondary)
      .setDisabled(disabled),
  );
}

function staffPanelButtons(disabled = false) {
  return new ActionRowBuilder().addComponents(
    new ButtonBuilder()
      .setCustomId(`${staffApplicationPrefix}:apply`)
      .setLabel('Quero me candidatar!')
      .setEmoji('📋')
      .setStyle(ButtonStyle.Danger)
      .setDisabled(disabled),
  );
}

function staffPanelEmbed(guild, enabled) {
  return new EmbedBuilder()
    .setColor(0xD9363E)
    .setAuthor({ name: `${safeText(guild.name, 200)} • PROCESSO SELETIVO` })
    .setTitle(`👔 Candidatura para Staff — ${safeText(guild.name, 180)}`)
    .setDescription([
      'Quer fazer parte da equipe que organiza e garante a melhor experiência da comunidade?',
      '',
      '**O que buscamos**',
      '🎯 Maturidade e responsabilidade',
      '🛡️ Conhecimento de comandos de administração',
      '📸 Capacidade de registrar provas (prints/vídeos)',
      '🤝 Boa comunicação e postura profissional',
      '',
      '**Como se candidatar:**',
      enabled
        ? 'Clique no botão abaixo e responda ao formulário. Todas as perguntas são obrigatórias; sua candidatura será enviada para análise da equipe.'
        : 'As candidaturas estão fechadas no momento. A equipe avisará quando o processo seletivo reabrir.',
      '',
      '⚠️ Abusos de poder podem resultar em remoção imediata.',
    ].join('\n'))
    .setFooter({
      text: `${safeText(guild.name, 100)} • Processo Seletivo • Inscrições ${enabled ? 'abertas' : 'fechadas'}`,
    });
}

async function updateStaffPanelAvailability(guild, enabled) {
  const channel = await findStaffChannelBySlug(guild, staffPanelChannelSlug);
  if (!channel) return 0;
  const messages = await channel.messages.fetch({ limit: 100 });
  const panels = messages.filter((message) => (
    message.author.id === client.user.id
    && message.components.some((row) => row.components.some((component) => (
      component.customId === `${staffApplicationPrefix}:apply`
    )))
  ));
  for (const message of panels.values()) {
    await message.edit({
      embeds: [staffPanelEmbed(guild, enabled)],
      components: [staffPanelButtons(!enabled)],
    });
  }
  return panels.size;
}

async function handleStaffApplicationPanelCommand(interaction) {
  if (!(await requireGuildPermission(interaction, PermissionFlagsBits.ManageGuild, 'Manage Server'))) return;
  const config = await getBotConfig(interaction.guildId);
  if (!config.staffApplicationsEnabled) {
    await replyPrivate(interaction, 'O painel de candidaturas de Staff está desativado. Ative-o em /configurar-bot → Candidaturas de Staff.');
    return;
  }
  await deferPrivateReply(interaction);

  const channels = await interaction.guild.channels.fetch();
  const panelChannel = channels.find((channel) => (
    channel?.type === ChannelType.GuildText && channel.name.endsWith(`┊${staffPanelChannelSlug}`)
  ));
  const submissionsChannel = channels.find((channel) => (
    channel?.type === ChannelType.GuildText && channel.name.endsWith(`┊${staffSubmissionsChannelSlug}`)
  ));
  const approvedChannel = channels.find((channel) => (
    channel?.type === ChannelType.GuildText && channel.name.endsWith(`┊${staffApprovedChannelSlug}`)
  ));
  const missingChannel = [
    [panelChannel, staffPanelChannelSlug],
    [submissionsChannel, staffSubmissionsChannelSlug],
    [approvedChannel, staffApprovedChannelSlug],
  ].find(([channel]) => !channel);
  if (missingChannel) {
    await replyPrivate(interaction, `Crie o canal **${missingChannel[1]}** e tente publicar o painel novamente.`);
    return;
  }

  const botMember = await interaction.guild.members.fetchMe();
  const requiredPermissions = [
    PermissionFlagsBits.ViewChannel,
    PermissionFlagsBits.SendMessages,
    PermissionFlagsBits.EmbedLinks,
  ];
  const missingPermissions = [
    [panelChannel, 'painel'],
    [submissionsChannel, 'recebimento das candidaturas'],
    [approvedChannel, 'anúncios de aprovação'],
  ].find(([channel]) => !channel.permissionsFor(botMember)?.has(requiredPermissions));
  if (missingPermissions) {
    await replyPrivate(interaction, `Preciso de Ver canal, Enviar mensagens e Incorporar links no canal de ${missingPermissions[1]} (<#${missingPermissions[0].id}>).`);
    return;
  }
  const missingEveryonePermission = [
    [submissionsChannel, 'recebimento das candidaturas'],
    [approvedChannel, 'anúncios de aprovação'],
  ].find(([channel]) => !channel.permissionsFor(botMember)?.has(PermissionFlagsBits.MentionEveryone));
  if (missingEveryonePermission) {
    await replyPrivate(interaction, `Preciso da permissão Mencionar @everyone em <#${missingEveryonePermission[0].id}> para avisar sobre ${missingEveryonePermission[1]}.`);
    return;
  }

  const panelMessages = await panelChannel.messages.fetch({ limit: 100 });
  const existingPanel = panelMessages.find((message) => (
    message.author.id === client.user.id
    && message.components.some((row) => row.components.some((component) => (
      component.customId === `${staffApplicationPrefix}:apply`
    )))
  ));
  const payload = {
    embeds: [staffPanelEmbed(interaction.guild, config.staffApplicationsEnabled)],
    components: [staffPanelButtons()],
  };
  if (existingPanel) {
    await existingPanel.edit(payload);
    await replyPrivate(interaction, `Painel atualizado em <#${panelChannel.id}>. As candidaturas serão recebidas em <#${submissionsChannel.id}> e as aprovações anunciadas em <#${approvedChannel.id}>.`);
    return;
  }
  await panelChannel.send(payload);
  await replyPrivate(interaction, `Painel publicado em <#${panelChannel.id}>. As candidaturas serão recebidas em <#${submissionsChannel.id}> e as aprovações anunciadas em <#${approvedChannel.id}>.`);
}

async function hasPendingStaffApplication(guild, userId) {
  const applications = await getPendingStaffApplications(guild.id, userId);
  for (const application of applications) {
    if (application.status === 'processing') return true;

    let channel;
    if (application.channelId) {
      try {
        channel = await guild.channels.fetch(application.channelId);
      } catch (error) {
        if (error.code !== 10003) throw error;
      }
    } else {
      channel = await findStaffChannelBySlug(guild, staffSubmissionsChannelSlug);
    }

    if (!channel?.isTextBased()) {
      if (!application.channelId && !channel) return true;
      await deletePendingStaffApplication(application.messageId);
      continue;
    }

    let message;
    try {
      message = await channel.messages.fetch(application.messageId);
    } catch (error) {
      if (error.code !== 10008) throw error;
    }
    const hasReviewButtons = message?.author.id === client.user.id
      && message.components.some((row) => row.components.some((component) => (
        component.customId === `${staffApplicationPrefix}:approve:${application.messageId}`
        || component.customId === `${staffApplicationPrefix}:reject:${application.messageId}`
      )));
    if (hasReviewButtons) return true;
    await deletePendingStaffApplication(application.messageId);
  }
  return false;
}

async function showStaffApplicationModal(interaction) {
  const modal = new ModalBuilder()
    .setCustomId(`${staffApplicationPrefix}:submit:all`)
    .setTitle('Candidatura para Staff')
    .addComponents(
      new ActionRowBuilder().addComponents(
        new TextInputBuilder()
          .setCustomId('answers')
          .setLabel('Responda às 10 perguntas abaixo')
          .setPlaceholder('Mantenha a numeração e responda abaixo de cada pergunta.')
          .setStyle(TextInputStyle.Paragraph)
          .setMaxLength(4000)
          .setRequired(true)
          .setValue(staffApplicationQuestions
            .map((question, index) => `${index + 1}. ${question.prompt}\nResposta:`)
            .join('\n\n')),
      ),
    );
  await interaction.showModal(modal);
}

function parseStaffApplicationAnswers(value) {
  const sections = [...value.matchAll(/^[ \t]*(\d{1,2})\.[^\r\n]*\r?\n/gm)];
  if (sections.length !== staffApplicationQuestions.length) return null;

  const answerLengths = [100, 3, 200, 1000, 1000, 700, 700, 700, 100, 700];
  const answers = {};
  for (const [index, section] of sections.entries()) {
    if (Number(section[1]) !== index + 1) return null;
    const start = section.index + section[0].length;
    const end = sections[index + 1]?.index ?? value.length;
    const answer = value.slice(start, end).replace(/^\s*Resposta:\s*/i, '').trim();
    const question = staffApplicationQuestions[index];
    answers[question.key] = safeText(answer, answerLengths[index]);
  }
  return answers;
}

function staffReviewButtons(messageId) {
  return new ActionRowBuilder().addComponents(
    new ButtonBuilder()
      .setCustomId(`${staffApplicationPrefix}:approve:${messageId}`)
      .setLabel('Aprovar')
      .setEmoji('✅')
      .setStyle(ButtonStyle.Success),
    new ButtonBuilder()
      .setCustomId(`${staffApplicationPrefix}:reject:${messageId}`)
      .setLabel('Recusar')
      .setEmoji('❌')
      .setStyle(ButtonStyle.Danger),
  );
}

async function handleStaffApplicationSubmission(interaction) {
  if (!interaction.inGuild() || !interaction.guild) {
    await replyPrivate(interaction, 'A candidatura só pode ser enviada dentro de um servidor.');
    return;
  }
  await deferPrivateReply(interaction);
  const config = await getBotConfig(interaction.guildId);
  if (!config.staffApplicationsEnabled) {
    await replyPrivate(interaction, 'As candidaturas de Staff estão fechadas no momento.');
    return;
  }
  const answers = parseStaffApplicationAnswers(interaction.fields.getTextInputValue('answers'));
  if (!answers) {
    await replyPrivate(interaction, 'Mantenha a numeração de 1 a 10 e responda abaixo de cada pergunta.');
    return;
  }
  if (!/^(1[3-9]|[2-9]\d)$/.test(answers.age)) {
    await replyPrivate(interaction, 'Informe uma idade válida entre 13 e 99 anos.');
    return;
  }
  if (Object.values(answers).some((answer) => !answer)) {
    await replyPrivate(interaction, 'Preencha as respostas de todas as 10 perguntas antes de enviar.');
    return;
  }
  if (await hasPendingStaffApplication(interaction.guild, interaction.user.id)) {
    await replyPrivate(interaction, 'Você já tem uma candidatura aguardando análise neste servidor.');
    return;
  }

  const channel = await findStaffChannelBySlug(interaction.guild, staffSubmissionsChannelSlug);
  if (!channel) {
    await replyPrivate(interaction, `Não encontrei o canal de formulários **${staffSubmissionsChannelSlug}**. Avise a equipe do servidor.`);
    return;
  }
  const botMember = await interaction.guild.members.fetchMe();
  if (!channel.permissionsFor(botMember)?.has([
    PermissionFlagsBits.ViewChannel,
    PermissionFlagsBits.SendMessages,
    PermissionFlagsBits.EmbedLinks,
  ])) {
    await replyPrivate(interaction, `O bot precisa de Ver canal, Enviar mensagens e Incorporar links em <#${channel.id}>.`);
    return;
  }
  if (!channel.permissionsFor(botMember)?.has(PermissionFlagsBits.MentionEveryone)) {
    await replyPrivate(interaction, `O bot precisa da permissão Mencionar @everyone em <#${channel.id}> para avisar a equipe quando chegar uma candidatura.`);
    return;
  }

  const applicationEmbed = new EmbedBuilder()
    .setColor(0x5865F2)
    .setTitle('📋 Nova candidatura para Staff')
    .setDescription(`Candidatura de <@${interaction.user.id}> recebida para análise.`)
    .addFields(
      { name: '👤 Usuário do Discord', value: `${interaction.user} (\`${interaction.user.id}\`)` },
      { name: '🎮 Nick do Roblox', value: answers.roblox },
      { name: '🎂 Idade', value: answers.age, inline: true },
      { name: '🕒 Disponibilidade', value: answers.availability },
      { name: '🛡️ Experiência e registro de provas', value: answers.experience },
      { name: '💬 Por que deseja ser staff?', value: answers.motivation },
      { name: '🤝 Como resolveria um conflito na equipe?', value: answers.conflict },
      { name: '📜 O que faria ao ver alguém quebrando regras?', value: answers.ruleViolation },
      { name: '🔎 Como agiria numa denúncia sem provas?', value: answers.scenario },
      { name: '⏱️ Horas disponíveis por semana', value: answers.weeklyHours, inline: true },
      { name: '⚖️ Respeito e imparcialidade', value: answers.commitment },
    )
    .setThumbnail(interaction.user.displayAvatarURL())
    .setFooter({ text: `${safeText(interaction.guild.name, 100)} • Aguardando análise` })
    .setTimestamp();
  const message = await channel.send({
    content: '@everyone',
    embeds: [applicationEmbed],
    components: [],
    allowedMentions: { parse: ['everyone'], users: [interaction.user.id] },
  });
  try {
    await recordStaffApplication({
      messageId: message.id,
      guildId: interaction.guildId,
      channelId: channel.id,
      userId: interaction.user.id,
      answers,
    });
    await message.edit({ components: [staffReviewButtons(message.id)] });
  } catch (error) {
    await message.delete().catch((deleteError) => {
      console.error(`Não foi possível remover a candidatura sem registro ${message.id}:`, deleteError);
    });
    throw error;
  }
  await replyPrivate(interaction, 'Sua candidatura com 10 respostas foi enviada para análise da equipe. Você receberá o resultado por mensagem privada.');
}

function staffApplicationStatusLabel(status) {
  if (status === 'approved') return 'Aprovado(a)';
  if (status === 'rejected') return 'Recusado(a)';
  return 'Em análise';
}

async function handleStaffReviewButton(interaction) {
  if (!interaction.inGuild() || !interaction.guild) {
    await replyPrivate(interaction, 'Esta ação só pode ser usada dentro do servidor.');
    return;
  }
  await deferPrivateReply(interaction);
  if (!(await requireGuildPermission(interaction, PermissionFlagsBits.ManageGuild, 'Manage Server'))) return;
  const match = interaction.customId.match(/^alta-staff:(approve|reject):(\d{17,20})$/);
  if (!match) {
    await replyPrivate(interaction, 'Este botão de candidatura não é válido.');
    return;
  }
  const decision = match[1] === 'approve' ? 'approved' : 'rejected';
  const messageId = match[2];

  const application = await getStaffApplication(messageId);
  if (!application || application.guildId !== interaction.guildId) {
    await replyPrivate(interaction, 'Não encontrei esta candidatura neste servidor.');
    return;
  }
  if (application.status !== 'pending') {
    await replyPrivate(interaction, `Esta candidatura já foi ${staffApplicationStatusLabel(application.status).toLowerCase()}.`);
    return;
  }
  let applicant = null;
  let applicantMember = null;
  let approvedStaffRole = null;

  let approvedChannel;
  if (decision === 'approved') {
    applicant = await client.users.fetch(application.userId);
    applicantMember = await interaction.guild.members.fetch(application.userId).catch((error) => {
      if (error.code === 10007 || error.code === 10013) return null;
      throw error;
    });
    if (!applicantMember) {
      await replyPrivate(interaction, 'O candidato não está mais neste servidor; não posso atribuir o cargo.');
      return;
    }
    approvedStaffRole = interaction.guild.roles.cache.find((role) => role.name === approvedStaffRoleName);
    if (!approvedStaffRole) {
      await replyPrivate(interaction, `Não encontrei o cargo **${approvedStaffRoleName}**. Crie-o e tente aprovar novamente.`);
      return;
    }
    const botMember = await interaction.guild.members.fetchMe();
    if (!botMember.permissions.has(PermissionFlagsBits.ManageRoles)
        || botMember.roles.highest.comparePositionTo(approvedStaffRole) <= 0) {
      await replyPrivate(interaction, `Preciso de Gerenciar cargos, e meu cargo mais alto deve ficar acima de **${approvedStaffRoleName}**.`);
      return;
    }

    approvedChannel = await findStaffChannelBySlug(interaction.guild, staffApprovedChannelSlug);
    if (!approvedChannel) {
      await replyPrivate(interaction, `Não encontrei o canal de aprovados **${staffApprovedChannelSlug}** para publicar a aprovação.`);
      return;
    }
    if (!approvedChannel.permissionsFor(botMember)?.has([
      PermissionFlagsBits.ViewChannel,
      PermissionFlagsBits.SendMessages,
      PermissionFlagsBits.EmbedLinks,
      PermissionFlagsBits.MentionEveryone,
    ])) {
      await replyPrivate(interaction, `O bot precisa de Ver canal, Enviar mensagens, Incorporar links e Mencionar @everyone em <#${approvedChannel.id}>.`);
      return;
    }
  }

  const claimed = await claimStaffApplication(messageId, interaction.user.id, decision);
  if (!claimed) {
    await replyPrivate(interaction, 'Outra pessoa já está analisando esta candidatura ou ela já foi decidida.');
    return;
  }

  let announcement;
  let roleWasAdded = false;
  if (decision === 'approved') {
    roleWasAdded = !applicantMember.roles.cache.has(approvedStaffRole.id);
    try {
      if (roleWasAdded) {
        await applicantMember.roles.add(approvedStaffRole, `Candidatura de Staff aprovada por ${interaction.user.tag}`);
      }
    } catch (error) {
      await releaseStaffApplication(messageId);
      console.error(`Não foi possível atribuir o cargo de Staff ${approvedStaffRole.id} a ${application.userId}:`, error);
      await replyPrivate(interaction, `Não consegui atribuir o cargo **${approvedStaffRoleName}**. Confira as permissões e hierarquia de cargos; a candidatura continua aguardando.`);
      return;
    }

    const approvalEmbed = new EmbedBuilder()
      .setColor(0x2ECC71)
      .setTitle('🎉 Novo Staff Aprovado!')
      .setDescription(`${applicant} foi aprovado(a) na candidatura de Staff!`)
      .addFields(
        { name: '👤 Usuário', value: `<@${claimed.userId}> (\`${claimed.userId}\`)`, inline: true },
        { name: '🎮 Nick Roblox', value: claimed.answers.roblox, inline: true },
        { name: '🎂 Idade', value: claimed.answers.age, inline: true },
        { name: '🕒 Disponibilidade', value: claimed.answers.availability },
        { name: '✅ Aprovado(a) por', value: `<@${interaction.user.id}>`, inline: true },
        { name: '🏠 Servidor', value: safeText(interaction.guild.name, 100), inline: true },
      )
      .setThumbnail(applicant.displayAvatarURL())
      .setFooter({ text: `${safeText(interaction.guild.name, 100)} • Sistema de Candidatura` })
      .setTimestamp();
    try {
      announcement = await approvedChannel.send({
        content: '@everyone',
        embeds: [approvalEmbed],
        allowedMentions: {
          parse: ['everyone'],
          users: [...new Set([claimed.userId, interaction.user.id])],
        },
      });
    } catch (error) {
      await releaseStaffApplication(messageId);
      if (roleWasAdded) {
        await applicantMember.roles.remove(approvedStaffRole, 'Anúncio de aprovação não pôde ser publicado').catch((roleError) => {
          console.error(`Não foi possível remover o cargo ${approvedStaffRole.id} após falha no anúncio:`, roleError);
        });
      }
      throw error;
    }
  }

  const completed = await completeStaffApplication(messageId);
  if (!completed) {
    throw new Error(`Não foi possível concluir a candidatura ${messageId} após a decisão.`);
  }

  const originalEmbed = interaction.message.embeds[0];
  let reviewMessageUpdated = true;
  if (originalEmbed) {
    try {
      await interaction.message.edit({
        embeds: [new EmbedBuilder(originalEmbed.toJSON())
          .setFooter({ text: `${safeText(interaction.guild.name, 100)} • ${staffApplicationStatusLabel(decision)} por ${interaction.user.tag}` })],
        components: [],
      });
    } catch (error) {
      reviewMessageUpdated = false;
      console.error(`Não foi possível atualizar a mensagem da candidatura ${messageId}:`, error);
    }
  }

  let dmSent = true;
  try {
    const applicantUser = applicant ?? await client.users.fetch(claimed.userId);
    const approved = decision === 'approved';
    const dmEmbed = new EmbedBuilder()
      .setColor(approved ? 0x2ECC71 : 0xD9363E)
      .setTitle(approved ? '🎉 Parabéns! Você foi aprovado(a)!' : '📩 Resultado da sua candidatura')
      .setDescription(approved
        ? `Sua candidatura para Staff em **${safeText(interaction.guild.name, 100)}** foi aprovada! A equipe está muito feliz em receber você. Entre em contato com a equipe para os próximos passos e seja bem-vindo(a)!`
        : `Agradecemos por se candidatar para Staff em **${safeText(interaction.guild.name, 100)}** e pelo tempo dedicado ao formulário. Desta vez sua candidatura não foi aprovada, mas esperamos que você continue participando da comunidade.`)
      .addFields(
        { name: '🎮 Nick do Roblox', value: claimed.answers.roblox, inline: true },
        { name: '📋 Resultado', value: approved ? '✅ Aprovado(a)' : '❌ Não aprovado(a)', inline: true },
        { name: '👮 Avaliado por', value: `<@${interaction.user.id}>`, inline: true },
      )
      .setFooter({ text: `${safeText(interaction.guild.name, 100)} • Processo Seletivo de Staff` })
      .setTimestamp();
    await applicantUser.send({
      embeds: [dmEmbed],
      allowedMentions: { users: [interaction.user.id] },
    });
  } catch (error) {
    dmSent = false;
    console.error(`Não foi possível enviar o resultado da candidatura por DM para ${claimed.userId}:`, error);
  }

  await replyPrivate(interaction, decision === 'approved'
    ? `Candidatura aprovada; cargo **${approvedStaffRoleName}** atribuído.${announcement ? ` Anúncio publicado em <#${approvedChannel.id}>.` : ''}${dmSent ? ' O candidato foi avisado por DM.' : ' Não consegui enviar DM ao candidato; avise-o manualmente.'}${reviewMessageUpdated ? '' : ' Não consegui desativar os botões da candidatura.'}`
    : `Candidatura recusada.${dmSent ? ' O candidato foi avisado por DM.' : ' Não consegui enviar DM ao candidato; avise-o manualmente.'}${reviewMessageUpdated ? '' : ' Não consegui desativar os botões da candidatura.'}`);
}

async function handleTellonymPanelCommand(interaction) {
  if (!(await requireGuildPermission(interaction, PermissionFlagsBits.ManageGuild, 'Manage Server'))) return;
  const config = await getBotConfig(interaction.guildId);
  if (!config.tellonymEnabled) {
    await replyPrivate(interaction, 'O sistema Tellonym está desativado nas configurações deste servidor.');
    return;
  }
  if (!config.tellonymAllowAnonymousMode && !config.tellonymAllowPublicMode) {
    await replyPrivate(interaction, 'Ative pelo menos um modo de envio (anônimo ou público) antes de publicar o painel.');
    return;
  }
  await deferPrivateReply(interaction);
  const channels = await interaction.guild.channels.fetch();
  const panelChannel = channels.find((candidate) => (
    candidate?.name === config.tellonymPanelChannel
    && [ChannelType.GuildText, ChannelType.GuildAnnouncement].includes(candidate.type)
  ));
  if (!panelChannel) {
    await replyPrivate(interaction, `Crie um canal de texto chamado **${config.tellonymPanelChannel}** e tente novamente.`);
    return;
  }
  const receiveChannel = channels.find((candidate) => (
    candidate?.name === config.tellonymReceiveChannel
    && [ChannelType.GuildText, ChannelType.GuildAnnouncement].includes(candidate.type)
  ));
  if (!receiveChannel) {
    await replyPrivate(interaction, `Crie um canal de texto chamado **${config.tellonymReceiveChannel}** e tente novamente.`);
    return;
  }

  const botMember = await interaction.guild.members.fetchMe();
  const panelPermissions = [
    PermissionFlagsBits.ViewChannel,
    PermissionFlagsBits.ReadMessageHistory,
    PermissionFlagsBits.SendMessages,
    PermissionFlagsBits.EmbedLinks,
  ];
  if (!panelChannel.permissionsFor(botMember)?.has(panelPermissions)) {
    await replyPrivate(interaction, `Preciso de Ver canal, Ler histórico, Enviar mensagens e Incorporar links em <#${panelChannel.id}>.`);
    return;
  }
  const receivePermissions = [
    PermissionFlagsBits.ViewChannel,
    PermissionFlagsBits.SendMessages,
    PermissionFlagsBits.EmbedLinks,
  ];
  if (!receiveChannel.permissionsFor(botMember)?.has(receivePermissions)) {
    await replyPrivate(interaction, `Preciso de Ver canal, Enviar mensagens e Incorporar links em <#${receiveChannel.id}>.`);
    return;
  }

  const embed = new EmbedBuilder()
    .setColor(configColor(config))
    .setAuthor({
      name: `${config.panelTitlePrefix} • TELLONYM`,
      iconURL: client.user.displayAvatarURL(),
    })
    .setTitle('💌 Mensagens anônimas')
    .setDescription([
      'Diga o que pensa, declare-se ou mande aquela fofoca pra comunidade.',
      '',
      '**Como funciona**',
      'Clique em **Enviar Tellonym**, escolha quem vai receber, escreva sua mensagem e selecione o modo anônimo ou público.',
      '',
      '**🕶️ Anônimo** — seu nome não aparece na publicação.',
      '**🌐 Público** — seu nome e avatar aparecem na publicação.',
      '',
      '❤️ Curta e 💬 comente as mensagens da comunidade.',
      '',
      '🚫 Respeite as regras do servidor. Ofensas, ameaças e exposição de informações pessoais não são permitidas.',
      '',
      '*O modo anônimo oculta seu nome no post; não garante anonimato perante o Discord ou a administração do bot.*',
    ].join('\n'))
    .setFooter({ text: configFooter(config, 'TELLONYM | Compartilhe com respeito') });
  await panelChannel.send({ embeds: [embed], components: [tellonymPanelButtons(receiveChannel.id)] });
  await replyPrivate(interaction, `Painel publicado em <#${panelChannel.id}>. As mensagens recebidas serão enviadas para <#${receiveChannel.id}>.`);
}

async function showTellonymSubmitModal(interaction, mode, channelId, recipientId) {
  const modal = new ModalBuilder()
    .setCustomId(`${tellonymPrefix}:submit:${mode}:${channelId}:${recipientId}`)
    .setTitle(mode === 'anonymous' ? 'Enviar anonimamente' : 'Enviar com meu nome')
    .addComponents(
      new ActionRowBuilder().addComponents(
        new TextInputBuilder()
          .setCustomId('message')
          .setLabel('Sua mensagem')
          .setStyle(TextInputStyle.Paragraph)
          .setMaxLength(4000)
          .setRequired(true),
      ),
    );
  await interaction.showModal(modal);
}

async function publishTellonym(interaction, mode, channelId, recipientId) {
  if (!interaction.inGuild() || !interaction.guild) {
    await replyPrivate(interaction, 'Mensagens Tellonym só podem ser enviadas dentro de um servidor.');
    return;
  }
  await deferPrivateReply(interaction);
  const config = await getBotConfig(interaction.guildId);
  if (!config.tellonymEnabled) {
    await replyPrivate(interaction, 'O sistema Tellonym está desativado neste servidor.');
    return;
  }
  if ((mode === 'anonymous' && !config.tellonymAllowAnonymousMode)
      || (mode === 'public' && !config.tellonymAllowPublicMode)) {
    await replyPrivate(interaction, 'Esse modo de envio Tellonym está desativado neste servidor.');
    return;
  }
  if (recipientId === interaction.user.id) {
    await replyPrivate(interaction, 'Escolha outra pessoa como destinatário.');
    return;
  }

  const cooldownKey = `${interaction.guildId}:${interaction.user.id}`;
  const remaining = (tellonymCooldowns.get(cooldownKey) ?? 0) + config.tellonymCooldownSeconds * 1000 - Date.now();
  if (remaining > 0) {
    await replyPrivate(interaction, `Aguarde ${Math.ceil(remaining / 1000)} segundo(s) antes de enviar outra mensagem.`);
    return;
  }

  const recipient = await interaction.guild.members.fetch(recipientId).catch((error) => {
    if (error.code === 10007 || error.code === 10013) return null;
    throw error;
  });
  if (!recipient) {
    await replyPrivate(interaction, 'O destinatário precisa ser membro deste servidor.');
    return;
  }
  const channel = await interaction.guild.channels.fetch(channelId);
  if (!channel
      || ![ChannelType.GuildText, ChannelType.GuildAnnouncement].includes(channel.type)) {
    await replyPrivate(interaction, 'O canal de recebimento das mensagens não está mais disponível.');
    return;
  }
  const botMember = await interaction.guild.members.fetchMe();
  if (!channel.permissionsFor(botMember)?.has([
    PermissionFlagsBits.ViewChannel,
    PermissionFlagsBits.SendMessages,
    PermissionFlagsBits.EmbedLinks,
  ])) {
    await replyPrivate(interaction, 'Não consigo publicar mensagens no canal de recebimento.');
    return;
  }

  const text = interaction.fields.getTextInputValue('message').trim();
  if (!text || text.length > config.tellonymMaxMessageLength) {
    await replyPrivate(interaction, `Escreva uma mensagem com até ${config.tellonymMaxMessageLength} caracteres.`);
    return;
  }
  const embed = new EmbedBuilder()
    .setColor(configColor(config))
    .setAuthor(mode === 'anonymous'
      ? { name: 'Anônimo', iconURL: 'https://cdn.discordapp.com/embed/avatars/0.png' }
      : {
        name: interaction.user.globalName ?? interaction.user.username,
        iconURL: interaction.user.displayAvatarURL(),
      })
    .setDescription(safeText(text, config.tellonymMaxMessageLength))
    .setFooter({ text: configFooter(config, `TELLONYM | ${mode === 'anonymous' ? '🕶️ Modo anônimo' : '🌐 Modo público'}`) })
    .setTimestamp();

  await deferPrivateReply(interaction);
  const postMessage = await channel.send({
    content: `Para: <@${recipient.id}>`,
    embeds: [embed],
    allowedMentions: { users: [recipient.id] },
  });
  try {
    await recordTellonymPost({
      messageId: postMessage.id,
      guildId: interaction.guildId,
      channelId: channel.id,
      mode,
    });
    await postMessage.edit({ components: [tellonymPostButtons(postMessage.id)] });
  } catch (error) {
    try {
      await postMessage.delete();
    } catch (cleanupError) {
      console.error(`Não foi possível remover a publicação Tellonym incompleta ${postMessage.id}:`, cleanupError);
    }
    throw error;
  }
  tellonymCooldowns.set(cooldownKey, Date.now());
  await replyPrivate(interaction, `Sua mensagem foi publicada em <#${channel.id}>. Lembre-se: o modo anônimo oculta seu nome no post, mas não garante anonimato perante o Discord ou a administração do bot.`);
}

async function handleTellonymButton(interaction) {
  const [prefix, action, value, extra] = interaction.customId.split(':');
  if (prefix !== tellonymPrefix) return;

  if (action === 'comment' && /^\d{17,20}$/.test(value ?? '')) {
    const modal = new ModalBuilder()
      .setCustomId(`${tellonymPrefix}:comment-submit:${value}`)
      .setTitle('Comentar no Tellonym')
      .addComponents(
        new ActionRowBuilder().addComponents(
          new TextInputBuilder()
            .setCustomId('comment')
            .setLabel('Comentário público')
            .setStyle(TextInputStyle.Paragraph)
            .setMaxLength(500)
            .setRequired(true),
        ),
      );
    await interaction.showModal(modal);
    return;
  }

  const validAction = (
    (action === 'send' || action === 'view' || action === 'like')
      && /^\d{17,20}$/.test(value ?? '')
  ) || (
    action === 'mode'
      && ['anonymous', 'public'].includes(value)
      && /^\d{17,20}$/.test(extra ?? '')
  );
  if (!validAction) {
    await replyPrivate(interaction, 'Esta ação Tellonym não é válida.');
    return;
  }

  const updatesMessage = action === 'mode' || action === 'like';
  if (updatesMessage) await interaction.deferUpdate();
  else await deferPrivateReply(interaction);

  const config = await getBotConfig(interaction.guildId);
  if (!config.tellonymEnabled) {
    if (action === 'mode') {
      await interaction.editReply({ content: 'O sistema Tellonym está desativado neste servidor.', components: [] });
    } else if (action === 'like') {
      await interaction.followUp({ content: 'O sistema Tellonym está desativado neste servidor.', flags: MessageFlags.Ephemeral });
    } else {
      await replyPrivate(interaction, 'O sistema Tellonym está desativado neste servidor.');
    }
    return;
  }

  if (action === 'send') {
    await interaction.editReply({
      content: [
        '**[ T E L L O N Y M ]**',
        '',
        'Escolha como deseja enviar sua mensagem:',
        '',
        '**Modo anônimo** — seu nome não aparece na publicação.',
        '**Modo público** — seu nome e avatar aparecem na publicação.',
      ].join('\n'),
      components: [tellonymModeButtons(value, config)],
      allowedMentions: { parse: [] },
    });
    return;
  }

  if (action === 'mode') {
    if ((value === 'anonymous' && !config.tellonymAllowAnonymousMode)
        || (value === 'public' && !config.tellonymAllowPublicMode)) {
      await interaction.editReply({ content: 'Esse modo de envio está desativado neste servidor.', components: [] });
      return;
    }
    const recipientMenu = new UserSelectMenuBuilder()
      .setCustomId(`${tellonymPrefix}:recipient:${value}:${extra}`)
      .setPlaceholder('Escolha quem vai receber a mensagem')
      .setMinValues(1)
      .setMaxValues(1);
    await interaction.editReply({
      content: 'Escolha o destinatário da mensagem. Depois, escreva o texto no formulário privado.',
      components: [new ActionRowBuilder().addComponents(recipientMenu)],
    });
    return;
  }

  if (action === 'like' && /^\d{17,20}$/.test(value ?? '')) {
    const post = await getTellonymPost(value);
    if (!post || post.guildId !== interaction.guildId) {
      await interaction.followUp({ content: 'Esta publicação não está mais disponível.', flags: MessageFlags.Ephemeral });
      return;
    }
    const result = await toggleTellonymLike(value, interaction.user.id);
    if (!result) {
      await interaction.followUp({ content: 'Esta publicação não está mais disponível.', flags: MessageFlags.Ephemeral });
      return;
    }
    await interaction.editReply({ components: [tellonymPostButtons(value, result.count)] });
    return;
  }

  if (action === 'view' && /^\d{17,20}$/.test(value ?? '')) {
    const post = await getTellonymPost(value);
    if (!post || post.guildId !== interaction.guildId) {
      await replyPrivate(interaction, 'Esta publicação não está mais disponível.');
      return;
    }
    const comments = await getTellonymComments(value);
    if (!comments) {
      await replyPrivate(interaction, 'Esta publicação não está mais disponível.');
      return;
    }
    const recentComments = comments.slice(-6);
    const description = recentComments.length
      ? recentComments.map((comment, index) => (
        `**${index + 1}. ${safeText(comment.username, 64)}**\n> ${safeText(comment.text, 500).replace(/\n/g, '\n> ')}`
      )).join('\n\n')
      : 'Ainda não há comentários nesta publicação.';
    const embed = new EmbedBuilder()
      .setColor(configColor(config))
      .setTitle('💬 Comentários')
      .setDescription(description)
      .setFooter({ text: configFooter(config, `Mostrando ${recentComments.length} de ${comments.length} comentário(s)`) });
    await interaction.editReply({ embeds: [embed], allowedMentions: { parse: [] } });
  }
}

async function handleTellonymSelect(interaction) {
  const [, action, mode, channelId] = interaction.customId.split(':');
  if (action !== 'recipient'
      || !['anonymous', 'public'].includes(mode)
      || !/^\d{17,20}$/.test(channelId ?? '')) return;
  const recipientId = interaction.values[0];
  if (!/^\d{17,20}$/.test(recipientId ?? '') || !interaction.guild) {
    await interaction.reply({ content: 'Escolha um membro deste servidor.', flags: MessageFlags.Ephemeral });
    return;
  }
  if (recipientId === interaction.user.id) {
    await interaction.reply({ content: 'Escolha outra pessoa como destinatário.', flags: MessageFlags.Ephemeral });
    return;
  }
  await showTellonymSubmitModal(interaction, mode, channelId, recipientId);
}

async function handleTellonymModal(interaction) {
  const [, action, modeOrMessageId, channelId, recipientId] = interaction.customId.split(':');
  await deferPrivateReply(interaction);
  const config = await getBotConfig(interaction.guildId);
  if (!config.tellonymEnabled) {
    await replyPrivate(interaction, 'O sistema Tellonym está desativado neste servidor.');
    return;
  }
  if (action === 'submit'
      && ['anonymous', 'public'].includes(modeOrMessageId)
      && /^\d{17,20}$/.test(channelId ?? '')
      && /^\d{17,20}$/.test(recipientId ?? '')) {
    await publishTellonym(interaction, modeOrMessageId, channelId, recipientId);
    return;
  }

  if (action === 'comment-submit' && /^\d{17,20}$/.test(modeOrMessageId ?? '')) {
    const messageId = modeOrMessageId;
    const post = await getTellonymPost(messageId);
    if (!post || post.guildId !== interaction.guildId) {
      await replyPrivate(interaction, 'Esta publicação não está mais disponível.');
      return;
    }
    const text = safeText(interaction.fields.getTextInputValue('comment').trim(), 500);
    if (!text) {
      await replyPrivate(interaction, 'Escreva um comentário antes de enviar.');
      return;
    }
    const count = await addTellonymComment(messageId, {
      userId: interaction.user.id,
      username: interaction.user.globalName ?? interaction.user.username,
      text,
    });
    if (count === null) {
      await replyPrivate(interaction, 'Esta publicação não está mais disponível.');
      return;
    }
    await replyPrivate(interaction, 'Seu comentário público foi adicionado.');
  }
}

function instagramPostButtons(messageId, likes = 0) {
  return new ActionRowBuilder().addComponents(
    new ButtonBuilder()
      .setCustomId(`${instagramPrefix}:like:${messageId}`)
      .setLabel(`❤️ ${likes}`)
      .setStyle(ButtonStyle.Secondary),
    new ButtonBuilder()
      .setCustomId(`${instagramPrefix}:comment:${messageId}`)
      .setLabel('Comentar')
      .setEmoji('💬')
      .setStyle(ButtonStyle.Secondary),
    new ButtonBuilder()
      .setCustomId(`${instagramPrefix}:view:${messageId}`)
      .setLabel('Ver comentários')
      .setEmoji('👀')
      .setStyle(ButtonStyle.Secondary),
  );
}

function instagramImageType(attachment) {
  const contentType = attachment.contentType?.split(';', 1)[0].toLowerCase();
  const extension = path.extname(attachment.name ?? '').toLowerCase();
  const imageTypes = {
    'image/jpeg': 'jpg',
    'image/png': 'png',
    'image/webp': 'webp',
    'image/gif': 'gif',
  };
  const supportedExtension = {
    '.jpg': 'jpg',
    '.jpeg': 'jpg',
    '.png': 'png',
    '.webp': 'webp',
    '.gif': 'gif',
  };
  const fileExtension = imageTypes[contentType] ?? supportedExtension[extension];
  return fileExtension ? { contentType: `image/${fileExtension === 'jpg' ? 'jpeg' : fileExtension}`, fileExtension } : null;
}

async function handleInstagramPhotoMessage(message) {
  if (!message.guild
      || message.author.bot
      || message.webhookId
      || message.channel.type !== ChannelType.GuildText
      || instagramProcessing.has(message.id)) return;
  const config = await getBotConfig(message.guild.id);
  if (!config.instagramEnabled || message.channel.name !== config.instagramChannel) return;

  const attachments = [...message.attachments.values()];
  const imageAttachments = attachments
    .map((attachment) => ({ attachment, imageType: instagramImageType(attachment) }))
    .filter(({ imageType }) => imageType);
  if (imageAttachments.length === 0) return;
  if (!config.instagramAllowGif
      && imageAttachments.some(({ imageType }) => imageType.fileExtension === 'gif')) {
    await message.reply({
      content: 'GIFs estão desativados neste servidor. Sua mensagem original foi mantida.',
      allowedMentions: { parse: [] },
    });
    return;
  }
  if (imageAttachments.length !== attachments.length) {
    await message.reply({
      content: 'Para transformar a publicação, envie somente fotos JPG, PNG, WebP ou GIF. Sua mensagem original foi mantida.',
      allowedMentions: { parse: [] },
    });
    return;
  }
  if (imageAttachments.length > config.instagramMaxPhotos) {
    await message.reply({
      content: `Cada publicação pode ter no máximo ${config.instagramMaxPhotos} fotos. Sua mensagem original foi mantida.`,
      allowedMentions: { parse: [] },
    });
    return;
  }
  const totalBytes = imageAttachments.reduce((total, { attachment }) => total + attachment.size, 0);
  const maxImageBytes = config.instagramMaxImageMegabytes * 1024 * 1024;
  const maxTotalBytes = Math.min(
    config.instagramMaxPostMegabytes * 1024 * 1024,
    maxImageBytes * config.instagramMaxPhotos,
  );
  if (imageAttachments.some(({ attachment }) => attachment.size > maxImageBytes)
      || totalBytes > maxTotalBytes) {
    await message.reply({
      content: `As fotos excedem o limite de ${config.instagramMaxImageMegabytes} MiB por arquivo ou ${Math.floor(maxTotalBytes / (1024 * 1024))} MiB por publicação. Sua mensagem original foi mantida.`,
      allowedMentions: { parse: [] },
    });
    return;
  }

  instagramProcessing.add(message.id);
  let postMessage;
  let postRecorded = false;
  try {
    const botMember = await message.guild.members.fetchMe();
    const requiredPermissions = [
      PermissionFlagsBits.ViewChannel,
      PermissionFlagsBits.SendMessages,
      PermissionFlagsBits.ManageMessages,
      PermissionFlagsBits.AttachFiles,
      PermissionFlagsBits.EmbedLinks,
    ];
    if (!message.channel.permissionsFor(botMember)?.has(requiredPermissions)) {
      await message.reply({
        content: 'Não consigo transformar esta foto: preciso de Ver canal, Enviar mensagens, Gerenciar mensagens, Anexar arquivos e Incorporar links neste canal.',
        allowedMentions: { parse: [] },
      });
      return;
    }

    const images = await Promise.all(imageAttachments.map(async ({ attachment, imageType }, index) => {
      if (attachment.size <= 0) throw new Error(`A imagem ${attachment.name} está vazia.`);
      const filename = `instagram-${message.id}-${index + 1}.${imageType.fileExtension}`;
      const buffer = await fetchDiscordAsset(attachment.url, filename, maxImageBytes);
      return { buffer, filename };
    }));
    const username = message.member?.displayName ?? message.author.globalName ?? message.author.username;
    const caption = safeText(message.content.trim(), config.instagramCaptionMaxLength);
    const embeds = images.map(({ filename }, index) => {
      const embed = new EmbedBuilder()
        .setColor(configColor(config))
        .setImage(`attachment://${filename}`);
      if (index === 0) {
        embed.setAuthor({ name: username, iconURL: message.author.displayAvatarURL() })
          .setFooter({ text: configFooter(config, 'Instagram') })
          .setTimestamp(message.createdAt);
        if (caption) embed.setDescription(caption);
      }
      return embed;
    });

    postMessage = await message.channel.send({
      embeds,
      files: images.map(({ buffer, filename }) => ({ attachment: buffer, name: filename })),
      allowedMentions: { parse: [] },
    });
    await recordInstagramPost({
      messageId: postMessage.id,
      guildId: message.guild.id,
      channelId: message.channel.id,
    });
    postRecorded = true;
    await postMessage.edit({ components: [instagramPostButtons(postMessage.id)] });
    if (config.instagramDeleteOriginal) await message.delete();
  } catch (error) {
    if (postRecorded && postMessage) {
      try {
        await deleteInstagramPost(postMessage.id);
      } catch (cleanupError) {
        console.error(`Não foi possível remover os dados da publicação Instagram incompleta ${postMessage.id}:`, cleanupError);
      }
    }
    if (postMessage) {
      try {
        await postMessage.delete();
      } catch (cleanupError) {
        console.error(`Não foi possível remover a publicação Instagram incompleta ${postMessage.id}:`, cleanupError);
      }
    }
    throw error;
  } finally {
    instagramProcessing.delete(message.id);
  }
}

async function handleInstagramInteraction(interaction) {
  const [, action, messageId] = interaction.customId.split(':');
  if (!/^\d{17,20}$/.test(messageId ?? '')) {
    await interaction.reply({ content: 'Esta publicação do Instagram não é válida.', flags: MessageFlags.Ephemeral });
    return;
  }

  if (action === 'comment') {
    const modal = new ModalBuilder()
      .setCustomId(`${instagramPrefix}:comment-submit:${messageId}`)
      .setTitle('Comentar na foto')
      .addComponents(
        new ActionRowBuilder().addComponents(
          new TextInputBuilder()
            .setCustomId('comment')
            .setLabel('Comentário público')
            .setStyle(TextInputStyle.Paragraph)
            .setMaxLength(500)
            .setRequired(true),
        ),
      );
    await interaction.showModal(modal);
    return;
  }

  if (!['like', 'view'].includes(action)) {
    await replyPrivate(interaction, 'Esta ação do Instagram não é válida.');
    return;
  }
  if (action === 'like') await interaction.deferUpdate();
  else await deferPrivateReply(interaction);

  const config = await getBotConfig(interaction.guildId);
  if (!config.instagramEnabled) {
    if (action === 'like') {
      await interaction.followUp({ content: 'O sistema Instagram está desativado neste servidor.', flags: MessageFlags.Ephemeral });
    } else {
      await replyPrivate(interaction, 'O sistema Instagram está desativado neste servidor.');
    }
    return;
  }
  const post = await getInstagramPost(messageId);
  if (!post || post.guildId !== interaction.guildId) {
    if (action === 'like') {
      await interaction.followUp({ content: 'Esta publicação do Instagram não está mais disponível.', flags: MessageFlags.Ephemeral });
    } else {
      await replyPrivate(interaction, 'Esta publicação do Instagram não está mais disponível.');
    }
    return;
  }

  if (action === 'like') {
    const result = await toggleInstagramLike(messageId, interaction.user.id);
    if (!result) {
      await interaction.followUp({ content: 'Esta publicação do Instagram não está mais disponível.', flags: MessageFlags.Ephemeral });
      return;
    }
    await interaction.editReply({ components: [instagramPostButtons(messageId, result.count)] });
    return;
  }

  if (action === 'view') {
    const comments = await getInstagramComments(messageId);
    if (!comments) {
      await replyPrivate(interaction, 'Esta publicação do Instagram não está mais disponível.');
      return;
    }
    const recentComments = comments.slice(-6);
    const description = recentComments.length
      ? recentComments.map((comment, index) => (
        `**${index + 1}. ${safeText(comment.username, 64)}**\n> ${safeText(comment.text, 500).replace(/\n/g, '\n> ')}`
      )).join('\n\n')
      : 'Ainda não há comentários nesta foto.';
    const embed = new EmbedBuilder()
      .setColor(configColor(config))
      .setTitle('💬 Comentários da foto')
      .setDescription(description)
      .setFooter({ text: configFooter(config, `Mostrando ${recentComments.length} de ${comments.length} comentário(s)`) });
    await interaction.editReply({ embeds: [embed], allowedMentions: { parse: [] } });
  }
}

async function handleInstagramModal(interaction) {
  const [, action, messageId] = interaction.customId.split(':');
  if (action !== 'comment-submit' || !/^\d{17,20}$/.test(messageId ?? '')) return;
  await deferPrivateReply(interaction);
  const config = await getBotConfig(interaction.guildId);
  if (!config.instagramEnabled) {
    await replyPrivate(interaction, 'O sistema Instagram está desativado neste servidor.');
    return;
  }
  const post = await getInstagramPost(messageId);
  if (!post || post.guildId !== interaction.guildId) {
    await replyPrivate(interaction, 'Esta publicação do Instagram não está mais disponível.');
    return;
  }
  const text = safeText(interaction.fields.getTextInputValue('comment').trim(), 500);
  if (!text) {
    await replyPrivate(interaction, 'Escreva um comentário antes de enviar.');
    return;
  }
  const count = await addInstagramComment(messageId, {
    userId: interaction.user.id,
    username: interaction.user.globalName ?? interaction.user.username,
    text,
  });
  if (count === null) {
    await replyPrivate(interaction, 'Esta publicação do Instagram não está mais disponível.');
    return;
  }
  await replyPrivate(interaction, 'Seu comentário público foi adicionado.');
}

async function handleTicketButton(interaction) {
  if (interaction.customId.startsWith(`${ticketOpenButtonPrefix}:`)) {
    await deferPrivateReply(interaction);
    const supportRoleId = interaction.customId.slice(`${ticketOpenButtonPrefix}:`.length);
    if (supportRoleId !== 'none' && !/^\d{17,20}$/.test(supportRoleId)) {
      await replyPrivate(interaction, 'A configuração do cargo de suporte deste painel é inválida. Peça à administração para atualizar o painel.');
      return;
    }
    await createTicket(interaction, { supportRoleId });
    return;
  }

  if (interaction.customId === ticketCloseButtonId) {
    const channel = interaction.channel;
    if (!channel || channel.type !== ChannelType.GuildText || !interaction.guild) {
      await interaction.reply({ content: 'Este botão só pode ser usado dentro de um canal de ticket.', flags: MessageFlags.Ephemeral });
      return;
    }
    const ticket = parseOpenTicketTopic(channel.topic);
    if (!ticket) {
      await interaction.reply({ content: 'Este canal não é um ticket aberto válido.', flags: MessageFlags.Ephemeral });
      return;
    }
    await deferPrivateReply(interaction);
    const config = await getBotConfig(interaction.guildId);
    if (!config.ticketsEnabled) {
      await replyPrivate(interaction, 'O sistema de tickets está desativado neste servidor.');
      return;
    }

    if (ticket.assigneeId === 'none') {
      await replyPrivate(interaction, 'Uma pessoa da equipe precisa enviar uma mensagem no ticket para assumi-lo antes do fechamento.');
      return;
    }
    if (ticket.assigneeId !== interaction.user.id) {
      await interaction.editReply({
        content: `Somente quem assumiu este ticket, <@${ticket.assigneeId}>, pode fechá-lo.`,
        allowedMentions: { users: ticket.assigneeId !== 'none' ? [ticket.assigneeId] : [] },
      });
      return;
    }

    const row = new ActionRowBuilder().addComponents(
      new ButtonBuilder()
        .setCustomId(ticketCloseConfirmButtonId)
        .setLabel('Confirmar fechamento')
        .setStyle(ButtonStyle.Danger),
      new ButtonBuilder()
        .setCustomId(ticketCloseCancelButtonId)
        .setLabel('Cancelar')
        .setStyle(ButtonStyle.Secondary),
    );
    await interaction.editReply({
      content: `Tem certeza de que deseja fechar este ticket? O transcript será enviado para #${config.ticketTranscriptChannel} e, em seguida, o canal será excluído.`,
      components: [row],
      allowedMentions: { parse: [] },
    });
  }
}

async function handleInteraction(interaction) {
  if (interaction.isButton() && interaction.customId.startsWith(`${rankManagementPrefix}:`)) {
    await handleRankButton(interaction);
    return;
  }
  if (interaction.isUserSelectMenu() && interaction.customId.startsWith(`${rankManagementPrefix}:`)) {
    await handleRankMemberSelect(interaction);
    return;
  }
  if (interaction.isRoleSelectMenu() && interaction.customId.startsWith(`${rankManagementPrefix}:`)) {
    await handleRankRoleSelect(interaction);
    return;
  }
  if (interaction.isStringSelectMenu() && interaction.customId === `${botConfigPrefix}:category`) {
    await showBotConfigModal(interaction);
    return;
  }
  if (interaction.isModalSubmit() && interaction.customId.startsWith(`${botConfigPrefix}:save:`)) {
    await saveBotConfigModal(interaction);
    return;
  }
  if (interaction.isButton() && interaction.customId.startsWith(`${staffApplicationPrefix}:`)) {
    if (interaction.customId === `${staffApplicationPrefix}:apply`) {
      await showStaffApplicationModal(interaction);
    } else {
      await handleStaffReviewButton(interaction);
    }
    return;
  }
  if (interaction.isModalSubmit() && interaction.customId.startsWith(`${staffApplicationPrefix}:submit:`)) {
    if (interaction.customId === `${staffApplicationPrefix}:submit:all`) {
      await handleStaffApplicationSubmission(interaction);
    } else {
      await replyPrivate(interaction, 'Este formulário foi atualizado. Abra o painel novamente para se candidatar.');
    }
    return;
  }
  if (interaction.isButton() && interaction.customId.startsWith(`${tellonymPrefix}:`)) {
    await handleTellonymButton(interaction);
    return;
  }
  if (interaction.isButton() && interaction.customId.startsWith(`${instagramPrefix}:`)) {
    await handleInstagramInteraction(interaction);
    return;
  }
  if (interaction.isButton() && interaction.customId.startsWith(`${staffFeedbackPrefix}:rate:`)) {
    await handleStaffFeedbackRating(interaction);
    return;
  }
  if (interaction.isModalSubmit() && interaction.customId.startsWith(`${staffFeedbackPrefix}:submit:`)) {
    await handleStaffFeedbackSubmission(interaction);
    return;
  }
  if (interaction.isUserSelectMenu() && interaction.customId.startsWith(`${tellonymPrefix}:`)) {
    await handleTellonymSelect(interaction);
    return;
  }
  if (interaction.isModalSubmit() && interaction.customId.startsWith(`${tellonymPrefix}:`)) {
    await handleTellonymModal(interaction);
    return;
  }
  if (interaction.isModalSubmit() && interaction.customId.startsWith(`${instagramPrefix}:`)) {
    await handleInstagramModal(interaction);
    return;
  }
  if (interaction.isButton() && interaction.customId === ticketCloseConfirmButtonId) {
    await handleTicketCloseConfirmation(interaction);
    return;
  }
  if (interaction.isButton() && interaction.customId === ticketCloseCancelButtonId) {
    await interaction.update({ content: 'Fechamento cancelado; o ticket continua aberto.', components: [] });
    return;
  }
  if (interaction.isStringSelectMenu() && interaction.customId.startsWith(`${ticketCategoryMenuId}:`)) {
    if (!interaction.inGuild() || !interaction.guild) {
      await interaction.reply({ content: 'Tickets só podem ser abertos dentro de um servidor.', flags: MessageFlags.Ephemeral });
      return;
    }
    const supportRoleId = interaction.customId.slice(`${ticketCategoryMenuId}:`.length);
    if (supportRoleId !== 'none' && !/^\d{17,20}$/.test(supportRoleId)) {
      await interaction.reply({ content: 'A configuração do cargo de suporte deste painel é inválida.', flags: MessageFlags.Ephemeral });
      return;
    }
    const [categoryId, ticketType] = interaction.values[0]?.split(':') ?? [];
    if (!/^\d{17,20}$/.test(categoryId ?? '')
        || !['parceria', 'denuncia', 'duvida'].includes(ticketType)) {
      await interaction.reply({ content: 'A opção selecionada neste painel não é válida.', flags: MessageFlags.Ephemeral });
      return;
    }
    await deferPrivateReply(interaction);
    await createTicket(interaction, { supportRoleId, categoryId, ticketType });
    return;
  }
  if (interaction.isButton()) {
    if (interaction.customId.startsWith(`${ticketOpenButtonPrefix}:`) || interaction.customId === ticketCloseButtonId) {
      await handleTicketButton(interaction);
    }
    return;
  }
  if (!interaction.isChatInputCommand()) return;
  const command = interaction.commandName;
  if (command === 'configurar-bot') {
    const category = interaction.options.getString('categoria');
    if (category) {
      await showBotConfigModal(interaction, category);
    } else {
      await deferPrivateReply(interaction);
      await showBotConfigPanel(interaction);
    }
    return;
  }
  if (command === 'painel-upamento') {
    await deferPrivateReply(interaction);
    await handleRankPanelCommand(interaction);
    return;
  }
  await deferPrivateReply(interaction);
  const commandConfig = interaction.guildId
    ? await getBotConfig(interaction.guildId)
    : botConfigDefaults;
  if (interaction.guildId
      && !['ajuda', 'configurar-bot', 'admin-grant', 'admin-revoke', 'admin-list'].includes(command)
      && interaction.user.id !== ownerId
      && commandConfig.commandCooldownSeconds > 0) {
    const cooldownKey = `${interaction.guildId}:${interaction.user.id}`;
    const previous = commandCooldowns.get(cooldownKey) ?? 0;
    const remaining = previous + commandConfig.commandCooldownSeconds * 1000 - Date.now();
    if (remaining > 0) {
      await replyPrivate(interaction, `Aguarde ${Math.ceil(remaining / 1000)} segundo(s) antes de usar outro comando.`);
      return;
    }
    commandCooldowns.set(cooldownKey, Date.now());
  }

  if (command === 'ajuda') {
    const helpConfig = commandConfig;
    await replyPrivate(interaction, [
      '**ALTA BOT — comandos**',
      helpConfig.antiSpamEnabled
        ? `Anti-spam: ${helpConfig.antiSpamMessageCount} mensagens em ${helpConfig.antiSpamWindowSeconds} segundos geram aviso; reincidência em ${helpConfig.antiSpamRepeatWindowMinutes} minutos pode resultar em expulsão.`
        : 'Anti-spam: desativado neste servidor.',
      helpConfig.antiRaidEnabled
        ? 'Anti-raid: bots não autorizados podem ser expulsos e os cargos de quem os adicionou removidos.'
        : 'Anti-raid: desativado neste servidor.',
      '`/ban`, `/kick`, `/timeout`, `/untimeout`, `/clear`: moderação com permissões nativas e hierarquia de cargos.',
      '`/dm`: DM individual, com intervalo por operador.',
      '`/announce`: aviso em um canal, com menções desativadas.',
      '`/set-log`: define o canal de auditoria.',
      '`/painel-ticket`: publica ou personaliza o painel com opções para parceria, denúncia e dúvida; cada opção cria ticket na própria categoria.',
      '`/painel-tellonym`: publica o painel de mensagens anônimas, com modos anônimo/público, curtidas e comentários.',
      '`/painel-candidatura`: publica o painel para candidaturas de Staff; são 10 perguntas em um único formulário, com notificações à equipe e aprovação que atribui o cargo configurado.',
      '`/painel-upamento`: publica um painel privado de upamentos/rebaixamentos; alterações exigem Gerenciar cargos e são registradas nos canais correspondentes.',
      '`/configurar-bot`: painel exclusivo do dono, incluindo a opção de abrir ou fechar as candidaturas de Staff.',
      `Administradores do servidor podem usar o bot: ${helpConfig.serverAdminAccess ? 'sim' : 'não'} (opção configurável somente pelo dono).`,
      helpConfig.instagramEnabled
        ? `Instagram: envie fotos JPG, PNG, WebP ou GIF em **${helpConfig.instagramChannel}** para criar uma publicação com curtidas e comentários.`
        : 'Instagram: desativado neste servidor.',
      '`/export-assets`: ZIP dos emojis e figurinhas deste servidor ou de outro onde o bot esteja instalado; para outro servidor, informe o ID.',
      '`/import-sticker`: instala uma figurinha por URL direta da CDN do Discord neste servidor; exige Manage Expressions.',
      '`/copy-sticker`: copia uma figurinha de outro servidor onde você e o bot sejam membros; você não precisa de permissão especial no servidor de origem.',
      '`/admin-grant`, `/admin-revoke`, `/admin-list`: administração do bot, exclusiva do dono.',
      '`/restart`: reinicia o processo do bot; somente dono ou administrador autorizado.',
      'O bot precisa estar instalado no servidor escolhido, e você precisa ter Manage Expressions nele. Um link de convite sozinho não dá acesso aos assets.',
    ].join('\n'));
    return;
  }

  if (command === 'admin-grant' || command === 'admin-revoke' || command === 'admin-list') {
    if (!(await requireOwner(interaction))) return;
    if (command === 'admin-list') {
      const ids = await getAuthorizedUserIds();
      await replyPrivate(interaction, ids.length
        ? ids.map((id) => `<@${id}> — \`${id}\``).join('\n')
        : 'Nenhum administrador adicional foi autorizado.');
      return;
    }
    const user = interaction.options.getUser('usuario', true);
    if (user.id === ownerId) {
      await replyPrivate(interaction, 'O dono já possui acesso permanente.');
      return;
    }
    const ids = command === 'admin-grant' ? await grantUser(user.id) : await revokeUser(user.id);
    await replyPrivate(interaction, `${user.tag} (${user.id}) foi ${command === 'admin-grant' ? 'autorizado' : 'removido'}. Total de administradores adicionais: ${ids.length}.`);
    return;
  }

  if (command === 'painel-ticket') {
    if (!(await requireGuild(interaction))) return;
    await handleTicketPanelCommand(interaction);
    return;
  }
  if (command === 'painel-tellonym') {
    if (!(await requireGuild(interaction))) return;
    await handleTellonymPanelCommand(interaction);
    return;
  }
  if (command === 'painel-candidatura') {
    if (!(await requireGuild(interaction))) return;
    await handleStaffApplicationPanelCommand(interaction);
    return;
  }
  if (!(await requireGuild(interaction)) || !(await requireBotAdmin(interaction))) return;
  if (command === 'restart') {
    await deferPrivateReply(interaction);
    try {
      await interaction.editReply('Reiniciando o bot agora.');
    } catch (error) {
      console.error('Não foi possível confirmar o reinício no Discord:', error);
    }
    client.destroy();
    process.exit(75);
  }

  if (command === 'import-sticker') {
    if (!(await requireGuildPermission(interaction, PermissionFlagsBits.ManageGuildExpressions, 'Manage Expressions'))) return;
    const guild = interaction.guild;
    const stickerConfig = await getBotConfig(guild.id);
    const botMember = await guild.members.fetchMe();
    if (!botMember.permissions.has(PermissionFlagsBits.ManageGuildExpressions)) {
      await replyPrivate(interaction, 'O bot precisa da permissão “Manage Expressions” neste servidor para instalar figurinhas.');
      return;
    }

    const url = interaction.options.getString('url', true).trim();
    const name = interaction.options.getString('nome', true).trim();
    const tags = interaction.options.getString('tag', true).trim();
    const description = interaction.options.getString('descricao')?.trim() ?? '';
    const stickerCooldownKey = `${interaction.guildId}:${interaction.user.id}`;
    const stickerRemaining = (stickerCopyCooldowns.get(stickerCooldownKey) ?? 0)
      + stickerConfig.stickerCooldownSeconds * 1000 - Date.now();
    if (stickerRemaining > 0) {
      await replyPrivate(interaction, `Aguarde ${Math.ceil(stickerRemaining / 1000)} segundo(s) antes de instalar outra figurinha.`);
      return;
    }
    let extension;
    try {
      const parsed = new URL(url);
      if (parsed.protocol !== 'https:' || !['cdn.discordapp.com', 'media.discordapp.net'].includes(parsed.hostname)) {
        await replyPrivate(interaction, 'Use uma URL HTTPS direta de cdn.discordapp.com ou media.discordapp.net.');
        return;
      }
      extension = stickerExtensionFromUrl(url);
    } catch (error) {
      if (error instanceof TypeError) {
        await replyPrivate(interaction, 'A URL informada não é válida.');
        return;
      }
      await replyPrivate(interaction, error.message);
      return;
    }

    await deferPrivateReply(interaction);
    try {
      const file = await fetchDiscordAsset(url, `sticker.${extension}`, maxStickerUploadBytes);
      const sticker = await guild.stickers.create({
        file: { attachment: file, name: `sticker.${extension}` },
        name,
        tags,
        description,
        reason: `Importada por ${interaction.user.tag} (${interaction.user.id}) via /import-sticker`,
      });
      stickerCopyCooldowns.set(stickerCooldownKey, Date.now());
      await interaction.editReply(`Figurinha **${safeText(sticker.name, 30)}** instalada neste servidor.`);
    } catch (error) {
      console.error('Falha ao importar figurinha:', error);
      await interaction.editReply(`Não consegui instalar a figurinha: ${safeText(error.message || 'erro desconhecido', 300)}`);
    }
    return;
  }

  if (command === 'copy-sticker') {
    const sourceGuildId = interaction.options.getString('servidor-origem', true).trim();
    const stickerId = interaction.options.getString('figurinha', true).trim();
    if (!/^\d{17,20}$/.test(sourceGuildId) || !/^\d{17,20}$/.test(stickerId)) {
      await replyPrivate(interaction, 'Informe IDs válidos de servidor e figurinha (17 a 20 dígitos).');
      return;
    }

    const cooldownKey = `${interaction.guildId}:${interaction.user.id}`;
    const previous = stickerCopyCooldowns.get(cooldownKey) ?? 0;
    const remaining = previous + commandConfig.stickerCooldownSeconds * 1000 - Date.now();
    if (remaining > 0) {
      await replyPrivate(interaction, `Aguarde ${Math.ceil(remaining / 1000)} segundo(s) antes de copiar outra figurinha.`);
      return;
    }

    await deferPrivateReply(interaction);
    let sourceGuild;
    try {
      sourceGuild = await client.guilds.fetch(sourceGuildId);
    } catch (error) {
      console.error(`Não foi possível acessar o servidor de origem ${sourceGuildId}:`, error);
      if (error.code === 10004 || error.code === 50001) {
        await replyPrivate(interaction, 'O Discord não permite buscar figurinhas apenas pelo ID de um servidor onde o bot não está. Para copiar sem o bot na origem, use /import-sticker com o link direto da figurinha da CDN (cdn.discordapp.com ou media.discordapp.net). Você não precisa de permissões na origem; o bot precisa de Manage Expressions no servidor atual.');
        return;
      }
      throw error;
    }

    let sourceMember;
    try {
      sourceMember = await sourceGuild.members.fetch(interaction.user.id);
    } catch (error) {
      if (error.code === 10007) {
        await replyPrivate(interaction, 'Você precisa ser membro do servidor de origem; nenhuma permissão especial é necessária.');
        return;
      }
      throw error;
    }
    if (!sourceMember) {
      await replyPrivate(interaction, 'Você precisa ser membro do servidor de origem; nenhuma permissão especial é necessária.');
      return;
    }

    const targetGuild = interaction.guild;
    const botMember = await targetGuild.members.fetchMe();
    if (!botMember.permissions.has(PermissionFlagsBits.CreateGuildExpressions)) {
      await replyPrivate(interaction, 'O bot precisa da permissão “Create Expressions” no servidor atual para instalar a cópia.');
      return;
    }

    let sourceSticker;
    try {
      sourceSticker = await sourceGuild.stickers.fetch(stickerId);
    } catch (error) {
      if (error.code === 10008) {
        await replyPrivate(interaction, 'Não encontrei essa figurinha no servidor de origem. Confira o ID.');
        return;
      }
      throw error;
    }

    const extension = stickerExtension(sourceSticker);
    const file = await fetchDiscordAsset(sourceSticker.url, `sticker.${extension}`, maxStickerUploadBytes);
    const copiedSticker = await targetGuild.stickers.create({
      file: { attachment: file, name: `sticker.${extension}` },
      name: sourceSticker.name,
      tags: sourceSticker.tags,
      description: sourceSticker.description ?? '',
      reason: `Copiada de ${sourceGuild.name} por ${interaction.user.tag} (${interaction.user.id})`,
    });
    stickerCopyCooldowns.set(cooldownKey, Date.now());
    await interaction.editReply(`Figurinha **${safeText(copiedSticker.name, 30)}** copiada para **${safeText(targetGuild.name, 100)}**. Você não precisou de permissão especial no servidor de origem.`);
    return;
  }

  if (['ban', 'kick', 'timeout', 'untimeout'].includes(command)) {
    await handleModeration(interaction, command);
    return;
  }

  if (command === 'clear') {
    if (!(await requireGuildPermission(interaction, PermissionFlagsBits.ManageMessages, 'Manage Messages'))) return;
    if (!interaction.channel?.isTextBased() || !interaction.channel.bulkDelete) {
      await replyPrivate(interaction, 'Este canal não oferece exclusão de mensagens em lote.');
      return;
    }
    await deferPrivateReply(interaction);
    const count = interaction.options.getInteger('quantidade', true);
    const deleted = await interaction.channel.bulkDelete(count, true);
    await replyWithAudit(interaction, `${deleted.size} mensagem(ns) removida(s). O Discord ignora mensagens com mais de 14 dias.`, 'Limpeza de mensagens', `Canal: <#${interaction.channelId}>\nQuantidade: ${deleted.size}`);
    return;
  }

  if (command === 'dm') {
    const previous = dmCooldowns.get(`${interaction.guildId}:${interaction.user.id}`) ?? 0;
    const remaining = previous + commandConfig.dmCooldownSeconds * 1000 - Date.now();
    if (remaining > 0) {
      await replyPrivate(interaction, `Aguarde ${Math.ceil(remaining / 1000)} segundo(s) antes de enviar outra DM pelo bot.`);
      return;
    }
    await deferPrivateReply(interaction);
    const user = interaction.options.getUser('usuario', true);
    if (!(await interaction.guild.members.fetch(user.id).catch(() => null))) {
      await replyPrivate(interaction, 'O destinatário precisa ser membro deste servidor.');
      return;
    }
    const message = safeText(interaction.options.getString('mensagem', true), 1500);
    await user.send({ content: message, allowedMentions: { parse: [] } });
    dmCooldowns.set(`${interaction.guildId}:${interaction.user.id}`, Date.now());
    await replyWithAudit(interaction, `DM individual enviada para ${user.tag}. O conteúdo não é copiado para o log.`, 'DM individual', `Destinatário: ${user.tag} (${user.id})`);
    return;
  }

  if (command === 'announce') {
    if (!(await requireGuildPermission(interaction, PermissionFlagsBits.ManageGuild, 'Manage Server'))) return;
    const channel = interaction.options.getChannel('canal', true);
    await deferPrivateReply(interaction);
    const botMember = await interaction.guild.members.fetchMe();
    if (channel.guildId !== interaction.guildId || !channel.isTextBased()
        || !channel.permissionsFor(botMember)?.has(PermissionFlagsBits.SendMessages)) {
      await replyPrivate(interaction, 'O bot não pode escrever nesse canal do servidor.');
      return;
    }
    const message = safeText(interaction.options.getString('mensagem', true), 1800);
    await channel.send({ content: message, allowedMentions: { parse: [] } });
    await replyWithAudit(interaction, `Aviso publicado em <#${channel.id}>.`, 'Aviso publicado', `Canal: <#${channel.id}>\nTexto: ${message}`);
    return;
  }

  if (command === 'set-log') {
    if (!(await requireGuildPermission(interaction, PermissionFlagsBits.ManageGuild, 'Manage Server'))) return;
    const channel = interaction.options.getChannel('canal', true);
    await deferPrivateReply(interaction);
    const botMember = await interaction.guild.members.fetchMe();
    if (channel.guildId !== interaction.guildId || !channel.isTextBased()
        || !channel.permissionsFor(botMember)?.has(PermissionFlagsBits.SendMessages)) {
      await replyPrivate(interaction, 'O bot não pode escrever nesse canal do servidor.');
      return;
    }
    await setLogChannelId(interaction.guildId, channel.id);
    await replyPrivate(interaction, `Canal de auditoria configurado: <#${channel.id}>.`);
    return;
  }

  if (command === 'export-assets') {
    const targetGuildId = interaction.options.getString('servidor')?.trim() || interaction.guildId;
    if (!/^\d{17,20}$/.test(targetGuildId)) {
      await replyPrivate(interaction, 'Informe um ID de servidor válido (17 a 20 dígitos).');
      return;
    }

    let targetGuild = interaction.guild;
    if (targetGuildId !== interaction.guildId) {
      try {
        targetGuild = await client.guilds.fetch(targetGuildId);
      } catch (error) {
        console.error(`Falha ao acessar o servidor ${targetGuildId} para exportação:`, error);
        if (error.code === 10004 || error.code === 50001) {
          await replyPrivate(interaction, 'Não consegui acessar esse servidor. Confira o ID e confirme que o bot está instalado nele. Você não precisa de permissões especiais, mas o bot precisa estar no servidor de origem.');
          return;
        }
        throw error;
      }
    }

    let targetMember;
    try {
      targetMember = await targetGuild.members.fetch(interaction.user.id);
    } catch (error) {
      if (error.code !== 10007) throw error;
    }
    if (!targetMember) {
      await replyPrivate(interaction, 'Você precisa ser membro do servidor escolhido para exportar os assets dele.');
      return;
    }

    const botMember = await targetGuild.members.fetchMe();
    if (!botMember.permissions.has(PermissionFlagsBits.ManageGuildExpressions)) {
      await replyPrivate(interaction, 'O bot precisa da permissão “Manage Expressions” no servidor de origem para listar e baixar as figurinhas. Você não precisa dessa permissão.');
      return;
    }

    const key = `${targetGuild.id}:${interaction.user.id}`;
    const previous = exportCooldowns.get(key) ?? 0;
    const exportConfig = targetGuild.id === interaction.guildId
      ? commandConfig
      : await getBotConfig(targetGuild.id);
    const remaining = previous + exportConfig.exportCooldownSeconds * 1000 - Date.now();
    if (remaining > 0) {
      await replyPrivate(interaction, `Aguarde ${Math.ceil(remaining / 1000)} segundo(s) antes de exportar novamente.`);
      return;
    }

    await deferPrivateReply(interaction);
    let result;
    try {
      result = await createGuildAssetsZip(targetGuild, {
        maxFileBytes: exportConfig.exportMaxFileMegabytes * 1024 * 1024,
        maxTotalBytes: exportConfig.exportMaxTotalMegabytes * 1024 * 1024,
      });
    } catch (error) {
      if (error.code === 50001 || error.code === 50013) {
        console.error(`O bot não tem acesso aos assets do servidor ${targetGuild.id}:`, error);
        await replyPrivate(interaction, 'O bot não tem acesso para listar os assets desse servidor. Confirme que ele tem “Manage Expressions” na origem. Você não precisa de permissões especiais lá.');
        return;
      }
      throw error;
    }
    try {
      await interaction.editReply({
        content: `ZIP de **${safeText(targetGuild.name, 100)}**: ${result.included} arquivo(s) incluído(s), ${result.skipped} ignorado(s). O arquivo inclui manifest.json.`,
        files: [{ attachment: result.path, name: path.basename(result.path) }],
      });
      exportCooldowns.set(key, Date.now());
    } finally {
      await rm(result.directory, { recursive: true, force: true });
    }
    return;
  }

  await replyPrivate(interaction, 'Comando não reconhecido.');
}

function schedulePermanentVoiceReconnect(connection) {
  if (permanentVoiceConnection !== connection || permanentVoiceReconnectTimer) return;
  permanentVoiceReconnectTimer = setTimeout(() => {
    permanentVoiceReconnectTimer = undefined;
    if (permanentVoiceConnection === connection) {
      permanentVoiceConnection = undefined;
      connection.destroy();
    }
    void connectToPermanentVoiceChannel();
  }, 15_000);
}

async function countChannelMessages(channel) {
  const botMember = await channel.guild.members.fetchMe();
  const requiredPermissions = [
    PermissionFlagsBits.ViewChannel,
    PermissionFlagsBits.ReadMessageHistory,
  ];
  if (!channel.permissionsFor(botMember)?.has(requiredPermissions)) {
    throw new Error(`O bot precisa de Ver canal e Ler histórico em #${channel.name}.`);
  }

  let count = 0;
  let before;
  while (true) {
    const messages = await channel.messages.fetch({ limit: 100, ...(before ? { before } : {}) });
    count += messages.size;
    if (messages.size < 100) return count;
    before = messages.last().id;
  }
}

async function loadServerStatusPresences(guild) {
  const now = Date.now();
  if (now - serverStatusLastPresenceFetchAt < 5 * 60_000) return;
  serverStatusLastPresenceFetchAt = now;
  try {
    await guild.members.fetch({ withPresences: true });
    serverStatusPresenceAvailable = true;
  } catch (error) {
    serverStatusPresenceAvailable = false;
    console.error(`Não consegui carregar as presenças dos membros em ${guild.name}:`, error);
  }
}

function getOnlineStaffCount(guild) {
  const role = guild.roles.cache.get(serverStatusStaffRoleId);
  if (!role) return 'Cargo não encontrado';
  if (!serverStatusPresenceAvailable) return 'Presenças indisponíveis';
  return role.members
    .filter((member) => !member.user.bot && member.presence?.status && member.presence.status !== 'offline')
    .size
    .toLocaleString('pt-BR');
}

async function refreshServerStatusPanel() {
  if (!serverStatusInitialized || !client.user) return;
  if (serverStatusRefreshInFlight) return serverStatusRefreshInFlight;
  serverStatusRefreshInFlight = (async () => {
    const guild = await client.guilds.fetch(serverStatusGuildId);
    await loadServerStatusPresences(guild);
    const channel = await guild.channels.fetch(serverStatusChannelId);
    if (!channel || channel.type !== ChannelType.GuildText || channel.guildId !== guild.id) {
      throw new Error(`O canal de status (${serverStatusChannelId}) não foi encontrado.`);
    }

    const botMember = await guild.members.fetchMe();
    const requiredPermissions = [
      PermissionFlagsBits.ViewChannel,
      PermissionFlagsBits.ReadMessageHistory,
      PermissionFlagsBits.SendMessages,
      PermissionFlagsBits.EmbedLinks,
    ];
    if (!channel.permissionsFor(botMember)?.has(requiredPermissions)) {
      throw new Error(`O bot precisa de Ver canal, Ler histórico, Enviar mensagens e Incorporar links em #${channel.name}.`);
    }

    const status = await getServerStatusState(guild.id);
    const updatedAt = new Intl.DateTimeFormat('pt-BR', {
      timeZone: 'America/Sao_Paulo',
      hour: '2-digit',
      minute: '2-digit',
      hourCycle: 'h23',
    }).format(new Date());
    if (!status.inviteUrl) {
      throw new Error('O convite permanente do painel de status ainda não foi configurado.');
    }
    const embed = new EmbedBuilder()
      .setColor(0xE50914)
      .setTitle(`Status do Servidor → ${guild.name}`)
      .addFields(
        {
          name: '┃ Players:',
          value: `\`\`\`\n🎮  ${guild.memberCount.toLocaleString('pt-BR')}\n\`\`\``,
          inline: true,
        },
        {
          name: '┃ Status:',
          value: `\`\`\`\n${serverStatusBotOnline ? '🟢' : '🔴'}  ${serverStatusBotOnline ? 'Online' : 'Offline'}\n\`\`\``,
          inline: true,
        },
        {
          name: '┃ Staffs Online:',
          value: `\`\`\`\n👮  ${getOnlineStaffCount(guild)}\n\`\`\``,
          inline: true,
        },
        {
          name: '┃ Visitas:',
          value: `\`\`\`\n📥 Entradas:  ${status.entries.toLocaleString('pt-BR')}\n📤 Saídas:  ${status.exits.toLocaleString('pt-BR')}\n\`\`\``,
          inline: false,
        },
      )
      .setImage('attachment://server-status.gif')
      .setFooter({ text: `Última atualização ${updatedAt}` })
      .setTimestamp();
    const components = [new ActionRowBuilder().addComponents(
      new ButtonBuilder()
        .setLabel('Compartilhar agora')
        .setEmoji('🔗')
        .setStyle(ButtonStyle.Link)
        .setURL(status.inviteUrl),
    )];
    const payload = {
      content: '**Abaixo estão algumas informações sobre nosso servidor atualizadas em tempo real.**',
      embeds: [embed],
      components,
      files: [{ attachment: serverStatusGifPath, name: 'server-status.gif' }],
      allowedMentions: { parse: [] },
    };

    let panelMessage = null;
    if (status.panelMessageId) {
      try {
        panelMessage = await channel.messages.fetch(status.panelMessageId);
      } catch (error) {
        if (error.code !== 10008) throw error;
        await setServerStatusState(guild.id, { panelMessageId: null });
      }
    }
    if (!panelMessage) {
      const recentMessages = await channel.messages.fetch({ limit: 100 });
      panelMessage = recentMessages.find((message) => (
        message.author.id === client.user.id
        && (message.embeds.some((messageEmbed) => (
          messageEmbed.title?.startsWith('Status do Servidor →')
        )) || message.components.some((component) => (
          component.content?.startsWith('### Status do Servidor →')
          || component.components?.some((child) => (
            child.content?.startsWith('### Status do Servidor →')
          ))
        )))
      )) ?? null;
    }
    const replaceLegacyPanel = panelMessage?.flags.has(MessageFlags.IsComponentsV2);
    if (!panelMessage || replaceLegacyPanel) {
      const previousPanel = panelMessage;
      panelMessage = await channel.send(payload);
      await setServerStatusState(guild.id, { panelMessageId: panelMessage.id });
      if (previousPanel) {
        await previousPanel.delete('Substituindo painel Components V2 para corrigir o GIF');
      }
    } else {
      await panelMessage.edit(payload);
      if (panelMessage.id !== status.panelMessageId) {
        await setServerStatusState(guild.id, { panelMessageId: panelMessage.id });
      }
    }
  })();
  try {
    await serverStatusRefreshInFlight;
  } finally {
    serverStatusRefreshInFlight = undefined;
  }
}

function scheduleServerStatusRefresh() {
  if (!serverStatusInitialized || serverStatusRefreshTimer) return;
  serverStatusRefreshTimer = setTimeout(() => {
    serverStatusRefreshTimer = undefined;
    void refreshServerStatusPanel().catch((error) => {
      console.error('Falha ao atualizar o painel de status do servidor:', error);
    });
  }, 2_000);
}

function recordServerVisit(guildId, kind) {
  if (guildId !== serverStatusGuildId) return;
  if (!serverStatusInitialized) {
    if (kind === 'entries') serverStatusPendingEntries += 1;
    else serverStatusPendingExits += 1;
    return;
  }
  void incrementServerVisit(guildId, kind)
    .then(scheduleServerStatusRefresh)
    .catch((error) => {
      console.error(`Falha ao registrar ${kind === 'entries' ? 'uma entrada' : 'uma saída'} no painel de status:`, error);
    });
}

async function ensureServerStatusInvite(guild, existingInviteUrl) {
    if (existingInviteUrl) {
      const inviteCode = existingInviteUrl.split('/').pop();
      try {
        const invite = await client.fetchInvite(inviteCode);
        if (invite.guildId === guild.id) return existingInviteUrl;
      } catch (error) {
        if (error.code !== 10006) throw error;
      }
    }

    const channel = await guild.channels.fetch(serverStatusChannelId);
    if (!channel || channel.type !== ChannelType.GuildText || channel.guildId !== guild.id) {
      throw new Error(`O canal de status (${serverStatusChannelId}) não foi encontrado para criar o convite.`);
    }
    const botMember = await guild.members.fetchMe();
    if (!channel.permissionsFor(botMember)?.has(PermissionFlagsBits.CreateInstantInvite)) {
      throw new Error(`O bot precisa de Criar convite em #${channel.name} para ativar Compartilhar agora.`);
    }

    const invite = await channel.createInvite({
      maxAge: 0,
      maxUses: 0,
      unique: true,
      reason: 'Convite permanente do botão Compartilhar agora no painel de status.',
    });
    await setServerStatusState(guild.id, { inviteUrl: invite.url });
    return invite.url;
}

async function initializeServerStatusPanel() {
    const guild = await client.guilds.fetch(serverStatusGuildId);
    const state = await getServerStatusState(guild.id);
  let entries = state.entries;
  let exits = state.exits;
  try {
    const [entryChannel, exitChannel] = await Promise.all([
      guild.channels.fetch(serverEntryChannelId),
      guild.channels.fetch(serverExitChannelId),
    ]);
    if (!entryChannel || entryChannel.type !== ChannelType.GuildText
        || !exitChannel || exitChannel.type !== ChannelType.GuildText) {
      throw new Error('Os canais de entrada ou saída não foram encontrados.');
    }
    [entries, exits] = await Promise.all([
      countChannelMessages(entryChannel),
      countChannelMessages(exitChannel),
    ]);
  } catch (error) {
    console.error(`Falha ao sincronizar visitas pelos canais de entrada e saída; mantendo os totais salvos:`, error);
  }

  entries += serverStatusPendingEntries;
  exits += serverStatusPendingExits;
  serverStatusPendingEntries = 0;
  serverStatusPendingExits = 0;
  await setServerStatusState(guild.id, { entries, exits });
  const inviteUrl = await ensureServerStatusInvite(guild, state.inviteUrl);
  serverStatusInitialized = true;
  await loadServerStatusPresences(guild);
  const staffRole = await guild.roles.fetch(serverStatusStaffRoleId);
  if (!staffRole) {
    console.error(`O cargo de Staffs Online não existe no servidor: ${serverStatusStaffRoleId}`);
  }
  await refreshServerStatusPanel();
  console.log(`Painel de status atualizado em #${(await guild.channels.fetch(serverStatusChannelId)).name}. Entradas: ${entries}; saídas: ${exits}.`);
  setInterval(() => scheduleServerStatusRefresh(), 60_000).unref();
}

async function connectToPermanentVoiceChannel() {
  try {
    const guild = await client.guilds.fetch(permanentVoiceGuildId);
    const channel = await guild.channels.fetch(permanentVoiceChannelId);
    if (!channel || channel.type !== ChannelType.GuildVoice || channel.guildId !== guild.id) {
      throw new Error(`O canal de voz configurado (${permanentVoiceChannelId}) não foi encontrado.`);
    }

    const botMember = await guild.members.fetchMe();
    if (!channel.permissionsFor(botMember)?.has(PermissionFlagsBits.Connect)) {
      throw new Error(`O bot não tem permissão para entrar em ${channel.name}.`);
    }

    const connection = joinVoiceChannel({
      channelId: channel.id,
      guildId: guild.id,
      adapterCreator: guild.voiceAdapterCreator,
      selfDeaf: true,
      selfMute: true,
    });
    permanentVoiceConnection = connection;
    connection.on('error', (error) => {
      console.error(`Erro na conexão de voz com ${channel.name}:`, error);
    });
    connection.on(VoiceConnectionStatus.Ready, () => {
      if (permanentVoiceReconnectTimer) {
        clearTimeout(permanentVoiceReconnectTimer);
        permanentVoiceReconnectTimer = undefined;
      }
      console.log(`Conectado continuamente à call ${channel.name} em ${guild.name}.`);
    });
    connection.on(VoiceConnectionStatus.Disconnected, () => schedulePermanentVoiceReconnect(connection));
    connection.on(VoiceConnectionStatus.Destroyed, () => schedulePermanentVoiceReconnect(connection));

    await entersState(connection, VoiceConnectionStatus.Ready, 30_000);
  } catch (error) {
    console.error('Falha ao entrar na call Programando:', error);
    if (!permanentVoiceReconnectTimer) {
      permanentVoiceReconnectTimer = setTimeout(() => {
        permanentVoiceReconnectTimer = undefined;
        void connectToPermanentVoiceChannel();
      }, 30_000);
    }
  }
}

client.once('ready', () => {
  serverStatusBotOnline = true;
  console.log(`Conectado como ${client.user.tag}. Nome do dono: ${ownerDisplayName}.`);
  void connectToPermanentVoiceChannel();
  for (const guild of client.guilds.cache.values()) {
    void ensureStaffFeedbackPanel(guild).catch((error) => {
      console.error(`Falha ao iniciar o painel de avaliações em ${guild.name}:`, error);
    });
  }
  void initializeServerStatusPanel().catch((error) => {
    console.error('Falha ao iniciar o painel de status do servidor:', error);
  });
  const updatedAt = new Intl.DateTimeFormat('pt-BR', {
    timeZone: 'America/Sao_Paulo',
    day: '2-digit',
    month: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    hourCycle: 'h23',
  }).format(new Date());
  client.user.setActivity(`Atualizado: ${updatedAt} | /ajuda`);
});

client.on('guildMemberAdd', (member) => {
  recordServerVisit(member.guild.id, 'entries');
  if (member.guild.id === serverStatusGuildId) scheduleServerStatusRefresh();
  void handleBotJoin(member).catch((error) => {
    console.error(`Falha ao verificar a entrada de ${member.user.tag}:`, error);
  });
});

client.on('guildMemberRemove', (member) => {
  recordServerVisit(member.guild.id, 'exits');
  if (member.guild.id === serverStatusGuildId) scheduleServerStatusRefresh();
});

client.on('guildMemberUpdate', (oldMember, newMember) => {
  if (newMember.guild.id === serverStatusGuildId) scheduleServerStatusRefresh();
  void handleBoosterAdded(oldMember, newMember).catch((error) => {
    console.error(`Falha ao agradecer o boost de ${newMember.user.tag} no servidor ${newMember.guild.name}:`, error);
  });
});

client.on('presenceUpdate', (_oldPresence, newPresence) => {
  if (newPresence.guild?.id !== serverStatusGuildId) return;
  serverStatusPresenceAvailable = true;
  scheduleServerStatusRefresh();
});

client.on('shardDisconnect', () => {
  serverStatusBotOnline = false;
  scheduleServerStatusRefresh();
});

client.on('shardResume', () => {
  serverStatusBotOnline = true;
  scheduleServerStatusRefresh();
});

client.on('messageCreate', (message) => {
  void handleInstagramPhotoMessage(message).catch((error) => {
    console.error(`Falha ao transformar foto enviada por ${message.author?.tag ?? 'desconhecido'} no Instagram:`, error);
  });
  void handleTicketAssumeMessage(message).catch((error) => {
    console.error(`Falha ao assumir ticket no canal ${message.channelId}:`, error);
  });
  void handleSpamMessage(message).catch((error) => {
    console.error(`Falha ao verificar mensagem de ${message.author?.tag ?? 'desconhecido'}:`, error);
  });
});

client.on('interactionCreate', (interaction) => {
  void handleInteraction(interaction).catch(async (error) => {
    console.error(`Falha no comando ${interaction.commandName ?? 'desconhecido'}:`, error);
    try {
      await replyPrivate(interaction, 'Não foi possível concluir o comando. Confira permissões e tente novamente.');
    } catch (replyError) {
      console.error('Falha ao informar o erro ao usuário:', replyError);
    }
  });
});

client.on('error', (error) => console.error('Erro do cliente Discord:', error));
await client.login(token);
// ==========================================
// SEÇÃO DE HOSPEDAGEM GRÁTUA (KEEP-ALIVE)
// ==========================================
import http from 'http';

// 1. Cria um servidor web minúsculo
// Isso faz o Render tratar seu bot como um "site"
const server = http.createServer((req, res) => {
  // Se alguém acessar sua URL, retorna uma mensagem
  res.writeHead(200, { 'Content-Type': 'text/plain' });
  res.end('ALTA BOT está online!');
});

// 2. Inicia o servidor na porta certa
// O Render define a porta automaticamente via variável PORT
const port = process.env.PORT || 3000;
server.listen(port, () => {
  console.log(`[HOSPEDAGEM] Servidor de monitoramento ativo na porta ${port}`);
});

// 3. O "Pulsar" Interno (Keep-Alive)
// A cada 10 minutos, o bot acessa a si mesmo.
// Isso impede que o Render considere o bot ocioso.
setInterval(() => {
  fetch(`http://localhost:${port}/keepalive`)
    .then(res => console.log('[KEEP-ALIVE] Batimento de coração enviado com sucesso.'))
    .catch(err => console.error('[KEEP-ALIVE] Falha no batimento:', err));
}, 10 * 60 * 1000); // 10 minutos

// 4. Log de Status (Para você saber se está vivo)
setInterval(() => {
  const mem = (process.memoryUsage().heapUsed / 1024 / 1024).toFixed(2);
  console.log(`[STATUS] ${new Date().toISOString()} | Guilds: ${client.guilds.cache.size} | Memória: ${mem}MB`);
}, 30 * 60 * 1000); // 30 minutos

