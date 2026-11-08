import { ChannelType, SlashCommandBuilder } from 'discord.js';
import { botConfigGroups } from './bot-config.js';

export const commands = [
  new SlashCommandBuilder()
    .setName('ajuda')
    .setDescription('Lista os comandos do bot SÍRIA TE AMA.'),
  new SlashCommandBuilder()
    .setName('admin-grant')
    .setDescription('Autoriza uma pessoa como administradora deste bot (somente o dono).')
    .addUserOption((option) => option.setName('usuario').setDescription('Usuário a autorizar.').setRequired(true)),
  new SlashCommandBuilder()
    .setName('admin-revoke')
    .setDescription('Remove a autorização administrativa de uma pessoa (somente o dono).')
    .addUserOption((option) => option.setName('usuario').setDescription('Usuário a remover.').setRequired(true)),
  new SlashCommandBuilder()
    .setName('admin-list')
    .setDescription('Lista os administradores do bot (somente o dono).'),
  new SlashCommandBuilder()
    .setName('restart')
    .setDescription('Reinicia o processo do bot (dono, administrador do servidor ou autorizado).'),
  new SlashCommandBuilder()
    .setName('ban')
    .setDescription('Bane um membro deste servidor.')
    .addUserOption((option) => option.setName('usuario').setDescription('Membro a banir.').setRequired(true))
    .addStringOption((option) => option.setName('motivo').setDescription('Motivo.').setMaxLength(400).setRequired(true)),
  new SlashCommandBuilder()
    .setName('kick')
    .setDescription('Expulsa um membro deste servidor.')
    .addUserOption((option) => option.setName('usuario').setDescription('Membro a expulsar.').setRequired(true))
    .addStringOption((option) => option.setName('motivo').setDescription('Motivo.').setMaxLength(400).setRequired(true)),
  new SlashCommandBuilder()
    .setName('timeout')
    .setDescription('Aplica timeout temporário a um membro.')
    .addUserOption((option) => option.setName('usuario').setDescription('Membro.').setRequired(true))
    .addIntegerOption((option) => option.setName('minutos').setDescription('Duração entre 1 minuto e 28 dias.').setMinValue(1).setMaxValue(40320).setRequired(true))
    .addStringOption((option) => option.setName('motivo').setDescription('Motivo.').setMaxLength(400).setRequired(true)),
  new SlashCommandBuilder()
    .setName('untimeout')
    .setDescription('Remove o timeout de um membro.')
    .addUserOption((option) => option.setName('usuario').setDescription('Membro.').setRequired(true))
    .addStringOption((option) => option.setName('motivo').setDescription('Motivo.').setMaxLength(400).setRequired(true)),
  new SlashCommandBuilder()
    .setName('clear')
    .setDescription('Apaga até 100 mensagens recentes deste canal.')
    .addIntegerOption((option) => option.setName('quantidade').setDescription('Mensagens a apagar.').setMinValue(1).setMaxValue(100).setRequired(true)),
  new SlashCommandBuilder()
    .setName('dm')
    .setDescription('Envia uma DM individual a um membro deste servidor.')
    .addUserOption((option) => option.setName('usuario').setDescription('Único destinatário.').setRequired(true))
    .addStringOption((option) => option.setName('mensagem').setDescription('Texto; menções automáticas desativadas.').setMaxLength(1500).setRequired(true)),
  new SlashCommandBuilder()
    .setName('announce')
    .setDescription('Envia um aviso em um canal deste servidor.')
    .addChannelOption((option) => option.setName('canal').setDescription('Canal de destino.').addChannelTypes(ChannelType.GuildText, ChannelType.GuildAnnouncement).setRequired(true))
    .addStringOption((option) => option.setName('mensagem').setDescription('Texto; menções automáticas desativadas.').setMaxLength(1800).setRequired(true)),
  new SlashCommandBuilder()
    .setName('set-log')
    .setDescription('Define o canal de auditoria de moderação deste servidor.')
    .addChannelOption((option) => option.setName('canal').setDescription('Canal de logs.').addChannelTypes(ChannelType.GuildText, ChannelType.GuildAnnouncement).setRequired(true)),
  new SlashCommandBuilder()
    .setName('painel-ticket')
    .setDescription('Publica ou atualiza o painel de atendimento do servidor.')
    .addChannelOption((option) => option
      .setName('categoria-parceria')
      .setDescription('Categoria onde serão criados os tickets de parceria.')
      .addChannelTypes(ChannelType.GuildCategory)
      .setRequired(false))
    .addChannelOption((option) => option
      .setName('categoria-denuncia')
      .setDescription('Categoria onde serão criados os tickets de denúncia.')
      .addChannelTypes(ChannelType.GuildCategory)
      .setRequired(false))
    .addChannelOption((option) => option
      .setName('categoria-duvida')
      .setDescription('Categoria onde serão criados os tickets de dúvida.')
      .addChannelTypes(ChannelType.GuildCategory)
      .setRequired(false))
    .addStringOption((option) => option
      .setName('titulo')
      .setDescription('Título do painel (opcional).')
      .setMaxLength(200)
      .setRequired(false))
    .addStringOption((option) => option
      .setName('texto')
      .setDescription('Texto de apresentação do painel (opcional).')
      .setMaxLength(4000)
      .setRequired(false))
    .addStringOption((option) => option
      .setName('emoji-parceria')
      .setDescription('Emoji Unicode ou deste servidor para PARCERIA.')
      .setMaxLength(100)
      .setRequired(false))
    .addStringOption((option) => option
      .setName('emoji-denuncia')
      .setDescription('Emoji Unicode ou deste servidor para DENÚNCIA.')
      .setMaxLength(100)
      .setRequired(false))
    .addStringOption((option) => option
      .setName('emoji-duvida')
      .setDescription('Emoji Unicode ou deste servidor para DÚVIDA.')
      .setMaxLength(100)
      .setRequired(false))
    .addRoleOption((option) => option
      .setName('suporte')
      .setDescription('Cargo que terá acesso aos tickets (opcional).')
      .setRequired(false)),
  new SlashCommandBuilder()
    .setName('painel-tellonym')
    .setDescription('Publica o painel de mensagens anônimas neste servidor.'),
  new SlashCommandBuilder()
    .setName('painel-candidatura')
    .setDescription('Publica o painel de candidatura para a equipe neste servidor.'),
  new SlashCommandBuilder()
    .setName('painel-upamento')
    .setDescription('Abre em privado o painel de upamentos e rebaixamentos.'),
  new SlashCommandBuilder()
    .setName('configurar-bot')
    .setDescription('Abre as opções do bot (somente o dono).')
    .addStringOption((option) => option
      .setName('categoria')
      .setDescription('Escolha uma categoria para editar direto, ou abra o painel completo.')
      .setRequired(false)
      .addChoices(...botConfigGroups.map((group) => ({
        name: group.label,
        value: group.id,
      })))),
  new SlashCommandBuilder()
    .setName('export-assets')
    .setDescription('Envia em privado um ZIP com emojis e figurinhas de um servidor.')
    .addStringOption((option) => option
      .setName('servidor')
      .setDescription('ID do servidor; você precisa ser membro, sem permissão especial.')
      .setMinLength(17)
      .setMaxLength(20)
      .setRequired(false)),
  new SlashCommandBuilder()
    .setName('import-sticker')
    .setDescription('Instala uma figurinha pela URL direta do arquivo da CDN do Discord neste servidor.')
    .addStringOption((option) => option
      .setName('url')
      .setDescription('URL direta da figurinha em cdn.discordapp.com ou media.discordapp.net.')
      .setMaxLength(500)
      .setRequired(true))
    .addStringOption((option) => option
      .setName('nome')
      .setDescription('Nome para a figurinha (2 a 30 caracteres).')
      .setMinLength(2)
      .setMaxLength(30)
      .setRequired(true))
    .addStringOption((option) => option
      .setName('tag')
      .setDescription('Emoji Unicode da figurinha, por exemplo 😀.')
      .setMaxLength(200)
      .setRequired(true))
    .addStringOption((option) => option
      .setName('descricao')
      .setDescription('Descrição opcional.')
      .setMaxLength(100)
      .setRequired(false)),
  new SlashCommandBuilder()
    .setName('copy-sticker')
    .setDescription('Copia uma figurinha de servidor onde o bot também está.')
    .addStringOption((option) => option
      .setName('servidor-origem')
      .setDescription('ID do servidor onde você e o bot são membros; você não precisa de permissões.')
      .setMinLength(17)
      .setMaxLength(20)
      .setRequired(true))
    .addStringOption((option) => option
      .setName('figurinha')
      .setDescription('ID da figurinha que será copiada.')
      .setMinLength(17)
      .setMaxLength(20)
      .setRequired(true)),
].map((command) => command.toJSON());
