const Discord = require('discord.js');
const client = new Discord.Client();
const config = require('./config.json');
const EmojiCore = config.token;
const prefix = config.prefix;
const PREFIX = prefix;
const adminfile = config.admins;
const { Users, CurrencyShop } = require('./dbObjects');
const currency = new Discord.Collection();
const coin = config.coin;
const clean = text => {
  if (typeof(text) === "string")
    return text.replace(/`/g, "`" + String.fromCharCode(8203)).replace(/@/g, "@" + String.fromCharCode(8203));
  else
      return text;
}
Reflect.defineProperty(currency, 'add', {
	value: async function add(id, amount) {
		const user = currency.get(id);
		if (user) {
			user.balance += Number(amount);
			return user.save();
		}
		const newUser = await Users.create({ user_id: id, balance: amount });
		currency.set(id, newUser);
		return newUser;
	},
});

Reflect.defineProperty(currency, 'getBalance', {
	value: function getBalance(id) {
		const user = currency.get(id);
		return user ? user.balance : 0;
	},
});

client.once('ready', async () => {
	const storedBalances = await Users.findAll();
	storedBalances.forEach(b => currency.set(b.user_id, b));
	console.log(`Logged in as ${client.user.tag}`);
});


client.on('message', async message => {
  if(message.content.startsWith(prefix+"spawn")) {
    if(message.author.id !== "194509651725910018") return message.channel.send("You need Permission: Creator");
    const target = message.author;
    var amount = message.content.split(" ").slice(1).join(" ")
    if(!amount) return message.reply("How much to give?")
    currency.add(message.author.id, amount);
    message.channel.send("Admin Protocol Spawn: Spawned "+amount)
}

  if(message.content.startsWith(prefix+"remove")) {
    if(message.author.id !== "194509651725910018") return message.channel.send("You need Permission: Creator");
    const target = message.author;
    var amount = message.content.split(" ").slice(1).join(" ")
    if(!amount) return message.reply("How much to take?")
    currency.add(message.author.id, -amount);
    message.channel.send("Admin Protocol Take: Took "+amount)
}

  if(message.content.startsWith(prefix+"transfer")) {
    if(message.author.id !== "194509651725910018") return message.channel.send("You need Permission: Creator");
    const me = message.author;
    const user = message.mentions.users.first();
    var amount = message.content.split(" ").slice(2).join(" ")
    if(!amount) return message.reply("How much to take?")
    currency.add(me.id, amount);
    currency.add(user.id, -amount);
    message.channel.send("Transfered `"+user+":"+amount+"` to you")
  }
  const args = message.content.split(" ").slice(1);

  if (message.content.startsWith(prefix + "eval")) {
    if(message.author.id !== "194509651725910018") return;
    try {
      const code = args.join(" ");
      let evaled = eval(code);

      if (typeof evaled !== "string")
        evaled = require("util").inspect(evaled);

      message.channel.send(clean(evaled), {code:"xl"});
    } catch (err) {
      message.channel.send(`\`ERROR\` \`\`\`xl\n${clean(err)}\n\`\`\``);
    }
  }
});
client.on('message', async message => {
	if (message.author.bot) return;
	//currency.add(message.author.id, 1);

	if (!message.content.startsWith(PREFIX)) return;
	const input = message.content.slice(PREFIX.length).trim();
	if (!input.length) return;
	const [, command, commandArgs] = input.match(/(\w+)\s*([\s\S]*)/);

	if (command === 'balance' || (command === 'bal') || (command === 'money')) {

		const target = message.mentions.users.first() || message.author;
		return message.channel.send(`${target.tag} has ${currency.getBalance(target.id)}${coin}`);

	}

	else if (command === 'inventory' || (command === 'inv')) {

		const target = message.mentions.users.first() || message.author;
		const user = await Users.findOne({ where: { user_id: target.id } });
		const items = await user.getItems();

		if (!items.length) message.channel.send(`${target.tag} has nothing!`);
		return message.channel.send(`${target.tag} currently has ${items.map(t => `${t.amount} ${t.item.name}`).join(', ')}`);

	}
	else if (command === 'give' || (command === 'pay')) {

		const currentAmount = currency.getBalance(message.author.id);
		const transferAmount = commandArgs.split(/ +/).find(arg => !/<@!?\d+>/.test(arg));
		const transferTarget = message.mentions.users.first();
    if(!transferTarget) return message.channel.send("Who would you like to pay?")
 		if (!transferAmount || isNaN(transferAmount)) return message.channel.send(`Sorry ${message.author}, that's an invalid amount`);
		if (transferAmount > currentAmount) return message.channel.send(`Sorry ${message.author} you don't have that much.`);
		if (transferAmount <= 0) return message.channel.send(`Please enter an amount greater than zero, ${message.author}`);

		currency.add(message.author.id, -transferAmount);
		currency.add(transferTarget.id, transferAmount);

		return message.channel.send(`Successfully transferred ${transferAmount}${coin} to ${transferTarget.tag}. Your current balance is ${currency.getBalance(message.author.id)}${coin}`);

	}
	else if (command === 'buy') {

		const item = await CurrencyShop.findOne({ where: { name: { $iLike: commandArgs } } });
		if (!item) return message.channel.send('That item doesn\'t exist.');
		if (item.cost > currency.getBalance(message.author.id)) {
			return message.channel.send(`You don't have enough currency, ${message.author}`);
		}

		const user = await Users.findOne({ where: { user_id: message.author.id } });
		currency.add(message.author.id, -item.cost);
		await user.addItem(item);

		message.channel.send(`You've bought a ${item.name}`);

	}
	else if (command === 'shop') {

		const items = await CurrencyShop.findAll();
		return message.channel.send(items.map(i => `${i.name}: ${i.cost}${coin}`).join('\n'), { code: true });

	}
	else if (command === 'leaderboard' || (command === 'top')) {

		return message.channel.send(
			currency.sort((a, b) => b.balance - a.balance)
				.filter(user => client.users.has(user.user_id))
				.first(10)
				.map((user, position) => `(${position + 1}) ${(client.users.get(user.user_id).tag)}: ${user.balance}${coin}`)
				.join('\n'),
			{ code: false }
		);
	}

});

client.login(process.env.BOT_TOKEN); //stop looking for my token >;(
