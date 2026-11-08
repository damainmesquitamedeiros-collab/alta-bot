import { mkdir, readFile, rename, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { botConfigDefaults, botConfigFields, parseBotConfigValue } from './bot-config.js';

const dataDirectory = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..', 'data');
const adminFile = path.join(dataDirectory, 'authorized-users.json');
const guildFile = path.join(dataDirectory, 'guild-settings.json');
const ticketRankingFile = path.join(dataDirectory, 'ticket-ranking.json');
const staffFeedbackFile = path.join(dataDirectory, 'staff-feedback.json');
const tellonymFile = path.join(dataDirectory, 'tellonym-posts.json');
const instagramFile = path.join(dataDirectory, 'instagram-posts.json');
const staffApplicationsFile = path.join(dataDirectory, 'staff-applications.json');
let ticketRankingWrite = Promise.resolve();
let staffFeedbackWrite = Promise.resolve();
let tellonymWrite = Promise.resolve();
let instagramWrite = Promise.resolve();
let guildSettingsWrite = Promise.resolve();
let staffApplicationsWrite = Promise.resolve();

async function readJson(file, fallback) {
  await mkdir(dataDirectory, { recursive: true });
  try {
    return JSON.parse(await readFile(file, 'utf8'));
  } catch (error) {
    if (error.code === 'ENOENT') return fallback;
    throw new Error(`Falha ao ler ${path.basename(file)}: ${error.message}`);
  }
}

async function writeJson(file, data) {
  await mkdir(dataDirectory, { recursive: true });
  const temporaryFile = `${file}.tmp`;
  await writeFile(temporaryFile, `${JSON.stringify(data, null, 2)}\n`, 'utf8');
  await rename(temporaryFile, file);
}

export async function getAuthorizedUserIds() {
  const data = await readJson(adminFile, { userIds: [] });
  if (!data || !Array.isArray(data.userIds) || data.userIds.some((id) => typeof id !== 'string' || !/^\d{17,20}$/.test(id))) {
    throw new Error('Formato inválido em data/authorized-users.json.');
  }
  return data.userIds;
}

export async function grantUser(userId) {
  const userIds = await getAuthorizedUserIds();
  if (!userIds.includes(userId)) {
    userIds.push(userId);
    await writeJson(adminFile, { userIds });
  }
  return userIds;
}

export async function revokeUser(userId) {
  const userIds = await getAuthorizedUserIds();
  const updated = userIds.filter((id) => id !== userId);
  if (updated.length !== userIds.length) await writeJson(adminFile, { userIds: updated });
  return updated;
}

async function getGuildSettings() {
  const data = await readJson(guildFile, { guilds: {} });
  if (!data?.guilds || typeof data.guilds !== 'object' || Array.isArray(data.guilds)) {
    throw new Error('Formato inválido em data/guild-settings.json.');
  }
  return data.guilds;
}

async function updateGuildSettings(update) {
  const operation = guildSettingsWrite.then(async () => {
    const guilds = await getGuildSettings();
    const result = await update(guilds);
    await writeJson(guildFile, { guilds });
    return result;
  });
  guildSettingsWrite = operation.then(() => undefined, () => undefined);
  return operation;
}

export async function getLogChannelId(guildId) {
  const guilds = await getGuildSettings();
  return guilds[guildId]?.logChannelId ?? null;
}

export async function setLogChannelId(guildId, channelId) {
  await updateGuildSettings((guilds) => {
    guilds[guildId] = { ...guilds[guildId], logChannelId: channelId };
  });
}

function validateServerStatusState(state, guildId) {
  if (!state || typeof state !== 'object' || Array.isArray(state)
      || (state.panelMessageId !== undefined
        && state.panelMessageId !== null
        && !/^\d{17,20}$/.test(state.panelMessageId))
      || (state.inviteUrl !== undefined
        && state.inviteUrl !== null
        && !/^https:\/\/(?:discord\.gg\/[A-Za-z0-9-]+|discord\.com\/invite\/[A-Za-z0-9-]+)$/.test(state.inviteUrl))
      || ['entries', 'exits'].some((key) => (
        state[key] !== undefined
        && (!Number.isSafeInteger(state[key]) || state[key] < 0)
      ))) {
    throw new Error(`Formato inválido do painel de status para o servidor ${guildId}.`);
  }
  return state;
}

export async function getServerStatusState(guildId) {
  if (!/^\d{17,20}$/.test(guildId)) throw new Error('ID inválido ao carregar o painel de status.');
  const guilds = await getGuildSettings();
  const state = validateServerStatusState(guilds[guildId]?.serverStatus ?? {}, guildId);
  return {
    panelMessageId: state.panelMessageId ?? null,
    inviteUrl: state.inviteUrl ?? null,
    entries: state.entries ?? 0,
    exits: state.exits ?? 0,
  };
}

export async function setServerStatusState(guildId, updates) {
  if (!/^\d{17,20}$/.test(guildId)
      || !updates
      || typeof updates !== 'object'
      || Array.isArray(updates)) {
    throw new Error('Dados inválidos ao salvar o painel de status.');
  }
  const allowedFields = new Set(['panelMessageId', 'inviteUrl', 'entries', 'exits']);
  for (const [key, value] of Object.entries(updates)) {
    if (!allowedFields.has(key)) throw new Error(`Campo inválido no painel de status: ${key}.`);
    if (key === 'panelMessageId' && value !== null && !/^\d{17,20}$/.test(value)) {
      throw new Error('ID inválido da mensagem do painel de status.');
    }
    if (key === 'inviteUrl' && value !== null
        && (typeof value !== 'string'
          || !/^https:\/\/(?:discord\.gg\/[A-Za-z0-9-]+|discord\.com\/invite\/[A-Za-z0-9-]+)$/.test(value))) {
      throw new Error('Link de convite inválido no painel de status.');
    }
    if (['entries', 'exits'].includes(key) && (!Number.isSafeInteger(value) || value < 0)) {
      throw new Error(`Contagem inválida para ${key} no painel de status.`);
    }
  }
  return updateGuildSettings((guilds) => {
    const current = validateServerStatusState(guilds[guildId]?.serverStatus ?? {}, guildId);
    guilds[guildId] = {
      ...guilds[guildId],
      serverStatus: { ...current, ...updates },
    };
  });
}

export async function incrementServerVisit(guildId, kind) {
  if (!/^\d{17,20}$/.test(guildId) || !['entries', 'exits'].includes(kind)) {
    throw new Error('Dados inválidos ao atualizar visitas do servidor.');
  }
  return updateGuildSettings((guilds) => {
    const current = validateServerStatusState(guilds[guildId]?.serverStatus ?? {}, guildId);
    const count = current[kind] ?? 0;
    if (!Number.isSafeInteger(count) || count < 0 || count === Number.MAX_SAFE_INTEGER) {
      throw new Error(`Contagem inválida de ${kind} no painel de status.`);
    }
    guilds[guildId] = {
      ...guilds[guildId],
      serverStatus: { ...current, [kind]: count + 1 },
    };
  });
}

export async function getBotConfig(guildId) {
  if (!/^\d{17,20}$/.test(guildId)) throw new Error('ID inválido ao carregar configurações do bot.');
  const guilds = await getGuildSettings();
  const stored = guilds[guildId]?.botConfig ?? {};
  if (!stored || typeof stored !== 'object' || Array.isArray(stored)) {
    throw new Error(`Formato inválido das configurações do bot para o servidor ${guildId}.`);
  }
  const config = { ...botConfigDefaults };
  for (const field of botConfigFields) {
    if (!Object.hasOwn(stored, field.key)) continue;
    const value = stored[field.key];
    if (typeof value !== typeof field.defaultValue) {
      throw new Error(`Formato inválido da opção “${field.key}” nas configurações do bot.`);
    }
    if (field.type === 'boolean' && typeof value !== 'boolean') {
      throw new Error(`Formato inválido da opção “${field.key}” nas configurações do bot.`);
    }
    const parsed = parseBotConfigValue(field, String(value));
    if (parsed !== value) {
      throw new Error(`Formato inválido da opção “${field.key}” nas configurações do bot.`);
    }
    config[field.key] = value;
  }
  return config;
}

export async function setBotConfig(guildId, updates) {
  if (!/^\d{17,20}$/.test(guildId)
      || !updates
      || typeof updates !== 'object'
      || Array.isArray(updates)) {
    throw new Error('Dados inválidos ao salvar configurações do bot.');
  }
  const allowedFields = new Map(botConfigFields.map((field) => [field.key, field]));
  const validatedUpdates = {};
  for (const [key, value] of Object.entries(updates)) {
    const field = allowedFields.get(key);
    if (!field || typeof value !== typeof field.defaultValue) {
      throw new Error(`Opção de configuração inválida: ${key}.`);
    }
    const parsed = parseBotConfigValue(field, String(value));
    if (parsed !== value) throw new Error(`Valor inválido para a opção “${field.label}”.`);
    validatedUpdates[key] = value;
  }

  await updateGuildSettings((guilds) => {
    guilds[guildId] = {
      ...guilds[guildId],
      botConfig: { ...guilds[guildId]?.botConfig, ...validatedUpdates },
    };
  });
}

function validateTellonymData(data) {
  if (!data?.posts || typeof data.posts !== 'object' || Array.isArray(data.posts)) {
    throw new Error('Formato inválido em data/tellonym-posts.json.');
  }
  for (const [messageId, post] of Object.entries(data.posts)) {
    if (!/^\d{17,20}$/.test(messageId)
        || !post
        || !/^\d{17,20}$/.test(post.guildId)
        || !/^\d{17,20}$/.test(post.channelId)
        || !['anonymous', 'public'].includes(post.mode)
        || typeof post.createdAt !== 'string'
        || !Array.isArray(post.likes)
        || post.likes.some((id) => typeof id !== 'string' || !/^\d{17,20}$/.test(id))
        || !Array.isArray(post.comments)
        || post.comments.some((comment) => (
          !comment
          || typeof comment.userId !== 'string'
          || !/^\d{17,20}$/.test(comment.userId)
          || typeof comment.username !== 'string'
          || typeof comment.text !== 'string'
          || typeof comment.createdAt !== 'string'
        ))) {
      throw new Error('Formato inválido de publicação em data/tellonym-posts.json.');
    }
  }
  return data;
}

async function updateTellonymData(update) {
  const operation = tellonymWrite.then(async () => {
    const data = validateTellonymData(await readJson(tellonymFile, { posts: {} }));
    const result = await update(data);
    await writeJson(tellonymFile, data);
    return result;
  });
  tellonymWrite = operation.then(() => undefined, () => undefined);
  return operation;
}

export async function recordTellonymPost({ messageId, guildId, channelId, mode }) {
  if (![messageId, guildId, channelId].every((id) => /^\d{17,20}$/.test(id))
      || !['anonymous', 'public'].includes(mode)) {
    throw new Error('Dados inválidos ao registrar uma publicação Tellonym.');
  }
  return updateTellonymData((data) => {
    data.posts[messageId] = {
      guildId,
      channelId,
      mode,
      createdAt: new Date().toISOString(),
      likes: [],
      comments: [],
    };
    const posts = Object.entries(data.posts)
      .sort((left, right) => left[1].createdAt.localeCompare(right[1].createdAt));
    for (const [oldMessageId] of posts.slice(0, Math.max(0, posts.length - 500))) {
      delete data.posts[oldMessageId];
    }
  });
}

export async function getTellonymPost(messageId) {
  const data = validateTellonymData(await readJson(tellonymFile, { posts: {} }));
  return data.posts[messageId] ?? null;
}

export async function toggleTellonymLike(messageId, userId) {
  if (!/^\d{17,20}$/.test(messageId) || !/^\d{17,20}$/.test(userId)) {
    throw new Error('ID inválido ao registrar uma curtida Tellonym.');
  }
  return updateTellonymData((data) => {
    const post = data.posts[messageId];
    if (!post) return null;
    const index = post.likes.indexOf(userId);
    const liked = index === -1;
    if (liked) post.likes.push(userId);
    else post.likes.splice(index, 1);
    return { liked, count: post.likes.length };
  });
}

export async function addTellonymComment(messageId, { userId, username, text }) {
  if (!/^\d{17,20}$/.test(messageId)
      || !/^\d{17,20}$/.test(userId)
      || typeof username !== 'string'
      || typeof text !== 'string'
      || !text.trim()
      || text.length > 500) {
    throw new Error('Dados inválidos ao registrar um comentário Tellonym.');
  }
  return updateTellonymData((data) => {
    const post = data.posts[messageId];
    if (!post) return null;
    if (post.comments.length >= 50) post.comments.shift();
    post.comments.push({
      userId,
      username,
      text: text.trim(),
      createdAt: new Date().toISOString(),
    });
    return post.comments.length;
  });
}

export async function getTellonymComments(messageId) {
  const post = await getTellonymPost(messageId);
  return post?.comments ?? null;
}

function validateInstagramData(data) {
  if (!data?.posts || typeof data.posts !== 'object' || Array.isArray(data.posts)) {
    throw new Error('Formato inválido em data/instagram-posts.json.');
  }
  for (const [messageId, post] of Object.entries(data.posts)) {
    if (!/^\d{17,20}$/.test(messageId)
        || !post
        || !/^\d{17,20}$/.test(post.guildId)
        || !/^\d{17,20}$/.test(post.channelId)
        || typeof post.createdAt !== 'string'
        || !Array.isArray(post.likes)
        || post.likes.some((id) => typeof id !== 'string' || !/^\d{17,20}$/.test(id))
        || !Array.isArray(post.comments)
        || post.comments.some((comment) => (
          !comment
          || typeof comment.userId !== 'string'
          || !/^\d{17,20}$/.test(comment.userId)
          || typeof comment.username !== 'string'
          || typeof comment.text !== 'string'
          || typeof comment.createdAt !== 'string'
        ))) {
      throw new Error('Formato inválido de publicação em data/instagram-posts.json.');
    }
  }
  return data;
}

async function updateInstagramData(update) {
  const operation = instagramWrite.then(async () => {
    const data = validateInstagramData(await readJson(instagramFile, { posts: {} }));
    const result = await update(data);
    await writeJson(instagramFile, data);
    return result;
  });
  instagramWrite = operation.then(() => undefined, () => undefined);
  return operation;
}

export async function recordInstagramPost({ messageId, guildId, channelId }) {
  if (![messageId, guildId, channelId].every((id) => /^\d{17,20}$/.test(id))) {
    throw new Error('Dados inválidos ao registrar uma publicação do Instagram.');
  }
  return updateInstagramData((data) => {
    data.posts[messageId] = {
      guildId,
      channelId,
      createdAt: new Date().toISOString(),
      likes: [],
      comments: [],
    };
    const posts = Object.entries(data.posts)
      .sort((left, right) => left[1].createdAt.localeCompare(right[1].createdAt));
    for (const [oldMessageId] of posts.slice(0, Math.max(0, posts.length - 500))) {
      delete data.posts[oldMessageId];
    }
  });
}

export async function deleteInstagramPost(messageId) {
  if (!/^\d{17,20}$/.test(messageId)) {
    throw new Error('ID inválido ao remover uma publicação do Instagram.');
  }
  return updateInstagramData((data) => {
    delete data.posts[messageId];
  });
}

export async function getInstagramPost(messageId) {
  const data = validateInstagramData(await readJson(instagramFile, { posts: {} }));
  return data.posts[messageId] ?? null;
}

export async function toggleInstagramLike(messageId, userId) {
  if (!/^\d{17,20}$/.test(messageId) || !/^\d{17,20}$/.test(userId)) {
    throw new Error('ID inválido ao registrar uma curtida do Instagram.');
  }
  return updateInstagramData((data) => {
    const post = data.posts[messageId];
    if (!post) return null;
    const index = post.likes.indexOf(userId);
    const liked = index === -1;
    if (liked) post.likes.push(userId);
    else post.likes.splice(index, 1);
    return { liked, count: post.likes.length };
  });
}

export async function addInstagramComment(messageId, { userId, username, text }) {
  if (!/^\d{17,20}$/.test(messageId)
      || !/^\d{17,20}$/.test(userId)
      || typeof username !== 'string'
      || typeof text !== 'string'
      || !text.trim()
      || text.length > 500) {
    throw new Error('Dados inválidos ao registrar um comentário do Instagram.');
  }
  return updateInstagramData((data) => {
    const post = data.posts[messageId];
    if (!post) return null;
    if (post.comments.length >= 50) post.comments.shift();
    post.comments.push({
      userId,
      username,
      text: text.trim(),
      createdAt: new Date().toISOString(),
    });
    return post.comments.length;
  });
}

export async function getInstagramComments(messageId) {
  const post = await getInstagramPost(messageId);
  return post?.comments ?? null;
}

function validateStaffApplicationsData(data) {
  if (!data?.applications || typeof data.applications !== 'object' || Array.isArray(data.applications)) {
    throw new Error('Formato inválido em data/staff-applications.json.');
  }
  for (const [messageId, application] of Object.entries(data.applications)) {
    if (!/^\d{17,20}$/.test(messageId)
        || !application
        || !/^\d{17,20}$/.test(application.guildId)
        || !/^\d{17,20}$/.test(application.userId)
        || (application.channelId !== undefined && !/^\d{17,20}$/.test(application.channelId))
        || !['pending', 'processing', 'approved', 'rejected'].includes(application.status)
        || typeof application.createdAt !== 'string'
        || !application.answers
        || typeof application.answers !== 'object'
        || Array.isArray(application.answers)
        || Object.values(application.answers).some((answer) => typeof answer !== 'string')
        || (application.reviewerId !== null && !/^\d{17,20}$/.test(application.reviewerId))
        || (application.decision !== null && !['approved', 'rejected'].includes(application.decision))) {
      throw new Error('Formato inválido de candidatura em data/staff-applications.json.');
    }
  }
  return data;
}

async function updateStaffApplications(update) {
  const operation = staffApplicationsWrite.then(async () => {
    const data = validateStaffApplicationsData(await readJson(staffApplicationsFile, { applications: {} }));
    const result = await update(data);
    await writeJson(staffApplicationsFile, data);
    return result;
  });
  staffApplicationsWrite = operation.then(() => undefined, () => undefined);
  return operation;
}

export async function getPendingStaffApplications(guildId, userId) {
  if (![guildId, userId].every((id) => /^\d{17,20}$/.test(id))) {
    throw new Error('ID inválido ao procurar candidatura de staff.');
  }
  const data = validateStaffApplicationsData(await readJson(staffApplicationsFile, { applications: {} }));
  return Object.entries(data.applications)
    .filter(([, application]) => (
      application.guildId === guildId
      && application.userId === userId
      && ['pending', 'processing'].includes(application.status)
    ))
    .map(([messageId, application]) => ({
      messageId,
      channelId: application.channelId ?? null,
      status: application.status,
    }));
}

export async function deletePendingStaffApplication(messageId) {
  if (!/^\d{17,20}$/.test(messageId)) {
    throw new Error('ID inválido ao remover candidatura pendente de staff.');
  }
  return updateStaffApplications((data) => {
    const application = data.applications[messageId];
    if (!application || application.status !== 'pending') return false;
    delete data.applications[messageId];
    return true;
  });
}

export async function recordStaffApplication({ messageId, guildId, channelId, userId, answers }) {
  if (![messageId, guildId, channelId, userId].every((id) => /^\d{17,20}$/.test(id))
      || !answers
      || typeof answers !== 'object'
      || Array.isArray(answers)
      || Object.values(answers).some((answer) => typeof answer !== 'string')) {
    throw new Error('Dados inválidos ao registrar candidatura de staff.');
  }
  return updateStaffApplications((data) => {
    if (data.applications[messageId]) throw new Error('Esta candidatura já foi registrada.');
    const alreadyPending = Object.values(data.applications).some((application) => (
      application.guildId === guildId
      && application.userId === userId
      && ['pending', 'processing'].includes(application.status)
    ));
    if (alreadyPending) throw new Error('Este usuário já tem uma candidatura aguardando análise.');
    data.applications[messageId] = {
      guildId,
      userId,
      channelId,
      answers,
      status: 'pending',
      decision: null,
      reviewerId: null,
      createdAt: new Date().toISOString(),
    };
  });
}

export async function getStaffApplication(messageId) {
  if (!/^\d{17,20}$/.test(messageId)) throw new Error('ID inválido ao buscar candidatura de staff.');
  const data = validateStaffApplicationsData(await readJson(staffApplicationsFile, { applications: {} }));
  return data.applications[messageId] ?? null;
}

export async function claimStaffApplication(messageId, reviewerId, decision) {
  if (!/^\d{17,20}$/.test(messageId)
      || !/^\d{17,20}$/.test(reviewerId)
      || !['approved', 'rejected'].includes(decision)) {
    throw new Error('Dados inválidos ao revisar candidatura de staff.');
  }
  return updateStaffApplications((data) => {
    const application = data.applications[messageId];
    if (!application || application.status !== 'pending') return null;
    application.status = 'processing';
    application.decision = decision;
    application.reviewerId = reviewerId;
    return application;
  });
}

export async function completeStaffApplication(messageId) {
  if (!/^\d{17,20}$/.test(messageId)) throw new Error('ID inválido ao concluir candidatura de staff.');
  return updateStaffApplications((data) => {
    const application = data.applications[messageId];
    if (!application || application.status !== 'processing' || !application.decision) return null;
    application.status = application.decision;
    return application;
  });
}

export async function releaseStaffApplication(messageId) {
  if (!/^\d{17,20}$/.test(messageId)) throw new Error('ID inválido ao liberar candidatura de staff.');
  return updateStaffApplications((data) => {
    const application = data.applications[messageId];
    if (!application || application.status !== 'processing') return false;
    application.status = 'pending';
    application.decision = null;
    application.reviewerId = null;
    return true;
  });
}

export async function recordHandledTicket(userId, ticketId) {
  if (!/^\d{17,20}$/.test(userId) || !/^\d{17,20}$/.test(ticketId)) {
    throw new Error('ID inválido ao registrar atendimento no ranking.');
  }
  const operation = ticketRankingWrite.then(async () => {
    const data = validateTicketRankingData(await readJson(ticketRankingFile, { tickets: {} }));
    if (data.tickets[ticketId]) return getTicketHandlerRanking(data);
    data.tickets[ticketId] = { userId, closedAt: new Date().toISOString() };
    await writeJson(ticketRankingFile, data);
    return getTicketHandlerRanking(data);
  });
  ticketRankingWrite = operation.then(() => undefined, () => undefined);
  return operation;
}

function validateTicketRankingData(data) {
  if (!data?.tickets || typeof data.tickets !== 'object' || Array.isArray(data.tickets)) {
    throw new Error('Formato inválido em data/ticket-ranking.json.');
  }
  for (const [ticketId, entry] of Object.entries(data.tickets)) {
    if (!/^\d{17,20}$/.test(ticketId)
        || !entry
        || !/^\d{17,20}$/.test(entry.userId)
        || typeof entry.closedAt !== 'string') {
      throw new Error('Formato inválido de atendimento em data/ticket-ranking.json.');
    }
  }
  return data;
}

function validateStaffFeedbackData(data) {
  if (!data?.tickets || typeof data.tickets !== 'object' || Array.isArray(data.tickets)) {
    throw new Error('Formato inválido em data/staff-feedback.json.');
  }
  for (const [ticketId, ticket] of Object.entries(data.tickets)) {
    if (!/^\d{17,20}$/.test(ticketId)
        || !ticket
        || !/^\d{17,20}$/.test(ticket.guildId)
        || !/^\d{17,20}$/.test(ticket.requesterId)
        || !/^\d{17,20}$/.test(ticket.staffId)
        || typeof ticket.ticketName !== 'string'
        || typeof ticket.ticketType !== 'string'
        || typeof ticket.serverName !== 'string'
        || typeof ticket.closedAt !== 'string'
        || (ticket.review !== null
          && (!ticket.review
            || ticket.review.reviewerId !== ticket.requesterId
            || !Number.isInteger(ticket.review.rating)
            || ticket.review.rating < 1
            || ticket.review.rating > 5
            || typeof ticket.review.comment !== 'string'
            || ticket.review.comment.length > 500
            || typeof ticket.review.reviewedAt !== 'string'
            || !/^\d{17,20}$/.test(ticket.review.messageId)))) {
      throw new Error('Formato inválido de avaliação de Staff em data/staff-feedback.json.');
    }
  }
  return data;
}

async function updateStaffFeedbackData(update) {
  const operation = staffFeedbackWrite.then(async () => {
    const data = validateStaffFeedbackData(await readJson(staffFeedbackFile, { tickets: {} }));
    const result = await update(data);
    await writeJson(staffFeedbackFile, data);
    return result;
  });
  staffFeedbackWrite = operation.then(() => undefined, () => undefined);
  return operation;
}

export async function recordStaffFeedbackRequest({
  ticketId,
  guildId,
  requesterId,
  staffId,
  ticketName,
  ticketType,
  serverName,
}) {
  if (![ticketId, guildId, requesterId, staffId].every((id) => /^\d{17,20}$/.test(id))
      || typeof ticketName !== 'string'
      || !ticketName
      || typeof ticketType !== 'string'
      || !ticketType
      || typeof serverName !== 'string'
      || !serverName) {
    throw new Error('Dados inválidos ao registrar o pedido de avaliação de Staff.');
  }
  return updateStaffFeedbackData((data) => {
    const existing = data.tickets[ticketId];
    if (existing) return existing;
    const ticket = {
      guildId,
      requesterId,
      staffId,
      ticketName: ticketName.slice(0, 100),
      ticketType: ticketType.slice(0, 50),
      serverName: serverName.slice(0, 100),
      closedAt: new Date().toISOString(),
      review: null,
    };
    data.tickets[ticketId] = ticket;
    return ticket;
  });
}

export async function getStaffFeedbackRequest(ticketId) {
  if (!/^\d{17,20}$/.test(ticketId)) throw new Error('ID inválido ao carregar uma avaliação de Staff.');
  await staffFeedbackWrite;
  const data = validateStaffFeedbackData(await readJson(staffFeedbackFile, { tickets: {} }));
  return data.tickets[ticketId] ?? null;
}

export async function recordStaffFeedback(ticketId, {
  reviewerId,
  rating,
  comment,
  messageId,
}) {
  if (!/^\d{17,20}$/.test(ticketId)
      || !/^\d{17,20}$/.test(reviewerId)
      || !Number.isInteger(rating)
      || rating < 1
      || rating > 5
      || typeof comment !== 'string'
      || comment.length > 500
      || !/^\d{17,20}$/.test(messageId)) {
    throw new Error('Dados inválidos ao salvar uma avaliação de Staff.');
  }
  return updateStaffFeedbackData((data) => {
    const ticket = data.tickets[ticketId];
    if (!ticket || ticket.requesterId !== reviewerId || ticket.review) return null;
    ticket.review = {
      reviewerId,
      rating,
      comment,
      reviewedAt: new Date().toISOString(),
      messageId,
    };
    return ticket;
  });
}

export async function getStaffFeedbackSummary(userId) {
  if (!/^\d{17,20}$/.test(userId)) throw new Error('ID inválido ao carregar estatísticas de avaliação de Staff.');
  await Promise.all([ticketRankingWrite, staffFeedbackWrite]);
  const [rankingData, feedbackData] = await Promise.all([
    readJson(ticketRankingFile, { tickets: {} }),
    readJson(staffFeedbackFile, { tickets: {} }),
  ]);
  const counts = getTicketHandlerCounts(validateTicketRankingData(rankingData));
  const tickets = validateStaffFeedbackData(feedbackData);
  const reviews = Object.values(tickets.tickets)
    .map((ticket) => ticket.staffId === userId ? ticket.review : null)
    .filter(Boolean);
  return {
    tickets: counts.get(userId) ?? 0,
    reviews: reviews.length,
    average: reviews.length
      ? reviews.reduce((sum, review) => sum + review.rating, 0) / reviews.length
      : 0,
  };
}

function getTicketHandlerRanking(data) {
  const counts = getTicketHandlerCounts(data);
  return [...counts.entries()]
    .map(([userId, tickets]) => ({ userId, tickets }))
    .sort((left, right) => right.tickets - left.tickets || left.userId.localeCompare(right.userId))
    .slice(0, 6);
}

function getTicketHandlerCounts(data) {
  const counts = new Map();
  for (const entry of Object.values(data.tickets)) {
    counts.set(entry.userId, (counts.get(entry.userId) ?? 0) + 1);
  }
  return counts;
}
