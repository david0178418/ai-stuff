import { $ } from 'bun';
import { OpenAI } from 'openai';

$.cwd('/home/dgranado/Projects/recruiting-crx');

const client = new OpenAI({
	baseURL: 'http://localhost:11434/v1',
});

const runner = await client.beta.chat.completions.runTools({
	// model: 'deepseek-r1:1.5b',
	// model: 'deepseek-r1:14b',
	// model: 'deepseek-r1:32b',
	// model: 'llama3:8b',
	// model: 'llama3:latest',
	model: 'llama3.2:1b-instruct-q8_0',
	// model: 'llama3.2:3b-instruct-fp16',
	// model: 'llava-phi3:latest',
	// model: 'llava:latest',
	// model: 'minicpm-v:latest',
	// model: 'mistral-small:24b',
	// model: 'qwen2.5-coder:1.5b',
	// model: 'vitali87/shell-commands-qwen2-1.5b-extended:latest',
	messages: [
		// { role: 'user', content: 'Why is the sky blue?' },
		{ role: 'system', content: 'You are a software engineer looking to research answers to questions related to a codebase of a project called Foo. It uses git for version control.' },
		{ role: 'user', content: 'When was the last commit to the project?' },
	],
	stream: true,
	tool_choice: 'auto',
	tools: [{
		type: 'function',
		function: {
			function: gitCommitHistory,
			parse: JSON.parse,
			description: 'Get commit history of the project',
			parameters: {
				type: "object",
				required: ["reasoning"],
				properties: {
					limit: {
						type: "number",
						description: "The number of commits to return.",
						default: 1,
					},
					verbose: {
						type: "boolean",
						description: "Whether to include verbose output.",
						default: 1,
					},
					reasoning: {
						type: "string",
						description: "Explanation for why this command is being run.",
					}
				}
			}
		}
	}],
})
.on('message', (message) => console.log(`MESSAGE: `, message));

async function cli({cmd, reasoning}: {cmd: string, reasoning: string}) {
	console.log(`REASON: ${reasoning}`);
	const x = `cd ../recruiting-crx && ${cmd}`
	console.log(`RUNNING: ${x}`);
	const result = await $`${x}`.text();
	console.log('RESULT:', result);
	return result;
}

async function gitCommitHistory(args: {limit?: number, reasoning: string, verbose?: boolean}) {
	const {
		limit = -1,
		verbose = false,
		reasoning
	} = args;
	console.log('REASON:', reasoning);
	console.log('RUNNING:', `git log -${limit}`);

	try {
		const result = await $`git log -${limit} ${verbose ? '-v' : ''}`.text();
		console.log('RESULT:', result);
		return result;
	} catch (error) {
		console.error('ERROR RUNNING CMD:', ((error as any).stderr as Buffer).toString() || '');
		return 'Thu Jan 30 18:02:28 2025 -0600';
	}
}

const finalContent = await runner.finalContent();
console.log('Final content:', finalContent);

