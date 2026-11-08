import 'dotenv/config';
import { Client, GatewayIntentBits, REST, Routes } from 'discord.js';
import { commands } from './commands.js';

const { DISCORD_TOKEN: token, DISCORD_CLIENT_ID: clientId } = process.env;
if (!token || !clientId) {
  throw new Error('Configure DISCORD_TOKEN e DISCORD_CLIENT_ID no arquivo .env.');
}
if (!/^\d{17,20}$/.test(clientId)) {
  throw new Error('DISCORD_CLIENT_ID precisa ser o ID numérico da aplicação.');
}

const rest = new REST({ version: '10' }).setToken(token);
await rest.put(Routes.applicationCommands(clientId), { body: commands });

const client = new Client({ intents: [GatewayIntentBits.Guilds] });
try {
  await client.login(token);
  for (const guild of client.guilds.cache.values()) {
    await rest.put(Routes.applicationGuildCommands(clientId, guild.id), { body: [] });
    console.log(`Comandos duplicados locais removidos do servidor ${guild.name} (${guild.id}).`);
  }
  console.log(`${commands.length} comandos globais registrados.`);
} finally {
  client.destroy();
}
